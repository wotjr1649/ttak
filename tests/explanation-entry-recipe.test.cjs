'use strict';
// Execute the published entry against real MCP compilers and a synthetic native
// transport. These checks establish wiring and failure boundaries, not model quality.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111174',candidate_sha256:'a'.repeat(64)};
const request='Explain the fictional Nori register in two sentences. It starts at7; reading returns the stored value without changing it. Read twice.';
const answer='Both reads return7. The stored value remains7.';
function connect(host='codex'){
  const d=createDispatcher({host});let id=0;
  d({jsonrpc:'2.0',id:++id,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'entry-recipe',version:'1'}}});
  d({jsonrpc:'2.0',method:'notifications/initialized'});
  return {list:()=>d({jsonrpc:'2.0',id:++id,method:'tools/list',params:{}}).result.tools,
    invoke:(name,args)=>d({jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:args}}).result};
}
function source(){
  const tool=connect().list().find(t=>t.name==='explanation_prepare');
  const recipes=[...tool.description.matchAll(/```javascript\n([\s\S]*?)\n```/g)];
  assert.equal(recipes.length,1,'normal tools/list must expose one complete static entry');return recipes[0][1];
}
const execute=(code,h)=>Object.getPrototypeOf(async function(){}).constructor('tools','load','store','text',code)(h.tools,h.load,h.store,h.text);
function fixture({original=request,factualAnswer=answer,verdict='answered',mutatePrepare,mutateDispatch,mode}={}){
  const parent=connect(),child=connect(),plan=v.prepare({...binding,request:original}),packet=plan.packets[0];
  const steps=[],printed=[],state={};let reply,closed=false;
  const tools={
    mcp__ttak_scenario__explanation_prepare:async args=>{
      steps.push('prepare');assert.deepEqual(args,{attempt_id:'current',candidate_sha256:'current',request:'current'});
      if(mode==='prepare-throw')throw new Error('Preparation failed');
      const value=parent.invoke('explanation_prepare',{...binding,request:original});assert.equal(value.isError,undefined);
      state.prepared=structuredClone(value);return mutatePrepare?mutatePrepare(value):value;
    },
    mcp__ttak_scenario__explanation_dispatch:async args=>{
      steps.push('dispatch');assert.deepEqual(args,{attempt_id:'current',candidate_sha256:'current',challenge:'current'});
      if(mode==='dispatch-throw')throw new Error('Dispatch failed');
      const value=parent.invoke('explanation_dispatch',{...binding,challenge:packet.challenge});assert.equal(value.isError,undefined);
      return mutateDispatch?mutateDispatch(value):value;
    },
    multi_agent_v1__spawn_agent:async args=>{
      steps.push('spawn');assert.deepEqual(args,{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false});
      if(mode==='spawn-throw')throw new Error('Spawn failed');return {agent_id:'entry-child'};
    },
    multi_agent_v1__wait_agent:async args=>{
      steps.push('wait');assert.deepEqual(args,{targets:['entry-child'],timeout_ms:60000});
      if(mode==='wait-throw')throw new Error('Wait failed');
      if(mode==='wait-timeout'){if(steps.filter(s=>s==='wait').length>1)throw new Error('Outer execution budget exhausted');return {timed_out:true,status:{}};}
      reply=child.invoke('explanation_fact_result',{challenge:packet.challenge,verdict,answer:factualAnswer,
        issues:verdict==='answered'?[]:[{quote:'Synthetic unmet requirement',reason:'Missing a necessary observation.',evidence_needed:'The actual observation.'}]}).structuredContent;
      assert.ok(reply);return {timed_out:false,status:{'entry-child':{completed:mode==='legacy-return'?reply.final_text:reply.receipt_text}}};
    },
    multi_agent_v1__close_agent:async args=>{
      steps.push('close');assert.deepEqual(args,{target:'entry-child'});closed=true;if(mode==='close-throw')throw new Error('Close failed');return {};
    },
    mcp__ttak_scenario__explanation_result:async args=>{
      steps.push('read');assert.equal(closed,true);assert.deepEqual(args,{...binding,challenge:packet.challenge,receipt_text:reply.receipt_text,include_next_step:true});
      if(mode==='read-throw')throw new Error('Read failed');
      const value=parent.invoke('explanation_result',{...args,result:reply.result});assert.equal(value.isError,undefined);
      if(mode==='read-mismatch')value.structuredContent.result_sha256='f'.repeat(64);
      if(mode==='missing-next')delete value.structuredContent.next_step;return value;
    }
  };
  return {tools,steps,printed,state,plan,parent,load:()=>{throw new Error('Entry needs no retained data');},
    store:(key,value)=>{assert.equal(key,'ttak-verification');steps.push('store');state.held=structuredClone(value);},
    text:value=>{steps.push('print');printed.push(structuredClone(value));}};
}
test('normal metadata entry prepares and reads its first independent fact in one call without reconstructing the packet',async()=>{
  const h=fixture();await execute(source(),h);
  assert.deepEqual(h.steps,['prepare','dispatch','spawn','wait','close','read','store','print']);
  assert.equal(h.printed.length,1);assert.equal(h.printed[0].result.answer,answer);assert.equal(h.printed[0].result.verdict,'answered');
  assert.equal(h.printed[0].next_step.stage,'final_proposal');assert.equal(h.printed[0].delivery,undefined);
  assert.deepEqual(h.state.held,{...binding,previous:{id:'REQUEST_FACTS',result:h.printed[0].result}});
  const final=h.parent.invoke('explanation_check_final',{...binding,request:'current',facts:'current',final_text:answer,revision:0});
  assert.equal(final.isError,undefined);assert.deepEqual(final.structuredContent.source_facts,{request,facts:[h.state.held.previous]});
  assert.equal(final.structuredContent.complete_authorized,false);
});
test('model evidence reaches the fresh verifier and its actual fact returns without a second preparation',async()=>{
  const model={initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
    {id:'T1',guard:{cells:['B'],at_least:1},writes:{A:false}},{id:'T2',guard:{cells:['A'],at_least:1},writes:{B:false}}]};
  const original='Explain this finite example and a remedy.\n'+JSON.stringify(model);
  const factualAnswer={computed_models:[{model_sha256:require('../scripts/verification-packet.cjs').digest(model),model}],
    request_context:'A and B are the abstract state cells read and written by T1 and T2.',additional_sources:[],language:'en'};
  const h=fixture({original,factualAnswer});assert.ok(h.plan.model_evidence.length);await execute(source(),h);
  assert.deepEqual(h.steps,['prepare','dispatch','spawn','wait','close','read','store','print']);
  const data=JSON.parse(h.plan.packets[0].prompt.slice(h.plan.packets[0].prompt.indexOf('\n')+1)).data;
  assert.equal(data.original_request,original);assert.deepEqual(data.model_evidence,require('../scripts/explanation-source-model.cjs').verifierModels(original));
  assert.equal(data.computed_fact_accounts.length,1);
  assert.equal(h.printed[0].result.answer,require('../scripts/explanation-source-model.cjs').compileModelAnswer(factualAnswer).answer);
  assert.equal(h.printed[0].next_step.stage,'final_proposal');assert.equal(h.printed[0].delivery_status,'unverified');
  assert.equal(h.printed[0].delivery,undefined);assert.equal(h.state.held.previous.result.kind,'fact');
});
test('unresolved actual fact is retained as unresolved and exposes no final-proposal or delivery recipe',async()=>{
  const h=fixture({verdict:'unresolved'});await execute(source(),h);
  assert.equal(h.printed[0].result.verdict,'unresolved');assert.equal(h.printed[0].next_step.stage,'withhold');
  assert.equal(h.printed[0].next_step.code,undefined);assert.equal(h.printed[0].delivery,undefined);
  assert.deepEqual(h.steps,['prepare','dispatch','spawn','wait','close','read','store','print']);
});
test('invalid or non-request-facts preparation never dispatches and cannot be treated as approval',async()=>{
  const changes=[r=>{r.isError=true;},r=>{delete r.structuredContent;},
    ...['preparation','protocol','complete_authorized','attempt_id','candidate_sha256','packets','model_evidence'].map(key=>r=>{r.structuredContent[key]=null;}),
    r=>{r.structuredContent.packets=[];},r=>{r.structuredContent.packets.push(r.structuredContent.packets[0]);},
    r=>{r.structuredContent.packets[0].kind='final';},r=>{r.structuredContent.packets[0].id='another-packet';},
    r=>{delete r.structuredContent.packets[0].packet_sha256;},r=>{r.structuredContent.complete_authorized=true;}];
  for(const change of changes){const h=fixture({mutatePrepare:r=>{change(r);return r;}});
    await assert.rejects(execute(source(),h));assert.deepEqual(h.steps,['prepare']);assert.equal(h.state.held,undefined);}
});
test('dispatch must match the prepared binding and exact packet before native launch',async()=>{
  const changes=[r=>{r.isError=true;},r=>{delete r.structuredContent;},
    ...['attempt_id','candidate_sha256','packet_id','packet_sha256','protocol'].map(key=>r=>{r.structuredContent[key]='changed';}),
    r=>{r.structuredContent.complete_authorized=true;},r=>{delete r.structuredContent.native_spawn;},
    ...['message','model','reasoning_effort','fork_context'].map(key=>r=>{r.structuredContent.native_spawn[key]=null;})];
  for(const change of changes){const h=fixture({mutateDispatch:r=>{change(r);return r;}});
    await assert.rejects(execute(source(),h));assert.deepEqual(h.steps,['prepare','dispatch']);assert.equal(h.state.held,undefined);}
});
test('entry failures neither retry nor print or retain an approval and always close a successfully spawned verifier',async()=>{
  for(const mode of ['prepare-throw','dispatch-throw','spawn-throw','wait-throw','wait-timeout','close-throw','read-throw','read-mismatch','missing-next','legacy-return']){
    const h=fixture({mode});await assert.rejects(execute(source(),h),undefined,mode);
    assert.equal(h.steps.includes('print'),false,mode);assert.equal(h.steps.includes('store'),false,mode);
    assert.equal(h.steps.filter(x=>x==='spawn').length,['prepare-throw','dispatch-throw'].includes(mode)?0:1,mode);
    assert.equal(h.steps.filter(x=>x==='close').length,['prepare-throw','dispatch-throw','spawn-throw'].includes(mode)?0:1,mode);
    assert.equal(h.state.held,undefined,mode);
  }
});
test('entry remains a Codex metadata recipe without a new tool, field, legacy compiler recipe or Claude workflow',()=>{
  const codex=connect().list(),claude=connect('claude').list(),tool=codex.find(t=>t.name==='explanation_prepare');source();
  assert.deepEqual(Object.keys(tool).sort(),Object.keys(v.prepareTool).sort());
  assert.deepEqual(tool.inputSchema,v.prepareToolFor('claude').inputSchema);
  assert.equal(claude.find(t=>t.name==='explanation_prepare').description.includes('```javascript'),false);
  assert.equal(v.prepare({...binding,request}).native_dispatch.spawn_agent_code.includes('explanation_prepare'),false);
  assert.equal(v.nativeAdapter('codex').spawn_agent_code.includes('explanation_prepare'),false);
  assert.equal(codex.length,claude.length);
});
test('native-waiting normal recipes carry one first-line yield directive without changing the native wait or other hosts',()=>{
  const adapter=v.nativeAdapter('codex'),directive='// @exec: {"yield_time_ms": 60000}';
  const withheld={protocol:v.protocol,kind:'final',challenge:'b'.repeat(64),verdict:'withheld',
    answer:'{"requirement_review":"Defect","claim_review":"Defect","fact_review":"Checked"}',
    issues:[{quote:'A synthetic defect',reason:'A correction is needed.',evidence_needed:'Corrected literal.'}],checked_questions:['REQUEST_FACTS']};
  const correction=v.resultNextStep(withheld,{remaining_facts:0,failed_facts:0,revision:0}).code;
  for(const code of [source(),adapter.spawn_agent_code,adapter.final_draft_code,correction]){
    assert.equal(code.split('\n')[0],directive);assert.equal(code.indexOf(directive,1),-1);assert.match(code,/timeout_ms:60000/);
    assert.doesNotThrow(()=>Object.getPrototypeOf(async function(){}).constructor('tools','load','store','text',code));
  }
  assert.equal(adapter.next_packet_code.includes('@exec:'),false);
  assert.equal(v.prepare({...binding,request}).native_dispatch.spawn_agent_code.includes('@exec:'),false);
  for(const host of ['claude','codex'])for(const purpose of ['request_assessment','withholding'])assert.equal(JSON.stringify(v.nativeAdapter(host,purpose)).includes('@exec:'),false);
  assert.equal(JSON.stringify(v.nativeAdapter('claude')).includes('@exec:'),false);
});
module.exports={entryFixture:fixture,executeEntry:execute};
