# 文档来源与验证范围 / Documentation evidence

核对日期 / Checked: **2026-11-10（Rewrite 匹配增量）**；其余内容沿用 **2026-11-07** 核对范围。 [手册合集 / Manual collection](README.md) · [机器可读来源清单 / Manifest](manifest.json)

本合集以当前实现为准，但各部分的验证深度不同。不能把收录了全部用户手册理解为每个页面、按钮、平台和运行路径都已逐项验收。下表明确区分源码核对、迁移整理和运行证据。

This collection follows the implementation, with explicitly different evidence levels. A complete collection of chapters does not mean every UI step, platform, or runtime path has been exercised.

| 内容 / Content | 来源与核对方式 / Evidence | 本次未覆盖 / Limits |
| --- | --- | --- |
| tools.md / tools.schema.json | 从当前公开 src/tools.ts 实际注册项生成，67 tools；逐项 JSON schema 与构建产物注册结果完全一致 | 不是所有工具的设备 E2E；schema 的存在不证明底层设备能力可用 |
| AI_GUIDE 中英文 | 核对 index.ts、discovery.ts、apiClient.ts、resources.ts 与 App 认证路由；明确局域网、Listening、口令、重启及失败判定 | 当前没有连接向导、安全弹窗、文档 resources/prompts；指南不会自动加载 |
| reference/script-api 中英文 | 按 App 默认模板、公共 API catalog、QuickJS 引擎、FFI、scheduler 与协议处理源码重写；区分同步/异步、HTTP/WS/定时契约 | 示例通过 JavaScript 语法和 JSON 结构检查；未执行 QuickJS 或真机脚本 |
| reference/rewrite-rules.md | 核对 App WebControl 输入约束、核心加载/动作模型、Query、Host 通配、表达式、JSON Path、multipart 与 WS 能力 | 保存、运行时接纳和实际流量改写仍需分别验证 |
| reference/remote-scripts.md | 核对公开工具和 App 普通远程脚本 prepare/create/configure/refresh/copy 链路 | 未进行本次远程下载、设备写入或自动更新验收 |
| reference/compatibility.md | 对比公开与内部 MCP 源码、App 路由，列出已实现与尚未接入的能力 | 不是设备版本协商的替代品 |
| skills/lemon（入口、参考与 HTTP 助手） | 核对 App 当前 WebControl 路由、认证 Gate、Replay/定时任务/模块/上传模型；通过 13 项 loopback HTTP 测试及 Skill 格式验证 | 未连接手机；未验证全部 App 操作、系统权限或真机脚本效果；隐藏输入仅供可交互的本地终端 |
| manual/scripts 中英文 | 按当前模板和脚本 API 重新撰写 | 与上述脚本 API 相同的运行验证限制 |
| 其他 manual 章节 | 整理自已有双语用户手册，修正已发现的认证、旧脚本示例、重写动作、协议边界和独立链接问题 | 未逐页逐项审计所有 App UI、Module renderer、CLI 跨平台行为及全部文字；不能标为全量实现验收 |

The machine-readable manifest records adapted chapter origins, source hashes, and review scope. Source paths identify private App implementation provenance; readers do not need those files to use this public manual.

## 2026-11-10 匹配同步 / Matching synchronization

本次按 App 提交 `9ce70bd739139042a21fb8e9b64ffc31fa7b0126`（参数条件）和 `5438ebdfed3b6ff30c6e6d726e1f1375c07b114c`（Host 通配）同步公开项目：

- 默认字段补齐 `query`，说明原始参数串、编码与顺序、完整值边界正则、空参数及表达式模式下的非活动条件。
- 现有四种非正则 Host 操作符扩展 `*`、`?`；明确 `eq *.example.com` 包含根域和各级子域，以及前缀、后缀、包含的字符串位置语义。分享使用 portable 5，备份使用 6，非活动条件也参与版本判断。
- `upsert_rewrite_rule` 保存通配条件前读取设备 `host_wildcards` 声明；不完整、缺失或请求失败时拒绝写入，仍允许保留完整分组并停用已有规则。Query 与普通规则原样转发，不附加分享文档的版本外壳。
- 中英文 README、AI 指南、重写手册、规则参考、兼容性、Skill HTTP 参考与工作流同步。工具参考从实际注册项生成，`npm test` 同时检查其新鲜度；`npm run docs:generate` 和 `npm run docs:check` 可单独执行生成与核对。

公开 MCP 在无主仓库依赖的独立副本中构建通过，**34/34** 项确定性测试通过（含 5 项子测试，较原 23 项新增 11 项）；Skill 的 **13/13** 项 loopback HTTP 测试与 `skill-creator` 格式检查通过。新增测试验证参数原样传递、四种 Host 模式的能力检查、旧设备拒绝写入、非活动条件及停用例外。文档例子的静态校验不执行真实重写引擎。

This is a public MCP implementation/documentation sync with local mocked API evidence. It does not repeat the App commits' Stack acceptance, contact an iPhone, publish GitHub changes, or deploy a service. The public surface remains 67 tools / 2 resources; the documented WebSocket and multipart tool gaps remain separate work.

## 已纠正的过时描述 / Corrected stale claims

- App 模板实际是 **export async function**；同步 export function 也合法，宿主操作需要按其 Promise 契约 await。不是 async export function。
- 当前 App 已支持 HTTP/1 Upgrade 后的 WebSocket 消息重写；不能继续笼统写成 observe-only。公开 MCP 仍缺两个 WS 读取工具和远程 WS handler 枚举。
- 支持的文本压缩响应可以有界解码后执行正文规则；这不代表支持压缩请求正文或任意流式正文。
- HTTP patch 仅支持 body.text；WS patch 另支持 body.base64、drop 与文本注入，两者不能混写。
- lemon:context.get() 返回执行环境元信息；当前流量位于处理函数参数 ctx.request / ctx.response / ctx.message。
- App/FFI 当前重写超时默认 30,000 ms；核心独立的 250/500 ms 不是 App 默认值。定时任务默认 10 秒，上限 60 秒。
- 受保护设备接口要求有效口令；环境变量缺失仍可启动进程不等于认证可选。产品权限与口令认证分别判断。
- body_replace 包括文本、正则、精确 JSON Path 和 multipart 字段语义，不能统一描述为替换整个正文。

## 检查结果 / Checks

- 2026-11-10 在脱离主仓库依赖的独立副本中，Node.js **24.1.0** 的 TypeScript 构建和 **34/34** 确定性单元测试通过；未证明 Node.js 20 的最低运行版本矩阵。
- 工具文档 JSON schema 与实际注册结果一致；所有文档相对文件链接、JSON 示例及 JavaScript 示例另作静态检查。
- 没有在本次操作中启动设备抓包、修改设备规则、运行远程脚本、执行 Replay 或进行真机 UI 验收。
- GitHub/raw 地址对应公开仓库 lemonXGroup/lemon-mcp 的 main 路径；在线内容以远端已推送的版本为准。本地构建、测试和格式检查不证明已发布；需要固定证据时使用发布 commit SHA。

## Skill 无 MCP 路径 / MCP-free Skill

新增 skills/lemon/ 是可独立安装的技能目录，附带 Python 标准库 HTTP 助手。13 项本地 mock HTTP 测试覆盖认证头和 URL 编码、代理绕过、JSON 请求、拒绝重定向、HTTP/应用错误、无损下载和文件权限、拒绝覆盖、multipart 上传、响应上限、连接中断后不重试，以及凭据输入约束。Skill frontmatter/UI 元数据通过 skill-creator 校验；测试与校验不会操作 iPhone。校验器所需 PyYAML 仅安装在临时验证目录，不是 Skill 运行依赖。

命令：python3 -m unittest discover -s skills/lemon/tests -v。HTTP 助手只需 Python 3.10+ 标准库；验证环境为 Python 3.13。直接 HTTP 仍需手机局域网可达、远程控制 Listening 和当前有效口令。--prompt-token 是用户终端的隐藏输入，MCP 服务仍没有安全口令弹窗或会话内凭据注入工具。Skill 的公开文件随仓库版本发布，在线可用性以远端分支和实际 raw 地址为准。

## 后续同步原则 / Maintenance

修改工具 schema 时重新导出工具参考；修改脚本模块或返回值时同步 API 文档与示例；修改 UI 时更新对应手册。每次更新保留来源、日期和验证范围，不能仅复制历史说明。不要把计划中的 API 写为当前可用，也不要用源码审阅替代设备运行证据。

When authoring code, read the exact reference and installed tool schema first. If a guide and the current validator disagree, stop relying on the example and inspect the concrete error and version. MCP documentation resources, prompts, connection tools, and a token dialog remain implementation follow-ups. The optional Skill HTTP helper already provides user-operated terminal hidden input; this does not add a dialog or credentials to an existing MCP session.
