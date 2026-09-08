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
| Independent comparison grades | 32 Luna comparisons | 8 Luna development comparisons; 24 remaining |
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
Snapshot 09 has 32 validated Sonnet grades covering all 96 responses exactly once, plus eight
independent Luna development grades. Native transcripts confirm Sonnet 5/medium and Luna/high,
including exact canonical grading prompts; condition mappings were not supplied. Preparing the
remaining Sonnet batch first failed a prompt-hash check before any model call or packet write.
Recovering the exact recorded prefix resolved the mismatch; no subject or grade was repeated.
The completed batch added 24 Sonnet and eight Luna calls.

Both graders identify the original retry failure. Four development quality ratings differ;
static AST inspection confirms one Luna reason incorrectly says the unused CleanupReport
definition was removed. The expert explanation again receives high grades despite the known
lock-wait error. The raw first Sonnet review grades include six null hard ratings and two failed
inspection-claim ratings that still need adjudication. A separate manual-adjudication JSON write
was blocked by the host complex-shell-syntax hook and was not retried; no such artifact is claimed.
Completed audits remain in snapshot 09's `grading-coverage-summary.json`,
`development-grader-disagreements.json` and `development-grading-observations.json`.
Valid JSON and grader agreement do not prove correctness. No overall win rate is claimed.

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

Primary references reviewed: [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ),
[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) and
[Python CSV](https://docs.python.org/3/library/csv.html). Stripe's retention example is at least
24 hours, not a universal exact expiration. The idempotency finding above also follows directly
from the mismatch between the response's lookup advice and the frozen task's conflict requirement.

## Local and native verification

Previously observed: 72 existing plugin tests passed without skips; the current release suite
passes thirteen tests, including independent functional-oracle negatives and original-plugin
selection validation. Historical conformance runner and guard-checker selftests passed.
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

Saved subject and grading records now total **567 calls**: Claude 250 subject/activation + 66
grades = 316; Codex 211 subject/activation + 40 grades = 251. Failed and superseded trials remain
included. Two Codex setup/control calls are separate: status consumed model tokens; enabling
TTAK consumed none. Remaining historical grading is 24 calls (all Codex), bringing
that recorded subtotal to 591 if completed. Further diagnosis and changed-input retesting are
additional; one entire additional comparative set would require another 516 calls. No quota
percentage, money conversion or fixed calls-to-release promise follows from these figures.

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
python -B tests/release/prepare.py --verify-freeze .superpowers/release-run-10
python -B tests/release/collect.py --experiment .superpowers/release-run-10 --trial claude.explain-child.ttak.1
```

These commands do not call a model. The collector defaults to a dry run. Execution requires
an explicit trial and a normally prepared task-local profile. It activates the required native
skills in the same session before the task, counts activation usage, disables shell/connectors
in subject turns, and never executes returned code. Original i-have-adhd requires explicit
activation; automatic skill routing is a separate integration check still to complete.

Snapshots 01-03 are unused preparation; profiles in 03 are reused. Snapshots 04-05 contain seven
historical pilot subjects, including superseded mixed-progress activation. Snapshots 06-09
preserve the full comparisons and earlier corrections. Snapshot 10 matches current frozen inputs;
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
