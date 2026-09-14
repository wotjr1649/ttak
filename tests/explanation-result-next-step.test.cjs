'use strict';
// Continuation recipes describe an observed stage; they never substitute for native approval.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111173',candidate_sha256:'a'.repeat(64)},request='Explain a fictional register that initially stores7 and returns its value without changing it.';
const invoke=(d,name,args)=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}}).result;
function connection(host='codex'){const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'next-step-test',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});return d;}
function fact(challenge='b'.repeat(64)){return v.resultSubmission({challenge,verdict:'answered',answer:'Reading returns7 and leaves7 stored.',issues:[]},'fact');}
function final(challenge='b'.repeat(64),withheld=false){const checks=reviewChecks(),issues=withheld?[{quote:'Reading changes7.',reason:'Reads leave the value unchanged.',evidence_needed:'Correct the read effect.'}]:[];if(withheld)checks.claim_review.conditions_outcomes=[0];
  return v.finalReviewSubmission({challenge,final_decision:withheld?'revise_explanation':'approve_explanation',...Object.assign({},...Object.values(checks)),checked_questions:['REQUEST_FACTS'],issues});}
const context=(extra={})=>({remaining_facts:0,failed_facts:0,revision:null,...extra});
test('normal result stages disclose only the currently applicable next recipe',()=>{
  const ready=v.resultNextStep(fact().result,context());assert.equal(ready.stage,'final_proposal');assert.equal(ready.code,v.nativeAdapter('codex').final_draft_code);
  const next=v.resultNextStep(fact().result,context({remaining_facts:1}));assert.equal(next.stage,'next_fact');assert.equal(next.code,v.nativeAdapter('codex').next_packet_code);
  const revise=v.resultNextStep(final(undefined,true).result,context({revision:0}));assert.equal(revise.stage,'correct_final');assert.match(revise.code,/const revision = 1;/);
  assert.equal(v.resultNextStep(final().result,context({revision:0})).stage,'deliver');assert.equal(v.resultNextStep(final().result,context({revision:1})).stage,'deliver');
  assert.deepEqual(Object.keys(v.resultNextStep(final(undefined,true).result,context({revision:1}))).sort(),['instructions','stage']);
  assert.equal(v.resultNextStep(final(undefined,true).result,context({revision:1})).stage,'withhold');
  const failed=v.resultSubmission({challenge:'b'.repeat(64),verdict:'unresolved',answer:'The required input is absent.',issues:[{quote:'Required input',reason:'Absent.',evidence_needed:'The input.'}]},'fact').result;
  assert.equal(v.resultNextStep(failed,context()).stage,'withhold');assert.equal(v.resultNextStep(fact().result,context({failed_facts:1})).stage,'withhold');
});
test('next-step contexts cannot invent a final revision, skip pending facts or accept unbounded fields',()=>{
  for(const changed of [{remaining_facts:-1},{remaining_facts:9},{failed_facts:'0'},{revision:2},{extra:true}])assert.throws(()=>v.resultNextStep(fact().result,context(changed)));
  assert.throws(()=>v.resultNextStep(fact().result,context({revision:0})));
  for(const extra of [{revision:null},{revision:0,remaining_facts:1},{revision:0,failed_facts:1}])assert.throws(()=>v.resultNextStep(final().result,context(extra)));
  assert.throws(()=>v.resultNextStep({...fact().result,extra:true},context()));
  let accessed=0;const accessor=context();Object.defineProperty(accessor,'revision',{enumerable:true,get(){accessed++;return null;}});assert.throws(()=>v.resultNextStep(fact().result,accessor));assert.equal(accessed,0);
});
test('an unfilled correction recipe makes no registration, native call, store or output',async()=>{
  const recipe=v.resultNextStep(final(undefined,true).result,context({revision:0})).code;let called=0;
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  await assert.rejects(new AsyncFunction('tools','load','store','text',recipe)({},()=>{called++;},()=>{called++;},()=>{called++;}),/corrected literal/);assert.equal(called,0);
});
test('the optional result request flag is exact and legacy result payloads remain unchanged',()=>{
  assert.deepEqual(v.resultReadTool.inputSchema.properties.include_next_step.type,'boolean');assert.equal(v.resultReadTool.inputSchema.properties.include_next_step.const,true);
  assert.deepEqual(v.resultReadTool.inputSchema.required,['attempt_id','candidate_sha256','challenge']);
  const result=fact().result,args={...binding,challenge:result.challenge,result};
  const expected=v.resultRead(args);assert.equal(Object.hasOwn(expected,'next_step'),false);
  for(const value of [false,1,'true',null])assert.throws(()=>v.resultRead({...args,include_next_step:value}));
  assert.throws(()=>v.resultRead({...args,include_next_step:true}));
});
test('a separately connected child read supplies the applicable final recipe only from the same exact parent cache',()=>{
  for(const mode of ['normal','wrong-candidate','missing-cache','claude','assessment']){
    const host=mode==='claude'?'claude':'codex',parent=connection(host),child=connection(host),args={...binding,request},assess=mode==='assessment';
    const plan=assess?v.prepareAssessment(args):v.prepare(args),packet=plan.packets[0];
    if(mode!=='missing-cache')assert.equal(invoke(parent,assess?'explanation_assess_request':'explanation_prepare',args).isError,undefined);
    const reply=assess?v.resultSubmission({challenge:packet.challenge,assessment_decision:'assessed',gap_review:'No required evidence is missing.',essential_gaps:[],corrections:[],issues:[]},'assessment')
      :invoke(child,'explanation_fact_result',{challenge:packet.challenge,verdict:'answered',answer:'Reading returns7 and leaves7 stored.',issues:[]}).structuredContent;
    const read={...binding,challenge:packet.challenge,result:reply.result,receipt_text:reply.receipt_text,include_next_step:true};if(mode==='wrong-candidate')read.candidate_sha256='c'.repeat(64);
    const response=invoke(parent,'explanation_result',read);if(mode!=='normal'){assert.equal(response.isError,true,mode);continue;}
    assert.equal(response.isError,undefined);assert.deepEqual(response.structuredContent.result,reply.result);assert.deepEqual(response.structuredContent.next_step,v.resultNextStep(reply.result,context()));
    assert.equal(invoke(parent,'explanation_result',read).isError,true);
    const proposal={...binding,request,facts:[{id:packet.id,result:reply.result}],final_text:'Reading changes7.',revision:0},prepared=invoke(parent,'explanation_check_final',proposal);assert.equal(prepared.isError,undefined);
    const checked=final(prepared.structuredContent.packet.challenge,true),resultRead={...binding,challenge:checked.result.challenge,result:checked.result,receipt_text:checked.receipt_text,include_next_step:true};
    const reviewed=invoke(parent,'explanation_result',resultRead);assert.equal(reviewed.isError,undefined);assert.deepEqual(reviewed.structuredContent.next_step,v.resultNextStep(checked.result,context({revision:0})));
    assert.equal(invoke(parent,'explanation_result',resultRead).isError,true);
  }
});

test('pre-cached but unread facts cannot advertise final readiness or skip the remaining actual result read',()=>{
  const parent=connection(),args={...binding,request,blocks:[{text:'Two independently checked topics.',question_ids:['Q1','Q2']}],
    questions:[{id:'Q1',kind:'mechanism',target:'The read behavior',conditions:'Use the supplied definition.',source_ids:[]},{id:'Q2',kind:'relationship',target:'The stored-value relationship',conditions:'Use the supplied definition.',source_ids:[]}],sources:[]};
  const plan=v.prepare(args);assert.equal(invoke(parent,'explanation_prepare',args).isError,undefined);
  const replies=plan.packets.map(p=>invoke(parent,'explanation_fact_result',{challenge:p.challenge,verdict:'answered',answer:'The read returns7 and preserves7.',issues:[]}).structuredContent);
  const read=i=>invoke(parent,'explanation_result',{...binding,challenge:plan.packets[i].challenge,result:replies[i].result,receipt_text:replies[i].receipt_text,include_next_step:true});
  assert.equal(read(0).structuredContent.next_step.stage,'next_fact');assert.equal(read(1).structuredContent.next_step.stage,'final_proposal');
});

test('Claude stage handoffs expose final registration before an Agent and keep correction literal-only',()=>{
  const answered=fact().result,ready=v.claudeResultNextStep(answered,context(),'REQUEST_FACTS');
  assert.equal(ready.stage,'final_proposal');assert.equal(ready.tool,'explanation_check_final');
  assert.deepEqual(ready.arguments,v.nativeAdapter('claude').explanation_check_final);
  assert.match(ready.instructions,/returned Agent/);assert.equal(Object.hasOwn(ready,'Agent'),false);assert.equal(Object.hasOwn(ready,'code'),false);
  const next=v.claudeResultNextStep(answered,context({remaining_facts:1}),'Q1');
  assert.equal(next.tool,'explanation_next');assert.deepEqual(next.arguments,{attempt_id:'current',candidate_sha256:'current',previous:{id:'Q1',result:answered}});
  const revise=v.claudeResultNextStep(final(undefined,true).result,context({revision:0}),'FINAL0');
  assert.equal(revise.stage,'correct_final');assert.equal(revise.tool,'explanation_revise_final');assert.equal(revise.arguments.revision,1);assert.equal(revise.arguments.final_text,'');
  assert.throws(()=>v.finalize({...revise.arguments,...binding,request,facts:[{id:'REQUEST_FACTS',result:answered}]}));
  for(const revision of [0,1])assert.deepEqual(v.claudeResultNextStep(final().result,context({revision}),'FINAL'+revision),v.resultNextStep(final().result,context({revision})));
  assert.deepEqual(v.claudeResultNextStep(final(undefined,true).result,context({revision:1}),'FINAL1'),v.resultNextStep(final(undefined,true).result,context({revision:1})));
});
test('Claude stage handoffs reject unsafe identifiers and inconsistent stage data',()=>{
  for(const id of [null,'','../other','Q1\nAgent',{},'x'.repeat(129)])assert.throws(()=>v.claudeResultNextStep(fact().result,context({remaining_facts:1}),id));
  for(const change of [{remaining_facts:9},{revision:0},{extra:true}])assert.throws(()=>v.claudeResultNextStep(fact().result,context(change),'Q1'));
  assert.throws(()=>v.claudeResultNextStep(final().result,context({revision:0,remaining_facts:1}),'FINAL0'));
  let accessed=0;const result=fact().result;Object.defineProperty(result,'answer',{enumerable:true,get(){accessed++;return 'unsafe';}});
  assert.throws(()=>v.claudeResultNextStep(result,context(),'Q1'));assert.equal(accessed,0);
  const args={};Object.defineProperty(args,'include_next_step',{enumerable:true,get(){accessed++;return true;}});
  assert.throws(()=>v.observeResultRead({},args,{},'claude'));assert.equal(accessed,0);
});
test('Claude three-field result reads disclose the independently recomputable next action without enabling the Codex flag',()=>{
  const parent=connection('claude'),child=connection('claude'),args={...binding,request};
  const issued=invoke(parent,'explanation_prepare',args);assert.equal(issued.isError,undefined);
  const packet=v.prepare(args).packets[0],submitted=invoke(child,'explanation_fact_result',{challenge:packet.challenge,verdict:'answered',answer:'Reading returns7 and leaves7 stored.',issues:[]}).structuredContent;
  const read={...binding,challenge:packet.challenge,result:submitted.result};
  assert.equal(invoke(parent,'explanation_result',{...read,receipt_text:submitted.receipt_text,include_next_step:true}).isError,true);
  const response=invoke(parent,'explanation_result',read);assert.equal(response.isError,undefined);
  assert.deepEqual(response.structuredContent.next_step,v.claudeResultNextStep(submitted.result,context(),'REQUEST_FACTS'));
  assert.equal(response.structuredContent.next_step.tool,'explanation_check_final');assert.equal(invoke(parent,'explanation_result',read).isError,true);
  const registration=invoke(parent,response.structuredContent.next_step.tool,{...response.structuredContent.next_step.arguments,...binding});assert.equal(registration.isError,undefined);
  assert.equal(v.launchChallenge(registration.structuredContent.native_dispatch.Agent.prompt),registration.structuredContent.packet.challenge);
  assert.notEqual(registration.structuredContent.packet.challenge,binding.candidate_sha256);
  const checked=final(registration.structuredContent.packet.challenge),finalRead=invoke(parent,'explanation_result',{...binding,challenge:checked.result.challenge,result:checked.result});
  assert.equal(finalRead.isError,undefined);assert.equal(finalRead.structuredContent.next_step.stage,'deliver');assert.equal(finalRead.structuredContent.delivery.final_text,submitted.result.answer);
});
test('Claude cannot advertise final readiness while a cached fact has not actually been read',()=>{
  const parent=connection('claude'),args={...binding,request,blocks:[{text:'Two topics.',question_ids:['Q1','Q2']}],
    questions:[{id:'Q1',kind:'mechanism',target:'Read behavior',conditions:'Given definition.',source_ids:[]},{id:'Q2',kind:'relationship',target:'Stored value',conditions:'Given definition.',source_ids:[]}],sources:[]};
  const plan=v.prepare(args);assert.equal(invoke(parent,'explanation_prepare',args).isError,undefined);
  const replies=plan.packets.map(p=>invoke(parent,'explanation_fact_result',{challenge:p.challenge,verdict:'answered',answer:'The read returns7 and preserves7.',issues:[]}).structuredContent);
  const first=invoke(parent,'explanation_result',{...binding,challenge:plan.packets[0].challenge,result:replies[0].result});
  assert.equal(first.structuredContent.next_step.stage,'next_fact');assert.equal(first.structuredContent.next_step.arguments.previous.id,'Q1');
  const second=invoke(parent,'explanation_result',{...binding,challenge:plan.packets[1].challenge,result:replies[1].result});
  assert.equal(second.structuredContent.next_step.stage,'final_proposal');
});
