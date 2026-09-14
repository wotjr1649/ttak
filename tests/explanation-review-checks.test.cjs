'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compileReviewChecks,reviewSchema}=require('../scripts/explanation-review-checks.cjs');
const v=require('../scripts/explanation-verification.cjs');
const {canonical}=require('../scripts/verification-packet.cjs');
const groups={requirement_review:['essential_requirements','reader_format'],claim_review:['actors_targets','conditions_outcomes','timing_negation','guarantees_scope_costs'],
  fact_review:['source_support','computed_outcomes','internal_consistency']};
const checked=()=>Object.fromEntries(Object.entries(groups).map(([field,keys])=>[field,Object.fromEntries(keys.map(key=>[key,'pass']))]));
test('every review dimension is explicitly supplied and losslessly encoded below the unchanged400-byte limit',()=>{
  const input=checked(),compiled=compileReviewChecks(input,0);assert.deepEqual(Object.keys(compiled),Object.keys(groups));
  for(const field of Object.keys(groups)){assert.deepEqual(JSON.parse(compiled[field]),input[field]);assert.ok(Buffer.byteLength(compiled[field])<=400);
    const schema=reviewSchema(field);assert.deepEqual(schema.required,groups[field]);assert.equal(schema.additionalProperties,false);}
  assert.deepEqual(input,checked());
});
test('defects reference complete existing issue entries, without truncation or silently discarding an issue',()=>{
  const input=checked();input.fact_review.computed_outcomes=[0];input.claim_review.conditions_outcomes=[0,1];
  const result=compileReviewChecks(input,2);assert.deepEqual(JSON.parse(result.fact_review).computed_outcomes,[0]);
  assert.deepEqual(JSON.parse(result.claim_review).conditions_outcomes,[0,1]);
  assert.throws(()=>compileReviewChecks(input,1));assert.throws(()=>compileReviewChecks(input,3));
  assert.throws(()=>compileReviewChecks(checked(),1));
  const worst=Object.fromEntries(Object.entries(groups).map(([field,keys])=>[field,Object.fromEntries(keys.map(key=>[key,Array.from({length:16},(_,i)=>i)]))]));
  const encoded=compileReviewChecks(worst,16);for(const field of Object.keys(groups)){assert.deepEqual(JSON.parse(encoded[field]),worst[field]);assert.ok(Buffer.byteLength(encoded[field])<=400);}
});
test('missing, extra, mixed, unreviewed and malformed check values fail rather than becoming a positive review',()=>{
  for(const field of Object.keys(groups)){
    const missing=checked();delete missing[field];assert.throws(()=>compileReviewChecks(missing,0));
    for(const key of groups[field]){
      const absent=checked();delete absent[field][key];assert.throws(()=>compileReviewChecks(absent,0));
      for(const value of ['fail','pending','PASS','A free-form review.',null,true,0,[],[0,0],[1],[-1],[16],[0.5],['0']]){
        const input=checked();input[field][key]=value;assert.throws(()=>compileReviewChecks(input,0));
      }
    }
    assert.throws(()=>compileReviewChecks({...checked(),[field]:'A legacy free-form review.'},0));
  }
  assert.throws(()=>compileReviewChecks({...checked(),extra:true},0));
  for(const count of [-1,17,NaN,1.5,'0'])assert.throws(()=>compileReviewChecks(checked(),count));
  let calls=0;const input=checked();Object.defineProperty(input.claim_review,'actors_targets',{enumerable:true,get(){calls++;return 'pass';}});
  assert.throws(()=>compileReviewChecks(input,0));assert.equal(calls,0);
  assert.throws(()=>reviewSchema({toString(){calls++;return 'claim_review';}}));assert.equal(calls,0);
  assert.throws(()=>reviewSchema('unrecognized'));
});
const submission=()=>({challenge:'a'.repeat(64),final_decision:'approve_explanation',...checked(),checked_questions:['Q1'],issues:[]});
test('the strict public submission preserves all check outcomes, issue evidence, receipt and legacy result limits',()=>{
  const input=submission(),reply=v.finalReviewSubmission(input);assert.equal(reply.result.kind,'final');assert.equal(reply.result.verdict,'complete');
  for(const field of Object.keys(groups))assert.deepEqual(JSON.parse(JSON.parse(reply.result.answer)[field]),input[field]);
  assert.deepEqual(v.resultSubmission(input,'final'),reply);assert.deepEqual(input,submission());assert.equal(JSON.parse(reply.receipt_text).challenge,input.challenge);
  const changed=submission();changed.final_decision='revise_explanation';changed.fact_review.computed_outcomes=[0];
  changed.issues=[{quote:'The skipped action aborted.',reason:'r'.repeat(1900),evidence_needed:'e'.repeat(900)}];
  const withheld=v.finalReviewSubmission(changed);assert.equal(withheld.result.verdict,'withheld');assert.deepEqual(withheld.result.issues,changed.issues);
  for(const field of Object.keys(groups))assert.ok(Buffer.byteLength(JSON.parse(withheld.result.answer)[field])<=400);
  assert.notEqual(canonical(withheld.result),canonical(reply.result));
});
test('public structured intake rejects legacy, mixed and inconsistent reviews instead of recovering them',()=>{
  assert.equal(typeof v.finalReviewSubmission,'function');
  const legacy={...submission(),requirement_review:'Short coverage.',claim_review:'Short finding.',fact_review:'Short fact finding.'};
  assert.throws(()=>v.finalReviewSubmission(legacy));assert.equal(v.resultSubmission(legacy,'final').result.verdict,'complete');
  const mixed={...submission(),fact_review:legacy.fact_review};assert.throws(()=>v.finalReviewSubmission(mixed));assert.throws(()=>v.resultSubmission(mixed,'final'));
  const issue={quote:'A supplied clause.',reason:'A concrete contradiction.',evidence_needed:'A correction.'};
  const unlinked={...submission(),issues:[issue]};assert.throws(()=>v.finalReviewSubmission(unlinked));
  const wrongDecision={...submission(),issues:[issue]};wrongDecision.claim_review.actors_targets=[0];assert.throws(()=>v.finalReviewSubmission(wrongDecision));
  assert.throws(()=>v.finalReviewSubmission({...submission(),final_decision:'revise_explanation'}));
  const duplicated=submission();duplicated.fact_review.source_support=[0,0];duplicated.issues=[issue];assert.throws(()=>v.finalReviewSubmission(duplicated));
});
test('normal final packets advertise the explicit checks and direct submission without an unnecessary string preview',()=>{
  const args={attempt_id:'11111111-1111-4111-8111-111111111111',candidate_sha256:'a'.repeat(64),request:'Explain a fictional register whose read returns3 and leaves3 stored.'};
  const plan=v.prepare(args),fact=v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',answer:'Each read returns3 and leaves3 stored.',issues:[]},'fact').result;
  const final=v.finalize({...args,final_text:'Reading returns3 and leaves3 stored.',facts:[{id:'REQUEST_FACTS',result:fact}],revision:0});
  const packet=JSON.parse(final.packet.prompt.slice(final.packet.prompt.indexOf('\n')+1));assert.equal(packet.format_preview,undefined);
  const advertised=v.resultTools.find(t=>t.name==='explanation_final_result').inputSchema.properties;
  for(const field of Object.keys(groups))for(const key of groups[field]){const name=field==='fact_review'?'fact_'+key:key;assert.deepEqual(packet.submission.input_schema.properties[name],advertised[name]);}
  assert.deepEqual(packet.submission.input_schema.required,['challenge','final_decision',...Object.entries(groups).flatMap(([field,keys])=>keys.map(key=>field==='fact_review'?'fact_'+key:key)),'checked_questions']);
  assert.equal(packet.submission.tool,'explanation_final_result');
  for(const host of ['native','mcp']){const guide=v.verifierInstruction(final.packet.challenge,host,'final');assert.doesNotMatch(guide,/explanation_final_preview/);assert.match(guide,/receipt_text/);}
});
test('the actual MCP dispatcher enforces check objects even though historical result parsing retains bounded text support',()=>{
  const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
  for(const host of ['claude','codex']){
    const dispatch=createDispatcher({host});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'review-checks-test',version:'1'}}});
    dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
    const call=argumentsValue=>dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_final_result',arguments:argumentsValue}}).result;
    const accepted=call(submission());assert.equal(accepted.isError,undefined);assert.deepEqual(accepted.structuredContent,v.finalReviewSubmission(submission()));
    const legacy={...submission(),requirement_review:'A short review.',claim_review:'A short finding.',fact_review:'A short fact review.'};
    assert.equal(call(legacy).isError,true);assert.equal(call({...submission(),fact_review:legacy.fact_review}).isError,true);
    assert.equal(call({...submission(),claim_review:{actors_targets:'pass'}}).isError,true);
  }
});
