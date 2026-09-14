'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sourceModels,verifierModels}=require('../scripts/explanation-source-model.cjs');
const {analyzeScenario}=require('../scripts/finite-scenario.cjs'),{canonical,digest}=require('../scripts/verification-packet.cjs');
const v=require('../scripts/explanation-verification.cjs');
const a=require('../scripts/explanation-attempt.cjs');
const model=()=>({initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
  {id:'T1',guard:{cells:['B'],at_least:1},writes:{A:false}},{id:'T2',guard:{cells:['A'],at_least:1},writes:{B:false}}]});
const request=value=>'Explain the supplied model and one remedy with its trade-off.\n'+JSON.stringify(value);
function verifySchedule(actual,expected,input,columns){
  assert.deepEqual(actual.order,expected.order);assert.equal(actual.invariant_preserved,expected.invariant_preserved);assert.equal(actual.steps.length,expected.steps.length);
  for(let i=0;i<actual.steps.length;i++){
    const step=actual.steps[i],source=expected.steps[i],transaction=input.transactions.find(t=>t.id===source.transaction);
    assert.deepEqual(step,{transaction:source.transaction,guard_read_values:source.observed,outcome:source.outcome,
      writes_applied:source.outcome==='committed'?transaction.writes:{},state_after:columns.map(name=>source.state[name]),invariant_holds:source.invariant_holds});
  }
  assert.deepEqual(actual.final_state,columns.map(name=>expected.final_state[name]));
}
test('witness rows bind each actor, actual reads, applied writes and post-state without a generated prose restatement',()=>{
  const input=model(),original=request({scenario:input,computed:'ATTACKER_RESULT'}),source=sourceModels(original)[0],entry=verifierModels(original)[0];
  assert.deepEqual(entry.source,source.source);assert.deepEqual(entry.model,input);assert.equal(entry.source.model_sha256,digest(input));
  assert.deepEqual(entry.computed.state_columns,['A','B']);assert.equal(entry.computed.explanation,undefined);assert.doesNotMatch(canonical(entry),/ATTACKER_RESULT/);
  const calculation=analyzeScenario(input);verifySchedule(entry.computed.concurrent_start_witness,calculation.concurrent_start_schedules[0],input,['A','B']);
  verifySchedule(entry.computed.serial_witness,calculation.serial_schedules[0],input,['A','B']);
  assert.deepEqual(entry.computed.serial_witness.steps[1].guard_read_values,{A:false});assert.deepEqual(entry.computed.serial_witness.steps[1].writes_applied,{});
  assert.deepEqual(entry.computed.serial_witness.steps[1].state_after,[false,true]);assert.equal(entry.computed.serial_witness.steps[1].outcome,'guard_false');
  assert.equal(entry.computed.real_database_verified,false);assert.equal(entry.computed.all_possible_interleavings_checked,false);
  assert.equal(entry.computed.concurrent_orders_checked,2);assert.equal(entry.computed.serial_orders_checked,2);
  assert.ok(Buffer.byteLength(canonical(entry))<Buffer.byteLength(canonical(source)));
});
test('witnesses recompute renamed and reordered models and select an actual violating schedule when present',()=>{
  const normal=model(),changed={initial:{ready:true,awake:true},invariant:{cells:['ready','awake'],at_least:1},transactions:[
    {id:'Beta',guard:{cells:['ready'],at_least:1},writes:{awake:false}},{id:'Alpha',guard:{cells:['awake'],at_least:1},writes:{ready:false}}]};
  for(const input of [normal,changed]){
    const entry=verifierModels(request(input))[0],calculation=analyzeScenario(input),columns=Object.keys(input.initial);
    assert.deepEqual(entry.computed.state_columns,columns);
    verifySchedule(entry.computed.concurrent_start_witness,calculation.concurrent_start_schedules.find(s=>!s.invariant_preserved)??calculation.concurrent_start_schedules[0],input,columns);
    verifySchedule(entry.computed.serial_witness,calculation.serial_schedules.find(s=>!s.invariant_preserved)??calculation.serial_schedules[0],input,columns);
    assert.equal(entry.computed.all_serial_orders_preserve_invariant,calculation.all_serial_orders_preserve_invariant);
  }
});
test('disabled guards, overlapping writes and unsafe serial orders retain their distinct computed outcomes',()=>{
  const disabled={initial:{A:true,B:false},invariant:{cells:['A'],at_least:1},transactions:[{id:'One',guard:{cells:['B'],at_least:1},writes:{A:false}}]};
  const overlap=model();overlap.transactions[1].writes={A:false};
  const unsafe=model();unsafe.transactions.forEach(t=>{t.guard={cells:[],at_least:0};});
  for(const input of [disabled,overlap,unsafe]){
    const entry=verifierModels(request(input))[0],calculation=analyzeScenario(input),columns=Object.keys(input.initial);
    verifySchedule(entry.computed.concurrent_start_witness,calculation.concurrent_start_schedules.find(s=>!s.invariant_preserved)??calculation.concurrent_start_schedules[0],input,columns);
    verifySchedule(entry.computed.serial_witness,calculation.serial_schedules.find(s=>!s.invariant_preserved)??calculation.serial_schedules[0],input,columns);
  }
  assert.equal(verifierModels(request(disabled))[0].computed.concurrent_start_witness.steps[0].outcome,'guard_false');
  assert.equal(verifierModels(request(overlap))[0].computed.concurrent_start_witness.steps[1].outcome,'write_conflict_abort');
  assert.equal(verifierModels(request(unsafe))[0].computed.all_serial_orders_preserve_invariant,false);
});
test('source limits and unsafe inputs still fail before projection, with no caller objects evaluated',()=>{
  assert.deepEqual(verifierModels('Explain a fictional register.'),[]);
  for(const original of [request(Array.from({length:5},model)),'x'.repeat(32001),request({scenario:model(),secret:'sk-'+'SYNTHETIC'.repeat(4)})])assert.throws(()=>verifierModels(original));
  let calls=0;assert.throws(()=>verifierModels({toString(){calls++;return request(model());}}));assert.equal(calls,0);
  const original=request(model()),a=verifierModels(original);a[0].computed.serial_witness.steps[0].state_after[1]=false;
  assert.equal(verifierModels(original)[0].computed.serial_witness.steps[0].state_after[1],true);
});
test('native fact and final packets use the projection while retaining the entire original and full parent evidence',()=>{
  const original=request({scenario:model(),source_conditions:'Implementation claims are conditional, not an obligation to explain every implementation.'});
  const args={attempt_id:'11111111-1111-4111-8111-111111111111',candidate_sha256:'a'.repeat(64),request:original},plan=v.prepare(args);
  const body=packet=>JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
  assert.deepEqual(plan.model_evidence,sourceModels(original));assert.deepEqual(body(plan.packets[0]).data.model_evidence,verifierModels(original));
  assert.equal(body(plan.packets[0]).data.original_request,original);
  const fact=v.resultSubmission({challenge:plan.packets[0].challenge,verdict:'answered',answer:'A test-only factual response, not a semantic certificate.',issues:[]},'fact').result;
  const finalArgs={...args,final_text:'The requested test explanation.',facts:[{id:'REQUEST_FACTS',result:fact}],revision:0},final=v.finalize(finalArgs),data=body(final.packet).data;
  assert.deepEqual(final.model_evidence,sourceModels(original));assert.deepEqual(data.model_evidence,verifierModels(original));assert.equal(data.request,original);
  assert.deepEqual(data.facts,finalArgs.facts);assert.equal(data.final_text,finalArgs.final_text);assert.deepEqual(data.model_draft_reviews,final.model_draft_reviews);
  assert.equal(final.complete_authorized,false);assert.equal(data.model_draft_reviews[0].semantic_certification,false);
  for(const host of ['claude','codex'])assert.deepEqual(v.exposePlan(plan,host).model_evidence,sourceModels(original));
});
test('the projection stays within the existing output bound for boundary-sized definitions admitted by sourceModels',()=>{
  let admitted=0,rejected=0;
  for(const count of [1,2,4])for(const cells of [2,8,16])for(const length of [1,28]){
    const names=Array.from({length:cells},(_,i)=>'C'+i+'x'.repeat(length)),input={initial:Object.fromEntries(names.map(name=>[name,true])),invariant:{cells:names,at_least:1},
      transactions:Array.from({length:Math.min(4,cells)},(_,i)=>({id:'Transaction'+i,guard:{cells:names,at_least:1},writes:{[names[i]]:false}}))};
    const original=request(Array.from({length:count},()=>input));
    try{sourceModels(original);}catch(error){assert.match(error.message,/content_rejected/);rejected++;continue;}
    admitted++;const projected=verifierModels(original);assert.equal(projected.length,count);assert.ok(Buffer.byteLength(canonical(projected))<=16000);
    for(const entry of projected){assert.deepEqual(entry.model,input);assert.equal(entry.computed.concurrent_orders_checked,analyzeScenario(input).concurrent_start_schedules.length);}
  }
  assert.ok(admitted>=8);assert.ok(rejected>0);
});
test('compact evidence preserves every prior computed fact, including explicit read/write and write/write edge arrays',()=>{
  const overlap=model();overlap.transactions[1].writes={A:false};
  const disjoint=model();disjoint.transactions.forEach(t=>{t.guard={cells:[],at_least:0};});
  const disabled=model();disabled.initial.B=false;
  for(const input of [model(),overlap,disjoint,disabled]){
    const original=request(input),before=sourceModels(original)[0].computed.facts,after=verifierModels(original)[0].computed;
    for(const [key,value]of Object.entries(before))assert.deepEqual(after[key],value,key);
    const plan=v.prepare({attempt_id:'11111111-1111-4111-8111-111111111111',candidate_sha256:'a'.repeat(64),request:original});
    const native=JSON.parse(plan.packets[0].prompt.slice(plan.packets[0].prompt.indexOf('\n')+1)).data.model_evidence[0].computed;
    for(const [key,value]of Object.entries(before))assert.deepEqual(native[key],value,key);
  }
});

test('observed read values include reverse serial orders and remain indexed by each actual guard',()=>{
  const input=model(),reverse=model();reverse.transactions.reverse();
  const renamed={initial:{Left:true,Right:false},invariant:{cells:['Left','Right'],at_least:1},transactions:[
    {id:'Reader',guard:{cells:['Right','Left'],at_least:1},writes:{Left:false}},
    {id:'Writer',guard:{cells:[],at_least:0},writes:{Right:true}}]};
  for(const definition of [input,reverse,renamed]){
    const computed=analyzeScenario(definition),rows=verifierModels(request(definition))[0].computed.guard_read_values_across_checked_orders;
    assert.equal(rows.length,definition.transactions.length);
    for(const [i,transaction]of definition.transactions.entries()){
      assert.equal(rows[i].transaction,transaction.id);
      for(const [key,schedules]of [['concurrent_start',computed.concurrent_start_schedules],['serial',computed.serial_schedules]])
        assert.deepEqual(rows[i][key],transaction.guard.cells.map(cell=>[false,true].filter(value=>
          schedules.some(schedule=>schedule.steps.find(step=>step.transaction===transaction.id).observed[cell]===value))));
    }
  }
  const first=verifierModels(request(input))[0].computed.guard_read_values_across_checked_orders[0];
  assert.deepEqual(first,{transaction:'T1',concurrent_start:[[true]],serial:[[false,true]]});
});

test('assessment and withholding reviewers receive recomputed counterexamples without promoting source result labels',()=>{
  const original='Explain the supplied scenario, give measured slowdown, and assess the draft claim T1 reads A. No measurements are supplied.\n'
    +JSON.stringify({scenario:model(),serial_schedules:'UNTRUSTED: T1 always sees B=true'});
  const binding={attempt_id:'11111111-1111-4111-8111-111111111201',candidate_sha256:'a'.repeat(64)},plan=v.prepareAssessment({...binding,request:original});
  const read=packet=>JSON.parse(packet.prompt.slice(packet.prompt.indexOf('\n')+1));
  const assessment=read(plan.packets[0]);assert.equal(assessment.data.original_request,original);
  assert.deepEqual(assessment.data.model_evidence,verifierModels(original));
  assert.doesNotMatch(canonical(assessment.data.model_evidence),/UNTRUSTED/);
  const result=v.resultSubmission({challenge:plan.packets[0].challenge,assessment_decision:'assessed',gap_review:'Measured slowdown needs measurements.',
    essential_gaps:[{requirement:'Measured slowdown',request_quote:'give measured slowdown',reason:'missing_evidence',evidence_needed:'Matched workload measurements.'}],
    corrections:[{claim:'T1 reads A',correction:'T1 reads B.',basis:'The supplied guard lists B.'}],issues:[]},'assessment').result;
  const proposal=a.noticeFromAssessment({...binding,assessment_result:result,language:'en'},original,result);
  const notice=read(proposal.proposal.review.packet);
  assert.equal(notice.data.request,original);assert.deepEqual(notice.data.model_evidence,assessment.data.model_evidence);
  assert.deepEqual(notice.data.model_evidence[0].computed.guard_read_values_across_checked_orders[0].serial,[[false,true]]);
  assert.equal(notice.data.final_text,proposal.proposal.decision.final_text);
  assert.equal(proposal.proposal.review.complete_authorized,false);
});
