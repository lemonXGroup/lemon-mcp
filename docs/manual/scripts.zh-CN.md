> 文档核对（2026-11-07）：本章已按当前模板与脚本引擎源码重写；示例尚未经过本次真机执行。[来源与验证范围](../verification.md)。

# 脚本

[手册合集](../README.md) · [完整脚本 API](../reference/script-api.zh-CN.md) · [English](scripts.en-US.md)

Lemon 使用受限的 QuickJS 原生 ESM。脚本运行环境与 Node.js、浏览器和其他代理工具的脚本接口不同。API 签名、上下文、返回值和限制以本仓库的 [脚本 API](../reference/script-api.zh-CN.md) 及当前设备 validator/runtime status 为准。

## 先选择运行场景

| 场景 | 入口 | 输入 | 返回值 |
| --- | --- | --- | --- |
| 定时任务 | onSchedule(input) | task_id、scheduled_at_ms、triggered_at_ms、schedule_type 等调度字段 | JSON-compatible 的任务结果，不是 HTTP patch |
| HTTP 请求重写 | onRequest(ctx) | ctx.request | HTTP 修改对象 |
| HTTP 响应重写 | onResponse(ctx) | ctx.response | HTTP 修改对象 |
| WebSocket 消息重写 | onWebSocketMessage(ctx) | ctx.message | WS 文本/二进制替换、丢弃或文本注入 |

WebSocket 是当前 App 的能力，当前公开 MCP 的工具和远程 required_handlers 仍存在 [接入差异](../reference/compatibility.md)。不要把定时任务入口用于请求改写，也不要用 HTTP handler 处理 WS 消息。

## 为什么 App 模板是 export async function

App 新建模板使用 `export async function`，方便后续 await 宿主 API。运行时同时接受同步函数返回值和 Promise：仅做同步修改时，`export function` 也合法。正确顺序是 export async function，不是 async export function。

与 App 定时任务模板一致的基本结构：

~~~javascript
// Runs while the VPN runtime is active.
export async function onSchedule(_input) {
  // Add the task logic here. A return value is optional.
}
~~~

宿主 store/http/notify/gzip 等 Promise 操作应 await；不要发起后台操作后直接退出 handler。

## 定时任务

任务保存于手机，依赖 PacketTunnel/VPN runtime。Cron 是五字段表达式；固定间隔由 MCP 限制在 250..86400000 毫秒。查询或保存任务不证明调度器正在运行，需读取 get_scheduled_task_runtime_status。

单文件示例：

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

通过 create_scheduled_task 创建，update_scheduled_task 更新，set_scheduled_task_enabled 启停，delete_scheduled_task 删除。包模式要求 script_type=package 且提供 script_package，script 仍为兼容必填字段，可放入口源码。

定时单文件 shorthand 在核心中默认不授予五项宿主权限；需要 log/store/http/notify/utils 时，请使用显式 manifest 的 package。App 的默认 ESM manifest 与 MCP rewrite content shorthand 则默认开放 log/utils，不能把这些入口的权限默认值混为一谈。

## HTTP Rewrite：同步和异步均可

请求头修改的异步写法：

~~~javascript
export async function onRequest(ctx) {
  if (ctx.request.host !== 'api.example.com') return {};
  return { headers: { 'X-Lemon-Debug': '1' } };
}
~~~

同一逻辑的同步写法：

~~~javascript
export function onRequest(ctx) {
  if (ctx.request.host !== 'api.example.com') return {};
  return { headers: { 'X-Lemon-Debug': '1' } };
}
~~~

正文修改需要配置 body phase，并确认正文可缓冲和成功解码：

~~~javascript
export async function onResponse(ctx) {
  if (typeof ctx.response.bodyText !== 'string') return {};
  const value = JSON.parse(ctx.response.bodyText);
  value.debug = true;
  return { body: { text: JSON.stringify(value) } };
}
~~~

ctx 仅包含当前方向的 request 或 response；不要假定两者同时存在。bodyText 只在正文可用且 UTF-8 有效时出现。返回 `{}`、null 或 undefined 表示不修改。HTTP header 值为字符串或 null，null 用于删除 header。HTTP body 返回 `{body:{text:string}}`；不能返回 body.base64、ctx 或整个 request/response。返回 status 会选择本地响应，具体阶段语义见完整 API。

scope=request/response 与 JS config.phase=header/body 是两个独立维度。规则的 JS action 绑定真实 script_id，例如 decoded config 为 `{"script_id":7,"phase":"body"}`。配置必须作为 action.config 的 JSON 字符串发送。

## ESM 脚本包

完整包由 manifest 与 modules 组成；manifest 声明 packageVersion=1、format=esm、entry、模块 allowlist 和五项 permissions。modules 中每项为 module_id/source。相对依赖必须被 allowlist 包含。

1. validate_rewrite_script_package 校验包结构。
2. upsert_rewrite_script 创建包或发布不可变 revision。
3. 在重写规则 JS action 中引用返回的 script_id。
4. 检查规则开关、全局 Rewrite/JS、runtime apply/reload 状态。
5. 用新请求验证结果，并按 trace 查看 debug events。

content shorthand 仅用于单文件 main.js，不能与 manifest/modules 混用。回滚通过 rollback_rewrite_script 切换 active revision；不要把重载失败误认为 revision 没保存。远程脚本见 [来源管理](../reference/remote-scripts.md)。

## 公共宿主 API

| 模块 | 用途 | 权限 |
| --- | --- | --- |
| lemon:context | runtime/version/moduleId/locale/isModule 等执行环境元信息；不是流量 ctx | 隐式 |
| lemon:log | debug/info/warn/error 结构化日志 | log |
| lemon:store | 命名空间字符串 KV，get/set/remove 为异步 | store |
| lemon:http | 受控 HTTPS 请求 | http |
| lemon:notify | 异步通知 | notify |
| lemon:utils | base64 编解码、异步 gzip/ungzip | utils |

完整 16 项导出/属性和签名见 [API 参考](../reference/script-api.zh-CN.md)。Module 的 data/config/i18n 属于另一运行 profile，不能据此推断普通重写脚本有这些权限。不要假定存在全局 fetch、require、process、浏览器 DOM、任意文件系统或其他代理产品的 $done 等接口。

## 限制与排查

当前 App 的 JS 默认内存为 32 MiB，执行/响应超时经 FFI 配置为 30,000 毫秒；核心独立默认 250/500 毫秒不能代表 App 当前设置。设备可能保存了自定义配置，读取 get_rewrite_runtime_status 为准。HTTP 正文默认 2 MiB、最高 8 MiB，仍受 MIME、可缓冲性和内存预算限制。定时任务默认 10 秒、最大 60 秒。

可解码的压缩响应先解码再进入正文处理。WS 完整消息上限与 HTTP 正文上限不同，详见完整 API。超时、异常、队列或校验失败需要按具体错误排查；记录缺失与流量未发生是不同结论。脚本文档的源码核对不等于当前设备已通过运行验收。
