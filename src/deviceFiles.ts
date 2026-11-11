import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const maximumListingBytes = 2 * 1024 * 1024;
export const maximumMockFileBytes = 2 * 1024 * 1024;
const maximumMockResponseBytes = 64 * 1024;
const maximumCreateBodyBytes = maximumMockFileBytes * 6 + 16 * 1024;
const binaryExtensions = new Set(["7z", "a", "avi", "bin", "db", "dylib", "gif", "gz", "heic", "ico", "jpeg", "jpg", "mov", "mp3", "mp4", "pdf", "png", "sqlite", "sqlite3", "tar", "wav", "webp", "xcframework", "zip"]);

export interface DeviceFileApi {
  get<T>(url: string, params?: unknown, policy?: { maxRedirects: 0; maxContentLength: number; proxy?: false }): Promise<T>;
  post<T>(url: string, data?: unknown, params?: unknown, policy?: { maxRedirects: 0; maxContentLength: number; maxBodyLength: number; proxy: false }): Promise<T>;
}

export interface DeviceFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  formattedSize?: string;
}

class DeviceFileError extends Error {}

function relativePath(value: string): string {
  if (typeof value !== "string" || value.length > 4096 || /[\\%\u0000-\u001f\u007f]/.test(value)
      || value.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(value)
      || (value !== "" && value.split("/").some(part => !part || part === "." || part === ".."))) {
    throw new DeviceFileError("Use an unescaped iPhone App Group-relative path without dot segments, backslashes or a URL.");
  }
  return value;
}

function mimeType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    json: "application/json", html: "text/html", htm: "text/html", xml: "application/xml",
    css: "text/css", csv: "text/csv", js: "text/javascript", mjs: "text/javascript", svg: "image/svg+xml",
  };
  return types[extension] ?? (binaryExtensions.has(extension) ? "application/octet-stream" : "text/plain");
}

function withMockReference(entry: DeviceFileEntry) {
  if (!entry.path.startsWith("MockFiles/")) return entry;
  const directFile = !entry.isDirectory && entry.path.split("/").length === 2;
  const supportedSize = entry.size <= maximumMockFileBytes;
  const candidate = directFile && supportedSize;
  return { ...entry, mock_file: {
    candidate,
    maximum_bytes: maximumMockFileBytes,
    content_validation: "not_read; iOS validates UTF-8, file type and content when saving the rule",
    ...(candidate ? { action: "mock_file", scope: "response",
      config: JSON.stringify({ content_type: mimeType(entry.name), file_path: entry.path }) }
      : { reason: !directFile ? "Only direct files in MockFiles can be referenced."
        : "The file exceeds the iOS 2 MiB Mock limit." }),
  } };
}

export async function listDeviceFiles(api: DeviceFileApi, input: { path?: string; offset?: number; limit?: number }) {
  const path = relativePath(input.path ?? "");
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 200;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new DeviceFileError("offset must be a nonnegative integer and limit must be 1..1000.");
  }
  const response = await api.get<unknown>("/api/files", { path }, {
    maxRedirects: 0, maxContentLength: maximumListingBytes, proxy: false,
  });
  if (!Array.isArray(response)) throw new DeviceFileError("The iPhone returned an invalid file listing.");
  const items = response.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new DeviceFileError("The iPhone returned an invalid file listing.");
    const item = entry as Record<string, unknown>;
    if (typeof item.name !== "string" || typeof item.path !== "string" || typeof item.isDirectory !== "boolean"
        || typeof item.size !== "number" || !Number.isSafeInteger(item.size) || item.size < 0) {
      throw new DeviceFileError("The iPhone returned an invalid file listing.");
    }
    relativePath(item.path);
    if (item.path !== (path ? path + "/" : "") + item.name || item.name.includes("/")) {
      throw new DeviceFileError("The iPhone returned a file outside the requested directory listing.");
    }
    return { name: item.name, path: item.path, isDirectory: item.isDirectory, size: item.size,
      ...(typeof item.formattedSize === "string" ? { formattedSize: item.formattedSize } : {}) };
  });
  const nextOffset = Math.min(items.length, offset + limit);
  return { path, items: items.slice(offset, offset + limit).map(withMockReference), total: items.length, offset, limit,
    has_more: nextOffset < items.length, next_offset: nextOffset < items.length ? nextOffset : null,
    pagination: "mcp_slice_of_one_directory",
    mock_file_directory: "MockFiles", maximum_mock_file_bytes: maximumMockFileBytes,
    listing_note: "Metadata only; the current iOS endpoint may return [] for either an empty or unavailable directory." };
}

function optionalContentType(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 255 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new DeviceFileError("content_type must be a nonempty MIME value without control characters (maximum 255 characters).");
  }
  return value;
}

async function requireMockCapability(api: DeviceFileApi, operation: "create" | "import_app_group") {
  const response = await api.get<unknown>("/api/rewrite/capabilities", undefined, {
    maxRedirects: 0, maxContentLength: maximumMockResponseBytes, proxy: false,
  });
  const capability = response && typeof response === "object" ? (response as Record<string, unknown>).mock_files : undefined;
  if (!capability || typeof capability !== "object") throw new DeviceFileError("Update Lemon on the iPhone: the device does not advertise Mock file creation/selection support.");
  const value = capability as Record<string, unknown>;
  if (typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version < 1 || value[operation] !== true
      || typeof value.maximum_bytes !== "number" || !Number.isSafeInteger(value.maximum_bytes) || value.maximum_bytes < maximumMockFileBytes) {
    throw new DeviceFileError("Update Lemon on the iPhone: its Mock file capability is missing or incompatible.");
  }
}

function mockFileResult(response: unknown) {
  if (!response || typeof response !== "object") throw new DeviceFileError("The iPhone returned an invalid Mock file reference.");
  const value = response as Record<string, unknown>;
  if (value.success !== true || typeof value.file_path !== "string" || !/^MockFiles\/[^/]+$/.test(value.file_path)
      || typeof value.size !== "number" || !Number.isSafeInteger(value.size) || value.size < 0 || value.size > maximumMockFileBytes
      || typeof value.content_type !== "string" || typeof value.reused !== "boolean"
      || typeof value.filename !== "string" || typeof value.name !== "string") {
    throw new DeviceFileError("The iPhone returned an invalid Mock file reference.");
  }
  relativePath(value.file_path);
  optionalContentType(value.content_type);
  if (value.name !== value.file_path.split("/")[1]) throw new DeviceFileError("The iPhone returned an invalid Mock file reference.");
  return { success: true, file_path: value.file_path, name: value.name, filename: value.filename,
    size: value.size, content_type: value.content_type, reused: value.reused,
    maximum_bytes: maximumMockFileBytes, action: "mock_file", scope: "response",
    config: JSON.stringify({ file_path: value.file_path, content_type: value.content_type }),
    note: "The file is on the iPhone. Use this config JSON string with a mock_file action; creating/selecting a file does not save or enable a rewrite rule. Attach new files promptly with upsert_rewrite_rule; unreferenced files may be reclaimed on app restart." };
}

export async function selectMockFile(api: DeviceFileApi, input: { path: string; content_type?: string }) {
  const path = relativePath(input.path);
  if (!path) throw new DeviceFileError("Select a file using a nonempty iPhone App Group-relative path.");
  const contentType = optionalContentType(input.content_type);
  await requireMockCapability(api, "import_app_group");
  return mockFileResult(await api.post<unknown>("/api/rewrite/mock-files/import", {
    path, ...(contentType !== undefined ? { content_type: contentType } : {}),
  }, undefined, { maxRedirects: 0, maxContentLength: maximumMockResponseBytes, maxBodyLength: 16 * 1024, proxy: false }));
}

export async function createMockFile(api: DeviceFileApi, input: { content?: string; filename?: string; content_type?: string }) {
  const content = input.content ?? "";
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > maximumMockFileBytes) {
    throw new DeviceFileError("Mock file content must be UTF-8 text of at most 2 MiB (2,097,152 bytes).");
  }
  if (Buffer.from(content, "utf8").toString("utf8") !== content || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) {
    throw new DeviceFileError("Mock file content must be valid UTF-8 text without unsupported control characters; tab, LF and CR are allowed.");
  }
  const filename = input.filename ?? "mock.json";
  if (typeof filename !== "string" || !filename || filename === "." || filename === ".." || /[/\\\u0000-\u001f\u007f]/.test(filename)
      || Buffer.byteLength(filename, "utf8") > 255) {
    throw new DeviceFileError("filename must be a basename without path separators or control characters (maximum 255 UTF-8 bytes).");
  }
  const contentType = optionalContentType(input.content_type);
  await requireMockCapability(api, "create");
  return mockFileResult(await api.post<unknown>("/api/rewrite/mock-files", {
    content, filename, ...(contentType !== undefined ? { content_type: contentType } : {}),
  }, undefined, { maxRedirects: 0, maxContentLength: maximumMockResponseBytes, maxBodyLength: maximumCreateBodyBytes, proxy: false }));
}

export function deviceFileErrorMessage(error: unknown): string {
  if (error instanceof DeviceFileError) return error.message;
  if (error && typeof error === "object") {
    const value = error as { response?: { status?: unknown }; code?: unknown };
    if (typeof value.response?.status === "number") {
      const details: Record<number, string> = {
        400: "Check the phone path and text/MIME constraints.", 401: "Check the current WebControl token locally.",
        403: "The iPhone rejected this path.", 404: "The phone file or required device API is unavailable; update Lemon if needed.",
        405: "Update Lemon on the iPhone to use this file operation.", 413: "The file content exceeds the iOS 2 MiB Mock limit.",
        422: "The iPhone rejected the file type, UTF-8 text or content.",
      };
      return "Device file operation failed (HTTP " + value.response.status + "). " + (details[value.response.status] ?? "Check the device and requested file.");
    }
    if (value.code === "ECONNABORTED" || value.code === "ETIMEDOUT") return "Device file operation timed out.";
  }
  return "Device file operation failed. Check iPhone reachability and the requested file.";
}

export function registerDeviceFileTools(server: McpServer, api: DeviceFileApi): void {
  const execute = (operation: (input: any) => Promise<unknown>) => async (input: any) => {
    try { return { content: [{ type: "text" as const, text: JSON.stringify(await operation(input), null, 2) }] }; }
    catch (error) { return { content: [{ type: "text" as const, text: deviceFileErrorMessage(error) }], isError: true }; }
  };
  server.registerTool("list_device_files", {
    description: "Lists existing files in one directory on the operated iPhone's App Group, without uploading or changing files. path is relative; empty means the root. offset/limit slice MCP output only; the current iOS endpoint still enumerates the complete directory. MockFiles candidates include a config JSON string and 2 MiB budget, but metadata does not prove UTF-8/content validity. Use select_mock_file to validate and import/reuse an existing phone file. Reuse fetch_device_file only when content inspection is needed. This is not the iOS Files/iCloud picker.",
    inputSchema: { path: z.string().max(4096).default(""), offset: z.number().int().nonnegative().default(0),
      limit: z.number().int().min(1).max(1000).default(200) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, execute(input => listDeviceFiles(api, input)));
  server.registerTool("select_mock_file", {
    description: "Selects an existing UTF-8 text file by path on the operated iPhone's App Group (not a computer path). The iPhone validates it, reuses a safe direct MockFiles reference or copies it into managed MockFiles storage, and returns a mock_file config JSON string without its content. Source files are unchanged. Maximum file content is 2 MiB. No upload from the computer, Files/iCloud picker or automatic rule save occurs. Attach new copied files promptly with upsert_rewrite_rule; unreferenced files may be reclaimed on app restart. Requires mock_files.import_app_group capability version 1.",
    inputSchema: { path: z.string().min(1).max(4096), content_type: z.string().min(1).max(255).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, execute(input => selectMockFile(api, input)));
  server.registerTool("create_mock_file", {
    description: "Creates a new managed UTF-8 text Mock file on the operated iPhone, mirroring the app's New File action. content defaults to empty and is limited to 2 MiB of UTF-8; filename defaults to mock.json and is a suggestion, not an overwrite path. Returns a mock_file config JSON string and metadata, without the text. To edit, fetch_device_file then create a new copy and update the rule reference with upsert_rewrite_rule; existing files/rules are unchanged by this tool. Never reads or uploads a computer file. Attach new files promptly with upsert_rewrite_rule; unreferenced files may be reclaimed on app restart. Requires mock_files.create capability version 1.",
    inputSchema: { content: z.string().max(maximumMockFileBytes).default(""), filename: z.string().max(255).optional(),
      content_type: z.string().min(1).max(255).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, execute(input => createMockFile(api, input)));
}
