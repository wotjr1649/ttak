'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('./release/normal-parse.cjs');
test('native stdout bridge drops hidden content and does not certify failed or incomplete collection',()=>{
  const raw=JSON.stringify({type:'assistant',message:{id:'one',model:'model',content:[{type:'thinking',thinking:'SYNTHETIC_HIDDEN'},{type:'text',text:'Visible final'}]}})+'\n';
  const report=parse({host:'claude',stdout:raw,process:{status:'exited'}});
  assert.equal(report.collection.complete,true);assert.equal(report.messages[0].text,'Visible final');
  assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC_HIDDEN/);
  assert.equal(parse({host:'claude',stdout:raw+'{"type":',process:{status:'exited'}}).collection.complete,false);
  assert.equal(parse({host:'claude',stdout:'',process:{status:'timeout'}}).collection.complete,false);
  assert.throws(()=>parse({host:'unknown',stdout:raw,process:{status:'exited'}}));
});
test('checkpoint recovery is explicit, bounded, and requires verified timeout cleanup',()=>{
  const input={host:'codex',stdout:'',process:{status:'timeout',cleanupVerified:true,activeProcesses:0},
    checkpoint_text:JSON.stringify({session:'observed-session',messages:[],hooks:[]})};
  assert.equal(parse(input).collection.complete,false);
  for(const changed of [{checkpoint_text:null},{checkpoint_text:'x'.repeat(1048577)},
    {process:{status:'timeout',cleanupVerified:false,activeProcesses:0}},
    {process:{status:'exited',cleanupVerified:true,activeProcesses:0}}])assert.throws(()=>parse({...input,...changed}));
  const secret='sk-'+'SYNTHETIC_ONLY'.repeat(4);
  assert.throws(()=>parse({...input,stdout:JSON.stringify({messages:[{text:secret}]})}),/withheld/);
});
