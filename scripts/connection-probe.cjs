'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { boundedNativeProcess, checkedTimeoutMs } = require('./bounded-native-process.cjs');
const { nativeEnvironment, possibleSecret } = require('./review-native-format.cjs');
const root = path.resolve(__dirname, '..');
const evidence = path.join(root, '.superpowers/native-connection-90');
const profile = path.join(root, '.superpowers/release-run-03/profiles/codex-ttak');
const executable = 'C:\\Users\\js\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin\\codex.exe';
const model = 'gpt-5.6-luna';
// A separately authorized observation after the user completed test-profile login.
const attemptName = process.argv.includes('--after-login') ? 'codex-attempt-02' : 'codex-attempt-01';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const safe = value => {
  const text = JSON.stringify(value);
  if (text.length > 500000 || possibleSecret(text)) throw new Error('report_withheld');
  return text;
};
function initial() {
  return { host: 'codex', model_requested: model, effort_requested: 'high', parent: null,
    requested_turns: 0, messages: [], tools: [], usage: [], turns: [], hooks: [],
    errors: [], native_input_isolation_verified: false, quality_verified: false,
    internal_api_response_count: null, internal_retry_count: null };
}
function observe(report, row) {
  const p = row.params || {};
  if (row.method === 'thread/tokenUsage/updated') {
    const counters = x => Object.fromEntries(Object.entries(x || {}).filter(([k, v]) =>
      ['inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'outputTokens',
        'reasoningOutputTokens', 'totalTokens'].includes(k) && Number.isSafeInteger(v) && v >= 0));
    report.usage.push({ threadId: p.threadId, turnId: p.turnId,
      last: counters(p.tokenUsage?.last), total: counters(p.tokenUsage?.total) });
  } else if (row.method === 'item/completed') {
    const item = p.item || {};
    if (item.type === 'agentMessage') {
      if (typeof item.text !== 'string' || item.text.length > 20000) throw new Error('message_limit');
      report.messages.push({ threadId: p.threadId, id: item.id, text: item.text });
    } else if (item.type === 'collabAgentToolCall') {
      const out = { threadId: p.threadId };
      for (const key of ['id', 'tool', 'status', 'senderThreadId', 'receiverThreadIds', 'model',
        'reasoningEffort', 'prompt']) if (Object.hasOwn(item, key)) out[key] = item[key];
      out.agentsStates = Object.fromEntries(Object.entries(item.agentsStates || {}).map(([id, value]) =>
        [id, { status: value.status }]));
      report.tools.push(out);
      if (!['spawnAgent', 'wait', 'closeAgent', 'listAgents'].includes(item.tool)) throw new Error('unexpected_agent_action');
      if (report.tools.filter(t => t.tool === 'spawnAgent').length > 1) throw new Error('extra_spawn_observed');
      if (item.status === 'failed' || item.status === 'interrupted') throw new Error('agent_tool_failed');
    } else if (!['reasoning', 'userMessage'].includes(item.type)) throw new Error('unexpected_tool');
  } else if (row.method === 'turn/completed') {
    report.turns.push({ threadId: p.threadId, id: p.turn?.id, status: p.turn?.status });
    if (p.turn?.status !== 'completed') throw new Error('turn_failed');
  } else if (row.method === 'hook/completed') {
    const h = p.run || {};
    report.hooks.push({ eventName: h.eventName, status: h.status, source: h.source });
    if (['blocked', 'failed', 'error', 'timedOut'].includes(h.status)) throw new Error('hook_denied');
  } else if (row.method === 'error') throw new Error('native_error');
  if (report.tools.length > 12 || report.messages.length > 16 || report.usage.length > 64 ||
      report.hooks.length > 32 || report.turns.length > 3) throw new Error('event_limit');
  safe(report);
}
function validateConfig(config) {
  if (!config || Object.keys(config.mcp_servers || {}).length ||
      Object.keys(config.model_providers || {}).length ||
      (config.model_provider && config.model_provider !== 'openai')) throw new Error('unexpected_provider_or_connector');
  const plugins = config.plugins || {};
  if (Object.keys(plugins).length !== 2 || plugins['ttak@ttak-release']?.enabled !== true ||
      plugins['ttak@ttak-stop77']?.enabled !== false) throw new Error('plugin_selection_changed');
}
function worker() {
  const prompt = fs.readFileSync(path.join(root, 'docs/prompts/2026-09-11-session-07-codex-connection.md'), 'utf8');
  const report = initial();
  const directory = path.join(evidence, attemptName);
  const checkpoint = () => fs.writeFileSync(path.join(directory, 'observations.json'), safe(report) + '\n');
  let done = false, buffer = '', bytes = 0, threadStarted = false;
  const decoder = new StringDecoder('utf8');
  const child = spawn(executable, ['-c', 'model_reasoning_effort="high"', '--disable', 'shell_tool',
    '-c', 'web_search="disabled"', 'app-server', '--stdio'],
  { cwd: directory, env: process.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const send = row => child.stdin.write(JSON.stringify(row) + '\n');
  const finish = reason => {
    if (done) return;
    done = true;
    if (reason) report.errors.push(reason);
    try { checkpoint(); process.stdout.write(safe(report) + '\n'); }
    catch { process.stdout.write('{"errors":["report_withheld"]}\n'); }
    child.stdin.end();
    // The outer Windows Job owns the app-server and descendants, even after this worker exits.
    process.exitCode = reason ? 1 : 0;
    setTimeout(() => process.exit(process.exitCode), 300).unref();
  };
  child.on('error', () => finish('app_server_launch_failed'));
  child.stdin.on('error', () => finish('app_server_input_failed'));
  child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > 2000000) finish('output_limit'); });
  child.on('close', () => { if (!done) finish('app_server_closed_early'); });
  child.stdout.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > 2000000) return finish('output_limit');
    buffer += decoder.write(chunk);
    let at;
    while (!done && (at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
      try {
        const row = JSON.parse(line);
        if (row.id != null && row.method) {
          send({ id: row.id, error: { code: -32601, message: 'Unsupported client request' } });
          finish('unexpected_client_request'); break;
        }
        if (row.error) throw new Error('rpc_error');
        if (row.id === 1) {
          send({ method: 'initialized' });
          send({ id: 2, method: 'config/read', params: { includeLayers: false } });
        } else if (row.id === 2) {
          validateConfig(row.result.config); report.config_verified = true;
          send({ id: 3, method: 'hooks/list', params: { cwds: [directory] } });
        } else if (row.id === 3) {
          const hooks = row.result.data.flatMap(value => value.hooks).filter(h => h.enabled);
          const expected = path.join(profile, 'plugins/cache/ttak-release/ttak/0.2.0-rc.1+codex.20260908082818/hooks/ttak.cjs');
          if (hooks.length !== 3 || hooks.some(h => h.pluginId !== 'ttak@ttak-release' ||
              h.trustStatus !== 'trusted' || h.handlerType !== 'command' ||
              h.command.replaceAll('/', '\\') !== ('node "' + expected + '"').replaceAll('/', '\\'))) {
            throw new Error('hook_inventory_changed');
          }
          report.reviewed_hook_count = hooks.length;
          if (threadStarted) throw new Error('second_thread_start');
          threadStarted = true;
          send({ id: 4, method: 'thread/start', params: { cwd: directory, model,
            allowProviderModelFallback: false, sandbox: 'read-only', approvalPolicy: 'never' } });
        } else if (row.id === 4) {
          const r = row.result;
          report.parent = { id: r.thread.id, model: r.model, effort: r.reasoningEffort, provider: r.modelProvider };
          if (r.model !== model || r.reasoningEffort !== 'high' || r.modelProvider !== 'openai') throw new Error('model_mismatch');
          report.requested_turns = 1; checkpoint();
          send({ id: 5, method: 'turn/start', params: { threadId: r.thread.id,
            input: [{ type: 'text', text: prompt }], effort: 'high' } });
        } else {
          observe(report, row);
          // Persist only filtered fields; raw reasoning and raw error bodies never reach the file.
          if (['item/completed', 'thread/tokenUsage/updated', 'turn/completed', 'hook/completed'].includes(row.method)) checkpoint();
          if (row.method === 'turn/completed' && row.params.threadId === report.parent?.id) {
            const children = report.tools.filter(t => t.tool === 'spawnAgent' && t.status === 'completed');
            finish(children.length === 1 ? null : 'independent_child_not_observed');
          }
        }
      } catch (error) {
        const reasons = new Set(['unexpected_provider_or_connector', 'plugin_selection_changed', 'hook_inventory_changed',
          'second_thread_start', 'model_mismatch', 'message_limit', 'unexpected_agent_action', 'extra_spawn_observed',
          'agent_tool_failed', 'unexpected_tool', 'turn_failed', 'hook_denied', 'native_error', 'event_limit', 'report_withheld', 'rpc_error']);
        finish(reasons.has(error.message) ? error.message : 'invalid_protocol');
      }
    }
  });
  send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'ttak_connection90', version: '1' } } });
}
async function run() {
  const timeoutMs = checkedTimeoutMs(Number(process.env.TTAK_NATIVE_TIMEOUT_MS));
  const directory = path.join(evidence, attemptName);
  fs.mkdirSync(directory); // Exclusive reservation: a second execution refuses before spawning.
  const plan = { host: 'codex', requested_model: model, timeout_ms: timeoutMs, top_level_limit: 1,
    requested_child_limit: 1, automatic_top_level_retries: 0, api_token_hard_cap_verified: false,
    subscription_only: true, billing_evidence: 'current user confirmation; no credential inspection',
    login_completed_by_user: attemptName === 'codex-attempt-02',
    prompt_sha256: hash(fs.readFileSync(path.join(root, 'docs/prompts/2026-09-11-session-07-codex-connection.md'))),
    started_at: new Date().toISOString() };
  fs.writeFileSync(path.join(directory, 'reservation.json'), safe(plan) + '\n', { flag: 'wx' });
  const env = nativeEnvironment('codex', profile, process.env, 'haiku-luna');
  const result = await boundedNativeProcess({ executable: process.execPath,
    arguments: [__filename, '--worker', ...(attemptName === 'codex-attempt-02' ? ['--after-login'] : [])],
    cwd: directory, input: '', timeoutMs, stdoutLimit: 524288, stderrLimit: 4096, cleanupMs: 5000 },
  { powershell: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', env });
  const summary = { ...result, stdout: undefined, stderr: undefined };
  fs.writeFileSync(path.join(directory, 'process.json'), safe(summary) + '\n', { flag: 'wx' });
  process.stdout.write(safe(summary) + '\n');
  if (result.status !== 'exited' || result.exitCode !== 0) process.exitCode = 1;
}
module.exports = { initial, observe, validateConfig, safe };
if (require.main === module) {
  if (process.argv[2] === '--worker') worker();
  else if (process.argv[2] === '--run-codex-once') run().catch(() => {
    process.stdout.write('{"error":"runner_failed_check_reserved_directory_cleanup_unverified"}\n'); process.exitCode = 1;
  });
  else { process.stdout.write('Use --run-codex-once only for the authorized diagnostic.\n'); process.exitCode = 2; }
}
