'use strict';
// Real local hook/MCP/parser transitions over synthetic native files, not host execution evidence.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),{handle:stop}=require('../hooks/scenario-stop.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs'),{textDigest,canonical}=require('../scripts/verification-packet.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs');
const parent='11111111-1111-4111-8111-111111111111',turn='22222222-2222-4222-8222-222222222222';
function fixture(host,notice,body,config={}){
  const runtime=path.resolve(__dirname,'../.superpowers'),tmp=fs.mkdtempSync(path.join(runtime,'delivery-hook-'));
  const profile=path.join(tmp,'profile'),root=path.join(profile,'plugins/data/ttak-delivery'),container=path.join(profile,host==='claude'?'projects':'sessions');
  fs.mkdirSync(root,{recursive:true});fs.mkdirSync(container);
  const parentFile=path.join(container,host==='claude'?parent+'.jsonl':'rollout-'+parent+'.jsonl');fs.writeFileSync(parentFile,'{}\n');
  const base={session_id:parent,turn_id:turn,cwd:tmp,transcript_path:parentFile},options={root,enabled:true,now:1000000};
  const handle=e=>handleEvent({...base,...e},options),file=path.join(root,'scenario-evidence-v1',textDigest(parent)+'.json'),read=()=>JSON.parse(fs.readFileSync(file));
  const prefix=host==='claude'?'mcp__plugin_ttak_ttak_scenario__':'mcp__ttak_scenario__',d=createDispatcher({host});
  d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'delivery-hook-test',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});
  const separate=config.separateChildConnection?createDispatcher({host}):d;
  if(separate!==d){separate({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'delivery-child-test',version:'1'}}});separate({jsonrpc:'2.0',method:'notifications/initialized'});}
  const invoke=(name,args,child=false)=>(child?separate:d)({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;let calls=0,children=0;
  const receiptText=reply=>config.receiptFence?'```\n'+reply.receipt_text+'\n```':reply.receipt_text;
  function call(name,args,actor={}){
    const pre={hook_event_name:'PreToolUse',tool_name:prefix+name,tool_use_id:'call-'+(++calls),tool_input:args,...actor},allowed=handle(pre);
    assert.notEqual(allowed.hookSpecificOutput?.permissionDecision,'deny');const bound=allowed.hookSpecificOutput?.updatedInput??args,response=invoke(name,bound,actor.agent_id!=null);
    assert.equal(response.isError,undefined);assert.deepEqual(handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    return {pre,bound,response,payload:response.structuredContent};
  }
  function verify(packet,kind,fields){
    const n=++children,child=host==='claude'?'a444455556666777'+n:'44444444-4444-4444-8444-44444444444'+n,childTurn='55555555-5555-4555-8555-55555555555'+n;
    const spawn={hook_event_name:'PreToolUse',tool_use_id:'spawn-'+n,tool_name:host==='claude'?'Agent':'spawn_agent',tool_input:host==='claude'
      ?{description:'Verify one packet',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}
      :{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
    assert.deepEqual(handle(spawn),{});if(host==='codex')assert.deepEqual(handle({...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child}}),{});
    handle({hook_event_name:'SubagentStart',agent_id:child,agent_type:v.agentType});const actor={agent_id:child,turn_id:childTurn};
    let packetCall;if(host==='claude')packetCall=call('explanation_packet',{challenge:packet.challenge},actor);else assert.deepEqual(handle({hook_event_name:'UserPromptSubmit',...actor,prompt:packet.prompt}),{});
    const name='explanation_'+kind+'_result';
    if(kind==='final'&&config.flat){const {requirement_review,claim_review,fact_review,...rest}=fields;fields={...rest,...requirement_review,...claim_review,...Object.fromEntries(Object.entries(fact_review).map(([key,value])=>['fact_'+key,value])),fact_issues:config.misattributed?fields.issues:[]};}
    const s=call(name,{challenge:packet.challenge,...fields},actor);
    const childFile=host==='claude'?path.join(container,parent,'subagents','agent-'+child+'.jsonl'):path.join(container,'rollout-'+child+'.jsonl');fs.mkdirSync(path.dirname(childFile),{recursive:true});
    const rows=host==='claude'?[
      {type:'assistant',uuid:'packet-'+n,isSidechain:true,agentId:child,sessionId:parent,version:'2.1.266',cwd:tmp,message:{role:'assistant',model:'claude-haiku-4-5-20251001',content:[{type:'tool_use',id:packetCall.pre.tool_use_id,name:prefix+'explanation_packet',input:packetCall.bound}]}},
      {type:'user',sourceToolAssistantUUID:'packet-'+n,isSidechain:true,agentId:child,sessionId:parent,version:'2.1.266',cwd:tmp,message:{role:'user',content:[{type:'tool_result',tool_use_id:packetCall.pre.tool_use_id,content:JSON.stringify(packetCall.payload)}]}},
      {type:'assistant',uuid:'native-'+n,isSidechain:true,agentId:child,sessionId:parent,version:'2.1.266',cwd:tmp,message:{role:'assistant',model:'claude-haiku-4-5-20251001',content:[{type:'tool_use',id:s.pre.tool_use_id,name:prefix+name,input:s.bound}]}},
      {type:'user',sourceToolAssistantUUID:'native-'+n,isSidechain:true,agentId:child,sessionId:parent,version:'2.1.266',cwd:tmp,message:{role:'user',content:[{type:'tool_result',tool_use_id:s.pre.tool_use_id,content:JSON.stringify(s.payload)}]}}
    ]:[
      {type:'session_meta',payload:{id:child,session_id:parent,parent_thread_id:parent,cli_version:'0.154.0',cwd:tmp}},
      {type:'turn_context',payload:{turn_id:childTurn,model:'gpt-5.6-luna',effort:'high'}},
      {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:packet.prompt}]}},
      {type:'event_msg',payload:{type:'item_completed',thread_id:child,turn_id:childTurn,item:{type:'McpToolCall',id:s.pre.tool_use_id,server:'ttak_scenario',tool:name,status:'completed',readOnlyHint:true,arguments:s.bound,result:s.response}}}
    ];fs.writeFileSync(childFile,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    assert.deepEqual(handle({hook_event_name:'SubagentStop',...actor,last_assistant_message:receiptText(s.payload)}),{});
    if(host==='claude')assert.deepEqual(handle({...spawn,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:receiptText(s.payload)+'\nagentId: '+child+' (for resuming)'}]}),{});
    return s.payload;
  }
  try{
    const request=notice?'Explain the fictional register and report measured slowdown. No measurements are supplied.':'Explain the fictional register: each read returns3 without changing the stored value.';
    handle({hook_event_name:'UserPromptSubmit',prompt:request});const binding={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate};
    const plan=notice?v.prepareAssessment({...binding,request}):v.prepare({...binding,request});call(notice?'explanation_assess_request':'explanation_prepare',{...binding,request});
    const fields=notice?{assessment_decision:'assessed',gap_review:'Required measurements are absent.',essential_gaps:[{requirement:'Measured slowdown',request_quote:'report measured slowdown',reason:'missing_evidence',evidence_needed:'Matched baseline and mitigation timings.'}],corrections:[],issues:[]}
      :{verdict:'answered',answer:'Each read returns3 and leaves3 stored.',issues:[]};
    const fact=verify(plan.packets[0],notice?'assessment':'fact',fields);
    if(config.beforeFactRead){config.beforeFactRead({binding,fact,handle,invoke,read,prefix});return;}
    const readInput=reply=>({attempt_id:'current',candidate_sha256:'current',challenge:'current',...(config.withNext&&host==='codex'?{receipt_text:receiptText(reply),include_next_step:true}:{})});
    if(config.readFact!==false){const observed=call('explanation_result',readInput(fact));if(config.withNext)assert.equal(observed.payload.next_step.stage,'final_proposal');}
    if(notice&&config.priorNormal){
      const normal=v.prepare({...binding,request});call('explanation_prepare',{...binding,request});
      verify(normal.packets[0],'fact',{verdict:'answered',answer:'The supplied register definition does not establish measured slowdown.',issues:[]});
      call('explanation_result',{attempt_id:'current',candidate_sha256:'current',challenge:'current'});
      assert.equal(read().attempt.verification.prior_assessment.facts[0].reply_sha256,require('../scripts/verification-packet.cjs').digest(fact.result));
    }
    let packet,text;
    if(notice){
      const args={...binding,assessment_result:config.currentAssessment?'current':fact.result,language:'en'},proposal=a.noticeFromAssessment(args,request,fact.result);
      call('explanation_notice_from_assessment',args);packet=proposal.proposal.review.packet;text=proposal.proposal.decision.final_text;
    }else{
      text=config.revise?'Reading changes3 to0.':config.reference?fact.result.answer:'두 읽기는 모두 3을 반환하고 저장값은 3으로 유지됩니다.';
      const args={...binding,request,final_text:config.reference?{fact_answers:'current'}:text,facts:[{id:'REQUEST_FACTS',result:fact.result}],revision:0};
      const wire=config.reference&&host==='claude'?{...args,request:'current',facts:'current'}:args;
      if(config.beforeFinal){config.beforeFinal({read,handle,invoke,args:wire,prefix,request,fact,finish:text=>stop({...base,hook_event_name:'Stop',last_assistant_message:text,stop_hook_active:false},true,options)});return;}
      packet=v.finalize(args).packet;call('explanation_check_final',wire);
    }
    const checks=reviewChecks();if(config.revise)checks.claim_review.conditions_outcomes=[0];
    if(config.misattributed)checks.fact_review.computed_outcomes=[0];
    let final=verify(packet,notice?'notice':'final',notice?{notice_decision:'approve_notice',requirement_review:'The measurement gap is accurate.',evidence_review:'Matched timings are required.',assessment_review:'No draft claim assessment is requested.',issues:[],checked_questions:[v.assessmentId]}
      :{final_decision:config.revise?'revise_explanation':'approve_explanation',...checks,issues:config.revise?[{quote:text,reason:'Reading leaves3 unchanged in the supplied definition.',evidence_needed:'Preserve3 in the proposed explanation.'}]:[],checked_questions:['REQUEST_FACTS']});
    if(config.corrected){
      assert.equal(notice,false);assert.equal(config.revise,true);assert.equal(config.withNext,true);
      const reviewed=call('explanation_result',readInput(final));assert.equal(reviewed.payload.next_step.stage,'correct_final');
      assert.equal(read().attempt.status,'pending');assert.equal(read().attempt.verification.revision,0);
      text=config.correctedWithheld?'Reading changes3 to1.':'A read returns3. It leaves3 stored.';
      const args=host==='claude'?{...reviewed.payload.next_step.arguments,...binding,final_text:text}:{...binding,request:'current',facts:'current',final_text:text,revision:1},issued=call('explanation_check_final',args);
      packet=v.finalizeReferences(args,issued.payload.source_facts).payload.packet;
      const checked=reviewChecks();if(config.correctedWithheld)checked.claim_review.conditions_outcomes=[0];
      final=verify(packet,'final',{final_decision:config.correctedWithheld?'revise_explanation':'approve_explanation',...checked,checked_questions:['REQUEST_FACTS'],
        issues:config.correctedWithheld?[{quote:text,reason:'A read preserves3.',evidence_needed:'The unchanged value must be retained.'}]:[]});
    }
    const pre={hook_event_name:'PreToolUse',tool_name:prefix+'explanation_result',tool_use_id:'delivery-read',tool_input:readInput(final)};
    const finish=(text,active=false)=>stop({...base,hook_event_name:'Stop',last_assistant_message:text,stop_hook_active:active},true,options);
    body({read,handle,pre,invoke,packet,text,final,finish,file});
  }finally{assert.equal(path.dirname(fs.realpathSync(tmp)),fs.realpathSync(runtime));fs.rmSync(tmp,{recursive:true});}
}
test('normal native-file Pre/MCP/Post final delivery reaches exact Stop and notice remains withheld',()=>{
  for(const host of ['claude','codex'])for(const notice of [false,true])fixture(host,notice,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.deepEqual(response.structuredContent.delivery,{scope:notice?'withholding_notice':'explanation',final_text:c.text,final_sha256:textDigest(c.text)});
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.status,notice?'withheld':'complete');assert.deepEqual(c.finish(c.text),{});
    assert.equal(c.read().attempt.corrections,0);assert.doesNotMatch(canonical(c.read()),/final_text|두 읽기는|Matched baseline/);
  });
});

test('a prior assessment survives actual normal fact hooks and a separate Codex connection before a fresh current notice review',()=>{
  for(const host of ['claude','codex'])fixture(host,true,c=>{
    const allowed=c.handle(c.pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');
    const bound=allowed.hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);assert.equal(response.isError,undefined);
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.status,'withheld');assert.equal(c.read().attempt.verification.facts[0].id,v.assessmentId);
    assert.deepEqual(response.structuredContent.delivery,{scope:'withholding_notice',final_text:c.text,final_sha256:textDigest(c.text)});
    assert.deepEqual(c.finish(c.text),{});
  },{priorNormal:true,currentAssessment:true,separateChildConnection:host==='codex'});
});

test('an assessment compiler cache without actual parent read Pre/Post cannot authorize current notice registration',()=>{
  for(const host of ['claude','codex'])fixture(host,true,()=>{}, {separateChildConnection:host==='codex',beforeFactRead:c=>{
    assert.equal(c.read().attempt.verification.facts[0].phase,'referenced');
    const response=c.invoke('explanation_result',{...c.binding,challenge:c.fact.result.challenge,result:c.fact.result,receipt_text:c.fact.receipt_text});
    assert.equal(response.isError,undefined);
    const denied=c.handle({hook_event_name:'PreToolUse',tool_name:c.prefix+'explanation_notice_from_assessment',tool_use_id:'unobserved-notice',
      tool_input:{...c.binding,assessment_result:'current',language:'en'}});
    assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');assert.equal(c.read().attempt.verification.final,null);
  }});
});

test('normal Codex final handoffs retain exact native delivery and the one-revision boundary',()=>{
  for(const mode of ['initial-complete','corrected-complete','spent-withheld'])fixture('codex',false,c=>{
    const allowed=c.handle(c.pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const bound=allowed.hookSpecificOutput.updatedInput;
    const response=c.invoke('explanation_result',bound);assert.equal(response.isError,undefined);
    assert.equal(response.structuredContent.next_step.stage,mode==='spent-withheld'?'withhold':'deliver');
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.verification.revision,mode==='initial-complete'?0:1);
    if(mode==='spent-withheld'){
      assert.equal(Object.hasOwn(response.structuredContent.next_step,'code'),false);assert.equal(response.structuredContent.delivery,undefined);
      assert.equal(c.read().attempt.status,'pending');assert.equal(c.finish(c.text).decision,'block');assert.equal(c.read().attempt.corrections,1);
      assert.equal(c.finish(c.text,true).continue,false);assert.equal(c.read().status,'unavailable');
    }else{assert.equal(c.read().attempt.status,'complete');assert.equal(response.structuredContent.delivery.final_text,c.text);assert.deepEqual(c.finish(c.text),{});}
  },{withNext:true,separateChildConnection:true,revise:mode!=='initial-complete',corrected:mode!=='initial-complete',correctedWithheld:mode==='spent-withheld'});
});

test('a next-step mutation or missing handoff cannot turn the actual approved result into a different parent contract',()=>{
  for(const mode of ['missing','stage','instructions'])fixture('codex',false,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);assert.equal(response.isError,undefined);
    assert.equal(response.structuredContent.result.verdict,'complete');
    if(mode==='missing')delete response.structuredContent.next_step;
    if(mode==='stage')response.structuredContent.next_step.stage='correct_final';
    if(mode==='instructions')response.structuredContent.next_step.instructions+=' Extra unsupported execution guidance.';
    response.content=[{type:'text',text:JSON.stringify(response.structuredContent)}];
    assert.match(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}).systemMessage,/could not record/);
    assert.equal(c.read().status,'unavailable');assert.equal(c.finish(c.text).continue,false);
  },{withNext:true,separateChildConnection:true});
});
test('flat final checks bind through both native-file parsers and real hooks without turning a withheld review into completion',()=>{
  for(const host of ['claude','codex'])for(const revise of [false,true])fixture(host,false,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.verification.final.verdict,revise?'withheld':'complete');
    if(revise){assert.equal(response.structuredContent.delivery,undefined);assert.equal(c.read().attempt.status,'pending');assert.equal(c.finish(c.text).decision,'block');}
    else{assert.equal(response.structuredContent.delivery.final_text,c.text);assert.equal(c.read().attempt.status,'complete');assert.deepEqual(c.finish(c.text),{});}
  },{flat:true,revise});
});

test('normal Pre rejects final-only fact attribution and preserves a failed check instead of editing or retrying it',()=>{
  for(const host of ['claude','codex'])fixture(host,false,c=>{
    const before=canonical(c.final),denied=c.handle(c.pre);assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');
    assert.equal(c.read().status,'unavailable');assert.equal(c.read().attempt.status,'pending');assert.equal(c.read().attempt.verification.final.phase,'referenced');
    assert.equal(c.read().attempt.verification.final.verdict,null);assert.equal(canonical(c.final),before);
    assert.equal(c.handle({...c.pre,tool_use_id:'cannot-retry'}).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(c.finish(c.text).continue,false);assert.doesNotMatch(canonical(c.read()),/Reading changes|final_text|\"issues\"/);
  },{revise:true,misattributed:true,flat:true,separateChildConnection:host==='codex'});
});
test('normal Post rejects omitted, rehashed or scope-widened delivery and Stop remains unavailable',()=>{
  for(const host of ['claude','codex'])for(const mode of ['missing','changed','scope'])fixture(host,true,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound),payload=response.structuredContent;
    if(mode==='missing')delete payload.delivery;
    if(mode==='changed'){payload.delivery.final_text='Changed.';payload.delivery.final_sha256=textDigest('Changed.');}
    if(mode==='scope')payload.delivery.scope='explanation';response.content[0].text=JSON.stringify(payload);
    assert.match(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}).systemMessage,/could not record/);
    assert.equal(c.read().status,'unavailable');assert.equal(c.finish(c.text).continue,false);
  });
});
test('delivery does not relax the exact Stop body or its one correction budget',()=>{
  for(const host of ['claude','codex'])for(const repair of [true,false])fixture(host,false,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.finish('## Added title\n\n'+c.text).decision,'block');assert.equal(c.read().attempt.corrections,1);
    const next=c.finish(repair?c.text:c.text+' ',true);if(repair)assert.deepEqual(next,{});else{assert.equal(next.continue,false);assert.equal(c.read().status,'unavailable');}
  });
});
test('source-linked whole fact composition passes actual native-file reads and exact Stop on both hosts',()=>{
  for(const host of ['claude','codex'])fixture(host,false,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.equal(response.structuredContent.delivery.final_text,'Each read returns3 and leaves3 stored.');
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.status,'complete');assert.deepEqual(c.finish(c.text),{});
    assert.equal(c.read().attempt.verification.facts[0].phase,'returned');assert.equal(c.read().attempt.corrections,0);
    assert.doesNotMatch(canonical(c.read()),/fact_answers|Each read|final_text/);
  },{reference:true});
});

test('unlabeled compact receipts cross real native-file hooks and exact delivery for both hosts without changing approval scope',()=>{
  for(const host of ['claude','codex'])for(const notice of [false,true])fixture(host,notice,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.equal(response.isError,undefined);assert.equal(response.structuredContent.delivery.final_text,c.text);
    assert.equal(response.structuredContent.delivery.scope,notice?'withholding_notice':'explanation');
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.status,notice?'withheld':'complete');assert.equal(c.read().attempt.verification.final.return_corrections,0);
    assert.deepEqual(c.finish(c.text),{});
  },{receiptFence:true,reference:!notice,withNext:!notice});
});

test('Claude actual native-file fact read supplies a checked final registration handoff, not an Agent launch',()=>fixture('claude',false,()=>{},
  {beforeFactRead:c=>{
    const pre={hook_event_name:'PreToolUse',tool_name:c.prefix+'explanation_result',tool_use_id:'claude-next-read',tool_input:{attempt_id:'current',candidate_sha256:'current',challenge:'current'}};
    const bound=c.handle(pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.equal(response.structuredContent.next_step.stage,'final_proposal');assert.equal(response.structuredContent.next_step.tool,'explanation_check_final');
    assert.equal(Object.hasOwn(response.structuredContent.next_step,'Agent'),false);
    assert.deepEqual(c.handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.status,'pending');assert.equal(c.read().attempt.verification.final,null);
    const args=response.structuredContent.next_step.arguments,finalPre={hook_event_name:'PreToolUse',tool_name:c.prefix+'explanation_check_final',tool_use_id:'claude-next-final',tool_input:args};
    const allowed=c.handle(finalPre);assert.notEqual(allowed.hookSpecificOutput?.permissionDecision,'deny');
    const finalBound=allowed.hookSpecificOutput.updatedInput,issued=c.invoke('explanation_check_final',finalBound);assert.equal(issued.isError,undefined);
    assert.deepEqual(c.handle({...finalPre,hook_event_name:'PostToolUse',tool_input:finalBound,tool_response:issued}),{});
    assert.equal(c.read().attempt.verification.final.phase,'planned');assert.equal(c.read().attempt.status,'pending');
    assert.equal(v.launchChallenge(issued.structuredContent.native_dispatch.Agent.prompt),c.read().attempt.verification.final.challenge);
  }}));
test('Claude hook rejects omitted or altered result-stage actions after an actual native fact read',()=>{
  for(const change of ['omit','tool','revision','literal','approval'])fixture('claude',false,()=>{},{beforeFactRead:c=>{
    const pre={hook_event_name:'PreToolUse',tool_name:c.prefix+'explanation_result',tool_use_id:'claude-altered-next',tool_input:{attempt_id:'current',candidate_sha256:'current',challenge:'current'}};
    const bound=c.handle(pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound),step=response.structuredContent.next_step;
    assert.equal(step.stage,'final_proposal');
    if(change==='omit')delete response.structuredContent.next_step;
    if(change==='tool')step.tool='Agent';if(change==='revision')step.arguments.revision=1;
    if(change==='literal')step.arguments.final_text='A substituted answer.';if(change==='approval')step.stage='deliver';
    response.content=[{type:'text',text:JSON.stringify(response.structuredContent)}];
    assert.match(c.handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}).systemMessage,/could not record/);
    assert.equal(c.read().status,'unavailable');assert.equal(c.read().attempt.verification.final,null);
    assert.equal(c.read().attempt.verification.facts[0].verdict,null);
    assert.equal(c.handle({...pre,tool_use_id:'denied-retry'}).hookSpecificOutput.permissionDecision,'deny');
  }});
});

test('Claude native-file reads carry the sole corrected-final action through a fresh review and exact delivery',()=>{
  for(const correctedWithheld of [false,true])fixture('claude',false,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.equal(response.isError,undefined);assert.equal(response.structuredContent.next_step.stage,correctedWithheld?'withhold':'deliver');
    assert.equal(Object.hasOwn(response.structuredContent.next_step,'tool'),false);
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.verification.revision,1);
    if(correctedWithheld){assert.equal(c.read().attempt.status,'pending');assert.equal(response.structuredContent.delivery,undefined);}
    else {assert.equal(c.read().attempt.status,'complete');assert.deepEqual(c.finish(response.structuredContent.delivery.final_text),{});}
  },{revise:true,corrected:true,withNext:true,correctedWithheld});
});
test('delivery-only correction points to the actual approved result literal for both explicit and whole-fact final inputs',()=>{
  for(const host of ['claude','codex'])for(const reference of [false,true])fixture(host,false,c=>{
    const bound=c.handle(c.pre).hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    const approved=response.structuredContent.delivery.final_text;assert.equal(approved,c.text);
    const correction=c.finish('An altered opening. '+approved);
    assert.equal(correction.decision,'block');assert.match(correction.reason,/delivery\.final_text/);assert.match(correction.reason,/explanation_result/);
    assert.doesNotMatch(correction.reason,/final_text argument of the latest explanation_check_final/);
    assert.equal(c.read().attempt.status,'complete');assert.equal(c.read().attempt.corrections,1);
    assert.deepEqual(c.finish(approved,true),{});assert.equal(c.read().attempt.final_sha256,textDigest(approved));
    assert.equal(c.read().attempt.verification.revision,0);assert.equal(c.read().attempt.corrections,1);
  },{reference});
});
test('source-linked final cannot use an unread result, substitute bytes, change parent or alter its pending input',()=>{
  for(const host of ['claude','codex'])for(const mode of ['unread','substituted','child','foreign','post-input'])fixture(host,false,()=>{},
    {reference:true,readFact:mode!=='unread',beforeFinal:c=>{
      const before=c.read();let input=structuredClone(c.args);
      if(mode==='foreign')input.candidate_sha256='b'.repeat(64);
      if(mode==='substituted'&&host==='codex')input.facts[0].result.answer='Substituted cached content.';
      const pre={hook_event_name:'PreToolUse',tool_name:c.prefix+'explanation_check_final',tool_use_id:'composition-adversary',tool_input:input,
        ...(mode==='child'?{agent_id:host==='claude'?'a4444555566667771':'44444444-4444-4444-8444-444444444441',turn_id:'55555555-5555-4555-8555-555555555551'}:{})};
      const allowed=c.handle(pre);
      if(['child','foreign','unread'].includes(mode)||mode==='substituted'&&host==='codex'){
        assert.equal(allowed.hookSpecificOutput?.permissionDecision,'deny',host+':'+mode);
        assert.equal(c.read().attempt.verification.final,null);
        assert.equal(c.read().pending_tool,undefined);
      }
      else{
        assert.notEqual(allowed.hookSpecificOutput?.permissionDecision,'deny');const bound=allowed.hookSpecificOutput?.updatedInput??input;
        const response=c.invoke('explanation_check_final',bound);assert.equal(response.isError,undefined);
        if(mode==='substituted'&&host==='claude'){
          response.structuredContent.source_facts.facts[0].result.answer='Substituted cached content.';
          const resolved=v.finalizeReferences(bound,response.structuredContent.source_facts);response.structuredContent=v.exposeReferencedFinal(resolved,'claude');
          response.content=[{type:'text',text:JSON.stringify(response.structuredContent)}];
        }
        const post=c.handle({...pre,hook_event_name:'PostToolUse',tool_input:mode==='post-input'?{...bound,final_text:'Changed proposal.'}:bound,tool_response:response});
        assert.match(post.systemMessage,/could not record/);
      }
      if(mode==='child'){
        assert.deepEqual(c.read(),before);assert.equal(c.read().attempt.verification.final,null);
        assert.equal(c.finish('Substituted cached content.').decision,'block');
      }else{
        assert.equal(c.read().status,'unavailable',host+':'+mode);assert.equal(c.finish('Substituted cached content.').continue,false);
      }
    }});
});

test('Claude keeps rejecting Codex-only next-step reads with or without a valid receipt and cannot retry the failed attempt',()=>{
  for(const withReceipt of [false,true])fixture('claude',false,c=>{
    const pre={...c.pre,tool_input:{...c.pre.tool_input,include_next_step:true,...(withReceipt?{receipt_text:c.final.receipt_text}:{})}};
    assert.equal(c.handle(pre).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(c.read().status,'unavailable');assert.equal(c.read().attempt.verification.final.phase,'referenced');
    assert.equal(c.read().attempt.verification.final.verdict,null);assert.equal(c.read().attempt.final_sha256,null);
    assert.equal(c.handle({...c.pre,tool_use_id:'retry-without-flag'}).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(c.finish(c.text).continue,false);
  });
});

test('Claude three-field reads and exact legacy receipts preserve native evidence while an Agent metadata footer stays rejected',()=>{
  for(const mode of ['three-fields','exact-legacy-receipt','agent-footer'])fixture('claude',false,()=>{}, {beforeFactRead:c=>{
    const input={attempt_id:'current',candidate_sha256:'current',challenge:'current'};
    if(mode==='exact-legacy-receipt')input.receipt_text=c.fact.receipt_text;
    if(mode==='agent-footer')input.receipt_text='agentId: a4444555566667771 (use SendMessage to continue this agent)';
    const pre={hook_event_name:'PreToolUse',tool_name:c.prefix+'explanation_result',tool_use_id:'three-field-read',tool_input:input},allowed=c.handle(pre);
    if(mode==='agent-footer'){
      assert.equal(allowed.hookSpecificOutput.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');
      assert.equal(c.read().attempt.verification.facts[0].phase,'referenced');assert.equal(c.read().attempt.verification.facts[0].verdict,null);
      assert.equal(c.handle({...pre,tool_use_id:'no-retry',tool_input:{attempt_id:'current',candidate_sha256:'current',challenge:'current'}}).hookSpecificOutput.permissionDecision,'deny');
    }else{
      assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const args=allowed.hookSpecificOutput.updatedInput;
      assert.deepEqual(args.result,c.fact.result);assert.equal(args.challenge,c.fact.result.challenge);
      const response=c.invoke('explanation_result',args);assert.equal(response.isError,undefined);
      assert.deepEqual(c.handle({...pre,hook_event_name:'PostToolUse',tool_input:args,tool_response:response}),{});
      assert.equal(c.read().attempt.verification.facts[0].phase,'returned');assert.equal(c.read().attempt.verification.facts[0].verdict,'answered');
    }
    assert.equal(c.read().attempt.verification.final,null);assert.equal(c.read().attempt.final_sha256,null);
  }});
});
