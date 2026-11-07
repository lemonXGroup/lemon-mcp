# Remote Rewrite script sources

[Manual](../README.md) · [Script API](script-api.md) · [Rules](rewrite-rules.md)

The public server already exposes six tools for ordinary remote Lemon ESM sources. These are distinct from the WebControl access token and from protected/DRM package refresh. A prepare token below is an opaque, short-lived candidate reference returned by the iPhone, not the six-digit connection credential.

| Tool | Purpose |
| --- | --- |
| prepare_remote_rewrite_script | Download and preflight on the iPhone without saving a script/rule |
| create_remote_rewrite_script | Explicitly install a standalone resource using a prepared token |
| get_remote_rewrite_script | Read source generation, validators, active revision, schedule, and controlled failure state |
| configure_remote_rewrite_script | Change source configuration using generation CAS; does not itself replace installed code |
| refresh_remote_rewrite_script | Explicitly check, validate, publish, and apply current source content |
| copy_remote_rewrite_script | Copy an installed normal snapshot into an independent local script |

## Prepare a candidate

~~~json
{
  "descriptor": {
    "url": "https://example.com/main.js",
    "format": "javascript",
    "autoUpdate": false,
    "intervalSeconds": 86400,
    "permissionCeiling": {"log":true,"store":false,"http":false,"notify":false,"utils":true},
    "isPrivate": false
  },
  "required_handlers": ["onResponse"]
}
~~~

format can be javascript or esm_package; the latter contains a complete manifest/modules package. expectedSHA256 optionally pins 64 hex digits for the downloaded content. This is native Lemon ESM, not another product's $done wrapper. No runtime URL import is enabled by using a remote source.

Auto-update is off by default. Allowed foreground intervals are 3600, 21600, and 86400 seconds. Background iOS execution is not a punctual scheduler. Prepared candidates expire after ten minutes and are bound to the caller and validation context. Current remote POST client calls use a 75-second timeout.

Current App supports onWebSocketMessage, but this public MCP's required_handlers enum accepts only onRequest/onResponse. Upgrade/synchronize the MCP before preparing a remote WS handler through this parameter.

## Save with a parent rule

For an unsaved rule, pass prepared candidates via upsert_rewrite_rule.remote_scripts_json so the resource and parent rule commit atomically. Do not create a standalone resource first unless that is the intended operation.

~~~json
[
  {"temporary_id":"9007199254740991","name":"Remote response","token":"PREPARED_CANDIDATE_TOKEN"}
]
~~~

Actions refer to that temporary script id. New temporary ids range from 9000000000000000 to 9007199254740991 and travel as decimal strings in remote drafts. For an existing shared source edit, read metadata first and include script_id, source_generation, and active_revision in the candidate draft. A stale generation/revision must not silently overwrite another edit.

## Refresh and recover

configure changes the source descriptor and invalidates validators without installing new code. refresh performs the explicit update. Conditional GET and content validation preserve the last accepted installed snapshot on a bad response. No content change need not produce a new revision.

Read persisted, changed, active_revision, runtime_applied, apply_deferred, and apply_error separately. A deferred or failed runtime application does not erase a persisted revision. Check runtime status and use the supported reload path when appropriate. A rollback changes active revision and pauses ordinary auto-update; protected content has its own licensed lifecycle.

isPrivate controls whether a source URL is included in sharing/backups; it does not mean the installed snapshot is absent. Source URLs may contain private query data. Keep them out of logs, issue text, and shared examples. A local copy does not inherit the source URL or subscription.
