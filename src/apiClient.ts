import axios, { AxiosInstance } from "axios";
import { randomUUID } from "node:crypto";

const MCP_SESSION_HEADER = "X-Lemon-MCP-Session";
const WEB_CONTROL_TOKEN_HEADER = "X-Lemon-WebControl-Token";
const WEB_CONTROL_TOKEN_ENV = "LEMON_WEB_CONTROL_TOKEN";
const TARGET_HOST_ENV = "LEMON_TARGET_HOST";
const TARGET_PORT_ENV = "LEMON_TARGET_PORT";
const DEFAULT_TARGET_HOST = "stack.local";
const DEFAULT_TARGET_PORT = 9999;

function configuredTargetPort(): number {
  const value = Number(process.env[TARGET_PORT_ENV]);
  return Number.isInteger(value) && value > 0 && value <= 65535
    ? value
    : DEFAULT_TARGET_PORT;
}

export function normalizeResponseBytes(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === "string") return Buffer.from(data, "utf8");

  if (data && typeof data === "object" && "type" in data && "data" in data) {
    const serializedBuffer = data as { type?: unknown; data?: unknown };
    if (serializedBuffer.type === "Buffer" && Array.isArray(serializedBuffer.data)) {
      return Buffer.from(serializedBuffer.data);
    }
  }

  try {
    return Buffer.from(JSON.stringify(data ?? null), "utf8");
  } catch {
    return Buffer.from(String(data ?? ""), "utf8");
  }
}

function normalizeResponseText(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  }
  try {
    return JSON.stringify(data ?? null, null, 2);
  } catch {
    return String(data ?? "");
  }
}

export class ApiClient {
  private client: AxiosInstance;
  private readonly webControlToken?: string;
  public baseUrl: string;
  /** Stable for this LemonMCP process and different after every restart. */
  public readonly sessionId = randomUUID();

  constructor(
    host: string,
    port: number = 9999,
    webControlToken = process.env[WEB_CONTROL_TOKEN_ENV]?.trim()
  ) {
    this.baseUrl = `http://${host}:${port}`;
    this.webControlToken = webControlToken || undefined;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  // Update the target dynamically (e.g. from Bonjour)
  public updateTarget(host: string, port: number) {
    this.baseUrl = `http://${host}:${port}`;
    this.client.defaults.baseURL = this.baseUrl;
  }

  public async get<T>(url: string, params?: any, policy?: { maxRedirects: 0; maxContentLength: number; proxy?: false }): Promise<T> {
    const response = await this.client.get<T>(url, {
      ...policy,
      params,
      headers: this.authHeaders(),
    });
    this.sendActivityPing();
    return response.data;
  }

  public async getText(url: string, params?: any): Promise<string> {
    const response = await this.client.get<string>(url, {
      params,
      responseType: "text",
      headers: this.authHeaders(),
    });
    this.sendActivityPing();
    return normalizeResponseText(response.data);
  }

  public async getBytes(url: string, params?: any): Promise<Buffer> {
    const response = await this.client.get<Buffer>(url, {
      params,
      responseType: "arraybuffer",
      headers: this.authHeaders(),
    });
    this.sendActivityPing();
    return normalizeResponseBytes(response.data);
  }

  public async post<T>(url: string, data?: any, params?: any, policy?: { maxRedirects: 0; maxContentLength: number; maxBodyLength: number; proxy: false }): Promise<T> {
    const response = await this.client.post<T>(url, data, {
      ...policy,
      ...(url.startsWith('/api/rewrite/scripts/remote') ? { timeout: 75000 } : {}),
      params,
      headers: this.authHeaders(),
    });
    if (url !== '/api/mcp/ping') this.sendActivityPing();
    return response.data;
  }

  public async postBytes<T>(url: string, data: Buffer, contentType: string, params?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, {
      params,
      headers: {
        ...this.authHeaders(),
        "Content-Type": contentType,
        "Content-Length": String(data.byteLength),
      },
    });
    this.sendActivityPing();
    return response.data;
  }

  public async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data, {
      headers: this.authHeaders(),
    });
    this.sendActivityPing();
    return response.data;
  }

  public async delete<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.delete<T>(url, {
      params,
      headers: this.authHeaders(),
    });
    if (url !== "/api/mcp/ping") this.sendActivityPing();
    return response.data;
  }

  public async disconnect(): Promise<void> {
    await this.client.delete('/api/mcp/ping', {
      headers: {
        ...this.authHeaders(),
        [MCP_SESSION_HEADER]: this.sessionId,
      },
    });
  }

  private sendActivityPing() {
    this.client.post('/api/mcp/ping', undefined, {
      headers: {
        ...this.authHeaders(),
        [MCP_SESSION_HEADER]: this.sessionId,
      },
    }).catch(() => {});
  }

  private authHeaders(): Record<string, string> {
    return this.webControlToken
      ? { [WEB_CONTROL_TOKEN_HEADER]: this.webControlToken }
      : {};
  }
}

// Instantiate a global client pointing to a configurable fallback. Bonjour
// discovery can replace this target after the MCP session is initialized.
export const lemonApi = new ApiClient(
  process.env[TARGET_HOST_ENV]?.trim() || DEFAULT_TARGET_HOST,
  configuredTargetPort(),
);
