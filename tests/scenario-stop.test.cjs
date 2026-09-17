'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const {handle:handleWithState}=require('../hooks/scenario-stop.cjs');
const handle=input=>handleWithState(input,true);
const {reviewIsolationOrdering}=require('../scripts/scenario-draft.cjs');
const bad='**Mitigation: serializable isolation**\n\nEnsure transactions execute in some serial order—one completes fully (snapshot, check, write, commit) before the next begins its snapshot. Under serializability, if the second runs later, its guard would fail.';
const input=text=>({hook_event_name:'Stop',stop_hook_active:false,last_assistant_message:text});

test('final-message scope failure triggers feedback even when the earlier draft was sound',()=>{
  assert.equal(reviewIsolationOrdering('Serializable isolation ensures effects as if transactions ran in a serial order; retries may be required.').length,0);
  const result=handle(input(bad));assert.equal(result.decision,'block');
  assert.match(result.reason,/result equivalence/);assert.ok(!result.reason.includes(bad));
});

test('one correction is bounded and persistent errors remain explicitly unverified',()=>{
  const result=handle({...input(bad),stop_hook_active:true});
  assert.equal(result.decision,undefined);assert.equal(result.continue,false);
  assert.match(result.stopReason,/not verified/);assert.match(result.stopReason,/result equivalence/);
});

test('corrected explanations, other tasks and unsupported events do not get blocked',()=>{
  for(const text of ['I fixed the CSV escaping and ran the round-trip test.',
    'Explicitly coordinate whole transactions. One transaction completes before the other begins.',
    'Serializable isolation provides results equivalent to a serial execution; concurrent transactions may need retry.'])assert.deepEqual(handle(input(text)),{});
  assert.deepEqual(handle({...input(bad),hook_event_name:'UserPromptSubmit'}),{});
  assert.equal(handle({...input(bad),stop_hook_active:'false'}).continue,false);
});

test('quoted errors and code are inert, and unrelated headings reset isolation context',()=>{
  for(const text of ['```text\n'+bad+'\n```',
    'Serializable does not guarantee that one transaction completes before the other begins.',
    '**Serializable isolation**\n\nEffects match a serial order.\n\n**Explicit queue**\n\nOne transaction completes before the other begins.'])assert.deepEqual(handle(input(text)),{});
});

test('the real hook ignores supplied file paths and emits only protocol JSON',()=>{
  const data=fs.mkdtempSync(path.join(__dirname,'../.superpowers/stop-state-test-'));
  fs.writeFileSync(path.join(data,'state.json'),JSON.stringify({enabled:true}));
  try {
  const payload={...input(bad),transcript_path:'private_marker_do_not_read',cwd:'private_marker_do_not_read'};
  const result=spawnSync(process.execPath,[path.join(__dirname,'../hooks/scenario-stop.cjs')],{input:JSON.stringify(payload),
    encoding:'utf8',timeout:5000,maxBuffer:16384,windowsHide:true,
    env:{...Object.fromEntries(Object.entries(process.env).filter(([k])=>['SYSTEMROOT','WINDIR','PATH'].includes(k.toUpperCase()))),PLUGIN_DATA:data}});
  assert.equal(result.status,0);assert.equal(result.stderr,'');
  assert.equal(JSON.parse(result.stdout).decision,'block');
  assert.ok(!result.stdout.includes('private_marker_do_not_read'));
  } finally {fs.rmSync(data,{recursive:true});}
});

test('automatic correction respects saved off and unavailable states in the real hook',()=>{
  const data=fs.mkdtempSync(path.join(__dirname,'../.superpowers/stop-state-test-'));
  try {
    for(const state of [null,{enabled:false},{enabled:'invalid'}]){
      if(state)fs.writeFileSync(path.join(data,'state.json'),JSON.stringify(state));
      const r=spawnSync(process.execPath,[path.join(__dirname,'../hooks/scenario-stop.cjs')],{
        input:JSON.stringify(input(bad)),encoding:'utf8',timeout:5000,maxBuffer:16384,windowsHide:true,
        env:{PLUGIN_DATA:data}});
      assert.equal(r.status,0);assert.deepEqual(JSON.parse(r.stdout),{});
    }
  }finally{fs.rmSync(data,{recursive:true});}
});

test('malformed and oversized requests produce an unavailable notice, not a success verdict',()=>{
  const data=fs.mkdtempSync(path.join(__dirname,'../.superpowers/stop-state-test-'));
  fs.writeFileSync(path.join(data,'state.json'),JSON.stringify({enabled:true}));
  try {
  for(const value of ['{bad','x'.repeat(131073)]){
    const r=spawnSync(process.execPath,[path.join(__dirname,'../hooks/scenario-stop.cjs')],{input:value,encoding:'utf8',
      timeout:5000,maxBuffer:16384,windowsHide:true,env:{PLUGIN_DATA:data}});
    assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).continue,false);
    assert.match(JSON.parse(r.stdout).stopReason,/unavailable/);
  }
  }finally{fs.rmSync(data,{recursive:true});}
});

test('a failed checker stops with a bounded recovery reason and never echoes the rejected answer',()=>{
  const secretMarker='untrusted_private_marker';
  const result=handle(input(secretMarker+'x'.repeat(24001)));
  assert.equal(result.continue,false);assert.match(result.stopReason,/check.*unavailable/);
  assert.ok(!JSON.stringify(result).includes(secretMarker));
  assert.equal(result.decision,undefined);
});

test('correction instructions preserve completeness and specify withholding unresolved claims',()=>{
  const reason=handle(input(bad)).reason;
  assert.match(reason,/withhold the completed explanation/);
  assert.match(reason,/unresolved.*evidence/);
  assert.doesNotMatch(reason,/a checker status or error is not a substitute/);
});

test('unsupported cost exclusions are corrected while qualified cost explanations remain intact',()=>{
  const badCost='Serializable isolation tracks dependencies and may require retries. The cost is proportional to contention, not to transaction size.';
  assert.equal(handle(input(badCost)).decision,'block');
  assert.match(handle(input(badCost)).reason,/read\/write footprint/);
  for(const text of ['Serializable overhead depends on contention, transaction size and retry work.',
    'Serializable isolation: "the cost is proportional to contention, not to transaction size" is an incorrect claim.',
    'Serializable cost is not proportional to contention alone.',
    'This estimate excludes transaction size from the model; it does not establish a universal cost law.'])assert.deepEqual(handle(input(text)),{});
});
