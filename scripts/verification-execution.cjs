'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { verificationStorage: store } = require('./verification-ledger.cjs');
const { checkedData, canonical, digest, textDigest, exact, checkId, checkInt, checkDigest,
  validatePacket, encodePacket } = require('./verification-packet.cjs');
const { reportSnapshot, parseChildResult } = require('./verification-host-adapter.cjs');
const { summarizeExecutionUsage } = require('./verification-execution-usage.cjs');
const { nativeEnvironment } = require('./review-native-format.cjs');
const { boundedNativeProcess, checkedTimeoutMs } = require('./bounded-native-process.cjs');
const { childDelivery, codexEnvironment, supportedFormat, anchoredFormat } = require('./verification-delivery.cjs');
const { parseAnchoredResult } = require('./verification-anchors.cjs');
const { isSubmissionFormat, submissionTool } = require('./verification-submission-contract.cjs');
const { auditSubmissionChild } = require('./verification-submission-audit.cjs');
const powershell = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const versions = { claude: '2.1.266', codex: '0.154.0' };
function inside(root, target) {
  const relative = path.relative(root, target);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep)) throw new Error('execution_outside_root');
}
function executionLocation(root, name, exists = true) {
  if (typeof name !== 'string' || path.isAbsolute(name) || name.split(/[\\/]/).some(part =>
      !part || part === '.' || part === '..' || !/^[A-Za-z0-9_.-]{1,64}$/.test(part))) throw new Error('execution_store_path');
  const directory = path.resolve(root, name); inside(root, directory);
  return store.location(path.dirname(directory), path.basename(directory), exists);
}
function fileDigest(file) {
  if (!path.isAbsolute(file)) throw new Error('execution_absolute_artifact_required');
  store.checkedDirectory(path.dirname(file));
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 536870912) throw new Error('execution_artifact_rejected');
  const fd = fs.openSync(file, 'r'), hash = crypto.createHash('sha256'), buffer = Buffer.alloc(65536);
  try {
    const first = fs.fstatSync(fd);
    if (first.ino !== stat.ino || first.dev !== stat.dev) throw new Error('execution_artifact_changed');
    let size = 0, count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null))) {
      size += count; if (size > 536870912) throw new Error('execution_artifact_limit'); hash.update(buffer.subarray(0, count));
    }
    const last = fs.fstatSync(fd), current = fs.lstatSync(file);
    if (size !== stat.size || last.mtimeMs !== stat.mtimeMs || current.ino !== stat.ino || current.dev !== stat.dev) {
      throw new Error('execution_artifact_changed');
    }
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}
function requestData(value, root) {
  const r = checkedData(value);
  exact(r, ['executable', 'arguments', 'cwd', 'input', 'timeoutMs', 'stdoutLimit', 'stderrLimit', 'cleanupMs']);
  if (!path.isAbsolute(r.executable) || !Array.isArray(r.arguments) || r.arguments.length > 64 ||
      r.arguments.some(x => typeof x !== 'string' || x.includes('\0')) || typeof r.input !== 'string') {
    throw new Error('execution_invalid_request');
  }
  store.checkedDirectory(r.cwd); inside(root, r.cwd);
  checkedTimeoutMs(r.timeoutMs); checkInt(r.cleanupMs, 100, 10000);
  checkInt(r.stdoutLimit, 1, 1048576); checkInt(r.stderrLimit, 1, 65536);
  return r;
}
function createVerificationExecution(root, name, planValue, requestValue) {
  const base = store.checkedDirectory(root), plan = checkedData(planValue), request = requestData(requestValue, base);
  exact(plan, ['run_id', 'host', 'profile', 'parent_prompt', 'packets', 'artifacts', 'not_after_ms',
    ...['native_executable', 'child_input_format'].filter(k => Object.hasOwn(plan, k))]);
  if (plan.child_input_format !== undefined && !supportedFormat(plan.child_input_format)) throw new Error('execution_delivery_format');
  if (plan.native_executable !== undefined && !path.isAbsolute(plan.native_executable)) throw new Error('execution_absolute_artifact_required');
  checkId(plan.run_id);
  if (!Object.hasOwn(versions, plan.host)) throw new Error('execution_unknown_host');
  store.checkedDirectory(plan.profile); inside(base, plan.profile);
  const reserved = Date.now(); checkInt(plan.not_after_ms, reserved + request.timeoutMs + request.cleanupMs + 20000, reserved + 3600000);
  if (!Array.isArray(plan.packets) || !plan.packets.length || plan.packets.length > 8 ||
      !Array.isArray(plan.artifacts) || !plan.artifacts.length || plan.artifacts.length > 32) throw new Error('execution_plan_limit');
  const packets = plan.packets.map(validatePacket);
  if (new Set(packets.map(p => p.question_id)).size !== packets.length) throw new Error('execution_duplicate_question');
  const artifacts = [...new Set([request.executable, powershell, ...plan.artifacts,
    ...(plan.native_executable ? [plan.native_executable] : [])])].map(file => {
    if (file !== request.executable && file !== powershell && file !== plan.native_executable) {
      inside(base, path.resolve(file));
      if (!/\.(?:cjs|mjs|js|ps1|cs|md)$/i.test(file)) throw new Error('execution_code_artifact_required');
    }
    return { path: file, sha256: fileDigest(file) };
  });
  const ticket = { schema_version: 1, run_id: plan.run_id, host: plan.host, cli_version: versions[plan.host],
    profile: plan.profile, request_sha256: digest(request), parent_prompt_sha256: textDigest(plan.parent_prompt),
    packets: packets.map(p => ({ question_id: p.question_id, packet_sha256: digest(p) })), artifacts,
    reserved_at_ms: reserved, not_after_ms: plan.not_after_ms, timeout_ms: request.timeoutMs,
    run_nonce: crypto.randomBytes(16).toString('hex'), top_level_execution_slots: 1,
    automatic_retries: 0, native_api_response_limit: null, api_token_hard_cap_verified: false,
    ...(plan.native_executable ? { native_executable: plan.native_executable } : {}),
    ...(plan.child_input_format ? { child_input_format: plan.child_input_format,
      child_input_sha256: packets.map(p => childDelivery(plan.host, p, plan.child_input_format).input_sha256),
      child_context_inputs: plan.host === 'codex' ? [codexEnvironment(request.cwd, reserved)] : [] } : {}) };
  const directory = executionLocation(base, name, false); fs.mkdirSync(directory, { mode: 0o700 });
  store.write(path.join(directory, 'ticket.json'), ticket);
  return { directory, ticket_sha256: digest(ticket) };
}
function validateEnvelope(value, ticket, ticketHash) {
  const e = checkedData(value);
  exact(e, ['schema_version', 'ticket_sha256', 'run_nonce', 'parent_thread_id', 'children', 'completion']);
  if (e.schema_version !== 1 || e.ticket_sha256 !== ticketHash || e.run_nonce !== ticket.run_nonce ||
      e.completion !== 'completed' || !Array.isArray(e.children) || e.children.length !== ticket.packets.length) {
    throw new Error('execution_envelope_binding');
  }
  checkId(e.parent_thread_id);
  for (const [i, child] of e.children.entries()) {
    exact(child, ['thread_id', 'packet_sha256', 'spawn_mode', 'completed']); checkId(child.thread_id);
    if (child.thread_id === e.parent_thread_id || child.packet_sha256 !== ticket.packets[i].packet_sha256 ||
        child.completed !== true || child.spawn_mode !== (ticket.host === 'codex' ? 'fork_context_false' :
          isSubmissionFormat(ticket.child_input_format) ? 'custom_verifier_foreground' : 'general_purpose_foreground')) {
      throw new Error('execution_child_binding');
    }
  }
  if (new Set(e.children.map(c => c.thread_id)).size !== e.children.length) throw new Error('execution_child_reused');
  return e;
}
function openVerificationExecution(root, name, ticketHash) {
  checkDigest(ticketHash); const base = store.checkedDirectory(root), directory = executionLocation(base, name);
  const file = name => path.join(directory, name);
  function inspect() {
    store.checkedDirectory(directory);
    const ticket = store.read(file('ticket.json'));
    if (digest(ticket) !== ticketHash) throw new Error('execution_ticket_changed');
    const names = store.namesIn(directory, 4);
    if (names.some(n => !['ticket.json', 'started', 'process.json', 'settlement.json'].includes(n))) throw new Error('execution_store_corrupted');
    const started = store.exists(file('started'));
    if (started) store.checkedDirectory(file('started'));
    let stamp = null;
    if (started) {
      const stamps = store.namesIn(file('started'), 1);
      if (stamps.some(n => n !== 'stamp.json')) throw new Error('execution_store_corrupted');
      if (stamps.length) stamp = store.read(path.join(file('started'), 'stamp.json'));
      if (stamp && stamp.ticket_sha256 !== ticketHash) throw new Error('execution_record_changed');
    }
    const proc = store.exists(file('process.json')) ? store.read(file('process.json')) : null;
    const settlement = store.exists(file('settlement.json')) ? store.read(file('settlement.json')) : null;
    if ((proc || settlement) && !started || (settlement && !proc)) throw new Error('execution_store_corrupted');
    if (proc && proc.ticket_sha256 !== ticketHash || settlement && settlement.ticket_sha256 !== ticketHash) throw new Error('execution_record_changed');
    if (proc) {
      if (!stamp || proc.started_at_ms !== stamp.started_at_ms || !['process_complete', 'stopped'].includes(proc.status)) throw new Error('execution_record_changed');
      checkInt(proc.started_at_ms, ticket.reserved_at_ms); checkInt(proc.finished_at_ms, proc.started_at_ms);
      if (proc.status === 'process_complete') {
        if (proc.reason !== null || !proc.process || proc.process.status !== 'exited' || proc.process.exitCode !== 0 ||
            proc.process.cleanupVerified !== true || proc.process.assignedBeforeResume !== true ||
            proc.process.activeProcesses !== 0 || proc.finished_at_ms > ticket.not_after_ms) throw new Error('execution_cleanup_record_invalid');
        validateEnvelope(proc.envelope, ticket, ticketHash);
      }
    }
    if (settlement && (!['observed', 'stopped'].includes(settlement.status) || settlement.p0_receipt !== null ||
        settlement.native_delivery_verified !== false || settlement.full_input_observed !== false ||
        settlement.semantic_quality_verified !== false || proc.status !== 'process_complete' ||
        (settlement.status === 'observed' && (settlement.reason !== null || settlement.local_execution_binding_checked !== true)))) {
      throw new Error('execution_settlement_invalid');
    }
    return { ticket, proc, settlement, status: settlement ? settlement.status : proc ?
      proc.status === 'process_complete' ? 'awaiting_evidence' : 'stopped' : started ? 'in_flight_or_interrupted' : 'ready' };
  }
  async function run(requestValue, sourceEnv = process.env) {
    const before = inspect(); if (before.status !== 'ready') throw new Error('execution_already_consumed');
    const request = requestData(requestValue, base), t = before.ticket;
    if (digest(request) !== t.request_sha256) throw new Error('execution_request_changed');
    store.checkedDirectory(t.profile); inside(base, t.profile);
    for (const a of t.artifacts) if (fileDigest(a.path) !== a.sha256) throw new Error('execution_artifact_changed');
    // Atomic start claim precedes any child process. Crashed or concurrent attempts cannot take it again.
    fs.mkdirSync(file('started'), { mode: 0o700 });
    const started = Date.now(); store.write(path.join(file('started'), 'stamp.json'), { ticket_sha256: ticketHash, started_at_ms: started });
    const record = { ticket_sha256: ticketHash, started_at_ms: started, finished_at_ms: null,
      status: 'stopped', reason: null, worker_launch_attempted: false, process: null, envelope: null, observed_usage: null };
    if (started + request.timeoutMs + request.cleanupMs + 20000 > t.not_after_ms) record.reason = 'deadline_before_launch';
    else {
      const env = nativeEnvironment(t.host, t.profile, sourceEnv, 'haiku-luna');
      env.TTAK_VERIFICATION_TICKET_SHA256 = ticketHash;
      env.TTAK_VERIFICATION_RUN_NONCE = t.run_nonce;
      try {
        record.worker_launch_attempted = true;
        const result = await boundedNativeProcess(request, { powershell, env });
        record.process = Object.fromEntries(['status', 'pid', 'exitCode', 'activeProcesses', 'totalProcesses',
          'assignedBeforeResume', 'cleanupVerified', 'elapsedMs'].map(k => [k, result[k]]));
        if (!result.cleanupVerified || !result.assignedBeforeResume || result.activeProcesses !== 0) record.reason = 'cleanup_unverified';
        else if (result.status !== 'exited') record.reason = result.status === 'timeout' ? 'timeout' : 'process_failed';
        else if (result.exitCode !== 0) record.reason = 'process_failed';
        else {
          try { record.envelope = validateEnvelope(JSON.parse(result.stdout), t, ticketHash); }
          catch { record.reason = 'collector_envelope_rejected'; }
          if (record.envelope) record.status = 'process_complete';
        }
      } catch { record.reason = 'supervisor_failed_cleanup_unverified'; }
    }
    record.finished_at_ms = Date.now();
    if (record.finished_at_ms > t.not_after_ms) { record.status = 'stopped'; record.reason = 'deadline_exceeded'; }
    store.write(file('process.json'), record); return state();
  }
  function settle(reportValues, packetValues) {
    const before = inspect(); if (before.status !== 'awaiting_evidence') throw new Error('execution_not_settleable');
    const settlement = { ticket_sha256: ticketHash, status: 'stopped', reason: 'evidence_rejected',
      failure_code: null, usage: null, children: [], local_execution_binding_checked: false,
      native_delivery_verified: false, full_input_observed: false, semantic_quality_verified: false, p0_receipt: null };
    try {
      const t = before.ticket, p = before.proc, envelope = validateEnvelope(p.envelope, t, ticketHash);
      if (!Array.isArray(reportValues) || reportValues.length !== t.packets.length + 1 || !Array.isArray(packetValues) ||
          packetValues.length !== t.packets.length) throw new Error('execution_evidence_count');
      const reports = reportValues.map(reportSnapshot), packets = packetValues.map(validatePacket);
      const ids = [envelope.parent_thread_id, ...envelope.children.map(c => c.thread_id)];
      if (new Set(reports.map(r => r.thread_id)).size !== ids.length || reports.some(r => !ids.includes(r.thread_id) ||
          r.host !== t.host || r.cli_version !== t.cli_version)) throw new Error('execution_report_binding');
      for (const r of reports) {
        const times = r.observed_time_range;
        if (!times.complete || times.first === null || times.first < p.started_at_ms || times.last > p.finished_at_ms) throw new Error('execution_stale_transcript');
        if (t.host === 'claude' && r.parent_thread_id !== envelope.parent_thread_id) throw new Error('execution_parent_binding');
      }
      const parent = reports.find(r => r.thread_id === envelope.parent_thread_id);
      if (parent.visible_inputs.filter(m => textDigest(m.content) === t.parent_prompt_sha256).length !== 1) throw new Error('execution_parent_prompt_mismatch');
      settlement.usage = summarizeExecutionUsage(reports);
      for (const [i, packet] of packets.entries()) {
        if (digest(packet) !== t.packets[i].packet_sha256) throw new Error('execution_packet_binding');
        const child = reports.find(r => r.thread_id === envelope.children[i].thread_id);
        const expectedInput = t.child_input_format ? childDelivery(t.host, packet, t.child_input_format).input : encodePacket(packet);
        if (t.child_input_format && (!supportedFormat(t.child_input_format) ||
            textDigest(expectedInput) !== t.child_input_sha256[i])) throw new Error('execution_packet_binding');
        const expectedInputs = [...(t.child_context_inputs || []), expectedInput];
        const submitted = isSubmissionFormat(t.child_input_format);
        if (child.visible_inputs.length !== expectedInputs.length || child.visible_inputs.some((m, j) => m.content !== expectedInputs[j]) ||
            !submitted && (child.tools.length || child.non_text_user_blocks.length || child.visible_answer_blocks.length !== 1)) throw new Error('execution_child_input_or_tools');
        if (submitted && (t.host !== 'claude' || parent.tools.length !== 1 ||
            !['Agent', 'Task'].includes(parent.tools[0].name))) throw new Error('submission_parent_forbidden');
        const submission = submitted ? auditSubmissionChild(child, packet) : null;
        const answer = submitted ? submission.result : t.child_input_format === anchoredFormat
          ? parseAnchoredResult(packet, child.visible_answer_blocks[0]) : parseChildResult(packet, child.visible_answer_blocks[0]);
        settlement.children.push({ thread_id: child.thread_id, packet_sha256: digest(packet), result_sha256: digest(answer),
          ...(t.child_input_format === anchoredFormat ? { wire_result_sha256: textDigest(child.visible_answer_blocks[0]),
            result_conversion: 'source_anchor_range_to_exact_p0_citation', result_input_format: anchoredFormat } : {}),
          ...(submitted ? { submission_sha256: submission.submission_sha256, tool_use_id: submission.tool_use_id,
            result_conversion: 'native_child_tool_arguments_to_exact_p0_citation', result_input_format: t.child_input_format } : {}) });
        if (answer.status !== 'answered' || answer.uncertainties.length) throw new Error('execution_unresolved_result');
      }
      settlement.status = 'observed'; settlement.reason = null; settlement.local_execution_binding_checked = true;
    } catch (error) {
      const known = new Set(['execution_evidence_count', 'execution_report_binding', 'execution_stale_transcript',
        'execution_parent_binding', 'execution_parent_prompt_mismatch', 'execution_packet_binding',
        'execution_child_input_or_tools', 'execution_unresolved_result', 'adapter_uncollected_report',
        'adapter_result_not_json_object', 'adapter_duplicate_result_key', 'verification_result_binding',
        'verification_citation_mismatch', 'verification_anchor_binding', 'verification_anchor_span', 'execution_counter_inconsistent',
        'submission_child_tool_count', 'submission_child_tool_binding', 'submission_ack_format', 'submission_ack_binding', 'submission_parent_forbidden']);
      settlement.failure_code = known.has(error.message) ? error.message : 'execution_evidence_invalid';
    }
    store.write(file('settlement.json'), settlement); return state();
  }
  function state() {
    const { ticket, proc, settlement, status } = inspect();
    return checkedData({ ticket_sha256: ticketHash, run_id: ticket.run_id, status, slot_consumed: status !== 'ready',
      process: proc, settlement, can_retry: false });
  }
  inspect(); return { run, settle, state };
}
module.exports = { createVerificationExecution, openVerificationExecution, fileDigest };
