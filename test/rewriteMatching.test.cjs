const assert = require('node:assert/strict');
const test = require('node:test');
const { registerTools } = require('../build/tools.js');
const { lemonApi } = require('../build/apiClient.js');

const tools = new Map();
registerTools({ registerTool(name, options, handler) { tools.set(name, { options, handler }); } });
const supported = { host_wildcards: { supported: true, version: 1, root_domain: true, operators: ['eq','prefix','suffix','contains'] } };
const group = (field, op, value, extra = {}) => ({ group_key: '00000000-0000-4000-8000-000000000001',
  order: 0, enabled: true, allows_match_all: false, conditions: [{ field, op, value }], actions: [], ...extra });
const invoke = (groups, rule = { name: 'Fixture', enabled: true, priority: 0 }) =>
  tools.get('upsert_rewrite_rule').handler({ rule_json: JSON.stringify(rule), groups_json: JSON.stringify(groups) });
function mockAPI(t, capabilities = supported) {
  const original = { get: lemonApi.get, post: lemonApi.post, put: lemonApi.put };
  t.after(() => Object.assign(lemonApi, original));
  const calls = [];
  lemonApi.get = async path => { calls.push({ method: 'GET', path }); if (capabilities instanceof Error) throw capabilities; return capabilities; };
  for (const [method, name] of [['POST','post'], ['PUT','put']]) {
    lemonApi[name] = async (path, body) => { calls.push({ method, path, body }); return { success: true, persisted: true, runtime_applied: true }; };
  }
  return calls;
}

test('query conditions preserve raw spelling, all operators and AND conditions without a version envelope', async t => {
  const calls = mockAPI(t, new Error('ordinary rules must not probe capabilities'));
  for (const op of ['eq','prefix','suffix','contains','regex']) {
    const groups = [group('host','eq','api.example.com')];
    groups[0].conditions.push({ field: 'query', op, value: 'name=A%20B&packageId=1' });
    const result = await invoke(groups);
    assert.equal(result.isError, undefined);
    const payload = calls.at(-1).body;
    assert.deepEqual(payload.groups, groups);
    assert.equal(payload.rule.schema_version, undefined);
  }
  assert.ok(calls.every(call => call.method === 'POST'));
});

test('all four host operators check device semantics before forwarding unchanged patterns', async t => {
  const calls = mockAPI(t);
  for (const op of ['eq','prefix','suffix','contains']) {
    const groups = [group('host',op,'*.api?.example.com')];
    const result = await invoke(groups);
    assert.equal(result.isError, undefined);
    assert.equal(calls.at(-2).path, '/api/rewrite/capabilities');
    assert.equal(calls.at(-2).method, 'GET');
    assert.deepEqual(calls.at(-1).body.groups, groups);
  }
});

test('missing, incomplete, old and unreachable capabilities prevent writes', async t => {
  for (const capabilities of [{}, { host_wildcards: { ...supported.host_wildcards, root_domain: false } },
    { host_wildcards: { ...supported.host_wildcards, version: 0 } },
    { host_wildcards: { ...supported.host_wildcards, operators: ['eq'] } },
    new Error('404 capability route unavailable')]) {
    await t.test(String(capabilities instanceof Error ? 'unreachable' : JSON.stringify(capabilities)), async sub => {
      const calls = mockAPI(sub, capabilities);
      const result = await invoke([group('host','eq','*.example.com')]);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /[Hh]ost wildcard/);
      assert.deepEqual(calls.map(call => call.method), ['GET']);
    });
  }
});

test('inactive wildcard conditions retain the capability gate when saving or enabling', async t => {
  const calls = mockAPI(t, {});
  const groups = [group('host','eq','*.example.com', { enabled: false, match_mode: 'expression', match_expression: '^https://example.com/' })];
  assert.equal((await invoke(groups)).isError, true);
  assert.equal((await invoke(groups, { id: 42, name: 'Fixture', enabled: true })).isError, true);
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('an existing policy can be disabled on an older phone without losing its groups', async t => {
  const calls = mockAPI(t, new Error('old phone'));
  const groups = [group('host','eq','*.example.com')];
  const result = await invoke(groups, { id: 42, name: 'Fixture', enabled: false });
  assert.equal(result.isError, undefined);
  assert.deepEqual(calls.map(call => call.method), ['PUT']);
  assert.deepEqual(calls[0].body.groups, groups);
  assert.equal(calls[0].body.rule.enabled, false);
});

test('regex host and wildcards in other fields keep their existing syntax and skip host capability checks', async t => {
  const calls = mockAPI(t, new Error('not applicable'));
  for (const groups of [[group('host','regex','.*')], ...['path','query','method'].map(field => [group(field,'eq','*?')])]) {
    assert.equal((await invoke(groups)).isError, undefined);
  }
  assert.ok(calls.every(call => call.method === 'POST'));
});
