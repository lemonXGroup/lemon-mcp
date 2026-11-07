> Evidence (2026-11-07): Adapted from the existing user manual with identified differences corrected; not every UI step or runtime path has been verified. See [provenance and limits](../verification.md).

> This manual ships with LemonMCP. Start with the [AI guide](../AI_GUIDE.md); use the [rule reference](../reference/rewrite-rules.md), [script API](../reference/script-api.md), and [compatibility notes](../reference/compatibility.md) for exact contracts.

## 00 Lemon Overview

Lemon is a local network debugging tool for a real iPhone. It brings traffic capture, request inspection, HTTPS inspection, request rewriting, replay, DNS debugging, automation scripts, and installable modules into one Console. It is designed for diagnosing client networking problems, creating reproducible test conditions, and verifying behavior under different network environments.

The core workflow is:

```text
Connect a real device -> capture traffic -> locate the problem -> choose a debugging method -> verify the result -> clean up
```

## What Lemon can do

Different problems call for different tools. Decide whether you need to observe, modify, repeat, or automate a scenario before choosing an entry point.

| Feature | Main purpose | Typical use |
| --- | --- | --- |
| Requests | Capture, search, filter, and inspect HTTP / HTTPS requests | Locate endpoints, status codes, headers, bodies, and timing issues |
| MITM | Inspect HTTPS content after trusted certificate setup | Read decrypted request URLs, headers, and bodies |
| Rewrite | Modify traffic as requests or responses pass through Lemon | Mock APIs, switch environments, inject debug headers, or replace responses |
| Replay | Save a request and execute it again | Reproduce an API issue and compare responses before and after a change |
| DNS | Inspect DNS queries and manage host mappings | Verify resolution or temporarily point a domain at a test or local address |
| TUN | Bring device TCP/IP traffic into Lemon | Capture and inspect traffic from the device |
| Scripts | Run restricted JavaScript on a schedule or Rewrite stage | Periodic checks, automation, and request / response transformations |
| Modules | Install local extensions with their own interfaces | Turn a repeated debugging workflow into a reusable tool |
| Files | Browse, edit, and share files in shared storage | Manage mock data, script resources, and debugging artifacts |
| Database | Browse and manage Lemon's local SQLite databases | Diagnose persistent state and related debug records |
| LAN Proxy | Share Lemon's proxy with devices on the local network | Debug another device that is not running Lemon directly |
| Remote Control | Expose a browser-accessible control endpoint | Operate Lemon from a Mac or another controlled client |
| AI Assistant | Connect supported AI integrations | Assist with request analysis, logs, and debugging workflows |

These features are different stages of one debugging workflow rather than isolated screens. For example, find an endpoint in **Requests**, replace its response with **Rewrite**, and then use **Replay** to verify how the client handles the result.

## A typical debugging workflow

### 1. Connect and check the device

Lemon targets a real iPhone running Lemon. Before starting, confirm that the device is connected, its traffic path is attached to Lemon, and the VPN / TUN, WebControl, and related runtime states are healthy. An empty list without device traffic does not necessarily indicate a feature failure.

### 2. Configure HTTPS inspection

To inspect HTTPS request or response content, configure a trusted certificate and confirm that the target app accepts it. Certificate setup, certificate pinning, and traffic that remains encrypted all affect what Lemon can display. When a body is unavailable, do not immediately conclude that the server returned no data.

### 3. Capture and narrow the scope

Use domain, path, method, or status filters in **Requests**, then open a single request. Record its timestamp, URL, headers, response status, body readability, and any redirect, compression, or decoding state before making a change.

### 4. Choose the smallest debugging action

- To observe only: use request details, logs, and database information.
- To change one local case: use a Rewrite rule.
- To execute the same request again: save it and use Replay.
- To change name resolution: use DNS / Hosts.
- To run logic repeatedly: use Scripts.
- To package a complete local tool: use Modules.

Change one variable at a time when possible. Specific rules, minimal permissions, and small change scopes make results easier to explain and roll back.

### 5. Verify and clean up

Trigger the same client scenario again and compare the actual request and response changes. When the investigation is complete, disable temporary Rewrite rules, host mappings, VPN settings, or debug scripts, and remove captures or sensitive data that are no longer needed.

## Console, User Manual, and Lemon MCP

### Console: operate Lemon directly

The Console is Lemon's primary interface for browsing lists, editing rules, reading details, and checking runtime state. Use it when you need to inspect one request precisely or adjust configuration manually.

### User Manual: understand configuration and diagnosis

The manual is organized around these capabilities:

- [Lemon_MCP](lemon-mcp.en-US.md): connect an AI to the real device through MCP and perform controlled debugging operations.
- [Scripts](scripts.en-US.md): scheduled tasks, single scripts, script packages, and Rewrite scripts.
- [Rewrite](rewrite.en-US.md): request / response matching, actions, and troubleshooting.
- [Modules](modules.en-US.md): module authoring, the `lemon-module` tool, and package import.
- [Requests](requests.en-US.md): search, filter, and inspect HTTP / HTTPS traffic.
- [MITM](mitm.en-US.md): configure certificates and inspect HTTPS content.
- [Replay](replay.en-US.md): save, edit, and execute requests again.
- [DNS](dns.en-US.md): inspect resolver history and manage Hosts mappings.
- [TUN](tun.en-US.md): understand how device traffic enters Lemon.
- [Regex](regex.en-US.md): validate patterns before using them in real rules.
- [Files](files.en-US.md): manage debugging resources in shared storage.
- [Database](database.en-US.md): diagnose local SQLite storage and table data.
- [LAN Proxy](lan-proxy.en-US.md): let other devices on the local network use Lemon Proxy.
- [Remote Control](remote-control.en-US.md): connect to Lemon through Web Control.
- [AI Assistant](ai-helper.en-US.md): let an AI assist analysis and debugging within an authorized scope.

### Lemon MCP: let an AI participate in debugging

Lemon MCP is an MCP service for AI agents. It discovers devices, calls Lemon's remote control interface, formats results, and manages selected automation resources. Network parsing, TLS handling, and captured data remain on the iPhone running Lemon.

MCP is useful for turning several Console operations into a reviewable diagnostic playbook: read device state, search for a request, fetch its body, correlate logs, verify Rewrite runtime state, and perform a replay only after user authorization. An MCP response that says a request was accepted does not prove that runtime state has loaded or that the client has completed verification; confirm persistence, runtime state, and final request behavior separately for write operations.

## How the features work together

### Observe: Requests, DNS, logs, and databases

Start with the request list and detail view, then use DNS, logs, or database records for context. A list preview is useful for locating a candidate; details and raw bodies are needed to confirm it. Do not base a conclusion on one preview or one status field alone.

### Modify: MITM, Rewrite, and Hosts

MITM answers whether HTTPS content can be seen, Rewrite changes content as it passes through Lemon, and host mappings change where a domain resolves. These operate at different layers, so first confirm that the target traffic actually passed through the layer being investigated.

### Reproduce: Replay and Scripts

Replay is suited to executing a saved request once more. Scripts are suited to repeating logic on a schedule or at a Rewrite stage. Scripts run in a restricted environment; they are not Node.js programs and cannot assume arbitrary filesystem access, npm packages, or unrestricted network access. Use the Scripts chapter and the current iOS validator as the source of truth for entrypoints and permissions.

### Extend: Modules

Modules package several operations into a local tool with an interface. A module can contain declarative UI, Core ESM logic, locale resources, and controlled capabilities, but Lemon's iOS host still loads and runs it. Use the public [`lemon-module`](https://github.com/lemonXGroup/lemon-module) tool to initialize, validate, test, and pack modules.

## Security and data boundaries

- Lemon primarily handles local debugging data from the user's device. Captured bodies, cookies, authorization headers, tokens, and database records may be sensitive.
- Review the source, capabilities, target addresses, and logging behavior before installing a third-party module, importing a script package, or enabling an AI connection.
- Replay sends a request to the target service again and may have real side effects. Confirm the request, environment, and authorization first.
- Treat raw SQL, capture deletion, log clearing, DNS changes, rule publishing, and module enablement as impactful operations.
- Before sharing diagnostics, remove device addresses, account data, tokens, cookies, request bodies, and local filesystem paths.

## Choosing an entry point

| Goal | Recommended entry |
| --- | --- |
| Check whether the device is working | Console runtime, TUN / VPN state, and environment information |
| Find a particular endpoint | Request search and filters |
| Temporarily replace an API response | Rewrite |
| Execute a request again | Replay |
| Run diagnostic logic on a schedule | Scripts |
| Build a UI-based debugging tool | Modules and `lemon-module` |
| Ask an AI to assist with a real device | Lemon MCP |
| Learn one capability in depth | The relevant manual chapter and its Markdown source |

When you are unsure where to start, check the device first, establish a small set of facts from Requests, and then choose the smallest modification or automation step. This reduces false conclusions and gives you a verified point to return to when something changes.
