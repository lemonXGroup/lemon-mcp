> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

# AI Assistant

AI Assistant is Lemon's entry point for AI integrations. It is not a replacement for Console; it lets a supported AI client use LemonMCP or another supported connection to read state, analyze traffic, and perform controlled debugging actions with the user's authorization.

## What it is good for

- Build a factual picture from request lists and request details.
- Relate status codes, headers, bodies, DNS, and runtime state.
- Create or update Rewrite, Replay, scheduled script, or module configuration after the target and impact are confirmed.
- Check that Remote Control is running and that a change has reached the device runtime.

An AI suggestion is not automatic authorization. Before replaying a request, executing SQL, clearing data, changing DNS, starting or stopping VPN, publishing a script, or installing a module, state the target, scope, and possible side effects.

## Connect LemonMCP

LemonMCP uses Web Control to connect to a real iPhone running Lemon. Before starting:

1. Start Remote Controller in Lemon and obtain its URL and token.
2. Configure the connection in the AI client according to the LemonMCP installation instructions.
3. Ask the AI to read device status and environment first, confirming the correct device.
4. Only then request read-only diagnosis such as searching traffic or opening a detail.

A successful connection does not mean every write capability is allowed, nor that a saved configuration has already been loaded by Packet Tunnel runtime. After each change, check persistence, runtime state, and the final request behavior separately.

## A useful debugging prompt

You can give an AI a task with this structure:

```text
First inspect device status and current traffic read-only.
Goal: investigate 401 responses from example.test.
Scope: only requests from the last 10 minutes for Host example.test.
Constraints: do not replay or change configuration; summarize evidence and possible causes first.
Done when: report the URL, method, status, key response headers, and next steps.
```

When a write is needed, add explicit authorization describing the target object, fields that may change, whether a real request may be executed, and how to verify and roll back.

## Least privilege

Let the AI read first, analyze second, and write only after explicit authorization. Do not grant unrelated powers such as clearing data, running SQL, installing modules, and replaying requests in one step. Requests, databases, and logs sent to an AI can contain cookies, tokens, and personal data; prefer redacted inputs.

## Understand failures

- Cannot connect: check Remote Controller, LAN reachability, URL, and token.
- Can read status but not traffic: confirm TUN / VPN is running and the target app made a request.
- Configuration saved but behavior is unchanged: check the relevant runtime status, reload capability, and trigger a new request.
- Replay differs: check sessions, timestamps, signatures, cookies, environment, and server side effects.

AI improves understanding and operation speed, but the final conclusion should come from request details, runtime status, and a repeatable device test.
