'use strict';
// Synthetic protocol tests do not establish model accuracy or native delivery.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const a=require('../scripts/explanation-attempt.cjs'),v=require('../scripts/explanation-verification.cjs');
const {canonical,textDigest,digest}=require('../scripts/verification-packet.cjs');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),{handle:stop}=require('../hooks/scenario-stop.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {assessRequest,assessmentResult,assessmentSubmission}=require('./helpers/request-assessment.cjs');
const {reviewNotice}=require('./helpers/withholding-review.cjs');
const binding={attempt_id:'12345678-1234-1234-1234-123456789abc',candidate_sha256:'a'.repeat(64)};
const request='Explain the supplied workload. T1 reads B and writes A. A draft says that T1 reads A; assess this claim. Exact measured slowdown is also essential, but no measurements are provided.';

test('pre-notice assessment has a gap-focused finding while the normal explanation still requires its own fact and final checks',()=>{
  const plan=v.prepareAssessment({...binding,request}),wire=JSON.parse(plan.packets[0].prompt.slice(plan.packets[0].prompt.indexOf('\n')+1));
  assert.ok(wire.submission.input_schema.required.includes('gap_review'));
  assert.equal(Object.hasOwn(wire.submission.input_schema.properties,'requirement_review'),false);
  assert.equal(wire.data.original_request,request);assert.equal(plan.complete_authorized,false);
  const observed=assessmentReceipt(),draft={...binding,request,blocks:[{text:'A proposed complete explanation.',question_ids:['MECHANISM']}],
    questions:[{id:'MECHANISM',kind:'mechanism',target:'The requested mechanism',conditions:'Use the supplied evidence.',source_ids:[]}],sources:[]};
  const pending=v.registerPlan(observed.attempt,v.prepare(draft),textDigest(request));
  assert.equal(pending.status,'pending');assert.equal(pending.verification.facts[0].phase,'planned');assert.equal(pending.verification.final,null);
  assert.throws(()=>a.checkedAttempt({...pending,status:'complete',final_sha256:'b'.repeat(64)}));
});

test('a dedicated assessment result distinguishes an identified evidence gap from failure to assess the request',()=>{
  const packet=v.prepareAssessment({...binding,request}).packets[0],wire=JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
  assert.equal(wire.submission.tool,'explanation_assessment_result');
  const input={challenge:packet.challenge,assessment_decision:'assessed',gap_review:'The required measured slowdown is absent.',
    corrections:[{claim:'T1 reads A.',correction:'T1 reads B.',basis:'The supplied scenario specifies the read cell.'}],
    essential_gaps:[{requirement:'Exact measured slowdown',reason:'missing_evidence',request_quote:'Exact measured slowdown is also essential, but no measurements are provided.',evidence_needed:'Comparable workload measurements.'}],issues:[]};
  const reply=v.resultSubmission(input,'assessment');assert.equal(reply.result.kind,'fact');assert.equal(reply.result.verdict,'answered');
  assert.deepEqual(JSON.parse(reply.result.answer),{gap_review:input.gap_review,essential_gaps:input.essential_gaps,corrections:input.corrections});
  const legacy={...input,requirement_review:input.gap_review};delete legacy.gap_review;assert.throws(()=>v.resultSubmission(legacy,'assessment'),/invalid_fields/);
  assert.deepEqual(reply.result.checked_questions,[]);assert.deepEqual(v.parseAnswer(reply.final_text,packet),reply.result);
  assert.throws(()=>v.resultSubmission({...input,assessment_decision:'unresolved'},'assessment'));
  assert.throws(()=>v.resultSubmission({...input,assessment_decision:'assessment_failed'},'assessment'),/missing_failure_reason/);
  assert.equal(v.resultSubmission({...input,assessment_decision:'assessment_failed',issues:[{quote:'Assessment input',reason:'The requirement cannot be interpreted reliably.',evidence_needed:'Unambiguous request context.'}]},'assessment').result.verdict,'unresolved');
});

test('assessment findings have strict bounded data fields and cannot hide an assessment failure among evidence gaps',()=>{
  const result=assessmentResult({...binding,request}),input=assessmentSubmission(result),tool=v.resultTools.find(t=>t.name==='explanation_assessment_result');
  assert.deepEqual(tool.inputSchema.required,['challenge','assessment_decision','gap_review','essential_gaps','corrections','issues']);
  for(const field of tool.inputSchema.required){const missing={...input};delete missing[field];assert.throws(()=>v.resultSubmission(missing,'assessment'));}
  const issue={quote:'Assessment context',reason:'The request cannot be interpreted reliably.',evidence_needed:'Unambiguous context.'};
  assert.throws(()=>v.resultSubmission({...input,issues:[issue]},'assessment'),/unresolved_claim/);
  assert.throws(()=>v.resultSubmission({...input,supported:true},'assessment'),/invalid_fields/);
  for(const field of ['gap_review'])for(const value of ['',null,'x'.repeat(3001),'Bad\u202etext','\ud800','sk-'+'SYNTHETIC'.repeat(4)])
    assert.throws(()=>v.resultSubmission({...input,[field]:value},'assessment'));
  const gap={requirement:'An essential requirement',reason:'missing_evidence',request_quote:'A required original clause.',evidence_needed:'The specific missing evidence.'};
  for(const essential_gaps of [null,{},[gap,gap],Array(9).fill(gap),[{...gap,execute:'unexpected'}],[{request_quote:gap.request_quote}],
    [{...gap,request_quote:'x'.repeat(1001)}],[{...gap,evidence_needed:'Bad\u202etext'}],[{...gap,evidence_needed:'sk-'+'SYNTHETIC'.repeat(4)}]])
    assert.throws(()=>v.resultSubmission({...input,essential_gaps},'assessment'));
  let invoked=0;const accessor={...input};Object.defineProperty(accessor,'corrections',{enumerable:true,get(){invoked++;return input.corrections;}});
  assert.throws(()=>v.resultSubmission(accessor,'assessment'));assert.equal(invoked,0);
  const valid=v.resultSubmission({...input,essential_gaps:[gap]},'assessment');assert.equal(valid.result.verdict,'answered');
  assert.deepEqual(JSON.parse(valid.result.answer).essential_gaps,[gap]);assert.equal(tool.annotations.openWorldHint,false);
});

test('a changed mitigation requirement quotation is rejected unchanged, not repaired into a notice',()=>{
  const original='Explain why two transactions updating different rows can violate that invariant, and give a mitigation with its trade-off.';
  const packet=v.prepareAssessment({...binding,request:original}).packets[0];
  const payload=v.resultSubmission({challenge:packet.challenge,assessment_decision:'assessed',
    gap_review:'The checker claims it needs a source spelling out a mitigation.',
    essential_gaps:[{requirement:'Specify a mitigation',request_quote:'Provide a valid mitigation with its trade-off.',reason:'missing_evidence',evidence_needed:'A source stating the completed solution.'}],corrections:[],issues:[]},'assessment');
  const input={...binding,assessment_result:'current',language:'en'};
  assert.equal(original.includes(JSON.parse(payload.result.answer).essential_gaps[0].request_quote),false);
  assert.throws(()=>a.noticeFromAssessment(input,original,payload.result),/withholding_request_quote_not_found/);
  assert.equal(JSON.parse(payload.result.answer).essential_gaps[0].request_quote,'Provide a valid mitigation with its trade-off.');
  // This is exact-data rejection, not a local judgment that the claimed gap is genuine.
  const valid=assessmentReceipt().result;
  assert.equal(a.noticeFromAssessment(input,request,valid).proposal.decision.disposition,'withheld');
});

test('assessment and ordinary fact result tools cannot substitute for each other in native receipts or the assessment cache',()=>{
  const assessPlan=v.prepareAssessment({...binding,request}),normalPlan=v.prepare({...binding,request,blocks:[{text:'A proposed mechanism.',question_ids:['MECHANISM']}],
    questions:[{id:'MECHANISM',kind:'mechanism',target:'The supplied mechanism',conditions:'Use the supplied source.',source_ids:[]}],sources:[]});
  for(const [plan,register,wrongKind]of [[assessPlan,v.registerAssessment,'fact'],[normalPlan,v.registerPlan,'assessment']]){
    const packet=plan.packets[0];let attempt=register(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
    attempt=v.observeAgent(attempt,{hook_event_name:'PreToolUse',tool_name:'Agent',tool_use_id:'scope-spawn',tool_input:{description:'Check packet',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}});
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:'scope-child',agent_type:v.agentType});
    const actor={agent_id:'scope-child',tool_use_id:'scope-get',tool_input:{challenge:packet.challenge}};
    attempt=v.observePacket(attempt,{...actor,hook_event_name:'PreToolUse'});attempt=v.observePacket(attempt,{...actor,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
    const args=wrongKind==='fact'?{challenge:packet.challenge,verdict:'answered',answer:'An ordinary fact result cannot replace the request assessment.',issues:[]}
      :{...assessmentSubmission(assessmentResult({...binding,request})),challenge:packet.challenge};
    assert.throws(()=>v.observeSubmission(attempt,{agent_id:'scope-child',tool_use_id:'wrong-submit',hook_event_name:'PreToolUse',tool_input:args},wrongKind),/submission_purpose/);
  }
  const d=connection('claude');assert.equal(invoke(d,'explanation_assess_request',{...binding,request}).isError,undefined);
  const result=assessmentResult({...binding,request}),{protocol,kind,checked_questions,...ordinary}=result;
  assert.equal(invoke(d,'explanation_fact_result',ordinary).isError,true);
  assert.equal(invoke(d,'explanation_assessment_result',assessmentSubmission(result)).isError,undefined);
});

test('native assessment submission and its exact return preserve the separate findings and every evidence gap',()=>{
  const observed=assessmentReceipt(),input=assessmentSubmission(observed.result),changed={...input,corrections:[{...input.corrections[0],correction:'A different claim assessment.'}]};
  assert.notEqual(canonical(JSON.parse(v.resultSubmission(changed,'assessment').final_text)),canonical(observed.result));
  assert.equal(observed.attempt.verification.facts[0].reply_sha256,digest(observed.result));
  assert.equal(observed.attempt.verification.facts[0].submitted,true);assert.equal(observed.attempt.verification.facts[0].return_corrections,0);
  const proposal=a.propose(noticeArguments(observed.result));
  assert.throws(()=>v.registerWithholding(observed.attempt,a.propose(noticeArguments(v.resultSubmission(changed,'assessment').result)).review,textDigest(request)),/unobserved_assessment/);
  assert.deepEqual(JSON.parse(JSON.parse(proposal.review.packet.prompt.slice(proposal.review.packet.prompt.indexOf('\n')+1)).data.facts[0].result.answer),JSON.parse(observed.result.answer));
});

test('request assessment contains the full original evidence but cannot accept a parent notice or its classifications',()=>{
  const args={...binding,request},plan=v.prepareAssessment(args);assert.equal(plan.purpose,'request_assessment');assert.equal(plan.packets.length,1);
  assert.equal(plan.packets[0].id,'REQUEST_ASSESSMENT');assert.equal(plan.packets[0].kind,'fact');assert.equal(plan.draft_sha256,null);
  const body=JSON.parse(plan.packets[0].prompt.slice(plan.packets[0].prompt.indexOf('\n')+1));
  assert.equal(body.data.original_request,request);assert.equal(body.data.purpose,'request_assessment');
  for(const field of ['final_text','unresolved','unresolved_requirements','corrections','proposed_corrections','draft']){
    assert.equal(Object.hasOwn(body.data,field),false);assert.throws(()=>v.prepareAssessment({...args,[field]:'PARENT_PROPOSAL_ONLY'}));
  }
  assert.doesNotMatch(plan.packets[0].prompt,/PARENT_PROPOSAL_ONLY/);
  const pending=v.registerAssessment(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
  assert.equal(pending.status,'pending');assert.equal(pending.final_sha256,null);assert.equal(pending.verification.purpose,'request_assessment');
  assert.equal(pending.verification.final,null);assert.equal(pending.verification.facts[0].phase,'planned');
  assert.doesNotMatch(canonical(pending),/T1 reads|original_request|final_text/);
  assert.throws(()=>v.registerAssessment(pending,plan,textDigest(request)));
  assert.throws(()=>v.registerAssessment(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request+' Changed.')));
  assert.throws(()=>a.checkedAttempt({...pending,status:'complete',final_sha256:'b'.repeat(64)}));
});

function assessmentReceipt(extra={}){
  const args={...binding,request},plan=v.prepareAssessment(args),packet=plan.packets[0];
  let attempt=v.registerAssessment(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
  const planned=attempt,pre={hook_event_name:'PreToolUse',tool_name:'Agent',tool_use_id:'assessment-spawn',tool_input:{description:'Assess request evidence',
    prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}};
  attempt=v.observeAgent(attempt,pre);attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:'assessment-child',agent_type:v.agentType,model:'claude-haiku-4-5-20251001'});
  const get={agent_id:'assessment-child',tool_use_id:'assessment-get',tool_input:{challenge:packet.challenge}};
  attempt=v.observePacket(attempt,{...get,hook_event_name:'PreToolUse'});attempt=v.observePacket(attempt,{...get,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)});
  const resultArgs={challenge:packet.challenge,assessment_decision:'assessed',gap_review:'The exact measurement is absent.',
    corrections:[{claim:'T1 reads A.',correction:'T1 reads B.',basis:'The supplied scenario specifies the read cell.'}],
    essential_gaps:[{requirement:'Exact measured slowdown',reason:'missing_evidence',request_quote:'Exact measured slowdown is also essential, but no measurements are provided.',evidence_needed:'Comparable workload measurements.'}],issues:[],...extra};
  const payload=v.resultSubmission(resultArgs,'assessment'),submit={agent_id:'assessment-child',tool_use_id:'assessment-submit',tool_input:resultArgs};
  attempt=v.observeSubmission(attempt,{...submit,hook_event_name:'PreToolUse'},'assessment');attempt=v.observeSubmission(attempt,{...submit,hook_event_name:'PostToolUse',submission_payload:payload},'assessment');
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:'assessment-child',last_assistant_message:payload.final_text});
  attempt=v.observeAgent(attempt,{...pre,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:payload.final_text+'\nagentId: assessment-child (for resuming)'}]});
  return {args,plan,packet,planned,attempt,result:payload.result};
}
function noticeArguments(result){return {...binding,request,revision:0,assessment_result:result,disposition:'withheld',language:'en',
  unresolved:[{requirement:'Exact measured slowdown',request_quote:'Exact measured slowdown is also essential, but no measurements are provided.',
    reason:'missing_evidence',evidence_needed:'Measurements for the requested workload.'}],
  corrections:[{claim:'T1 reads A',correction:'T1 reads B and writes A.',basis:'The supplied workload states these actions.'}]};}

test('a notice can begin only after the same original request assessment actually returned answered',()=>{
  const observed=assessmentReceipt(),args=noticeArguments(observed.result),proposal=a.propose(args);
  const packet=JSON.parse(proposal.review.packet.prompt.slice(proposal.review.packet.prompt.indexOf('\n')+1));
  assert.deepEqual(packet.data.facts,[{id:v.assessmentId,result:observed.result}]);
  for(const attempt of [a.begin(binding.attempt_id,binding.candidate_sha256),observed.planned])
    assert.throws(()=>v.registerWithholding(attempt,proposal.review,textDigest(request)));
  const pending=v.registerWithholding(observed.attempt,proposal.review,textDigest(request));
  assert.equal(pending.status,'pending');assert.equal(pending.verification.purpose,'withholding');
  assert.deepEqual(pending.verification.facts,observed.attempt.verification.facts);assert.equal(pending.verification.final.phase,'planned');
  const altered=a.propose({...args,assessment_result:{...observed.result,answer:'A substituted assessment.'}});
  assert.throws(()=>v.registerWithholding(observed.attempt,altered.review,textDigest(request)));
  assert.throws(()=>a.propose({...args,assessment_result:'current'}));
  assert.throws(()=>a.propose({...args,assessment_result:{...observed.result,challenge:'b'.repeat(64)}}));
  assert.throws(()=>a.propose({...args,request:request+' A new constraint.'}));
  assert.throws(()=>v.registerWithholding({...observed.attempt,status:'unavailable'},proposal.review,textDigest(request)));
});

test('an unresolved assessment is a failed check, not permission to construct a withholding certificate',()=>{
  const observed=assessmentReceipt({assessment_decision:'assessment_failed',issues:[{quote:'The source',reason:'The assessment itself cannot be completed.',evidence_needed:'Restore the missing source context.'}]});
  assert.equal(observed.attempt.status,'unavailable');
  assert.throws(()=>a.propose(noticeArguments(observed.result)));
});

test('a completed assessment permits normal drafting without becoming completion proof or permitting another assessment loop',()=>{
  const observed=assessmentReceipt(),args={...binding,request,blocks:[{text:'A proposed explanation still needs its own checks.',question_ids:['MECHANISM']}],
    questions:[{id:'MECHANISM',kind:'mechanism',target:'The supplied workload mechanism',conditions:'Use the supplied definitions.',source_ids:[]}],sources:[]};
  const plan=v.prepare(args),normal=v.registerPlan(observed.attempt,plan,textDigest(request));
  assert.equal(normal.status,'pending');assert.equal(normal.verification.purpose,undefined);
  assert.deepEqual(normal.verification.prior_assessment,observed.attempt.verification);
  assert.equal(normal.verification.facts[0].id,'MECHANISM');assert.equal(normal.verification.facts[0].phase,'planned');
  assert.throws(()=>v.registerAssessment(normal,observed.plan,textDigest(request)));
  assert.throws(()=>v.registerPlan(observed.planned,plan,textDigest(request)));
  assert.throws(()=>a.checkedAttempt({...normal,status:'complete',final_sha256:'b'.repeat(64)}));
  const proposal=a.propose(noticeArguments(observed.result));
  assert.deepEqual(v.registerWithholding(normal,proposal.review,textDigest(request)).verification.facts,observed.attempt.verification.facts);
  const unassessed=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
  const assessment=v.registerAssessment(unassessed,observed.plan,textDigest(request));assert.equal(assessment.verification.purpose,'request_assessment');
  assert.ok(assessment.verification.prior_verification_sha256);assert.equal(assessment.verification.facts[0].phase,'planned');
  const active=v.observeAgent(unassessed,{hook_event_name:'PreToolUse',tool_name:'Agent',tool_use_id:'normal-spawn',tool_input:{description:'Check mechanism',
    prompt:v.launchPrompt(plan.packets[0].challenge),subagent_type:v.agentType,run_in_background:false}});
  assert.throws(()=>v.registerAssessment(active,observed.plan,textDigest(request)));
});

function connection(host){
  const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});return dispatch;
}
const invoke=(dispatch,name,args)=>dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
function fixture(host,body){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'assessment-test-'));
  const options={root,enabled:true,now:1000000},base={session_id:'assessment-session',turn_id:'assessment-parent'};
  const input=(event,extra={})=>({...base,hook_event_name:event,...extra}),event=value=>handleEvent(value,options);
  const prefix=host==='claude'?'mcp__plugin_ttak_ttak_scenario__':'mcp__ttak_scenario__';
  const file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file,'utf8'));
  const dispatch=connection(host),childDispatch=host==='codex'?connection(host):dispatch;
  const finish=text=>stop(input('Stop',{last_assistant_message:text,stop_hook_active:true}),true,options);
  try{
    event(input('UserPromptSubmit',{prompt:request}));const args={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate,request};
    body({host,args,input,event,options,prefix,file,read,dispatch,childDispatch,finish});
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}

test('normal hook selectors reuse only the observed request assessment and leave notice approval pending',()=>{
  for(const host of ['claude','codex'])fixture(host,ctx=>{
    const {args,input,event,options,prefix,read,dispatch,childDispatch,finish,file}=ctx;
    const result=assessRequest(args,input,options,dispatch,{host,childDispatch}),before=read();
    const selector={...noticeArguments(result),...args,request:'current',assessment_result:host==='claude'?'current':result};
    const pre=input('PreToolUse',{tool_name:prefix+'explanation_decide',tool_use_id:'first-notice',tool_input:{...selector,attempt_id:'current',candidate_sha256:'current'}});
    const allowed=event(pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');
    const resolved=allowed.hookSpecificOutput.updatedInput,response=invoke(dispatch,'explanation_decide',resolved);
    assert.equal(response.isError,undefined);const proposal=a.propose({...selector,request,assessment_result:result});
    assert.deepEqual(response.structuredContent,a.exposeDecision(proposal,host,request,host==='claude'?result:undefined));
    assert.deepEqual(event({...pre,hook_event_name:'PostToolUse',tool_input:resolved,tool_response:response}),{});
    assert.equal(read().attempt.status,'pending');assert.equal(read().attempt.final_sha256,null);
    assert.equal(read().request_sha256,before.request_sha256);assert.deepEqual(read().attempt.verification.facts,before.attempt.verification.facts);
    assert.equal(read().attempt.verification.final.phase,'planned');assert.equal(read().pending_tool,undefined);
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),/T1 reads|original_request|resolved_assessment|assessment_result/);
    // The independently observed assessment alone cannot approve the notice.
    if(host==='codex'){
      reviewNotice({...selector,request,assessment_result:result},input,options);
      assert.equal(read().attempt.status,'withheld');assert.deepEqual(finish(proposal.decision.final_text),{});
    }else{
      assert.equal(finish(proposal.decision.final_text).continue,false);assert.equal(read().attempt.status,'unavailable');
    }
  });
});

test('assessment cache isolation is compatible with a separately connected Codex child but cannot invent a current result',()=>fixture('codex',ctx=>{
  const {args,input,options,dispatch,childDispatch,read}=ctx,result=assessRequest(args,input,options,dispatch,{host:'codex',childDispatch});
  const notice={...noticeArguments(result),...args,request:'current'};
  assert.equal(invoke(dispatch,'explanation_decide',{...notice,assessment_result:'current'}).isError,true);
  assert.equal(invoke(childDispatch,'explanation_decide',notice).isError,true);
  const reply=invoke(dispatch,'explanation_decide',notice);assert.equal(reply.isError,undefined);
  assert.equal(reply.structuredContent.review.assessment_sha256,digest(result));assert.equal(reply.structuredContent.notice_authorized,false);
  assert.equal(read().attempt.verification.purpose,'request_assessment');
}));

test('missing assessment or its native receipt cannot be replaced by a well-formed fact object or cache selector',()=>{
  for(const mode of ['explicit','selector','prepared-only'])fixture('claude',ctx=>{
    const {args,input,event,prefix,dispatch,read,finish}=ctx,result=assessmentResult(args);
    if(mode==='prepared-only'){
      const pre=input('PreToolUse',{tool_name:prefix+'explanation_assess_request',tool_use_id:'assessment-prepare',tool_input:args});
      assert.deepEqual(event(pre),{});const response=invoke(dispatch,'explanation_assess_request',args);
      assert.deepEqual(event({...pre,hook_event_name:'PostToolUse',tool_response:response}),{});
    }
    const notice={...noticeArguments(result),...args,...(mode==='selector'?{request:'current',assessment_result:'current'}:{})};
    const denied=event(input('PreToolUse',{tool_name:prefix+'explanation_decide',tool_use_id:'unobserved-notice',tool_input:notice}));
    assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');assert.equal(read().status,'unavailable');
    assert.equal(finish('The notice was approved.').continue,false);
  });
});

test('the assessment parent call retains a missing or changed Post receipt and cannot be restarted after failure',()=>{
  for(const mode of ['missing','changed'])fixture('claude',ctx=>{
    const {args,input,event,prefix,dispatch,read,finish}=ctx;
    const pre=input('PreToolUse',{tool_name:prefix+'explanation_assess_request',tool_use_id:'original-assessment',tool_input:args});
    assert.deepEqual(event(pre),{});const response=invoke(dispatch,'explanation_assess_request',args);assert.equal(response.isError,undefined);
    assert.equal(read().pending_tool.call_sha256,textDigest('original-assessment'));
    if(mode==='changed'){
      const payload=structuredClone(response.structuredContent);payload.request_sha256='f'.repeat(64);
      const altered={structuredContent:payload,content:[{type:'text',text:canonical(payload)}]};
      assert.match(event({...pre,hook_event_name:'PostToolUse',tool_response:altered}).systemMessage,/could not record/);
    }
    const denied=event({...pre,tool_use_id:'replacement-assessment'});assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');
    assert.equal(read().status,'unavailable');assert.equal(finish('The assessment succeeded.').continue,false);
  });
});

test('a completed assessment cannot be rerun and changed actual assessment bytes fail at both hook boundaries',()=>{
  for(const mode of ['duplicate','explicit-change','selector-response-change','selector-response-omission'])fixture('claude',ctx=>{
    const {args,input,event,options,prefix,dispatch,read,file}=ctx,result=assessRequest(args,input,options,dispatch,{host:'claude'});
    if(mode==='duplicate'){
      const denied=event(input('PreToolUse',{tool_name:prefix+'explanation_assess_request',tool_use_id:'repeat',tool_input:args}));
      assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');
    }else{
      const notice={...noticeArguments(result),...args,request:'current',assessment_result:mode==='explicit-change'?{...result,answer:'A changed assessment.'}:'current'};
      const pre=input('PreToolUse',{tool_name:prefix+'explanation_decide',tool_use_id:'changed-assessment',tool_input:notice}),allowed=event(pre);
      if(mode==='explicit-change')assert.equal(allowed.hookSpecificOutput.permissionDecision,'deny');
      else{
        assert.deepEqual(allowed,{});const response=invoke(dispatch,'explanation_decide',notice);assert.equal(response.isError,undefined);
        const payload=response.structuredContent;
        if(mode==='selector-response-change')payload.resolved_assessment.answer='A changed assessment.';else delete payload.resolved_assessment;
        assert.match(event({...pre,hook_event_name:'PostToolUse',tool_response:{structuredContent:payload,content:[{type:'text',text:canonical(payload)}]}}).systemMessage,/could not record/);
      }
    }
    assert.equal(read().status,'unavailable');assert.doesNotMatch(fs.readFileSync(file,'utf8'),/A changed assessment/);
  });
});

test('assessment packet and result caches enforce connection, source, candidate, cardinality and lifetime bounds',()=>{
  const d=connection('claude'),args={...binding,request},other=connection('claude');
  const prepared=invoke(d,'explanation_assess_request',args);assert.equal(prepared.isError,undefined);
  const challenge=v.prepareAssessment(args).packets[0].challenge;
  assert.equal(invoke(other,'explanation_packet',{challenge}).isError,true);
  for(const extra of [{},{candidate_sha256:'b'.repeat(64)},{request:request+' Changed.'}])assert.equal(invoke(d,'explanation_assess_request',{...args,...extra}).isError,true);
  const result=assessmentResult(args),submission=assessmentSubmission(result);
  assert.equal(invoke(d,'explanation_assessment_result',submission).isError,undefined);
  assert.equal(invoke(d,'explanation_assessment_result',submission).isError,true);
  assert.equal(invoke(d,'explanation_decide',{...noticeArguments(result),assessment_result:{...result,answer:'Changed.'}}).isError,true);
  assert.equal(invoke(d,'explanation_decide',{...noticeArguments(result),request:'current',assessment_result:'current'}).isError,undefined);
  const now=Date.now;let tick=100000;Date.now=()=>tick;
  try{
    const bounded=connection('claude');
    for(let i=0;i<8;i++)assert.equal(invoke(bounded,'explanation_assess_request',{...args,attempt_id:'bounded-'+i}).isError,undefined);
    assert.equal(invoke(bounded,'explanation_assess_request',{...args,attempt_id:'bounded-overflow'}).isError,true);
    tick+=30*60*1000+1;
    assert.equal(invoke(bounded,'explanation_packet',{challenge:v.prepareAssessment({...args,attempt_id:'bounded-0'}).packets[0].challenge}).isError,true);
    assert.equal(invoke(bounded,'explanation_assess_request',{...args,attempt_id:'after-expiry'}).isError,undefined);
  }finally{Date.now=now;}
});

test('Codex assessment recipe stores its exact native result separately and transfers it unchanged to the notice proposal',async()=>{
  const {args,plan,result}=assessmentReceipt(),wire=v.dispatchPacket(plan,plan.packets[0],{...binding,challenge:plan.packets[0].challenge});
  const adapter=v.exposePlan(plan,'codex').native_dispatch,AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const memory=new Map(),seen=[];let emitted;
  const mocks={mcp__ttak_scenario__explanation_dispatch:async()=>wire,
    multi_agent_v1__spawn_agent:async value=>{assert.deepEqual(value,wire.native_spawn);seen.push('spawn');return {agent_id:'recipe-child'};},
    multi_agent_v1__wait_agent:async value=>{assert.deepEqual(value.targets,['recipe-child']);seen.push('wait');return {status:{'recipe-child':{completed:canonical(result)}},timed_out:false};},
    multi_agent_v1__close_agent:async()=>{seen.push('close');}};
  mocks.mcp__ttak_scenario__explanation_dispatch=async()=>({structuredContent:wire});
  await new AsyncFunction('tools','load','store','text',adapter.spawn_agent_code)(mocks,key=>memory.get(key),(key,value)=>memory.set(key,value),value=>{emitted=value;});
  assert.deepEqual(seen,['spawn','wait','close']);const held=memory.get('ttak-verification');
  assert.deepEqual(held.assessment,{id:v.assessmentId,result});assert.deepEqual(held.facts,[]);assert.equal(held.request,request);assert.equal(held.final,undefined);
  assert.deepEqual(emitted,{packet_id:v.assessmentId,result,delivery_status:'unverified'});
  let actual;
  await new AsyncFunction('tools','load','text',adapter.notice_from_assessment_code)({mcp__ttak_scenario__explanation_notice_from_assessment:async value=>{actual=value;return {proposal:true};}},key=>memory.get(key),()=>{});
  assert.equal(actual.assessment_result,held.assessment.result);assert.deepEqual(actual,{...binding,assessment_result:result,language:'en'});
});
