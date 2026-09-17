'use strict';
// Synthetic receipts verify the compiler and lifecycle, not native semantic accuracy.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {canonical,digest,textDigest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs'),{handleEvent}=require('../hooks/scenario-evidence.cjs');
const {finalReviewAnswer,finalReviewSubmission}=require('./helpers/final-review.cjs');
const request='Explain the fictional Daro register to a beginner in two sentences. It stores one integer. Reading returns it without change. Start at 3, read twice, and report both readings and the stored value.';
const draft='PARENT_DRAFT_ONLY: both reads return 3 and the stored value remains 3.';
const args=()=>({attempt_id:'12345678-1234-1234-1234-123456789148',candidate_sha256:'a'.repeat(64),request,draft});
const body=p=>JSON.parse(p.prompt.slice(p.prompt.indexOf('\n')+1));
function connection(host){const dispatch=createDispatcher({host});let id=1;
  dispatch({jsonrpc:'2.0',id:id++,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'request-facts-test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  return (method,params)=>dispatch({jsonrpc:'2.0',id:id++,method,params}).result;
}
test('both advertised native preparation schemas use facts-first while the explicit draft compiler remains',()=>{
  for(const host of ['claude','codex']){
    const tool=connection(host)('tools/list',{}).tools.find(t=>t.name==='explanation_prepare');
    assert.deepEqual(tool.inputSchema.required,['attempt_id','candidate_sha256','request']);
    assert.equal(tool.inputSchema.additionalProperties,false);
    assert.equal(tool.inputSchema.properties.draft,undefined);
    assert.equal(tool.name,v.prepareTool.name);assert.deepEqual(tool.annotations,v.prepareTool.annotations);
  }
});
test('one request-wide fact packet preserves every original byte, hides the draft and binds its changes',()=>{
  const original=args(),plan=v.prepare(original),p=plan.packets[0],data=body(p).data;
  assert.equal(plan.packets.length,1);assert.equal(p.id,'REQUEST_FACTS');assert.equal(p.kind,'fact');
  assert.equal(data.purpose,'request_facts');assert.equal(data.original_request,request);
  assert.equal(data.source_mode,'original_request_and_model_knowledge_without_source_certification');
  assert.equal(Object.hasOwn(data,'draft'),false);assert.equal(Object.hasOwn(data,'sources'),false);
  assert.doesNotMatch(p.prompt,/PARENT_DRAFT_ONLY|draft_sha256|sibling_result/);
  assert.equal(plan.draft_sha256,textDigest(draft));assert.equal(plan.request_sha256,textDigest(request));
  assert.equal(plan.complete_authorized,false);assert.equal(plan.independent_native_agents_required,1);
  assert.notEqual(v.prepare({...original,draft:draft+' Another claim.'}).packets[0].challenge,p.challenge);
  assert.notEqual(v.prepare({...original,request:request+' Also explain the scope.'}).packets[0].challenge,p.challenge);
  assert.deepEqual(original,args());assert.equal(body(p).submission.tool,'explanation_fact_result');
  for(const host of ['claude','codex']){
    const result=connection(host)('tools/call',{name:'explanation_prepare',arguments:original});
    assert.equal(result.isError,undefined);assert.deepEqual(result.structuredContent,v.exposePlan(plan,host));
    assert.deepEqual(result.structuredContent.pending_question_ids,[]);
  }
});
test('flat preparation rejects malformed, hybrid, excessive or executable data without invoking it',()=>{
  for(const value of [null,{}, {...args(),draft:''},{...args(),draft:[]},{...args(),draft:'x'.repeat(24001)},
    {...args(),request:'x'.repeat(32001)},{...args(),draft:'bad\ud800text'},
    {...args(),draft:'sk-'+'SYNTHETIC'.repeat(4)},...['blocks','questions','sources','plan_json'].map(key=>({...args(),[key]:[]}))])assert.throws(()=>v.prepare(value));
  let invoked=0;const value=args();Object.defineProperty(value,'draft',{enumerable:true,get(){invoked++;return draft;}});
  assert.throws(()=>v.prepare(value));assert.equal(invoked,0);
  const legacy={attempt_id:args().attempt_id,candidate_sha256:args().candidate_sha256,request,
    blocks:[{text:draft,question_ids:Array.from({length:12},(_,i)=>'Q'+i)}],
    questions:Array.from({length:12},(_,i)=>({id:'Q'+i,kind:'mechanism',target:'Daro read',conditions:'Read twice from 3.',source_ids:[]})),sources:[]};
  assert.throws(()=>v.prepare(legacy),/verification_invalid_list/);
  const {blocks,questions,sources,...binding}=legacy;
  assert.throws(()=>v.prepare({...binding,plan_json:JSON.stringify({blocks,questions,sources})}),/verification_invalid_list/);
});
function result(p,extra={}){return {protocol:v.protocol,challenge:p.challenge,kind:p.kind,
  verdict:p.kind==='fact'?'answered':'complete',answer:p.kind==='final'?finalReviewAnswer('The two stated reads and final value match the supplied definition.'):'Each read returns 3 and leaves 3 stored.',issues:[],checked_questions:p.kind==='final'?['REQUEST_FACTS']:[],...extra};}
function receipt(attempt,p,host,index,answer=result(p)){
  const agent='facts-agent-'+index,id='facts-call-'+index,pre={hook_event_name:'PreToolUse',tool_name:host==='claude'?'Agent':'spawn_agent',tool_use_id:id,
    tool_input:host==='claude'?{description:'Verify one packet',prompt:v.launchPrompt(p.challenge),subagent_type:v.agentType,run_in_background:false}
      :{message:v.launchPrompt(p.challenge),model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
  attempt=v.observeAgent(attempt,pre);
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:agent,agent_type:host==='claude'?v.agentType:'default',model:host==='claude'?'claude-haiku-4-5-20251001':'gpt-5.6-luna'});
  const retrieval={hook_event_name:'PreToolUse',agent_id:agent,tool_use_id:id+'-read',tool_input:{challenge:p.challenge}};
  attempt=v.observePacket(attempt,retrieval);attempt=v.observePacket(attempt,{...retrieval,hook_event_name:'PostToolUse',packet_payload:v.packetBody(p)});
  const {protocol,kind,checked_questions,...fields}=answer,input={agent_id:agent,tool_use_id:id+'-result',tool_input:kind==='final'?finalReviewSubmission(answer):fields};
  attempt=v.observeSubmission(attempt,{...input,hook_event_name:'PreToolUse'},kind);
  attempt=v.observeSubmission(attempt,{...input,hook_event_name:'PostToolUse',submission_payload:v.resultSubmission(input.tool_input,kind)},kind);
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:agent,last_assistant_message:canonical(answer)});
  return v.observeAgent(attempt,{...pre,hook_event_name:'PostToolUse',tool_response:host==='claude'?[{type:'text',text:canonical(answer)+'\nagentId: '+agent+' (for resuming)'}]:{agent_id:agent}});
}
test('a request-wide factual answer still requires observed fresh final review and full question coverage',()=>{
  for(const host of ['claude','codex'])for(const mode of ['draft','facts-first']){
    const input=args();if(mode==='facts-first')delete input.draft;
    const plan=v.prepare(input);let attempt=v.registerPlan(a.begin(input.attempt_id,input.candidate_sha256),plan,textDigest(request));
    const finalArgs={attempt_id:input.attempt_id,candidate_sha256:input.candidate_sha256,request,final_text:'Each Daro read returns the stored integer without changing it. Both readings are 3 and 3 remains stored.',facts:[{id:'REQUEST_FACTS',result:result(plan.packets[0])}],revision:0};
    const final=v.finalize(finalArgs);assert.throws(()=>v.registerFinal(attempt,final,finalArgs),/unobserved_fact/);
    attempt=receipt(attempt,plan.packets[0],host,1);assert.equal(attempt.status,'pending');
    assert.equal(attempt.verification.facts[0].reply_sha256,digest(finalArgs.facts[0].result));
    assert.throws(()=>a.checkedAttempt({...attempt,status:'complete',final_sha256:final.final_sha256}),/independent_completion/);
    attempt=v.registerFinal(attempt,final,finalArgs);
    assert.deepEqual(body(final.packet).data,{request,final_text:finalArgs.final_text,facts:finalArgs.facts});
    assert.throws(()=>receipt(attempt,final.packet,host,2,result(final.packet,{checked_questions:[]})),/verification_invalid_list/);
    assert.throws(()=>receipt(attempt,final.packet,host,2,result(final.packet,{checked_questions:['WrongQuestion']})),/question_coverage/);
    const completed=receipt(attempt,final.packet,host,2);assert.equal(completed.status,'complete');
    assert.equal(completed.final_sha256,textDigest(finalArgs.final_text));assert.equal(a.checkedAttempt(completed),completed);
    const withheld=result(final.packet,{verdict:'withheld',issues:[{quote:'Both readings',reason:'A material claim needs correction.',evidence_needed:'A corrected explanation.'}]});
    const adverse=receipt(attempt,final.packet,host,2,withheld);assert.equal(adverse.status,'pending');
    assert.equal(adverse.verification.final.verdict,'withheld');
    assert.throws(()=>v.registerFinal(adverse,{...final,revision:1},{...finalArgs,revision:1}),/revision_not_available/);
  }
});
test('normal Pre and Post bind exact draft bytes and preserve unavailable failed preparations',()=>{
  const runtime=path.resolve(__dirname,'../.superpowers');
  for(const mode of ['valid','post-changed','malformed']){
    const root=fs.mkdtempSync(path.join(runtime,'request-facts-')),options={root,enabled:true,now:1000000},base={session_id:'facts-parent',turn_id:'facts-turn'};
    const event=input=>handleEvent({...base,...input},options),file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file));
    try{
      event({hook_event_name:'UserPromptSubmit',prompt:request});
      const input={...args(),attempt_id:'current',candidate_sha256:'current',...(mode==='malformed'?{draft:[]}: {})};
      const pre={hook_event_name:'PreToolUse',tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_prepare',tool_use_id:'facts-prepare',tool_input:input},response=event(pre);
      if(mode==='malformed'){
        assert.equal(response.hookSpecificOutput.permissionDecision,'deny');assert.equal(read().status,'unavailable');
        assert.equal(event({...pre,tool_input:{...input,draft}}).hookSpecificOutput.permissionDecision,'deny');continue;
      }
      const bound=response.hookSpecificOutput.updatedInput;assert.equal(bound.request,request);assert.equal(bound.draft,draft);
      const prepared=connection('claude')('tools/call',{name:'explanation_prepare',arguments:bound});assert.equal(prepared.isError,undefined);
      const post=event({...pre,hook_event_name:'PostToolUse',tool_input:mode==='post-changed'?{...bound,draft:draft+' '}:bound,tool_response:prepared});
      if(mode==='post-changed'){assert.match(post.systemMessage,/could not record/);assert.equal(read().status,'unavailable');}
      else{assert.deepEqual(post,{});assert.equal(read().attempt.verification.facts[0].id,'REQUEST_FACTS');assert.doesNotMatch(canonical(read()),/Daro|PARENT_DRAFT_ONLY/);}
    }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
  }
});
