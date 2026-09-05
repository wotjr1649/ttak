# Cross-host conformance runner

`claude plugin eval` is early-access gated on this account, verified by execution: it prints
`` `plugin eval` is currently in early access `` before resolving a target. `run.py` replaces it.

**Status.** Built and dry-run tested only. It has not been run against a real host — that is
deliberate, not an oversight: building and validating the instrument does not require one, and no
conformance figure exists yet. The repository's own `README.md`, in "What is measured", already
states this: "Cross-host conformance ... measured on a live host: ... unmeasured for TTAK today."

## What it does

```
python run.py --host claude|codex --arm with|without --model <id> --trials N --out <file>
```

Runs every case in `cases.jsonl` for `--trials` trials, invoking the target host once per trial in an
isolated, ephemeral session, and appends one JSONL row per `(case, trial, arm, host)` to `--out`. A
row records the prompt, the constructed command, the model, the CLI version, the installed-skill set,
the raw stdout/stderr, and a `"pass": null` placeholder — grading against the case's `criteria` and
`forbidden` lists happens afterward (by a person or a separate LLM-judge pass), not inside this script.
`--score --out <file>` then aggregates a graded file into a gate verdict.

Resumable: a `(case, trial, arm, host)` row already present in `--out` is skipped, so an interrupted
run (or a later run adding more trials) picks up where it left off, including in `--dry-run`.

Standard library only, Python 3.14. No pip installs, matching the rest of this repository's
zero-dependency policy — this is a development instrument, not shipped runtime.

## Try it (no host invoked)

```
python run.py --host claude --arm without --trials 1 --dry-run
python run.py --selftest
```

`--dry-run` prints the exact commands it would run and executes nothing — no subprocess is spawned.
`--selftest` exercises the pure functions (command construction, `cases.jsonl` schema validation,
resumability keys, the gate) with plain `assert`s and also invokes no CLI. Neither spends model budget.

## Isolation, and why it is not optional

```python
CLAUDE = ["claude", "-p", "--output-format", "json",
          "--setting-sources", "",          # do not inherit the operator's plugins, hooks, output style
          "--model", MODEL]                 # pin explicitly; never inherit the operator's default
CODEX  = ["codex", "exec", "--ephemeral", "--ignore-user-config",
          "--sandbox", "read-only", "--skip-git-repo-check", "--json"]
```

Without these flags the baseline (`without`) arm inherits the operator's own configuration. On the
development machine that means an enabled `ponytail` and `outputStyle: Concise` would both leak into
the baseline, measuring TTAK against itself and against a competitor at once. `build_command()` in
`run.py` starts every command from one of these two lists and asserts the required flags are present —
as exact adjacent subsequences (e.g. `--sandbox` immediately followed by `read-only`), not independent
membership checks, since two membership checks can each pass against a mutated command that pairs the
flag with the wrong value. The assertion runs on every command built, including under `--dry-run`, so
a future edit that drops a flag fails loudly instead of shipping a quietly-leaky baseline.

Every trial also runs in a fresh, empty working directory, for both arms and both hosts. The flags
above stop the operator's settings from leaking in; running from this repository's own root would leak
a second way, since a model that can read TTAK's own specification behaves differently for that reason
alone, independent of whether the hook actually injected anything.

### How `arm` toggles TTAK

Loading the plugin is necessary but not sufficient: `hooks/ttak.cjs` only injects the policy text when
its saved state reads `"on"`; an absent or off state emits at most a one-line notice. So `with` does
two things, and both are required:

- **Claude Code.** `--plugin-dir <repo root>` loads the plugin ad hoc for one session (verified against
  this machine's `claude --help`: "Load a plugin from a directory ... for this session only"). No
  persistent install is needed. `run.py` also points `PLUGIN_DATA` at a fresh temporary directory and
  seeds `state.json` with `{"enabled": true}` before invoking, in the same shape `writeState()` writes.
- **Codex CLI.** There is no equivalent ad hoc flag — checked exhaustively against this machine's
  `codex exec --help`, `codex --help`, and `codex plugin --help`; plugin loading is only
  `codex plugin marketplace add` + `codex plugin add` against a `CODEX_HOME`, a persistent, stateful
  operation. `run.py` therefore expects a **pre-provisioned fixture** at
  `<tmp>/ttak-conformance/codex-home-with` (see setup below) and points `CODEX_HOME` at it for the
  `with` arm, plus the same `PLUGIN_DATA`/`state.json` seeding as Claude. It also adds
  `--dangerously-bypass-hook-trust`: Codex requires an interactive `/hooks` trust review before any
  hook runs, and that flag's own `--help` text names unattended automation — this runner — as its
  intended use. A real `with`-arm run against Codex fails fast with a clear message if the fixture is
  missing, rather than silently measuring the baseline twice under a `with` label.

The `without` arm needs no setup for either host: Claude gets no `--plugin-dir` at all, and Codex gets
a fresh, empty `CODEX_HOME` created per trial, so nothing loads.

#### Codex `with`-arm setup (one-time, manual — not run by this task)

```
CODEX_HOME=<tmp>/ttak-conformance/codex-home-with codex plugin marketplace add <this repo>
CODEX_HOME=<tmp>/ttak-conformance/codex-home-with codex plugin add ttak@ttak
```

`<tmp>` is the OS temp directory (`tempfile.gettempdir()`; see `CODEX_HOME_WITH` in `run.py`). This
task does not run these commands — building and dry-running the instrument does not require a real
host, and actually provisioning this fixture means invoking `codex` for real, which is out of scope
here (see Task 12, host integration verification).

## Case coverage

`cases.jsonl` holds one row per `id` with `ac`, `prompt`, `criteria` (statements a grader can check),
and `forbidden` (outcomes that fail it). Fifteen cases cover fifteen of the eighteen §17.2 scenario
groups (see `docs/TTAK_Plugin_Product_Definition_v0.2_EN.md`). `ac` cites the acceptance criterion each
case is evidence for, from §17.4; `run.py --selftest` checks every `ac` value against the IDs actually
defined there, so a typo or an invented ID fails loudly instead of silently mismapping a case.

| case id | §17.2 group | ac |
|---|---|---|
| `simple-impl` | simple code implementation | AC-006 |
| `overeng-trap` | over-engineering trap | AC-004 |
| `reuse-available` | existing helper should be reused | AC-004 |
| `root-cause` | multiple symptoms, one shared root cause | AC-006 |
| `elaborate-design` | explicitly requires a more elaborate design | AC-003 |
| `safety-data-loss` | security/data-loss handling YAGNI must not remove | AC-001 |
| `audience-beginner` | beginner explanation | AC-007 |
| `audience-practitioner` | practitioner explanation | AC-007 |
| `audience-expert` | expert explanation | AC-007 |
| `audience-decision-maker` | decision-maker explanation | AC-007 |
| `option-comparison` | option comparison requiring a final recommendation | AC-006 |
| `unverifiable-env` | unverified environment, false completion claims avoided | AC-002 |
| `serious-context-humor` | serious context, humor suppressed | AC-006 |
| `ambiguous-instruction` | ambiguous instruction, one focused question justified | AC-006 |
| `completed-no-next-action` | complete task, no artificial next action added | AC-006 |

`completed-no-next-action` exercises the amended `[RESP-007]`: *"Give one concrete next action only
when work remains for the user"* (`policy/contract.md`). The prohibition form this replaced failed
6/6 on the frozen predecessor candidate across two hosts; this case measures whether the
conditional-positive form alone (no explicit "do not invent a next action" clause) still avoids the
failure, now that the prohibition has been dropped rather than merely reworded.

`option-comparison` exercises `[RESP-006]` ("When a recommendation is possible, TTAK SHOULD recommend
one option and state the deciding reason") and `[RESP-005]` (alternatives limited to those that
materially change the decision). §9.1 lists "option comparison and recommendation" verbatim as
`TTAK Core` — v1-owned, not Review — so this is a real scenario, not a stand-in for
`audience-decision-maker`: that case is about adapting an explanation to a stated reader, this one is
about producing a recommendation among named options regardless of who is asking.

**The other three §17.2 groups this instrument does not cover, and the actual reason for each:**

- **Group 11** (document contradiction and duplication review) is squarely `TTAK Review` — §9.2 lists
  "documents, policies, and specifications" and "requirement consistency" as Review's own scope, and
  Review is deferred to v1.1 (`[AC-008]`, not a v1 gate). Excluded correctly.
- **Group 12** (workflow simplification) is **genuinely ambiguous**, not excluded for a settled reason:
  §9.1 lists "workflow analysis" under `TTAK Core` (v1-owned), and §9.2 lists "business workflows"
  under `TTAK Review` (deferred). Nothing in the specification says which one "workflow simplification"
  in §17.2 means. Left uncovered because I cannot honestly file it under either bucket, not because it
  is confidently Review-shaped.
- **Group 14** (long multi-step work requiring visible progress, `[RESP-009]`) is excluded for an
  architectural reason, not a scope reason: `run.py` sends one prompt and records one response per
  trial. There is no second turn in which progress could be shown continuing, so this instrument cannot
  exercise "visible progress" regardless of whether the capability is in scope. A runner that issued a
  multi-turn conversation per trial could cover it; this one does not.

`ac` values map to §17.4's own modal verbs, not an invented scheme: AC-001 through AC-004 use MUST and
are hard gates (100%, checked in `gate()`'s `HARD_ACS`); AC-006 and AC-007 use SHOULD and are reported
with a threshold (85%, `SOFT_ACS`) but never fail the gate by themselves. AC-005 (no regression vs. the
baseline arm) and AC-009 through AC-012 are runner-level or process-level gates, not properties of an
individual case, so no case cites them.

## Scoring and the gate

`--score --out <file>` reads already-graded rows (`"pass": true/false`; rows still `null` are counted
and excluded, never silently treated as a pass; an exactly-duplicate `(case, trial, arm, host)` row is
de-duplicated, last-wins, before counting) and prints, per `(ac, arm)`, the trial count and pass rate —
the baseline (`without`) arm is always reported alongside `with`, not folded into one number.

**The gate itself is scored on the `with` arm only.** A hard AC (`AC-001`–`AC-004`) below 100% on
`with` fails the gate (exit 1); so does a hard AC with **zero** `with`-arm rows at all, printed as
`NOT ATTEMPTED` rather than silently reading as a pass — grading is external and incremental by this
tool's own design (see above), so scoring a file partway through grading, or before a hard case was
graded at all, must not print `GATE: PASS`. A soft AC (`AC-006`, `AC-007`) below 85% is printed as a
warning but never fails the gate; a soft AC with no data at all is not flagged, since it is SHOULD, not
MUST. The baseline (`without`) arm is reported at every AC and never gates, however it performs, even
at 0%: `safety-data-loss` exists specifically to show a baseline stripping a safeguard without TTAK, so
gating the baseline's own number would make the instrument structurally unpassable on the case that
matters most. **A single-run difference between arms is not a regression** regardless: the predecessor
measured run-to-run reproducibility at ≈0.96, which puts the 95% upper bound on the true failure rate
at 39.3% (`[AC-005]`). Every figure this script prints states its trial count for that reason — a rate
without one is not evidence of anything.

## Installed-skill set

**A real run of the `with` arm loads exactly one skill: `ttak`** (`run.py` records this per row in the
`"skills"` field, and it is what `--plugin-dir <repo root>` with no other `--plugin-dir` loads). Any
figure this instrument produces about *routing* — whether the model chooses to invoke the explainer
skill unprompted — is measured where TTAK is the only installed skill, and an only-installed skill
cannot fail to be routed to; such a figure proves nothing about routing accuracy in a realistic
environment with other skills competing for the same trigger words. This is `OPEN-06` in
`docs/superpowers/specs/2026-09-04-ttak-design.md`. None of the fifteen cases above are routing
cases — they send prompts and score the response's content and tone, not which skill answered — so
this instrument does not currently produce a routing figure at all. A future routing-focused case
would need to state, and actually load, a realistic competing skill set to mean anything.
