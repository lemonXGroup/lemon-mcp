> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

## What Lemon_MCP can do

Lemon_MCP is Lemon's Model Context Protocol (MCP) server for AI agents. It runs on the developer's Mac, communicates with Cursor, Claude Desktop, Codex, or another MCP client over standard input and output, and then connects over HTTP / Bonjour to a real iPhone running Lemon.

This gives an AI more than a way to read a capture preview. With user authorization, it can complete a debugging loop: start or stop capture, inspect device state, search and expand requests, analyze logs and the database, replay requests, configure DNS, manage Rewrite rules and script packages, manage UI Modules, and operate Lemon's embedded browser.

This chapter is a capability contract for both people and AI agents. Tool names, parameter names, and behavior are defined by the schemas returned at runtime through MCP `tools/list` and `resources/list`. When the server or iOS version changes, read the live schema again instead of relying on historical parameters.

## Boundaries an AI must understand

### Lemon_MCP is not the network parser

MCP discovers the device, orchestrates WebControl requests, formats results, and manages script packages. HTTP parsing, TLS decryption, decompression, and capture persistence still happen inside Lemon, PacketTunnel, and lemonCore on iOS. A missing readable body is not automatically a network failure; inspect capture state, decode state, raw bytes, and logs together.

### Every operation targets a real device

Tools operate on the iPhone selected by the current MCP target, not on a simulator and not on the MCP process's local filesystem. Lemon must be running with WebControl enabled, usually on the same controlled local network as the Mac. If Bonjour discovery fails, set the device IP and port manually.

### Read and write operations are different

The following operations change device state or data. An AI should only run them when the user explicitly asks or when the agreed diagnostic plan requires them:

- `toggle_vpn` starts or stops the device VPN / PacketTunnel.
- `clear_captured_traffic` deletes captured requests and body files.
- `clear_system_logs` clears persisted system logs.
- `upsert_host_mapping` and `delete_host_mapping` immediately change DNS Host mappings.
- Replay create, update, delete, and execute operations change saved requests or send requests to a target.
- Rewrite and Module publish, rollback, enable, disable, and delete operations change runtime configuration.
- `execute_raw_sql` is a raw database entry point; MCP does not enforce a complete read-only SQL AST.

Before clearing, deleting, replaying, changing DNS, publishing a script, or installing a module, the AI should state what will change. Results must distinguish “persisted successfully”, “loaded into runtime”, and “request accepted”.

## Connection and setup

### Build Lemon_MCP

```bash
cd /path/to/lemon-mcp
npm install
npm run build
```

The server is written in Node.js / TypeScript and exposes an MCP channel through `StdioServerTransport`. It does not open a public HTTP server on the Mac.

### Configure an AI client

Always use the absolute path to the build output. The exact configuration file depends on the AI client:

```json
{
  "mcpServers": {
    "LemonMCP": {
      "command": "node",
      "args": [
        "/absolute/path/to/lemon-mcp/build/index.js"
      ],
      "env": {
        "LEMON_WEB_CONTROL_TOKEN": "TOKEN_FROM_LEMON_REMOTE_CONTROLLER"
      }
    }
  }
}
```

Protected WebControl APIs require the current six-digit access token. MCP reads `LEMON_WEB_CONTROL_TOKEN` at startup and sends it in `X-Lemon-WebControl-Token`; preserve leading zeroes. The process can start without the variable, but authenticated device calls will fail. Enter it through local configuration and restart MCP after a change. Never put it in source code, documentation, or chat. A secure input dialog is not implemented; see the [first-use guide](../AI_GUIDE.md).

### Device discovery and target selection

MCP starts device discovery only after the stdio handshake, so an unattached process is not shown as active. The discovery sequence is:

1. Browse Bonjour / mDNS for the `_lemon._tcp` service, usually named `Lemon.Local`.
2. Prefer the advertised IPv4 address and actual service port; otherwise use the service host.
3. Probe the default fallback `stack.local:9999` in parallel.
4. Call `set_lemon_target_ip` when automatic discovery cannot reach the device.
5. Call `get_lemon_target_ip` to verify the target currently used by MCP.

Each Lemon_MCP process has its own session. Successful non-ping REST calls asynchronously send an MCP activity ping. A normal transport close attempts to clear the session, and iOS also marks it disconnected after roughly 8 seconds without a heartbeat. MCP activity does not mean VPN connected, and VPN connected does not mean a request has completed.

## Recommended diagnostic playbook for AI

This sequence fits most network problems. Skip steps that are not needed.

1. **Confirm the target**: call `get_lemon_target_ip`. If connection fails, call `set_lemon_target_ip`, then verify again.
2. **Read the environment**: read `lemonmcp://env/hardware_status` and record device, memory, VPN, MITM, and CA certificate state.
3. **Create a baseline**: only call `clear_system_logs` and `clear_captured_traffic` when the user wants a clean scene; record the cleanup time.
4. **Start and verify capture**: call `toggle_vpn(action="start")`, then read the environment again. The tool result means the start request was submitted, not that the VPN is synchronously connected.
5. **Reproduce the issue**: perform the action in the app under test. An empty capture without a trigger is not evidence of failure.
6. **Search previews**: call `search_traffic_previews(keyword, limit)`. Domain-like keywords use exact Host matching; other keywords use the device's fuzzy search behavior.
7. **Expand a request**: pass the returned `trace_id` to `get_captured_request` to read the complete request, response, body state, and body-file references.
8. **Read raw bodies**: when the detail contains `requestBodyMeta.path` or `responseBodyMeta.path`, call `fetch_binary_payload(path)`. Do not treat a garbled preview as proof that the raw file is corrupt.
9. **Correlate evidence**: read `lemonmcp://database/schema` first, then use `execute_raw_sql` for `trace_events`, `http_requests`, DNS, or runtime tables. Prefer `SELECT` and `PRAGMA`.
10. **Inspect logs and Rewrite**: use `fetch_system_logs` and `get_rewrite_debug_events` for the same time window; use `list_rewrite_rules` and `get_rewrite_runtime_status` to check configuration when needed.
11. **Make a change**: only after the target and evidence are clear, and the user permits it, use Replay, DNS, Rewrite, or Module write tools. Verify persistence and runtime state separately.
12. **Finish with a report**: call `toggle_vpn(action="stop")` when appropriate and report the target, device state, trigger time, traces, body paths, log window, SQL results, changes made, and anything still requiring a real-device check.

## Tool reference

### Device, VPN, and embedded web page

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `toggle_vpn` | `action`: `start` or `stop` | Requests iOS VPN / PacketTunnel start or stop. The result means the request was submitted; verify the state with the hardware resource or another status source. |
| `open_web_page` | `url`: HTTP / HTTPS URL | Opens a page in Lemon's embedded WKWebView. Only valid HTTP / HTTPS URLs are accepted; embedded username/password credentials are rejected; maximum length is 4096 characters. |
| `close_web_page` | None | Closes the current embedded WKWebView. The close operation is idempotent. |
| `refresh_web_page` | None | Reloads the current WKWebView. Returns `webview_not_open` when no page is presented. |
| `go_back_web_page` | None | Moves back in the embedded WKWebView history; it does not wait for page loading. |
| `go_forward_web_page` | None | Moves forward in the embedded WKWebView history; it does not wait for page loading. |

The web-page tools return after the iOS presentation coordinator accepts the command. They do not wait for the final page load. Separate “open”, “wait”, and “observe” steps when validating page content.

### Scheduled JavaScript tasks

Scheduled tasks are stored locally and can run JavaScript on a five-field Cron schedule or a fixed millisecond interval. `interval_ms` is constrained to `250..86400000`; scheduled execution also requires the relevant entitlement. A task can be a single file or a validated ESM package. A package entry must export `onSchedule(input)` from its manifest entry.

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `list_scheduled_tasks` | None | Lists local Cron / interval tasks, runtime state, and next run time. |
| `get_scheduled_task` | `id`: positive integer | Reads one scheduled task's complete configuration. |
| `get_scheduled_task_runtime_status` | None | Reads PacketTunnel scheduled-task runtime state without exposing script source. |
| `create_scheduled_task` | `name`, `schedule_type`, `cron_expr?`, `interval_ms?`, `script_type`, `script`, `script_package?`, `enabled?` | Creates a task. `cron` requires a five-field expression; `interval` requires milliseconds. `single` cannot include `script_package`; `package` must include a complete package. Enabled defaults to true. |
| `update_scheduled_task` | `id` plus create-task fields | Updates task configuration and source without changing execution history. `enabled` is required. |
| `set_scheduled_task_enabled` | `id`, `enabled` | Enables or disables one task. |
| `delete_scheduled_task` | `id`: positive integer | Deletes one locally stored scheduled task. |

After creating or updating a task, check that the schedule type matches its fields and use runtime status to determine whether the scheduler is actually available. A successful database write alone is not proof of execution.

### Capture, logs, files, and database

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `clear_captured_traffic` | None | Clears HTTP records and body files. This is destructive; confirm the intent to establish a new baseline first. |
| `fetch_system_logs` | `bytes?` | Reads the tail of `lemoncore.log`, defaulting to 102400 bytes, which is suitable for large logs. Increase the range only for a defined time window. |
| `clear_system_logs` | None | Clears persisted system logs. This is destructive and is normally used before a clean diagnostic baseline. |
| `search_traffic_previews` | `keyword`, `limit?` | Searches request summaries. Limit defaults to 50 and MCP clamps it to 0..1000. Domain, IPv4, or Host-with-port keywords use exact Host filtering. Results include `trace_id`, `database_id`, method, URL, status, time, body lengths, and previews up to 500 characters. |
| `get_captured_request` | `trace_id`: non-empty string | Reads a complete request / response. The value may be a transaction id, trace id, or legacy database id returned by search. `requestBodyMeta` and `responseBodyMeta` distinguish `missing`, `empty`, `text`, `binary_ref`, and `structured`. |
| `fetch_binary_payload` | `path`: relative body path | Reads a complete request or response body. Strict safe UTF-8 without unsafe control characters is returned as text; other bytes are returned as Base64 with byte length. Use a path obtained from request details. |
| `fetch_device_file` | `path`: relative App Group path | Reads a non-database file. Known text extensions are read as text and JSON is pretty-printed; other content uses safe byte formatting. ESM packages in `runtime.sqlite` must be read with script-package tools instead. |
| `execute_raw_sql` | `query`: SQLite SQL string | Runs a raw diagnostic query against the Lemon SQLite database. MCP does not enforce a complete read-only AST. Default to `SELECT` / `PRAGMA` and avoid `UPDATE`, `DELETE`, DDL, and long transactions. |

Interpret captures in this order: determine whether the request finalized, inspect decode state, then read raw bytes through the body path. A missing `response_status` may mean the transaction has not finalized or is not HTTP; `capture_state=complete` does not mean the body is UTF-8.

### Target management

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `set_lemon_target_ip` | `ip`, `port?` | Overrides the MCP target manually. The default port is 9999. Use it when Bonjour is unavailable or the device address changes, then verify with `get_lemon_target_ip`. |
| `get_lemon_target_ip` | None | Returns the device URL currently used by MCP, such as `http://192.168.1.10:9999`. It describes configuration, not device health. |

### DNS Host mappings

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `list_host_mappings` | None | Lists native DNS custom Host mappings, including generation and revision metadata. |
| `upsert_host_mapping` | `id?`, `domain`, `target?`, `action?`, `enabled?`, `comment?` | Creates or updates a mapping. `id` is an existing UUID; `action` is `map` or `block`; `map` requires an IPv4 / IPv6 `target`, while `block` does not; `enabled` defaults to true. Writes apply immediately without a second confirmation. |
| `delete_host_mapping` | `id`: UUID | Deletes a mapping and applies the change immediately. Confirm the UUID and affected domain first. |

DNS mappings and Rewrite are different pipelines. Hosts changes DNS resolution; Rewrite changes a request or response passing through the proxy. Do not use evidence from one pipeline as a substitute for the other.

### HTTP Replay

Replay can save a captured request for reuse or execute a one-shot request without saving it. Supported methods are `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `CONNECT`, and `TRACE`. Headers are a string-to-string map and body is optional UTF-8 text.

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `list_replay_items` | None | Lists saved replay requests in the local runtime database. |
| `get_replay_item` | `id`: UUID | Reads a saved request's complete headers and body. |
| `create_replay_item` | `name`, `url`, `method`, `headers?`, `body?` | Saves a new replay request. The URL must be valid and headers default to an empty map. |
| `update_replay_item` | `id`, `name`, `url`, `method`, `headers?`, `body?` | Updates a saved request without changing its execution history. |
| `delete_replay_item` | `id`: UUID | Deletes a saved replay request. |
| `execute_replay_item` | `id`: UUID | Executes the saved request through the native URLSession / runtime path, returns a bounded response preview, and updates execution status. It sends a real request. |
| `execute_replay_request` | `url`, `method`, `headers?`, `body?` | Executes a one-shot request without persistence. Use it after inspecting a captured request when testing a minimal change. It sends a real request. |

Before replaying, remove one-time authentication headers when appropriate, confirm the target environment, and check for private data in the request body. Replay success does not mean the request is fully equivalent; server state, timestamps, signatures, and idempotency can differ.

### Rewrite script packages

Rewrite script packages are versioned ESM packages stored in iOS `runtime.sqlite`, not legacy `RewriteScripts/*.js` files. A complete package contains a manifest and an allowlisted set of module sources.

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `list_rewrite_scripts` | None | Lists script summaries, numeric ids, active revisions, and enabled state. |
| `get_rewrite_script_package` | `id`: positive integer, `revision?`: positive integer | Reads the active or selected historical revision's complete manifest and module source. |
| `list_rewrite_script_revisions` | `id`: positive integer | Lists immutable revisions, hashes, sizes, and active state. |
| `validate_rewrite_script_package` | `manifest`, `modules` | Runs the iOS validator without persistence. The validator is the final authority for path allowlists, package version, module counts, and size limits. |
| `upsert_rewrite_script` | `id?`, `name?`, `manifest?`, `modules?`, `content?`, `reload?` | Creates a package or publishes a new revision. Provide a complete package, or use `content` as a restricted one-file `main.js` shorthand; the two forms cannot be mixed. `reload=true` requests a runtime reload after persistence. |
| `rollback_rewrite_script` | `id`, `revision`, `reload?` | Makes a historical revision active while retaining history; reload is optional. |
| `get_rewrite_runtime_status` | None | Reports Rewrite / JavaScript enablement, resource limits, sync state, and script counts. |
| `get_rewrite_debug_events` | `trace_id?`, `event_type?`, `level?`, `limit?`, `offset?` | Reads the structured Rewrite debug projection. Filters by trace, event type, severity, and pagination; limit defaults to 200 and maxes at 1000. Example event types include `rule_matched`, `mutation_applied`, `script_failed`, and `rewrite_skipped`. |
| `clear_rewrite_debug_events` | `trace_id?` | With a trace, clears one request's events; without one, clears the whole debug projection. This is destructive. |
| `reload_rewrite_runtime` | None | Requests an active snapshot reload from `runtime.sqlite`. It can fail when the VPN runtime is not running, without undoing persisted scripts. |
| `delete_rewrite_script` | `id`: positive integer | Deletes a script package and its revisions. Confirm that no enabled Rewrite rule depends on it. |

The current basic manifest contract is:

```json
{
  "packageVersion": 1,
  "format": "esm",
  "entry": "./main.js",
  "modules": ["./main.js", "./lib/transform.js"],
  "permissions": {
    "log": true,
    "store": false,
    "http": false,
    "notify": false,
    "utils": true
  }
}
```

`modules` is the relative module-path allowlist. A source item looks like `{ "module_id": "main.js", "source": "..." }`. Only enabled Rewrite rules load a package, while the JavaScript runtime is separately controlled by `rewrite.js_enabled`. A publish can persist successfully while reload fails; the result includes the persisted result and `reload.success=false`, which the AI must report as a partial outcome.

### Rewrite rules

The rule API manages policies, MatchGroups, and ordered actions. Match conditions belong in the MatchGroup array rather than in the policy metadata object.

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `list_rewrite_rules` | None | Reads all Rewrite policies, MatchGroups, and actions. |
| `upsert_rewrite_rule` | `rule_json`, `groups_json` | Creates or updates a rule. `rule_json` is a JSON string containing `id?`, `name`, `enabled`, and `priority`; `groups_json` is a MatchGroup array. Include an id in the rule object for updates. |
| `delete_rewrite_rule` | `id`: number | Deletes one Rewrite rule. |
| `get_rewrite_schema` | None | Returns local schema guidance that omits newer App features. Read it alongside the rule reference and compatibility table. |

Core MatchGroup shape:

```json
{
  "group_key": "123e4567-e89b-12d3-a456-426614174000",
  "enabled": true,
  "order": 0,
  "allows_match_all": false,
  "conditions": [
    { "field": "host", "op": "eq", "value": "api.example.com" }
  ],
  "actions": [
    {
      "enabled": true,
      "scope": "response",
      "action": "header_mod",
      "config": "{\"operation\":\"set\",\"key\":\"X-Lemon-Debug\",\"value\":\"1\"}",
      "order": 0
    }
  ]
}
```

HTTP action scopes are `request` and `response`. The App also supports `websocket_client` and `websocket_server` for body_replace/js only; public MCP schema guidance is older. Read [compatibility](../reference/compatibility.md). Action types are:

- `header_mod`: modify HTTP headers.
- `body_replace`: modify literal text, regex matches, exact JSON paths, or multipart ordinary fields. See the [rule reference](../reference/rewrite-rules.md) for exact parameters.
- `mock_file`: return a local payload.
- `redirect`: perform an HTTP redirect.
- `js`: invoke an ESM script package; its config may be a JSON string such as `{"script_id":7,"phase":"body"}`.

Conditions inside one MatchGroup use AND. Matching groups use OR and do not short-circuit after the first match. Actions have their own `order`, and request / response scope must match the stage being changed. An AI should read the [exact rule reference](../reference/rewrite-rules.md) alongside get_rewrite_schema, whose current text omits newer features. Validate script packages with validate_rewrite_script_package, then persist and verify runtime status and debug events.

### UI Modules

Modules are installable, enableable UI extensions that run inside Lemon. MCP provides package inspection, publishing, revision, enablement, and runtime lifecycle management. The iOS validator is the final authority for the package schema; do not construct a package from an old example alone.

| Tool | Input | Capability and notes |
| --- | --- | --- |
| `list_modules` | None | Lists installed host-side UI Modules, active revisions, and enabled state. |
| `get_module_package` | `module_id`, `revision?` | Reads the complete manifest and ESM sources for an active or historical revision. Module ids use reverse-domain form. |
| `list_module_revisions` | `module_id` | Lists immutable module revisions, hashes, and the active revision. |
| `validate_module_package` | `package_json`: complete JSON string | Runs the iOS package validator without persistence. |
| `upsert_module` | `package_json`, `reload?` | Installs a module or publishes a new revision. With `reload=true`, requests a reload of active workers after persistence. |
| `rollback_module` | `module_id`, `revision`, `reload?` | Activates a historical revision while retaining history; reload is optional. |
| `toggle_module` | `module_id`, `enabled` | Enables or disables a module; disabling releases its worker. |
| `delete_module` | `module_id` | Deletes a module and all immutable revisions. |
| `get_module_runtime_status` | None | Reads active module workers, leases, and runtime limits. |
| `reload_module_runtime` | `module_id?` | Releases one module worker or all workers so the next activation loads the active revision. Omit the id to reload all. |

A Module package V2 commonly contains `packageVersion`, `kind`, `format`, `manifest`, `capabilities`, and `files`. The manifest describes module id, moduleVersion, entrypoints, locales, assets, UI schema, required entitlements, and permissions. The current allowlisted UI renderer includes text, button, toggle, picker, stepper, slider, textField, searchField, textEditor, codeEditor, list, table, chart, image, navigation, sheet, and alert nodes. The exact available contract still comes from the package validator and iOS host contract.

Module host permissions are `log`, `store`, `http`, `notify`, and `utils`. Data capabilities are declared by the package and checked against the host allowlist. A `lemon:*` bridge can import only declared and enabled capabilities. When inspecting a module, read its manifest, capabilities, entrypoints, and source before installing or enabling it.

These three tools are compatibility aliases retained for older clients. Do not call them in addition to the canonical tool:

| Compatibility tool | Equivalent capability |
| --- | --- |
| `inspect_module` | Reads an active module manifest, UI schema, and ESM sources. Prefer `get_module_package` when active or historical package selection is needed. |
| `install_module` | Older module-package publish alias accepting `package_json`. Prefer `upsert_module`, which supports optional reload. |
| `set_module_enabled` | Older alias for `toggle_module`. |

### MCP Resources

Resources are read-only context for an AI, not tools with write actions. Read them when they add evidence; do not inject the full database schema into every prompt.

| Resource URI | Content | How to use it |
| --- | --- | --- |
| `lemonmcp://env/hardware_status` | Device health snapshot, including memory, VPN state, MITM configured / effective state, CA certificate installation, and system trust information. | Read before making VPN, capture, or runtime claims. It is a point-in-time snapshot, not a replacement for later verification. |
| `lemonmcp://database/schema` | Dynamically reads the Lemon SQLite table list and column details for each table. | Read before generating `execute_raw_sql`; do not guess old table or field names. |

## Evidence correlation and common mistakes

### Correlate with trace data

`search_traffic_previews` returns a UI / MCP-oriented summary. Its `trace_id` can come from `transaction_id`, a legacy `trace_id`, or a database id. It is suitable for continuing with `get_captured_request`, but it is not guaranteed to be the recorder's `trace_events.trace_id` for cross-table queries. When cross-table evidence is needed, use the detail result or URL plus a time window to find the real `trace_id` and `transaction_id` in SQL.

Recommended read-only evidence chain:

```sql
SELECT trace_id, stage, message, created_at
FROM trace_events
WHERE trace_id = '...'
ORDER BY created_at;

SELECT transaction_id, request_scheme, host, request_path,
       response_status, capture_state, decode_status,
       response_body_path, failure_reason, finalize_reason
FROM http_requests
WHERE trace_id = '...';
```

Do not treat these observations as root causes by themselves:

- `H2 session ended with error` is a connection-level event; inspect each HTTP transaction's finalize state.
- Port 443 or a UI HTTPS label cannot replace `request_scheme` and protocol-detection evidence.
- A garbled preview cannot replace MIME, encoding, decode state, and raw-byte evidence.
- A disconnected VPN UI does not by itself prove a request failed; correlate VpnController, PacketTunnel, runtime state, and traces.
- A database initialization error is not permission to create an empty database over the scene.
- A successful MCP result may only mean WebControl accepted a request; it does not prove runtime activation or final page loading.

### Verify every write

Separate every change into three layers:

1. **Request layer**: did MCP send the request, and did WebControl return an error?
2. **Persistence layer**: can list / get tools read the new rule, revision, mapping, task, or module?
3. **Runtime layer**: do runtime status, reload results, debug events, or a new real request prove that the new state is active?

Rewrite and Module publishing can persist successfully while reload fails. Rollback switches an active pointer and retains historical revisions. Preserve the partial outcome instead of hiding the reload error to report a simple success.

## Minimum safety rules

- Use Lemon_MCP only on a device and network controlled by the user. Never expose the WebControl port to the public Internet through forwarding.
- Never put tokens, cookies, Authorization headers, personal data, or production secrets into Markdown, rules, Replay items, scripts, or logs.
- Give clearing, deleting, DNS writes, Replay execution, Rewrite / Module publishing, and raw SQL a specific purpose.
- Use relative paths returned by tools for files and bodies. Do not guess absolute paths or bypass the secure path resolver.
- Preserve `byteLength`, encoding, and path when handling binary data; do not mistake Base64 for business content.
- Record the target, device / iOS, Lemon / Core versions, time window, trigger, traces, evidence, and conclusion for every diagnostic session.
- Without a real-device connection, label conclusions as code or contract evidence pending real-device verification. Never invent a device result.

These capabilities let an AI participate in the full loop from reproduction to evidence collection to fix verification. Network permissions, data deletion, real requests, and configuration publishing remain under the user's control.

## Independent public snapshot additions

This snapshot registers 67 tools and 2 resources. The six remote-source tools are documented in [remote scripts](../reference/remote-scripts.md). Read the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility](../reference/compatibility.md) for expression, JSON Path, multipart, and WebSocket support; the old get_rewrite_schema text is incomplete. Use the [AI guide](../AI_GUIDE.md) for initial connection. Authenticated endpoints require the current token, independently of device entitlements.
