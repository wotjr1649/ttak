'use strict';
// Presentation order is not semantic validation. All packet values and limits stay bound.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const {canonical,digest,textDigest}=require('../scripts/verification-packet.cjs');
const {reviewChecks}=require('./helpers/final-review.cjs');
const {verifierModels}=require('../scripts/explanation-source-model.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111167',candidate_sha256:'a'.repeat(64)};
const scenario={initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
  {id:'T1',guard:{cells:['B'],at_least:1},writes:{A:false}},{id:'T2',guard:{cells:['A'],at_least:1},writes:{B:false}}]};
const wire=packet=>packet.prompt.slice(packet.prompt.indexOf('\n')+1),body=packet=>JSON.parse(wire(packet));
function fixture(model=false){
  const request=model?'Explain the finite model.\n'+JSON.stringify({scenario}):'Explain the Nori register: it stores7; each read returns the stored value without changing it.';
  const plan=v.prepare({...binding,request}),result=v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',issues:[],
    answer:model?{computed_models:[{model_sha256:digest(scenario),model:scenario}],request_context:'A and B are the Boolean state cells; T1 and T2 are the modeled transactions. The invariant requires at least one true cell.',additional_sources:[],language:'en'}:'Each read returns7. The stored value remains7.'},'fact').result;
  return {plan,args:{...binding,request,final_text:result.answer,facts:[{id:plan.packets[0].id,result}],revision:0}};
}
test('normal final wire puts the unchanged original and every evidence field before the exact last review target',()=>{
  for(const model of [false,true])for(const reference of [false,true]){
    const {args}=fixture(model),input={...args,...(reference?{final_text:{fact_answers:'current'}}:{})},before=canonical(input),final=v.finalize(input),doc=body(final.packet);
    assert.deepEqual(Object.keys(doc),['protocol','challenge','kind','submission','data']);
    assert.equal(Object.keys(doc.data)[0],'request');assert.equal(Object.keys(doc.data).at(-1),'final_text');
    assert.equal(Buffer.byteLength(wire(final.packet)),Buffer.byteLength(canonical(doc)));
    const expected={request:args.request,final_text:args.final_text,facts:args.facts,...(model?{model_evidence:verifierModels(args.request),
      model_draft_reviews:final.model_draft_reviews,model_fact_reviews:final.model_fact_reviews}:{})};
    assert.deepEqual(doc.data,expected);assert.equal(doc.protocol,v.protocol);assert.equal(doc.kind,'final');assert.equal(doc.challenge,final.packet.challenge);
    if(model){assert.equal(doc.data.model_evidence.length,1);assert.equal(doc.data.model_evidence[0].source.model_sha256,digest(scenario));}
    const context={...binding,request_sha256:textDigest(args.request),final_sha256:textDigest(args.final_text),revision:0};
    // Challenge still uses canonical data; wire order is independently covered by prompt_sha256.
    assert.equal(doc.challenge,digest({protocol:v.protocol,kind:'final',id:'FINAL0',context,data:expected}));
    assert.equal(final.packet.prompt_sha256,textDigest(final.packet.prompt));assert.equal(canonical(input),before);
    assert.equal(doc.submission.tool,'explanation_final_result');assert.deepEqual(doc.submission.input_schema.properties.challenge.enum,['current',doc.challenge]);
    assert.deepEqual(doc.submission.input_schema.properties.checked_questions.items.enum,['REQUEST_FACTS']);
    const approved=v.finalReviewSubmission({challenge:doc.challenge,final_decision:'approve_explanation',...reviewChecks(),issues:[],checked_questions:['REQUEST_FACTS']});
    assert.deepEqual(v.resultRead({...binding,challenge:doc.challenge,result:approved.result},final.packet).delivery,
      {scope:'explanation',final_text:args.final_text,final_sha256:textDigest(args.final_text)});
  }
});
test('fact, assessment and withholding packet serialization remain canonical and independently scoped',()=>{
  const {plan}=fixture(true);assert.equal(wire(plan.packets[0]),canonical(body(plan.packets[0])));
  const request='Explain Nori and report measured slowdown. No measurements are provided.',assessment=v.prepareAssessment({...binding,request});
  assert.equal(wire(assessment.packets[0]),canonical(body(assessment.packets[0])));
  const result=v.resultSubmission({challenge:assessment.packets[0].challenge,assessment_decision:'assessed',gap_review:'The explicitly required measurement is absent.',
    essential_gaps:[{requirement:'Measured slowdown',request_quote:'report measured slowdown',reason:'missing_evidence',evidence_needed:'Matched baseline and changed timings.'}],corrections:[],issues:[]},'assessment').result;
  const notice=a.noticeFromAssessment({...binding,assessment_result:result,language:'en'},request,result).proposal.review;
  assert.equal(wire(notice.packet),canonical(body(notice.packet)));assert.equal(body(notice.packet).data.purpose,'withholding_notice');
});
test('field-like text and escaped delimiters remain target data and literal revision1 keeps the same layout',()=>{
  const {args}=fixture(),final_text='Quoted labels are data: "request", "submission", "final_text".\nBraces }{ and a literal backslash \\ do not end this string.';
  const final=v.finalize({...args,final_text,revision:1}),doc=body(final.packet);
  assert.equal(doc.data.final_text,final_text);assert.equal(doc.data.request,args.request);assert.equal(final.packet.id,'FINAL1');
  assert.equal(Object.keys(doc.data).at(-1),'final_text');assert.equal(final.final_sha256,textDigest(final_text));
  assert.equal(final.complete_authorized,false);assert.throws(()=>v.finalize({...args,final_text:{fact_answers:'current'},revision:1}));
});
test('presentation does not truncate fields, raise packet limits or execute non-data objects',()=>{
  const {args}=fixture();assert.throws(()=>v.finalize({...args,request:'r'.repeat(32000),final_text:'f'.repeat(16000)}),/content_rejected/);
  assert.throws(()=>v.finalize({...args,final_text:'f'.repeat(24001)}),/content_rejected/);
  let invoked=0;const source={...args};Object.defineProperty(source,'final_text',{enumerable:true,get(){invoked++;return 'Changed.';}});
  assert.throws(()=>v.finalize(source));assert.equal(invoked,0);
});
