> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# LAN Proxy

LAN Proxy exposes Lemon's HTTP proxy on the device's local network address so another device on the same Wi-Fi can use Lemon as its proxy. It is useful for testing a device that does not run Lemon or for sharing the current capture, MITM, and Rewrite path with an external test device.

## Before enabling it

Make sure the Lemon device and the test device are on the same local network and that peer-to-peer access is allowed. In **LAN Proxy**, enable the service and note the displayed Server IP and HTTP Proxy Port.

The port can be changed, but it must be valid. Stop the service before changing a port so clients do not continue using a stale address.

## Configure another device

On iOS, for example:

1. Enable LAN Proxy in Lemon and note the Server IP and port.
2. Open the current Wi-Fi network's HTTP Proxy settings on the other device.
3. Select manual configuration and enter Lemon's IP and port.
4. Save the setting, visit a test URL, and confirm the request in Lemon.

If Basic Authentication is enabled, enter the same username and password on the client. Do not expose the proxy to an untrusted network: other devices on the network may be able to access or observe data passing through Lemon.

## Verify and troubleshoot

| Symptom | Check |
| --- | --- |
| Client cannot connect | Same network, current IP, firewall, and network isolation |
| Connects but no requests appear | Whether only HTTP was configured, whether traffic is HTTPS, and whether another VPN is active |
| HTTPS body is unreadable | Whether the test device trusts Lemon CA or the target app pins certificates |
| Authentication fails | Complete credentials and whether the client retained an old password |

LAN Proxy does not replace connections that already exist. After changing the port, authentication, or certificate, reconnect Wi-Fi or restart the target app so the new settings are actually used.

## Finish the test

Turn LAN Proxy off after external-device testing, restore the other device's proxy setting, and remove certificates, Hosts, or Rewrite rules that are no longer needed. Stopping the service does not undo a CA or proxy setting already installed on another device.
