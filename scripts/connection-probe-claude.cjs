'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { nativeEnvironment } = require('./review-native-format.cjs');
const { boundedNativeProcess, checkedTimeoutMs } = require('./bounded-native-process.cjs');
const { safe } = require('./connection-probe.cjs');
const root = path.resolve(__dirname, '..');
const evidence = path.join(root, '.superpowers/native-connection-90');
const afterAliasFix = process.argv.includes('--after-tool-alias-fix');
const directory = path.join(evidence, afterAliasFix ? 'claude-attempt-02' : 'claude-attempt-01');
const model = 'claude-haiku-4-5-20251001';
// CLI 2.1.266 exposed --tools Agent as Task in the observed Haiku session.
const isAgentTool = name => name === 'Agent' || name === 'Task';
const promptPath = path.join(root, 'docs/prompts/2026-09-11-session-08-claude-connection.md');
function initial() { return { host: 'claude', init: null, messages: [], tools: [], inputs: [],
  results: [], tasks: [], errors: [], native_input_isolation_verified: false, quality_verified: false }; }
function observe(r, row) {
  if (row.type === 'system' && row.subtype === 'init') {
    r.init = { session_id: row.session_id, model: row.model, tools: row.tools,
      mcp_count: (row.mcp_servers || []).length, plugin_count: (row.plugins || []).length };
    if (row.model !== model || r.init.mcp_count || r.init.plugin_count ||
        !Array.isArray(row.tools) || row.tools.length !== 1 || !isAgentTool(row.tools[0])) throw new Error('unexpected_init');
  } else if (row.type === 'system' && row.subtype === 'api_retry') {
    throw new Error('api_retry_observed');
  } else if (row.type === 'assistant') {
    const m = row.message || {};
    if (m.model !== model) throw new Error('model_mismatch');
    const usage = Object.fromEntries(Object.entries(m.usage || {}).filter(([k, v]) =>
      ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].includes(k) && Number.isSafeInteger(v)));
    const item = { id: m.id, model: m.model, parent_tool_use_id: row.parent_tool_use_id || null, usage, text: [] };
    for (const block of m.content || []) {
      if (block.type === 'text') item.text.push(block.text);
      if (block.type === 'tool_use') {
        r.tools.push({ id: block.id, name: block.name, input: block.input,
          parent_tool_use_id: row.parent_tool_use_id || null });
        if (!isAgentTool(block.name) || row.parent_tool_use_id || r.tools.length > 1 ||
            block.input?.subagent_type === 'fork' || block.input?.resume || block.input?.run_in_background) {
          throw new Error('unexpected_agent_action');
        }
      }
    }
    r.messages.push(item);
  } else if (row.type === 'user') {
    const content = row.message?.content;
    if (row.parent_tool_use_id) {
      const text = typeof content === 'string' ? [content] : (content || []).filter(b => b.type === 'text').map(b => b.text);
      r.inputs.push({ parent_tool_use_id: row.parent_tool_use_id, text });
    }
    if (Array.isArray(content)) for (const block of content) {
      if (block.type === 'tool_result') {
        r.tasks.push({ tool_use_id: block.tool_use_id, is_error: !!block.is_error, content: block.content });
        if (block.is_error) throw new Error('agent_tool_failed');
      }
    }
  } else if (row.type === 'result') {
    r.results.push({ session_id: row.session_id, subtype: row.subtype, is_error: row.is_error,
      result: row.result, num_turns: row.num_turns, duration_ms: row.duration_ms,
      usage: row.usage, modelUsage: row.modelUsage, client_estimated_cost_usd: row.total_cost_usd,
      permission_denial_count: (row.permission_denials || []).length });
    if (row.is_error || row.subtype !== 'success' || row.permission_denials?.length ||
        Object.keys(row.modelUsage || {}).some(key => key !== model)) throw new Error('native_result_failed');
  }
  if (r.messages.length > 24 || r.inputs.length > 8 || r.results.length > 1 || r.tasks.length > 4) throw new Error('event_limit');
  safe(r);
}
function worker() {
  const reservation = JSON.parse(fs.readFileSync(path.join(directory, 'reservation.json'), 'utf8'));
  const r = initial(); const decoder = new StringDecoder('utf8');
  let buffer = '', bytes = 0, done = false;
  const checkpoint = () => fs.writeFileSync(path.join(directory, 'observations.json'), safe(r) + '\n');
  const cli = spawn('C:\\Users\\js\\.local\\bin\\claude.exe', ['-p', '--model', model,
    '--output-format', 'stream-json', '--verbose', '--forward-subagent-text', '--include-hook-events',
    '--tools', 'Agent', '--allowedTools', 'Agent', '--disallowedTools', 'Agent(fork)',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--session-id', reservation.session_id],
  { cwd: directory, env: process.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const finish = error => {
    if (done) return; done = true;
    if (error) r.errors.push(error);
    try { checkpoint(); process.stdout.write(safe(r) + '\n'); }
    catch { process.stdout.write('{"errors":["report_withheld"]}\n'); }
    process.exitCode = error ? 1 : 0;
    if (error) { cli.kill(); setTimeout(() => process.exit(1), 300).unref(); }
  };
  cli.on('error', () => finish('cli_launch_failed'));
  cli.stdin.on('error', () => finish('cli_input_failed'));
  cli.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > 2000000) finish('output_limit'); });
  cli.stdout.on('data', chunk => {
    bytes += chunk.length; if (bytes > 2000000) return finish('output_limit');
    buffer += decoder.write(chunk); let at;
    while (!done && (at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
      try { observe(r, JSON.parse(line)); checkpoint(); }
      catch (error) {
        const known = ['unexpected_init', 'api_retry_observed', 'model_mismatch', 'unexpected_agent_action',
          'agent_tool_failed', 'native_result_failed', 'event_limit', 'report_withheld'];
        finish(known.includes(error.message) ? error.message : 'invalid_protocol');
      }
    }
  });
  cli.on('close', code => finish(code !== 0 ? 'cli_failed' :
    r.results.length !== 1 || r.tools.length !== 1 || r.tasks.length !== 1 ? 'incomplete_connection' : null));
  cli.stdin.end(fs.readFileSync(promptPath, 'utf8'));
}
async function run() {
  const timeoutMs = checkedTimeoutMs(Number(process.env.TTAK_NATIVE_TIMEOUT_MS));
  const codex = JSON.parse(fs.readFileSync(path.join(evidence, 'codex-attempt-02/audit.json'), 'utf8'));
  if (codex.connection_status !== 'PASS') throw new Error('codex_not_passed');
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) throw new Error('subscription_oauth_environment_missing');
  fs.mkdirSync(directory);
  const reservation = { session_id: crypto.randomUUID(), model, timeout_ms: timeoutMs,
    top_level_limit: 1, requested_child_limit: 1, automatic_top_level_retries: 0,
    after_tool_alias_fix: afterAliasFix,
    billing_evidence: 'User confirms MAX 20 OAuth included usage only; paid extra usage disabled',
    prompt_sha256: crypto.createHash('sha256').update(fs.readFileSync(promptPath)).digest('hex'),
    started_at: new Date().toISOString() };
  fs.writeFileSync(path.join(directory, 'reservation.json'), safe(reservation) + '\n', { flag: 'wx' });
  const env = nativeEnvironment('claude', path.join(root, '.superpowers/release-run-03/profiles/claude-ttak'), process.env, 'haiku-luna');
  const result = await boundedNativeProcess({ executable: process.execPath,
    arguments: [__filename, '--worker', ...(afterAliasFix ? ['--after-tool-alias-fix'] : [])],
    cwd: directory, input: '', timeoutMs, stdoutLimit: 524288, stderrLimit: 4096, cleanupMs: 5000 },
  { powershell: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', env });
  const summary = { ...result, stdout: undefined, stderr: undefined };
  fs.writeFileSync(path.join(directory, 'process.json'), safe(summary) + '\n', { flag: 'wx' });
  process.stdout.write(safe(summary) + '\n');
  if (result.status !== 'exited' || result.exitCode !== 0) process.exitCode = 1;
}
module.exports = { initial, observe };
if (require.main === module) {
  if (process.argv[2] === '--worker') worker();
  else if (process.argv[2] === '--run-once') run().catch(() => {
    process.stdout.write('{"error":"runner_failed_check_reserved_directory_cleanup_unverified"}\n'); process.exitCode = 1;
  });
  else process.exitCode = 2;
}
