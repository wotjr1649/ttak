'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {readStateFile,snapshot}=require('./release/normal-state.cjs'),area=path.resolve(__dirname,'../.superpowers');
test('post-turn evidence preserves the completed state when a later turn replaces its file',()=>{
 const dir=fs.mkdtempSync(path.join(area,'state-snapshot-')),file=path.join(dir,'state.json');
 try{const raw=JSON.stringify({turn:{id:'first'},attempt:{status:'complete',final_sha256:'a'.repeat(64)}});fs.writeFileSync(file,raw);
  const before=readStateFile(file);fs.writeFileSync(file,JSON.stringify({turn:{id:'second'},attempt:null}));const after=readStateFile(file);
  assert.equal(before.state.attempt.status,'complete');assert.equal(after.state.attempt,null);
  assert.equal(before.sha256,createHash('sha256').update(raw).digest('hex'));assert.notEqual(before.sha256,after.sha256);
  assert.equal(readStateFile(path.join(dir,'missing.json')).exists,false);
 }finally{assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(area));fs.rmSync(dir,{recursive:true});}
});
test('state snapshots refuse outside paths, oversized files and hard links without copying their contents',()=>{
 assert.throws(()=>readStateFile(path.resolve('outside-state.json')),/scope/);
 const dir=fs.mkdtempSync(path.join(area,'state-boundary-')),file=path.join(dir,'state.json');
 try{fs.writeFileSync(file,' '.repeat(32769));assert.throws(()=>readStateFile(file),/file/);
  fs.writeFileSync(file,'{}');fs.linkSync(file,path.join(dir,'alias.json'));assert.throws(()=>readStateFile(file),/file/);
  assert.throws(()=>snapshot({profile:dir,installed:dir,session:'00000000-0000-4000-8000-000000000001'}),/profile/);
 }finally{assert.equal(path.dirname(fs.realpathSync(dir)),fs.realpathSync(area));fs.rmSync(dir,{recursive:true});}
});
