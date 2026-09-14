'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{digest,textDigest}=require('../scripts/verification-packet.cjs');
const {selectSubmittedResult}=require('../scripts/explanation-result-source.cjs');
const parent='11111111-1111-4111-8111-111111111111',child='22222222-2222-4222-8222-222222222222',turn='33333333-3333-4333-8333-333333333333';
const cwd=process.cwd(),challenge='a'.repeat(64),call='exec-44444444-4444-4444-8444-444444444444';
function fixture(host='codex',answer='The defined guard reads B and conditionally writes A.'){
  const args={challenge,verdict:'answered',answer,issues:[]},payload=v.resultSubmission(args,'fact');
  const slot={agent_id:host==='codex'?child:'a1111222233334444',kind:'fact',challenge,phase:'referenced',submitted:true,spawn_confirmed:true,retrieved:true,
    child_turn_sha256:host==='codex'?textDigest(turn):null,submission_call_sha256:textDigest(call),submission_sha256:digest(payload.result),reply_sha256:digest(payload.result),verdict:null};
  const input={session_id:parent,cwd};
  const rows=host==='codex'?[
    {type:'session_meta',payload:{id:child,session_id:parent,parent_thread_id:parent,cli_version:'0.154.0',cwd}},
    {type:'turn_context',payload:{turn_id:turn,model:'gpt-5.6-luna',effort:'high'}},
    {type:'event_msg',payload:{type:'item_completed',thread_id:child,turn_id:turn,item:{type:'McpToolCall',id:call,server:'ttak_scenario',tool:'explanation_fact_result',status:'completed',readOnlyHint:true,result:{content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload},arguments:args}}}
  ]:[
    {type:'assistant',uuid:'call-row',isSidechain:true,agentId:slot.agent_id,sessionId:parent,version:'2.1.266',cwd,message:{role:'assistant',model:'claude-haiku-4-5-20251001',content:[{type:'tool_use',id:call,name:'mcp__plugin_ttak_ttak_scenario__explanation_fact_result',input:args}]}},
    {type:'user',uuid:'reply-row',sourceToolAssistantUUID:'call-row',isSidechain:true,agentId:slot.agent_id,sessionId:parent,version:'2.1.266',cwd,message:{role:'user',content:[{type:'tool_result',tool_use_id:call,is_error:false,content:JSON.stringify(payload)}]}}
  ];
  const raw=()=>rows.map(r=>JSON.stringify(r)).join('\n')+'\n';return {args,payload,slot,input,rows,raw,read:()=>selectSubmittedResult(raw(),input,slot,host,'fact')};
}
test('read exact already-submitted results from both pinned native layouts without copying other content',()=>{
  for(const host of ['codex','claude']){const f=fixture(host);f.rows.push({type:'reasoning',unrelated:'PRIVATE_SYNTHETIC_IGNORED'});assert.deepEqual(f.read(),f.payload.result);assert.doesNotMatch(JSON.stringify(f.read()),/PRIVATE_SYNTHETIC/);}
});
test('native retrieval requires a submitted completed-child reference, never a planned or failed check',()=>{
  for(const host of ['codex','claude'])for(const delta of [{phase:'launched'},{phase:'returned'},{submitted:false},{spawn_confirmed:false},{retrieved:false},{reply_sha256:'f'.repeat(64)},{submission_call_sha256:'f'.repeat(64)},{verdict:'answered'}]){
    const f=fixture(host);Object.assign(f.slot,delta);assert.throws(f.read,/native_submitted_result_unavailable/);
  }
});
test('Codex rejects wrong parent, child, version, cwd, model, effort, turn, server, tool and errors',()=>{
  const changes=[f=>f.rows[0].payload.parent_thread_id=child,f=>f.rows[0].payload.session_id=child,f=>f.rows[0].payload.id=parent,f=>f.rows[0].payload.cli_version='0.155.0',f=>f.rows[0].payload.cwd=cwd+'x',
    f=>f.rows[1].payload.model='another-model',f=>f.rows[1].payload.effort='low',f=>f.rows[2].payload.thread_id=parent,f=>f.rows[2].payload.turn_id=child,
    f=>f.rows[2].payload.item.server='other',f=>f.rows[2].payload.item.tool='explanation_final_result',f=>f.rows[2].payload.item.status='failed',f=>f.rows[2].payload.item.result.isError=true];
  for(const change of changes){const f=fixture();change(f);assert.throws(f.read,/native_submitted_result_unavailable/);}
});
test('Claude requires exact sidechain identity, version, model and tool-use/result pairing',()=>{
  const changes=[f=>f.rows[0].agentId='other',f=>f.rows[1].sessionId=child,f=>f.rows[0].isSidechain=false,f=>f.rows[1].version='2.1.269',
    f=>f.rows[0].message.model='other',f=>f.rows[1].sourceToolAssistantUUID='other',f=>f.rows[1].message.content[0].is_error=true,
    f=>f.rows[0].message.content[0].name='mcp__other__explanation_fact_result',f=>f.rows[1].message.content[0].tool_use_id='other'];
  for(const change of changes){const f=fixture('claude');change(f);assert.throws(f.read,/native_submitted_result_unavailable/);}
});
test('duplicate records and changed compiler arguments, result, or MCP containers cannot provide evidence',()=>{
  for(const host of ['codex','claude']){
    const duplicated=fixture(host);duplicated.rows.push(structuredClone(duplicated.rows.at(-1)));assert.throws(duplicated.read,/native_submitted_result_unavailable/);
    const changed=fixture(host);changed.args.answer+=' Altered.';assert.throws(changed.read,/native_submitted_result_unavailable/);
    const bad=fixture(host);if(host==='codex')bad.rows[2].payload.item.result.content[0].text='{}';else bad.rows[1].message.content[0].content='{}';assert.throws(bad.read,/native_submitted_result_unavailable/);
  }
});
test('malformed, incomplete, oversized and unsafe selected results fail closed',()=>{
  const f=fixture();for(const raw of ['{}','{}\n','broken\n',f.raw().trimEnd(),'x'.repeat(8388609)+'\n'])assert.throws(()=>selectSubmittedResult(raw,f.input,f.slot,'codex','fact'),/native_submitted_result_unavailable/);
  const unsafe=fixture();unsafe.rows[2].payload.item.result.structuredContent.result.answer='Bearer '+ 'A'.repeat(20);assert.throws(unsafe.read,/native_submitted_result_unavailable/);
});
test('computed native fact receipts are rechecked against the source-model hashes, not merely a self-consistent result',()=>{
  const model={initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
    {id:'T1',guard:{cells:['B'],at_least:1},writes:{A:false}},{id:'T2',guard:{cells:['A'],at_least:1},writes:{B:false}}]};
  const answer={computed_models:[{model_sha256:digest(model),model}],request_context:'A and B are the Boolean state cells; T1 and T2 are the modeled transactions. The invariant requires at least one true cell.',additional_sources:[],language:'en'};
  for(const host of ['claude','codex']){
    const f=fixture(host,answer);f.slot.source_model_sha256s=[digest(model)];assert.deepEqual(f.read(),f.payload.result);
    f.slot.source_model_sha256s=['b'.repeat(64)];assert.throws(f.read,/native_submitted_result_unavailable/);
    delete f.slot.source_model_sha256s;assert.throws(f.read,/native_submitted_result_unavailable/);
    const legacy=fixture(host);legacy.slot.source_model_sha256s=[digest(model)];assert.throws(legacy.read,/native_submitted_result_unavailable/);
  }
});
test('native current arguments require the explicit observed submission marker as well as all original result evidence',()=>{
  for(const host of ['claude','codex']){
    const f=fixture(host);f.args.challenge='current';assert.throws(f.read,/native_submitted_result_unavailable/);
    f.slot.submission_reference=true;assert.deepEqual(f.read(),f.payload.result);
    for(const challenge of ['current ','Current','a'.repeat(63),'b'.repeat(64)]){f.args.challenge=challenge;assert.throws(f.read,/native_submitted_result_unavailable/);}
    f.args.challenge='current';f.args.answer='Changed.';assert.throws(f.read,/native_submitted_result_unavailable/);
    const altered=fixture(host);altered.args.challenge='current';altered.slot.submission_reference=true;altered.slot.submission_sha256='f'.repeat(64);assert.throws(altered.read,/native_submitted_result_unavailable/);
    const foreign=fixture(host);foreign.args.challenge='current';foreign.slot.submission_reference=true;foreign.slot.agent_id='foreign-child';assert.throws(foreign.read,/native_submitted_result_unavailable/);
  }
});
