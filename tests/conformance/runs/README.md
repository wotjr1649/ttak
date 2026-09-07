# Run records

Raw `run.py` output, one JSONL row per `(case, trial, arm, host)`. Every row here is ungraded —
`"pass"` is `null` — so nothing in this directory is a conformance figure. `--score` over either
file reports every hard AC as `NOT ATTEMPTED`.

| File | What it is |
|---|---|
| `2026-09-07-claude-t1.jsonl` | The first real run. Claude Code `2.1.263`, 16 cases × 1 trial × both arms, 32 rows, all exit 0, `$1.19` summed from each row's own `total_cost_usd`, 588 s wall clock |
| `2026-09-07-codex-probe-401.jsonl` | One row, one case, Codex `with` arm. Kept as the evidence for the parent README's Codex section: exit 1, `401 Unauthorized` on every retry of both transports, and the fallback-metadata warning for a model id Codex does not know. No rollout was written, so it says nothing about whether the hook injected |
| `2026-09-07-claude-t1-voided.jsonl` | The attempt before it, kept because it is the evidence for the decode defect in the parent README: 30 of its 32 rows carry `"exit_code": 0` with `"stdout": null` and `"error": null` — a run that captured nothing, recorded as a run that succeeded |

The two files are not comparable and the voided one must not be graded. It is here to be read, not
to be scored.
