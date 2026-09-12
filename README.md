# LemonMCP

[中文文档](./README.zh-CN.md)

LemonMCP is a local [Model Context Protocol](https://modelcontextprotocol.io/)
server for [Lemon for iOS](https://github.com/lemonXGroup/lemonAllinOne). It
lets an AI client such as Cursor, Claude Desktop, Codex, or another MCP
consumer inspect and control a Lemon-enabled iPhone through the local
WebControl API.

LemonMCP runs on the developer's Mac and communicates over stdio with the AI
client. It does not open a public HTTP server on the Mac. It discovers the
Lemon device over Bonjour/mDNS and sends authenticated HTTP requests to the
device's WebControl service.

## Chapter 1: Fast installation with an AI assistant

If your AI client has permission to use the local terminal, copy the prompt
below. It asks the AI to check the environment, clone or update LemonMCP, build
it, and create the MCP configuration for the client it detects.

```text
Install and configure LemonMCP on this computer.

Repository: https://github.com/lemonXGroup/lemon-mcp.git
Default install directory: ~/lemon-mcp

Follow these requirements exactly:
1. Check git and Node.js first. Node.js must be version 20 or newer. If it is
   not, tell me which version is needed; do not use sudo or modify the system
   Node.js installation.
2. Clone the repository if ~/lemon-mcp does not exist. If it already exists,
   check for uncommitted changes. Never overwrite, reset, or force-update a
   dirty worktree; report it and wait. Only use git pull --ff-only on a clean
   worktree.
3. Run npm ci and npm run build in the project directory. Then run npm test and
   report the result.
4. Identify the MCP client I use and its configuration file. Only edit the
   clearly matching MCP configuration, make a local backup first, and preserve
   every other configured server.
5. Add a stdio server named LemonMCP. Use command node and the absolute entry
   point <absolute-project-path>/build/index.js.
6. Do not ask me to send a WebControl token in chat. Never print, upload, or
   commit it. If a token is required, put a placeholder in the local config and
   tell me to replace it locally:
   LEMON_WEB_CONTROL_TOKEN=fill-this-in-locally
7. If Bonjour is unavailable, show optional local settings for
   LEMON_TARGET_HOST and LEMON_TARGET_PORT. Do not guess or change the device
   address by default.
8. Do not start a long-running LemonMCP process. Do not invoke traffic/log
   clearing, DNS writes, Replay, Rewrite, Module, or any other consequential
   MCP operation. Tell me which client must be restarted or reloaded.
9. Report the install directory, build result, test result, edited config file,
   backup location, and any token or restart steps I must complete locally.
```

An AI assistant cannot grant itself local permissions. If it cannot edit client
files, let it run the install and build commands, then copy the generated JSON
snippet into the client configuration manually. This flow does not require
GitHub Actions, Docker, or a global npm installation.

## What it provides

The server currently registers 61 tools and 2 resources. Tool schemas exposed
to the MCP client are the runtime source of truth; the following list is a
capability map for humans and AI agents.

### Device and embedded web page

- `toggle_vpn`: request VPN/PacketTunnel start or stop.
- `open_web_page`: open an HTTP or HTTPS URL in Lemon's embedded WKWebView.
- `close_web_page`, `refresh_web_page`, `go_back_web_page`,
  `go_forward_web_page`: control the current embedded page.

### Scheduled JavaScript tasks

- `list_scheduled_tasks`, `get_scheduled_task`:
  inspect locally stored tasks.
- `get_scheduled_task_runtime_status`: inspect PacketTunnel scheduler state.
- `create_scheduled_task`, `update_scheduled_task`:
  create or update Cron or fixed-interval tasks.
- `set_scheduled_task_enabled`, `delete_scheduled_task`:
  change task state or remove a task.

Tasks support a single ESM file or a validated ESM package. Scheduled packages
must export `onSchedule(input)` from their manifest entry. Fixed intervals are
limited to `250..86400000` milliseconds by the MCP schema.

### Traffic, logs, files, and database

- `clear_captured_traffic`: remove captured HTTP records and body files.
- `fetch_system_logs`, `clear_system_logs`: read or clear the Lemon core log.
- `search_traffic_previews`: find request summaries by keyword or host.
- `get_captured_request`: read a complete request/response and body metadata.
- `fetch_binary_payload`: fetch a referenced request or response body.
- `fetch_device_file`: read a non-database App Group file.
- `execute_raw_sql`: run a diagnostic query against Lemon's SQLite database.

Use `search_traffic_previews` for discovery and `get_captured_request` for
authoritative request details. Binary or unsafe text bodies are returned in a
lossless, bounded representation instead of being decoded as arbitrary text.

### Device target and DNS Hosts

- `set_lemon_target_ip`, `get_lemon_target_ip`: inspect or override the active
  WebControl host and port.
- `list_host_mappings`: list native DNS Host mappings.
- `upsert_host_mapping`: create or update a mapping or block rule.
- `delete_host_mapping`: remove a mapping by UUID.

### HTTP Replay

- `list_replay_items`, `get_replay_item`: inspect saved requests.
- `create_replay_item`, `update_replay_item`: save or edit a request.
- `delete_replay_item`: remove a saved request.
- `execute_replay_item`: execute a saved request.
- `execute_replay_request`: execute a one-shot request without saving it.

Replay execution sends a real request. Verify the target, credentials, headers,
body, and expected side effects before using it.

### Rewrite script packages

- `list_rewrite_scripts`, `get_rewrite_script_package`:
  inspect active or historical packages.
- `list_rewrite_script_revisions`: inspect immutable revisions.
- `validate_rewrite_script_package`: validate without persisting.
- `upsert_rewrite_script`: create a package or publish a new revision.
- `rollback_rewrite_script`: switch the active revision.
- `get_rewrite_runtime_status`: inspect JavaScript runtime state and limits.
- `get_rewrite_debug_events`, `clear_rewrite_debug_events`:
  read or clear structured debug events.
- `reload_rewrite_runtime`: request a runtime reload.
- `delete_rewrite_script`: remove a package and its revisions.

The complete package form contains a manifest and allowlisted ESM modules.
`upsert_rewrite_script` also accepts a one-file `content` shorthand, which is
converted to a restricted `main.js` package. Use
`validate_rewrite_script_package` before publishing and verify both persistence
and runtime status afterwards.

### Rewrite rules

- `list_rewrite_rules`: list policies, MatchGroups, and actions.
- `upsert_rewrite_rule`: create or update a rule using `rule_json` and
  `groups_json`.
- `delete_rewrite_rule`: remove a rule by numeric id.
- `get_rewrite_schema`: return the current rule, action, and package schema.

Conditions inside one MatchGroup use AND. Matching groups use OR. The exact
accepted fields and action values are returned by `get_rewrite_schema` and
should be read before generating a rule.

### UI Modules

- `list_modules`, `get_module_package`: inspect installed modules and package
  revisions.
- `list_module_revisions`: inspect immutable revisions.
- `validate_module_package`: validate a package without installing it.
- `upsert_module`: install a module or publish a new revision.
- `rollback_module`: activate a historical revision.
- `toggle_module`: enable or disable a module.
- `delete_module`: remove a module and all revisions.
- `get_module_runtime_status`: inspect active workers and runtime limits.
- `reload_module_runtime`: release one worker or reload all workers.

The following compatibility aliases are retained for early clients:
`inspect_module`, `install_module`, and `set_module_enabled`. New integrations
should use the canonical module tools above.

### MCP resources

- `lemonmcp://env/hardware_status`: a point-in-time device, memory, VPN,
  MITM, and CA certificate status snapshot.
- `lemonmcp://database/schema`: the current Lemon SQLite table and column
  descriptions for accurate diagnostic SQL.

Resources are read-only context. They do not replace a later status check or
the detailed response from a tool call.

## Requirements

- macOS with Node.js 20 or newer.
- Lemon for iOS running on a real iPhone with WebControl enabled.
- The Mac and iPhone on a reachable local network, or a connection that
  supports the advertised Bonjour service.
- A current WebControl token when the iOS app requires authentication.

Lemon advertises `_lemon._tcp` through Bonjour. The default fallback target is
`stack.local:9999`. Set `LEMON_TARGET_HOST` and `LEMON_TARGET_PORT` when a
different fallback address is needed. Bonjour discovery still takes priority.

## Install and build

```sh
npm ci
npm run build
```

Run the server directly with:

```sh
export LEMON_WEB_CONTROL_TOKEN='TOKEN_FROM_LEMON_REMOTE_CONTROLLER'
npm start
```

The token is read from the environment and sent only as the
`X-Lemon-WebControl-Token` request header. Do not commit it, put it in an MCP
configuration shared with others, or include it in issue reports.

## Configure an MCP client

Use the absolute path to the built entry point. The exact configuration file
depends on the MCP client:

```json
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
```

For a non-Bonjour fallback target, add `LEMON_TARGET_HOST` and
`LEMON_TARGET_PORT` to the same `env` object. The MCP process starts its device
discovery only after the stdio handshake completes. Successful WebControl
calls send a session-scoped activity ping, and transport shutdown attempts to
clear that session on the iOS side.

## Safety model

LemonMCP can change device state and can send real network requests. Treat the
following as explicitly consequential operations: VPN start/stop, traffic or
log clearing, raw SQL, DNS writes, Replay execution, Rewrite publication or
deletion, and Module installation or deletion.

An AI client should explain the target and expected effect before performing a
destructive or external operation, then verify three separate outcomes where
applicable:

1. WebControl accepted the request.
2. The new state is persisted and can be read back.
3. The iOS runtime loaded the state or a real request demonstrated the change.

Keep WebControl on a trusted network. Do not expose its port to the public
Internet, and do not put credentials, cookies, authorization headers, private
data, or production secrets in scripts, Rewrite rules, Replay items, logs, or
Markdown examples.

## Development

```sh
npm ci
npm test
```

The public project includes deterministic unit tests for the API client,
Bonjour target selection, byte handling, captured requests, file formatting,
traffic search, and Rewrite package validation. Real-device E2E fixtures are
kept in the main Lemon repository because they require a controlled iOS
device, a private test backend, and repository-specific cleanup tooling.

## Relationship to the Lemon repository

This directory is maintained as a standalone-ready copy of the MCP server.
The iOS WebControl contract remains owned by the Lemon app. When that contract
changes, update the MCP tool schemas and this README together, then run the
public project's unit tests and a real-device compatibility check from the
main repository.
