> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# Requests

Requests is Lemon's traffic inspection entry point. It records HTTP / HTTPS transactions that pass through Lemon and lets you search, filter by response type, favorite important entries, group traffic by domain, and open a full request detail view.

## When to use it

- Confirm whether an endpoint was actually called and which status it returned.
- Compare request headers, response headers, request bodies, and response bodies.
- Find all traffic for a service by grouping requests by host.
- Keep a request for later replay or rewrite work.

The list only contains traffic that has passed through Lemon. If it is empty, first confirm that TUN / VPN is running, the target app has made a network request, and the traffic path actually goes through Lemon.

## List views and filters

### Search and scope

The search field narrows results by URL. The scope menu switches between all requests and favorites. Favorites are useful for keeping important endpoints visible while new traffic continues to arrive.

### Response type filters

Sequence view provides these response filters:

| Filter | Useful for |
| --- | --- |
| All | Every recorded request |
| JSON | APIs and structured data |
| HTML | Documents and pages |
| Image | Image resources |
| Script | JavaScript and similar assets |
| XML | XML or related API responses |
| Other | Responses outside the listed types |

Filtering is applied while loading data. If a page is empty after changing a filter, refresh or continue loading before concluding that there are no matching requests.

### Sequence and domains

- **Sequence view** shows requests chronologically and is useful for reconstructing an interaction.
- **Domains view** groups requests by host and is useful when you want to locate a service before opening a specific transaction.

The request list can refresh automatically and supports pull-to-refresh and clearing records. Clearing is a local data operation; make sure the records are no longer needed before using it.

## How to read request details

When you open a request, check it in this order:

1. URL, HTTP method, status code, and timestamp.
2. Request headers such as Host, Content-Type, Authorization, Cookie, and debug fields.
3. Response headers such as Content-Type, cache directives, compression, redirects, and server information.
4. Request and response bodies, including whether they are decoded, compressed, textual, or binary.
5. WebSocket and SSE sessions in their dedicated detail views rather than relying on a normal HTTP preview.

Whether HTTPS content is visible depends on MITM trust, certificate pinning in the target app, and whether the traffic is on Lemon's path. Seeing a URL without a readable body does not prove that the server returned no body.

## Continue debugging from a request

| Goal | Next step |
| --- | --- |
| Keep evidence | Favorite the request and read its details when needed |
| Run it again | Create a replay and review URL, headers, and body first |
| Change it temporarily | Create a Rewrite rule with narrow Host, Path, Method, and stage matches |
| Automate it | Move repeated logic into a script or module |

Replay sends a real request to the target service and can have side effects. Authorization, Cookie, and request bodies may contain sensitive data, so redact them before sharing details.

## Troubleshooting

### Nothing appears

Confirm that VPN / TUN is active, the target app generated traffic, and no favorites scope, URL search, or response filter is hiding the result. If only HTTPS bodies are missing, check MITM trust first.

### Only some traffic appears

The app may use certificate pinning, QUIC, a non-HTTP protocol, WebSocket, or a path that does not go through Lemon. Validate the chain with a known ordinary HTTP / HTTPS request before narrowing down to the target app.

### Capture needs to start over

Use the request settings to control automatic refresh and clear unrelated records. Trigger one small, repeatable client action and inspect that request chain again.
