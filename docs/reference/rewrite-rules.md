# Rewrite rule reference

[Manual](../README.md) · [AI guide](../AI_GUIDE.md) · [Script API](script-api.md) · [Compatibility](compatibility.md)

This reference describes the current App/WebControl contract and how the public MCP tools carry it. The bundled get_rewrite_schema covers query conditions, host wildcards and URL expressions. Confirm the installed MCP version and device capabilities before generating newer rules.

## Rule lifecycle through MCP

| Intent | Tool and procedure |
| --- | --- |
| Read | `list_rewrite_rules`; retain the rule metadata and complete groups |
| Create | `upsert_rewrite_rule` with rule_json and groups_json strings; omit rule.id |
| Update | Read first, then upsert with the actual rule.id and complete replacement groups |
| Enable or disable | Upsert the complete rule with enabled=true/false; retain all groups |
| Delete | `delete_rewrite_rule({id})`, using the exact id_text string (or safe positive integer) |
| Inspect runtime | `get_rewrite_runtime_status` and `get_rewrite_debug_events` |
| Apply after a change | Check the mutation's application result; use `reload_rewrite_runtime` when required and verify the active runtime |

The rule API is not a field-level patch API. Keep unrelated actions and stable group_key values during edits. A rule delete and a script delete are separate operations. Read-only inspection does not require starting capture. There is no dedicated MCP tool to change the global Rewrite or JS switches; use the App when required.

## Policy metadata and groups

Policy metadata accepts name, enabled, priority, and an optional local id for updates. Match conditions belong to groups. Do not send database timestamps, DRM flags, expiration, share codes, draft markers, or old flat matchHost/matchPath fields.

A complete group includes group_key, enabled, order, allows_match_all, conditions, and actions. Use a unique lowercase UUID for group_key. Group order must equal its zero-based array position; action order follows the same rule. Omit group/action/condition database ids and foreign keys. Each group can contain a field only once.

Example rule metadata, initially disabled:

~~~json
{
  "name": "Local debug header",
  "enabled": false,
  "priority": 100
}
~~~

Example groups:

~~~json
[
  {
    "group_key": "123e4567-e89b-42d3-a456-426614174000",
    "enabled": true,
    "order": 0,
    "allows_match_all": false,
    "match_mode": "default",
    "match_expression": "",
    "conditions": [
      {
        "field": "host",
        "op": "eq",
        "value": "api.example.com"
      },
      {
        "field": "path",
        "op": "prefix",
        "value": "/v1/"
      },
      {
        "field": "query",
        "op": "regex",
        "value": "(^|&)packageId=1(&|$)"
      }
    ],
    "actions": [
      {
        "enabled": true,
        "scope": "request",
        "action": "header_mod",
        "config": "{\"operation\":\"set\",\"key\":\"X-Lemon-Debug\",\"value\":\"1\"}",
        "order": 0
      }
    ]
  }
]
~~~

The actual MCP arguments are JSON **strings**:

~~~json
{
  "rule_json": "{\"name\":\"Local debug header\",\"enabled\":false,\"priority\":100}",
  "groups_json": "[{\"group_key\":\"123e4567-e89b-42d3-a456-426614174000\",\"enabled\":true,\"order\":0,\"allows_match_all\":false,\"match_mode\":\"default\",\"match_expression\":\"\",\"conditions\":[{\"field\":\"host\",\"op\":\"eq\",\"value\":\"api.example.com\"},{\"field\":\"path\",\"op\":\"prefix\",\"value\":\"/v1/\"},{\"field\":\"query\",\"op\":\"regex\",\"value\":\"(^|&)packageId=1(&|$)\"}],\"actions\":[{\"enabled\":true,\"scope\":\"request\",\"action\":\"header_mod\",\"config\":\"{\\\"operation\\\":\\\"set\\\",\\\"key\\\":\\\"X-Lemon-Debug\\\",\\\"value\\\":\\\"1\\\"}\",\"order\":0}]}]"
}
~~~

To update, set rule.id to the original id_text decimal string (or a safe positive integer) before encoding it, and omit the read-only id_text field. Preserve the group's UUID. After saving a disabled draft, enable it only when the user requests activation and all runtime prerequisites are satisfied.

## Exact policy identifiers

SQLite policy identifiers are Int64 values and may exceed JavaScript's safe integer range. Updated iPhones add `id_text` to GET /api/rewrite while keeping the legacy numeric id. **Use the original id_text string for updates and deletion.** A large numeric id parsed as a JavaScript Number may already be rounded; converting that Number to a string cannot recover the original identifier.

`upsert_rewrite_rule` accepts rule.id as a safe positive integer or a canonical positive decimal Int64 string (`1..9223372036854775807`, no sign, leading zero, whitespace, decimal point or exponent). Construct writable policy metadata explicitly: copy id_text into **id**, retain name/enabled/priority, and omit the read-only id_text field and database metadata. For a new rule omit both id and id_text. A present null, zero, boolean, fractional or unsafe numeric identifier is rejected before any device operation.

```json
{"id":"8448911919725463553","name":"Existing phone rule","enabled":false,"priority":0}
```

`delete_rewrite_rule` accepts the same string/number contract and sends the exact decimal value in the query string. An iOS application error is reported as a tool failure. Deleting an absent identifier remains the existing idempotent API behavior; verify the intended record is absent rather than relying only on a success message.

Safe numeric updates retain their numeric wire type for older iPhones. String policy updates require the updated iPhone WebControl parser. If id_text is unavailable, read a bounded query with `CAST(id AS TEXT) AS id_text` rather than selecting a bare numeric id. Keep joins within SQLite, and project only the fields needed for the check; do not fetch large rule bodies just to validate one file reference. This change does not alter database keys, SQLite sequences, global JSON parsing, script identifiers or the cloud share schema.

## Matching

Default matching uses host, path, query and method conditions with eq, prefix, suffix, contains or regex. Conditions in a group use AND; multiple enabled matching groups run in order without first-match short-circuiting. Keep allows_match_all=false for a scoped rule. Empty conditions and a star-only host use the existing explicit match-all confirmation.

### Query conditions

The query field matches the raw query string without its leading question mark and excludes the fragment. It preserves percent encoding, case and parameter order; it does not decode parameters or sort key/value pairs. For https://api.example.com/items?name=A%20B&packageId=1#detail, the target is name=A%20B&packageId=1.

~~~json
{"field":"query","op":"regex","value":"(^|&)packageId=1(&|$)"}
~~~

This selects a complete parameter value and avoids contains packageId=1 also matching packageId=10. Use regex ^$ for a missing query or an empty query. Blank editor input omits the condition. Query supports all five existing operators; literal query star/question-mark characters do not gain host wildcard syntax.

Query conditions remain in groups.conditions through reads, updates, shares and backups. They do not require a new portable version number; older clients reject the unknown query field. Do not move query matching into path or invent a legacy flat matchQuery field.

### Host wildcards

The four existing non-regex host operators accept * for zero or more hostname characters, including dots, and ? for exactly one character, including a dot. Only one raw leading *. means zero or more complete subdomain labels. The other characters are literal; regex keeps Rust regular-expression syntax. No extra operator or enable-wildcards switch is added.

| Condition | Matches | Does not match |
| --- | --- | --- |
| eq *.example.com | example.com, a.example.com, a.b.example.com | badexample.com, example.com.evil.test |
| eq api?.example.com | api1.example.com | api.example.com, api12.example.com |
| prefix api? | api12.example.com | xapi1.example.com |
| suffix *.example.com | badexample.com, a.example.com | example.com.cn |
| contains api?- | cdn-api1-east.example.com | cdn-api12-east.example.com |
| eq **.example.com | a.example.com | example.com |
| eq *.*.example.com | a.example.com | example.com |

Use eq *.example.com to select only a root domain and its subdomains. Prefix, suffix and contains retain their string-position meaning and can intentionally match broader names. Internal *. is ordinary wildcard syntax and does not make its dot optional. Consecutive ordinary stars are equivalent to one star; they do not expand the special leading *. rule.

Host matching is case-insensitive. Wildcards cannot consume userinfo, ports, paths, queries or fragments. A numeric literal port may be specified, such as *.example.com:8443; port wildcards are unsupported. Host eq example.com is bounded to the actual authority even with no path condition, so it rejects example.com.evil.test. Host wildcard syntax does not change path, query, method or full-URL expression syntax. Existing local non-regex host * and ? values acquire the new semantics after the device upgrade, including root-domain coverage for leading *.; no per-rule conversion switch exists.

Before using wildcards, GET /api/rewrite/capabilities must report:

~~~json
{"host_wildcards":{"supported":true,"version":1,"root_domain":true,"operators":["eq","prefix","suffix","contains"]},"portable_schema_versions":[2,3,4,5]}
~~~

The public upsert_rewrite_rule checks the host_wildcards declaration before saving, including disabled groups and inactive conditions retained in expression mode. Missing, incomplete or unreachable support prevents the write. Disabling an existing policy with its actual id and enabled=false remains possible, preserving all groups. Direct HTTP clients must perform this capability check themselves. The public MCP has no standalone capability-read tool; the optional Skill HTTP helper can call the route.

### URL expressions

Expression matching sets match_mode=expression and match_expression to a Rust regex over the complete URL: scheme, host, optional port, path and query. Existing host/path/query/method conditions are retained but ignored in expression mode; all HTTP methods are eligible. An enabled expression must be nonempty and valid. Rust regex does not support lookaround or backreferences. Expression groups must keep allows_match_all=false.

~~~json
{
  "match_mode": "expression",
  "match_expression": "^https://api\\.example\\.com/v1/items(?:\\?.*)?$",
  "allows_match_all": false
}
~~~

This is only a matcher fragment; retain the other required group fields when submitting it.

## Action types and phases

Every action requires enabled, scope, action, config as a JSON string, and order. HTTP scopes are request and response. The current App additionally supports websocket_client and websocket_server for body_replace and js only. Check [compatibility](compatibility.md): the public MCP is missing the newer WS query tools and its remote required_handlers enum does not accept onWebSocketMessage.

| Action | Decoded config | Meaning |
| --- | --- | --- |
| header_mod | operation, key, value | Set/add/remove an HTTP header |
| body_replace | mode, find, replace, regex and mode-specific fields | Literal text, regex, exact JSON Path, or multipart ordinary-field modification |
| mock_file | content_type, file_path | Use an existing local mock payload |
| redirect | target | Redirect using the target URL |
| js | script_id, phase | Invoke a stored ESM script; phase is header/body for HTTP |

These JSON examples show **decoded configs**. Apply JSON.stringify before placing one in action.config.

### Header modification

~~~json
{"operation":"set","key":"X-Lemon-Debug","value":"1"}
~~~

Operations are set, add, and remove. Keep value as a string, including an empty string for removal. This action modifies headers; matching a host/path/query/method does not itself change those URL fields.

### Literal and regex body replacement

~~~json
{"mode":"text","find":"old value","replace":"new value","regex":false}
~~~

~~~json
{"mode":"regex","find":"id=([0-9]+)","replace":"debug_id=$1","regex":true}
~~~

Text and regex substitution differ. Regex uses Rust regex syntax and capture replacement rules. Use an explicit full-body result from a JavaScript body action or a mock file when that better describes the intended operation; do not assume every body_replace config replaces the whole body.

### Exact JSON Path

~~~json
{"mode":"json_path","operation":"set","find":"$.data.enabled","replace":"true","regex":false,"value_type":"boolean"}
~~~

~~~json
{"mode":"json_path","operation":"delete","find":"$.data.obsolete","replace":"","regex":false,"value_type":"string"}
~~~

Supported value_type values are string, number, boolean, null, object, and array. replace remains a string carrying the requested value's textual representation. Deletion is explicit: setting null or an empty string does not mean deletion. Exact array indices are supported; do not generate unsupported wildcards, recursive selectors, filters, or arbitrary expressions. Preserve numeric text instead of rounding it through JavaScript Number when precision matters.

### Multipart request fields

Use scope=request and action=body_replace. Confirm `GET /api/rewrite/capabilities` reports multipart_request_body.supported=true. The current public MCP has no dedicated capability tool and lacks the internal preflight; consult the App or upgrade the MCP before relying on this guard.

~~~json
{"mode":"multipart","operation":"set","field":"role","occurrence":{"kind":"all"},"find":"","replace":"tester","regex":false}
~~~

~~~json
{"mode":"multipart","operation":"replace","field":"tag","occurrence":{"kind":"index","index":0},"find":"^(.*)$","replace":"debug-$1","regex":true}
~~~

~~~json
{"mode":"multipart","operation":"delete","field":"obsolete","occurrence":{"kind":"all"},"find":"","replace":"","regex":false}
~~~

~~~json
{"mode":"multipart","operation":"append","field":"note","find":"","replace":"local test","regex":false}
~~~

- set replaces selected existing ordinary field values; missing fields are skipped.
- replace performs literal or regex substitution inside selected existing values; find must be nonempty.
- delete removes selected ordinary field parts and requires empty find/replace and regex=false.
- append omits occurrence entirely; it creates a new UTF-8 ordinary field.
- Other operations require occurrence.kind=all or kind=index with zero-based index 0..1023. The UI shows one-based ordinals.
- Field names are exact and may include meaningful whitespace. They must be nonempty, at most 1024 UTF-8 bytes, exclude CR/LF/NUL, and cannot be _charset_. Unknown keys are rejected. find is limited to 4096 bytes; new values to 1 MiB.
- Files, including filename="" and filename*, remain byte-preserved. File parts do not count toward ordinary-field indices. Compressed requests, multipart responses, nested multipart, file edits, unsupported encodings, and large streaming uploads are excluded.
- Operations are ordered. A prior deletion changes later indices. An unsupported selected field can make an all-occurrences operation skip atomically.
- Input/output body limits default to 2 MiB and can be configured up to 8 MiB, subject to shared memory budget. Larger settings do not guarantee that every upload can be rewritten. Timeout or parser/budget failure preserves the original body.

application/x-www-form-urlencoded uses its own text semantics; do not treat a multipart upload as arbitrary text.

### Mock and redirect

~~~json
{"content_type":"application/json","file_path":"MockFiles/example.json"}
~~~

~~~json
{"target":"https://example.com/debug"}
~~~

Use list_device_files to enumerate a phone App Group directory, select_mock_file to validate and import/reuse a phone file, or create_mock_file to create a new file on the phone. Both return a config JSON **string** containing file_path and content_type for a mock_file action. Content is limited to 2 MiB of valid UTF-8 text. Attach new references promptly with upsert_rewrite_rule; unreferenced files may be reclaimed on app restart. Editing uses fetch_device_file → create_mock_file → update the rule reference so existing rules retain their content. These tools do not read/upload computer files or invoke the system Files/iCloud picker. See the [complete phone file workflow](device-files.md).

### ESM script binding

~~~json
{"script_id":7,"phase":"body"}
~~~

Use the real script id returned by publication. Choose header or body explicitly for HTTP; omitted phase retains the historical body default. The script handler matches the action scope. WebSocket uses onWebSocketMessage(ctx) after Upgrade and has a different return contract. See [script API](script-api.md).

## Portable versions and local writes

Portable ordinary rules use schema_version=2; expression data needs version 3; multipart needs version 4; any non-regex host * or ? condition selects version 5, including inactive conditions. Host wildcard requirements take precedence when combined with multipart or expression data. Cloud backup and local recovery use a separate version sequence: host wildcards select version 6; ordinary/expression/multipart backups retain 3/4/5. New importers accept portable 2/3/4/5 and backup 3/4/5/6. MCP upsert arguments are a local WebControl payload, not a portable export envelope: do not add schema_version to rule_json merely because an exported rule has one.

## Verification and recovery

Check endpoint acceptance, persisted readback, runtime application, and a new observed request separately. A JS runtime switch can remain disabled even when a rule is enabled. If publication persists but reload fails, report the partial result and retry the runtime operation when appropriate; do not blindly republish new revisions. Retain the previous rule and script revision so an authorized rollback can restore the previous behavior.

Protected packages may expose only metadata. A successful read does not imply permission to decrypt, copy, or mutate protected content. Use supported lifecycle operations and the device's authorization decisions.

## Contract provenance

Matching and compatibility updated on 2026-11-10 against App commits 9ce70bd739139042a21fb8e9b64ffc31fa7b0126 (query conditions) and 5438ebdfed3b6ff30c6e6d726e1f1375c07b114c (host wildcards). Checked the current RewriteRouter, RewriteMatchGroup, query/host matchers, sharing/backup version selection and public MCP tool definitions. The remaining action reference retains its 2026-11-07 source review. The installed device validator remains authoritative for accepted payloads and limits.
