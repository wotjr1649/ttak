'use strict';
// Source composition is proposal construction, never a factual or native certificate.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {canonical,digest,textDigest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111165',candidate_sha256:'a'.repeat(64)};
const request='Explain the fictional register. A read returns the stored integer unchanged. Initially it stores7. Read it twice.';
const reference={fact_answers:'current'},answers=['  Each read returns7.\n','The stored value remains7.  '];
function fixture(count=2){
  const questions=Array.from({length:count},(_,n)=>({id:'FACT'+n,kind:'mechanism',target:'The register',conditions:'The defined read operation.',source_ids:[]}));
  const plan=v.prepare({...binding,request,blocks:questions.map(q=>({text:'Explain the defined read operation.',question_ids:[q.id]})),questions,sources:[]});
  let attempt=v.registerPlan(a.begin(binding.attempt_id,binding.candidate_sha256),plan,plan.request_sha256);const facts=[];
  for(const [n,packet]of plan.packets.entries()){
    const child='fact-child-'+n,spawn={hook_event_name:'PreToolUse',tool_name:'spawn_agent',tool_use_id:'spawn-'+n,
      tool_input:{message:packet.prompt,model:'gpt-5.6-luna',reasoning_effort:'high',fork_context:false}};
    attempt=v.observeAgent(attempt,spawn);attempt=v.observeAgent(attempt,{...spawn,hook_event_name:'PostToolUse',tool_response:{agent_id:child}});
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStart',agent_id:child,agent_type:v.agentType});
    const input={challenge:packet.challenge,verdict:'answered',answer:answers[n%answers.length],issues:[]},payload=v.resultSubmission(input,'fact');
    const submit={hook_event_name:'PreToolUse',agent_id:child,tool_use_id:'submit-'+n,tool_input:input};
    attempt=v.observeSubmission(attempt,submit,'fact');attempt=v.observeSubmission(attempt,{...submit,hook_event_name:'PostToolUse',submission_payload:payload},'fact');
    attempt=v.observeAgent(attempt,{hook_event_name:'SubagentStop',agent_id:child,last_assistant_message:payload.receipt_text});
    const selected=v.resultReference({...binding,challenge:'current'},attempt),read={...selected.args,result:payload.result};
    attempt=v.observeResultRead(attempt,read,v.resultRead(read));facts.push({id:packet.id,result:payload.result});
    if(n<count-1){const args={...binding,previous:facts.at(-1)},next=v.nextPacket(plan,args);attempt=v.registerNext(attempt,args,next,'codex');}
  }
  const args={...binding,request,facts,final_text:reference,revision:0};return {attempt,plan,facts,args};
}
const body=packet=>JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1)).data;
test('all whole fact answers compose exactly in order, with the same literal final packet and no input mutation',()=>{
  const {args}=fixture(),before=canonical(args),text=answers.join('\n\n'),compiled=v.finalize(args);
  assert.deepEqual(compiled,v.finalize({...args,final_text:text}));assert.equal(body(compiled.packet).final_text,text);
  assert.equal(compiled.final_sha256,textDigest(text));assert.equal(compiled.complete_authorized,false);assert.equal(canonical(args),before);
  assert.equal(body(v.finalize({...args,final_text:'current'}).packet).final_text,'current');
});
test('source references resolve only original/fact transport and retain the selector for native order checks',()=>{
  const {args,attempt}=fixture(),input={...args,request:'current',facts:'current'},source={request,facts:args.facts};
  assert.deepEqual(v.checkFinalReferences(input,attempt),input);const resolved=v.finalizeReferences(input,source);
  assert.deepEqual(resolved.args,args);assert.deepEqual(resolved.payload,v.finalize(args));
  assert.deepEqual(v.exposeReferencedFinal(resolved,'claude').source_facts,source);
});

test('the initial current-reference contract rejects rewrites but preserves exact whole answers and explicit proposal review',()=>{
  const {args}=fixture(),input={...args,request:'current',facts:'current'},source={request,facts:args.facts};
  const exactText=answers.join('\n\n');
  assert.equal(v.finalizeReferences({...input,final_text:exactText},source).payload.final_sha256,textDigest(exactText));
  for(const final_text of ['An invented explanation.',answers[0],exactText.trim(),[...answers].reverse().join('\n\n')])
    assert.throws(()=>v.finalizeReferences({...input,final_text},source),/first_review_requires_whole_facts/);
  const changed='A proposed wording for independent review.';
  assert.equal(v.finalizeReferences({...input,final_text:changed,revision:1},source).payload.final_sha256,textDigest(changed));
  assert.equal(v.finalize({...args,final_text:changed}).final_sha256,textDigest(changed));
});
test('reference registration requires every actual returned result in current plan order, not cached membership alone',()=>{
  const {args,attempt}=fixture(),compiled=v.finalize(args),registered=v.registerFinal(attempt,compiled,args);
  assert.equal(registered.status,'pending');assert.equal(registered.verification.final.phase,'planned');
  assert.doesNotMatch(canonical(registered),/fact_answers|Each read|stored value|final_text/);
  for(const facts of [[...args.facts].reverse(),args.facts.slice(0,1),args.facts.map((f,n)=>n?f:{...f,result:{...f.result,answer:'Substituted answer.'}})]){
    const changed={...args,facts};assert.throws(()=>v.registerFinal(attempt,v.finalize(changed),changed));
  }
  // Literal drafting keeps its existing fact membership contract.
  const literal={...args,final_text:'A proposed literal answer.',facts:[...args.facts].reverse()};assert.doesNotThrow(()=>v.registerFinal(attempt,v.finalize(literal),literal));
  for(const altered of [{...attempt,id:'another-parent'},{...attempt,candidate:'b'.repeat(64)},{...attempt,status:'unavailable'}])assert.throws(()=>v.registerFinal(altered,compiled,args));
  const unread=structuredClone(attempt);unread.verification.facts[0].phase='referenced';unread.verification.facts[0].verdict=null;
  assert.throws(()=>v.registerFinal(unread,compiled,args),/unobserved_fact/);assert.throws(()=>v.checkFinalReferences({...args,request:'current',facts:'current'},unread),/unobserved_fact/);
});
test('only an exact initial selector is accepted; missing, unresolved, extra, executable and oversized data still fail',()=>{
  const {args,attempt}=fixture();
  for(const final_text of [null,{},[],{fact_answers:'other'},{fact_answers:'current',ids:['FACT0']},{fact_answers:'current',trim:true}])assert.throws(()=>v.finalize({...args,final_text}));
  assert.throws(()=>v.finalize({...args,revision:1}));assert.throws(()=>v.finalize({...args,extra:true}));
  for(const facts of [[],[args.facts[0],args.facts[0]],[{...args.facts[0],result:{...args.facts[0].result,verdict:'unresolved',issues:[{quote:'Missing.',reason:'Unknown.',evidence_needed:'Actual evidence.'}]}}],
    [{...args.facts[0],result:{...args.facts[0].result,answer:' '}}]])assert.throws(()=>v.finalize({...args,facts}));
  let executed=0;const accessor={};Object.defineProperty(accessor,'fact_answers',{enumerable:true,get(){executed++;return 'current';}});
  assert.throws(()=>v.finalize({...args,final_text:accessor}));
  assert.throws(()=>v.registerFinal(attempt,v.finalize(args),{...args,final_text:accessor}));assert.equal(executed,0);
  const facts=args.facts.map(f=>({...f,result:{...f.result,answer:'x'.repeat(8000)}}));assert.equal(body(v.finalize({...args,facts}).packet).final_text.length,16002);
  facts.push({...facts[0],id:'FACT2',result:{...facts[0].result,challenge:'c'.repeat(64)}});assert.throws(()=>v.finalize({...args,facts}),/content_rejected/);
});
test('an existing final cannot be retried through the reference; literal revision rules remain unchanged',()=>{
  const {args,attempt}=fixture(),final=v.finalize(args),pending=v.registerFinal(attempt,final,args),input={...args,request:'current',facts:'current'};
  assert.throws(()=>v.checkFinalReferences(input,pending),/revision_not_available/);assert.throws(()=>v.checkFinalReferences({...input,revision:1},pending));
  assert.throws(()=>v.registerFinal(pending,final,args),/revision_not_available/);
});
test('both normal MCP hosts compile source-linked proposals and require a fresh exact-final packet',()=>{
  for(const host of ['claude','codex']){
    const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'composition-test',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});
    const invoke=(name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
    const prepared={...binding,request},plan=v.prepare(prepared);assert.equal(invoke('explanation_prepare',prepared).isError,undefined);
    const input={...binding,request:'current',facts:'current',final_text:reference,revision:0};assert.equal(invoke('explanation_check_final',input).isError,true);
    const submitted=invoke('explanation_fact_result',{challenge:plan.packets[0].challenge,verdict:'answered',answer:answers[0],issues:[]}).structuredContent;
    const actual={request,facts:[{id:'REQUEST_FACTS',result:submitted.result}]},args=host==='claude'?input:{...input,...actual};
    const result=invoke('explanation_check_final',args);assert.equal(result.isError,undefined);assert.equal(result.structuredContent.complete_authorized,false);
    const final=v.finalize({...input,...actual});assert.equal(final.final_sha256,textDigest(answers[0]));
    assert.notEqual(final.packet.challenge,plan.packets[0].challenge);assert.equal(invoke('explanation_check_final',args).isError,true);
    const schema=d({jsonrpc:'2.0',id:3,method:'tools/list'}).result.tools.find(t=>t.name==='explanation_check_final').inputSchema;
    assert.deepEqual(schema.required,['attempt_id','candidate_sha256','request','facts']);assert.equal(schema.additionalProperties,false);
    assert.equal(Object.hasOwn(schema.properties,'final_text'),false);assert.equal(Object.hasOwn(schema.properties,'revision'),false);
  }
});
