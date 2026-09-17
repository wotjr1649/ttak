'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs'),{digest,canonical}=require('../scripts/verification-packet.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111111',candidate_sha256:'a'.repeat(64)},request='Explain the defined operation: reading the register returns3 and changes nothing.';
function fixture(){
  const plan=v.prepare({...binding,request});let attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,plan.request_sha256);
  const get=()=>attempt,set=x=>{attempt=x;},packet=plan.packets[0];return {plan,get,set,packet};
}
function submit(f,packet,kind,fields,delivery='native'){
  const id=packet.id+'-child',pre={hook_event_name:'PreToolUse',tool_name:delivery==='native'?'spawn_agent':'Agent',tool_use_id:packet.id+'-spawn',tool_input:delivery==='native'
    ?{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}
    :{description:'Check one packet',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}};
  f.set(v.observeAgent(f.get(),pre));
  if(delivery==='native')f.set(v.observeAgent(f.get(),{...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:id}}));
  f.set(v.observeAgent(f.get(),{hook_event_name:'SubagentStart',agent_id:id,agent_type:v.agentType}));
  if(delivery==='mcp'){
    const p={hook_event_name:'PreToolUse',agent_id:id,tool_use_id:packet.id+'-packet',tool_input:{challenge:packet.challenge}};
    f.set(v.observePacket(f.get(),p));f.set(v.observePacket(f.get(),{...p,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)}));
  }
  const args={challenge:packet.challenge,...fields},payload=v.resultSubmission(args,kind),input={hook_event_name:'PreToolUse',agent_id:id,tool_use_id:packet.id+'-submit',tool_input:args};
  f.set(v.observeSubmission(f.get(),input,kind));f.set(v.observeSubmission(f.get(),{...input,hook_event_name:'PostToolUse',submission_payload:payload},kind));
  const finish=text=>{f.set(v.observeAgent(f.get(),{hook_event_name:'SubagentStop',agent_id:id,last_assistant_message:text}));
    if(delivery==='mcp')f.set(v.observeAgent(f.get(),{...pre,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:text+'\nagentId: '+id+' (for resuming)'}]}));};
  return {payload,finish};
}
const factFields={verdict:'answered',answer:'Reading returns3 without changing the register.',issues:[]};
function disclose(f,payload,packet){
  const selected=v.resultReference({attempt_id:'current',candidate_sha256:'current',challenge:'current'},f.get());
  const args={...selected.args,result:payload.result},response=v.resultRead(args,packet);f.set(v.observeResultRead(f.get(),args,response));return response;
}
test('native receipts bind the actual typed result but do not make facts available before exact result disclosure',()=>{
  for(const delivery of ['native','mcp']){
    const f=fixture(),{payload,finish}=submit(f,f.packet,'fact',factFields,delivery);
    const ref=JSON.parse(payload.receipt_text);assert.deepEqual(ref,{protocol:'ttak-verification-receipt-v1',challenge:f.packet.challenge,result_sha256:digest(payload.result)});assert.ok(payload.receipt_text.length<240);
    finish(payload.receipt_text);assert.equal(f.get().verification.facts[0].phase,'referenced');assert.equal(f.get().verification.facts[0].verdict,null);assert.equal(f.get().status,'pending');
    const args={...binding,request,final_text:'Reading returns3.',facts:[{id:f.packet.id,result:payload.result}],revision:0};
    assert.throws(()=>v.registerFinal(f.get(),v.finalize(args),args),/unobserved_fact/);
    assert.deepEqual(disclose(f,payload).result,payload.result);assert.equal(f.get().verification.facts[0].phase,'returned');assert.equal(f.get().verification.facts[0].verdict,'answered');
    assert.throws(()=>disclose(f,payload),/reference_unavailable/);assert.doesNotMatch(canonical(f.get()),/Reading returns|"answer"|receipt_text/);
  }
});
test('exact independent final approval becomes complete only after the original submitted result is disclosed',()=>{
  const f=fixture(),fact=submit(f,f.packet,'fact',factFields);fact.finish(fact.payload.receipt_text);disclose(f,fact.payload);
  const args={...binding,request,final_text:'Reading the register returns3 and changes nothing.',facts:[{id:f.packet.id,result:fact.payload.result}],revision:0},final=v.finalize(args);
  f.set(v.registerFinal(f.get(),final,args));const checked=submit(f,final.packet,'final',{final_decision:'approve_explanation',requirement_review:'The requested operation is covered.',claim_review:'The stated behavior matches the definition.',fact_review:'REQUEST_FACTS matches the original definition.',checked_questions:[f.packet.id],issues:[]});
  checked.finish(checked.payload.receipt_text);assert.equal(f.get().status,'pending');assert.equal(f.get().final_sha256,null);
  disclose(f,checked.payload,final.packet);assert.equal(f.get().status,'complete');assert.equal(f.get().final_sha256,final.final_sha256);
});
test('forged receipt, raw parent-supplied body, wrong disclosure and missing original submission cannot authorize a result',()=>{
  for(const mutate of [r=>({...r,challenge:'b'.repeat(64)}),r=>({...r,result_sha256:'b'.repeat(64)}),r=>({...r,verdict:'complete'}),r=>({...r,protocol:'other'})]){
    const f=fixture(),s=submit(f,f.packet,'fact',factFields);assert.throws(()=>s.finish(JSON.stringify(mutate(JSON.parse(s.payload.receipt_text)))));
  }
  const f=fixture(),s=submit(f,f.packet,'fact',factFields);s.finish(s.payload.receipt_text);
  assert.throws(()=>v.resultReference({...binding,challenge:'current',result:s.payload.result},f.get()));
  assert.throws(()=>v.resultReference({...binding,candidate_sha256:'b'.repeat(64),challenge:'current'},f.get()));
  const selected=v.resultReference({...binding,challenge:'current'},f.get()),args={...selected.args,result:s.payload.result},payload=v.resultRead(args);
  assert.throws(()=>v.observeResultRead(f.get(),args,{...payload,result:{...payload.result,answer:'Changed.'}}));
  const changed={...args,result:{...args.result,answer:'Changed.'}};assert.throws(()=>v.observeResultRead(f.get(),changed,v.resultRead(changed)));
  const absent=structuredClone(f.get());absent.verification.facts[0].submitted=false;assert.throws(()=>v.resultReference({...binding,challenge:'current'},absent));
});
test('reference disclosure preserves the final question-coverage guard and withholding decision',()=>{
  const f=fixture(),fact=submit(f,f.packet,'fact',factFields);fact.finish(fact.payload.receipt_text);disclose(f,fact.payload);
  const args={...binding,request,final_text:'Reading changes the register.',facts:[{id:f.packet.id,result:fact.payload.result}],revision:0},final=v.finalize(args);f.set(v.registerFinal(f.get(),final,args));
  const s=submit(f,final.packet,'final',{final_decision:'revise_explanation',requirement_review:'The request requires the actual read behavior.',claim_review:'The changed-value claim contradicts the definition.',fact_review:'REQUEST_FACTS accurately describes the unchanged register.',checked_questions:['other-question'],issues:[{quote:'Reading changes the register.',reason:'The supplied operation changes nothing.',evidence_needed:'Correct the claimed effect.'}]});
  s.finish(s.payload.receipt_text);assert.throws(()=>disclose(f,s.payload),/question_coverage/);assert.equal(f.get().status,'pending');
});
test('the Codex adapter retrieves the bound body after native close, and failed or mismatched reads never enter retained evidence',async()=>{
  // Pure recipe wiring, not native execution or a verifier quality claim.
  for(const mode of ['normal','read-error','wrong-hash']){
    const f=fixture(),payload=v.resultSubmission({challenge:f.packet.challenge,...factFields},'fact'),wire=v.dispatchPacket(f.plan,f.packet,{...binding,challenge:f.packet.challenge}),steps=[];let held;
    const tools={mcp__ttak_scenario__explanation_dispatch:async()=>({structuredContent:wire}),
      multi_agent_v1__spawn_agent:async()=>{steps.push('spawn');return {agent_id:'native-child'};},
      multi_agent_v1__wait_agent:async()=>{steps.push('wait');return {timed_out:false,status:{'native-child':{completed:payload.receipt_text}}};},
      multi_agent_v1__close_agent:async()=>{steps.push('close');return {};},
      mcp__ttak_scenario__explanation_result:async args=>{
        steps.push('read');assert.deepEqual(args,{...binding,challenge:f.packet.challenge});if(mode==='read-error')throw new Error('Read failed');
        const output=v.resultRead({...args,result:payload.result});if(mode==='wrong-hash')output.result_sha256='b'.repeat(64);return {structuredContent:output};}
    };
    const run=Object.getPrototypeOf(async function(){}).constructor('tools','text','store','load',f.plan.native_dispatch.spawn_agent_code);
    const execute=()=>run(tools,()=>steps.push('print'),(key,value)=>{steps.push('store');held=value;},()=>undefined);
    if(mode==='normal'){await execute();assert.deepEqual(held.facts,[{id:f.packet.id,result:payload.result}]);assert.deepEqual(steps,['spawn','wait','close','read','store','print']);}
    else{await assert.rejects(execute());assert.equal(held,undefined);assert.deepEqual(steps,['spawn','wait','close','read']);}
  }
});
test('typed final bounds remain unchanged and no rejected review can produce a receipt',()=>{
  const fields={challenge:'a'.repeat(64),final_decision:'approve_explanation',requirement_review:'Coverage is complete.',claim_review:'Claims match.',fact_review:'REQUEST_FACTS matches.',checked_questions:['REQUEST_FACTS'],issues:[]};
  for(const field of ['requirement_review','claim_review','fact_review'])assert.throws(()=>v.resultSubmission({...fields,[field]:'x'.repeat(401)},'final'),/content_rejected/);
  assert.equal(v.resultSubmission(fields,'final').receipt_text.includes('approve_explanation'),false);
});

test('one whole unlabeled compact-receipt fence preserves typed-result binding and the later disclosure gate',()=>{
  for(const delivery of ['native','mcp']){
    const f=fixture(),s=submit(f,f.packet,'fact',factFields,delivery),text='```\n'+s.payload.receipt_text+'\n```';
    assert.deepEqual(v.parseNativeReturn(text,f.packet),v.parseNativeReturn(s.payload.receipt_text,f.packet));
    s.finish(text);assert.equal(f.get().verification.facts[0].phase,'referenced');assert.equal(f.get().verification.facts[0].verdict,null);
    assert.equal(f.get().status,'pending');assert.equal(f.get().verification.facts[0].return_corrections,0);
    assert.deepEqual(disclose(f,s.payload).result,s.payload.result);assert.equal(f.get().verification.facts[0].phase,'returned');
    assert.equal(f.get().verification.facts[0].reply_sha256,digest(s.payload.result));
  }
});
test('compact receipt framing does not extract a favorable substring or relax legacy full-result serialization',()=>{
  const f=fixture(),s=submit(f,f.packet,'fact',factFields),plain='```\n'+s.payload.receipt_text+'\n```';
  for(const text of ['preface\n'+plain,plain+'\nclosing',plain+'\n'+plain,'```js\n'+s.payload.receipt_text+'\n```',
    '```JSON\n'+s.payload.receipt_text+'\n```','````\n'+s.payload.receipt_text+'\n````','~~~\n'+s.payload.receipt_text+'\n~~~',
    '```\n'+s.payload.receipt_text,plain+'\n','```\n'+s.payload.final_text+'\n```'])assert.throws(()=>v.parseNativeReturn(text,f.packet));
  assert.deepEqual(v.parseNativeReturn(s.payload.final_text,f.packet).result,s.payload.result);
  assert.deepEqual(v.parseNativeReturn('```json\n'+s.payload.final_text+'\n```',f.packet).result,s.payload.result);
});
test('a well-framed compact receipt still rejects forged identity, hash, fields and absent typed submission',()=>{
  for(const mutate of [r=>({...r,challenge:'b'.repeat(64)}),r=>({...r,result_sha256:'b'.repeat(64)}),r=>({...r,verdict:'complete'}),r=>({...r,protocol:'other'})]){
    const f=fixture(),s=submit(f,f.packet,'fact',factFields,'mcp');
    assert.throws(()=>s.finish('```\n'+JSON.stringify(mutate(JSON.parse(s.payload.receipt_text)))+'\n```'));
    assert.equal(f.get().verification.facts[0].reply_sha256,null);assert.equal(f.get().status,'pending');
  }
  const f=fixture(),s=submit(f,f.packet,'fact',factFields,'mcp'),missing=structuredClone(f.get());missing.verification.facts[0].submitted=false;
  assert.throws(()=>v.observeAgent(missing,{hook_event_name:'SubagentStop',agent_id:missing.verification.facts[0].agent_id,last_assistant_message:'```\n'+s.payload.receipt_text+'\n```'}),/unobserved_submission/);
});
