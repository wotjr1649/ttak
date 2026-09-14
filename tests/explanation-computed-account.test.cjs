'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const source=require('../scripts/explanation-source-model.cjs'),v=require('../scripts/explanation-verification.cjs');
const {explainScenario}=require('../scripts/finite-scenario-render.cjs'),{digest,textDigest,canonical}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const a=require('../scripts/explanation-attempt.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111111',candidate_sha256:'a'.repeat(64)};
const model=()=>({initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
  {id:'T1',guard:{cells:['B'],at_least:1},writes:{A:false}},{id:'T2',guard:{cells:['A'],at_least:1},writes:{B:false}}]});
const request=value=>'Explain this finite example and one sufficient remedy with its conditions and trade-off.\n'+JSON.stringify(value);
const body=packet=>JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
test('precomputed accounts are the entire existing renderer output, bound to original model hashes',()=>{
  const m=model(),original=request({scenario:m,computed_fact_accounts:[{answer:'ATTACKER_ANSWER',model_sha256:digest(m)}]});
  const accounts=source.computedFactAccounts(original),expected=explainScenario(m,'en').explanation;
  assert.deepEqual(accounts,[{model_sha256:digest(m),language:'en',answer:expected,answer_sha256:textDigest(expected)}]);
  assert.equal(source.compileModelAnswer({computed_models:[{model_sha256:digest(m),model:m}],request_context:'A and B are the Boolean state cells; T1 and T2 are the modeled transactions. The invariant requires at least one true cell.',additional_sources:[],language:'en'}).answer,'A and B are the Boolean state cells; T1 and T2 are the modeled transactions. The invariant requires at least one true cell.\n\n'+accounts[0].answer);
  assert.doesNotMatch(canonical(accounts),/ATTACKER_ANSWER/);
  assert.match(accounts[0].answer,/snapshot acquisition and the guard check/);assert.match(accounts[0].answer,/trade-off is loss of concurrency/);
});
test('changed, disabled, conflicting and unsafe serial models expose their own complete account, never a universal remedy',()=>{
  const renamed={initial:{ready:true,awake:false},invariant:{cells:['ready'],at_least:1},transactions:[{id:'Inspect',guard:{cells:['awake'],at_least:1},writes:{ready:false}}]};
  const overlap=model();overlap.transactions[1].writes={A:false};const unsafe=model();unsafe.transactions.forEach(t=>{t.guard={cells:[],at_least:0};});
  for(const m of [model(),renamed,overlap,unsafe]){
    const account=source.computedFactAccounts(request(m))[0];assert.equal(account.answer,explainScenario(m,'en').explanation);assert.equal(account.model_sha256,digest(m));
    assert.equal(account.answer_sha256,textDigest(account.answer));
  }
  assert.match(source.computedFactAccounts(request(renamed))[0].answer,/makes no update because its guard is false/);
  assert.match(source.computedFactAccounts(request(overlap))[0].answer,/aborts on a write conflict/);
  assert.match(source.computedFactAccounts(request(unsafe))[0].answer,/Serialization alone is insufficient/);
});
test('only request-facts packets add accounts while original source and every witness remain unchanged',()=>{
  const original=request(model()),plan=v.prepare({...binding,request:original}),data=body(plan.packets[0]).data;
  assert.deepEqual(data.computed_fact_accounts,source.computedFactAccounts(original));assert.deepEqual(data.model_evidence,source.verifierModels(original));
  assert.equal(data.original_request,original);assert.deepEqual(plan.model_evidence,source.sourceModels(original));
  const result=v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',answer:{computed_models:[{model_sha256:digest(model()),model:model()}],request_context:'A and B are the Boolean state cells; T1 and T2 are the modeled transactions. The invariant requires at least one true cell.',additional_sources:[],language:'en'},issues:[]},'fact').result;
  const final=v.finalize({...binding,request:original,final_text:'A bounded test proposal.',facts:[{id:'REQUEST_FACTS',result}],revision:0});
  assert.equal(Object.hasOwn(body(final.packet).data,'computed_fact_accounts'),false);assert.deepEqual(body(final.packet).data.facts,[{id:'REQUEST_FACTS',result}]);
  assert.deepEqual(body(final.packet).data.model_evidence,source.verifierModels(original));
  assert.equal(Object.hasOwn(body(v.prepare({...binding,request:'Explain an ordinary fictional register.'}).packets[0]).data,'computed_fact_accounts'),false);
  assert.equal(Object.hasOwn(body(v.prepareAssessment({...binding,request:original}).packets[0]).data,'computed_fact_accounts'),false);
});
test('duplicate model locations retain separate provenance but share one fresh account; unsafe sources still reject',()=>{
  const m=model(),original=request([m,m]);assert.equal(source.sourceModels(original).length,2);assert.equal(source.computedFactAccounts(original).length,1);
  const output=source.computedFactAccounts(original);output[0].answer='Changed.';assert.notEqual(source.computedFactAccounts(original)[0].answer,'Changed.');
  assert.deepEqual(source.computedFactAccounts('Explain a fictional register.'),[]);
  for(const input of [request(Array.from({length:5},model)),request({scenario:m,secret:'sk-'+'SYNTHETIC'.repeat(4)}),'x'.repeat(32001),
    'Explain\n{"scenario":'+JSON.stringify(m)+',"scenario":'+JSON.stringify(m)+'}'])assert.throws(()=>source.computedFactAccounts(input));
  let invoked=0;assert.throws(()=>source.computedFactAccounts({toString(){invoked++;return original;}}));assert.equal(invoked,0);
});
test('normal MCP retrieves the account in the same bound fact packet on both host adapters',()=>{
  for(const host of ['claude','codex']){
    const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'account-test',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});
    const call=(name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
    const original=request(model()),plan=v.prepare({...binding,request:original});assert.equal(call('explanation_prepare',{...binding,request:original}).isError,undefined);
    const response=host==='claude'?call('explanation_packet',{challenge:plan.packets[0].challenge}):call('explanation_dispatch',{...binding,challenge:plan.packets[0].challenge});
    assert.equal(response.isError,undefined);const prompt=host==='claude'?response.structuredContent.prompt:response.structuredContent.native_spawn.message;
    assert.equal(prompt,plan.packets[0].prompt);const data=JSON.parse(prompt.slice(prompt.indexOf('\n')+1)).data;
    assert.deepEqual(data.computed_fact_accounts,source.computedFactAccounts(original));assert.equal(plan.complete_authorized,false);
  }
});
test('a self-rehashed substitute account cannot enter either native verifier route',()=>{
  const original=request(model()),plan=v.prepare({...binding,request:original}),packet=plan.packets[0],data=body(packet);
  data.data.computed_fact_accounts[0].answer='An attacker-selected account.';data.data.computed_fact_accounts[0].answer_sha256=textDigest(data.data.computed_fact_accounts[0].answer);
  const changed=packet.prompt.slice(0,packet.prompt.indexOf('\n')+1)+canonical(data),initial=()=>v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,plan.request_sha256);
  assert.throws(()=>v.observeAgent(initial(),{hook_event_name:'PreToolUse',tool_name:'spawn_agent',tool_use_id:'changed-native',tool_input:{message:changed,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}}));
  let attempt=v.observeAgent(initial(),{hook_event_name:'PreToolUse',tool_name:'Agent',tool_use_id:'launch-one',tool_input:{description:'One check',prompt:v.launchPrompt(packet.challenge),subagent_type:v.agentType,run_in_background:false}});
  attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:'child-one',agent_type:v.agentType});
  const get={hook_event_name:'PreToolUse',agent_id:'child-one',tool_use_id:'get-one',tool_input:{challenge:packet.challenge}};attempt=v.observePacket(attempt,get);
  assert.throws(()=>v.observePacket(attempt,{...get,hook_event_name:'PostToolUse',packet_payload:{...v.packetBody(packet),prompt:changed,prompt_sha256:textDigest(changed)}}));
  assert.equal(attempt.verification.facts[0].retrieved,false);assert.equal(attempt.status,'pending');
  assert.equal(v.observePacket(attempt,{...get,hook_event_name:'PostToolUse',packet_payload:v.packetBody(packet)}).verification.facts[0].retrieved,true);
});
test('boundary-sized source models preserve the existing account and packet bounds without truncation',()=>{
  let admitted=0,rejected=0;
  for(const count of [1,2,4])for(const cells of [2,8,16])for(const length of [1,28]){
    const names=Array.from({length:cells},(_,i)=>'C'+i+'x'.repeat(length)),m={initial:Object.fromEntries(names.map(n=>[n,true])),invariant:{cells:names,at_least:1},
      transactions:Array.from({length:Math.min(4,cells)},(_,i)=>({id:'Transaction'+i,guard:{cells:names,at_least:1},writes:{[names[i]]:false}}))};
    const original=request(Array.from({length:count},()=>m));try{source.sourceModels(original);}catch(error){assert.match(error.message,/content_rejected/);rejected++;continue;}
    const accounts=source.computedFactAccounts(original);assert.ok(Buffer.byteLength(canonical(accounts))<=16000);assert.equal(accounts[0].answer,explainScenario(m,'en').explanation);
    const plan=v.prepare({...binding,request:original});assert.ok(Buffer.byteLength(plan.packets[0].prompt)<=48000);admitted++;
  }
  assert.ok(admitted>=8);assert.ok(rejected>0);
});
