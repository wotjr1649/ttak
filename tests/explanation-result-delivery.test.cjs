'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs'),{textDigest,canonical}=require('../scripts/verification-packet.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111111',candidate_sha256:'a'.repeat(64)};
const normalRequest='Explain the fictional Daro register. Reading returns its stored integer without changing it. Start at3 and read twice.';
const noticeRequest='Explain the fictional Daro register and report measured slowdown. No measurements are supplied.';
const draft='## 읽기 결과\n\n두 읽기는 모두 3을 반환합니다.\n저장값도 3입니다.  ';
function returned(attempt,packet,kind,fields,host){
  const child=packet.id+'-child',spawn={hook_event_name:'PreToolUse',tool_use_id:packet.id+'-spawn',tool_name:host==='claude'?'Agent':'spawn_agent',tool_input:host==='claude'
    ?{description:'Verify one packet',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}
    :{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
  attempt=v.observeAgent(attempt,spawn);
  if(host==='codex')attempt=v.observeAgent(attempt,{...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child}});
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:child,agent_type:v.agentType});
  if(host==='claude'){
    const get={agent_id:child,tool_use_id:packet.id+'-get',tool_input:{challenge:packet.challenge}};
    attempt=v.observePacket(attempt,{...get,hook_event_name:'PreToolUse'});
    attempt=v.observePacket(attempt,{...get,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
  }
  const input={challenge:packet.challenge,...fields},payload=kind==='final'?v.finalReviewSubmission(input):v.resultSubmission(input,kind);
  const submit={agent_id:child,tool_use_id:packet.id+'-submit',tool_input:input};
  attempt=v.observeSubmission(attempt,{...submit,hook_event_name:'PreToolUse'},kind);
  attempt=v.observeSubmission(attempt,{...submit,hook_event_name:'PostToolUse',submission_payload:payload},kind);
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:child,last_assistant_message:payload.receipt_text});
  if(host==='claude')attempt=v.observeAgent(attempt,{...spawn,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:payload.receipt_text+'\nagentId: '+child+' (for resuming)'}]});
  const args={...v.resultReference({...binding,challenge:packet.challenge},attempt).args,result:payload.result};
  return {attempt,args,input,payload};
}
function fixture(host='claude',notice=false){
  const request=notice?noticeRequest:normalRequest,plan=notice?v.prepareAssessment({...binding,request}):v.prepare({...binding,request});
  let attempt=notice?v.registerAssessment(a.begin(binding.attempt_id,binding.candidate_sha256),plan,plan.request_sha256)
    :v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,plan.request_sha256);
  const factFields=notice?{assessment_decision:'assessed',gap_review:'The requested measurement is absent.',essential_gaps:[{requirement:'Measured slowdown',request_quote:'report measured slowdown',reason:'missing_evidence',evidence_needed:'Matched baseline and mitigation timings.'}],corrections:[],issues:[]}
    :{verdict:'answered',answer:'Both reads return3 and leave3 stored.',issues:[]};
  const fact=returned(attempt,plan.packets[0],notice?'assessment':'fact',factFields,host);
  attempt=v.observeResultRead(fact.attempt,fact.args,v.resultRead(fact.args));
  let final,proposal,finalArgs;
  if(notice){
    proposal=a.noticeFromAssessment({...binding,assessment_result:fact.payload.result,language:'en'},request,fact.payload.result);
    final=proposal.proposal.review;attempt=v.registerWithholding(attempt,final,plan.request_sha256);
  }else{
    finalArgs={...binding,request,final_text:draft,facts:[{id:plan.packets[0].id,result:fact.payload.result}],revision:0};
    final=v.finalize(finalArgs);attempt=v.registerFinal(attempt,final,finalArgs);
  }
  const fields=notice?{notice_decision:'approve_notice',requirement_review:'The essential measurement gap is identified.',evidence_review:'Matched timings are needed.',assessment_review:'No draft assessment is requested.',checked_questions:[v.assessmentId],issues:[]}
    :{final_decision:'approve_explanation',...reviewChecks(),checked_questions:['REQUEST_FACTS'],issues:[]};
  const ready=returned(attempt,final.packet,notice?'notice':'final',fields,host);
  return {...ready,host,notice,request,plan,fact,final,proposal,finalArgs,text:notice?proposal.proposal.decision.final_text:draft};
}
function connection(host){
  const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'delivery-test',version:'1'}}});
  d({jsonrpc:'2.0',method:'notifications/initialized'});return d;
}
const call=(d,name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
function cached(f){
  const d=connection(f.host);
  assert.equal(call(d,f.notice?'explanation_assess_request':'explanation_prepare',{...binding,request:f.request}).isError,undefined);
  assert.equal(call(d,f.notice?'explanation_assessment_result':'explanation_fact_result',f.fact.input).isError,undefined);
  assert.equal(call(d,'explanation_result',f.fact.args).isError,undefined);
  const issued=f.notice?call(d,'explanation_notice_from_assessment',{...binding,assessment_result:f.fact.payload.result,language:'en'})
    :call(d,'explanation_check_final',f.finalArgs);
  assert.equal(issued.isError,undefined);return d;
}
test('complete final reads expose exact reviewed bytes and preserve notice-only approval on both hosts',()=>{
  for(const host of ['claude','codex'])for(const notice of [false,true]){
    const f=fixture(host,notice),payload=v.resultRead(f.args,f.final.packet);
    assert.equal(payload.delivery_status,notice?'approved_withholding_notice':'approved_explanation');
    assert.deepEqual(payload.delivery,{scope:notice?'withholding_notice':'explanation',final_text:f.text,final_sha256:textDigest(f.text)});
    assert.deepEqual(payload.result,f.payload.result);const settled=v.observeResultRead(f.attempt,f.args,payload);
    assert.equal(settled.status,notice?'withheld':'complete');assert.equal(settled.final_sha256,textDigest(f.text));
    assert.doesNotMatch(canonical(settled),/읽기 결과|Matched timings|final_text|"delivery":\{/);
    assert.throws(()=>v.observeResultRead(settled,f.args,payload),/reference_unavailable/);
  }
});
test('disclosure rejects missing, changed, self-rehashed, wrong-scope or extra delivery data',()=>{
  for(const notice of [false,true]){
    const f=fixture('claude',notice),good=v.resultRead(f.args,f.final.packet),before=canonical(f.attempt);
    for(const change of [p=>{delete p.delivery;},p=>{p.delivery.final_text='Changed.';},p=>{p.delivery.final_text='Changed.';p.delivery.final_sha256=textDigest('Changed.');},
      p=>{p.delivery.scope=notice?'explanation':'withholding_notice';},p=>{p.delivery.final_sha256='b'.repeat(64);},p=>{p.delivery.extra=true;},p=>{p.extra=true;}]){
      const bad=structuredClone(good);change(bad);assert.throws(()=>v.observeResultRead(f.attempt,f.args,bad));assert.equal(canonical(f.attempt),before);
    }
    assert.throws(()=>v.resultReference({...binding,challenge:'current',final_text:f.text},f.attempt));
  }
});
test('packet delivery rejects changed challenge, hash, kind, missing text and executable properties',()=>{
  const f=fixture();
  for(const change of [p=>{p.challenge='b'.repeat(64);},p=>{p.prompt_sha256='b'.repeat(64);},p=>{p.kind='fact';},p=>{p.extra=true;},p=>{
    const data=JSON.parse(p.prompt.slice(p.prompt.indexOf('\n')+1));delete data.data.final_text;p.prompt=p.prompt.slice(0,p.prompt.indexOf('\n')+1)+canonical(data);p.prompt_sha256=textDigest(p.prompt);
  }]){const bad=structuredClone(f.final.packet);change(bad);assert.throws(()=>v.resultRead(f.args,bad));}
  let invoked=0;const accessor={...f.final.packet};Object.defineProperty(accessor,'prompt',{enumerable:true,get(){invoked++;return f.final.packet.prompt;}});
  assert.throws(()=>v.resultRead(f.args,accessor));assert.equal(invoked,0);
});
test('normal MCP gets final bytes only from its own live candidate-bound final packet',()=>{
  for(const host of ['claude','codex'])for(const notice of [false,true]){
    const f=fixture(host,notice),d=cached(f),response=call(d,'explanation_result',f.args);
    const expected=v.resultRead(f.args,f.final.packet);
    if(host==='claude'&&!notice)expected.next_step=v.claudeResultNextStep(f.args.result,{remaining_facts:0,failed_facts:0,revision:0},f.final.packet.id);
    assert.equal(response.isError,undefined);assert.deepEqual(response.structuredContent,expected);
    assert.equal(response.structuredContent.delivery.final_text,f.text);assert.equal(call(connection(host),'explanation_result',f.args).isError,true);
    assert.equal(call(d,'explanation_result',{...f.args,candidate_sha256:'b'.repeat(64)}).isError,true);
    assert.equal(call(d,'explanation_result',{...f.args,final_text:f.text}).isError,true);
    const other='c'.repeat(64);assert.equal(call(d,'explanation_result',{...f.args,challenge:other,result:{...f.args.result,challenge:other}}).isError,true);
  }
});
test('the cache rejects an earlier final after a new revision is issued',()=>{
  for(const host of ['claude','codex']){
    const f=fixture(host),d=cached(f),args={...f.finalArgs,revision:1,final_text:'Both reads return3; no value changes.'},next=v.finalize(args);
    assert.equal(call(d,'explanation_check_final',args).isError,undefined);
    assert.equal(call(d,'explanation_result',f.args).isError,true);
    const submitted=v.finalReviewSubmission({...f.input,challenge:next.packet.challenge}),read={...binding,challenge:next.packet.challenge,result:submitted.result};
    const response=call(d,'explanation_result',read);assert.equal(response.isError,undefined);
    assert.equal(response.structuredContent.delivery.final_text,args.final_text);
    // A cache lookup is not native authorization: the old retained attempt rejects this new result.
    assert.throws(()=>v.observeResultRead(f.attempt,read,response.structuredContent,host),/reference_unavailable/);
  }
});
test('final delivery respects cache expiry and rejects a backwards clock',t=>{
  // Controlled clock input tests the actual cache comparison, not a substitute verdict or hook.
  let now=1000000;t.mock.method(Date,'now',()=>now);
  for(const elapsed of [1800001,-1]){
    now=1000000;const f=fixture(),d=cached(f),control=cached(f);assert.equal(call(control,'explanation_result',f.args).isError,undefined);
    now+=elapsed;assert.equal(call(d,'explanation_result',f.args).isError,true);
  }
});
test('fact and unresolved review reads never expose an approved delivery',()=>{
  const f=fixture(),fact=v.resultRead(f.fact.args);assert.equal(Object.hasOwn(fact,'delivery'),false);
  assert.equal(fact.delivery_status,'unverified');
  assert.throws(()=>v.resultRead(f.fact.args,f.final.packet));
  const input={...f.input,final_decision:'revise_explanation',issues:[{quote:'3',reason:'Synthetic disputed value.',evidence_needed:'Resolve the value.'}]};
  // Keep the existing strict review compiler; derive a genuine withheld result with its issue linked.
  input.claim_review={...f.input.claim_review,conditions_outcomes:[0]};
  const result=v.finalReviewSubmission(input).result,args={...f.args,result};
  assert.equal(result.verdict,'withheld');assert.equal(Object.hasOwn(v.resultRead(args),'delivery'),false);
  assert.throws(()=>v.resultRead(args,f.final.packet));
  assert.equal(Object.hasOwn(call(cached(f),'explanation_result',args).structuredContent,'delivery'),false);
});

test('native result observation rejects invented, missing and wrong-scope delivery status',()=>{
  for(const notice of [false,true]){
    const f=fixture('codex',notice),payload=v.resultRead(f.args,f.final.packet);
    for(const status of [undefined,'unverified',notice?'approved_explanation':'approved_withholding_notice']){
      const changed=structuredClone(payload);
      if(status===undefined)delete changed.delivery_status;else changed.delivery_status=status;
      assert.throws(()=>v.observeResultRead(f.attempt,f.args,changed));
    }
  }
});

test('all purpose-specific Codex readers accept only whole compact receipts in an unlabeled fence',async()=>{
  for(const purpose of ['complete','request_assessment','withholding'])for(const shape of ['bare','json','unlabeled','extra','wrong-label','full-unlabeled']){
    const f=fixture('codex',purpose!=='complete'),assessment=purpose==='request_assessment';
    const packet=assessment?f.plan.packets[0]:f.final.packet,actual=assessment?f.fact:f;
    const wire=v.dispatchPacket(f.plan,packet,{...binding,challenge:packet.challenge});
    const observed=v.resultRead(actual.args,assessment?undefined:packet);
    if(purpose==='complete')observed.next_step=v.resultNextStep(observed.result,{remaining_facts:0,failed_facts:0,revision:0});
    const receipt=actual.payload.receipt_text,returned=shape==='bare'?receipt:shape==='json'?'```json\n'+receipt+'\n```':
      shape==='unlabeled'?'```\n'+receipt+'\n```':shape==='extra'?'Explanation.\n```\n'+receipt+'\n```':
      shape==='wrong-label'?'```javascript\n'+receipt+'\n```':'```\n'+actual.payload.final_text+'\n```';
    let printed,reads=0;
    const tools={mcp__ttak_scenario__explanation_dispatch:async()=>({structuredContent:wire}),multi_agent_v1__spawn_agent:async()=>({agent_id:'child'}),
      multi_agent_v1__wait_agent:async()=>({timed_out:false,status:{child:{completed:returned}}}),multi_agent_v1__close_agent:async()=>({}),
      mcp__ttak_scenario__explanation_result:async()=>{reads++;return {structuredContent:observed};}};
    const run=Object.getPrototypeOf(async function(){}).constructor('tools','text','store','load',v.nativeAdapter('codex',purpose).spawn_agent_code);
    const execute=()=>run(tools,x=>{printed=x;},()=>{},()=>undefined);
    if(['extra','wrong-label','full-unlabeled'].includes(shape)){await assert.rejects(execute());assert.equal(printed,undefined);assert.equal(reads,0);}
    else{await execute();assert.equal(reads,1);assert.equal(printed.delivery_status,observed.delivery_status);
      if(assessment)assert.equal(printed.delivery,undefined);else assert.equal(printed.delivery.final_text,f.text);}
  }
});
test('Codex recipe prints the observed delivery unchanged and rejects a body different from its dispatched final',async()=>{
  for(const changed of [false,true]){
    const f=fixture('codex'),wire=v.dispatchPacket(f.plan,f.final.packet,{...binding,challenge:f.final.packet.challenge});
    const observed=v.resultRead(f.args,f.final.packet);observed.next_step=v.resultNextStep(observed.result,{remaining_facts:0,failed_facts:0,revision:0});
    if(changed)observed.delivery.final_text='Changed.';let printed,held;
    const tools={mcp__ttak_scenario__explanation_dispatch:async()=>({structuredContent:wire}),multi_agent_v1__spawn_agent:async()=>({agent_id:'child'}),
      multi_agent_v1__wait_agent:async()=>({timed_out:false,status:{child:{completed:f.payload.receipt_text}}}),multi_agent_v1__close_agent:async()=>({}),
      mcp__ttak_scenario__explanation_result:async()=>({structuredContent:observed})};
    const run=Object.getPrototypeOf(async function(){}).constructor('tools','text','store','load',v.nativeAdapter('codex').spawn_agent_code);
    const execute=()=>run(tools,x=>{printed=x;},(k,x)=>{held=x;},()=>undefined);
    if(changed){await assert.rejects(execute());assert.equal(printed,undefined);assert.equal(held,undefined);}
    else{await execute();assert.deepEqual(printed.delivery,observed.delivery);assert.equal(printed.delivery.final_text,f.text);
      assert.deepEqual(held,{...binding,previous:{id:f.final.packet.id,result:f.payload.result}});}
  }
});
