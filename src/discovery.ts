import { Bonjour, Service } from "bonjour-service";
import { lemonApi } from "./apiClient";

export interface LemonTarget {
  host: string;
  port: number;
  serviceName?: string;
}

export interface LemonDiscoveryOptions {
  timeoutMs?: number;
  fallbackHost?: string;
  fallbackPort?: number;
}

export function targetFromService(service: Service): LemonTarget | undefined {
  const targetIpv4 = service.addresses?.find((address) => address.includes(".") && !address.includes(":"));
  const host = targetIpv4 || service.host;
  if (!host || !Number.isInteger(service.port) || service.port <= 0 || service.port > 65535) return undefined;
  return {
    host: host.replace(/\.$/, ""),
    port: service.port,
    serviceName: service.name,
  };
}

/**
 * Resolve the same Bonjour target used by the long-lived LemonMCP service.
 * The E2E runner is a separate Node process, so it cannot read the MCP
 * process's in-memory ApiClient target directly; both processes must use the
 * same resolver instead.
 */
export async function discoverLemonTarget(options: LemonDiscoveryOptions = {}): Promise<LemonTarget> {
  const timeoutMs = Math.max(250, Math.floor(options.timeoutMs ?? 3_000));
  const fallbackHost = options.fallbackHost?.trim();
  const fallbackPort = options.fallbackPort ?? 9999;
  const bonjour = new Bonjour();
  let browser: ReturnType<Bonjour["find"]> | undefined;

  try {
    const discovered = await new Promise<LemonTarget | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), timeoutMs);
      browser = bonjour.find({ type: "lemon" }, (service) => {
        const target = targetFromService(service);
        if (!target) return;
        clearTimeout(timer);
        resolve(target);
      });
    });
    if (discovered) return discovered;
    if (fallbackHost && Number.isInteger(fallbackPort) && fallbackPort > 0 && fallbackPort <= 65535) {
      return { host: fallbackHost, port: fallbackPort };
    }
    throw new Error(`No Lemon Bonjour service found within ${timeoutMs}ms and no valid fallback target is configured`);
  } finally {
    browser?.stop();
    bonjour.destroy();
  }
}

export class DiscoveryService {
  private bonjour = new Bonjour();

  public startDiscovery() {
    // Attempt to discover iOS Lemon broadcasting its custom service type.
    // If the iOS side is not publishing Bonjour, we rely on the configured
    // fallback target in apiClient.ts.

    const browser = this.bonjour.find({ type: 'lemon' }, (service: Service) => {
      const target = targetFromService(service);
      if (!target) return;
      console.error(`[LemonMCP Discovery] Found ${target.serviceName ?? "Lemon"} at: ${target.host}:${target.port}`);
      // Always update target if a new/updated broadcast is received
      lemonApi.updateTarget(target.host, target.port);
    });

    browser.start();

    // Probe the fallback target right away while Bonjour continues in parallel.
    this.pingFallback();
  }

  private async pingFallback() {
    try {
      await lemonApi.get("/api/status");
    } catch (e) {
      // Bonjour discovery remains active and may update the target later.
    }
  }

  public stop() {
    this.bonjour.destroy();
  }
}
