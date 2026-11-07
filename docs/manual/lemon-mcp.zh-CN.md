> 文档核对（2026-11-07）：本章整理自已有用户手册，并修正已发现的差异；未逐项验收全部 UI 与运行路径。[来源与验证范围](../verification.md)。

> 本手册随 LemonMCP 独立发布。先读 [AI 使用指南](../AI_GUIDE.zh-CN.md)；精确规则与脚本契约见 [规则参考](../reference/rewrite-rules.md)、[脚本 API](../reference/script-api.zh-CN.md) 和 [兼容性](../reference/compatibility.md)。

## Lemon_MCP 能做什么

Lemon_MCP 是 Lemon 面向 AI Agent 的 Model Context Protocol（MCP）服务。它运行在开发者的 Mac 上，通过标准输入输出与 Cursor、Claude Desktop、Codex 或其他 MCP 客户端通信，再通过局域网 HTTP / Bonjour 连接到正在运行 Lemon 的真实 iPhone。

它让 AI 不仅能阅读一段抓包结果，还能在得到用户授权后完成完整的调试闭环：启动或停止抓包、读取设备状态、搜索并展开请求、分析日志和数据库、重放请求、配置 DNS、管理 Rewrite 规则和脚本包、管理 UI Modules，以及操作 Lemon 内置网页。

本章是给人和 AI 共同阅读的能力契约：工具名、参数名和行为以 Lemon_MCP 运行时通过 MCP `tools/list`、`resources/list` 返回的 schema 为准；服务或 iOS 版本变化后，应重新读取 live schema，不要凭历史记忆猜测参数。

## AI 应该先理解的边界

### Lemon_MCP 不是网络解析引擎

MCP 负责发现设备、编排 WebControl 请求、整理返回数据和管理脚本包。HTTP 协议解析、TLS 解密、压缩处理和抓包落库仍然发生在 iOS 的 Lemon、PacketTunnel 和 lemonCore 中。AI 不应该把“没有可读正文”直接判断为网络失败，应结合 capture state、decode status、原始字节和日志判断。

### 所有操作都针对真实设备

工具操作的是当前 MCP target 指向的 iPhone，不是模拟器，也不是 MCP 进程本身的本地文件。设备需要运行 Lemon 并开启 WebControl，通常与 Mac 位于同一受控局域网；Bonjour 发现不到时，可以手动设置 IP 和端口。

### 读操作和写操作必须分开思考

下面这些操作会改变设备状态或数据，AI 只有在用户明确要求或调试剧本明确需要时才应执行：

- `toggle_vpn` 会启动或停止设备 VPN / PacketTunnel。
- `clear_captured_traffic` 会删除抓包记录和 body 文件。
- `clear_system_logs` 会清空系统日志。
- `upsert_host_mapping`、`delete_host_mapping` 会立即改变 DNS Hosts 映射。
- Replay 的增删改和执行会改变保存的请求或向目标发出请求。
- Rewrite、Module 的发布、回滚、启停和删除会改变运行时配置。
- `execute_raw_sql` 是原始数据库入口，MCP 层没有完整的只读 SQL AST 防火墙。

清理、删除、重放、改变 DNS、发布脚本或安装模块之前，AI 应先说明即将改变的对象，并在结果中区分“持久化成功”“运行时已加载”和“请求已提交”。

## 连接与配置

### 构建 Lemon_MCP

```bash
cd /path/to/lemon-mcp
npm install
npm run build
```

MCP server 使用 Node.js / TypeScript，并通过 `StdioServerTransport` 提供 MCP 通道。它不会在 Mac 上额外开启一个公网 HTTP 服务。

### 在 AI 客户端中配置

始终使用构建产物的绝对路径。下面是通用配置示例，具体配置文件位置由 AI 客户端决定：

```json
{
  "mcpServers": {
    "LemonMCP": {
      "command": "node",
      "args": [
        "/absolute/path/to/lemon-mcp/build/index.js"
      ],
      "env": {
        "LEMON_WEB_CONTROL_TOKEN": "TOKEN_FROM_LEMON_REMOTE_CONTROLLER"
      }
    }
  }
}
```

当前受保护的 WebControl API 要求有效的六位访问口令。MCP 从启动环境变量 `LEMON_WEB_CONTROL_TOKEN` 读取它，以 `X-Lemon-WebControl-Token` 请求头发送；保留前导零。变量未填写时进程仍可启动，但这不表示设备认证能够通过。口令只在本机配置中输入，不写入源代码、教程或聊天；修改后重启 MCP。安全输入弹窗尚未实现，见 [首次连接指南](../AI_GUIDE.zh-CN.md)。

### 设备发现与 target

MCP 完成 stdio 握手后才启动设备发现，避免一个尚未连接 AI 客户端的进程被误判为活跃。发现顺序如下：

1. 通过 Bonjour / mDNS 查找 `_lemon._tcp` 服务，通常服务名为 `Lemon.Local`。
2. 优先使用服务广播的 IPv4 地址和实际端口；没有 IPv4 时使用服务 host。
3. 同时尝试默认 fallback `stack.local:9999`。
4. 自动发现失败时，用 `set_lemon_target_ip` 设置设备 IP 和端口。
5. 用 `get_lemon_target_ip` 复核 MCP 当前实际 target。

每个 Lemon_MCP 进程都有独立的 session。成功的非 ping REST 请求会异步发送 MCP 心跳；正常关闭 transport 时会尽量发送清理请求，iOS 在约 8 秒没有收到当前 session 心跳后也会标记为断开。MCP 活跃不等于 VPN 已连接，VPN 已连接也不等于某个请求已经完成。

## 给 AI 的推荐调试剧本

这是最适合大多数网络问题的顺序。没有必要的步骤不要强行执行。

1. **确认目标**：调用 `get_lemon_target_ip`。连接异常时再调用 `set_lemon_target_ip`，然后重新确认。
2. **读取环境**：读取 `lemonmcp://env/hardware_status`，记录设备、内存、VPN、MITM 和 CA 证书状态。
3. **建立基线**：只有用户要求清理现场时，才调用 `clear_system_logs` 和 `clear_captured_traffic`，记录清理时间。
4. **启动并确认**：调用 `toggle_vpn(action="start")`，然后重新读取环境。工具返回的是“启动请求已提交”，不是同步的 connected confirmation。
5. **触发问题**：让被测 App 重现一次问题。不要在没有触发动作时把空抓包当成失败。
6. **搜索摘要**：调用 `search_traffic_previews(keyword, limit)` 定位请求。域名样关键词使用精确 Host 匹配，普通关键词使用设备端模糊搜索。
7. **展开请求**：用搜索结果中的 `trace_id` 调用 `get_captured_request`，读取完整请求、响应、正文状态和 body 文件引用。
8. **读取原始正文**：如果详情返回 `requestBodyMeta.path` 或 `responseBodyMeta.path`，再调用 `fetch_binary_payload(path)`。不要把预览乱码直接当作原始文件损坏。
9. **关联证据**：先读取 `lemonmcp://database/schema`，再用 `execute_raw_sql` 查询 `trace_events`、`http_requests`、DNS 或 runtime 表。优先使用 `SELECT` 和 `PRAGMA`。
10. **分析日志和 Rewrite**：用 `fetch_system_logs`、`get_rewrite_debug_events` 查看同一时间窗口，必要时用 `list_rewrite_rules`、`get_rewrite_runtime_status` 核对配置。
11. **执行变更**：只有目标和证据清晰、且用户允许时，才使用 Replay、DNS、Rewrite 或 Module 的写工具。写入后分别验证持久化结果和 runtime status。
12. **结束并报告**：需要时调用 `toggle_vpn(action="stop")`，报告 target、设备状态、触发时间、trace、正文路径、日志窗口、SQL 结果、变更结果和仍待真机验证的部分。

## Tool 能力参考

### 设备、VPN 与内置网页

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `toggle_vpn` | `action`: `start` 或 `stop` | 请求启动或停止 iOS VPN / PacketTunnel。返回表示请求已提交，不代表连接状态已完成；用 hardware resource 或其他状态证据复核。 |
| `open_web_page` | `url`: HTTP / HTTPS URL | 在 Lemon 内置 WKWebView 打开网页。只接受有效的 HTTP / HTTPS 地址，禁止 URL 内嵌用户名和密码，最大 4096 字符。 |
| `close_web_page` | 无 | 关闭当前内置 WKWebView；关闭操作是幂等的。 |
| `refresh_web_page` | 无 | 重新加载当前 WKWebView；页面未打开时会返回 `webview_not_open`。 |
| `go_back_web_page` | 无 | 后退内置 WKWebView 历史记录；不会等待页面加载完成。 |
| `go_forward_web_page` | 无 | 前进内置 WKWebView 历史记录；不会等待页面加载完成。 |

网页控制工具在 iOS presentation coordinator 接受命令后返回，不等待网页最终加载。AI 要验证页面内容时，应把打开、等待和后续观测分开。

### 定时 JavaScript 任务

定时任务存储在设备本地，可按五段 Cron 或固定毫秒间隔运行 JavaScript。`interval_ms` 的实现约束是 `250..86400000`；定时执行还需要对应的 entitlement。脚本可以是单文件，也可以是经过校验的 ESM package；package 入口需要从 manifest entry 导出 `onSchedule(input)`。

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `list_scheduled_tasks` | 无 | 列出本地 Cron / interval 任务、运行状态和下次执行时间。 |
| `get_scheduled_task` | `id`: 正整数 | 读取一个定时任务的详细配置。 |
| `get_scheduled_task_runtime_status` | 无 | 读取 PacketTunnel 定时任务 runtime 状态，不暴露脚本源代码。 |
| `create_scheduled_task` | `name`, `schedule_type`, `cron_expr?`, `interval_ms?`, `script_type`, `script`, `script_package?`, `enabled?` | 创建任务。`cron` 需要五段表达式，`interval` 需要毫秒间隔；`single` 不能带 `script_package`，`package` 必须带完整 package；默认启用。 |
| `update_scheduled_task` | `id` 加创建任务字段 | 更新任务配置和脚本，不改变已有执行历史；`enabled` 为必填布尔值。 |
| `set_scheduled_task_enabled` | `id`, `enabled` | 单独启用或停用任务。 |
| `delete_scheduled_task` | `id`: 正整数 | 删除一个本地定时任务。 |

创建或更新后，AI 应检查 schedule type 与对应字段是否匹配，并用 runtime status 判断调度器是否真正可用，不要只根据数据库写入成功下结论。

### 抓包、日志、文件与数据库

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `clear_captured_traffic` | 无 | 清空 HTTP 记录和 body 文件。是破坏性操作，执行前要确认建立新基线的意图。 |
| `fetch_system_logs` | `bytes?` | 读取 `lemoncore.log` 尾部，默认 102400 bytes，适合大日志；增加范围前先明确排查窗口。 |
| `clear_system_logs` | 无 | 清空持久化系统日志，是破坏性操作。适合在清理基线前使用。 |
| `search_traffic_previews` | `keyword`, `limit?` | 搜索请求摘要；limit 默认 50，MCP 会限制在 0 到 1000。域名、IPv4 或带端口 Host 使用精确 Host 过滤。结果包含 `trace_id`、`database_id`、method、url、status、时间、body 长度和最多 500 字符预览。 |
| `get_captured_request` | `trace_id`: 非空字符串 | 读取完整请求 / 响应。这个参数实际可接受 search 返回的 transaction id、trace id 或 legacy database id；结果包含 `requestBodyMeta` 和 `responseBodyMeta`，区分 missing、empty、text、binary_ref、structured。 |
| `fetch_binary_payload` | `path`: body 相对路径 | 读取完整请求或响应 body。严格安全 UTF-8 且无危险控制字符时返回文本，否则返回带 byte length 的 Base64；路径应来自已读取的请求详情。 |
| `fetch_device_file` | `path`: App Group 相对路径 | 读取非数据库文件。常见文本扩展名会按文本读取，JSON 会格式化；其他内容按安全字节读取。`runtime.sqlite` 中的 ESM 包不要用此工具，应使用脚本包工具。 |
| `execute_raw_sql` | `query`: SQLite SQL 字符串 | 在 Lemon SQLite 数据库上执行原始诊断查询。MCP 层没有完整只读 AST 防护，默认只使用 `SELECT` / `PRAGMA`，避免 `UPDATE`、`DELETE`、DDL 和长事务。 |

抓包结果的推荐解释方式是：先看请求是否完成，再看解码状态，最后按 body path 读取原始字节。`response_status` 为空可能是尚未 finalize 或协议并非 HTTP，不等于必然失败；`capture_state=complete` 也不等于正文是 UTF-8。

### 设备 target 管理

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `set_lemon_target_ip` | `ip`, `port?` | 手动覆盖 MCP target。默认端口 9999，适用于 Bonjour 不可达或设备地址变化。设置后应立即用 `get_lemon_target_ip` 复核。 |
| `get_lemon_target_ip` | 无 | 返回当前 MCP 使用的设备 URL，例如 `http://192.168.1.10:9999`。它只说明 target 配置，不证明设备当前健康。 |

### DNS Hosts 映射

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `list_host_mappings` | 无 | 列出当前 native DNS 自定义 Hosts 映射，以及生成号和 revision 等元数据。 |
| `upsert_host_mapping` | `id?`, `domain`, `target?`, `action?`, `enabled?`, `comment?` | 创建或更新映射。`id` 是已有 UUID；`domain` 是匹配域名；`action` 为 `map` 或 `block`；map 需要 IPv4 / IPv6 `target`，block 不需要；`enabled` 默认 true。写入会立即应用，不需要第二次确认。 |
| `delete_host_mapping` | `id`: UUID | 删除映射并立即应用。执行前应先确认 UUID 和影响域名。 |

DNS 映射和 Rewrite 是两条不同链路：Hosts 解决域名解析结果，Rewrite 处理经过代理的请求或响应。分析问题时不要用一个链路的结果替代另一个链路的证据。

### HTTP Replay

Replay 可以把捕获到的请求保存成可复用的请求，也可以执行一次不落库的临时请求。支持 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS`、`CONNECT`、`TRACE`；headers 是字符串到字符串的 map，body 是可选 UTF-8 文本。

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `list_replay_items` | 无 | 列出本地 runtime database 中保存的重放请求。 |
| `get_replay_item` | `id`: UUID | 读取一个保存请求的完整 headers 和 body。 |
| `create_replay_item` | `name`, `url`, `method`, `headers?`, `body?` | 保存新的重放请求；URL 必须是合法 URL，headers 默认空 map。 |
| `update_replay_item` | `id`, `name`, `url`, `method`, `headers?`, `body?` | 修改保存请求，不改变已有执行历史。 |
| `delete_replay_item` | `id`: UUID | 删除保存的重放请求。 |
| `execute_replay_item` | `id`: UUID | 通过 native URLSession / runtime 执行保存请求，返回有界响应预览并更新执行状态。会真实发出请求。 |
| `execute_replay_request` | `url`, `method`, `headers?`, `body?` | 执行一次不保存的临时请求。适合先用 `get_captured_request` 检查，再做最小变更验证。会真实发出请求。 |

重放前先清理或移除一次性认证头、确认目标环境和请求体不含隐私数据。不要把“重放成功”解释为原请求完全等价，服务端状态、时间戳、签名和幂等性都可能不同。

### Rewrite 脚本包

Rewrite 脚本包是存储在 iOS `runtime.sqlite` 中的版本化 ESM package，不是旧版 `RewriteScripts/*.js` 文件。一个完整包由 manifest 和 allowlisted module sources 组成。

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `list_rewrite_scripts` | 无 | 列出脚本包摘要、数字 id、active revision 和启用状态。 |
| `get_rewrite_script_package` | `id`: 正整数，`revision?`: 正整数 | 读取 active 或指定历史 revision 的完整 manifest 和 module source。 |
| `list_rewrite_script_revisions` | `id`: 正整数 | 列出 immutable revision、hash、大小和 active 标记。 |
| `validate_rewrite_script_package` | `manifest`, `modules` | 调用 iOS validator 进行校验，不落库。validator 是路径 allowlist、版本、模块数量和大小限制的最终依据。 |
| `upsert_rewrite_script` | `id?`, `name?`, `manifest?`, `modules?`, `content?`, `reload?` | 创建或发布新 revision。可以提供完整 package，也可以只提供 `content`，由 MCP 转成受限权限的单文件 `main.js`；两种形式不能混用。`reload=true` 会在持久化后请求 runtime reload。 |
| `rollback_rewrite_script` | `id`, `revision`, `reload?` | 切换 active revision，历史 revision 保留；可选 reload。 |
| `get_rewrite_runtime_status` | 无 | 查看 rewrite / JavaScript 开关、资源限制、同步状态和脚本计数。 |
| `get_rewrite_debug_events` | `trace_id?`, `event_type?`, `level?`, `limit?`, `offset?` | 读取结构化 Rewrite debug projection。可按 trace、事件类型、严重级别和分页过滤；limit 默认 200，最大 1000。事件类型示例：`rule_matched`、`mutation_applied`、`script_failed`、`rewrite_skipped`。 |
| `clear_rewrite_debug_events` | `trace_id?` | 传 trace 只清除一条请求的事件；省略时清空整个 debug projection，是破坏性操作。 |
| `reload_rewrite_runtime` | 无 | 请求从 `runtime.sqlite` 加载 active snapshot；VPN runtime 未运行时可能失败，但不会撤销已经持久化的脚本。 |
| `delete_rewrite_script` | `id`: 正整数 | 删除脚本包及其 revision。执行前确认不会影响正在使用的 Rewrite 规则。 |

脚本 manifest 的当前基本约束如下：

```json
{
  "packageVersion": 1,
  "format": "esm",
  "entry": "./main.js",
  "modules": ["./main.js", "./lib/transform.js"],
  "permissions": {
    "log": true,
    "store": false,
    "http": false,
    "notify": false,
    "utils": true
  }
}
```

`modules` 是相对模块路径 allowlist，source 项形如 `{ "module_id": "main.js", "source": "..." }`。只有启用的 Rewrite 规则会加载脚本；JavaScript runtime 开关又由 `rewrite.js_enabled` 独立控制。发布成功但 reload 失败时，结果会同时包含已持久化内容和 `reload.success=false`，AI 必须把它报告为 partial outcome。

### Rewrite 规则

规则 API 管理的是 policy、MatchGroups 和有序 actions。规则的匹配条件不放在 policy 顶层，而放在 `groups_json` 的 MatchGroup 中。

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `list_rewrite_rules` | 无 | 读取全部 Rewrite policies、MatchGroups 和 actions。 |
| `upsert_rewrite_rule` | `rule_json`, `groups_json` | 创建或更新规则。`rule_json` 是 JSON 字符串，包含 `id?`、`name`、`enabled`、`priority`；`groups_json` 是 MatchGroup 数组。更新时 rule 需要带 id。 |
| `delete_rewrite_rule` | `id`: 数字 | 删除一个 Rewrite rule。 |
| `get_rewrite_schema` | 无 | 返回本地 rule、MatchGroup、action 和 ESM package 提示；新能力描述滞后，创建规则时同时读取规则参考和兼容性。 |

MatchGroup 的核心结构示例：

```json
{
  "group_key": "123e4567-e89b-12d3-a456-426614174000",
  "enabled": true,
  "order": 0,
  "allows_match_all": false,
  "conditions": [
    { "field": "host", "op": "eq", "value": "api.example.com" }
  ],
  "actions": [
    {
      "enabled": true,
      "scope": "response",
      "action": "header_mod",
      "config": "{\"operation\":\"set\",\"key\":\"X-Lemon-Debug\",\"value\":\"1\"}",
      "order": 0
    }
  ]
}
```

HTTP action scope 是 `request` 和 `response`。当前 App 还支持 `websocket_client` 和 `websocket_server`，只允许 body_replace/js；公开 MCP 的 schema 提示尚未同步，见 [兼容性](../reference/compatibility.md)。action type 是：

- `header_mod`：修改 HTTP headers。
- `body_replace`：按字面文本、正则、精确 JSON Path 或 multipart 普通字段执行正文修改；完整参数见 [规则参考](../reference/rewrite-rules.md)。
- `mock_file`：返回本地 payload。
- `redirect`：执行 HTTP redirect。
- `js`：调用 ESM script package，config 可以是 `{"script_id":7,"phase":"body"}` 这样的 JSON 字符串。

同一 MatchGroup 内的 conditions 使用 AND；匹配到的多个 groups 使用 OR，且不会因为第一个 group 命中而短路。动作还有自己的 `order`，request / response scope 必须与实际修改阶段一致。AI 生成规则时先读 [精确规则参考](../reference/rewrite-rules.md) 并对照 `get_rewrite_schema`；该工具文本尚未覆盖新能力。涉及脚本时用 `validate_rewrite_script_package` 检查脚本包，最后保存并核对 runtime status / debug events。

### UI Modules

Modules 是可以安装、启用并在 Lemon 内运行的 UI 扩展。MCP 提供包的检查、发布、revision、启停和 runtime 生命周期管理。模块 package 的最终 schema 由 iOS validator 决定，不能只依据旧版示例拼接字段。

| Tool | 输入 | 能力和注意事项 |
| --- | --- | --- |
| `list_modules` | 无 | 列出已安装 host-side UI Modules、active revision 和启用状态。 |
| `get_module_package` | `module_id`, `revision?` | 读取指定模块 active 或历史 revision 的完整 manifest 和 ESM sources。module id 使用 reverse-domain 形式。 |
| `list_module_revisions` | `module_id` | 列出 immutable module revisions、hash 和 active revision。 |
| `validate_module_package` | `package_json`: 完整 JSON 字符串 | 调用 iOS validator 校验 package，不落库。 |
| `upsert_module` | `package_json`, `reload?` | 安装模块或发布新 revision；`reload=true` 时持久化后请求重载所有 active workers。 |
| `rollback_module` | `module_id`, `revision`, `reload?` | 切换到历史 revision，历史会保留；可选重载指定 worker。 |
| `toggle_module` | `module_id`, `enabled` | 启用或停用模块；停用时会释放对应 worker。 |
| `delete_module` | `module_id` | 删除模块及其全部 immutable revisions。 |
| `get_module_runtime_status` | 无 | 读取 active module workers、leases 和 runtime limits。 |
| `reload_module_runtime` | `module_id?` | 释放一个模块或全部模块 worker，使下一次激活读取 active revision。省略 module id 时重载全部。 |

模块 package V2 通常包含以下信息：`packageVersion`、`kind`、`format`、manifest、capabilities 和 `files`。manifest 还描述 module id、moduleVersion、entrypoints、locales、assets、UI schema、required entitlements 和 permissions。当前 UI renderer 支持 text、button、toggle、picker、stepper、slider、textField、searchField、textEditor、codeEditor、list、table、chart、image、navigation、sheet、alert 等受 allowlist 控制的节点；具体可用控件仍以 package validator 和 iOS host contract 为准。

模块的 host permissions 包括 `log`、`store`、`http`、`notify`、`utils`；data capabilities 由 package 声明并由 host allowlist 检查。`lemon:*` bridge 只能导入已声明且已启用的能力。AI 读取模块时应先看 manifest、capabilities、entrypoints 和 source，再决定是否安装或启用。

以下三个工具是早期客户端保留的兼容别名，不应与 canonical tool 重复调用：

| 兼容 Tool | 等价能力 |
| --- | --- |
| `inspect_module` | 读取一个模块的 active manifest、UI schema 和 ESM sources，优先使用 `get_module_package` 获取 active / historical package。 |
| `install_module` | 发布模块 package 的早期别名，输入 `package_json`；优先使用 `upsert_module`，因为它支持可选 reload。 |
| `set_module_enabled` | `toggle_module` 的早期别名。 |

### MCP Resources

Resources 是 AI 可读取的上下文，不是带写入动作的 tools。建议在诊断开始时按需读取，不要每次都把完整数据库 schema 重复塞进上下文。

| Resource URI | 内容 | 用法 |
| --- | --- | --- |
| `lemonmcp://env/hardware_status` | 设备健康快照，包括内存、VPN 状态、MITM configured / effective、CA 证书安装和系统信任等环境信息。 | 先于 VPN、抓包和 runtime 结论读取；它是某一时刻快照，不替代后续状态复核。 |
| `lemonmcp://database/schema` | 动态读取 Lemon SQLite 表列表及每张表的列描述。 | 先读 schema，再生成 `execute_raw_sql`；不要凭旧表名或字段名猜 SQL。 |

## 证据关联与常见误判

### 用 trace 关联数据

`search_traffic_previews` 返回的是面向 UI / MCP 的摘要。其 `trace_id` 字段可能来自 `transaction_id`、旧 `trace_id` 或数据库 id；它适合继续调用 `get_captured_request`，但不保证就是 recorder 跨表查询用的真实 `trace_events.trace_id`。需要跨表分析时，先用详情或 URL + 时间窗口在 SQL 中找出真实 `trace_id` 和 `transaction_id`。

推荐的只读 SQL 证据链：

```sql
SELECT trace_id, stage, message, created_at
FROM trace_events
WHERE trace_id = '...'
ORDER BY created_at;

SELECT transaction_id, request_scheme, host, request_path,
       response_status, capture_state, decode_status,
       response_body_path, failure_reason, finalize_reason
FROM http_requests
WHERE trace_id = '...';
```

不要把以下现象直接当成根因：

- `H2 session ended with error` 只说明连接级事件，需要结合每个 HTTP transaction 的 finalize 状态。
- 端口 443 或 UI 显示 HTTPS 不能替代 `request_scheme` 和 protocol detection 证据。
- 乱码 preview 不能替代原始字节、MIME、encoding 和 decode status。
- VPN UI 断开不能单独证明某个请求失败，应结合 VpnController、PacketTunnel、runtime status 和 trace。
- 数据库初始化错误时不能新建空库覆盖现场。
- MCP tool 返回成功有时只代表 WebControl 接受请求，不能自动推导运行时已加载或网页已完成加载。

### 写操作后的验证

每次变更都把状态拆成三个层次：

1. **请求层**：MCP 是否成功发出请求，WebControl 是否返回错误。
2. **持久化层**：list / get 工具能否读取新的规则、revision、mapping、task 或 module。
3. **运行时层**：runtime status、reload 结果、debug event 或下一次真实请求是否证明新状态已生效。

尤其是 Rewrite / Module 发布，持久化成功和 reload 失败可以同时发生；rollback 只切换 active pointer，不删除历史 revision。AI 必须保留 partial outcome，不要为了给出“成功”而隐藏 reload 错误。

## 最小安全规则

- 只在用户控制的设备和网络中使用 Lemon_MCP，不要把 WebControl 端口通过端口转发暴露到公网。
- 不要把 token、Cookie、Authorization、个人数据或生产密钥写入 Markdown、规则、Replay、脚本或日志。
- 清理、删除、DNS 写入、Replay 执行、Rewrite / Module 发布和原始 SQL 都要有明确目的。
- 读取文件和 body 时使用工具返回的相对 path，不要猜绝对路径或绕过 secure path resolver。
- 处理二进制时保留 `byteLength`、encoding 和 path；不要把 Base64 当作业务正文。
- 对每次调试记录 target、设备 / iOS、Lemon / Core 版本、时间窗口、触发动作、trace、证据和结论。
- 没有真机连接时，把结论标记为“代码或契约层判断，待真机验证”，不要伪造设备结果。

这套能力使 AI 可以参与从“复现问题”到“收集证据”再到“验证修复”的完整流程，但最终的网络权限、数据删除、真实请求和配置发布仍然属于用户控制范围。

## 独立公开版本补充

此公开快照实际注册 67 个 tools、2 个 resources。新增的 6 个远程脚本工具见 [远程脚本](../reference/remote-scripts.md)。当前 App 的表达式、JSON Path、multipart 和 WebSocket 能力需要结合 [规则参考](../reference/rewrite-rules.md)、[脚本 API](../reference/script-api.zh-CN.md) 与 [兼容性](../reference/compatibility.md) 阅读，不能仅凭旧 get_rewrite_schema 文本生成规则。首次连接按 [AI 指南](../AI_GUIDE.zh-CN.md) 完成。已认证接口需要当前手机口令；客户端配置环境变量并不代替设备端权限。
