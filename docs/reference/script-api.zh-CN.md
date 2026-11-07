# JavaScript API 参考

[English](script-api.md) · [AI 使用指南](../AI_GUIDE.md) · [重写规则](rewrite-rules.md) · [兼容性](compatibility.md)

源码核对日期：**2026-11-07**。本文覆盖 Lemon App 的 QuickJS ESM 实现，并区分公开 MCP 项目当前暴露的接口。已在 App 实现的能力，可能仍需升级 MCP 或在 Lemon 中手动配置；执行前应检查已连接服务实际提供的工具。

## 1. 运行环境与脚本包

JavaScript 在 iPhone 上的受限 QuickJS 运行时执行。重写脚本由抓包运行时执行；定时脚本经运行时中的调度器执行。安装电脑端 MCP 服务后，这些脚本仍不属于电脑上的 Node.js 程序。

入口必须使用具名 ESM 导出，并提供与用途对应的处理函数；入口模块存在 `default` 导出会被拒绝。`export function onRequest(ctx) { ... }` 与 `export async function onRequest(ctx) { ... }` 均受支持：运行时会直接读取同步返回值，或等待返回的 Promise。`onResponse`、`onWebSocketMessage`、`onSchedule` 遵守同样约定。下文示例与 App 默认模板保持一致，优先使用 `export async function`。正确 JavaScript 语法是 `export async function`，不是 `async export function`；声明 async 不会自动等待函数内部的宿主调用。

支持 `JSON`、`Object`、`Array`、`Math`、`Date`、`Promise`、`Map`、`Set`、`RegExp`、`Uint8Array`、`ArrayBuffer` 等 JavaScript 标准对象。没有 Node.js 的 `process`/`require` 或浏览器 `fetch`。DOM、Node 文件系统、计时器和第三方客户端库不属于受支持宿主 API，请使用本文列出的模块。

导入只能指向包内相对模块或获准的 `lemon:*` 模块。全部源模块都必须出现在 manifest 白名单。支持预算内的相对静态、动态导入；拒绝绝对路径、远程 URL 导入、裸 npm 导入、import attributes，以及直接导入 `lemon:script/...`。诊断中的内部脚本 URL 是引擎标识，不是用户应导入的文件路径。

重写脚本工具接受的完整双文件包示例：

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

调用 `upsert_rewrite_script` 创建时提供 `name`，更新已有脚本时提供 `id`。工具接受完整 `manifest`/`modules` 或单文件 `content` 简写，两者不能混用。重写 `content` 简写生成 `main.js`，默认 `log=true`、`utils=true`，其他权限关闭；需要其他权限时使用完整包。源码保存在不可变脚本包 revision 中，不是任意 `RewriteScripts/*.js` 文件。

## 2. 处理函数与规则阶段

| 用途 | 规则动作 scope | JavaScript 动作 `config.phase` | 必需具名导出 | 输入成员 |
| --- | --- | --- | --- | --- |
| 请求头 | `request` | `header` | `onRequest(ctx)` | `ctx.request` |
| 请求正文 | `request` | `body` | `onRequest(ctx)` | `ctx.request` |
| 响应头 | `response` | `header` | `onResponse(ctx)` | `ctx.response` |
| 响应正文 | `response` | `body` | `onResponse(ctx)` | `ctx.response` |
| 客户端 WebSocket 消息 | `websocket_client` | 由 scope 决定消息阶段 | `onWebSocketMessage(ctx)` | `ctx.message` |
| 服务端 WebSocket 消息 | `websocket_server` | 由 scope 决定消息阶段 | `onWebSocketMessage(ctx)` | `ctx.message` |
| 定时任务 | 不属于重写动作 | 不适用 | `onSchedule(input)` | 调度字段直接放在 `input` 上 |

JavaScript 规则动作引用已创建脚本，例如 `{"scope":"response","action":"js","config":"{\"script_id\":7,\"phase\":\"body\"}"}`。规则工具中的 `config` 是 JSON 字符串，完整规则外壳见[重写规则](rewrite-rules.md)。应明确设置 `phase`；HTTP JavaScript 动作省略 phase 时，兼容逻辑默认进入正文阶段。

每次只提供当前方向的数据：`onRequest` 有 `ctx.request`，`onResponse` 有 `ctx.response`，WebSocket 有 `ctx.message`。不能假设其他成员同时存在。同一个 `onRequest`/`onResponse` 可以被请求头或正文规则调用；没有文档定义的 `ctx.phase` 字段，需要明确区分时应拆为不同脚本。

App 已实现 WebSocket scope 与处理函数。本次核对的公开 MCP 副本仍缺少专用 WebSocket 查询工具，且 `prepare_remote_rewrite_script.required_handlers` 只接受 `onRequest`、`onResponse`。不能向该枚举传入 `onWebSocketMessage`。配置 WebSocket 工作流前应核对已安装服务实际工具 schema。

## 3. HTTP 输入上下文

`ctx.request` 或 `ctx.response` 是普通对象，字段如下：

| 字段 | 类型与含义 |
| --- | --- |
| `url` | 当前完整 URL 字符串 |
| `host` | URL 解析成功时的主机名 |
| `path` | URL 路径，不包含 query |
| `query` | 不含开头 `?` 的查询字符串，缺失时为空串 |
| `method` | 方法字符串；该调用没有方法时为 `""` |
| `status` | HTTP 状态码；缺失时为 `0`，请求阶段通常如此 |
| `headers` | 普通对象，键为 header 名称，值为字符串 |
| `bodyText` | 可选字符串，仅当提供了正文且字节是有效 UTF-8 时存在 |

不能假设 header 名称统一大小写，应按不区分大小写的方式查找。同一对象键的重复 header 仅保留最后赋值，无法完整表示重复字段；精确保留或处理多个同名 header 时应选择合适的原生规则动作。这些对象不是浏览器的 `Headers`、`Request`、`Response`，没有 `.get()`、`.text()`、`.json()` 方法。

Header 阶段不提供已缓冲正文；正文阶段依赖协议层在限制内接纳并缓冲正文。`bodyText` 缺失可能表示正文不可用、被跳过或不是 UTF-8。使用 `typeof bodyText === "string"` 检查，空字符串也属于有效文本正文。HTTP 重写上下文没有文档定义的 `bodyBytes` 或 `bodyBase64`。

## 4. HTTP 返回格式

返回修改对象；`undefined`、`null`、`{}` 均表示不修改。异步处理函数可以返回解析为上述值的 Promise。仅修改输入对象不会提交修改。

```ts
type HttpPatch = {
  headers?: { [name: string]: string | null };
  body?: { text?: string };
  status?: number;
};
```

`headers` 按字段增改删除：字符串设置值，`null` 删除，未出现的名称保持原值。它不表示用新 header 对象覆盖全部旧字段。`body.text` 用 JavaScript 字符串的 UTF-8 字节替换整个正文；修改 JSON 时先解析、修改对象，再把 `JSON.stringify(value)` 放入 `body.text`。

正文阶段仅返回 `body.text`、不含 `status` 时产生正文替换。Header 阶段返回 `body.text` 会生成本地响应。返回 `status` 即使在正文阶段也会生成本地响应，不是保留上游正文并仅修改状态码。状态码必须为 100–599 的整数。本地响应默认使用 `text/plain; charset=utf-8`；需要完整指定本地响应参数时应使用对应原生动作。协议层接纳正文替换时会处理正文长度与分帧。

未知输出字段会被拒绝。HTTP 阶段不支持 `body.base64`、`bodyBytes`、`redirect`、`cookies`、`stop`、`args`、`drop`、`injectBefore`、`injectAfter`。`body` 内除 `text` 外的键均不合法。不能把对象直接当作 `body.text`，不能返回整个 `ctx`，也不能用数组代替修改对象。

下例应绑定到**响应正文** JavaScript 动作：

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

## 5. WebSocket 输入与返回值

`onWebSocketMessage` 处理完整解码的数据消息，不处理单个控制帧。`ctx.message` 包含前述 URL 派生字段、method/status/headers，并增加：

| 字段 | 含义 |
| --- | --- |
| `direction` | `"client_to_server"` 或 `"server_to_client"` |
| `bodyBase64` | 提供消息字节时的 Base64 表示 |
| `bodyText` | 消息字节是有效 UTF-8 时提供 |

不能只根据 UTF-8 是否有效推断消息的 text/binary opcode；当前处理函数输入没有文档定义的 opcode 字段，二进制载荷也可能恰好是有效 UTF-8。

```ts
type WebSocketPatch = {
  body?: { text?: string; base64?: string }; // 最多选择一种表示。
  drop?: boolean;
  injectBefore?: string;
  injectAfter?: string;
};
```

`body.text` 用 UTF-8 文本替换消息字节，`body.base64` 指定替换字节。转发替换消息时保留原消息的 text/binary opcode，因此应确保替换载荷适用于原 opcode。`drop=true` 丢弃原消息。`injectBefore`、`injectAfter` 分别在前后插入文本消息，每项只接受一个字符串。WebSocket 输出禁止 `headers`、`status`。不支持直接用 JSON 对象作为正文、注入消息数组或自创 `body.bytes` 格式。

服务端消息规则示例；应限制 URL 匹配范围，并确认应用预期的是文本消息：

```javascript
export async function onWebSocketMessage(ctx) {
  if (ctx.message.direction !== "server_to_client") return {};
  if (typeof ctx.message.bodyText !== "string") return {};
  if (ctx.message.bodyText === "debug-noise") return { drop: true };
  return { body: { text: ctx.message.bodyText.replace("staging", "debug") } };
}
```

WebSocket scope 接受消息正文动作与 JavaScript，不接受 HTTP header、跳转或本地响应动作。Ping、Pong、Close 经控制帧路径处理。实现包含完整消息重组与受支持的 `permessage-deflate` 压缩处理。握手无效、协商不支持、解码失败、内存或大小超限时，可能降级抓取或重写。若工具提供 capture-state/gap 诊断应一并读取；未保存消息不代表消息未转发。

## 6. 定时脚本

定时脚本的入口模块必须导出 `onSchedule(input)`，`script_type="single"` 也遵守该约定。周期触发的输入为：

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

时间戳是 Unix 毫秒。App 的手动执行路径才会增加 `trigger`、`parameters`；普通周期触发没有这两个字段。这不代表当前公开 MCP 已提供手动执行工具。

返回值是任务结果，可使用能被 JSON 序列化的对象、数组、字符串、数字、布尔值或 `null`；`undefined` 转为 `null`。它不是 HTTP/WebSocket 修改对象，不会修改已抓取流量。避免循环引用、函数和未转换的 `BigInt`。

```javascript
export async function onSchedule(input) {
  return { taskId: input.task_id, observedAtMs: input.triggered_at_ms, ok: true };
}
```

`create_scheduled_task`/`update_scheduled_task` 使用 `script_type="single"` 配合 `script`，或使用 `script_type="package"` 配合 `script_package: { manifest, modules }`。定时单文件脚本默认没有任何可选宿主模块权限。使用 log/store/http/notify/utils 时必须改用完整 ESM 包并显式开启权限；这一点与重写 `content` 简写不同。

固定间隔为 250–86,400,000 毫秒。Cron 表达式和启用操作由 Lemon 校验。定时执行需要抓包运行时中的调度器和相应功能授权；保存任务不代表正在执行。通过 `get_scheduled_task_runtime_status` 及实际工具返回值核对是否已进入运行状态。

## 7. 公共宿主模块：16 个导出或属性

公共脚本 profile 包含以下 6 个模块。导入需要权限的模块前，必须在 `manifest.permissions` 打开对应权限。

| 模块 | 权限 | 导出与签名 |
| --- | --- | --- |
| `lemon:context` | 隐式可用 | `runtime: "lemon-esm"` |
| `lemon:context` | 隐式可用 | `version: number`，当前为 `1` |
| `lemon:context` | 隐式可用 | `get(): object` |
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

`lemon:context.get()` 返回运行时元信息：`runtime`、`version`、`moduleId`、`locale`、`isModule`。请求、响应、消息数据应通过处理函数参数读取，`get()` 不会提供已抓取事务或通用 App 控制对象。

`lemon:log` 产生有界结构化诊断。当前日志处理会对敏感字段脱敏，并输出长度、哈希信息；不要假定每个原始 message/details 都会完整出现在系统日志中。不要在脚本日志中写入口令或载荷秘密。

`lemon:store` 是按脚本隔离的持久化字符串键值库；不同脚本使用同名 key 不互通。存对象前使用 `JSON.stringify`，读后解析。Key 为 1–256 个 UTF-8 字节，value 最大 1 MiB，TTL 最长 7 天；省略或设为 0 使用不过期形式。缺失或过期时 `get` 返回 `null`。

`lemon:notify.post` 经 iOS 宿主提交通知；是否展示取决于系统通知权限与宿主可用性。title、subtitle、body 各有 512 字节上限。

`lemon:utils` 的字符串输入使用 UTF-8，二进制结果使用字节。gzip/ungzip 异步执行，输入输出受 2 MiB 上限约束。`Uint8Array` 不是文本解码 API；不要使用 `String.fromCharCode(...bytes)` 解码任意 UTF-8 文本。

App 内部还可能存在 `lemon:data`、`lemon:config`、`lemon:i18n`，它们使用 UI Module 专属数据、locale 合约，不属于普通重写/定时脚本的额外权限，本文公共脚本 profile 不包含它们。

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

默认方法 `GET`，方法名使用大写。只接受 HTTPS。异步解析 DNS 后会检查目标地址，拒绝私网、回环、链路本地、多播地址。MCP 通过局域网连接 Lemon，不代表脚本 HTTP API 也能请求用户局域网内的服务。

默认不跟随跳转。开启后限制为原主机上的 HTTPS、较小跳数，并检查取消与授权状态。HTTP timeout 默认 10,000 毫秒，限制为 1–30,000 毫秒；外层处理函数截止时间仍然生效，HTTP 设置 10 秒不会让重写处理函数获得 10 秒执行时间。

请求、响应正文各受 2 MiB 限制，header 受 64 个字段与 16 KiB 限制。只有响应字节为有效 UTF-8 时提供 `bodyText`。结果不是浏览器 Response，应读取 `bodyText`/`bodyBytes`，不能调用 `.json()`/`.text()`。

下面是需要 `http=true`、`store=true` 的定时**脚本包**入口，保存用户授权的少量公网 HTTPS 文本。使用前应将 URL 改为预期公网端点：

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

## 9. 异步调用、资源限制与失败行为

对需要结果或确认完成的 store、HTTP、通知、gzip、ungzip 操作使用 `await`，通过 `async` 函数或返回 Promise 让宿主等待。模块初始化时的顶层宿主调用不能替代处理函数内调用。避免即发即弃的调用和无限制 `Promise.all`，最多允许 8 个待完成宿主操作。

下表为当前源码默认值与上限，不表示连接设备全部已启用这些功能，也不保证每次调用都能获得最大预算：

| 资源 | 当前源码值 |
| --- | --- |
| QuickJS heap / stack | 32 MiB / 256 KiB |
| App 配置的重写执行 / 响应 timeout 默认值 | 均为 30,000 毫秒；设备实际持久化配置可能不同 |
| 核心独立 `JsRuntimeConfig` 执行 / 响应默认值 | 250 毫秒 / 500 毫秒；App/FFI 配置会覆盖这两个值 |
| 定时执行 / 响应 timeout 默认值 | 10 秒；任务配置上限 60 秒 |
| 运行时 ready timeout | 2 秒 |
| Manifest / 单源模块 / 整包源码 | 64 KiB / 512 KiB / 2 MiB |
| 模块数 / 导入图深度 / 动态导入预算 | 128 / 32 / 16 |
| HTTP 重写正文 | 默认 2 MiB；可配置上限 8 MiB |
| 重写队列 | 同时限制数量与字节；进程字节上限 8 MiB + 256 KiB |
| WebSocket 完整消息 | 传输层上限 1 MiB |
| 待完成宿主操作 | 8 |
| HTTP 宿主 API 请求/响应正文 | 各 2 MiB，独立于重写正文配置 |
| 输出 header | 64 个 / 名称和值合计 16 KiB |
| 结构化脚本日志 | 编码后 16 KiB 上限 |

提高 HTTP 重写正文限制不会提高 HTTP 宿主 API 的 2 MiB、WebSocket 的 1 MiB、整包源码的大小限制。取消或授权变化可能中断执行。编译错误、异常、超时、队列饱和、无效输出、资源不足会产生错误或跳过诊断；HTTP 正文替换无法接纳时通常保留原流量。WebSocket 行为还受传输状态影响：引擎报错时保留原消息，但替换消息超过传输层消息上限可能终止会话。应核对替换是否真正采用；已保存 revision 或校验成功不代表网络请求已被修改。

## 10. 协议与发布边界

HTTP/1、HTTP/2 使用相同 header/body 动作模型。当前 App 源码也将接纳的 HTTP/3 stream 接入公共重写流水线；实际 HTTP/3 拦截依赖设备协议开关与拦截前提。当前 HTTP/3 实现拒绝 `CONNECT`，因此普通 HTTP/3 支持不等于支持 WebSocket-over-HTTP/3。

对于受支持的文本**响应**，identity、gzip、deflate、Brotli 可以在有界解码后执行正文规则。未知、叠加编码或解码、大小、预算失败时保留原编码响应；不能由此推断支持一般的压缩请求正文重写。SSE 等流式数据不会成为可任意缓冲处理的完整 HTTP 文本正文。Multipart 请求正文使用专门原生 multipart 动作；当前引擎对 multipart 输入跳过普通请求正文 JavaScript 分发，见[重写规则](rewrite-rules.md)。

公开 MCP 项目当前提供脚本校验、创建或发布 revision、读取、删除、回滚。保存脚本不会自动绑定规则、启用规则、开启全局 JavaScript 重写或启动抓包。正确流程是校验包、发布、用精确匹配范围绑定 scope/phase、核对开关和运行时，再观察新的匹配请求验证。承诺完整操作前，先阅读[兼容性](compatibility.md)中的公开工具缺口。

当前 upsert_rewrite_script 不接受 enabled 参数，也没有独立的重写脚本启停工具；定时任务启停和规则启停是其他接口，不能混用。

## 源码依据

已核对 App 源码标识 `contracts/script_editor_api_catalog.v1.json`、`lemonCore/core/src/rewrite/js_engine.rs`、`lemonCore/core/src/rewrite/json_engine.rs`、`lemonCore/core/src/rewrite/mod.rs`、`lemonCore/ffi/src/settings.rs`、`lemonCore/ffi/src/lifecycle/rewrite.rs`、`lemonCore/ffi/src/lifecycle/scheduler.rs`、`lemonCore/middlewares/src/response_body.rs`、`lemonCore/middlewares/src/http_codec/response_body.rs`、`lemonCore/middlewares/src/http3/semantics.rs`、`lemonCore/middlewares/src/ws_codec/session.rs`、`lemon_ios/InternalModules/Shared/Config/LemonCoreRuntimeConfig.swift`；公开工具合约在 `src/tools.ts`、`src/rewriteScripts.ts`。这些路径仅记录核对来源，公开项目文档可独立阅读，不要求访问 App 源码树。
