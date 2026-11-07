# Documentation routing / 完整能力阅读入口

Use the task-specific chapter, not every manual at once. A copied Skill folder retains these public links; the full repository also contains the same docs/ files for offline use. New files are online only after their commit is pushed to public main. Pin a published commit SHA instead of main for a reproducible version.

Exact contracts take precedence over general descriptions; live phone capabilities and responses identify the installed version. If a contract cannot be retrieved locally or online, say so and do not invent parameters.

| Reference | Public raw Markdown |
| --- | --- |
| 完整双语手册索引 / Manual index | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/README.md) |
| 版本兼容性 / Compatibility | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/compatibility.md) |
| 全部 Rewrite 参数 / Rule actions | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/rewrite-rules.md) |
| 脚本 API 中文 | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.zh-CN.md) |
| Script API English | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/script-api.md) |
| 远程脚本 / Remote sources | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/remote-scripts.md) |
| MCP 输入 schema（不能直接当作 HTTP JSON） | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/reference/tools.schema.json) |
| 来源和验证范围 / Evidence | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/verification.md) |

## All manual chapters

| Topic | 中文 | English |
| --- | --- | --- |
| 产品概览 / Overview | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/overview.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/overview.en-US.md) |
| MCP 安装 / MCP setup | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lemon-mcp.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lemon-mcp.en-US.md) |
| 脚本与定时任务 / Scripts | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/scripts.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/scripts.en-US.md) |
| 重写 / Rewrite | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/rewrite.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/rewrite.en-US.md) |
| 模块与作者 API / Modules | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/modules.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/modules.en-US.md) |
| 请求与 WebSocket / Requests | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/requests.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/requests.en-US.md) |
| HTTPS / MITM | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/mitm.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/mitm.en-US.md) |
| 重放 / Replay | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/replay.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/replay.en-US.md) |
| DNS | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/dns.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/dns.en-US.md) |
| TUN / 抓包 | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/tun.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/tun.en-US.md) |
| 正则 / Regex | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/regex.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/regex.en-US.md) |
| 文件 / Files | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/files.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/files.en-US.md) |
| 数据库 / Database | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/database.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/database.en-US.md) |
| 局域网代理 / LAN proxy | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lan-proxy.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/lan-proxy.en-US.md) |
| 远程控制 / Remote Control | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/remote-control.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/remote-control.en-US.md) |
| App AI 助手 / AI helper | [阅读](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/ai-helper.zh-CN.md) | [Read](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/ai-helper.en-US.md) |

## Applying this knowledge

Capture, traffic/WS, rules, scripts, scheduled tasks, Replay/Workspace, DNS Hosts, modules, files, logs and diagnostic SQL have route guidance in [HTTP API](http-api.md). User-facing features beyond those routes are still part of Lemon knowledge: explain their prerequisites and guide the App UI using the appropriate chapter. In particular, certificate installation/system trust, global MITM/Rewrite/JS controls, global DNS/TUN/LAN Proxy options, purchasing and AI-provider setup need their own supported UI/API. The Skill provides no undocumented setter.

The existing product manuals were adapted from the App website and were not all re-executed on a phone. The current rule/script references and this Skill HTTP inventory have source checks recorded in docs/manifest.json; this does not establish real-device acceptance. Distinguish code examples, local transport tests, stored configuration and observed runtime results.
