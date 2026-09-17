'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { readTranscript, transcriptPaths } = require('../scripts/verification-native-evidence.cjs');
const { validateWorkerInput } = require('../scripts/verification-host-worker.cjs');
const { assertClaudeSettings } = require('../scripts/verification-native-run.cjs');
const { createVerificationExecution } = require('../scripts/verification-execution.cjs');
const { diagnosticPacket, artifacts } = require('../scripts/verification-native-run.cjs');
const { parentPrompt, format } = require('../scripts/verification-delivery.cjs');
const { verificationStorage: store } = require('../scripts/verification-ledger.cjs');
const base = path.resolve(__dirname, '../.superpowers');
function setup(t) {
  const cwd = fs.mkdtempSync(path.join(base, 'worker95-test-'));
  t.after(() => { assert.equal(path.dirname(cwd), base); assert.ok(path.basename(cwd).startsWith('worker95-test-')); fs.rmSync(cwd, { recursive: true }); });
  return cwd;
}
test('native reader rejects symlinks, hard links, oversized and non-jsonl paths', t => {
  const cwd = setup(t), file = path.join(cwd, 'record.jsonl'); fs.writeFileSync(file, '{"type":"synthetic"}\n');
  assert.equal(readTranscript(file), '{"type":"synthetic"}\n');
  const other = path.join(cwd, 'linked.jsonl'); fs.linkSync(file, other);
  assert.throws(() => readTranscript(file), /transcript_file/); fs.unlinkSync(other);
  const big = path.join(cwd, 'big.jsonl'); fs.writeFileSync(big, Buffer.alloc(2097153));
  assert.throws(() => readTranscript(big), /transcript_file/);
  const json = path.join(cwd, 'not-transcript.json'); fs.writeFileSync(json, '{}');
  assert.throws(() => readTranscript(json), /transcript_file/);
  const link = path.join(cwd, 'linked-directory'); fs.symlinkSync(cwd, link, 'junction');
  assert.throws(() => readTranscript(path.join(link, 'record.jsonl')), /storage_link/);
});
test('Codex lookup requires unique exact thread suffixes within bounded session dates', t => {
  const profile = setup(t), time = Date.parse('2026-09-11T00:00:00Z');
  const dir = path.join(profile, 'sessions/2026/09/11'); fs.mkdirSync(dir, { recursive: true });
  const binding = { parent_thread_id: 'Parent1', children: [{ thread_id: 'Child1' }] };
  const ticket = { host: 'codex', profile, reserved_at_ms: time };
  fs.writeFileSync(path.join(dir, 'rollout-Parent1.jsonl'), '{}'); fs.writeFileSync(path.join(dir, 'rollout-Child1.jsonl'), '{}');
  const paths = transcriptPaths(ticket, profile, binding); assert.equal(paths.length, 2);
  fs.writeFileSync(path.join(dir, 'other-Child1.jsonl'), '{}'); assert.throws(() => transcriptPaths(ticket, profile, binding), /not_unique/);
  assert.throws(() => transcriptPaths(ticket, profile, { ...binding, parent_thread_id: '../escape' }), /invalid_id/);
});
test('Claude lookup derives local parent/sidechain paths and rejects changed settings without credential reads', t => {
  const cwd = setup(t), profile = path.join(cwd, 'profile'); fs.mkdirSync(profile);
  const paths = transcriptPaths({ host: 'claude', profile }, cwd, { parent_thread_id: 'Parent1', children: [{ thread_id: 'Child1' }] });
  assert.ok(paths[1].endsWith(path.join('Parent1', 'subagents', 'agent-Child1.jsonl')));
  assertClaudeSettings(profile, cwd);
  fs.writeFileSync(path.join(profile, 'settings.json'), '{"apiKeyHelper":"never execute"}');
  assert.throws(() => assertClaudeSettings(profile, cwd), /profile_changed/);
});
test('worker preflight requires reserved ticket, start stamp, nonce, model path and subscription-only environment', t => {
  const cwd = setup(t), profile = path.join(cwd, 'profile'); fs.mkdirSync(profile);
  const code = path.join(cwd, 'worker.cjs'); fs.writeFileSync(code, '// local synthetic artifact\n');
  const packet = diagnosticPacket(), request = { executable: process.execPath, arguments: [code], cwd, input: '', timeoutMs: 1000,
    stdoutLimit: 16384, stderrLimit: 4096, cleanupMs: 500 };
  const created = createVerificationExecution(cwd, 'run', { host: 'codex', run_id: 'Test95', profile, parent_prompt: parentPrompt('codex', packet),
    packets: [packet], artifacts: [code], native_executable: process.execPath, child_input_format: format, not_after_ms: Date.now() + 60000 }, request);
  const data = { ticket_directory: created.directory, host: 'codex', profile, cwd, packet, native_executable: process.execPath, session_id: null };
  const ticket = store.read(path.join(created.directory, 'ticket.json'));
  const env = { TTAK_VERIFICATION_TICKET_SHA256: created.ticket_sha256, TTAK_VERIFICATION_RUN_NONCE: ticket.run_nonce, CODEX_HOME: profile };
  assert.throws(() => validateWorkerInput(data, env));
  fs.mkdirSync(path.join(created.directory, 'started')); store.write(path.join(created.directory, 'started/stamp.json'),
    { ticket_sha256: created.ticket_sha256, started_at_ms: Date.now() });
  assert.equal(validateWorkerInput(data, env).hash, created.ticket_sha256);
  for (const mutation of [e => e.TTAK_VERIFICATION_RUN_NONCE = 'wrong', e => e.OPENAI_API_KEY = 'excluded-fixture', e => e.CODEX_HOME = cwd]) {
    const changed = { ...env }; mutation(changed); assert.throws(() => validateWorkerInput(data, changed), /ticket_binding/);
  }
  assert.throws(() => validateWorkerInput({ ...data, native_executable: code }, env), /ticket_binding/);
});

test('frozen worker artifact list covers every static local module dependency', () => {
  for (const name of artifacts.filter(n => n.endsWith('.cjs'))) {
    const source = fs.readFileSync(path.resolve(__dirname, '../scripts', name), 'utf8');
    for (const match of source.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)) {
      assert.ok(artifacts.includes(match[1]), name + ' missing ' + match[1]);
    }
  }
});
