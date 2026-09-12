const assert = require("node:assert/strict");
const test = require("node:test");

const { formatTextFileContent, isTextFilePath } = require("../build/fileContent.js");

test("JSON device files are formatted as JSON instead of object coercion", () => {
  const result = formatTextFileContent(
    "[File Content for Config/lemoncore.json]",
    '{"schema":2,"nested":{"enabled":true}}',
  );

  assert.equal(result, [
    "[File Content for Config/lemoncore.json]:",
    "{",
    '  "schema": 2,',
    '  "nested": {',
    '    "enabled": true',
    "  }",
    "}",
  ].join("\n"));
  assert.equal(result.includes("[object Object]"), false);
});

test("text path detection leaves binary payloads on the byte-safe path", () => {
  assert.equal(isTextFilePath("Config/lemoncore.json"), true);
  assert.equal(isTextFilePath("Logs/lemoncore.log"), true);
  assert.equal(isTextFilePath("Bodies/1234_resp.bin"), false);
});
