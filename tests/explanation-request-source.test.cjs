'use strict';
// Native-shaped synthetic input, not a claim about real host delivery.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {textDigest}=require('../scripts/verification-packet.cjs');
const {readCurrentRequest,selectCurrentRequest,MAX_BYTES,MAX_LINES,MAX_ENTRIES}=require('../scripts/explanation-request-source.cjs');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),{handle:stop}=require('../hooks/scenario-stop.cjs');
const {createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const v=require('../scripts/explanation-verification.cjs');
const session='12345678-1234-1234-1234-123456789abc',turn='87654321-4321-4321-4321-cba987654321';
const request='Explain this model. A quoted <skill>example</skill> is user data; keep it. A required measurement is absent.';
function nativeRecords(cwd){return [
  {type:'session_meta',payload:{id:session,session_id:session,cli_version:'0.154.0',cwd}},
  {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'HOST_ENVIRONMENT_ONLY'}],internal_chat_message_metadata_passthrough:{turn_id:turn,content_item_kinds:['environments.environment_context']}}},
  {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:request}],internal_chat_message_metadata_passthrough:{turn_id:turn,content_item_kinds:['user.text']}}},
  {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'LOADED_SKILL_ONLY'}],internal_chat_message_metadata_passthrough:{turn_id:turn,content_item_kinds:['skills.selected_skill_instructions']}}}
];}
const encode=rows=>rows.map(JSON.stringify).join('\n')+'\n';
function fixture(body){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'request-source-test-'));
  const profile=path.join(root,'profile'),dataRoot=path.join(profile,'plugins/data/ttak-source'),sessions=path.join(profile,'sessions'),cwd=path.join(root,'work');
  const directory=path.join(sessions,'2026/09/12'),file=path.join(directory,'rollout-2026-09-12T00-00-00-'+session+'.jsonl');
  fs.mkdirSync(dataRoot,{recursive:true});fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(cwd);
  const rows=nativeRecords(cwd);fs.writeFileSync(file,encode(rows),{flag:'wx'});
  const input={session_id:session,turn_id:turn,cwd,transcript_path:file};
  try{body({root,profile,dataRoot,sessions,cwd,file,rows,input,hash:textDigest(request)});}
  finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}

test('an exact current-turn native user-text record supplies the original request without copying loaded context',()=>fixture(ctx=>{
  const before=fs.readFileSync(ctx.file),result=readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash);
  assert.equal(result,request);assert.equal(textDigest(result),ctx.hash);assert.deepEqual(fs.readFileSync(ctx.file),before);
  assert.equal(readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash),request);
}));

test('native source selection rejects other sessions, turns, roles, context kinds, versions, working directories and altered user text',()=>fixture(ctx=>{
  const changes=[rows=>{rows[0].payload.id=turn;},rows=>{rows[0].payload.session_id=turn;},rows=>{rows[0].payload.cli_version='0.154.1';},
    rows=>{rows[0].payload.cwd=ctx.profile;},rows=>{rows[2].payload.internal_chat_message_metadata_passthrough.turn_id=session;},
    rows=>{rows[2].payload.role='assistant';},rows=>{rows[2].payload.internal_chat_message_metadata_passthrough.content_item_kinds=['skills.selected_skill_instructions'];},
    rows=>{rows[2].payload.content[0].text=request+' Changed.';},rows=>{delete rows[2].payload.internal_chat_message_metadata_passthrough;},
    rows=>{rows[2].payload.internal_chat_message_metadata_passthrough.content_item_kinds=[];},rows=>{rows.push(structuredClone(rows[2]));},
    rows=>{rows.push(structuredClone(rows[0]));},rows=>{rows.reverse();}];
  for(const change of changes){const rows=structuredClone(ctx.rows);change(rows);assert.throws(()=>selectCurrentRequest(encode(rows),ctx.input,ctx.hash));}
  assert.throws(()=>selectCurrentRequest(encode(ctx.rows),ctx.input,'f'.repeat(64)));
  assert.throws(()=>selectCurrentRequest(encode(ctx.rows),{...ctx.input,session_id:'../../outside'},ctx.hash));
}));

test('quoted metadata inside actual user text stays intact and a matching quote in loaded context cannot replace that user record',()=>fixture(ctx=>{
  const rows=structuredClone(ctx.rows);rows[1].payload.content[0].text=request;rows[3].payload.content[0].text=request;
  assert.equal(selectCurrentRequest(encode(rows),ctx.input,ctx.hash),request);
  rows.splice(2,1);assert.throws(()=>selectCurrentRequest(encode(rows),ctx.input,ctx.hash));
}));

test('malformed, incomplete, oversized or excessive native records never supply an unchecked request',()=>fixture(ctx=>{
  assert.throws(()=>selectCurrentRequest('{invalid}\n',ctx.input,ctx.hash));
  assert.throws(()=>selectCurrentRequest(encode(ctx.rows).trimEnd(),ctx.input,ctx.hash));
  assert.throws(()=>selectCurrentRequest('x'.repeat(MAX_BYTES+1),ctx.input,ctx.hash));
  assert.throws(()=>selectCurrentRequest(encode([...ctx.rows,...Array(MAX_LINES).fill({type:'unused'})]),ctx.input,ctx.hash));
  fs.appendFileSync(ctx.file,'{"type":"unfinished');assert.equal(readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash),request);
  fs.writeFileSync(ctx.file,encode(ctx.rows.slice(0,2))+'{"type":"unfinished');assert.throws(()=>readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash));
  fs.writeFileSync(ctx.file,encode(ctx.rows)+'{invalid}\n');assert.throws(()=>readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash));
  fs.writeFileSync(ctx.file,Buffer.from([255,10]));assert.throws(()=>readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash));
  fs.truncateSync(ctx.file,MAX_BYTES+1);assert.throws(()=>readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash));
}));

test('an explicit outside, missing or wrong-session path is rejected without searching a valid alternative',()=>fixture(ctx=>{
  const outside=path.join(ctx.root,'outside-'+session+'.jsonl');fs.writeFileSync(outside,encode(ctx.rows));
  for(const transcript_path of [outside,path.join(path.dirname(ctx.file),'missing-'+session+'.jsonl'),path.join(ctx.sessions,'wrong-name.jsonl'),'relative.jsonl',''])
    assert.throws(()=>readCurrentRequest({...ctx.input,transcript_path},ctx.dataRoot,ctx.hash));
  assert.throws(()=>readCurrentRequest(ctx.input,ctx.root,ctx.hash));
  assert.equal(readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash),request);
}));

test('hardlinks, directory links and ambiguous native session paths remain hard boundaries',()=>fixture(ctx=>{
  const hardlink=path.join(ctx.root,'linked-copy.jsonl');fs.linkSync(ctx.file,hardlink);
  assert.throws(()=>readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash));fs.unlinkSync(hardlink);
  const linkedDir=path.join(ctx.sessions,'linked-directory');fs.symlinkSync(path.dirname(ctx.file),linkedDir,'junction');
  try{
    assert.throws(()=>readCurrentRequest({...ctx.input,transcript_path:path.join(linkedDir,path.basename(ctx.file))},ctx.dataRoot,ctx.hash));
    assert.throws(()=>readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash));
  }finally{fs.unlinkSync(linkedDir);}
  const duplicate=path.join(ctx.sessions,'duplicate-'+session+'.jsonl');fs.copyFileSync(ctx.file,duplicate,fs.constants.COPYFILE_EXCL);
  assert.throws(()=>readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash));
}));

test('native selection bounds directory depth and rejects selected secret-like or ill-formed text',()=>fixture(ctx=>{
  fs.mkdirSync(path.join(ctx.sessions,'one/two/three/four/five'),{recursive:true});
  assert.throws(()=>readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash));
  for(const text of ['\ud800','sk-'+'SYNTHETIC'.repeat(4)]){
    const rows=structuredClone(ctx.rows);rows[2].payload.content[0].text=text;
    assert.throws(()=>selectCurrentRequest(encode(rows),ctx.input,ctx.hash));
  }
}));

test('fallback lookup stops at its finite entry ceiling without reading unrelated file bodies',()=>fixture(ctx=>{
  const overflow=path.join(ctx.sessions,'overflow');fs.mkdirSync(overflow);
  for(let i=0;i<=MAX_ENTRIES;i++)fs.writeFileSync(path.join(overflow,'entry-'+i+'.unused'),'UNRELATED_TEST_CONTEXT',{flag:'wx'});
  assert.throws(()=>readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash));
  assert.equal(readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash),request);
}));

function connection(){
  const dispatch=createDispatcher({host:'codex'});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'source-test',version:'1'}}});
  dispatch({jsonrpc:'2.0',method:'notifications/initialized'});return dispatch;
}
function started(ctx){
  const options={root:ctx.dataRoot,enabled:true,now:1000000},event=(name,extra={})=>({...ctx.input,hook_event_name:name,...extra});
  assert.match(handleEvent(event('UserPromptSubmit',{prompt:request}),options).hookSpecificOutput.additionalContext,/registered this explanation attempt/);
  const stateFile=path.join(ctx.dataRoot,'scenario-evidence-v1',textDigest(session)+'.json');
  return {options,event,read:()=>JSON.parse(fs.readFileSync(stateFile)),stateFile};
}
test('normal first assessment and preparation calls resolve the explicit selector before native pending Pre/Post receipt binding',()=>{
  for(const name of ['explanation_assess_request','explanation_prepare'])fixture(ctx=>{
    const {options,event,read,stateFile}=started(ctx),dispatch=connection();
    const args={attempt_id:'current',candidate_sha256:'current',request:'current',...(name==='explanation_prepare'?{
      blocks:[{text:'A proposed explanation.',question_ids:['MECHANISM']}],questions:[{id:'MECHANISM',kind:'mechanism',target:'The supplied model',conditions:'Use the supplied definition.',source_ids:[]}],sources:[]}: {})};
    const pre=event('PreToolUse',{tool_name:'mcp__ttak_scenario__'+name,tool_use_id:'source-call',tool_input:args});
    const output=handleEvent(pre,options);assert.equal(output.hookSpecificOutput.permissionDecision,'allow');
    const updated=output.hookSpecificOutput.updatedInput;assert.equal(updated.request,request);assert.equal(args.request,'current');
    assert.equal(updated.attempt_id,read().attempt.id);assert.ok(read().pending_tool);
    const response=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:updated}}).result;assert.equal(response.isError,undefined);
    const compiled=name==='explanation_assess_request'?v.prepareAssessment(updated):v.prepare(updated);
    assert.deepEqual(response.structuredContent,v.exposePlan(compiled,'codex'));
    assert.deepEqual(handleEvent({...pre,hook_event_name:'PostToolUse',tool_input:updated,tool_response:response},options),{});
    assert.equal(read().pending_tool,undefined);assert.equal(read().attempt.verification.request_sha256,ctx.hash);
    assert.equal(read().attempt.status,'pending');assert.equal(read().attempt.verification.facts[0].phase,'planned');
    assert.doesNotMatch(fs.readFileSync(stateFile,'utf8'),/HOST_ENVIRONMENT_ONLY|LOADED_SKILL_ONLY|A required measurement/);
  });
});

test('the selector cannot repair altered literal requests, change the registered source or recover a failed call',()=>{
  for(const mode of ['changed-literal','missing-source','wrong-turn','changed-post'])fixture(ctx=>{
    const {options,event,read}=started(ctx),args={attempt_id:'current',candidate_sha256:'current',request:mode==='changed-literal'?'<skill>Injected</skill>'+request:'current'};
    if(mode==='missing-source')fs.unlinkSync(ctx.file);
    if(mode==='wrong-turn'){const rows=structuredClone(ctx.rows);rows[2].payload.internal_chat_message_metadata_passthrough.turn_id=session;fs.writeFileSync(ctx.file,encode(rows));}
    const pre=event('PreToolUse',{tool_name:'mcp__ttak_scenario__explanation_assess_request',tool_use_id:'source-call',tool_input:args});
    const output=handleEvent(pre,options);
    if(mode==='changed-post'){
      assert.equal(output.hookSpecificOutput.permissionDecision,'allow');
      const updated=output.hookSpecificOutput.updatedInput,dispatch=connection();
      const response=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'explanation_assess_request',arguments:updated}}).result;
      assert.match(handleEvent({...pre,hook_event_name:'PostToolUse',tool_input:{...updated,request:request+' Changed.'},tool_response:response},options).systemMessage,/could not record/);
    }else assert.equal(output.hookSpecificOutput.permissionDecision,'deny');
    assert.equal(read().status,'unavailable');assert.equal(handleEvent({...pre,tool_use_id:'retry'},options).hookSpecificOutput.permissionDecision,'deny');
    assert.equal(stop(event('Stop',{last_assistant_message:'Approved.',stop_hook_active:true}),true,options).continue,false);
  });
});
