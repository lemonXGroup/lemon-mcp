export type CapturedBodyState = "missing" | "empty" | "text" | "binary_ref" | "structured";

export interface CapturedBodyMetadata {
  state: CapturedBodyState;
  path: string | null;
  byteLength: number | null;
}

function nonEmptyPath(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function bodyByteLength(body: unknown): number | null {
  return typeof body === "string" ? Buffer.byteLength(body, "utf8") : null;
}

export function describeCapturedBody(body: unknown, path: unknown): CapturedBodyMetadata {
  const bodyPath = nonEmptyPath(path);
  if (bodyPath) {
    return { state: "binary_ref", path: bodyPath, byteLength: bodyByteLength(body) };
  }
  if (body === null || body === undefined) {
    return { state: "missing", path: null, byteLength: null };
  }
  if (typeof body === "string") {
    return {
      state: body.length === 0 ? "empty" : "text",
      path: null,
      byteLength: bodyByteLength(body),
    };
  }
  return { state: "structured", path: null, byteLength: null };
}

export function normalizeCapturedRequest(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== "object") {
    throw new Error("Captured request response is not an object");
  }
  const payload = response as { item?: unknown };
  if (!payload.item || typeof payload.item !== "object" || Array.isArray(payload.item)) {
    throw new Error("Captured request response does not contain an item");
  }
  const item = payload.item as Record<string, unknown>;
  return {
    ...item,
    requestBodyMeta: describeCapturedBody(item.requestBody, item.requestBodyPath),
    responseBodyMeta: describeCapturedBody(item.responseBody, item.responseBodyPath),
  };
}
