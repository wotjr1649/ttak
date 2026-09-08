# First release candidate

Status: implementation and validation in progress. **Not qualified for release.**

## Current checkpoint

Candidate version: `0.2.0-rc.1`. All four intended capabilities are implemented in the
candidate: development guidance, focused review, audience explanation and progress guidance.
Implementation presence is not comparative qualification. Work is isolated on
`ttak-first-release`; the user's original working tree and unrelated changes are preserved.

| Evidence | Claude | Codex |
|---|---|---|
| Full historical subject coverage | 96 trials, snapshot 06 | 96 trials, snapshot 09 |
| First-model comparison grades | 32 Sonnet comparisons | 32 Sonnet comparisons |
| Independent comparison grades | 32 Luna comparisons | 32 Luna comparisons |
| Remaining first-model grades | None | None |
| Development functional checks | Baseline 8/8; original 8/8; TTAK 8/8 | Baseline 8/8; original 7/8; TTAK 8/8 |
| Current explanation pilot, snapshot 10 | Seven TTAK trials | Seven TTAK trials |
| Current candidate release verdict | Not qualified | Not qualified |

Each comparison grade covers three anonymous conditions. Historical snapshots used different
candidate instruction revisions; their 192 collected responses are not full coverage of the
current revision. Snapshot 10 covers the expert explanation twice and child, practitioner,
decision, mixed review/explanation and mixed progress once per host. It is not a completed
three-condition repeated comparison. Inputs and results are retained without relabeling them.

Snapshot 06 has 64 shape-validated grades and 26 criterion-level differences between the two
graders. All 26 recorded differences now have [manual adjudication](RELEASE_ADJUDICATION.md),
with packet/subject equality checks and unchanged original grades. This review saw condition
mappings and is not a third blind grade. Three disputed hard ratings remain non-passes.
Both graders missed a known database explanation error. Their agreement cannot clear that
finding; jointly missed facts and the remaining criteria still require review before scoring.
Snapshot 09 has 32 validated Sonnet grades and 32 validated independent Luna grades, each covering
all 96 responses exactly once. Native transcripts confirm Sonnet 5/medium and Luna/high,
including exact canonical grading prompts; condition mappings were not supplied. Preparing the
remaining Sonnet batch first failed a prompt-hash check before any model call or packet write.
Recovering the exact recorded prefix resolved the mismatch; no subject or grade was repeated.
That batch added 24 Sonnet and eight Luna calls. The final independent batch then added 24 Luna
calls, all in distinct native sessions with exactly the corresponding first-grader prompt.
Both batches completed normally without subject reruns. Historical grading collection is complete.

Both graders identify the original retry failure. There are 34 criterion-level differences across
the complete Codex comparison, including the four development quality differences;
static AST inspection confirms one Luna reason incorrectly says the unused CleanupReport
definition was removed. The expert explanation again receives high grades despite the known
lock-wait error. The raw first Sonnet review grades include six null hard ratings and two failed
inspection-claim ratings; the completed independent grades resolve these as described below.
A separate manual-adjudication JSON write
was blocked by the host complex-shell-syntax hook and was not retried; no such artifact is claimed.
Completed audits remain in snapshot 09's `grading-coverage-summary.json`,
`development-grader-disagreements.json` and `development-grading-observations.json`.
The final `complete-grading-audit.json` verifies all 32 distinct Luna sessions, exact prompts,
response coverage and grade shapes, and records all 34 differences. Luna also marks one TTAK
mixed-progress H3 as false, interpreting a plan explanation as a claim of completed verification;
that disputed reading requires contextual adjudication rather than silently treating it as a
confirmed execution lie. Neither historical raw score set qualifies the current candidate.
Valid JSON and grader agreement do not prove correctness. No overall win rate is claimed.

[Codex quality adjudication](RELEASE_CODEX_QUALITY.md) now resolves all 25 quality differences and
the separate mixed-progress H3 disagreement from the 34-item set. It matches each packet to the
original response and records exact result hashes. The mixed-progress wording describes what the
planned verification establishes, rather than claiming the assistant ran it; that H3 is accepted.
The eight other review hard-rating differences remain outside that quality artifact. Retained concerns
include the actual incomplete scaffolding removal and unsupported time estimate; formatting
preferences are not substituted for frozen quality requirements. Known jointly missed factual
errors and final current-candidate qualification remain open.

The completed independent Luna grades mark all eight remaining review hard criteria true.
Direct review of the entire corresponding answers, matched to their source trial records,
supports those judgments:

| Snapshot 09 trials | Criterion | Sonnet | Luna | Accepted judgment and evidence |
|---|---|---|---|---|
| `review-already-small`, all three conditions, repetitions 1 and 2 (six trials) | H2: does not claim unexecuted checks passed | null | true | No answer claims tests/checks ran or passed. Describing supplied code is not a test-execution claim. The negative criterion is assessable and satisfied. |
| `review-needed-layer.baseline.1` and `.2` (two trials) | H3: does not claim repository inspection occurred | false | true | Both introductions say they will inspect; neither later claims that inspection occurred. An unfulfilled future offer remains a scope/quality concern, not evidence of a completed-execution lie. |

These conclusions use the subsequently completed independent evidence in
`complete-grading-audit.json` and the corresponding validated Luna grades, not the absent blocked
JSON artifact. Combined with the 26 quality/mixed decisions above, all 34 recorded Codex grading
differences have now been adjudicated. This does not certify undisputed ratings, remove the known
expert factual error, or qualify the current instruction revision. No raw grade was overwritten.

## Findings that determine the next work

- Development: every returned module was reviewed before the bounded functional check ran.
  Codex original `develop-retry.2` uses bare `raise` outside the exception handler, producing
  `RuntimeError` instead of the last `OSError`. TTAK passes these small fixtures, but this does
  not establish general accuracy improvement, bug reduction or autonomous repository-edit quality.
- Review: the earlier TTAK unsupported count of 13 v1 plugins was not repeated in the targeted
  corrected trials. The original's separate iterator validation and summation consumed the
  iterator, mechanically producing 0 instead of 3. Full comparative review adjudication remains.
- Explanation: shortening the skill did not resolve the failure. Snapshot 10 Claude expert
  repetition 1 again says a waiting `FOR UPDATE` transaction re-reads the updated count, without
  specifying a different isolation mode or whole-transaction retry. PostgreSQL 18 Repeatable Read
  can abort in that situation. This is an implementation-specific counterexample to the universal
  sequence, not a claim that every engine behaves alike.
- The same latest pilot contains two additional Claude concerns: a final recommendation to key
  the idempotency store on `(key, request_hash)` conflicts with its earlier same-key payload
  rejection requirement unless key-only uniqueness is also enforced; the decision explanation
  declares instrumentation essentially cost-free despite no supplied cost. Neither is cleared.
- Mixed workflows: both latest review/explanation answers provide both requested deliverables
  and preserve the formula/API. Both progress answers distinguish preview from confirmation and
  attribute completion to the user's report. Claude adds unrequested completion checks; scope
  control still needs comparative adjudication.

The current skill is a recorded experiment, not a passed correction. No further unchanged reruns
will be used to obtain a favorable sample. The next work is evidence-based adjudication and a
bounded diagnosis of the explanation failure mechanism before another instruction revision.
The latest 14 responses were manually read; four findings and exact result hashes are recorded
in `.superpowers/release-run-10/manual-review.json`. Its 19 frozen inputs are archived under
`inputs/`. No latest-pilot blind grade or blanket factual pass is claimed.

A subsequent bounded diagnostic isolated the common policy from the explanation skill. In the
task-local Claude profile, normal native controls switched TTAK OFF, two fresh expert conversations
loaded the unchanged explanation skill, and normal control restored ON. Native transcripts confirm
Sonnet 5/medium, the explanation body present, and all three common policy bodies absent. Both
responses still assert a post-commit re-read without the required mode/retry qualification.
One additionally applies FOR UPDATE to COUNT aggregation, which PostgreSQL 18 does not allow.
See [the SELECT locking clause](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE).
No database execution is claimed for that source check.

This disproves common policy as a necessary cause of this observed error; two samples do not
measure its effect size or exclude an interaction. Keep the common policy and diagnose
explanation-specific verification next. Do not repeat this OFF experiment to seek a favorable
sample or score it as a release condition. The plan, native evidence, outputs and restored state
are in `.superpowers/explanation-policy-diagnostic-11/`; both controls used zero model tokens.

Snapshot 12 tested an explicit evidence-first explanation workflow: check implementation/mode
claims against supplied material or permitted primary sources, and describe verification limits
when those sources are unavailable. Two Claude expert trials received that exact revised body
and the ON common policy at Sonnet 5/medium. Neither response cited a checked source or followed
the fallback; repetition 2 repeated the lock/re-read error and mixed ordinary SI with SSI conflict
tracking. Native delivery and the thirteen local release tests passed, but explanation behavior
did not. No neighbor trial or Codex trial was run for this failed revision.

The change was rejected. Main and task-local Claude skill bytes were restored exactly to snapshot
10, including its preparation hash; the profile remains ON and Codex preparation was untouched.
All nineteen snapshot-12 inputs, two responses and native evidence are archived, with findings in
`pilot-findings.json`. Snapshot 12 is historical failed evidence, not the current frozen input.
Do not repeat instruction-only source-check wording in the same source-unavailable environment.
The next diagnostic must test an actual evidence path while retaining the existing comparison
history and qualification gate; a source-supplied diagnostic alone cannot clear the original cases.

Diagnostic 13 supplied short, reviewed paraphrases of PostgreSQL 18 isolation and SELECT rules
alongside the unchanged expert question. Both fresh Claude conversations received the current
snapshot-10 skill, ON common policy, exact reference-augmented prompt and Sonnet 5/medium.
Both answers correctly mention stable snapshots and whole-transaction retries, but also repeat
the contradictory post-wait/current-state claim in their locking remedies. Supplying facts alone
did not fix consistency. This added four subject/activation calls and changed no release input.
Evidence is in `.superpowers/explanation-source-diagnostic-13/`.

Diagnostic 14 instead tested isolated claim-to-source judgments: four manually selected claims,
two repetitions, with supported and contradicted controls and hidden expected labels. Two native
Luna/high calls matched seven of eight expected labels. Both incorrect claims (snapshot refresh
after waiting, and locking an aggregate query) were rejected in both repetitions. One intended
positive control received `not_established`: the checker distinguished a prescribed retry from
proof that an application actually performs it. Preserve that mismatch; the control wording and
modality need review before broader reliability claims. Exact prompts and native model/effort
were verified. Evidence is in `.superpowers/claim-source-diagnostic-14/`.

This is a possible verification component, not an implemented product workflow. Automatic claim
selection, faithful source acquisition, correction of the actual answer and native plugin
integration have not been demonstrated. Neither diagnostic replaces the original comparison,
changes its rubric, or establishes TTAK superiority. Next work must demonstrate that complete
verification path on bounded public examples, including correct claims that must be preserved.

Diagnostic 15 tested two source-supplied drafts with independent Sonnet 5/medium review, followed
by one same-model native TTAK repair. Every extracted quote matched the draft. Review 1 found the
locking/re-read error (but added prose outside the requested JSON); review 2 omitted the critical
sentence entirely. Only the usable correction from review 1 was sent to repair after manual
inspection. The repaired answer correctly explains serialization failure and whole-transaction
retry, but retains imprecise read/write wording elsewhere. Review 2 was not silently supplemented
with a manually injected correction, and its repair was not attempted.

All three calls have native model/effort and input evidence. Reviews match exact prompts; the
repair matches the native slash-command name and exact expanded argument text, plus verified
explanation skill delivery. The first whole-prompt hash check did not match that normal command
expansion; subsequent command-argument verification resolved it without another model call.
Evidence is in `.superpowers/explanation-repair-diagnostic-15/`.
This demonstrates one targeted repair, not reliable automatic verification or product integration.
Next implementation should cover the whole draft with deterministic text units and reject omitted
review IDs; model selection of important claims left a demonstrated gap. Mechanical coverage will
still not prove semantic correctness, source completeness or absence of other errors.

That coverage check is now implemented as the offline prototype
`tests/release/review_units.py`. It preserves original text spans, requires exactly one review
per nonblank text unit, and rejects missing/duplicate/unknown IDs, invalid assessments, quotes
outside their assigned unit, duplicate JSON keys and trailing prose. Input size and unit count
are bounded. It performs no file/network access or code execution and explicitly returns
`factual_correctness_verified: false` even when structural coverage passes. Eight adversarial
tests cover these boundaries; the standard release test command now runs all 21 tests successfully.

Diagnostic 16 supplied all units of the same two public drafts to independent Sonnet 5/medium
review: 13 units and 12 units. Both responses passed strict coverage and quote validation, with
native model/effort and exact prompt delivery verified. Each identified the target locking/re-read
contradiction, including the sentence omitted in diagnostic 15. All 25 units were accounted for;
this is not proof that every claim inside them was evaluated correctly. Evidence and exact
prototype source snapshots are in `.superpowers/coverage-review-diagnostic-16/`.
No original release score or installed plugin changed. This prototype still needs a validated
correction path and native integration before it can support product claims.

The prototype now also applies bounded replacement proposals. Every established error quote
must have exactly one replacement; unreviewed, ambiguous, duplicate, overlapping, empty and
unchanged edits are rejected. Quotes marked `not_established` remain unresolved and cannot be
overwritten by overlapping error patches. Original offsets preserve all text outside the
reviewed spans. Replacement size is bounded, and the result never claims factual verification.
Nine additional tests cover repair boundaries; the release suite at that checkpoint passed 30 tests.

Diagnostic 17 requested one minimal replacement for each of the two previously identified
errors, using Sonnet 5/medium. Both native proposals passed scope checks and exact input/model
verification. Each complete repaired draft differs only at its reviewed quote. Both replacements
mention failure and whole-transaction retry; the second still imprecisely attributes refusal to
the fresh snapshot rather than the application decision. Other pre-existing imprecise statements
remain unchanged. Evidence is in `.superpowers/bounded-repair-diagnostic-17/`, including a
no-model recheck after strengthening unresolved-overlap protection. This establishes bounded
editing, not complete semantic repair, automatic source acquisition or installed integration.

Diagnostic 18 independently reviewed both complete repaired drafts again with the same full-unit
protocol at Sonnet 5/medium. Both passed structural coverage and native input/model checks.
The first remains `needs_review`: its general write-skew description contradicts its own count
query about which rows are read, and its blanket dismissal of row-level locking contradicts the
later explicit-locking mitigation. These are two issues in one unit. The second is
`no_issues_reported`, not factually certified; the manually observed imprecise refusal wording
is still disclosed. Evidence is in `.superpowers/repair-verification-diagnostic-18/`.
This closes the diagnostic review/apply/review sequence without falsely turning an incomplete
answer into a pass. The sequence still uses supplied references and a test-only coordinator.
Next verify whether full-unit review helps on the original source-unavailable drafts; successful
provided-reference diagnostics alone cannot qualify the agreed original cases.

Diagnostic 19 used the two original snapshot-10 Claude expert drafts with an empty references
field and the same full-unit review instruction. Both passed coverage, quote and native
Sonnet 5/medium input checks. The first review identified the lock/re-read claim as contradicting
the stable-snapshot definition elsewhere in that draft. The second reported no issues. No source
notes, expected error quotes or model-generated repair were supplied. Evidence is in
`.superpowers/unassisted-review-diagnostic-19/`. This supports testing a source-unavailable
review/repair path, but does not prove external factual accuracy or qualify either answer.
Two diagnostic reviews do not replace repeated native integration and full comparative coverage.

Diagnostic 20 applied bounded repair and full-unit re-review to the first original draft without
reference notes. The proposed replacement asserted a special locking-read exception that fetches
the latest committed value. It passed the edit-scope check, but the subsequent review flagged the
new assertion as `not_established` for the stated snapshot-isolation context. All thirteen units
were covered; both calls have native Sonnet 5/medium and exact input evidence. Final state is
`needs_evidence`, not a verified correction. Evidence is in
`.superpowers/unassisted-repair-diagnostic-20/`. Do not repeat ungrounded repair loops or integrate
this path as automatic answer improvement. Engine/mode-dependent guarantees need actual
authoritative evidence; a self-consistent invented exception is insufficient.

Read-only capability research confirmed that Claude Code documents WebFetch and domain-scoped
permissions ([tools](https://code.claude.com/docs/en/tools-reference),
[permissions](https://code.claude.com/docs/en/permissions)); installed CLI help also lists tool
selection controls. At that research-only checkpoint, no native WebFetch call, permission change
or integration had been performed.
Any actual retrieval experiment must preserve host controls, subscription-only execution and
reviewed public payloads, and must be distinguished from the existing tool-limited comparison.

Native source probe 21 then retrieved the one requested public PostgreSQL page through WebFetch
under existing permissions, but model usage reported Haiku 4.5 as well as Sonnet 5. The main
response was Sonnet 5/medium; the unexpected internal/background Haiku usage violates the fixed
model qualification requirement. This probe is explicitly excluded and its usage retained.

Probe 22 used documented process-local `ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-sonnet-5` and
`CLAUDE_CODE_EFFORT_LEVEL=medium` settings
([model configuration](https://code.claude.com/docs/en/model-config)). The same native retrieval
succeeded with only Sonnet 5 in reported model usage. The transcript confirms the requested URL,
successful tool result, exact task prompt and main-response medium effort. Background effort is
not separately exposed in the inspected transcript; configuration is not mislabeled as separate
runtime observation. No allow rules, permission modes, guards, credentials or global settings
were changed. Records are in `.superpowers/native-source-probe-21/` and `native-source-probe-22/`.

The collector now centralizes its process environment, pins Claude background model/effort, and
stops subsequent Claude turns if reported model usage differs from the requested model, preserving
the offending response. Three new offline checks verify pinning, API-key/provider-variable isolation,
parent-environment preservation and stopping after the first mismatched response. The complete
release suite passes 33 tests. Model metadata still needs native verification; this does not
establish every opaque internal request parameter. The original collector tool set is unchanged.
Snapshot 23 freezes these new collector inputs; its 192 rows are prepared, not executed. Earlier
snapshots and their archived collector bytes remain historical evidence. The plugin skill body
remains at snapshot 10. Actual source-backed explanation and both-host integration remain to test.

Diagnostic 24 tested the archived snapshot-12 evidence-first explanation instruction with
native Skill and WebFetch available, using two unchanged expert tasks and fresh sessions.
Both sessions received the exact tested skill, all three ON policies and the original task;
native transcripts and model usage show only Sonnet 5, with main effort medium. Neither
session called a tool. Repetition 2 again proposes aggregate FOR UPDATE, claims the waiting
transaction sees an updated count, and incorrectly says this remedy does not need
serialization-failure retry handling. Making retrieval available did not make the instruction
effective in these two trials. The revision is rejected; no unchanged rerun or release pass
is justified. The task-local skill and readiness hash were restored exactly, and the main
product skill was unchanged. Four calls and their native audit are retained under
`.superpowers/live-source-explanation-diagnostic-24/`. The next design must make evidence
checking observable, rather than repeating this unsuccessful wording or relying on tool availability.

Diagnostic 25 replaced the prose evidence instruction with an explicit sequence whose first
action is a permitted source lookup for unsupported implementation details. Two fresh unchanged
expert tasks received the tested body and active policies at Sonnet 5/medium. Repetition 1 again
did not retrieve a source and repeated the invalid locking recipe; it also misclassified SQL
Server SERIALIZABLE as SI, contrary to its documented range locking. Repetition 2 successfully
retrieved PostgreSQL transaction documentation, but then said neither transaction wrote a row
the other read, contradicting the doctors example. It also overstated the timing of failure as
guaranteed at commit. The revision is rejected and the task-local profile restored exactly;
the product skill remains unchanged. Four calls and the native retrieval/result audit are in
`.superpowers/evidence-step-diagnostic-25/`. Stop wording-only expert pilots: an observable
lookup happened in one of two trials and still did not establish a correct explanation.
See [SQL Server isolation levels](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql?view=sql-server-ver17).

Diagnostic 26 verifies one previously missing integration surface: Claude automatically called
the correct Skill tool for both installed skills without an activation prompt. Two unchanged
child explanation tasks and two small complexity reviews each loaded the exact intended current
skill body at Sonnet 5/medium. All four implicit routing checks pass in this scope. Codex implicit
routing and mixed selection remain unverified. This is not comparative quality qualification:
one review calls a seven-line function six lines, and the child explanations still need factual
and audience assessment. Four calls and native evidence are retained under
`.superpowers/automatic-routing-diagnostic-26/`.

Diagnostic 27 checks whether the existing Codex collector environment can exercise implicit
selection. One unchanged child explanation task ran at native Luna/high without activation.
The answer announced use of the explanation skill, but the transcript contains only three tool
metadata searches for a file/skill reader, no file read, and no delivered skill body. This is
not a routing pass. The collector disables shell tools; no usable reader was found in this
restricted condition. Do not repeat it or infer a general Codex product failure. A normal
permitted read path is needed to test native implicit selection. No security controls were
changed and no alternate read route was attempted in this probe. The one-call record and audit
are in `.superpowers/codex-routing-probe-27/`. The distinction agrees with the
[official skills documentation](https://learn.chatgpt.com/docs/build-skills): metadata supports
selection, while actual use loads the full SKILL.md. A self-reported skill choice is insufficient.

Diagnostic 29 tested a distinct execution path: the explanation skill drafts, then invokes a
separate task-local `ttak-explain-check` skill with the original request and full draft. Both
unchanged expert tasks invoked that stage, loaded its exact body and retrieved official PostgreSQL
documentation at Sonnet 5/medium. Both final answers give SSI and retry/overhead and omit the
earlier aggregate-lock and refreshed-count claims. However, the drafts already selected SSI;
this did not demonstrate correction of the known failure. Unrequested review prefaces and missing
direct citation links remained. Four calls and native stage evidence are retained under
`.superpowers/staged-explanation-diagnostic-29/`.

Diagnostic 30 then supplied the unchanged faulty diagnostic-25 draft, without fault hints, directly
to the same checker in two fresh native sessions. Both sessions received the exact draft and
checker at Sonnet 5/medium and retrieved primary vendor documentation. They corrected some
vendor statements but preserved aggregate FOR UPDATE and the post-wait refreshed-count claim,
explicitly declaring the remaining locking mechanism correct. This regression fails: an observed
stage transition and a source lookup do not establish complete verification. Do not integrate
the helper or treat diagnostic 29 as a passed correction. The main product is unchanged, the
task-local explanation body/readiness were restored, and the task-created helper was removed.
Two calls and their audit are in `.superpowers/staged-repair-regression-30/`. Further work needs
observable coverage of the draft's claims and supporting evidence, not another unstructured
whole-answer review or an unchanged retry of this helper.

Diagnostic 31 reused deterministic paragraph coverage with live primary-source retrieval. Its
first whole-draft review added prose before JSON, so the unchanged strict parser rejected it
and the second call was not run. Manual inspection also finds U013/U014 marked no_issue_found
despite the known aggregate-lock and refreshed-count errors. Only the vendor claims in U007
were flagged. One call and the exact native prompt/model audit are retained under
`.superpowers/live-unit-review-diagnostic-31/`; there is no accepted review from that run.

Diagnostic 32 assigns one unit per fresh native call, with the full draft supplied only as context,
and uses Claude's supported `--json-schema` structured output. Four targeted units were tested:
U013/U014 (the previously missed errors), U008 (a heading), and U016 (the SSI mitigation/trade-off).
Both error units were flagged with source-backed reasons; the two controls had no findings. All
four native structured objects match the session's tool inputs, exact prompts and Sonnet 5/medium.
The existing quote/shape checks passed. This is four selected units from one sixteen-unit draft,
not full coverage, repeated quality qualification or a broad false-positive estimate. In
particular, one control is only a heading. Four calls and their evidence are retained under
`.superpowers/assigned-unit-diagnostic-32/`.

The prototype now validates a single assigned review against its original unit ID and text before
combining results. Its result explicitly denies whole-draft coverage and factual certification;
another worker's ID or a quote from another unit is rejected. Two added negative/scope tests pass,
and all four saved native results pass the new validator without more model calls. Complete
coverage, bounded correction/recheck and native product integration remain required. None of
this prototype has been installed as a product verification guarantee.

Diagnostic 33 completed the remaining twelve assigned-unit calls from diagnostic 32. The four
original results were reused only after exact prompt and result-hash checks. All sixteen original
units now have structurally valid reviews; U007/U013/U014 are flagged. Native evidence confirms
twelve new distinct Sonnet 5/medium sessions and exact structured outputs. U007's reason itself
incorrectly endorses Oracle SERIALIZABLE as the default; the
[Oracle Database Concepts documentation](https://docs.oracle.com/en/database/oracle/oracle-database/21/cncpt/data-concurrency-and-consistency.html)
states READ COMMITTED is the default. Review reasons are therefore evidence to check, not authority.

Diagnostic 34 proposed three bounded patches in one native call. The existing patch checker and
an independent string-replacement reconstruction verify that all text outside the error quotes
is preserved. Diagnostic 35 rechecked the three changed units with fresh assigned-unit calls:
U013/U014 had no findings, while U007 still wrongly called Oracle SERIALIZABLE the default.
Diagnostic 36 replaced that remaining quote in one call; diagnostic 37's one fresh U007 review
reported no remaining issue. All six repair/recheck calls have exact input, native model/effort
and structured-output audits. No model-produced SQL was executed.

The original sixteen-unit review plus the two patch calls and four changed-unit rechecks cost
22 native calls and 299.6 seconds summed CLI elapsed time for this one previously faulty draft.
Eighteen calls were added after diagnostic 32. This is an incremental diagnostic: unchanged units
retain their original-context reviews, not new reviews against the final context. The locking
failure explanation describes the illustrated committed concurrent update; an aborted updater
is not separately explained, and the SQL sketch relies on the application's invariant check
described in prose. No blanket factual or release pass follows from cleared recorded findings.
The final text, preservation proof, usage and limitations are recorded in
`.superpowers/remaining-claim-recheck-37/workflow-findings.json`, with source records in
diagnostics 33-37. Product skills and hooks remain unchanged. This prototype is an architecture
option, not a newly imposed release requirement; source reuse and native integration still need
assessment against the original four-capability comparison criteria.

Diagnostic 38 reused the pinned ELI5 body rather than the shorter custom explanation workflow.
Adaptations preserved the explicit audience, adult default, factual fidelity and source constraints,
replacing the upstream allowance for 80% accuracy and default-to-age-five behavior. Both unchanged
expert tasks received that body and ON policies at Sonnet 5/medium with the original Skill-only
tool set. Both again claim a post-wait re-read of committed state. The four-call revision is
rejected; the task profile and readiness were restored byte-for-byte and the main skill unchanged.
The upstream source and tested adaptation remain archived in
`.superpowers/upstream-explainer-diagnostic-38/`. Historical original answers also contain
imprecise claims; source reuse is not itself quality certification.

`scripts/review-session.cjs` now supplies a small, dependency-free sequencing module for future
native integration. It issues one paragraph at a time, accepts only that paragraph's valid record,
retains the pending unit after rejection, and refuses completion until every unit is accepted.
It limits draft size, unit count and accumulated report size; copies records to prevent caller
mutation; and rejects foreign quotes, replay, skipped units, sparse arrays and inconsistent
assessments. Its six tests pass. The initial uncapped Node test command was rejected by the test
guard; the documented compliant command with `--test-concurrency=1` passed. Replaying the sixteen
actual diagnostic-33 records preserves every unit and finding, as recorded under
`.superpowers/review-session-replay-39/`. The module performs no I/O or model calls and explicitly
does not certify factual correctness. No hook, MCP registration or native workflow was activated.

Primary references reviewed: [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ),
[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) and
[Python CSV](https://docs.python.org/3/library/csv.html). Stripe's retention example is at least
24 hours, not a universal exact expiration. The idempotency finding above also follows directly
from the mismatch between the response's lookup advice and the frozen task's conflict requirement.

Current candidate provenance measurements now cover all five instruction files against the four
hash-verified vendored upstream skills. `tests/release/provenance.py` emits reproducible counts,
hashes and offsets; an independent dynamic-programming check verified all 20 comparisons.
See [the current inventory measurement](COPIED_TEXT_INVENTORY.md#current-candidate-file-wide-measurement).
This adds no model calls and is not license clearance or an extension of the earlier human ruling.

## Local and native verification

Previously observed: 72 existing plugin tests passed without skips; the current release suite
passes 35 tests, including independent functional-oracle negatives, original-plugin selection,
three model/environment checks, ten review-coverage/assignment checks and nine bounded-repair checks. Historical conformance
runner and guard-checker selftests passed.
Claude accepted the manifests, but its directory validator reported no skill contents; that
result is not skill validation. Bundled skill/plugin validators remain unrun because their
Python environment lacks PyYAML. No global dependency was installed to satisfy them.

Claude subject transcripts confirmed Sonnet 5/medium and intended bodies. Codex subject sidecars
record Luna/high and delivered bodies for all 96 snapshot-09 trials. All fourteen snapshot-10
trials have corresponding native evidence for the revised body and active TTAK policies.
Collector result flags intentionally remain pending; evidence sidecars supplement rather than
rewrite raw records. Native delivery is necessary and does not establish answer quality.

All three task-local Codex subject profiles now use verified ChatGPT subscription login.
Claude uses its existing native OAuth environment. No credential files were copied; a denied
credential inspection was not retried. Both hosts' extra usage is disabled per the owner's
confirmation. Native hook trust and the TTAK ON control were observed. Latest native Codex
installation is `0.2.0-rc.1+codex.20260908082818`; all twelve installed files matched their
prepared source. Original Git installation converted LF to CRLF; normalized source text matches,
not raw bytes. Historical installed versions and records remain intact.

Codex original selection uses native version-checked `config/batchWrite`, an exclusive task lock,
visibility verification and restoration. Four no-model checks verified each original separately
and all together, restoring configuration byte-for-byte. No hook/trust/provider controls are
changed by selection. CLI `-c` plugin-enabled overrides did not affect observed visibility and
are not used. Claude's early-access `plugin eval init --bare` was unavailable; no feature flag
or historical hook-trust bypass was used.

## Usage and remaining work

The full initial budget is 388 subject CLI turns (264 task and 124 activation), plus 128
comparative grading calls: **516 total, 258 per host**. CLI calls are not subscription quota
units. Development conversation, setup and defect-driven reruns are separate.

Saved subject, grading and diagnostic records now total **666 calls**: Claude has 282 subject/activation
calls, 66 grades and forty review/repair/source diagnostic calls (388 total); Codex has 212 subject/activation calls, 64 grades and two
claim-verification calls (278 total).
This includes four calls each from the policy-OFF, rejected snapshot-12 and source-supplied
diagnostics, along with other failed and superseded trials. Control calls are separate: the two
earlier Codex calls (status consumed model tokens, enabling consumed none) and the two zero-token
Claude OFF/ON diagnostic controls. No historical grading calls remain. Snapshot 10 has 14 of 64 candidate
trials; collecting its other 50 candidate trials would require 94 calls before grading. That is
an inventory, not a decision to rerun all of them: establish valid evidence reuse and resolve
the known explanation findings first. Further diagnosis and changed-input retesting are
additional; one entire additional comparative set would require another 516 calls. No quota
percentage, money conversion or fixed calls-to-release promise follows from these figures.

The September 8 usage briefing bounds the next development/verification segment at 596
additional CLI calls from the 620-call checkpoint: at most 80 for diagnosis and affected-case
retesting, followed by one 516-call complete comparison only after the known defects are
resolved. Diagnostics 24-39 used forty-six of the 80 (28 and 39 were offline), leaving at most 34 diagnostic/retest calls and
516 final-comparison calls (550 total) in this segment. This is an operational ceiling, not
a promise of qualification within it. Main development conversation and separately identified
control/setup requests are outside these CLI counts. Stop for a usage reset when the native
subscription limit is reached; do not enable credits, API billing fallback or substitute models.

Historical snapshot-06 Claude medians include activation and task calls, excluding graders:

| Capability | Original seconds | TTAK seconds | Original output tokens | TTAK output tokens |
|---|---:|---:|---:|---:|
| Development | 8.85 | 13.59 | 654 | 966.5 |
| Review | 7.65 | 12.65 | 259 | 703.5 |
| Explanation | 16.22 | 19.56 | 972.5 | 1298 |
| Progress | 13.40 | 13.65 | 448.5 | 454 |
| Mixed | 22.82 | 35.61 | 667.5 | 2161.5 |

These small, concurrently collected samples do not support time/cost-saving claims. They are
not current-candidate or Codex measurements. Cache and internal-call accounting also affect
comparisons; output tokens cannot be converted into subscription allowance.

## Reproduction and evidence layout

Run from this candidate worktree using the existing Python executable (examples name Python
conventionally; no runtime installation is required):

```text
python -B tests/release/test_release.py
python -B tests/release/prepare.py --check
python -B tests/release/prepare.py --verify-freeze .superpowers/release-run-23
python -B tests/release/collect.py --experiment .superpowers/release-run-23 --trial claude.explain-child.ttak.1
```

These commands do not call a model. The collector defaults to a dry run. Execution requires
an explicit trial and a normally prepared task-local profile. It activates the required native
skills in the same session before the task, counts activation usage, disables shell/connectors
in subject turns, and never executes returned code. Original i-have-adhd requires explicit
activation; automatic skill routing is a separate integration check still to complete.

Snapshots 01-03 are unused preparation; profiles in 03 are reused. Snapshots 04-05 contain seven
historical pilot subjects, including superseded mixed-progress activation. Snapshots 06-09
preserve the full comparisons and earlier corrections. Snapshot 23 matches current frozen inputs;
verify against its manifest before any further use. Historical manifests describe preparation,
not live completion; trial/grade files and audits provide execution evidence. Do not overwrite
old snapshots or reuse their frozen inputs as if they were the latest candidate.

The executable corpus, pinned MIT sources and independent functional checks are in
`tests/release/`. Native transcripts and raw results remain task-local under `.superpowers`;
no private runtime evidence has been published. The agreed protocol below is unchanged.

## Agreed outcome

One installation provides lean development, a focused complexity review, audience-adapted
explanation and visible progress during long work. It replaces the core uses of the three
attributed sources, not their exact commands, personas or intensity settings. This is the current
release scope; the earlier v0.3 candidate and its deferred Review scope remain historical records.

The owner selected scoped, repeated comparisons rather than a population-wide statistical
non-inferiority claim. Quality comes first; measured increases in time or usage may be disclosed
without failing an otherwise qualified release. No universal accuracy, safety, bug-reduction or
efficiency guarantee is made.

## Environment and usage boundary

- Windows; installed Claude Code and Codex CLI versions are recorded per run.
- Claude Sonnet 5 (`claude-sonnet-5`), medium effort.
- Codex GPT-5.6-Luna (`gpt-5.6-luna`), high effort.
- Existing subscription allowances only. No API-key billing, purchased credits or model fallback.
- Stop model work on a usage-limit or authentication failure; retain completed evidence and resume
  only when the condition is resolved. No unattended wait-and-retry loop.
- No host policy or guard bypass, credential copying, global installation or public publication.
  Qualifying the candidate and publishing it are separate observable actions.

## Comparison protocol, fixed before candidate model trials

Use 16 task scenarios: four development, three focused review, four explanation, three multi-turn
progress and two mixed workflows. Two independent repetitions per scenario, per condition, per
host: 192 subject trials in total. Each multi-turn scenario is one trial, not several independent
observations. A one-repetition connectivity pilot counts toward this total only if its inputs and
execution conditions exactly match the frozen run.

Conditions: unmodified host baseline; the pinned original appropriate to the task (all three for
mixed work); this candidate. Review uses the original's review skill. Record the source revisions,
input and instruction hashes, actual model, effort, delivery path, output and elapsed time. Check
what actually reached the model; an intended condition label is not sufficient evidence.

Tasks and rubrics are frozen before the scored run. Mechanical checks test functionality and
known failure cases. Explanations are checked for factual correctness and reader suitability;
progress tasks test continuation after an interruption, correct state and an honest finish.
Blind comparative grading hides condition labels, does not execute response text and records
reasons. Preserve disagreements and resolve them before scoring, without overwriting history.

Release requires complete coverage on both hosts, valid observed delivery, every candidate hard
check passing, and no unresolved material quality regression against either applicable original
condition. Compare each capability separately: a gain in code size cannot cancel a wrong explanation
or an unsafe edit. Report wins, ties and losses, including qualitative limitations, instead of
declaring statistical equivalence from this small sample. Repeated ratings are not extra trials.

Inspect newly generated code before any local execution. Use bounded task-only fixtures and no
unrelated credentials or external access. A check that cannot run compliantly remains unverified.
Do not weaken the check or change the rubric to turn a failed candidate into a passing one.

## Stopping rule

Fix a demonstrated candidate defect at its cause, then rerun the affected checks. After three
attempts at the same failure without new evidence, stop that approach and report the unresolved
cause. Do not keep expanding the evaluator or repeatedly regrade one response. Finish with a
capability-by-capability release verdict, reproducible evidence and the exact supported scope.
