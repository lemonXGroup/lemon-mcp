export type TrafficPreview = {
  host?: unknown;
  url?: unknown;
  [key: string]: unknown;
};

const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?$/i;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?$/;
const BRACKETED_IPV6_PATTERN = /^\[[0-9a-f:]+\](?::\d{1,5})?$/i;

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function exactHostForKeyword(keyword: string): string | null {
  const candidate = normalizeHost(keyword);
  if (!candidate) return null;

  if (HOST_PATTERN.test(candidate) || IPV4_PATTERN.test(candidate) || BRACKETED_IPV6_PATTERN.test(candidate)) {
    return candidate;
  }

  return null;
}

function itemHost(item: TrafficPreview): string | null {
  if (typeof item.host === "string" && item.host.trim()) {
    return normalizeHost(item.host);
  }

  if (typeof item.url === "string") {
    try {
      return normalizeHost(new URL(item.url).host);
    } catch {
      return null;
    }
  }

  return null;
}

export function filterTrafficItems(
  items: TrafficPreview[],
  keyword: string,
  limit: number,
): TrafficPreview[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  const exactHost = exactHostForKeyword(keyword);
  const candidates = exactHost
    ? items.filter((item) => itemHost(item) === exactHost)
    : items;

  return candidates.slice(0, safeLimit);
}
