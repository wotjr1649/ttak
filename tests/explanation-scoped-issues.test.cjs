'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),{scopeReviewIssues}=require('../scripts/explanation-review-checks.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs'),{canonical}=require('../scripts/verification-packet.cjs');
const factKeys=['source_support','computed_outcomes','internal_consistency'],normalKeys=['essential_requirements','reader_format','actors_targets','conditions_outcomes','timing_negation','guarantees_scope_costs'];
const issue=n=>({quote:'Statement '+n,reason:'Concrete defect '+n,evidence_needed:'Supported correction '+n});
function input(){
  return {challenge:'a'.repeat(64),final_decision:'approve_explanation',...Object.fromEntries([...normalKeys,...factKeys.map(k=>'fact_'+k)].map(k=>[k,'pass'])),
    checked_questions:['REQUEST_FACTS'],issues:[],fact_issues:[]};
}
test('public final schema keeps fact findings in their own checks and preserves the legacy scoped result contract',()=>{
  const schema=v.resultTools.find(t=>t.name==='explanation_final_result').inputSchema;
  assert.deepEqual(schema.required,['challenge','final_decision',...normalKeys,...factKeys.map(k=>'fact_'+k),'checked_questions']);
  for(const key of factKeys){assert.equal(schema.properties['fact_'+key].anyOf[1].items.type,'object');assert.match(schema.properties['fact_'+key].description,/actual fact answer/);}
  const approved=v.finalReviewSubmission(input());assert.equal(approved.result.verdict,'complete');assert.deepEqual(approved.result.issues,[]);
  assert.equal(Object.keys(approved.result).length,7);assert.equal(Object.hasOwn(approved.result,'fact_issues'),false);
});
test('the observed177 index cannot refer from an empty fact list to final issue0',()=>{
  for(const key of factKeys){
    const args={...input(),final_decision:'revise_explanation',conditions_outcomes:[0],issues:[issue(0)],['fact_'+key]:[0]};
    assert.throws(()=>v.finalReviewSubmission(args));
    args['fact_'+key]='pass';assert.equal(v.finalReviewSubmission(args).result.verdict,'withheld');
  }
  const reversed={...input(),final_decision:'revise_explanation',fact_computed_outcomes:[0],fact_issues:[issue(0)],conditions_outcomes:[0]};
  assert.throws(()=>v.finalReviewSubmission(reversed));reversed.conditions_outcomes='pass';assert.equal(v.finalReviewSubmission(reversed).result.verdict,'withheld');
});
test('source-local indices map losslessly to the unchanged canonical result and retain both concrete defects',()=>{
  const args={...input(),final_decision:'revise_explanation',conditions_outcomes:[0],fact_computed_outcomes:[0],issues:[issue('final')],fact_issues:[issue('fact')]},before=canonical(args);
  const grouped=reviewChecks();grouped.claim_review.conditions_outcomes=[0];grouped.fact_review.computed_outcomes=[1];
  const expected=v.finalReviewSubmission({challenge:args.challenge,final_decision:args.final_decision,...grouped,checked_questions:args.checked_questions,issues:[issue('final'),issue('fact')]});
  assert.deepEqual(v.finalReviewSubmission(args),expected);assert.deepEqual(v.resultSubmission(args,'final'),expected);assert.equal(canonical(args),before);
});
test('identical cross-source findings retain all links without duplicating their exact canonical evidence',()=>{
  const args={...input(),final_decision:'revise_explanation',actors_targets:[0],fact_internal_consistency:[0],issues:[issue(0)],fact_issues:[structuredClone(issue(0))]};
  const grouped=reviewChecks();grouped.claim_review.actors_targets=[0];grouped.fact_review.internal_consistency=[0];
  const expected=v.finalReviewSubmission({challenge:args.challenge,final_decision:args.final_decision,...grouped,checked_questions:args.checked_questions,issues:[issue(0)]});
  assert.deepEqual(v.finalReviewSubmission(args),expected);
  const different={...args,fact_issues:[{...issue(0),reason:'A different concrete reason.'}]};assert.equal(v.finalReviewSubmission(different).result.issues.length,2);
});
test('each source list and its indices must be complete, unique, in range and correctly typed',()=>{
  for(const fields of [{list:'issues',key:'conditions_outcomes'},{list:'fact_issues',key:'fact_computed_outcomes'}]){
    const valid={...input(),final_decision:'revise_explanation',[fields.list]:[issue(0)],[fields.key]:[0]};
    for(const bad of [[],[0,0],[-1],[1],[0.5],['0'],null,true,'fail'])assert.throws(()=>v.finalReviewSubmission({...valid,[fields.key]:bad}));
    assert.throws(()=>v.finalReviewSubmission({...valid,[fields.key]:'pass'}));
    assert.throws(()=>v.finalReviewSubmission({...valid,[fields.list]:[issue(0),issue(0)],[fields.key]:[0,1]}));
    assert.throws(()=>v.finalReviewSubmission({...valid,[fields.list]:[issue(0),issue(1)]}));
    assert.throws(()=>v.finalReviewSubmission({...valid,final_decision:'approve_explanation'}));
  }
  for(const bad of [null,{},'none',false])assert.throws(()=>v.finalReviewSubmission({...input(),fact_issues:bad}));
});
test('global16-issue and existing result limits remain even when two local domains are used',()=>{
  const finalIssues=Array.from({length:8},(_,i)=>issue(i)),factIssues=Array.from({length:8},(_,i)=>issue(i+8));
  const args={...input(),final_decision:'revise_explanation',issues:finalIssues,fact_issues:factIssues,conditions_outcomes:finalIssues.map((_,i)=>i),fact_computed_outcomes:factIssues.map((_,i)=>i)};
  assert.equal(v.finalReviewSubmission(args).result.issues.length,16);
  assert.throws(()=>v.finalReviewSubmission({...args,fact_issues:[...factIssues,issue(16)],fact_computed_outcomes:[...args.fact_computed_outcomes,8]}));
  const shared=Array.from({length:16},(_,i)=>issue(i)),indices=shared.map((_,i)=>i);
  assert.equal(v.finalReviewSubmission({...args,issues:shared,fact_issues:shared,conditions_outcomes:indices,fact_computed_outcomes:indices}).result.issues.length,16);
  assert.throws(()=>v.finalReviewSubmission({...args,issues:finalIssues.map(x=>({...x,reason:'r'.repeat(2001)}))}));
});
test('legacy exact formats remain parseable, but a new source list cannot be mixed into legacy shapes',()=>{
  const legacy={challenge:'a'.repeat(64),final_decision:'approve_explanation',...reviewChecks(),checked_questions:['REQUEST_FACTS'],issues:[]};
  const oldFlat={...input()};delete oldFlat.fact_issues;
  assert.deepEqual(v.finalReviewSubmission(legacy),v.finalReviewSubmission(input()));assert.deepEqual(v.finalReviewSubmission(oldFlat),v.finalReviewSubmission(input()));
  assert.throws(()=>v.finalReviewSubmission({...legacy,fact_issues:[]}));
  const mixed={...input(),source_support:'pass'};delete mixed.fact_source_support;assert.throws(()=>v.finalReviewSubmission(mixed));
  assert.throws(()=>v.finalReviewSubmission({...input(),extra:true}));
});
test('accessors, dangerous object fields and possible secrets never execute or reach a returned issue',()=>{
  let calls=0;const args=input();Object.defineProperty(args,'fact_issues',{enumerable:true,get(){calls++;return [];}});
  assert.throws(()=>v.finalReviewSubmission(args));assert.equal(calls,0);
  const unsafe={...input(),final_decision:'revise_explanation',fact_computed_outcomes:[0],fact_issues:[{...issue(0),reason:'sk-'+'SYNTHETIC'.repeat(4)}]};
  assert.throws(()=>v.finalReviewSubmission(unsafe));
  assert.throws(()=>scopeReviewIssues(reviewChecks(),[],JSON.parse('[{"__proto__":{}}]')));
});
