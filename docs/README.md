# Lemon 用户手册与 AI 参考 / User manual collection

本合集随独立的 lemon-mcp GitHub 仓库发布，包含 **16 个章节的中英文手册**，以及首次连接、完整工具 schema、规则和脚本 API 参考。AI 可以在线读取 raw Markdown，也可以在安装目录离线读取同一份文件。

This collection ships in the independent public repository: 16 chapters in Chinese and English, an onboarding guide, complete tool input schemas, and exact Rewrite/script references.

## AI 建议阅读顺序 / Start here

1. [首次连接与操作指南（中文）](AI_GUIDE.zh-CN.md) / [AI guide](AI_GUIDE.md)
2. [能力兼容性与尚未接入的功能](reference/compatibility.md)
3. [当前全部 70 个工具](reference/tools.md) / [完整输入 JSON schema](reference/tools.schema.json)
4. [手机文件与模拟文件工作流](reference/device-files.md)
5. [规则 CRUD、Query / Host 通配匹配、JSON Path、multipart 与动作参数](reference/rewrite-rules.md)
6. [脚本 API（中文）](reference/script-api.zh-CN.md) / [Script API](reference/script-api.md)
7. [远程脚本的准备、发布、更新与回滚](reference/remote-scripts.md)

## 不安装 MCP 的 AI / AI clients without MCP

使用 [Lemon Skill](../skills/lemon/SKILL.md)，可以在支持技能的 AI 工具中安装整个 skills/lemon 目录，或让 AI 在线阅读入口并按需加载参考。内置 Python 标准库 HTTP 助手无需 MCP；直接操作仍需本地执行环境可访问手机局域网及当前口令。

[连接与隐藏输入](../skills/lemon/references/connection.md) · [直接 HTTP 参数](../skills/lemon/references/http-api.md) · [操作流程](../skills/lemon/references/workflows.md) · [Workspace 定义](../skills/lemon/references/replay-workspace.md) · [全部手册路由](../skills/lemon/references/documentation.md)

Install the whole skills/lemon folder in a compatible client, or read the public SKILL.md as task guidance. MCP and Node.js are optional for this path; Python 3.10+ is sufficient for direct HTTP. A browsing-only cloud AI can guide the user but cannot directly reach a private LAN. See the repository README for installation and first-use prompts.

## 完整用户手册 / All user manual chapters

| 章节 / Topic | 中文 | English | AI 在线 Markdown / Raw |
| --- | --- | --- | --- |
| 00 产品概览 / Overview | [阅读](manual/overview.zh-CN.md) | [Read](manual/overview.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/overview.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/overview.en-US.md) |
| 01 LemonMCP / LemonMCP | [阅读](manual/lemon-mcp.zh-CN.md) | [Read](manual/lemon-mcp.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lemon-mcp.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lemon-mcp.en-US.md) |
| 02 脚本与定时任务 / Scripts and scheduled tasks | [阅读](manual/scripts.zh-CN.md) | [Read](manual/scripts.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/scripts.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/scripts.en-US.md) |
| 03 重写 / Rewrite | [阅读](manual/rewrite.zh-CN.md) | [Read](manual/rewrite.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/rewrite.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/rewrite.en-US.md) |
| 04 模块 / Modules | [阅读](manual/modules.zh-CN.md) | [Read](manual/modules.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/modules.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/modules.en-US.md) |
| 05 请求记录 / Requests | [阅读](manual/requests.zh-CN.md) | [Read](manual/requests.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/requests.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/requests.en-US.md) |
| 06 HTTPS 检查 / HTTPS MITM | [阅读](manual/mitm.zh-CN.md) | [Read](manual/mitm.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/mitm.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/mitm.en-US.md) |
| 07 重放 / Replay | [阅读](manual/replay.zh-CN.md) | [Read](manual/replay.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/replay.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/replay.en-US.md) |
| 08 DNS / DNS | [阅读](manual/dns.zh-CN.md) | [Read](manual/dns.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/dns.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/dns.en-US.md) |
| 09 TUN / 抓包 / TUN and capture | [阅读](manual/tun.zh-CN.md) | [Read](manual/tun.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/tun.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/tun.en-US.md) |
| 10 正则表达式 / Regular expressions | [阅读](manual/regex.zh-CN.md) | [Read](manual/regex.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/regex.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/regex.en-US.md) |
| 11 文件 / Files | [阅读](manual/files.zh-CN.md) | [Read](manual/files.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/files.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/files.en-US.md) |
| 12 数据库 / Database | [阅读](manual/database.zh-CN.md) | [Read](manual/database.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/database.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/database.en-US.md) |
| 13 局域网代理 / LAN proxy | [阅读](manual/lan-proxy.zh-CN.md) | [Read](manual/lan-proxy.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lan-proxy.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lan-proxy.en-US.md) |
| 14 远程控制 / Remote Control | [阅读](manual/remote-control.zh-CN.md) | [Read](manual/remote-control.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/remote-control.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/remote-control.en-US.md) |
| 15 AI 助手 / AI helper | [阅读](manual/ai-helper.zh-CN.md) | [Read](manual/ai-helper.en-US.md) | [中文](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/ai-helper.zh-CN.md) · [EN](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/ai-helper.en-US.md) |

## 公开 GitHub 入口 / Public entry points

- [GitHub 文档首页](https://github.com/lemonXGroup/lemon-mcp/blob/main/docs/README.md)
- [AI 入口 llms.txt](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/llms.txt)
- [中文首次使用指南](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/AI_GUIDE.zh-CN.md)
- [English AI guide](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/AI_GUIDE.md)
- [规则参考](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/rewrite-rules.md)
- [中文脚本 API](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.zh-CN.md)
- [English script API](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.md)

这些地址对应公开仓库 main 分支，文档需要先提交并推送才会在线可用。需要可复现的版本时，用已发布的 commit SHA 替换 main。不要假定 MCP 客户端会自动抓取链接或读取本地 Markdown；首次使用时提供 AI 入口，后续按任务读取。当前服务尚未注册文档 resources/prompts。

## 版本、来源与验证 / Version and evidence

Rewrite 匹配、能力检查与工具参考于 2026-11-10 按 Query / Host 通配提交同步；其余内容保留 2026-11-07 的核对范围。2026-11-12 新增手机文件枚举、路径选择与新建模拟文件；公开版当前 70 tools / 2 resources，内部 MCP 72 tools。精确工具输入来自公开代码生成的 schema，可用 `npm run docs:generate` 重建，`npm run docs:check` 校验。脚本 API、默认模板、HTTP/WS 返回值和 Rewrite 参数按所列 App/core 源码核对。其他用户操作章节整理自现有双语用户手册；本次未逐页执行真机 UI 验收。

源码事实、当前工具是否接入、设备版本/权限及本次是否运行验证是不同问题。先读兼容性；不要把 App 能力当作已经暴露的 MCP 工具，也不要把示例语法通过当作运行验收。验证深度与已纠正差异见 [来源与验证范围](verification.md)，完整来源清单见 [文档 manifest](manifest.json)。
