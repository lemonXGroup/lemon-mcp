---
name: lemon
description: >-
  Use Lemon on a real iPhone for packet capture, HTTP and WebSocket inspection,
  HTTPS/MITM troubleshooting, Rewrite rule CRUD, QuickJS JavaScript scripts,
  scheduled tasks, Replay and Replay Workspace, DNS Hosts, modules, files, logs,
  and database diagnostics. Works through LemonMCP when available or directly
  through the phone's WebControl HTTP API without installing MCP. Also use for
  Lemon 抓包、重写规则、脚本编写、定时任务、请求查询、重放和远程控制。
---

# Lemon

帮助用户完成 Lemon 的具体任务。使用用户的语言回答。按任务加载下面的参考；先查真实接口和文档，再生成规则或脚本。

## 选择执行方式

- 已有 LemonMCP：使用客户端实际发现的工具、资源和输入 schema。先读公开 [能力兼容性](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/compatibility.md)，不要假定安装版本拥有全部 App 接口。
- 无 MCP，但有本地 Python 3.10+ 和网络执行权限：使用随 Skill 提供的 [HTTP 助手](scripts/lemon_http.py)，直接连接手机。无需 npm、Node.js 或 MCP 配置。
- 只能阅读网页、执行环境无法访问手机局域网：读取手册，提供 App 操作或用户本机执行步骤；说明实际未连接设备。阅读 Skill 不会为云端 AI 建立局域网通道。

HTTP 助手路径以本 SKILL.md 所在目录为基准。执行前定位实际安装路径，不要假定当前工作目录就是 Skill 目录。

## 首次连接

1. 引导用户让 **执行 HTTP 请求的电脑与 iPhone 位于可互通的局域网**。检查 Wi-Fi 客户端隔离、VPN 路由等实际问题。
2. 手机打开 Lemon → 控制台（Console）→ 远程控制（Remote Controller），开启开关，等到 Listening。使用该页面显示的实际地址、端口和当前六位口令，保留开头的零。不要硬编码默认设备地址。
3. 地址可在对话中提供；口令通过本地安全输入或凭据注入提供。不要要求用户将口令发送到聊天，也不要读取、复制或显示其他 MCP 客户端的凭据配置。
4. 读取 [连接和凭据](references/connection.md)，选择当前客户端实际支持的输入方式。缺少凭据时，完成可独立进行的文档阅读/代码准备，连接工作等用户在本机输入后继续。
5. 以认证的 GET /api/env 做预检。GET /api/status 只是存活检查。确认 device/system、isConnected、MITM 和证书信息，再执行任务。

HTTP 助手通过 LEMON_BASE_URL 和 LEMON_WEB_CONTROL_TOKEN 读取运行时设置。下面命令假定用户已经通过客户端保护的环境注入完成配置，口令不会出现在命令参数中：

~~~sh
python3 <skill-directory>/scripts/lemon_http.py GET /api/env
python3 <skill-directory>/scripts/lemon_http.py GET /api/requests --query limit=20 --query offset=0
~~~

用户在自己的交互式终端手动执行时可以增加 --prompt-token，使用隐藏输入。没有安全输入能力的 AI 客户端不能凭空弹出密码框。不要把真实口令写入命令、URL、仓库、脚本或日志。

## 按任务加载参考

| 用户目标 | 本地参考 | 进一步的完整契约 |
| --- | --- | --- |
| 启停抓包、HTTPS 证书、MITM、局域网代理 | [操作流程](references/workflows.md) | [手册路由表](references/documentation.md) |
| HTTP 请求、正文、WebSocket 消息与导出 | [HTTP API](references/http-api.md) | [请求手册](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/requests.zh-CN.md) |
| 重写规则查询、创建、更新、删除、启停 | [操作流程](references/workflows.md)、[HTTP API](references/http-api.md) | [规则及全部动作参数](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/rewrite-rules.md) |
| 编写、校验、发布、回滚 JS；远程脚本 | [操作流程](references/workflows.md)、[HTTP API](references/http-api.md) | [脚本 API](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.zh-CN.md)、[远程脚本](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/remote-scripts.md) |
| Cron/interval 定时任务、运行状态与历史 | [HTTP API](references/http-api.md)、[操作流程](references/workflows.md) | [脚本手册](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/scripts.zh-CN.md) |
| 请求重放、批量/流程/参数化 Replay Workspace | [HTTP API](references/http-api.md)、[Workspace 定义](references/replay-workspace.md) | [重放手册](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/replay.zh-CN.md) |
| DNS Hosts、模块包、文件、日志、SQL | [HTTP API](references/http-api.md) | [手册路由表](references/documentation.md) |
| 其他 App 功能或配置 | [手册路由表](references/documentation.md) | [完整双语手册](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/README.md) |

在线读取时获取 raw Markdown 正文，不要仅凭链接标题推测字段。相同文档在完整仓库的 docs/ 下可离线读取。链接无法访问时，明确缺少哪份契约；已有本地参考支持的工作可继续。

修改 URL、Query 或返回 HTTP 重定向时，读取 [请求目标动作](references/request-target.md)，区分内部转发与客户端 3xx，先核对设备能力和参数策略。

## 执行与验证

- 沿用用户已经授权的目标和范围。先读现有对象再编辑，保留不相关字段、顺序和标识。用户已明确要求的操作不重复请求确认。
- 抓包启停用 POST /api/vpn/start 或 /stop，随后重新 GET /api/env 核实 isConnected。没有任务需要时，不自动开始抓包或清空记录。
- 查询先分页摘要，再按真实 ID 获取详情和正文。trace_id 和纳秒时间戳保持十进制字符串，避免 JavaScript Number 丢失精度。
- HTTP 规则提交 {rule, groups} 对象；MCP 的 rule_json/groups_json 是 JSON 字符串。动作 config 在两者中都是 JSON 字符串。不要混用这三层格式。
- 编写脚本前读取完整脚本 API。使用 export async function（或支持的同步 export function），HTTP 的 ctx 只有当前方向；使用 lemon:* 模块。不要生成 Node.js/browser API，或凭空增加上下文成员和权限。
- 脚本包先校验，再发布；规则绑定真实 script_id。默认模板、脚本存储启用、规则启用、全局 Rewrite/JS 开关是不同状态。
- 保存成功、运行时应用成功、新流量实际命中分别验证。保留 persisted/runtime_applied/apply_deferred/apply_error 等返回信息；需要时重载，再通过新请求和调试事件证明效果。
- Replay、定时任务和脚本 HTTP 会发送真实请求。按用户指定的目标、频率、数据和凭据执行，不自行扩大范围。失败或超时后先核实结果再决定重试，避免重复副作用。
- App 全局设置只有已确认的接口才能修改。证书安装与系统信任、全局 MITM/Rewrite/JS 开关、LAN Proxy 等按手册引导用户在 App/系统中操作；不要用数据库写入模拟缺少的 API。
- 401 时核实当前口令和设备；403 capability_required 时说明设备授权要求；404 时核实版本和路径。更换口令后重新准备远程脚本候选，不复用旧凭据绑定的 token。

URL/Query/重定向增量核对：2026-11-13。HTTP 契约原核对日期：2026-11-07，来自当前 App 路由与模型；设备版本可能不同。Skill 不改变设备授权、客户端工具权限或网络可达性。报告实际完成了哪些操作、读回和运行证据，以及尚未完成的手机端验证。
