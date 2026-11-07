# Task workflows

Use [HTTP API](http-api.md) for exact paths and payloads. With MCP available, use the discovered tools and schemas instead of mechanically translating tool names into URLs.

## Capture and inspect a request

1. Authenticate GET /api/env. Starting/stopping capture is a user task action, not a prerequisite for inspecting stored records.
2. For HTTPS content, inspect MITM configuration, selected domains, root certificate presence and system trust. If missing, guide the user through [HTTPS MITM](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/mitm.zh-CN.md). Certificate file presence alone does not prove system trust; pinned or unsupported protocols can remain opaque.
3. If asked to capture, POST /api/vpn/start and check isConnected. Ask the user to reproduce traffic only when that action requires their device interaction. Do not clear old traffic automatically.
4. Page GET /api/requests using q/limit/offset. For exact host matching, inspect host/URL across enough pages; the HTTP route has no host filter. Report the query and coverage when claiming no matches.
5. GET /api/requests/detail for the selected id. Fetch body references with /api/body; save bytes if binary or compressed. Report preview/truncation rather than treating missing text as an empty response.
6. For a WebSocket trace, fetch /api/websocket/records and then detail or export. Preserve trace_id, cursors, capture errors and gaps.
7. If asked to stop, POST /api/vpn/stop and re-read isConnected. Preserve the user's intended final capture state.

## Create or edit a Rewrite rule

1. Read current rules, runtime status and relevant live capabilities. Load the [full rule/action reference](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/rewrite-rules.md).
2. Translate the user's scope into precise host/path/method or a URL expression. Conditions in one default group use AND; enabled groups can run in order, with no first-match short circuit. Keep allows_match_all=false unless broad matching is explicitly intended. Rust regex lacks lookaround/backreferences.
3. Choose the native action: header_mod; body_replace text/regex/JSON Path/multipart; mock_file; redirect; js. Read each action's actual config. For exact JSON Path preserve numeric text and value_type. For multipart check multipart_request_body.supported and use native request-field actions; do not treat a multipart body as ordinary JS text.
4. Create: omit rule.id and generate fresh lowercase UUID group_key values. Update: use the actual policy id, preserve group_key and unrelated actions, normalize group/action order, omit database/DRM/timestamp fields.
5. Send a complete {rule,groups} JSON file. action.config is encoded JSON text. For enable/disable, only change rule.enabled within that complete payload. POST/PUT are replacement-style operations, not arbitrary field patches.
6. Match activation to the user's request. A draft request stays disabled; an explicit enable/update request does not need a second authorization. Check persisted/runtime application separately, read back the policy, inspect status/debug events and test with newly generated authorized traffic.
7. Delete only the selected policy id. Deleting a referenced script is a separate operation; do not delete reusable scripts as incidental cleanup.

## Write and publish JavaScript

Read the [complete script API](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.zh-CN.md) before generating code, particularly handler inputs, return patches, host-call signatures, permissions and limits.

- QuickJS ESM executes on iPhone. Use named export async function onRequest/onResponse/onWebSocketMessage/onSchedule; synchronous named handlers are also accepted. async export is invalid JavaScript. An async function still needs await on asynchronous host calls.
- onRequest has ctx.request, onResponse has ctx.response, WS has ctx.message. Do not invent the opposite direction or use lemon:context.get as a substitute for traffic context.
- HTTP returns patches such as headers, body.text and status. A status result triggers a local response. WS has its own text/base64/drop/injectBefore/injectAfter contract; do not reuse HTTP output shapes.
- Host modules are lemon:log, lemon:store, lemon:http, lemon:notify, lemon:utils and lemon:context. Read their signatures and manifest permissions; neither browser fetch nor Node require/process/fs exists.
- Submit every local source in the manifest allowlist and modules source array. No npm or runtime URL imports. Grant only the permissions the implementation uses.
- Use the complete package form for direct HTTP. POST /api/rewrite/scripts/validate; only then create/publish, read back package/revision, bind the real script_id in a rule, and verify runtime/new traffic. Publishing an enabled rule must preserve the user's scope and current rule state.
- A header-phase handler cannot assume a body. Bounded compressed textual response decoding and dedicated multipart handling have specific support/skip behavior. Read the canonical API for limits rather than borrowing Node.js semantics.
- For existing scripts, read the current package and revisions first. Publish a new revision or use rollback; do not mutate managed script files via /api/files.

For remote sources, read the [remote lifecycle](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/remote-scripts.md): prepare, inspect validation outcome, commit candidate with the parent rule or explicitly create standalone, read generation/revision, configure with CAS, then refresh. A prepared token is not an installed script and expires after ten minutes. Keep the same authentication context. Auto-update is a separate user choice and does not allow runtime URL imports.

## Scheduled tasks

Read the existing detail before updates. Choose cron versus interval, single versus package, enablement and frequency according to the request. Package entry exports onSchedule(input). runtime_requirement currently only supports vpn. Preserve leading precision in returned nanosecond timestamps. GET /api/scripts/scheduled/status plus recent /runs provide execution evidence; a saved task can remain unexecuted while VPN/scheduler is stopped. There is no documented run-now HTTP endpoint. Do not automatically start VPN or enable unrelated tasks to make a status check succeed.

## Replay and Workspace

Read target URL, method, headers, disabled header names, body and credentials before execution. Saved Replay CRUD does not execute requests; execute routes do. Read [Workspace](replay-workspace.md) before creating suites, especially full model fields, concurrency, retries, stopOnFailure, parameters, extraction and assertion semantics. Status filtering is server-side across the run; page by result sequence. Cancellation uses suite id. Respect the user’s scope when generating load or repeating state-changing requests.

## DNS, modules and diagnostics

DNS Hosts use their own mapping CRUD and generation reporting. Global resolver settings remain App UI. Verify a new resolution/connection when actual DNS effects matter.

Module packages are distinct from Rewrite scripts. Follow the Module authoring manual, validate the complete package, publish, then check module/runtime state. Publishing can evict a worker; actual loading is lazy on page activation. Do not equate persisted=true or runtime_reloaded=true with page functionality.

For files/logs/database, use the narrowest documented endpoint. Keep downloaded private traffic outside the public repo. Inspect real database tables/columns before bounded SELECT queries. Managed configuration must go through its owner API; SQL is not a general replacement for missing remote settings.
