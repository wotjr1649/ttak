'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),{handle:stop}=require('../hooks/scenario-stop.cjs');
const v=require('../scripts/explanation-verification.cjs'),{textDigest}=require('../scripts/verification-packet.cjs'),{createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs');
function fixture(host,body){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'preview-hook-'));
  const base={session_id:'preview-parent',turn_id:'parent-turn'},options={root,enabled:true,now:1000000},handle=x=>handleEvent({...base,...x},options);
  const file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file)),prefix=host==='claude'?'mcp__plugin_ttak_ttak_scenario__':'mcp__ttak_scenario__';
  const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'preview-test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});let number=1;
  const invoke=(name,args)=>dispatch({jsonrpc:'2.0',id:++number,method:'tools/call',params:{name,arguments:args}}).result;
  function call(name,args,actor={}){
    const pre={hook_event_name:'PreToolUse',tool_name:prefix+name,tool_use_id:'call-'+(++number),tool_input:args,...actor},allowed=handle(pre);
    assert.notEqual(allowed.hookSpecificOutput?.permissionDecision,'deny');const bound=allowed.hookSpecificOutput?.updatedInput??args,response=invoke(name,bound);
    assert.equal(response.isError,undefined);assert.deepEqual(handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    return response.structuredContent;
  }
  function launch(packet){
    const child=packet.id+'-child',actor={agent_id:child,turn_id:packet.id+'-turn'},spawn={hook_event_name:'PreToolUse',tool_name:host==='codex'?'spawn_agent':'Agent',tool_use_id:packet.id+'-spawn',tool_input:host==='codex'
      ?{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}
      :{description:'One check',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}};
    assert.deepEqual(handle(spawn),{});if(host==='codex')assert.deepEqual(handle({...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child}}),{});
    handle({hook_event_name:'SubagentStart',agent_id:child,agent_type:v.agentType});
    if(host==='codex')assert.deepEqual(handle({hook_event_name:'UserPromptSubmit',...actor,prompt:packet.prompt}),{});else call('explanation_packet',{challenge:packet.challenge},actor);
    return {actor,spawn,finish:payload=>{
      assert.deepEqual(handle({hook_event_name:'SubagentStop',...actor,last_assistant_message:payload.final_text}),{});
      if(host==='claude')assert.deepEqual(handle({...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child}}),{});
    }};
  }
  try{
    const request='Explain the fictional register whose read returns3 without changing its stored value.';handle({hook_event_name:'UserPromptSubmit',prompt:request});
    const binding={attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate},args={...binding,request},plan=v.prepare(args);call('explanation_prepare',args);
    const fact=plan.packets[0],factActor=launch(fact),factResult=call('explanation_fact_result',{challenge:fact.challenge,verdict:'answered',answer:'Reading returns3 and leaves3 stored.',issues:[]},factActor.actor);factActor.finish(factResult);
    const finalArgs={...binding,request,final_text:'Reading returns3 and leaves3 stored.',facts:[{id:fact.id,result:factResult.result}],revision:0},final=v.finalize(finalArgs);call('explanation_check_final',finalArgs);
    const finalActor=launch(final.packet),input={challenge:final.packet.challenge,requirement_review:'The requested read behavior is covered.',claim_review:'The read and final state match.',fact_review:'REQUEST_FACTS matches the definition.'};
    const pre={hook_event_name:'PreToolUse',tool_name:prefix+'explanation_final_preview',tool_use_id:'preview-once',tool_input:input,...finalActor.actor};
    const submission={challenge:input.challenge,...reviewChecks(),final_decision:'approve_explanation',checked_questions:[fact.id],issues:[]};
    body({handle,read,file,invoke,call,pre,input,submission,finalActor,prefix,base,options,finalArgs});
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}
test('normal hook/MCP preview is measured only; actual full result and exact Stop remain necessary on both hosts',()=>{
  for(const host of ['claude','codex'])fixture(host,c=>{
    assert.deepEqual(c.handle(c.pre),{});assert.equal(c.read().attempt.verification.final.format_preview.observed,false);
    const response=c.invoke('explanation_final_preview',c.input);assert.equal(response.isError,undefined);assert.equal(response.structuredContent.complete_authorized,false);
    assert.equal(response.structuredContent.review_bytes.claim_review,Buffer.byteLength(c.input.claim_review));
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_response:response}),{});
    assert.equal(c.read().attempt.status,'pending');assert.equal(c.read().attempt.verification.final.submission_sha256,null);
    assert.doesNotMatch(fs.readFileSync(c.file,'utf8'),/requested read behavior|review_bytes|receipt_text/);
    const submitted=c.call('explanation_final_result',c.submission,c.finalActor.actor);c.finalActor.finish(submitted);
    assert.equal(c.read().attempt.status,'complete');assert.deepEqual(stop({...c.base,hook_event_name:'Stop',last_assistant_message:c.finalArgs.final_text,stop_hook_active:false},true,c.options),{});
  });
});
test('missing or altered preview receipt fails closed and remains unverified, without storing the draft',()=>{
  for(const host of ['claude','codex'])for(const mode of ['no-pre','no-post','changed-input','changed-result','duplicate'])fixture(host,c=>{
    if(mode!=='no-pre')assert.deepEqual(c.handle(c.pre),{});
    const response=c.invoke('explanation_final_preview',c.input);assert.equal(response.isError,undefined);
    if(mode==='no-post'){
      assert.equal(c.handle({...c.pre,tool_name:c.prefix+'explanation_final_result',tool_use_id:'actual-submit',tool_input:c.submission}).hookSpecificOutput?.permissionDecision,'deny');
    }else{
      const post={...c.pre,hook_event_name:'PostToolUse',tool_response:response};
      if(mode==='changed-input')post.tool_input={...c.input,claim_review:'Changed.'};
      if(mode==='changed-result'){response.structuredContent.review_bytes.claim_review=1;response.content[0].text=JSON.stringify(response.structuredContent);}
      if(mode==='duplicate'){
        assert.deepEqual(c.handle(post),{});assert.equal(c.handle({...c.pre,tool_use_id:'second-preview'}).hookSpecificOutput?.permissionDecision,'deny');
      }else assert.match(c.handle(post).systemMessage,/could not record/);
    }
    assert.equal(c.read().status,'unavailable');assert.notEqual(c.read().attempt.status,'complete');
    assert.equal(stop({...c.base,hook_event_name:'Stop',last_assistant_message:c.finalArgs.final_text,stop_hook_active:false},true,c.options).continue,false);
  });
});
test('over-limit preview cannot accept an oversized final submission or recover a denied submission',()=>{
  for(const host of ['claude','codex'])fixture(host,c=>{
    const input={...c.input,claim_review:'x'.repeat(401)},pre={...c.pre,tool_input:input};assert.deepEqual(c.handle(pre),{});
    const response=c.invoke('explanation_final_preview',input);assert.equal(response.structuredContent.format_ok,false);assert.equal(response.isError,undefined);
    assert.deepEqual(c.handle({...pre,hook_event_name:'PostToolUse',tool_response:response}),{});assert.equal(c.read().status,'empty');
    assert.equal(c.handle({...pre,tool_name:c.prefix+'explanation_final_result',tool_use_id:'too-large',tool_input:{...c.submission,claim_review:input.claim_review}}).hookSpecificOutput?.permissionDecision,'deny');
    assert.equal(c.read().status,'unavailable');assert.equal(c.read().attempt.verification.final.submitted,false);
    assert.equal(c.handle({...c.pre,tool_use_id:'cannot-recover'}).hookSpecificOutput?.permissionDecision,'deny');assert.equal(c.read().status,'unavailable');
  });
});
test('parent and wrong-child callers cannot preview; correct summaries still require an actual final result',()=>{
  for(const host of ['claude','codex'])for(const actor of ['parent','wrong-child','preview-only'])fixture(host,c=>{
    if(actor==='preview-only'){
      assert.deepEqual(c.handle(c.pre),{});const response=c.invoke('explanation_final_preview',c.input);
      assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_response:response}),{});
      assert.match(c.handle({hook_event_name:'SubagentStop',...c.finalActor.actor,last_assistant_message:JSON.stringify(response.structuredContent)}).systemMessage,/could not record/);
      assert.equal(c.read().status,'unavailable');
    }else{
      const pre={...c.pre,agent_id:actor==='parent'?undefined:'unrelated-child',turn_id:actor==='parent'?'parent-turn':'unrelated-turn'};
      assert.equal(c.handle(pre).hookSpecificOutput?.permissionDecision,'deny');
    }
    assert.equal(c.read().attempt.verification.final.submitted,false);assert.notEqual(c.read().attempt.status,'complete');
  });
});
test('a bound native Agent return after a denied preview gives model-visible terminal failure without reopening the attempt',()=>{
  fixture('claude',c=>{
    assert.deepEqual(c.handle(c.pre),{});const response=c.invoke('explanation_final_preview',c.input);
    assert.deepEqual(c.handle({...c.pre,hook_event_name:'PostToolUse',tool_response:response}),{});
    assert.equal(c.handle({...c.pre,tool_use_id:'second-preview'}).hookSpecificOutput?.permissionDecision,'deny');
    const before=fs.readFileSync(c.file,'utf8'),post={...c.finalActor.spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:c.finalActor.actor.agent_id}};
    const feedback=c.handle(post);assert.equal(feedback.hookSpecificOutput?.hookEventName,'PostToolUse');
    assert.equal(feedback.hookSpecificOutput?.additionalContext,feedback.systemMessage);assert.match(feedback.systemMessage,/unverified/);
    assert.match(feedback.systemMessage,/Do not continue or relaunch/);assert.equal(feedback.hookSpecificOutput?.updatedToolOutput,undefined);
    assert.equal(fs.readFileSync(c.file,'utf8'),before);assert.equal(c.read().attempt.verification.final.submitted,false);
    assert.deepEqual(c.handle({...post,turn_id:'other-parent-turn'}),{});assert.deepEqual(c.handle({...post,tool_use_id:'unrelated-spawn'}),{});
    assert.equal(c.handle({...c.pre,tool_name:c.prefix+'explanation_final_result',tool_use_id:'recovery-submit',tool_input:c.submission}).hookSpecificOutput?.permissionDecision,'deny');
    assert.equal(stop({...c.base,hook_event_name:'Stop',last_assistant_message:c.finalArgs.final_text,stop_hook_active:false},true,c.options).continue,false);
  });
});
