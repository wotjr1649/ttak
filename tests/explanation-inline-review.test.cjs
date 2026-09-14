'use strict';
// Concrete findings remain data; the compiler only constructs their check links.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs');
const {compileInlineReviewChecks}=require('../scripts/explanation-review-checks.cjs');
const {canonical}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const keys=['essential_requirements','reader_format','actors_targets','conditions_outcomes','timing_negation','guarantees_scope_costs',
  'fact_source_support','fact_computed_outcomes','fact_internal_consistency'];
const passed=()=>Object.fromEntries(keys.map(key=>[key,'pass']));
const issue=n=>({quote:'Exact clause '+n,reason:'Concrete defect '+n,evidence_needed:'Correct the identified clause '+n});
const input=()=>({challenge:'a'.repeat(64),final_decision:'approve_explanation',...passed(),checked_questions:['REQUEST_FACTS']});

test('all nine inline checks remain explicit and produce the same bounded all-pass result',()=>{
  const schema=v.resultTools.find(t=>t.name==='explanation_final_result').inputSchema;
  assert.deepEqual(schema.required,['challenge','final_decision',...keys,'checked_questions']);
  assert.equal(schema.additionalProperties,false);assert.equal(Object.hasOwn(schema.properties,'issues'),false);
  for(const key of keys){
    const cards=schema.properties[key].anyOf.find(s=>s.type==='array');
    assert.equal(cards.items.type,'object');assert.deepEqual(cards.items.required,['quote','reason','evidence_needed']);
    assert.equal(cards.items.additionalProperties,false);
  }
  const value=input(),before=canonical(value),actual=v.finalReviewSubmission(value);
  assert.deepEqual(actual,v.finalReviewSubmission({...value,issues:[],fact_issues:[]}));
  assert.equal(actual.result.verdict,'complete');assert.equal(canonical(value),before);
  for(const field of Object.values(JSON.parse(actual.result.answer)))assert.ok(Buffer.byteLength(field)<=400);
});

test('complete findings are preserved and linked across checks without caller-assigned numbers',()=>{
  const first=issue(0),second=issue(1),fact=issue(2);
  const value={...input(),final_decision:'revise_explanation',essential_requirements:[first,second],reader_format:[first],fact_source_support:[fact]};
  const before=canonical(value),result=v.finalReviewSubmission(value).result,reviews=JSON.parse(result.answer);
  assert.deepEqual(result.issues,[first,second,fact]);assert.equal(result.verdict,'withheld');
  assert.deepEqual(JSON.parse(reviews.requirement_review),{essential_requirements:[0,1],reader_format:[0]});
  assert.deepEqual(JSON.parse(reviews.fact_review),{computed_outcomes:'pass',internal_consistency:'pass',source_support:[2]});
  assert.equal(canonical(value),before);
  const shared=compileInlineReviewChecks({...passed(),actors_targets:[first],fact_internal_consistency:[structuredClone(first)]});
  assert.deepEqual(shared.issues,[first]);assert.deepEqual(shared.checks.claim_review.actors_targets,[0]);assert.deepEqual(shared.checks.fact_review.internal_consistency,[0]);
});

test('invalid legacy indices, missing checks, approval conflicts and executable data remain rejected',()=>{
  for(const changed of [{essential_requirements:[4]},{essential_requirements:[]},{essential_requirements:[{...issue(0),extra:true}]},
    {essential_requirements:[issue(0),issue(0)]},{essential_requirements:[issue(0)]},{final_decision:'revise_explanation'},
    {essential_requirements:'pass '},{extra:true}])assert.throws(()=>v.finalReviewSubmission({...input(),...changed}));
  const missing=input();delete missing.reader_format;assert.throws(()=>v.finalReviewSubmission(missing));
  const legacy={...input(),final_decision:'revise_explanation',essential_requirements:[0,1,2,4],issues:[issue(0),issue(1),issue(2),issue(3)],fact_issues:[]};
  assert.throws(()=>v.finalReviewSubmission(legacy),/invalid_integer/);
  let executed=0;const getter=issue(0);Object.defineProperty(getter,'reason',{enumerable:true,get(){executed++;return 'Bad';}});
  assert.throws(()=>v.finalReviewSubmission({...input(),final_decision:'revise_explanation',actors_targets:[getter]}));assert.equal(executed,0);
});

test('global issue capacity and secret/content bounds are unchanged; no finding is silently removed',()=>{
  const cards=Array.from({length:16},(_,n)=>issue(n));
  const value={...input(),final_decision:'revise_explanation',actors_targets:cards};
  assert.equal(v.finalReviewSubmission(value).result.issues.length,16);
  assert.throws(()=>v.finalReviewSubmission({...value,conditions_outcomes:[issue(16)]}));
  assert.throws(()=>v.finalReviewSubmission({...value,actors_targets:[{...issue(0),quote:'x'.repeat(1501)}]}));
  assert.throws(()=>v.finalReviewSubmission({...value,actors_targets:[{...issue(0),quote:'sk-'+'SYNTHETIC'.repeat(4)}]}));
});

for(const host of ['claude','codex'])test(host+' actual MCP accepts concrete per-check findings and never turns them into approval',()=>{
  const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'inline-review',version:'1'}}});
  d({jsonrpc:'2.0',method:'notifications/initialized'});
  const invoke=value=>d({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_final_result',arguments:value}}).result;
  const value={...input(),final_decision:'revise_explanation',reader_format:[issue(0)]},response=invoke(value);
  assert.equal(response.isError,undefined);assert.deepEqual(response.structuredContent,v.finalReviewSubmission(value));
  assert.equal(response.structuredContent.result.verdict,'withheld');
  assert.equal(invoke({...value,final_decision:'approve_explanation'}).isError,true);
});
