'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { scenarioCodexArguments } = require('../scripts/finite-scenario-codex.cjs');
const { testPython } = require('../scripts/test-python.cjs');
const executable = 'C:\\Program Files\\nodejs\\node.exe';
const server = 'D:\\AI_DEV\\ttak\\.superpowers\\worktrees\\first-release\\scripts\\finite-scenario-mcp.cjs';
test('pins Luna and confines the candidate command to a read-only single MCP server invocation', () => {
  const args = scenarioCodexArguments(executable, server);
  assert.equal(args[args.indexOf('--model')+1], 'gpt-5.6-luna');
  assert.equal(args[args.indexOf('--sandbox')+1], 'read-only');
  assert.ok(args.includes('approval_policy="never"'));
  assert.ok(args.includes('web_search="disabled"'));
  assert.equal(args[args.indexOf('--disable')+1], 'shell_tool');
  assert.ok(!args.some(arg=>arg.includes('bypass')||arg.includes('ignore-rules')));
  assert.equal(args.at(-1), '-');
});
test('TOML overrides round-trip through the platform parser with exact paths and restricted tool settings', () => {
  const args = scenarioCodexArguments(executable, server);
  const input = args.filter((_,i)=>i>0 && args[i-1]==='-c').join('\n');
  const result = spawnSync(testPython(),
    ['-I','-S','-B','-c','import sys,tomllib,json; print(json.dumps(tomllib.loads(sys.stdin.read())))'],
    {input,encoding:'utf8',timeout:5000,maxBuffer:65536,windowsHide:true,
      env:Object.fromEntries(Object.entries(process.env).filter(([key])=>['SYSTEMROOT','WINDIR','PATH'].includes(key.toUpperCase())))});
  assert.equal(result.status,0); assert.equal(result.stderr,'');
  const config = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(config.mcp_servers), ['finite_scenario']);
  assert.deepEqual(config.mcp_servers.finite_scenario, {command:executable,args:[server],env_vars:[],
    env:{OPENAI_API_KEY:'',ANTHROPIC_API_KEY:'',CLAUDE_CODE_OAUTH_TOKEN:''},enabled:true,required:true,
    enabled_tools:['scenario_explain'],startup_timeout_sec:10,tool_timeout_sec:10,default_tools_approval_mode:'writes'});
});
test('relative paths and control characters cannot enter an invocation', () => {
  for (const value of ['node.exe','..\\server.cjs','D:\\test\nfile.cjs','D:\\test\u0000file.cjs']) {
    assert.throws(()=>scenarioCodexArguments(value,server),/invalid_scenario_command_path/);
    assert.throws(()=>scenarioCodexArguments(executable,value),/invalid_scenario_command_path/);
  }
});
