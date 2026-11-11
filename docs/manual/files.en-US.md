> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# Files

Files manages debugging resources in Lemon's shared storage. It is useful for Mock data, script dependencies, module packages, and exported diagnostics. It supports directories, files, editing, upload, download, sharing, and deletion.

## Available operations

| Operation | Typical use |
| --- | --- |
| Browse | Locate scripts, modules, or exported artifacts |
| New folder | Keep resources separated by project or test |
| New file / edit | Update text configuration, Mock data, or helper scripts |
| Upload | Put an external resource in shared storage |
| Download / share | Move a diagnostic artifact to another tool or system location |
| Delete | Remove resources that are no longer needed |

The file view follows the current path. Text files can be opened and edited; large binary files or files with unknown encoding are better handled by downloading or preserving a copy before editing.

## Organize resources

A simple layout might look like this:

```text
debug/
  mock/
  scripts/
  modules/
  exports/
```

Folder names do not grant scripts or modules special capabilities. A script or module still needs to pass its own validation, publishing, or installation flow; placing a file in a directory does not make it run automatically.

## Before editing or sharing

Confirm the current path and file name before editing. Check for cookies, Authorization values, device addresses, personal data, or service keys before uploading, downloading, or sharing. Deleting a file is an actual deletion: stop consumers and keep a recoverable copy before removing a resource that may still be referenced.

## Automation

When an AI or remote client works with files, list the directory first, read the target, and only then save, upload, or delete. Read it again after writing and verify the path, byte count, and encoding. A successful file API call does not mean that a downstream script or module has already loaded the new content.

## Troubleshooting

- File missing: check the current directory, shared storage availability, and case-sensitive spelling.
- Edit has no effect: check the reference path and reload the script or module using the file.
- Uploaded file cannot be used: existence does not mean the content passes script, module, or runtime validation.
- Share fails: download to a system-accessible location or check the file type and permission limits.


The public MCP provides list_device_files for phone App Group directories and select_mock_file/create_mock_file for Mock action files. These do not read computer files or invoke the native Files/iCloud picker. Follow the [phone file workflow](../reference/device-files.md), including UTF-8/2 MiB limits and saving new references before an app restart.
