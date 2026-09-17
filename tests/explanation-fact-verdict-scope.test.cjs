'use strict';
// Synthetic decisions test role descriptions and transport, not model judgment.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {canonical,textDigest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs'),{reviewChecks}=require('./helpers/final-review.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111168',candidate_sha256:'a'.repeat(64)};
const request='Explain a fictional tally to a beginner. Its stated initial value is5, and reading leaves it unchanged. Assess this quoted proposal: "Reading changes5 to9."';
const answer='Each read returns5 and leaves5 stored. The quoted proposal is false under the stated definition.';
const wrong='Reading changes5 to9.';
const missing={quote:'report the measured slowdown',reason:'No comparable measurements were supplied.',evidence_needed:'Matched baseline and changed workload timings.'};
const body=p=>JSON.parse(p.prompt.slice(p.prompt.indexOf('\n')+1));
function connection(host){const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'fact-scope',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});let id=1;return (method,params)=>d({jsonrpc:'2.0',id:++id,method,params}).result;}
test('fact-only schema explains answerability and missing inputs while retaining the exact result contract',()=>{
  const plan=v.prepare({...binding,request}),schema=body(plan.packets[0]).submission.input_schema;
  assert.deepEqual(schema.required,['challenge','verdict','answer','issues']);assert.deepEqual(schema.properties.verdict.enum,['answered','unresolved','conflict']);
  assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.properties.challenge.enum,['current',plan.packets[0].challenge]);
  for(const host of ['claude','codex']){
    const tool=connection(host)('tools/list',{}).tools.find(t=>t.name==='explanation_fact_result');
    assert.equal(tool.inputSchema.properties.verdict.description,schema.properties.verdict.description);
    assert.equal(tool.inputSchema.properties.issues.description,schema.properties.issues.description);
  }
  assert.match(schema.properties.verdict.description,/facts needed.*established/);
  assert.match(schema.properties.verdict.description,/settled correction/);
  assert.match(schema.properties.issues.description,/unavailable input or observation/);
  assert.equal(body(plan.packets[0]).data.original_request,request);
  assert.equal(plan.packets[0].prompt_sha256,textDigest(plan.packets[0].prompt));
  assert.match(plan.packets[0].prompt.split('\n')[0],/A false quoted claim/);
  for(const t of v.resultTools.filter(t=>t.name!=='explanation_fact_result')){
    if(t.name==='explanation_final_result')assert.equal(Object.hasOwn(t.inputSchema.properties,'issues'),false);
    else assert.notEqual(t.inputSchema.properties.issues.description,schema.properties.issues.description);
  }
});
for(const host of ['claude','codex'])test(host+' settled correction is factual evidence; the unchanged wrong proposal still needs independent revision',()=>{
  const call=connection(host),invoke=(name,args)=>call('tools/call',{name,arguments:args}),plan=v.prepare({...binding,request});
  assert.deepEqual(invoke('explanation_prepare',{...binding,request}).structuredContent,v.exposePlan(plan,host));
  const fact=invoke('explanation_fact_result',{challenge:plan.packets[0].challenge,verdict:'answered',answer,issues:[]}).structuredContent;
  assert.equal(fact.result.answer,answer);assert.equal(fact.result.verdict,'answered');assert.equal(Object.keys(fact.result).length,7);
  assert.throws(()=>a.checkedAttempt({...a.begin(binding.attempt_id,binding.candidate_sha256),status:'complete',final_sha256:textDigest(answer)}));
  const args={...binding,request,facts:[{id:'REQUEST_FACTS',result:fact.result}],final_text:wrong,revision:0};
  const first=invoke('explanation_check_final',args);assert.equal(first.isError,undefined);
  const f0=v.finalize(args);
  assert.equal(body(f0.packet).data.final_text,wrong);assert.equal(body(f0.packet).data.request,request);assert.deepEqual(body(f0.packet).data.facts[0].result,fact.result);
  const issue={quote:wrong,reason:'The stipulated read leaves5 unchanged.',evidence_needed:'Correct the proposal to preserve5.'},checks=reviewChecks();checks.claim_review.conditions_outcomes=[0];
  const withheld=invoke('explanation_final_result',{challenge:f0.packet.challenge,final_decision:'revise_explanation',...checks,checked_questions:['REQUEST_FACTS'],issues:[issue]}).structuredContent;
  assert.equal(withheld.result.verdict,'withheld');assert.equal(f0.complete_authorized,false);
  const corrected={...args,request:'current',facts:'current',final_text:answer,revision:1},second=invoke('explanation_check_final',corrected);assert.equal(second.isError,undefined);
  const f1=v.finalizeReferences(corrected,second.structuredContent.source_facts).payload;
  const approved=invoke('explanation_final_result',{challenge:f1.packet.challenge,final_decision:'approve_explanation',...reviewChecks(),checked_questions:['REQUEST_FACTS'],issues:[]}).structuredContent;
  assert.equal(v.resultRead({...binding,challenge:f1.packet.challenge,result:approved.result},f1.packet).delivery.final_text,answer);
  assert.equal(invoke('explanation_check_final',{...corrected,revision:2}).isError,true);
  // These synthetic MCP results do not provide the guard's native receipts or completion authority.
  const pending=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,textDigest(request));
  assert.throws(()=>v.registerFinal(pending,f1,{...binding,request,facts:[{id:'REQUEST_FACTS',result:fact.result}],final_text:answer,revision:1}));
});
test('unresolved and conflict are never promoted to answered or allowed into final composition',()=>{
  for(const verdict of ['unresolved','conflict'])for(const host of ['claude','codex']){
    const call=connection(host),invoke=(name,args)=>call('tools/call',{name,arguments:args});
    const source=request+' Also report the measured slowdown.',plan=v.prepare({...binding,request:source});invoke('explanation_prepare',{...binding,request:source});
    const submitted=invoke('explanation_fact_result',{challenge:plan.packets[0].challenge,verdict,answer:'The fictional values are known but the required measured cost is not.',issues:[missing]}).structuredContent;
    assert.equal(submitted.result.verdict,verdict);assert.deepEqual(submitted.result.issues,[missing]);
    assert.equal(invoke('explanation_check_final',{...binding,request:'current',facts:'current',final_text:answer,revision:0}).isError,true);
    assert.throws(()=>v.resultSubmission({challenge:plan.packets[0].challenge,verdict,answer,issues:[]},'fact'));
    assert.throws(()=>v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',answer,issues:[missing]},'fact'));
  }
});
test('verdict guidance does not normalize evidence, accept extra fields, exceed bounds or invoke data',()=>{
  const input={challenge:'b'.repeat(64),verdict:'answered',answer,issues:[]},before=canonical(input);
  for(const changed of [{...input,verdict:'approve_explanation'},{...input,supported:true},{...input,answer:'x'.repeat(8001)},
    {...input,answer:'bad\ud800'},{...input,answer:'sk-'+'SYNTHETIC'.repeat(4)}])assert.throws(()=>v.resultSubmission(changed,'fact'));
  let invoked=0;const getter={...input};Object.defineProperty(getter,'verdict',{enumerable:true,get(){invoked++;return 'answered';}});
  assert.throws(()=>v.resultSubmission(getter,'fact'));assert.equal(invoked,0);assert.equal(canonical(input),before);
});
