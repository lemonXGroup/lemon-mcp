# Request URL, Query and HTTP redirects

Source contract reviewed on 2026-11-14. Check the connected phone before using these actions:

```json
{"request_target_rewrite":{"supported":true,"version":1,"actions":["url_rewrite","query_mod","redirect"],"query_policies":["auto","preserve","replace","merge","clear"],"cross_origin":true,"cross_scheme":true,"js_url":true},"portable_schema_versions":[2,3,4,5,6]}
```

Read GET /api/rewrite/capabilities directly, or use get_rewrite_schema through the updated MCP. Missing/unreachable capability means support is unknown. Updated upsert_rewrite_rule validates configs and refuses to write these actions to an unsupported device.

All three actions require scope=request and run at request headers. config remains a JSON **string** in WebControl and MCP payloads. Exports containing any of these actions use portable ordinary/DRM schema_version=6 and cloud/local recovery version 7. Readers still accept the existing redirect action in portable versions 2–5 and backup versions 3–6, using status=307 and query_policy=auto when absent. No migration or separate legacy action exists. Older clients must reject version 6 portable documents. Local upsert rule metadata has no schema_version.

| Action | Decoded config | Effect |
| --- | --- | --- |
| url_rewrite | {"target":"/v2/items","query_policy":"auto"} | Internally selects the upstream URL; preserves method/body |
| query_mod | {"operations":[{"op":"set","key":"page","value":"2"}]} | Changes the query of the current target |
| redirect | {"target":"/next","query_policy":"auto","status":307} | Returns a local 3xx response with Location; sends no business request to origin |

url_rewrite and redirect accept an encoded absolute HTTP(S) URL, a root-relative path beginning with /, or a query beginning with ?. Query-only targets retain the current path. Root paths retain scheme/authority. Explicit scheme/host/port changes are supported by the H1/H2/H3 origin paths. Host/:authority, TLS decision, SNI, port and upstream ALPN follow the adopted target. Method/body are preserved unless another explicit body action changes them. An HTTPS-to-HTTP internal rewrite keeps the original HTTPS connection to the client and uses cleartext only for the new upstream leg. A real redirect asks the client to follow Location and is subject to that client's ATS and redirect handling.

No userinfo, fragment, whitespace/control bytes, backslashes, unencoded non-ASCII, scheme-relative //host, or non-HTTP(S) scheme is accepted. Use percent-encoded URL text. URL input/output is limited to 16 KiB. Rewritten origins are checked against protected destinations, routing rejection, MITM bypass, DNS/Hosts and egress policies; explicit target rejection does not silently contact the original destination.

## Query policy

| Policy | Behavior |
| --- | --- |
| auto (default) | Explicit target query wins, including an empty trailing ?. Otherwise preserve original query for the same scheme/host/effective port; clear it for a different origin |
| preserve | Use original query, ignoring target query |
| replace | Use target query; clear when absent |
| merge | Keep original items whose decoded keys are absent in the target, then append all target items; target duplicates remain |
| clear | Remove the query |

Example: original https://api.example.test/a?tag=1&tag=2&sig=a%2fb+%20&flag.

- /b with auto becomes https://api.example.test/b?tag=1&tag=2&sig=a%2fb+%20&flag.
- /b?tag=3 with auto replaces the entire query with tag=3.
- /b?tag=3 with merge keeps sig=a%2fb+%20&flag and appends tag=3.
- https://other.example.test/b with auto has no query. Choose preserve/merge explicitly if cross-origin parameters are intended.
- /b? with auto leaves an explicit empty query; /b with clear removes it.

## Query operations

```json
{"operations":[{"op":"set","key":"page","value":"2"},{"op":"append","key":"tag","value":"a b"},{"op":"remove","key":"debug"}]}
```

Operations run in order: set removes all items with the decoded, case-sensitive key and appends one value; append adds another value; remove removes all items with the key; clear removes all query items. clear has only op; remove has op/key; set and append have op/key/value. Unknown/missing fields, wrong types and empty operation arrays are rejected. At most 128 operations; each decoded key/value pair is at most 16 KiB.

Enter **decoded** keys/values. Changed items use UTF-8 form encoding (space becomes +). Do not pre-encode them. Unchanged items keep their original byte encoding, order, duplicate keys, key-only flags and empty items. Query modification can invalidate a request signature; Lemon does not recalculate application signatures.

## HTTP redirect method behavior

Default status is 307. Supported statuses are 301, 302, 303, 307 and 308. Standards-compliant follow behavior for 307/308 preserves method/body. 301/302/303 may produce a GET and lose the original body on the next client request. The client controls whether it follows; Lemon does not issue the follow request automatically. Redirecting to HTTP may be blocked by the client's ATS policy.

## JavaScript

Only request-header output accepts url and queryPolicy:

```js
export function onRequest(ctx) {
  return {url: "/v2/items", queryPolicy: "auto"};
}
```

The policy names and URL limits are shared with url_rewrite. queryPolicy requires url. These outputs in request-body/response/WebSocket stages are errors. Mutating ctx.request.url without returning url does not change the actual target. Script output is an internal rewrite and preserves method/body. Use a native redirect action for a real 3xx response.

## Ordering and verification

Matches use the captured original URL. URL/Query actions apply in action order to the selected target. A real redirect resolves Location at its position; use it after any desired URL/Query operations. Do not depend on later target actions changing an already selected Location.

Verify persistence, runtime application and a fresh request separately. Check adopted URL/Host, original method/body, actual origin observation, and response status/Location. A matching debug event alone does not prove delivery. The H1/H2 interception path retains the initial origin TCP/TLS/ALPN negotiation used by the existing MITM architecture; a local redirect or rewrite may still require that initial origin handshake to succeed, even though no business request is submitted to it.
