'use strict';
// Input and source boundaries only. Never call run() or launch the native binary.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {specification,reserveCheckpoint}=require('./release/normal-codex.cjs'),{collector}=require('./release/normal-events.cjs');
const area=path.resolve(__dirname,'../.superpowers'),sha=value=>createHash('sha256').update(value).digest('hex');
const spec=()=>({collection_id:'00000000-0000-0000-0000-000000000001',prompt:'Explain a fictional register that returns7 without changing its value.',session:null,skills:[],ttak_root:null,parent_turn_limit:20,internal_verifier_limit:0});
test('candidate activation and resumed task share a provisioned agent capability while allocations remain separate',()=>{
  const {threadConfiguration}=require('./release/normal-codex.cjs');
  const activation={...spec(),ttak_root:'reviewed-candidate'},task={...activation,internal_verifier_limit:11,session:'00000000-0000-0000-0000-000000000002'};
  assert.deepEqual(threadConfiguration(activation),threadConfiguration(task));
  assert.equal(threadConfiguration(activation)['agents.enabled'],true);
  assert.equal(activation.internal_verifier_limit,0);
  assert.equal(threadConfiguration(spec())['agents.enabled'],false);
  assert.equal(threadConfiguration(task)['agents.max_concurrent_threads_per_session'],1);
});
test('normal transport rejects unknown effects, invalid sessions and unbounded limits',()=>{
  assert.deepEqual(specification(spec()),spec());
  for(const fields of [{collection_id:'../escape'},{collection_id:null},{session:'not-a-session'},{parent_turn_limit:0},{parent_turn_limit:21},{internal_verifier_limit:12},
    {internal_verifier_limit:1},{prompt:''},{unexpected:true},{skills:[{name:'x',path:'../SKILL.md',sha256:'a'.repeat(64)}]}])
    assert.throws(()=>specification({...spec(),...fields}));
  let reads=0;const input=spec();Object.defineProperty(input,'prompt',{enumerable:true,get(){reads++;return 'x';}});
  assert.throws(()=>specification(input));assert.equal(reads,0);
});
test('selected skills require ordinary task-local files with the exact reviewed bytes',()=>{
  const dir=fs.mkdtempSync(path.join(area,'normal-spec-')),file=path.join(dir,'SKILL.md'),raw='---\nname: fixture\ndescription: Test only\n---\nFixture body.\n';
  try{
    fs.writeFileSync(file,raw,{flag:'wx'});const value={...spec(),skills:[{name:'fixture',path:file,sha256:sha(raw)}]};
    assert.deepEqual(specification(value),value);
    assert.throws(()=>specification({...value,skills:[value.skills[0],value.skills[0]]}));
    fs.appendFileSync(file,'changed');assert.throws(()=>specification(value));
    assert.throws(()=>specification({...value,skills:[{...value.skills[0],path:path.resolve(__dirname,'../README.md')}]}));
  }finally{assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(area));fs.rmSync(dir,{recursive:true});}
});
test('a baseline collector rejects unrelated hook events without attributing them to TTAK',()=>{
  const report={session:'parent',hooks:[],turns:[],child_turns:[]};let resolved=0;
  const collect=collector({report,installed:null,parentLimit:1,agentLimit:0,checkpoint:()=>{},resolve:()=>resolved++,reject:code=>{throw new Error(code);}});
  assert.throws(()=>collect({method:'hook/completed',params:{threadId:'parent',run:{source:'plugin',sourcePath:path.join(area,'other/hooks/hooks.json'),eventName:'stop',entries:[],status:'completed'}}}),/unexpected_hook/);
  assert.deepEqual(report.hooks,[]);assert.equal(resolved,0);
});

test('sequential collections preserve the conversation cwd and never overwrite an earlier checkpoint',()=>{
  const dir=fs.mkdtempSync(path.join(area,'normal-resume-'));
  try{
    const first=reserveCheckpoint(spec(),dir);fs.writeFileSync(first,'first completed observation');
    assert.throws(()=>reserveCheckpoint(spec(),dir),{code:'EEXIST'});
    const next=reserveCheckpoint({...spec(),session:'00000000-0000-0000-0000-000000000003',collection_id:'00000000-0000-0000-0000-000000000002'},dir);
    assert.notEqual(first,next);assert.equal(path.dirname(first),path.dirname(next));
    assert.equal(fs.readFileSync(first,'utf8'),'first completed observation');
    assert.equal(fs.readFileSync(next,'utf8'),'');
    assert.throws(()=>reserveCheckpoint({...spec(),collection_id:'../outside'},dir));
    assert.throws(()=>reserveCheckpoint(spec(),path.resolve(__dirname,'..')));
  }finally{assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(area));fs.rmSync(dir,{recursive:true});}
});
