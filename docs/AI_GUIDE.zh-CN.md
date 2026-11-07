# AI 使用 LemonMCP 的起点

[手册合集](README.md) · [English](AI_GUIDE.md) · [兼容性](reference/compatibility.md)

这份指南帮助 AI 从首次连接进入真实设备调试。先确认当前客户端实际列出的 tools/resources，再按任务读取相关文档。能列出工具、能返回本地 schema、能显示 target 地址，都不等于手机已经连接或口令已经通过验证。

无 MCP 路径：如当前 AI 工具不方便安装 MCP，可使用 [Lemon Skill](../skills/lemon/SKILL.md)。其 HTTP 助手支持本地交互式终端隐藏输入口令；这是独立的直接 HTTP 连接，不会为当前 MCP 服务增加弹窗或注入口令。

## 第一次连接

1. LemonMCP 进程运行的电脑与 iPhone 应处于可以互相访问的局域网，通常连接同一个 Wi-Fi。相同 Wi-Fi 名称也可能有访客网络或 AP 隔离。AI 服务运行在云端时，应由有权访问该局域网的本机 MCP 进程连接手机。
2. 在 iPhone 打开 Lemon → Console → Remote Controller（远程控制），开启服务开关，等待 Listening。以页面显示的实际 URL、端口和当前六位访问口令为准。首次检查先保持 Lemon 在前台。
3. 当前版本从启动环境变量 `LEMON_WEB_CONTROL_TOKEN` 读取口令。请让用户在本机 MCP 客户端配置中填入；保留前导零，将口令作为字符串。不要让用户把口令发到聊天里，也不要把口令作为 MCP 工具参数。
4. 如果用户不方便编辑配置，当前版本需要提供本机配置步骤；目前没有连接工具、Keychain 入口或安全口令弹窗，不能声称已经弹出。后续版本如提供本机安全输入入口，应由该入口直接接收口令，AI 只读取连接结果。
5. 更新环境变量或在手机刷新口令后，重启对应 MCP 服务。当前 API client 在构造时读取口令，修改配置不会刷新已运行进程中的值。
6. 调用 `get_lemon_target_ip` 查看当前目标。Bonjour 发布 `_lemon._tcp`；它的发现结果可以覆盖 fallback。只有发现不可用时，才根据手机显示的地址使用 `LEMON_TARGET_HOST` / `LEMON_TARGET_PORT` 或 `set_lemon_target_ip`，多设备时先确认选中的是用户的手机。默认 `stack.local:9999` 只是 fallback。
7. 读取 `lemonmcp://env/hardware_status`。检查它的内容确实是设备状态，且没有 Error 文本；资源读取请求成功本身不代表设备请求成功。这一步才会调用需认证的设备环境接口。
8. 返回简洁的连接结果：目标设备、地址、认证是否通过、VPN、MITM、证书状态。不要回显口令。连接失败时按网络、服务、认证、授权、客户端版本分别排查。

## 连接失败时

| 现象 | 优先检查 |
| --- | --- |
| 没有可用的 LemonMCP tools | 本机安装、构建入口、MCP 服务是否启动、客户端是否刷新 |
| 超时 / connection refused | Mac 到 iPhone 的连通性、手机前台、远程控制 Listening、实际端口、局域网隔离 |
| `401 / caller_authentication_required` | 当前手机口令、本机配置、是否重启 MCP 服务；不要反复猜口令 |
| `403 / capability_required` | 手机的设备授权、对应能力与会员权限；口令不授予产品权限 |
| 新能力接口 404 或缺少支持字段 | App 与 MCP 的兼容性；读取兼容性参考 |
| tools 可用但手机 MCP 指示不活跃 | 必须完成 MCP initialization，且认证的设备请求成功；只列工具不会完成设备连接 |

公开 `/api/status` 的可达性不足以证明口令有效。VPN 关闭也不等于 WebControl 断开。

## 启停抓包

用户要求开始抓包时，调用 `toggle_vpn({action:"start"})`，随后重新读取设备环境确认 `isConnected`。停止则使用 `action:"stop"` 并复查。不要为读取历史记录而自动启动 VPN。VPN 运行不证明 HTTPS 已解密；另查 MITM、证书信任、目标 App 的证书绑定与绕过策略。

## 查询和分析请求

先用 `search_traffic_previews` 按域名或关键词定位，再用 `get_captured_request` 读取详情。使用 API 返回的 transaction_id / trace_id / 兼容 id，不猜测标识；大整数 ID 保持字符串。只有确有需要时才用 `fetch_binary_payload` 读取 body。区分正文缺失、空正文、预览截断、二进制和最终正文。

结构化事件与请求详情按 trace 关联。诊断 SQL 前先读取 `lemonmcp://database/schema`；使用限定范围的只读查询。不要把“没有日志”直接解释为“没有请求”，也不要为排查自动清理现有数据。

## 创建、读取、修改、停用或删除重写

1. 先读 [规则参考](reference/rewrite-rules.md)；涉及脚本再读 [脚本 API](reference/script-api.zh-CN.md)。当前公开版 `get_rewrite_schema` 的文本尚未追上表达式/multipart/WebSocket，不能单独作为完整能力说明。
2. 查询 `list_rewrite_rules` 和 `get_rewrite_runtime_status`，明确目标规则、匹配范围、动作阶段及全局开关。当前 MCP 没有设置全局 Rewrite/JS 开关的专用工具，必要时引导用户在 App 打开。
3. 使用 `upsert_rewrite_rule`：创建时不带 rule.id；修改时带真实 rule.id，并提交完整的 groups。更新之前保留原规则内容和 group_key，避免丢失其他匹配组或动作。
4. 脚本包先 validate，再发布 revision，随后将 script_id 绑定至 action。普通远程脚本的 prepare/create/configure/refresh/copy 是另一条生命周期，见 [远程脚本](reference/remote-scripts.md)。
5. 停用单条规则通过 upsert 设置 `enabled:false`，并保留其余完整内容。删除使用 `delete_rewrite_rule`；不要把停用改成删除。
6. 分别核对：接口接受、重新读取的持久化结果、runtime snapshot/reload 结果，以及新产生的真实请求结果。必要时读取 `get_rewrite_debug_events` 和限量系统日志。保存成功和重载成功都不能单独证明改写符合要求。

## 按任务读文档

- 抓包或 HTTPS 问题：[Requests](manual/requests.zh-CN.md)、[TUN](manual/tun.zh-CN.md)、[MITM](manual/mitm.zh-CN.md)。
- 规则生成、JSON Path、multipart、WebSocket：[规则参考](reference/rewrite-rules.md)、[兼容性](reference/compatibility.md)。
- 脚本编写、权限、ESM：[脚本 API](reference/script-api.zh-CN.md)、[脚本手册](manual/scripts.zh-CN.md)。
- Replay、DNS、Module、定时任务：从 [完整手册](README.md) 进入；先确认该操作是否已被 MCP 接入。

工具只负责当前开放的操作。Lemon 的 App 能力比 MCP 工具范围更大；没有工具时请说明边界，不能用原始 SQL 写入内部表代替缺少的配置 API。

## 可以直接复制给 AI 的提示词

~~~text
请使用 LemonMCP 帮我连接 Lemon，并完成首次只读检查。
先阅读 https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/llms.txt
以及它链接的 AI 使用指南和兼容性说明。
引导我确认运行 MCP 的电脑与 iPhone 局域网互通、Lemon 的远程控制已开启且显示 Listening。
口令由我在本机安全入口或 MCP 配置中输入，不发到聊天；不要读取或回显凭据。
以当前实际工具为准；如果当前版本没有安全输入入口，明确告诉我需要在哪里本机填写，不要假装弹出窗口。
读取当前 target 和 hardware_status，确认设备与认证，并报告 VPN、MITM 和证书状态。
这一步只检查连接。后续当我提出抓包、查询、规则或脚本任务时，先读对应文档，再执行我已授权的操作并验证结果。
~~~

这是使用指南，不是自动执行指令。联网失败时可读取安装目录内同一份 Markdown。
