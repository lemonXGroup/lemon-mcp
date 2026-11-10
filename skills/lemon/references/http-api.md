# Direct WebControl HTTP API

Rewrite matching updated 2026-11-10 against the App query/host commits; other routes retain their 2026-11-07 source check. These are **HTTP payloads**, not MCP tool arguments. All operations below use the current token header; feature/licensing gates still apply. Older phones may lack routes. See [connection](connection.md) for the Python helper, errors and binary output.

The helper prints an envelope; device JSON is under body. Some routes return a bare array or {total,items}, others {success,...}; do not assume one common device wrapper. An HTTP 200 may contain success:false. GET reads do not require starting capture.

## Contents

[Device](#device-preferences-and-embedded-browser) · [HTTP traffic](#http-traffic-and-bodies) · [WebSocket](#websocket-records) · [Rewrite](#rewrite-policies) · [JavaScript](#rewrite-javascript-packages) · [Remote scripts](#remote-script-sources) · [Schedules](#scheduled-scripts) · [Replay](#saved--one-shot-replay) · [Workspace](#replay-workspace) · [DNS](#native-dns-hosts) · [Modules](#modules) · [Files/logs/database](#files-logs-and-database)

## Device, preferences and embedded browser

| Method / path | Input | Result / use |
| --- | --- | --- |
| GET /api/env | None | Authenticated device/system, isConnected, certificate/MITM state |
| GET /api/preferences | None | Read preferences; no general-purpose setter |
| POST /api/vpn/start | No body | Requests start; confirm isConnected by GET /api/env |
| POST /api/vpn/stop | No body | Requests stop; confirm by GET /api/env |
| POST /api/webview/open | JSON {"url":"https://example.com"} | Open phone's embedded browser; real navigation |
| POST /api/webview/close | No body | Close embedded browser |
| POST /api/webview/refresh, /back, /forward | No body | Accepted action, or webview_not_open |

/api/status is public liveness only. Direct HTTP clients must not use /api/mcp/ping to impersonate an MCP session.

## HTTP traffic and bodies

| Method / path | Query | Device response |
| --- | --- | --- |
| GET /api/requests | limit (default 50), offset (default 0), q (optional) | {total,items} summaries |
| GET /api/requests/detail | id from a summary | {success,item} authoritative detail |
| GET /api/body | path from returned body metadata, optional mime | Raw bytes; use --output for lossless download |
| POST /api/requests/clear | None | Deletes captured HTTP records/body files |

q is fuzzy search. There is **no host query parameter** on /api/requests: exact-host filtering requires checking returned hosts/URLs and paging enough records. Do not infer a complete search from one page or claim a preview is the whole body. Preserve large request IDs as strings; follow returned paths rather than guessing filesystem locations. /api/body is restricted to the bodies directory.

## WebSocket records

| Method / path | Query |
| --- | --- |
| GET /api/websocket/records | trace_id (UInt64 decimal string, required); before (Int64 cursor), kind (default message), q, limit (1..200, default 100) |
| GET /api/websocket/detail | trace_id and id (record identifier) |
| GET /api/websocket/export | trace_id; returns raw application/x-ndjson |

List returns items, has_more, latest_id and next_before. Use next_before for older pages; preserve identifiers as strings. HTTP Upgrade support does not imply H2/H3 extended CONNECT support. Check capture status, unsupported reasons and gaps before attributing missing messages to the network.

## Rewrite policies

Read the complete [rules/action reference](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/rewrite-rules.md) before generating groups or configs.

| Method / path | Input |
| --- | --- |
| GET /api/rewrite | Bare array of policies with portable groups, except protected content |
| GET /api/rewrite/capabilities | Read live host_wildcards and multipart request body flags, and portable_schema_versions |
| POST /api/rewrite | JSON {"rule":{name,enabled,priority},"groups":[...]} |
| PUT /api/rewrite | Same complete payload, with existing rule.id |
| DELETE /api/rewrite | Query id = policy's numeric ID |
| GET /api/rewrite/status | Runtime configuration/application state |
| POST /api/rewrite/reload | No body; request runtime reload |
| GET /api/rewrite/debug-events | Query limit (default 200), offset, trace_id, event_type, level |
| POST /api/rewrite/debug-events/clear | Optional query trace_id; omission clears all events |
| GET /api/rewrite/license/audit | Query limit (default 100), offset |

Rule metadata accepts name, enabled, priority, optional id. Submit groups as a JSON array, not groups_json. action.config remains a JSON string. Before updating, split a returned policy into allowed rule metadata and full portable groups: do not blindly echo stored timestamps, DRM fields or schema projections into rule. Do not include legacy top-level actions/matchHost fields.

Each group has unique lowercase UUID group_key; order equals array position. Action order equals action position. Omit local group/action/condition IDs and foreign keys. Preserve unrelated actions and group_key on edits. To enable/disable a policy, PUT its complete groups with rule.enabled changed. No dedicated global Rewrite/JS switch setter exists here.

Default conditions accept host/path/query/method and eq/prefix/suffix/contains/regex. Query targets the raw query string without leading ?, excluding fragments; preserve encoding, case and order. Use (^|&)packageId=1(&|$) for an exact query parameter. In expression mode, retained default conditions are inactive. Host non-regex * and ? need host_wildcards supported=true, version>=1, root_domain=true and all four operators; only the leading *. includes root and subdomains. Direct HTTP calls do not pass through the MCP preflight: read capabilities yourself before saving wildcard rules. Keep existing ids/groups when disabling an old rule. Host wildcard shares use version 5 and backups 6, including inactive conditions; query has no format version bump. Do not add portable schema_version to local rule metadata.

Optional remote_scripts carries atomic remote drafts alongside a rule. Use the exact lifecycle from [remote sources](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/remote-scripts.md); the HTTP value is an array, unlike MCP remote_scripts_json.

## Rewrite JavaScript packages

Read the full [JavaScript API](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.md) / [中文 API](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.zh-CN.md) before writing code.

| Method / path | Input |
| --- | --- |
| GET /api/rewrite/scripts | Bare array of script metadata |
| GET /api/rewrite/scripts/package | Query id, optional revision |
| GET /api/rewrite/scripts/revisions | Query id |
| POST /api/rewrite/scripts/validate | JSON {manifest,modules}; validates without saving |
| POST /api/rewrite/scripts | JSON {name,manifest,modules}; creates script |
| PUT /api/rewrite/scripts | JSON {id,name?,manifest,modules}; publishes new revision |
| POST /api/rewrite/scripts/rollback | JSON {id,revision} |
| DELETE /api/rewrite/scripts | Query id |

manifest/modules are objects/arrays, not JSON strings. There is **no HTTP content shorthand** and no enabled input for publishing. The MCP tool converts its shorthand before calling HTTP. Manifest modules is a list of paths, while the outer modules list contains {module_id,source}. Validation success does not prove handler effects on real traffic.

Minimal side-effect-free package to validate (add name to create, id to update):

~~~json
{
  "manifest": {
    "packageVersion": 1, "format": "esm", "entry": "./main.js", "modules": ["./main.js"],
    "permissions": {"log":false,"store":false,"http":false,"notify":false,"utils":false}
  },
  "modules": [{"module_id":"main.js","source":"export async function onResponse(ctx) { return {}; }"}]
}
~~~

Create the script, read back its actual id, then bind an action with the relevant scope and string config containing script_id and phase. A saved package by itself is not a traffic rule.

## Remote script sources

| Method / path | Input |
| --- | --- |
| GET /api/rewrite/scripts/remote | Query id |
| POST /api/rewrite/scripts/remote/prepare | JSON {descriptor,required_handlers?} |
| POST /api/rewrite/scripts/remote | JSON {token,name} from prepare |
| PUT /api/rewrite/scripts/remote | JSON {id,generation,descriptor}; generation is the current source generation |
| POST /api/rewrite/scripts/remote/refresh | JSON {id} |
| POST /api/rewrite/scripts/remote/copy | JSON {id,name?} |

Prepare downloads/validates on the phone and returns a candidate token (600 seconds, caller-bound, persisted:false). This candidate is distinct from the connection credential. Keep it within the same credential context and out of user-facing logs/chat. For an unsaved rule, commit via remote_scripts atomically rather than creating a standalone script unless requested. Configuration changes require refresh to install new code. Use a longer explicit --timeout (e.g. 75) for remote fetches; no automatic retries.

Descriptor format, SHA256 pinning, permission ceilings and generation/revision CAS are in the remote reference. Direct HTTP is not constrained by the old public MCP required_handlers enum; the phone implementation/version remains authoritative for WS support. Remote code is installed as a validated local snapshot; runtime remote URL imports remain unsupported.

## Scheduled scripts

| Method / path | Input |
| --- | --- |
| GET /api/scripts/scheduled | {success,tasks} summaries |
| GET /api/scripts/scheduled/detail | Query id |
| GET /api/scripts/scheduled/status | Scheduler status; may return 503 scheduled_task_runtime_unavailable |
| GET /api/scripts/scheduled/runs | Query task_id required, limit (default 50) |
| POST /api/scripts/scheduled | JSON create payload below |
| PUT /api/scripts/scheduled | Complete payload plus positive id and required enabled |
| POST /api/scripts/scheduled/toggle | JSON {id,enabled} |
| DELETE /api/scripts/scheduled | Query id |

Create/update fields: name, script (required string, use empty string with packages), schedule_type (cron or interval), cron_expr for cron, interval_ms for interval, script_type (single or package), script_package for package, enabled, runtime_requirement. Current runtime_requirement accepts only vpn. Cron and interval are mutually exclusive; interval is 250..86400000 ms. Creation defaults enabled=true: explicitly choose the state that matches the user's request. Running requires the PacketTunnel scheduler; a persisted task is not proof it executed.

A disabled single-file interval draft:

~~~json
{
  "name":"Example scheduled task", "schedule_type":"interval", "interval_ms":60000,
  "script_type":"single", "script":"export async function onSchedule(input) { return {}; }",
  "enabled":false, "runtime_requirement":"vpn"
}
~~~

Package tasks require onSchedule from the manifest entry; permissions and host APIs follow the script API. HTTP write payload names use snake_case; detail may encode the native model with different keys. Map the documented fields rather than echoing the entire detail object. Run history includes status/result/error and *_at_ns decimal strings. Use status and recent runs to verify execution; do not invent a run-now route.

## Saved / one-shot Replay

| Method / path | Input |
| --- | --- |
| GET /api/replay/items | {success,items} |
| GET /api/replay/items/detail | Query id (UUID) |
| POST /api/replay/items | JSON request payload |
| PUT /api/replay/items | Complete request payload with existing id |
| DELETE /api/replay/items | Query id |
| POST /api/replay/items/execute | JSON {id}; sends a real request |
| POST /api/replay/execute | JSON request payload; sends without saving |

Request payload: url, method, headers (string map), body (optional string), name?, enabled?, disabled_headers? (array of case-insensitive header names); id only for update. Headers defaults to an empty map, so preserve existing headers on update. body is text, not arbitrary base64. Execution returns status/headers/body preview metadata; respect body_truncated (2 MiB preview cap). Choose target, auth, body and side effects according to the user's task. These are phone-side requests, not helper-side HTTP to the replay destination.

## Replay Workspace

See [Workspace definitions and pagination](replay-workspace.md). Important routes:

| Method / path | Input |
| --- | --- |
| GET /api/replay/suites | {success,suites} |
| POST /api/replay/suites | Full native ReplaySuite JSON |
| PUT /api/replay/suites | Full native ReplaySuite JSON with existing id |
| DELETE /api/replay/suites | Query id = suite UUID |
| POST /api/replay/runs/start | JSON {id: suite UUID}; returns run_id |
| POST /api/replay/runs/cancel | JSON {id: suite UUID}, **not run UUID** |
| GET /api/replay/runs | Query id = suite UUID |
| GET /api/replay/runs/detail | Query id = run UUID, after = sequence cursor, status? |
| GET /api/replay/runs/result | Query id = individual result UUID |

## Native DNS Hosts

| Method / path | Input |
| --- | --- |
| GET /api/dns/hosts | {success,generation,items} |
| POST /api/dns/hosts | JSON {domain,target,action,enabled,comment?}; omit id |
| PUT /api/dns/hosts | Same fields plus existing UUID id |
| DELETE /api/dns/hosts | Query id = UUID |

action is map or block. map requires a valid IP target; block can omit target. Preserve the full mapping on update. Read generation and the resulting state; changes affect subsequent resolution, not necessarily existing connections/caches. Global DNS configuration is separate from Host mapping CRUD.

## Modules

| Method / path | Input |
| --- | --- |
| GET /api/modules | {success,modules} |
| GET /api/modules/package | Query id (module string ID), revision? |
| GET /api/modules/revisions | Query id |
| GET /api/modules/status | Runtime and module state |
| POST /api/modules/validate | Full ModulePackage JSON |
| POST /api/modules | Full ModulePackage; install/publish |
| PUT /api/modules | Full ModulePackage; publish |
| POST /api/modules/rollback | JSON {module_id,revision} |
| POST /api/modules/toggle | JSON {module_id,enabled} |
| POST /api/modules/reload | JSON {module_id} or {} for all |
| DELETE /api/modules | Query id |

Current ModulePackage wire keys are packageVersion, kind, format, manifest, capabilities and files. A file has path, kind, encoding, content. This is not a Rewrite manifest/modules package, nor the author's module.json alone. Read an existing package and the [Module authoring manual](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/modules.en-US.md) before editing. Preserve valid package metadata and locale/UI resources; validate before publishing. Worker eviction/reload may be true while runtime_applied is false: the new revision loads lazily when its page activates. Legacy install/enable/disable aliases exist; prefer canonical routes above.

## Files, logs and database

| Method / path | Input / format |
| --- | --- |
| GET /api/files | Query path = relative directory, default root; bare file list |
| GET /api/files/download | Query path; raw bytes |
| POST /api/files/save | JSON {path,content}; text write/overwrite |
| POST /api/files/touch | JSON {path}; create new empty file |
| POST /api/files/mkdir | JSON {path} |
| POST /api/files/upload | Query path = destination directory; multipart/form-data, one part named file; helper --upload-file |
| DELETE /api/files | Query path; may delete directory contents |
| GET /api/logs/system | Query bytes (nonnegative, e.g. 102400); UTF-8 log tail |
| POST /api/logs/system/clear | No body; clears persisted logs |
| GET /api/database/stats | Size/table counts/migrations |
| GET /api/database/tables | Table names |
| GET /api/database/table/<table-name> | Columns for a known table |
| POST /api/database/query | JSON {"query":"SELECT ... LIMIT 20"} |

File operations are App Group relative and enforce device path/managed-log restrictions. Upload has a device 16 MiB total request cap and cannot bypass protected paths. Read only the files needed for the task; never retrieve certificate private keys or auth material. Use proper APIs for configuration, not raw SQLite edits or direct mutation of managed package files. Inspect table/column schemas before diagnostic SQL; bounded read queries are the normal path. Do not make writes or broad exports outside the user's requested scope.

## Provenance and boundaries

These tables were checked against WebRouters/{System,Requests,Rewrite,RewriteRemote,CronScript,Replay,ReplayWorkspace,HostMapping,Module,Files,WebBrowser}Router.swift, WebControlCapabilityGate.swift, ReplaySuite/ReplayItem/ReplayResultSummary models, Script/CronScriptStore, ModuleModels and FileUploadService in the Lemon App. Source path/hash evidence is recorded in the public docs/manifest.json; App source files are not needed to use this Skill.

No generic remote API is established here for certificate installation/system trust, global MITM/Rewrite/JS toggles, global DNS/TUN/LAN Proxy settings, purchasing/licensing, or the App's AI-provider setup. Use the corresponding manual and App UI. This route inventory does not imply parity with every installed MCP release.
