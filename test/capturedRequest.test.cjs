const assert = require("node:assert/strict");
const test = require("node:test");

const {
  describeCapturedBody,
  normalizeCapturedRequest,
} = require("../build/capturedRequest.js");

test("captured body metadata distinguishes missing, empty, text, binary, and structured values", () => {
  assert.deepEqual(describeCapturedBody(null, null), {
    state: "missing",
    path: null,
    byteLength: null,
  });
  assert.deepEqual(describeCapturedBody("", null), {
    state: "empty",
    path: null,
    byteLength: 0,
  });
  assert.deepEqual(describeCapturedBody("中文", null), {
    state: "text",
    path: null,
    byteLength: Buffer.byteLength("中文", "utf8"),
  });
  assert.deepEqual(describeCapturedBody(null, "Bodies/response.bin"), {
    state: "binary_ref",
    path: "Bodies/response.bin",
    byteLength: null,
  });
  assert.deepEqual(describeCapturedBody({ value: true }, null), {
    state: "structured",
    path: null,
    byteLength: null,
  });
});

test("normalizeCapturedRequest preserves the raw item while adding both body metadata fields", () => {
  const item = {
    trace_id: "trace-1",
    requestBody: "payload",
    responseBody: null,
    responseBodyPath: "Bodies/response.bin",
  };
  const result = normalizeCapturedRequest({ item });

  assert.equal(result.trace_id, "trace-1");
  assert.equal(result.requestBody, "payload");
  assert.deepEqual(result.requestBodyMeta, {
    state: "text",
    path: null,
    byteLength: Buffer.byteLength("payload", "utf8"),
  });
  assert.deepEqual(result.responseBodyMeta, {
    state: "binary_ref",
    path: "Bodies/response.bin",
    byteLength: null,
  });
});

test("normalizeCapturedRequest rejects malformed observation responses", () => {
  assert.throws(() => normalizeCapturedRequest(null), /not an object/);
  assert.throws(() => normalizeCapturedRequest({}), /does not contain an item/);
  assert.throws(() => normalizeCapturedRequest({ item: [] }), /does not contain an item/);
});
