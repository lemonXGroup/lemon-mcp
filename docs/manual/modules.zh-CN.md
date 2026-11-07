> 文档核对（2026-11-07）：本章整理自已有用户手册，并修正已发现的差异；未逐项验收全部 UI 与运行路径。[来源与验证范围](../verification.md)。

> 本手册随 LemonMCP 独立发布。先读 [AI 使用指南](../AI_GUIDE.zh-CN.md)；精确规则与脚本契约见 [规则参考](../reference/rewrite-rules.md)、[脚本 API](../reference/script-api.zh-CN.md) 和 [兼容性](../reference/compatibility.md)。

## 模块是什么

“模块”是 Lemon 中可以独立安装和运行的本地工具。模块可以拥有自己的界面、脚本和受控的数据能力，适合把重复的调试流程整理成一个可复用的小工具。

模块与“重写”解决的问题不同：重写直接处理经过 Lemon 的请求和响应；模块则是一个可安装的扩展，可以在自己的界面中调用 Lemon 提供的能力。你可以在模块界面里发起操作，再配合请求、重写或其他 Console 功能完成调试。

## 打开模块中心

1. 打开 Lemon 的 **Console**。
2. 选择 **Modules（模块）**，进入 **Module Center（模块中心）**。
3. 在官方模块区域浏览可用模块；已经安装的模块会出现在已安装区域。
4. 需要使用本地模块包时，选择 **Import Module Package（导入模块包）**。

安装或导入完成后，可以从模块信息页打开模块。暂时不需要运行时，关闭对应模块的启用状态即可。

## 模块包的基本组成

模块包的具体文件名以导入包为准，但信息页通常会展示以下元数据：

| 信息 | 用途 |
| --- | --- |
| Manifest | 描述模块身份、入口和能力声明 |
| Package Version | 标识当前脚本包版本，便于确认升级状态 |
| Entry Module | 模块启动时加载的入口模块 |
| JavaScript / ESM files | 实现界面和运行逻辑的脚本文件 |

安装前先确认模块来源和版本。不要直接运行来源不明的脚本包，也不要为了绕过安装问题手动修改 manifest 中的能力声明。

## 使用 lemonModule 创建模块

[`lemon-module` GitHub 仓库](https://github.com/lemonXGroup/lemon-module) 是面向外部开发者的独立模块工具项目。仓库中的命令行程序名为 `lemon-module`，用于创建模块工程、校验模块契约、生成 `.lemonmodule` 归档和检查归档内容。

它是模块开发与发布辅助工具，不是模块运行时：

- `init` 从内置模板创建模块工程。
- `validate` 校验 manifest、路径、能力声明和资源限制。
- `test` 执行结构校验，并做一次确定性的打包 / 解包回环测试。
- `pack` 生成可以导入 Lemon 的 `.lemonmodule` 文件。
- `inspect` 读取归档元数据，不执行模块 JavaScript。
- `upload` 可选地将归档提交到管理员模块接口，普通用户本地安装不需要这个命令。

### 获取并构建工具

`lemon-module` 支持 macOS、Linux 和 Windows。源码构建需要 Rust stable，当前版本要求 Rust `1.85` 或更高版本。下面的命令从公开仓库构建当前平台的 release 二进制：

```bash
git clone https://github.com/lemonXGroup/lemon-module.git
cd lemon-module
cargo build --release --locked
./target/release/lemon-module --help
```

也可以直接使用 Cargo 安装到本机的 Cargo bin 目录：

```bash
cargo install --path . --locked
lemon-module --help
```

如果不需要安装二进制，开发期间也可以在仓库根目录使用 `cargo run --release --locked --` 替代 `./target/release/lemon-module`。

### 从模板创建模块

`init` 的目标路径必须是不存在的目录或空目录，不会覆盖已有文件。模块目录名只用于生成初始 `moduleID`，创建后应立即修改为自己的 reverse-domain 命名空间：

```bash
./target/release/lemon-module init modules/my-debug-tool --template basic
```

工具提供四种起始模板：

| 模板 | 适用场景 | 生成内容 |
| --- | --- | --- |
| `basic` | 最小模块 | 基础页面、标题和刷新按钮 |
| `request-list` | 请求列表类工具 | 请求列表风格的页面占位结构 |
| `settings-form` | 设置类工具 | 设置页面以及配置 schema 和默认值 |
| `dashboard` | 仪表盘类工具 | 仪表盘页面以及配置文件 |

模板只负责生成工程骨架。`request-list` 不会自动读取请求数据，`dashboard` 也不会自动生成业务指标；业务逻辑仍需在 Core 脚本中调用已声明的 Lemon API。

### 本地开发的标准流程

在 `lemon-module` 仓库根目录执行：

```bash
# 创建模块工程。
./target/release/lemon-module init modules/my-debug-tool --template basic

# 编辑 module.json、core/、ui/ 和 locales/ 后，校验模块。
./target/release/lemon-module validate modules/my-debug-tool

# 执行确定性的打包 / 解包回环测试。
./target/release/lemon-module test modules/my-debug-tool

# 生成可导入 Lemon 的模块包。
./target/release/lemon-module pack modules/my-debug-tool \
  --output my-debug-tool-1.0.0.lemonmodule

# 检查生成的归档，不执行其中的 JavaScript。
./target/release/lemon-module inspect my-debug-tool-1.0.0.lemonmodule
```

这些本地命令的职责不同：

| 命令 | 作用 | 是否需要 Lemon 或 iPhone |
| --- | --- | --- |
| `init` | 创建模块目录和示例文件 | 不需要 |
| `validate` | 校验源工程或 `.lemonmodule` 归档 | 不需要 |
| `test` | 校验并验证归档回环 | 不需要 |
| `pack` | 生成 `.lemonmodule` 归档 | 不需要 |
| `inspect` | 查看归档摘要和文件清单 | 不需要 |
| `upload` | 上传到管理员发布接口 | 需要服务端地址和管理员 token |

### 模块工程与归档文件

`lemon-module` 会递归读取模块工程，并只收集受支持的运行时文件：

| 路径 | 文件类型 | 归档用途 |
| --- | --- | --- |
| `core/**/*.js` | UTF-8 JavaScript | Core ESM 源码 |
| `shared/**/*.js` | UTF-8 JavaScript | 可共享的 Core ESM 源码 |
| `ui/**/*.json` | UTF-8 JSON | 声明式 UI |
| `locales/**/*.json` | UTF-8 JSON | 语言包 |
| `config/**/*.json` | UTF-8 JSON | 配置 schema、默认值和迁移文件 |
| `assets/*.{png,jpg,jpeg}` | 图片资源 | 归档内的资源文件 |

`module.json` 是作者维护的源清单，打包时会据此生成归档内的 `manifest.json`，两者不是同一个文件。`README.md`、`LICENSE`、`CHANGELOG.md`、隐藏文件、`docs/`、`tests/` 和 `.lemonignore` 本身不会进入归档。其他不受支持的文件类型会导致打包失败；仅供作者使用的文件可以写入 `.lemonignore` 排除。

校验时尤其需要确认：

- `moduleID` 至少包含两个点分隔的部分，只使用字母、数字、`.`, `-` 和 `_`。
- `moduleVersion` 是三段数字版本号，例如 `1.0.0`。
- 当前 `minHostApi` 为 `1.0`，`uiSchemaVersion` 为 `2`。
- `entrypoints.core`、`entrypoints.ui` 和语言包路径都指向实际存在的文件。
- `capabilities` 只声明模块真正使用的最小能力，并且与 `lemon:*` 导入、UI command 和 data API 一致。

### 在 macOS 上构建 Windows 二进制

该工具使用 rustls 和 Rust 实现的压缩库，不依赖目标系统预装 OpenSSL 或 zlib，因此可以从 macOS 交叉构建 Windows x64 二进制。普通 Windows 用户建议优先使用 MSVC 目标：

```bash
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
cargo xwin build --release --locked --target x86_64-pc-windows-msvc
```

产物位于 `target/x86_64-pc-windows-msvc/release/lemon-module.exe`。也可以用 Zig 构建 Windows GNU 目标：

```bash
rustup target add x86_64-pc-windows-gnu
cargo install cargo-zigbuild
cargo zigbuild --release --locked --target x86_64-pc-windows-gnu
```

GNU 产物在部分 Windows 环境中还需要 MinGW runtime DLL；分发时应把所需 DLL 与 `.exe` 一起测试。交叉构建只负责生成 CLI，不会执行模块 JavaScript，也不会代替真实 Windows 环境验证 Lemon iOS 运行时。

### 导入生成的模块包

本地开发完成后，导入的是 `pack` 生成的 `.lemonmodule` 文件，而不是单独的 `module.json` 或 `core/main.js`：

1. 打开 Lemon 的 **Console**，进入 **Modules（模块）** 和 **Module Center（模块中心）**。
2. 选择 **Import Module Package（导入模块包）**，选中 `.lemonmodule` 文件。
3. 等待 Lemon 完成校验和安装，在模块信息页检查版本、入口和能力声明。
4. 确认来源可信且权限符合预期后启用模块，再打开模块界面。

`lemon-module` 不会执行模块 JavaScript、不安装模块的 npm 依赖，也不提供模块运行时；运行时由 Lemon iOS 宿主负责。`upload` 仅用于拥有管理员权限的发布流程，普通模块作者在本机执行 `validate`、`test` 和 `pack` 即可。

## 实际示例：制作一个工具模块

下面是一个完全自包含的 Base64 工具模块示例，按文件拆开说明。它演示了一个最小但完整的模块闭环：声明能力、初始化状态、响应按钮 action、调用 Lemon 宿主 API、渲染声明式界面，以及提供语言包。示例只依赖公开的模块包契约，不依赖任何内部工程或未公开文件。

### 目录结构

```text
com.lemon.modules.example/
├── module.json             # 作者维护的源清单，不放源码内容
├── core/
│   └── main.js              # ESM 业务逻辑和生命周期函数
├── ui/
│   └── index.json           # 声明式 UI，不写 SwiftUI / HTML / CSS
└── locales/
    ├── en.json              # 英文语言包
    └── zh-Hans.json         # 简体中文语言包
```

`module.json` 是作者目录中的源清单。打包命令会根据 `entrypoints`、`locales` 和实际文件生成归档内的 `manifest.json`；不要把这两个文件混为一谈，也不要手动向源清单中添加源码、文件大小或 hash。

### 1. 声明模块身份和能力

```json
{
  "moduleID": "com.example.base64-tool",
  "moduleVersion": "1.0.0",
  "minHostApi": "1.0",
  "uiSchemaVersion": 2,
  "fallbackLocale": "zh-Hans",
  "entrypoints": {
    "core": "./core/main.js",
    "ui": "./ui/index.json"
  },
  "locales": {
    "en": "./locales/en.json",
    "zh-Hans": "./locales/zh-Hans.json"
  },
  "assets": {},
  "capabilities": {
    "commands": ["copy"],
    "config": [],
    "data": [],
    "host": ["utils"],
    "system": []
  },
  "nameKey": "module.name",
  "descriptionKey": "module.description",
  "icon": "wrench.and.screwdriver"
}
```

关键点：

- `moduleID` 使用 reverse-domain 形式；发布到官方命名空间时才使用 `com.lemon.modules.*`，第三方模块应使用自己的命名空间。
- `entrypoints.core` 必须指向实际存在的 ESM 文件，`entrypoints.ui` 必须指向实际存在的 UI JSON 文件。
- `host: ["utils"]` 对应 `core/main.js` 中的 `lemon:utils` 导入。没有声明的 host capability，即使代码中写了 import，也会在校验或运行时被拒绝。
- `commands: ["copy"]` 对应代码返回的复制命令。只声明实际使用的能力，便于用户审查模块权限。
- `uiSchemaVersion` 应使用当前 Lemon 支持的版本；最终可用字段以 Lemon 的 package validator 和 host contract 为准。

### 2. 编写核心逻辑 `core/main.js`

```javascript
import { base64Encode } from "lemon:utils";
import { get as t } from "lemon:i18n";

function initialState() {
  return {
    // State is serializable data. UI controls bind to these paths.
    input: "",
    output: "",
    outputReady: false
  };
}

function result(state, commands = []) {
  // Every lifecycle/action handler returns the next state and host commands.
  return { state, commands };
}

export function onLoad() {
  // Called when the module runtime is created for the first time.
  return result(initialState());
}

export function onAppear(context) {
  // Keep the previous state when the user returns to the module page.
  return result(context?.state ?? initialState());
}

export function onAction(context, action) {
  const state = { ...initialState(), ...(context?.state ?? {}) };

  if (action?.id === "encode") {
    try {
      // lemon:utils performs the host-approved Base64 conversion.
      state.output = base64Encode(state.input ?? "");
    } catch (_) {
      // User-facing text belongs in the locale file, not hard-coded here.
      state.output = t("module.error.generic");
    }
    state.outputReady = true;
    return result(state);
  }

  if (action?.id === "copy") {
    // Commands are executed by Lemon after a user action; the module does
    // not access the clipboard directly.
    return result(state, [{ type: "copy", text: state.output ?? "" }]);
  }

  // Unknown actions should leave the module stable and do nothing.
  return result(state);
}
```

这个返回结构是模块运行时的核心约定：`state` 会回写到 UI 的 binding，`commands` 由宿主执行。按钮的 `action.id` 必须和 `onAction` 中判断的值一致；如果要在页面刷新后重新请求数据，可以再实现 `onRefresh(context)`，但不要在生命周期回调里返回 `openPage` 等需要用户确认的命令。

上面的示例只展示编码路径。你可以沿用同样的 `state -> onAction -> result` 模式继续增加 Base64 解码、URL 编解码、时间戳、JSON 格式化或 JWT 载荷解析等功能。

### 3. 用 `ui/index.json` 声明界面

```json
{
  "schemaVersion": 2,
  "rootPage": "main",
  "navigationStyle": "stack",
  "pages": [
    {
      "id": "main",
      "title": { "key": "module.utilities.base64" },
      "root": {
        "type": "vstack",
        "id": "base64-root",
        "spacing": "m",
        "children": [
          {
            "type": "text",
            "style": "headline",
            "text": { "key": "module.utilities.base64" }
          },
          {
            "type": "textEditor",
            "id": "base64-input",
            "height": 140,
            "placeholder": { "key": "module.utilities.inputHint" },
            "value": { "bind": "$.input", "fallback": "" }
          },
          {
            "type": "hstack",
            "alignment": "center",
            "children": [
              {
                "type": "button",
                "id": "encode-button",
                "title": { "key": "module.utilities.encode" },
                "action": { "id": "encode" }
              },
              {
                "type": "button",
                "id": "copy-button",
                "role": "secondary",
                "title": { "key": "module.utilities.copy" },
                "action": { "id": "copy" },
                "disabledWhen": { "path": "$.outputReady", "equals": false }
              }
            ]
          },
          {
            "type": "codeEditor",
            "id": "base64-output",
            "height": 140,
            "role": "readOnly",
            "style": "monospaced",
            "value": { "bind": "$.output", "fallback": "" }
          }
        ]
      }
    }
  ],
  "components": {}
}
```

这个文件必须是合法 JSON，因此不能像 JavaScript 一样直接写注释。理解它可以抓住三条关系：`value.bind` 把控件连接到 `state`；`action.id` 把按钮连接到 `onAction`；`disabledWhen` 根据状态决定控件是否可用。UI 只负责声明结构，业务逻辑仍然放在 `core/main.js`。

### 4. 提供语言包

`locales/zh-Hans.json`：

```json
{
  "module.name": "Base64 工具",
  "module.description": "在本地完成 Base64 编码。",
  "module.utilities.base64": "Base64",
  "module.utilities.inputHint": "输入文本",
  "module.utilities.encode": "编码",
  "module.utilities.copy": "复制",
  "module.error.generic": "处理失败"
}
```

`locales/en.json`：

```json
{
  "module.name": "Base64 Tool",
  "module.description": "Encode text as Base64 locally.",
  "module.utilities.base64": "Base64",
  "module.utilities.inputHint": "Enter text",
  "module.utilities.encode": "Encode",
  "module.utilities.copy": "Copy",
  "module.error.generic": "Operation failed"
}
```

语言包的 key 必须覆盖 UI 中使用的 `{"key": "..."}` 和代码中传给 `t(...)` 的 key。`fallbackLocale` 只负责找不到当前语言时的回退，不会替代缺失的 key；缺少 key 时应在两份语言包中补齐。

### 5. 校验、测试和打包

在已经克隆的 `lemon-module` 仓库根目录执行以下命令；也可以将二进制路径替换成 `cargo run --release --locked --`：

```bash
# 先校验源清单、路径、能力和资源大小。
./target/release/lemon-module validate /path/to/com.example.base64-tool

# 执行确定性的打包 / 解包回环测试。
./target/release/lemon-module test /path/to/com.example.base64-tool

# 生成可导入 Lemon 的归档文件。
./target/release/lemon-module pack /path/to/com.example.base64-tool \
  --output ./com.example.base64-tool-1.0.0.lemonmodule
```

最终导入的是生成的 `.lemonmodule`，不是单独的 `module.json` 或 `core/main.js`。如果校验报错，优先根据错误路径修正 manifest、UI schema 或 capability 声明，不要删除校验字段来绕过检查。

### 需要读取 Lemon 数据时

如果模块要读取请求、DNS、Rewrite 或运行状态，可以按下面的方式声明最小数据能力并调用对应的 data API：

```json
{
  "capabilities": {
    "data": ["runtime.read"]
  }
}
```

这是源清单片段；合并到已有 capabilities 对象，保留其他实际需要的声明，不要覆盖整个清单。再在核心脚本中导入匹配的 data API：

```javascript
import { getRuntimeStatus } from "lemon:data";

export async function onLoad(context) {
  try {
    // Data APIs are asynchronous because the host owns the data boundary.
    const runtime = await getRuntimeStatus();
    return {
      state: { ...(context?.state ?? {}), runtime },
      commands: []
    };
  } catch (error) {
    // Keep a serializable error in state so the UI can display it.
    return {
      state: {
        ...(context?.state ?? {}),
        error: String(error)
      },
      commands: []
    };
  }
}
```

声明的 capability、实际导入的 `lemon:*` 模块和调用的数据方法必须相互匹配。不要为了“先跑起来”声明全部数据权限；这会扩大模块的审查范围，也可能被 validator 拒绝。

## 安装、启用与打开

### 从官方模块安装

在 Module Center 的官方模块列表中打开模块信息页，先阅读描述和能力声明，再执行安装。安装成功后，到已安装模块区域确认状态，并使用打开入口进入模块界面。

### 导入本地模块包

如果模块包保存在本地：

1. 进入 Module Center，选择 **Import Module Package**。
2. 选择模块包文件，等待 Lemon 完成校验和安装。
3. 打开模块信息页，检查版本、入口模块和能力声明。
4. 确认无误后启用模块，再进入模块界面。

安装状态、启用状态和打开模块是三个不同动作。模块已经安装不代表它一定启用；模块启用也不代表当前页面已经打开。

## 运行时权限

模块信息页会列出 **Host Permissions（运行时权限）** 和 **Data Capabilities（数据能力）**。只有在这里明确启用的能力，模块才应该能够调用对应的 Lemon 接口。

当前控制台中常见的 Host Permissions 包括：

- **Log output**：输出模块运行日志，便于定位脚本错误。
- **Persistent store**：读写模块自己的持久化数据。
- **HTTP requests**：由模块发起受控的 HTTP 请求。
- **Notifications**：发送受控的系统通知；不应作为高频 UI 更新通道。
- **Utility functions**：使用 Lemon 提供的通用工具函数。

`lemon:*` 模块只能导入在模块信息页中启用的能力。没有声明或没有启用的能力不应被模块使用；如果模块启动后提示权限不足，先回到信息页核对能力声明和开关，再重新打开模块。

> 权限越少，模块的行为边界越清晰。安装第三方模块时，只开启它实际需要的能力。

## 模块界面支持的控件

模块渲染器支持多种常见控件，实际显示哪些控件由模块自身定义。常见类型包括：

- Text：展示状态、说明或结果。
- Button：触发一次操作。
- Toggle：切换布尔配置。
- Picker：从选项中选择值。
- Stepper：按步长调整数字。
- Slider：在连续范围内调整数字。
- Text editor：编辑文本或脚本片段。
- Search field：过滤列表内容。
- List / Table：展示可滚动的项目和结构化数据。
- Chart：展示趋势或统计数据。

控件的值和操作由模块脚本管理。若某个按钮没有反应，先查看模块日志，再确认模块所需的运行时权限是否已经启用。

## 查看源码

在模块信息页选择 **View Source（查看源码）**，可以检查模块的 **Source Code（源码）**。阅读源码时重点关注：

1. 入口模块如何创建界面和注册操作。
2. 模块是否读取或写入持久化数据。
3. 是否使用了 HTTP requests，以及请求的目标地址。
4. 是否在日志中输出了账号、Token 或请求内容。
5. 能力声明是否与实际行为一致。

源码查看适合用于审查、学习和排查问题。修改本地包后，重新导入并检查版本与能力声明，避免继续使用旧的已安装副本。

## 模块运行失败时的排查顺序

### 模块无法安装

- 确认导入的是有效的模块包，而不是单个 JavaScript 文件。
- 检查包版本和当前 Lemon 版本是否兼容。
- 重新导入前先确认文件没有损坏，来源没有被截断。
- 如果是官方目录模块，等待目录状态刷新后再试。

### 模块已安装但无法打开

- 在已安装模块列表中确认模块处于启用状态。
- 打开模块信息页，检查 Entry Module 是否存在。
- 核对模块要求的 Host Permissions 和 Data Capabilities。
- 查看 Log output，定位入口脚本加载或界面渲染错误。

### 模块运行中没有数据

确认模块是否真的拥有所需能力，并检查调用参数和目标数据是否存在。例如模块需要持久化存储时，必须启用 Persistent store；需要发送请求时，必须启用 HTTP requests。不要把权限错误误判为数据为空。

## 管理建议

- 定期检查已安装模块，停用不再使用的模块。
- 升级前记录当前 Package Version，出现问题时便于回退和对比。
- 分享模块包前清理本地路径、调试日志和私有配置。
- 用最小权限安装和测试第三方模块。
- 模块问题和请求改写问题要分开排查：先确认模块能正常打开，再检查它触发的请求或重写规则。

模块是本地扩展能力。请只安装你信任的模块包，并在使用网络请求、持久化数据或日志能力时遵守相应的隐私和安全要求。
