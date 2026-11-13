import { normalizeRequestTarget, requestTargetActions, supportsRequestTarget } from "./requestTarget.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lemonApi } from "./apiClient";
import { registerDeviceFileTools } from "./deviceFiles";
import { rewritePolicyID, rewritePolicyIDSchema, validateRewritePolicyID } from "./rewriteIdentifiers";
import { formatByteContent } from "./byteContent";
import { formatTextFileContent, isTextFilePath } from "./fileContent";
import {
  apiErrorMessage,
  assertApiSuccess,
  buildRewriteScriptPackage,
  rewriteScriptManifestSchema,
  rewriteScriptModuleSchema,
  rewriteScriptPermissionsSchema,
} from "./rewriteScripts";
import { normalizeCapturedRequest } from "./capturedRequest";
import { exactHostForKeyword, filterTrafficItems } from "./trafficSearch";
import { hasHostWildcardConditions, supportsHostWildcards } from "./rewriteMatching";

const scheduledScriptPackageSchema = z.object({
  manifest: rewriteScriptManifestSchema,
  modules: z.array(rewriteScriptModuleSchema).min(1),
});

const replayMethodSchema = z.enum([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE",
]);
const replayHeadersSchema = z.record(z.string(), z.string()).default({});

function buildReplayPayload(input: {
  name?: string;
  url: string;
  method: z.infer<typeof replayMethodSchema>;
  headers: Record<string, string>;
  body?: string | null;
  id?: string;
}) {
  return {
    ...(input.id === undefined ? {} : { id: input.id }),
    ...(input.name === undefined ? {} : { name: input.name }),
    url: input.url,
    method: input.method,
    headers: input.headers,
    body: input.body ?? null,
  };
}

function buildScheduledScriptPayload(input: {
  script_type: "single" | "package";
  script: string;
  script_package?: z.infer<typeof scheduledScriptPackageSchema>;
}) {
  if (input.script_type === "package") {
    if (!input.script_package) {
      throw new Error("script_package is required when script_type=package");
    }
    return {
      script: input.script,
      script_type: input.script_type,
      script_package: input.script_package,
    };
  }
  if (input.script_package) {
    throw new Error("script_package must be omitted when script_type=single");
  }
  return {
    script: input.script,
    script_type: input.script_type,
  };
}

export function registerTools(server: McpServer) {
  registerDeviceFileTools(server, lemonApi);
  const remoteDescriptor = z.object({
    url: z.string().url().describe("Public HTTPS source URL. The iPhone downloads and preflights it."),
    format: z.enum(["javascript", "esm_package"]).default("javascript"),
    autoUpdate: z.boolean().default(false),
    intervalSeconds: z.union([z.literal(3600), z.literal(21600), z.literal(86400)]).default(86400),
    permissionCeiling: rewriteScriptPermissionsSchema.default({ log: true, store: false, http: false, notify: false, utils: true }),
    expectedSHA256: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    isPrivate: z.boolean().default(false).describe("Omit this source URL from sharing and cloud backups; the complete installed snapshot is still retained."),
  });
  server.registerTool("prepare_remote_rewrite_script", {
    description: "Downloads and preflights native Lemon ESM on the iPhone without persisting a script. Returns a caller-bound token valid for 10 minutes. Use it in a parent rule's remote_scripts or explicitly create a standalone resource.",
    inputSchema: { descriptor: remoteDescriptor, required_handlers: z.array(z.enum(["onRequest", "onResponse"])).default([]) },
  }, async (input) => {
    try { return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(await lemonApi.post('/api/rewrite/scripts/remote/prepare', input)), null, 2) }] }; }
    catch (error) { return { content: [{ type: "text", text: apiErrorMessage(error) }], isError: true }; }
  });
  server.registerTool("create_remote_rewrite_script", {
    description: "Explicitly installs a standalone remote script using a prepared token. For an unsaved rule, pass the token through remote_scripts to save the resource and rule atomically.",
    inputSchema: { token: z.string().uuid(), name: z.string().trim().min(1) },
  }, async (input) => {
    try { return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(await lemonApi.post('/api/rewrite/scripts/remote', input)), null, 2) }] }; }
    catch (error) { return { content: [{ type: "text", text: apiErrorMessage(error) }], isError: true }; }
  });
  server.registerTool("get_remote_rewrite_script", {
    description: "Reads a remote source's generation, validators, schedule, and controlled failure state. Source URLs may contain private query credentials; do not publish them.",
    inputSchema: { id: z.number().int().positive() },
  }, async (input) => {
    try { return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(await lemonApi.get('/api/rewrite/scripts/remote', input)), null, 2) }] }; }
    catch (error) { return { content: [{ type: "text", text: apiErrorMessage(error) }], isError: true }; }
  });
  server.registerTool("configure_remote_rewrite_script", {
    description: "Changes source URL, permission ceiling, pin, or foreground auto-update settings using a generation CAS. It invalidates validators and does not replace the installed package; explicitly refresh to validate and install new content.",
    inputSchema: { id: z.number().int().positive(), generation: z.number().int().positive(), descriptor: remoteDescriptor },
  }, async (input) => {
    try { return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(await lemonApi.put('/api/rewrite/scripts/remote', input)), null, 2) }] }; }
    catch (error) { return { content: [{ type: "text", text: apiErrorMessage(error) }], isError: true }; }
  });
  server.registerTool("refresh_remote_rewrite_script", {
    description: "Manually checks a normal remote script on the iPhone, bypassing its schedule. Conditional GET, integrity checks, preflight, atomic publish and runtime apply are shared with native UI. DRM content continues to use the existing licensed refresh channel.",
    inputSchema: { id: z.number().int().positive() },
  }, async (input) => {
    try { return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(await lemonApi.post('/api/rewrite/scripts/remote/refresh', input)), null, 2) }] }; }
    catch (error) { return { content: [{ type: "text", text: apiErrorMessage(error) }], isError: true }; }
  });
  server.registerTool("copy_remote_rewrite_script", {
    description: "Copies an installed normal script snapshot to a new independent local script. No source URL or automatic subscription is copied.",
    inputSchema: { id: z.number().int().positive(), name: z.string().trim().min(1) },
  }, async (input) => {
    try { return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(await lemonApi.post('/api/rewrite/scripts/remote/copy', input)), null, 2) }] }; }
    catch (error) { return { content: [{ type: "text", text: apiErrorMessage(error) }], isError: true }; }
  });
  // 1. toggle_vpn
  server.registerTool("toggle_vpn", {
    description: "Starts or stops the Lemon iOS VPN. Wait for success or error response.",
    inputSchema: {
      action: z.enum(["start", "stop"]).describe("Whether to start or stop the VPN capture"),
    }
  }, async ({ action }) => {
    try {
      const response = await lemonApi.post(`/api/vpn/${action}`);
      return {
        content: [{ type: "text", text: `Successfully requested VPN ${action}.` }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `VPN ${action} failed: ${error.message}` }],
        isError: true
      };
    }
  });

  // 2. open_web_page
  server.registerTool("open_web_page", {
    description: "Opens an HTTP or HTTPS URL inside the Lemon iOS app's embedded WKWebView.",
    inputSchema: {
      url: z.string()
        .trim()
        .max(4096)
        .refine((value) => {
          try {
            const parsed = new URL(value);
            return (parsed.protocol === "http:" || parsed.protocol === "https:")
              && !parsed.username
              && !parsed.password
              && Boolean(parsed.hostname);
          } catch {
            return false;
          }
        }, "URL must be a valid HTTP or HTTPS address without embedded credentials")
        .describe("HTTP or HTTPS URL to open inside Lemon")
    }
  }, async ({ url }) => {
    try {
      const result = await lemonApi.post<any>("/api/webview/open", { url });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to open web page: ${apiErrorMessage(error)}` }],
        isError: true
      };
    }
  });

  const registerWebBrowserControlTool = (
    name: string,
    endpoint: string,
    description: string,
    failureMessage: string
  ) => {
    server.registerTool(name, { description }, async () => {
      try {
        const result = await lemonApi.post<any>(endpoint);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `${failureMessage}: ${apiErrorMessage(error)}` }],
          isError: true
        };
      }
    });
  };

  registerWebBrowserControlTool(
    "close_web_page",
    "/api/webview/close",
    "Closes the Lemon iOS embedded WKWebView.",
    "Failed to close web page"
  );
  registerWebBrowserControlTool(
    "refresh_web_page",
    "/api/webview/refresh",
    "Reloads the current page in the Lemon iOS embedded WKWebView.",
    "Failed to refresh web page"
  );
  registerWebBrowserControlTool(
    "go_back_web_page",
    "/api/webview/back",
    "Navigates back in the Lemon iOS embedded WKWebView history.",
    "Failed to navigate back in web page"
  );
  registerWebBrowserControlTool(
    "go_forward_web_page",
    "/api/webview/forward",
    "Navigates forward in the Lemon iOS embedded WKWebView history.",
    "Failed to navigate forward in web page"
  );

  // Scheduled JavaScript tasks
  server.registerTool("list_scheduled_tasks", {
    description: "Lists locally stored Cron or millisecond-interval JavaScript tasks, including runtime state and next run time.",
  }, async () => {
    try {
      const result = await lemonApi.get<any>("/api/scripts/scheduled");
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to list scheduled tasks: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("get_scheduled_task", {
    description: "Fetches one locally stored Cron or interval JavaScript task by id.",
    inputSchema: {
      id: z.number().int().positive().describe("Scheduled task id"),
    },
  }, async ({ id }) => {
    try {
      const result = await lemonApi.get<any>("/api/scripts/scheduled/detail", { id });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to fetch scheduled task: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("get_scheduled_task_runtime_status", {
    description: "Returns the current PacketTunnel scheduled-task runtime state without exposing script source.",
  }, async () => {
    try {
      const result = await lemonApi.get<any>("/api/scripts/scheduled/status");
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to fetch scheduled task runtime status: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("create_scheduled_task", {
    description: "Creates a locally stored Cron or millisecond-interval JavaScript task. Use script_type=single with script for one file, or script_type=package with script_package for a validated ESM package. Packages must export onSchedule(input) from their manifest entry. Interval values must be 250..86400000 ms. It is enabled by default unless enabled=false is provided.",
    inputSchema: {
      name: z.string().trim().min(1).describe("Task name"),
      schedule_type: z.enum(["cron", "interval"]).default("cron").describe("Cron or fixed interval scheduling"),
      cron_expr: z.string().trim().min(1).optional().describe("Five-field Cron expression; required for schedule_type=cron"),
      interval_ms: z.number().int().min(250).max(86400000).optional().describe("Fixed interval in milliseconds; required for schedule_type=interval"),
      script_type: z.enum(["single", "package"]).default("single").describe("Whether the task uses one script file or an ESM script package"),
      script: z.string().describe("JavaScript source for a single task, or the entry source compatibility field for a package"),
      script_package: scheduledScriptPackageSchema.optional().describe("Complete ESM package used when script_type=package"),
      enabled: z.boolean().optional().describe("Whether the task starts enabled; defaults to true"),
    },
  }, async ({ name, schedule_type, cron_expr, interval_ms, script_type, script, script_package, enabled }) => {
    try {
      const source = buildScheduledScriptPayload({ script_type, script, script_package });
      const result = await lemonApi.post<any>("/api/scripts/scheduled", {
        name,
        schedule_type,
        ...(cron_expr === undefined ? {} : { cron_expr }),
        ...(interval_ms === undefined ? {} : { interval_ms }),
        ...source,
        ...(enabled === undefined ? {} : { enabled }),
      });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to create scheduled task: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("update_scheduled_task", {
    description: "Updates a locally stored Cron or millisecond-interval JavaScript task. Use script_type=single with script for one file, or script_type=package with script_package for a validated ESM package. Packages must export onSchedule(input) from their manifest entry.",
    inputSchema: {
      id: z.number().int().positive().describe("Scheduled task id"),
      name: z.string().trim().min(1).describe("Task name"),
      schedule_type: z.enum(["cron", "interval"]).default("cron").describe("Cron or fixed interval scheduling"),
      cron_expr: z.string().trim().min(1).optional().describe("Five-field Cron expression; required for schedule_type=cron"),
      interval_ms: z.number().int().min(250).max(86400000).optional().describe("Fixed interval in milliseconds; required for schedule_type=interval"),
      script_type: z.enum(["single", "package"]).default("single").describe("Whether the task uses one script file or an ESM script package"),
      script: z.string().describe("JavaScript source for a single task, or the entry source compatibility field for a package"),
      script_package: scheduledScriptPackageSchema.optional().describe("Complete ESM package used when script_type=package"),
      enabled: z.boolean().describe("Whether the task is enabled"),
    },
  }, async ({ id, name, schedule_type, cron_expr, interval_ms, script_type, script, script_package, enabled }) => {
    try {
      const source = buildScheduledScriptPayload({ script_type, script, script_package });
      const result = await lemonApi.put<any>("/api/scripts/scheduled", {
        id,
        name,
        schedule_type,
        ...(cron_expr === undefined ? {} : { cron_expr }),
        ...(interval_ms === undefined ? {} : { interval_ms }),
        ...source,
        enabled,
      });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to update scheduled task: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("set_scheduled_task_enabled", {
    description: "Enables or disables one scheduled task. Enabling scheduled execution requires the configured schedule entitlement.",
    inputSchema: {
      id: z.number().int().positive().describe("Scheduled task id"),
      enabled: z.boolean().describe("Whether the task should be enabled"),
    },
  }, async ({ id, enabled }) => {
    try {
      const result = await lemonApi.post<any>("/api/scripts/scheduled/toggle", { id, enabled });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to update scheduled task state: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("delete_scheduled_task", {
    description: "Deletes one locally stored scheduled task by id.",
    inputSchema: {
      id: z.number().int().positive().describe("Scheduled task id"),
    },
  }, async ({ id }) => {
    try {
      const result = await lemonApi.delete<any>("/api/scripts/scheduled", { id });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to delete scheduled task: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 2. clear_captured_traffic
  server.registerTool("clear_captured_traffic", {
    description: "Clears all captured HTTP traffics and body binaries from the device."
  }, async () => {
    try {
      await lemonApi.post('/api/requests/clear');
      return {
        content: [{ type: "text", text: "Successfully cleared all captured traffics." }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to clear traffics: ${error.message}` }],
        isError: true
      };
    }
  });

  // 3. fetch_system_logs
  server.registerTool("fetch_system_logs", {
    description: "Safely reads the tail (end) of the Lemon core engine (lemoncore.log) to analyze system or runtime network errors. Suitable for large log files.",
    inputSchema: {
      bytes: z.number().optional().describe("Number of bytes to read from the end. Default is 102400 (100KB, ~1500 lines). Increase only if deeply debugging.")
    }
  }, async ({ bytes }) => {
    try {
      const result = await lemonApi.getText('/api/logs/system', { bytes: bytes ?? 102400 });
      return {
        content: [{ type: "text", text: result }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to fetch system logs: ${error.message}` }],
        isError: true
      };
    }
  });

  // 4. clear_system_logs
  server.registerTool("clear_system_logs", {
    description: "Empties the Lemon core engine root logs (lemoncore.log). Useful to clean up logs before starting a fresh capture to isolate issues."
  }, async () => {
    try {
      await lemonApi.post('/api/logs/system/clear');
      return {
        content: [{ type: "text", text: "Successfully cleared the lemoncore system tail logs." }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to clear system logs: ${error.message}` }],
        isError: true
      };
    }
  });

  // Custom DNS Host mappings
  server.registerTool("list_host_mappings", {
    description: "Lists the native DNS custom Host mappings currently applied by Lemon.",
  }, async () => {
    try {
      const result = await lemonApi.get<any>("/api/dns/hosts");
      return {
        content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }],
      };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to list Host mappings: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("upsert_host_mapping", {
    description: "Creates a native DNS Host mapping, or updates one when an existing mapping id is provided. Writes are applied immediately and do not require a second confirmation.",
    inputSchema: {
      id: z.string().uuid().optional().describe("Existing Host mapping UUID; omit to create a new mapping"),
      enabled: z.boolean().optional().describe("Whether the mapping is active (default true)"),
      domain: z.string().trim().min(1).max(253).describe("ASCII domain name to match, for example api.example.com"),
      target: z.string().trim().max(45).optional().describe("IPv4 or IPv6 target; omit for a block mapping"),
      action: z.enum(["map", "block"]).optional().describe("Map the domain to target, or block it (default map)"),
      comment: z.string().max(4096).optional().describe("Optional operator comment; use an empty string to clear it"),
    },
  }, async ({ id, enabled, domain, target, action, comment }) => {
    try {
      const payload = {
        ...(id === undefined ? {} : { id }),
        enabled: enabled ?? true,
        domain,
        target: target ?? "",
        action: action ?? "map",
        ...(comment === undefined ? {} : { comment }),
      };
      const result = id === undefined
        ? await lemonApi.post<any>("/api/dns/hosts", payload)
        : await lemonApi.put<any>("/api/dns/hosts", payload);
      return {
        content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }],
      };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to save Host mapping: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("delete_host_mapping", {
    description: "Deletes a native DNS custom Host mapping by UUID. The change is applied immediately without a second confirmation.",
    inputSchema: {
      id: z.string().uuid().describe("Host mapping UUID"),
    },
  }, async ({ id }) => {
    try {
      const result = await lemonApi.delete<any>("/api/dns/hosts", { id });
      return {
        content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }],
      };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to delete Host mapping: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  // 5. search_traffic_previews
  server.registerTool("search_traffic_previews", {
    description: "Find HTTP traffic targeting specific keywords or hosts across recent logs.",
    inputSchema: {
      keyword: z.string().describe("Search term, URL substring, or Hostname"),
      limit: z.number().optional().describe("Number of items to retrieve (default 50)")
    }
  }, async ({ keyword, limit }) => {
    try {
      const requestedLimit = typeof limit === "number" && Number.isFinite(limit) ? limit : 50;
      const safeLimit = Math.max(0, Math.min(1_000, Math.floor(requestedLimit)));
      const exactHostQuery = exactHostForKeyword(keyword) !== null;
      const queryLimit = exactHostQuery ? 1_000 : safeLimit;
      const result = await lemonApi.get<any>('/api/requests', { q: keyword, limit: queryLimit });
      const items = Array.isArray(result?.items) ? result.items : [];
      const selectedItems = filterTrafficItems(items, keyword, safeLimit);

      const sanitizedItems = selectedItems.map((item: any) => {
        return {
          trace_id: item.transaction_id ?? item.trace_id ?? item.id,
          database_id: item.id,
          legacy_trace_id: item.trace_id ?? null,
          method: item.method,
          url: item.url,
          status: item.statusCode,
          time: new Date(item.timestamp * 1000).toISOString(),
          requestBodyLength: item.requestBody ? item.requestBody.length : 0,
          responseBodyLength: item.responseBody ? item.responseBody.length : 0,
          hasBinaryResponse: item.responseBodyPath !== "",
          requestPreview: item.requestBody ? item.requestBody.substring(0, 500) : null,
          responsePreview: item.responseBody ? item.responseBody.substring(0, 500) : null,
        };
      });

      return {
        content: [{ type: "text", text: JSON.stringify(sanitizedItems, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Search failed: ${error.message}` }],
        isError: true
      };
    }
  });

  // 6. get_captured_request
  server.registerTool("get_captured_request", {
    description: "Reads one complete captured request/response by transaction_id, trace_id, or the legacy database id returned by search_traffic_previews. Body metadata distinguishes missing, empty, text, and binary-file payloads.",
    inputSchema: {
      trace_id: z.string().trim().min(1).max(256).describe("Stable request identifier returned as trace_id by search_traffic_previews."),
    }
  }, async ({ trace_id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>("/api/requests/detail", { id: trace_id }));
      return {
        content: [{ type: "text", text: JSON.stringify(normalizeCapturedRequest(result), null, 2) }]
      };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to fetch captured request: ${apiErrorMessage(error)}` }],
        isError: true
      };
    }
  });

  // Saved request replays
  server.registerTool("list_replay_items", {
    description: "Lists saved HTTP replay items stored in Lemon's local runtime database.",
  }, async () => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>("/api/replay/items"));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to list replay items: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("get_replay_item", {
    description: "Reads one saved HTTP replay item by UUID, including its request headers and body.",
    inputSchema: {
      id: z.string().uuid().describe("Saved replay item UUID"),
    },
  }, async ({ id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>("/api/replay/items/detail", { id }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to fetch replay item: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("create_replay_item", {
    description: "Saves a new HTTP replay item in Lemon's local runtime database. The item can later be executed with execute_replay_item.",
    inputSchema: {
      name: z.string().trim().min(1).max(512).describe("Replay item name"),
      url: z.string().trim().url().max(4096).describe("HTTP or HTTPS request URL"),
      method: replayMethodSchema.describe("HTTP method"),
      headers: replayHeadersSchema.describe("Request headers as a string map"),
      body: z.string().nullable().optional().describe("Optional UTF-8 request body"),
    },
  }, async ({ name, url, method, headers, body }) => {
    try {
      const result = assertApiSuccess(await lemonApi.post<any>(
        "/api/replay/items",
        buildReplayPayload({ name, url, method, headers, body }),
      ));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to create replay item: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("update_replay_item", {
    description: "Updates a saved HTTP replay item without changing its execution history.",
    inputSchema: {
      id: z.string().uuid().describe("Saved replay item UUID"),
      name: z.string().trim().min(1).max(512).describe("Replay item name"),
      url: z.string().trim().url().max(4096).describe("HTTP or HTTPS request URL"),
      method: replayMethodSchema.describe("HTTP method"),
      headers: replayHeadersSchema.describe("Request headers as a string map"),
      body: z.string().nullable().optional().describe("Optional UTF-8 request body"),
    },
  }, async ({ id, name, url, method, headers, body }) => {
    try {
      const result = assertApiSuccess(await lemonApi.put<any>(
        "/api/replay/items",
        buildReplayPayload({ id, name, url, method, headers, body }),
      ));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to update replay item: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("delete_replay_item", {
    description: "Deletes one saved HTTP replay item by UUID.",
    inputSchema: {
      id: z.string().uuid().describe("Saved replay item UUID"),
    },
  }, async ({ id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.delete<any>("/api/replay/items", { id }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Failed to delete replay item: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("execute_replay_item", {
    description: "Executes one saved HTTP replay item through Lemon's native URLSession/runtime path and returns the response preview. Saved execution status is updated.",
    inputSchema: {
      id: z.string().uuid().describe("Saved replay item UUID"),
    },
  }, async ({ id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.post<any>(
        "/api/replay/items/execute",
        { id },
      ));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Replay execution failed: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("execute_replay_request", {
    description: "Executes a one-shot HTTP replay without saving it. Use this for a captured request after inspecting it with get_captured_request, or for an ad-hoc request.",
    inputSchema: {
      url: z.string().trim().url().max(4096).describe("HTTP or HTTPS request URL"),
      method: replayMethodSchema.describe("HTTP method"),
      headers: replayHeadersSchema.describe("Request headers as a string map"),
      body: z.string().nullable().optional().describe("Optional UTF-8 request body"),
    },
  }, async ({ url, method, headers, body }) => {
    try {
      const result = assertApiSuccess(await lemonApi.post<any>(
        "/api/replay/execute",
        buildReplayPayload({ url, method, headers, body }),
      ));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: unknown) {
      return {
        content: [{ type: "text", text: `Replay execution failed: ${apiErrorMessage(error)}` }],
        isError: true,
      };
    }
  });

  // 7. fetch_binary_payload
  server.registerTool("fetch_binary_payload", {
    description: "Deep-dives into a specific HTTP payload by fetching its full request/response bodies.",
    inputSchema: {
      path: z.string().describe("The physical `.bin` path (e.g. `1234_req.bin`) discovered from previews.")
    }
  }, async ({ path }) => {
    try {
      const responseData = await lemonApi.getBytes(`/api/body`, { path });
      return {
        content: [{
          type: "text",
          text: formatByteContent(`[Full Payload Content for ${path}]`, responseData)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to fetch payload: ${error.message}` }],
        isError: true
      };
    }
  });

  // 5. execute_raw_sql
  server.registerTool("execute_raw_sql", {
    description: "Executes a raw SQL diagnostic query on the Lemon SQLite database (Read-Only queries advised). For Int64 identifiers, SELECT CAST(id AS TEXT) AS id_text; bare large JSON numbers lose precision in JavaScript. Keep joins inside SQLite and project only necessary metadata.",
    inputSchema: {
      query: z.string().describe("Standard SQLite SQL string to execute on the database")
    }
  }, async ({ query }) => {
    try {
      const result = await lemonApi.post('/api/database/query', { query });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Query failed: ${error.message}` }],
        isError: true
      };
    }
  });

  // 7. set_lemon_target_ip
  server.registerTool("set_lemon_target_ip", {
    description: "Manually override the target IP address of the iOS Lemon device. Use this if mDNS/Bonjour discovery fails or if the device relies on a different network IP.",
    inputSchema: {
      ip: z.string().describe("The physical IP address of the iOS device running Lemon (e.g. 192.168.1.10)"),
      port: z.number().optional().describe("The port (default 9999)")
    }
  }, async ({ ip, port }) => {
    try {
      lemonApi.updateTarget(ip, port ?? 9999);
      return {
        content: [{ type: "text", text: `Successfully repointed MCP logic to Lemon at ${ip}:${port ?? 9999}` }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to update target IP configuration to ${ip}: ${error.message}` }],
        isError: true
      };
    }
  });

  // 8. get_lemon_target_ip
  server.registerTool("get_lemon_target_ip", {
    description: "Retrieves the current network URL/IP that the MCP is using to communicate with the iOS device.",
  }, async () => {
    return {
      content: [{ type: "text", text: `Current LemonMCP Target: ${lemonApi.baseUrl}` }]
    };
  });

  // 9. fetch_device_file
  server.registerTool("fetch_device_file", {
    description: "Fetches a specific non-database file from the iOS device's AppGroup container. ESM rewrite script packages are stored in runtime.sqlite; use get_rewrite_script_package instead of looking for RewriteScripts/*.js files.",
    inputSchema: {
      path: z.string().describe("The relative path inside the AppGroup container (for example Logs/lemoncore.log or Bodies/response.bin)")
    }
  }, async ({ path }) => {
    try {
      if (isTextFilePath(path)) {
        const text = await lemonApi.getText(`/api/files/download`, { path });
        return {
          content: [{
            type: "text",
            text: formatTextFileContent(`[File Content for ${path}]`, text)
          }]
        };
      }

      const responseData = await lemonApi.getBytes(`/api/files/download`, { path });
      return {
        content: [{
          type: "text",
          text: formatByteContent(`[File Content for ${path}]`, responseData)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to fetch file: ${error.message}` }],
        isError: true
      };
    }
  });

  // 10. list_rewrite_scripts
  server.registerTool("list_rewrite_scripts", {
    description: "Lists ESM rewrite script packages with their ids, active revisions, and enabled state. Use get_rewrite_script_package to read source modules.",
  }, async () => {
    try {
      const result = await lemonApi.get<any>('/api/rewrite/scripts');
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 11. get_rewrite_script_package
  server.registerTool("get_rewrite_script_package", {
    description: "Fetches the complete manifest and source modules for an active or historical ESM rewrite script revision.",
    inputSchema: {
      id: z.number().int().positive().describe("Script package id"),
      revision: z.number().int().positive().optional().describe("Optional historical revision. Omit to read the active revision."),
    }
  }, async ({ id, revision }) => {
    try {
      const result = await lemonApi.get<any>('/api/rewrite/scripts/package', {
        id,
        ...(revision === undefined ? {} : { revision }),
      });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to fetch script package: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 12. list_rewrite_script_revisions
  server.registerTool("list_rewrite_script_revisions", {
    description: "Lists immutable revisions for a rewrite script package, including content hashes, byte sizes, and the active revision.",
    inputSchema: {
      id: z.number().int().positive().describe("Script package id"),
    }
  }, async ({ id }) => {
    try {
      const result = await lemonApi.get<any>('/api/rewrite/scripts/revisions', { id });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to list script revisions: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 13. validate_rewrite_script_package
  server.registerTool("validate_rewrite_script_package", {
    description: "Validates an ESM rewrite package with the same iOS-side manifest, module-path, and size rules used before persistence. It does not write anything.",
    inputSchema: {
      manifest: rewriteScriptManifestSchema,
      modules: z.array(rewriteScriptModuleSchema).min(1),
    }
  }, async ({ manifest, modules }) => {
    try {
      const result = await lemonApi.post<any>('/api/rewrite/scripts/validate', { manifest, modules });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Script package validation failed: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 14. upsert_rewrite_script
  server.registerTool("upsert_rewrite_script", {
    description: "Creates a new ESM rewrite script package or publishes a new immutable revision. Provide manifest/modules for multi-file packages, or content as a one-file shorthand. Set reload=true to request an immediate runtime snapshot reload after persistence.",
    inputSchema: {
      id: z.number().int().positive().optional().describe("Existing script package id. Omit to create a package."),
      name: z.string().min(1).optional().describe("Script name. Required when creating; optional when updating."),
      manifest: rewriteScriptManifestSchema.optional().describe("Complete ESM package manifest."),
      modules: z.array(rewriteScriptModuleSchema).min(1).optional().describe("Complete module source list matching manifest.modules."),
      content: z.string().optional().describe("One-file shorthand. Converted to main.js with the default restricted permissions."),
      reload: z.boolean().optional().describe("Request an immediate rewrite snapshot reload after the package is stored.")
    }
  }, async ({ id, name, manifest, modules, content, reload }) => {
    try {
      if (id === undefined && !name) {
        throw new Error("name is required when creating a script package");
      }
      const packageData = buildRewriteScriptPackage({ manifest, modules, content });
      const payload = {
        ...(id === undefined ? {} : { id }),
        ...(name === undefined ? {} : { name }),
        ...packageData,
      };
      let result: any;
      if (id) {
        result = await lemonApi.put<any>('/api/rewrite/scripts', payload);
      } else {
        result = await lemonApi.post<any>('/api/rewrite/scripts', payload);
      }
      result = assertApiSuccess(result);
      if (reload) {
        try {
          const reloadResult = await lemonApi.post<any>('/api/rewrite/reload');
          result = { ...result, reload: assertApiSuccess(reloadResult) };
        } catch (error: unknown) {
          // Persistence already succeeded. Preserve that result and expose a
          // reload failure as a partial outcome (for example when VPN is off).
          result = {
            ...result,
            reload: { success: false, err_msg: apiErrorMessage(error) },
          };
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to upsert rewrite script: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 15. rollback_rewrite_script
  server.registerTool("rollback_rewrite_script", {
    description: "Makes an existing immutable revision the active revision for a rewrite script package. Historical revisions are retained.",
    inputSchema: {
      id: z.number().int().positive().describe("Script package id"),
      revision: z.number().int().positive().describe("Revision to activate"),
      reload: z.boolean().optional().describe("Request an immediate rewrite snapshot reload after switching the active revision."),
    }
  }, async ({ id, revision, reload }) => {
    try {
      let result = assertApiSuccess(await lemonApi.post<any>('/api/rewrite/scripts/rollback', { id, revision }));
      if (reload) {
        try {
          result = { ...result, reload: assertApiSuccess(await lemonApi.post<any>('/api/rewrite/reload')) };
        } catch (error: unknown) {
          result = { ...result, reload: { success: false, err_msg: apiErrorMessage(error) } };
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to rollback rewrite script: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 16. get_rewrite_runtime_status
  server.registerTool("get_rewrite_runtime_status", {
    description: "Reports whether rewrite and JavaScript execution are enabled, runtime resource limits, sync state, and script counts.",
  }, async () => {
    try {
      const result = await lemonApi.get<any>('/api/rewrite/status');
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to fetch rewrite runtime status: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 17. get_rewrite_debug_events
  server.registerTool("get_rewrite_debug_events", {
    description: "Reads the independent structured rewrite-debug event projection. Filter by trace, rewrite phase, or severity instead of scanning generic trace events.",
    inputSchema: {
      trace_id: z.string().optional().describe("Optional HTTP trace id to inspect."),
      event_type: z.string().optional().describe("Optional event type, for example rule_matched, mutation_applied, script_failed, or rewrite_skipped."),
      level: z.string().optional().describe("Optional severity filter, for example info or warn."),
      limit: z.number().int().min(0).max(1_000).optional().describe("Maximum number of events to return (default 200, maximum 1000)."),
      offset: z.number().int().min(0).optional().describe("Number of newest matching events to skip."),
    }
  }, async ({ trace_id, event_type, level, limit, offset }) => {
    try {
      const result = await lemonApi.get<any>('/api/rewrite/debug-events', {
        ...(trace_id === undefined ? {} : { trace_id }),
        ...(event_type === undefined ? {} : { event_type }),
        ...(level === undefined ? {} : { level }),
        ...(limit === undefined ? {} : { limit }),
        ...(offset === undefined ? {} : { offset }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to fetch rewrite debug events: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 18. clear_rewrite_debug_events
  server.registerTool("clear_rewrite_debug_events", {
    description: "Clears structured rewrite-debug events. Provide trace_id to clear only one request; omit it only when intentionally clearing the whole debug projection.",
    inputSchema: {
      trace_id: z.string().optional().describe("Optional HTTP trace id. When omitted, all rewrite-debug events are cleared."),
    }
  }, async ({ trace_id }) => {
    try {
      const result = await lemonApi.post<any>('/api/rewrite/debug-events/clear', undefined, {
        ...(trace_id === undefined ? {} : { trace_id }),
      });
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to clear rewrite debug events: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 19. reload_rewrite_runtime
  server.registerTool("reload_rewrite_runtime", {
    description: "Requests the active rewrite snapshot to reload from runtime.sqlite. This may fail when the VPN runtime is not running; persisted scripts are unaffected.",
  }, async () => {
    try {
      const result = await lemonApi.post<any>('/api/rewrite/reload');
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to reload rewrite runtime: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 20. delete_rewrite_script
  server.registerTool("delete_rewrite_script", {
    description: "Delete a rewrite script by its numeric ID.",
    inputSchema: { id: z.number().int().positive() }
  }, async ({ id }) => {
    try {
      const result = await lemonApi.delete<any>(`/api/rewrite/scripts?id=${id}`);
      return { content: [{ type: "text", text: JSON.stringify(assertApiSuccess(result), null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to delete rewrite script: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 21. list_rewrite_rules
  server.registerTool("list_rewrite_rules", {
    description: "Fetches all existing rewrite policies and their MatchGroups. Use each policy id_text decimal string as rule.id when updating, or as delete_rewrite_rule id. The legacy numeric id may exceed JavaScript safe integer precision. Construct policy metadata explicitly; do not pass id_text or other read-only fields back in rule_json. This response includes all rule bodies, so use narrow read-only SQL with CAST(id AS TEXT) for bounded checks.",
  }, async () => {
    try {
      const result = await lemonApi.get<any>('/api/rewrite');
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
    }
  });

  // 22. upsert_rewrite_rule
  server.registerTool("upsert_rewrite_rule", {
    description: "Add or update a rewrite policy with ordered MatchGroups. Supports host/path/query/method conditions and URL expressions. Checks device host-wildcard support before saving; disabling an existing policy remains available. To update, ensure the rule object has an 'id'.",
    inputSchema: {
      rule_json: z.string().describe("JSON string specifying Policy metadata. For updates set id to the original id_text decimal string, or a safe positive integer. Omit id_text and read-only fields. Unsafe numeric ids are rejected. Example: {\"name\":\"Mock API\",\"enabled\":true,\"priority\":100}"),
      groups_json: z.string().describe("JSON string array of MatchGroup objects. Each group has group_key, order, match_mode (default/expression), match_expression, host/path/query/method conditions (AND in default mode) and actions. Host eq/prefix/suffix/contains accept * and ? on supported devices; leading *. includes the root domain. Multiple groups are evaluated in order without short-circuiting."),
      remote_scripts_json: z.string().optional().describe("Optional JSON array from prepare_remote_rewrite_script. New resources: {temporary_id:string,name,token}, IDs 9000000000000000..9007199254740991 referenced by actions. Shared source edits: {temporary_id:string,script_id,source_generation,active_revision,name,token}, using current metadata. The iPhone commits resources and the parent rule atomically.")
    }
  }, async ({ rule_json, groups_json, remote_scripts_json }) => {
    try {
      const rule = JSON.parse(rule_json);
      validateRewritePolicyID(rule);
      const groups = JSON.parse(groups_json);
      const targetActions = Array.isArray(groups) ? groups.flatMap((group: any) => group.actions || [])
        .filter((action: any) => requestTargetActions.includes(action.action)) : [];
      for (const action of targetActions) {
        action.config = JSON.stringify(normalizeRequestTarget(action.action, JSON.parse(action.config), action.scope));
      }
      if (targetActions.length) {
        const capabilities = await lemonApi.get<any>("/api/rewrite/capabilities");
        if (!supportsRequestTarget(capabilities)) throw new Error("The device needs an update for URL/Query/HTTP redirect actions.");
      }

      const disablingExistingPolicy = rule.id !== undefined && rule.enabled === false;
      if (!disablingExistingPolicy && hasHostWildcardConditions(groups)) {
        let capabilities: unknown;
        try {
          capabilities = await lemonApi.get("/api/rewrite/capabilities");
        } catch (error) {
          throw new Error(`Cannot verify host wildcard support: ${apiErrorMessage(error)}. Update the device if the capability endpoint is unavailable.`);
        }
        if (!supportsHostWildcards(capabilities)) {
          throw new Error("Host wildcards require device host_wildcards version 1, root_domain=true and all four operators; update the device before saving this rule.");
        }
      }
      const remote = remote_scripts_json === undefined ? {} : { remote_scripts: JSON.parse(remote_scripts_json) };
      // iOS takes POST /api/rewrite with json: { rule: { ... }, groups: [ ... ] }
      let res: any;
      if (rule.id !== undefined) {
        res = await lemonApi.put('/api/rewrite', { rule, groups, ...remote });
      } else {
        res = await lemonApi.post('/api/rewrite', { rule, groups, ...remote });
      }
      if (res && res.success === false) {
        throw new Error(res.err_msg || "Unknown iOS backend error");
      }
      return { content: [{ type: "text", text: "Successfully upserted rewrite rule." }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
    }
  });

  // 23. delete_rewrite_rule
  server.registerTool("delete_rewrite_rule", {
    description: "Delete a rewrite rule by its exact id_text decimal string, or a safe positive integer. Large JavaScript numbers are rejected to prevent deleting the wrong policy. Use list_rewrite_rules id_text or SELECT CAST(id AS TEXT) to obtain the original identifier.",
    inputSchema: { id: rewritePolicyIDSchema }
  }, async ({ id }) => {
    try {
      const exactID = rewritePolicyID(id);
      const result = await lemonApi.delete<any>(`/api/rewrite?id=${exactID}`);
      if (result && result.success === false) throw new Error(result.err_msg || "Unknown iOS backend error");
      return { content: [{ type: "text", text: "Successfully deleted rewrite rule." }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed: ${error.message}` }], isError: true };
    }
  });

  // 24. get_rewrite_schema
  server.registerTool("get_rewrite_schema", {
    description: "Returns the exact JSON schema and accepted enum values for creating or updating Rewrite Rules and Actions.",
  }, async () => {
    let targetCapability = "Device support unknown (capability request unavailable).";
    try { const capabilities = await lemonApi.get<any>("/api/rewrite/capabilities"); targetCapability = supportsRequestTarget(capabilities) ? "Device URL/Query/HTTP redirect support: version 1." : "Device needs an update for URL/Query/HTTP redirect actions."; } catch {}
    const schema = `
# Lemon Rewrite Configuration Schema

${targetCapability}

When calling \`upsert_rewrite_rule\`, you need to provide \`rule_json\` and \`groups_json\`.

## 1. Rule Object (Rewrite Policy)
\`\`\`json
{
  "id": "123", // Optional exact id_text string (or safe positive integer), only for updates
  "name": "My AI Interception Rule",
  "enabled": true,
  "priority": 100
}
\`\`\`
Policy metadata does not contain match conditions; all conditions belong to a MatchGroup. Do not send createdAt, updatedAt, isEncrypted, expiresAt, shareCode, or flat matcher fields. The optional id is a local WebControl update key and is not part of the portable RewriteRuleDocumentV2.

## 2. MatchGroups Array
\`\`\`json
[
  {
    "group_key": "123e4567-e89b-12d3-a456-426614174000",
    "enabled": true,
    "order": 0,
    "allows_match_all": false,
    "match_mode": "default",
    "match_expression": "",
    "conditions": [{ "field": "host", "op": "eq", "value": "api.example.com" }],
    "actions": [{ "enabled": true, "scope": "response", "action": "body_replace", "config": "{}", "order": 0 }]
  }
]
\`\`\`
Each MatchGroup contains a stable \`group_key\`, an \`order\`, optional \`conditions\` and an ordered \`actions\` array. Conditions inside one group use AND; matching groups use OR without short-circuiting.
Set \`match_mode\` to "expression" and \`match_expression\` to a Rust regex over the full URL (scheme, host, optional port, path and query). Host/path/query/method conditions are retained but ignored in expression mode; all HTTP methods are eligible. An enabled expression must be nonempty and valid; lookaround and backreferences are unsupported. Expression groups must set \`allows_match_all\` to false. Missing matcher fields mean default mode for historical groups. Portable sharing uses schema_version 3 when expression data is present; ordinary rules remain version 2. Non-regex host eq/prefix/suffix/contains support * (zero or more host characters) and ? (one host character). A single leading *. includes the root domain and all subdomains. Position semantics still apply: suffix *.example.com also matches badexample.com. Use eq *.example.com for a root domain and its subdomains only. These wildcards never consume ports, paths or queries; other fields and regex keep their syntax. Shares with wildcard host conditions, including inactive conditions, use schema_version 5; backups use version 6. GET /api/rewrite/capabilities reports host_wildcards version 1 with root_domain=true.

Default-mode condition fields are "host", "path", "query" and "method"; operators are "eq", "prefix", "suffix", "contains" and "regex". Conditions use AND. Query matches the raw query string without the leading ?, excluding fragments; it preserves encoding, case and parameter order. Use query regex (^|&)packageId=1(&|$) for a complete parameter value and ^$ for no query or an empty query. Query does not add a portable version number; old clients reject this unknown field. Non-regex wildcards only extend host, and do not change path/query/method syntax. A star-only host uses the existing allows_match_all confirmation.

**Accepted scope (RewritePhase)**: "request", "response", "websocket_client", "websocket_server". WebSocket scopes allow body_replace and js only. A WebSocket script exports onWebSocketMessage(ctx); ctx.message has direction, bodyText and bodyBase64. Return {body:{text:"replacement"}} or {body:{base64:"AAE="}}, {drop:true}, {injectBefore:"text"}, or {injectAfter:"text"}. Message actions execute after the HTTP Upgrade; HTTP header actions do not rewrite WebSocket messages.
**Accepted action (RewriteActionType)**:
- "header_mod": Modifies HTTP Headers.
- "body_replace": Replaces text, regex matches, an exact JSON path, or ordinary multipart request fields.
- "mock_file": Reads an existing UTF-8 text file on the operated iPhone, directly inside its App Group MockFiles directory (maximum 2 MiB). Use list_device_files to find a phone file and select_mock_file to validate/import/reuse it, or create_mock_file to create a new phone file. Use the returned action config JSON string containing content_type and file_path. The iPhone validates and reads that path; no computer file upload is involved.
- "url_rewrite": Internal URL change, preserves method/body. Request headers only. Config {"target":"/v2/path","query_policy":"auto"}.
- "query_mod": Request headers only. Config {"operations":[{"op":"set","key":"page","value":"2"},{"op":"append","key":"tag","value":"a"},{"op":"remove","key":"debug"},{"op":"clear"}]}. Operations run in order; set/remove affect all same-name keys, append retains duplicates. key/value are decoded text.
- "redirect": Local HTTP redirect, config {"target":"/v2/path","status":307,"query_policy":"auto"}. Supported statuses 301/302/303/307/308; default 307 preserves method/body on client follow. No origin business request is sent.

Query policies: auto uses explicit target query; otherwise preserves original only for same-origin targets and clears across origins. preserve uses original query, replace uses only target query, merge keeps nonconflicting original keys then target keys (target wins), clear removes query. Unmodified query encoding/order/duplicates are retained. Targets are encoded HTTP(S) URLs, root paths or query-only targets; no userinfo/fragments/network-path URLs. Limits: 16 KiB URL, 128 Query operations. New actions require device request_target_rewrite version 1; query /api/rewrite/capabilities before use. Portable sharing uses schema 6; cloud/local recovery uses schema 7. JS request-header output supports {url:"/v2",queryPolicy:"auto"}; other phases reject url.

- "js": Invokes an ESM script package by id. Its config is a JSON string such as {"script_id":7,"phase":"body"}.

Multipart request fields use config JSON strings with mode="multipart", scope="request", and portable schema_version=4. Example config: {"mode":"multipart","operation":"set","field":"role","occurrence":{"kind":"all"},"find":"","replace":"admin","regex":false}. Operations are set, replace, delete, append. Replace requires nonempty find and supports regex captures; delete requires empty find/replace and regex=false. Append omits occurrence. Other operations require occurrence {"kind":"all"} or {"kind":"index","index":0} (zero-based, 0..1023). Exact field names include whitespace, exclude _charset_, and cannot contain CR/LF/NUL. Files are preserved; multipart response/compressed/large streaming edits are unsupported. GET /api/rewrite/capabilities reports device support; 404 or a missing capability requires upgrading. When request-target actions are absent, rules with host wildcards export schema 5; remaining rules without multipart continue to export schema 2/3. Normal text/regex remains suitable for application/x-www-form-urlencoded; never use raw text replacement for a multipart upload.

upsert_rewrite_rule checks GET /api/rewrite/capabilities before saving host wildcards, including inactive conditions. Missing support is an error; an existing policy can still be disabled with id and enabled=false. This gate does not add a portable schema_version to local rule metadata. Ordinary shares keep versions 2/3/4; host wildcard shares use 5 and their backups use 6.

## 3. ESM Script Package

\`upsert_rewrite_script\` accepts either a complete package or a one-file \`content\` shorthand. A complete package has this shape:
\`\`\`json
{
  "name": "JSON response rewrite",
  "manifest": {
    "packageVersion": 1,
    "format": "esm",
    "entry": "./main.js",
    "modules": ["./main.js", "./lib/transform.js"],
    "permissions": {
      "log": true,
      "store": false,
      "http": false,
      "notify": false,
      "utils": true
    }
  },
  "modules": [
    { "module_id": "main.js", "source": "import { transform } from './lib/transform.js'; export function onResponse(ctx) { return transform(ctx); }" },
    { "module_id": "lib/transform.js", "source": "export function transform(ctx) { return {}; }" }
  ]
}
\`\`\`

The iOS validator is the source of truth for ESM path allowlists, package version, module count, per-module size, and total package size. Only explicitly enabled rules load a package. The JavaScript runtime itself is controlled separately by \`rewrite.js_enabled\`; use \`get_rewrite_runtime_status\` before diagnosing a script that has no effect.
`;
    return { content: [{ type: "text", text: schema }] };
  });

  // 25. list_modules
  server.registerTool("list_modules", {
    description: "Lists installed host-side UI Modules, active revisions, and enabled state.",
  }, async () => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>('/api/modules'));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to list Modules: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 26. get_module_package
  server.registerTool("get_module_package", {
    description: "Fetches the complete manifest and ESM sources for an active or historical Module revision.",
    inputSchema: {
      module_id: z.string().describe("Reverse-domain Module id"),
      revision: z.number().int().positive().optional().describe("Optional historical revision"),
    },
  }, async ({ module_id, revision }) => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>('/api/modules/package', {
        id: module_id,
        ...(revision === undefined ? {} : { revision }),
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to fetch Module package: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 27. list_module_revisions
  server.registerTool("list_module_revisions", {
    description: "Lists immutable Module revisions, hashes, and the active revision.",
    inputSchema: { module_id: z.string().describe("Reverse-domain Module id") },
  }, async ({ module_id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>('/api/modules/revisions', { id: module_id }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to list Module revisions: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 28. validate_module_package
  server.registerTool("validate_module_package", {
    description: "Validates a Module package using the iOS validator without persisting it.",
    inputSchema: { package_json: z.string().describe("Complete JSON package with manifest and sources") },
  }, async ({ package_json }) => {
    try {
      const packageValue = JSON.parse(package_json);
      const result = assertApiSuccess(await lemonApi.post<any>('/api/modules/validate', packageValue));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Module package validation failed: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 29. upsert_module
  server.registerTool("upsert_module", {
    description: "Installs a new Module or publishes a new immutable revision. Optionally reloads the host runtime.",
    inputSchema: {
      package_json: z.string().describe("Complete JSON package with manifest and sources"),
      reload: z.boolean().optional().describe("Reload all active Module workers after persistence"),
    },
  }, async ({ package_json, reload }) => {
    try {
      const packageValue = JSON.parse(package_json);
      let result = assertApiSuccess(await lemonApi.put<any>('/api/modules', packageValue));
      if (reload) {
        try {
          result = { ...result, reload: assertApiSuccess(await lemonApi.post<any>('/api/modules/reload')) };
        } catch (error: unknown) {
          result = { ...result, reload: { success: false, err_msg: apiErrorMessage(error) } };
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to upsert Module: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 30. rollback_module
  server.registerTool("rollback_module", {
    description: "Switches a Module to an immutable historical revision; history is retained.",
    inputSchema: {
      module_id: z.string().describe("Reverse-domain Module id"),
      revision: z.number().int().positive().describe("Revision to activate"),
      reload: z.boolean().optional().describe("Reload this Module worker after rollback"),
    },
  }, async ({ module_id, revision, reload }) => {
    try {
      let result = assertApiSuccess(await lemonApi.post<any>('/api/modules/rollback', { module_id, revision }));
      if (reload) {
        try {
          result = { ...result, reload: assertApiSuccess(await lemonApi.post<any>('/api/modules/reload', { module_id })) };
        } catch (error: unknown) {
          result = { ...result, reload: { success: false, err_msg: apiErrorMessage(error) } };
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to rollback Module: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 31. toggle_module
  server.registerTool("toggle_module", {
    description: "Enables or disables one installed UI Module.",
    inputSchema: {
      module_id: z.string().describe("Reverse-domain Module id"),
      enabled: z.boolean().describe("Whether the Module can be opened"),
    },
  }, async ({ module_id, enabled }) => {
    try {
      const result = assertApiSuccess(await lemonApi.post<any>('/api/modules/toggle', { module_id, enabled }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to toggle Module: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 32. delete_module
  server.registerTool("delete_module", {
    description: "Deletes an installed UI Module and all of its immutable revisions.",
    inputSchema: { module_id: z.string().describe("Reverse-domain Module id") },
  }, async ({ module_id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.delete<any>('/api/modules', { id: module_id }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to delete Module: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 33. get_module_runtime_status
  server.registerTool("get_module_runtime_status", {
    description: "Reports active Module workers, leases, and runtime limits.",
  }, async () => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>('/api/modules/status'));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to read Module runtime status: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // 34. reload_module_runtime
  server.registerTool("reload_module_runtime", {
    description: "Releases one Module worker or all workers so the next activation loads the active revision.",
    inputSchema: { module_id: z.string().optional().describe("Optional Module id; omit to reload all") },
  }, async ({ module_id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.post<any>('/api/modules/reload', module_id ? { module_id } : undefined));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to reload Module runtime: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  // Compatibility aliases retained for clients using the initial preview.
  server.registerTool("inspect_module", {
    description: "Fetches the active manifest, UI schema, and ESM sources of one installed Module.",
    inputSchema: { module_id: z.string().describe("Reverse-domain Module id") },
  }, async ({ module_id }) => {
    try {
      const result = assertApiSuccess(await lemonApi.get<any>(`/api/modules/${encodeURIComponent(module_id)}`));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to inspect Module: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("install_module", {
    description: "Compatibility alias for installing or publishing a Module package.",
    inputSchema: { package_json: z.string().describe("Complete JSON package with manifest and sources") },
  }, async ({ package_json }) => {
    try {
      const result = assertApiSuccess(await lemonApi.post<any>('/api/modules', JSON.parse(package_json)));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to install Module: ${apiErrorMessage(error)}` }], isError: true };
    }
  });

  server.registerTool("set_module_enabled", {
    description: "Compatibility alias for enabling or disabling one UI Module.",
    inputSchema: {
      module_id: z.string().describe("Reverse-domain Module id"),
      enabled: z.boolean().describe("Whether the Module can be opened"),
    },
  }, async ({ module_id, enabled }) => {
    try {
      const result = assertApiSuccess(await lemonApi.post<any>('/api/modules/toggle', { module_id, enabled }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Failed to update Module: ${apiErrorMessage(error)}` }], isError: true };
    }
  });
}
