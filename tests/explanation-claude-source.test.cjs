'use strict';
// Pinned native-shaped fixtures exercise source selection, not live host delivery.
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const source=require('../scripts/explanation-request-source.cjs'),{textDigest}=require('../scripts/verification-packet.cjs');
const {handleEvent}=require('../hooks/scenario-evidence.cjs'),{createDispatcher}=require('../scripts/scenario-feedback-mcp.cjs');
const session='12345678-1234-1234-1234-123456789150',promptId='22345678-1234-1234-1234-123456789150',userId='32345678-1234-1234-1234-123456789150';
const request='Explain the fictional Daro register. Reading preserves its integer. A quoted <command-args>example</command-args> is part of this request.';
const prefix='<command-message>ttak:ttak-explain</command-message>\n<command-name>/ttak:ttak-explain</command-name>\n<command-args>',suffix='</command-args>';
const encode=rows=>rows.map(JSON.stringify).join('\n')+'\n';
function fixture(body){
  const runtime=path.resolve(__dirname,'../.superpowers'),root=fs.mkdtempSync(path.join(runtime,'claude-source-test-'));
  const profile=path.join(root,'profile'),dataRoot=path.join(profile,'plugins/data/ttak'),projects=path.join(profile,'projects'),directory=path.join(projects,'native-project'),cwd=path.join(root,'work'),file=path.join(directory,session+'.jsonl');
  fs.mkdirSync(dataRoot,{recursive:true});fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(cwd);
  const row={parentUuid:null,isSidechain:false,promptId,type:'user',message:{role:'user',content:prefix+request+suffix},uuid:userId,timestamp:'2026-09-13T01:00:00.000Z',userType:'external',entrypoint:'sdk-cli',cwd,sessionId:session,version:'2.1.266'};
  const rows=[row,{...row,uuid:'42345678-1234-1234-1234-123456789150',isMeta:true,message:{role:'user',content:[{type:'text',text:'LOADED_SKILL_ONLY'}]}}];
  fs.writeFileSync(file,encode(rows),{flag:'wx'});const input={session_id:session,cwd,transcript_path:file};
  try{body({root,profile,dataRoot,projects,directory,cwd,file,row,rows,input,hash:textDigest(request)});}
  finally{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(runtime));fs.rmSync(root,{recursive:true});}
}
test('Claude selects the exact registered original from the observed native command wrapper',()=>fixture(ctx=>{
  const original=fs.readFileSync(ctx.file);
  assert.equal(source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'),request);
  assert.equal(source.readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash,'claude'),request);
  assert.deepEqual(fs.readFileSync(ctx.file),original);
  const literal=prefix+request+suffix;fs.writeFileSync(ctx.file,encode([{...ctx.row,message:{role:'user',content:literal}}]));
  assert.equal(source.readCurrentRequest(ctx.input,ctx.dataRoot,textDigest(literal),'claude'),literal);
}));
test('the latest external non-meta user record governs selection; older matching text cannot repair a changed request',()=>fixture(ctx=>{
  const later={...ctx.row,uuid:'52345678-1234-1234-1234-123456789150',promptId:'62345678-1234-1234-1234-123456789150',message:{role:'user',content:'Explain a different task.'}};
  fs.writeFileSync(ctx.file,encode([...ctx.rows,later]));assert.throws(()=>source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'));
  fs.writeFileSync(ctx.file,encode([later,...ctx.rows]));assert.equal(source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'),request);
  for(const change of [r=>{r.sessionId=promptId;},r=>{r.version='2.1.267';},r=>{r.cwd=ctx.profile;},r=>{r.userType='internal';},r=>{r.isSidechain=true;},r=>{r.isMeta=true;},r=>{r.message.role='assistant';},r=>{r.promptId='bad';},r=>{r.message.content='Changed '+request;}]){
    const row=structuredClone(ctx.row);change(row);fs.writeFileSync(ctx.file,encode([row]));assert.throws(()=>source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'));
  }
  fs.writeFileSync(ctx.file,encode([ctx.row,ctx.row]));assert.throws(()=>source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'));
}));
test('Claude source paths, links, ambiguity, UTF-8 and finite snapshots retain the existing hard boundaries',()=>fixture(ctx=>{
  for(const transcript_path of [path.join(ctx.root,session+'.jsonl'),path.join(ctx.directory,'missing.jsonl'),'relative.jsonl',''])assert.throws(()=>source.readCurrentRequest({...ctx.input,transcript_path},ctx.dataRoot,ctx.hash,'claude'));
  const linked=path.join(ctx.root,'linked.jsonl');fs.linkSync(ctx.file,linked);assert.throws(()=>source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'));fs.unlinkSync(linked);
  const other=path.join(ctx.projects,'duplicate');fs.mkdirSync(other);const duplicate=path.join(other,session+'.jsonl');fs.copyFileSync(ctx.file,duplicate,fs.constants.COPYFILE_EXCL);
  assert.throws(()=>source.readCurrentRequest({...ctx.input,transcript_path:null},ctx.dataRoot,ctx.hash,'claude'));fs.unlinkSync(duplicate);
  fs.appendFileSync(ctx.file,'{"unfinished');assert.equal(source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'),request);
  for(const raw of ['{bad}\n',Buffer.from([255,10]),encode([{...ctx.row,message:{role:'user',content:'sk-'+'SYNTHETIC'.repeat(4)}}])]){
    fs.writeFileSync(ctx.file,raw);assert.throws(()=>source.readCurrentRequest(ctx.input,ctx.dataRoot,ctx.hash,'claude'));
  }
}));
test('normal Claude Pre/Post resolves only the explicit original selector for both first tools',()=>{
  for(const name of ['explanation_assess_request','explanation_prepare'])fixture(ctx=>{
    const options={root:ctx.dataRoot,enabled:true,now:1000000},event=(hook_event_name,extra={})=>({...ctx.input,hook_event_name,...extra});
    handleEvent(event('UserPromptSubmit',{prompt:'/ttak:ttak-explain '+request}),options);
    const dispatch=createDispatcher({host:'claude'});dispatch({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'claude-source-test',version:'1'}}});dispatch({jsonrpc:'2.0',method:'notifications/initialized'});
    const input={attempt_id:'current',candidate_sha256:'current',request:'current',...(name==='explanation_prepare'?{draft:'The read leaves the integer unchanged.'}: {})};
    const pre=event('PreToolUse',{tool_name:'mcp__plugin_ttak_ttak_scenario__'+name,tool_use_id:'native-original',tool_input:input}),allowed=handleEvent(pre,options);
    assert.equal(allowed.hookSpecificOutput.permissionDecision,'allow');const bound=allowed.hookSpecificOutput.updatedInput;assert.equal(bound.request,request);
    const response=dispatch({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:bound}}).result;assert.equal(response.isError,undefined);
    assert.deepEqual(handleEvent({...pre,hook_event_name:'PostToolUse',tool_input:bound,tool_response:response},options),{});
    const state=JSON.parse(fs.readFileSync(path.join(ctx.dataRoot,'scenario-evidence-v1',textDigest(session)+'.json')));assert.equal(state.request_sha256,ctx.hash);assert.equal(Object.hasOwn(state,'pending_tool'),false);
  });
});
