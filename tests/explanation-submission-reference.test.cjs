'use strict';
// Synthetic lifecycle evidence exercises the binding; it is not a native model verdict.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {textDigest,canonical}=require('../scripts/verification-packet.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111171',candidate_sha256:'a'.repeat(64)};
const request='Explain a fictional register initially7 whose reads return its stored value without changing it. An exact measured slowdown is essential, but no measurements are supplied.';
const fields={fact:{verdict:'answered',answer:'The two reads return7 and the final value is7.',issues:[]},
  assessment:{assessment_decision:'assessed',gap_review:'The essential measured slowdown has no supplied measurements.',essential_gaps:[{requirement:'Exact measured slowdown',request_quote:'An exact measured slowdown is essential, but no measurements are supplied.',reason:'missing_evidence',evidence_needed:'Comparable workload measurements.'}],corrections:[],issues:[]},
  final:{final_decision:'approve_explanation',...Object.assign({},...Object.values(reviewChecks())),checked_questions:['REQUEST_FACTS'],issues:[]},
  notice:{notice_decision:'approve_notice',requirement_review:'The measurement is essential and missing.',evidence_review:'Comparable workload measurements are needed.',assessment_review:'No draft assessment was requested.',checked_questions:[v.assessmentId],issues:[]}};
function fixture(kind='fact',delivery='native'){
  let attempt=a.begin(binding.attempt_id,binding.candidate_sha256),packet;
  const launch=p=>{
    const child=p.id+'-child',actor={session_id:'parent',agent_id:child,turn_id:p.id+'-turn'};
    const spawn={hook_event_name:'PreToolUse',tool_use_id:p.id+'-spawn',tool_name:delivery==='native'?'spawn_agent':'Agent',tool_input:delivery==='native'
      ?{message:p.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}
      :{description:'One check',prompt:v.launchPrompt(p.challenge),subagent_type:v.agentType,run_in_background:false}};
    attempt=v.observeAgent(attempt,spawn);
    if(delivery==='native')attempt=v.observeAgent(attempt,{...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child}});
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:child,agent_type:v.agentType});
    if(delivery==='native')attempt=v.childPrompt(attempt,{...actor,prompt:p.prompt},textDigest('parent-turn'));
    else{
      const get={...actor,hook_event_name:'PreToolUse',tool_use_id:p.id+'-packet',tool_input:{challenge:p.challenge}};
      attempt=v.observePacket(attempt,get);attempt=v.observePacket(attempt,{...get,hook_event_name:'PostToolUse',packet_payload:v.packetBody(p)});
    }
    return {actor,spawn};
  };
  const complete=(p,k)=>{
    const l=launch(p),args={challenge:p.challenge,...fields[k]},payload=v.resultSubmission(args,k),pre={...l.actor,hook_event_name:'PreToolUse',tool_use_id:p.id+'-submit',tool_input:args};
    attempt=v.observeSubmission(attempt,pre,k);attempt=v.observeSubmission(attempt,{...pre,hook_event_name:'PostToolUse',submission_payload:payload},k);
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',...l.actor,last_assistant_message:payload.final_text});
    if(delivery==='mcp')attempt=v.observeAgent(attempt,{...l.spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:l.actor.agent_id}});
    return payload.result;
  };
  if(['assessment','notice'].includes(kind)){
    const plan=v.prepareAssessment({...binding,request});attempt=v.registerAssessment(attempt,plan,plan.request_sha256);packet=plan.packets[0];
    if(kind==='notice'){
      const assessment_result=complete(packet,'assessment'),proposal=a.propose({...binding,request,revision:0,disposition:'withheld',language:'en',assessment_result,unresolved:fields.assessment.essential_gaps,corrections:[]});
      attempt=v.registerWithholding(attempt,proposal.review,textDigest(request));packet=proposal.review.packet;
    }
  }else{
    const plan=v.prepare({...binding,request});attempt=v.registerPlan(attempt,plan,plan.request_sha256);packet=plan.packets[0];
    if(kind==='final'){
      const result=complete(packet,'fact'),args={...binding,request,final_text:fields.fact.answer,facts:[{id:packet.id,result}],revision:0},final=v.finalize(args);
      attempt=v.registerFinal(attempt,final,args);packet=final.packet;
    }
  }
  const launched=launch(packet),pre={...launched.actor,hook_event_name:'PreToolUse',tool_use_id:packet.id+'-current-submit',tool_input:{challenge:'current',...fields[kind]}};
  return {attempt,packet,pre,kind,slot:()=>[...attempt.verification.facts,...(attempt.verification.final?[attempt.verification.final]:[])].find(s=>s.id===packet.id)};
}
test('explicit current binds each result kind only in its observed fresh verifier Pre; MCP results remain exact digests',()=>{
  for(const delivery of ['native','mcp'])for(const kind of ['fact','final','assessment','notice']){
    const f=fixture(kind,delivery),before=canonical(f.attempt),bound=v.bindSubmissionArguments(f.attempt,f.pre,kind);
    assert.deepEqual(bound,{changed:true,input:{...f.pre.tool_input,challenge:f.packet.challenge}});assert.equal(canonical(f.attempt),before);
    assert.throws(()=>v.resultSubmission(f.pre.tool_input,kind),/invalid_digest/);
    const payload=v.resultSubmission(bound.input,kind),pending=v.observeSubmission(f.attempt,f.pre,kind),slot=[...pending.verification.facts,...(pending.verification.final?[pending.verification.final]:[])].find(s=>s.id===f.packet.id);
    assert.equal(slot.submission_reference,true);assert.equal(slot.submitted,false);assert.equal(payload.result.challenge,f.packet.challenge);
    const finished=v.observeSubmission(pending,{...f.pre,hook_event_name:'PostToolUse',tool_input:bound.input,submission_payload:payload},kind);
    assert.equal([...finished.verification.facts,...(finished.verification.final?[finished.verification.final]:[])].find(s=>s.id===f.packet.id).submitted,true);
    assert.equal(f.pre.tool_input.challenge,'current');assert.doesNotMatch(canonical(finished),/The two reads|Comparable workload|receipt_text/);
  }
});
test('selector never pads malformed literals and literal calls retain their existing strict path',()=>{
  for(const challenge of ['current ','Current','a'.repeat(63),'b'.repeat(64),'a'.repeat(65)]){
    const f=fixture(),pre={...f.pre,tool_input:{...f.pre.tool_input,challenge}};
    assert.equal(v.bindSubmissionArguments(f.attempt,pre,'fact').changed,false);assert.throws(()=>v.observeSubmission(f.attempt,pre,'fact'));
  }
  const f=fixture(),pre={...f.pre,tool_input:{...f.pre.tool_input,challenge:f.packet.challenge}},result=v.observeSubmission(f.attempt,pre,'fact');
  assert.equal(result.verification.facts[0].submission_reference,undefined);
});
test('current rejects parent, foreign child, wrong bound native turn, purpose and stale lifecycle without changing receipts',()=>{
  for(const delivery of ['native','mcp'])for(const mode of ['parent','foreign','phase','unretrieved','pending-submission','returned','purpose','cancelled','correction']){
    const f=fixture('fact',delivery),attempt=structuredClone(f.attempt),pre=structuredClone(f.pre),slot=attempt.verification.facts[0];let kind='fact';
    if(mode==='parent'){delete pre.agent_id;pre.turn_id='parent-turn';}
    if(mode==='foreign')pre.agent_id='foreign-child';if(mode==='phase')slot.phase='planned';
    if(mode==='unretrieved'){slot.retrieved=false;slot.retrieval_sha256=null;}
    if(mode==='pending-submission'){slot.submission_call_sha256='b'.repeat(64);slot.submission_sha256='c'.repeat(64);}
    if(mode==='returned'){slot.phase='returned';slot.verdict='answered';}
    if(mode==='purpose')kind='assessment';if(mode==='cancelled')attempt.status='cancelled';if(mode==='correction')slot.return_corrections=1;
    const before=canonical(attempt);assert.throws(()=>v.bindSubmissionArguments(attempt,pre,kind),undefined,mode);assert.equal(canonical(attempt),before);
  }
  for(const mode of ['wrong-turn','missing-turn','unconfirmed','missing-child-turn']){
    const f=fixture(),slot=f.attempt.verification.facts[0];if(mode==='wrong-turn')f.pre.turn_id='other-turn';if(mode==='missing-turn')delete f.pre.turn_id;
    if(mode==='unconfirmed')slot.spawn_confirmed=false;if(mode==='missing-child-turn')slot.child_turn_sha256=null;
    assert.throws(()=>v.bindSubmissionArguments(f.attempt,f.pre,'fact'),undefined,mode);
  }
  const f=fixture();delete f.pre.agent_id;assert.equal(v.bindSubmissionArguments(f.attempt,f.pre,'fact').input.challenge,f.packet.challenge);
});
test('submission reference requires the exact observed Pre/Post result and does not authorize a second submission',()=>{
  for(const mode of ['post-current','changed-call','changed-answer','changed-result','duplicate']){
    const f=fixture(),bound=v.bindSubmissionArguments(f.attempt,f.pre,'fact'),payload=v.resultSubmission(bound.input,'fact'),pending=v.observeSubmission(f.attempt,f.pre,'fact');
    const post={...f.pre,hook_event_name:'PostToolUse',tool_input:bound.input,submission_payload:payload};
    if(mode==='post-current')post.tool_input=f.pre.tool_input;if(mode==='changed-call')post.tool_use_id='other-call';
    if(mode==='changed-answer')post.tool_input={...bound.input,answer:'Changed.'};if(mode==='changed-result')post.submission_payload={...payload,final_text:'Changed.'};
    if(mode==='duplicate')assert.throws(()=>v.observeSubmission(pending,{...f.pre,tool_use_id:'again'},'fact'));
    else assert.throws(()=>v.observeSubmission(pending,post,'fact'));
    assert.equal(pending.verification.facts[0].submitted,false);
  }
  const f=fixture();f.attempt.verification.facts[0].submission_reference=true;assert.throws(()=>v.checkedVerification(f.attempt.verification));
});
