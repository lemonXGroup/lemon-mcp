const assert = require("node:assert/strict");
const test = require("node:test");
const { lemonApi } = require("../build/apiClient.js");
const { registerTools } = require("../build/tools.js");

function fixture(t) {
  const originals = { get: lemonApi.get, post: lemonApi.post, put: lemonApi.put, delete: lemonApi.delete };
  t.after(() => Object.assign(lemonApi, originals));
  const calls = [];
  for (const method of Object.keys(originals)) lemonApi[method] = async (url, body) => { calls.push({ method, url, body }); return { success: true }; };
  const tools = new Map();
  registerTools({ registerTool: (name, options, handler) => tools.set(name, { options, handler }) });
  return { tools, calls };
}
const exactID = "8448911919725463553";
function updateInput(id, overrides = {}) {
  return { rule_json: JSON.stringify({ id, name: "Phone Mock ID fixture", enabled: false, priority: 0, ...overrides }), groups_json: "[]" };
}
const invalidIDs = [0, -1, 1.5, true, null, Number.MAX_SAFE_INTEGER + 1, Number("8448911919725463553"),
  "", "0", "01", "-1", "+1", " 1", "1 ", "1e3", "1.0", "1\n", "1\r", "1\u2028", "1\u2029", "9223372036854775808", "999999999999999999999", "١", {}, []];

test("registered delete sends exact decimal Int64 strings without a Number round trip", async t => {
  const { tools, calls } = fixture(t);
  const remove = tools.get("delete_rewrite_rule");
  for (const id of [exactID, "9223372036854775807", 1, Number.MAX_SAFE_INTEGER]) {
    assert.equal(remove.options.inputSchema.id.safeParse(id).success, true);
    const result = await remove.handler({ id }); assert.notEqual(result.isError, true);
    assert.equal(calls.at(-1).url, "/api/rewrite?id=" + id);
  }
  assert.equal(calls.length, 4);
});

test("delete rejects unsafe numbers and malformed decimal identifiers before any device call", async t => {
  const { tools, calls } = fixture(t);
  const remove = tools.get("delete_rewrite_rule");
  for (const id of invalidIDs) {
    assert.equal(remove.options.inputSchema.id.safeParse(id).success, false, JSON.stringify(id));
    const result = await remove.handler({ id }); assert.equal(result.isError, true, JSON.stringify(id));
    assert.match(result.content[0].text, /id_text/);
  }
  assert.equal(calls.length, 0);
});

test("upsert preserves exact string identifiers in the real registered PUT payload", async t => {
  const { tools, calls } = fixture(t);
  for (const id of [exactID, "9223372036854775807", 123, Number.MAX_SAFE_INTEGER]) {
    const result = await tools.get("upsert_rewrite_rule").handler(updateInput(id));
    assert.notEqual(result.isError, true);
    assert.equal(calls.at(-1).method, "put"); assert.equal(calls.at(-1).url, "/api/rewrite");
    assert.equal(calls.at(-1).body.rule.id, id);
  }
  assert.equal(calls.length, 4);
});

test("upsert rejects rounded JSON numbers and all malformed ids before capability reads or writes", async t => {
  const { tools, calls } = fixture(t);
  const upsert = tools.get("upsert_rewrite_rule");
  for (const id of invalidIDs) {
    const result = await upsert.handler(updateInput(id)); assert.equal(result.isError, true, JSON.stringify(id));
    assert.match(result.content[0].text, /id_text/);
  }
  const rawRounded = await upsert.handler({ rule_json: '{"id":8448911919725463553,"name":"Rounded","enabled":false,"priority":0}', groups_json: "[]" });
  assert.equal(rawRounded.isError, true); assert.match(rawRounded.content[0].text, /already lost precision/);
  assert.equal(calls.length, 0);
});

test("creation omits ids and GET id_text must be copied into id rather than echoed as metadata", async t => {
  const { tools, calls } = fixture(t);
  const upsert = tools.get("upsert_rewrite_rule");
  const result = await upsert.handler({ rule_json: '{"name":"New phone rule","enabled":false,"priority":0}', groups_json: "[]" });
  assert.notEqual(result.isError, true); assert.equal(calls.at(-1).method, "post");
  assert.equal("id" in calls.at(-1).body.rule, false);
  for (const value of [{ id_text: exactID }, { id: exactID, id_text: exactID }]) {
    const rejected = await upsert.handler({ rule_json: JSON.stringify({ name: "No duplicate", enabled: false, priority: 0, ...value }), groups_json: "[]" });
    assert.equal(rejected.isError, true); assert.match(rejected.content[0].text, /omit id_text/);
  }
  assert.equal(calls.length, 1);
});

test("exact string id preserves disabling an existing wildcard rule on a device lacking capability", async t => {
  const { tools, calls } = fixture(t);
  lemonApi.get = async () => { throw new Error("disabled existing policy must not probe host wildcards"); };
  const input = updateInput(exactID);
  input.groups_json = JSON.stringify([{ group_key: "a0287fd2-24b0-4f87-a11e-c59c16338cac", order: 0, enabled: true,
    allows_match_all: false, match_mode: "default", match_expression: "",
    conditions: [{ field: "host", op: "eq", value: "*.phone-mock.test.invalid" }],
    actions: [{ enabled: true, order: 0, scope: "response", action: "mock_file", config: '{"file_path":"MockFiles/phone.json","content_type":"application/json"}' }] }]);
  const result = await tools.get("upsert_rewrite_rule").handler(input); assert.notEqual(result.isError, true);
  assert.equal(calls.length, 1); assert.equal(calls[0].method, "put"); assert.equal(calls[0].body.rule.id, exactID);
});

test("list keeps original id_text and delete surfaces iOS application errors", async t => {
  const { tools } = fixture(t);
  lemonApi.get = async () => [{ id: Number(exactID), id_text: exactID, name: "Phone Mock ID fixture" }];
  const listed = await tools.get("list_rewrite_rules").handler({});
  assert.equal(JSON.parse(listed.content[0].text)[0].id_text, exactID);
  lemonApi.delete = async () => ({ success: false, err_msg: "fixture delete rejected" });
  const deleted = await tools.get("delete_rewrite_rule").handler({ id: exactID });
  assert.equal(deleted.isError, true); assert.match(deleted.content[0].text, /fixture delete rejected/);
});
