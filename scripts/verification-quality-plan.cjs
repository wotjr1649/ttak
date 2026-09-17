'use strict';
// Public fixture planning only. The plan never grants account access, installation or call authority.
const { analyzeScenario } = require('./finite-scenario.cjs');
const { validateSpec, budgetFor } = require('./verification-explanation.cjs');
const { checkedData, exact, textDigest, digest } = require('./verification-packet.cjs');
const source = (id, version, text) => ({ id, version, text, sha256: textDigest(text) });
const references = [
  { id: 'S2', url: 'https://www.postgresql.org/docs/18/transaction-iso.html', checked_date: '2026-09-11',
    kind: 'reviewed_paraphrase', version: 'PostgreSQL-18', text:
    'PostgreSQL Repeatable Read uses snapshot isolation. Successive statements use a snapshot established by the first non-transaction-control statement. '
    + 'A transaction trying to update or lock a row changed by another transaction since that snapshot can fail; distinct write targets do not by themselves protect a cross-row business invariant. '
    + 'Serializable ensures committed results are equivalent to some serial execution, without requiring physical serial execution. '
    + 'It adds monitoring overhead beyond Repeatable Read and can abort transactions with serialization failures. Applications must retry the whole transaction. '
    + 'Predicate locks used for SSI monitoring do not block other transactions. Monitoring overhead and work repeated after aborts are separate costs.' },
  { id: 'S3', url: 'https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/README-SSI',
    supporting_url: 'https://raw.githubusercontent.com/postgres/postgres/REL_18_STABLE/src/backend/storage/lmgr/predicate.c',
    checked_date: '2026-09-11', kind: 'reviewed_paraphrase', version: 'PostgreSQL-18-SSI', text:
    'SSI monitors read-write antidependencies while running snapshot isolation. A serialization anomaly requires a dependency cycle. '
    + 'The SSI implementation looks for dangerous structures consisting of two adjacent rw conflicts and applies commit-order conditions. '
    + 'This is not an exact search for complete cycles: a dangerous structure can occur without a cycle, so some transactions may be aborted although their execution would not have produced an anomaly. '
    + 'Conflict checking occurs during reads, writes and commit processing; describing it exclusively as cycle detection at commit loses implementation conditions.' },
  { id: 'S4', url: 'https://www.postgresql.org/docs/18/explicit-locking.html', checked_date: '2026-09-11',
    kind: 'reviewed_paraphrase', version: 'PostgreSQL-18-locking', text:
    'Row locks block conflicting writers and lockers, not ordinary queries. FOR SHARE locks on a row can coexist with other FOR SHARE and FOR KEY SHARE locks. '
    + 'FOR UPDATE conflicts with other listed row-lock modes; locks last until transaction end or rollback. '
    + 'Explicit locking therefore requires a specified lock mode, acquisition order and read/check protocol. Locking relevant rows can cause waiting; inconsistent acquisition order or lock upgrades can cause deadlocks. '
    + 'In Repeatable Read or Serializable, attempting to lock a row changed since the snapshot can raise an error.' }
];
const doctorScenario = { initial: { A: true, B: true }, invariant: { cells: ['A', 'B'], at_least: 1 }, transactions: [
  { id: 'T1', guard: { cells: ['B'], at_least: 1 }, writes: { A: false } },
  { id: 'T2', guard: { cells: ['A'], at_least: 1 }, writes: { B: false } }] };
const normalScenario = { initial: { A: true, B: true }, invariant: { cells: ['A', 'B'], at_least: 0 }, transactions: [
  { id: 'T1', guard: { cells: ['A'], at_least: 1 }, writes: { A: false } },
  { id: 'T2', guard: { cells: ['B'], at_least: 1 }, writes: { B: false } }] };
const unseenScenario = { initial: { A: true, B: true, C: true }, invariant: { cells: ['A', 'B', 'C'], at_least: 2 }, transactions: [
  { id: 'T1', guard: { cells: ['A', 'B', 'C'], at_least: 3 }, writes: { A: false } },
  { id: 'T2', guard: { cells: ['A', 'B', 'C'], at_least: 3 }, writes: { B: false } }] };
function makeSpec(caseValue, host, repetition) {
  const c = checkedData(caseValue); exact(c, ['id', 'prompt', 'hard', 'quality']);
  if (!['known', 'normal', 'unseen'].includes(c.id) || ![1, 2].includes(repetition)) throw new Error('quality_case');
  const normal = c.id === 'normal', scenario = normal ? normalScenario : c.id === 'known' ? doctorScenario : unseenScenario;
  const computed = analyzeScenario(scenario);
  const facts = { scenario, scope: computed.scope, potential_read_write_edges: computed.potential_read_write_edges,
    potential_write_write_edges: computed.potential_write_write_edges,
    concurrent_start_schedules: computed.concurrent_start_schedules, serial_schedules: computed.serial_schedules,
    real_database_verified: false, all_possible_interleavings_checked: false };
  const obligations = normal ? [
    ['O1', 'State the actual read/write and write/write relationships.'],
    ['O2', 'Explain the concurrent result against the stated unconditional invariant.'],
    ['O3', 'Explain whether this invariant needs serial coordination, with the finite-model scope.']
  ] : [
    ['O1', 'Explain the original snapshots and concrete interleaving.'],
    ['O2', 'Explain the write targets and cross-row invariant outcome.'],
    ['O3', 'Provide a valid mitigation with its conditions.'],
    ['O4', 'Scope all claims about conflict detection, implementations and locking precisely.'],
    ['O5', 'State mitigation concurrency or retry costs without unsupported cost exclusions.']
  ];
  const question = (id, kind, targets, sources, covers) => ({ id, kind, target_ids: targets, condition_ids: ['C1'], source_ids: sources, covers });
  const questions = normal ? [
    question('Q1', 'relationship', ['T1', 'T2'], ['S1'], ['O1']),
    question('Q2', 'mechanism', ['T1', 'T2'], ['S1'], ['O2']),
    question('Q3', 'mitigation', ['T1', 'T2'], ['S1'], ['O3'])
  ] : [
    question('Q1', 'relationship', ['T1', 'T2'], ['S1', 'S2'], ['O1', 'O2', 'O4']),
    question('Q2', 'mechanism', ['SI'], ['S1', 'S2'], ['O4']),
    question('Q3', 'implementation', ['SSI'], ['S2', 'S3'], ['O3', 'O4']),
    question('Q4', 'cost', ['SSI'], ['S2', 'S3'], ['O5']),
    question('Q5', 'mitigation', ['T1', 'T2'], ['S1', 'S2', 'S4'], ['O3', 'O5']),
    question('Q6', 'implementation', ['Locks'], ['S4'], ['O3', 'O4'])
  ];
  return validateSpec({ schema_version: 1, run_id: 'Quality101-' + c.id + '-' + host + '-' + repetition,
    turn_id: 'Turn1', host, task: c.prompt, reader: 'A senior database engineer', language: 'en',
    obligations: obligations.map(([id, text]) => ({ id, text })), questions,
    bundle: { targets: [{ id: 'T1', text: 'Transaction T1 in the supplied finite scenario' },
      { id: 'T2', text: 'Transaction T2 in the supplied finite scenario' },
      ...(!normal ? [{ id: 'SI', text: 'Snapshot isolation and PostgreSQL 18 Repeatable Read' },
        { id: 'SSI', text: 'PostgreSQL 18 Serializable Snapshot Isolation' },
        { id: 'Locks', text: 'PostgreSQL 18 explicit row locking' }] : [])],
      conditions: [{ id: 'C1', text: 'The finite scenario uses concurrent-start snapshots and separately lists serial whole-transaction schedules. '
        + 'Real implementation claims, if made, refer to PostgreSQL 18. Do not equate model execution with a real database observation.' }],
      sources: [source('S1', 'finite-boolean-model-v1', JSON.stringify(facts)),
        ...(!normal ? references.map(r => source(r.id, r.version, r.text)) : [])] },
    criteria: [...c.hard.map((text, i) => ({ id: 'H' + (i + 1), text })), ...c.quality.map((text, i) => ({ id: 'Q' + (i + 1), text }))] });
}
function createQualityPlan(caseValues, timeBudgets) {
  const cases = checkedData(caseValues);
  if (!Array.isArray(cases) || cases.length !== 3 || cases.map(c => c.id).join(',') !== 'known,normal,unseen') throw new Error('quality_case_order');
  const rows = [];
  for (const repetition of [1, 2]) for (const c of cases) for (const host of ['claude', 'codex']) {
    const spec = makeSpec(c, host, repetition), budget = budgetFor(spec, timeBudgets?.[host]);
    rows.push({ ordinal: rows.length + 1, case_id: c.id, repetition, host, status: 'UNRUN', spec, spec_sha256: digest(spec), budget });
  }
  const totals = Object.fromEntries(['top_level_cli_starts', 'child_contexts', 'parent_only_starts', 'child_coordinator_starts',
    'worst_process_ms', 'worst_supervised_ms'].map(k => [k, rows.reduce((sum, row) => sum + row.budget[k], 0)]));
  return { schema_version: 1, candidate: 'independent-explanation-101', product_status: 'rc.13 / No-Go',
    rows, totals, references, max_observed_input_tokens_per_row: 400000, max_observed_output_tokens_per_row: 40000,
    observed_usage_limits_are_post_call_stops: true, token_hard_cap_verified: false,
    stop_after_first_execution_delivery_or_quality_failure: true, require_root_review_before_next_row: true,
    automatic_retries: 0, concurrency: 1, authority_granted: false, native_starts: 0,
    original_192_subjects_516_requests_run: false, independent_blind_holdout: false,
    normal_plugin_path_verified: false };
}
module.exports = { createQualityPlan, makeSpec };
