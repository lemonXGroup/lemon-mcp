> Evidence (rewrite matching updated 2026-11-10; other sections reviewed 2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

## What Rewrite does

Rewrite changes a request or response while traffic is passing through Lemon. It is useful for local integration work, API mocking, switching between test environments, adding a temporary debug header, and checking how a client handles an unusual response.

Rewrite changes traffic flowing through Lemon; a rewritten request can still change server-side business state. Before you start, make sure the device traffic is connected to Lemon and that the certificate required for HTTPS inspection is configured correctly.

## Open the Rewrite console

1. Open Lemon's **Console**.
2. Select **Rewrite** to open the rewrite rule list.
3. Use **Enable Rewrite** to turn the rewrite engine on or off globally.
4. Create a rule with the add action. Existing rules can be enabled or disabled from the list.

When the global switch is off, an enabled individual rule will not match traffic. After editing a rule, use **Reload Rewrite** so the engine loads the latest configuration.

## Create a rule

### 1. Choose the processing stage

Choose HTTP request, HTTP response, or one of the two WebSocket message directions:

| Stage | What it handles | Common examples |
| --- | --- | --- |
| Request | Data sent before the server receives it | Change headers/body, or use the applicable redirect/local-response action |
| Response | Data returned by the server | Replace a response body, change response headers, or use a mock file |
| WebSocket client | Complete messages sent to the server after HTTP/1 Upgrade | body_replace or onWebSocketMessage |
| WebSocket server | Complete messages sent to the client after HTTP/1 Upgrade | body_replace or onWebSocketMessage |

The stage affects which match fields and actions make sense. If a saved rule appears to do nothing, check the stage first.

### 2. Add match conditions

Configure the rule's scope in the Match section. Common fields include:

- **Host**: match a domain such as `api.example.com`.
- **Path**: match a URL path such as `/api/v1/profile`.
- **Query**: match the raw query string, for example `packageId=1`.
- **Method**: restrict the rule to methods such as `GET` or `POST`.
- **Match operator**: choose an exact, contains, prefix, suffix, or regular-expression style operation when available for the field.

Default-mode conditions within a group use AND. Enabled groups are evaluated in order without first-match short-circuiting, so several matching groups may execute. Start with Host and Path, then add Query and Method as needed. This keeps a rule from affecting every request under a domain.

Use multiple **Match Groups** when you need to express more than one group of conditions. Conditions inside one group describe a complete match; groups let you represent a broader set of alternatives. Before saving, compare the fields with a real request that you expect to match.

### Query and Host wildcard matching

Query matches the raw query string without its leading `?`, preserving encoding, case and parameter order and excluding the fragment. It supports eq, prefix, suffix, contains and regex and uses AND with Host, Path and Method. For a complete parameter value, use query regex `(^|&)packageId=1(&|$)`; contains `packageId=1` also matches `packageId=10`. Regex `^$` matches no query or an empty query. Full-URL expression mode retains but ignores these default conditions.

Host eq, prefix, suffix and contains support `*` for any length and `?` for one character. A single leading `*.` includes the root domain and all subdomains; no new mode is required. For example, `eq *.example.com` matches `example.com`, `a.example.com` and `a.b.example.com`, while rejecting `badexample.com` and `example.com.evil.test`. `eq api?.example.com` requires exactly one character at the question mark. Only the first leading `*.` has the root-domain exception; internal `*.` keeps a required dot.

Prefix, suffix and contains retain their position semantics: `suffix *.example.com` also matches `badexample.com`. Use `eq *.example.com` for a domain and its subdomains only. Wildcards cannot consume ports, userinfo, paths or queries; regex and other fields keep their own syntax. A star-only Host uses the existing match-all confirmation.

Use an updated device with host_wildcards version 1, root_domain=true and all four operators in /api/rewrite/capabilities. The public MCP checks this before saving; disabling an existing policy remains possible. Existing local wildcard conditions adopt these semantics after upgrading. Shares with host wildcard conditions, including inactive conditions, use version 5; cloud/local backups use version 6. Query conditions keep the existing format and are rejected by older clients that do not recognize the field.

### 3. Choose an action

Choose the action to run after a match. The main action types exposed by the console are:

- **Header modification**: add, change, or remove a request or response header.
- **Body replacement**: replace a request or response body with supplied text.
- **Mock file**: use a local file as response content.
- **Redirect**: send a request to another address.
- **JavaScript action**: use a script for more flexible request or response changes.

Keep the action aligned with the stage. For example, change a request header at the request stage and replace server output at the response stage. Prefer several small rules with clear purposes over one rule that performs unrelated changes.

## Three common scenarios

### Add a test-environment header

Set the stage to request, narrow the match with Host, Path, and Method, then choose Header modification. For example, add a local-only marker:

```text
Header: X-Lemon-Debug
Value: true
```

Do not put real account details, tokens, or production secrets into a shared rule. Disable or remove the rule when the debugging session is over.

### Replace an API response with local data

Set the stage to response, match the target endpoint, and choose Body replacement or Mock file. Keep the JSON valid and preserve the fields the client actually reads:

```json
{
  "code": 0,
  "data": {
    "enabled": true,
    "items": []
  }
}
```

For a Mock file, make sure the file is available in Lemon's shared storage and select the intended file in the rule editor.

### Use JavaScript for conditional changes

JavaScript actions are useful when the change depends on request data. This example follows the current HTTP request-header contract. Both synchronous export function and the App default export async function are supported; consult the [script reference](../reference/script-api.md):

```js
export async function onRequest(ctx) {
  if (!ctx.request.path?.startsWith('/api/v1')) return {};
  return { headers: { 'X-Lemon-Debug': 'true' } };
}
```

Use a native ESM handler and return a valid modification object; do not return request, response, or ctx directly. Host network calls require explicit http permission and await with controlled lemon:http. Do not put sensitive values in log output.

## Save, apply, and verify

Use this order when checking a rule:

1. Save the rule and confirm it appears in the rule list.
2. Confirm the individual rule is enabled and **Enable Rewrite** is on.
3. Use **Reload Rewrite** when needed so the engine reads the latest rule.
4. Send a new request from the client that should match.
5. Compare the request and response details, including headers, URL, body, and status code.

Do not use the rule list alone to decide whether a rule matched. The actual Host, Path, Method, and processing stage determine the result.

## Troubleshooting

Check these items in order:

1. Is Lemon capturing traffic from the target device?
2. Is the request going through HTTPS inspection? Encrypted content cannot be matched or replaced as plain-text body content until it is available for inspection.
3. Are both the global and individual rule switches enabled?
4. Is the stage correct? Check ports, case, path prefixes, and the actual Host and Path values.
5. Are the match operator and Match Group combination stricter or broader than intended?
6. Are all action parameters present? Can the mock file be read? Does the script return the expected result?

Use **Rewrite Debug / Rewrite Events** logs while troubleshooting. Look for rule loading, match decisions, and action errors. Turn verbose logging back down after the session to keep normal operation focused.

## Rule scope and safety

Broad rules are more likely to affect unrelated traffic. Keep these practices in mind:

- Use an explicit Host, Path, and Method instead of matching an entire domain without a reason.
- Keep temporary rules disabled until you are ready to test them.
- When several rules match, use the logs to confirm execution order before splitting or narrowing rules.
- Check for local paths, account data, or sensitive headers before deleting or sharing a rule.
- Protected rules, DRM content, or subscription capabilities may be limited by the app version and authorization state; ordinary rewrite rules cannot be used to bypass those limits.

Rewrite is a local debugging tool. Use it only with applications and services you are authorized to test, and follow their terms and applicable law.

## Exact contracts and newer features

See the [rule reference](../reference/rewrite-rules.md) for MatchGroups, expressions, JSON Path, multipart, WebSocket scopes, and MCP CRUD. Use the [script API](../reference/script-api.md) for handlers, context, and result shapes, and [compatibility](../reference/compatibility.md) for public MCP gaps.
