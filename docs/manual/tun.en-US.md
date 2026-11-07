> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# TUN

TUN is the virtual network interface through which Lemon receives device traffic. Lemon's Packet Tunnel routes traffic into its TCP/IP processing path, where Requests, DNS, MITM, Rewrite, and other debugging features can inspect it.

## What TUN does

TUN answers how traffic enters Lemon. It is not a request editor and not only a statistics page. Without a working TUN / VPN path, other features may have no new requests or DNS transactions to display.

## Runtime information

The TUN page can show:

- Packet Tunnel real-time memory usage.
- The virtual interface IPv4 address, netmask, and MTU.
- The currently effective DNS resolver count, transport, and fallback policy.
- Whether the real-time memory floating window is enabled.

These values help confirm that the runtime is active and that configuration was applied. The interface address and MTU are diagnostic values; do not change network settings without a clear plan.

## Startup checklist

Before capturing traffic:

1. Open TUN and confirm the tunnel is running normally.
2. Check whether the effective DNS policy matches the test.
3. Return to Requests and trigger a fresh action in the target app.
4. If nothing appears, validate the path with a known ordinary HTTP / HTTPS request.
5. Enable MITM, Rewrite, or Hosts one at a time so the cause of a change stays clear.

## When traffic is missing

Check whether the target app bypasses the system path, whether another VPN or network extension owns the route, and whether the app actually made a request. For HTTPS, receiving a connection does not mean certificate trust is complete. DNS visibility also depends on resolver configuration and caching.

## Resource and security notes

Capture storage, body buffering, Rewrite, and scripts all add work to Packet Tunnel. Watch memory during large-body or high-volume tests and clear unrelated records. Turn off TUN / VPN after testing so temporary proxy, Hosts, or Rewrite configuration does not affect normal device traffic.
