> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# Replay

Replay stores an editable HTTP request and executes it again later. It is useful for reproducing an API issue, comparing responses after changing one input, or verifying a Rewrite or Hosts configuration.

## Replay versus repeating an action in the app

Repeating an app action also depends on UI state, sessions, timing, and other requests. Replay executes only the saved request, which makes an experiment easier to reproduce. It can also bypass the app's normal workflow, so it is not automatically equivalent to a complete user action.

## Create a replay

You can start with a blank replay or use a known request as a reference. The editor contains:

| Field | Meaning |
| --- | --- |
| Name | A label that explains the experiment |
| URL | The complete target URL with a valid host |
| Headers | Required headers; remove unnecessary credentials or tracking fields |
| Method | The HTTP method |
| Request Body | The body sent with the request |

Review the relationship between URL, method, body, and Content-Type before saving. For example, GET commonly has no body, while a JSON POST usually needs a matching Content-Type header.

## Execute and interpret the result

The play button executes a saved request, and a running execution can be cancelled. The list keeps the latest status code, while the detail view can show a response preview. Saving, executing, and receiving a successful business result are different events.

Use a one-variable-at-a-time workflow:

1. Save and run the original request; record the status and important response fields.
2. Change one header, parameter, or body field.
3. Run it again and compare the response.
4. Record the environment and conclusion outside the request if the experiment matters.

## Good use cases

- Verify server behavior for boundary values.
- Compare responses for different authorization, headers, or bodies.
- Confirm that a Rewrite rule changes the intended request.
- Reproduce an intermittent request with fewer manual variables.

## Risk and cleanup

Replay is a real network request, not an offline preview. It can create data, change state, trigger payments, or send notifications. Before executing, confirm:

- the URL points to a test environment or the production impact is understood;
- cookies, authorization, idempotency keys, and timestamps are still valid;
- the request cannot create an irreversible side effect;
- replay items containing tokens, personal data, or sensitive bodies are deleted when no longer needed.

Short-lived signatures, nonces, and sessions can make a saved replay fail later. That means the request context changed; it does not necessarily mean the replay feature failed.

## Replay Workspace and MCP scope

The current App additionally provides suite-based Replay Workspace execution, run history, and step results. Current public replay tools cover individual requests and do not expose suite/run APIs. execute_replay_item is not a Workspace suite run. See the [tool inventory](../reference/tools.md) and [compatibility](../reference/compatibility.md).
