# Current MCP tools

[Manual](../README.md) · [AI guide](../AI_GUIDE.md) · [Full input schemas](tools.schema.json) · [Compatibility](compatibility.md)

Generated from the current public tool registration and Zod schemas on 2026-11-12. This snapshot registers **70 tools** and **2 resources**. These are the public interfaces; check device capabilities and compatibility before generating newer rules.

| Tool | Input fields | Description |
| --- | --- | --- |
| `list_device_files` | path, offset, limit | Lists existing files in one directory on the operated iPhone's App Group, without uploading or changing files. path is relative; empty means the root. offset/limit slice MCP output only; the current iOS endpoint still enumerates the complete directory. MockFiles candidates include a config JSON string and 2 MiB budget, but metadata does not prove UTF-8/content validity. Use select_mock_file to validate and import/reuse an existing phone file. Reuse fetch_device_file only when content inspection is needed. This is not the iOS Files/iCloud picker. |
| `select_mock_file` | path, content_type? | Selects an existing UTF-8 text file by path on the operated iPhone's App Group (not a computer path). The iPhone validates it, reuses a safe direct MockFiles reference or copies it into managed MockFiles storage, and returns a mock_file config JSON string without its content. Source files are unchanged. Maximum file content is 2 MiB. No upload from the computer, Files/iCloud picker or automatic rule save occurs. Attach new copied files promptly with upsert_rewrite_rule; unreferenced files may be reclaimed on app restart. Requires mock_files.import_app_group capability version 1. |
| `create_mock_file` | content, filename?, content_type? | Creates a new managed UTF-8 text Mock file on the operated iPhone, mirroring the app's New File action. content defaults to empty and is limited to 2 MiB of UTF-8; filename defaults to mock.json and is a suggestion, not an overwrite path. Returns a mock_file config JSON string and metadata, without the text. To edit, fetch_device_file then create a new copy and update the rule reference with upsert_rewrite_rule; existing files/rules are unchanged by this tool. Never reads or uploads a computer file. Attach new files promptly with upsert_rewrite_rule; unreferenced files may be reclaimed on app restart. Requires mock_files.create capability version 1. |
| `prepare_remote_rewrite_script` | descriptor, required_handlers | Downloads and preflights native Lemon ESM on the iPhone without persisting a script. Returns a caller-bound token valid for 10 minutes. Use it in a parent rule's remote_scripts or explicitly create a standalone resource. |
| `create_remote_rewrite_script` | token, name | Explicitly installs a standalone remote script using a prepared token. For an unsaved rule, pass the token through remote_scripts to save the resource and rule atomically. |
| `get_remote_rewrite_script` | id | Reads a remote source's generation, validators, schedule, and controlled failure state. Source URLs may contain private query credentials; do not publish them. |
| `configure_remote_rewrite_script` | id, generation, descriptor | Changes source URL, permission ceiling, pin, or foreground auto-update settings using a generation CAS. It invalidates validators and does not replace the installed package; explicitly refresh to validate and install new content. |
| `refresh_remote_rewrite_script` | id | Manually checks a normal remote script on the iPhone, bypassing its schedule. Conditional GET, integrity checks, preflight, atomic publish and runtime apply are shared with native UI. DRM content continues to use the existing licensed refresh channel. |
| `copy_remote_rewrite_script` | id, name | Copies an installed normal script snapshot to a new independent local script. No source URL or automatic subscription is copied. |
| `toggle_vpn` | action | Starts or stops the Lemon iOS VPN. Wait for success or error response. |
| `open_web_page` | url | Opens an HTTP or HTTPS URL inside the Lemon iOS app's embedded WKWebView. |
| `close_web_page` |  | Closes the Lemon iOS embedded WKWebView. |
| `refresh_web_page` |  | Reloads the current page in the Lemon iOS embedded WKWebView. |
| `go_back_web_page` |  | Navigates back in the Lemon iOS embedded WKWebView history. |
| `go_forward_web_page` |  | Navigates forward in the Lemon iOS embedded WKWebView history. |
| `list_scheduled_tasks` |  | Lists locally stored Cron or millisecond-interval JavaScript tasks, including runtime state and next run time. |
| `get_scheduled_task` | id | Fetches one locally stored Cron or interval JavaScript task by id. |
| `get_scheduled_task_runtime_status` |  | Returns the current PacketTunnel scheduled-task runtime state without exposing script source. |
| `create_scheduled_task` | name, schedule_type, cron_expr?, interval_ms?, script_type, script, script_package?, enabled? | Creates a locally stored Cron or millisecond-interval JavaScript task. Use script_type=single with script for one file, or script_type=package with script_package for a validated ESM package. Packages must export onSchedule(input) from their manifest entry. Interval values must be 250..86400000 ms. It is enabled by default unless enabled=false is provided. |
| `update_scheduled_task` | id, name, schedule_type, cron_expr?, interval_ms?, script_type, script, script_package?, enabled | Updates a locally stored Cron or millisecond-interval JavaScript task. Use script_type=single with script for one file, or script_type=package with script_package for a validated ESM package. Packages must export onSchedule(input) from their manifest entry. |
| `set_scheduled_task_enabled` | id, enabled | Enables or disables one scheduled task. Enabling scheduled execution requires the configured schedule entitlement. |
| `delete_scheduled_task` | id | Deletes one locally stored scheduled task by id. |
| `clear_captured_traffic` |  | Clears all captured HTTP traffics and body binaries from the device. |
| `fetch_system_logs` | bytes? | Safely reads the tail (end) of the Lemon core engine (lemoncore.log) to analyze system or runtime network errors. Suitable for large log files. |
| `clear_system_logs` |  | Empties the Lemon core engine root logs (lemoncore.log). Useful to clean up logs before starting a fresh capture to isolate issues. |
| `list_host_mappings` |  | Lists the native DNS custom Host mappings currently applied by Lemon. |
| `upsert_host_mapping` | id?, enabled?, domain, target?, action?, comment? | Creates a native DNS Host mapping, or updates one when an existing mapping id is provided. Writes are applied immediately and do not require a second confirmation. |
| `delete_host_mapping` | id | Deletes a native DNS custom Host mapping by UUID. The change is applied immediately without a second confirmation. |
| `search_traffic_previews` | keyword, limit? | Find HTTP traffic targeting specific keywords or hosts across recent logs. |
| `get_captured_request` | trace_id | Reads one complete captured request/response by transaction_id, trace_id, or the legacy database id returned by search_traffic_previews. Body metadata distinguishes missing, empty, text, and binary-file payloads. |
| `list_replay_items` |  | Lists saved HTTP replay items stored in Lemon's local runtime database. |
| `get_replay_item` | id | Reads one saved HTTP replay item by UUID, including its request headers and body. |
| `create_replay_item` | name, url, method, headers, body? | Saves a new HTTP replay item in Lemon's local runtime database. The item can later be executed with execute_replay_item. |
| `update_replay_item` | id, name, url, method, headers, body? | Updates a saved HTTP replay item without changing its execution history. |
| `delete_replay_item` | id | Deletes one saved HTTP replay item by UUID. |
| `execute_replay_item` | id | Executes one saved HTTP replay item through Lemon's native URLSession/runtime path and returns the response preview. Saved execution status is updated. |
| `execute_replay_request` | url, method, headers, body? | Executes a one-shot HTTP replay without saving it. Use this for a captured request after inspecting it with get_captured_request, or for an ad-hoc request. |
| `fetch_binary_payload` | path | Deep-dives into a specific HTTP payload by fetching its full request/response bodies. |
| `execute_raw_sql` | query | Executes a raw SQL diagnostic query on the Lemon SQLite database (Read-Only queries advised). For Int64 identifiers, SELECT CAST(id AS TEXT) AS id_text; bare large JSON numbers lose precision in JavaScript. Keep joins inside SQLite and project only necessary metadata. |
| `set_lemon_target_ip` | ip, port? | Manually override the target IP address of the iOS Lemon device. Use this if mDNS/Bonjour discovery fails or if the device relies on a different network IP. |
| `get_lemon_target_ip` |  | Retrieves the current network URL/IP that the MCP is using to communicate with the iOS device. |
| `fetch_device_file` | path | Fetches a specific non-database file from the iOS device's AppGroup container. ESM rewrite script packages are stored in runtime.sqlite; use get_rewrite_script_package instead of looking for RewriteScripts/*.js files. |
| `list_rewrite_scripts` |  | Lists ESM rewrite script packages with their ids, active revisions, and enabled state. Use get_rewrite_script_package to read source modules. |
| `get_rewrite_script_package` | id, revision? | Fetches the complete manifest and source modules for an active or historical ESM rewrite script revision. |
| `list_rewrite_script_revisions` | id | Lists immutable revisions for a rewrite script package, including content hashes, byte sizes, and the active revision. |
| `validate_rewrite_script_package` | manifest, modules | Validates an ESM rewrite package with the same iOS-side manifest, module-path, and size rules used before persistence. It does not write anything. |
| `upsert_rewrite_script` | id?, name?, manifest?, modules?, content?, reload? | Creates a new ESM rewrite script package or publishes a new immutable revision. Provide manifest/modules for multi-file packages, or content as a one-file shorthand. Set reload=true to request an immediate runtime snapshot reload after persistence. |
| `rollback_rewrite_script` | id, revision, reload? | Makes an existing immutable revision the active revision for a rewrite script package. Historical revisions are retained. |
| `get_rewrite_runtime_status` |  | Reports whether rewrite and JavaScript execution are enabled, runtime resource limits, sync state, and script counts. |
| `get_rewrite_debug_events` | trace_id?, event_type?, level?, limit?, offset? | Reads the independent structured rewrite-debug event projection. Filter by trace, rewrite phase, or severity instead of scanning generic trace events. |
| `clear_rewrite_debug_events` | trace_id? | Clears structured rewrite-debug events. Provide trace_id to clear only one request; omit it only when intentionally clearing the whole debug projection. |
| `reload_rewrite_runtime` |  | Requests the active rewrite snapshot to reload from runtime.sqlite. This may fail when the VPN runtime is not running; persisted scripts are unaffected. |
| `delete_rewrite_script` | id | Delete a rewrite script by its numeric ID. |
| `list_rewrite_rules` |  | Fetches all existing rewrite policies and their MatchGroups. Use each policy id_text decimal string as rule.id when updating, or as delete_rewrite_rule id. The legacy numeric id may exceed JavaScript safe integer precision. Construct policy metadata explicitly; do not pass id_text or other read-only fields back in rule_json. This response includes all rule bodies, so use narrow read-only SQL with CAST(id AS TEXT) for bounded checks. |
| `upsert_rewrite_rule` | rule_json, groups_json, remote_scripts_json? | Add or update a rewrite policy with ordered MatchGroups. Supports host/path/query/method conditions and URL expressions. Checks device host-wildcard support before saving; disabling an existing policy remains available. To update, ensure the rule object has an 'id'. |
| `delete_rewrite_rule` | id | Delete a rewrite rule by its exact id_text decimal string, or a safe positive integer. Large JavaScript numbers are rejected to prevent deleting the wrong policy. Use list_rewrite_rules id_text or SELECT CAST(id AS TEXT) to obtain the original identifier. |
| `get_rewrite_schema` |  | Returns the exact JSON schema and accepted enum values for creating or updating Rewrite Rules and Actions. |
| `list_modules` |  | Lists installed host-side UI Modules, active revisions, and enabled state. |
| `get_module_package` | module_id, revision? | Fetches the complete manifest and ESM sources for an active or historical Module revision. |
| `list_module_revisions` | module_id | Lists immutable Module revisions, hashes, and the active revision. |
| `validate_module_package` | package_json | Validates a Module package using the iOS validator without persisting it. |
| `upsert_module` | package_json, reload? | Installs a new Module or publishes a new immutable revision. Optionally reloads the host runtime. |
| `rollback_module` | module_id, revision, reload? | Switches a Module to an immutable historical revision; history is retained. |
| `toggle_module` | module_id, enabled | Enables or disables one installed UI Module. |
| `delete_module` | module_id | Deletes an installed UI Module and all of its immutable revisions. |
| `get_module_runtime_status` |  | Reports active Module workers, leases, and runtime limits. |
| `reload_module_runtime` | module_id? | Releases one Module worker or all workers so the next activation loads the active revision. |
| `inspect_module` | module_id | Fetches the active manifest, UI schema, and ESM sources of one installed Module. |
| `install_module` | package_json | Compatibility alias for installing or publishing a Module package. |
| `set_module_enabled` | module_id, enabled | Compatibility alias for enabling or disabling one UI Module. |

## Resources

- lemonmcp://env/hardware_status calls the authenticated device environment endpoint for device, memory, VPN, MITM, and certificate state. Inspect Error contents; a successful resource envelope can still describe a failed device request.
- lemonmcp://database/schema reads the live table and column descriptions before diagnostic SQL generation.

The server currently registers no MCP prompts, documentation resources, or server instructions. Read the bundled documentation locally or through the public GitHub links. Tool annotations are also absent; callers must infer consequences from operation semantics and explicit user authorization.
