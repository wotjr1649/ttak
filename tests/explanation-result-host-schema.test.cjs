'use strict';
// Public tools/list metadata, not native model behavior or execution permission.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
function listed(host){const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'host-schema',version:'1'}}});
  d({jsonrpc:'2.0',method:'notifications/initialized'});return d({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}).result.tools.find(t=>t.name==='explanation_result');}
test('Claude tools/list advertises only its three binding inputs, without Codex wait receipt or next-step options',()=>{
  const tool=listed('claude'),schema=tool.inputSchema;
  assert.deepEqual(Object.keys(schema.properties),['attempt_id','candidate_sha256','challenge']);
  assert.deepEqual(schema.required,['attempt_id','candidate_sha256','challenge']);assert.equal(schema.additionalProperties,false);
  for(const key of Object.keys(schema.properties))assert.deepEqual(schema.properties[key],v.resultReadTool.inputSchema.properties[key]);
  const waitInstruction='When passing receipt_text from native wait, supply that exact returned string: the hook and compiler require its challenge and hash to match this same observed result. ';
  assert.equal(v.resultReadTool.description.split(waitInstruction).length,2);assert.equal(tool.description,v.resultReadTool.description.replace(waitInstruction,''));
  assert.deepEqual(tool.annotations,v.resultReadTool.annotations);
  const failedShapes={attempt_id:'current',candidate_sha256:'current',challenge:'b'.repeat(64),include_next_step:true,receipt_text:'agentId: another-agent (metadata, not a receipt)'};
  assert.deepEqual(Object.keys(failedShapes).filter(k=>!Object.hasOwn(schema.properties,k)),['include_next_step','receipt_text']);
  assert.deepEqual(Object.keys(v.nativeAdapter('claude').explanation_result),schema.required);
});
test('Codex tools/list preserves its exact receipt-gated next-step metadata and is not mutated by Claude discovery',()=>{
  const original=structuredClone(v.resultReadTool),before=listed('codex');assert.deepEqual(before,original);
  listed('claude');assert.deepEqual(listed('codex'),original);assert.deepEqual(v.resultReadTool,original);
  assert.equal(before.inputSchema.properties.include_next_step.const,true);
});
test('the host-specific result metadata builder rejects unknown hosts and selects the same normally listed schema',()=>{
  for(const host of ['claude','codex'])assert.deepEqual(v.resultReadToolFor(host),listed(host));
  for(const host of [undefined,null,'unknown','CLAUDE',{}])assert.throws(()=>v.resultReadToolFor(host),/verification_result_host/);
});
