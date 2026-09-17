'use strict';
// Execute published recipes with real packet/submission compilers and synthetic
// native transport. Actual host behavior is a separate release diagnostic.
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../scripts/explanation-verification.cjs'),a=require('../scripts/explanation-attempt.cjs');
const binding={attempt_id:'11111111-1111-4111-8111-111111111200',candidate_sha256:'a'.repeat(64)};
const request='Explain the fictional register and give its measured slowdown. No measurements are supplied.';
function setup(purpose,verdict='complete'){
  const assessment=v.prepareAssessment({...binding,request}),gap={requirement:'Measured slowdown',request_quote:'give its measured slowdown',reason:'missing_evidence',evidence_needed:'Matched baseline and mitigation measurements for this workload.'};
  const submitted=v.resultSubmission({challenge:assessment.packets[0].challenge,assessment_decision:'assessed',gap_review:'The requested measurement is absent.',essential_gaps:[gap],corrections:[],issues:[]},'assessment');
  if(purpose==='request_assessment')return {plan:assessment,packet:assessment.packets[0],submitted};
  const compiled=a.noticeFromAssessment({...binding,assessment_result:submitted.result,language:'en'},request,submitted.result);
  const plan=compiled.proposal.review,packet=plan.packet;
  return {plan,packet,submitted:v.resultSubmission({challenge:packet.challenge,notice_decision:verdict==='complete'?'approve_notice':'revise_notice',
    requirement_review:'Review the actual missing measurement.',evidence_review:'Review the matched benchmark request.',assessment_review:'There is no requested draft correction.',checked_questions:[v.assessmentId],
    issues:verdict==='complete'?[]:[{quote:'Matched baseline and mitigation measurements',reason:'Specify the same measurement unit.',evidence_needed:'State a matched unit for both measurements.'}]},'notice')};
}
async function execute(purpose,{verdict='complete',alter=()=>{}}={}){
  const f=setup(purpose,verdict),wire=v.dispatchPacket(f.plan,f.packet,{...binding,challenge:f.packet.challenge});
  let held,printed;const calls=[];
  const observed=v.resultRead({...binding,challenge:f.packet.challenge,result:f.submitted.result},purpose==='withholding'&&verdict==='complete'?f.packet:undefined);
  alter(observed,wire);
  const tools={
    mcp__ttak_scenario__explanation_dispatch:async()=>{calls.push('dispatch');return {structuredContent:wire};},
    multi_agent_v1__spawn_agent:async input=>{assert.deepEqual(input,wire.native_spawn);calls.push('spawn');return {agent_id:'one-verifier'};},
    multi_agent_v1__wait_agent:async input=>{assert.deepEqual(input,{targets:['one-verifier'],timeout_ms:60000});calls.push('wait');return {timed_out:false,status:{'one-verifier':{completed:f.submitted.receipt_text}}};},
    multi_agent_v1__close_agent:async input=>{assert.deepEqual(input,{target:'one-verifier'});calls.push('close');},
    mcp__ttak_scenario__explanation_result:async input=>{assert.deepEqual(input,{...binding,challenge:f.packet.challenge});calls.push('read');return {structuredContent:observed};}
  };
  const source=v.nativeAdapter('codex',purpose,f.packet).spawn_agent_code;
  try{await Object.getPrototypeOf(async function(){}).constructor('tools','load','store','text',source)(tools,()=>held,(key,value)=>{held=value;calls.push('store');},value=>{printed=value;calls.push('print');});}
  catch(error){assert.equal(held,undefined);assert.equal(printed,undefined);assert.equal(calls.filter(c=>c==='close').length,1);throw error;}
  return {held,printed,calls,source};
}
test('assessment recipe cannot accidentally certify a notice and retains its distinct result',async()=>{
  const h=await execute('request_assessment');
  assert.equal(h.printed.delivery_status,'unverified');assert.equal(h.held.assessment.result.kind,'fact');assert.equal(h.held.final,undefined);
  assert.doesNotMatch(h.source,/expectedNoticeStatus/);
});
test('notice recipe handles approval and revision explicitly and preserves the exact delivered notice',async()=>{
  for(const verdict of ['complete','withheld']){
    const h=await execute('withholding',{verdict});
    assert.equal(h.printed.delivery_status,verdict==='complete'?'approved_withholding_notice':'unverified');
    assert.equal(h.held.final.result.verdict,verdict);
    if(verdict==='complete')assert.equal(h.printed.delivery.final_text,h.held.final.final_text);
    else assert.equal(h.printed.delivery,undefined);
    assert.deepEqual(h.calls,['dispatch','spawn','wait','close','read','store','print']);
    assert.match(h.source,/const expectedNoticeStatus/);assert.doesNotMatch(h.source,/held\.assessment =/);
  }
});
test('wrong approval status, final body, scope, binding or packet purpose never retains or prints approval',async()=>{
  for(const alter of [o=>{o.delivery_status='unverified';},o=>{o.delivery_status='approved_explanation';},
    o=>{o.delivery.final_text+='changed';},o=>{o.delivery.scope='explanation';},o=>{o.result_sha256='b'.repeat(64);},
    o=>{o.result.challenge='b'.repeat(64);},o=>{o.result.kind='fact';},
    (o,w)=>{const at=w.native_spawn.message.indexOf('\n'),body=JSON.parse(w.native_spawn.message.slice(at+1));body.data.purpose='request_assessment';w.native_spawn.message=w.native_spawn.message.slice(0,at+1)+JSON.stringify(body);}])
    await assert.rejects(execute('withholding',{alter}));
  await assert.rejects(execute('request_assessment',{alter:o=>{o.delivery_status='approved_withholding_notice';}}));
});
