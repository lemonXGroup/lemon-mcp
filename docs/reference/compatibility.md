# Capability and compatibility boundaries

Rewrite matching updated against the source tree on 2026-11-10; other capability rows retain their 2026-11-07 review. [Manual](../README.md) · [AI guide](../AI_GUIDE.md)

## App support and the public MCP surface

| Capability | Current App / WebControl | This public MCP snapshot |
| --- | --- | --- |
| VPN start/stop, traffic summaries and exact detail, bodies, logs | Implemented | Tools available |
| DNS Hosts, one-request Replay, scheduled task CRUD | Implemented | Tools available |
| Local ESM revisions and remote script lifecycle | Implemented | Tools available |
| UI Module package and lifecycle management | Implemented | Tools available; this does not expose every Module host capability as a standalone MCP tool |
| Query conditions | Raw query field with five existing operators; AND with host/path/method | Forwarded unchanged; documented by get_rewrite_schema; no portable version bump, older clients reject query |
| Host wildcards | Four non-regex operators, leading *. includes root and all subdomains; portable 5 / backup 6 | get_rewrite_schema documents the semantics; upsert checks the complete host_wildcards capability before saving, except disabling an existing policy |
| URL expression matching | Implemented; inactive host/path/query/method conditions are retained | groups_json forwards the fields and get_rewrite_schema documents them |
| JSON Path body edits | Implemented | groups_json can forward them; consult the rule reference |
| multipart request fields | Implemented; advertises multipart_request_body | Payload can be forwarded; the newer preflight check in the internal MCP is absent here |
| WebSocket message/frame query | GET /api/websocket/records and /detail | list_websocket_records and get_websocket_record are not yet registered here |
| WebSocket rewrite scope and onWebSocketMessage | Implemented | Generic rule/package payloads and local schema guidance support WS phases; remote required_handlers still rejects this handler |
| Replay Workspace suites and run history/results | Implemented | No dedicated suite/run tools in either current MCP copy |
| Scheduled task execution history | GET /api/scripts/scheduled/runs | No dedicated MCP tool |
| Rewrite capability discovery | GET /api/rewrite/capabilities | No standalone MCP tool; upsert automatically checks host wildcards, but lacks internal multipart preflight |
| Global Rewrite, JS, MITM, or capture policy settings | App-managed | No general MCP settings write API |
| First-use connection wizard and token dialog | Not part of current MCP implementation | Not implemented; environment token only |
| Documentation resources, MCP prompts, server instructions | Not registered in current server | These files are available locally and through GitHub; clients must be directed to read them |

This snapshot registers **67 tools and 2 resources**. The internal MCP registers 69 tools; the two extra tools are WebSocket reads. Count the installed runtime rather than inferring its surface from a README version string.

Host wildcard support requires host_wildcards.supported=true, version>=1, root_domain=true and all four operators from GET /api/rewrite/capabilities. A missing flag, partial declaration or failed capability read blocks the public MCP write; an existing policy can still be disabled with its actual id and enabled=false. A successful JSON parse on an old device does not establish wildcard semantics.

## Protocol-specific boundaries

Current source includes HTTP/1, HTTP/2, and an HTTP/3 path sharing Rewrite processing. This is not a promise that every request or body is eligible for modification. TLS trust, capture routing, MIME policy, buffering, size limits, and available runtime budgets still apply.

WebSocket rewriting applies to completed messages after HTTP/1 Upgrade, with scopes websocket_client and websocket_server. The capability endpoint explicitly advertises h1_upgrade=true, extended_connect_h2=false, and extended_connect_h3=false. HTTP/3 support does not imply WebSocket over HTTP/3 support. Respect capture_state, capture_reason, and recorded gaps; saved content may be incomplete.

For multipart, discover the device capability before use. A 404, missing field, or supported=false means this feature needs a device upgrade. Supported operations are set/replace/delete/append for ordinary request fields, with file parts preserved; compressed requests, multipart responses, nested multipart, file mutation, and large streaming edits are outside this feature.

HTTP body scripts return body.text. body.base64, drop, injectBefore, and injectAfter belong to the WebSocket result contract and must not be used in an HTTP patch.

## Authentication

The access token is a six-digit caller credential, including possible leading zeroes. It is distinct from the device's product license. Authenticated endpoints require a valid token, and entitlement-gated operations additionally need the relevant device capability. A successful public status probe is not an authenticated preflight.

A secure dialog is a proposed enhancement, not current behavior. MCP form elicitation must not request access tokens; a future implementation must use an appropriate local secure input flow or URL mode, with capability checks and local configuration fallback. See the [official elicitation specification](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation).

## Evidence limits

The 2026-11-10 matching sync built and ran 34 deterministic tests (including five subtests) in a clean standalone copy on Node.js 24.1.0; the Skill's 13 loopback HTTP tests and format validation also passed. These checks did not perform a new physical-device run, prove the Node.js 20 minimum in a runtime matrix, publish GitHub content, or deploy an App/backend change. Other capability rows retain their earlier source review. See the [evidence record](../verification.md) for the two App commits and exact scope.

## Optional Skill without MCP

The [Lemon Skill](../../skills/lemon/SKILL.md) provides source-checked direct HTTP routes and a Python standard-library helper. It can use current App HTTP capabilities that the public MCP has not exposed, including WS queries, scheduled run history and Replay Workspace. This does not synchronize the MCP tool surface. The local terminal helper supports hidden token input; the MCP server still uses its environment token and has no token dialog. A Skill cannot make a cloud-only client reach a private phone LAN.
