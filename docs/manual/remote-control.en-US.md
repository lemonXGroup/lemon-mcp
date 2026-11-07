> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# Remote Control

Remote Control starts a Web Control service on the Lemon device. A browser or supported client on the same network can then use HTTP endpoints to operate Lemon. It is one of the connection layers used by LemonMCP, the website console, and automation tools.

## Start the service

In **Remote Controller**:

1. Set a listening port; the default is `9999` and it must be available.
2. Enable the service.
3. Record the displayed URL, Listening status, and access token.
4. Use the URL from a browser or supported client and provide the token when required.

The page shows the current local-network address. It can change after switching Wi-Fi, reconnecting, or waking the device. Refresh the Access Info when a connection stops working.

## Authentication and capabilities

The access token is a credential for the remote service. Do not put it in public screenshots, repositories, logs, or chat messages. A new service session may produce new credentials; use the value currently shown by the page.

Endpoints have different impact: reading status, inspecting requests, saving files, executing Replay, modifying Rewrite, and running SQL are not equivalent. A remote client should request the smallest capability needed and read the resulting state after each write.

## Background mode

The page offers a Picture-in-Picture background mode to help keep the web service running when iOS allows it. It is not an unlimited background guarantee; system resources, network state, and the iOS lifecycle can still interrupt the service. Keep Lemon in the foreground when a stable connection matters.

## Connection troubleshooting

- URL will not open: confirm the service is Active, both devices are on the same network, and the IP and port are current.
- Authentication fails: use the token currently shown in Lemon rather than an old value.
- Page opens but an endpoint is denied: check the caller's capability and whether that endpoint requires authentication.
- Service affects networking: check port conflicts, other VPNs, and network isolation.

Remote Control exposes debugging abilities on the device. Use it only on a trusted local network, turn it off after testing, never map it to the public Internet for convenience, and do not share the token with people who do not need device access.

## Connect through LemonMCP

The current access token is a six-digit string and may contain leading zeroes. A normal service restart reuses the saved token; explicit token refresh invalidates the old one immediately. Update local MCP configuration and restart the MCP process. The current public server has no token input dialog. Follow the [first-use guide](../AI_GUIDE.md).
