'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),v=require('../scripts/explanation-verification.cjs'),{textDigest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const parent='11111111-1111-4111-8111-111111111111',parentTurn='22222222-2222-4222-8222-222222222222',childTurn='33333333-3333-4333-8333-333333333333';
const request='Explain the supplied fictional register. Each read returns3 without changing its stored value.';
function fixture(host,body,settings={}){
  const runtime=path.resolve(__dirname,'../.superpowers'),tmp=fs.mkdtempSync(path.join(runtime,'result-hook-')),profile=path.join(tmp,'profile'),root=path.join(profile,'plugins/data/ttak-receipt');fs.mkdirSync(root,{recursive:true});
  const child=host==='codex'?'44444444-4444-4444-8444-444444444444':'a4444555566667777',container=path.join(profile,host==='codex'?'sessions':'projects');fs.mkdirSync(container);
  const parentFile=path.join(container,host==='codex'?'rollout-'+parent+'.jsonl':parent+'.jsonl');fs.writeFileSync(parentFile,'{}\n');
  const childFile=host==='codex'?path.join(container,'rollout-'+child+'.jsonl'):path.join(container,parent,'subagents','agent-'+child+'.jsonl');fs.mkdirSync(path.dirname(childFile),{recursive:true});
  const base={session_id:parent,turn_id:parentTurn,cwd:tmp,transcript_path:parentFile},options={root,enabled:true,now:1000000},handle=x=>handleEvent({...base,...x},options);
  const file=path.join(root,'scenario-evidence-v1',textDigest(parent)+'.json'),read=()=>JSON.parse(fs.readFileSync(file));
  const prefix=host==='claude'?'mcp__plugin_ttak_ttak_scenario__':'mcp__ttak_scenario__',dispatch=createDispatcher({host});
  dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'result-hook-test',version:'1'}}});dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  const separate=settings.separateChildConnection?createDispatcher({host}):dispatch;
  if(separate!==dispatch){separate({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'separate-child-test',version:'1'}}});separate({jsonrpc:'2.0',method:'notifications/initialized'});}
  const invoke=(name,args,child=false)=>(child?separate:dispatch)({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
  let number=0;
  function call(name,args,actor={}){
    const pre={hook_event_name:'PreToolUse',tool_name:prefix+name,tool_use_id:'call-'+(++number),tool_input:args,...actor},allowed=handle(pre);
    assert.notEqual(allowed.hookSpecificOutput?.permissionDecision,'deny');const bound=allowed.hookSpecificOutput?.updatedInput??args,response=invoke(name,bound,actor.agent_id!=null);assert.equal(response.isError,undefined);
    assert.deepEqual(handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});return {pre,bound,response,payload:response.structuredContent};
  }
  try{
    handle({hook_event_name:'UserPromptSubmit',prompt:request});const binding={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate},args={...binding,request},plan=v.prepare(args),packet=plan.packets[0];call('explanation_prepare',args);
    const spawn={hook_event_name:'PreToolUse',tool_use_id:'spawn-one',tool_name:host==='codex'?'spawn_agent':'Agent',tool_input:host==='codex'
      ?{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}
      :{description:'One check',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}};
    assert.deepEqual(handle(spawn),{});if(host==='codex')assert.deepEqual(handle({...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child}}),{});
    handle({hook_event_name:'SubagentStart',agent_id:child,agent_type:v.agentType});const actor={agent_id:child,turn_id:childTurn};
    if(host==='codex')assert.deepEqual(handle({hook_event_name:'UserPromptSubmit',...actor,prompt:packet.prompt}),{});else call('explanation_packet',{challenge:packet.challenge},actor);
    const submissionArgs={challenge:settings.challenge??packet.challenge,verdict:'answered',answer:'Each read returns3 without changing the stored value.',issues:[]};
    if(settings.beforeSubmission){settings.beforeSubmission({handle,read,file,invoke,actor,packet,prefix,options,submissionArgs});return;}
    const submission=call('explanation_fact_result',submissionArgs,actor);
    const rows=host==='codex'?[
      {type:'session_meta',payload:{id:child,session_id:parent,parent_thread_id:parent,cli_version:'0.154.0',cwd:tmp}},
      {type:'turn_context',payload:{turn_id:childTurn,model:'gpt-5.6-luna',effort:'high'}},
      {type:'event_msg',payload:{type:'item_completed',thread_id:child,turn_id:childTurn,item:{type:'McpToolCall',id:submission.pre.tool_use_id,server:'ttak_scenario',tool:'explanation_fact_result',status:'completed',readOnlyHint:true,arguments:submission.bound,result:submission.response}}}
    ]:[
      {type:'assistant',uuid:'native-call',isSidechain:true,agentId:child,sessionId:parent,version:'2.1.266',cwd:tmp,message:{role:'assistant',model:'claude-haiku-4-5-20251001',content:[{type:'tool_use',id:submission.pre.tool_use_id,name:prefix+'explanation_fact_result',input:submission.pre.tool_input}]}},
      {type:'user',sourceToolAssistantUUID:'native-call',isSidechain:true,agentId:child,sessionId:parent,version:'2.1.266',cwd:tmp,message:{role:'user',content:[{type:'tool_result',tool_use_id:submission.pre.tool_use_id,content:JSON.stringify(submission.payload)}]}}
    ];
    fs.writeFileSync(childFile,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    assert.deepEqual(handle({hook_event_name:'SubagentStop',...actor,last_assistant_message:submission.payload.receipt_text}),{});
    if(host==='claude')assert.deepEqual(handle({...spawn,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:submission.payload.receipt_text+'\nagentId: '+child+' (for resuming)'}]}),{});
    assert.equal(read().attempt.verification.facts[0].phase,'referenced');
    const pre={hook_event_name:'PreToolUse',tool_name:prefix+'explanation_result',tool_use_id:'read-result',tool_input:{attempt_id:'current',candidate_sha256:'current',challenge:'current'}};
    body({handle,read,file,pre,invoke,submission,childFile,parentFile,root,tmp,actor});
  }finally{assert.equal(path.dirname(fs.realpathSync(tmp)),fs.realpathSync(runtime));fs.rmSync(tmp,{recursive:true});}
}
test('normal parent Pre/MCP/Post retrieves only the actual child result and stores no result text',()=>{
  for(const host of ['claude','codex'])fixture(host,c=>{
    const allowed=c.handle(c.pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const bound=allowed.hookSpecificOutput.updatedInput;
    assert.deepEqual(bound.result,c.submission.payload.result);assert.ok(c.read().pending_tool);assert.equal(c.read().attempt.verification.facts[0].phase,'referenced');
    const response=c.invoke('explanation_result',bound);assert.equal(response.isError,undefined);
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().pending_tool,undefined);assert.equal(c.read().attempt.verification.facts[0].phase,'returned');assert.equal(c.read().attempt.status,'pending');
    assert.doesNotMatch(fs.readFileSync(c.file,'utf8'),/Each read|"answer"|receipt_text|transcript_path/);
  });
});
test('missing or changed native evidence, hard links, outside parent paths and child callers fail closed',()=>{
  for(const host of ['claude','codex'])for(const mode of ['missing','changed','hardlink','outside','child','supplied-body'])fixture(host,c=>{
    let pre=c.pre;const before=c.read();
    if(mode==='missing')fs.unlinkSync(c.childFile);
    if(mode==='changed')fs.writeFileSync(c.childFile,'{}\n');
    if(mode==='hardlink')fs.linkSync(c.childFile,path.join(c.tmp,'second-link.jsonl'));
    if(mode==='outside')pre={...pre,transcript_path:path.join(c.tmp,'outside.jsonl')};
    if(mode==='child')pre={...pre,...c.actor};
    if(mode==='supplied-body')pre={...pre,tool_input:{...pre.tool_input,result:c.submission.payload.result}};
    assert.equal(c.handle(pre).hookSpecificOutput?.permissionDecision,'deny');
    if(mode==='child')assert.deepEqual(c.read(),before);else assert.equal(c.read().status,'unavailable');
    assert.notEqual(c.read().attempt.status,'complete');
  });
  fixture('claude',c=>{assert.equal(c.handle({...c.pre,transcript_path:null}).hookSpecificOutput?.permissionDecision,'deny');});
});
test('a result read requires its exact Pre/Post pair and a missing or changed return remains unavailable',()=>{
  for(const host of ['claude','codex'])for(const mode of ['without-pre','changed-args','changed-response','missing-post'])fixture(host,c=>{
    const allowed=mode==='without-pre'?null:c.handle(c.pre),bound=allowed?.hookSpecificOutput.updatedInput??{...c.pre.tool_input,result:c.submission.payload.result};
    if(mode==='missing-post'){assert.equal(c.handle({...c.pre,tool_use_id:'another-read'}).hookSpecificOutput?.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');return;}
    const response=mode==='without-pre'?{content:[{type:'text',text:'{}'}]}:c.invoke('explanation_result',bound);
    if(mode==='changed-response'){response.structuredContent.result.answer='Changed.';response.content[0].text=JSON.stringify(response.structuredContent);}
    const changed=mode==='changed-args'?{...bound,result:{...bound.result,answer:'Changed.'}}:bound;
    assert.match(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:changed,tool_response:response}).systemMessage,/could not record/);assert.equal(c.read().status,'unavailable');
  });
});
test('current follows real hook/MCP submission and native result-source parsing on both hosts without an early verdict',()=>{
  for(const host of ['claude','codex'])fixture(host,c=>{
    const slot=c.read().attempt.verification.facts[0];assert.equal(slot.submission_reference,true);assert.equal(slot.phase,'referenced');assert.equal(slot.verdict,null);
    assert.equal(c.submission.pre.tool_input.challenge,'current');assert.equal(c.submission.bound.challenge,slot.challenge);
    assert.deepEqual(c.submission.response.structuredContent,v.resultSubmission(c.submission.bound,'fact'));
    const allowed=c.handle(c.pre),bound=allowed.hookSpecificOutput.updatedInput;assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');
    assert.deepEqual(bound.result,c.submission.payload.result);assert.equal(c.read().attempt.verification.facts[0].verdict,null);
    const response=c.invoke('explanation_result',bound);assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    assert.equal(c.read().attempt.verification.facts[0].verdict,'answered');assert.equal(c.read().attempt.status,'pending');
    assert.equal(c.handle({...c.pre,tool_use_id:'second-read'}).hookSpecificOutput.permissionDecision,'deny');
  },{challenge:'current'});
});
test('current normal Pre rejects wrong scope, expired state, a spent call and malformed literal without recovery',()=>{
  for(const host of ['claude','codex'])for(const mode of ['parent','foreign','candidate','expired','unretrieved','spent','truncated','missing-post'])fixture(host,()=>{},
    {challenge:'current',beforeSubmission:c=>{
      let pre={hook_event_name:'PreToolUse',tool_name:c.prefix+'explanation_fact_result',tool_use_id:'current-once',tool_input:c.submissionArgs,...c.actor};
      const stored=c.read(),before=JSON.stringify(stored);
      if(mode==='parent'){delete pre.agent_id;pre.turn_id=parentTurn;}
      if(mode==='foreign')pre.agent_id='unrelated-child';
      if(mode==='candidate')stored.attempt.candidate='b'.repeat(64);if(mode==='expired')c.options.now+=1800001;
      if(mode==='unretrieved'){stored.attempt.verification.facts[0].retrieved=false;stored.attempt.verification.facts[0].retrieval_sha256=null;}
      if(['candidate','unretrieved'].includes(mode))fs.writeFileSync(c.file,JSON.stringify(stored)+'\n');
      if(mode==='truncated')pre.tool_input={...pre.tool_input,challenge:c.packet.challenge.slice(0,-1)};
      if(['spent','missing-post'].includes(mode)){
        const allowed=c.handle(pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');
        if(mode==='spent'){
          const bound=allowed.hookSpecificOutput.updatedInput,response=c.invoke('explanation_fact_result',bound);
          assert.deepEqual(c.handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
        }
        pre={...pre,tool_use_id:'another-submit'};
      }
      assert.equal(c.handle(pre).hookSpecificOutput.permissionDecision,'deny');assert.notEqual(c.read().attempt.status,'complete');
      if(mode==='foreign')assert.equal(JSON.stringify(c.read()),before);
      else{
        assert.equal(c.read().status,'unavailable');
        assert.equal(c.handle({...pre,...c.actor,tool_use_id:'cannot-recover',tool_input:c.submissionArgs}).hookSpecificOutput.permissionDecision,'deny');
      }
    }});
});
test('normal hook/MCP read compares the actual wait receipt before disclosing a result on either host',()=>{
  for(const host of ['claude','codex'])for(const mode of ['plain','fenced','wrong-hash','changed-post'])fixture(host,c=>{
    const receipt=mode==='fenced'?'```json\n'+c.submission.payload.receipt_text+'\n```':c.submission.payload.receipt_text;
    const pre={...c.pre,tool_input:{...c.pre.tool_input,receipt_text:mode==='wrong-hash'?JSON.stringify({...JSON.parse(receipt),result_sha256:'b'.repeat(64)}):receipt}};
    const allowed=c.handle(pre);if(mode==='wrong-hash'){assert.equal(allowed.hookSpecificOutput.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');return;}
    assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const bound=allowed.hookSpecificOutput.updatedInput,response=c.invoke('explanation_result',bound);
    assert.equal(response.isError,undefined);assert.deepEqual(response.structuredContent.result,c.submission.payload.result);
    const post={...pre,hook_event_name:'PostToolUse',tool_input:mode==='changed-post'?{...bound,receipt_text:receipt+' '}:bound,tool_response:response};
    if(mode==='changed-post'){assert.match(c.handle(post).systemMessage,/could not record/);assert.equal(c.read().status,'unavailable');}
    else{assert.deepEqual(c.handle(post),{});assert.equal(c.read().attempt.verification.facts[0].phase,'returned');assert.equal(c.read().attempt.status,'pending');}
  },{challenge:'current'});
});
test('a separate Codex child result enters its parent cache only through exact native result disclosure',()=>{
  fixture('codex',c=>{
    const pre={...c.pre,tool_input:{...c.pre.tool_input,receipt_text:c.submission.payload.receipt_text}},bound=c.handle(pre).hookSpecificOutput.updatedInput;
    const response=c.invoke('explanation_result',bound);assert.equal(response.isError,undefined);
    assert.deepEqual(c.handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    const finalInput={attempt_id:'current',candidate_sha256:'current',request:'current',facts:'current',final_text:'Each read returns3 without changing the stored value.',revision:0};
    const finalPre={hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_check_final',tool_use_id:'final-with-cache',tool_input:finalInput};
    const allowed=c.handle(finalPre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const args=allowed.hookSpecificOutput.updatedInput;
    const final=c.invoke('explanation_check_final',args);assert.equal(final.isError,undefined);
    assert.deepEqual(final.structuredContent.source_facts,{request,facts:[{id:'REQUEST_FACTS',result:c.submission.payload.result}]});
    assert.deepEqual(c.handle({...finalPre,hook_event_name:'PostToolUse',tool_input:args,tool_response:final}),{});
    assert.equal(c.read().attempt.verification.final.phase,'planned');assert.equal(c.read().attempt.status,'pending');assert.equal(final.structuredContent.complete_authorized,false);
  },{challenge:'current',separateChildConnection:true});
});
test('a compiler cache without the parent native read receipt cannot authorize final registration',()=>{
  fixture('codex',c=>{
    const attempt=c.read().attempt;
    const args={attempt_id:attempt.id,candidate_sha256:attempt.candidate,challenge:c.submission.payload.result.challenge,result:c.submission.payload.result,receipt_text:c.submission.payload.receipt_text};
    const seeded=c.invoke('explanation_result',args);assert.equal(seeded.isError,undefined);assert.equal(c.read().attempt.verification.facts[0].phase,'referenced');
    const pre={hook_event_name:'PreToolUse',tool_name:'mcp__ttak_scenario__explanation_check_final',tool_use_id:'without-native-read',
      tool_input:{attempt_id:'current',candidate_sha256:'current',request:'current',facts:'current',final_text:'The read returns3.',revision:0}};
    assert.equal(c.handle(pre).hookSpecificOutput.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');assert.equal(c.read().attempt.verification.final,null);
  },{challenge:'current',separateChildConnection:true});
});

test('normal Codex read Pre/Post independently validates the current next recipe and rejects changed or missing handoffs',()=>{
  for(const mode of ['normal','changed-code','changed-stage','missing','unrequested','spent','missing-post'])fixture('codex',c=>{
    const pre={...c.pre,tool_input:{...c.pre.tool_input,receipt_text:c.submission.payload.receipt_text,...(mode==='unrequested'?{}:{include_next_step:true})}};
    const allowed=c.handle(pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const bound=allowed.hookSpecificOutput.updatedInput;
    assert.equal(c.read().attempt.verification.facts[0].phase,'referenced');const response=c.invoke('explanation_result',bound);assert.equal(response.isError,undefined);
    const expected=v.resultNextStep(c.submission.payload.result,{remaining_facts:0,failed_facts:0,revision:null});
    if(mode==='unrequested')response.structuredContent.next_step=expected;else assert.deepEqual(response.structuredContent.next_step,expected);
    if(mode==='changed-code')response.structuredContent.next_step.code+='\nthrow new Error("changed recipe");';
    if(mode==='changed-stage')response.structuredContent.next_step.stage='deliver';if(mode==='missing')delete response.structuredContent.next_step;
    response.content=[{type:'text',text:JSON.stringify(response.structuredContent)}];
    if(mode==='missing-post'){
      assert.equal(c.handle({...pre,tool_use_id:'next-without-post'}).hookSpecificOutput.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');return;
    }
    const observed=c.handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response});
    if(['normal','spent'].includes(mode)){
      assert.deepEqual(observed,{});assert.equal(c.read().attempt.verification.facts[0].phase,'returned');assert.equal(c.read().attempt.status,'pending');
      if(mode==='spent')assert.equal(c.handle({...pre,tool_use_id:'second-next-read'}).hookSpecificOutput.permissionDecision,'deny');
    }else{assert.match(observed.systemMessage,/could not record/);assert.equal(c.read().status,'unavailable');}
  },{challenge:'current',separateChildConnection:true});
});

test('the next-step selector cannot bypass its normal Codex scope or actual wait-receipt requirement',()=>{
  for(const host of ['claude','codex'])for(const mode of ['no-receipt','false','wrong-receipt','normal']){
    if(host==='codex'&&mode==='normal')continue;
    fixture(host,c=>{
      const args={...c.pre.tool_input,include_next_step:mode==='false'?false:true};
      if(mode!=='no-receipt')args.receipt_text=mode==='wrong-receipt'?JSON.stringify({...JSON.parse(c.submission.payload.receipt_text),result_sha256:'b'.repeat(64)}):c.submission.payload.receipt_text;
      assert.equal(c.handle({...c.pre,tool_input:args}).hookSpecificOutput.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');
    },{challenge:'current',separateChildConnection:host==='codex'});
  }
});
