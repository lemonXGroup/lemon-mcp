# Connection and credential input

This reference applies to the direct HTTP helper. The MCP server's own configuration remains separate.

## Address and reachability

Use the exact origin displayed in Lemon → Console → Remote Controller after enabling the service and seeing Listening. Usually the computer and iPhone share a reachable LAN. Set LEMON_BASE_URL to that origin, for example http://192.0.2.10:9999 (documentation-only address; replace it). An IPv6 origin uses brackets. Do not assume stack.local or port 9999 on another user's device. The helper does not run Bonjour discovery or an MCP activity ping.

A cloud sandbox or online chat with browsing alone cannot reach a private iPhone LAN. Run the helper on the user's computer or provide App instructions. Never expose the phone's WebControl port publicly to solve this limitation.

## Current token

Keep leading zeroes in the phone's current six-digit token. The helper sends it only in X-Lemon-WebControl-Token. Three input choices:

1. **Client protected environment injection:** set LEMON_WEB_CONTROL_TOKEN in the local execution environment through the client's supported secret UI. The AI need not see its value. Changing a parent shell does not update an already-running AI application's environment.
2. **User-operated interactive terminal:** append --prompt-token. Python getpass reads hidden input and keeps it in this process's memory. It refuses noninteractive input or an echoing fallback. The user can execute a prepared command locally without installing MCP or configuring a persistent token.
3. **Existing protected token file:** --token-file /user-selected/private/path reads a small file at runtime; POSIX permissions must be 0600 or stricter. The user selects/provisions it outside the repository. The helper does not create a credential file, search configuration stores, or persist the token. Avoid creating extra copies if a protected environment is already available.

Never put the actual token in a command argument, URL, shell history, chat, source file, saved payload, issue, or log. Do not read or copy another MCP client's protected configuration to populate the Skill. If the client offers a native secure input dialog, use that only when it actually supports secrets; a generic form/chat question is not a password field. The Skill adds no universal GUI dialog or persistent credential service.

A user-run first check, replacing the example address with the phone's real address:

~~~sh
python3 <skill-directory>/scripts/lemon_http.py GET /api/env --base-url http://192.0.2.10:9999 --prompt-token
~~~

For repeated AI execution, use protected client injection or an existing user-selected protected file. Hidden input in an AI-created terminal is not useful unless the client actually allows the user to type into it without recording the secret.

## Preflight and errors

GET /api/env authenticates and reports device/system, isConnected and certificate/MITM state. GET /api/status is public liveness only. certInstalled indicates certificate material exists; it does not prove iOS system trust. A VPN start response only accepts the request; check isConnected afterwards.

- Network error: check current address/port, Listening state, local-network permission and network routing. Keep the phone available while troubleshooting.
- 401 / caller_authentication_required: re-enter the current phone token through the same secure mechanism; confirm this is the intended phone.
- 403 / capability_required: read the returned feature requirement and guide the user through Lemon's licensing UI. Do not bypass it through SQL/files.
- 404: confirm exact route and device version. The public MCP's tool list is not a complete listing of App HTTP routes.
- Timeout/oversized response: the operation may already have run. Read status or persisted state before repeating a mutation.

## Helper interface

Python 3.10+ standard library only. Run --help for current options. Examples assume credentials and origin are injected:

~~~sh
python3 <skill-directory>/scripts/lemon_http.py GET /api/requests --query q=example --query limit=20 --query offset=0
python3 <skill-directory>/scripts/lemon_http.py POST /api/rewrite/scripts/validate --json-file /private/work/package.json
python3 <skill-directory>/scripts/lemon_http.py GET /api/body --query path=<returned-body-path> --output /private/work/new-body.bin
python3 <skill-directory>/scripts/lemon_http.py POST /api/files/upload --query path=<existing-relative-directory> --upload-file /private/work/payload.bin
~~~

Replace angle-bracket placeholders before executing; quote actual paths/arguments correctly. The helper URL-encodes each --query KEY=VALUE. JSON is read from files, not shell-interpolated strings. --output requires a new path, writes successful raw bytes with mode 0600, and never overwrites an existing file. Keep traffic artifacts outside public repositories. JSON-level success:false is a failure even under HTTP 200.

Exit codes: 0 accepted response, 1 HTTP/application rejection, 2 local input/transport/size error. Responses normally print a JSON envelope with http_status, content_type, ok and body, body_text, or body_base64. --output prints only metadata. Console strings redact the current authentication token and escape control characters; this is not a general traffic-secret scrubber. Raw downloads preserve bytes and may contain secrets.

Defaults: 15-second socket I/O timeout, 4 MiB response limit; explicit maximums 120 seconds and 64 MiB. This is a per-I/O timeout, not an overall operation deadline. Request files/multipart bodies are capped at 16 MiB; device endpoints have their own, sometimes lower, limits. The helper bypasses environment HTTP proxies, verifies HTTPS certificates, refuses redirects, and does not automatically retry. Narrow queries before raising limits.
