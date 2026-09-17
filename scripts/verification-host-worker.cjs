'use strict';
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { verificationStorage: store } = require('./verification-ledger.cjs');
const { checkedData, exact, digest, checkId, textDigest } = require('./verification-packet.cjs');
const { nativeEnvironment } = require('./review-native-format.cjs');
const { format, anchoredFormat, supportedFormat, parentPrompt, childDelivery } = require('./verification-delivery.cjs');
const { outputInstructions } = require('./verification-anchors.cjs');
const { pinnedSubmissionFormat, isSubmissionFormat, submissionTool, verifierType, coordinatorType, agentDefinitions } = require('./verification-submission-contract.cjs');
const { createProtocol, verifyCodexCalls } = require('./verification-worker-protocol.cjs');
const { transcriptPaths, readTranscript } = require('./verification-native-evidence.cjs');
function validateWorkerInput(value, env) {
  const data = checkedData(value);
  exact(data, ['ticket_directory', 'host', 'profile', 'cwd', 'packet', 'native_executable', 'session_id',
    ...(Object.hasOwn(data, 'delivery_format') ? ['delivery_format'] : [])]);
  const selectedFormat = data.delivery_format || format;
  store.checkedDirectory(data.cwd); store.checkedDirectory(data.ticket_directory);
  const ticket = store.read(path.join(data.ticket_directory, 'ticket.json'));
  const stamp = store.read(path.join(data.ticket_directory, 'started', 'stamp.json'));
  const hash = digest(ticket);
  if (hash !== env.TTAK_VERIFICATION_TICKET_SHA256 || ticket.run_nonce !== env.TTAK_VERIFICATION_RUN_NONCE ||
      stamp.ticket_sha256 !== hash || Date.now() < stamp.started_at_ms || Date.now() >= ticket.not_after_ms ||
      data.host !== ticket.host || data.profile !== ticket.profile || data.native_executable !== ticket.native_executable ||
      !supportedFormat(selectedFormat) || ticket.child_input_format !== selectedFormat || ticket.packets.length !== 1 ||
      ticket.packets[0].packet_sha256 !== digest(data.packet) ||
      ticket.parent_prompt_sha256 !== textDigest(parentPrompt(data.host, data.packet, selectedFormat)) ||
      ticket.child_input_sha256[0] !== childDelivery(data.host, data.packet, selectedFormat).input_sha256 ||
      env[data.host === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'] !== data.profile ||
      env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY) throw new Error('worker_ticket_binding');
  if (data.host === 'claude') { checkId(data.session_id); if (!env.CLAUDE_CODE_OAUTH_TOKEN) throw new Error('worker_subscription_missing'); }
  else if (data.session_id !== null) throw new Error('worker_session_binding');
  return { data, ticket, hash };
}
function argumentsFor(host, sessionId, selectedFormat = format, inputHash = null, packet = null) {
  if (!supportedFormat(selectedFormat)) throw new Error('delivery_unknown_format');
  if (isSubmissionFormat(selectedFormat)) {
    if (host !== 'claude') throw new Error('submission_claude_only');
    checkId(sessionId);
    return ['-p', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'stream-json', '--verbose',
      '--forward-subagent-text', '--include-hook-events', '--tools', 'Agent',
      '--allowedTools', 'Agent(' + verifierType + '),' + submissionTool, '--disallowedTools', 'Agent(fork)',
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--session-id', sessionId,
      '--agents', JSON.stringify(agentDefinitions(process.execPath, path.join(__dirname, 'verification-submission-mcp.cjs'), inputHash,
        selectedFormat === pinnedSubmissionFormat ? childDelivery(host, packet, selectedFormat).pinned_context : null)),
      '--agent', coordinatorType];
  }
  if (host === 'codex') return ['-c', 'model_reasoning_effort="high"', '--disable', 'shell_tool',
    '-c', 'web_search="disabled"', 'app-server', '--stdio'];
  checkId(sessionId);
  return ['-p', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'stream-json', '--verbose',
    '--forward-subagent-text', '--include-hook-events', '--tools', 'Agent', '--allowedTools', 'Agent',
    '--disallowedTools', 'Agent(fork)', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--session-id', sessionId,
    ...(selectedFormat === anchoredFormat ? ['--append-subagent-system-prompt', outputInstructions] : [])];
}
function runWorker(value, env = process.env) {
  const { data, ticket, hash } = validateWorkerInput(value, env);
  if (path.resolve(data.cwd) !== process.cwd()) throw new Error('worker_cwd_binding');
  // A second direct worker invocation cannot consume the same reserved native start.
  const claim = path.join(data.cwd, 'worker-started'); fs.mkdirSync(claim);
  store.write(path.join(claim, 'stamp.json'), { ticket_sha256: hash, started_at_ms: Date.now() });
  const selectedFormat = data.delivery_format || format;
  const protocol = createProtocol(data.host, data.packet, data.cwd, data.profile, data.session_id, selectedFormat);
  const inputHash = isSubmissionFormat(selectedFormat)
    ? require('./verification-input.cjs').writePinnedInput(data.cwd, ticket.run_id, ticket.run_nonce, data.packet) : null;
  const cli = spawn(data.native_executable, argumentsFor(data.host, data.session_id, selectedFormat, inputHash, data.packet), {
    cwd: data.cwd, env: nativeEnvironment(data.host, data.profile, env, 'haiku-luna'),
    windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
  const decoder = new StringDecoder('utf8'); let buffer = '', bytes = 0, ended = false;
  function finish(reason) {
    if (ended) return; ended = true;
    let envelope = null;
    try {
      if (!reason) {
        const binding = protocol.finish();
        if (data.host === 'codex') verifyCodexCalls(readTranscript(transcriptPaths(ticket, data.cwd, binding)[0]), data.packet, binding.children[0].thread_id, selectedFormat);
        envelope = { schema_version: 1, ticket_sha256: hash, run_nonce: ticket.run_nonce, ...binding, completion: 'completed' };
      }
      store.write(path.join(data.cwd, 'worker-observations.json'), { ticket_sha256: hash,
        status: reason ? 'stopped' : 'completed', reason, report: protocol.report });
    } catch { reason = 'worker_evidence_rejected'; envelope = null; }
    // Never print native errors, raw stream data, reasoning or environment values.
    if (envelope) process.stdout.write(JSON.stringify(envelope) + '\n');
    else process.stdout.write('{"error":"worker_stopped"}\n');
    process.exitCode = reason ? 1 : 0;
    cli.stdin.end();
    if (reason) cli.kill();
    // The already assigned Windows Job remains responsible for all descendants.
    setTimeout(() => process.exit(process.exitCode), 300).unref();
  }
  const send = row => cli.stdin.write(JSON.stringify(row) + '\n');
  cli.on('error', () => finish('worker_launch_failed'));
  cli.stdin.on('error', () => finish('worker_input_failed'));
  cli.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > 2097152) finish('worker_output_limit'); });
  cli.stdout.on('data', chunk => {
    if (ended) return;
    bytes += chunk.length; if (bytes > 2097152) return finish('worker_output_limit');
    buffer += decoder.write(chunk); let at;
    while (!ended && (at = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
      if (!line.trim()) continue;
      try {
        if (Buffer.byteLength(line) > 262144) throw new Error('frame_limit');
        for (const action of protocol.observe(JSON.parse(line))) send(action);
        if (data.host === 'codex' && protocol.isComplete()) finish(null);
      } catch { finish('worker_protocol_rejected'); }
    }
  });
  cli.on('close', code => {
    if (ended) return;
    buffer += decoder.end();
    // Missing newline / trailing protocol data is incomplete, not silently discarded.
    finish(code !== 0 || buffer.trim() || !protocol.isComplete() ? 'worker_incomplete' : null);
  });
  if (data.host === 'codex') send(protocol.initialize); else cli.stdin.end(protocol.prompt);
}
module.exports = { validateWorkerInput, argumentsFor, runWorker };
if (require.main === module) {
  let input = '', size = 0, rejected = false;
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    size += Buffer.byteLength(chunk);
    if (size > 1048576) { rejected = true; process.stdin.destroy(); process.exitCode = 1; }
    else input += chunk;
  });
  process.stdin.on('end', () => {
    try { if (rejected) throw new Error('limit'); runWorker(JSON.parse(input)); }
    catch { process.stdout.write('{"error":"worker_preflight_rejected"}\n'); process.exitCode = 1; }
  });
}
