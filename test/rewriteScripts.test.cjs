const assert = require("node:assert/strict");
const test = require("node:test");

const {
  apiErrorMessage,
  assertApiSuccess,
  buildRewriteScriptPackage,
  defaultRewriteScriptManifest,
} = require("../build/rewriteScripts.js");

test("content shorthand is converted to a restricted one-module ESM package", () => {
  const result = buildRewriteScriptPackage({ content: "export function onResponse() { return {}; }" });

  assert.deepEqual(result.manifest, defaultRewriteScriptManifest());
  assert.deepEqual(result.modules, [
    { module_id: "main.js", source: "export function onResponse() { return {}; }" },
  ]);
});

test("complete package input is preserved and requires manifest/modules together", () => {
  const manifest = defaultRewriteScriptManifest();
  const modules = [{ module_id: "main.js", source: "export function onRequest() { return {}; }" }];
  assert.deepEqual(buildRewriteScriptPackage({ manifest, modules }), { manifest, modules });
  assert.throws(
    () => buildRewriteScriptPackage({ manifest }),
    /manifest and modules must be provided together/,
  );
  assert.throws(
    () => buildRewriteScriptPackage({ content: "export function onRequest() {}", modules }),
    /content cannot be combined/,
  );
});

test("iOS success false responses are surfaced as errors", () => {
  assert.deepEqual(assertApiSuccess({ success: true, id: 7 }), { success: true, id: 7 });
  assert.throws(() => assertApiSuccess({ success: false, err_msg: "invalid module allowlist" }), /invalid module allowlist/);
});

test("HTTP response diagnostics prefer iOS error text", () => {
  assert.equal(
    apiErrorMessage({ response: { data: { err_msg: "manifest is invalid" } }, message: "Request failed" }),
    "manifest is invalid",
  );
  assert.equal(apiErrorMessage(new Error("network down")), "network down");
});
