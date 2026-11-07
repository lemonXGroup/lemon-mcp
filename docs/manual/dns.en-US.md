> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# DNS

DNS puts resolver history and custom Hosts mappings in one place. You can inspect queries, identify failures or slow resolutions, and temporarily map a domain to a chosen address for integration testing or environment switching.

## Two parts of DNS

### Hosts

Hosts is an active domain mapping. Each entry has a domain, a target address, and an optional note. After saving, the mapping is written to Lemon's DNS configuration and used by the runtime for later queries. Duplicate domains are rejected; after editing or deleting a mapping, trigger a fresh query to observe the new result.

### DNS Query History

History records actual DNS transactions, including the action, resolver, duration, CNAME chain, and failure indicators. The history view supports search and filters such as All, Attention, FakeDNS, and CNAME.

## Add a Hosts mapping

1. Open DNS settings and enter **Custom Hosts**.
2. Create a mapping with a domain and target address; do not include a scheme or path in the domain.
3. Confirm that the target is a valid address format supported by the current version.
4. Save and wait for the configuration to apply.
5. Trigger a new request in the target app and inspect the history for the actual action.

A Hosts mapping affects resolution for the matching domain. It does not change the HTTP URL and does not replace an already established connection. Cached results and long-lived connections may need to expire or be recreated.

## Read query history

A transaction can answer questions such as:

- Which result was returned for the domain?
- Which resolver and transport were used?
- Did Hosts, FakeDNS, or a blocking action apply?
- How many CNAME hops occurred?
- Was there fallback, an error, or an unusually long duration?

Compare several transactions for the same domain instead of drawing a conclusion from one query. A failure can come from the network, the upstream resolver, a Hosts entry, or the domain itself.

## Common actions

| Result | Meaning |
| --- | --- |
| Pass-through | Continue through the normal resolution path |
| Hosts | Use a custom Hosts mapping |
| Blocked by Hosts / Rejected | Blocked by a Hosts or rejection policy |
| FakeDNS | Return a virtual result for the debugging path |
| Fallback | Use a backup method after the preferred method failed |

## Troubleshooting

When a request reaches the wrong server, check the domain spelling first, then look for a new DNS transaction and its actual result. If a saved mapping has no new history entry, connection reuse or caching may be involved. If a query exists but the result is wrong, check the target address, mapping state, and whether the current TUN / VPN has loaded the new configuration.

DNS changes real device behavior. Delete or disable temporary mappings after integration work so later requests are not redirected to a test address.
