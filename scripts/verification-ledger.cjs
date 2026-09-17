'use strict';
// Local append-only reservations. No invoker, process launcher, timer or authority grant.
const fs = require('node:fs'), path = require('node:path');
const { checkedData, canonical, digest, exact, checkId, checkInt, checkDigest, list, uniqueIds } = require('./verification-packet.cjs');
const { validateTicket, checkedLimits, receiptSummary, validateReceiptSummary } = require('./verification-native-audit.cjs');
const MAX_FILE = 262144;
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

function checkedDirectory(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
    throw new Error('verification_storage_path');
  }
  const resolved = path.resolve(value);
  for (let current = resolved;; current = path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(fs.realpathSync(current), current)) {
      throw new Error('verification_storage_link');
    }
    if (path.dirname(current) === current) break;
  }
  return resolved;
}
function location(root, name, exists = true) {
  const base = checkedDirectory(root);
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw new Error('verification_storage_name');
  const directory = path.join(base, name);
  if (exists) checkedDirectory(directory);
  return directory;
}
function regular(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > MAX_FILE) {
    throw new Error('verification_storage_file');
  }
  return stat;
}
function read(file) {
  checkedDirectory(path.dirname(file));
  const before = regular(file), fd = fs.openSync(file, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size || opened.nlink !== 1) {
      throw new Error('verification_storage_changed');
    }
    const bytes = Buffer.alloc(MAX_FILE + 1);
    let length = 0, count;
    while (length < bytes.length && (count = fs.readSync(fd, bytes, length, bytes.length - length, null)) > 0) length += count;
    const after = regular(file), final = fs.fstatSync(fd);
    if (length > MAX_FILE || after.dev !== before.dev || after.ino !== before.ino || final.size !== before.size ||
        length !== before.size || final.mtimeMs !== before.mtimeMs) throw new Error('verification_storage_changed');
    let value;
    try { value = JSON.parse(bytes.toString('utf8', 0, length)); } catch { throw new Error('verification_storage_json'); }
    return checkedData(value);
  } finally { fs.closeSync(fd); }
}
function write(file, value) {
  checkedDirectory(path.dirname(file));
  const raw = canonical(value) + '\n';
  if (Buffer.byteLength(raw) > MAX_FILE) throw new Error('verification_storage_limit');
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function exists(file) {
  try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function namesIn(directory, max) {
  const handle = fs.opendirSync(directory), names = [];
  try {
    let item;
    while ((item = handle.readSync())) {
      if (names.length >= max) throw new Error('verification_store_corrupted');
      names.push(item.name);
    }
  } finally { handle.closeSync(); }
  return names.sort();
}
function validateConfig(value) {
  const config = checkedData(value);
  exact(config, ['schema_version', 'run_id', 'turn_id', 'parent_thread_id', 'host', 'cli_version',
    'plan_sha256', 'questions', 'started_at_ms', 'deadline_ms', 'limits']);
  for (const key of ['run_id', 'turn_id', 'parent_thread_id']) checkId(config[key]);
  checkDigest(config.plan_sha256);
  if (config.schema_version !== 1 || !['claude', 'codex'].includes(config.host) ||
      !/^\d+\.\d+\.\d+$/.test(config.cli_version)) throw new Error('verification_invalid_config');
  list(config.questions, 8);
  for (const row of config.questions) {
    exact(row, ['question_id', 'packet_sha256']); checkId(row.question_id); checkDigest(row.packet_sha256);
  }
  uniqueIds(config.questions.map(row => row.question_id), 8);
  checkInt(config.started_at_ms); checkInt(config.deadline_ms, config.started_at_ms + 1, config.started_at_ms + 3600000);
  exact(config.limits, ['max_calls', 'max_responses', 'max_input_tokens', 'max_output_tokens', 'call_timeout_ms']);
  checkInt(config.limits.max_calls, config.questions.length + 1, 64);
  checkedLimits({ max_responses: config.limits.max_responses,
    max_input_tokens: config.limits.max_input_tokens, max_output_tokens: config.limits.max_output_tokens });
  checkInt(config.limits.call_timeout_ms, 1, 300000);
  return config;
}

function createVerificationLedger(root, name, value) {
  const config = validateConfig(value), directory = location(root, name, false);
  fs.mkdirSync(directory, { mode: 0o700 }); // Existing or interrupted stores are never overwritten.
  write(path.join(directory, 'plan.json'), config);
  return { directory, config_sha256: digest(config) };
}

function openVerificationLedger(root, name, expectedConfigHash) {
  checkDigest(expectedConfigHash);
  const directory = location(root, name);
  function inspect(now) {
    checkInt(now); location(root, name);
    const config = validateConfig(read(path.join(directory, 'plan.json')));
    if (digest(config) !== expectedConfigHash) throw new Error('verification_plan_changed');
    checkInt(now, config.started_at_ms);
    const names = namesIn(directory, config.limits.max_calls + 1);
    if (names.length > config.limits.max_calls + 1 || !names.includes('plan.json') ||
        names.some(item => item !== 'plan.json' && !/^C\d{4}$/.test(item))) throw new Error('verification_store_corrupted');
    const calls = names.filter(item => item !== 'plan.json'), responseIds = [], childThreads = [], completedQuestions = [];
    const reserved = { max_responses: 0, max_input_tokens: 0, max_output_tokens: 0 };
    const observed = { responses: 0, input_debit: 0, output_debit: 0 };
    let pending = null, stopped = null, complete = false, previous = expectedConfigHash, lastTime = config.started_at_ms;
    for (let index = 0; index < calls.length; index++) {
      const id = 'C' + String(index + 1).padStart(4, '0'), dir = path.join(directory, id);
      if (calls[index] !== id || pending || stopped || complete) throw new Error('verification_order_corrupted');
      checkedDirectory(dir);
      const files = namesIn(dir, 2);
      if (files.some(file => !['reservation.json', 'settlement.json'].includes(file))) throw new Error('verification_store_corrupted');
      if (!exists(path.join(dir, 'reservation.json'))) {
        if (files.length) throw new Error('verification_store_corrupted');
        pending = { call_id: id, interrupted: true }; continue;
      }
      const reservation = read(path.join(dir, 'reservation.json'));
      exact(reservation, ['previous_sha256', 'ticket']);
      const ticket = validateTicket(reservation.ticket);
      if (reservation.previous_sha256 !== previous || ticket.call_id !== id ||
          ['run_id', 'turn_id', 'host', 'cli_version', 'parent_thread_id'].some(key => ticket[key] !== config[key]) ||
          ticket.reserved_at_ms < lastTime || ticket.expires_at_ms > config.deadline_ms ||
          ticket.expires_at_ms !== Math.min(ticket.reserved_at_ms + config.limits.call_timeout_ms, config.deadline_ms)) {
        throw new Error('verification_reservation_changed');
      }
      if (now < ticket.reserved_at_ms) throw new Error('verification_clock_reversed');
      for (const key of Object.keys(reserved)) {
        reserved[key] += ticket.limits[key];
        if (reserved[key] > config.limits[key]) throw new Error('verification_budget_corrupted');
      }
      if (ticket.kind === 'child') {
        const next = config.questions[completedQuestions.length];
        if (!next || next.question_id !== ticket.question_id || next.packet_sha256 !== ticket.packet_sha256) {
          throw new Error('verification_question_order');
        }
      }
      if (ticket.kind === 'rewrite' && completedQuestions.length !== config.questions.length) {
        throw new Error('verification_rewrite_before_verification');
      }
      const settlementFile = path.join(dir, 'settlement.json');
      if (!exists(settlementFile)) {
        pending = ticket; if (now >= ticket.expires_at_ms) stopped = 'timeout'; continue;
      }
      const settlement = read(settlementFile);
      exact(settlement, ['ticket_sha256', 'settled_at_ms', 'status', 'reason', 'audit']);
      if (settlement.ticket_sha256 !== digest(ticket)) throw new Error('verification_settlement_changed');
      checkInt(settlement.settled_at_ms, ticket.reserved_at_ms);
      lastTime = settlement.settled_at_ms;
      if (settlement.status === 'stopped') {
        if (!['cancelled', 'timeout', 'partial', 'execution_error', 'audit_rejected', 'quality_failure', 'unresolved'].includes(settlement.reason) ||
            settlement.audit !== null) throw new Error('verification_invalid_stop');
        stopped = settlement.reason;
      } else {
        const summary = validateReceiptSummary(settlement.audit, ticket);
        if (settlement.status !== 'accepted' || settlement.reason !== null || settlement.settled_at_ms >= ticket.expires_at_ms ||
            !summary || summary.ticket_sha256 !== digest(ticket) || summary.outcome !== 'complete' ||
            summary.native_delivery_verified !== false || summary.semantic_quality_verified !== false) {
          throw new Error('verification_invalid_settlement');
        }
        if (summary.usage.response_ids.some(id => responseIds.includes(id)) ||
            (ticket.kind === 'child' && childThreads.includes(summary.thread_id))) throw new Error('verification_replayed_call');
        responseIds.push(...summary.usage.response_ids);
        observed.responses += summary.usage.response_count;
        observed.input_debit += summary.usage.limit_debit.input_tokens;
        observed.output_debit += summary.usage.limit_debit.output_tokens;
        if (ticket.kind === 'child') { childThreads.push(summary.thread_id); completedQuestions.push(ticket.question_id); }
        if (ticket.kind === 'rewrite') complete = true;
      }
      previous = digest(settlement);
    }
    if (now < lastTime) throw new Error('verification_clock_reversed');
    return { config, previous, status: stopped ? 'stopped' : pending ? 'in_flight' : complete ? 'complete'
      : now >= config.deadline_ms ? 'expired' : calls.length >= config.limits.max_calls ? 'exhausted' : 'ready', stop_reason: stopped,
    used_calls: calls.length, reserved, observed, pending, completed_questions: completedQuestions,
    reservation_accounting_complete: !pending?.interrupted,
    response_ids: responseIds, child_thread_ids: childThreads,
    next_question: config.questions[completedQuestions.length] || null };
  }
  function state(now = Date.now()) {
    const { config, previous, ...view } = inspect(now);
    return view;
  }
  function reserve(value, now = Date.now()) {
    const request = checkedData(value); exact(request, ['kind', 'question_id', 'packet_sha256', 'limits']);
    const before = inspect(now), config = before.config;
    if (before.status !== 'ready' || before.used_calls >= config.limits.max_calls) throw new Error('verification_not_reservable');
    const id = 'C' + String(before.used_calls + 1).padStart(4, '0');
    const ticket = validateTicket({ schema_version: 1, run_id: config.run_id, turn_id: config.turn_id,
      call_id: id, host: config.host, cli_version: config.cli_version, parent_thread_id: config.parent_thread_id,
      ...request, reserved_at_ms: now, expires_at_ms: Math.min(now + config.limits.call_timeout_ms, config.deadline_ms) });
    for (const key of Object.keys(ticket.limits)) {
      if (before.reserved[key] + ticket.limits[key] > config.limits[key]) throw new Error('verification_reservation_limit');
    }
    if (ticket.kind === 'child' && (!before.next_question || ticket.question_id !== before.next_question.question_id ||
        ticket.packet_sha256 !== before.next_question.packet_sha256)) throw new Error('verification_question_order');
    if (ticket.kind === 'rewrite' && before.next_question) throw new Error('verification_rewrite_before_verification');
    const dir = path.join(directory, id);
    fs.mkdirSync(dir, { mode: 0o700 }); // Single winner across independently opened writers.
    write(path.join(dir, 'reservation.json'), { previous_sha256: before.previous, ticket });
    return ticket;
  }
  function pendingTicket(ticketValue, now) {
    const ticket = validateTicket(ticketValue), current = inspect(now);
    if (!current.pending || canonical(current.pending) !== canonical(ticket)) throw new Error('verification_no_matching_reservation');
    return { ticket, current };
  }
  function recordStop(ticket, reason, now) {
    write(path.join(directory, ticket.call_id, 'settlement.json'), {
      ticket_sha256: digest(ticket), settled_at_ms: now, status: 'stopped', reason, audit: null });
  }
  function fail(ticketValue, reason, now = Date.now()) {
    if (!['cancelled', 'timeout', 'partial', 'execution_error', 'audit_rejected', 'quality_failure'].includes(reason)) {
      throw new Error('verification_invalid_stop');
    }
    const { ticket } = pendingTicket(ticketValue, now);
    recordStop(ticket, reason, now); return state(now);
  }
  function accept(ticketValue, receipt, now = Date.now()) {
    const { ticket, current } = pendingTicket(ticketValue, now);
    let summary;
    try {
      summary = receiptSummary(receipt);
      if (summary.ticket_sha256 !== digest(ticket) || current.status !== 'in_flight' || now >= ticket.expires_at_ms ||
          summary.usage.response_ids.some(id => current.response_ids.includes(id)) ||
          (ticket.kind === 'child' && current.child_thread_ids.includes(summary.thread_id))) {
        throw new Error('verification_receipt_mismatch');
      }
    } catch {
      recordStop(ticket, now >= ticket.expires_at_ms ? 'timeout' : 'audit_rejected', now);
      throw new Error('verification_audit_rejected_no_retry');
    }
    if (summary.outcome !== 'complete') { recordStop(ticket, 'unresolved', now); return state(now); }
    write(path.join(directory, ticket.call_id, 'settlement.json'), { ticket_sha256: digest(ticket),
      settled_at_ms: now, status: 'accepted', reason: null, audit: summary });
    return state(now);
  }
  if (digest(validateConfig(read(path.join(directory, 'plan.json')))) !== expectedConfigHash) {
    throw new Error('verification_plan_changed');
  }
  return { state, reserve, accept, fail };
}

// Shared bounded storage operations; callers still own scope and authorization checks.
const verificationStorage = Object.freeze({ checkedDirectory, location, read, write, exists, namesIn });
module.exports = { createVerificationLedger, openVerificationLedger, verificationStorage };
