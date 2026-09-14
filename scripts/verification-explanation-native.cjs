'use strict';
// Explicit local adapter for an authorized public-data run. Import/prepare performs no model call.
const fs = require('node:fs'), path = require('node:path');
const { verificationStorage: store } = require('./verification-ledger.cjs');
const { digest, checkedData, exact, checkId, canonical } = require('./verification-packet.cjs');
const { fileDigest } = require('./verification-execution.cjs');
const nativeRun = require('./verification-native-run.cjs');
const { nativeEnvironment, nativeArguments, parseNative, auditTranscript, modelSettings } = require('./review-native-format.cjs');
const { boundedNativeProcess, checkedTimeoutMs } = require('./bounded-native-process.cjs');
const { readTranscript, collectEvidence } = require('./verification-native-evidence.cjs');
const { collectClaudeTranscript, collectCodexTranscript, reportSnapshot, parseStrictObject } = require('./verification-host-adapter.cjs');
const { codexEnvironment, childDelivery, anchoredFormat } = require('./verification-delivery.cjs');
const { summarizeExecutionUsage } = require('./verification-execution-usage.cjs');
const { auditSubmissionChild, submissionSchema } = require('./verification-submission-audit.cjs');
const { sourceBoundInstructions } = require('./verification-submission-contract.cjs');
const { parseAnchoredResult } = require('./verification-anchors.cjs');
const { auditClaudeParent, parentProofInputs } = require('./verification-parent-claude.cjs');
const root = path.resolve(__dirname, '..'), powershell = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const base = path.join(root, '.superpowers/verification-worker-95');
const versions = { claude: '2.1.266', codex: '0.154.0' };
const reviewedCodexConfigHash = '0560a308e3ee2b477a07ae91726854748644ccb91ad5d54deadf833fa2a0063c';
function checkProfile(host, cwd) {
  const profile = nativeRun.profileFor(host); store.checkedDirectory(profile);
  if (host === 'claude') nativeRun.assertClaudeSettings(profile, cwd);
  else if (fileDigest(path.join(profile, 'config.toml')) !== reviewedCodexConfigHash) throw new Error('explanation_profile_changed');
  return profile;
}
async function prepareNativeAdapters(name, host) {
  // name and host are resolved by the caller, not by any packet or generated answer.
  store.location(base, name, false); modelSettings(host, 'haiku-luna');
  await nativeRun.assertBinary(host); const profile = checkProfile(host, base);
  const files = [...nativeRun.artifacts.map(f => path.join(__dirname, f)),
    ...['verification-explanation.cjs', 'verification-parent-claude.cjs', 'verification-quality-plan.cjs', 'verification-quality-campaign.cjs', 'finite-scenario.cjs']
      .map(f => path.join(__dirname, f)), __filename, process.execPath, powershell,
    ...(host === 'codex' ? ['hooks/ttak.cjs', 'policy/precedence.md', 'policy/invariants.md', 'policy/contract.md'].map(f =>
      path.join(profile, 'plugins/cache/ttak-release/ttak/0.2.0-rc.1+codex.20260908082818', f)) : [])];
  const freeze = files.map(file => ({ path: file, sha256: fileDigest(file) }));
  const directory = store.location(base, name, false); fs.mkdirSync(directory);
  store.write(path.join(directory, 'adapter-plan.json'), { host, profile, freeze, native_starts: 0,
    profile_modified: false, semantic_quality_verified: false });
  let ordinal = 0, failed = false, running = false;
  async function invoke(requestValue, limitsValue) {
    if (failed || running) throw new Error('explanation_native_adapter_stopped');
    running = true; let stageDir = null;
    try {
      const request = checkedData(requestValue), limits = checkedData(limitsValue);
      if (request.host !== host || !['draft', 'child', 'rewrite'].includes(request.stage)) throw new Error('explanation_native_request');
      checkId(request.run_id); checkId(request.turn_id);
      for (const file of freeze) if (fileDigest(file.path) !== file.sha256) throw new Error('explanation_candidate_changed');
      await nativeRun.assertBinary(host); checkProfile(host, base);
      checkedTimeoutMs(limits.timeout_ms);
      if (limits.cleanup_ms !== 5000 ||
          Date.now() + limits.timeout_ms + limits.cleanup_ms + 20000 > limits.not_after_ms) throw new Error('explanation_native_limits');
      // At most eight questions and two parent stages. This capacity is not execution authority.
      if (++ordinal > 10) throw new Error('explanation_native_capacity');
      const stageName = name + '-s' + ordinal;
      stageDir = store.location(directory, 's' + ordinal, false); fs.mkdirSync(stageDir);
      store.write(path.join(stageDir, 'reservation.json'), { request_sha256: digest(request),
        ordinal, stage: request.stage, reserved_at_ms: Date.now(), limits });
      let result, usage, executionId;
      if (request.stage === 'child' && host === 'claude') {
        exact(request, ['run_id', 'turn_id', 'host', 'stage', 'packet']);
        const prepared = await nativeRun.preparePacketRun(host, stageName, request.packet, undefined, limits.timeout_ms);
        store.write(path.join(stageDir, 'native-ticket.json'), prepared);
        const observation = await nativeRun.executePacketRun(stageName, prepared.ticket_sha256, prepared.packet_sha256);
        store.write(path.join(stageDir, 'execution.json'), observation);
        if (observation.status !== 'observed') throw new Error('explanation_child_execution_failed');
        const ticket = store.read(path.join(prepared.directory, 'ticket.json'));
        const reports = collectEvidence(ticket, prepared.cwd, observation.process.envelope);
        result = host === 'claude' ? auditSubmissionChild(reports[1], request.packet).result
          : parseAnchoredResult(request.packet, reports[1].visible_answer_blocks[0]);
        if (digest(result) !== observation.settlement.children[0].result_sha256) throw new Error('explanation_child_result_changed');
        usage = observation.settlement.usage; executionId = observation.process.envelope.parent_thread_id;
      } else {
        const direct = directStageRequest(request), { prompt, schema } = direct;
        const cwd = store.location(base, stageName + '-work', false); fs.mkdirSync(cwd);
        checkProfile(host, cwd);
        const schemaPath = path.join(cwd, 'schema.json'); store.write(schemaPath, schema);
        const started = Date.now();
        const command = { executable: nativeRun.native[host].executable,
          arguments: nativeArguments(host, schema, schemaPath, 'haiku-luna'), cwd, input: prompt,
          timeoutMs: limits.timeout_ms, cleanupMs: 5000, stdoutLimit: 1048576, stderrLimit: 4096 };
        store.write(path.join(stageDir, 'command.json'), command);
        // Reservation is durable before the first process. The Windows Job owns the whole process tree.
        const processResult = await boundedNativeProcess(command, { powershell,
          env: nativeEnvironment(host, profile, process.env, 'haiku-luna') });
        const finished = Date.now();
        store.write(path.join(stageDir, 'process.json'), Object.fromEntries(['status', 'pid', 'exitCode',
          'activeProcesses', 'totalProcesses', 'cleanupVerified', 'assignedBeforeResume', 'elapsedMs'].map(k => [k, processResult[k]])));
        if (processResult.exitCode !== 0) store.write(path.join(stageDir, 'exit-diagnosis.json'), {
          category: nativeFailureCategory(host, processResult.stdout), execution_role: direct.role, automatic_retry: false });
        if (processResult.status !== 'exited' || processResult.exitCode !== 0 || !processResult.cleanupVerified ||
            !processResult.assignedBeforeResume || processResult.activeProcesses !== 0) throw new Error('explanation_parent_execution_failed');
        const parsed = parseNative(host, processResult.stdout, 'haiku-luna'); executionId = parsed.session;
        // Do not save raw stdout/stderr or native reasoning. Keep selected visible fields and counters only.
        const raw = readTranscript(parentTranscript(host, profile, cwd, parsed.session, started));
        const audit = auditTranscript(host, raw, { session: parsed.session, prompt, version: versions[host] }, 'haiku-luna');
        const report = host === 'claude' ? collectClaudeTranscript(raw, { parent_session_id: parsed.session, agent_id: null })
          : collectCodexTranscript(raw, { thread_id: parsed.session });
        usage = summarizeExecutionUsage([report]); result = checkedData(parsed.value);
        store.write(path.join(stageDir, 'collected.json'), { execution_id: executionId, usage, result, execution_role: direct.role,
          protocol_accepted: false, full_input_observed: false, semantic_quality_verified: false });
        const proof = host === 'claude' ? auditClaudeParent(raw, report, prompt, result) : null;
        auditParentReport(report, prompt, started, finished, host === 'codex' ? [codexEnvironment(cwd, started)] : [], proof);
        auditParentResult(host, raw, report, parsed.value);
        usage = summarizeExecutionUsage([report]); result = checkedData(parsed.value);
        if (direct.role === 'independent_verifier_session') result = parseAnchoredResult(request.packet, canonical(result));
        store.write(path.join(stageDir, 'audit.json'), { audit, protocol: proof, execution_role: direct.role,
          native_subagent: false, usage, result_sha256: digest(result),
          full_input_observed: false, semantic_quality_verified: false });
      }
      const observation = { execution_id: executionId, host, model: modelSettings(host, 'haiku-luna').model,
        effort: modelSettings(host, 'haiku-luna').effort, request_sha256: digest(request), status: 'observed',
        cleanup_verified: true, active_owned_processes: 0,
        usage: { input_including_cache: usage.totals.input_including_cache,
          output_including_reasoning: usage.totals.output_including_reasoning,
          native_api_responses: null, completeness_verified: false }, result };
      store.write(path.join(stageDir, 'result.json'), observation); return observation;
    } catch (error) {
      failed = true;
      const known = new Set(['explanation_candidate_changed', 'explanation_profile_changed', 'explanation_native_limits',
        'explanation_native_capacity', 'explanation_parent_execution_failed', 'explanation_child_execution_failed',
        'explanation_child_result_changed', 'explanation_parent_report', 'explanation_parent_result_binding',
        'explanation_parent_transcript', 'explanation_parent_protocol', 'native_model_or_execution_failure', 'native_error_or_unexpected_tool',
        'ambiguous_native_result', 'missing_native_result', 'native_transcript_settings_mismatch',
        'native_thinking_not_observed', 'native_prompt_delivery_mismatch', 'native_cleanup_unverified',
        'supervisor_watchdog_cleanup_unverified', 'supervisor_failed_cleanup_unverified',
        'adapter_thread_binding', 'adapter_model_mismatch', 'adapter_missing_observations', 'adapter_incomplete_turn']);
      const code = known.has(error.message) ? error.message : 'explanation_native_adapter_failed';
      if (stageDir) store.write(path.join(stageDir, 'failure.json'), { status: 'stopped', further_calls_blocked: true,
        code, partial_usage_may_be_uncollected: true, cleanup_requires_process_record: true });
      throw new Error(code.startsWith('explanation_') ? code : 'explanation_native_adapter_failed');
    } finally { running = false; }
  }
  return { parent: invoke, child: invoke, directory, freeze_sha256: digest(freeze) };
}
function nativeFailureCategory(host, stdout) {
  if (typeof stdout !== 'string' || Buffer.byteLength(stdout) > 1048576) return 'unclassified';
  const messages = [];
  for (const line of (host === 'codex' ? stdout.split(/\r?\n/) : [stdout])) {
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (host === 'codex' && ['error', 'turn.failed'].includes(row.type)) messages.push(row.message, row.error?.message);
    if (host === 'claude' && row.is_error === true) messages.push(row.result);
  }
  const value = messages.filter(v => typeof v === 'string').join('\n');
  if (/Selected model is at capacity|server_overloaded/.test(value)) return 'server_overloaded';
  if (/invalid_json_schema|Invalid schema for response_format/.test(value)) return 'invalid_json_schema';
  if (/rate_limit_error|usage_limit_reached/.test(value)) return 'usage_limit';
  return 'unclassified'; // Never save provider payloads, account data, or arbitrary error text.
}
function directStageRequest(value) {
  const request = checkedData(value);
  if (request.stage === 'child') {
    exact(request, ['run_id', 'turn_id', 'host', 'stage', 'packet']);
    if (request.host !== 'codex') throw new Error('explanation_native_request');
    const schema = submissionSchema(request.packet);
    const envelope = JSON.parse(childDelivery('codex', request.packet, anchoredFormat).input);
    envelope.schema_version = 5; envelope.result_schema = schema; envelope.result_instructions += sourceBoundInstructions;
    return { prompt: canonical(envelope),
      schema, role: 'independent_verifier_session' };
  }
  exact(request, ['run_id', 'turn_id', 'host', 'stage', 'prompt', 'prompt_sha256', 'schema']);
  if (!['draft', 'rewrite'].includes(request.stage)) throw new Error('explanation_native_request');
  return { prompt: request.prompt, schema: request.schema, role: 'explanation_parent' };
}
function parentTranscript(host, profile, cwd, session, time) {
  checkId(session);
  if (host === 'claude') return path.join(profile, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'), session + '.jsonl');
  const found = [];
  for (const delta of [-86400000, 0, 86400000]) {
    const day = new Date(time + delta).toISOString().slice(0, 10).replaceAll('-', path.sep);
    const dir = path.join(profile, 'sessions', day);
    if (!store.exists(dir)) continue;
    store.checkedDirectory(dir);
    for (const name of store.namesIn(dir, 2048)) if (name.endsWith('-' + session + '.jsonl')) found.push(path.join(dir, name));
  }
  if (found.length !== 1) throw new Error('explanation_parent_transcript');
  return found[0];
}
function auditParentReport(report, prompt, started, finished, contextInputs = [], proof = null) {
  reportSnapshot(report);
  const t = report.observed_time_range;
  const inputs = proof === null ? [...contextInputs, prompt] : parentProofInputs(proof, report, prompt);
  if (proof !== null && contextInputs.length) throw new Error('explanation_parent_report');
  if (!t.complete || t.first < started || t.last > finished ||
      report.visible_inputs.length !== inputs.length || report.visible_inputs.some((v, i) => v.content !== inputs[i]) ||
      report.non_text_user_blocks.some(b => report.host !== 'claude' || b.type !== 'tool_result') ||
      report.tools.some(t => report.host !== 'claude' || t.type !== 'tool_use' || t.name !== 'StructuredOutput')) {
    throw new Error('explanation_parent_report');
  }
  return true;
}
function auditParentResult(host, raw, report, result) {
  reportSnapshot(report);
  const selected = [];
  if (host === 'claude') {
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      const row = JSON.parse(line);
      if (row.type !== 'assistant' || !Array.isArray(row.message?.content)) continue;
      for (const block of row.message.content) if (block.type === 'tool_use' && block.name === 'StructuredOutput') selected.push(checkedData(block.input));
    }
  } else for (const text of report.visible_answer_blocks) selected.push(parseStrictObject(text));
  if (selected.length !== 1 || canonical(selected[0]) !== canonical(result)) throw new Error('explanation_parent_result_binding');
  return true;
}
module.exports = { prepareNativeAdapters, parentTranscript, auditParentReport, auditParentResult, directStageRequest, nativeFailureCategory };
