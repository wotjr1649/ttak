'use strict';
const fs = require('node:fs'), path = require('node:path');
const { verificationStorage: store } = require('./verification-ledger.cjs');
const { checkId } = require('./verification-packet.cjs');
const { collectClaudeTranscript, collectCodexTranscript } = require('./verification-host-adapter.cjs');
function readTranscript(file) {
  store.checkedDirectory(path.dirname(file));
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 2097152 ||
      path.extname(file) !== '.jsonl') throw new Error('worker_transcript_file');
  const fd = fs.openSync(file, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (opened.ino !== before.ino || opened.dev !== before.dev || opened.nlink !== 1) throw new Error('worker_transcript_changed');
    const bytes = Buffer.alloc(2097153); let size = 0, count;
    while (size < bytes.length && (count = fs.readSync(fd, bytes, size, bytes.length - size, null))) size += count;
    const after = fs.fstatSync(fd), current = fs.lstatSync(file);
    if (size !== before.size || after.size !== size || after.mtimeMs !== before.mtimeMs ||
        current.ino !== before.ino || current.dev !== before.dev || current.isSymbolicLink() ||
        current.nlink !== 1 || after.nlink !== 1 || current.mtimeMs !== before.mtimeMs) throw new Error('worker_transcript_changed');
    return bytes.toString('utf8', 0, size); // Memory only: raw reasoning is not written or returned to the UI.
  } finally { fs.closeSync(fd); }
}
function transcriptPaths(ticket, cwd, binding) {
  store.checkedDirectory(ticket.profile); checkId(binding.parent_thread_id);
  if (binding.children.length !== 1) throw new Error('worker_child_count');
  const child = checkId(binding.children[0].thread_id), parent = binding.parent_thread_id;
  if (ticket.host === 'claude') {
    const project = path.join(ticket.profile, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
    return [path.join(project, parent + '.jsonl'), path.join(project, parent, 'subagents', 'agent-' + child + '.jsonl')];
  }
  const matches = new Map([[parent, []], [child, []]]), days = new Set();
  for (const delta of [-86400000, 0, 86400000]) days.add(new Date(ticket.reserved_at_ms + delta).toISOString().slice(0, 10).replaceAll('-', path.sep));
  for (const day of days) {
    const directory = path.join(ticket.profile, 'sessions', day);
    if (!store.exists(directory)) continue;
    store.checkedDirectory(directory);
    for (const name of store.namesIn(directory, 2048)) {
      for (const id of matches.keys()) if (name.endsWith('-' + id + '.jsonl')) matches.get(id).push(path.join(directory, name));
    }
  }
  if ([...matches.values()].some(values => values.length !== 1)) throw new Error('worker_transcript_not_unique');
  return [matches.get(parent)[0], matches.get(child)[0]];
}
function collectEvidence(ticket, cwd, binding) {
  const paths = transcriptPaths(ticket, cwd, binding);
  return paths.map((file, i) => ticket.host === 'codex'
    ? collectCodexTranscript(readTranscript(file), { thread_id: i ? binding.children[0].thread_id : binding.parent_thread_id })
    : collectClaudeTranscript(readTranscript(file), { parent_session_id: binding.parent_thread_id, agent_id: i ? binding.children[0].thread_id : null }));
}
module.exports = { readTranscript, transcriptPaths, collectEvidence };
