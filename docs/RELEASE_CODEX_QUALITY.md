# Codex quality adjudication

Manual review of 25 quality-score disagreements and the separate mixed-progress H3 disagreement
in snapshot 09. This review saw condition mappings; it is not another blind grader. Frozen criteria
and source grades remain unchanged. The other eight review hard-rating disagreements are outside
this artifact.

| Trial | Criterion | Sonnet | Luna | Adjudicated | Reason |
|---|---|---:|---:|---:|---|
| codex.develop-retry.original.1 | Q1 | 1 | 2 | 2 | A bounded loop for earlier attempts plus a final uncaught call is a small direct fix. The observed behavior passes; preferring a stored last-error variable is a style preference absent from the criterion. |
| codex.develop-retry.baseline.1 | Q1 | 1 | 2 | 2 | A single loop with a final-iteration re-raise is direct. Naming its index underscore is a readability preference and does not make this a less direct fix. |
| codex.develop-retry.original.2 | Q1 | 1 | 2 | 1 | The code is small but does not fix exhaustion: bare raise outside the handler produces the observed RuntimeError. Small size alone does not establish a completed fix. |
| codex.develop-safe-trim.baseline.2 | Q1 | 0 | 2 | 1 | The function inlines reporting, but the complete returned module retains the now-unused CleanupReport definition. Static AST inspection confirms partial removal, not full removal and not zero change. |
| codex.explain-child.original.1 | Q1 | 1 | 2 | 2 | The familiar book index and dinosaur lookup give a concrete, understandable example. Updating the index explains slower changes without jargon. A numeric page mapping is not a frozen requirement. |
| codex.explain-child.original.1 | Q2 | 1 | 2 | 2 | The familiar book index and dinosaur lookup give a concrete, understandable example. Updating the index explains slower changes without jargon. A numeric page mapping is not a frozen requirement. |
| codex.explain-decision.original.2 | Q2 | 2 | 1 | 1 | Relevant cost and risk are present, but the answer opens with a fact inventory and reaches the recommendation later. Partial credit follows the explicit lead-with-outcome criterion. |
| codex.explain-decision.ttak.2 | Q2 | 1 | 2 | 2 | The opening sentence directly recommends delaying migration; measured headroom, estimated cost and uncertainty follow. A summary sentence is an outcome-led opening, not a reason to penalize it. |
| codex.mixed-review-explain.original.1 | Q2 | 1 | 2 | 2 | The technical review and the separately introduced manager explanation are understandable. The manager paragraph gives a plain department analogy and maintenance rationale; jargon in the technical section does not erase that deliverable. |
| codex.mixed-review-explain.original.1 | Q3 | 1 | 2 | 2 | The technical review and the separately introduced manager explanation are understandable. The manager paragraph gives a plain department analogy and maintenance rationale; jargon in the technical section does not erase that deliverable. |
| codex.mixed-review-explain.original.2 | Q2 | 1 | 2 | 2 | The manager paragraph plainly describes direct calculation, the preserved API/formula and reduced maintenance. Formatting issues in the preceding technical notation belong to overall clarity, not absence of an audience-appropriate explanation. |
| codex.mixed-safe-progress.original.1 | Q1 | 1 | 2 | 2 | Both the plan and follow-up explain itemized non-deleting preview versus a count and confirmation. An awkward phrase does not reverse that clearly stated distinction or require extra explanation for the supplied reader. |
| codex.mixed-safe-progress.ttak.2 | H3 | True | False | True | The first turn is explicitly a plan explanation with a future verification step. Its sentence about what verification confirms describes the purpose of that step, not a reported test execution. Actual passed tests appear only after the user reports them. Ambiguous generic phrasing is not proof of a false personal-execution claim. |
| codex.mixed-safe-progress.original.2 | Q2 | 1 | 2 | 2 | The follow-up preserves the preview safeguard and the final turn recovers the reported removal and local checks. The criterion does not require repeating the whole plan or safe-flow checklist after every interruption. |
| codex.progress-finish.ttak.2 | Q1 | 1 | 2 | 2 | The final sentence explicitly reports the rename, both passing tests and the limited diff, attributed to user evidence. A bullet list is not required to make those results visible. |
| codex.progress-interruption.original.1 | Q1 | 1 | 2 | 1 | The casefold answer does not itself reconnect to the unfinished change. The following turn does recover the goal when prompted, so recovery is partial across the conversation. |
| codex.progress-interruption.original.1 | Q2 | 1 | 2 | 2 | States completed identification, remaining rename and unrun tests, with one concrete next action. A compact existing step number does not repeat the entire plan. The unsupported time estimate is retained as a separate assumption concern. |
| codex.review-already-small.original.1 | Q2 | 1 | 2 | 2 | No abstraction or weaker replacement is proposed. The negative requirement is satisfied; thin justification belongs to Q1 and is not a separate requirement to invent a replacement. |
| codex.review-already-small.baseline.2 | Q2 | 1 | 2 | 2 | No abstraction or weaker replacement is proposed. The negative requirement is satisfied; thin justification belongs to Q1 and is not a separate requirement to invent a replacement. |
| codex.review-already-small.original.2 | Q1 | 0 | 1 | 1 | Allows a no-findings result but provides no supporting explanation. This partially satisfies the criterion; it neither justifies the result fully nor forces a harmful rewrite. |
| codex.review-already-small.original.2 | Q2 | 1 | 2 | 2 | No abstraction or weaker replacement is proposed. The negative requirement is satisfied; thin justification belongs to Q1 and is not a separate requirement to invent a replacement. |
| codex.review-needed-layer.baseline.1 | Q2 | 0 | 1 | 1 | Uses supplied consumer/caller facts and rejects deletion, but the unfulfilled inspection offer leaves the distinction from missing repository evidence unclear. Partial support is present. |
| codex.review-needed-layer.original.1 | Q2 | 1 | 0 | 1 | Explicitly bases rejection on this evidence and cites the supplied external consumers and callers. It does not explain missing source evidence. Partial credit reflects both aspects. |
| codex.review-redundancy.ttak.1 | Q1 | 2 | 1 | 2 | Identifies the uniquely named factory and converter classes in the small supplied snippet. Those identifiers locate both findings; the criterion does not require numeric line references in addition. |
| codex.review-redundancy.baseline.1 | Q1 | 2 | 1 | 2 | Identifies the uniquely named factory and converter classes in the small supplied snippet. Those identifiers locate both findings; the criterion does not require numeric line references in addition. |
| codex.review-redundancy.ttak.2 | Q3 | 1 | 2 | 2 | Preserving existing arithmetic exceptions does not claim a new correctness bug. The original arithmetic can raise for incompatible values even without explicit exception handlers. |

Each response above was matched to its original subject record. Exact result hashes:

- codex.develop-retry.original.1 Q1: `07a877251ec7d3bef676bb4c16558cc01bcfe647bb5b7c0bedd44f442652dd64`
- codex.develop-retry.baseline.1 Q1: `e0b8c2374f5a8802022993407d3484ff21996d9d1147aeab335d506995ab897a`
- codex.develop-retry.original.2 Q1: `d966cb6a8c543b567436f95abea1573add9c4c16d17056577b34e12631826df9`
- codex.develop-safe-trim.baseline.2 Q1: `3641b98081f6b34338c1a340f0da300a74dc1beb652ef274039cc42e7f13acf0`
- codex.explain-child.original.1 Q1: `8efb80565308d5ca9c2d6002a2611a158ca07f312f2a32a24a047eca5774a218`
- codex.explain-child.original.1 Q2: `8efb80565308d5ca9c2d6002a2611a158ca07f312f2a32a24a047eca5774a218`
- codex.explain-decision.original.2 Q2: `e608ced5da7bf6f5470d2099991d2803e536a8b3147229f2f756514f7a2e38b3`
- codex.explain-decision.ttak.2 Q2: `d6754caf55e14a6f1a817fd7dc76ef061579768aa5556912b2f5116ba34d2a9c`
- codex.mixed-review-explain.original.1 Q2: `13f6835afb2b7e918d1f46561da7884243dd48c0442de88b53355df49d53c1d6`
- codex.mixed-review-explain.original.1 Q3: `13f6835afb2b7e918d1f46561da7884243dd48c0442de88b53355df49d53c1d6`
- codex.mixed-review-explain.original.2 Q2: `36de6a6aea9e25d808da0bfdbf97b3a4fb93aaa47812ad227cc69759b45b7177`
- codex.mixed-safe-progress.original.1 Q1: `a3db19a9578ae6b3cd5d0356cbefe01e0762f3de23b2a8d026ded00a40abdd91`
- codex.mixed-safe-progress.ttak.2 H3: `db4bbffdff0ccbdf86e72902f4b8c58b96626063ded38b971d33a34a1684bfeb`
- codex.mixed-safe-progress.original.2 Q2: `043e16c81998e103bda1a3eab5da10ce61eedf027a42848b70d9bc8112fd9816`
- codex.progress-finish.ttak.2 Q1: `f26e3f1d04685996fe081b60346b278bb2631f034c4a39cf1166986251874a0f`
- codex.progress-interruption.original.1 Q1: `4276aeb003b2c046d12c94538adfc4ceadc2b4aa2f562bc401bd6f443d7d23f6`
- codex.progress-interruption.original.1 Q2: `4276aeb003b2c046d12c94538adfc4ceadc2b4aa2f562bc401bd6f443d7d23f6`
- codex.review-already-small.original.1 Q2: `dba2141fd88d1c5224d5610428f46f05c9baff109e23a754055502239a236011`
- codex.review-already-small.baseline.2 Q2: `8eae02c940f04da71dcbb66fa6dafa81de372888df4d1869f80dc188d080b230`
- codex.review-already-small.original.2 Q1: `9cb67dbf49aff4cac0344902831c006962eadc11aa05c8e222e5eac46a0998eb`
- codex.review-already-small.original.2 Q2: `9cb67dbf49aff4cac0344902831c006962eadc11aa05c8e222e5eac46a0998eb`
- codex.review-needed-layer.baseline.1 Q2: `2b240f841ac0137d0c6874c5c20e13dfc3af2304d55a3bde97536b5173f6b12f`
- codex.review-needed-layer.original.1 Q2: `e35955f1e258d42b7e4b57874d2fbc22a9d5d6ba1fabff5f9c85888430f6a40d`
- codex.review-redundancy.ttak.1 Q1: `1c67a93af032380ac27cfaf32e1ee234021ec0b8a5ef0a19ae4a0e0f37606efa`
- codex.review-redundancy.baseline.1 Q1: `d0006f091cfb85e94f868a80730776ba70499d7e8117e4525ce90ea2ff91e66d`
- codex.review-redundancy.ttak.2 Q3: `a0d4a9e4a5749301691178ab7e606a085cec79f27c7bde52a263e88eb409ab56`

Raw evidence: `.superpowers/release-run-09/complete-grading-audit.json` and the corresponding
`grading/<case>.<repetition>/` packet, mapping and validated-grade files.

This resolves the named disagreements only. Agreement elsewhere is not factual certification.
The eight separate review hard decisions are documented in [the release checkpoint](RELEASE.md).
The known expert explanation error and current-candidate repeated qualification remain open.
No overall quality advantage or release pass is claimed.
