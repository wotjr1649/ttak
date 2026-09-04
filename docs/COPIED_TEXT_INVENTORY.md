# Copied-text inventory

`[LIC-001]` requires that copied source text be tracked. `ATTRIBUTIONS.md` is a notice file and does
not satisfy that requirement; this is the tracking file. `[LIC-007]` (choose the final licence only
after the copied-content review) and `[AC-012]` (close the licence and attribution review before
redistribution) are blocked until the review this file feeds has been performed by a human.

**This file records what was measured. It does not close `[AC-012]`.** See *Findings* at the end.

## Controller ruling: v0.2 §19.3 is not satisfied, and is not being fixed by rewriting

Recorded on the face of this file rather than buried in a finding, because a normative MUST that the
shipped product breaks is not something to leave implied.

**The deviation.** v0.2 §19.3 requires that policy text be derived from the upstream `SKILL.md` files
directly, not from `SRC-LEANCLARITY`'s policy files, so that the attribution chain is one step.
`policy/invariants.md` and `policy/contract.md` do not meet that. They reproduce
`SRC-LEANCLARITY`'s `policies/engineering.md` and `policies/guidance.md` at `7dfe5b2`, bullet for
bullet, with shared runs reaching 18 words. Measured evidence is in F1. **§19.3 as written is not
satisfied for those two files.**

**The chain those two files actually have, stated in full:**

```
ponytail   @ 2ed6c52  ─┐
                       ├─→  leanclarity policies/*.md @ 7dfe5b2  ─→  TTAK policy/invariants.md
i-have-adhd @ cbe69fb8 ─┘                                            TTAK policy/contract.md
```

Two steps, not one. Both `i-have-adhd` pins are therefore live for `policy/contract.md`:
`cbe69fb83c08a37cf54d5ec9ec6bb88c8bc9973c`, the commit the predecessor's own
`THIRD_PARTY_NOTICES.md` records for the text it derived, and
`58494af57962b2d7a996b4d419474380a299af5e`, the v0.2 §5.1 pin against which this inventory's upstream
line citations were read. `ATTRIBUTIONS.md` records the same pair, in the shape the predecessor's
notice file uses for its own sources.

`policy/precedence.md` and `skills/ttak-explain/SKILL.md` are **not** affected: both were derived as
§19.3 requires, and both measure at a three-word longest shared run against any source.

**The ruling: amend, do not rewrite.** §19.3 had two purposes. The first — restoring the units the
predecessor deliberately dropped, above all the precedence clause — is achieved, and the three-word
figure for `precedence.md` makes it measurable rather than asserted. The second — a one-step chain —
is not. Re-deriving the two files now would discard text a reviewer verified character-identical to
its specification, and would run straight at a failure this project has already documented: the
predecessor's own compression rewrote these bullets and broke 14 of 19 deterministic assertions by
dropping the enumerated nouns. Trading verified text for a cleaner provenance line is a bad trade
when every party in the chain is the same author under the same licence.

**What this ruling does not do.** It does not make the artifact conform. **A v0.3 amendment must
reconcile §19.3 with the artifact** — either by scoping the direct-derivation requirement to the
files that meet it and recording the two-step chain for the other two, or by some other wording the
shipped text actually satisfies. Until that amendment lands, this project ships a product that breaks
one of its own MUSTs, and that fact belongs to `[AC-012]`, which stays open.

## Scope

Every paragraph or bullet of the instruction text TTAK ships:

- `policy/precedence.md` (3 paragraphs)
- `policy/invariants.md` (8 bullets)
- `policy/contract.md` (9 bullets)
- `skills/ttak-explain/SKILL.md` (frontmatter + 11 body units)

Not in scope: documentation, tests, manifests, and the hook runtime, none of which reproduce source
text. `README.md` and `README.ko.md` are covered by a single row at the end.

## Sources and pinned revisions

| Source | Repository | Pinned revision | Licence at that revision |
|---|---|---|---|
| `SRC-PONYTAIL` | `github.com/DietrichGebert/ponytail` | `2ed6c52c9d7e5e56942508591085fd45dea277d3` | MIT, holder `DietrichGebert` |
| `SRC-IHAVEADHD` | `github.com/ayghri/i-have-adhd` | `58494af57962b2d7a996b4d419474380a299af5e` | MIT, holder `Ayoub Ghriss` |
| `SRC-DREAMBIG-ELI5` | `github.com/DreambigOu/ELI5` | `a766623b062331fdde53467001379b4ddf3acc2f` | MIT, **no holder named** |
| `SRC-LEANCLARITY` | `github.com/wotjr1649/leanclarity` | `7dfe5b2e25166e91069034038ac59121f771e844` | MIT, holder `LeanClarity contributors` |

Every source file cited below was read at the pinned revision in a local checkout whose `HEAD`
matches that revision with a clean tree. Cited line numbers are line numbers in those files.

### The two `i-have-adhd` pins

Two pinned revisions exist for one source and both belong in the record, per v0.2 section 19.3:

- v0.2 section 5.1 pins `58494af57962b2d7a996b4d419474380a299af5e` (2026-09-01). This is the
  direct-upstream pin.
- `SRC-LEANCLARITY`'s own `THIRD_PARTY_NOTICES.md` pins
  `cbe69fb83c08a37cf54d5ec9ec6bb88c8bc9973c`, an earlier commit, for the text it derived.

Where TTAK text derives directly from the upstream `SKILL.md`, **`58494af...` is the chain that
applies** and `cbe69fb8...` is recorded only as context. Where TTAK text reaches it through
`SRC-LEANCLARITY` — which the *Findings* section shows is the case for `policy/contract.md` — the
chain is two steps and **both pins apply**: `cbe69fb8...` for the upstream text as the predecessor
read it, and `7dfe5b2...` for the intermediate expression TTAK actually reproduces.

## Method

Two instruments, both reproducible:

1. **Reading.** Each source file was read in full at its pinned revision before any provenance claim
   below was written. (An earlier task in this project asserted a provenance without reading the
   source; the correction was to cite line numbers. Every row here cites lines.)
2. **Longest shared word run.** Each TTAK unit was compared against each candidate source by longest
   contiguous common word sequence, case-folded and punctuation-stripped. The figure in the
   *Longest run* column is that length in words, with the matched text quoted where it is material.
   It is evidence, not a verdict: a long run of ordinary words can be coincidence and a short run can
   still be reproduction. It is reported because "this is my own wording" is otherwise unfalsifiable.

## Classification key

| Term | Meaning |
|---|---|
| **Independent re-expression** | The idea comes from the source; the words do not. Nothing is reproduced. |
| **Reproduced expression** | Source wording is carried, in whole or in a phrase long enough to be the source's expression rather than a shared technical term. Requires the notice in `ATTRIBUTIONS.md`. |
| **Original** | No source. TTAK-only. |

Verdicts: `OK` — no obligation beyond the notices already reproduced. `DEFECT` — reproduced
expression that also breaches a normative obligation of this specification; ruled on above.

### The three places where wording deliberately tracks upstream

The plan named two. Reading found a third. All three are listed together here so the set is stated
once and in full:

| Row | What tracks | Why it is deliberate |
|---|---|---|
| I4 | The reuse-order chain | The order is the product decision; the wording carries it. `standard library` is a `[SRC-002]` protected noun |
| I7 | The protected-noun list | `[SRC-002]` exempts these nouns from paraphrase, and the predecessor's evidence records that rewording this line breaks 14 of 19 deterministic assertions |
| I8 | `ponytail`'s "a branch, a loop, a parser, a money/security path" enumeration | Not anticipated by the plan; found by measurement. A short functional enumeration, reproduced with one connective changed. See F3 |

---

## `policy/precedence.md`

Composed into every injection, main and subagent.

| # | Unit | Derives from | Longest run | Classification | Verdict |
|---|---|---|---|---|---|
| P1 | "This guidance ranks below the host's own system and developer instructions..." | Concept from `i-have-adhd/skills/i-have-adhd/SKILL.md` L126 ("Inside an agent harness, the system prompt outranks this skill") and L125 ("the task wins; the shape stays"); user-authority half from `ponytail/skills/ponytail/SKILL.md` L94-95 ("User insists on the full version, build it, no re-arguing") | 3 w | Independent re-expression | OK |
| P2 | "It is guidance the model interprets. It is not a guard, not an enforcement mechanism..." | No upstream analogue. Nearest published statement of the same idea is the author's own `SRC-LEANCLARITY` `README.md` at `7dfe5b2` ("None of these instruction sets is a guard"); the wording here is not taken from it | 3 w | Original | OK |
| P3 | "Simplicity never outranks correctness, safety, completeness, or an explicit requirement..." | Concept from `ponytail` SKILL L92-95 ("Never simplify away... anything explicitly requested"); the quality hierarchy is v0.2 section 3.4, TTAK-original | 2 w | Independent re-expression | OK |

`precedence.md` is the file the design calls the substantive difference from every predecessor, and
the measurement supports that claim: its longest shared run against any of the five candidate source
files is three words. Nothing in it is reproduced from anywhere.

---

## `policy/invariants.md`

| # | Unit | Derives from | Longest run | Classification | Verdict |
|---|---|---|---|---|---|
| I1 | "Understand the request and the flow it touches before changing anything. Inspect the callers and shared paths..." | `SRC-LEANCLARITY` `policies/engineering.md` L3; upstream idea in `ponytail` SKILL L97-101 ("Trace the whole thing first, every file the change touches, the actual flow") and L50-54 ("grep every caller of the function you're about to touch") | 5 w vs leanclarity: "before changing a shared contract" | Reproduced expression (intermediate) | DEFECT, see F1 |
| I2 | "When only analysis, explanation, reporting or review was asked for, do not mutate code..." — this is `[TTAK-TRIM-009]` | `SRC-LEANCLARITY` `policies/engineering.md` L4. No upstream `SKILL.md` states this rule; v0.2 section 5.1 records it as reaching that source from `SRC-IHAVEADHD`, and reading `i-have-adhd` SKILL at `58494af` does not find it — the nearest, L121, is about explanation length, not about refusing to mutate | 5 w vs leanclarity: "analysis explanation reporting or review" | Reproduced expression (intermediate) | DEFECT, see F1 and F2 |
| I3 | "Skip features, files, options and scaffolding the requested outcome does not need." | `SRC-LEANCLARITY` `policies/engineering.md` L5; upstream idea in `ponytail` SKILL L36 (ladder rung 1, YAGNI) and L59 ("no scaffolding 'for later'") | 3 w | Independent re-expression | OK |
| I4 | **The reuse-order chain.** "Prefer, in order: existing project code, the standard library, native platform features, an already-installed dependency, then the smallest new implementation..." | `SRC-LEANCLARITY` `policies/engineering.md` L6, which itself carries `ponytail` SKILL L37-L42 (ladder rungs 2-7) in the same order. Restated as v0.2 section 8.3 | **18 w** vs leanclarity: "prefer in order existing project code the standard library native platform features an already installed dependency then the" | **Reproduced expression** — deliberate; the order is the product decision and the wording tracks it | DEFECT, see F1 |
| I5 | "Do not add a single-use abstraction, future-only configuration, wrapper, factory, or file split without a present reason." | `SRC-LEANCLARITY` `policies/engineering.md` L7 (one-use to single-use, "provider" dropped, need to reason); upstream idea in `ponytail` SKILL L58 | 7 w vs leanclarity: "factory or file split without a present" | Reproduced expression (intermediate) | DEFECT, see F1 |
| I6 | "Fix the smallest shared root cause rather than patching the reported symptom. Optimize for the smallest correct change, not the shortest-looking diff." | `SRC-LEANCLARITY` `policies/engineering.md` L8; upstream idea in `ponytail` SKILL L50-54. The second sentence deliberately **contradicts** `ponytail` SKILL L61 ("Shortest working diff wins"), per v0.2 section 5.3 Adapt | **14 w** vs leanclarity: "the reported symptom optimize for the smallest correct change not the shortest looking diff" | **Reproduced expression** | DEFECT, see F1 |
| I7 | **The protected-noun list.** "Never simplify away trust-boundary validation, security controls, correctness guards, data-loss prevention, accessibility, or the failure handling that protects the result. Never simplify away anything the user explicitly asked for..." | `SRC-LEANCLARITY` `policies/engineering.md` L9 for the noun list; the second sentence comes from `ponytail` SKILL L92-95 ("anything explicitly requested. User insists on the full version, build it, no re-arguing"), which `SRC-LEANCLARITY` had dropped | **15 w** vs leanclarity: "never simplify away trust boundary validation security controls correctness guards data loss prevention accessibility or"; 5 w vs `ponytail`: "the user explicitly asked for" | **Reproduced expression** — deliberate and mandated: `[SRC-002]` exempts `standard library`, `trust-boundary validation`, `data-loss prevention`, `accessibility` and `explicit output formats` from paraphrase, and the predecessor's own evidence records that rewriting this line breaks 14 of 19 deterministic assertions | DEFECT, see F1. The *preservation* is required; the *route* is not |
| I8 | "For a non-trivial change — a branch, a loop, a parser, a money or security path — leave the smallest runnable check that would fail if the behavior regressed." | `SRC-LEANCLARITY` `policies/engineering.md` L10 for the clause; the enumeration comes from `ponytail` SKILL L107-108 ("Non-trivial logic (a branch, a loop, a parser, a money/security path) leaves ONE runnable check behind") | **13 w** vs leanclarity: "path leave the smallest runnable check that would fail if the behavior regressed"; **8 w** vs `ponytail`: "a branch a loop a parser a money" | **Reproduced expression** — from two sources at once; the 8-word enumeration is `ponytail`'s, reproduced with one connective changed | DEFECT, see F1 and F3 |

---

## `policy/contract.md`

| # | Unit | Derives from | Longest run | Classification | Verdict |
|---|---|---|---|---|---|
| C1 | "Lead with the answer, conclusion, code, cause or action the request calls for." | `i-have-adhd` SKILL L33-40 (Rule 1, "Lead with the next action"), generalized per v0.2 section 5.4 Adapt; `SRC-LEANCLARITY` `policies/guidance.md` L3 states the same generalization | 3 w: "lead with the" | Independent re-expression | OK |
| C2 | "Use numbered steps only for genuinely multi-step work, one action per step." | `SRC-LEANCLARITY` `policies/guidance.md` L4; upstream in `i-have-adhd` SKILL L42-46 (Rule 2) | 7 w vs leanclarity: "steps only for genuinely multi step work" | Reproduced expression (intermediate) | DEFECT, see F1 |
| C3 | "Finish the current request before raising a separate concern, and label it separately." | `SRC-LEANCLARITY` `policies/guidance.md` L5 (tangent to concern); upstream in `i-have-adhd` SKILL L64-69 (Rule 4) | 8 w vs leanclarity: "finish the current request before raising a separate" | Reproduced expression (intermediate) | DEFECT, see F1 |
| C4 | "Honor explicit output formats. When detail, a walkthrough or an exhaustive review is asked for, give it in full without an arbitrary brevity or list limit." | `SRC-LEANCLARITY` `policies/guidance.md` L8; "give it in full" is `ponytail` SKILL L73. Deliberately rejects `i-have-adhd` SKILL L103 ("Cap lists at 5 items"), per v0.2 section 5.4 Exclude. `explicit output formats` is a `[SRC-002]` protected noun | 7 w vs leanclarity: "detail a walkthrough or an exhaustive review"; 4 w vs `ponytail`: "give it in full" | Reproduced expression (intermediate) | DEFECT, see F1 |
| C5 | "Distinguish checks that were run and observed from checks that were not. Never report a check as passing unless it ran and the result was seen..." — the verification-honesty clause | `SRC-LEANCLARITY` `policies/guidance.md` L9. **No upstream `SKILL.md` contains this rule**; it originates with the predecessor. `[SRC-002]` requires it be preserved in meaning rather than paraphrased for style | 8 w vs leanclarity: "never report a check as passing unless it" | Reproduced expression, sole source `SRC-LEANCLARITY` | DEFECT, see F1 and F2 |
| C6 | "Disclose material uncertainty, unverified assumptions and remaining limitations." | No source reproduces. Concept adjacent to `i-have-adhd` SKILL L135 ("Keep a hedge that carries real uncertainty; deleting it manufactures confidence") | 1 w | Original | OK |
| C7 | "Give one concrete next action only when work remains for the user." — `[RESP-007]` | `SRC-LEANCLARITY` `policies/guidance.md` L7, **minus** its trailing clause "do not invent one after completion"; upstream in `i-have-adhd` SKILL L57-59 (Rule 3), minus its under-two-minutes cap | **12 w** vs leanclarity: "give one concrete next action only when work remains for the user"; 4 w vs `i-have-adhd`: "one concrete next action" | **Reproduced expression** | DEFECT, see F1. The dropped clause is deliberate: the v0.2 amendment records it failing 6 of 6 across two hosts as a prohibition the upstream did not have |
| C8 | "After repeated attempts fail for the same reason, stop iterating, name the assumption now in doubt, and ask for the smallest diagnostic evidence that would settle it." — `[TTAK-TRACK-008]` | `SRC-LEANCLARITY` `policies/guidance.md` L11; upstream in `i-have-adhd` SKILL L123 ("If the last three turns have been 'still broken,' stop iterating on code. Name the assumption that might be wrong. Ask one diagnostic question") | 9 w vs leanclarity: "after repeated attempts fail for the same reason stop"; 3 w vs `i-have-adhd`: "name the assumption" | Reproduced expression (intermediate) | DEFECT, see F1 |
| C9 | "Confirm before a destructive effect." | `SRC-LEANCLARITY` `policies/guidance.md` L10, first sentence **verbatim**; upstream in `i-have-adhd` SKILL L122 (rule-break 2) | **5 w, the whole sentence**: "confirm before a destructive effect" | **Reproduced expression** | DEFECT, see F1. A five-word functional instruction; the shortest reproduction here and the least material one |

---

## `skills/ttak-explain/SKILL.md`

| # | Unit | Derives from | Longest run | Classification | Verdict |
|---|---|---|---|---|---|
| E1 | Frontmatter `description` | Trigger-term pattern from `ELI5/skills/eli5/SKILL.md` L3; the terms themselves ("explain", "break down", "simplify") are the ordinary vocabulary of the task | 4 w: "user asks to explain" (`i-have-adhd` L121) | Independent re-expression | OK |
| E2 | "Adapt the explanation to the reader. Accuracy is not traded for simplicity at any level." | Deliberately **inverts** `ELI5` SKILL L115 ("Getting the core idea across at 80% accuracy is better than a 100% accurate explanation that loses the audience"), per v0.2 section 5.5 Exclude | 2 w | Independent re-expression (inverted) | OK |
| E3 | "Follow a stated audience. When none is stated, assume a capable adult who may be unfamiliar with the subject..." | Deliberately **inverts** `ELI5` SKILL L50 ("If the audience isn't explicitly stated, default to 'Age 5'"), per v0.2 section 5.5 Exclude | 2 w | Independent re-expression (inverted) | OK |
| E4 | "Infer expertise only from the user's own terminology and context. Never infer age, diagnosis, education, intelligence, or a relationship..." | TTAK safeguard written **against** `ELI5` SKILL L14-L49 (the Ages, Grade, Job Role and Relationship tables) and against `i-have-adhd` SKILL L13's premise that the reader has a named condition. v0.2 section 11.3 | 3 w | Original | OK |
| E5 | The four-profile table (Beginner / Practitioner / Expert / Decision-maker) | Table *structure* follows `ELI5` SKILL L32-40 (Job Roles) and L71-89 (Language Calibration); many categories reduced to four per v0.2 section 5.5 Adapt. Cell text independently written: the Decision-maker row shares only "risk" and "cost" with ELI5's Manager row at L35, and the Expert row shares only "trade-offs, edge cases" with L81 | 3 w: "the core idea" | Independent re-expression | OK |
| E6 | "State the core idea before the details." | `ELI5` SKILL L66 ("Start with the 'what', one sentence that captures the essence"). This is the big-picture-first item that v0.2 section 5.6 reattributed to this source after a reviewer required the line citation | 3 w: "the core idea" | Independent re-expression | OK |
| E7 | "For code, systems and processes, explain purpose before mechanism — syntax matters only after the reason for it is clear." | `ELI5` SKILL L114 ("always explain the *purpose* first, then the mechanism. Nobody cares about syntax until they know why it exists") | 2 w, but shares the ordered triad purpose - mechanism - syntax and the argument built on it | Independent re-expression, **closest row in this file**; recorded rather than glossed | OK |
| E8 | "Do not avoid a necessary domain term; define it briefly when the reader may not know it." | Softens `ELI5` SKILL L26 and L74 ("avoid jargon entirely"; "No jargon. Zero. If a technical term is essential, define it immediately") | 3 w | Independent re-expression | OK |
| E9 | "Analogies are optional; use one only when it reduces confusion, and drop it when it would build a false model." | Deliberately **demotes** `ELI5` SKILL L67, where an analogy is a mandatory structural step, per v0.2 section 5.5 Exclude | 3 w | Independent re-expression (inverted) | OK |
| E10 | "Simplification must not distort the conclusion, the constraints, or the risk. 'Simple' means easier to understand, not less true..." | No source. Written against `ELI5` SKILL L115 | 2 w | Original | OK |
| E11 | "Deliver the explanation in the conversation. Produce no file, artifact, or document unless the user asks for one." | No source. Product boundary; v0.2 section 18.1 records that the HTML and picture-artifact convention this excludes is no longer traced to a retained TTAK source | 2 w | Original | OK |
| E12 | "Answer in the user's language unless the subject matter requires another." | No source. v0.2 section 0.3 bilingual policy | 3 w | Original | OK |

**The explainer is clean.** Its longest shared run with any candidate source, anywhere in the body,
is three words. Every substantive relationship to `SRC-DREAMBIG-ELI5` is an inversion of it.

---

## `skills/ponytail-review/SKILL.md`

**Not carried in v1.** `TTAK Review` is deferred to v1.1 (v0.2 section 9.2), so no Review material
ships: no `[CAP-REVIEW-001]`...`[CAP-REVIEW-007]` text, no verdict vocabulary, no finding format.
Read at `2ed6c52...` and compared against the shipped tree: none of its format (the `delete:`,
`stdlib:`, `native:`, `yagni:` and `shrink:` tags, or the `L<line>: <tag> <what>. <replacement>.`
line shape) appears anywhere in TTAK. `[CAP-REVIEW-007]` ("a lean artifact MUST be allowed to pass")
corresponds to that skill's lean-artifact rule and is a **specification** requirement only; it is in
no shipped instruction file. Recorded here so v1.1 starts from a stated baseline rather than
re-deriving one. If Review material is carried in v1.1, this row becomes a derivation source and
`ATTRIBUTIONS.md` must list the file, per v0.2 section 19.3.

## `README.md` and `README.ko.md`

The measurement paragraphs restate published figures from `SRC-LEANCLARITY` — the null behaviour
result, the failed behaviour gate, the composition figure and its correction — read at `7dfe5b2` in
that project's `docs/evidence/LeanClarity_v1.0_GO_EVIDENCE.md` (L180-L205, L259, L554, L922) and its
`README.md` (L120-L131). Figures are facts, not expression; the sentences carrying them here were
written for this file. The nearest overlap is the idea "none of these instruction sets is a guard",
which TTAK states as "not a guard" — the same phrase already in `policy/precedence.md` (P2). No
sentence is reproduced. Classification: independent re-expression. Verdict: OK.

---

## Findings

### F1 — `policy/invariants.md` and `policy/contract.md` reproduce the predecessor's policy files rather than deriving from the upstream `SKILL.md` files

**This is a normative conformance defect, not a licence violation.** It is the reason this file does
not close `[AC-012]` by itself. **Ruled on in fix round 1: amend, do not rewrite** — the ruling, the
two-step chain and the v0.3 requirement are recorded at the top of this file. What follows is the
measurement the ruling rests on.

v0.2 section 19.3 states: "Policy text MUST be derived from the upstream `SKILL.md` files directly,
not from `SRC-LEANCLARITY`'s policy files", with the stated purpose that "direct derivation makes the
attribution chain one step instead of two." The design document repeats it at section 5.4.

Measured, the shipped text does not meet that. `policy/invariants.md` aligns bullet-for-bullet, in
the same order, with `SRC-LEANCLARITY` `policies/engineering.md` at `7dfe5b2` — 8 of 8 bullets — and
`policy/contract.md` aligns with `policies/guidance.md` for 8 of its 9. Longest shared runs against
the predecessor reach **18, 15, 14, 13 and 12 words**. Against the upstream `SKILL.md` files the
longest run anywhere in either file is **8 words**, and most are 2 to 4.

For contrast, measured the same way: `policy/precedence.md` tops out at 3 words against any source
and `skills/ttak-explain/SKILL.md` at 3 words in the body. Both of those were derived as section 19.3
requires. The defect is specific to the two files, not to the project's method.

Consequences, separated:

- **Licence.** None outstanding. `SRC-LEANCLARITY` is MIT at the pinned revision, its notice is
  reproduced verbatim in `ATTRIBUTIONS.md`, and the artifacts derived from it are named there. MIT's
  only condition on reproduction is the notice, and it is met. `[LIC-002]` and `[SRC-003]` are
  satisfied for this text.
- **Specification.** `[SRC-001]`, `[SRC-002]` and the section 19.3 derivation obligation are **not**
  satisfied for these two files. Their attribution chain is two steps, which is what section 19.3
  exists to prevent.
- **Provenance accuracy.** The two-step chain also means both `i-have-adhd` pins apply to
  `policy/contract.md`, not `58494af...` alone. Recorded above.

**Resolution.** Not remediated by rewriting. The controller ruled to accept the two-step chain,
record it, and reconcile the requirement in a v0.3 amendment; see the ruling at the top of this file
for the reasoning and for what the amendment must still do. `[AC-012]` stays open until that
amendment lands and a human closes the review.

### F2 — Two shipped rules have no upstream `SKILL.md` source at all

`policy/invariants.md` I2 (`[TTAK-TRIM-009]`, the analysis-only rule) and `policy/contract.md` C5
(the verification-honesty clause) exist in `SRC-LEANCLARITY`'s policy files and in no upstream
`SKILL.md` at either pinned revision. v0.2 section 5.1 describes `[TTAK-TRACK-008]` and
`[TTAK-TRIM-009]` as "rules restored here that reached this source from `SRC-IHAVEADHD`". For
`[TTAK-TRACK-008]` (C8) that is accurate: `i-have-adhd` SKILL L123 is the source. For
`[TTAK-TRIM-009]` it is not — reading `i-have-adhd` SKILL at `58494af...` in full finds no
analysis-only rule, and the nearest, L121, is about explanation length.

**Confirmed against the predecessor's own decomposition**, which was written to answer exactly this
question. `docs/evidence/LeanClarity_v1.0_UPSTREAM_DECOMPOSITION.md` at `7dfe5b2` marks both rules as
having no upstream source at all:

- L84, row `E2` (the analysis-only rule, TTAK's I2): source recorded as
  `원본 없음 — LeanClarity 신규` — "no original; new in LeanClarity".
- L97, row `G7` (the verification-honesty clause, TTAK's C5): the same,
  `원본 없음 — LeanClarity 신규`.

So both rules originate with the predecessor and neither reaches TTAK from `SRC-IHAVEADHD`. v0.2
section 5.1 over-attributes one of them upstream. **The controller has accepted this and the
specification correction is pending**; it is not corrected in this file, and it must not be corrected
by inventing an upstream line.

### F3 — A third place where wording deliberately tracks upstream

The plan named two: the reuse-order chain (I4) and the protected-noun list (I7). Reading found a
third. `policy/invariants.md` I8 reproduces `ponytail` SKILL L107-108's enumeration "a branch, a
loop, a parser, a money/security path" as "a branch, a loop, a parser, a money or security path" — an
8-word run changed by one connective. It is a short functional enumeration, MIT, and covered by the
`ponytail` notice already reproduced in `ATTRIBUTIONS.md`, so nothing further is required for the
licence. It is recorded because the inventory's value is that its list is complete, not that it
matches the list someone expected.

### F4 — `SRC-DREAMBIG-ELI5` names no copyright holder

`DreambigOu/ELI5`'s `LICENSE` at `a766623...` reads `Copyright (c) 2026` with no holder, and its
`skills/eli5/SKILL.md` carries no `license` key in its frontmatter, so that skill file's licence
coverage rests entirely on the repository `LICENSE`. `ATTRIBUTIONS.md` reproduces the notice exactly
as published and states the fact; it does not repair it, because naming a holder the file does not
name would be a false attribution statement. TTAK ships no reproduced expression from this source
(every `skills/ttak-explain/SKILL.md` row above is re-expression or original, longest body run three
words), so nothing turns on it today. Under `[LIC-008]` this is an unresolved licence interpretation
and is escalated rather than decided here.

## Status

| Requirement | State |
|---|---|
| `[LIC-001]` copied text tracked | Satisfied by this file |
| `[LIC-002]` MIT notices retained for copied material | Satisfied, four notices verbatim in `ATTRIBUTIONS.md` |
| `[LIC-003]` Apache-2.0 handling | Not applicable, no Apache-2.0 material |
| `[LIC-005]` complete third-party attribution file | Satisfied by `ATTRIBUTIONS.md` |
| `[LIC-006]` no implied endorsement | Satisfied: attribution appears only in `ATTRIBUTIONS.md` and README prose, and no manifest names an upstream project (asserted by test) |
| v0.2 section 19.3 direct derivation | **Not satisfied** for `policy/invariants.md` and `policy/contract.md`. Ruled: amend, do not rewrite. A v0.3 amendment must reconcile it |
| v0.2 section 5.1 upstream attribution of `[TTAK-TRIM-009]` | **Incorrect.** Specification correction pending with the controller (F2) |
| `[LIC-007]` final licence chosen after review | **Open** — the review has its input now; F1 is ruled, F4 is not |
| `[LIC-008]` escalate unresolved interpretation | F4 escalated |
| `[AC-012]` licence and attribution review closed | **Open** — needs the v0.3 amendment and a human ruling on F4 |
