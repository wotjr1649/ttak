# First release candidate

Status: implementation and validation in progress. This candidate is not yet qualified for release.

## Current checkpoint

Candidate version: `0.2.0-rc.1`. The reviewer is implemented; development, explanation and progress
guidance have been updated. The original working tree and its uncommitted grading records are
preserved separately from this candidate worktree.

Observed local checks: 72 existing plugin tests passed with no skips; ten new release-corpus and
functional-oracle tests previously passed; the current release suite passes all eleven tests,
including rejection of a lossy normalization helper and task-appropriate skill activation.
The historical conformance runner and guard-checker selftests
passed. Claude's validator accepted the plugin and marketplace manifests. Its attempted directory
validation reported no skill contents, so that result does not validate the new skill. The bundled
skill validator did not run because its Python environment lacks PyYAML; no dependency was installed.

Seven Claude subject trial records and two blinded Claude grading records exist across snapshots
04 and 05. These are pilot evidence, not seven release-qualified passes: one candidate response
omitted the requested manager explanation, and its corrected rerun completed that deliverable.
The three mixed-progress records used an unnecessary review activation; retain their history but
exclude that comparison from release scoring and rerun with task-appropriate activation.
The review-and-explanation comparison has only one repetition and one grader; all three conditions
passed its hard checks, with no material regression identified by that grader. Both-host repeated
coverage, independent grading and the release gate remain incomplete. Runtime verification flags
in the raw collector records remain pending; do not infer qualification from collection success.

Snapshot 06 contains all 96 planned Claude trials across the sixteen scenarios, three conditions
and two repetitions. Native transcript inspection found the intended policy/skill
bodies and Sonnet 5 assistant messages. Neither progress treatment received a review skill body.
For all 96 trials, native `assistant.effort` metadata also confirms
medium effort. Separate evidence files supplement the unchanged raw collector records; successful
collection alone still does not qualify a trial. Cross-model grading remains pending.

All 24 development artifacts were reviewed before execution and passed their task-specific
functional checks: normalization, CSV round-trip, bounded exception retry, and cleanup-plan
preview/containment. Changes were limited to the requested functions or reporting scaffolding,
without new imports or external effects. The six normalization artifacts have identical code
hashes. Baseline and original conditions also passed every functional check: no functional
accuracy advantage for TTAK was observed in these fixtures. These results do not establish
general bug reduction, automatic repository editing quality, or comparative explanation quality.

Eight blinded Sonnet 5 development grades passed every hard criterion. Most quality ratings are
full; preserve two rubric-consistency questions for independent review: nearly identical skipped
backoff notes receive different treatment across repetitions, and one cleanup grade penalizes
list aliasing under a criterion about independent preview/confirmation behavior. No material
development regression was identified by this grader. These are single-grader observations.

Manual review of the new review responses found an unsupported TTAK claim in
`claude.review-needed-layer.ttak.1`: it states that 13 of the 14 plugins are v1, although no v1
count was supplied. The compatibility recommendation is correct; that invented count is not.
Original `claude.review-already-small.original.2` proposes a
separate `any()` validation pass followed by `sum()`. A local reproduction with `iter([1, 2])`
returns 0 instead of the supplied implementation's 3 because validation exhausts the iterator.
Both observations are retained for the final comparison.

Six first-grader review ratings are now saved and shape-validated. The grader missed the
unsupported count and declared no material regressions despite the independently reproduced
iterator issue; these ratings are insufficient to clear the manual findings. Explanation and
remaining progress/mixed ratings, independent grading and grading-disagreement resolution remain.

Snapshot 07 tests a narrow instruction correction: ground review quantities/dependencies in
evidence, and keep implementation/mode assumptions consistent in explanations. Two repetitions
of each affected failure scenario received the revised bodies and Sonnet 5/medium. The count 13
did not recur. However, `claude.explain-expert.ttak.2` incorrectly states that neither transaction
writes a row read by the other, contradicting its own doctors example. Explanation accuracy is
still unresolved; the correction is not qualified. In snapshot 06, the claim that a waiting
transaction simply reads updated rows also needs implementation-specific qualification:
[PostgreSQL 18 Repeatable Read](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ)
can abort after a concurrent update and requires retrying the entire transaction.

Snapshot 08 replaces the general consistency sentence with an example-tracing check covering
starting conditions, actions, resulting state and remedy failure/retry paths. Two Sonnet 5/medium
expert-explanation trials received the revised body. The earlier reversed read/write sentence did
not recur, but both responses still make unqualified lock-behavior claims; one again says the
waiting transaction re-reads the updated count. This is partial improvement, not a passed
explanation correction. Further same-pattern wording changes are paused pending source-grounded
factual review and independent grading. No neighbor-case success is claimed for this revision.

One blinded Sonnet 5 grading of the corrected mixed-progress comparison passed all hard criteria
for all conditions. It identified the original's refusal to explain the supplied plan as a
material shortfall, and rated TTAK partially on scope control because it added CI/caller checks.
The baseline also mentions CI/test coverage but received full scope credit; retain that
consistency question for independent review rather than silently adjusting the rating.

An authentication-metadata inspection was denied by the host's credential-path guard;
it was not retried through another route. The owner subsequently confirmed that extra usage is
disabled on both accounts. The task-local Claude profile uses the existing native OAuth environment
without copying a credential file; native `ttak on` was observed blocked and consumed by its hook,
with the setting saved ON. The new Codex profile reports not logged in through the normal CLI.

The installed Claude CLI advertises `plugin eval`, but its offline `init --bare` command returned
`plugin eval is currently in early access`. No template was created and no feature flag was changed.
This native evaluator is unavailable in this environment; comparison execution must use an
independently permitted host workflow. The existing historical runner is not a release runner:
it lacks multi-turn cases and original-plugin conditions, and its Codex with-arm contains a hook
trust bypass that will not be used for this candidate.

Offline preparation:

```text
python -B tests/release/test_release.py
python -B tests/release/prepare.py --check
python -B tests/release/prepare.py --freeze .superpowers/release-run-new
python -B tests/release/prepare.py --verify-freeze .superpowers/release-run-08
python -B tests/release/collect.py --experiment .superpowers/release-run-08 --trial claude.explain-child.ttak.1
```

These commands do not call a model. The freeze example requires a destination that does not yet
exist; snapshot 08 is the current existing snapshot used by the next two examples.
`prepare.py` freezes inputs and comparison assignments, not
results. The 16 scenarios, functional checks and pinned original source bytes live in
`tests/release/`. Public source texts are stored as `skill-source.md` data, accompanied by their
unchanged upstream licenses, instead of being discoverable installed skills.

`collect.py` defaults to printing one native-host command without invoking it. Execution requires
an explicitly selected trial and a prepared profile inside this worktree's `.superpowers` runtime
directory. Profiles can be reused across input revisions without moving their native login state. Its
`readiness.json` records host, condition, subscription-only and disabled-extra-usage confirmation,
connector-free setup, normal hook trust, installed plugin roots and `skill_invocations` mapping
each required skill to its verified native name. This preparation record does
not prove runtime delivery or grant permission. Profiles must be prepared through normal host
installation, login and trust controls; the collector does none of those itself. It uses no shell
or external connector tools in model turns, preserves a real session for multi-turn cases and
never executes generated code. Observed delivery, actual model and effort must be independently
verified before a collected response can enter the release score. The collector's command and
capture tests are offline. Claude pilot execution has been observed; Codex subject execution
still needs the task-profile login and normal hook-trust setup.

Treated trials explicitly activate the applicable native skills before sending the task in the
same session. This is required for the original i-have-adhd skill, which disables model-initiated
invocation. Activation responses, tokens and elapsed time are recorded separately and must be
included when reporting total usage; they are not additional independent trials or graded task
answers. Baseline trials activate nothing. Native activation itself still needs transcript
verification: a model saying it loaded a skill is not proof. This measures deliberately selected
skills; automatic routing is a separate integration check.

Preparation snapshots 01 and 02 predate the collector's explicit activation support and are
retained as unused preparation records. Neither contains subject trials; verification rejects
their now-stale collector hashes. Snapshot 03 predates native plugin selection and subscription
environment forwarding; its profiles remain in place and can be referenced by snapshot 04.
Snapshots 04 through 07 contain the records described above and archived input bytes. Their
hashes differ from the current corrected collector and oracle; do not overwrite them or silently
relabel their results. Snapshot 08 freezes the current instruction correction. Executable inputs and the
protocol below are frozen per snapshot; this changing checkpoint is not an experimental input.

The current full comparison budget is 388 subject CLI turns (264 task turns and 124 skill
activation turns), plus 128 planned grading turns: 516 total, split equally between the hosts.
This excludes development conversation, setup probes and defect-driven reruns. Saved pilot and
grading records currently account for 250 Claude CLI turns, including the failed candidate attempt
and superseded comparison routing.
CLI turns are not subscription quota units; native internal calls and cache accounting vary.

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
