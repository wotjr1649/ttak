'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { createVerificationExecution, openVerificationExecution } = require('../scripts/verification-execution.cjs');
const { collectCodexTranscript, collectClaudeTranscript } = require('../scripts/verification-host-adapter.cjs');
const { summarizeExecutionUsage } = require('../scripts/verification-execution-usage.cjs');
const { encodePacket } = require('../scripts/verification-packet.cjs');
const { childDelivery, format, anchoredFormat } = require('../scripts/verification-delivery.cjs');
const { anchorMap } = require('../scripts/verification-anchors.cjs');
const { submissionFormat, pinnedSubmissionFormat, isSubmissionFormat, submissionTool } = require('../scripts/verification-submission-contract.cjs');
const { submissionAck } = require('../scripts/verification-submission-audit.cjs');
const fixture = require('./fixtures/verification-p0.cjs');
const root = path.resolve(__dirname, '..'), base = path.join(root, '.superpowers');
const worker = path.join(__dirname, 'fixtures/verification-execution-worker.cjs');
function setup(t, mode = 'success', resultOverride, delivery = false, host = 'codex') {
  const selectedFormat = typeof delivery === 'string' ? delivery : format;
  fs.mkdirSync(base, { recursive: true }); const cwd = fs.mkdtempSync(path.join(base, 'execution94-test-'));
  t.after(() => {
    assert.equal(path.dirname(cwd), base); assert.ok(path.basename(cwd).startsWith('execution94-test-'));
    fs.rmSync(cwd, { recursive: true, force: false });
  });
  const profile = path.join(cwd, 'profile'); fs.mkdirSync(profile);
  const localWorker = path.join(cwd, 'worker.cjs'); fs.copyFileSync(worker, localWorker);
  const packet = fixture.plan().packets[0].input;
  const request = { executable: process.execPath, arguments: [localWorker, mode], cwd,
    input: JSON.stringify({ directory: path.join(cwd, 'run'), packet_text: delivery ? childDelivery(host, packet, selectedFormat).input : encodePacket(packet), parent_prompt: 'Synthetic parent prompt',
      result: resultOverride || JSON.stringify(fixture.observation(fixture.ticket()).observed.result),
      ...(isSubmissionFormat(selectedFormat) ? { submission_ack: submissionAck(packet, JSON.parse(resultOverride)) } : {}) }),
    timeoutMs: mode === 'hang' ? 1500 : 4000, stdoutLimit: 65536, stderrLimit: 4096, cleanupMs: 3000 };
  const plan = { run_id: 'Execution94', host, profile, parent_prompt: 'Synthetic parent prompt',
    packets: [packet], artifacts: [localWorker], not_after_ms: Date.now() + 90000,
    ...(delivery ? { child_input_format: selectedFormat, native_executable: process.execPath } : {}) };
  const created = createVerificationExecution(cwd, 'run', plan, request);
  const open = () => openVerificationExecution(cwd, 'run', created.ticket_sha256);
  const reports = () => ['parent', 'child'].map((name, i) => {
    const raw = fs.readFileSync(path.join(cwd, name + '.jsonl'), 'utf8');
    return host === 'codex' ? collectCodexTranscript(raw, { thread_id: i ? 'Child1' : 'Parent1' })
      : collectClaudeTranscript(raw, { parent_session_id: 'Parent1', agent_id: i ? 'Child1' : null });
  });
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ['PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].includes(k.toUpperCase())));
  return { cwd, request, plan, packet, created, open, reports, env };
}
test('real worker sees fsynced reservation before execution; evidence settles without a P0 receipt', { timeout: 20000 }, async t => {
  const x = setup(t), run = x.open();
  assert.equal(run.state().status, 'ready');
  const done = await run.run(x.request, { ...x.env, OPENAI_API_KEY: 'excluded-fixture', ANTHROPIC_API_KEY: 'excluded-fixture' });
  assert.equal(done.status, 'awaiting_evidence'); assert.equal(done.process.process.activeProcesses, 0);
  const result = run.settle(x.reports(), [x.packet]);
  assert.equal(result.status, 'observed'); assert.equal(result.settlement.local_execution_binding_checked, true);
  assert.equal(result.settlement.usage.accounting_unit, 'distinct_thread_cumulative_snapshot');
  assert.equal(result.settlement.usage.totals.reported_total_tokens, 220);
  assert.equal(result.settlement.usage.totals.input_including_cache, 200);
  assert.equal(result.settlement.usage.native_api_response_count, null);
  assert.equal(result.settlement.p0_receipt, null); assert.equal(result.settlement.native_delivery_verified, false);
  assert.equal(x.open().state().status, 'observed');
  await assert.rejects(x.open().run(x.request, x.env), /already_consumed/);
  assert.throws(() => run.settle(x.reports(), [x.packet]), /not_settleable/);
});

test('wire envelope and exact reserved host context settle through a real process without relaxing P0 receipt', { timeout: 20000 }, async t => {
  const x = setup(t, 'success', undefined, true), run = x.open();
  const state = await run.run(x.request, x.env); assert.equal(state.status, 'awaiting_evidence');
  const reports = x.reports(); assert.equal(reports[1].visible_inputs.length, 2);
  assert.equal(reports[1].visible_inputs[1].content, childDelivery('codex', x.packet).input);
  const done = run.settle(reports, [x.packet]); assert.equal(done.status, 'observed');
  assert.equal(done.settlement.p0_receipt, null); assert.equal(done.settlement.full_input_observed, false);
});

test('both host accounting paths settle anchored results from real worker processes and retain raw-result binding', { timeout: 20000 }, async t => {
  const p = fixture.plan().packets[0].input, r = fixture.observation(fixture.ticket()).observed.result;
  const anchored = { ...r, anchor_map_sha256: anchorMap(p).anchor_map_sha256,
    citations: [{ source_id: p.sources[0].id, first: 'A0001', last: 'A0001' }] };
  for (const host of ['codex', 'claude']) {
    const x = setup(t, 'success', JSON.stringify(anchored), anchoredFormat, host), run = x.open();
    assert.equal((await run.run(x.request, x.env)).status, 'awaiting_evidence');
    const done = run.settle(x.reports(), [x.packet]);
    assert.equal(done.status, 'observed'); assert.equal(done.settlement.children[0].result_input_format, anchoredFormat);
    assert.match(done.settlement.children[0].wire_result_sha256, /^[a-f0-9]{64}$/);
    assert.equal(done.settlement.p0_receipt, null); assert.equal(done.settlement.semantic_quality_verified, false);
  }
});

test('anchored format never rescues code fences or unknown anchor IDs after execution', { timeout: 20000 }, async t => {
  const p = fixture.plan().packets[0].input, r = fixture.observation(fixture.ticket()).observed.result;
  const anchored = { ...r, anchor_map_sha256: anchorMap(p).anchor_map_sha256,
    citations: [{ source_id: p.sources[0].id, first: 'A9999', last: 'A9999' }] };
  for (const [text, failure] of [[JSON.stringify(anchored), 'verification_anchor_span'],
    ['```json\n' + JSON.stringify(anchored) + '\n```', 'adapter_result_not_json_object']]) {
    const x = setup(t, 'success', text, anchoredFormat, 'claude'), run = x.open(); await run.run(x.request, x.env);
    const done = run.settle(x.reports(), [x.packet]); assert.equal(done.status, 'stopped');
    assert.equal(done.settlement.failure_code, failure); assert.ok(done.settlement.usage.totals.reported_total_tokens > 0);
    assert.equal(x.open().state().status, 'stopped');
  }
});

for (const selectedFormat of [submissionFormat, pinnedSubmissionFormat]) test(selectedFormat + ' settles only actual child arguments and ack through a real process', { timeout: 20000 }, async t => {
  const p = fixture.plan().packets[0].input, r = fixture.observation(fixture.ticket()).observed.result;
  const anchored = { ...r, anchor_map_sha256: anchorMap(p).anchor_map_sha256,
    citations: [{ source_id: p.sources[0].id, first: 'A0001', last: 'A0001' }] };
  const x = setup(t, 'success', JSON.stringify(anchored), selectedFormat, 'claude'), run = x.open();
  assert.equal((await run.run(x.request, x.env)).status, 'awaiting_evidence');
  const done = run.settle(x.reports(), [x.packet]); assert.equal(done.status, 'observed');
  assert.equal(done.settlement.children[0].result_input_format, selectedFormat);
  assert.equal(done.settlement.children[0].tool_use_id, 'Submit1'); assert.equal(done.settlement.p0_receipt, null);
  assert.equal(done.process.process.activeProcesses, 0);
});

test('v3 rejects parent submission and changed native child ack after real execution', { timeout: 20000 }, async t => {
  const p = fixture.plan().packets[0].input, r = fixture.observation(fixture.ticket()).observed.result;
  const anchored = { ...r, anchor_map_sha256: anchorMap(p).anchor_map_sha256,
    citations: [{ source_id: p.sources[0].id, first: 'A0001', last: 'A0001' }] };
  for (const target of ['parent', 'child']) {
    const x = setup(t, 'success', JSON.stringify(anchored), submissionFormat, 'claude'), run = x.open(); await run.run(x.request, x.env);
    const file = path.join(x.cwd, target + '.jsonl'), rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
    if (target === 'parent') { rows[1].message.content[0].name = submissionTool; rows[1].message.content[0].input = anchored; }
    else rows[2].message.content[0].content[0].text = '{}';
    fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    const done = run.settle(x.reports(), [x.packet]); assert.equal(done.status, 'stopped');
    assert.equal(done.settlement.failure_code, target === 'parent' ? 'submission_parent_forbidden' : 'submission_ack_binding');
    assert.ok(done.settlement.usage.totals.reported_total_tokens > 0);
  }
});

test('altered host environment is not discarded to make a wire delivery pass', { timeout: 20000 }, async t => {
  const x = setup(t, 'success', undefined, true), run = x.open(); await run.run(x.request, x.env);
  const file = path.join(x.cwd, 'child.jsonl');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('powershell', 'unexpected-context'));
  const done = run.settle(x.reports(), [x.packet]); assert.equal(done.status, 'stopped');
  assert.equal(done.settlement.failure_code, 'execution_child_input_or_tools');
});

test('nested execution stores stay inside the task root and reject traversal', t => {
  const x = setup(t); fs.mkdirSync(path.join(x.cwd, 'records'));
  const nested = createVerificationExecution(x.cwd, 'records/nested', x.plan, x.request);
  assert.equal(openVerificationExecution(x.cwd, 'records/nested', nested.ticket_sha256).state().status, 'ready');
  for (const name of ['../escaped', 'records/../escaped', 'records//empty', 'records/./dot']) {
    assert.throws(() => createVerificationExecution(x.cwd, name, x.plan, x.request), /store_path/);
  }
});

test('reviewed instruction artifacts are frozen and changed policy stops before process creation', async t => {
  const x = setup(t), policy = path.join(x.cwd, 'policy.md'); fs.writeFileSync(policy, 'Synthetic instruction.\n');
  const plan = { ...x.plan, artifacts: [...x.plan.artifacts, policy] };
  const reserved = createVerificationExecution(x.cwd, 'policy-run', plan, x.request);
  const run = openVerificationExecution(x.cwd, 'policy-run', reserved.ticket_sha256);
  fs.appendFileSync(policy, 'Changed after reservation.\n');
  await assert.rejects(run.run(x.request, x.env), /artifact_changed/);
  assert.equal(run.state().status, 'ready'); assert.equal(fs.existsSync(path.join(reserved.directory, 'started')), false);
});
test('concurrent handles claim one worker only', { timeout: 20000 }, async t => {
  const x = setup(t);
  const results = await Promise.allSettled([x.open().run(x.request, x.env), x.open().run(x.request, x.env)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /already_consumed|EEXIST/);
  assert.equal(x.open().state().status, 'awaiting_evidence');
});
test('timeout kills real descendants and permanently consumes the slot', { timeout: 20000 }, async t => {
  const x = setup(t, 'hang'); const result = await x.open().run(x.request, x.env);
  assert.equal(result.status, 'stopped'); assert.equal(result.process.reason, 'timeout');
  assert.equal(result.process.process.cleanupVerified, true); assert.equal(result.process.process.activeProcesses, 0);
  assert.ok(result.process.process.totalProcesses >= 2); assert.equal(result.process.observed_usage, null);
  await assert.rejects(x.open().run(x.request, x.env), /already_consumed/);
});
test('normal worker exit also cleans detached descendants', { timeout: 20000 }, async t => {
  const x = setup(t, 'orphan'); const result = await x.open().run(x.request, x.env);
  assert.equal(result.status, 'awaiting_evidence'); assert.ok(result.process.process.totalProcesses >= 2);
  assert.equal(result.process.process.activeProcesses, 0);
});
test('wrong nonce, malformed envelope and nonzero exit never reach evidence acceptance', { timeout: 30000 }, async t => {
  for (const mode of ['wrong-nonce', 'malformed', 'exit']) {
    const x = setup(t, mode), run = x.open(); const result = await run.run(x.request, x.env);
    assert.equal(result.status, 'stopped'); assert.equal(result.process.process.cleanupVerified, true);
    assert.equal(result.process.observed_usage, null);
    assert.throws(() => run.settle([], []), /not_settleable/);
    await assert.rejects(run.run(x.request, x.env), /already_consumed/);
  }
});
test('partial start claim cannot be silently recovered and relaunched', t => {
  const x = setup(t); fs.mkdirSync(path.join(x.created.directory, 'started'));
  assert.equal(x.open().state().status, 'in_flight_or_interrupted');
  return assert.rejects(x.open().run(x.request, x.env), /already_consumed/);
});
test('request, artifact and ticket changes fail before any process starts', async t => {
  const x = setup(t);
  await assert.rejects(x.open().run({ ...x.request, input: 'changed' }, x.env), /request_changed/);
  fs.appendFileSync(x.request.arguments[0], '\n// changed fixture artifact\n');
  await assert.rejects(x.open().run(x.request, x.env), /artifact_changed/);
  const ticketPath = path.join(x.created.directory, 'ticket.json');
  const ticket = JSON.parse(fs.readFileSync(ticketPath, 'utf8')); ticket.host = 'claude';
  fs.writeFileSync(ticketPath, JSON.stringify(ticket));
  assert.throws(x.open, /ticket_changed/);
});
test('code fenced result stops settlement and cannot be retroactively accepted', { timeout: 20000 }, async t => {
  const x = setup(t, 'success', '```json\n' + JSON.stringify(fixture.observation(fixture.ticket()).observed.result) + '\n```');
  const run = x.open(); await run.run(x.request, x.env);
  const result = run.settle(x.reports(), [x.packet]);
  assert.equal(result.status, 'stopped'); assert.equal(result.settlement.reason, 'evidence_rejected');
  assert.equal(result.settlement.failure_code, 'adapter_result_not_json_object');
  assert.equal(result.settlement.usage.totals.reported_total_tokens, 220);
  assert.throws(() => run.settle(x.reports(), [x.packet]), /not_settleable/);
});
test('stale native timestamps are rejected after a successful worker exit', { timeout: 20000 }, async t => {
  const x = setup(t), run = x.open(); await run.run(x.request, x.env);
  const file = path.join(x.cwd, 'child.jsonl');
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  for (const row of rows) row.timestamp = '2000-01-01T00:00:00.000Z';
  fs.writeFileSync(file, rows.map(JSON.stringify).join('\n') + '\n');
  assert.equal(run.settle(x.reports(), [x.packet]).status, 'stopped');
});
test('expired execution claim consumes its slot without launching a worker', async t => {
  const x = setup(t), originalNow = Date.now;
  let result;
  try {
    Date.now = () => x.plan.not_after_ms + 1;
    result = await x.open().run(x.request, x.env);
  } finally { Date.now = originalNow; }
  assert.equal(result.status, 'stopped'); assert.equal(result.process.worker_launch_attempted, false);
  assert.equal(result.process.process, null);
  await assert.rejects(x.open().run(x.request, x.env), /already_consumed/);
});
test('profile junction replacement is rejected before a process starts', async t => {
  const x = setup(t); fs.rmdirSync(x.plan.profile); fs.symlinkSync(x.cwd, x.plan.profile, 'junction');
  await assert.rejects(x.open().run(x.request, x.env), /storage_link/);
  assert.equal(fs.existsSync(path.join(x.created.directory, 'started')), false);
});
test('changed cleanup record is rejected on reopen', { timeout: 20000 }, async t => {
  const x = setup(t); await x.open().run(x.request, x.env);
  const file = path.join(x.created.directory, 'process.json'), value = JSON.parse(fs.readFileSync(file, 'utf8'));
  value.process.cleanupVerified = false; fs.writeFileSync(file, JSON.stringify(value));
  assert.throws(x.open, /cleanup_record_invalid/);
});
test('aggregate accounting rejects duplicate threads and invented report objects', { timeout: 20000 }, async t => {
  const x = setup(t); await x.open().run(x.request, x.env); const reports = x.reports();
  assert.throws(() => summarizeExecutionUsage([reports[0], reports[0]]), /duplicate_or_mixed_threads/);
  assert.throws(() => summarizeExecutionUsage([JSON.parse(JSON.stringify(reports[0]))]), /uncollected_report/);
});
