# Explanation review integration

The release objective and its comparison criteria remain in [RELEASE.md](RELEASE.md).
This integration is in progress. It is not installed in the explanation skill and is not an
accuracy guarantee.

The host generates an audience-appropriate draft. Reviewed evidence and the draft enter an
orchestrator, which assigns one paragraph per fresh native session while retaining the full
draft as context. A bounded repair uses the complete recorded review. The entire revised draft
is reviewed again, including unchanged paragraphs. The final host response must distinguish a
completed workflow from an unresolved finding or an exhausted allowance.

`scripts/review-workflow.cjs` implements the orchestration and reuses the existing review/session
and repair validators. A caller sets a maximum of 1–128 native calls and zero to two repair rounds.
These per-workflow bounds do not authorize spending beyond the aggregate experiment allowance.
Before a review pass it checks whether all paragraphs fit in the remaining call allowance.
An incomplete pass is not started. A changed draft clears the old report; insufficient recheck
allowance returns `budget_exhausted`, with `workflow_complete: false`. Unresolved evidence and
exhausted repair rounds also stop without completion. Worker failures propagate without retry.
Every invocation requires a distinct transport-provided session ID. The module itself launches
no model and cannot establish session isolation without an audited native adapter.

The native adapter remains to implement. It must start new CLI sessions, pass reviewed input on
stdin, retain normal host controls and subscription authentication, enforce timeout/output bounds,
check actual session/model/effort records and account for every invocation. It must not resume the
drafting session, enable API billing or allow model output to choose commands or destinations.
The installed CLI help confirms Claude print/JSON-schema output and Codex exec/JSON-schema output.
Official references: [Claude programmatic use](https://code.claude.com/docs/en/headless) and
[Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).

## Usage projection before further model calls

The frozen subject plan needs 88 baseline, 172 original and 128 TTAK task/activation calls, plus
128 comparison grades: 516 calls before adding independent review. The remaining agreed segment
contains 543 calls, comprising 27 diagnostic/retest calls and those 516 comparison calls.

For a concrete size projection, diagnostic 46 reads the fourteen snapshot-10 pilot records.
It counts every paragraph in all responses of explanation and mixed tasks. Where the second
repetition is absent, it uses repetition 1's size only for planning; this is not evidence reuse or
fabricated trial completion. Projecting all 24 such trials gives 32 responses and 302 paragraph
reviews. New outputs and repairs can have different sizes, so these are scenarios, not bounds.

| Scenario | Projected native CLI calls |
|---|---:|
| Entire new comparison plus one independent review pass, no repairs | 818 |
| Entire new comparison plus one repair and full recheck per response, unchanged paragraph counts | 1,152 |
| First scenario with all 260 historical baseline/original calls reused, if later proven eligible | 558 |
| Second scenario with that same conditional reuse | 892 |

Even the conditional no-repair estimate exceeds the remaining 543-call segment. Reuse has not
been verified and is not assumed in execution. Grading a changed TTAK answer still requires new
comparisons. A 16-paragraph diagnostic with one repair and a same-size full recheck needs 33 calls,
which also exceeds the remaining 27 diagnostic calls. Existing results cannot justify an
unannounced allowance increase, omitted paragraphs or weaker quality criteria.

Evidence and per-trial projection inputs are in `.superpowers/workflow-budget-46/result.json`.
This calculation adds zero model calls. Complete the native adapter and its bounded local checks
first. Then use the remaining diagnostic allowance on a small integration/quality pilot; revise
the full-run usage proposal from observed workflow costs before starting the full comparison.
