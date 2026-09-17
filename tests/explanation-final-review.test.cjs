'use strict';
// Format and receipt boundaries only; actual native semantic review is separate.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{canonical,digest}=require('../scripts/verification-packet.cjs');
const review=()=>({challenge:'a'.repeat(64),final_decision:'approve_explanation',requirement_review:'The requested mechanism, two reads and final value are covered.',
  claim_review:'The proposed reading operation and unchanged value match the supplied definition.',fact_review:'The independent factual answer preserves the original definition and the two read outcomes.',checked_questions:['Q1'],issues:[]});
const issue={quote:'A supplied claim',reason:'Its scope contradicts the original evidence.',evidence_needed:'A correctly scoped statement.'};
test('a final submission is a dedicated review rather than a copied proposed explanation',()=>{
  const input=review(),reply=v.resultSubmission(input,'final');assert.equal(reply.result.kind,'final');assert.equal(reply.result.verdict,'complete');
  assert.deepEqual(JSON.parse(reply.result.answer),{requirement_review:input.requirement_review,claim_review:input.claim_review,fact_review:input.fact_review});
  assert.deepEqual(JSON.parse(reply.final_text),reply.result);assert.deepEqual(input,review());assert.deepEqual(reply.result.checked_questions,['Q1']);
  assert.throws(()=>v.resultSubmission({challenge:input.challenge,verdict:'complete',answer:'The complete copied user explanation.',checked_questions:['Q1'],issues:[]},'final'),/invalid_fields/);
  const withheld=v.resultSubmission({...input,final_decision:'revise_explanation',issues:[issue]},'final');assert.equal(withheld.result.verdict,'withheld');assert.deepEqual(withheld.result.issues,[issue]);
});
test('each review, exact decision and checked question is mandatory under the existing result limits',()=>{
  const tool=v.resultTools.find(t=>t.name==='explanation_final_result'),input=review();
  const keys=['essential_requirements','reader_format','actors_targets','conditions_outcomes','timing_negation','guarantees_scope_costs','fact_source_support','fact_computed_outcomes','fact_internal_consistency'];
  assert.deepEqual(tool.inputSchema.required,['challenge','final_decision',...keys,'checked_questions']);
  assert.equal(tool.inputSchema.additionalProperties,false);assert.equal(tool.inputSchema.properties.answer,undefined);
  const flat={challenge:input.challenge,final_decision:input.final_decision,...Object.fromEntries(keys.map(key=>[key,'pass'])),checked_questions:input.checked_questions,issues:[],fact_issues:[]};
  for(const field of tool.inputSchema.required.filter(key=>key!=='fact_issues')){const missing={...flat};delete missing[field];assert.throws(()=>v.resultSubmission(missing,'final'));}
  const previous={...flat};delete previous.fact_issues;assert.deepEqual(v.resultSubmission(previous,'final'),v.resultSubmission(flat,'final'));
  for(const field of ['requirement_review','claim_review','fact_review']){const missing={...input};delete missing[field];assert.throws(()=>v.resultSubmission(missing,'final'));}
  for(const field of ['requirement_review','claim_review','fact_review'])for(const value of ['',null,'x'.repeat(2001),'bad\ud800','bad\u202etext','sk-'+'SYNTHETIC'.repeat(4)])assert.throws(()=>v.resultSubmission({...input,[field]:value},'final'));
  for(const decision of ['complete','withheld','approve_notice',true])assert.throws(()=>v.resultSubmission({...input,final_decision:decision},'final'));
  assert.throws(()=>v.resultSubmission({...input,checked_questions:[]},'final'));
  assert.throws(()=>v.resultSubmission({...input,checked_questions:['Q1','Q1']},'final'));
  assert.throws(()=>v.resultSubmission({...input,final_decision:'revise_explanation'},'final'),/missing_failure_reason/);
  assert.throws(()=>v.resultSubmission({...input,issues:[issue]},'final'),/unresolved_claim/);
  let invoked=0;const accessor={...input};Object.defineProperty(accessor,'claim_review',{enumerable:true,get(){invoked++;return 'Unsafe';}});assert.throws(()=>v.resultSubmission(accessor,'final'));assert.equal(invoked,0);
});
test('changes in any review are bound into the result returned to the host',()=>{
  const input=review(),result=v.resultSubmission(input,'final').result;
  for(const field of ['requirement_review','claim_review','fact_review']){
    const changed=v.resultSubmission({...input,[field]:'A changed review finding.'},'final').result;assert.notEqual(digest(changed),digest(result));
    assert.notEqual(canonical(changed),canonical(result));
  }
});
test('review summaries are bounded independently of the complete issue evidence and never truncated',()=>{
  for(const field of ['requirement_review','claim_review','fact_review']){
    const exact={...review(),[field]:'x'.repeat(400)},accepted=v.resultSubmission(exact,'final');assert.equal(JSON.parse(accepted.result.answer)[field],exact[field]);
    assert.throws(()=>v.resultSubmission({...exact,[field]:'x'.repeat(401)},'final'),/content_rejected/);
    assert.throws(()=>v.resultSubmission({...exact,[field]:'가'.repeat(134)},'final'),/content_rejected/);
    assert.equal(Object.hasOwn(v.resultTools.find(t=>t.name==='explanation_final_result').inputSchema.properties,field),false);
  }
  const detailed={...review(),final_decision:'revise_explanation',issues:[{...issue,reason:'r'.repeat(1900),evidence_needed:'e'.repeat(900)}]};
  const reply=v.resultSubmission(detailed,'final');assert.deepEqual(reply.result.issues,detailed.issues);assert.equal(reply.result.verdict,'withheld');
});
