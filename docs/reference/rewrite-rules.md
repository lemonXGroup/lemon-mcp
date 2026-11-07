# Rewrite rule reference

[Manual](../README.md) · [AI guide](../AI_GUIDE.md) · [Script API](script-api.md) · [Compatibility](compatibility.md)

This reference describes the current App/WebControl contract and how the public MCP tools carry it. The current public `get_rewrite_schema` text is older than several features described here. Confirm the installed tools and device support before generating newer rules.

## Rule lifecycle through MCP

| Intent | Tool and procedure |
| --- | --- |
| Read | `list_rewrite_rules`; retain the rule metadata and complete groups |
| Create | `upsert_rewrite_rule` with rule_json and groups_json strings; omit rule.id |
| Update | Read first, then upsert with the actual rule.id and complete replacement groups |
| Enable or disable | Upsert the complete rule with enabled=true/false; retain all groups |
| Delete | `delete_rewrite_rule({id})`, using the numeric policy id |
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
  "groups_json": "[{\"group_key\":\"123e4567-e89b-42d3-a456-426614174000\",\"enabled\":true,\"order\":0,\"allows_match_all\":false,\"match_mode\":\"default\",\"match_expression\":\"\",\"conditions\":[{\"field\":\"host\",\"op\":\"eq\",\"value\":\"api.example.com\"},{\"field\":\"path\",\"op\":\"prefix\",\"value\":\"/v1/\"}],\"actions\":[{\"enabled\":true,\"scope\":\"request\",\"action\":\"header_mod\",\"config\":\"{\\\"operation\\\":\\\"set\\\",\\\"key\\\":\\\"X-Lemon-Debug\\\",\\\"value\\\":\\\"1\\\"}\",\"order\":0}]}]"
}
~~~

To update, add the existing numeric id to the rule metadata before encoding it. Preserve the group's UUID. After saving a disabled draft, enable it only when the user requests activation and all runtime prerequisites are satisfied.

## Matching

Default matching uses conditions with fields host, path, and method and operators eq, prefix, suffix, contains, or regex. Conditions in a group use AND; multiple enabled matching groups can run in order without first-match short-circuiting. Keep allows_match_all=false for a scoped rule. Empty conditions must not silently create a match-all rule.

Expression matching sets match_mode=expression and match_expression to a Rust regex over the complete URL: scheme, host, optional port, path, and query. Existing host/path/method conditions are retained but ignored in expression mode; all HTTP methods are eligible. An enabled expression must be nonempty and valid. Rust regex does not support lookaround or backreferences. Expression groups must keep allows_match_all=false.

~~~json
{
  "match_mode": "expression",
  "match_expression": "^https://api\\.example\\.com/v1/items(?:\\?.*)?$",
  "allows_match_all": false
}
~~~

This is only a matcher fragment; retain the other required group fields when submitting it.

## Action types and phases

Every action requires enabled, scope, action, config as a JSON string, and order. HTTP scopes are request and response. The current App additionally supports websocket_client and websocket_server for body_replace and js only. Check [compatibility](compatibility.md): the public MCP is missing the newer WS query tools and part of its schema guidance.

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

Operations are set, add, and remove. Keep value as a string, including an empty string for removal. This action modifies headers; matching a host/path/method does not itself change those URL fields.

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

A mock file must already exist in permitted App Group storage. fetch_device_file is a read tool; it cannot upload the missing mock. The current MCP does not expose a general file-upload tool.

### ESM script binding

~~~json
{"script_id":7,"phase":"body"}
~~~

Use the real script id returned by publication. Choose header or body explicitly for HTTP; omitted phase retains the historical body default. The script handler matches the action scope. WebSocket uses onWebSocketMessage(ctx) after Upgrade and has a different return contract. See [script API](script-api.md).

## Portable versions and local writes

Portable ordinary rules use schema_version=2; expression data needs version 3; multipart needs version 4. Local backup version numbers are a different protocol. MCP upsert arguments are a local WebControl payload, not a portable export envelope: do not add schema_version to rule_json merely because an exported rule has one.

## Verification and recovery

Check endpoint acceptance, persisted readback, runtime application, and a new observed request separately. A JS runtime switch can remain disabled even when a rule is enabled. If publication persists but reload fails, report the partial result and retry the runtime operation when appropriate; do not blindly republish new revisions. Retain the previous rule and script revision so an authorized rollback can restore the previous behavior.

Protected packages may expose only metadata. A successful read does not imply permission to decrypt, copy, or mutate protected content. Use supported lifecycle operations and the device's authorization decisions.

## Contract provenance

Checked on 2026-11-07 against the App's RewriteRouter, RewriteMatchGroup, RewriteActionParametersCodec, runtime script result validation, and MCP tool definitions. The installed device validator remains authoritative for accepted payloads and limits.
