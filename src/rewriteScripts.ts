import { z } from "zod";

export const rewriteScriptPermissionsSchema = z.object({
  log: z.boolean(),
  store: z.boolean(),
  http: z.boolean(),
  notify: z.boolean(),
  utils: z.boolean(),
});

export const rewriteScriptManifestSchema = z.object({
  packageVersion: z.number().int().describe("Supported package format version. Current value is 1."),
  format: z.literal("esm"),
  entry: z.string().min(1).describe("Relative entry module path, for example ./main.js."),
  modules: z.array(z.string().min(1)).min(1).describe("Relative module allowlist."),
  permissions: rewriteScriptPermissionsSchema,
});

export const rewriteScriptModuleSchema = z.object({
  module_id: z.string().min(1).describe("Normalized relative module path, for example main.js."),
  source: z.string().min(1),
});

export type RewriteScriptManifest = z.infer<typeof rewriteScriptManifestSchema>;
export type RewriteScriptModule = z.infer<typeof rewriteScriptModuleSchema>;

export const defaultRewriteScriptPermissions: RewriteScriptManifest["permissions"] = {
  log: true,
  store: false,
  http: false,
  notify: false,
  utils: true,
};

export const defaultRewriteScriptManifest = (): RewriteScriptManifest => ({
  packageVersion: 1,
  format: "esm",
  entry: "./main.js",
  modules: ["./main.js"],
  permissions: { ...defaultRewriteScriptPermissions },
});

export function buildRewriteScriptPackage(input: {
  manifest?: RewriteScriptManifest;
  modules?: RewriteScriptModule[];
  content?: string;
}): { manifest: RewriteScriptManifest; modules: RewriteScriptModule[] } {
  const hasPackage = input.manifest !== undefined || input.modules !== undefined;
  if (hasPackage && input.content !== undefined) {
    throw new Error("content cannot be combined with manifest/modules");
  }
  if (hasPackage && (!input.manifest || !input.modules)) {
    throw new Error("manifest and modules must be provided together");
  }
  if (input.manifest && input.modules) {
    return { manifest: input.manifest, modules: input.modules };
  }
  if (input.content === undefined || input.content.trim().length === 0) {
    throw new Error("Provide a complete package or non-empty content shorthand");
  }
  return {
    manifest: defaultRewriteScriptManifest(),
    modules: [{ module_id: "main.js", source: input.content }],
  };
}

export function assertApiSuccess<T>(response: T): T {
  if (response && typeof response === "object" && "success" in response) {
    const value = response as T & { success?: unknown; err_msg?: unknown };
    if (value.success === false) {
      throw new Error(typeof value.err_msg === "string" ? value.err_msg : "iOS rejected the request");
    }
  }
  return response;
}

export function apiErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      response?: { data?: { err_msg?: unknown; message?: unknown } };
    };
    const responseMessage = value.response?.data?.err_msg ?? value.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.length > 0) return responseMessage;
    if (typeof value.message === "string" && value.message.length > 0) return value.message;
  }
  return String(error);
}
