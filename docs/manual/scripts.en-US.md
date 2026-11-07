> Evidence (2026-11-07): This chapter was rewritten against current templates and engine source; examples were not executed on a device in this audit. See [provenance and limits](../verification.md).

# Scripts

[Manual collection](../README.md) · [Complete script API](../reference/script-api.md) · [中文](scripts.zh-CN.md)

Lemon uses restricted native QuickJS ESM. Its API differs from Node.js, a browser, and other proxy products. Use the [source-checked script API](../reference/script-api.md) and the installed validator/runtime status for exact signatures, context, results, and limits.

## Choose the execution context

| Context | Handler | Input | Result |
| --- | --- | --- | --- |
| Scheduled task | onSchedule(input) | task_id, scheduled_at_ms, triggered_at_ms, schedule_type | JSON-compatible task result, not an HTTP patch |
| HTTP request | onRequest(ctx) | ctx.request | HTTP modification object |
| HTTP response | onResponse(ctx) | ctx.response | HTTP modification object |
| WebSocket message | onWebSocketMessage(ctx) | ctx.message | WS replacement, drop, or text injection |

WS is supported by the current App, with [public MCP integration gaps](../reference/compatibility.md). Scheduled and traffic handlers are different contracts.

## Why the App template uses export async function

App templates use `export async function` so asynchronous host calls can be awaited later. The runtime accepts both ordinary values and Promises: `export function` is also valid for purely synchronous work. The correct keyword order is export async function, not async export function.

The scheduled-task template has this shape:

~~~javascript
// Runs while the VPN runtime is active.
export async function onSchedule(_input) {
  // Add the task logic here. A return value is optional.
}
~~~

Await Promise-based host operations such as store, http, notify, gzip, and ungzip. Do not start work and return before it finishes.

## Scheduled tasks

Tasks are stored on the phone and depend on its PacketTunnel/VPN runtime. Cron uses five fields; fixed intervals accepted by MCP range from 250 to 86400000 milliseconds. Read get_scheduled_task_runtime_status to verify the scheduler; a saved task does not prove execution.

~~~json
{
  "name": "Local diagnostic tick",
  "schedule_type": "interval",
  "interval_ms": 10000,
  "script_type": "single",
  "script": "export async function onSchedule(input) { return { task: input.task_id, at: Date.now() }; }",
  "enabled": false
}
~~~

Use create_scheduled_task, update_scheduled_task, set_scheduled_task_enabled, and delete_scheduled_task for lifecycle operations. Package mode requires script_type=package and script_package. The compatibility script field remains required and can contain the entry source.

Scheduled single-file shorthand grants none of the five host permissions by default in the core. Use an explicit package manifest when log/store/http/notify/utils are needed. The App default ESM manifest and MCP Rewrite content shorthand instead enable log/utils by default; these entry points must not be conflated.

## HTTP Rewrite: synchronous or asynchronous

Asynchronous request header example:

~~~javascript
export async function onRequest(ctx) {
  if (ctx.request.host !== 'api.example.com') return {};
  return { headers: { 'X-Lemon-Debug': '1' } };
}
~~~

Equivalent synchronous example:

~~~javascript
export function onRequest(ctx) {
  if (ctx.request.host !== 'api.example.com') return {};
  return { headers: { 'X-Lemon-Debug': '1' } };
}
~~~

For body changes, configure body phase and confirm buffered, decodable content:

~~~javascript
export async function onResponse(ctx) {
  if (typeof ctx.response.bodyText !== 'string') return {};
  const value = JSON.parse(ctx.response.bodyText);
  value.debug = true;
  return { body: { text: JSON.stringify(value) } };
}
~~~

Only the active direction is present: ctx.request or ctx.response. bodyText exists only when bytes are available and valid UTF-8. Empty object, null, or undefined means no change. HTTP header values are strings or null; null removes a header. HTTP bodies use `{body:{text:string}}`, not body.base64, ctx, or the complete request/response object. Returning status selects a local response; read the API for phase-specific semantics.

Action scope=request/response and JS config.phase=header/body are separate dimensions. Bind a published script_id, for example decoded config `{"script_id":7,"phase":"body"}`, and encode it as the action.config JSON string.

## ESM package lifecycle

A complete package contains manifest and modules. Manifest declares packageVersion=1, format=esm, entry, module allowlist, and five permissions; source rows contain module_id/source. Imported relative modules must be allowlisted.

Validate, publish an immutable revision, bind script_id in a rule, check global and rule switches, inspect runtime application, then verify a new real request and trace-related debug events. content shorthand creates main.js and cannot be combined with manifest/modules. Rollback switches the active revision. A failed reload does not mean publication was rolled back. See [remote sources](../reference/remote-scripts.md) for their separate lifecycle.

## Public host modules

| Module | Purpose | Permission |
| --- | --- | --- |
| lemon:context | runtime/version/moduleId/locale/isModule metadata; not traffic ctx | Implicit |
| lemon:log | debug/info/warn/error structured logging | log |
| lemon:store | Namespaced string KV; asynchronous get/set/remove | store |
| lemon:http | Controlled HTTPS requests | http |
| lemon:notify | Asynchronous notifications | notify |
| lemon:utils | Base64 codecs and asynchronous gzip/ungzip | utils |

The [API reference](../reference/script-api.md) lists all 16 exports/properties. Module-only data/config/i18n APIs are a separate profile. Do not assume global fetch, require, process, browser DOM, arbitrary filesystem access, or another proxy product's $done API.

## Limits and diagnosis

Current App defaults are 32 MiB JS memory and 30,000 ms execution/response timeout through FFI. Standalone core defaults of 250/500 ms are not the App defaults. A device may retain customized settings; query get_rewrite_runtime_status. HTTP body defaults to 2 MiB, configurable to 8 MiB, subject to MIME, buffering, and memory budgets. Scheduled execution defaults to 10 seconds with a 60-second maximum.

Decodable compressed responses are decoded before body processing. WS message limits differ from HTTP body limits; see the complete API. Source verification of these documents is separate from running them on the current physical device.
