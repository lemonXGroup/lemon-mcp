> 文档核对（匹配契约更新于 2026-11-10，其余沿用 2026-11-07 核对）：本章整理自已有用户手册，并修正已发现的差异；未逐项验收全部 UI 与运行路径。[来源与验证范围](../verification.md)。

> 本手册随 LemonMCP 独立发布。先读 [AI 使用指南](../AI_GUIDE.zh-CN.md)；精确规则与脚本契约见 [规则参考](../reference/rewrite-rules.md)、[脚本 API](../reference/script-api.zh-CN.md) 和 [兼容性](../reference/compatibility.md)。

## 重写是什么

“重写”用于在流量经过 Lemon 时，按照匹配条件修改请求或响应。它适合本地联调、接口 Mock、临时切换测试环境、补充调试请求头，以及快速验证客户端对异常响应的处理。

重写规则改变经过 Lemon 的流量；改写后的请求仍可能改变服务器业务状态。开始前请确认设备流量已经接入 Lemon，并且 HTTPS 检查所需的证书已经正确配置。

## 进入重写控制台

1. 打开 Lemon 的 **Console**。
2. 选择 **Rewrite（重写）**，进入重写规则列表。
3. 使用页面顶部的 **Enable Rewrite（开启重写）** 开关控制整个重写引擎。
4. 点击新增按钮创建规则；已有规则可以通过列表中的开关单独启用或停用。

全局开关关闭时，单条规则即使保持启用，也不会参与匹配。修改规则后，使用 **Reload Rewrite（重载重写引擎）** 让最新配置重新加载。

## 创建一条规则

### 1. 先确定作用阶段

在编辑页选择动作作用于 HTTP 请求、HTTP 响应，或两个 WebSocket 消息方向：

| 阶段 | 适合处理的内容 | 常见例子 |
| --- | --- | --- |
| 请求 | 发往服务器之前的请求 | 修改请求头、请求正文，或按动作执行重定向 / 本地响应 |
| 响应 | 服务器返回之后的响应 | 替换响应体、修改响应头、Mock 文件 |
| WebSocket 客户端消息 | HTTP/1 Upgrade 后发往服务端的完整消息 | body_replace 或 onWebSocketMessage 脚本 |
| WebSocket 服务端消息 | HTTP/1 Upgrade 后发往客户端的完整消息 | body_replace 或 onWebSocketMessage 脚本 |

阶段会影响可以使用的匹配字段和动作。遇到“规则保存成功但没有效果”，优先检查阶段是否选反。

### 2. 添加匹配条件

在 Match 区域配置规则的触发范围。常用字段包括：

- **Host**：匹配域名，例如 `api.example.com`。
- **Path**：匹配 URL 路径，例如 `/api/v1/profile`。
- **Query（参数）**：匹配原始参数串，例如 `packageId=1`。
- **Method**：限制 `GET`、`POST` 等 HTTP 方法。
- **匹配操作符**：根据字段选择精确匹配、包含、前缀、后缀或正则等操作。

默认匹配模式中，同组条件使用 AND；多组启用匹配组按顺序判断，命中后不会短路，多个组都可能执行动作。建议先用 Host 和 Path 缩小范围，再按需增加 Query、Method，避免把规则应用到整个域名的所有请求。

需要组合多组条件时，使用多个 **Match Group**。每组内部用于描述一组完整的匹配条件；组与组之间用于表达更宽的匹配范围。保存前可以用一条已知请求检查每个字段的实际值。

### 参数与 Host 通配符

参数（Query）匹配不带开头 `?` 的原始参数串，保留编码、大小写和参数顺序，忽略 fragment。支持等于、前缀、后缀、包含和正则，并与 Host、Path、Method 取 AND。精确匹配某个参数值时，可使用参数正则 `(^|&)packageId=1(&|$)`，避免“包含 `packageId=1`”同时命中 `packageId=10`。正则 `^$` 可匹配无参数或空参数串。完整 URL 表达式模式会保留但忽略这些默认条件。

Host 的等于、前缀、后缀、包含模式支持 `*` 匹配任意长度，`?` 匹配单个字符。开头的单个 `*.` 同时包含根域及全部子域，不新增模式。例如，等于 `*.example.com` 命中 `example.com`、`a.example.com` 和 `a.b.example.com`，不命中 `badexample.com`、`example.com.evil.test`；等于 `api?.example.com` 要求问号位置恰好有一个字符。只有最开头的单个 `*.` 有根域例外，内部 `*.` 的点号仍需匹配。

前缀、后缀、包含保留字符串位置语义：“后缀 `*.example.com`”也会命中 `badexample.com`。仅限定根域及子域时请选择“等于 `*.example.com`”。通配符不能消费端口、userinfo、路径或参数；正则及其他字段保持各自语法。仅含星号的 Host 复用现有“匹配全部”确认。

使用前确认设备 /api/rewrite/capabilities 返回 host_wildcards version=1、root_domain=true 及四种操作符。公开 MCP 会在保存前检查，仍允许关闭已有规则。已有本地通配条件升级后直接采用新语义。含 Host 通配条件的分享使用版本 5、云备份和本地恢复使用版本 6，非活动条件也计入版本判断；参数条件沿用已有格式，不认识 query 字段的旧客户端会拒绝导入。

### 3. 选择动作

在 Action 区域选择命中后执行的动作。当前控制台支持的主要类型包括：

- **Header modification**：添加、修改或删除请求头 / 响应头。
- **Body replacement**：用指定文本替换请求体或响应体。
- **Mock file**：使用本地文件作为响应内容。
- **Redirect**：将请求导向另一个地址。
- **JavaScript action**：使用脚本对匹配到的请求或响应做更灵活的处理。

动作参数要和规则阶段保持一致。例如修改请求头应放在请求阶段，替换服务端返回内容应放在响应阶段。一个规则尽量只负责一个清晰的调试目的，多个目的可以拆成多条规则，排查时更容易定位。

## 三个常用场景

### 修改测试环境请求头

将规则阶段设为请求，在 Host / Path / Method 中限定目标接口，然后选择 Header modification。例如增加一个仅供本地调试使用的标记：

```text
Header: X-Lemon-Debug
Value: true
```

不要把真实账号、Token 或生产密钥写入共享规则。调试完成后及时停用或删除规则。

### 把接口响应替换为本地数据

将规则阶段设为响应，匹配目标接口，选择 Body replacement 或 Mock file。JSON 内容应保持有效，并尽量保留客户端实际依赖的字段。例如：

```json
{
  "code": 0,
  "data": {
    "enabled": true,
    "items": []
  }
}
```

如果使用 Mock file，确认文件位于 Lemon 可以访问的共享存储中，并在规则编辑页选择正确的文件。

### 用 JavaScript action 做条件处理

脚本动作适合需要根据请求内容决定修改方式的情况。下面示例符合当前 HTTP 请求头脚本契约；同步 `export function` 和 App 默认的 `export async function` 均受支持，详细 API 见 [脚本参考](../reference/script-api.zh-CN.md)：

```js
export async function onRequest(ctx) {
  if (!ctx.request.path?.startsWith('/api/v1')) return {};
  return { headers: { 'X-Lemon-Debug': 'true' } };
}
```

脚本使用原生 ESM handler，并返回符合契约的修改对象；不要直接返回 request、response 或 ctx。需要宿主网络调用时必须显式授权 `http` 权限并 await 受控的 `lemon:http`；不要把敏感信息输出到日志。

## 保存、应用与验证

完成编辑后按以下顺序验证：

1. 保存规则，确认它出现在规则列表中。
2. 确认规则开关处于启用状态，并确认全局 **Enable Rewrite** 已开启。
3. 必要时点击 **Reload Rewrite**，确保引擎读取了最新规则。
4. 从客户端重新发起一条能命中条件的请求。
5. 在请求详情和响应详情中对比修改前后的 Header、URL、Body 或状态码。

不要只通过规则列表判断是否命中。实际请求的 Host、Path、Method 和阶段才是最终依据。

## 没有生效时怎么排查

按下面的顺序检查通常最快：

1. Lemon 是否正在捕获目标设备流量。
2. 请求是否经过了 HTTPS 检查；未解密的 HTTPS 内容无法按明文 Body 进行匹配或替换。
3. 规则全局开关和单条规则开关是否都已开启。
4. 阶段是否选择正确，Host / Path 是否包含了端口、大小写或实际前缀差异。
5. 匹配操作符和 Match Group 的组合是否比预期更严格或更宽泛。
6. 动作参数是否完整，Mock 文件是否可读，脚本是否返回了正确的结果。

排查时查看 **Rewrite Debug / Rewrite Events** 相关日志，重点关注规则是否被加载、是否命中，以及动作执行阶段是否出现错误。临时调试完成后关闭详细日志，避免影响正常使用。

## 规则顺序与安全边界

规则越宽泛，越容易影响不相关的请求。建议：

- 使用明确的 Host、Path 和 Method，避免只匹配一个过宽的域名。
- 将临时规则保持停用，确认需要时再打开。
- 多条规则同时命中时，先从日志确认执行顺序，再拆分或收窄规则。
- 删除或分享规则前检查其中是否包含本地路径、账号信息或敏感 Header。
- 受保护规则、DRM 内容或会员能力可能受应用版本和授权状态限制，不能通过普通重写规则绕过。

重写是本地调试工具。请仅对自己有权限测试的应用和服务使用，并遵守服务条款与相关法律法规。

## 精确规则与新能力

完整 MatchGroup、表达式、JSON Path、multipart、WebSocket scope 和 MCP 增删查改格式见 [规则参考](../reference/rewrite-rules.md)。脚本入口、上下文和返回值见 [脚本 API](../reference/script-api.zh-CN.md)。当前公开 MCP 的接入差异见 [兼容性](../reference/compatibility.md)。
