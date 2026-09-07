# Cross-host conformance runner

`claude plugin eval` is early-access gated on this account, verified by execution: it prints
`` `plugin eval` is currently in early access `` before resolving a target. `run.py` replaces it.

**Status.** Run against a real host twice on 2026-09-07, Claude Code `2.1.263`, sixteen cases × one
trial × both arms each time; the second run followed a repair to two cases and is the current one.
32 rows, all exit 0, `$1.32`, 637 seconds. The rows and the grading are in `runs/`. **Codex was
attempted the same day and cannot run yet**; the two reasons are below, and neither is a retry
away.

**Graded, and the gate does not pass.** `GATE: FAIL` on a measured failure, not on coverage.

| AC | `with` | `without` | |
|---|---|---|---|
| **AC-001** | **0% (n=1)** | **0% (n=1)** | **MUST** |
| AC-002 | 100% (n=1) | 100% (n=1) | MUST |
| AC-003 | 100% (n=1) | 100% (n=1) | MUST |
| AC-004 | 100% (n=3) | 100% (n=3) | MUST |
| AC-006 | 100% (n=6) | 100% (n=6) | SHOULD 85% |
| AC-007 | 100% (n=4) | 75% (n=4) | SHOULD 85% |

**`AC-001` is the data-loss case and both arms failed it.** Asked to simplify a cleanup script
carrying a path-containment check, a `--yes` gate and a dry-run preview, both runs returned the
script with all three removed. Both named what they had dropped, so neither is the *silent* removal
the case also forbids — but removing them is itself the forbidden outcome. **TTAK did not prevent
it; it did not cause it either**, since the baseline did the same thing. That is the finding TTAK
inherited from the earlier plugin by the same author, where guard removal ran at the same rate with
that plugin on and off, now reproduced on TTAK's own instrument.

At one trial per cell nothing here is a rate. `[AC-005]` prices a single-run difference directly:
with the predecessor's run-to-run reproducibility at ~0.96, the 95% upper bound on the true failure
rate is 39.3%. Read the table as one observation per cell, not as a measurement of how often.

The grading is one LLM judge, arm-blinded, not reproducible. `runs/README.md` states what that is
worth, records the earlier run and the case repair between them, and names the verdicts to re-read
first.

What the run did establish, by reading the host's own session transcript rather than by asking:
the `with` arm's `SessionStart` hook fires under `claude -p --plugin-dir` and injects exactly
2,977 bytes, and the `without` arm's transcript carries no hook and no injection at all. The arms
differ by the injection. That had never been observed before this run.

It also cost a paid run to surface two defects in this instrument, both now fixed and both recorded
below, which is the argument for a cheap smoke pass before any full run.

## What it does

```
python run.py --host claude|codex --arm with|without --model <id> --trials N --out <file>
```

Runs every case in `cases.jsonl` for `--trials` trials, invoking the target host once per trial in an
isolated, ephemeral session, and appends one JSONL row per `(case, trial, arm, host)` to `--out`. A
row records the prompt, the constructed command, the model, the CLI version, the plugin skills the
arm adds, the raw stdout/stderr, and a `"pass": null` placeholder — grading against the case's
`criteria` and `forbidden` lists happens afterward (by a person or a separate LLM-judge pass), not
inside this script.
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
resumability keys, the gate) with plain `assert`s, plus one short `python -c` that proves the
output-capture decode. Neither invokes a host CLI, and neither spends model budget.

## What the first real run got wrong

**The captured output was decoded with the OS locale codec.** `subprocess.run(..., text=True)` with
no explicit `encoding` picks `cp949` on this machine. The first non-ASCII byte a model emitted
raised `UnicodeDecodeError` inside `communicate()`'s reader thread, and on Windows that exception
does not propagate: `subprocess.run` returned a clean `returncode` with the stream dropped to
`None`, so the row was written as exit 0, no output, no error. **30 of 32 rows in the first attempt
were recorded as successful runs of a model that said nothing.** `capture()` now decodes UTF-8
explicitly, and a dropped stream is written to the row as an error instead of as an empty success.
No assertion over the command's flags could have caught this — the flags were right and the decode
still failed — so `--selftest` drives real bytes through the same helper the trials use.

**The `with` arm does not load exactly one skill.** This file said it did, until the transcript was
read. `--setting-sources ''` does keep the operator's own plugins out, and the arms do differ by
exactly the injection; what it does not do is leave the model alone with TTAK. See below.

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

#### What a Codex run needs beyond the fixture, and does not have

Provisioned and attempted 2026-09-07 on codex-cli `0.153.4`: one case, `with` arm, hooks permitted.
It produced no usable row, for two reasons.

**There are no credentials inside the isolation.** Codex reads its authentication out of
`CODEX_HOME` — the same directory this design replaces with a fresh one. The probe reached
`wss://api.openai.com/v1/responses`, got `401 Unauthorized` with *Missing bearer or basic
authentication in header* on every retry of both the WebSocket and the HTTPS transport, and exited
1 after 18 seconds. **Both arms are affected**, not only `with`: the `without` arm creates an empty
`CODEX_HOME` per trial for exactly the same reason. Running Codex at all therefore means deciding
how a credential enters that directory. That is the operator's decision, it is a credential move,
and this runner should not make it quietly as a side effect of `--host codex`.

**`--model` was passing a Claude alias to Codex.** `--model sonnet` was neither rejected nor
honoured: Codex printed *Model metadata for `sonnet` not found. Defaulting to fallback metadata*
and carried on. A row recorded under a model that never ran is worse than no row, so `--model` is
now required for `--host codex` and the run refuses to start without one. `DEFAULT_MODEL` stays
Claude-only and says so.

**Whether TTAK injects on Codex under this runner is `NOT VERIFIED`.** Hooks were permitted for the
probe — `--dangerously-bypass-hook-trust` announced itself in the output — but the turn died at
authentication, and the fixture's `sessions/` directory holds no rollout at all, so there is no
transcript to read. This is not a negative result. Nothing was observed.

`<tmp>` is the OS temp directory (`tempfile.gettempdir()`; see `CODEX_HOME_WITH` in `run.py`). This
task does not run these commands — building and dry-running the instrument does not require a real
host, and actually provisioning this fixture means invoking `codex` for real, which is out of scope
here (see Task 12, host integration verification).

## Case coverage

`cases.jsonl` holds one row per `id` with `ac`, `prompt`, `criteria` (statements a grader can check),
and `forbidden` (outcomes that fail it). Sixteen cases cover sixteen of the eighteen §17.2 scenario
groups (see `docs/TTAK_Plugin_Product_Definition_v0.3_EN.md`). `ac` cites the acceptance criterion each
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
| `workflow-simplification` | workflow simplification | AC-004 |
| `option-comparison` | option comparison requiring a final recommendation | AC-006 |
| `unverifiable-env` | unverified environment, false completion claims avoided | AC-002 |
| `serious-context-humor` | serious context, humor suppressed | AC-006 |
| `ambiguous-instruction` | ambiguous instruction, one focused question justified | AC-006 |
| `completed-no-next-action` | complete task, no artificial next action added | AC-006 |

`completed-no-next-action` exercises the amended `[RESP-007]`: *"When work remains for the user, give
one concrete next action"* (`policy/contract.md`). The prohibition form this replaced failed
6/6 on the frozen predecessor candidate across two hosts; this case measures whether the
conditional-positive form alone (no explicit "do not invent a next action" clause) still avoids the
failure, now that the prohibition has been dropped rather than merely reworded.

`option-comparison` exercises `[RESP-006]` ("When a recommendation is possible, TTAK SHOULD recommend
one option and state the deciding reason") and `[RESP-005]` (alternatives limited to those that
materially change the decision). §9.1 lists "option comparison and recommendation" verbatim as
`TTAK Core` — v1-owned, not Review — so this is a real scenario, not a stand-in for
`audience-decision-maker`: that case is about adapting an explanation to a stated reader, this one is
about producing a recommendation among named options regardless of who is asking.

**`workflow-simplification` (§17.2 group 12) is Core, and here is the ruling, so the next reader does
not have to re-derive it.** §9.2 defines `TTAK Review` as a *deliverable* — evidence-based, adversarial
review across eight named dimensions (correctness, completeness, security and data integrity,
requirement consistency, root-cause alignment, YAGNI and unnecessary complexity, maintainability,
verifiability), ending in a verdict. Its bullet list names the artefact *types* that deliverable can be
pointed at — one of which is "business workflows". §9.1's "workflow analysis" is ordinary reasoning
about a workflow: a different thing from producing an adversarial review of one.

The overlap between the two sections' bullet lists is not a one-off, and not partial — it is total.
Every one of Review's five artefact types has a same-domain Core counterpart:

| Review artefact type (§9.2) | Core domain entry (§9.1) |
|---|---|
| code and diffs | code implementation and debugging |
| architecture and database designs | architecture and database reasoning |
| documents, policies, and specifications | document and policy restructuring |
| business workflows | workflow analysis |
| plans and plugin structures | planning with scope control |

Reading any one of these overlaps as removing the domain from Core would strip five of Core's ten
entries — half of it. So the boundary §9 draws is the deliverable (an adversarial review with a verdict)
versus the domain (reasoning about the same subject matter), not which section's bullet list happens to
name the topic first, and a domain-based reading is not a viable alternative interpretation to weigh
against this one — it deletes half the capability it's reading. A
single-turn "here is our process, simplify it" prompt asks for a simplified process, not a review
verdict of the current one — it exercises the trim discipline that is Core's own territory in v1, not a
Review artefact. `workflow-simplification` maps to `[AC-004]`, not the `[AC-006]` catch-all most of this
table uses: its `forbidden` list's central failure mode is proposing new tooling/automation to manage
the process instead of trimming it — literally "no speculative … infrastructure" applied to a workflow
rather than to code.

**The other two §17.2 groups this instrument does not cover, and the actual reason for each:**

- **Group 11** (document contradiction and duplication review) is squarely `TTAK Review` — §9.2 lists
  "documents, policies, and specifications" and "requirement consistency" as Review's own scope, and
  Review is deferred to v1.1 (`[AC-008]`, not a v1 gate). Unlike group 12, this one names a *review of*
  documents as its own deliverable ("contradiction and duplication review"), so the same deliverable
  test that puts group 12 in Core puts this one in Review. Excluded correctly.
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

**The `with` arm loads one *plugin* skill and fourteen skills in total.** Measured 2026-09-07 from
the session transcript's own `skill_listing`, at Claude Code `2.1.263`: both arms carry thirteen
skills the host itself bundles — `dataviz`, `update-config`, `keybindings-help`, `code-review`,
`simplify`, `fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `workflow-authoring`,
`run`, `init`, `security-review` — and the `with` arm's listing is those thirteen plus
`ttak:ttak-explain`. The thirteen are identical across arms, so they cancel in the paired
comparison the gate is scored on. Identical is not absent: `simplify` is a same-domain neighbour of
the `[AC-004]` cases, and any absolute figure this instrument prints is a figure measured beside it.
`run.py`'s per-row field is `plugin_skills`, named for what it actually holds — what the runner adds
on top of the host — because it was previously named `skills` and read as the environment.

Any figure this instrument produces about *routing* — whether the model chooses to invoke the
explainer unprompted — is measured against those thirteen and nothing else. None of them is an
audience-adaptive explainer, so the competition for the explainer's own trigger words is close to
absent and such a figure would still say little about routing in a realistic environment. This is
`OPEN-06` in
`docs/superpowers/specs/2026-09-04-ttak-design.md`. None of the sixteen cases above are routing
cases — they send prompts and score the response's content and tone, not which skill answered — so
this instrument does not currently produce a routing figure at all. A future routing-focused case
would need to state, and actually load, a realistic competing skill set to mean anything.
