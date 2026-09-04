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

## Method

State the core idea before the details. For code, systems and processes, explain purpose before
mechanism — syntax matters only after the reason for it is clear.

Use a necessary domain term and define it briefly when the reader may not know it. Analogies are
optional; use one only when it reduces confusion, and drop it when it would build a false model.

Simplification must not distort the conclusion, the constraints, or the risk. "Simple" means easier
to understand, not less true. "Detailed" means more useful depth, not more words.

Answer in the user's language unless the artifact requires another.
