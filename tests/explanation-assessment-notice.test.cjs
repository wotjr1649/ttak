'use strict';
// Synthetic protocol evidence only; native runs separately establish actual model behavior.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const a=require('../scripts/explanation-attempt.cjs'),v=require('../scripts/explanation-verification.cjs');
const {canonical,digest,textDigest}=require('../scripts/verification-packet.cjs');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),{handle:stop}=require('../hooks/scenario-stop.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {assessRequest}=require('./helpers/request-assessment.cjs');
const binding={attempt_id:'12345678-1234-1234-1234-123456789abc',candidate_sha256:'a'.repeat(64)};
const request='Explain the supplied scenario and report measured slowdown. No measurements are supplied. T1 reads B; its guarded write to A occurs only when B is true. A draft says T1 reads A; assess that claim.';
const gap={requirement:'Measured slowdown',request_quote:'report measured slowdown',reason:'missing_evidence',evidence_needed:'Matched baseline and mitigation execution times for the same workload.'};
const correction={claim:'T1 reads A.',correction:'T1 reads B. Its guarded write target is A; a false guard executes no write.',basis:'The supplied scenario defines the read cell and the guarded write.'};
function assessment(overrides={},args={...binding,request}){
  const packet=v.prepareAssessment(args).packets[0];
  return v.resultSubmission({challenge:packet.challenge,assessment_decision:'assessed',gap_review:'The required measurement is absent.',
    essential_gaps:[gap],corrections:[correction],issues:[],...overrides},'assessment').result;
}
const input=assessment_result=>({...binding,language:'en',assessment_result});

function connection(host){
  const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'synthetic-test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});return dispatch;
}
const invoke=(dispatch,name,args)=>dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
function fixture(host,body,{assess=true}={}){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'assessment-notice-test-'));
  const options={root,enabled:true,now:1000000},base={session_id:'direct-notice-session',turn_id:'direct-notice-parent'};
  const event=(name,extra={})=>({...base,hook_event_name:name,...extra}),handle=value=>handleEvent(value,options);
  const prefix=host==='claude'?'mcp__plugin_ttak_ttak_scenario__':'mcp__ttak_scenario__';
  const file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file));
  const dispatch=connection(host),childDispatch=host==='codex'?connection(host):dispatch;
  try{
    handle(event('UserPromptSubmit',{prompt:request}));const args={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate,request};
    const result=assessment({},args);
    if(assess)assert.deepEqual(assessRequest(args,event,options,dispatch,{host,childDispatch,result}),result);
    const selector={attempt_id:'current',candidate_sha256:'current',assessment_result:host==='claude'?'current':result,language:'en'};
    const pre=event('PreToolUse',{tool_name:prefix+'explanation_notice_from_assessment',tool_use_id:'direct-notice',tool_input:selector});
    const finish=text=>stop(event('Stop',{last_assistant_message:text,stop_hook_active:true}),true,options);
    body({host,args,result,selector,pre,event,handle,options,prefix,file,read,dispatch,childDispatch,finish});
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}
function propose(ctx){
  const {pre,handle,dispatch,result}=ctx,allowed=handle(pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');
  const args=allowed.hookSpecificOutput.updatedInput,response=invoke(dispatch,'explanation_notice_from_assessment',args);
  assert.equal(response.isError,undefined);
  const compiled=a.noticeFromAssessment(args,request,result);assert.deepEqual(response.structuredContent,a.exposeAssessmentNotice(compiled,ctx.host));
  return {args,response,compiled,post:{...pre,hook_event_name:'PostToolUse',tool_input:args,tool_response:response}};
}
function freshReview(ctx,proposal,overrides={}){
  const {host,event,handle,prefix,childDispatch}=ctx,packet=proposal.review.packet,id='notice-'+proposal.review.revision,agent='fresh-'+id;
  const spawn=event('PreToolUse',{tool_name:host==='claude'?'Agent':'spawn_agent',tool_use_id:id,tool_input:host==='claude'
    ?v.exposeFinal(proposal.review,host).native_dispatch.Agent:{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}});
  assert.deepEqual(handle(spawn),{});const returned={...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:agent}};
  if(host==='codex')assert.deepEqual(handle(returned),{});
  const actor={agent_id:agent,turn_id:id+'-turn'};
  assert.equal(handle(event('SubagentStart',{...actor,agent_type:host==='claude'?v.agentType:'default',model:host==='claude'?'claude-haiku-4-5-20251001':'gpt-5.6-luna'})).hookSpecificOutput.hookEventName,'SubagentStart');
  function childCall(name,args){
    const pre=event('PreToolUse',{...actor,tool_name:prefix+name,tool_use_id:id+'-'+name,tool_input:args});assert.deepEqual(handle(pre),{});
    const response=invoke(childDispatch,name,args);assert.equal(response.isError,undefined);
    assert.deepEqual(handle({...pre,hook_event_name:'PostToolUse',tool_response:response}),{});return response.structuredContent;
  }
  if(host==='claude')assert.deepEqual(childCall('explanation_packet',{challenge:packet.challenge}),v.packetBody(packet));
  const submitted=childCall('explanation_notice_result',{challenge:packet.challenge,notice_decision:'approve_notice',
    requirement_review:'Synthetic review of the actual gap classification.',evidence_review:'Synthetic review of the requested measurements.',
    assessment_review:'Synthetic review of the requested claim correction.',checked_questions:[v.assessmentId],issues:[],...overrides});
  assert.deepEqual(handle(event('SubagentStop',{...actor,last_assistant_message:submitted.final_text})),{});
  if(host==='claude')assert.deepEqual(handle(returned),{});return submitted.result;
}

test('the initial notice carries every actual assessment gap and correction without parent reconstruction',()=>{
  const result=assessment(),compiled=a.noticeFromAssessment(input(result),request,result);
  assert.deepEqual(compiled.args,{...binding,request,assessment_result:result,language:'en',disposition:'withheld',revision:0,unresolved:[gap],corrections:[correction]});
  assert.deepEqual(compiled.proposal,a.propose(compiled.args));
  assert.equal(compiled.proposal.review.assessment_sha256,digest(result));
  const payload=a.exposeAssessmentNotice(compiled,'claude');
  assert.deepEqual(payload.source_assessment,{request,assessment_result:result});
  assert.equal(payload.notice_authorized,false);assert.equal(payload.review.complete_authorized,false);
  assert.match(payload.final_text,/a false guard executes no write/);
});

test('the assessment notice helper accepts only binding, language and the unchanged actual result',()=>{
  const result=assessment();
  assert.deepEqual(a.assessmentNoticeTool.inputSchema.required,['attempt_id','candidate_sha256','assessment_result','language']);
  assert.equal(a.assessmentNoticeTool.inputSchema.additionalProperties,false);
  for(const extra of [{request},{revision:0},{unresolved:[]},{corrections:[]},{final_text:'A parent-authored notice.'}])
    assert.throws(()=>a.noticeFromAssessment({...input(result),...extra},request,result));
  assert.throws(()=>a.noticeFromAssessment({...input(result),language:'fr'},request,result));
  assert.throws(()=>a.noticeFromAssessment(input(result),request+' Changed.',result));
  const changed=assessment({corrections:[{...correction,correction:'A different assessment.'}]});
  assert.throws(()=>a.noticeFromAssessment(input(changed),request,result));
  assert.deepEqual(a.noticeFromAssessment(input('current'),request,result).args.assessment_result,result);
});

test('empty gaps, a failed assessment, malformed typed findings and unrelated canonical fact answers cannot form a notice',()=>{
  const noGap=assessment({essential_gaps:[]});
  assert.throws(()=>a.noticeFromAssessment(input(noGap),request,noGap),/unresolved_requirements_required/);
  const failed=assessment({assessment_decision:'assessment_failed',issues:[{quote:'Request context',reason:'Its scope cannot be interpreted reliably.',evidence_needed:'Unambiguous context.'}]});
  assert.throws(()=>a.noticeFromAssessment(input(failed),request,failed),/assessment_unresolved/);
  for(const answer of ['A well-formed ordinary fact answer.',canonical({gap_review:'Missing measurement.',essential_gaps:[gap],corrections:[correction],supported:true})]){
    const result={...assessment(),answer};assert.throws(()=>a.noticeFromAssessment(input(result),request,result));
  }
  const unquoted=assessment({essential_gaps:[{...gap,request_quote:'A clause absent from this request.'}]});
  assert.throws(()=>a.noticeFromAssessment(input(unquoted),request,unquoted),/request_quote_not_found/);
});

test('assessment-to-notice fields share the formatter bounds and reject ambiguous, unsafe or duplicate structured data',()=>{
  const schema=v.resultTools.find(t=>t.name==='explanation_assessment_result').inputSchema;
  assert.deepEqual(schema.properties.essential_gaps.items,a.tool.inputSchema.properties.unresolved.items);
  assert.deepEqual(schema.properties.corrections.items,a.tool.inputSchema.properties.corrections.items);
  for(const field of ['requirement','request_quote','reason','evidence_needed']){
    const missing={...gap};delete missing[field];assert.throws(()=>assessment({essential_gaps:[missing]}));
  }
  for(const field of ['requirement','evidence_needed'])for(const value of ['',null,'x'.repeat(481),'🙂'.repeat(121),'A\nB','A\u202eB','\ud800','A<B','`text`'])
    assert.throws(()=>assessment({essential_gaps:[{...gap,[field]:value}]}));
  for(const field of ['claim','correction','basis'])for(const value of ['',null,'x'.repeat(481),'🙂'.repeat(121),'A\nB','A\u202eB','\ud800'])
    assert.throws(()=>assessment({corrections:[{...correction,[field]:value}]}));
  for(const corrections of [null,[correction,correction],Array(5).fill(correction),[{...correction,resolves_request_quote:gap.request_quote}]])
    assert.throws(()=>assessment({corrections}));
  assert.throws(()=>assessment({essential_gaps:[{...gap,reason:'waived'}]}));
  const result=assessment({essential_gaps:[{...gap,requirement:'x'.repeat(480)}],corrections:[]});
  assert.equal(a.noticeFromAssessment(input(result),request,result).proposal.decision.unresolved_count,1);
});

test('Korean assessment fields survive formatting exactly while the helper changes only fixed language labels',()=>{
  const result=assessment({essential_gaps:[{...gap,requirement:'측정된 성능 저하',evidence_needed:'같은 작업 부하의 기준 실행 시간과 완화 적용 실행 시간.'}],
    corrections:[{claim:'T1이 A를 읽는다.',correction:'T1은 B를 읽으며 조건이 참일 때만 A에 쓴다.',basis:'주어진 시나리오의 읽기 대상과 쓰기 조건.'}]});
  const compiled=a.noticeFromAssessment({...input(result),language:'ko'},request,result),findings=JSON.parse(result.answer);
  assert.deepEqual(compiled.args.unresolved,findings.essential_gaps);assert.deepEqual(compiled.args.corrections,findings.corrections);
  assert.match(compiled.proposal.decision.final_text,/완성 설명을 보류합니다/);
  for(const value of Object.values(findings.corrections[0]))assert.ok(compiled.proposal.decision.final_text.includes(value));
});

test('both normal host hook paths bind the actual assessment and require a fresh notice review before exact delivery',()=>{
  for(const host of ['claude','codex'])fixture(host,ctx=>{
    const before=ctx.read(),issued=propose(ctx);assert.ok(ctx.read().pending_tool);
    assert.deepEqual(ctx.handle(issued.post),{});const pending=ctx.read();
    assert.equal(pending.pending_tool,undefined);assert.equal(pending.attempt.status,'pending');assert.equal(pending.attempt.final_sha256,null);
    assert.deepEqual(pending.attempt.verification.facts,before.attempt.verification.facts);assert.equal(pending.attempt.verification.final.phase,'planned');
    assert.doesNotMatch(fs.readFileSync(ctx.file,'utf8'),/T1 reads|assessment_result|source_assessment|gap_review|final_text/);
    freshReview(ctx,issued.compiled.proposal);
    assert.equal(ctx.read().attempt.status,'withheld');assert.deepEqual(ctx.finish(issued.response.structuredContent.final_text),{});
  });
});

test('a prepared or cached assessment without actual native receipts cannot authorize the new parent helper',()=>{
  for(const host of ['claude','codex'])fixture(host,ctx=>{
    invoke(ctx.dispatch,'explanation_assess_request',ctx.args);
    const submitted={challenge:ctx.result.challenge,assessment_decision:'assessed',...JSON.parse(ctx.result.answer),issues:[]};
    assert.equal(invoke(ctx.dispatch,'explanation_assessment_result',submitted).isError,undefined);
    assert.equal(ctx.handle(ctx.pre).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(ctx.read().status,'unavailable');assert.equal(ctx.finish('Approved notice.').continue,false);
  },{assess:false});
});

test('parent result, language, binding and extra-text mutations are denied before the helper can run',()=>{
  const changes=[{language:'fr'},{request},{unresolved:[]},{corrections:[]},{revision:1},{attempt_id:'another-attempt'},{candidate_sha256:'b'.repeat(64)},
    {assessment_result:{...assessment(),answer:'Changed assessment.'}}];
  for(const change of changes)fixture('codex',ctx=>{
    const denied=ctx.handle({...ctx.pre,tool_input:{...ctx.selector,...change}});
    assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');assert.equal(ctx.read().status,'unavailable');
  });
});

test('Post recomputes the entire notice payload and rejects changed source, assessment, rendered text or host adapter',()=>{
  const mutations=[p=>{p.source_assessment.request+=' Changed.';},p=>{p.source_assessment.assessment_result.answer='Changed assessment.';},
    p=>{p.source_assessment.extra='Unexpected source field';},p=>{p.final_text+=' An added parent claim.';},p=>{p.notice_authorized=true;},
    p=>{p.review.native_dispatch.Agent.prompt='TTAK:'+'b'.repeat(64);},p=>{p.review.assessment_sha256='b'.repeat(64);}];
  for(const mutate of mutations)fixture('claude',ctx=>{
    const issued=propose(ctx),payload=structuredClone(issued.response.structuredContent);mutate(payload);
    const response={structuredContent:payload,content:[{type:'text',text:canonical(payload)}]};
    assert.match(ctx.handle({...issued.post,tool_response:response}).systemMessage,/could not record/);
    assert.equal(ctx.read().status,'unavailable');assert.equal(ctx.finish(issued.compiled.proposal.decision.final_text).continue,false);
  });
});

test('missing Pre or Post, changed call identity and duplicate initial proposals cannot lose their failure state',()=>{
  for(const mode of ['missing-pre','missing-post','changed-call','duplicate'])fixture('claude',ctx=>{
    if(mode==='missing-pre'){
      const args={...ctx.selector,attempt_id:ctx.args.attempt_id,candidate_sha256:ctx.args.candidate_sha256};
      const response=invoke(ctx.dispatch,'explanation_notice_from_assessment',args);assert.equal(response.isError,undefined);
      assert.match(ctx.handle({...ctx.pre,hook_event_name:'PostToolUse',tool_input:args,tool_response:response}).systemMessage,/could not record/);
    }else{
      const issued=propose(ctx);
      if(mode==='changed-call')assert.match(ctx.handle({...issued.post,tool_use_id:'changed-call'}).systemMessage,/could not record/);
      if(mode==='duplicate')assert.deepEqual(ctx.handle(issued.post),{});
      if(mode==='missing-post'||mode==='duplicate')assert.equal(ctx.handle({...ctx.pre,tool_use_id:'second-notice'}).hookSpecificOutput.permissionDecision,'deny');
    }
    assert.equal(ctx.read().status,'unavailable');assert.equal(ctx.finish('Approved.').continue,false);
  });
});

test('a separately connected Codex verifier result transfers explicitly without creating a false current cache',()=>fixture('codex',ctx=>{
  const args={...ctx.selector,attempt_id:ctx.args.attempt_id,candidate_sha256:ctx.args.candidate_sha256};
  assert.equal(invoke(ctx.dispatch,'explanation_notice_from_assessment',{...args,assessment_result:'current'}).isError,true);
  assert.equal(invoke(ctx.childDispatch,'explanation_notice_from_assessment',args).isError,true);
  assert.equal(invoke(ctx.dispatch,'explanation_notice_from_assessment',{...args,candidate_sha256:'b'.repeat(64)}).isError,true);
  const response=invoke(ctx.dispatch,'explanation_notice_from_assessment',args);assert.equal(response.isError,undefined);
  assert.deepEqual(response.structuredContent.source_assessment.assessment_result,ctx.result);
  assert.equal(invoke(ctx.dispatch,'explanation_notice_from_assessment',args).isError,true);
}));

test('actual assessment result reads populate only the matching bounded parent cache once',()=>{
  const original=Date.now;let clock=1000000;Date.now=()=>clock;
  try{
    for(const mode of ['normal','candidate','challenge','conflict','duplicate','expired','backwards','ordinary-fact']){
      clock=1000000;const parent=connection('codex'),child=connection('codex'),args={...binding,request};
      assert.equal(invoke(parent,'explanation_assess_request',args).isError,undefined);
      const result=assessment(),fields={...JSON.parse(result.answer),challenge:result.challenge,assessment_decision:'assessed',issues:[]};
      const submitted=invoke(child,'explanation_assessment_result',fields).structuredContent;
      const read={...binding,challenge:result.challenge,result,receipt_text:submitted.receipt_text};
      if(mode==='candidate')read.candidate_sha256='b'.repeat(64);
      if(mode==='challenge'){const changed=v.resultSubmission({...fields,challenge:'b'.repeat(64)},'assessment');Object.assign(read,{challenge:changed.result.challenge,result:changed.result,receipt_text:changed.receipt_text});}
      if(mode==='conflict')assert.equal(invoke(parent,'explanation_assessment_result',{...fields,gap_review:'A different assessment.'}).isError,undefined);
      if(mode==='expired')clock+=1800001;if(mode==='backwards')clock--;
      if(mode==='ordinary-fact'){const wrong=v.resultSubmission({challenge:result.challenge,verdict:'answered',answer:'An ordinary fact is not a typed assessment.',issues:[]},'fact');Object.assign(read,{result:wrong.result,receipt_text:wrong.receipt_text});}
      const response=invoke(parent,'explanation_result',read);
      if(!['normal','duplicate'].includes(mode)){assert.equal(response.isError,true,mode);continue;}
      assert.equal(response.isError,undefined,mode);assert.deepEqual(response.structuredContent.result,result);
      if(mode==='duplicate'){assert.equal(invoke(parent,'explanation_result',read).isError,true);continue;}
      assert.equal(invoke(parent,'explanation_prepare',args).isError,undefined);
      const proposed=invoke(parent,'explanation_notice_from_assessment',input('current'));assert.equal(proposed.isError,undefined);
      assert.deepEqual(proposed.structuredContent.source_assessment,{request,assessment_result:result});assert.equal(proposed.structuredContent.notice_authorized,false);
      assert.equal(invoke(child,'explanation_notice_from_assessment',input('current')).isError,true);
    }
    const absent=connection('codex'),result=assessment();
    assert.equal(invoke(absent,'explanation_result',{...binding,challenge:result.challenge,result}).isError,undefined);
    assert.equal(invoke(absent,'explanation_notice_from_assessment',input('current')).isError,true);
  }finally{Date.now=original;}
});

test('compact normal Codex retention preserves access to an actually read prior assessment without recopying it',async()=>{
  const parent=connection('codex'),child=connection('codex'),args={...binding,request},prepared=invoke(parent,'explanation_assess_request',args).structuredContent;
  const result=assessment(),submitted=invoke(child,'explanation_assessment_result',{...JSON.parse(result.answer),challenge:result.challenge,assessment_decision:'assessed',issues:[]}).structuredContent;
  assert.equal(invoke(parent,'explanation_result',{...binding,challenge:result.challenge,result,receipt_text:submitted.receipt_text}).isError,undefined);
  const normal=invoke(parent,'explanation_prepare',args).structuredContent,packet=v.prepare(args).packets[0];
  const fact=invoke(child,'explanation_fact_result',{challenge:packet.challenge,verdict:'answered',answer:'The factual account is distinct from the prior measurement assessment.',issues:[]}).structuredContent;
  const memory=new Map([['ttak-verification',{...binding,request,facts:[],assessment:{id:v.assessmentId,result}}]]),emitted=[];
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const api={mcp__ttak_scenario__explanation_dispatch:async value=>invoke(parent,'explanation_dispatch',{...value,...binding,challenge:packet.challenge}),
    multi_agent_v1__spawn_agent:async()=>({agent_id:'compact-assessment-child'}),
    multi_agent_v1__wait_agent:async()=>({timed_out:false,status:{'compact-assessment-child':{completed:fact.receipt_text}}}),multi_agent_v1__close_agent:async()=>{},
    mcp__ttak_scenario__explanation_result:async value=>invoke(parent,'explanation_result',{...value,result:fact.result}),
    mcp__ttak_scenario__explanation_notice_from_assessment:async value=>{assert.equal(value.assessment_result,'current');return invoke(parent,'explanation_notice_from_assessment',value);}};
  await new AsyncFunction('tools','load','store','text',normal.native_dispatch.spawn_agent_code)(api,key=>memory.get(key),(key,value)=>memory.set(key,value),value=>emitted.push(value));
  assert.deepEqual(memory.get('ttak-verification'),{...binding,previous:{id:packet.id,result:fact.result}});
  await new AsyncFunction('tools','load','text',prepared.native_dispatch.notice_from_assessment_code)(api,key=>memory.get(key),value=>emitted.push(value));
  assert.equal(emitted[1].isError,undefined);assert.deepEqual(emitted[1].structuredContent.source_assessment,{request,assessment_result:result});
  assert.equal(emitted[1].structuredContent.notice_authorized,false);assert.equal(emitted[1].structuredContent.review.complete_authorized,false);
});

test('the new helper does not approve a notice by itself or discard an active normal verifier',()=>{
  fixture('claude',ctx=>{
    const issued=propose(ctx);assert.deepEqual(ctx.handle(issued.post),{});
    assert.equal(ctx.finish(issued.compiled.proposal.decision.final_text).continue,false);assert.equal(ctx.read().attempt.status,'unavailable');
  });
  fixture('claude',ctx=>{
    const args={...ctx.args,blocks:[{text:'A proposed mechanism.',question_ids:['MECHANISM']}],
      questions:[{id:'MECHANISM',kind:'mechanism',target:'The supplied workload mechanism',conditions:'The supplied scenario applies.',source_ids:[]}],sources:[]};
    const plan=v.prepare(args),normal=v.registerPlan(ctx.read().attempt,plan,textDigest(request));
    const selector={attempt_id:ctx.args.attempt_id,candidate_sha256:ctx.args.candidate_sha256,assessment_result:ctx.result,language:'en'};
    assert.deepEqual(a.checkAssessmentNoticeArguments(selector,normal),selector);
    const active=v.observeAgent(normal,{hook_event_name:'PreToolUse',tool_name:'Agent',tool_use_id:'normal-spawn',tool_input:v.exposePlan(plan,'claude').native_dispatch.Agent});
    assert.throws(()=>a.checkAssessmentNoticeArguments(selector,active),/verifier_still_active/);
    for(const status of ['unavailable','cancelled'])assert.throws(()=>a.checkAssessmentNoticeArguments(selector,{...normal,status}));
  });
});

test('a notice built from an assessment retains its original arguments for the existing one-revision typed repair',()=>{
  for(const host of ['claude','codex'])fixture(host,ctx=>{
    const issued=propose(ctx);assert.deepEqual(ctx.handle(issued.post),{});
    const added={claim:'A second requested claim.',correction:'Its supplied correction.',basis:'The supplied test fixture.'};
    const result=freshReview(ctx,issued.compiled.proposal,{notice_decision:'revise_notice',issues:[{quote:'A second requested claim',reason:'Synthetic omission.',evidence_needed:'The supplied correction.',notice_correction:added}]});
    const args={attempt_id:ctx.args.attempt_id,candidate_sha256:ctx.args.candidate_sha256,review_result:host==='claude'?'current':result};
    const pre=ctx.event('PreToolUse',{tool_name:ctx.prefix+'explanation_repair_notice',tool_use_id:'repair-notice',tool_input:args});assert.deepEqual(ctx.handle(pre),{});
    const response=invoke(ctx.dispatch,'explanation_repair_notice',args);assert.equal(response.isError,undefined);
    const compiled=a.repairProposal(issued.compiled.args,result);assert.deepEqual(response.structuredContent,a.exposeRepair(compiled,host));
    assert.deepEqual(ctx.handle({...pre,hook_event_name:'PostToolUse',tool_response:response}),{});
    assert.deepEqual(compiled.revised.corrections,[correction,added]);assert.deepEqual(compiled.revised.unresolved,[gap]);
    freshReview(ctx,compiled.proposal);assert.deepEqual(ctx.finish(response.structuredContent.final_text),{});
  });
});
