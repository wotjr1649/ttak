'use strict';
// The same nine check outcomes and issues must compile identically, not become a new certificate.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),checks=require('../scripts/explanation-review-checks.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs'),{canonical,digest}=require('../scripts/verification-packet.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const keys=['essential_requirements','reader_format','actors_targets','conditions_outcomes','timing_negation','guarantees_scope_costs','fact_source_support','fact_computed_outcomes','fact_internal_consistency'];
const grouped=()=>({challenge:'a'.repeat(64),final_decision:'approve_explanation',...reviewChecks(),checked_questions:['REQUEST_FACTS'],issues:[]});
function flatten(input){const {requirement_review,claim_review,fact_review,...rest}=input;return {...rest,...requirement_review,...claim_review,...Object.fromEntries(Object.entries(fact_review).map(([key,value])=>['fact_'+key,value])),fact_issues:Object.values(fact_review).some(value=>value!=='pass')?input.issues:[]};}
const issue=n=>({quote:'Claim'+n,reason:'A concrete contradictory outcome'+n,evidence_needed:'A supported correction'+n});
test('flat schema retains all nine required dimensions and exact original per-check domains',()=>{
  const schema=checks.flatReviewSchema();assert.deepEqual(schema.required,keys);assert.equal(schema.additionalProperties,false);
  const expected={};for(const group of ['requirement_review','claim_review','fact_review'])for(const [key,schema]of Object.entries(checks.reviewSchema(group).properties))expected[group==='fact_review'?'fact_'+key:key]=schema;
  assert.deepEqual(schema.properties,expected);assert.deepEqual(Object.keys(schema.properties),keys);
  const tool=v.resultTools.find(t=>t.name==='explanation_final_result');assert.deepEqual(tool.inputSchema.required,['challenge','final_decision',...keys,'checked_questions']);
  for(const key of keys){
    assert.ok(tool.inputSchema.properties[key].description.startsWith(expected[key].description.split(' After checking,')[0]));
    assert.deepEqual(tool.inputSchema.properties[key].anyOf[0],expected[key].anyOf[0]);
    assert.equal(tool.inputSchema.properties[key].anyOf[1].items.type,'object');
  }
  for(const group of ['requirement_review','claim_review','fact_review'])assert.equal(Object.hasOwn(tool.inputSchema.properties,group),false);
});
test('flat approvals and every negative issue assignment are lossless equivalents of strict grouped checks',()=>{
  for(const count of [0,1,16]){
    const input=grouped();input.issues=Array.from({length:count},(_,n)=>issue(n));if(count)input.final_decision='revise_explanation';
    for(const group of ['requirement_review','claim_review','fact_review'])for(const key of Object.keys(input[group]))if(count)input[group][key]=Array.from({length:count},(_,n)=>n);
    const flat=flatten(input),before=canonical(flat),legacy=v.finalReviewSubmission(input),result=v.finalReviewSubmission(flat);
    assert.deepEqual(result,legacy);assert.deepEqual(v.resultSubmission(flat,'final'),legacy);assert.equal(canonical(flat),before);
    assert.equal(Object.keys(result.result).length,7);assert.equal(JSON.parse(result.receipt_text).result_sha256,digest(result.result));
    for(const value of Object.values(JSON.parse(result.result.answer)))assert.ok(Buffer.byteLength(value)<=400);
  }
});
test('each flat field remains mandatory and mixed grouped/flat, coercions and bad indices are rejected',()=>{
  const input=flatten(grouped());
  for(const key of keys){const missing={...input};delete missing[key];assert.throws(()=>v.finalReviewSubmission(missing));
    for(const bad of ['fail','pending','PASS',true,null,0,[],[0],[-1],[16],[0.5],['0']])assert.throws(()=>v.finalReviewSubmission({...input,[key]:bad}));}
  for(const group of ['requirement_review','claim_review','fact_review'])assert.throws(()=>v.finalReviewSubmission({...input,[group]:reviewChecks()[group]}));
  assert.throws(()=>v.finalReviewSubmission({...grouped(),conditions_outcomes:[0]}));assert.throws(()=>v.finalReviewSubmission({...input,extra:true}));
  assert.throws(()=>v.finalReviewSubmission({...input,issues:[issue(0)]}));
  assert.throws(()=>v.finalReviewSubmission({...input,conditions_outcomes:[0],issues:[issue(0)]}));
  assert.throws(()=>v.finalReviewSubmission({...input,final_decision:'revise_explanation'}));
  assert.throws(()=>v.finalReviewSubmission({...input,final_decision:'revise_explanation',conditions_outcomes:[0,0],issues:[issue(0)]}));
  const all=Object.fromEntries(keys.map(key=>[key,'pass']));let invoked=0;Object.defineProperty(all,'actors_targets',{enumerable:true,get(){invoked++;return 'pass';}});
  assert.throws(()=>checks.expandReviewChecks(all));assert.equal(invoked,0);
  assert.throws(()=>v.finalReviewSubmission({...input,issues:[{...issue(0),reason:'sk-'+'SYNTHETIC'.repeat(4)}]}));
});
test('the observed168 malformed parameter fragments remain invalid; they are not normalized into flat approvals',()=>{
  for(const reader_format of [[0],'pass']){
    const bad={challenge:'a'.repeat(64),final_decision:'revise_explanation',requirement_review:'\n<parameter name="essential_requirements">[0]',reader_format};
    assert.throws(()=>v.finalReviewSubmission(bad));assert.throws(()=>v.resultSubmission(bad,'final'));
  }
});
for(const host of ['claude','codex'])test(host+' actual MCP advertises and compiles flat negative decisions without dropping the exact issue',()=>{
  const d=createDispatcher({host});d({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'flat-final',version:'1'}}});d({jsonrpc:'2.0',method:'notifications/initialized'});
  const tools=d({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}).result.tools;
  assert.deepEqual(tools.find(t=>t.name==='explanation_final_result').inputSchema,v.resultTools.find(t=>t.name==='explanation_final_result').inputSchema);
  const args={...flatten(grouped()),final_decision:'revise_explanation',conditions_outcomes:[0],issues:[issue(0)]};
  const call=input=>d({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'explanation_final_result',arguments:input}}).result;
  const reply=call(args);assert.equal(reply.isError,undefined);assert.deepEqual(reply.structuredContent,v.finalReviewSubmission(args));assert.equal(reply.structuredContent.result.verdict,'withheld');
  assert.equal(call({...args,conditions_outcomes:'pass'}).isError,true);assert.equal(call({...args,issues:[]}).isError,true);
  const binding={attempt_id:'11111111-1111-4111-8111-111111111169',candidate_sha256:'b'.repeat(64)},request='Explain a fictional register whose read returns5 without changing5.';
  const plan=v.prepare({...binding,request}),fact=v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',answer:'Reading returns5 and keeps5.',issues:[]},'fact').result;
  const final=v.finalize({...binding,request,final_text:'Reading changes5 to9.',facts:[{id:'REQUEST_FACTS',result:fact}],revision:0}),body=JSON.parse(final.packet.prompt.slice(final.packet.prompt.indexOf('\n')+1));
  assert.equal(body.data.final_text,'Reading changes5 to9.');assert.equal(Object.keys(body.data).at(-1),'final_text');assert.equal(body.data.request,request);
  assert.deepEqual(body.submission.input_schema.required,['challenge','final_decision',...keys,'checked_questions']);assert.equal(final.complete_authorized,false);
});
