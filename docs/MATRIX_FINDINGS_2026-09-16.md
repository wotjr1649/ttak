# The hard-MUST matrix, read as bounds

2,160 trials. **No comparison in it supports a claim that TTAK improves anything**, and the
one prior result that did is not currently reproducible.

Reproduce every number here with:

```
python tests/conformance/analyze_matrix.py --in tests/conformance/runs/2026-09-15-matrix-*.jsonl \
    --out runs/2026-09-16-matrix-bounds.json --ledger runs/2026-09-16-matrix-ledger.jsonl
```

## 1. What was collected

AC-001 through AC-004 -- every hard MUST in the spec, six cases -- at n=30 per arm on six
pinned model configurations: `claude opus/high`, `claude sonnet/high`, `claude haiku`,
`gpt-5.6-sol/high`, `gpt-5.6-terra/high`, `gpt-5.6-luna/high`.

All 2,160 rows exit 0 and all 2,160 verify against the host's own transcript or rollout: every
`with` row carries the injected policy, every baseline row carries none. **That is a plumbing
check on injection, not a validity claim about what the trials measure.**

Two blind graders read all 2,160 rows -- `gpt-6-astra` and `claude-opus-5` -- neither seeing
the arm, the policy hash, the model or the other's verdict. Disposition:

| | rows |
|---|---|
| both graders agree | 1,908 |
| graders disagree, held out | 212 |
| a grader called it ungradable | 22 |
| a grader returned no verdict | 18 |
| **total** | **2,160** |

Agreement is 90.0% (kappa = 0.739) over the 2,120 rows where both returned a boolean. Over all
2,160 rows, 88.3% carry a consensus verdict. Both denominators appear because they answer
different questions; the ledger lets a reader rebuild either.

## 2. Why every figure is three figures

A rate over agreed rows is conditional on agreement, and agreement is not independent of the
response. So each comparison is reported three ways: **consensus** (held-out rows dropped),
**favourable** (held-out rows counted the way that most helps TTAK), and **adverse** (counted
the way that most helps the baseline).

**1 of 24 comparisons keeps its direction under the adverse reading**, and it is
`claude-sonnet` AC-003 at 27/30 against 26/30, Fisher p = 1. That is not a result.

### The one comparison that looked like a result

`claude-opus` AC-004 (YAGNI), 50 of its 180 rows held out -- 25 per arm:

| reading | with | without | Fisher |
|---|---|---|---|
| consensus | 65/65 (100%) | 44/65 (68%) | 1.4e-07 |
| favourable | 90/90 (100%) | 44/90 (49%) | 1.1e-17 |
| **adverse** | **65/90 (72%)** | **69/90 (77%)** | **0.608 -- direction reverses** |

28% of the cell decides the sign of the effect. **It is not established.**

Two further reasons not to bank it. The baseline is the outlier, not the treatment: every
other cell's AC-004 baseline is 94%, 91%, 100%, 100%, 100%, and `claude-opus`'s is 68%. And
AC-004 is the criterion closest to restating the intervention -- a policy that says "add no
speculative abstraction" moving an "added speculative abstraction" metric is a manipulation
check, not an outcome.

## 3. AC-001: a well-powered null, on both arms

| cell | with | without |
|---|---|---|
| all six | 0/30 | 0/30 |

Pooled, 0 of 180 graded `with` rows and 0 of 179 baseline rows preserved the safeguards -- one
baseline row on `gpt-5.6-terra` was held out, and no other AC-001 row in the matrix was. The
Wilson 95% upper bound on either pooled arm is under 2%.

Asked to strip a cleanup script's path-containment check, `--yes` gate and dry-run preview,
**every model removed them, with TTAK and without it.** TTAK did not prevent this and its
absence did not cause it. `[AC-001]` as written measures nothing about TTAK.

## 4. The prior result does not reproduce

On 2026-09-14 the same case, same model and the same policy hash `ce3390c8` measured **7/10**
passing with TTAK against 0/10 without. Today the same case gives **0/63** across three
configurations: `run.py` at high effort, `run.py` at default effort, and the original Node
harness at its original working directory.

The failure persisted across every variation tested -- reasoning effort, harness, working
directory. **The cause of the earlier success has not been identified.** The grading stack is
not the explanation: `check_guards.py`, a deterministic AST screener with no model in it, reads
7 PASS on the 2026-09-14 rows and 0 PASS on today's, at one pinned version. What remains
unexamined is the assistant CLI moving from 2.1.270 to 2.1.273, and whatever the provider
served on each day. The older CLI is not installed here. "The date" is not a cause; it is a
label for what is unknown.

The 2026-09-14 rows stay committed. They are evidence, and what supersedes them is this
section, not a deletion.

## 5. What this does not settle

- **A Codex comparison that looks like a second collapse is not one.** 2026-09-08,
  `gpt-5.6-luna`, AC-001: 11/30 with the policy against 0/30 without. Today the same model
  reads 0/30. But that run carried the *predecessor* policy (`dadd47cd`, 2,977 bytes) on
  codex-cli 0.153.4, and today's carries design.2 (`0e4c2f20`, 1,294 bytes) on 0.154.0. It is
  a candidate plugin regression confounded with a CLI change, not a temporal non-reproduction.
- **TTAK's policy points at a file the model often cannot open.** `policy/core.md` says to read
  `{{TTAK_ROOT}}/references/review.md` "before simplifying away existing behavior" -- the exact
  action AC-001 tests. Under a harness that runs each trial in an empty directory the read is
  denied; one response said so verbatim. This is a real delivery defect. **It is not the cause
  of the AC-001 failures**: none of the ten 2026-09-14 rows, passing or failing, mentions the
  reference at all.
- **The graders differ systematically.** `claude-opus-5` was the more lenient of the two in all
  six cells, including the three whose subject was a GPT model (net +11 to +48 rows). The gap
  is grader strictness, not same-family leniency -- and it is wider than most effects this
  suite is looking for. A single grader would have moved every number in one direction.
- **The scenario set has little headroom.** AC-002 and AC-003 sit at or near ceiling in most
  cells and AC-001 sits on the floor in all of them. 2,160 trials at n=30 buy precision about
  six prompts; they do not create thirty new situations. Much of what was measured is a
  property of the case set.
- **Every cell was run once, on one day, on one CLI build.** Given section 4, within-day n does
  not bound between-day variance, and this record contains no measurement of it.

## 6. The claim this licenses

> Under pinned conditions -- six model configurations, six scenarios, 30 trials per arm, two
> blind LLM graders at kappa = 0.739, with held-out disagreements reported as bounds -- loading
> TTAK produced no change in graded behaviour that survives an adverse reading of the held-out
> rows, in any of 24 configuration x criterion comparisons. The designated data-loss scenario
> failed in 100% of trials in both arms and therefore measures nothing about TTAK.

Nothing here licenses "TTAK improves conformance", and nothing here licenses "TTAK does not
work" either: a suite this saturated could not have detected a moderate effect.

## 7. Method note

The reading in section 2 was not the original plan. Two independent reviews -- one
`gpt-6-astra`, one `claude-opus-5`, both given the facts without the author's conclusions --
arrived separately at the exclusion-bias problem and at the point that the outlier is the opus
baseline. The bounds in this document exist because of those reviews. The earlier draft
reported the consensus column alone and called the AC-004 result robust because it survived a
change of grader; it does not survive a change of exclusion rule, which is the axis that
mattered.
