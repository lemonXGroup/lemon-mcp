# Phone files and Mock actions

[Manual](../README.md) · [Rewrite rules](rewrite-rules.md) · [Compatibility](compatibility.md)

Reviewed on 2026-11-12 against the phone App Group file API, Mock store, and both MCP implementations. These operations act on the operated iPhone. They do not read a computer filesystem path or invoke the native Files/iCloud picker.

## Enumerate an existing phone directory

Call `list_device_files` with an App Group-relative directory:

```json
{"path":"MockFiles","offset":0,"limit":200}
```

An empty path lists the App Group root; nested directories require another call. Results include name, path, isDirectory and size. File content is not read. The output preserves the phone's order, which is not guaranteed to be sorted. offset/limit slice the MCP response after the phone enumerates the entire single directory; this is not server-side pagination. The current phone API may return an empty array for either an empty directory or an unavailable directory.

Direct files in `MockFiles/` within the size budget receive candidate metadata and a suggested action config. A candidate is only a metadata hint: its file type, UTF-8 and text content have not yet been validated. Use `select_mock_file` before attaching a phone path when that validation is needed.

Paths must be plain, unescaped App Group-relative paths. Absolute paths, URLs, dot segments, encoded separators, backslashes and control characters are rejected. This boundary does not expose arbitrary iPhone storage, Files-provider items or iCloud documents outside the App Group.

## Select an existing phone file

Call `select_mock_file` with a phone file found by listing, for example:

```json
{"path":"UserFiles/response.json","content_type":"application/json"}
```

The phone validates the file. It safely reuses an existing direct managed MockFiles reference, or copies another permitted App Group file into managed MockFiles. It does not change the source file. The response contains file_path, size, content_type, reused, action, scope and a **config JSON string**; it does not contain the file's text. Use the returned generated reference rather than guessing a destination filename. MIME may be omitted for extension-based inference.

## Create a phone file

Call `create_mock_file` to mirror the app's New File action:

```json
{"filename":"response.json","content":"{\"ok\":true}","content_type":"application/json"}
```

All inputs are optional. An empty object creates an empty text file with a suggested filename of mock.json. The phone generates a unique managed name; filename is a suggestion and cannot overwrite an existing file. Only generated text content is supplied to this API. There is no local_path argument, computer file reader or general upload tool.

Both selecting/importing and creating a file are separate from saving a rule. **Attach new file references promptly with upsert_rewrite_rule.** New copies are pending resources; files left unreferenced may be reclaimed by reconciliation when the app restarts.

## Save the reference as a Mock action

Keep the returned action `mock_file`, scope `response`, and config **string**. Do not replace it with body_replace or insert the whole file content into the rule config. This complete tool input shows a disabled example; replace the example path with the actual returned reference:

```json
{
  "rule_json": "{\"name\":\"Phone mock example\",\"enabled\":false,\"priority\":0}",
  "groups_json": "[{\"group_key\":\"b8df6be0-b6e8-4d45-8fbc-41a2765779cd\",\"enabled\":true,\"order\":0,\"allows_match_all\":false,\"match_mode\":\"default\",\"match_expression\":\"\",\"conditions\":[{\"field\":\"host\",\"op\":\"eq\",\"value\":\"phone-mock.test.invalid\"}],\"actions\":[{\"enabled\":true,\"order\":0,\"scope\":\"response\",\"action\":\"mock_file\",\"config\":\"{\\\"content_type\\\":\\\"application/json\\\",\\\"file_path\\\":\\\"MockFiles/generated-by-phone.json\\\"}\"}]}]"
}
```

Verify the saved action type and file_path in the iPhone editor. For a bounded MCP check, inspect lemonmcp://database/schema and use execute_raw_sql with a narrow read-only SELECT for the saved rule/action identifiers, action type and config reference. Cast identifiers to TEXT (for example, CAST(p.id AS TEXT) AS id_text) and perform joins inside SQLite. For later updates/deletion use the original id_text string, as explained in [exact policy identifiers](rewrite-rules.md#exact-policy-identifiers). Avoid listing all rule bodies merely to check one reference. Saving a rule and successfully rewriting real traffic are separate evidence.

## Inspect and edit

Use `fetch_device_file` with the returned phone file_path only when inspection is necessary. Known text extensions may be formatted (JSON is pretty-printed), so this display is not a byte-exact round trip. Prefer the original known text when exact preservation matters. For editing, create a new file with the edited text, then update the chosen action's reference with upsert_rewrite_rule. This preserves other actions that still reference the old file; these tools do not mutate an existing shared Mock file in place.

## Limits and device compatibility

| Boundary | Current contract |
| --- | --- |
| Mock content | At most 2 MiB (2,097,152 UTF-8 bytes), matching the phone app's Mock file limit; this is independent of shared-rule package/BOS limits |
| Text | Valid UTF-8; lower ASCII control characters are rejected except tab, LF and CR; file type validation remains authoritative on iOS |
| New filename | Basename only, at most 255 UTF-8 bytes; no path separators or control characters |
| MIME | Optional, nonempty and at most 255 characters; no control characters |
| Directory listing | One directory; 2 MiB response budget; 1..1000 returned items per MCP slice |
| New/select response | Metadata and config only, bounded to 64 KiB |
| Device capability | GET /api/rewrite/capabilities must advertise mock_files.version >= 1, create/import_app_group for the requested operation, and maximum_bytes >= 2097152 |

The MCP checks capability before either write. Old, missing, partial or unreachable capabilities block file creation/selection; they are not silently converted to a text-replacement action. All calls use the configured phone token, and new file calls reject redirects and bypass environment HTTP proxies. Validation and HTTP errors are summarized without returning Axios headers, response bodies or credentials.

These tools pass API fixture and loopback HTTP tests, plus focused Stack phone API/persistence acceptance for empty/2 MiB files, path selection, exact ID updates/deletion and resource cleanup. The repository's [verification record](../verification.md) separates these checks from UI interactions, actual rewritten traffic and publication.

## 中文要点

文件来源始终是被操作手机的 App Group 路径。先枚举，再通过 select_mock_file 选择、验证并复制导入或复用；也可以 create_mock_file 新建空文件或文本文件。新建和选择不会自动创建规则，需要立即把返回的 config 字符串交给 upsert_rewrite_rule，动作类型保持 mock_file。编辑采用读取 → 新建副本 → 更新当前规则引用，避免影响其他引用旧文件的动作。内容受手机模拟文件既有的 2 MiB UTF-8 上限约束；这与规则分享/BOS 的大包限额不同。没有电脑文件上传，也不会调起系统 Files/iCloud 选择器。
