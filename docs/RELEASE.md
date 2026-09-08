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

Snapshot 06 adds four collected Claude trials: all three conditions of mixed-safe-progress,
with the corrected activation, and the first TTAK develop-reuse response. Native transcript
inspection found the intended policy/skill bodies and Sonnet 5 assistant messages. Neither
progress treatment received a review skill body. Actual effort verification and blinded grading
of these new records remain pending. The complete develop-reuse code was inspected: only the two
requested helper calls changed, with no new imports or side effects. Its independent functional
check passed, including Unicode casefolding, whitespace, empty names and input preservation.
This is one functional result, not proof of comparative development quality.

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
python -B tests/release/prepare.py --verify-freeze .superpowers/release-run-06
python -B tests/release/collect.py --experiment .superpowers/release-run-06 --trial claude.explain-child.ttak.1
```

These commands do not call a model. The freeze example requires a destination that does not yet
exist; snapshot 06 is the current existing snapshot used by the next two examples.
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
Snapshots 04 and 05 contain the pilot records described above and archived input bytes. Their
hashes differ from the current corrected collector and oracle; do not overwrite them or silently
relabel their results. Snapshot 06 freezes the corrected run. Executable inputs and the
protocol below are frozen per snapshot; this changing checkpoint is not an experimental input.

The current full comparison budget is 388 subject CLI turns (264 task turns and 124 skill
activation turns), plus 128 planned grading turns: 516 total, split equally between the hosts.
This excludes development conversation, setup probes and defect-driven reruns. Saved pilot and
grading records currently account for 43 Claude CLI turns, including the failed candidate attempt
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
