'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { boundedNativeProcess, checkedTimeoutMs } = require('./bounded-native-process.cjs');
const { nativeRequest, nativeEnvironment, nativeArguments, parseNative, auditTranscript, possibleSecret, pinned, modelSettings } = require('./review-native-format.cjs');
const { validateRole } = require('./review-roles.cjs');
const { decodeAnchoredRole, decodeAnchoredPatches } = require('./review-anchors.cjs');
const hash = text => createHash('sha256').update(text).digest('hex');
const write = (dir, name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

function inside(root, target) {
  const resolved = fs.realpathSync(target), relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('native_path_outside_scope');
  return resolved;
}
function findTranscript(profile, host, session) {
  const start = path.join(profile, host === 'claude' ? 'projects' : 'sessions');
  const stack = [start], found = []; let count = 0;
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (++count > 10000) throw new Error('transcript_lookup_limit');
      if (entry.isSymbolicLink()) throw new Error('transcript_link_rejected');
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(file);
      else if (entry.isFile() && (host === 'claude' ? entry.name === `${session}.jsonl` : entry.name.endsWith(`-${session}.jsonl`))) {
        found.push(inside(profile, file));
      }
    }
  }
  if (found.length !== 1) throw new Error('native_transcript_missing_or_ambiguous');
  if (fs.statSync(found[0]).size > 8388608) throw new Error('native_transcript_too_large');
  return fs.readFileSync(found[0], 'utf8');
}

function createNativeInvoker(options) {
  const timeoutMs = checkedTimeoutMs(options?.timeoutMs);
  if (!options || !pinned[options.host] || !/^\d+\.\d+\.\d+$/.test(options.version) ||
      !Number.isSafeInteger(options.maxCalls) || options.maxCalls < 1 || options.maxCalls > 27) {
    throw new Error('invalid_native_options');
  }
  const root = fs.realpathSync(options.root);
  const profile = inside(root, options.profile), runs = inside(root, options.runs);
  for (const executable of [options.executable, options.powershell]) {
    if (!path.isAbsolute(executable) || !fs.statSync(executable).isFile()) throw new Error('invalid_native_executable');
  }
  const { host, version, executable, powershell, maxCalls } = options;
  const study = options.study ?? 'legacy';
  const quoteMode = options.quoteMode ?? 'verbatim';
  if (!['verbatim', 'anchors'].includes(quoteMode)) throw new Error('invalid_native_quote_mode');
  const selected = modelSettings(host, study);
  const env = nativeEnvironment(host, profile, process.env, study);
  let used = 0, running = false, failed = false, checked = false;
  const executableHash = hash(fs.readFileSync(executable));
  const launch = request => boundedNativeProcess(request, { powershell, env });
  const limits = { timeoutMs, stdoutLimit: 1048576, stderrLimit: 65536, cleanupMs: 10000 };

  async function preflight() {
    const readinessPath = path.join(profile, 'readiness.json');
    if (!fs.existsSync(readinessPath) || fs.statSync(readinessPath).size > 65536) throw new Error('native_readiness_missing');
    const readiness = JSON.parse(fs.readFileSync(readinessPath, 'utf8'));
    for (const key of ['subscription_only', 'extra_usage_disabled', 'no_external_connectors', 'normal_hook_trust_verified']) {
      if (readiness[key] !== true) throw new Error('native_readiness_incomplete');
    }
    // Current baseline profiles have no configuration files. A changed profile requires
    // explicit inspection, not silently ignoring its normal controls or loading unknown tools.
    for (const name of ['config.toml', 'settings.json', 'settings.local.json', '.mcp.json']) {
      if (fs.existsSync(path.join(profile, name))) throw new Error('profile_configuration_requires_review');
    }
    if (hash(fs.readFileSync(executable)) !== executableHash) throw new Error('native_binary_changed');
    const result = await launch({ executable, arguments: ['--version'], cwd: runs, input: '', ...limits, timeoutMs: 10000 });
    const expected = host === 'claude' ? `${version} (Claude Code)` : `codex-cli ${version}`;
    if (result.status !== 'exited' || result.exitCode !== 0 || result.stdout.trim() !== expected) throw new Error('native_version_mismatch');
    checked = true;
    return { host, version, executable_sha256: executableHash, model_calls: 0, cleanup_verified: true };
  }

  async function invoke(job) {
    if (running || failed || used >= maxCalls) throw new Error('native_invoker_stopped');
    running = true;
    let dir;
    try {
      if (!checked) await preflight();
      if (hash(fs.readFileSync(executable)) !== executableHash) throw new Error('native_binary_changed');
      const id = randomUUID();
      const { prompt, schema } = nativeRequest(job, id, quoteMode);
      if (possibleSecret(prompt)) throw new Error('native_content_withheld');
      dir = path.join(runs, id); fs.mkdirSync(dir);
      const schemaPath = path.join(dir, 'schema.json');
      write(dir, 'schema.json', schema);
      const args = nativeArguments(host, schema, schemaPath, study);
      const attempt = { id, host, version, study, quote_mode: quoteMode, ...selected, phase: job.phase, role: job.role ?? null,
        prompt_sha256: hash(prompt), schema_sha256: hash(JSON.stringify(schema)), executable_sha256: executableHash,
        limits, started_at: new Date().toISOString(), ordinal: ++used, max_calls: maxCalls, retries: 0 };
      write(dir, 'attempt.json', attempt);
      const processResult = await launch({ executable, arguments: args, cwd: dir, input: prompt, ...limits });
      write(dir, 'process.json', { status: processResult.status, exit_code: processResult.exitCode,
        pid: processResult.pid, total_processes: processResult.totalProcesses, active_processes: processResult.activeProcesses,
        cleanup_verified: processResult.cleanupVerified, elapsed_ms: processResult.elapsedMs });
      if (possibleSecret(processResult.stdout) || possibleSecret(processResult.stderr)) throw new Error('native_content_withheld');
      // Retain bounded native outputs only after the local possible-secret check; never print them.
      write(dir, 'native-output.json', { stdout: processResult.stdout, stderr: processResult.stderr });
      if (processResult.status !== 'exited' || processResult.exitCode !== 0) throw new Error('native_process_failed');
      const parsed = parseNative(host, processResult.stdout, study);
      const transcript = findTranscript(profile, host, parsed.session);
      const audit = auditTranscript(host, transcript, { session: parsed.session, prompt, version }, study);
      if (quoteMode === 'anchors') {
        write(dir, 'anchored-result.json', parsed.value);
        parsed.value = job.phase === 'repair' ? decodeAnchoredPatches(job.packet, job.review, parsed.value) :
          decodeAnchoredRole(job.packet, job.role, parsed.value);
      }
      if (job.phase !== 'repair') validateRole(job.packet, job.role, parsed.value);
      write(dir, 'audit.json', { ...audit, usage: parsed.usage, transcript_sha256: hash(transcript),
        prompt_sha256: attempt.prompt_sha256, native_transport_verified: true, factual_correctness_verified: false });
      write(dir, 'result.json', parsed);
      return parsed;
    } catch (error) {
      failed = true;
      // Fixed failure category only; exception messages can contain untrusted parser contents.
      if (dir) write(dir, 'failure.json', { status: 'failed', retries: 0, further_calls_blocked: true });
      throw new Error('native_invocation_failed_no_retry');
    } finally { running = false; }
  }
  return { invoke, preflight, usage: () => ({ used, maxCalls, failed, running }) };
}
module.exports = { createNativeInvoker, findTranscript };
