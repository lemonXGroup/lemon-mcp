const assert = require('node:assert/strict');
const test = require('node:test');
const { z } = require('zod');
const { registerTools } = require('../build/tools.js');
const { lemonApi } = require('../build/apiClient.js');

const tools = new Map();
registerTools({ registerTool(name, options, handler) { tools.set(name, { options, handler }); } });
function input(name, value) { return z.object(tools.get(name).options.inputSchema).parse(value); }

test('remote preparation defaults to manual and denies privileged host permissions', () => {
  const parsed = input('prepare_remote_rewrite_script', { descriptor: { url: 'https://example.com/a.js' } });
  assert.deepEqual(parsed.descriptor.permissionCeiling, { log: true, store: false, http: false, notify: false, utils: true });
  assert.equal(parsed.descriptor.autoUpdate, false);
  assert.equal(parsed.descriptor.intervalSeconds, 86400);
  assert.throws(() => input('prepare_remote_rewrite_script', { descriptor: { url: 'https://example.com/a.js', intervalSeconds: 1 } }));
  assert.throws(() => input('prepare_remote_rewrite_script', { descriptor: { url: 'https://example.com/a.js', expectedSHA256: 'not-a-pin' } }));
});

test('preparation and refresh delegate to the iPhone and preserve API failure state', async (t) => {
  const original = lemonApi.post;
  t.after(() => { lemonApi.post = original; });
  const calls = [];
  lemonApi.post = async (path, body) => { calls.push({ path, body }); return { success: true, token: 'prepared' }; };
  const payload = input('prepare_remote_rewrite_script', { descriptor: { url: 'https://example.com/a.js' }, required_handlers: ['onResponse'] });
  const result = await tools.get('prepare_remote_rewrite_script').handler(payload);
  assert.equal(result.isError, undefined);
  assert.equal(calls[0].path, '/api/rewrite/scripts/remote/prepare');
  assert.deepEqual(calls[0].body, payload);
  lemonApi.post = async () => ({ success: false, err_msg: 'remote_hash_mismatch' });
  const failed = await tools.get('refresh_remote_rewrite_script').handler({ id: 42 });
  assert.equal(failed.isError, true);
  assert.match(failed.content[0].text, /remote_hash_mismatch/);
});

test('parent rule forwards prepared tokens without creating a standalone script', async (t) => {
  const original = lemonApi.post;
  t.after(() => { lemonApi.post = original; });
  const calls = [];
  lemonApi.post = async (path, body) => { calls.push({ path, body }); return { success: true }; };
  const drafts = [{ temporary_id: '9007199254740991', name: 'Draft', token: 'test-token' }];
  await tools.get('upsert_rewrite_rule').handler({ rule_json: '{"name":"Rule","enabled":true,"priority":0}', groups_json: '[]', remote_scripts_json: JSON.stringify(drafts) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/rewrite');
  assert.deepEqual(calls[0].body.remote_scripts, drafts);
});
