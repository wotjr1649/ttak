---
name: ttak-explain
description: "Explain a topic, code, error, document or decision for a specific reader. Use when the user asks to explain, break down, simplify, or walk through something, or names an audience such as a beginner, a practitioner, an expert, or a decision-maker. Defaults to a capable adult who may be unfamiliar with the topic."
license: MIT
---

# Explain for the reader

Read the entire request, including prose outside supplied data. For a registered TTAK explanation
with no concrete essential evidence obstacle, start the normal `explanation_prepare` workflow:
independent facts, composition, then independent exact-final review. If a specific essential requirement
needs an unavailable input or observation, use **Missing essential evidence** below first.
Put the draft only in tool input; a draft, quotation or example in the conversation is already
visible to the reader.

Use the user's language and stated age, role and background. When none is stated,
assume a capable adult who may be unfamiliar with the subject.
Never infer age, diagnosis, education, intelligence, or a relationship from insufficient evidence.

When delivering the completed explanation, lead with the answer or conclusion the reader needs, then explain the mechanism and the
conditions that change it. Match the requested depth and format.

| Reader | Useful emphasis |
|---|---|
| Beginner | Plain vocabulary, the core idea, one short concrete example |
| Practitioner | Purpose, operating flow, where it is applied, common failure points |
| Expert | Internal mechanics, edge cases, performance, trade-offs |
| Decision-maker | Outcome, cost, risk, scope, alternatives, the decision required |

An explicit audience overrides these broad profiles. Keep facts, estimates and unknowns distinct.
Read supplied material and preserve its numbers, causal relationships and constraints. An analogy
must not add a guarantee that the real system lacks.

Prefer a conceptual example unless concrete code or configuration is requested. For a proposed
remedy, choose the number requested and establish each chosen remedy's conditions and trade-off.
An inventory of supplied sources or targets is not itself a request for an explanation of every item.
Name the implementation and operating
mode when they determine behavior; an unverified execution sequence is not a guaranteed result.
Keep the example's starting conditions, actions and outcome consistent.

For a boolean concurrency example, first inspect the `model_evidence` returned by preparation.
It locates definitions in the unchanged original and computes their bounded behavior. Use the
computed relationships and outcomes within that scope; it does not verify a real database.
The fact verifier selects source-bound model definitions for the tool to render, with only
still-needed facts as a supplement. Examine the returned account's relevance and that supplement;
computed model facts do not establish a real implementation or waive a requested observation.
For these models, `explanation_check_final` also applies the bundled prose checks separately to
your exact final text and the actual fact answers. The independent final verifier receives the
calculation and both reports; a fact report's locations refer to that fact's answer, not your draft.
No separate draft for `scenario_review` is needed for an already computed model. If preparation
did not locate the example, use `scenario_review` when available with its initial state, invariant,
guarded writes and your actual draft. Revise supported findings and recheck once if needed.
A clear partial report certifies neither the remaining prose nor the whole explanation.
For other topics, or when the tool is unavailable, assess the supplied evidence directly.

For a TTAK-bound explanation, set `attempt_id` and `candidate_sha256` both
to `current`; the normal hook resolves only this explicit pair from the active parent turn.
Adapter recipes may instead carry returned bindings programmatically. Do not transcribe
identifiers or use a new binding to restart a failed attempt.

On a code-mode host, when the selected entry's tool metadata is not already loaded, discover just that
entry so unrelated review stages do not fill the initial context:

```javascript
const entry = ALL_TOOLS.find(t => t.name === "mcp__ttak_scenario__explanation_prepare");
if (!entry) throw new Error("TTAK explanation entry unavailable");
text(entry);
```

For the **Missing essential evidence** branch, use
`mcp__ttak_scenario__explanation_assess_request` in this lookup instead. Read later-stage
metadata when the actual result's branch needs it; retain the returned complete recipes.
Keep this request's binding throughout the check:

1. Before composing the explanation, use `explanation_prepare` with `request: "current"` and the
   two binding fields only.
   When its tool metadata provides a prepare-and-first-fact entry recipe, execute that whole recipe
   in one call instead of standalone preparation. If it returns model evidence, inspect the preparation
   before step 2. Otherwise it has already run the first fact check: examine its actual result at step 3.
   The normal hook resolves the native original and checks its registered hash. The compiler
   prepares an independent factual inquiry covering the entire original
   request. Its verifier receives the original premises and sources, not a parent conclusion or a question
   list selected to match your conclusions. It derives the factual account needed for the user's
   actual scope; unused alternatives add no obligations. Model knowledge and supplied quotations
   remain evidence to assess, not factual certificates.
2. Run each prepared packet in a fresh native verifier, one at a time. Follow the available tool's
   `native_dispatch` instructions for the current host. Transfer the prepared input exactly by its
   specified retrieval or programmatic delivery path; do not copy or reconstruct a long packet yourself.
   When the adapter supplies code recipes, run each complete recipe in one call. Use its retained
   result objects for subsequent packets and the final check, rather than re-entering the results.
   A verifier's short `receipt_text` identifies its actual submission; it is not the factual answer
   or approval. Follow the adapter's `explanation_result` retrieval before using that result.
   Complete programmatic adapter recipes include this retrieval. A failed read remains a failed check.
   If result retrieval supplies `next_step`, use that current branch after examining the actual result.
   It is execution guidance, not a verdict or permission to retry a spent packet.
   Keep the template's model, scope and fresh-context settings. Wait for the
   complete result and close a separately managed agent before the next. Do not send the draft or
   sibling answers to a fact verifier. Do not replace a missing native verifier with a parent-authored
   answer, or resume an earlier verifier.
   The tool exposes only one packet. When pending question IDs remain, call `explanation_next`
   with the previous verifier's ID and result unchanged, then run the returned packet. A pending ID
   is not a launch prompt. Keep the exact result objects for the final check.
3. Send the independent factual account to its first final review before rewriting it.
   Execute the result's `next_step` recipe, or the adapter's `explanation_check_final` arguments,
   unchanged. This first call takes only four references and has no draft-text or revision input:
   the server selects every whole actual fact answer in order. The final reviewer checks accuracy,
   completeness, reader, language and format against the unchanged original request, including any
   user-supplied proposed wording. Use its findings to make necessary adaptations in step 4.
   A whole code recipe registers the proposal and runs its fresh verifier in the same call; execute it
   through result retrieval, without a second spawn. An argument-object adapter instead returns a packet
   to run in another fresh native verifier. This verifier checks the actual final text, including
   new claims and all essential requirements; a fact answer is evidence to assess, not a vote.
   Its final submission records every named review check as pass or concrete issues directly
   under that check. Code constructs the issue links. These reports do not replace the actual
   native result or recover a failed check.
4. If that decision is `complete`, copy the result retrieval's `delivery.final_text` exactly as
   the entire final message. The adapter prints this reviewed body; its scope distinguishes an
   explanation from a withholding notice. If the decision identifies a
   correctable problem, fill the result's correction recipe with the exact corrected literal when provided,
   then use `explanation_revise_final` once with `revision: 1` and
   another fresh verifier. A packet, citation, clean `scenario_review`, or parent's `supported`
   declaration cannot authorize completion; the hook requires the bound native results.

If the fact checks reveal an unresolved essential requirement, use the same withholding-review
branch. A failed tool or hook is an unavailable check, not missing user data; do not restart it by
changing the binding. A Stop continuation keeps the attempt and its spent check budget.

When those requirements are supported, finish the explanation without repetition or optional alternatives. Include
an exception when omitting it would change the conclusion. Accuracy is not traded for simplicity at any level.
Deliver the explanation in the conversation. Produce no file, artifact, or document unless the user asks for one.

## Missing essential evidence

Distinguish unavailable evidence from a settled assessment across the entire request. When the user
asks to assess a draft and the supplied material settles it, finding that the draft is wrong answers
that request. Give the supported correction; that assessment is not an unresolved requirement or a
clarification request. If an essential requirement cannot be fulfilled from the available evidence,
withhold the completed explanation and identify the genuinely unresolved requirement and evidence
needed. Acknowledging the gap does not fulfill it. Do not prepare a partial explanation or offer to
remove the requirement. A failed check needs a restored check, not evidence already supplied.
Optional alternatives add no requirements.

For a registered TTAK attempt, that concrete essential obstacle first goes to
`explanation_assess_request` with `request: "current"`. The normal hook reuses the native original
and checks the active turn's registered hash. Loaded skill and environment context are not user
input. A missing or mismatched native source is a failed check, not permission to restart.
Run its packet in a fresh native verifier using `native_dispatch`. That verifier assesses the
original request and evidence without seeing a parent notice or missing-evidence classification.
Correctly identifying a genuine gap can complete this assessment; it does not complete the user's
requested explanation. In the dedicated result, `essential_gaps` describes missing user evidence,
while `issues` describes a failure to perform the assessment itself. Keep these outcomes separate.

Use the actual `answered` assessment to decide whether withholding is needed. If no essential
gap remains, use the normal `explanation_prepare` path. Otherwise, follow the assessment adapter
to call `explanation_notice_from_assessment` with its actual `assessment_result` and the user's
language. The helper uses the unchanged cached original and transfers every structured
`essential_gaps` and `corrections` field directly into the initial notice. This avoids introducing
claims while reconstructing the assessment. Reuse this same assessment if later checks uncover an
obstacle; do not rerun it. A gap-free assessment still requires normal draft and final verification.

After the proposal, run `review.packet` in another fresh native verifier using `review.native_dispatch`.
This verifier checks the original request, exact notice and actual independent assessment. The
returned `final_text` is not yet approved. Its `complete` verdict approves only that exact
withholding notice, never the full explanation. Copy the result retrieval's `delivery.final_text`
exactly as the entire final message.
If the review returns `withheld` and every issue has `notice_correction`, run the adapter's
`explanation_repair_notice` recipe unchanged. It applies those actual review fields to `corrections`.
When an assessment was wrongly listed as unresolved, the review's exact
`notice_correction.resolves_request_quote` moves only that settled entry to corrections. All other
unresolved requirements stay unchanged. A fresh independent review still checks the entire request
and new notice; a settled assessment does not belong in missing evidence.
For other issue types, correct the notice once through `explanation_decide` with `revision: 1` and
`request: "current"`, preserving the same actual `assessment_result`. Both paths consume the same
single revision and reuse the unchanged original from the same bounded connection. The hook checks
both native reviews and resolved bytes before permitting the new verifier. A failed check or spent
budget remains unverified.
