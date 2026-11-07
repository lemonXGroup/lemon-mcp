# LemonMCP

[English documentation](./README.md)

LemonMCP 是面向 [Lemon for iOS](https://github.com/lemonXGroup/lemonAllinOne)
的本地 [Model Context Protocol](https://modelcontextprotocol.io/) 服务。
它允许 Cursor、Claude Desktop、Codex 或其他 MCP 客户端，通过本地
WebControl API 检查和控制运行 Lemon 的真实 iPhone。

LemonMCP 运行在开发者的 Mac 上，通过 stdio 与 AI 客户端通信。它不会在
Mac 上开启公网 HTTP 服务，而是通过 Bonjour/mDNS 发现 Lemon 设备，再向
iPhone 上的 WebControl 服务发送经过认证的 HTTP 请求。

## 使用 AI 快速安装

如果你的 AI 客户端拥有本机终端权限，可以直接复制下面的提示词。它会让 AI
检查本机环境、安装或更新 LemonMCP、构建项目，并生成当前客户端需要的 MCP
配置。

```text
请帮我在本机安装并配置 LemonMCP。

项目地址：https://github.com/lemonXGroup/lemon-mcp.git
默认安装目录：~/lemon-mcp

请严格执行以下要求：
1. 先检查 git 和 Node.js 版本。Node.js 必须是 20 或更高版本；如果不满足，
   先告诉我需要安装或切换的版本，不要使用 sudo，不要修改系统 Node.js。
2. 如果 ~/lemon-mcp 不存在，克隆项目；如果已经存在，先检查工作区是否有
   未提交修改。工作区有修改时不要覆盖或强制 reset，先报告并等待处理；干净
   时使用 git pull --ff-only 更新。
3. 在项目目录执行 npm ci 和 npm run build。安装完成后执行 npm test，并报告
   测试结果。
4. 找出我正在使用的 MCP 客户端及其配置文件。只修改明确属于该 MCP 客户端
   的配置，修改前保留一个本地备份，不要覆盖其他服务器配置。
5. 添加名为 LemonMCP 的 stdio server，使用构建产物的绝对路径：
   command 为 node，args 为 <项目绝对路径>/build/index.js。
6. 不要让我在聊天中发送 WebControl token，也不要打印、上传或写入仓库。
   如果客户端需要 token，在本地配置中留下占位符，并告诉我只在本机替换：
   LEMON_WEB_CONTROL_TOKEN=请在本机填写
7. 如果 Bonjour 不可用，为 LEMON_TARGET_HOST 和 LEMON_TARGET_PORT 提供可选
   的本机配置示例；默认不要猜测或修改设备地址。
8. 不要启动长期运行的 LemonMCP 进程，不要执行清理抓包、写 DNS、Replay、
   Rewrite、Module 或其他有副作用的 MCP 操作。安装结束后告诉我需要重启或
   刷新哪个 MCP 客户端。
9. 最后报告：安装目录、构建结果、测试结果、修改的配置文件、备份位置，以及
   仍需我在本机完成的 token 或客户端重启步骤。
```

AI 不能替代本机授权。若当前客户端不能修改本机文件，请让它执行安装和构建
命令后输出配置片段，再手动粘贴到对应的 MCP 配置文件。整个安装过程不需要
GitHub Actions、Docker 或全局 npm 安装。

## 用户手册与 AI 使用

安装后先读 [完整双语手册合集](docs/README.md)、[AI 首次连接指南](docs/AI_GUIDE.zh-CN.md)
和 [能力兼容性](docs/reference/compatibility.md)。合集包含 16 章中英文用户手册、
全部工具输入 schema、重写 CRUD/动作参数，以及按当前源码核对的脚本 API。

可将 [公开 AI 入口 llms.txt](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/llms.txt)
交给 AI 在线读取。当前服务不会自动把这些文件载入客户端；公开副本的待同步能力
已在兼容性文档中明确列出。

## 能力概览

当前服务注册 67 个工具和 2 个资源。MCP 客户端实际获得的工具 schema
是运行时的最终事实来源，下面的内容用于帮助人类用户和 AI Agent 快速理解
能力范围。

### 设备和内置网页

- toggle_vpn：请求启动或停止 VPN/PacketTunnel。
- open_web_page：在 Lemon 内置 WKWebView 中打开 HTTP 或 HTTPS 地址。
- close_web_page、refresh_web_page、go_back_web_page、
  go_forward_web_page：控制当前内置网页。

### 定时 JavaScript 任务

- list_scheduled_tasks、get_scheduled_task：查看设备本地保存的任务。
- get_scheduled_task_runtime_status：查看 PacketTunnel 调度器状态。
- create_scheduled_task、update_scheduled_task：创建或更新 Cron
  或固定间隔任务。
- set_scheduled_task_enabled、delete_scheduled_task：修改任务状态或
  删除任务。

任务支持单个 ESM 文件或经过校验的 ESM 脚本包。定时任务脚本包必须从
manifest entry 导出 onSchedule(input)。固定间隔由 MCP schema 限制在
250..86400000 毫秒范围内。

### 抓包、日志、文件和数据库

- clear_captured_traffic：清除抓取的 HTTP 记录和 body 文件。
- fetch_system_logs、clear_system_logs：读取或清理 Lemon Core 日志。
- search_traffic_previews：按关键词或 Host 搜索请求摘要。
- get_captured_request：读取完整请求、响应和正文元数据。
- fetch_binary_payload：读取请求或响应引用的完整 body。
- fetch_device_file：读取非数据库的 App Group 文件。
- execute_raw_sql：在 Lemon SQLite 数据库上执行诊断查询。

建议使用 search_traffic_previews 定位请求，再使用 get_captured_request
获取最终详情。二进制或包含不安全控制字符的正文会以无损且有边界的格式
返回，不会被强制当作普通文本解码。

### 设备目标和 DNS Hosts

- set_lemon_target_ip、get_lemon_target_ip：查看或覆盖当前 WebControl
  主机和端口。
- list_host_mappings：列出原生 DNS Hosts 映射。
- upsert_host_mapping：创建或更新映射或拦截规则。
- delete_host_mapping：通过 UUID 删除映射。

### HTTP Replay

- list_replay_items、get_replay_item：查看已保存的请求。
- create_replay_item、update_replay_item：保存或编辑请求。
- delete_replay_item：删除已保存的请求。
- execute_replay_item：执行已保存的请求。
- execute_replay_request：执行一次不保存的临时请求。

Replay 执行会真实发出网络请求。执行前请确认目标地址、凭据、请求头、请求体
以及预期的服务端副作用。

### Rewrite 脚本包

- list_rewrite_scripts、get_rewrite_script_package：查看当前或历史脚本包。
- list_rewrite_script_revisions：查看不可变 revision。
- validate_rewrite_script_package：在不落库的情况下校验脚本包。
- upsert_rewrite_script：创建脚本包或发布新的 revision。
- rollback_rewrite_script：切换当前 active revision。
- get_rewrite_runtime_status：查看 JavaScript runtime 状态和资源限制。
- get_rewrite_debug_events、clear_rewrite_debug_events：读取或清理
  结构化调试事件。
- reload_rewrite_runtime：请求重载 Rewrite runtime。
- delete_rewrite_script：删除脚本包及其 revision。

完整脚本包由 manifest 和 allowlisted ESM modules 组成。
upsert_rewrite_script 也支持单文件 content shorthand，该 shorthand 会被
转换为受限的 main.js 脚本包。发布前建议调用
validate_rewrite_script_package，发布后分别检查持久化结果和 runtime 状态。

### 远程 Rewrite 来源

- prepare_remote_rewrite_script、create_remote_rewrite_script：预检与安装。
- get_remote_rewrite_script、configure_remote_rewrite_script：读取与修改来源配置。
- refresh_remote_rewrite_script、copy_remote_rewrite_script：更新或复制为独立本地快照。

使用前请读 [远程脚本生命周期](docs/reference/remote-scripts.md)。

### Rewrite 规则

- list_rewrite_rules：列出 policy、MatchGroup 和 action。
- upsert_rewrite_rule：使用 rule_json 和 groups_json 创建或更新规则。
- delete_rewrite_rule：通过数字 id 删除规则。
- get_rewrite_schema：返回当前规则、action 和脚本包 schema。

同一个 MatchGroup 内的条件使用 AND，多个匹配组使用 OR。生成规则前应先
读取 get_rewrite_schema，确认当前实现接受的字段和 action 值。

### UI Modules

- list_modules、get_module_package：查看已安装模块和脚本包 revision。
- list_module_revisions：查看不可变 revision。
- validate_module_package：在安装前校验模块包。
- upsert_module：安装模块或发布新的 revision。
- rollback_module：激活历史 revision。
- toggle_module：启用或停用模块。
- delete_module：删除模块及其全部 revision。
- get_module_runtime_status：查看 active workers 和 runtime 限制。
- reload_module_runtime：释放单个 worker 或重载全部 worker。

以下兼容别名会继续保留，以支持早期客户端：
inspect_module、install_module 和 set_module_enabled。新集成应优先使用
上面的 canonical module tools。

### MCP Resources

- lemonmcp://env/hardware_status：设备、内存、VPN、MITM 和 CA 证书状态
  的即时快照。
- lemonmcp://database/schema：Lemon SQLite 当前表和字段描述，用于生成
  准确的诊断 SQL。

Resources 是只读上下文，不会替代后续的状态检查，也不会替代工具调用返回的
详细结果。

## 系统要求

- macOS 和 Node.js 20 或更高版本。
- 在真实 iPhone 上运行并开启 WebControl 的 Lemon for iOS。
- Mac 和 iPhone 位于可互相访问的局域网，或使用支持 Bonjour 服务转发的连接。
- 调用需认证的设备接口，需要当前有效的 WebControl 访问口令。

Lemon 通过 Bonjour 发布 _lemon._tcp 服务。默认 fallback 地址为
stack.local:9999。如果需要使用其他 fallback 地址，可以设置
LEMON_TARGET_HOST 和 LEMON_TARGET_PORT。Bonjour 发现结果优先于 fallback
配置。

## 安装和构建

    npm ci
    npm run build

直接启动服务：

    export LEMON_WEB_CONTROL_TOKEN='TOKEN_FROM_LEMON_REMOTE_CONTROLLER'
    npm start

token 从环境变量读取，只会作为 X-Lemon-WebControl-Token 请求头发送。
不要将它提交到仓库、放入会被他人共享的 MCP 配置，或包含在 issue 报告中。

## 配置 MCP 客户端

使用构建产物的绝对路径。具体配置文件位置取决于 MCP 客户端：

    {
      "mcpServers": {
        "LemonMCP": {
          "command": "node",
          "args": [
            "/absolute/path/to/lemonMCP/build/index.js"
          ],
          "env": {
            "LEMON_WEB_CONTROL_TOKEN": "TOKEN_FROM_LEMON_REMOTE_CONTROLLER"
          }
        }
      }
    }

如果不能使用 Bonjour fallback 地址，可以在同一个 env 对象中增加
LEMON_TARGET_HOST 和 LEMON_TARGET_PORT。

MCP 进程会等 stdio handshake 完成后才开始发现设备。WebControl 请求成功后，
会异步发送带 session 标识的 activity ping；stdio transport 关闭时，会尝试
清理 iOS 侧对应的 session。

## 安全边界

LemonMCP 可以改变设备状态，也可以发送真实网络请求。以下操作都应视为
具有明确副作用的操作：

- 启动或停止 VPN。
- 清理抓包记录或系统日志。
- 执行原始 SQL。
- 写入 DNS 映射。
- 执行 Replay。
- 发布或删除 Rewrite 配置。
- 安装、启停或删除 Module。

AI 客户端执行破坏性操作或外部操作前，应说明目标对象和预期效果。涉及配置
变更时，还应分别确认以下三个结果：

1. WebControl 是否接受了请求。
2. 新状态是否已经持久化，并且可以重新读取。
3. iOS runtime 是否已经加载新状态，或真实请求是否证明修改已经生效。

请只在受信任的网络中运行 WebControl。不要将 WebControl 端口暴露到公网，
也不要将凭据、Cookie、Authorization 请求头、隐私数据或生产密钥写入脚本、
Rewrite 规则、Replay、日志或 Markdown 示例。

## 开发

    npm ci
    npm test

公开项目包含以下确定性单元测试：

- API client。
- Bonjour target 选择。
- 字节内容处理。
- 抓包请求规范化。
- 文件内容格式化。
- 流量搜索。
- Rewrite 脚本包校验。

真实设备 E2E fixture 保留在 Lemon 主仓库中，因为它依赖受控 iOS 设备、私有
测试后端以及主仓库专用的清理工具。

## 与 Lemon 主仓库的关系

本项目已独立为 [lemonXGroup/lemon-mcp](https://github.com/lemonXGroup/lemon-mcp)，使用自己的 Git 历史和 origin。即使本机目录位于 Lemon 工作区的 public_projects/lemonMCP 下，也应在本项目根目录单独提交和推送；主仓库已忽略该目录。

iOS WebControl 协议仍由 Lemon App 维护。协议变化时，应同步更新 MCP 工具 schema 与文档，运行本项目单元测试，并在主仓库完成对应的真机兼容性检查。内部实现与公开项目分别维护 Git 历史，源码同步需要在本项目中审阅后提交。
