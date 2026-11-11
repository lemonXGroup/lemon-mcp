const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const { ApiClient, lemonApi } = require("../build/apiClient.js");
const { registerTools } = require("../build/tools.js");
const { listDeviceFiles, registerDeviceFileTools, deviceFileErrorMessage, maximumMockFileBytes, selectMockFile, createMockFile } = require("../build/deviceFiles.js");

async function serving(t, handler) {
  const server = http.createServer((request, response) => {
    if (request.url === "/api/mcp/ping") { response.end("{}"); return; }
    handler(request, response);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server.address().port;
}

test("directory listing preserves source order and slices only MCP output", async () => {
  const entries = [
    { name: "nested", path: "UserFiles/nested", isDirectory: true, size: 0, formattedSize: "0 B" },
    { name: "a.txt", path: "UserFiles/a.txt", isDirectory: false, size: 4 },
    { name: "b.txt", path: "UserFiles/b.txt", isDirectory: false, size: 5 },
  ];
  let call;
  const api = { get: async (...args) => { call = args; return entries; } };
  const result = await listDeviceFiles(api, { path: "UserFiles", offset: 1, limit: 1 });
  assert.equal(call[0], "/api/files");
  assert.deepEqual(call[1], { path: "UserFiles" });
  assert.equal(call[2].maxRedirects, 0);
  assert.equal(call[2].proxy, false);
  assert.deepEqual(result.items, [entries[1]]);
  assert.equal(result.total, 3);
  assert.equal(result.has_more, true);
  assert.equal(result.next_offset, 2);
  assert.equal(result.pagination, "mcp_slice_of_one_directory");
  assert.equal((await listDeviceFiles(api, { path: "UserFiles", offset: 20 })).items.length, 0);
});

test("MockFiles metadata supplies an existing phone file reference without reading its content", async () => {
  let requests = 0;
  const entries = [
    { name: "sample.json", path: "MockFiles/sample.json", isDirectory: false, size: maximumMockFileBytes },
    { name: "large.txt", path: "MockFiles/large.txt", isDirectory: false, size: maximumMockFileBytes + 1 },
    { name: "folder", path: "MockFiles/folder", isDirectory: true, size: 0 },
  ];
  const api = { get: async (url) => { requests++; assert.equal(url, "/api/files"); return entries; } };
  const result = await listDeviceFiles(api, { path: "MockFiles" });
  assert.equal(requests, 1);
  assert.equal(result.maximum_mock_file_bytes, 2 * 1024 * 1024);
  assert.equal(result.items[0].mock_file.candidate, true);
  assert.equal(result.items[0].mock_file.maximum_bytes, maximumMockFileBytes);
  assert.match(result.items[0].mock_file.content_validation, /not_read/);
  assert.deepEqual(JSON.parse(result.items[0].mock_file.config), {
    content_type: "application/json", file_path: "MockFiles/sample.json",
  });
  assert.equal(result.items[1].mock_file.candidate, false);
  assert.equal("config" in result.items[1].mock_file, false);
  assert.match(result.items[1].mock_file.reason, /2 MiB/);
  assert.equal(result.items[2].mock_file.candidate, false);
});

test("enumerated phone reference stays a mock_file action through the registered rewrite tool", async t => {
  const originalGet = lemonApi.get;
  const originalPost = lemonApi.post;
  t.after(() => { lemonApi.get = originalGet; lemonApi.post = originalPost; });
  const calls = [];
  lemonApi.get = async (url, params) => {
    calls.push(["get", url, params]);
    assert.equal(url, "/api/files");
    return [{ name: "phone.json", path: "MockFiles/phone.json", isDirectory: false, size: 64 }];
  };
  lemonApi.post = async (url, body) => {
    calls.push(["post", url, body]);
    return { success: true, id: 123 };
  };
  const registered = new Map();
  registerTools({ registerTool: (name, options, handler) => registered.set(name, { options, handler }) });
  assert.equal(registered.has("upload_device_file"), false);
  const listing = await registered.get("list_device_files").handler({ path: "MockFiles" });
  const selected = JSON.parse(listing.content[0].text).items[0];
  const action = { enabled: true, order: 0, scope: selected.mock_file.scope,
    action: selected.mock_file.action, config: selected.mock_file.config };
  const groups = [{ group_key: "a0287fd2-24b0-4f87-a11e-c59c16338cac", order: 0, enabled: true,
    allows_match_all: false, match_mode: "default", match_expression: "",
    conditions: [{ field: "host", op: "eq", value: "mock-file.test.invalid" }], actions: [action] }];
  const saved = await registered.get("upsert_rewrite_rule").handler({
    rule_json: JSON.stringify({ name: "Existing phone mock", enabled: false, priority: 0 }),
    groups_json: JSON.stringify(groups),
  });
  assert.notEqual(saved.isError, true);
  assert.deepEqual(calls.map(call => call[0] + " " + call[1]), ["get /api/files", "post /api/rewrite"]);
  const sent = calls[1][2].groups[0].actions[0];
  assert.equal(sent.action, "mock_file");
  assert.equal(sent.scope, "response");
  assert.equal(sent.config, selected.mock_file.config);
  assert.equal(JSON.parse(sent.config).file_path, "MockFiles/phone.json");
  assert.equal("local_path" in registered.get("list_device_files").options.inputSchema, false);
});

test("listing rejects traversal, encoded paths, URLs, invalid pages and malformed device metadata", async () => {
  let requests = 0;
  const api = { get: async () => { requests++; return []; } };
  for (const value of ["../Logs", "MockFiles/../Logs", "MockFiles%2f..", "/Logs", "https://example.com", "a\\b", "a//b", "a\0b"]) {
    await assert.rejects(listDeviceFiles(api, { path: value }), /App Group-relative/);
  }
  await assert.rejects(listDeviceFiles(api, { limit: 1001 }), /limit/);
  await assert.rejects(listDeviceFiles(api, { offset: -1 }), /offset/);
  assert.equal(requests, 0);
  for (const response of [{ success: false }, [null], [{ name: "x", path: "x", isDirectory: false, size: -1 }]]) {
    await assert.rejects(listDeviceFiles({ get: async () => response }, {}), /invalid file listing/);
  }
  await assert.rejects(listDeviceFiles({ get: async () => [
    { name: "wrong.json", path: "Other/wrong.json", isDirectory: false, size: 1 },
  ] }, { path: "MockFiles" }), /outside the requested directory/);
});

test("directory read is authenticated and rejects a redirect without sending the token onward", async t => {
  let leakedRequests = 0;
  const destination = await serving(t, (_request, response) => { leakedRequests++; response.end("[]"); });
  let receivedToken;
  const source = await serving(t, (request, response) => {
    receivedToken = request.headers["x-lemon-webcontrol-token"];
    response.writeHead(307, { location: "http://127.0.0.1:" + destination + "/collect" });
    response.end();
  });
  const api = new ApiClient("127.0.0.1", source, "synthetic-never-forward-token");
  await assert.rejects(listDeviceFiles(api, {}), error => error.response?.status === 307);
  assert.equal(receivedToken, "synthetic-never-forward-token");
  assert.equal(leakedRequests, 0);
});

test("file listing registration is read-only and failure messages omit Axios credentials", async () => {
  const registered = new Map();
  registerDeviceFileTools({ registerTool: (name, options, handler) => registered.set(name, { options, handler }) }, {});
  assert.deepEqual([...registered.keys()], ["list_device_files", "select_mock_file", "create_mock_file"]);
  for (const name of ["select_mock_file", "create_mock_file"]) {
    assert.equal(registered.get(name).options.annotations.readOnlyHint, false);
    assert.equal(registered.get(name).options.annotations.destructiveHint, false);
    assert.equal("local_path" in registered.get(name).options.inputSchema, false);
  }
  const listing = registered.get("list_device_files");
  assert.equal(listing.options.inputSchema.path.parse(undefined), "");
  assert.equal(listing.options.annotations.readOnlyHint, true);
  const result = await listing.handler({ path: "../not-allowed" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /App Group-relative/);
  assert.equal(listing.options.inputSchema.limit.safeParse(1001).success, false);
  const message = deviceFileErrorMessage({
    message: "synthetic-never-print", response: { status: 401, data: { err_msg: "synthetic-never-print" } },
    config: { headers: { "X-Lemon-WebControl-Token": "synthetic-never-print" } },
  });
  assert.match(message, /401/);
  assert.equal(message.includes("synthetic-never-print"), false);
});

const mockCapabilities = { mock_files: { version: 1, create: true, import_app_group: true, maximum_bytes: maximumMockFileBytes } };
function mockReference(overrides = {}) {
  return { success: true, file_path: "MockFiles/device-generated.json", path: "MockFiles/device-generated.json",
    name: "device-generated.json", filename: "mock.json", size: 2, content_type: "application/json", reused: false,
    config: { file_path: "MockFiles/device-generated.json", content_type: "application/json" }, ...overrides };
}

test("phone selection validates capability and returns only a managed mock_file reference", async () => {
  const calls = [];
  const api = {
    get: async (...args) => { calls.push(["get", ...args]); return mockCapabilities; },
    post: async (...args) => { calls.push(["post", ...args]); return mockReference(); },
  };
  const result = await selectMockFile(api, { path: "UserFiles/response.json", content_type: "application/json" });
  assert.deepEqual(calls.map(call => [call[0], call[1]]), [["get", "/api/rewrite/capabilities"], ["post", "/api/rewrite/mock-files/import"]]);
  assert.deepEqual(calls[1][2], { path: "UserFiles/response.json", content_type: "application/json" });
  assert.deepEqual(calls[1][4], { maxRedirects: 0, maxContentLength: 65536, maxBodyLength: 16384, proxy: false });
  assert.equal(result.action, "mock_file");
  assert.deepEqual(JSON.parse(result.config), { file_path: "MockFiles/device-generated.json", content_type: "application/json" });
  assert.equal("content" in result, false);
  assert.equal("local_path" in result, false);
  const reused = await selectMockFile({ ...api, post: async () => mockReference({ reused: true }) }, { path: "MockFiles/device-generated.json" });
  assert.equal(reused.reused, true);
});

test("new phone files support blank content, exact UTF-8 budget and independent generated references", async () => {
  const bodies = [];
  const api = { get: async () => mockCapabilities, post: async (url, body, params, policy) => {
    assert.equal(url, "/api/rewrite/mock-files"); assert.equal(params, undefined);
    assert.equal(policy.maxRedirects, 0); assert.equal(policy.proxy, false);
    assert.equal(policy.maxBodyLength, maximumMockFileBytes * 6 + 16 * 1024);
    bodies.push(body); return mockReference({ size: Buffer.byteLength(body.content), filename: body.filename });
  } };
  const blank = await createMockFile(api, {});
  assert.deepEqual(bodies[0], { content: "", filename: "mock.json" });
  assert.equal(blank.size, 0);
  const exact = "😀".repeat(maximumMockFileBytes / 4);
  const result = await createMockFile(api, { content: exact, filename: "new.json" });
  assert.equal(result.size, maximumMockFileBytes);
  assert.equal(result.reused, false);
  assert.equal("content" in result, false);
  const previousCalls = bodies.length;
  await assert.rejects(createMockFile(api, { content: exact + "a" }), /at most 2 MiB/);
  assert.equal(bodies.length, previousCalls);
});

test("unsafe mock inputs and unsupported device capabilities cannot perform a write", async () => {
  let reads = 0; let writes = 0;
  const api = { get: async () => { reads++; return mockCapabilities; }, post: async () => { writes++; return mockReference(); } };
  for (const path of ["", "../x", "/tmp/x", "file:///tmp/x", "a%2fb", "a\\b"]) await assert.rejects(selectMockFile(api, { path }));
  for (const content of ["a\0b", "a\u000bb", "\ud800", "\udc00"]) await assert.rejects(createMockFile(api, { content }), /UTF-8|control/);
  for (const filename of ["../x", "a/b.json", "a\\b.json", "", ".", "..", "é".repeat(128)]) await assert.rejects(createMockFile(api, { filename }), /filename/);
  for (const content_type of ["", "text/plain\r\nInjected: yes", "text/\0plain"]) {
    await assert.rejects(createMockFile(api, { content_type }), /MIME/);
    await assert.rejects(selectMockFile(api, { path: "ok.txt", content_type }), /MIME/);
  }
  assert.equal(reads, 0); assert.equal(writes, 0);
  for (const capabilities of [{}, { mock_files: {} }, { mock_files: { ...mockCapabilities.mock_files, create: false, import_app_group: false } },
    { mock_files: { ...mockCapabilities.mock_files, version: 0 } }, { mock_files: { ...mockCapabilities.mock_files, maximum_bytes: 100 } }]) {
    const old = { get: async () => capabilities, post: api.post };
    await assert.rejects(createMockFile(old, {}), /Update Lemon/);
    await assert.rejects(selectMockFile(old, { path: "file.json" }), /Update Lemon/);
  }
  assert.equal(writes, 0);
});

test("malformed or failed phone results never produce an apparently successful config", async () => {
  for (const response of [null, {}, mockReference({ success: false }), mockReference({ file_path: "../other.json" }),
    mockReference({ file_path: "MockFiles/nested/f.json" }), mockReference({ file_path: "MockFiles/%2e.json" }),
    mockReference({ content_type: "text/plain\r\nX: y" }), mockReference({ size: maximumMockFileBytes + 1 }),
    mockReference({ reused: undefined }), mockReference({ name: "wrong.json" })]) {
    const api = { get: async () => mockCapabilities, post: async () => response };
    await assert.rejects(createMockFile(api, {}));
    await assert.rejects(selectMockFile(api, { path: "source.json" }));
  }
});

test("new mock file POST is authenticated and never follows a redirect", async t => {
  let leakedRequests = 0; let receivedToken; let receivedBody;
  const destination = await serving(t, (_request, response) => { leakedRequests++; response.end("{}"); });
  const source = await serving(t, (request, response) => {
    if (request.url === "/api/rewrite/capabilities") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(mockCapabilities)); return; }
    receivedToken = request.headers["x-lemon-webcontrol-token"];
    const chunks = [];
    request.on("data", value => chunks.push(value));
    request.on("end", () => {
      receivedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(307, { location: "http://127.0.0.1:" + destination + "/collect" }); response.end();
    });
  });
  const api = new ApiClient("127.0.0.1", source, "synthetic-never-forward-token");
  await assert.rejects(createMockFile(api, { content: "{}" }), error => error.response?.status === 307);
  assert.deepEqual(receivedBody, { content: "{}", filename: "mock.json" });
  assert.equal(receivedToken, "synthetic-never-forward-token"); assert.equal(leakedRequests, 0);
});

test("registered select/create keep phone file configs intact when saving a disabled mock rule", async t => {
  const originalGet = lemonApi.get; const originalPost = lemonApi.post;
  t.after(() => { lemonApi.get = originalGet; lemonApi.post = originalPost; });
  const calls = [];
  lemonApi.get = async url => { calls.push(["get", url]); return mockCapabilities; };
  lemonApi.post = async (url, body) => { calls.push(["post", url, body]); return url === "/api/rewrite" ? { success: true, id: 456 } : mockReference(); };
  const registered = new Map(); registerTools({ registerTool: (name, options, handler) => registered.set(name, { options, handler }) });
  for (const [tool, input] of [["select_mock_file", { path: "UserFiles/response.json" }], ["create_mock_file", { content: "{}", filename: "new.json" }]]) {
    const response = await registered.get(tool).handler(input); assert.notEqual(response.isError, true);
    const selected = JSON.parse(response.content[0].text);
    const action = { action: selected.action, scope: selected.scope, config: selected.config, enabled: true, order: 0 };
    const saved = await registered.get("upsert_rewrite_rule").handler({
      rule_json: JSON.stringify({ name: "Phone mock file", enabled: false, priority: 0 }),
      groups_json: JSON.stringify([{ group_key: "a0287fd2-24b0-4f87-a11e-c59c16338cac", order: 0, enabled: true,
        allows_match_all: false, match_mode: "default", match_expression: "", conditions: [{ field: "host", op: "eq", value: "phone-mock.test.invalid" }], actions: [action] }]),
    });
    assert.notEqual(saved.isError, true);
    const sent = calls.at(-1)[2].groups[0].actions[0]; assert.equal(sent.action, "mock_file"); assert.equal(sent.config, selected.config);
    assert.equal(JSON.parse(sent.config).file_path, "MockFiles/device-generated.json");
  }
  assert.deepEqual(calls.map(call => call[0] + " " + call[1]), ["get /api/rewrite/capabilities", "post /api/rewrite/mock-files/import", "post /api/rewrite",
    "get /api/rewrite/capabilities", "post /api/rewrite/mock-files", "post /api/rewrite"]);
});
