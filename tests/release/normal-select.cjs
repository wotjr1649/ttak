'use strict';
// Normal API selection only, inside the caller's bounded supervisor and lock.
// This never changes trust, hooks, credentials, providers or model settings.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {checkedData,exact}=require('../../scripts/verification-packet.cjs');
const {possibleSecret}=require('../../scripts/review-native-format.cjs');
const {connect}=require('./normal-rpc.cjs');
const profile=path.resolve(__dirname,'../../.superpowers/release-run-03/profiles/codex-ttak');
function selection(value){
  const map=checkedData(value);
  if(!map||Array.isArray(map)||typeof map!=='object'||Object.keys(map).length>256)throw new Error('normal_selection_invalid');
  for(const [key,enabled]of Object.entries(map))if(typeof enabled!=='boolean'||
    key.length>128||!/^[a-z0-9-]+@[a-z0-9-]+$/.test(key))throw new Error('normal_selection_scope');
  return map;
}
function selectedPlugins(value){
  const plugins=checkedData(value);
  return selection(Object.fromEntries(Object.entries(plugins).map(([key,config])=>{
    if(!config||typeof config.enabled!=='boolean')throw new Error('normal_selection_missing');return [key,config.enabled];
  })));
}
function selectionEdits(actual,expected,target){
  actual=selectedPlugins(actual);expected=selection(expected);target=selection(target);
  assert.deepEqual(actual,expected,'normal_selection_changed');
  assert.deepEqual(Object.keys(target).sort(),Object.keys(expected).sort(),'normal_selection_new_target');
  return Object.entries(target).filter(([key,value])=>expected[key]!==value).map(([key,value])=>{
    // Existing entries outside this campaign may be preserved and compared,
    // but never edited. In particular ttak@personal remains exactly as saved.
    if(!/^(?:ttak@ttak-[a-z0-9-]{1,100}|(?:ponytail|eli5|i-have-adhd)@ttak-original-codex-v4)$/.test(key))throw new Error('normal_selection_effect_scope');
    return {keyPath:'plugins.'+JSON.stringify(key)+'.enabled',value,mergeStrategy:'replace'};
  });
}
async function run(value){
  const spec=checkedData(value);exact(spec,['expected','target']);selection(spec.expected);selection(spec.target);
  assert.equal(process.env.CODEX_HOME,profile);assert.equal(fs.realpathSync(profile),profile);
  const configFile=path.join(profile,'config.toml'),stat=fs.lstatSync(configFile);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1);assert.equal(fs.realpathSync(configFile),configFile);
  const c=connect();
  try{
    await c.request('initialize',{clientInfo:{name:'ttak_normal_selection',version:'1'}});c.send({method:'initialized'});
    const before=await c.request('config/read',{includeLayers:true}),layers=before.layers.filter(layer=>layer.name?.type==='user');assert.equal(layers.length,1);
    const edits=selectionEdits(layers[0].config.plugins,spec.expected,spec.target);
    if(edits.length){const written=await c.request('config/batchWrite',{filePath:configFile,expectedVersion:layers[0].version,edits});assert.equal(written.status,'ok');}
    const after=await c.request('config/read',{includeLayers:true}),users=after.layers.filter(layer=>layer.name?.type==='user');assert.equal(users.length,1);
    assert.deepEqual(selectedPlugins(users[0].config.plugins),spec.target);
    assert.deepEqual(selectedPlugins(after.config.plugins),spec.target);
    const listed=await c.request('hooks/list',{cwds:[process.cwd()]});assert.equal(listed.data.length,1);assert.deepEqual(listed.data[0].errors,[]);
    const result={selection_verified:true,changed_entries:edits.length,selection:spec.target,hooks:listed.data[0].hooks,trust_changes:0,model_starts:0};
    if(possibleSecret(JSON.stringify(result)))throw new Error('normal_selection_output_withheld');
    return result;
  }finally{await c.close();}
}
module.exports={selection,selectedPlugins,selectionEdits,run};
if(require.main===module){let input='',bytes=0;process.stdin.setEncoding('utf8');
  process.stdin.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>131072){process.stdin.destroy();process.exitCode=1;}else input+=chunk;});
  process.stdin.on('end',async()=>{try{console.log(JSON.stringify(await run(JSON.parse(input))));}
    catch{console.log('{"error":"normal_selection_failed"}');process.exitCode=1;}});
}
