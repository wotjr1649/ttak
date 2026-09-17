'use strict';
// Synthetic native source and replayed verifier receipts. No model-quality claim.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const v=require('../scripts/explanation-verification.cjs'),{handleEvent}=require('../hooks/scenario-evidence.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs'),{textDigest}=require('../scripts/verification-packet.cjs');
const session='12345678-1234-1234-1234-123456789181',turn='87654321-4321-4321-4321-123456789181';
const request='Explain the fictional Velo register in two sentences. It begins at 9; reading returns the stored integer without changing it. Read twice.';
const answer='Both reads return 9, and 9 remains stored.';
const proposal='The first read returns 9, and the second also returns 9. Since reading changes nothing, 9 remains stored.';
function connect(){
  const d=createDispatcher({host:'codex'});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'final-alias',version:'1'}}});
  d({jsonrpc:'2.0',method:'notifications/initialized'});
  return (name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
}
function fixture(body){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'final-alias-test-'));
  const profile=path.join(root,'profile'),dataRoot=path.join(profile,'plugins/data/ttak-alias'),cwd=path.join(root,'work');
  const nativeFile=path.join(profile,'sessions/2026/09/14/rollout-'+session+'.jsonl');
  fs.mkdirSync(path.dirname(nativeFile),{recursive:true});fs.mkdirSync(dataRoot,{recursive:true});fs.mkdirSync(cwd);
  const rows=[{type:'session_meta',payload:{id:session,session_id:session,cli_version:'0.154.0',cwd}},
    {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'UNRELATED_LOADED_SKILL'}],internal_chat_message_metadata_passthrough:{turn_id:turn,content_item_kinds:['skills.selected_skill_instructions']}}},
    {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:request}],internal_chat_message_metadata_passthrough:{turn_id:turn,content_item_kinds:['user.text']}}}];
  const encode=()=>rows.map(JSON.stringify).join('\n')+'\n';fs.writeFileSync(nativeFile,encode(),{flag:'wx'});
  const options={root:dataRoot,enabled:true,now:1000000},event=(hook_event_name,extra={})=>({session_id:session,turn_id:turn,cwd,transcript_path:nativeFile,hook_event_name,...extra});
  const stateFile=path.join(dataRoot,'scenario-evidence-v1',textDigest(session)+'.json'),read=()=>JSON.parse(fs.readFileSync(stateFile));
  const handle=input=>handleEvent(input,options),invoke=connect();
  try{
    handle(event('UserPromptSubmit',{prompt:request}));
    const initial=read(),binding={attempt_id:initial.attempt.id,candidate_sha256:initial.attempt.candidate},args={...binding,request};
    const pre=event('PreToolUse',{tool_name:'mcp__ttak_scenario__explanation_prepare',tool_use_id:'prepare-181',tool_input:args});
    assert.deepEqual(handle(pre),{});const prepared=invoke('explanation_prepare',args);assert.equal(prepared.isError,undefined);
    assert.deepEqual(handle({...pre,hook_event_name:'PostToolUse',tool_response:prepared}),{});
    const plan=v.prepare(args),packet=plan.packets[0],agent='fact-child-181',spawn={hook_event_name:'PreToolUse',tool_name:'spawn_agent',tool_use_id:'spawn-181',
      tool_input:{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
    let attempt=read().attempt;
    attempt=v.observeAgent(attempt,spawn);attempt=v.observeAgent(attempt,{...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:agent}});
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:agent,agent_type:'default',model:'gpt-5.6-luna'});
    attempt=v.childPrompt(attempt,{agent_id:agent,turn_id:'fact-turn-181',prompt:packet.prompt},read().turn);
    const factInput={challenge:packet.challenge,verdict:'answered',answer,issues:[]},submission=v.resultSubmission(factInput,'fact');
    const sent={hook_event_name:'PreToolUse',agent_id:agent,turn_id:'fact-turn-181',tool_use_id:'submit-181',tool_input:factInput};
    attempt=v.observeSubmission(attempt,sent,'fact');attempt=v.observeSubmission(attempt,{...sent,hook_event_name:'PostToolUse',submission_payload:submission},'fact');
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:agent,last_assistant_message:submission.receipt_text});
    const readArgs={...binding,challenge:packet.challenge,receipt_text:submission.receipt_text,result:submission.result,include_next_step:true};
    const response=invoke('explanation_result',readArgs);assert.equal(response.isError,undefined);attempt=v.observeResultRead(attempt,readArgs,response.structuredContent);
    fs.writeFileSync(stateFile,JSON.stringify({...read(),attempt}));
    const input={attempt_id:'current',candidate_sha256:'current',request:'current',facts:[{id:packet.id,result:submission.result}],final_text:proposal,revision:0};
    const finalPre=event('PreToolUse',{tool_name:'mcp__ttak_scenario__explanation_check_final',tool_use_id:'final-181',tool_input:input});
    body({handle,event,read,options,invoke,binding,input,pre:finalPre,nativeFile,rows,encode,stateFile,source:{request,facts:input.facts}});
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}
test('normal Codex resolves current original with explicit actual facts before final compilation and keeps the final unapproved',()=>fixture(ctx=>{
  const allowed=ctx.handle(ctx.pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');
  const args=allowed.hookSpecificOutput.updatedInput;assert.equal(args.request,request);
  assert.deepEqual(args.facts,ctx.input.facts);assert.equal(ctx.input.request,'current');
  const result=ctx.invoke('explanation_check_final',args);assert.equal(result.isError,undefined);
  assert.equal(result.structuredContent.request_sha256,textDigest(request));assert.equal(result.structuredContent.complete_authorized,false);
  assert.deepEqual(ctx.handle({...ctx.pre,hook_event_name:'PostToolUse',tool_input:args,tool_response:result}),{});
  assert.equal(ctx.read().attempt.status,'pending');assert.equal(ctx.read().attempt.verification.final.phase,'planned');
  assert.equal(ctx.read().pending_tool,undefined);assert.equal(ctx.read().attempt.final_sha256,null);
}));
test('both-current references still use the already bound cache contract without rereading source files',()=>fixture(ctx=>{
  fs.unlinkSync(ctx.nativeFile);
  const pre={...ctx.pre,tool_input:{...ctx.input,facts:'current',final_text:{fact_answers:'current'}}},allowed=ctx.handle(pre);
  assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const args=allowed.hookSpecificOutput.updatedInput;
  assert.equal(args.request,'current');assert.equal(args.facts,'current');
  const result=ctx.invoke('explanation_check_final',args);assert.equal(result.isError,undefined);
  assert.deepEqual(result.structuredContent.source_facts,ctx.source);
  assert.deepEqual(ctx.handle({...pre,hook_event_name:'PostToolUse',tool_input:args,tool_response:result}),{});
  assert.equal(ctx.read().attempt.status,'pending');
}));
test('missing or changed native originals cannot be replaced by the literal word current',()=>{
  for(const mode of ['missing','changed','wrong-turn'])fixture(ctx=>{
    if(mode==='missing')fs.unlinkSync(ctx.nativeFile);
    else{
      if(mode==='changed')ctx.rows[2].payload.content[0].text+=' Changed.';
      else ctx.rows[2].payload.internal_chat_message_metadata_passthrough.turn_id=session;
      fs.writeFileSync(ctx.nativeFile,ctx.encode());
    }
    assert.equal(ctx.handle(ctx.pre).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(ctx.read().status,'unavailable');assert.equal(ctx.read().attempt.verification.final,null);
    assert.equal(ctx.handle({...ctx.pre,tool_use_id:'retry-181'}).hookSpecificOutput.permissionDecision,'deny');
  });
});
test('explicit final inputs with wrong original or fact bytes fail before registration instead of spending a mismatched packet',()=>{
  for(const mode of ['request','facts'])fixture(ctx=>{
    const input={...ctx.input,request};
    if(mode==='request')input.request+=' Changed.';
    else input.facts=[{...input.facts[0],result:{...input.facts[0].result,answer:'A changed factual account.'}}];
    assert.equal(ctx.handle({...ctx.pre,tool_input:input}).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(ctx.read().status,'unavailable');assert.equal(ctx.read().attempt.verification.final,null);
  });
});
test('current original resolution cannot change the active turn, candidate, timeout or failed-attempt boundary',()=>{
  for(const mode of ['turn','candidate','expired','unavailable'])fixture(ctx=>{
    let pre=ctx.pre;
    if(mode==='turn')pre={...pre,turn_id:session};
    if(mode==='candidate')pre={...pre,tool_input:{...ctx.input,attempt_id:ctx.binding.attempt_id,candidate_sha256:'b'.repeat(64)}};
    if(mode==='expired')ctx.options.now+=1800001;
    if(mode==='unavailable')fs.writeFileSync(ctx.stateFile,JSON.stringify({...ctx.read(),status:'unavailable',attempt:{...ctx.read().attempt,status:'unavailable'}}));
    assert.equal(ctx.handle(pre).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(ctx.read().attempt.verification.final,null);
  });
});
test('direct legacy compilation and the strict reference-pair library contract are unchanged',()=>fixture(ctx=>{
  const literal={...ctx.input,...ctx.binding};
  assert.equal(v.usesFinalReferences(literal),false);assert.equal(v.finalize(literal).request_sha256,textDigest('current'));
  assert.throws(()=>v.finalizeReferences(literal,ctx.source),/verification_final_reference_input/);
  assert.throws(()=>v.finalizeReferences({...literal,request,facts:'current'},ctx.source),/verification_final_reference_input/);
}));
