> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

## What Modules are

Modules are locally installed tools that can run independently inside Lemon. A module can have its own interface, scripts, and controlled data capabilities, making it useful for turning a repeated debugging workflow into a reusable tool.

Modules and Rewrite solve different problems. Rewrite changes requests and responses as they pass through Lemon. A module is an installable extension with its own interface and runtime capabilities. A module can trigger an operation and then work with Requests, Rewrite, or another Console feature.

## Open Module Center

1. Open Lemon's **Console**.
2. Select **Modules** to enter **Module Center**.
3. Browse available items in the official modules area; installed items appear in the installed area.
4. To use a local package, choose **Import Module Package**.

After an install or import, open the module from its information page. When you do not need it to run, turn off its enabled state.

## Module package basics

The exact filenames depend on the package, but the information page normally exposes these pieces of metadata:

| Item | Purpose |
| --- | --- |
| Manifest | Describes the module identity, entry point, and capability declarations |
| Package Version | Identifies the script package version and helps confirm upgrades |
| Entry Module | The entry module loaded when the module starts |
| JavaScript / ESM files | The scripts that implement the interface and runtime behavior |

Check the package source and version before installing. Do not run an unknown script package, and do not edit a manifest's capability declarations just to work around an installation error.

## Create Modules with lemonModule

The [`lemon-module` GitHub repository](https://github.com/lemonXGroup/lemon-module) is the standalone module tool project for external developers. Its command-line program is named `lemon-module`; it creates module projects, validates the module contract, produces `.lemonmodule` archives, and inspects archive contents.

It is a module authoring and release helper, not the module runtime:

- `init` creates a module project from a built-in template.
- `validate` checks the manifest, paths, capability declarations, and resource limits.
- `test` validates the project and performs a deterministic pack / unpack round-trip.
- `pack` creates a `.lemonmodule` archive that Lemon can import.
- `inspect` reads archive metadata without executing module JavaScript.
- `upload` optionally sends an archive to an administrator module endpoint; ordinary local installation does not require it.

### Get and build the tool

`lemon-module` supports macOS, Linux, and Windows. Building from source requires Rust stable; the current version requires Rust `1.85` or newer. The following commands build a release binary for the current platform from the public repository:

```bash
git clone https://github.com/lemonXGroup/lemon-module.git
cd lemon-module
cargo build --release --locked
./target/release/lemon-module --help
```

You can also install it into the local Cargo bin directory:

```bash
cargo install --path . --locked
lemon-module --help
```

During development, you can run `cargo run --release --locked --` from the repository root instead of `./target/release/lemon-module`.

### Create a module from a template

The `init` destination must be a new or empty directory; existing files are never overwritten. The directory name is only used to generate the initial `moduleID`, so replace it with your own reverse-domain namespace after initialization:

```bash
./target/release/lemon-module init modules/my-debug-tool --template basic
```

The tool provides four starting templates:

| Template | Use case | Generated content |
| --- | --- | --- |
| `basic` | Minimal module | Basic page, title, and refresh button |
| `request-list` | Request-list utility | Request-list-style placeholder UI |
| `settings-form` | Settings-oriented utility | Settings page plus config schema and defaults |
| `dashboard` | Dashboard utility | Dashboard page plus configuration files |

Templates only create a project skeleton. `request-list` does not fetch request data automatically, and `dashboard` does not generate business metrics; business logic still needs to call Lemon APIs declared by the Core script.

### Standard local workflow

Run the following from the root of the `lemon-module` repository:

```bash
# Create a module project.
./target/release/lemon-module init modules/my-debug-tool --template basic

# Edit module.json, core/, ui/, and locales/, then validate the module.
./target/release/lemon-module validate modules/my-debug-tool

# Run the deterministic pack / unpack round-trip test.
./target/release/lemon-module test modules/my-debug-tool

# Create a module package that Lemon can import.
./target/release/lemon-module pack modules/my-debug-tool \
  --output my-debug-tool-1.0.0.lemonmodule

# Inspect the generated archive without executing its JavaScript.
./target/release/lemon-module inspect my-debug-tool-1.0.0.lemonmodule
```

These local commands have different responsibilities:

| Command | Purpose | Requires Lemon or an iPhone |
| --- | --- | --- |
| `init` | Create the module directory and example files | No |
| `validate` | Validate a source project or `.lemonmodule` archive | No |
| `test` | Validate and verify an archive round-trip | No |
| `pack` | Create a `.lemonmodule` archive | No |
| `inspect` | Read the archive summary and file list | No |
| `upload` | Upload to the administrator release endpoint | Requires a server URL and administrator token |

### Module project and archive files

`lemon-module` recursively reads the project and collects only supported runtime files:

| Path | File type | Archive purpose |
| --- | --- | --- |
| `core/**/*.js` | UTF-8 JavaScript | Core ESM source |
| `shared/**/*.js` | UTF-8 JavaScript | Shared Core ESM source |
| `ui/**/*.json` | UTF-8 JSON | Declarative UI |
| `locales/**/*.json` | UTF-8 JSON | Locale resources |
| `config/**/*.json` | UTF-8 JSON | Config schema, defaults, and migrations |
| `assets/*.{png,jpg,jpeg}` | Image resources | Archive assets |

`module.json` is the author-maintained source manifest. Packing uses it to generate the archive's `manifest.json`; they are not the same file. `README.md`, `LICENSE`, `CHANGELOG.md`, hidden files, `docs/`, `tests/`, and `.lemonignore` itself are excluded from the archive. Other unsupported file types cause packing to fail; author-only files can be excluded with `.lemonignore`.

During validation, pay particular attention to the following:

- `moduleID` has at least two dot-separated components and uses only letters, digits, `.`, `-`, and `_`.
- `moduleVersion` has three numeric components, such as `1.0.0`.
- The current `minHostApi` is `1.0`, and `uiSchemaVersion` is `2`.
- `entrypoints.core`, `entrypoints.ui`, and locale paths point to existing files.
- `capabilities` declares only the smallest set the module actually uses and matches its `lemon:*` imports, UI commands, and data APIs.

### Build Windows binaries from macOS

The tool uses rustls and a Rust implementation of its compression library, so it does not require OpenSSL or zlib to be preinstalled on the target system and can cross-compile Windows x64 binaries from macOS. For ordinary Windows users, prefer the MSVC target:

```bash
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
cargo xwin build --release --locked --target x86_64-pc-windows-msvc
```

The artifact is `target/x86_64-pc-windows-msvc/release/lemon-module.exe`. You can also use Zig to build the Windows GNU target:

```bash
rustup target add x86_64-pc-windows-gnu
cargo install cargo-zigbuild
cargo zigbuild --release --locked --target x86_64-pc-windows-gnu
```

GNU artifacts may need MinGW runtime DLLs in some Windows environments; test and distribute the required DLLs together with the `.exe`. Cross-compilation only builds the CLI. It does not execute module JavaScript or replace validation of the Lemon iOS runtime on a real Windows environment.

### Import the generated module package

After local development, import the `.lemonmodule` file produced by `pack`, not an individual `module.json` or `core/main.js` file:

1. Open Lemon's **Console**, then go to **Modules** and **Module Center**.
2. Choose **Import Module Package** and select the `.lemonmodule` file.
3. Wait for Lemon to validate and install it, then review the version, entry point, and capabilities on the module information page.
4. After confirming that the source is trusted and the permissions are expected, enable the module and open its interface.

`lemon-module` does not execute module JavaScript, install npm dependencies, or provide the module runtime; the Lemon iOS host provides runtime execution. `upload` is for administrator-controlled release flows only. Ordinary module authors can work locally with `validate`, `test`, and `pack`.

## A Practical Example: Build a Utility Module

The example below is a self-contained Base64 utility module, explained file by file. It demonstrates a complete small-module loop: capability declarations, state initialization, action handling, Lemon host APIs, declarative UI, and locale resources. It depends only on the public module package contract, not on any internal project or unpublished file.

### Directory layout

```text
com.example.base64-tool/
├── module.json             # Source manifest maintained by the author
├── core/
│   └── main.js              # ESM business logic and lifecycle functions
├── ui/
│   └── index.json           # Declarative UI, without SwiftUI / HTML / CSS
└── locales/
    ├── en.json              # English locale resource
    └── zh-Hans.json         # Simplified Chinese locale resource
```

`module.json` is the source manifest in the authoring directory. The pack command creates the archive's `manifest.json` from `entrypoints`, `locales`, and the physical files. Do not confuse the two files, and do not add source content, file sizes, or hashes to the source manifest.

### 1. Declare identity and capabilities

```json
{
  "moduleID": "com.example.base64-tool",
  "moduleVersion": "1.0.0",
  "minHostApi": "1.0",
  "uiSchemaVersion": 2,
  "fallbackLocale": "en",
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

Important details:

- Use reverse-domain notation for `moduleID`. The `com.lemon.modules.*` namespace is reserved for first-party modules; third-party modules should use their own namespace.
- `entrypoints.core` must point to an existing ESM file, and `entrypoints.ui` must point to an existing UI JSON file.
- `host: ["utils"]` corresponds to the `lemon:utils` import in `core/main.js`. An undeclared host capability will be rejected by validation or at runtime.
- `commands: ["copy"]` corresponds to the copy command returned by the script. Declare only what the module really uses so users can review its permissions.
- Use a UI schema version supported by the current Lemon build. The package validator and host contract remain the final authority for available fields.

### 2. Write `core/main.js`

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

This return shape is the central runtime contract: `state` flows back into UI bindings, while `commands` are executed by the host. A button's `action.id` must match the value handled by `onAction`. Implement `onRefresh(context)` when a page needs to reload data, but do not return user-confirmation commands such as `openPage` from lifecycle callbacks.

The excerpt focuses on encoding. You can extend it with Base64 decoding, URL encoding/decoding, timestamps, JSON formatting, or JWT payload parsing using the same `state -> onAction -> result` pattern.

### 3. Declare the interface in `ui/index.json`

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

This file must remain valid JSON, so it cannot contain JavaScript-style comments. The important relationships are: `value.bind` connects a control to `state`; `action.id` connects a button to `onAction`; and `disabledWhen` derives availability from state. The UI declares structure; business logic stays in `core/main.js`.

### 4. Add locale resources

`locales/zh-Hans.json`:

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

`locales/en.json`:

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

Locale keys must cover every `{"key": "..."}` used by the UI and every key passed to `t(...)` in the core script. `fallbackLocale` only selects a fallback language; it does not fill in a missing key. Add the same key to both locale files.

### 5. Validate, test, and pack

Run these commands from the root of a cloned `lemon-module` repository; you can replace the binary path with `cargo run --release --locked --`:

```bash
# Validate the source manifest, paths, capabilities, and resource limits.
./target/release/lemon-module validate /path/to/com.example.base64-tool

# Run the deterministic pack/unpack round-trip test.
./target/release/lemon-module test /path/to/com.example.base64-tool

# Create the archive that Lemon can import.
./target/release/lemon-module pack /path/to/com.example.base64-tool \
  --output ./com.example.base64-tool-1.0.0.lemonmodule
```

Import the generated `.lemonmodule`, not a standalone `module.json` or `core/main.js`. When validation fails, fix the manifest, UI schema, or capability at the reported path instead of removing fields to bypass the check.

### Reading Lemon data

When a module needs requests, DNS, Rewrite, or runtime data, declare the smallest matching data capability and call the corresponding data API:

```json
{
  "capabilities": {
    "data": ["runtime.read"]
  }
}
```

This is a source-manifest fragment. Merge it into the existing capabilities object and retain other required declarations; do not replace the full manifest. Then import the matching data API from the core script:

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

Declared capabilities, imported `lemon:*` modules, and data methods must agree. Do not declare every data permission just to get a prototype working: that broadens the review surface and may be rejected by the validator.

## Install, enable, and open

### Install from the official catalog

Open a module's information page from the official area in Module Center. Read its description and capability declarations, then install it. After installation, confirm its state in the installed modules area and use the open entry to launch its interface.

### Import a local package

When the package is stored locally:

1. Open Module Center and choose **Import Module Package**.
2. Select the package and wait for Lemon to validate and install it.
3. Open the module information page and check the version, entry module, and capabilities.
4. Enable the module after reviewing the details, then open its interface.

Installed, enabled, and open are separate states. An installed module is not necessarily enabled, and an enabled module is not necessarily open on screen.

## Runtime permissions

The module information page lists **Host Permissions** and **Data Capabilities**. A module should only be able to call the Lemon interfaces explicitly enabled there.

Common Host Permissions exposed by the console include:

- **Log output**: write module logs for script troubleshooting.
- **Persistent store**: read and write the module's persistent data.
- **HTTP requests**: make controlled HTTP requests from the module.
- **Notifications**: send controlled system notifications; do not use them as a high-frequency UI update channel.
- **Utility functions**: use general-purpose utilities provided by Lemon.

`lemon:*` modules can only import capabilities enabled on the module information page. A capability that is not declared or enabled should not be used. If a module reports a permission error on launch, check its declarations and switches, then open it again.

> Fewer permissions make a module's behavior easier to understand. Enable only what a third-party module actually needs.

## Supported interface controls

The module renderer supports common controls. The module itself decides which controls appear. Typical types include:

- Text: show status, instructions, or results.
- Button: trigger a one-time operation.
- Toggle: change a Boolean setting.
- Picker: choose a value from a set of options.
- Stepper: adjust a number by a fixed step.
- Slider: adjust a number across a continuous range.
- Text editor: edit text or a script fragment.
- Search field: filter list content.
- List / Table: show scrollable items and structured data.
- Chart: show a trend or summary.

The module script owns each control's value and action. When a button does nothing, check module logs first, then confirm that the required runtime permissions are enabled.

## View source

Choose **View Source** on the module information page to inspect its **Source Code**. Pay particular attention to:

1. How the entry module creates the interface and registers actions.
2. Whether the module reads or writes persistent data.
3. Whether it uses HTTP requests and which addresses it contacts.
4. Whether it writes accounts, tokens, or request content to logs.
5. Whether its capability declarations match its actual behavior.

Source viewing is useful for review, learning, and troubleshooting. After changing a local package, import it again and check its version and capabilities so that you do not keep using the old installed copy.

## Troubleshooting

### The module will not install

- Confirm that you selected a valid module package, not a single JavaScript file.
- Check whether the package version is compatible with the current Lemon version.
- Before importing again, verify that the file is complete and not corrupted.
- For an official catalog module, wait for the catalog state to refresh before retrying.

### The module is installed but will not open

- Confirm that it is enabled in the installed modules list.
- Check that the Entry Module exists on the information page.
- Review the required Host Permissions and Data Capabilities.
- Use Log output to locate entry-script or interface-rendering errors.

### The module runs but has no data

Confirm that the module has the capability it needs, then check its arguments and whether the target data exists. A module that needs persistent data requires Persistent store; one that sends requests requires HTTP requests. Do not mistake a permission error for an empty data set.

## Maintenance guidance

- Review installed modules regularly and disable those you no longer use.
- Record the current Package Version before upgrading so that you can compare or roll back if needed.
- Remove local paths, debug logs, and private configuration before sharing a package.
- Test third-party modules with the smallest practical permission set.
- Separate module troubleshooting from request rewriting: first confirm that the module opens, then inspect requests or rewrite rules it triggers.

Modules extend Lemon locally. Install only packages you trust, and follow the applicable privacy and security requirements when using HTTP requests, persistent data, or logging.
