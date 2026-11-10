# Using LemonMCP with an AI client

[Manual collection](README.md) · [中文](AI_GUIDE.zh-CN.md) · [Compatibility](reference/compatibility.md)

Discover the actual tools and resources exposed by the installed server, then read the relevant chapter before acting. A tool listing, local schema response, or target URL is not proof of a connection to the iPhone.

Without MCP: use the [Lemon Skill](../skills/lemon/SKILL.md) and its direct HTTP helper. It supports hidden token input in a user-operated local terminal; it does not add a dialog or inject credentials into an existing MCP session.

## Connect for the first time

1. The computer running the MCP process and the iPhone need a reachable local network, usually the same Wi-Fi. Guest networks and access point isolation can prevent communication. A cloud AI client needs a local MCP process with access to that network.
2. Open Lemon → Console → Remote Controller on the iPhone. Enable the service and wait for Listening. Use its actual URL, port, and current six-digit access token. Keep Lemon in the foreground for the first check.
3. This version reads `LEMON_WEB_CONTROL_TOKEN` from the process environment at startup. Ask the user to fill it in locally in their MCP client configuration. Preserve leading zeroes. Do not ask for it in chat or pass it as a tool argument.
4. The current server has no connection tool, Keychain input, or secure token dialog. Do not claim to open one. If a later version provides a local secure input flow, that flow should receive the token directly; the AI only needs its connection result.
5. Restart the MCP server after changing the environment or rotating the token on the iPhone. The existing API client does not reload it dynamically.
6. Inspect `get_lemon_target_ip`. Bonjour uses `_lemon._tcp` and can replace a fallback address. When discovery is unavailable, use the address displayed on the phone with `LEMON_TARGET_HOST` / `LEMON_TARGET_PORT` or `set_lemon_target_ip`. Confirm the selected phone when more than one device is present. `stack.local:9999` is only a fallback.
7. Read `lemonmcp://env/hardware_status` and inspect its contents. It must contain device state, not an Error message. This calls an authenticated device endpoint; a successful MCP resource response alone is insufficient.
8. Report the device, target address, authentication result, VPN, MITM, and certificate state without repeating the token.

## Diagnose a failed connection

| Observation | Next check |
| --- | --- |
| LemonMCP tools are unavailable | Local install, compiled entry point, server startup, client reload |
| Timeout or connection refused | Reachable network, phone foreground, Listening, actual port, network isolation |
| `401 / caller_authentication_required` | Current token, local configuration, MCP process restart; do not guess tokens |
| `403 / capability_required` | Device authorization and the required product entitlement |
| Missing endpoint or capability | App/server compatibility and available tools |
| Tools listed but phone shows no active MCP session | Completed MCP initialization and a successful authenticated device call |

The public `/api/status` endpoint does not prove authentication. A stopped VPN does not imply a stopped WebControl service.

## Capture and inspect traffic

When the user asks to start capture, call `toggle_vpn({action:"start"})` and read device state again to confirm `isConnected`. Use `action:"stop"` to stop and verify. Historical capture reads do not require starting the VPN. HTTPS plaintext also depends on MITM, certificate trust, target application behavior, and bypass policy.

Use `search_traffic_previews` to find records, then `get_captured_request` for authoritative detail. Preserve returned identifiers as strings where applicable, especially large trace IDs. Fetch referenced bodies only when needed. Distinguish missing, empty, truncated, binary, and final content. Read `lemonmcp://database/schema` before a bounded diagnostic SELECT. Never clear records just to investigate a failure.

## Maintain Rewrite rules and scripts

Read `get_rewrite_schema` and the [rule reference](reference/rewrite-rules.md); for scripts, read the [script API](reference/script-api.md). Default matching accepts host/path/query/method. Query uses the raw query string without `?`. Host eq/prefix/suffix/contains accept `*` and `?`; `eq *.example.com` includes the root and all subdomains, while the other operators retain string-position semantics. The public tool checks device Host wildcard capabilities before saving, including inactive conditions; an existing policy can still be disabled. Direct HTTP callers must check the capability route themselves. Read [compatibility](reference/compatibility.md) for the remaining multipart and WebSocket tool gaps.

Read existing rules and runtime status first. Create with `upsert_rewrite_rule` without an id; update with the actual rule.id and a complete groups array. Preserve group_key and unrelated content. Disable by updating enabled=false; delete only when requested using `delete_rewrite_rule`. There is no dedicated MCP tool for changing the global Rewrite or JavaScript switch; guide the user to the App when needed.

Validate a script package before publishing its immutable revision, then bind the returned script_id to the action. Remote scripts have their own [prepare and update flow](reference/remote-scripts.md). Verify request acceptance, persisted readback, runtime application, and a newly generated real request separately.

## Read the right documentation

- Capture: [Requests](manual/requests.en-US.md), [TUN](manual/tun.en-US.md), [MITM](manual/mitm.en-US.md).
- Rules, JSON Path, multipart, WebSocket: [rules](reference/rewrite-rules.md), [compatibility](reference/compatibility.md).
- ESM and host permissions: [script API](reference/script-api.md), [Scripts](manual/scripts.en-US.md).
- Other features: the [complete manual](README.md) and [tool inventory](reference/tools.md).

The App has more capabilities than the current MCP surface. Do not invent tools or use raw SQL writes as a replacement for missing configuration APIs.

## Copyable first-use prompt

~~~text
Use LemonMCP to connect to Lemon and perform an initial read-only check.
Read https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/llms.txt
and follow its AI guide and compatibility references.
Guide me to confirm that the MCP host computer can reach my iPhone and that Remote Controller is enabled and Listening.
I will enter the token locally through a secure input flow or MCP configuration, not in chat. Do not read back or expose credentials.
Use the tools actually available. If this version has no secure input flow, explain the local configuration step instead of claiming to open a dialog.
Inspect the current target and hardware_status, verify the device and authentication, and report VPN, MITM, and certificate state.
Only check the connection at this stage. For later capture, inspection, rule, or script requests, read the relevant documentation, perform the authorized operation, and verify the result.
~~~

If online reading is unavailable, use the same Markdown in the local installation. This guide does not execute itself when the server is installed.
