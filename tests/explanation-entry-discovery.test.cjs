'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
function recipe(){
  const doc=fs.readFileSync(path.join(__dirname,'../skills/ttak-explain/SKILL.md'),'utf8');
  const sections=[...doc.matchAll(/```javascript\n([\s\S]*?)\n```/g)];
  assert.equal(sections.length,1);return sections[0][1];
}
function inventory(){
  const dispatch=createDispatcher({host:'codex'});
  dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'discovery-local',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
  return dispatch({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}).result.tools.map(t=>Object.freeze({name:'mcp__ttak_scenario__'+t.name,description:t.description}));
}
function discover(items,assessment=false){
  let code=recipe();if(assessment){
    const name='mcp__ttak_scenario__explanation_prepare';assert.equal(code.split(name).length,2);
    code=code.replace(name,'mcp__ttak_scenario__explanation_assess_request');
  }
  const output=[],context=vm.createContext({ALL_TOOLS:Object.freeze(items),text:value=>output.push(value)},{codeGeneration:{strings:false,wasm:false}});
  new vm.Script(code).runInContext(context,{timeout:100});return output;
}
test('initial discovery returns only the current normal entry with its complete live product metadata',()=>{
  const items=inventory(),target=items.find(t=>t.name==='mcp__ttak_scenario__explanation_prepare');
  const printed=discover(items);assert.deepEqual(printed,[target]);assert.equal(printed[0],target);
  // Product tools/list omits the native host's appended declarations. Verify
  // exact selection here; measure the native byte reduction on its own envelope.
  assert.equal(Buffer.byteLength(JSON.stringify(printed)),Buffer.byteLength(JSON.stringify([target])));
  const omitted=items.filter(t=>t!==target);
  assert.equal(Buffer.byteLength(JSON.stringify(items))-Buffer.byteLength(JSON.stringify(printed)),
    omitted.reduce((n,t)=>n+Buffer.byteLength(JSON.stringify(t))+1,0));
});
test('the evidence-obstacle lookup selects assessment without including preparation or later stages',()=>{
  const items=inventory(),target=items.find(t=>t.name==='mcp__ttak_scenario__explanation_assess_request');
  assert.deepEqual(discover(items,true),[target]);
});
test('tool description mentions, suffixes and similarly named foreign tools cannot replace the exact entry',()=>{
  const target=Object.freeze({name:'mcp__ttak_scenario__explanation_prepare',description:'Current entry metadata'});
  const decoys=[
    {name:'mcp__foreign__explanation_prepare',description:target.name},
    {name:target.name+'_legacy',description:target.name},
    {name:'mcp__ttak_scenario__explanation_result',description:'explanation_prepare'},
    {name:'multi_agent_v1__spawn_agent',description:target.name}
  ].map(Object.freeze);
  assert.deepEqual(discover([...decoys,target]),[target]);
  assert.throws(()=>discover(decoys),/entry unavailable/);
});
test('missing selected metadata fails without printing another branch or invoking tools',()=>{
  const items=inventory();
  assert.throws(()=>discover(items.filter(t=>!t.name.endsWith('__explanation_prepare'))),/entry unavailable/);
  assert.throws(()=>discover(items.filter(t=>!t.name.endsWith('__explanation_assess_request')),true),/entry unavailable/);
  assert.throws(()=>discover([]),/entry unavailable/);
});
