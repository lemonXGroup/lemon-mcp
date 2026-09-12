const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { ApiClient, normalizeResponseBytes } = require("../build/apiClient.js");
const { decodeByteContent, formatByteContent } = require("../build/byteContent.js");

async function clientServing(t, payload) {
  const server = http.createServer((request, response) => {
    if (request.url === "/api/mcp/ping") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
      return;
    }

    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(payload);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  return new ApiClient("127.0.0.1", address.port);
}

test("getBytes preserves JSON-shaped UTF-8 content as original text", async (t) => {
  const expectedText = '{"schema":2,"generation":2,"name":"Lemon"}';
  const expectedBytes = Buffer.from(expectedText, "utf8");
  const client = await clientServing(t, expectedBytes);

  const result = await client.getBytes("/api/files/download", {
    path: "Config/lemoncore.json",
  });

  assert.deepEqual(result, expectedBytes);
  assert.deepEqual(decodeByteContent(result), {
    byteLength: expectedBytes.byteLength,
    content: expectedText,
    encoding: "utf-8",
  });
  assert.equal(
    formatByteContent("[File Content for Config/lemoncore.json]", result),
    `[File Content for Config/lemoncore.json]:\n${expectedText}`,
  );
});

test("activity pings carry a stable process session header", async (t) => {
  let pingHeaders;
  let requestHeaders;
  let resolvePing;
  const pingSeen = new Promise((resolve) => {
    resolvePing = resolve;
  });
  const server = http.createServer((request, response) => {
    if (request.url === "/api/mcp/ping") {
      pingHeaders = request.headers;
      resolvePing();
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
      return;
    }

    requestHeaders = request.headers;
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end("ok");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const client = new ApiClient("127.0.0.1", address.port, "test-web-control-token");

  await client.getBytes("/api/files/download");
  await pingSeen;

  assert.match(pingHeaders["x-lemon-mcp-session"], /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
  assert.equal(requestHeaders["x-lemon-webcontrol-token"], "test-web-control-token");
  assert.equal(pingHeaders["x-lemon-webcontrol-token"], "test-web-control-token");
});

test("getBytes base64-encodes non-UTF-8 bytes without data loss", async (t) => {
  const expectedBytes = Buffer.from([0x00, 0xff, 0x80]);
  const client = await clientServing(t, expectedBytes);

  const result = await client.getBytes("/api/body", { path: "binary_resp.bin" });
  const decoded = decodeByteContent(result);

  assert.deepEqual(result, expectedBytes);
  assert.deepEqual(decoded, {
    byteLength: 3,
    content: expectedBytes.toString("base64"),
    encoding: "base64",
  });
  assert.deepEqual(Buffer.from(decoded.content, "base64"), expectedBytes);
  assert.equal(
    formatByteContent("[Full Payload Content for binary_resp.bin]", result),
    `[Full Payload Content for binary_resp.bin] [byteLength=3, encoding=base64]:\n${expectedBytes.toString("base64")}`,
  );
});

test("valid UTF-8 with unsafe control characters uses base64", () => {
  const expectedBytes = Buffer.from("visible\u001b[31m", "utf8");
  const decoded = decodeByteContent(expectedBytes);

  assert.equal(decoded.encoding, "base64");
  assert.equal(decoded.byteLength, expectedBytes.byteLength);
  assert.deepEqual(Buffer.from(decoded.content, "base64"), expectedBytes);
});

test("normalizeResponseBytes handles serialized Buffer and object responses", () => {
  assert.deepEqual(
    normalizeResponseBytes({ type: "Buffer", data: [0x7b, 0x7d] }),
    Buffer.from("{}"),
  );
  assert.deepEqual(
    normalizeResponseBytes({ schema: 2 }),
    Buffer.from('{"schema":2}'),
  );
});
