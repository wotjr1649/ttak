'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {collectHistory}=require('./release/normal-history.cjs');
const session='00000000-0000-4000-8000-000000000001',turn='00000000-0000-4000-8000-000000000002',prior='00000000-0000-4000-8000-000000000003';
const context=id=>({type:'turn_context',payload:{turn_id:id,model:'gpt-5.6-luna',effort:'high'}});
const call=(id='call-one')=>({type:'response_item',payload:{type:'custom_tool_call',call_id:id,name:'exec',input:'text("public fixture")'}});
const output=(id='call-one')=>({type:'response_item',payload:{type:'custom_tool_call_output',call_id:id,output:[{type:'input_text',text:'public result'}]}});
const usage=()=>({type:'token_usage_record',payload:{turn_id:turn,thread_id:session,response_id:'response-one',usage:{input_tokens:10,output_tokens:3,total_tokens:13,reasoning_output_tokens:2}}});
test('native custom calls missing from public items remain paired and scoped to the selected completed turn',()=>{
 const events=[context(prior),call('old'),output('old'),context(turn),call(),output(),usage(),
  {type:'response_item',payload:{type:'reasoning',text:'HIDDEN_REASONING_SENTINEL',encrypted_content:'ENCRYPTED_SENTINEL'}}];
 const result=collectHistory(events,session,[turn]);assert.equal(result.calls.length,1);assert.equal(result.outputs.length,1);
 assert.equal(result.calls[0].call_id,'call-one');assert.equal(result.aggregate.total,13);assert.equal(result.aggregate.responses,1);
 assert.doesNotMatch(JSON.stringify(result),/HIDDEN_REASONING_SENTINEL|ENCRYPTED_SENTINEL|public result/);
 assert.equal(result.outputs[0].output_bytes,13);
});
test('unpaired, duplicate and unknown calls cannot be reported as complete history',()=>{
 for(const suffix of [[call()],[output()],[call(),call(),output(),output()],
   [{type:'response_item',payload:{type:'web_search_call'}}]])
  assert.throws(()=>collectHistory([context(turn),...suffix],session,[turn]),/native_history/);
});
test('missing scope, changed actual model and duplicate or inconsistent usage fail',()=>{
 assert.throws(()=>collectHistory([],session,[turn]),/missing_turn/);
 const changed=context(turn);changed.payload.model='different';assert.throws(()=>collectHistory([changed],session,[turn]),/model/);
 assert.throws(()=>collectHistory([context(turn),usage(),usage()],session,[turn]),/usage/);
 const bad=usage();bad.payload.usage.total_tokens=14;assert.throws(()=>collectHistory([context(turn),bad],session,[turn]),/usage/);
 assert.throws(()=>collectHistory([context(turn)],session,[turn,turn]),/scope/);
});
test('local controls may have no model usage, while non-text tool outputs are rejected',()=>{
 assert.equal(collectHistory([context(turn)],session,[turn]).aggregate.responses,0);
 const bad=output();bad.payload.output=[{type:'encrypted_content',encrypted_content:'not-retained'}];
 assert.throws(()=>collectHistory([context(turn),call(),bad],session,[turn]),/output_type/);
});
