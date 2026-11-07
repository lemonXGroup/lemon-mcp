# Replay Workspace definitions

Checked against ReplayWorkspaceRouter.swift, ReplaySuite.swift, ReplayItem.swift and ReplayResultSummary.swift on 2026-11-07. Read the [Replay manual](https://raw.githubusercontent.com/lemonXGroup/lemon-mcp/main/docs/manual/replay.en-US.md) for variable, extraction and assertion behavior before constructing a flow. These routes may exist even when the installed MCP has no corresponding tools.

## Full suite JSON

GET /api/replay/suites returns native Codable objects under suites. PUT requires an existing suite; POST saves a full suite. Read/modify the complete object when available, preserving fields. Swift defaults on stored properties do not imply a partial JSON patch is accepted.

The root fields are schemaVersion (currently 1), id (UUID), name, mode (batch, flow, parameters), steps, variables (JSON values), parameterMode (rows or cartesian), parameterSource (string containing JSON data), concurrency, repeatCount, interval, timeout, retries, stopOnFailure, updatedAt. interval and timeout are seconds. Keep loads bounded to the user's requested scope and let the phone validate its current limits.

A step has UUID id, request, optional sourceTransactionID, extractions array and assertions array. Its request is a **native ReplayItem**, using camelCase disabledHeaderNames, lastRun, lastStatus and updatedAt, unlike the separate /api/replay/items payload that uses disabled_headers. Do not substitute a traffic summary or SQL row for a ReplayItem.

Native ReplayItem required fields are id, name, url, method and headers. body, lastRun and lastStatus are optional. disabledHeaderNames and enabled are accepted; updatedAt can be preserved from the returned object. Workspace dates use Swift JSONEncoder's default Date representation: seconds since 2001-01-01, not Unix epoch seconds or ISO strings.

Example complete one-step suite (saving does not execute it; replace example IDs and target appropriately):

~~~json
{
  "schemaVersion": 1,
  "id": "28b12c5f-47e3-466c-9b58-a80ba50df2b3",
  "name": "Example check", "mode": "batch",
  "steps": [{
    "id": "fe427155-0375-412c-9b80-b1de60e9882c",
    "request": {
      "id": "26708617-dcd0-4bea-8141-3ea9214bb503",
      "name": "Example GET", "url": "https://example.com/", "method": "GET",
      "headers": {}, "disabledHeaderNames": [], "body": null, "enabled": true,
      "updatedAt": 0
    },
    "extractions": [], "assertions": []
  }],
  "variables": {}, "parameterMode": "rows", "parameterSource": "[]",
  "concurrency": 1, "repeatCount": 1, "interval": 0, "timeout": 30,
  "retries": 0, "stopOnFailure": true, "updatedAt": 0
}
~~~

Extraction fields: id (UUID), name (destination variable), source (json/header/regex), path. Assertion fields: id (UUID), kind (status/contains/json/duration), path, expected (string). Read manual semantics before populating these; a value with a plausible field name does not establish supported JSON Path or regex behavior.

## Run and inspect

1. POST /api/replay/runs/start with {"id":"<suite UUID>"}; capture run_id. This sends actual requests.
2. GET /api/replay/runs?id=<suite UUID> lists historical runs. Run status is running, succeeded, failed, cancelled or interrupted.
3. GET /api/replay/runs/detail?id=<run UUID>&after=0 returns run, results, counts and has_more. Results are summaries, in pages of 100.
4. Advance after to the last returned summary's **sequence**, not its ordinal, array index, result UUID or timestamp. Continue while has_more, with a bounded polling cadence if the run is still active. A full final page can legitimately require one empty follow-up page.
5. Optional status filter is succeeded, failed, skipped or cancelled (step results, not run status). Use it on the server to cover the whole run, not only loaded pages. Reset the cursor when changing filters.
6. GET /api/replay/runs/result?id=<result UUID> retrieves detailed request/response metadata, checks, errors and body reference. Preserve previewTruncated and bodyFile; do not assume a preview contains the complete response. Native Workspace body files are not automatically interchangeable with HTTP capture /api/body paths; follow an actual returned downloadable relative file path and documented files API.
7. POST /api/replay/runs/cancel uses {"id":"<suite UUID>"}. Read the run state to confirm cancellation; accepted does not imply every in-flight target request was undone.

The Workspace JSON request limit is 8 MiB. Saving/deleting a suite, running and canceling are separate actions. Do not execute a suite just to validate its shape.
