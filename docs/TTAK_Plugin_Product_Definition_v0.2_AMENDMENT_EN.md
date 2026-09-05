# TTAK Plugin Product Definition — v0.2 Amendment

> **Applied on 2026-09-04.** This amendment was approved and applied in full per §8. The resulting normative text is `TTAK_Plugin_Product_Definition_v0.2_EN.md`, with `TTAK_Plugin_Product_Definition_v0.2_KO.md` as its official translation. This document is retained as the record of what changed and why.

| Field | Value |
|---|---|
| Status | Applied |
| Amends | `TTAK_Plugin_Product_Definition_v0.1_CANDIDATE_EN.md` (normative) and `..._KO.md` (translation), renamed on application to `TTAK_Plugin_Product_Definition_v0.2_EN.md` and `..._v0.2_KO.md` |
| Date | 2026-09-04 |
| Normative language | English |
| Authority | `[HANDOFF-005]` — platform constraints MAY trigger a proposed product amendment but MUST NOT silently rewrite a requirement. This document exists so that no change is silent. |
| Evidence | `docs/analysis/2026-09-04_TTAK_DESIGN_REVIEW_PACKET.md` and the four adversarial reviews of it |
| Applied? | Yes, on 2026-09-04. Section 8 gives the application procedure that was followed. |

---

## 0. Why this amendment exists

The v0.1 candidate was written before either host was inspected and before the author's own prior
plugin was accounted for. Four independent adversarial reviews of the derived design — a spec
compliance audit, a second-model design review, a platform technical verification, and a product and
licensing attack — produced findings that cannot be absorbed by an implementation plan because they
change product requirements.

`[HANDOFF-004]` requires the platform analysis to identify unsupported or conflicting requirements
explicitly, and `[HANDOFF-005]` forbids rewriting a requirement silently. The design review packet
failed both: it recorded ten decisions with no requirement-ID column, and the compliance audit found
twenty requirements changed without declaration. This document is the correction. Every change below
names the requirement it touches.

Everything here has now been applied; the v0.1 files became the v0.2 files on 2026-09-04.

---

## 1. Evidence that forces amendment

Five findings are load-bearing. Each was verified by execution or by reading a primary source; none
is inferred from documentation alone.

### 1.1 The author's prior plugin is a source, and its measurements are inherited

`leanclarity` (`github.com/wotjr1649/leanclarity`, MIT, same author) consolidates Ponytail and
i-have-adhd for the same two hosts on the same Windows target. It is currently installed and enabled
in Codex and installed and disabled in Claude Code on the development machine.

Cited at commit `7dfe5b2`, one commit past the `v1.0.3` tag, not at `v1.0.2`. The manifest still
declares `1.0.2` there, so the version string does not identify the source basis and the commit is
the pin (§5.1 of the amended specification records the same). This matters for the composition figure
below: the `v1.0.2` release published *thirteen* of twenty-four, and the commit tagged `v1.0.3` —
"Correct a published safety number that counted observation failures as removals" — lowered it to
eight of twenty-four. The number used here is that published correction.

Its published measurements:

- Context: 11,584 characters of upstream guidance reduced to 2,486 — but its own evidence file records
  that this is **≈620 tokens, 0.06% of a 1M context window, on the order of $0.002 per session.** The
  percentage is large; the base is negligible.
- Behavior: two paired ON/OFF studies found no resolvable difference. All eight case×host cells
  returned Fisher `p = 1.0000`.
- Its own behavior gate `LCL-BEH-001` is `FAIL`: five of seventeen frozen cases do not pass.
- Composition: with Ponytail loaded alongside at high reasoning effort, asked to shorten a
  record-deleting function, data-loss guards were observed removed in 8 of 24 runs — itself a
  published correction of an earlier 13 of 24, which had counted observation failures as removals.
  **The rate was the same whether LeanClarity was ON or OFF.**

That last clause matters and was initially misread. The measured unsafe composition was caused by
Ponytail plus high effort. Superseding LeanClarity does not remove it. TTAK inherits the condition.

### 1.2 Two of the five failures were caused by adding a clause the upstream did not have

`BEH-GUI-04` fails 6/6 on Claude across two candidates. Its cause is recorded: LeanClarity took
i-have-adhd's already-conditional rule ("if anything is left open, name ONE thing") and appended a
prohibition ("do not invent one after completion"). A revision was built specifically to fix it and
did not. The evidence file states: "상위에 없던 조항을 추가한 것이 통하지 않는다는 직접 증거다."

**`[RESP-007]` is that same appended prohibition.** TTAK currently carries a clause with a measured
6/6 failure rate across two hosts on the frozen candidate `1.0.2`.

`BEH-GUI-07` fails 24/24 at all four compression levels. Both are classified in that evidence as
counter-intuitive constraints — constraints opposing model defaults — which arXiv 2604.07192 measures
failing at 10–100% regardless of encoding. That paper was independently verified to exist and to say
this.

### 1.3 The Codex host instructs the model not to carry skills across turns

The Codex CLI host system prompt contains, verbatim:

> Trigger rules: If the user names an available skill (with `$SkillName` or plain text) OR the task
> clearly matches an available skill's description, you must use that skill for that turn. Multiple
> mentions mean use them all. **Do not carry skills across turns unless re-mentioned.**

A skill-only design therefore cannot satisfy `[ACT-003]` on Codex. This is not model drift; it is a
host instruction that outranks skill text. It is the mechanism explaining why Ponytail, i-have-adhd
and LeanClarity each built lifecycle-hook machinery despite skills being available.

Two further Codex facts, read from the installed binary and bundled tooling:

- The bundled `plugin-creator` validator rejects `disable-model-invocation` set to anything other
  than `false` or absent (`validate_plugin.py:457-463`). A single `SKILL.md` shared by both hosts
  cannot carry Claude's user-only flag.
- Plugin skills are namespaced by manifest name (`namespace.rs::qualify` → `{namespace}:{base_name}`).
  The invocation string is `$ttak:ttak-explain`, not `$ttak-explain`.
- `openai/codex#42112` is open: a skills-only plugin with `allow_implicit_invocation: false` per
  skill does not expose its skills in fresh tasks on Windows Desktop. That is the exact configuration
  a skill-only TTAK would ship.

### 1.4 `claude plugin eval` is gated and unavailable on this account

Verified by execution:

```
$ claude plugin eval __ttak_gate_probe_nonexistent__
`plugin eval` is currently in early access
```

The gate check runs before target resolution. `--help` prints regardless of the gate, so the earlier
claim that the command was "available locally, not early-access gated" was unfounded. Additionally,
`claude plugin details` computes always-on cost from `name + description + when_to_use` without
consulting `disableModelInvocation`, so it over-reports user-only skills; and
`claude plugin validate <repo-root>` checks only `marketplace.json` when one is present at the root.

### 1.5 Claude Code already ships part of the product, and part of it is already on

Claude Code 2.1.237+ includes a built-in `Concise` output style whose documented behavior — leading
with the result, skipping preamble and narration, answering in full when detail is requested, and
preserving error reports, security warnings and destructive-action confirmations intact — covers what
`[RESP-001]`, `[RESP-012]`, `[RESP-014]` and `[RESP-015]` aim at. `"outputStyle": "Concise"` was found
already set in the development machine's own settings. Bundled skills `/code-review`,
`/security-review`, `/debug` and `/doctor` occupy adjacent ground at zero install cost.

Codex has no output styles. The genuine gap is host-asymmetric.

---

## 2. Requirement amendments

Each row names the requirement, the change, and the evidence. Requirements not listed are unchanged.

### 2.1 Retired

| ID | Current text | Change | Basis |
|---|---|---|---|
| `[SRC-006]` | "The Anthropic community `eli5` license discrepancy MUST be resolved before copying or redistributing any material from that directory." | **Retired.** The source is removed from the product entirely; nothing is copied and nothing is redistributed, so the obligation has no subject. | §3, D7 |
| `[LIC-004]` | "The applicable license for material taken from `SRC-ANTHROPIC-ELI5` MUST be confirmed before copying or redistribution." | **Retired**, same reason. | §3, D7 |

Requirement-ID count moves from 157 to 155 before §2.2 additions.

### 2.2 Added

| ID | New text | Basis |
|---|---|---|
| `[TTAK-TRACK-008]` | After repeated attempts fail for the same reason, TTAK MUST stop blind iteration, state the assumption now in doubt, and request the smallest diagnostic evidence needed. | The upstream decomposition shows this rule survived into LeanClarity (`guidance` bullet 9) from i-have-adhd's debug-spiral exception, and has **no counterpart anywhere in v0.1**. It is a loss, not a deliberate exclusion. |
| `[TTAK-TRIM-009]` | When only analysis, explanation, reporting, or review was requested, TTAK MUST NOT mutate code or force an implementation. | v0.1 places this only in `[CAP-REVIEW-006]`, scoping it to the Review capability. LeanClarity carries it as a Core engineering rule (`engineering` bullet 2) and it is the anchor of one of its behavior cases. Core needs it. |

Requirement-ID count: 155 + 2 = **157**. The arithmetic coincidence is noted so it is not mistaken for
"no change" during synchronization; the *set* differs by four members.

### 2.3 Amended

| ID | Change | Basis |
|---|---|---|
| `[SRC-002]` | Add an exception: the enumerated protection nouns — `standard library`, `trust-boundary validation`, `data-loss prevention`, `accessibility`, `explicit output formats`, and the verification-honesty clause — SHOULD be preserved in meaning rather than paraphrased for style. | v0.1 §0.2 admits a SHOULD exception only for a documented platform constraint; this basis is a measurement, so it is declared here instead of taken silently. LeanClarity's `L3` compression deleted exactly these nouns and broke 14 of 19 deterministic assertions. |
| `[RESP-007]` | Restate in the upstream's conditional-positive form: *give one concrete next action only when work remains for the user*. Drop the appended prohibition. | §1.2. The prohibition form failed 6/6 across both hosts on the frozen candidate `1.0.2`, and 3/3 again on Claude after a revision built specifically to fix it. |
| `[ACT-003]` | Qualify: session persistence is delivered by host lifecycle injection where the host supports it. On a host that instructs the model not to carry skill instructions across turns, a skill-only implementation MUST NOT be described as persistent. | §1.3 |
| `[ACT-006]` | Narrow to v1 scope: Review is deferred (§2.4), so this governs Explain only in v1. | §3, D9′ |
| `[AC-001]` | Unchanged as a gate. Add a scope sentence: this gate measures TTAK's own critical scenarios under pinned evaluation conditions. It does not certify behavior when TTAK is loaded alongside other instruction sets, and TTAK is not a security control. | §1.1. Publishing the composition finding as a limitation is required, but it does not discharge the gate; conflating the two was the error the compliance audit caught. |
| `[AC-005]` | Retain "MUST not regress." Add the instrument (the cross-host runner's baseline arm) and the reproducibility caveat: LeanClarity measured run-to-run reproducibility ≈ 0.96, putting the 95% upper bound on the true failure rate at 39.3%. A single-run difference is not a regression. | §1.1, §1.4 |
| `[AC-006]` | Retain the 85% SHOULD. Add: the rubric MUST be defined and frozen before the first scored run. | Compliance audit: the threshold currently has no rubric behind it. |
| `[AC-009]` | Amend: per-platform context cost MUST be measured, but on Claude Code `claude plugin details` over-reports user-only skills and does not count hook-injected content, and Codex has no equivalent tool. TTAK MUST therefore measure and publish the byte and token size of the text it injects, from the shipped source, as the primary figure. | §1.4 |
| `[AC-011]` | Add: the English/Korean requirement-ID set match MUST be checked by an automated diff in CI, not by hand. | Adopts the prior review's own `OPEN-09` prescription, which the design had not taken up. |
| `[AC-012]` | Unchanged. Note explicitly that it is **not** closed: the `[LIC-001]` copied-text inventory does not yet exist, so the review it gates has not been performed. | §2.5, and the withdrawal of the earlier "review is complete" claim. |
| `[LIC-007]` | Unchanged. Note that selecting MIT before the `[LIC-001]` inventory exists would invert the required order; MIT is the expected outcome, not a completed decision. | Compliance audit |
| `[PREC-*]`, `[WORK-021]` | Unchanged in text. Add a delivery requirement: the precedence statement MUST appear in the text the model receives, not only in this specification. | §2.6 |

### 2.4 Scope amendments

| Location | Change | Basis |
|---|---|---|
| §9.2 `TTAK Review`, §9.4 | **Deferred to v1.1.** v1 exposes two capabilities: the core operating discipline and the explainer. `[CAP-REVIEW-001]`…`[CAP-REVIEW-007]` and `[AC-008]` remain normative but are not v1 acceptance gates. | Bundled `/code-review` and `/security-review` carry more specific descriptions and win skill-listing competition on code. Review's non-code scope (documents, plans, workflows, with a phase-gate verdict) may be genuinely open, but has not had the competitor check that Explain has had. `[PRIN-SCOPE-002]` is satisfied by declaring the deferral here rather than by dropping it quietly. |
| §15.3 Deferred → In Scope | A minimal visual asset (one logo file) moves into v1 scope. | Both marketplaces require a logo in the listing. Detailed character design stays deferred; this is the minimum the distribution channel demands, and moving it silently would have breached `[PRIN-SCOPE-002]`. |
| §15.1 In Scope | Add: a small cross-host evaluation runner. | §1.4 removed the native instrument that §17 depended on. |
| §5.1 | Add a pinned source row for `leanclarity` with commit, license evidence, and the specific derived artifacts. | The compliance audit found it was the one source cited without a pin and outside the "LICENSE files verified" predicate. |
| §23 Handoff Gate | "all four source repositories are pinned and attributed" → three upstream repositories plus `leanclarity`. | D7 |

### 2.5 Attribution and licensing

| Change | Basis |
|---|---|
| Policy text MUST be derived from the upstream `SKILL.md` files directly, not from LeanClarity's policies. | TTAK restores units LeanClarity deliberately dropped — the persona (`P1`), the precedence clause (`P24`, `A16`), and the user-authority clause (`P19`, `P20`) — which are absent from LeanClarity's text. Direct derivation also makes the attribution chain one step instead of two. |
| `ATTRIBUTIONS.md` MUST reproduce each upstream notice **verbatim as published**. `DreambigOu/ELI5`'s LICENSE reads `Copyright (c) 2026` with no copyright holder named; it MUST be reproduced that way, with a factual note, and MUST NOT be "corrected" by inserting a name. | Verified by reading the file. Inventing a copyright holder is a false attribution statement. |
| `ATTRIBUTIONS.md` MUST record which upstream commit each derived artifact passed through. LeanClarity pins i-have-adhd at `cbe69fb8…`; v0.1 §5.1 pins `58494af…`. If any text arrives via LeanClarity, both pins belong in the record. | Licensing review |
| `skills/ponytail-review/SKILL.md` MUST be listed as a derivation source if any Review material is carried, including `[CAP-REVIEW-007]`, which corresponds to its "Lean already. Ship." rule. LeanClarity's notices never covered Ponytail's auxiliary skills. | Licensing review |
| One license string MUST be identical across `LICENSE`, all plugin and marketplace manifests, and every `SKILL.md` frontmatter, enforced by a CI check. | The only reason `OPEN-01` existed upstream was a manifest/LICENSE mismatch. Reproducing it would be self-refuting. |
| Analysis and specification documents that are distributed MUST NOT quote text from a source whose license is unresolved. | The design review packet originally reproduced the `eli5` stub verbatim; corrected on 2026-09-04. |
| Attribution MUST live in `ATTRIBUTIONS.md` and README prose, and MUST NOT appear in searchable manifest keywords or `interface` metadata in a way that reads as affiliation. | `[LIC-006]`, plus both marketplaces' endorsement rules. |

### 2.6 The delivered precedence statement

The upstream decomposition records that both source projects told the *model* where they ranked —
Ponytail's "governs what you build, not how you talk" and i-have-adhd's "the system prompt outranks
this skill" — and that LeanClarity dropped both. Its own evidence calls this the most important
unresolved conflict: the specification knows the ranking and the model does not, so behavior cannot
be consistent across users with different global instructions.

TTAK's §16 fixes this on paper. This amendment adds the delivery obligation: the ranking MUST be
present in the injected text. It is the single largest substantive difference between TTAK and its
predecessor, and it is not a matter of character.

---

## 3. Design decisions recorded (not requirement changes)

These are implementation-level decisions. They are listed so §2 stays limited to requirement changes.

| ID | Decision |
|---|---|
| D1′ | TTAK supersedes LeanClarity under a new plugin identity, and LeanClarity receives a final release that removes its active guidance and points to TTAK. The earlier safety rationale is **withdrawn**: the measured unsafe composition was Ponytail plus high effort and was unaffected by LeanClarity's state. The rationale is product coherence and avoiding two overlapping plugins from one author. TTAK MUST warn against running alongside Ponytail. |
| D2′ | The persona is a user-experience and brand device. TTAK does not claim it improves constraint adherence. Any persona text that consumes runtime tokens requires a measured user-experience effect; absent that, the brand belongs in packaging only. |
| D3 | Character lives in the operating frame and the packaging. The enumerated protection nouns are preserved (see `[SRC-002]` amendment). |
| D4′ | **Lifecycle hooks on both hosts** carry the core discipline; one shared policy text, one hook runtime. The earlier zero-hook decision is withdrawn. This removes, by construction: the Codex validator conflict, the namespaced-invocation problem, `openai/codex#42112`, the host's no-carry-over instruction, the user-only token mis-reporting, the bare-name slot collision, and the subagent propagation gap. It reacquires: a Node runtime, a state file, the Windows hook-stdin defense, and the Codex hook trust-review step. All four have known solutions in the author's own prior work. |
| D5′ | No `disable-model-invocation` anywhere. The core is not a skill. The explainer is model-invocable on both hosts. |
| D6′ | Evaluation uses a small cross-host runner (`claude -p --setting-sources "" --model <pinned>`, `codex exec --ephemeral --ignore-user-config`) plus deterministic unit tests for state, injection, and failure modes. The 2,171-line prior harness is not revived. |
| D7 | `SRC-ANTHROPIC-ELI5` is removed entirely. |
| D8′ | TTAK does not claim to be better than a baseline. It **does** verify that it conforms to its own specification. Dropping comparative claims is honesty; dropping conformance verification would be abandoning the product's function. |
| D9′ | v1 = core discipline + explainer. Review deferred. |
| D10 | MIT, pending the `[LIC-001]` inventory. |
| D11 | Default OFF. One short activation notice on the first session only, suppressed by a flag thereafter. |
| D12 | Activation and deactivation by exact-match plain prompt, intercepted before the model sees it. |
| D13 | The name TTAK is retained. Listings carry a distinguishing full form, because `TTAK` is the designated prefix of Korean national ICT standards issued by TTA (`TTAK.KO-06.xxxx`) in the product's own target market. Trademark clearance is out of scope here and needs professional review before public listing. |
| D14 | `.gitattributes` with `* text=auto eol=lf`, and every `SKILL.md` description quoted or written as a block scalar. Verified on this machine: a repository with `.gitattributes` checks out with zero CR bytes under `core.autocrlf=true`; one without it does not. `anthropics/claude-code#80890` silently skips a `SKILL.md` with CRLF and an unquoted description containing `": "`. |
| D15 | Policy text derived directly from upstream sources. |

---

## 4. Open issues closed

| Issue | Resolution |
|---|---|
| `OPEN-01` Anthropic `eli5` license | Closed by removal (D7). Residual obligations are handled in §2.5: removing a source row exempts nothing; not distributing its expression does. |
| `OPEN-02` session persistence | Resolved: host lifecycle injection on both hosts. Codex's no-carry-over instruction makes this the only viable route there. |
| `OPEN-03` hooks | Resolved in favour of hooks, with the necessity now demonstrated rather than assumed — the original wording required proof before adding, and §1.3 supplies it. |
| `OPEN-05` command syntax | Resolved: exact-match plain prompts, identical on both hosts. Plugin skill invocation is namespaced (`$ttak:ttak-explain`, `/ttak:ttak-explain`). |
| Codex plugin structure | Resolved: `.codex-plugin/plugin.json` canonical, `.agents/plugins/marketplace.json` primary with `.claude-plugin/marketplace.json` as a legacy fallback that is read but loses to `.agents/`. |

## 5. Open issues remaining or newly opened

| ID | Issue | Severity |
|---|---|---|
| `OPEN-04` | Injected context size versus value. Now measurable directly from the shipped text. | Medium |
| `OPEN-06` | Explain's routing accuracy under a realistic installed-skill set. Host listing budgets drop descriptions starting with the least-invoked skills, so a newly installed plugin is the first to lose its description. Any routing measurement in an environment where TTAK is the only skill cannot fail and therefore proves nothing. | High |
| `OPEN-07` | Final license, pending the `[LIC-001]` inventory. | High |
| `OPEN-08` | Evaluation sensitivity: pinned models, repetition count, and evidence retention must be fixed before any published figure. | Medium |
| `OPEN-11` **new** | `claude plugin eval` is gated on this account. If access is granted later, the runner's role should be re-evaluated rather than duplicated. | Medium |
| `OPEN-12` **new** | Persona runtime cost is unjustified until a three-arm ablation — no frame, operating-frame headings, persona prose — measures a user-experience difference in recognizability, directness, audience fit, and restraint. Null result means the brand moves to packaging only. | Medium |
| `OPEN-13` **new** | Marketplace submission prerequisites are unbuilt: privacy policy URL, support URL, terms URL, website, logo, at least three working examples, five positive and three negative test cases, verified developer identity, and a Console organization role. These are distribution requirements, not documentation preferences. | High |
| `OPEN-14` **new** | `TTAK` collides with the TTA national ICT standard prefix in the target market. Mitigated by listing form; trademark clearance still required. | Medium |
| `OPEN-15` **new** | Review's non-code niche has not had a competitor check. Required before v1.1 scope is set. | Low |

---

## 6. What v1 claims

Claims, each with a named and available instrument:

1. **Injected size.** Bytes and tokens of the text TTAK injects, measured from the shipped source. Plus the explainer skill's catalog cost via `claude plugin details`.
2. **Structural validity.** `claude plugin validate` invoked three times — repository root, plugin manifest path, and skills directory — because a single root invocation checks only `marketplace.json`.
3. **Activation determinism.** Deterministic tests over the state machine: default OFF, activation, deactivation, corrupt state, missing data directory, and failure modes. Injection presence verified per lifecycle event on both hosts.
4. **Conformance.** The cross-host runner scores TTAK against its own specification on the §17.2 scenario groups. Absolute conformance, not comparative superiority.
5. **Consolidation.** One instruction set replaces three upstream sets plus the author's prior plugin, at a stated size. The arithmetic is stated explicitly rather than left as "four".

Not claimed: improved model output relative to a baseline, higher constraint adherence, safety
enforcement, or any benchmark result.

Published as known limitations: the composition finding of §1.1, the counter-intuitive-constraint
class of §1.2, the instrument's ≈0.96 reproducibility, and that none of this is a guard.

---

## 7. Size reconciliation

The specification contains roughly 104 runtime-normative statements. At LeanClarity's measured
density of ~138 characters per bullet, writing all of them out yields ~11,000 characters — the same
order as the 11,584 that LeanClarity used as the baseline for its 78.5% reduction. Three properties
cannot all hold: a small-size claim, preservation of the enumerated nouns, and full specification
coverage.

This amendment resolves it by ranking them. Preservation of the enumerated protection nouns is
non-negotiable (`[SRC-002]` amendment). Coverage is next: the injected text covers the invariants and
the precedence statement, and does not restate what the host already enforces. Size is reported, not
promised — §6 claim 1 states a measured number rather than a reduction target.

---

## 8. Application procedure

This amendment has been applied. Applying it required, in order:

1. Approval of this document.
2. Edit `..._v0.1_CANDIDATE_EN.md` → `..._v0.2_EN.md` per §2. `[DOC-003]` requires English first.
3. Mirror every change into the Korean document in the same commit. `[DOC-002]` requires identical
   requirement IDs, decisions, scope and meaning; `[AC-011]` requires identical normative ID sets.
   The set changes by four members (two retired, two added), so the prior review report's "157/157
   PASS" table and both SHA-256 file hashes become stale and MUST be recomputed and re-recorded.
4. Add the automated English/Korean ID-set diff check required by the amended `[AC-011]`.
5. Re-run the requirements traceability analysis. Its absence in the design packet was the mechanical
   cause of the twenty undeclared changes the compliance audit found; §20.2 lists it as required
   deliverable 1.

Steps 1–4 completed on 2026-09-04. `TTAK_Plugin_Product_Definition_v0.2_EN.md` is now the normative text and `..._v0.2_KO.md` its official translation; step 5, the requirements traceability analysis, remains outstanding.

---

## 9. Revision history

| Version | Date | Status | Summary |
|---|---|---|---|
| 0.2 | 2026-09-04 | Applied | First amendment. Retires two requirements, adds two, amends twelve, defers Review to v1.1, records the LeanClarity lineage and its inherited measurements, reverses the zero-hook decision, and replaces an unavailable evaluation instrument. |
