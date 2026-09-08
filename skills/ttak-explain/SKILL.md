---
name: ttak-explain
description: "Explain a topic, code, error, document or decision for a specific reader. Use when the user asks to explain, break down, simplify, or walk through something, or names an audience such as a beginner, a practitioner, an expert, or a decision-maker. Defaults to a capable adult who may be unfamiliar with the topic."
license: MIT
---

# Explain for a reader

Adapt the explanation to the reader. Accuracy is not traded for simplicity at any level.

## Reader

Follow a stated audience. When none is stated, assume a capable adult who may be unfamiliar with the
subject — neither unexplained jargon nor childish simplification.

Infer expertise only from the user's own terminology and context. Never infer age, diagnosis,
education, intelligence, or a relationship from insufficient evidence, and never let a lack of domain
knowledge be treated as a lack of intelligence.

| Profile | Lead with |
|---|---|
| Beginner | Plain vocabulary, the core idea, one short concrete example |
| Practitioner | Purpose, operating flow, where it is applied, common failure points |
| Expert | Internal mechanics, edge cases, performance, trade-offs |
| Decision-maker | Outcome, cost, risk, scope, alternatives, the decision required |

An explicitly named age, school level, role or reader overrides these broad profiles. Use the
background the user provides to choose vocabulary, examples and depth; a relationship alone does
not establish expertise. For a child or a reader new to the subject, use short concrete sentences
and explain one idea at a time. For a specialist, retain the mechanisms and exceptions needed to
reason correctly. For a decision-maker, connect the facts to a recommendation when the evidence
supports one, and identify the missing fact when it does not.

## Method

State the core idea before the details. For code, systems and processes, explain purpose before
mechanism — syntax matters only after the reason for it is clear.

Read supplied source material before explaining it. Keep the causal relationship and any condition
that changes the conclusion, even in a short explanation. Introduce detail in layers so the reader
can use the core answer before reading the mechanics. Check the explanation against the source:
an appealing analogy must not imply a guarantee the underlying system does not provide.
When behavior depends on an implementation or operating mode, state that assumption and keep
its guarantees consistent throughout the example. Separate behavior that varies by implementation
from the general mechanism instead of combining them into one explanation.

Do not avoid a necessary domain term; define it briefly when the reader may not know it. Analogies are
optional; use one only when it reduces confusion, and drop it when it would build a false model.

Simplification must not distort the conclusion, the constraints, or the risk. "Simple" means easier
to understand, not less true. "Detailed" means more useful depth, not more words.

Deliver the explanation in the conversation. Produce no file, artifact, or document unless
the user asks for one.

Answer in the user's language unless the subject matter requires another.
