'use strict';
// Explicit one-shot entry point. Importing / preparing this module never starts a CLI.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { verificationStorage: store } = require('./verification-ledger.cjs');
const { prepareVerification, validatePacket, checkDigest, textDigest, digest, canonical } = require('./verification-packet.cjs');
const { createVerificationExecution, openVerificationExecution } = require('./verification-execution.cjs');
const { anchoredFormat, supportedFormat, parentPrompt } = require('./verification-delivery.cjs');
const { collectEvidence } = require('./verification-native-evidence.cjs');
const { submissionFormat, pinnedSubmissionFormat } = require('./verification-submission-contract.cjs');
const root = path.resolve(__dirname, '..');
const { checkedTimeoutMs } = require('./bounded-native-process.cjs');
const native = Object.freeze({
  // The desktop installation's bin directory is a junction. Pin its observed physical release path.
  codex: { executable: 'C:\\Users\\js\\.codex\\packages\\standalone\\releases\\0.154.0-x86_64-pc-windows-msvc\\bin\\codex.exe',
    sha256: 'be96b992178b1e467c225800da0d65f2c86d5eba1ef0b14632f65db381cbdfde' },
  claude: { executable: 'C:\\Users\\js\\.local\\bin\\claude.exe',
    sha256: 'd2c5f7b3b6a12819097ceb6efbce2a390157166003fcaee32dbde0e6d7b45ef7' }
});
const artifacts = ['verification-native-run.cjs', 'verification-host-worker.cjs', 'verification-worker-protocol.cjs', 'verification-input.cjs',
  'verification-submission-contract.cjs', 'verification-submission-audit.cjs', 'verification-submission-protocol.cjs',
  'verification-submission-mcp.cjs', 'review-mcp.cjs', 'review-repair.cjs',
  'verification-anchors.cjs', 'source-text-anchors.cjs',
  'verification-native-evidence.cjs', 'verification-delivery.cjs', 'verification-execution.cjs', 'verification-execution-usage.cjs',
  'verification-host-adapter.cjs', 'verification-ledger.cjs', 'verification-native-audit.cjs', 'verification-packet.cjs',
  'connection-probe.cjs', 'connection-probe-claude.cjs', 'review-native-format.cjs', 'review-roles.cjs',
  'review-session.cjs', 'review-anchors.cjs', 'bounded-native-process.cjs', 'windows-job.ps1', 'windows-job.cs'];
function diagnosticPacket() {
  const source = 'In this synthetic FIFO queue, items leave in arrival order. A arrives before B. No other operations occur.';
  return prepareVerification({ run_id: 'Worker95', turn_id: 'Turn1', language: 'en',
    draft: 'PARENT_ONLY_ORCHID_95', obligations: ['O1'], bundle: {
      targets: [{ id: 'A', text: 'Item A' }, { id: 'B', text: 'Item B' }],
      conditions: [{ id: 'C1', text: 'A arrives before B; no other queue operations.' }],
      sources: [{ id: 'S1', version: 'synthetic-95', text: source, sha256: textDigest(source) }] },
    questions: [{ id: 'Q1', kind: 'relationship', target_ids: ['A', 'B'], condition_ids: ['C1'], source_ids: ['S1'], covers: ['O1'] }]
  }).packets[0].input;
}
function profileFor(host) {
  if (!Object.hasOwn(native, host)) throw new Error('worker_unknown_host');
  return path.join(root, '.superpowers/release-run-03/profiles', host + '-ttak');
}
function assertClaudeSettings(profile, cwd) {
  // Existing empty test profile only. Do not edit settings or inspect credentials.
  for (const file of ['settings.json', 'settings.local.json', 'CLAUDE.md', 'agents', 'hooks']) {
    if (store.exists(path.join(profile, file))) throw new Error('worker_profile_changed');
  }
  for (let dir = cwd;; dir = path.dirname(dir)) {
    for (const file of ['CLAUDE.md', '.claude/CLAUDE.md', '.claude/agents', '.mcp.json']) {
      if (store.exists(path.join(dir, file))) throw new Error('worker_project_context_changed');
    }
    for (const name of ['settings.json', 'settings.local.json']) {
      const file = path.join(dir, '.claude', name);
      if (store.exists(file)) {
        const value = store.read(file);
        if (canonical(value) !== canonical({ enabledPlugins: {}, outputStyle: 'default' })) throw new Error('worker_project_settings_changed');
      }
    }
    if (path.dirname(dir) === dir) break;
  }
}
async function assertBinary(host) {
  const entry = native[host];
  if (!entry) throw new Error('worker_unknown_host');
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(entry.executable)) hash.update(chunk);
  if (hash.digest('hex') !== entry.sha256) throw new Error('worker_cli_changed');
}
async function prepare(host, name, selectedFormat = host === 'claude' ? submissionFormat : anchoredFormat, timeoutMs) {
  return preparePacketRun(host, name, diagnosticPacket(), selectedFormat, timeoutMs);
}
async function preparePacketRun(host, name, packetValue, selectedFormat = host === 'claude' ? pinnedSubmissionFormat : anchoredFormat, timeoutMs) {
  checkedTimeoutMs(timeoutMs);
  const packet = validatePacket(packetValue);
  if (!supportedFormat(selectedFormat)) throw new Error('delivery_unknown_format');
  const profile = profileFor(host); store.checkedDirectory(profile);
  const base = store.checkedDirectory(path.join(root, '.superpowers/verification-worker-95'));
  const directory = store.location(base, name, false), cwd = store.location(base, name + '-work', false);
  if (store.exists(directory) || store.exists(cwd)) throw new Error('worker_run_exists');
  await assertBinary(host);
  if (host === 'claude') assertClaudeSettings(profile, base);
  fs.mkdirSync(cwd);
  const data = { ticket_directory: directory, host, profile, cwd, packet, native_executable: native[host].executable,
    session_id: host === 'claude' ? crypto.randomUUID() : null, delivery_format: selectedFormat };
  const request = { executable: process.execPath, arguments: [path.join(__dirname, 'verification-host-worker.cjs')], cwd,
    input: canonical(data), timeoutMs, stdoutLimit: 16384, stderrLimit: 4096, cleanupMs: 5000 };
  const plan = { run_id: name, host, profile, parent_prompt: parentPrompt(host, packet, selectedFormat), packets: [packet],
    artifacts: [...artifacts.filter(file => host === 'claude' || file !== 'verification-input.cjs')
      .map(file => path.join(__dirname, file)), ...(host === 'codex' ?
      ['hooks/ttak.cjs', 'policy/precedence.md', 'policy/invariants.md', 'policy/contract.md'].map(file =>
        path.join(profile, 'plugins/cache/ttak-release/ttak/0.2.0-rc.1+codex.20260908082818', file)) : [])], native_executable: native[host].executable,
    child_input_format: selectedFormat, not_after_ms: Date.now() + 3500000 };
  const created = createVerificationExecution(root, path.relative(root, directory), plan, request);
  store.write(path.join(cwd, 'request.json'), { ticket_sha256: created.ticket_sha256, request });
  return { name, host, directory, cwd, ticket_sha256: created.ticket_sha256, packet_sha256: digest(packet), native_starts: 0 };
}
async function execute(name, env = process.env) {
  return executePrepared(name, null, digest(diagnosticPacket()), env);
}
async function executePacketRun(name, expectedTicketHash, expectedPacketHash, env = process.env) {
  checkDigest(expectedTicketHash);
  return executePrepared(name, expectedTicketHash, expectedPacketHash, env);
}
async function executePrepared(name, expectedTicketHash, expectedPacketHash, env) {
  checkDigest(expectedPacketHash);
  const base = store.checkedDirectory(path.join(root, '.superpowers/verification-worker-95'));
  const cwd = store.location(base, name + '-work');
  const saved = store.read(path.join(cwd, 'request.json')), data = JSON.parse(saved.request.input);
  if (expectedTicketHash !== null && saved.ticket_sha256 !== expectedTicketHash ||
      data.cwd !== cwd || data.profile !== profileFor(data.host) || digest(validatePacket(data.packet)) !== expectedPacketHash ||
      data.native_executable !== native[data.host].executable) throw new Error('worker_saved_request_changed');
  await assertBinary(data.host);
  if (data.host === 'claude') assertClaudeSettings(data.profile, cwd);
  const run = openVerificationExecution(root, path.relative(root, data.ticket_directory), saved.ticket_sha256);
  const result = await run.run(saved.request, env);
  if (result.status !== 'awaiting_evidence') return result;
  const ticket = store.read(path.join(data.ticket_directory, 'ticket.json'));
  let reports;
  try { reports = collectEvidence(ticket, cwd, result.process.envelope); }
  catch { reports = []; } // Settlement records a permanent evidence-count failure; no retry or fabricated report.
  return run.settle(reports, [data.packet]);
}
async function executePair(codexName, claudeName, env = process.env) {
  const base = store.checkedDirectory(path.join(root, '.superpowers/verification-worker-95'));
  for (const [name, host] of [[codexName, 'codex'], [claudeName, 'claude']]) {
    const saved = store.read(path.join(store.location(base, name + '-work'), 'request.json'));
    if (JSON.parse(saved.request.input).host !== host) throw new Error('worker_pair_host_order');
  }
  const codex = await execute(codexName, env);
  if (codex.status !== 'observed') return { status: 'stopped', codex, claude: null, claude_status: 'UNRUN' };
  const claude = await execute(claudeName, env);
  return { status: claude.status === 'observed' ? 'observed' : 'stopped', codex, claude };
}
module.exports = { diagnosticPacket, prepare, execute, preparePacketRun, executePacketRun, executePair,
  assertClaudeSettings, assertBinary, profileFor, native, artifacts };
if (require.main === module) {
  const [action, first, second] = process.argv.slice(2);
  const work = action === '--prepare' && first && second ? prepare(first, second, undefined, Number(process.env.TTAK_NATIVE_TIMEOUT_MS))
    : action === '--execute-once' && first && !second ? execute(first)
      : action === '--execute-pair' && first && second ? executePair(first, second) : Promise.reject(new Error('usage'));
  work.then(value => { process.stdout.write(JSON.stringify(value) + '\n'); if (value.status === 'stopped') process.exitCode = 1; })
    .catch(error => {
      const reason = /^(?:worker|verification|execution)_[a-z_]+$/.test(error.message) ? error.message : 'details_withheld';
      process.stdout.write(JSON.stringify({ error: 'native_verification_stopped_before_completion', reason }) + '\n'); process.exitCode = 1;
    });
}
