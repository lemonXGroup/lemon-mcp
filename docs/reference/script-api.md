# JavaScript API reference

[中文](script-api.zh-CN.md) · [AI guide](../AI_GUIDE.md) · [Rewrite rules](rewrite-rules.md) · [Compatibility](compatibility.md)

Source review date: **2026-11-07**. This reference describes the Lemon App's QuickJS ESM implementation and the public MCP project's current interface. A documented App capability may require a newer MCP release or manual configuration in Lemon; inspect the connected server's tools before using it.

## 1. Runtime and package contract

Lemon executes JavaScript in a bounded QuickJS runtime on the iPhone. Rewrite scripts run in the capture runtime; scheduled scripts run through its scheduler. Installing the desktop MCP server does not turn these scripts into desktop Node.js programs.

Use named ESM exports. An entry module must export a handler appropriate to its use; an entry `default` export is rejected. Both `export function onRequest(ctx) { ... }` and `export async function onRequest(ctx) { ... }` are accepted: the runtime consumes a direct return value or awaits a returned Promise. The same applies to `onResponse`, `onWebSocketMessage`, and `onSchedule`. The examples below follow the App's `export async function` templates. JavaScript requires `export async function`, not `async export function`; an async declaration does not automatically await host calls inside it.

Standard JavaScript objects such as `JSON`, `Object`, `Array`, `Math`, `Date`, `Promise`, `Map`, `Set`, `RegExp`, `Uint8Array`, and `ArrayBuffer` are available. Node.js `process`/`require` and browser `fetch` are unavailable. Browser DOM, Node filesystem APIs, timers, and third-party client libraries are not part of the supported host API. Use the modules documented below.

Imports must resolve within the submitted package or use a permitted `lemon:*` module. Include every source module in the manifest allowlist. Relative static and dynamic imports are supported within graph limits; absolute paths, remote URL imports, bare npm imports, import attributes, and direct `lemon:script/...` imports are rejected. Internal package URLs shown in diagnostics are engine identifiers, not paths for users to import.

A complete two-file package accepted by the rewrite package tools has this shape:

```json
{
  "manifest": {
    "packageVersion": 1,
    "format": "esm",
    "entry": "./main.js",
    "modules": ["./main.js", "./lib/headers.js"],
    "permissions": {
      "log": false,
      "store": false,
      "http": false,
      "notify": false,
      "utils": false
    }
  },
  "modules": [
    {
      "module_id": "main.js",
      "source": "import { patch } from './lib/headers.js'; export async function onRequest(ctx) { return ctx.request.host === 'api.example.test' ? patch() : {}; }"
    },
    {
      "module_id": "lib/headers.js",
      "source": "export function patch() { return { headers: { 'x-debug-client': 'lemon' } }; }"
    }
  ]
}
```

For `upsert_rewrite_script`, supply `name` when creating and `id` when publishing a revision to an existing script. The tool accepts either complete `manifest`/`modules` or the `content` shorthand, not both. The shorthand creates `main.js` with `log=true`, `utils=true`, and the other permissions disabled. Use a complete package whenever you need different permissions. Sources are stored as immutable package revisions, not arbitrary `RewriteScripts/*.js` files.

## 2. Handlers and rule phases

| Use | Rule action scope | JavaScript action `config.phase` | Required named export | Input member |
| --- | --- | --- | --- | --- |
| Request headers | `request` | `header` | `onRequest(ctx)` | `ctx.request` |
| Request body | `request` | `body` | `onRequest(ctx)` | `ctx.request` |
| Response headers | `response` | `header` | `onResponse(ctx)` | `ctx.response` |
| Response body | `response` | `body` | `onResponse(ctx)` | `ctx.response` |
| Client WebSocket message | `websocket_client` | Message phase determined by scope | `onWebSocketMessage(ctx)` | `ctx.message` |
| Server WebSocket message | `websocket_server` | Message phase determined by scope | `onWebSocketMessage(ctx)` | `ctx.message` |
| Scheduled task | Not a rewrite action | Not applicable | `onSchedule(input)` | Scheduler fields directly on `input` |

A JavaScript rule action refers to an existing script, for example `{"scope":"response","action":"js","config":"{\"script_id\":7,\"phase\":\"body\"}"}`. Rule tools use a JSON string for `config`; see [Rewrite rules](rewrite-rules.md) for the full rule envelope. Set `phase` explicitly. For HTTP JavaScript actions, an omitted phase follows the legacy body-phase behavior.

Each invocation receives the current direction only: `onRequest` has `ctx.request`, `onResponse` has `ctx.response`, and WebSocket has `ctx.message`. Do not assume the other members exist. The same `onRequest` or `onResponse` function may be called from header or body rules; there is no documented `ctx.phase` field. Keep separate scripts if the logic needs an unambiguous phase.

The App implements WebSocket scopes and handlers. The public MCP snapshot reviewed here still lacks the dedicated WebSocket inspection tools, and `prepare_remote_rewrite_script.required_handlers` accepts only `onRequest` and `onResponse`. Do not pass `onWebSocketMessage` to that enum. Validate the installed server's actual schema before configuring a WebSocket workflow.

## 3. HTTP input context

The request or response member is a plain object with the following fields:

| Field | Type and meaning |
| --- | --- |
| `url` | String containing the full current URL |
| `host` | Parsed host when URL parsing succeeds |
| `path` | Parsed pathname, without query |
| `query` | Query string without the leading `?`; empty when absent |
| `method` | Method string, or `""` if the invocation has no method |
| `status` | HTTP status, or `0` if absent, commonly in request phases |
| `headers` | Plain object with header-name keys and string values |
| `bodyText` | Optional string, present only when body bytes are supplied and valid UTF-8 |

Header names are not guaranteed to have one capitalization. Use a case-insensitive lookup. Repeated occurrences of the same object key retain the last assigned value, so this object cannot preserve every duplicate header; use an appropriate native rule action when exact duplicate handling matters. This is not a browser `Headers`, `Request`, or `Response` object: it has no `.get()`, `.text()`, or `.json()` methods.

Header hooks do not provide a buffered body. Body hooks require the protocol layer to admit and buffer the body within its limits. Missing `bodyText` can mean unavailable, skipped, or non-UTF-8 content. Check `typeof bodyText === "string"`; an empty string is a valid text body. HTTP rewrite context has no documented `bodyBytes` or `bodyBase64` field.

## 4. HTTP return schema

Return a patch object, or return `undefined`, `null`, or `{}` for no change. Async handlers may return a Promise resolving to the same values. Mutating the input alone does not submit a patch.

```ts
type HttpPatch = {
  headers?: { [name: string]: string | null };
  body?: { text?: string };
  status?: number;
};
```

`headers` sets or removes individual headers: a string sets the value, `null` removes the header, and omitted names remain unchanged. The result is not a full replacement of the original header map. `body.text` replaces the entire body with the UTF-8 bytes of a JavaScript string. To modify JSON, parse it, change the object, and return `JSON.stringify(value)` as `body.text`.

In a body phase, `body.text` without `status` produces a body replacement. At a header phase, `body.text` produces a local response. Returning `status` produces a local response even at a body phase; it is not a status-only edit while preserving an upstream response body. Valid statuses are integers from 100 to 599. The generated local response uses `text/plain; charset=utf-8`; choose a native local-response action when you need its explicit response configuration. Protocol code manages framing and body length when adopting a replacement.

Unknown result fields are rejected. In HTTP phases, `body.base64`, `bodyBytes`, `redirect`, `cookies`, `stop`, `args`, `drop`, `injectBefore`, and `injectAfter` are not valid output fields. Nested body keys other than `text` are rejected. Returning an object as `body.text`, returning the complete `ctx`, or returning an array instead of a patch does not satisfy the contract.

Example, attach this script to a **response body** JavaScript action:

```javascript
export async function onResponse(ctx) {
  const response = ctx.response;
  if (response.status !== 200 || typeof response.bodyText !== "string") return {};
  let data;
  try { data = JSON.parse(response.bodyText); } catch (_) { return {}; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  data.debugMode = true;
  return {
    headers: { "x-lemon-debug": "1", "x-remove-debug": null },
    body: { text: JSON.stringify(data) }
  };
}
```

## 5. WebSocket input and result

`onWebSocketMessage` operates on a complete decoded data message, not an individual control frame. `ctx.message` contains the URL-derived fields, method/status/header fields described above, plus:

| Field | Meaning |
| --- | --- |
| `direction` | `"client_to_server"` or `"server_to_client"` |
| `bodyBase64` | Base64 representation when message bytes are provided |
| `bodyText` | Available when those message bytes are valid UTF-8 |

Do not infer text/binary opcode solely from UTF-8 validity. The current handler input has no documented opcode field; binary data can happen to decode as UTF-8.

```ts
type WebSocketPatch = {
  body?: { text?: string; base64?: string }; // Choose at most one representation.
  drop?: boolean;
  injectBefore?: string;
  injectAfter?: string;
};
```

`body.text` replaces message bytes with UTF-8 text; `body.base64` supplies replacement bytes. The transport retains the original message's text/binary opcode when forwarding its replacement, so preserve a valid payload for that opcode. `drop=true` suppresses the original message. `injectBefore` and `injectAfter` inject text messages around it and each accepts a single string. `headers` and `status` are forbidden in WebSocket results. JSON objects, arrays of injected messages, and an assumed `body.bytes` format are unsupported.

Example for a server-message rule; use a narrow URL match and ensure the application expects text messages:

```javascript
export async function onWebSocketMessage(ctx) {
  if (ctx.message.direction !== "server_to_client") return {};
  if (typeof ctx.message.bodyText !== "string") return {};
  if (ctx.message.bodyText === "debug-noise") return { drop: true };
  return { body: { text: ctx.message.bodyText.replace("staging", "debug") } };
}
```

WebSocket scopes accept message body actions and JavaScript, rather than HTTP header/redirect/local-response actions. Ping, Pong, and Close control frames pass through the control-frame path. The implementation handles message reassembly and supported `permessage-deflate` compression. Invalid handshakes, unsupported negotiation, decode failures, and memory/size limits can cause capture or rewrite degradation. Read capture-state/gap diagnostics when available; an omitted capture does not prove no message was forwarded.

## 6. Scheduled scripts

Scheduled scripts must export `onSchedule(input)` from their entry module, including when `script_type="single"`. The callback's periodic input is:

```ts
type ScheduleInput = {
  task_id: number;
  scheduled_at_ms: number;
  triggered_at_ms: number;
  schedule_type: "cron" | "interval";
  trigger?: "manual";
  parameters?: unknown;
};
```

Timestamps use Unix milliseconds. `trigger` and `parameters` are added by the App's manual-run path; ordinary periodic callbacks omit both. This does not imply that the current public MCP server exposes a manual-run tool.

Return a JSON-compatible value as the task result, such as an object, array, string, number, boolean, or `null`. `undefined` becomes `null`. The result is not an HTTP or WebSocket patch and does not modify captured traffic. Avoid cyclic values, functions, and unconverted `BigInt` values.

```javascript
export async function onSchedule(input) {
  return { taskId: input.task_id, observedAtMs: input.triggered_at_ms, ok: true };
}
```

For `create_scheduled_task`/`update_scheduled_task`, use `script_type="single"` with `script`, or `script_type="package"` with `script_package: { manifest, modules }`. Single-file scheduled scripts receive no optional host-module permissions by default. To use log/store/http/notify/utils, submit an ESM package and explicitly enable the required permissions. This differs from the rewrite `content` shorthand defaults.

Fixed intervals are 250 through 86,400,000 milliseconds. Cron expressions and enablement are validated by Lemon. Tasks require the capture runtime's scheduler and applicable feature entitlement; a saved task is not proof that its runtime is running. Use `get_scheduled_task_runtime_status` and the actual tool response to verify activation.

## 7. Public host modules: 16 exports/properties

The public script profile contains these six modules. Enable the named permission in `manifest.permissions` before importing a permission-gated module.

| Module | Permission | Export and signature |
| --- | --- | --- |
| `lemon:context` | Implicit | `runtime: "lemon-esm"` |
| `lemon:context` | Implicit | `version: number` (currently `1`) |
| `lemon:context` | Implicit | `get(): object` |
| `lemon:log` | `log` | `debug(message: string, details?: unknown): void` |
| `lemon:log` | `log` | `info(message: string, details?: unknown): void` |
| `lemon:log` | `log` | `warn(message: string, details?: unknown): void` |
| `lemon:log` | `log` | `error(message: string, details?: unknown): void` |
| `lemon:store` | `store` | `get(key: string): Promise<string \| null>` |
| `lemon:store` | `store` | `set(key: string, value: string, ttlSeconds?: number): Promise<void>` |
| `lemon:store` | `store` | `remove(key: string): Promise<void>` |
| `lemon:http` | `http` | `request(options: HttpOptions): Promise<HttpResult>` |
| `lemon:notify` | `notify` | `post(title: string, subtitle?: string, body?: string): Promise<void>` |
| `lemon:utils` | `utils` | `base64Encode(value: string \| Uint8Array \| ArrayBuffer): string` |
| `lemon:utils` | `utils` | `base64Decode(value: string): Uint8Array` |
| `lemon:utils` | `utils` | `gzip(value: string \| Uint8Array \| ArrayBuffer): Promise<Uint8Array>` |
| `lemon:utils` | `utils` | `ungzip(value: string \| Uint8Array \| ArrayBuffer): Promise<Uint8Array>` |

`lemon:context.get()` returns runtime metadata: `runtime`, `version`, `moduleId`, `locale`, and `isModule`. Use the handler argument for request/response/message data. `get()` does not supply the captured transaction or a general App-control object.

`lemon:log` emits bounded structured diagnostics. Current log processing redacts sensitive fields and emits lengths/hashes; do not expect every raw message/details value to appear in system logs. Keep credentials and payload secrets out of script logs.

`lemon:store` is a persistent, script-namespaced string store. The same key in another script is separate. Serialize objects with `JSON.stringify` and parse after reading. Keys are 1–256 UTF-8 bytes, values at most 1 MiB, and TTL at most seven days. Omitted/zero TTL uses the non-expiring form. `get` returns `null` for a missing/expired value.

`lemon:notify.post` submits a notification through the iOS host. Delivery depends on iOS notification permission and host availability. Title, subtitle, and body each have a 512-byte limit.

`lemon:utils` uses UTF-8 for string inputs and bytes for binary results. Gzip/ungzip run asynchronously with a 2 MiB input/output bound. `Uint8Array` is not a text-decoding API; do not use `String.fromCharCode(...bytes)` for arbitrary UTF-8 text.

Other modules present in the App's internal implementation, such as `lemon:data`, `lemon:config`, and `lemon:i18n`, have UI Module-specific data/locale contracts. They are not additional ordinary rewrite/scheduled-script permissions and are outside this public script profile.

## 8. `lemon:http.request`

```ts
type HttpOptions = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: { [name: string]: string };
  body?: string | Uint8Array | ArrayBuffer;
  timeoutMs?: number;
  followRedirects?: boolean;
};
type HttpResult = {
  status: number;
  headers: { [name: string]: string };
  bodyBytes: Uint8Array;
  bodyText?: string;
};
```

Default method is `GET`; method names are uppercase. Only HTTPS targets are accepted. DNS results are checked and private, loopback, link-local, and multicast destinations are refused. This API cannot call a service on the user's LAN merely because MCP itself connects to Lemon over the LAN.

Redirect following defaults to false. When enabled, the policy restricts it to HTTPS on the original host, with a small hop limit and cancellation/authorization checks. Request timeout defaults to 10,000 ms and is clamped to 1–30,000 ms. The enclosing handler deadline still applies: a 10-second HTTP timeout does not grant a rewrite handler 10 seconds to run.

Request and response bodies are bounded at 2 MiB; headers are bounded at 64 entries and 16 KiB. `bodyText` exists only for valid UTF-8 response bytes. The return value is not a browser Response: read `bodyText` or `bodyBytes`, rather than calling `.json()` or `.text()`.

For a scheduled **package** with `http=true` and `store=true`, the following entry stores a small user-authorized public HTTPS response. Replace the URL with the intended public endpoint before use:

```javascript
import { request } from "lemon:http";
import { set } from "lemon:store";

export async function onSchedule(input) {
  const response = await request({ url: "https://example.com/", timeoutMs: 3000 });
  if (response.status !== 200 || typeof response.bodyText !== "string") {
    return { ok: false, status: response.status };
  }
  await set("last-public-text", response.bodyText, 3600);
  return { ok: true, taskId: input.task_id, bytes: response.bodyBytes.length };
}
```

## 9. Asynchronous calls, limits, and failures

Await every store, HTTP, notification, gzip, or ungzip operation whose result or completion matters. Return the handler Promise or use an `async` handler. Top-level host operations during module initialization are not a supported substitute for calls inside handlers. Avoid fire-and-forget calls and unbounded `Promise.all`; the pending host-operation limit is eight.

The following are source defaults and ceilings, not a promise that a connected device has all features enabled or that every invocation receives the maximum budget:

| Resource | Current source value |
| --- | --- |
| QuickJS heap / stack | 32 MiB / 256 KiB |
| App-configured rewrite execution / response timeout default | 30,000 ms for each; actual persisted device configuration can differ |
| Standalone core `JsRuntimeConfig` execution / response defaults | 250 ms / 500 ms; App/FFI configuration overrides these |
| Scheduled execution / response timeout default | 10 seconds; task configuration ceiling 60 seconds |
| Runtime readiness timeout | 2 seconds |
| Manifest / source module / total package source | 64 KiB / 512 KiB / 2 MiB |
| Modules / import graph depth / dynamic import budget | 128 / 32 / 16 |
| HTTP rewrite body | Default 2 MiB; configurable ceiling 8 MiB |
| Rewrite queue | Count and byte budgets; process byte ceiling 8 MiB + 256 KiB |
| WebSocket complete message | 1 MiB at the transport layer |
| Pending host operations | 8 |
| HTTP host API request/response body | 2 MiB each, separate from rewrite body settings |
| Output headers | 64 entries / 16 KiB combined names and values |
| Structured script log | 16 KiB encoded bound |

The HTTP body ceiling does not increase the HTTP host API's 2 MiB bound, WebSocket's 1 MiB message bound, or total package-source size. Cancellation and authorization changes may interrupt work. Compile errors, exceptions, timeouts, saturated queues, invalid results, or unavailable resources produce errors/skip diagnostics; HTTP body rewrites generally preserve the original traffic when the replacement cannot be adopted. WebSocket behavior also depends on its transport state: an engine error retains the original message, while a replacement exceeding the transport message limit can terminate the session. Check whether a replacement was adopted; a stored script revision or successful validation alone does not prove on-wire execution.

## 10. Protocol and publication boundaries

HTTP/1 and HTTP/2 share the header/body action model. Current App source also routes admitted HTTP/3 streams through the common rewrite pipeline; actual HTTP/3 interception requires the device's enabled protocol support and interception prerequisites. HTTP/3 `CONNECT` is rejected in the current source, so ordinary HTTP/3 support does not establish WebSocket-over-HTTP/3 support.

For supported textual **responses**, identity, gzip, deflate, and Brotli encodings can use bounded decoding before body rules. Unsupported/stacked encodings and decode/size/budget failures preserve the original encoded representation. This response capability does not imply general compressed request-body rewriting. SSE and other streaming data do not become complete buffered text bodies for arbitrary HTTP body scripts. Multipart request-body changes use the dedicated native multipart action; the current engine skips ordinary request-body JavaScript dispatch for multipart input. See [Rewrite rules](rewrite-rules.md).

The public MCP project currently exposes script validation, creation/revision publication, fetching, deletion, and rollback. Saving a script does not attach it to a rewrite rule, enable the rule, enable JavaScript rewriting globally, or start capture. Validate a package, publish it, attach a narrow matching rule with the intended scope/phase, check enablement/runtime state, and then verify a new matching request. Consult [Compatibility](compatibility.md) for public-tool gaps before promising an end-to-end operation.

The current upsert_rewrite_script has no enabled argument and there is no dedicated rewrite-script enable/disable tool. Scheduled-task enablement and rule enablement use different interfaces.

## Source provenance

Reviewed against the App source paths `contracts/script_editor_api_catalog.v1.json`, `lemonCore/core/src/rewrite/js_engine.rs`, `lemonCore/core/src/rewrite/json_engine.rs`, `lemonCore/core/src/rewrite/mod.rs`, `lemonCore/ffi/src/settings.rs`, `lemonCore/ffi/src/lifecycle/rewrite.rs`, `lemonCore/ffi/src/lifecycle/scheduler.rs`, `lemonCore/middlewares/src/response_body.rs`, `lemonCore/middlewares/src/http_codec/response_body.rs`, `lemonCore/middlewares/src/http3/semantics.rs`, `lemonCore/middlewares/src/ws_codec/session.rs`, and `lemon_ios/InternalModules/Shared/Config/LemonCoreRuntimeConfig.swift`; public tool contracts are in `src/tools.ts` and `src/rewriteScripts.ts`. These source identifiers record provenance; this public repository is self-contained and does not require access to the App source tree.
