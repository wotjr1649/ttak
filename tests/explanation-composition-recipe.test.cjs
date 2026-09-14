'use strict';
// Execute the published composition recipes against the real in-process MCP compiler.
// Synthetic fact results test adapter wiring, not native retrieval or semantic quality.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {canonical,textDigest}=require('../scripts/verification-packet.cjs');
const {recipeTransport}=require('./helpers/final-recipe.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111166',candidate_sha256:'a'.repeat(64)};
const request='가상의 Nori 레지스터는 숫자 하나를 저장하고 읽기는 값을 바꾸지 않습니다. 저장값7을 두 번 읽은 결과를 초보자에게 두 문장으로 설명하세요.';
const answer='두 번 읽으면 모두7이 나옵니다. 읽어도 저장값7은 그대로입니다.',adapted='첫 번째와 두 번째 읽기는 모두7을 돌려줍니다. 읽기는 저장값을 바꾸지 않으므로 마지막 값도7입니다.';
const defaultLine='const final_text = {"fact_answers":"current"};';
function fixture(host){
  const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'recipe-test',version:'1'}}});dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  const invoke=(name,args)=>dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
  const args={...binding,request},plan=v.prepare(args),prepared=invoke('explanation_prepare',args).structuredContent;
  const fact=invoke('explanation_fact_result',{challenge:plan.packets[0].challenge,verdict:'answered',answer,issues:[]}).structuredContent;
  const read=host==='codex'?invoke('explanation_result',{...binding,challenge:fact.result.challenge,result:fact.result,receipt_text:fact.receipt_text,include_next_step:true}):null;
  if(read)assert.equal(read.isError,undefined);
  return {invoke,plan,prepared,nextStep:read?.structuredContent.next_step,held:{...binding,request,facts:[{id:'REQUEST_FACTS',result:fact.result}],previous:{id:'REQUEST_FACTS',result:fact.result}}};
}
for(const host of ['claude','codex'])for(const literal of [false,true])test(host+' final recipe executes '+(literal?'explicit literal adaptation':'whole-fact composition by default'),async()=>{
  const f=fixture(host),before=canonical(f.held),adapter=f.prepared.native_dispatch;let input,response;
  if(host==='claude'){
    input=v.bindArguments({...adapter.explanation_check_final,...(literal?{final_text:adapted,request,facts:f.held.facts,revision:0}:{})},{id:binding.attempt_id,candidate:binding.candidate_sha256}).input;
    response=f.invoke('explanation_check_final',input);
  }else{
    assert.equal(Object.hasOwn(adapter,'final_draft_code'),false);assert.equal(f.nextStep.stage,'final_proposal');
    const source=literal?v.nativeAdapter('codex').spawn_agent_code:f.nextStep.code;
    const h=recipeTransport(f.invoke,f.held),execute=Object.getPrototypeOf(async function(){}).constructor('tools','load','store','text',source);
    if(literal)await h.tools.mcp__ttak_scenario__explanation_check_final({...binding,request,facts:f.held.facts,final_text:adapted,revision:0});
    await execute(h.tools,h.load,h.store,h.text);input=h.registration.input;response=h.registration.response;
    assert.deepEqual(h.steps,['register','dispatch','spawn','wait','close','read','store','print']);
    assert.equal(h.printed[0].delivery.final_text,literal?adapted:answer);
  }
  assert.equal(response.isError,undefined);assert.deepEqual(input.final_text,literal?adapted:undefined);
  const resolved=v.usesFinalReferences(input)?v.finalizeReferences(input,response.structuredContent.source_facts).payload:v.finalize(input);
  const data=JSON.parse(resolved.packet.prompt.slice(resolved.packet.prompt.indexOf('\n')+1)).data;
  assert.equal(data.request,request);assert.deepEqual(data.facts,f.held.facts);assert.equal(data.final_text,literal?adapted:answer);
  assert.equal(resolved.final_sha256,textDigest(data.final_text));assert.equal(resolved.complete_authorized,false);
  assert.notEqual(resolved.packet.challenge,f.plan.packets[0].challenge);assert.equal(canonical(f.held),before);
  assert.equal(f.invoke('explanation_check_final',input).isError,true);
});
test('the Codex composition recipe does not manufacture absent retained facts or catch a rejected final call',async()=>{
  const source=v.nativeAdapter('codex').final_draft_code,execute=Object.getPrototypeOf(async function(){}).constructor('tools','load','text',source);
  for(const held of [undefined,{...binding,request,facts:[]}]){
    let invoked=0;await assert.rejects(execute({mcp__ttak_scenario__explanation_check_final:async()=>{invoked++;}},()=>held,()=>{}),/no retained fact result/);assert.equal(invoked,0);
  }
  const f=fixture('codex');let printed=false;
  await assert.rejects(execute({mcp__ttak_scenario__explanation_check_final:async()=>{throw new Error('Native bound call rejected');}},()=>f.held,()=>{printed=true;}),/Native bound call rejected/);
  assert.equal(printed,false);
});
