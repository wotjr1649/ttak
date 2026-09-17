# Finite guarded-write scenarios

## Original-source integration

`scripts/explanation-source-model.cjs` locates complete JSON documents starting on their
own line in an explanation request, including complete JSON strings inside those documents.
For exact supported Boolean definitions it records the original UTF-16 range, document and
model digests, and a path whose `{ "decode": "json" }` steps denote explicit string decoding.
It recomputes the existing renderer from that definition; supplied result tables are not inputs
to the computation. Quoted definitions remain data, not instructions or proof of real-world fit.

The normal request-wide preparation carries this `model_evidence` to the parent and independent
factual verifier. The exact-final preparation recomputes it and applies existing partial prose
checks to the actual final text. The final verifier receives those scoped findings too. Bound
models are stored using the existing ordinal-name representation; supported contradictions
cannot be overridden at Stop by an independent `complete` assertion. No clean partial report
certifies the whole explanation or replaces independent final review.

The decoder has a 32 KB original-input bound, depth 16, 4,096 visited values, eight nested JSON
string decodes, four models and 16 KB of additional computed evidence. It rejects duplicate
keys, executable objects, unsafe data, malformed supported models and exceeded bounds.
Unsupported prose and encodings remain for independent assessment. This path performs no
I/O, model calls or database execution. Native semantic qualification is recorded separately.

## Model

`scripts/finite-scenario.cjs` computes dependencies and outcomes for a deliberately bounded
state model. It accepts 1–16 boolean cells, an at-least-count invariant and 1–4 transactions.
Each transaction reads the cells listed in its guard and, when the guard holds, atomically
assigns its declared constant writes. Strings are identifiers, never executable code.

`analyzeScenario(input)` reports potential read/write overlaps separately from potential
overlapping writes. These are declared relationships; a guard-false or aborted transaction
does not perform its declared writes. Schedule steps record the actual modeled outcomes.
It enumerates commit orders for a concurrent-start case where every snapshot precedes every
commit, with first-committer-wins on overlapping writes. It separately enumerates serial orders
where each transaction acquires its snapshot and completes before the next begins. Each step
records observations, outcome, state and invariant status.

The model is useful for constructing and checking a concrete counterexample. It does not cover
every possible interleaving, real database implementation, SQL syntax, row locking or arbitrary
transaction program. The output retains `real_database_verified: false` and
`all_possible_interleavings_checked: false`. Serial execution is reported as preserving the
invariant only when every enumerated serial order does so; unsafe transaction logic can still fail.

Seven tests cover cross-row dependencies and a write-skew witness, serial guard changes,
overlapping-write aborts, unsafe logic under serialization, all six orders of a three-party
example, guard-false potential overlaps, input immutability, malformed references and size bounds. No dependencies, processes,
network calls or database services are needed by the module.

Local artifact `.superpowers/finite-scenario-62b/` records a two-cell example, its computed
result and code/test hashes. The example has two read/write dependencies, no overlapping writes,
a concurrent invariant violation and invariant-preserving serial orders.
The initial artifact and source under `finite-scenario-62` are retained; revision 62b clarifies
that graph edges are potential overlaps rather than assertions of committed actions.

Diagnostic 63 supplied operator-authored scenario facts to Haiku. It correctly described the
cross-row reads but falsely claimed exhaustive interleaving coverage and described a false guard
as a transaction abort. The output therefore failed; supplying correct facts did not establish
correct final explanation. The native model did not construct the scenario or invoke a tool.

`finite-scenario-render.cjs` now renders the calculation directly in English or Korean, including
guard outcomes, coordination boundaries and explicit coverage limits. `finite-scenario-mcp.cjs`
exposes this through the read-only `scenario_explain` stdio tool, with at most three calls per
connection. Input is limited to the finite schema; there is no filesystem, network, database,
credential or model API access in the tool. Invalid input produces fixed error text. It reuses
the existing bounded UTF-8 transport through an optional dispatcher argument to `serve`.

The finite engine, renderer/server and existing review MCP tests passed together: 20 tests,
zero failures or skips. These include real stdio round trips and malformed/oversized frames.
This is local implementation evidence, not native model quality evidence. The modules remain
experimental and disconnected from the installed plugin. Subsequent user-run diagnostic 64
confirmed one faithful Haiku-authored scenario and exact structured tool output. Its final answer
paraphrased the output, failing the predeclared verbatim requirement. Manual review found the
original task's content criteria met in this one answer; repetition and comparisons remain unrun.
See [the diagnostic and audit correction](FINITE_SCENARIO_NATIVE_PLAN.ko.md).

`finite-scenario-audit.cjs` now provides the pure `inspectScenarioDelivery(input, content,
finalAnswer)` comparison for subsequent diagnostics. It accepts plain text or the observed
JSON-encoded structured result, including either form inside a single MCP text block. Structured
results must match the complete recomputed payload, including facts; arbitrary nested payloads,
extra text blocks and oversized responses are rejected. It reports verbatim inclusion separately
and always leaves semantic quality unverified. Even a verbatim block can have false prose added
around it. Five new tests and the twenty related tests passed together.

Offline replay 65 applies the corrected implementation to diagnostic 64's preserved tool input,
response and final answer. It confirms a matching structured result and non-verbatim final answer
without a model call or changing the original diagnostic outcome. The bound artifact is
`.superpowers/scenario-native-64/delivery-audit-65.json`.

Revision 67 adds the concrete participant-by-participant snapshot/guard/write/completion order
beside the mitigation, together with the already-computed counterexample for snapshots acquired
before ordered commits. Calculations and facts are unchanged. Twenty-six related tests passed;
native quality effects are untested. Previous renderer/engine bytes are preserved under
`.superpowers/mitigation-boundary-67/` for historical replay. Do not re-audit earlier native
results against the revised renderer. See [revision 67 and proposed diagnostic 68](MITIGATION_BOUNDARY_67.ko.md).
