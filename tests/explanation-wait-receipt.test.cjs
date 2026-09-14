'use strict';
// Move the existing native-return comparison into the normal read boundary, never waive it.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {canonical}=require('../scripts/verification-packet.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111172',candidate_sha256:'a'.repeat(64)};
function fixture(fullReturn=false){
  const plan=v.prepare({...binding,request:'Explain a fictional register initially7 with non-mutating reads.'}),packet=plan.packets[0];
  let attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,plan.request_sha256);
  const spawn={hook_event_name:'PreToolUse',tool_name:'spawn_agent',tool_use_id:'spawn-once',tool_input:{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
  attempt=v.observeAgent(attempt,spawn);attempt=v.observeAgent(attempt,{...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:'fresh-child'}});
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:'fresh-child',agent_type:'default'});
  const input={challenge:packet.challenge,verdict:'answered',answer:'Each read returns7 without changing it.',issues:[]},payload=v.resultSubmission(input,'fact');
  const submit={hook_event_name:'PreToolUse',agent_id:'fresh-child',tool_use_id:'submit-once',tool_input:input};
  attempt=v.observeSubmission(attempt,submit,'fact');attempt=v.observeSubmission(attempt,{...submit,hook_event_name:'PostToolUse',submission_payload:payload},'fact');
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:'fresh-child',last_assistant_message:fullReturn?payload.final_text:payload.receipt_text});
  return {attempt,packet,payload,selector:{...binding,challenge:packet.challenge},args:{...binding,challenge:packet.challenge,result:payload.result}};
}
test('an explicit wait receipt binds to the same native reference and leaves the disclosed result payload unchanged',()=>{
  const f=fixture(),before=canonical(f.attempt),expected=v.resultRead(f.args);
  for(const receipt_text of [f.payload.receipt_text,'```json\n'+f.payload.receipt_text+'\n```']){
    const selected=v.resultReference({...f.selector,receipt_text},f.attempt);assert.equal(selected.slot.phase,'referenced');
    assert.equal(selected.args.receipt_text,receipt_text);assert.equal(selected.args.challenge,f.packet.challenge);
    const args={...f.args,receipt_text},read=v.resultRead(args);assert.deepEqual(read,expected);
    const observed=v.observeResultRead(f.attempt,args,read);assert.equal(observed.verification.facts[0].phase,'returned');assert.equal(observed.verification.facts[0].verdict,'answered');
    assert.equal(observed.status,'pending');assert.equal(canonical(f.attempt),before);
  }
});
test('missing explicit receipt remains compatible, but changed hash, binding, commentary and full-result substitution are rejected',()=>{
  const f=fixture();assert.deepEqual(v.resultReference(f.selector,f.attempt).args,f.selector);assert.doesNotThrow(()=>v.resultRead(f.args));
  const receipt=JSON.parse(f.payload.receipt_text);
  for(const receipt_text of [JSON.stringify({...receipt,result_sha256:'b'.repeat(64)}),JSON.stringify({...receipt,challenge:'b'.repeat(64)}),
    JSON.stringify({...receipt,extra:true}),'Approved. '+f.payload.receipt_text,f.payload.final_text,'x'.repeat(513),'']){
    assert.throws(()=>v.resultReference({...f.selector,receipt_text},f.attempt));assert.throws(()=>v.resultRead({...f.args,receipt_text}));
  }
  assert.throws(()=>v.resultRead({...f.args,receipt_text:f.payload.receipt_text,result:{...f.payload.result,answer:'Changed.'}}));
});
test('wait receipt input cannot reopen a consumed legacy or referenced result',()=>{
  const legacy=fixture(true);assert.equal(legacy.attempt.verification.facts[0].phase,'returned');
  assert.deepEqual(v.parseNativeReturn(legacy.payload.final_text,legacy.packet).result,legacy.payload.result);
  assert.throws(()=>v.resultReference({...legacy.selector,receipt_text:legacy.payload.receipt_text},legacy.attempt));
  const f=fixture(),args={...f.args,receipt_text:f.payload.receipt_text},used=v.observeResultRead(f.attempt,args,v.resultRead(args));
  assert.throws(()=>v.resultReference({...f.selector,receipt_text:f.payload.receipt_text},used));
  const failed={...f.attempt,status:'unavailable'};assert.throws(()=>v.resultReference({...f.selector,receipt_text:f.payload.receipt_text},failed));
});
test('the wait receipt is an optional bounded read input, not another result or completion flag',()=>{
  const schema=v.resultReadTool.inputSchema;assert.deepEqual(schema.required,['attempt_id','candidate_sha256','challenge']);assert.equal(schema.additionalProperties,false);
  assert.equal(schema.properties.receipt_text.type,'string');assert.equal(schema.properties.receipt_text.maxLength,512);
  assert.equal(Object.hasOwn(schema.properties,'result'),false);assert.equal(Object.hasOwn(schema.properties,'complete'),false);
});
