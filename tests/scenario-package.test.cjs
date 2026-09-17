'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');

test('every bound parent and child MCP call has both pre and post hook coverage on its normal host',()=>{
  const hooks=JSON.parse(fs.readFileSync(path.join(root,'hooks/hooks.json'))).hooks;
  for(const name of ['assess_request','notice_from_assessment','decide','repair_notice','prepare','next','check_final','dispatch','packet','fact_result','final_result','notice_result','assessment_result'])for(const prefix of ['mcp__ttak_scenario__','mcp__plugin_ttak_ttak_scenario__']){
    const tool=prefix+'explanation_'+name;
    for(const event of ['PreToolUse','PostToolUse'])assert.ok(hooks[event].some(group=>new RegExp(group.matcher).test(tool)),event+' '+tool);
  }
});

test('packaged MCP configuration launches with only the bundled runtime files', () => {
  const runtime=path.join(root,'.superpowers');
  fs.mkdirSync(runtime,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(runtime,'scenario-package-test-'));
  try {
    const files=require('../hooks/scenario-evidence.cjs').CANDIDATE_FILES;
    for(const file of files){
      const target=path.join(fixture,file);fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,fs.readFileSync(path.join(root,file)),{flag:'wx'});
    }
    const read=file=>JSON.parse(fs.readFileSync(path.join(fixture,file),'utf8'));
    assert.equal(typeof read('.codex-plugin/plugin.json').mcpServers,'object');
    assert.equal(fs.existsSync(path.join(fixture,'.codex-plugin/mcp.json')),false);
    assert.equal(read('.claude-plugin/plugin.json').mcpServers,'./.claude-plugin/mcp.json');
    assert.equal(read('.claude-plugin/plugin.json').version,read('.codex-plugin/plugin.json').version);
    let observed;
    const scenario={initial:{A:true,B:true},invariant:{cells:['A','B'],at_least:1},transactions:[
      {id:'T1',guard:{cells:['A','B'],at_least:2},writes:{A:false}},
      {id:'T2',guard:{cells:['A','B'],at_least:2},writes:{B:false}}]};
    const draft='Both transactions read A and B, but write different cells. Concurrent snapshots can violate the invariant. PostgreSQL SERIALIZABLE permits concurrent execution and may require whole-transaction retry.';
    const toolInput={scenario,draft,language:'en'};
    for(const host of ['claude','codex']) {
    const config=read(host==='codex'?'.codex-plugin/plugin.json':'.claude-plugin/mcp.json').mcpServers;
    assert.deepEqual(Object.keys(config),['ttak_scenario']);
    const server=config.ttak_scenario;
    assert.equal(server.command,'node');
    assert.deepEqual(server.env,{OPENAI_API_KEY:'',ANTHROPIC_API_KEY:'',CLAUDE_CODE_OAUTH_TOKEN:''});
    const args=server.args.map(value=>value.replaceAll('${CLAUDE_PLUGIN_ROOT}',fixture));
    const cwd=host==='codex'?path.resolve(fixture,server.cwd):fixture;
    assert.equal(cwd,fixture);
    if(host==='codex') assert.ok(server.args.every(value=>!value.includes('${')));
    assert.ok(path.relative(fixture,path.resolve(cwd,args[0])).startsWith('scripts'+path.sep));
    assert.deepEqual(args.slice(1),['--host',host]);
    const init={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'package-test',version:'1'}}};
    const rows=[init,{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list',params:{}},
      {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'scenario_review',arguments:toolInput}}];
    const result=spawnSync(process.execPath,args,{cwd,input:rows.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',
      timeout:5000,maxBuffer:1048576,windowsHide:true,
      env:{...Object.fromEntries(Object.entries(process.env).filter(([k])=>['SYSTEMROOT','WINDIR','PATH'].includes(k.toUpperCase()))),...server.env}});
    assert.equal(result.status,0);assert.equal(result.stderr,'');
    const output=result.stdout.trim().split('\n').map(JSON.parse);
    assert.equal(output[1].result.tools[0].name,'scenario_review');
    const listed=output[1].result.tools.map(t=>t.name);
    assert.equal(listed.length,16);assert.ok(listed.includes('explanation_revise_final'));assert.ok(listed.includes('explanation_final_preview'));assert.ok(listed.includes('explanation_result'));assert.ok(listed.includes('explanation_notice_from_assessment'));assert.ok(listed.includes('explanation_assess_request'));assert.ok(listed.includes('explanation_assessment_result'));
    assert.equal(listed.includes('explanation_packet'),host==='claude');assert.equal(listed.includes('explanation_dispatch'),host==='codex');
    assert.equal(output[2].result.isError,undefined);observed=output[2].result;
    }
    assert.match(read('hooks/hooks.json').hooks.Stop[0].hooks[0].command,/hooks\/scenario-stop\.cjs/);
    const data=path.join(fixture,'data');fs.mkdirSync(data);
    fs.writeFileSync(path.join(data,'state.json'),JSON.stringify({enabled:true}));
    const stop=spawnSync(process.execPath,[path.join(fixture,'hooks/scenario-stop.cjs')],{cwd:fixture,
      input:JSON.stringify({hook_event_name:'Stop',stop_hook_active:false,last_assistant_message:'Serializable requires that one transaction completes before the other begins.'}),
      encoding:'utf8',timeout:5000,maxBuffer:16384,windowsHide:true,env:{PLUGIN_DATA:data}});
    assert.equal(stop.status,0);assert.equal(JSON.parse(stop.stdout).decision,'block');
    const invoke=(file,input)=>{
      const result=spawnSync(process.execPath,[path.join(fixture,'hooks',file)],{cwd:fixture,
        input:JSON.stringify({session_id:'package-session',turn_id:'package-turn',...input}),
        encoding:'utf8',timeout:5000,maxBuffer:16384,windowsHide:true,env:{PLUGIN_DATA:data}});
      assert.equal(result.status,0);assert.equal(result.stderr,'');return JSON.parse(result.stdout);
    };
    assert.deepEqual(invoke('scenario-evidence.cjs',{hook_event_name:'UserPromptSubmit',prompt:'Compute the model.'}),{});
    assert.deepEqual(invoke('scenario-evidence.cjs',{hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__scenario_review',
      tool_input:toolInput,tool_response:observed}),{});
    const final={hook_event_name:'Stop',stop_hook_active:false,last_assistant_message:draft};
    assert.match(invoke('scenario-stop.cjs',final).reason,/required evidence check/);
    assert.deepEqual(invoke('scenario-stop.cjs',final),{});
    assert.deepEqual(invoke('scenario-evidence.cjs',{hook_event_name:'UserPromptSubmit',prompt:'Compute the next model.'}),{});
    assert.deepEqual(invoke('scenario-evidence.cjs',{hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__scenario_review',
      tool_input:toolInput,tool_response:observed.content}),{});
    assert.match(invoke('scenario-stop.cjs',final).reason,/required evidence check/);
    assert.deepEqual(invoke('scenario-stop.cjs',final),{});
    assert.deepEqual(invoke('scenario-evidence.cjs',{hook_event_name:'UserPromptSubmit',prompt:'Compute the text-result model.'}),{});
    assert.deepEqual(invoke('scenario-evidence.cjs',{hook_event_name:'PostToolUse',tool_name:'mcp__ttak_scenario__scenario_review',
      tool_input:toolInput,tool_response:observed.content[0].text}),{});
    assert.match(invoke('scenario-stop.cjs',final).reason,/required evidence check/);
    assert.deepEqual(invoke('scenario-stop.cjs',final),{});
    const registered=invoke('scenario-evidence.cjs',{hook_event_name:'UserPromptSubmit',prompt:'Explain the example with an essential measurement.'});
    assert.match(registered.hookSpecificOutput.additionalContext,/registered this explanation attempt/);
    // No scenario finding cannot satisfy the independent completion decision.
    assert.equal(invoke('scenario-stop.cjs',{...final,stop_hook_active:true}).continue,false);
    const malformed=spawnSync(process.execPath,[path.join(fixture,'hooks/scenario-evidence.cjs')],{cwd:fixture,
      input:'{"hook_event_name":',encoding:'utf8',timeout:5000,maxBuffer:16384,windowsHide:true,env:{PLUGIN_DATA:data}});
    assert.equal(malformed.status,2);assert.equal(JSON.parse(malformed.stdout).continue,false);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(fixture)),fs.realpathSync(runtime));
    fs.rmSync(fixture,{recursive:true});
  }
});

test('native candidate binding includes every inline MCP launch field in the manifest',()=>{
  const runtime=path.join(root,'.superpowers'),fixture=fs.mkdtempSync(path.join(runtime,'inline-binding-test-'));
  try{
    const files=require('../hooks/scenario-evidence.cjs').CANDIDATE_FILES;
    assert.ok(files.includes('.codex-plugin/plugin.json'));assert.equal(files.includes('.codex-plugin/mcp.json'),false);
    for(const file of files){
      const target=path.join(fixture,file);fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,fs.readFileSync(path.join(root,file)),{flag:'wx'});
    }
    const {candidateDigest}=require(path.join(fixture,'hooks/scenario-evidence.cjs')),file=path.join(fixture,'.codex-plugin/plugin.json');
    const raw=fs.readFileSync(file),original=JSON.parse(raw),before=candidateDigest();
    const changes=[
      m=>{m.mcpServers.ttak_scenario.command='different-node';},
      m=>{m.mcpServers.ttak_scenario.args[0]='scripts/different.cjs';},
      m=>{m.mcpServers.ttak_scenario.args[2]='claude';},
      m=>{m.mcpServers.ttak_scenario.cwd='different';},
      m=>{delete m.mcpServers.ttak_scenario.env.OPENAI_API_KEY;},
      m=>{m.mcpServers.other=m.mcpServers.ttak_scenario;delete m.mcpServers.ttak_scenario;}
    ];
    for(const change of changes){
      const altered=structuredClone(original);change(altered);fs.writeFileSync(file,JSON.stringify(altered));
      assert.notEqual(candidateDigest(),before);
      fs.writeFileSync(file,raw);assert.equal(candidateDigest(),before);
    }
  }finally{
    assert.equal(path.dirname(fs.realpathSync(fixture)),fs.realpathSync(runtime));
    fs.rmSync(fixture,{recursive:true});
  }
});
