# Explanation review integration

The release objective and its comparison criteria remain in [RELEASE.md](RELEASE.md).
The current candidate integrates fresh fact and final-explanation verification; its observed scope
and remaining release gates are in the [release work log](RELEASE_RESUME_2026-09-14.ko.md).
The paragraph-isolated architecture described below is historical and remains deferred.

Historical product experiment: [integrated validation 87](NATIVE_VALIDATION_87.ko.md) integrated rc.13
JSON-text normalization and passed Node 221 / Python 78 / conformance checks. Four installed
OFF/ON controls passed. The first Haiku explanation received exactly one required evidence
reconciliation and completed a revised answer, but final Q1 precision failed. Five requests were
used, seven stopped unrun, and task profiles restored. This same-model correction candidate is
not adopted as the shipping quality solution. Further native calls with it are not proposed;
no replacement design is adopted. Product code is rc.13 and No-Go. Original criteria remain.
The two-role architecture below remains deferred. No stopped ledger is authorized to resume.

Historical decision: [diagnostic 50 reassessment](RELEASE_PATH_REASSESSMENT.ko.md) separates final
product requirements from experiment-specific gates. It identifies no sufficiently grounded
new implementation candidate. Both review-integration paths remain deferred; there are no
new model calls or changes to stopped ledgers. The historical implementation sequences below
are not instructions to resume those experiments.

September 9 reassessment: the owner chose to treat this paragraph-isolated architecture as a
candidate whose adoption depends on evidence. The adapter-first sequence below records the
earlier path; it is no longer the selected next action. [Diagnostic 47 preparation](REASSESSMENT_47.ko.md)
defines a source-entailment/context-consistency role candidate, complete input packets and an
18-call maximum screen inside the remaining 27 diagnostics. No native calls were made; nine
calls remain unallocated. The subsequent [local role contract and workflow](REVIEW_ROLES.md)
implement structural validation, reconciliation and two-role rechecks; 45 related Node tests
pass. [Diagnostic 48](NATIVE_REVIEW_TRANSPORT.md) subsequently audited one actual evidence-role
call per host, including model/effort, exact prompt, Unicode and process-tree cleanup. It leaves
25 diagnostic calls (18 planned, 7 unallocated). Native context/repair cycles and semantic quality
remain unverified. Existing paragraph-runtime
modules remain unchanged, and no quality or release pass follows from this preparation.

[Diagnostic 49](ROLE_SCREEN_49.ko.md) then froze the execution inputs and introduced a shared
result-bound call ledger. Its first Claude evidence-role call omitted the mandatory U014
post-wait claim despite returning all 16 units. The candidate screen stopped after one call;
context, repair and Codex jobs were not launched. There are 24 diagnostic calls remaining.
The role candidate is not adopted for product integration.

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
