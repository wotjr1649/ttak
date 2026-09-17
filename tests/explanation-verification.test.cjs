'use strict';
// Synthetic hook events test the receipt protocol, not model accuracy or native delivery.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const v=require('../scripts/explanation-verification.cjs');
const a=require('../scripts/explanation-attempt.cjs');
const {canonical,digest,textDigest}=require('../scripts/verification-packet.cjs');
const {handleEvent}=require('../hooks/scenario-evidence.cjs');
const {handle:stop}=require('../hooks/scenario-stop.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {assessmentResult,assessmentSubmission,assessRequest}=require('./helpers/request-assessment.cjs');
const {checkedReviewAnswer,finalReviewSubmission}=require('./helpers/final-review.cjs');
const binding={attempt_id:'12345678-1234-1234-1234-123456789abc',candidate_sha256:'a'.repeat(64)};
const request='Explain the fictional Nori register. Given reference: A Nori register stores one integer. Reading returns the stored integer without changing it.';
const source='A Nori register stores one integer. Reading returns the stored integer without changing it.';
const finalText='A Nori register holds one integer. Reading it returns that integer and leaves the stored value unchanged.';
function preparation(extra={}) {
  return {...binding,request,blocks:[{text:finalText,question_ids:['Q1']}],
    questions:[{id:'Q1',kind:'mechanism',target:'Nori register reading',conditions:'Use the supplied fictional definition.',source_ids:['S1']}],
    sources:[{id:'S1',version:'supplied definition',text:source}],...extra};
}
function answer(packet,extra={}) {
  return {protocol:v.protocol,challenge:packet.challenge,kind:packet.kind,
    verdict:packet.kind==='fact'?'answered':'complete',answer:packet.kind==='final'?checkedReviewAnswer(extra.issues?.length??0):'Reading returns the stored integer and does not change the register.',
    issues:[],checked_questions:packet.kind==='final'?['Q1']:[],...extra};
}
function submissionArgs(result,kind=result.kind){
  if(kind==='assessment')return assessmentSubmission(result);
  if(kind==='notice'){
    assert.deepEqual(result.checked_questions,[v.assessmentId]);
    return {challenge:result.challenge,notice_decision:result.verdict==='complete'?'approve_notice':'revise_notice',...JSON.parse(result.answer),checked_questions:result.checked_questions,issues:result.issues};
  }
  if(kind==='final')return finalReviewSubmission(result);
  const {protocol,kind:resultKind,checked_questions,...args}=result;
  return {...args,...(kind==='final'?{checked_questions}:{})};
}
function submissionReceipt(attempt,result,agent,id){
  const kind=attempt.verification.purpose==='withholding'?'notice':attempt.verification.purpose==='request_assessment'?'assessment':result.kind,args=submissionArgs(result,kind),input={agent_id:agent,tool_use_id:id,tool_input:args};
  attempt=v.observeSubmission(attempt,{...input,hook_event_name:'PreToolUse'},kind);
  return v.observeSubmission(attempt,{...input,hook_event_name:'PostToolUse',submission_payload:v.resultSubmission(args,kind)},kind);
}
function initial(extra={}) {
  const args=preparation(extra),plan=v.prepare(args);
  const attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
  return {args,plan,attempt};
}
function spawn(packet,host='claude',id='spawn-1') {
  return {hook_event_name:'PreToolUse',tool_name:host==='claude'?'Agent':'spawn_agent',tool_use_id:id,
    tool_input:host==='claude'?{description:'Check one packet',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}
      :{message:v.launchPrompt(packet.challenge),model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
}
function receipt(attempt,packet,{host='claude',id='spawn-1',agent='agent-1',result=answer(packet),postFirst=false}={}) {
  const pre=spawn(packet,host,id);
  attempt=v.observeAgent(attempt,pre);
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:agent,
    agent_type:host==='claude'?v.agentType:'default',model:host==='claude'?'claude-haiku-4-5-20251001':'gpt-5.6-luna'});
  const retrieval={hook_event_name:'PreToolUse',agent_id:agent,tool_use_id:id+'-read',tool_input:{challenge:packet.challenge}};
  attempt=v.observePacket(attempt,retrieval);
  attempt=v.observePacket(attempt,{...retrieval,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
  attempt=submissionReceipt(attempt,result,agent,id+'-submit');
  const post={...pre,hook_event_name:'PostToolUse',tool_response:host==='claude'
    ?[{type:'text',text:canonical(result)+'\nagentId: '+agent+' (for resuming)'}]:{agent_id:agent}};
  const end={hook_event_name:'SubagentStop',agent_id:agent,last_assistant_message:canonical(result)};
  for(const event of postFirst?[post,end]:[end,post])attempt=v.observeAgent(attempt,event);
  return attempt;
}
function finalArgs(plan,result=answer(plan.packets[0]),extra={}) {
  return {...binding,request,final_text:finalText,facts:[{id:'Q1',result}],revision:0,...extra};
}

test('fact packets omit the actual draft and sibling answers and bind changed draft bytes',()=>{
  const args=preparation({blocks:[{text:'DRAFT_ONLY_108: the parent proposes a claim.',question_ids:['Q1']}]});
  const plan=v.prepare(args),packet=JSON.parse(plan.packets[0].prompt.split('\n').slice(1).join('\n'));
  assert.equal(packet.data.question,'What mechanism applies to the named target under the supplied conditions?');
  assert.equal(packet.data.sources[0].text,source);assert.equal(packet.data.source_mode,'supplied_sources');
  assert.doesNotMatch(plan.packets[0].prompt,/DRAFT_ONLY_108|sibling_result|draft_sha256/);
  assert.equal(Object.hasOwn(packet.data,'final_text'),false);assert.equal(Object.hasOwn(packet.data,'draft'),false);
  assert.equal(packet.data.original_request,request);
  assert.equal(plan.complete_authorized,false);assert.equal(plan.independent_native_agents_required,1);
  const changed=v.prepare({...args,blocks:[{text:'Different actual claim.',question_ids:['Q1']}]});
  assert.notEqual(plan.draft_sha256,changed.draft_sha256);assert.notEqual(plan.packets[0].challenge,changed.packets[0].challenge);
});

test('source-less checks are explicit model knowledge, and invented or dropped source coverage is rejected',()=>{
  const args=preparation({sources:[],questions:[{id:'Q1',kind:'mechanism',target:'Nori register',conditions:'Fictional definition.',source_ids:[]}]});
  assert.match(v.prepare(args).packets[0].prompt,/model_knowledge_without_source_certification/);
  for(const mutate of [
    value=>{value.sources[0].text='An invented source guarantees a different result.';},
    value=>{value.blocks[0].question_ids=['Q2'];},
    value=>{value.questions.push({...value.questions[0],id:'Q2'});},
    value=>{value.questions[0].source_ids=['S2'];},
    value=>{value.questions[0].supported=true;}
  ]){const value=preparation();mutate(value);assert.throws(()=>v.prepare(value));}
});

test('wire parsing accepts only the complete bound result and retains adverse verdicts',()=>{
  const {plan}=initial(),packet=plan.packets[0],result=answer(packet);
  assert.deepEqual(v.parseAnswer(canonical(result),packet),result);
  assert.deepEqual(v.parseAnswer('```json\n'+canonical(result)+'\n```',packet),result);
  for(const text of ['Here is my answer: '+canonical(result),canonical(result)+'\n'+canonical(result),
    canonical({...result,challenge:'b'.repeat(64)}),canonical({...result,supported:true}),
    canonical({...result,verdict:'unresolved'}),canonical({...result,checked_questions:['Q2']})])assert.throws(()=>v.parseAnswer(text,packet));
  const adverse=answer(packet,{verdict:'unresolved',issues:[{quote:'Missing initial value',reason:'The requested number is absent.',evidence_needed:'The initial value.'}]});
  assert.equal(v.parseAnswer(canonical(adverse),packet).verdict,'unresolved');
});

test('an asserted fact answer or plan on a different request cannot authorize a final check',()=>{
  const {attempt,plan}=initial(),args=finalArgs(plan),payload=v.finalize(args);
  assert.throws(()=>v.registerFinal(attempt,payload,args),/unobserved_fact/);
  assert.throws(()=>v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest('Different request')),/plan_binding/);
  assert.throws(()=>v.registerPlan(attempt,plan,textDigest(request)),/plan_binding/);
  assert.throws(()=>a.checkedAttempt({...attempt,status:'complete',final_sha256:textDigest(finalText)}),/independent_completion/);
});

test('both native lifecycle and spawn-return observations are necessary in either host order',()=>{
  for(const host of ['claude','codex'])for(const postFirst of [false,true]){
    let {attempt,plan}=initial();const packet=plan.packets[0],pre=spawn(packet,host);
    const launched=v.observeAgent(attempt,pre);
    const postOnly=v.observeAgent(launched,{...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'agent-1'}});
    assert.equal(postOnly.verification.facts[0].phase,'launched');
    attempt=receipt(attempt,packet,{host,postFirst});
    const slot=attempt.verification.facts[0];
    assert.equal(slot.phase,'returned');assert.equal(slot.reply_sha256,digest(answer(packet)));assert.equal(attempt.status,'pending');
    const args=finalArgs(plan),payload=v.finalize(args);
    attempt=v.registerFinal(attempt,payload,args);
    assert.equal(attempt.status,'pending');
    attempt=receipt(attempt,payload.packet,{host,postFirst,id:'spawn-2',agent:'agent-2'});
    assert.equal(attempt.status,'complete');assert.equal(attempt.final_sha256,textDigest(finalText));
    assert.equal(a.checkedAttempt(attempt),attempt);
  }
});

test('native packet alteration, duplicate execution, wrong model, forked context and concurrent checks fail closed',()=>{
  const {attempt,plan}=initial(),packet=plan.packets[0];
  assert.throws(()=>v.observeAgent(a.begin(binding.attempt_id,binding.candidate_sha256),spawn(packet)),/plan_not_active/);
  for(const mutate of [
    value=>{value.tool_input.prompt+=' unreviewed addition';},
    value=>{value.tool_input.model='claude-sonnet-5';},
    value=>{value.tool_input.run_in_background=true;},
    value=>{value.tool_input.resume='previous-agent';}
  ]){const event=spawn(packet);mutate(event);assert.throws(()=>v.observeAgent(attempt,event));}
  for(const mutate of [value=>{value.tool_input.fork_context=true;},value=>{value.tool_input.model='different-model';},
    value=>{value.tool_input.reasoning_effort='low';}]){
    const event=spawn(packet,'codex');mutate(event);assert.throws(()=>v.observeAgent(attempt,event));
  }
  const launched=v.observeAgent(attempt,spawn(packet));
  assert.throws(()=>v.observeAgent(launched,spawn(packet)),/agent_budget/);
  assert.throws(()=>v.observeAgent(launched,{hook_event_name:'SubagentStart',agent_id:'agent-1',agent_type:v.agentType,model:'different-model'}),/agent_model/);
  assert.throws(()=>v.observeAgent(receipt(attempt,packet),spawn(packet)),/agent_budget/);
});

test('changed agent IDs, final omission, stale answers and changed fact bodies cannot become completion',()=>{
  let {attempt,plan}=initial();const packet=plan.packets[0],pre=spawn(packet);
  let launched=v.observeAgent(attempt,pre);
  launched=v.observeAgent(launched,{hook_event_name:'SubagentStart',agent_id:'actual-agent',agent_type:v.agentType});
  assert.equal(v.observeAgent(launched,{hook_event_name:'SubagentStop',agent_id:'unrelated-agent',last_assistant_message:canonical(answer(packet))}),null);
  assert.throws(()=>v.observeAgent(launched,{...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'wrong-agent'}}),/agent_id_mismatch/);
  assert.throws(()=>v.observeAgent(launched,{hook_event_name:'SubagentStop',agent_id:'actual-agent',last_assistant_message:canonical(answer(packet))}),/packet_not_received/);
  const retrieval={hook_event_name:'PreToolUse',agent_id:'actual-agent',tool_use_id:'packet-read',tool_input:{challenge:packet.challenge}};
  launched=v.observePacket(launched,retrieval);
  launched=v.observePacket(launched,{...retrieval,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
  assert.throws(()=>v.observeAgent(launched,{hook_event_name:'SubagentStop',agent_id:'actual-agent',last_assistant_message:canonical(answer(packet,{challenge:'b'.repeat(64)}))}),/answer_binding/);
  attempt=receipt(attempt,packet);
  const args=finalArgs(plan,answer(packet,{answer:'Altered answer pretending to be independently observed.'}));
  assert.throws(()=>v.registerFinal(attempt,v.finalize(args),args),/unobserved_fact/);
  const valid=finalArgs(plan),payload=v.finalize(valid);attempt=v.registerFinal(attempt,payload,valid);
  assert.throws(()=>receipt(attempt,payload.packet,{id:'spawn-final',agent:'agent-final',result:answer(payload.packet,{checked_questions:[]})}),/verification_invalid_list/);
  assert.throws(()=>receipt(attempt,payload.packet,{id:'spawn-final',agent:'agent-final',result:answer(payload.packet,{checked_questions:['WrongQuestion']})}),/question_coverage/);
});

test('a negative fact cannot be promoted and only one changed final revision is available',()=>{
  let {attempt,plan}=initial();const negative=answer(plan.packets[0],{verdict:'unresolved',issues:[{quote:'Value',reason:'The requested value is absent.',evidence_needed:'The value.'}]});
  const failed=receipt(attempt,plan.packets[0],{result:negative});
  assert.equal(failed.status,'pending');assert.throws(()=>v.finalize(finalArgs(plan,negative)),/unresolved_fact/);
  attempt=receipt(attempt,plan.packets[0]);let args=finalArgs(plan),payload=v.finalize(args);
  attempt=v.registerFinal(attempt,payload,args);
  const withheld=answer(payload.packet,{verdict:'withheld',issues:[{quote:'One integer',reason:'The final sentence needs correction.',evidence_needed:'Correct the sentence.'}]});
  attempt=receipt(attempt,payload.packet,{id:'final-0',agent:'final-agent-0',result:withheld});
  assert.equal(attempt.status,'pending');
  assert.throws(()=>v.registerFinal(attempt,v.finalize({...args,revision:1}),{...args,revision:1}),/revision_not_available/);
  args={...args,revision:1,final_text:finalText+' The value can be read repeatedly.'};payload=v.finalize(args);
  attempt=v.registerFinal(attempt,payload,args);
  attempt=receipt(attempt,payload.packet,{id:'final-1',agent:'final-agent-1',result:answer(payload.packet,{verdict:'withheld',issues:withheld.issues})});
  assert.throws(()=>v.registerFinal(attempt,v.finalize({...args,final_text:finalText+' A third draft.'}),args),/revision_not_available/);
});

function fixture(body,{host='claude'}={}){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'verification-test-'));
  const options={root,enabled:true,now:1000000},base={session_id:'verification-session',turn_id:'parent-turn'};
  const file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json');
  const event=input=>handleEvent({...base,...input,...(host==='claude'&&input.tool_name?.startsWith('mcp__ttak_scenario__')
    ?{tool_name:input.tool_name.replace('mcp__ttak_scenario__','mcp__plugin_ttak_ttak_scenario__')}:{})},options);
  const finish=text=>stop({...base,hook_event_name:'Stop',last_assistant_message:text,stop_hook_active:true},true,options);
  const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  const call=(name,args,extra={})=>{
    const response=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
    assert.equal(response.isError,undefined);
    const output=event({hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__'+name,tool_input:args,tool_response:response,...extra});
    return {output,payload:response.structuredContent};
  };
  const read=()=>JSON.parse(fs.readFileSync(file,'utf8'));
  const assess=prompt=>{
    event({hook_event_name:'UserPromptSubmit',prompt});const args={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate,request:prompt};
    const result=assessRequest(args,(name,extra)=>({...base,hook_event_name:name,...extra}),options,dispatch,{host});
    return {...args,assessment_result:result};
  };
  try{event({hook_event_name:'UserPromptSubmit',prompt:request});body({event,finish,file,call,dispatch,read,assess});}
  finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}
function hookReceipt(event,packet,id,call,result=answer(packet)){
  const pre=spawn(packet,'claude','spawn-'+id),kind=/^WITHHOLDING[01]$/.test(packet.id)?'notice':packet.kind;
  assert.deepEqual(event(pre),{});
  const started=event({hook_event_name:'SubagentStart',agent_id:'agent-'+id,agent_type:v.agentType,turn_id:'child-turn-'+id});
  assert.equal(started.hookSpecificOutput.hookEventName,'SubagentStart');
  assert.equal(started.hookSpecificOutput.additionalContext,v.verifierInstruction(packet.challenge,'mcp',kind));
  const child={agent_id:'agent-'+id,turn_id:'child-turn-'+id,tool_use_id:'read-'+id};
  assert.deepEqual(event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_packet',tool_input:{challenge:packet.challenge},...child}),{});
  assert.deepEqual(call('explanation_packet',{challenge:packet.challenge},child).output,{});
  hookSubmission(event,call,result,{...child,tool_use_id:'submit-'+id},kind);
  for(const input of [{hook_event_name:'SubagentStop',agent_id:'agent-'+id,last_assistant_message:canonical(result),turn_id:'child-turn-'+id},
    {...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'agent-'+id}}])assert.deepEqual(event(input),{});
  return result;
}
function hookSubmission(event,call,result,child,kind=result.kind){
  const name='explanation_'+kind+'_result',args=submissionArgs(result,kind);
  assert.deepEqual(event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__'+name,tool_input:args,...child}),{});
  assert.deepEqual(call(name,args,child).output,{});
}

test('normal MCP and hook path stores only receipts and binds Stop to the exact completed body',()=>fixture(({event,finish,file,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const plan=call('explanation_prepare',preparation(bound));assert.deepEqual(plan.output,{});
  const result=hookReceipt(event,plan.payload.packets[0],'fact',call);
  const final=call('explanation_check_final',{...finalArgs(plan.payload,result),...bound});assert.deepEqual(final.output,{});
  assert.equal(read().attempt.status,'pending');hookReceipt(event,final.payload.packet,'final',call);
  assert.equal(read().attempt.status,'complete');assert.deepEqual(finish(finalText),{});
  event({hook_event_name:'SessionEnd'});assert.deepEqual(event({hook_event_name:'SessionStart',source:'resume'}),{});
  const stored=fs.readFileSync(file,'utf8');assert.doesNotMatch(stored,/Nori|stored integer|explain the|final_text|tool_input|"prompt"|"answer"/i);
  assert.equal(finish(finalText+' The register can never change.').continue,false);
  assert.equal(read().attempt.status,'unavailable');
}));

test('an independently completed legacy full-result attempt permits only one exact-body delivery correction',()=>fixture(({event,file,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const plan=call('explanation_prepare',preparation(bound));
  const result=hookReceipt(event,plan.payload.packets[0],'fact-copy',call);
  const final=call('explanation_check_final',{...finalArgs(plan.payload,result),...bound});
  hookReceipt(event,final.payload.packet,'final-copy',call);
  const decided=read(),root=path.dirname(path.dirname(file)),options={root,enabled:true,now:1000000};
  const finish=text=>stop({session_id:'verification-session',turn_id:'parent-turn',hook_event_name:'Stop',last_assistant_message:text,stop_hook_active:false},true,options);
  const correction=finish(finalText+' Another unverified claim.');
  assert.equal(correction.decision,'block');assert.match(correction.reason,/already independently approved/);
  assert.match(correction.reason,/legacy full-result verifier return without explanation_result, copy the literal final_text from the reviewed final packet instead/);
  const reviewed=v.finalize({...finalArgs(plan.payload,result),...bound}).packet;
  assert.equal(reviewed.prompt_sha256,final.payload.packet.packet_sha256);
  assert.equal(JSON.parse(reviewed.prompt.slice(reviewed.prompt.indexOf('\n')+1)).data.final_text,finalText);
  assert.doesNotMatch(correction.reason,/final_text argument of the latest explanation_check_final/);
  assert.doesNotMatch(correction.reason,/first call|start explanation_prepare|TTAK registered/);
  assert.deepEqual(event({hook_event_name:'UserPromptSubmit',prompt:correction.reason}),{});
  assert.deepEqual(read().attempt,{...decided.attempt,corrections:1});
  assert.deepEqual(finish(finalText),{});
  assert.equal(finish(finalText+' Another unverified claim.').continue,false);
  assert.equal(finish(finalText).continue,false);
}));

test('normal plugin-scoped MCP names reach the same exact receipt checks while lookalikes do not',()=>fixture(({event,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate},args=preparation(bound);
  const scoped=call('explanation_prepare',args,{tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_prepare'});
  assert.deepEqual(scoped.output,{});assert.equal(read().attempt.verification.available_id,'Q1');
  const packet=scoped.payload.packets[0];event(spawn(packet));event({hook_event_name:'SubagentStart',agent_id:'scoped-child',agent_type:v.agentType});
  const child={agent_id:'scoped-child',tool_use_id:'scoped-read',turn_id:'scoped-turn',tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_packet'};
  assert.deepEqual(event({hook_event_name:'PreToolUse',tool_input:{challenge:packet.challenge},...child}),{});
  const fetched=call('explanation_packet',{challenge:packet.challenge},child);assert.deepEqual(fetched.output,{});
  assert.equal(read().attempt.verification.facts[0].retrieved,true);
  const prior=JSON.stringify(read());
  assert.deepEqual(event({hook_event_name:'PostToolUse',tool_name:'mcp__plugin_other_ttak_scenario__explanation_packet',tool_input:{challenge:packet.challenge},tool_response:{}}),{});
  assert.equal(JSON.stringify(read()),prior);
}));

test('rejected native or final bindings stay unavailable and cannot be repaired by an asserted success',()=>fixture(({event,finish,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const plan=call('explanation_prepare',preparation(bound));
  const eventInput=spawn(plan.payload.packets[0]);eventInput.tool_input.run_in_background=true;
  assert.equal(event(eventInput).hookSpecificOutput.permissionDecision,'deny');
  assert.equal(read().status,'unavailable');assert.equal(finish(finalText).continue,false);
  // Native 108: an unavailable state must not turn the same launch guard into a no-op.
  assert.equal(event(spawn(plan.payload.packets[0])).hookSpecificOutput?.permissionDecision,'deny');
}));

test('a fake parent fact report fails durably in the normal hook path',()=>fixture(({call,read,finish})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const plan=call('explanation_prepare',preparation(bound));
  const fake=call('explanation_check_final',{...finalArgs(plan.payload),...bound});
  assert.match(fake.output.systemMessage,/could not record/);
  assert.equal(read().status,'unavailable');assert.equal(finish(finalText).continue,false);
}));

test('a malformed child result remains failed even when the host gives it a child turn ID',()=>fixture(({event,call,read,finish})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const plan=call('explanation_prepare',preparation(bound)),packet=plan.payload.packets[0],pre=spawn(packet);
  event(pre);event({hook_event_name:'SubagentStart',agent_id:'child-a',agent_type:v.agentType,turn_id:'child-turn'});
  assert.match(event({hook_event_name:'SubagentStop',agent_id:'child-a',turn_id:'child-turn',last_assistant_message:'not a bound JSON result'}).systemMessage,/could not record/);
  assert.equal(read().status,'unavailable');
  event({...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'child-a'}});
  event({hook_event_name:'SubagentStop',agent_id:'child-a',turn_id:'child-turn',last_assistant_message:canonical(answer(packet))});
  assert.equal(finish(finalText).continue,false);
}));

function twoQuestions(){
  const args=preparation();args.questions.push({id:'Q2',kind:'relationship',target:'Stored value before and after reading',conditions:'Use the stated definition.',source_ids:['S1']});
  args.blocks[0].question_ids.push('Q2');return args;
}

test('only the first packet is exposed and a known later packet cannot launch before its receipt transition',()=>{
  const args=twoQuestions(),plan=v.prepare(args),exposed=v.exposePlan(plan);
  assert.equal(exposed.packets.length,1);assert.deepEqual(exposed.pending_question_ids,['Q2']);
  assert.equal(JSON.stringify(exposed).includes(plan.packets[1].prompt_sha256),false);
  let attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
  assert.throws(()=>v.observeAgent(attempt,spawn(plan.packets[1])),/agent_budget/);
  const nextArgs={...binding,previous:{id:'Q1',result:answer(plan.packets[0])}},payload=v.nextPacket(plan,nextArgs);
  assert.throws(()=>v.registerNext(attempt,nextArgs,payload),/next_unobserved/);
  attempt=receipt(attempt,plan.packets[0]);
  assert.throws(()=>v.observeAgent(attempt,spawn(plan.packets[1])),/agent_budget/);
  attempt=v.registerNext(attempt,nextArgs,payload);
  assert.equal(attempt.verification.available_id,'Q2');
  assert.equal(v.observeAgent(attempt,spawn(payload.packet,'claude','spawn-2')).verification.facts[1].phase,'launched');
  assert.throws(()=>v.registerNext(attempt,nextArgs,payload),/next_unobserved/);
});

test('next packet cannot change the prompt, candidate, previous answer or packet identity',()=>{
  const plan=v.prepare(twoQuestions());let attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
  attempt=receipt(attempt,plan.packets[0]);const args={...binding,previous:{id:'Q1',result:answer(plan.packets[0])}};
  for(const mutate of [p=>{p.packet.prompt+=' Additional instruction';},p=>{p.packet.id='Q1';},p=>{p.candidate_sha256='b'.repeat(64);},
    p=>{p.previous_result_sha256='b'.repeat(64);},p=>{p.native_dispatch.spawn_agent_code='Changed adapter code';}]){
    const payload=JSON.parse(JSON.stringify(v.nextPacket(plan,args)));mutate(payload);
    assert.throws(()=>v.registerNext(attempt,args,payload));
  }
  const altered={...args,previous:{id:'Q1',result:answer(plan.packets[0],{answer:'A parent-edited fact answer.'})}};
  assert.throws(()=>v.registerNext(attempt,altered,v.nextPacket(plan,altered)),/next_unobserved/);
});

test('typed result submission fills protocol fields but never certifies a parent claim or erases issues',()=>{
  const {plan,attempt}=initial(),packet=plan.packets[0];
  const args={challenge:packet.challenge,verdict:'answered',answer:'The stipulated read returns the stored integer without changing it.',issues:[]};
  const submitted=v.resultSubmission(args,'fact');
  assert.deepEqual(v.parseAnswer(submitted.final_text,packet),submitted.result);assert.deepEqual(submitted.result.checked_questions,[]);
  assert.throws(()=>v.resultSubmission({...args,checked_questions:[]},'fact'),/verification_invalid_fields/);
  assert.throws(()=>v.resultSubmission({...args,checked_questions:['What is a register?']},'fact'));
  const issues=[{quote:'Measured slowdown',reason:'No measurement is available.',evidence_needed:'The requested measurement.'}];
  assert.throws(()=>v.resultSubmission({...args,issues},'fact'),/unresolved_claim/);
  assert.equal(v.resultSubmission({...args,verdict:'unresolved',issues},'fact').result.verdict,'unresolved');
  assert.throws(()=>a.checkedAttempt({...attempt,status:'complete',final_sha256:textDigest(finalText)}),/independent_completion/);
});

test('native packet submission schemas match the actual typed tool inputs rather than their returned JSON',()=>{
  const {plan}=initial(),fact=plan.packets[0],final=v.finalize(finalArgs(plan)).packet;
  for(const packet of [fact,final]){
    const wire=JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1)),tool=v.resultTools.find(t=>t.name==='explanation_'+packet.kind+'_result');
    assert.equal(Object.hasOwn(wire,'result_schema'),false);assert.equal(wire.submission.tool,tool.name);
    const schema=wire.submission.input_schema;assert.deepEqual(schema.required,tool.inputSchema.required);
    assert.deepEqual(Object.keys(schema.properties).sort(),Object.keys(tool.inputSchema.properties).sort());
    assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.properties.challenge.enum,['current',packet.challenge]);
    const normalized=structuredClone(schema);normalized.properties.challenge=tool.inputSchema.properties.challenge;
    if(packet.kind==='final'){
      assert.deepEqual(schema.properties.checked_questions.items.enum,['Q1']);
      delete normalized.properties.checked_questions.items.enum;
    }else{
      assert.equal(Object.hasOwn(schema.properties,'checked_questions'),false);
      assert.deepEqual(schema.properties.answer,tool.inputSchema.properties.answer.anyOf[0]);
      assert.equal(Object.hasOwn(schema,'$defs'),false);
      normalized.properties.answer=tool.inputSchema.properties.answer;normalized.$defs=tool.inputSchema.$defs;
    }
    assert.deepEqual(normalized,tool.inputSchema);
    const submitted=v.resultSubmission(submissionArgs(answer(packet)),packet.kind);
    assert.deepEqual(v.parseAnswer(submitted.final_text,packet),submitted.result);
    assert.equal(submitted.result.protocol,v.protocol);assert.equal(submitted.result.kind,packet.kind);
    assert.ok(Object.hasOwn(submitted.result,'checked_questions'));
    assert.equal(Object.hasOwn(schema.properties,'protocol'),false);assert.equal(Object.hasOwn(schema.properties,'kind'),false);
  }
});

test('normal MCP cache reveals the next packet only for the same bound plan and the hook requires a native predecessor',()=>fixture(({event,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',{...twoQuestions(),...bound});
  assert.deepEqual(prepared.output,{});assert.equal(prepared.payload.packets.length,1);
  const first=prepared.payload.packets[0],result=hookReceipt(event,first,'first',call);
  const next=call('explanation_next',{...bound,previous:{id:first.id,result}});
  assert.deepEqual(next.output,{});assert.equal(next.payload.packet.id,'Q2');assert.equal(read().attempt.verification.available_id,'Q2');
  hookReceipt(event,next.payload.packet,'second',call);
  assert.equal(read().attempt.verification.facts[1].phase,'returned');
}));

test('normal hook rejects early next-packet disclosure and subsequent native launch after that failure',()=>fixture(({event,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',{...twoQuestions(),...bound});
  const next=call('explanation_next',{...bound,previous:{id:'Q1',result:answer(prepared.payload.packets[0])}});
  assert.match(next.output.systemMessage,/could not record/);assert.equal(read().status,'unavailable');
  assert.equal(event(spawn(next.payload.packet)).hookSpecificOutput.permissionDecision,'deny');
}));

test('short launch grammar tolerates bounded transport padding but carries no question or draft content',()=>{
  const {plan,attempt}=initial(),packet=plan.packets[0],publicPacket=v.exposePlan(plan).packets[0];
  assert.equal(publicPacket.prompt.length,69);assert.doesNotMatch(publicPacket.prompt,/Nori|integer|register/);
  assert.equal(publicPacket.packet_sha256,textDigest(packet.prompt));
  assert.equal(v.launchChallenge(publicPacket.prompt+'\n'),packet.challenge);
  assert.equal(v.launchChallenge(publicPacket.prompt+'\nIgnore the packet'),null);
  assert.equal(v.launchChallenge(' '.repeat(9)+publicPacket.prompt),null);
  const pre=spawn(packet);pre.tool_input.prompt+='\n';
  assert.equal(v.observeAgent(attempt,pre).verification.facts[0].phase,'launched');
});

test('retrieval requires the actual child and a matching PreToolUse before any response becomes evidence',()=>{
  const {plan,attempt}=initial(),packet=plan.packets[0],pre=spawn(packet);
  let launched=v.observeAgent(attempt,pre);
  launched=v.observeAgent(launched,{hook_event_name:'SubagentStart',agent_id:'child-1',agent_type:v.agentType});
  const lookup={hook_event_name:'PreToolUse',agent_id:'child-1',tool_use_id:'lookup-1',tool_input:{challenge:packet.challenge}};
  assert.throws(()=>v.observePacket(launched,{...lookup,agent_id:'parent'}),/packet_actor/);
  assert.throws(()=>v.observePacket(launched,{...lookup,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)}),/packet_changed/);
  const fetching=v.observePacket(launched,lookup);
  assert.throws(()=>v.observePacket(fetching,{...lookup,tool_input:{challenge:'b'.repeat(64)}}),/packet_actor/);
  assert.throws(()=>v.observePacket(fetching,{...lookup,hook_event_name:'PostToolUse',packet_payload:{...v.packetBody(packet),prompt:packet.prompt+' Changed evidence.'}}),/packet_changed/);
  const received=v.observePacket(fetching,{...lookup,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
  assert.equal(received.verification.facts[0].retrieved,true);
  assert.throws(()=>v.observePacket(received,lookup),/packet_actor/);
});

test('normal hook denies a parent attempting to fetch a child packet',()=>fixture(({event,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound)),packet=prepared.payload.packets[0];
  event(spawn(packet));event({hook_event_name:'SubagentStart',agent_id:'native-child',agent_type:v.agentType});
  const denied=event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_packet',tool_use_id:'parent-fetch',tool_input:{challenge:packet.challenge}});
  assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');assert.equal(read().status,'unavailable');
  assert.doesNotMatch(JSON.stringify(denied),/Nori|stored integer/);
}));

test('child-session packet lookup locates only the bound parent receipt without storing packet text',()=>fixture(({event,call,read,file})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound)),packet=prepared.payload.packets[0],pre=spawn(packet,'codex');
  event(pre);event({hook_event_name:'SubagentStart',agent_id:'child-session',agent_type:'default',turn_id:'child-turn'});
  const child={session_id:'child-session',turn_id:'child-turn',tool_use_id:'child-fetch'};
  assert.deepEqual(event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_packet',tool_input:{challenge:packet.challenge},...child}),{});
  const fetched=call('explanation_packet',{challenge:packet.challenge},child);assert.deepEqual(fetched.output,{});
  assert.equal(fetched.payload.prompt_sha256,packet.packet_sha256);assert.match(fetched.payload.prompt,/Nori/);
  assert.equal(read().attempt.verification.facts[0].retrieved,true);
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/Nori|original_request|stored integer/);
  hookSubmission(event,call,answer(packet),{...child,tool_use_id:'child-submit'});
  assert.deepEqual(event({hook_event_name:'SubagentStop',agent_id:'child-session',last_assistant_message:canonical(answer(packet)),turn_id:'child-turn'}),{});
  assert.deepEqual(event({...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'child-session'}}),{});
  assert.equal(read().attempt.verification.facts[0].phase,'returned');
}));

test('a changed retrieved payload fails the parent attempt and cannot be retried as a success',()=>fixture(({event,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound)),packet=prepared.payload.packets[0],pre=spawn(packet);
  event(pre);event({hook_event_name:'SubagentStart',agent_id:'actual-child',agent_type:v.agentType});
  const child={agent_id:'actual-child',turn_id:'child-turn',tool_use_id:'get-packet'};
  event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_packet',tool_input:{challenge:packet.challenge},...child});
  const wrong={protocol:v.protocol,challenge:packet.challenge,prompt:'Replaced evidence',prompt_sha256:packet.packet_sha256};
  const response={content:[{type:'text',text:JSON.stringify(wrong)}],structuredContent:wrong};
  assert.match(event({hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__explanation_packet',tool_input:{challenge:packet.challenge},tool_response:response,...child}).systemMessage,/could not record/);
  assert.equal(read().status,'unavailable');
  assert.equal(event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_packet',tool_input:{challenge:packet.challenge},...child}).hookSpecificOutput.permissionDecision,'deny');
}));

test('Codex spawn-first lifecycle preserves the root attempt across its child prompt and binds the native child turn',()=>fixture(({event,call,read,finish,file})=>{
  const original=read(),bound={attempt_id:original.attempt.id,candidate_sha256:original.attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound)),packet=prepared.payload.packets[0],pre=spawn(packet,'codex');
  event(pre);event({...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'codex-child'}});
  const started=event({hook_event_name:'SubagentStart',agent_id:'codex-child',agent_type:'default',turn_id:'child-turn',model:'gpt-5.6-luna'});
  assert.equal(started.hookSpecificOutput.additionalContext,v.verifierInstruction(packet.challenge));
  const prompt=event({hook_event_name:'UserPromptSubmit',turn_id:'child-turn',prompt:packet.prompt,model:'gpt-5.6-luna'});
  assert.deepEqual(prompt,{});
  assert.doesNotMatch(JSON.stringify(prompt),/previous explanation/);
  assert.equal(read().epoch,original.epoch);assert.equal(read().turn,original.turn);assert.equal(read().request_sha256,original.request_sha256);
  assert.equal(read().attempt.verification.facts[0].child_turn_sha256,textDigest('child-turn'));
  const child={turn_id:'child-turn',tool_use_id:'codex-packet'};
  assert.deepEqual(event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_packet',tool_input:{challenge:packet.challenge},...child}),{});
  assert.deepEqual(call('explanation_packet',{challenge:packet.challenge},child).output,{});
  hookSubmission(event,call,answer(packet),{...child,tool_use_id:'codex-submit'});
  assert.deepEqual(event({hook_event_name:'SubagentStop',agent_id:'codex-child',turn_id:'child-turn',last_assistant_message:canonical(answer(packet))}),{});
  assert.equal(read().attempt.verification.facts[0].phase,'returned');assert.equal(read().attempt.status,'pending');
  const final=call('explanation_check_final',{...finalArgs(prepared.payload),...bound});assert.deepEqual(final.output,{});
  hookReceipt(event,final.payload.packet,'final',call);assert.deepEqual(finish(finalText),{});
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/Nori|original_request|stored integer|child-turn/);
}));

test('child-turn fallback rejects parent, changed turn, changed native ID and unconfirmed spawns',()=>{
  const {attempt,plan}=initial(),packet=plan.packets[0],pre=spawn(packet,'codex');
  let launched=v.observeAgent(attempt,pre);
  const input={session_id:'root-session',hook_event_name:'UserPromptSubmit',turn_id:'child-turn',prompt:v.launchPrompt(packet.challenge)};
  assert.equal(v.childPrompt(launched,input,textDigest('parent-turn')),null);
  launched=v.observeAgent(launched,{...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'actual-child'}});
  assert.throws(()=>v.childPrompt(launched,{...input,turn_id:'parent-turn'},textDigest('parent-turn')),/child_turn_binding/);
  assert.throws(()=>v.childPrompt(launched,{...input,agent_id:'another-child'},textDigest('parent-turn')),/child_turn_binding/);
  launched=v.childPrompt(launched,input,textDigest('parent-turn'));
  assert.throws(()=>v.childPrompt(launched,{...input,turn_id:'second-child-turn'},textDigest('parent-turn')),/child_turn_binding/);
  const get={session_id:'root-session',turn_id:'child-turn',hook_event_name:'PreToolUse',tool_use_id:'get',tool_input:{challenge:packet.challenge}};
  for(const extra of [{turn_id:'parent-turn'},{turn_id:'other-turn'},{agent_id:'different-child'}])
    assert.throws(()=>v.observePacket(launched,{...get,...extra}),/packet_actor/);
  assert.equal(v.observePacket(launched,get).verification.facts[0].retrieval_sha256,textDigest('get'));
});

test('a native start for an unrelated child receives no verifier packet or bootstrap',()=>fixture(({event,call,read})=>{
  assert.deepEqual(event({hook_event_name:'SubagentStart',agent_id:'unrelated',agent_type:'default'}),{});
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound)),pre=spawn(prepared.payload.packets[0],'codex');
  event(pre);event({...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'actual-child'}});
  assert.deepEqual(event({hook_event_name:'SubagentStart',agent_id:'unrelated',agent_type:'default'}),{});
}));

test('a child prompt cannot clear a failed native attempt and make the parent appear unchecked',()=>fixture(({event,call,read})=>{
  const original=read(),bound={attempt_id:original.attempt.id,candidate_sha256:original.attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound)),packet=prepared.payload.packets[0],pre=spawn(packet,'codex');
  event(pre);event({...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'failed-child'}});
  event({hook_event_name:'SubagentStart',agent_id:'failed-child',agent_type:'default',turn_id:'child-turn'});
  event({hook_event_name:'SubagentStop',agent_id:'failed-child',turn_id:'child-turn',last_assistant_message:'No packet received'});
  assert.equal(read().status,'unavailable');
  const result=event({hook_event_name:'UserPromptSubmit',turn_id:'child-turn',prompt:packet.prompt});
  assert.equal(result.continue,false);assert.equal(read().status,'unavailable');assert.equal(read().epoch,original.epoch);
  assert.equal(read().attempt.id,original.attempt.id);
}));

test('programmatic Codex dispatch preserves full packet bytes without certifying delivery or changing model scope',()=>{
  const {attempt,plan}=initial(),packet=plan.packets[0],args={...binding,challenge:packet.challenge};
  const dispatched=v.dispatchPacket(plan,packet,args);
  assert.equal(dispatched.native_spawn.message,packet.prompt);assert.equal(dispatched.packet_sha256,textDigest(packet.prompt));
  assert.equal(dispatched.complete_authorized,false);assert.deepEqual(Object.keys(dispatched.native_spawn).sort(),['fork_context','message','model','reasoning_effort']);
  for(const changed of [{candidate_sha256:'b'.repeat(64)},{attempt_id:'other-attempt'},{challenge:'b'.repeat(64)}])
    assert.throws(()=>v.dispatchPacket(plan,packet,{...args,...changed}),/dispatch_binding/);
  const pre={...spawn(packet,'codex'),tool_input:dispatched.native_spawn};
  const launched=v.observeAgent(attempt,pre);assert.equal(launched.verification.facts[0].delivery,'native');
  assert.equal(launched.verification.facts[0].retrieved,false);
  assert.equal(v.observeAgent(launched,{hook_event_name:'SubagentStop',agent_id:'unknown',last_assistant_message:canonical(answer(packet))}),null);
  assert.equal(launched.verification.facts[0].retrieved,false);
});

test('native packet receipt requires exact accepted input and actual child identity; MCP delivery remains separate',()=>{
  const {attempt,plan}=initial(),packet=plan.packets[0],wire=v.dispatchPacket(plan,packet,{...binding,challenge:packet.challenge});
  const pre={...spawn(packet,'codex'),tool_input:wire.native_spawn};
  assert.throws(()=>v.observeAgent(attempt,{...pre,tool_input:{...pre.tool_input,message:packet.prompt+'\n'}}),/unknown_packet/);
  const claude=spawn(packet);claude.tool_input.prompt=packet.prompt;assert.throws(()=>v.observeAgent(attempt,claude),/unknown_packet/);
  let launched=v.observeAgent(attempt,pre);launched=v.observeAgent(launched,{hook_event_name:'SubagentStart',agent_id:'native-child',agent_type:'default'});
  assert.throws(()=>v.observeAgent(launched,{hook_event_name:'SubagentStop',agent_id:'native-child',last_assistant_message:canonical(answer(packet))}),/packet_not_received/);
  assert.throws(()=>v.observeAgent(launched,{...pre,hook_event_name:'PostToolUse',tool_input:{...pre.tool_input,message:packet.prompt+' Changed'},tool_response:{agent_id:'native-child'}}),/spawn_changed/);
  launched=v.observeAgent(launched,{...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:'native-child'}});
  assert.equal(launched.verification.facts[0].retrieved,true);assert.equal(launched.verification.facts[0].retrieval_sha256,textDigest(pre.tool_use_id));
  launched=submissionReceipt(launched,answer(packet),'native-child','native-submit');
  const returned=v.observeAgent(launched,{hook_event_name:'SubagentStop',agent_id:'native-child',last_assistant_message:canonical(answer(packet))});
  assert.equal(returned.verification.facts[0].phase,'returned');assert.equal(returned.status,'pending');
  const forged=structuredClone(launched.verification);forged.facts[0].spawn_confirmed=false;
  assert.throws(()=>v.checkedVerification(forged),/unobserved_native_packet/);
});

test('normal native-input hook path preserves the Codex root and completes without a child cache lookup',()=>fixture(({event,call,read,finish,file})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound));
  function nativeReceipt(publicPacket,id){
    const dispatch=call('explanation_dispatch',{...bound,challenge:publicPacket.challenge});assert.deepEqual(dispatch.output,{});
    const pre={...spawn(publicPacket,'codex',id),tool_input:dispatch.payload.native_spawn};
    assert.deepEqual(event(pre),{});assert.deepEqual(event({...pre,hook_event_name:'PostToolUse',tool_response:{agent_id:id+'-child'}}),{});
    const started=event({hook_event_name:'SubagentStart',agent_id:id+'-child',agent_type:'default',turn_id:id+'-turn'});
    assert.equal(started.hookSpecificOutput.additionalContext,v.verifierInstruction(publicPacket.challenge,'native',publicPacket.kind));
    const old=read();assert.deepEqual(event({hook_event_name:'UserPromptSubmit',turn_id:id+'-turn',prompt:dispatch.payload.native_spawn.message}),{});
    assert.equal(read().epoch,old.epoch);assert.equal(read().turn,old.turn);
    hookSubmission(event,call,answer(publicPacket),{turn_id:id+'-turn',tool_use_id:id+'-submit'});
    assert.deepEqual(event({hook_event_name:'SubagentStop',agent_id:id+'-child',turn_id:id+'-turn',last_assistant_message:canonical(answer(publicPacket))}),{});
    return answer(publicPacket);
  }
  const fact=nativeReceipt(prepared.payload.packets[0],'native-fact');
  const final=call('explanation_check_final',{...finalArgs(prepared.payload,fact),...bound});assert.deepEqual(final.output,{});
  nativeReceipt(final.payload.packet,'native-final');assert.equal(read().attempt.status,'complete');assert.deepEqual(finish(finalText),{});
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/Nori|original_request|stored integer|"message"|native-fact-turn/);
},{host:'codex'}));

test('only the explicit current pair resolves, preserving every non-binding value and rejecting mixed or mistyped identifiers',()=>{
  const attempt=a.begin(binding.attempt_id,binding.candidate_sha256),literal=preparation(),implicit=preparation({attempt_id:'current',candidate_sha256:'current'});
  const result=v.bindArguments(implicit,attempt);assert.equal(result.changed,true);assert.deepEqual(result.input,literal);
  assert.equal(implicit.attempt_id,'current');assert.equal(v.bindArguments(literal,attempt).changed,false);
  for(const value of [{...implicit,attempt_id:binding.attempt_id},{...implicit,candidate_sha256:binding.candidate_sha256},
    {...literal,attempt_id:'12345678-1234-1234-1234-123456789abd'},{...literal,candidate_sha256:'b'.repeat(64)},null,[]])assert.throws(()=>v.bindArguments(value,attempt));
  const secret='sk-'+'SYNTHETIC'.repeat(4);assert.throws(()=>v.bindArguments({...implicit,request:secret},attempt),/content_rejected/);
});

test('normal current binding rewrites only scoped parent MCP input and the ordinary result checks still register the exact plan',()=>fixture(({event,call,read})=>{
  const original=read(),args=preparation({attempt_id:'current',candidate_sha256:'current'});
  const output=event({hook_event_name:'PreToolUse',tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_prepare',tool_use_id:'current-prepare',tool_input:args});
  assert.equal(output.hookSpecificOutput.permissionDecision,'allow');const updated=output.hookSpecificOutput.updatedInput;
  assert.deepEqual(updated,preparation({attempt_id:original.attempt.id,candidate_sha256:original.attempt.candidate}));
  const {pending_tool,...unchanged}=read();assert.deepEqual(unchanged,original);assert.equal(pending_tool.call_sha256,textDigest('current-prepare'));assert.equal(args.attempt_id,'current');
  assert.deepEqual(call('explanation_prepare',updated,{tool_use_id:'current-prepare'}).output,{});assert.ok(read().attempt.verification);
  assert.equal(read().attempt.id,original.attempt.id);assert.equal(read().request_sha256,original.request_sha256);
}));

test('a wrong parent binding is denied before its MCP plan runs and current cannot clear the failure',()=>fixture(({event,read,finish})=>{
  const original=read(),args=preparation({attempt_id:'wrong-attempt',candidate_sha256:original.attempt.candidate});
  const pre={hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_prepare',tool_use_id:'wrong-binding',tool_input:args};
  assert.equal(event(pre).hookSpecificOutput.permissionDecision,'deny');assert.equal(read().status,'unavailable');assert.equal(read().attempt.verification,undefined);
  assert.equal(event({...pre,tool_input:{...args,attempt_id:'current',candidate_sha256:'current'}}).hookSpecificOutput.permissionDecision,'deny');
  assert.equal(read().epoch,original.epoch);assert.equal(finish(finalText).continue,false);
}));

test('another turn and a lookalike server cannot gain a current binding or change the parent state',()=>fixture(({event,read})=>{
  const original=read(),pre={hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_prepare',tool_use_id:'scope-binding',
    tool_input:preparation({attempt_id:'current',candidate_sha256:'current'})};
  assert.equal(event({...pre,turn_id:'unrelated-turn'}).hookSpecificOutput.permissionDecision,'deny');assert.deepEqual(read(),original);
  assert.deepEqual(event({...pre,tool_name:'mcp__plugin_other_ttak_scenario__explanation_prepare'}),{});assert.deepEqual(read(),original);
}));

test('current dispatch selects only the available planned packet and never repairs a literal mismatch',()=>{
  const {attempt,plan}=initial(),markers={attempt_id:'current',candidate_sha256:'current',challenge:'current'};
  const bound=v.bindDispatchArguments(markers,attempt);assert.equal(bound.changed,true);
  assert.deepEqual(bound.input,{...binding,challenge:plan.packets[0].challenge});assert.equal(markers.challenge,'current');
  assert.deepEqual(v.bindDispatchArguments(bound.input,attempt),{changed:false,input:bound.input});
  for(const value of [{...markers,challenge:'b'.repeat(64)},{...markers,candidate_sha256:'b'.repeat(64)},
    {attempt_id:'current',candidate_sha256:'current'},{...markers,extra:'not accepted'}])assert.throws(()=>v.bindDispatchArguments(value,attempt));
  for(const other of [a.begin(binding.attempt_id,binding.candidate_sha256),{...attempt,status:'unavailable'},
    v.observeAgent(attempt,spawn(plan.packets[0])),receipt(attempt,plan.packets[0])])assert.throws(()=>v.bindDispatchArguments(markers,other));
});

test('current dispatch follows observed sequential advancement and separately registered final packets',()=>{
  const q=preparation().questions[0],{plan,attempt:start}=initial({blocks:[{text:finalText,question_ids:['Q1','Q2']}],questions:[q,{...q,id:'Q2'}]});
  const markers={attempt_id:'current',candidate_sha256:'current',challenge:'current'};
  assert.throws(()=>v.bindDispatchArguments({...binding,challenge:plan.packets[1].challenge},start),/dispatch_binding/);
  let attempt=receipt(start,plan.packets[0]);assert.throws(()=>v.bindDispatchArguments(markers,attempt),/dispatch_unavailable/);
  const next={...binding,previous:{id:'Q1',result:answer(plan.packets[0])}};
  attempt=v.registerNext(attempt,next,v.nextPacket(plan,next));assert.equal(v.bindDispatchArguments(markers,attempt).input.challenge,plan.packets[1].challenge);
  attempt=receipt(attempt,plan.packets[1],{id:'spawn-2',agent:'agent-2'});
  const args={...finalArgs(plan),facts:plan.packets.map(p=>({id:p.id,result:answer(p)}))},final=v.finalize(args);
  attempt=v.registerFinal(attempt,final,args);assert.equal(v.bindDispatchArguments(markers,attempt).input.challenge,final.packet.challenge);
});

test('normal dispatch pre-hook resolves all three current fields without itself launching or storing content',()=>fixture(({event,call,read})=>{
  const bound={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
  const prepared=call('explanation_prepare',preparation(bound)),before=read();
  const pre={hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_dispatch',tool_use_id:'atomic-dispatch',
    tool_input:{attempt_id:'current',candidate_sha256:'current',challenge:'current'}};
  const out=event(pre);assert.equal(out.hookSpecificOutput.permissionDecision,'allow');
  const {pending_tool,...unchanged}=read();assert.deepEqual(unchanged,before);assert.equal(pending_tool.call_sha256,textDigest('atomic-dispatch'));
  assert.deepEqual(out.hookSpecificOutput.updatedInput,{...bound,challenge:prepared.payload.packets[0].challenge});
  const dispatch=call('explanation_dispatch',out.hookSpecificOutput.updatedInput,{tool_use_id:'atomic-dispatch'});assert.deepEqual(dispatch.output,{});
  assert.equal(read().attempt.verification.facts[0].phase,'planned');assert.equal(read().attempt.verification.facts[0].retrieved,false);
  assert.equal(event({...pre,turn_id:'another-turn'}).hookSpecificOutput.permissionDecision,'deny');assert.deepEqual(read(),before);
  assert.equal(event({...pre,tool_input:{...pre.tool_input,challenge:'b'.repeat(64)}}).hookSpecificOutput.permissionDecision,'deny');
  assert.equal(read().status,'unavailable');assert.equal(event(pre).hookSpecificOutput.permissionDecision,'deny');
},{host:'codex'}));

test('the native lifecycle recipe retains exact results for the final draft without model re-entry',async()=>{
  // This is a pure adapter wiring check, not evidence of native execution or verifier accuracy.
  const {plan}=initial();let packet=plan.packets[0],wire=v.dispatchPacket(plan,packet,{...binding,challenge:packet.challenge}),result=answer(packet);
  const steps=[],handle={agent_id:'synthetic-child'},memory=new Map();
  const tools={mcp__ttak_scenario__explanation_dispatch:async args=>{
    assert.deepEqual(args,{attempt_id:'current',candidate_sha256:'current',challenge:'current'});steps.push('dispatch');return {structuredContent:wire};},
    multi_agent_v1__spawn_agent:async args=>{assert.equal(args,wire.native_spawn);assert.equal(args.message,packet.prompt);steps.push('spawn');return handle;},
    multi_agent_v1__wait_agent:async args=>{assert.deepEqual(args,{targets:[handle.agent_id],timeout_ms:60000});steps.push('wait');return {timed_out:false,status:{[handle.agent_id]:{completed:canonical(result)}}};},
    multi_agent_v1__close_agent:async args=>{assert.deepEqual(args,{target:handle.agent_id});steps.push('close');return {previous_status:{completed:canonical(result)}};},
    mcp__ttak_scenario__explanation_check_final:async args=>{assert.deepEqual(args,finalArgs(plan,result));steps.push('prepare-final');
      const final=v.finalize(args);packet=final.packet;wire=v.dispatchPacket(final,packet,{...binding,challenge:packet.challenge});result=answer(packet);
      return {structuredContent:v.exposeFinal(final)};}};
  const execute=code=>Object.getPrototypeOf(async function(){}).constructor('tools','text','store','load',code)(tools,value=>{
    if(value.packet_id)assert.deepEqual(value,{packet_id:packet.id,result,delivery_status:'unverified'});steps.push('print');},(key,value)=>{memory.set(key,structuredClone(value));steps.push('store');},key=>memory.get(key));
  await execute(plan.native_dispatch.spawn_agent_code);assert.deepEqual(steps,['dispatch','spawn','wait','close','store','print']);
  assert.deepEqual(memory.get('ttak-verification'),{...binding,request,facts:[{id:packet.id,result}]});
  await execute(plan.native_dispatch.final_draft_code.replace('const final_text = {"fact_answers":"current"};','const final_text = '+JSON.stringify(finalText)+';'));
  assert.deepEqual(steps.slice(-7),['prepare-final','dispatch','spawn','wait','close','store','print']);
  assert.equal(Object.hasOwn(plan.native_dispatch,'spawn_agent'),false);
});

test('retained recipe results advance exact previous objects and reset only for a different attempt',async()=>{
  const {plan}=initial(),packet=plan.packets[0],wire=v.dispatchPacket(plan,packet,{...binding,challenge:packet.challenge}),result=answer(packet);
  let held={attempt_id:'old-attempt',candidate_sha256:binding.candidate_sha256,request:'Old request',facts:[{id:'OLD',result}]},previous;
  const tools={mcp__ttak_scenario__explanation_dispatch:async()=>({structuredContent:wire}),multi_agent_v1__spawn_agent:async()=>({agent_id:'child'}),
    multi_agent_v1__wait_agent:async()=>({timed_out:false,status:{child:{completed:'```json\n'+canonical(result)+'\n```'}}}),multi_agent_v1__close_agent:async()=>({}),
    mcp__ttak_scenario__explanation_next:async args=>{previous=args;return {};}};
  const run=code=>Object.getPrototypeOf(async function(){}).constructor('tools','text','store','load',code)(tools,()=>{},(k,x)=>{held=structuredClone(x);},()=>structuredClone(held));
  await run(plan.native_dispatch.spawn_agent_code);assert.deepEqual(held,{...binding,request,facts:[{id:packet.id,result}]});
  await run(plan.native_dispatch.next_packet_code);assert.deepEqual(previous,{...binding,previous:{id:packet.id,result}});
  await assert.rejects(run(plan.native_dispatch.spawn_agent_code),/duplicate fact/);assert.equal(held.facts.length,1);
});

test('native recipe timeout, wait failure, close failure and altered results cannot enter the retained evidence',async()=>{
  const {plan}=initial(),packet=plan.packets[0],wire=v.dispatchPacket(plan,packet,{...binding,challenge:packet.challenge});
  for(const mode of ['timeout','wait-error','close-error','altered-result']){
    let closed=0,stored=0,waits=0;
    const tools={mcp__ttak_scenario__explanation_dispatch:async()=>({structuredContent:wire}),multi_agent_v1__spawn_agent:async()=>({agent_id:'child'}),
      multi_agent_v1__wait_agent:async()=>{if(mode==='wait-error'||mode==='timeout'&&++waits>1)throw new Error('wait failed or outer budget exhausted');return mode==='timeout'?{timed_out:true,status:{}}:
        {timed_out:false,status:{child:{completed:canonical(answer(packet,mode==='altered-result'?{challenge:'b'.repeat(64)}:{}))}}};},
      multi_agent_v1__close_agent:async()=>{closed++;if(mode==='close-error')throw new Error('close failed');return {};}};
    const execute=Object.getPrototypeOf(async function(){}).constructor('tools','text','store','load',plan.native_dispatch.spawn_agent_code);
    await assert.rejects(execute(tools,()=>{},()=>{stored++;},()=>undefined));assert.equal(closed,1);assert.equal(stored,0);
  }
});

test('the final native recipe retains its result and exact final text without replacing the observed fact objects',async()=>{
  const {plan}=initial(),facts=[{id:plan.packets[0].id,result:answer(plan.packets[0])}],args=finalArgs(plan),final=v.finalize(args),packet=final.packet;
  const wire=v.dispatchPacket(final,packet,{...binding,challenge:packet.challenge}),result=answer(packet);
  let held={...binding,request,facts};const original=structuredClone(held);
  const tools={mcp__ttak_scenario__explanation_dispatch:async()=>({structuredContent:wire}),multi_agent_v1__spawn_agent:async()=>({agent_id:'final-child'}),
    multi_agent_v1__wait_agent:async()=>({timed_out:false,status:{'final-child':{completed:canonical(result)}}}),multi_agent_v1__close_agent:async()=>({})};
  const execute=Object.getPrototypeOf(async function(){}).constructor('tools','text','store','load',final.native_dispatch.spawn_agent_code);
  await execute(tools,()=>{},(k,x)=>{held=structuredClone(x);},()=>structuredClone(held));
  assert.deepEqual(held,{...original,final:{result,final_text:finalText}});
});

test('normal host adapters disclose only their own launch path and bind that path through sequential disclosure',()=>{
  const {plan,attempt:start}=initial(twoQuestions()),packet=plan.packets[0],attempt=receipt(start,packet);
  const next={...binding,previous:{id:packet.id,result:answer(packet)}};
  const claude=v.exposePlan(plan,'claude'),codex=v.exposePlan(plan,'codex');
  assert.deepEqual(claude.packets,codex.packets);assert.equal(claude.candidate_sha256,codex.candidate_sha256);
  assert.deepEqual(Object.keys(claude.native_dispatch).sort(),['Agent','explanation_check_final','explanation_result','instructions']);assert.doesNotMatch(JSON.stringify(claude.native_dispatch),/codex|luna|spawn_agent|store\(|load\(/i);
  assert.equal(Object.hasOwn(codex.native_dispatch,'Agent'),false);assert.equal(typeof codex.native_dispatch.spawn_agent_code,'string');
  const output=v.nextPacket(plan,next,'claude');assert.equal(v.registerNext(attempt,next,output,'claude').verification.available_id,'Q2');
  assert.throws(()=>v.registerNext(attempt,next,output,'codex'),/next_unobserved/);
  const final=v.finalize(finalArgs(plan));assert.deepEqual(v.exposeFinal(final,'claude').native_dispatch,
    {...claude.native_dispatch,Agent:{...claude.native_dispatch.Agent,prompt:v.launchPrompt(final.packet.challenge)}});
  assert.throws(()=>v.nativeAdapter('unknown'),/verification_host/);
});

test('the normal Claude hook rejects a guessed Codex-only dispatch without changing the failed binding into permission',()=>fixture(({event,call,read})=>{
  call('explanation_prepare',preparation({attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate}));
  const pre={hook_event_name:'PreToolUse',tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_dispatch',tool_use_id:'wrong-host',
    tool_input:{attempt_id:'current',candidate_sha256:'current',challenge:'current'}};
  assert.equal(event(pre).hookSpecificOutput.permissionDecision,'deny');assert.equal(read().status,'unavailable');
  assert.equal(read().attempt.verification.facts[0].phase,'planned');assert.equal(read().attempt.verification.facts[0].retrieved,false);
}));

test('verifier bootstrap specifies the actual host result function, input schema fields and Codex MCP return envelope',()=>{
  for(const kind of ['fact','final']){
    const tool=v.resultTools.find(t=>t.name==='explanation_'+kind+'_result');
    const native=v.verifierInstruction('a'.repeat(64),'native',kind),claude=v.verifierInstruction('a'.repeat(64),'mcp',kind);
    assert.ok(native.includes('tools.mcp__ttak_scenario__'+tool.name));assert.ok(native.includes(tool.inputSchema.required.join(', ')));
    assert.ok(native.includes('text(reply.structuredContent.receipt_text)'));assert.doesNotMatch(native,/tools\.explanation_|text\(reply\.final_text\)/);
    assert.ok(claude.includes('mcp__plugin_ttak_ttak_scenario__'+tool.name));assert.doesNotMatch(claude,/code mode|structuredContent|spawn_agent/);
  }
  assert.throws(()=>v.verifierInstruction('a'.repeat(64),'native','unknown'),/verifier_route/);
  assert.throws(()=>v.verifierInstruction('a'.repeat(64),'unknown','fact'),/verifier_route/);
});

test('one neutral mechanism question can cover all parts of a worked example without dropping draft blocks or bypassing native checks',()=>{
  const original='Explain a fictional register that stores one integer. A read returns that integer without changing it. Initially it stores 7. Read twice and explain both results and the remaining state.';
  const texts=['It stores one integer.','Reading leaves the stored integer unchanged.','The first read returns 7.','The second read returns 7.','After both reads, 7 remains stored.'];
  const args={...binding,request:original,blocks:texts.map(text=>({text,question_ids:['MECHANISM']})),sources:[],
    questions:[{id:'MECHANISM',kind:'mechanism',target:'The defined register mechanism across the complete supplied read sequence: definition, initial state, read results and resulting stored state.',conditions:'Use the supplied definition and initial state.',source_ids:[]}]};
  const plan=v.prepare(args);assert.equal(plan.packets.length,1);assert.equal(plan.independent_native_agents_required,1);
  assert.equal(plan.draft_sha256,textDigest(texts.join('\n\n')));assert.equal(JSON.parse(plan.packets[0].prompt.split('\n').slice(1).join('\n')).data.original_request,original);
  const attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(original));
  const finalArgs={...binding,request:original,final_text:texts.join(' '),facts:[{id:'MECHANISM',result:answer(plan.packets[0])}],revision:0};
  assert.throws(()=>v.registerFinal(attempt,v.finalize(finalArgs),finalArgs),/unobserved_fact/);
  const returned=receipt(attempt,plan.packets[0]);const pending=v.registerFinal(returned,v.finalize(finalArgs),finalArgs);
  assert.equal(pending.status,'pending');assert.equal(pending.verification.final.phase,'planned');
  assert.equal(v.prepareTool.inputSchema.properties.questions.maxItems,8);
});

const noticeRequest='Explain the supplied workload. T1 reads B and writes A. Assess the draft claim that T1 reads A. An exact measured slowdown is essential, but no measurements are supplied.';
const noticeCorrection={claim:'T1 reads A.',correction:'T1 reads B and writes A.',basis:'The supplied workload defines the read target as B and the write target as A.'};
function noticeArgs(extra={}){
  const args={...binding,request:noticeRequest,revision:0,disposition:'withheld',language:'en',corrections:[],unresolved:[{
    requirement:'Exact measured slowdown for the supplied workload',request_quote:'An exact measured slowdown is essential, but no measurements are supplied.',reason:'missing_evidence',evidence_needed:'Comparable workload measurements.'}],...extra};
  if(!Object.hasOwn(args,'assessment_result'))args.assessment_result=assessmentResult({attempt_id:args.attempt_id,candidate_sha256:args.candidate_sha256,request:args.request});
  return args;
}
const noticeResult=(packet,extra={})=>answer(packet,{answer:canonical({requirement_review:'The notice accurately identifies the missing measurement.',
  evidence_review:'Comparable workload measurements can establish the requested relative slowdown.',assessment_review:'The notice includes the requested settled assessment.'}),checked_questions:[v.assessmentId],...extra});
function initialAssessment(args){
  const assessment=v.prepareAssessment({attempt_id:args.attempt_id,candidate_sha256:args.candidate_sha256,request:args.request});
  const started=v.registerAssessment(a.begin(args.attempt_id,args.candidate_sha256),assessment,textDigest(args.request));
  return receipt(started,assessment.packets[0],{result:args.assessment_result,id:'assessment-spawn',agent:'assessment-child'});
}
function initialNotice(extra={}){
  const args=noticeArgs(extra),proposal=a.propose(args),assessed=initialAssessment(args);
  const attempt=v.registerWithholding(assessed,proposal.review,textDigest(args.request));
  return {args,proposal,attempt,assessed};
}

test('withholding review includes the entire original request and only its exact proposed notice',()=>{
  const {args,proposal,attempt}=initialNotice(),data=JSON.parse(proposal.review.packet.prompt.split('\n').slice(1).join('\n'));
  assert.equal(data.kind,'final');assert.equal(data.data.purpose,'withholding_notice');
  assert.equal(data.data.request,noticeRequest);assert.equal(data.data.final_text,proposal.decision.final_text);
  assert.deepEqual(data.data.facts,[{id:v.assessmentId,result:args.assessment_result}]);
  assert.match(proposal.review.packet.prompt,/every explicit request to assess/);
  assert.equal(attempt.status,'pending');assert.equal(attempt.final_sha256,null);assert.equal(attempt.verification.purpose,'withholding');
  assert.doesNotMatch(canonical(attempt),/T1 reads|Comparable workload|final_text|request"/);
  for(const host of ['claude','codex']){
    const exposed=a.exposeDecision(proposal,host);assert.equal(exposed.notice_authorized,false);assert.equal(exposed.review.complete_authorized,false);
    assert.equal(exposed.review.packet.prompt,v.launchPrompt(proposal.review.packet.challenge));
    assert.equal(exposed.final_text,proposal.decision.final_text);
    assert.equal(Object.hasOwn(exposed.review.native_dispatch,'final_draft_code'),false);
  }
});

test('notice review binds the original request and cannot be omitted or forged into completion',()=>{
  const {args,proposal,attempt,assessed}=initialNotice();
  for(const key of ['request','revision','assessment_result']){const missing={...args};delete missing[key];assert.throws(()=>a.propose(missing),key==='assessment_result'?/assessment_required/:/review_input_required/);}
  for(const changes of [{request:noticeRequest.replace('Assess the draft claim that T1 reads A. ','')},{request:noticeRequest+' Changed constraint.'},
    {attempt_id:'12345678-1234-1234-1234-123456789abd'},{candidate_sha256:'b'.repeat(64)}]){
    assert.throws(()=>a.propose({...args,...changes}),/answer_binding/);
    const changed=a.propose(noticeArgs(changes));assert.throws(()=>v.registerWithholding(assessed,changed.review,textDigest(noticeRequest)),/review_binding/);
  }
  assert.throws(()=>a.checkedAttempt({...attempt,status:'withheld',final_sha256:proposal.decision.final_sha256}),/independent_withholding/);
  assert.throws(()=>a.checkedAttempt({...attempt,status:'complete',final_sha256:proposal.decision.final_sha256}),/independent_completion/);
});

test('a complete native notice review authorizes withholding only, with no completed-explanation promotion',()=>{
  for(const host of ['claude','codex']){
    const {proposal,attempt}=initialNotice({corrections:[noticeCorrection]}),returned=receipt(attempt,proposal.review.packet,
      {host,postFirst:host==='codex',result:noticeResult(proposal.review.packet)});
    assert.equal(returned.status,'withheld');assert.equal(returned.final_sha256,proposal.decision.final_sha256);assert.equal(a.checkedAttempt(returned),returned);
    assert.throws(()=>a.checkedAttempt({...returned,status:'complete'}),/independent_completion/);
    assert.throws(()=>a.checkedAttempt({...returned,final_sha256:'f'.repeat(64)}),/independent_withholding/);
    const incomplete={...returned,verification:{...returned.verification,final:{...returned.verification.final,submitted:false,submission_call_sha256:null,submission_sha256:null}}};
    assert.throws(()=>a.checkedAttempt(incomplete),/unobserved_submitted_return/);
  }
});

test('a notice omission reported by the independent verifier remains pending until one corrected notice is reviewed',()=>{
  const {args,proposal,attempt}=initialNotice(),issue={quote:'Assess the draft claim that T1 reads A.',reason:'The requested assessment is missing.',evidence_needed:'State that T1 reads B and writes A, using the supplied definition.'};
  const rejected=receipt(attempt,proposal.review.packet,{result:noticeResult(proposal.review.packet,{verdict:'withheld',issues:[issue]})});
  assert.equal(rejected.status,'pending');assert.equal(rejected.final_sha256,null);
  const revisedArgs={...args,revision:1,corrections:[noticeCorrection]},revised=a.propose(revisedArgs);
  assert.notEqual(revised.review.packet.challenge,proposal.review.packet.challenge);
  assert.notEqual(revised.decision.final_sha256,proposal.decision.final_sha256);
  const pending=v.registerWithholding(rejected,revised.review,textDigest(noticeRequest));assert.equal(pending.status,'pending');
  const returned=receipt(pending,revised.review.packet,{id:'notice-revised',agent:'notice-revised-agent',result:noticeResult(revised.review.packet)});
  assert.equal(returned.status,'withheld');assert.equal(returned.verification.revision,1);
  assert.equal(returned.final_sha256,revised.decision.final_sha256);assert.equal(a.checkedAttempt(returned),returned);
});

test('notice correction cannot reset a used budget, skip a review, replay an unchanged notice or revise an approval',()=>{
  const {args,proposal,attempt,assessed}=initialNotice(),revised=a.propose({...args,revision:1,corrections:[noticeCorrection]});
  assert.throws(()=>v.registerWithholding(a.begin(binding.attempt_id,binding.candidate_sha256),revised.review,textDigest(noticeRequest)),/unobserved_assessment/);
  assert.throws(()=>v.registerWithholding(assessed,revised.review,textDigest(noticeRequest)),/revision_not_available/);
  assert.throws(()=>v.registerWithholding(attempt,revised.review,textDigest(noticeRequest)),/revision_not_available/);
  const issue={quote:'Assess the draft claim',reason:'Assessment missing.',evidence_needed:'Supply the requested correction.'};
  const rejected=receipt(attempt,proposal.review.packet,{result:noticeResult(proposal.review.packet,{verdict:'withheld',issues:[issue]})});
  assert.throws(()=>v.registerWithholding(rejected,a.propose({...args,revision:1}).review,textDigest(noticeRequest)),/revision_not_available/);
  const pending=v.registerWithholding({...rejected,corrections:1},revised.review,textDigest(noticeRequest));assert.equal(pending.corrections,1);
  const rejectedAgain=receipt(pending,revised.review.packet,{id:'second',agent:'second-agent',result:noticeResult(revised.review.packet,{verdict:'withheld',issues:[issue]})});
  assert.throws(()=>v.registerWithholding(rejectedAgain,revised.review,textDigest(noticeRequest)),/revision_not_available/);
  assert.throws(()=>a.propose({...args,revision:2}),/integer/);
  const approved=receipt(attempt,proposal.review.packet,{result:noticeResult(proposal.review.packet)});
  assert.throws(()=>v.registerWithholding(approved,revised.review,textDigest(noticeRequest)),/review_binding/);
});

test('withholding cannot discard an active verifier or revive a failed or completed attempt',()=>{
  const argsNotice=noticeArgs({request,unresolved:[{...noticeArgs().unresolved[0],request_quote:'Explain the fictional Nori register.'}]}),proposal=a.propose(argsNotice);
  const plan=v.prepare(preparation()),attempt=v.registerPlan(initialAssessment(argsNotice),plan,textDigest(request));
  const switched=v.registerWithholding(attempt,proposal.review,textDigest(request));assert.equal(switched.verification.prior_verification_sha256,digest(attempt.verification));
  const launched=v.observeAgent(attempt,spawn(plan.packets[0]));
  assert.throws(()=>v.registerWithholding(launched,proposal.review,textDigest(request)),/still_active/);
  for(const status of ['unavailable','cancelled','complete','withheld'])assert.throws(()=>v.registerWithholding({...attempt,status},proposal.review,textDigest(request)),/review_binding/);
  const args=finalArgs(plan);assert.throws(()=>v.registerFinal(switched,v.finalize(args),args),/final_binding/);
  const erased={...switched.verification};delete erased.purpose;assert.throws(()=>v.checkedVerification(erased));
});

test('normal MCP caches the exact notice review for the appropriate native host route',()=>{
  for(const host of ['claude','codex']){
    const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
    dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
    const call=(name,args)=>dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}});
    const args=noticeArgs(),proposal=a.propose(args);
    assert.equal(call('explanation_assess_request',{...binding,request:args.request}).result.isError,undefined);
    const reply=call('explanation_decide',args).result;
    assert.equal(reply.isError,undefined);assert.deepEqual(reply.structuredContent,a.exposeDecision(proposal,host));
    const review=host==='claude'?call('explanation_packet',{challenge:proposal.review.packet.challenge})
      :call('explanation_dispatch',{...binding,challenge:proposal.review.packet.challenge});
    assert.equal(review.result.isError,undefined);
    assert.equal(host==='claude'?review.result.structuredContent.prompt:review.result.structuredContent.native_spawn.message,proposal.review.packet.prompt);
    assert.equal(call('explanation_decide',args).result.isError,true);
    const revised=call('explanation_decide',{...args,revision:1,corrections:[noticeCorrection]});assert.equal(revised.result.isError,undefined);
    assert.equal(call('explanation_decide',{...args,revision:1,corrections:[noticeCorrection]}).result.isError,true);
  }
});

test('normal hook keeps a notice unapproved before the native review and retains its failure on Stop',()=>fixture(({event,call,read,finish,assess})=>{
  const bound=assess(noticeRequest);
  const result=call('explanation_decide',noticeArgs(bound));assert.equal(read().attempt.status,'pending');assert.equal(read().attempt.final_sha256,null);
  assert.equal(finish(result.payload.final_text).continue,false);assert.equal(read().attempt.status,'unavailable');
  const denied=event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_input:noticeArgs({...bound,revision:1,corrections:[noticeCorrection]}),tool_use_id:'late-notice'});
  assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');
}));

test('normal MCP and actual hook receipt sequence accept only the independently approved notice bytes',()=>fixture(({event,call,read,finish,assess})=>{
  const bound=assess(noticeRequest);
  const args=noticeArgs({...bound,corrections:[noticeCorrection]}),result=call('explanation_decide',args),packet=a.propose(args).review.packet;
  hookReceipt(event,packet,'notice-approved',call,noticeResult(packet));
  assert.equal(read().attempt.status,'withheld');assert.deepEqual(finish(result.payload.final_text),{});
  assert.equal(finish(result.payload.final_text+' This is now a complete explanation.').continue,false);
}));

test('normal MCP and hook notice revision requires the observed adverse review and a fresh verifier',()=>fixture(({event,call,read,finish,assess})=>{
  const bound=assess(noticeRequest);
  const args=noticeArgs(bound);call('explanation_decide',args);const packet=a.propose(args).review.packet;
  const issue={quote:'Assess the draft claim that T1 reads A.',reason:'The notice omits this requested assessment.',evidence_needed:'State the correction supported by the supplied workload.'};
  hookReceipt(event,packet,'notice-rejected',call,noticeResult(packet,{verdict:'withheld',issues:[issue]}));
  assert.equal(read().attempt.status,'pending');const id=read().attempt.id;
  const revisedArgs={...args,revision:1,corrections:[noticeCorrection]},revised=call('explanation_decide',revisedArgs),next=a.propose(revisedArgs).review.packet;
  hookReceipt(event,next,'notice-corrected',call,noticeResult(next));
  assert.equal(read().attempt.id,id);assert.equal(read().attempt.status,'withheld');assert.deepEqual(finish(revised.payload.final_text),{});
}));

test('notice review rejects foreign result bindings and fabricated preceding question coverage',()=>{
  const {proposal,attempt}=initialNotice();assert.throws(()=>receipt(attempt,proposal.review.packet,{result:noticeResult(proposal.review.packet,{challenge:'b'.repeat(64)})}));
  assert.throws(()=>v.resultSubmission({...submissionArgs(noticeResult(proposal.review.packet),'notice'),checked_questions:['Q1']},'notice'),/notice_assessment_coverage/);
});

test('notice proposal rejects unsafe original text and malformed revision before packet construction',()=>{
  for(const request of ['', 'x'.repeat(32001), 'sk-'+'SYNTHETIC'.repeat(4), 'Bad\u202etext'])assert.throws(()=>a.propose(noticeArgs({request})));
  for(const revision of [-1,2,'0',null])assert.throws(()=>a.propose(noticeArgs({revision})));
  assert.throws(()=>a.propose({...noticeArgs(),supported:true}));
  let invoked=0;const accessor={...noticeArgs()};Object.defineProperty(accessor,'request',{enumerable:true,get(){invoked++;return noticeRequest;}});
  assert.throws(()=>a.propose(accessor),/invalid_data/);assert.equal(invoked,0);
});

test('Claude packet responses carry the exact ready-to-use Agent input rather than a prompt placeholder',()=>{
  const {plan,attempt}=initial(),fact=plan.packets[0],factResponse=v.exposePlan(plan,'claude');
  const checked=receipt(attempt,fact),finalArgsValue=finalArgs(plan),compiled=v.finalize(finalArgsValue),finalAttempt=v.registerFinal(checked,compiled,finalArgsValue);
  const notice=initialNotice();
  for(const [pending,packet,response]of [[attempt,fact,factResponse],[finalAttempt,compiled.packet,v.exposeFinal(compiled,'claude')],
    [notice.attempt,notice.proposal.review.packet,a.exposeDecision(notice.proposal,'claude').review]]){
    const args=response.native_dispatch.Agent;assert.equal(args.prompt,v.launchPrompt(packet.challenge));
    assert.equal(args.subagent_type,v.agentType);assert.equal(args.run_in_background,false);
    const pre={hook_event_name:'PreToolUse',tool_name:'Agent',tool_use_id:'ready-input',tool_input:args};
    assert.equal(v.observeAgent(pending,pre).verification.available_id,packet.id);
    for(const prompt of ['<packet.prompt>'+packet.challenge+'</packet.prompt>',packet.challenge,'<packet.prompt>'])
      assert.throws(()=>v.observeAgent(pending,{...pre,tool_input:{...args,prompt}}),/unknown_packet/);
  }
});

test('next-packet Agent input is bound to that specific next packet and cannot be substituted',()=>{
  const base=preparation(),second={...base.questions[0],id:'Q2',target:'The stated register definition'};
  const {plan,attempt}=initial({questions:[...base.questions,second],blocks:[{text:finalText,question_ids:['Q1','Q2']}]});
  const result=answer(plan.packets[0]),returned=receipt(attempt,plan.packets[0],{result});
  const args={...binding,previous:{id:'Q1',result}},response=v.nextPacket(plan,args,'claude');
  assert.equal(response.native_dispatch.Agent.prompt,v.launchPrompt(plan.packets[1].challenge));
  const pending=v.registerNext(returned,args,response,'claude');
  const pre={hook_event_name:'PreToolUse',tool_name:'Agent',tool_use_id:'ready-next',tool_input:response.native_dispatch.Agent};
  assert.equal(v.observeAgent(pending,pre).verification.facts[1].phase,'launched');
  const wrong={...response,native_dispatch:{...response.native_dispatch,Agent:{...response.native_dispatch.Agent,prompt:v.launchPrompt(plan.packets[0].challenge)}}};
  assert.throws(()=>v.registerNext(returned,args,wrong,'claude'),/unobserved_or_changed/);
});

test('notice requirements are tied to verbatim original clauses rather than only a paraphrase or nearby obligation',()=>{
  const original='Explain the cost. O5: State qualitative cost categories. Also include the exact measured percentage slowdown as a required part of the answer. No measurements have been supplied.';
  const quote='Also include the exact measured percentage slowdown as a required part of the answer.';
  const args=noticeArgs({request:original,unresolved:[{...noticeArgs().unresolved[0],request_quote:quote}]}),proposal=a.propose(args);
  const data=JSON.parse(proposal.review.packet.prompt.split('\n').slice(1).join('\n')).data;
  assert.equal(data.request,original);assert.deepEqual(data.unresolved_requirements,args.unresolved);assert.equal(data.unresolved_requirements[0].request_quote,quote);
  assert.equal(a.exposeDecision(proposal).notice_authorized,false);
  const pending=v.registerWithholding(initialAssessment(args),proposal.review,textDigest(original));
  assert.equal(pending.status,'pending');assert.doesNotMatch(canonical(pending),/qualitative|percentage|request_quote/);
  for(const request_quote of [undefined,'Invented requirement.','also include the exact measured percentage slowdown as a required part of the answer.',quote+' Altered.']){
    const item={...args.unresolved[0],request_quote};if(request_quote===undefined)delete item.request_quote;
    assert.throws(()=>a.propose({...args,unresolved:[item]}));
  }
  // Another actual quotation changes the review input, but cannot certify its
  // semantic suitability or become completion evidence merely because it exists.
  const nearby=a.propose({...args,unresolved:[{...args.unresolved[0],request_quote:'O5: State qualitative cost categories.'}]});
  assert.notEqual(nearby.review.packet.challenge,proposal.review.packet.challenge);
  assert.equal(nearby.decision.final_text,proposal.decision.final_text);assert.equal(a.exposeDecision(nearby).notice_authorized,false);
  assert.ok(a.propose({...args,unresolved:[{...args.unresolved[0],request_quote:quote+' '}]}));
});

test('requirement quotations reject unsafe or oversized text without weakening ordinary notice constraints',()=>{
  for(const request_quote of ['', 'x'.repeat(1001),'가'.repeat(334),'Bad\u202equote','sk-'+'SYNTHETIC'.repeat(4)])
    assert.throws(()=>a.propose(noticeArgs({unresolved:[{...noticeArgs().unresolved[0],request_quote}]})));
  assert.ok(a.tool.inputSchema.properties.unresolved.items.required.includes('request_quote'));
  assert.equal(a.tool.inputSchema.properties.unresolved.items.properties.request_quote.maxLength,1000);
});

function rejectedNotice({event,call,assess}){
  const args=noticeArgs(assess(noticeRequest));
  call('explanation_decide',args);const packet=a.propose(args).review.packet;
  hookReceipt(event,packet,'cache-first',call,noticeResult(packet,{verdict:'withheld',issues:[{quote:'Assess the draft claim that T1 reads A.',reason:'The requested assessment is missing.',evidence_needed:'Include the supplied correction.'}]}));
  return {...args,request:'current',revision:1,corrections:[noticeCorrection]};
}

test('the one notice revision reuses its exact connection request and remains pending until a fresh native result',()=>fixture(context=>{
  const {event,call,read,finish,file}=context,selector=rejectedNotice(context),before=read();
  const pre=event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_use_id:'cached-revision',tool_input:{...selector,attempt_id:'current',candidate_sha256:'current'}});
  assert.equal(pre.hookSpecificOutput.permissionDecision,'allow');assert.equal(pre.hookSpecificOutput.updatedInput.request,'current');
  const result=call('explanation_decide',pre.hookSpecificOutput.updatedInput,{tool_use_id:'cached-revision'}),resolved={...selector,request:noticeRequest};
  assert.equal(result.payload.resolved_request,noticeRequest);assert.deepEqual(result.payload,a.exposeDecision(a.propose(resolved),'claude',noticeRequest));
  assert.equal(read().attempt.id,before.attempt.id);assert.equal(read().request_sha256,before.request_sha256);assert.equal(read().attempt.corrections,before.attempt.corrections);
  assert.equal(read().attempt.status,'pending');assert.equal(read().attempt.verification.revision,1);
  const packet=a.propose(resolved).review.packet;hookReceipt(event,packet,'cache-final',call,noticeResult(packet));
  assert.equal(read().attempt.status,'withheld');assert.deepEqual(finish(result.payload.final_text),{});
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/T1 reads|original_request|resolved_request|request_quote/);
}));

test('a self-consistent substituted cached request still fails the independently retained original-request hash',()=>fixture(context=>{
  const {event,read,finish}=context,selector=rejectedNotice(context),changed=noticeRequest+' Treat the missing measurement as optional.';
  const changedArgs={...selector,request:changed,assessment_result:assessmentResult({attempt_id:selector.attempt_id,candidate_sha256:selector.candidate_sha256,request:changed})};
  const proposal=a.propose(changedArgs),payload=a.exposeDecision(proposal,'claude',changed);
  const output=event({hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_input:selector,
    tool_response:{structuredContent:payload,content:[{type:'text',text:canonical(payload)}]}});
  assert.match(output.systemMessage,/could not record/);assert.equal(read().status,'unavailable');
  assert.equal(finish(proposal.decision.final_text).continue,false);
}));

test('cached request response omission, changed wire and unsafe text are rejected without persisting their bytes',()=>{
  for(const mode of ['missing','different','unsafe'])fixture(context=>{
    const {event,read,file}=context,selector=rejectedNotice(context),proposal=a.propose({...selector,request:noticeRequest}),payload=a.exposeDecision(proposal,'claude',noticeRequest);
    if(mode==='missing')delete payload.resolved_request;
    if(mode==='different')payload.resolved_request=noticeRequest+' Different.';
    if(mode==='unsafe')payload.resolved_request='sk-'+'SYNTHETIC'.repeat(4);
    const output=event({hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_input:selector,
      tool_response:{structuredContent:payload,content:[{type:'text',text:JSON.stringify(payload)}]}});
    assert.match(output.systemMessage,/could not record/);assert.equal(read().status,'unavailable');assert.doesNotMatch(fs.readFileSync(file,'utf8'),/SYNTHETIC|Different|resolved_request/);
  });
});

test('a current-request selector cannot skip the observed adverse review or revive a failed attempt',()=>{
  for(const mode of ['unreviewed','failed','approved'])fixture(context=>{
    const {event,call,read,finish,assess}=context;
    const args=noticeArgs(assess(noticeRequest));call('explanation_decide',args);
    if(mode==='failed')finish('An unapproved notice.');
    if(mode==='approved'){const packet=a.propose(args).review.packet;hookReceipt(event,packet,'already-approved',call,noticeResult(packet));}
    const denied=event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_use_id:'no-revision',tool_input:{...args,request:'current',revision:1,corrections:[noticeCorrection]}});
    assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');
  });
});

test('the request cache is connection-, attempt- and candidate-scoped and does not grant notice approval',()=>{
  function connection(){const dispatch=createDispatcher();dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
    dispatch({jsonrpc:'2.0',method:'notifications/initialized'});return (args,name='explanation_decide')=>dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;}
  const call=connection(),other=connection(),args=noticeArgs(),selector={...args,request:'current',revision:1,corrections:[noticeCorrection]};
  assert.equal(call(selector).isError,true);
  assert.equal(call({...binding,request:args.request},'explanation_assess_request').isError,undefined);
  assert.equal(call(args).isError,undefined);assert.equal(other(selector).isError,true);
  assert.equal(call({...selector,attempt_id:'12345678-1234-1234-1234-123456789abd'}).isError,true);
  assert.equal(call({...selector,candidate_sha256:'b'.repeat(64)}).isError,true);
  const reply=call(selector);assert.equal(reply.isError,undefined);assert.equal(reply.structuredContent.resolved_request,noticeRequest);
  assert.equal(reply.structuredContent.notice_authorized,false);assert.equal(call(selector).isError,true);
});

test('a cached request does not make a fabricated requirement quotation acceptable',()=>fixture(context=>{
  const {event,dispatch,read}=context,selector=rejectedNotice(context),args={...selector,unresolved:[{...selector.unresolved[0],request_quote:'This clause was never supplied.'}]};
  assert.deepEqual(event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_use_id:'bad-cached-quote',tool_input:args}),{});
  const reply=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_decide',arguments:args}}).result;assert.equal(reply.isError,true);
  event({hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_input:args,tool_response:reply});
  assert.equal(read().status,'unavailable');
}));

test('the cache selector remains one exact data-only revision contract',()=>{
  const selector={...noticeArgs(),request:'current',revision:1,corrections:[noticeCorrection]};
  assert.equal(a.revisionDecision(selector).disposition,'withheld');
  for(const extra of [{request:'CURRENT'},{revision:0},{revision:2},{supported:true}])assert.throws(()=>a.revisionDecision({...selector,...extra}));
  let invoked=0;const value={...selector};Object.defineProperty(value,'request',{enumerable:true,get(){invoked++;return 'current';}});
  assert.throws(()=>a.revisionDecision(value));assert.equal(invoked,0);
  assert.throws(()=>a.exposeDecision(a.propose(noticeArgs()),'codex',noticeRequest+' Wrong original request.'),/resolved_request_mismatch/);
});

const correctionIssue={quote:'Assess the draft claim that T1 reads A.',reason:'The requested assessment is missing.',
  evidence_needed:'No new evidence is needed; include the supplied correction.',notice_correction:noticeCorrection};
function repairableNotice(context){
  const {event,call,assess}=context;
  const original=noticeArgs(assess(noticeRequest));call('explanation_decide',original);
  const packet=a.propose(original).review.packet,review=noticeResult(packet,{verdict:'withheld',issues:[correctionIssue]});
  hookReceipt(event,packet,'typed-repair',call,review);return {original,review};
}

test('typed review repair appends the observed correction without changing unresolved requirements or granting approval',()=>fixture(context=>{
  const {event,read,call,finish,file}=context,{original,review}=repairableNotice(context),before=read();
  const input={attempt_id:'current',candidate_sha256:'current',review_result:'current'};
  const pre=event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_repair_notice',tool_use_id:'repair',tool_input:input});
  assert.equal(pre.hookSpecificOutput.permissionDecision,'allow');const args=pre.hookSpecificOutput.updatedInput;
  const result=call('explanation_repair_notice',args,{tool_use_id:'repair'});assert.deepEqual(result.output,{});
  assert.deepEqual(result.payload.repair.original,original);assert.deepEqual(result.payload.repair.review_result,review);
  const compiled=a.repairProposal(original,review);assert.deepEqual(result.payload,a.exposeRepair(compiled,'claude'));
  const next=JSON.parse(compiled.proposal.review.packet.prompt.split('\n').slice(1).join('\n'));
  assert.deepEqual(next.data.unresolved_requirements,original.unresolved);assert.equal(next.data.request,noticeRequest);
  assert.equal(result.payload.correction_count,1);assert.equal(result.payload.unresolved_count,1);
  assert.match(result.payload.final_text,/Draft claim: T1 reads A/);assert.equal(result.payload.notice_authorized,false);
  assert.equal(read().attempt.status,'pending');assert.equal(read().attempt.verification.revision,1);assert.equal(read().attempt.corrections,before.attempt.corrections);
  hookReceipt(event,compiled.proposal.review.packet,'typed-repaired',call,noticeResult(compiled.proposal.review.packet));
  assert.equal(read().attempt.status,'withheld');assert.deepEqual(finish(result.payload.final_text),{});
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/T1 reads|review_result|request_quote|resolved_request/);
}));

test('typed corrections use one bounded schema and are rejected for fact packets or ordinary final checks',()=>{
  const {proposal,attempt}=initialNotice(),result=noticeResult(proposal.review.packet,{verdict:'withheld',issues:[correctionIssue]});
  assert.deepEqual(v.resultSubmission(submissionArgs(result,'notice'),'notice').result,result);
  const schema=v.resultTools.find(t=>t.name==='explanation_notice_result').inputSchema.properties.issues.items;
  const reviewSchema=schema.properties.notice_correction,coreSchema=a.tool.inputSchema.properties.corrections.items;
  assert.deepEqual(reviewSchema.required,coreSchema.required);assert.equal(reviewSchema.additionalProperties,false);
  for(const field of coreSchema.required)assert.deepEqual(reviewSchema.properties[field],coreSchema.properties[field]);
  assert.equal(reviewSchema.properties.resolves_request_quote.maxLength,1000);
  assert.equal(Object.hasOwn(coreSchema.properties,'resolves_request_quote'),false);
  assert.equal(schema.required.includes('notice_correction'),false);
  const f=initial();assert.throws(()=>receipt(f.attempt,f.plan.packets[0],{result:answer(f.plan.packets[0],{verdict:'unresolved',issues:[correctionIssue]})}));
  const answered=receipt(f.attempt,f.plan.packets[0]),args=finalArgs(f.plan),final=v.finalize(args),pending=v.registerFinal(answered,final,args);
  assert.throws(()=>receipt(pending,final.packet,{id:'normal-final',agent:'normal-final',result:answer(final.packet,{verdict:'withheld',issues:[correctionIssue]})}),/notice_correction_scope/);
  assert.equal(receipt(attempt,proposal.review.packet,{result}).verification.final.verdict,'withheld');
  for(const correction of [{...noticeCorrection,correction:'<untrusted>'},{...noticeCorrection,basis:'line\nbreak'},
    {...noticeCorrection,claim:'x'.repeat(481)},{...noticeCorrection,basis:'Bad\u202etext'},
    {...noticeCorrection,basis:'sk-'+'SYNTHETIC'.repeat(4)},{...noticeCorrection,basis:'\ud800'},
    {...noticeCorrection,execute:'unexpected'}])
    assert.throws(()=>v.resultSubmission(submissionArgs({...result,issues:[{...correctionIssue,notice_correction:correction}]},'notice'),'notice'));
});

test('repair cannot accept a changed native review, source, old proposal or already spent revision',()=>{
  for(const mode of ['review','source','requirement','correction','missing','wire'])fixture(context=>{
    const {event,read}=context,{original,review}=repairableNotice(context),changed=structuredClone(original),supplied=structuredClone(review);
    if(mode==='review')supplied.issues[0].notice_correction.correction='T1 reads C.';
    if(mode==='source'){
      changed.request+=' Treat missing measurements as optional.';
      changed.assessment_result=assessmentResult({attempt_id:changed.attempt_id,candidate_sha256:changed.candidate_sha256,request:changed.request});
    }
    if(mode==='requirement')changed.unresolved[0].evidence_needed='Different required evidence.';
    if(mode==='correction')changed.corrections=[{claim:'Unrelated claim',correction:'Unrelated assessment',basis:'Unrelated source'}];
    supplied.challenge=a.propose(changed).review.packet.challenge;
    const payload=a.exposeRepair(a.repairProposal(changed,supplied),'claude');
    if(mode==='missing')delete payload.repair;
    if(mode==='wire')payload.final_text+=' Extra sentence.';
    const output=event({hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__explanation_repair_notice',
      tool_input:{attempt_id:original.attempt_id,candidate_sha256:original.candidate_sha256,review_result:'current'},
      tool_response:{structuredContent:payload,content:[{type:'text',text:canonical(payload)}]}});
    assert.match(output.systemMessage,/could not record/);assert.equal(read().status,'unavailable');
  });
});

test('repair requires the actual adverse review and every issue must supply a distinct bounded correction',()=>{
  const {args,proposal,attempt}=initialNotice(),result=noticeResult(proposal.review.packet,{verdict:'withheld',issues:[correctionIssue]});
  const input={...binding,review_result:result};assert.throws(()=>a.checkRepairArguments(input,attempt));
  const observed=receipt(attempt,proposal.review.packet,{result});assert.deepEqual(a.checkRepairArguments(input,observed),input);
  assert.throws(()=>a.checkRepairArguments({...input,review_result:{...result,answer:'Changed review.'}},observed));
  for(const state of ['unavailable','cancelled','complete','withheld'])assert.throws(()=>a.checkRepairArguments(input,{...observed,status:state}));
  assert.throws(()=>a.checkRepairArguments(input,{...observed,verification:{...observed.verification,revision:1}}));
  for(const issues of [[{quote:'Unrelated issue',reason:'Other defect',evidence_needed:'Other repair'}],[correctionIssue,correctionIssue]])
    assert.throws(()=>a.repairProposal(args,{...result,issues}));
  assert.throws(()=>a.repairProposal({...args,corrections:[noticeCorrection]},result));
  let invoked=0;const executable={...input};Object.defineProperty(executable,'review_result',{enumerable:true,get(){invoked++;return result;}});
  assert.throws(()=>a.checkRepairArguments(executable,observed));assert.equal(invoked,0);
});

test('Codex repair recipe transfers the separately returned review object without reconstruction',async()=>{
  const {args,proposal,attempt}=initialNotice(),review=noticeResult(proposal.review.packet,{verdict:'withheld',issues:[correctionIssue]});
  const observed=receipt(attempt,proposal.review.packet,{result:review}),held={...binding,final:{result:review}};
  const dispatch=createDispatcher({host:'codex'});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  const call=(name,arguments_)=>dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:arguments_}}).result;
  assert.equal(call('explanation_assess_request',{...binding,request:args.request}).isError,undefined);
  assert.equal(call('explanation_decide',args).isError,undefined);
  // No child result was submitted to the parent MCP connection. The explicit
  // native object is needed; the Claude-only cache shortcut cannot invent it.
  assert.equal(call('explanation_repair_notice',{...binding,review_result:'current'}).isError,true);
  let emitted,called=0;
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction('tools','load','text',a.exposeDecision(proposal,'codex').review.native_dispatch.repair_notice_code)({
    mcp__ttak_scenario__explanation_repair_notice:async input=>{
      called++;assert.equal(input.review_result,review);a.checkRepairArguments(input,observed);
      const reply=call('explanation_repair_notice',input);assert.equal(reply.isError,undefined);
      const pending=a.registerRepair(observed,input,reply.structuredContent,'codex',textDigest(noticeRequest));
      assert.equal(pending.status,'pending');assert.equal(pending.verification.revision,1);return reply;
    }},key=>{assert.equal(key,'ttak-verification');return held;},value=>{emitted=value;});
  assert.equal(called,1);assert.equal(emitted.structuredContent.correction_count,1);
  assert.equal(call('explanation_repair_notice',{...binding,review_result:review}).isError,true);
});

test('a repair cache is bounded by connection, candidate, duplicate receipt and expiry',()=>{
  const originalNow=Date.now;let now=100000;Date.now=()=>now;
  try{
    function connection(){const d=createDispatcher({host:'claude'});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
      d({jsonrpc:'2.0',method:'notifications/initialized'});return (name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;}
    const first=connection(),other=connection(),{args,proposal}=initialNotice(),review=noticeResult(proposal.review.packet,{verdict:'withheld',issues:[correctionIssue]});
    const input={...binding,review_result:'current'};
    for(const call of [first,other]){assert.equal(call('explanation_assess_request',{...binding,request:args.request}).isError,undefined);assert.equal(call('explanation_decide',args).isError,undefined);}
    first('explanation_notice_result',submissionArgs(review,'notice'));assert.equal(other('explanation_repair_notice',input).isError,true);
    assert.equal(first('explanation_notice_result',submissionArgs(review,'notice')).isError,true);
    assert.equal(first('explanation_repair_notice',{...input,candidate_sha256:'f'.repeat(64)}).isError,true);
    now+=30*60*1000+1;assert.equal(first('explanation_repair_notice',input).isError,true);
  }finally{Date.now=originalNow;}
});

test('a native MCP error without PostToolUse cannot be bypassed by another revision or accepted at Stop',()=>{
  for(const next of ['revision','stop'])fixture(context=>{
    const {event,read,dispatch,finish}=context,{original,review}=repairableNotice(context);
    const bad={...original,revision:1,request:'current',corrections:[noticeCorrection],
      unresolved:[{...original.unresolved[0],request_quote:'This clause was not in the request.'}]};
    const input={hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_use_id:'missing-post',tool_input:bad};
    assert.deepEqual(event(input),{});
    const response=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_decide',arguments:bad}}).result;assert.equal(response.isError,true);
    // Claude emits no PostToolUse for an MCP isError result. Do not synthesize one.
    if(next==='revision'){
      const out=event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_repair_notice',tool_use_id:'bypass',
        tool_input:{attempt_id:original.attempt_id,candidate_sha256:original.candidate_sha256,review_result:review}});
      assert.equal(out.hookSpecificOutput.permissionDecision,'deny');
    }else assert.equal(finish('The failed check passed.').continue,false);
    assert.equal(read().status,'unavailable');
  });
});

test('only the same observed parent call return clears its pending receipt',()=>{
  for(const mode of ['valid','call','input','tool'])fixture(context=>{
    const {event,read,dispatch}=context,{original}=repairableNotice(context),args={attempt_id:original.attempt_id,candidate_sha256:original.candidate_sha256,review_result:'current'};
    const pre={hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_repair_notice',tool_use_id:'receipt-repair',tool_input:args};assert.deepEqual(event(pre),{});
    assert.equal(read().pending_tool.call_sha256,textDigest('receipt-repair'));
    const response=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_repair_notice',arguments:args}}).result;assert.equal(response.isError,undefined);
    const post={...pre,hook_event_name:'PostToolUse',tool_response:response};
    if(mode==='call')post.tool_use_id='different';
    if(mode==='input')post.tool_input={...args,review_result:{...response.structuredContent.repair.review_result,answer:'Substituted'}};
    if(mode==='tool')post.tool_name='mcp__ttak_scenario__explanation_decide';
    const out=event(post);
    if(mode==='valid'){assert.deepEqual(out,{});assert.equal(Object.hasOwn(read(),'pending_tool'),false);assert.equal(read().attempt.verification.revision,1);}
    else{assert.match(out.systemMessage,/could not record/);assert.equal(read().status,'unavailable');}
  });
});

test('a typed correction can settle only one exact quoted unresolved entry, leaving genuine evidence gaps intact',()=>{
  const extra={requirement:'Assess the draft claim',request_quote:'Assess the draft claim that T1 reads A.',reason:'contradicted',evidence_needed:'Compare to the supplied definition.'};
  const original=noticeArgs({unresolved:[noticeArgs().unresolved[0],extra]}),previous=a.propose(original);
  const review=noticeResult(previous.review.packet,{verdict:'withheld',issues:[{...correctionIssue,notice_correction:{...noticeCorrection,resolves_request_quote:extra.request_quote}}]});
  const repair=a.repairProposal(original,review);
  assert.deepEqual(repair.revised.unresolved,[original.unresolved[0]]);assert.deepEqual(repair.revised.corrections,[noticeCorrection]);
  assert.equal(repair.proposal.decision.unresolved_count,1);assert.equal(repair.proposal.decision.correction_count,1);assert.equal(a.exposeRepair(repair).notice_authorized,false);
  for(const quote of ['Not an existing unresolved requirement.','',extra.request_quote+' '])
    assert.throws(()=>a.repairProposal(original,{...review,issues:[{...correctionIssue,notice_correction:{...noticeCorrection,resolves_request_quote:quote}}]}));
  assert.throws(()=>v.resultSubmission(submissionArgs({...review,issues:[{...correctionIssue,resolves_request_quote:extra.request_quote}]}),'final'));
  assert.throws(()=>a.repairProposal(original,{...review,issues:[review.issues[0],review.issues[0]]}));
  const only=noticeArgs({unresolved:[extra]}),single=noticeResult(a.propose(only).review.packet,{verdict:'withheld',issues:review.issues});
  assert.throws(()=>a.repairProposal(only,single),/unresolved_requirements_required/);
});

test('the targeted native review object is accepted only on the review wire, never as a formatter correction',()=>{
  const target='Assess the draft claim that T1 reads A.',notice_correction={...noticeCorrection,resolves_request_quote:target};
  const {proposal}=initialNotice(),review=noticeResult(proposal.review.packet,{verdict:'withheld',issues:[{...correctionIssue,notice_correction}]});
  assert.deepEqual(v.resultSubmission(submissionArgs(review,'notice'),'notice').result,review);
  assert.throws(()=>a.propose(noticeArgs({corrections:[notice_correction]})),/invalid_explanation_correction/);
  for(const bad of [{...notice_correction,extra:'ignored?'},{...notice_correction,resolves_request_quote:null},
    {...notice_correction,resolves_request_quote:'x'.repeat(1001)}, {...notice_correction,claim:'wrong\nline'}])
    assert.throws(()=>v.resultSubmission(submissionArgs({...review,issues:[{...correctionIssue,notice_correction:bad}]},'notice'),'notice'));
});

test('task-body binding preserves user-supplied metadata examples but rejects extra automatic host context',()=>{
  const request=noticeRequest+' Quoted example data: <environment_context><cwd>fictional</cwd></environment_context>.';
  const args=noticeArgs({request}),proposal=a.propose(args),attempt=initialAssessment(args);
  assert.equal(v.normalizeRequest(request),request);assert.equal(v.registerWithholding(attempt,proposal.review,textDigest(request)).status,'pending');
  const wrapped='<environment_context><cwd>automatic-host-workdir</cwd></environment_context>\n\n'+request;
  assert.equal(v.normalizeRequest(wrapped),wrapped);assert.throws(()=>v.registerWithholding(attempt,a.propose(noticeArgs({request:wrapped})).review,textDigest(request)),/withholding_review_binding/);
  const data=JSON.parse(proposal.review.packet.prompt.split('\n').slice(1).join('\n'));
  assert.equal(data.data.request,request);assert.ok(data.data.request.includes('<cwd>fictional</cwd>'));
});

test('a native notice proposal must explicitly include its correction list without changing the legacy formatter',()=>{
  const {corrections,...absent}=noticeArgs();assert.throws(()=>a.propose(absent),/withholding_corrections_required/);
  const {request,revision,assessment_result,...core}=absent;assert.deepEqual(a.decide(core),a.decide({...core,corrections:[]}));
  assert.equal(a.propose({...absent,corrections:[]}).decision.correction_count,undefined);
  assert.equal(a.propose({...absent,corrections:[noticeCorrection]}).decision.correction_count,1);
  assert.ok(a.tool.inputSchema.required.includes('corrections'));
  for(const corrections of [null,{},'none'])assert.throws(()=>a.propose({...absent,corrections}));
});

test('notice reviewers receive the already proposed corrections as bound data, never as a prefilled defect verdict',()=>{
  for(const corrections of [[],[noticeCorrection]]){
    const {proposal,attempt}=initialNotice({corrections}),wire=JSON.parse(proposal.review.packet.prompt.split('\n').slice(1).join('\n'));
    assert.deepEqual(wire.data.proposed_corrections,corrections);assert.equal(Object.hasOwn(wire.data,'issues'),false);
    assert.equal(wire.data.final_text,proposal.decision.final_text);assert.equal(wire.data.request,noticeRequest);
    assert.equal(attempt.status,'pending');assert.equal(a.exposeDecision(proposal).notice_authorized,false);
    assert.equal(wire.submission.input_schema.properties.issues.items.required.includes('notice_correction'),false);
    assert.doesNotMatch(canonical(attempt),/proposed_corrections|T1 reads/);
  }
  const original=a.propose(noticeArgs({corrections:[noticeCorrection]}));
  const changed=a.propose(noticeArgs({corrections:[{...noticeCorrection,correction:'An incorrect proposed correction.'}]}));
  assert.notEqual(original.review.packet.challenge,changed.review.packet.challenge);
  assert.notEqual(original.decision.final_sha256,changed.decision.final_sha256);
  const falseDefect=noticeResult(original.review.packet,{verdict:'withheld',issues:[correctionIssue]});
  assert.throws(()=>a.repairProposal(noticeArgs({corrections:[noticeCorrection]}),falseDefect),/duplicate_correction/);
});

test('a duplicate native notice repair reports non-approval and cannot turn a later revision into success',()=>fixture(context=>{
  const {event,read,call,dispatch,finish,assess}=context;
  const original=noticeArgs({...assess(noticeRequest),corrections:[noticeCorrection]});
  call('explanation_decide',original);const packet=a.propose(original).review.packet;
  hookReceipt(event,packet,'duplicate-assessment',call,noticeResult(packet,{verdict:'withheld',issues:[correctionIssue]}));
  const args={attempt_id:original.attempt_id,candidate_sha256:original.candidate_sha256,review_result:'current'};
  assert.deepEqual(event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_repair_notice',tool_use_id:'duplicate-repair',tool_input:args}),{});
  const response=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_repair_notice',arguments:args}}).result;
  assert.equal(response.isError,true);assert.match(response.content[0].text,/explanation_notice_repair_unavailable/);
  assert.match(response.content[0].text,/Neither the explanation nor its proposed notice is approved/);
  assert.equal(read().pending_tool.call_sha256,textDigest('duplicate-repair'));
  const denied=event({hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_decide',tool_use_id:'after-failure',
    tool_input:{...original,request:'current',revision:1}});
  assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');
  assert.match(denied.hookSpecificOutput.permissionDecisionReason,/Neither the explanation nor its proposed notice is approved/);
  assert.equal(read().status,'unavailable');assert.equal(finish('The notice was approved.').continue,false);
  assert.equal(read().attempt.status,'unavailable');assert.equal(read().attempt.final_sha256,null);
}));

test('notice review has a distinct decision and mandatory requirement and assessment findings',()=>{
  const {proposal}=initialNotice({corrections:[noticeCorrection]}),packet=proposal.review.packet;
  const wire=JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
  const tool=v.resultTools.find(t=>t.name==='explanation_notice_result');assert.ok(tool);assert.equal(wire.submission.tool,tool.name);
  const schema=structuredClone(wire.submission.input_schema);assert.deepEqual(schema.properties.challenge.enum,['current',packet.challenge]);
  schema.properties.challenge=tool.inputSchema.properties.challenge;assert.deepEqual(schema,tool.inputSchema);
  assert.deepEqual(tool.inputSchema.required,['challenge','notice_decision','requirement_review','evidence_review','assessment_review','checked_questions','issues']);
  const input={challenge:packet.challenge,notice_decision:'approve_notice',requirement_review:'The required measurement is absent.',
    evidence_review:'Matched baseline and mitigation elapsed-time measurements can determine the requested relative slowdown.',
    assessment_review:'The requested T1 assessment is correctly included with its supplied basis.',checked_questions:[v.assessmentId],issues:[]};
  const reply=v.resultSubmission(input,'notice');assert.equal(reply.result.kind,'final');assert.equal(reply.result.verdict,'complete');
  assert.deepEqual(reply.result.checked_questions,[v.assessmentId]);assert.deepEqual(JSON.parse(reply.result.answer),{requirement_review:input.requirement_review,evidence_review:input.evidence_review,assessment_review:input.assessment_review});
  assert.deepEqual(v.parseAnswer(reply.final_text,packet),reply.result);
  for(const field of ['requirement_review','evidence_review','assessment_review']){const missing={...input};delete missing[field];assert.throws(()=>v.resultSubmission(missing,'notice'));}
  for(const notice_decision of ['complete','withheld','approve_explanation',true])assert.throws(()=>v.resultSubmission({...input,notice_decision},'notice'));
  assert.throws(()=>v.resultSubmission({...input,notice_decision:'revise_notice'},'notice'),/missing_failure_reason/);
  assert.throws(()=>v.resultSubmission({...input,issues:[correctionIssue]},'notice'),/unresolved_claim/);
  assert.equal(v.resultSubmission({...input,notice_decision:'revise_notice',issues:[correctionIssue]},'notice').result.verdict,'withheld');
  assert.throws(()=>v.resultSubmission({...input,checked_questions:[]},'notice'),/invalid_list/);
  assert.throws(()=>v.resultSubmission({...input,unsupported:true},'notice'),/invalid_fields/);
});

function submissionReady(attempt,packet){
  attempt=v.observeAgent(attempt,spawn(packet));
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:'scope-child',agent_type:v.agentType,model:'claude-haiku-4-5-20251001'});
  const read={agent_id:'scope-child',tool_use_id:'scope-read',tool_input:{challenge:packet.challenge}};
  attempt=v.observePacket(attempt,{...read,hook_event_name:'PreToolUse'});
  return v.observePacket(attempt,{...read,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
}
test('notice and ordinary result tools cannot substitute for each other on any native proof path',()=>{
  const notice=initialNotice(),ready=submissionReady(notice.attempt,notice.proposal.review.packet),child={agent_id:'scope-child',tool_use_id:'scope-submit',hook_event_name:'PreToolUse'};
  assert.throws(()=>v.observeSubmission(ready,{...child,tool_input:submissionArgs(noticeResult(notice.proposal.review.packet))},'final'),/verification_invalid_fields/);
  assert.throws(()=>v.observeSubmission(ready,{...child,tool_input:submissionArgs(answer(notice.proposal.review.packet,{checked_questions:[v.assessmentId]}))},'final'),/submission_purpose/);
  const normal=initial(),args=finalArgs(normal.plan),final=v.finalize(args),finalAttempt=v.registerFinal(receipt(normal.attempt,normal.plan.packets[0]),final,args);
  for(const [attempt,packet]of [[normal.attempt,normal.plan.packets[0]],[finalAttempt,final.packet]]){
    const input={challenge:packet.challenge,notice_decision:'approve_notice',requirement_review:'A notice-only finding.',evidence_review:'A notice-only evidence review.',assessment_review:'A notice-only assessment.',checked_questions:[v.assessmentId],issues:[]};
    assert.throws(()=>v.observeSubmission(submissionReady(attempt,packet),{...child,tool_input:input},'notice'),/submission_purpose/);
  }
  const dispatcher=createDispatcher({host:'claude'});dispatcher({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
  dispatcher({jsonrpc:'2.0',method:'notifications/initialized'});
  const call=(name,args)=>dispatcher({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
  assert.equal(call('explanation_assess_request',{...binding,request:notice.args.request}).isError,undefined);
  assert.equal(call('explanation_decide',notice.args).isError,undefined);
  assert.equal(call('explanation_final_result',submissionArgs(noticeResult(notice.proposal.review.packet))).isError,true);
});

test('all separate notice findings are bound to the observed submission without permitting unsafe text or altered returns',()=>{
  const notice=initialNotice(),packet=notice.proposal.review.packet,input=submissionArgs(noticeResult(packet),'notice');
  const child={agent_id:'scope-child',tool_use_id:'scope-submit',tool_input:input},ready=submissionReady(notice.attempt,packet);
  const reserved=v.observeSubmission(ready,{...child,hook_event_name:'PreToolUse'},'notice'),payload=v.resultSubmission(input,'notice');
  for(const field of ['requirement_review','evidence_review','assessment_review']){
    const changed={...input,[field]:'Changed review content.'};assert.notEqual(v.resultSubmission(changed,'notice').final_text,payload.final_text);
    assert.throws(()=>v.observeSubmission(reserved,{...child,hook_event_name:'PostToolUse',tool_input:changed,submission_payload:payload},'notice'),/submission_changed/);
    assert.throws(()=>v.observeSubmission(reserved,{...child,hook_event_name:'PostToolUse',submission_payload:v.resultSubmission(changed,'notice')},'notice'),/submission_changed/);
    for(const value of ['',null,'x'.repeat(3001),'Bad\u202etext','sk-'+'SYNTHETIC'.repeat(4)])assert.throws(()=>v.resultSubmission({...input,[field]:value},'notice'));
  }
  const submitted=v.observeSubmission(reserved,{...child,hook_event_name:'PostToolUse',submission_payload:payload},'notice');assert.equal(submitted.verification.final.submitted,true);
  assert.doesNotMatch(canonical(submitted),/requirement_review|evidence_review|assessment_review|measurement/);
});

test('a valid JSON notice return cannot substitute newlines for literal escape text in a submitted quotation',()=>{
  const notice=initialNotice(),packet=notice.proposal.review.packet;
  for(const quote of ['A short requirement clause.','First clause.\\n\\nSecond clause.','First clause.\n\nSecond clause.']){
    const input={...submissionArgs(noticeResult(packet),'notice'),notice_decision:'revise_notice',issues:[{...correctionIssue,quote}]};
    const payload=v.resultSubmission(input,'notice'),child={agent_id:'scope-child',tool_use_id:'quote-submit',tool_input:input};
    let attempt=submissionReady(notice.attempt,packet);attempt=v.observeSubmission(attempt,{...child,hook_event_name:'PreToolUse'},'notice');
    attempt=v.observeSubmission(attempt,{...child,hook_event_name:'PostToolUse',submission_payload:payload},'notice');
    assert.equal(v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:'scope-child',last_assistant_message:payload.final_text}).verification.final.phase,'answered');
    if(quote.includes('\\n')){
      const changed=structuredClone(payload.result);changed.issues[0].quote=quote.replaceAll('\\n','\n');
      assert.ok(v.parseAnswer(canonical(changed),packet));
      assert.throws(()=>v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:'scope-child',last_assistant_message:canonical(changed)}),/unobserved_submission/);
      assert.equal(attempt.verification.final.return_corrections,0);assert.equal(attempt.verification.final.reply_sha256,null);
    }
  }
});

test('notice approval requires a separate evidence-sufficiency finding bound to the submitted result',()=>{
  const {proposal,attempt}=initialNotice(),packet=proposal.review.packet,wire=JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
  assert.ok(wire.submission.input_schema.required.includes('evidence_review'));
  const input=submissionArgs(noticeResult(packet),'notice');assert.equal(typeof input.evidence_review,'string');
  const reply=v.resultSubmission(input,'notice');assert.equal(JSON.parse(reply.result.answer).evidence_review,input.evidence_review);
  const absent={...input};delete absent.evidence_review;assert.throws(()=>v.resultSubmission(absent,'notice'),/invalid_fields/);
  const ready=submissionReady(attempt,packet),child={agent_id:'scope-child',tool_use_id:'sufficiency-submit',tool_input:input};
  const reserved=v.observeSubmission(ready,{...child,hook_event_name:'PreToolUse'},'notice');
  const changed=v.resultSubmission({...input,evidence_review:'A different evidence-sufficiency finding.'},'notice');
  assert.notEqual(changed.final_text,reply.final_text);
  assert.throws(()=>v.observeSubmission(reserved,{...child,hook_event_name:'PostToolUse',submission_payload:changed},'notice'),/submission_changed/);
});
