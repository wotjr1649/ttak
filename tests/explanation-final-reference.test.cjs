'use strict';
// Cache references are data transport. Only actual hook receipts authorize a final check.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const v=require('../scripts/explanation-verification.cjs'),{canonical,textDigest,digest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs'),{handleEvent}=require('../hooks/scenario-evidence.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs');
const binding={attempt_id:'12345678-1234-1234-1234-123456789150',candidate_sha256:'a'.repeat(64)};
const request='Explain the fictional Daro register. It stores one integer; reading returns it without change. Start at 3 and read twice.',draft='Both reads return 3 and leave 3 stored.';
const preparation=extra=>({...binding,request,draft,...extra}),selector=extra=>({...binding,request:'current',facts:'current',final_text:{fact_answers:'current'},revision:0,...extra});
function connection(host='claude'){
  const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'final-reference-test',version:'1'}}});dispatch({jsonrpc:'2.0',method:'notifications/initialized'});return dispatch;
}
const invoke=(d,name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
function factInput(packet){return {challenge:packet.challenge,verdict:'answered',answer:'The two reads return 3 and the stored value stays 3.',issues:[]};}
function compiledFact(args=preparation()){
  const plan=v.prepare(args),input=factInput(plan.packets[0]),result=v.resultSubmission(input,'fact').result;
  return {plan,input,result,source:{request:args.request,facts:[{id:plan.packets[0].id,result}]}};
}
test('both hosts advertise a draft-free first review and a separate literal-only correction',()=>{
  const claude=connection()({jsonrpc:'2.0',id:3,method:'tools/list'}).result.tools.find(t=>t.name==='explanation_check_final');
  assert.equal(claude.inputSchema.properties.request.const,'current');assert.equal(claude.inputSchema.properties.facts.const,'current');
  const codex=connection('codex')({jsonrpc:'2.0',id:3,method:'tools/list'}).result.tools.find(t=>t.name==='explanation_check_final');
  assert.deepEqual(codex.inputSchema,claude.inputSchema);
  assert.deepEqual(codex.inputSchema.required,['attempt_id','candidate_sha256','request','facts']);
  assert.equal(Object.hasOwn(codex.inputSchema.properties,'final_text'),false);
  assert.deepEqual(v.nativeAdapter('claude').explanation_check_final,{attempt_id:'current',candidate_sha256:'current',request:'current',facts:'current'});
  const correction=connection('codex')({jsonrpc:'2.0',id:3,method:'tools/list'}).result.tools.find(t=>t.name==='explanation_revise_final');
  assert.deepEqual(correction.inputSchema.properties.revision,{type:'integer',const:1});assert.equal(correction.inputSchema.properties.final_text.type,'string');
});
test('resolved references compile exactly the original and actual result objects, without repair or mutation',()=>{
  const {source}=compiledFact(),input=selector(),resolved=v.finalizeReferences(input,source);
  assert.deepEqual(resolved.args,{...input,...source});assert.deepEqual(resolved.payload,v.finalize(resolved.args));
  assert.deepEqual(v.exposeReferencedFinal(resolved,'claude'),{...v.exposeFinal(resolved.payload,'claude'),source_facts:source});
  assert.deepEqual(input,selector());assert.deepEqual(source,compiledFact().source);
  for(const bad of [{...input,request},{...input,facts:source.facts},{...input,revision:2},{...input,final_text:''},{...input,extra:true}])assert.throws(()=>v.finalizeReferences(bad,source));
  for(const bad of [{...source,extra:true},{request,facts:[]},{request:request+' Changed.',facts:[{...source.facts[0],result:{...source.facts[0].result,verdict:'unresolved'}}]}])assert.throws(()=>v.finalizeReferences(input,bad));
  let invoked=0;const accessor={...input};Object.defineProperty(accessor,'final_text',{enumerable:true,get(){invoked++;return draft;}});assert.throws(()=>v.finalizeReferences(accessor,source));assert.equal(invoked,0);
  const factsAccessor={...input};Object.defineProperty(factsAccessor,'facts',{enumerable:true,get(){invoked++;return 'current';}});assert.throws(()=>v.usesFinalReferences(factsAccessor));assert.equal(invoked,0);
  const literalCurrent={...input,facts:source.facts};assert.equal(v.usesFinalReferences(literalCurrent),false);
  assert.equal(v.finalize(literalCurrent).request_sha256,textDigest('current'));
});
test('the normal connection requires its own original and each actual cached fact, rejects duplicates and cross-candidate references',()=>{
  const d=connection(),fact=compiledFact();assert.equal(invoke(d,'explanation_check_final',selector()).isError,true);
  assert.equal(invoke(d,'explanation_prepare',preparation()).isError,undefined);
  assert.equal(invoke(d,'explanation_check_final',selector()).isError,true);
  assert.equal(invoke(d,'explanation_fact_result',fact.input).isError,undefined);
  assert.equal(invoke(d,'explanation_fact_result',fact.input).isError,true);
  assert.equal(invoke(d,'explanation_check_final',selector({candidate_sha256:'b'.repeat(64)})).isError,true);
  const final=invoke(d,'explanation_check_final',selector());assert.equal(final.isError,undefined);
  assert.deepEqual(final.structuredContent,v.exposeReferencedFinal(v.finalizeReferences(selector(),fact.source),'claude'));
  assert.equal(invoke(d,'explanation_check_final',selector()).isError,true);
  assert.equal(invoke(connection(),'explanation_check_final',selector()).isError,true);
});
test('parent fact-cache imports preserve packet/candidate/result identity and reject duplicate result reads',()=>{
  for(const mode of ['normal','candidate','challenge','conflicting-result','duplicate']){
    const parent=connection('codex'),child=connection('codex'),args={...binding,request},plan=v.prepare(args),packet=plan.packets[0];
    assert.equal(invoke(parent,'explanation_prepare',args).isError,undefined);
    const input=factInput(packet),submitted=invoke(child,'explanation_fact_result',input).structuredContent;
    const readArgs={...binding,challenge:packet.challenge,result:submitted.result,receipt_text:submitted.receipt_text};
    if(mode==='candidate')readArgs.candidate_sha256='b'.repeat(64);
    if(mode==='challenge'){
      const wrong=v.resultSubmission({...input,challenge:'b'.repeat(64)},'fact');Object.assign(readArgs,{challenge:wrong.result.challenge,result:wrong.result,receipt_text:wrong.receipt_text});
    }
    if(mode==='conflicting-result'){
      assert.equal(invoke(parent,'explanation_fact_result',input).isError,undefined);
      const changed=v.resultSubmission({...input,answer:'A changed factual account.'},'fact');Object.assign(readArgs,{result:changed.result,receipt_text:changed.receipt_text});
    }
    const read=invoke(parent,'explanation_result',readArgs);
    if(['candidate','challenge','conflicting-result'].includes(mode)){assert.equal(read.isError,true);continue;}
    assert.equal(read.isError,undefined);assert.deepEqual(read.structuredContent,v.resultRead(readArgs));
    if(mode==='duplicate'){assert.equal(invoke(parent,'explanation_result',readArgs).isError,true);continue;}
    const final=invoke(parent,'explanation_check_final',selector());assert.equal(final.isError,undefined);
    assert.deepEqual(final.structuredContent.source_facts,{request,facts:[{id:packet.id,result:submitted.result}]});
    assert.equal(final.structuredContent.complete_authorized,false);
  }
});
test('expired or absent parent caches cannot turn a disconnected child result into reusable final facts',()=>{
  const previous=Date.now;let clock=1000000;Date.now=()=>clock;
  try{
    const parent=connection('codex'),child=connection('codex'),args={...binding,request},plan=v.prepare(args),packet=plan.packets[0];
    invoke(parent,'explanation_prepare',args);const submitted=invoke(child,'explanation_fact_result',factInput(packet)).structuredContent;
    const readArgs={...binding,challenge:packet.challenge,result:submitted.result,receipt_text:submitted.receipt_text};
    clock+=1800001;assert.equal(invoke(parent,'explanation_result',readArgs).isError,true);
    const fresh=connection('codex');assert.equal(invoke(fresh,'explanation_result',readArgs).isError,undefined);
    assert.equal(invoke(fresh,'explanation_check_final',selector()).isError,true);
  }finally{Date.now=previous;}
});
function fixture(body,{nativeFact=true,original=request,finalText={fact_answers:'current'},factualAnswer=null,explicitFinal=false}={}){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'final-reference-test-')),options={root,enabled:true,now:1000000};
  const base={session_id:'final-reference-parent',turn_id:'parent-turn'},event=(hook_event_name,extra={})=>({...base,hook_event_name,...extra}),handle=e=>handleEvent(e,options);
  const file=path.join(root,'scenario-evidence-v1',textDigest(base.session_id)+'.json'),read=()=>JSON.parse(fs.readFileSync(file)),dispatch=connection(),prefix='mcp__plugin_ttak_ttak_scenario__';let number=0;
  const call=(name,args,actor={})=>{const pre=event('PreToolUse',{tool_name:prefix+name,tool_use_id:'reference-call-'+(++number),tool_input:args,...actor}),allowed=handle(pre);
    const bound=allowed.hookSpecificOutput?.updatedInput??args;assert.notEqual(allowed.hookSpecificOutput?.permissionDecision,'deny');
    const response=invoke(dispatch,name,bound);assert.equal(response.isError,undefined);assert.deepEqual(handle({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});return response.structuredContent;};
  function receipt(packet,kind,fields={},inline=false){
    const agent=kind+'-reference-agent-'+packet.id,spawn=event('PreToolUse',{tool_name:'Agent',tool_use_id:'reference-'+packet.id+'-spawn',tool_input:{description:'Verify one packet',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}});
    assert.deepEqual(handle(spawn),{});assert.equal(handle(event('SubagentStart',{agent_id:agent,agent_type:v.agentType,model:'claude-haiku-4-5-20251001'})).hookSpecificOutput.hookEventName,'SubagentStart');
    const actor={agent_id:agent,turn_id:agent+'-turn'};assert.deepEqual(call('explanation_packet',{challenge:packet.challenge},actor),v.packetBody(packet));
    let input=kind==='fact'?{...factInput(packet),...(factualAnswer?{answer:factualAnswer}:{})}:{challenge:packet.challenge,final_decision:'approve_explanation',...reviewChecks(),issues:[],checked_questions:['REQUEST_FACTS'],...fields};
    if(inline){
      const {requirement_review,claim_review,fact_review,issues,...rest}=input;
      input={...rest,...Object.fromEntries(Object.entries({requirement_review,claim_review,fact_review}).flatMap(([group,checks])=>
        Object.entries(checks).map(([key,value])=>[group==='fact_review'?'fact_'+key:key,value==='pass'?value:value.map(index=>issues[index])])))};
    }
    const submitted=call('explanation_'+kind+'_result',input,actor);assert.deepEqual(handle(event('SubagentStop',{...actor,last_assistant_message:submitted.final_text})),{});
    assert.deepEqual(handle({...spawn,hook_event_name:'PostToolUse',tool_response:[{type:'text',text:submitted.final_text+'\nagentId: '+agent+' (for resuming)'}]}),{});return submitted.result;
  }
  try{
    handle(event('UserPromptSubmit',{prompt:original}));const args=preparation({attempt_id:read().attempt.id,candidate_sha256:read().attempt.candidate,request:original}),plan=v.prepare(args);
    assert.deepEqual(call('explanation_prepare',args),v.exposePlan(plan,'claude'));
    const actual=nativeFact?receipt(plan.packets[0],'fact'):invoke(dispatch,'explanation_fact_result',factInput(plan.packets[0])).structuredContent.result;
    const input=selector({attempt_id:'current',candidate_sha256:'current',final_text:finalText,
      ...(explicitFinal?{request:original,facts:[{id:plan.packets[0].id,result:actual}]}:{})}),pre=event('PreToolUse',{tool_name:prefix+'explanation_check_final',tool_use_id:'reference-final',tool_input:input});
    body({read,handle,event,dispatch,pre,args,plan,actual,receipt,options});
  }finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}
test('an independent complete assertion cannot override a computed cross-read/write contradiction at Stop',()=>{
  const scenario={initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
    {id:'T1',guard:{cells:['B'],at_least:1},writes:{A:false}},{id:'T2',guard:{cells:['A'],at_least:1},writes:{B:false}}]};
  for(const finalText of ['No row is both read and written by different transactions.','T1 reads B, which T2 writes. T2 reads A, which T1 writes.'])fixture(ctx=>{
    const bound=ctx.handle(ctx.pre).hookSpecificOutput.updatedInput,response=invoke(ctx.dispatch,'explanation_check_final',bound);
    assert.deepEqual(ctx.handle({...ctx.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});
    const resolved=v.finalize(bound);ctx.receipt(resolved.packet,'final');
    assert.equal(ctx.read().attempt.status,'complete');
    const stop=require('../hooks/scenario-stop.cjs').handle(ctx.event('Stop',{last_assistant_message:finalText,stop_hook_active:false}),true,ctx.options);
    if(finalText.startsWith('No row')){assert.equal(stop.continue,false);assert.equal(ctx.read().status,'unavailable');assert.equal(ctx.read().attempt.status,'unavailable');}
    else assert.deepEqual(stop,{});
  },{original:'Explain the supplied finite model.\n'+JSON.stringify({scenario}),finalText,explicitFinal:true,
    factualAnswer:{computed_models:[{model_sha256:digest(scenario),model:scenario}],request_context:'A and B are the Boolean state cells; T1 and T2 are the modeled transactions. The invariant requires at least one true cell.',additional_sources:[],language:'en'}});
});
test('a cached assertion without the native fact receipt cannot authorize even the referenced final call',()=>fixture(ctx=>{
  assert.equal(ctx.handle(ctx.pre).hookSpecificOutput.permissionDecision,'deny');assert.equal(ctx.read().status,'unavailable');
},{nativeFact:false}));

test('four-field first review and separate correction retain native Pre/Post receipts and the one-revision limit',()=>fixture(ctx=>{
  const invokeBound=(name,input,id)=>{
    const pre=ctx.event('PreToolUse',{tool_name:'mcp__plugin_ttak_ttak_scenario__'+name,tool_use_id:id,tool_input:input});
    const allowed=ctx.handle(pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');
    const args=allowed.hookSpecificOutput.updatedInput??input,response=invoke(ctx.dispatch,name,args);assert.equal(response.isError,undefined);
    assert.deepEqual(ctx.handle({...pre,hook_event_name:'PostToolUse',tool_input:args,tool_response:response}),{});
    return v.finalizeReferences(args,response.structuredContent.source_facts).payload;
  };
  const first={attempt_id:'current',candidate_sha256:'current',request:'current',facts:'current'};
  const initial=invokeBound('explanation_check_final',first,'initial-short');
  const data=JSON.parse(initial.packet.prompt.slice(initial.packet.prompt.indexOf('\n')+1)).data;
  assert.equal(data.final_text,ctx.actual.answer);assert.equal(initial.revision,0);assert.equal(ctx.read().attempt.status,'pending');
  const checks=reviewChecks();checks.requirement_review.reader_format=[0];
  ctx.receipt(initial.packet,'final',{final_decision:'revise_explanation',...checks,
    issues:[{quote:ctx.actual.answer,reason:'The request requires two sentences.',evidence_needed:'Use two sentences while preserving the values.'}]},true);
  const finalText='Both reads return 3. The stored value remains 3.';
  const revised=invokeBound('explanation_revise_final',{...first,final_text:finalText,revision:1},'correction-short');
  assert.notEqual(revised.packet.challenge,initial.packet.challenge);ctx.receipt(revised.packet,'final',{},true);
  assert.equal(ctx.read().attempt.status,'complete');assert.equal(ctx.read().attempt.final_sha256,textDigest(finalText));
  assert.equal(invoke(ctx.dispatch,'explanation_revise_final',{...first,attempt_id:ctx.args.attempt_id,candidate_sha256:ctx.args.candidate_sha256,final_text:'Another draft.',revision:2}).isError,true);
},{original:request+' Use exactly two sentences.'}));

test('correction cannot replace a missing initial native review and is covered by both native hook matchers',()=>fixture(ctx=>{
  const definitions=require('../hooks/hooks.json').hooks;
  for(const event of ['PreToolUse','PostToolUse'])for(const prefix of ['mcp__ttak_scenario__','mcp__plugin_ttak_ttak_scenario__']){
    const match=new RegExp(definitions[event][0].matcher);assert.equal(match.test(prefix+'explanation_revise_final'),true);
    assert.equal(match.test(prefix+'explanation_revise_final_extra'),false);
  }
  const denied=ctx.handle(ctx.event('PreToolUse',{tool_name:'mcp__plugin_ttak_ttak_scenario__explanation_revise_final',tool_use_id:'premature-correction',
    tool_input:{attempt_id:'current',candidate_sha256:'current',request:'current',facts:'current',final_text:draft,revision:1}}));
  assert.equal(denied.hookSpecificOutput.permissionDecision,'deny');assert.equal(ctx.read().status,'unavailable');
}));
test('normal Pre/Post resolves references and still requires a fresh exact-final native decision',()=>fixture(ctx=>{
  const allowed=ctx.handle(ctx.pre);assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const bound=allowed.hookSpecificOutput.updatedInput;
  assert.equal(bound.request,'current');assert.equal(bound.facts,'current');const response=invoke(ctx.dispatch,'explanation_check_final',bound);assert.equal(response.isError,undefined);
  assert.deepEqual(response.structuredContent.source_facts,{request,facts:[{id:'REQUEST_FACTS',result:ctx.actual}]});
  assert.deepEqual(ctx.handle({...ctx.pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response}),{});assert.equal(ctx.read().attempt.status,'pending');
  const final=v.finalizeReferences(bound,response.structuredContent.source_facts);ctx.receipt(final.payload.packet,'final');assert.equal(ctx.read().attempt.status,'complete');
  assert.equal(ctx.read().attempt.final_sha256,textDigest(ctx.actual.answer));assert.doesNotMatch(canonical(ctx.read()),/Daro|stored value|source_facts/);
}));
test('changed resolved original, fact bytes, selector bytes or pending final text fail closed',()=>{
  for(const mode of ['original','fact','post-text','mixed'])fixture(ctx=>{
    const pre=mode==='mixed'?{...ctx.pre,tool_input:{...ctx.pre.tool_input,request}}:ctx.pre,allowed=ctx.handle(pre);
    if(mode==='mixed'){assert.equal(allowed.hookSpecificOutput.permissionDecision,'deny');return;}
    const bound=allowed.hookSpecificOutput.updatedInput,response=invoke(ctx.dispatch,'explanation_check_final',bound);assert.equal(response.isError,undefined);
    if(mode==='original')response.structuredContent.source_facts.request+=' Changed.';
    if(mode==='fact')response.structuredContent.source_facts.facts[0].result.answer='A changed but well-formed factual result.';
    if(mode!=='post-text'){
      const compiled=v.finalizeReferences(bound,response.structuredContent.source_facts),payload=v.exposeReferencedFinal(compiled,'claude');response.structuredContent=payload;response.content=[{type:'text',text:JSON.stringify(payload)}];
    }
    const post=ctx.handle({...pre,hook_event_name:'PostToolUse',tool_input:mode==='post-text'?{...bound,final_text:draft+' '}:bound,tool_response:response});
    assert.match(post.systemMessage,/could not record/);assert.equal(ctx.read().status,'unavailable');assert.equal(ctx.handle(ctx.pre).hookSpecificOutput.permissionDecision,'deny');
  });
});
