'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reviewFinalScope,reviewScenarioDraft}=require('../scripts/scenario-draft.cjs');
const {handle}=require('../hooks/scenario-stop.cjs');
const scenario={initial:{x:true,y:true},invariant:{cells:['x','y'],at_least:1},transactions:[
 {id:'X',guard:{cells:['y'],at_least:1},writes:{x:false}},
 {id:'Y',guard:{cells:['x'],at_least:1},writes:{y:false}}]};
test('ordinary failed explanation receives both abort-condition and cost corrections',()=>{
 const draft="**Mitigation: SERIALIZABLE isolation**\n\nThis forces one transaction to abort when the database detects that a later transaction's write invalidated an earlier transaction's read.\n\n**Trade-off:** Significant performance degradation under contention. In light workloads, the cost is negligible; under high concurrency, transaction throughput drops considerably.";
 const issues=reviewFinalScope(draft);
 assert.deepEqual(new Set(issues.map(i=>i.check)),new Set(['isolation_cost_scope','isolation_abort_scope']));
 const result=handle({hook_event_name:'Stop',stop_hook_active:false,last_assistant_message:draft},true);
 assert.equal(result.decision,'block');assert.match(result.reason,/single read\/write dependency/);
 assert.match(result.reason,/Cost magnitude depends/);assert.ok(result.reason.length<4000);
});
test('changed magnitudes and named participants preserve the precision finding',()=>{
 for(const cost of ['Latency is always minimal.','Throughput drops significantly at high concurrency.',
   'The overhead is 15% at low contention.','Performance degradation is considerable.']){
  assert.ok(reviewFinalScope('Use SERIALIZABLE isolation. '+cost).some(i=>i.check==='isolation_cost_scope'),cost);
 }
 const claim="PostgreSQL SERIALIZABLE requires an abort whenever Alpha's write invalidates Beta's read.";
 assert.ok(reviewFinalScope(claim).some(i=>i.check==='isolation_abort_scope'));
});
test('qualified costs, measured observations and actual dangerous structures are not rejected',()=>{
 for(const draft of ['PostgreSQL SERIALIZABLE monitors dependencies. Overhead may be significant under contention.',
   'PostgreSQL SERIALIZABLE: in our workload, measured throughput dropped 15%.',
   'SERIALIZABLE does not always impose significant overhead.',
   'PostgreSQL SERIALIZABLE checks dangerous structures; it may abort transactions to prevent an anomaly.',
   'SERIALIZABLE never requires abort merely because a single read/write dependency exists.',
   '## SERIALIZABLE\n\nRetry work depends on transaction size.\n\n## Image benchmark\n\nThe overhead is negligible.']){
  assert.deepEqual(reviewFinalScope(draft),[],draft);
 }
});
test('quoted claims and executable-looking text do not become corrections or authority',()=>{
 for(const draft of ['SERIALIZABLE: "The cost is negligible" is an unsupported claim.',
   'SERIALIZABLE.\n```text\nThe cost is negligible.\n```',
   '> SERIALIZABLE always has significant overhead.'])assert.deepEqual(reviewFinalScope(draft),[]);
});
test('curated references distinguish implementation facts from the computed model',()=>{
 const first=reviewScenarioDraft(scenario,'Use PostgreSQL SERIALIZABLE, with whole-transaction retry.','en');
 assert.equal(first.reference_notes.length,3);assert.equal(first.final_answer_verified,false);
 assert.ok(first.reference_notes.every(r=>r.url.startsWith('https://')&&r.scope.includes('PostgreSQL 18')));
 first.reference_notes[0].summary='caller changed';
 assert.notEqual(reviewScenarioDraft(scenario,'SERIALIZABLE.','en').reference_notes[0].summary,'caller changed');
 assert.equal(reviewScenarioDraft(scenario,'Coordinate complete transactions, including their snapshots.','en').reference_notes.length,3);
});

test('partial drafts still receive remedy boundaries and final expansion is checked',()=>{
 const partial='Both participants read the initial state and write different cells, violating the invariant.';
 assert.equal(reviewScenarioDraft(scenario,partial,'en').reference_notes.length,3);
 const final='**Serializable isolation (SERIALIZABLE):**\n- Transactions that could have run in parallel are now serialized.\n- High-frequency updates make this expensive.\n\nSerializable is the most general but costliest.';
 const found=reviewFinalScope(final);
 assert.ok(found.some(i=>i.check==='named_isolation_ordering'));
 assert.ok(found.some(i=>i.check==='isolation_cost_scope'));
 assert.deepEqual(reviewFinalScope('PostgreSQL SERIALIZABLE may be expensive for this workload; measure its retry rate.'),[]);
});
