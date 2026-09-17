'use strict';
// Execute the whole published recipe. Synthetic verifiers establish no native latency or semantic claim.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {recipeTransport}=require('./helpers/final-recipe.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111170',candidate_sha256:'a'.repeat(64)};
const request='Explain a fictional register whose read returns7 without changing7.',answer='A read returns7. It leaves7 stored.';
function fixture(options={}){
  const d=createDispatcher({host:'codex'});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'final-recipe',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});
  const invoke=(name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
  const plan=v.prepare({...binding,request}),prepared=invoke('explanation_prepare',{...binding,request}).structuredContent;
  const reply=invoke('explanation_fact_result',{challenge:plan.packets[0].challenge,verdict:'answered',answer:options.factAnswer??answer,issues:[]}).structuredContent,fact=reply.result;
  const read=invoke('explanation_result',{...binding,challenge:fact.challenge,result:fact,receipt_text:reply.receipt_text,include_next_step:true});assert.equal(read.isError,undefined);
  const initial={...binding,request,facts:[{id:'REQUEST_FACTS',result:fact}]},h=recipeTransport(invoke,initial,options);h.initial=initial;h.nextStep=read.structuredContent.next_step;h.invoke=invoke;h.prepared=prepared;return h;
}
const execute=(source,h)=>Object.getPrototypeOf(async function(){}).constructor('tools','load','store','text',source)(h.tools,h.load,h.store,h.text);
for(const mode of ['source','literal','revision'])test('the '+mode+' route registers and independently reviews its exact body',async()=>{
  let h=fixture(),source=h.nextStep.code;const adapter=v.nativeAdapter('codex');assert.equal(source,adapter.final_draft_code);
  if(mode==='literal'){
    await h.tools.mcp__ttak_scenario__explanation_check_final({...binding,request,facts:h.initial.facts,final_text:answer,revision:0});
    source=adapter.spawn_agent_code;
  }else if(mode==='revision'){
    const first=fixture({mode:'withheld',factAnswer:answer+' Additional detail.'});await execute(first.nextStep.code,first);
    source=first.printed[0].next_step.code.replace('const final_text = "";','const final_text = '+JSON.stringify(answer)+';');
    h=recipeTransport(first.invoke,first.held);h.initial=first.initial;
  }
  await execute(source,h);assert.deepEqual(h.steps,['register','dispatch','spawn','wait','close','read','store','print']);
  assert.deepEqual(h.registration.input.final_text,mode==='source'?undefined:answer);
  assert.equal(h.registration.response.structuredContent.revision,mode==='revision'?1:0);
  if(mode==='literal')assert.deepEqual({request:h.registration.input.request,facts:h.registration.input.facts},{request,facts:h.initial.facts});
  else{
    assert.equal(h.registration.input.request,'current');assert.equal(h.registration.input.facts,'current');
    assert.deepEqual(h.registration.response.structuredContent.source_facts,{request,facts:h.initial.facts});
  }
  assert.equal(h.printed.length,1);assert.equal(h.printed[0].result.verdict,'complete');assert.equal(h.printed[0].delivery.final_text,answer);
  assert.equal(h.printed[0].next_step.stage,'deliver');
  assert.deepEqual(h.held,{...binding,previous:{id:mode==='revision'?'FINAL1':'FINAL0',result:h.printed[0].result}});
});
test('the joined final recipe reuses its checked dispatch lifecycle and prints a withheld result without approval',async()=>{
  const h=fixture({mode:'withheld'}),adapter=v.nativeAdapter('codex');
  assert.ok(adapter.final_draft_code.endsWith(adapter.spawn_agent_code.slice(adapter.spawn_agent_code.indexOf('\n')+1)));
  await execute(adapter.final_draft_code,h);assert.deepEqual(h.steps,['register','dispatch','spawn','wait','close','read','store','print']);
  assert.equal(h.printed[0].result.verdict,'withheld');assert.equal(h.printed[0].delivery,undefined);
  assert.equal(h.printed[0].next_step.stage,'correct_final');
  assert.equal(h.held.previous.result.verdict,'withheld');assert.equal(h.registration.response.structuredContent.complete_authorized,false);
});

test('a polling timeout does not cancel a verifier that finishes on the next wait',async()=>{
  const h=fixture({mode:'wait-once'});
  await execute(v.nativeAdapter('codex').final_draft_code,h);
  assert.deepEqual(h.steps,['register','dispatch','spawn','wait','wait','close','read','store','print']);
  assert.equal(h.printed[0].delivery_status,'approved_explanation');
});
test('registration rejection never dispatches and wait/close/read failures never print or retain approval',async()=>{
  for(const mode of ['register-rejected','register-throw','wait-timeout','wait-throw','close-throw','read-mismatch','missing-next','legacy-return',
    'wrong-result-challenge','wrong-result-kind','wrong-delivery-text','wrong-delivery-scope','missing-delivery']){
    const h=fixture({mode});await assert.rejects(execute(v.nativeAdapter('codex').final_draft_code,h),undefined,mode);
    assert.equal(h.steps.includes('print'),false,mode);assert.equal(h.steps.includes('store'),false,mode);assert.equal(h.held.final,undefined,mode);
    assert.deepEqual(h.held,{...h.initial,previous:h.initial.facts.at(-1)},mode);
    if(mode.startsWith('register'))assert.deepEqual(h.steps,['register']);
    else assert.equal(h.steps.filter(x=>x==='close').length,1);
  }
});
test('a malformed or differently bound registration response cannot trigger the joined verifier',async()=>{
  for(const mode of ['missing','kind','approval','attempt','candidate','revision']){
    const h=fixture(),register=h.tools.mcp__ttak_scenario__explanation_check_final;
    h.tools.mcp__ttak_scenario__explanation_check_final=async args=>{
      const response=await register(args),payload=response.structuredContent;
      if(mode==='missing')delete response.structuredContent;
      if(mode==='kind')payload.packet.kind='fact';
      if(mode==='approval')payload.complete_authorized=true;
      if(mode==='attempt')payload.attempt_id='another-attempt';
      if(mode==='candidate')payload.candidate_sha256='c'.repeat(64);
      if(mode==='revision')payload.revision=1;
      return response;
    };
    await assert.rejects(execute(v.nativeAdapter('codex').final_draft_code,h),/final registration failed/);
    assert.deepEqual(h.steps,['register']);assert.equal(h.held.final,undefined);
  }
});
test('normal sequential recipes retain the latest fact while the actual parent cache preserves every fact in plan order',async()=>{
  // Separate in-process MCP connections and synthetic native transports; no model-quality claim.
  const reference='A Nori register stores one integer. Reading returns the stored integer without changing it.';
  const original='Explain the fictional Nori register. Given reference: '+reference;
  const args={...binding,request:original,blocks:[{text:'Reading returns the value and preserves it.',question_ids:['Q1','Q2']}],
    questions:[{id:'Q1',kind:'mechanism',target:'Nori register reading',conditions:'Use the supplied fictional definition.',source_ids:['S1']},
      {id:'Q2',kind:'relationship',target:'Stored value before and after reading',conditions:'Use the stated definition.',source_ids:['S1']}],
    sources:[{id:'S1',version:'supplied definition',text:reference}]};
  const connect=()=>{const d=createDispatcher({host:'codex'});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'sequential-recipe',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});return d;};
  const parent=connect(),child=connect(),invoke=(d,name,input)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:input}}).result;
  const plan=v.prepare(args);assert.equal(invoke(parent,'explanation_prepare',args).isError,undefined);
  let packet=plan.packets[0],held,reply;const results=[],prints=[],steps=[];
  const tools={mcp__ttak_scenario__explanation_dispatch:async input=>{assert.deepEqual(input,{attempt_id:'current',candidate_sha256:'current',challenge:'current'});return invoke(parent,'explanation_dispatch',{...binding,challenge:packet.challenge});},
    multi_agent_v1__spawn_agent:async input=>{assert.deepEqual(input,{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false});steps.push('spawn-'+packet.id);return {agent_id:packet.id+'-child'};},
    multi_agent_v1__wait_agent:async input=>{assert.deepEqual(input,{targets:[packet.id+'-child'],timeout_ms:60000});reply=invoke(child,'explanation_fact_result',{challenge:packet.challenge,verdict:'answered',answer:'The supplied operation returns the stored value without changing it.',issues:[]}).structuredContent;return {timed_out:false,status:{[packet.id+'-child']:{completed:reply.receipt_text}}};},
    multi_agent_v1__close_agent:async input=>{assert.deepEqual(input,{target:packet.id+'-child'});steps.push('close-'+packet.id);return {};},
    mcp__ttak_scenario__explanation_result:async input=>{assert.equal(input.receipt_text,reply.receipt_text);const response=invoke(parent,'explanation_result',{...input,result:reply.result});assert.equal(response.isError,undefined);results.push({id:packet.id,result:reply.result});return response;},
    mcp__ttak_scenario__explanation_next:async input=>{assert.deepEqual(input,{...binding,previous:results[0]});const response=invoke(parent,'explanation_next',input);assert.equal(response.isError,undefined);packet=plan.packets[1];return response;}};
  const context={tools,load:()=>held,store:(key,value)=>{assert.equal(key,'ttak-verification');held=structuredClone(value);},text:value=>prints.push(value)},adapter=v.nativeAdapter('codex');
  await execute(adapter.spawn_agent_code,context);assert.deepEqual(held,{...binding,previous:results[0]});
  await execute(adapter.next_packet_code,context);await execute(adapter.spawn_agent_code,context);
  assert.deepEqual(held,{...binding,previous:results[1]});assert.deepEqual(steps,['spawn-Q1','close-Q1','spawn-Q2','close-Q2']);
  const final=invoke(parent,'explanation_check_final',{...binding,request:'current',facts:'current',final_text:{fact_answers:'current'},revision:0});
  assert.equal(final.isError,undefined);assert.deepEqual(final.structuredContent.source_facts,{request:original,facts:results});assert.equal(final.structuredContent.complete_authorized,false);
  const first=v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',answer:results[0].result.answer,issues:[]},'fact');
  assert.equal(invoke(parent,'explanation_result',{...binding,challenge:first.result.challenge,result:first.result,receipt_text:first.receipt_text}).isError,true);
});

test('normal preparation discloses only its current packet recipe and the actual read supplies the whole final recipe',()=>{
  const h=fixture();assert.deepEqual(Object.keys(h.prepared.native_dispatch).sort(),['spawn_agent_code','spawn_agent_instructions']);
  assert.equal(h.prepared.native_dispatch.spawn_agent_code,v.nativeAdapter('codex').spawn_agent_code);
  assert.equal(h.nextStep.stage,'final_proposal');assert.equal(h.nextStep.code,v.nativeAdapter('codex').final_draft_code);
  const legacy=v.prepare({...binding,request}).native_dispatch;assert.equal(typeof legacy.final_draft_code,'string');
  assert.equal(legacy.spawn_agent_code.includes('include_next_step'),false);
});

test('the actual withheld handoff executes its filled correction recipe once with a fresh verifier and exact delivery',async()=>{
  const first=fixture({mode:'withheld',factAnswer:answer+' Additional detail.'});await execute(first.nextStep.code,first);
  const next=first.printed[0].next_step;assert.equal(next.stage,'correct_final');assert.equal(first.printed[0].result.verdict,'withheld');
  const source=next.code.replace('const final_text = "";','const final_text = '+JSON.stringify(answer)+';');
  const corrected=recipeTransport(first.invoke,first.held);await execute(source,corrected);
  assert.deepEqual(corrected.steps,['register','dispatch','spawn','wait','close','read','store','print']);
  assert.equal(corrected.registration.input.revision,1);assert.equal(corrected.registration.input.final_text,answer);
  assert.deepEqual(corrected.registration.response.structuredContent.source_facts,{request,facts:first.initial.facts});
  assert.equal(corrected.printed[0].result.verdict,'complete');assert.equal(corrected.printed[0].next_step.stage,'deliver');assert.equal(corrected.printed[0].delivery.final_text,answer);
  const spent=recipeTransport(first.invoke,corrected.held);await assert.rejects(execute(source,spent),/final registration failed/);assert.deepEqual(spent.steps,['register']);
});
