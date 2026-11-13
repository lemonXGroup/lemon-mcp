
const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeRequestTarget, validRequestTarget } = require('../build/requestTarget.js');
const { lemonApi } = require('../build/apiClient.js');
const { registerTools } = require('../build/tools.js');
test('target contract preserves encoded values and rejects unsafe URLs or malformed operations', () => {
  for (const target of ['/v2?a=%2f&flag&&', '?x=1', 'https://example.test/a']) {
    assert.equal(validRequestTarget(target), true);
    assert.deepEqual(normalizeRequestTarget('url_rewrite', {target}, 'request'), {target, query_policy:'auto'});
  }
  for (const target of ['//other.test/a', 'http://u:p@example.test/', '/a#b', '/中文', '/a b', 'ftp://example.test/', 'http://example.test:0/']) assert.equal(validRequestTarget(target), false, target);
  assert.deepEqual(normalizeRequestTarget('redirect', {target:'/next'}, 'request'), {target:'/next', query_policy:'auto', status:307});
  for (const config of [{operations:[]}, {operations:[{op:'set',key:'x'}]}, {operations:[{op:'clear',value:'x'}]}, {operations:[{op:'remove',key:'x',value:''}]}]) assert.throws(()=>normalizeRequestTarget('query_mod',config,'request'));
  assert.throws(()=>normalizeRequestTarget('url_rewrite',{target:'/x',query_policy:null},'request'));
  assert.throws(()=>normalizeRequestTarget('redirect',{target:'/x',status:null},'request'));
  assert.throws(()=>normalizeRequestTarget('url_rewrite',{target:'/x'},'response'));
});
test('registered upsert checks device capabilities before writing new target actions', async t => {
  const original={get:lemonApi.get,post:lemonApi.post};
  t.after(()=>Object.assign(lemonApi,original));
  const calls=[];
  let supported=false;
  lemonApi.get=async url=>{calls.push(['get',url]);return {request_target_rewrite:{supported,version:1}};};
  lemonApi.post=async (url,body)=>{calls.push(['post',url,body]);return {success:true};};
  const registered=new Map();
  registerTools({registerTool:(name,_options,handler)=>registered.set(name,handler)});
  const input={rule_json:JSON.stringify({name:'target fixture',enabled:true,priority:0}),groups_json:JSON.stringify([{group_key:'fcf8c088-6d9c-4d51-995b-5a217671d13c',order:0,enabled:true,allows_match_all:false,match_mode:'default',match_expression:'',conditions:[{field:'host',op:'eq',value:'fixture.test'}],actions:[{enabled:true,scope:'request',action:'url_rewrite',config:JSON.stringify({target:'/v2'}),order:0}]}])};
  let result=await registered.get('upsert_rewrite_rule')(input);
  assert.equal(result.isError,true);assert.equal(calls.some(c=>c[0]==='post'),false);
  supported=true;
  result=await registered.get('upsert_rewrite_rule')(input);
  assert.notEqual(result.isError,true);
  const config=JSON.parse(calls.at(-1)[2].groups[0].actions[0].config);
  assert.deepEqual(config,{target:'/v2',query_policy:'auto'});
});
