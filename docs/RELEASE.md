# First release candidate

Status: implementation and validation in progress. This candidate is not yet qualified for release.

## Current checkpoint

Candidate version: `0.2.0-rc.1`. The reviewer is implemented; development, explanation and progress
guidance have been updated. The original working tree and its uncommitted grading records are
preserved separately from this candidate worktree.

Observed local checks: 72 existing plugin tests passed with no skips; eight new release-corpus and
functional-oracle tests passed; the historical conformance runner and guard-checker selftests
passed. Claude's validator accepted the plugin and marketplace manifests. Its attempted directory
validation reported no skill contents, so that result does not validate the new skill. The bundled
skill validator did not run because its Python environment lacks PyYAML; no dependency was installed.

Subject model trials completed for this candidate: **0 of 192**. Native discovery and delivery of
the new skill, subscription-only trial execution, comparative grading and the release gate remain
unverified. An authentication-metadata inspection was denied by the host's credential-path guard;
it was not retried through another route. Public CLI status showed Claude OAuth login and Codex
ChatGPT login, but not the accounts' extra-usage settings. Account confirmation is pending.

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
python -B tests/release/prepare.py --freeze .superpowers/release-run-02
python -B tests/release/prepare.py --verify-freeze .superpowers/release-run-02
python -B tests/release/collect.py --experiment .superpowers/release-run-02 --trial claude.explain-child.ttak.1
```

These commands do not call a model. `prepare.py` freezes inputs and comparison assignments, not
results. The 16 scenarios, functional checks and pinned original source bytes live in
`tests/release/`. Public source texts are stored as `skill-source.md` data, accompanied by their
unchanged upstream licenses, instead of being discoverable installed skills.

`collect.py` defaults to printing one native-host command without invoking it. Execution requires
an explicitly selected trial and a prepared profile inside the frozen experiment. Its
`readiness.json` records host, condition, subscription-only and disabled-extra-usage confirmation,
connector-free setup, normal hook trust and installed plugin roots. This preparation record does
not prove runtime delivery or grant permission. Profiles must be prepared through normal host
installation, login and trust controls; the collector does none of those itself. It uses no shell
or external connector tools in model turns, preserves a real session for multi-turn cases and
never executes generated code. Observed delivery, actual model and effort must be independently
verified before a collected response can enter the release score. The collector's command and
capture tests are offline; live host execution is still unverified.

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
