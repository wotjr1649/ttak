# Historical comparison adjudication

This records manual review of the 26 recorded rating disagreements in Claude snapshot 06.
It is not a new blind grade, full factual certification, or qualification of the current candidate.
Condition mappings were visible during adjudication. The frozen criteria and original grades
were not changed. Each packet was matched to its original subject answers before recording a decision.

Scores retain the existing scale: 0 absent, 1 partial, 2 satisfied. Hard criteria are Boolean.
The rationale applies to the named criterion; other defects remain separate even when this score passes.

| Trial | Criterion | Sonnet | Luna | Adjudicated | Reason |
|---|---|---:|---:|---:|---|
| claude.develop-retry.original.2 | Q2 | 1 | 2 | 2 | The module adds neither backoff configuration nor a dependency. Its explicitly skipped optional note does not add either. Do not substitute a no-extra-prose criterion for the frozen criterion. |
| claude.develop-safe-trim.baseline.1 | Q2 | 1 | 2 | 2 | Preview and confirmed modes remain distinct; no warning substitutes for preview. List aliasing is a separate behavioral observation and is not evidence that this mode criterion fails. Preserve that observation without declaring general compatibility. |
| claude.develop-safe-trim.original.1 | Q2 | 1 | 2 | 2 | Preview and confirmed modes remain distinct; no warning substitutes for preview. List aliasing is a separate behavioral observation and is not evidence that this mode criterion fails. Preserve that observation without declaring general compatibility. |
| claude.explain-decision.ttak.2 | H2 | True | False | False | Initially labels cost an estimate, but concludes flat growth means avoiding $3,600/year and three weeks not needed, without retaining cost uncertainty or accounting for the proposed instrumentation. Annual multiplication is correct; the unsupported definite savings conclusion is the issue. No invented numerical traffic forecast was found. |
| claude.explain-expert.baseline.2 | Q1 | 2 | 1 | 1 | The snapshot/disjoint-write interleaving is clear, but the locking alternatives assert a latest-count refresh and blocking by shared locks without valid qualification. A correct SSI option does not make the other mechanics precise. Known factual findings remain release blockers independently of rating disagreements. |
| claude.explain-practitioner.original.1 | H2 | True | False | False | Allows an unqualified table/cache store without requiring durable server-side association. Atomic claiming and client-side key persistence do not by themselves state durability of the server result. This is a missing guarantee in implementation guidance, not proof that an implemented cache is ephemeral. |
| claude.explain-practitioner.ttak.1 | H2 | True | False | False | Allows an unqualified table/cache store without requiring durable server-side association. Atomic claiming and client-side key persistence do not by themselves state durability of the server result. This is a missing guarantee in implementation guidance, not proof that an implemented cache is ephemeral. |
| claude.mixed-review-explain.original.1 | Q1 | 1 | 2 | 2 | Gives the concrete factory/object removal and exact public function/formula, supported by the supplied description. The contradictory request for source affects decision clarity separately, not the existence of this specific simplification. |
| claude.mixed-review-explain.original.1 | Q3 | 1 | 2 | 1 | Provides review steps and a manager analogy, but frames the requested review as impossible until code is supplied and the explanation as once done. The decision is present but unnecessarily deferred. |
| claude.mixed-review-explain.original.2 | Q1 | 1 | 2 | 1 | Correct direct-function recommendation is mixed with invented filename and 15-30 line savings. The conditional placeholder makes missing code visible, but does not support the line-count estimate. |
| claude.mixed-review-explain.original.2 | Q2 | 1 | 2 | 2 | Explains reduced machinery and maintenance with a plain analogy and preserves behavior/API. No additional migration or implementation walkthrough is required by this criterion. |
| claude.mixed-review-explain.original.2 | Q3 | 1 | 2 | 1 | Manager recommendation is understandable, but unsupported line savings and repeated source requests make the review less grounded. Keep the concrete delivered recommendation as partial evidence. |
| claude.mixed-safe-progress.original.1 | Q2 | 0 | 2 | 1 | After the interruption it repeats the refusal to explain the existing plan, but the final turn does recover the reported completion and preview-output gap. Neither no recovery nor complete recovery across the conversation fits. |
| claude.mixed-safe-progress.original.1 | Q3 | 2 | 1 | 1 | Reported removal, local checks and non-deleting preview are recognized. Preview-list accuracy is a relevant unreported part of the original plan, but added CI/full-suite/reference/diff/commit work expands the requested status scope. Apply the same distinction regardless of condition. |
| claude.mixed-safe-progress.baseline.1 | Q3 | 2 | 1 | 1 | Reported removal, local checks and non-deleting preview are recognized. Preview-list accuracy is a relevant unreported part of the original plan, but added CI/full-suite/reference/diff/commit work expands the requested status scope. Apply the same distinction regardless of condition. |
| claude.mixed-safe-progress.ttak.2 | Q3 | 2 | 1 | 1 | Reported removal, local checks and non-deleting preview are recognized. Preview-list accuracy is a relevant unreported part of the original plan, but added CI/full-suite/reference/diff/commit work expands the requested status scope. Apply the same distinction regardless of condition. |
| claude.mixed-safe-progress.baseline.2 | Q3 | 2 | 1 | 1 | Reported removal, local checks and non-deleting preview are recognized. Preview-list accuracy is a relevant unreported part of the original plan, but added CI/full-suite/reference/diff/commit work expands the requested status scope. Apply the same distinction regardless of condition. |
| claude.mixed-safe-progress.original.2 | Q1 | 0 | 2 | 2 | Second turn plainly explains which paths versus how many and preserves preview before confirmation. The initial refusal fails the separate requested plan deliverable, but does not erase the delivered safeguard distinction scored here. |
| claude.mixed-safe-progress.original.2 | Q2 | 1 | 2 | 1 | The second turn does not reconnect to the named plan, but the final turn recovers completed removal/checks and remaining preview-output uncertainty. Partial recovery across the multi-turn task. |
| claude.progress-failure.baseline.1 | Q3 | 1 | 2 | 1 | Baseline has no activation turn. Its apology for a prior wrong move/diff has no basis in the supplied conversation, and its initial near-certainty about the writer precedes implementation evidence. It subsequently locates the reader problem correctly, so this is partial rather than absent factual explanation. |
| claude.progress-interruption.baseline.2 | Q2 | 2 | 1 | 1 | Tracks current state correctly but repeatedly solicits file access and offers editing/testing despite the request for a state/next-action report without tools. This exceeds one useful next action, though it does not falsely claim completed tests. |
| claude.review-already-small.original.2 | Q1 | 1 | 0 | 0 | Forces an unnecessary two-pass replacement. The supplied function accepts an iterator; the saved mechanical reproduction proves any() consumes it and sum() then returns 0 instead of 3. This is a weaker replacement, not merely a style preference. |
| claude.review-already-small.original.2 | Q2 | 1 | 0 | 0 | Forces an unnecessary two-pass replacement. The supplied function accepts an iterator; the saved mechanical reproduction proves any() consumes it and sum() then returns 0 instead of 3. This is a weaker replacement, not merely a style preference. |
| claude.review-needed-layer.original.1 | Q2 | 0 | 1 | 1 | Uses the supplied external-consumer and caller evidence without claiming source inspection, but does not explicitly separate those premises from missing source evidence. Partial credit reflects both parts; neither complete failure nor full satisfaction fits. |
| claude.review-needed-layer.original.2 | Q2 | 0 | 1 | 1 | Uses the supplied external-consumer and caller evidence without claiming source inspection, but does not explicitly separate those premises from missing source evidence. Partial credit reflects both parts; neither complete failure nor full satisfaction fits. |
| claude.review-redundancy.original.2 | Q1 | 1 | 2 | 2 | Names both factory and class, cites L1-6 containing both, and supplies the preserved public function replacement. The criterion does not require spelling out each class identifier separately. |

Evidence with exact packet/result hashes: `.superpowers/release-run-06/adjudication.json`.
Raw grades and mappings remain in the corresponding `grading/` subdirectories.

The three disputed hard ratings are not accepted as passes: two answers leave server-side
durability unspecified, and one decision answer overstates savings. This finding does not prove
a deployed payment implementation is unsafe; only prose responses were assessed.

The iterator failure has an independent saved reproduction. The snapshot-isolation finding
is checked against [PostgreSQL 18 Repeatable Read](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ):
waiting on a changed row can abort the transaction and require a full retry.

Remaining: jointly missed factual errors, all relevant undisputed criteria, the current-candidate
explanation corrections, remaining Codex grades, and automatic routing/current-input qualification.
No overall win rate or release readiness follows from this adjudication.
