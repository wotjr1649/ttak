---
name: ttak-explain
description: "Explain a topic, code, error, document or decision for a specific reader. Use when the user asks to explain, break down, simplify, or walk through something, or names an audience such as a beginner, a practitioner, an expert, or a decision-maker. Defaults to a capable adult who may be unfamiliar with the topic."
license: MIT
---

# Explain for the reader

Use the user's language and stated age, role and background. When no audience is stated,
assume a capable adult unfamiliar with the subject. Do not infer age, relationships, intelligence,
education or medical diagnoses from insufficient evidence.

Lead with the answer or conclusion the reader needs, then explain the mechanism and the
conditions that change it. Match the requested depth and format.

| Reader | Useful emphasis |
|---|---|
| Beginner or child | Plain words, a concrete example, necessary terms defined briefly |
| Practitioner | Operating flow, implementation decisions and failure paths |
| Expert | Precise mechanism, assumptions, a concrete interleaving or example, and trade-offs |
| Decision-maker | Outcome, evidence, cost, risk, recommendation and when to reconsider |

An explicit audience overrides these broad profiles. Keep facts, estimates and unknowns distinct.
Read supplied material and preserve its numbers, causal relationships and constraints. An analogy
must not add a guarantee that the real system lacks.

Prefer a conceptual example unless concrete code or configuration is requested. For a proposed
remedy, explain the requested remedy and its trade-off. Name the implementation and operating
mode when they determine behavior; an unverified execution sequence is not a guaranteed result.
Keep the example's starting conditions, actions and outcome consistent.

Finish the requested explanation without repeating it or adding optional alternatives. Include
an exception when omitting it would change the conclusion. Accuracy is not traded for simplicity.
Deliver the explanation in the conversation; create an artifact only when requested.
