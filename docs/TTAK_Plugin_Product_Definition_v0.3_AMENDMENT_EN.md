# TTAK Plugin Product Definition — v0.3 Amendment

> **Applied on 2026-09-06.** This amendment was approved and applied in full per §5. It changes documents only. **No product code, policy text, manifest, README or test was touched by it, and none needs to be:** every item below is a document sentence catching up to an artifact that already shipped and was already reviewed. The resulting normative text remains `TTAK_Plugin_Product_Definition_v0.2_EN.md` with `..._v0.2_KO.md` as its official translation; §5 explains why the filenames did not move.

| Field | Value |
|---|---|
| Status | Applied |
| Amends | `TTAK_Plugin_Product_Definition_v0.2_EN.md` §5.1 and §19.3 (normative) and `..._v0.2_KO.md` (translation), and `docs/superpowers/specs/2026-09-04-ttak-design.md` §4.1, §4.4, §5.3, §5.4 and its §9 risks table |
| Date | 2026-09-06 |
| Normative language | English. `[DOC-003]` — English edited first, Korean mirrored in the same commit, equal force in both |
| Authority | `[HANDOFF-005]` — a platform constraint MAY trigger a proposed product amendment but MUST NOT silently rewrite a requirement. Item 4 is exactly that case; the other three are stale sentences, and this document exists so that neither kind is silent |
| Evidence | `docs/COPIED_TEXT_INVENTORY.md`, `ATTRIBUTIONS.md`, `docs/analysis/codex-cli/2026-09-04-host-integration.md`, `docs/analysis/claude-code/2026-09-04-host-integration.md`. Cited by section throughout; **not restated here** |
| Requirement-ID effect | **None.** No ID added, retired, renumbered or re-worded. §19.3 states on its face that its obligations "carry no separate requirement ID". `node scripts/check-id-sets.cjs` reports `ID sets match: 157 ids` before and after |
| Applied? | Yes, on 2026-09-06. §5 gives the procedure that was followed |

---

## 0. Why this amendment exists

Fourteen tasks built and reviewed the v1 artifact. Four times, execution found the shipped artifact
and a written sentence disagreeing. Each was ruled on when it was found and recorded where its
evidence lives, and each was deliberately left in the documents so that fixing it would be a declared
change rather than a quiet one.

Three of the four are **stale sentences**: a decision was taken, the artifact followed it, and a
sentence written before the decision was never revisited. One — item 4 — is a **deliberate
contradiction**: an observed host behaviour made the written rule unshippable, the code changed, and
the design text was held for this amendment rather than edited by the task that found it.

Two things this amendment refuses to do, both of which would have been easier:

- **It does not change the product to make a sentence true.** No persona is added, no heading is
  added, no directory rule is restored.
- **It does not soften a finding.** `policy/invariants.md` and `policy/contract.md` reproduce the
  predecessor's policy files at a measured 29-word longest shared run. That is stated as what it is.
  The amendment permits the chain and requires it to be recorded; it does not describe it as
  compliance with the rule it breaks.

---

## 1. Item 1 — §19.3's direct-derivation rule is unsatisfiable as written

**What it said.** v0.2 §19.3, bullet 1: policy text MUST be derived from the upstream `SKILL.md`
files directly, not from `SRC-LEANCLARITY`'s policy files, because direct derivation "makes the
attribution chain one step instead of two". Design §5.4 repeated it. v0.2 §5.1 restated it as an
accomplished fact.

**What ships.** `policy/invariants.md` and `policy/contract.md` track the predecessor's
`policies/engineering.md` and `policies/guidance.md` bullet for bullet. `policy/precedence.md` and
`skills/ttak-explain/SKILL.md` were derived as the rule requires and measure at a three-word longest
shared run file-wide against any candidate source. Measurements, the per-unit and file-wide metrics,
and the two-step chain drawn out in full: `docs/COPIED_TEXT_INVENTORY.md`, "Controller ruling" and
finding F1.

**Why it cannot simply be complied with.** `policy/invariants.md` I2 (`[TTAK-TRIM-009]`) and
`policy/contract.md` C5, the verification-honesty clause, have **no upstream `SKILL.md` source at
all**, confirmed against the predecessor's own upstream decomposition. For those two units there is
no upstream line to derive from, so the MUST is **unsatisfiable**, not merely unmet — no rewriting
produces a one-step chain for text whose only source is the intermediate.
`docs/COPIED_TEXT_INVENTORY.md` finding F2 carries the confirmation and the two line citations.

A middle route existed for three other units and was declined; that decision, and the reason, are
recorded in the same "Controller ruling" section and are not re-argued here.

**Amended to.** Direct derivation becomes a SHOULD. A two-step chain through `SRC-LEANCLARITY` is
permitted where it is recorded, and the record is required to carry two things that §19.3 already
required elsewhere and that `ATTRIBUTIONS.md` already contains:

- both pins — the predecessor's own upstream pin and the v0.2 §5.1 pin — for any artifact that
  reaches TTAK through `SRC-LEANCLARITY` (§19.3 already carried this as its pin-recording bullet; the
  amended first bullet points at it rather than restating it);
- a unit that originates with `SRC-LEANCLARITY` recorded as originating there, on its face, rather
  than attributed to an upstream source it does not have.

The licensing outcome is identical either way, which is why the chain is acceptable at all: every
party in the chain is the same author under the same licence, `SRC-LEANCLARITY` is MIT at the pinned
revision, and its notice is reproduced verbatim in `ATTRIBUTIONS.md`, `wotjr1649/leanclarity`.
`[LIC-002]` and `[SRC-003]` were already satisfied for this text and are unaffected.

**Sections changed.** v0.2 §19.3 bullet 1 (EN and KO); v0.2 §5.1 closing paragraph (EN and KO);
design §5.4.

**§5.1 is in scope and was not on the brief's list.** Its closing paragraph asserted the same rule as
a statement of fact — "TTAK's policy text is derived from the upstream `SKILL.md` files directly, not
from this source's policy files (§19.3)" — and cross-referenced §19.3 for it. Amending §19.3 alone
would have left one document asserting a rule and contradicting it seven hundred lines apart. It now
says which files take the two-step route and that §19.3 permits the chain. This is the same deviation
at a second site, not a fifth item.

## 2. Item 2 — §19.3 and design §5.4 claimed a restored persona that does not ship

**What they said.** TTAK restores three units the predecessor deliberately dropped — "the persona,
the precedence clause, and the user-authority clause".

**What ships.** Two of the three. The precedence clause ships as `policy/precedence.md`; the
user-authority clause ships as the second sentence of `policy/invariants.md` I7. **No persona text
ships anywhere.** Searching `woodpecker`, `딱따구리`, `persona` and `페르소나` across `policy/`,
`skills/`, `hooks/`, all four manifests and both READMEs returns nothing; re-run at the commit
carrying this amendment.

**Why this is not an implementation gap.** Design §5.3 is the governing decision: persona prose does
not enter the injected text until the three-arm ablation (`OPEN-12`) shows a user-experience effect,
and until then the brand lives in the name, the logo, the README and the marketplace `interface`
block, which cost no runtime tokens. It does live there —
`displayName: "TTAK — Track · Trim · Adapt · Keep"` in all three manifests that carry the field.

**The clause is stale, not outranked.** The v0.2 amendment revised twelve requirements and never
reached §19.3, so its sentence predates the §5.3 decision rather than competing with it. Nothing here
turns on a design document outranking a specification — the specification is the higher-ranked
document, and the correction is that one of its sentences was left behind. The general precedence
question between the two documents is not settled by this amendment; the "Controller ruling"
section of `docs/COPIED_TEXT_INVENTORY.md` raised it and left it open, and it stays open. See §7.

**Amended to.** Two restored units, not three. The persona is recorded separately as a brand device
carried by the name, the logo, the READMEs and the manifests' `displayName`, with persona prose in
the injected text gated on `OPEN-12`.

**Sections changed.** v0.2 §19.3, new second bullet (EN and KO); design §5.4, second paragraph.

## 3. Item 3 — design §5.3's own first sentence was false against the artifact

**What it said.** "The operating frame — `Track · Trim · Adapt · Keep` — appears as section
headings."

**What ships.** The policy files' headings are `# Precedence`, `# Invariants` and
`# Response contract`. The frame appears in the `displayName` of the three manifests that carry the
field and nowhere in the injected text.

This one is worth stating plainly: the sentence naming the artifact's own headings was wrong about
them, in the section that argues a heading which changes nothing should not be paid for. The artifact
took that argument to its conclusion and shipped no frame headings; the sentence describing the
artifact did not follow.

**Amended to.** The frame appears in the manifests' `displayName` and so on the listing surface, not
as headings in the injected text, and the shipped headings are named. The rest of §5.3 stands
unchanged: the `OPEN-12` gating, and the argument that a heading which changes nothing should not be
paid for. Two words were added to the following paragraph — "the headings" became "operating-frame
headings" — because the amended first sentence removed that phrase's antecedent. That is a
readability repair, not a change of meaning: the referent was and is `OPEN-12`'s middle arm.

**Sections changed.** Design §5.3, first sentence and the paragraph after it; design §9 risks table,
the "Persona runtime cost unjustified" row, which carried the same claim as "Frame headings only".

## 4. Item 4 — design §4.1 and §4.4 contradicted the shipped runtime, deliberately

**What they said.** Lifecycle reads never create; the first-session notice may create its own leaf
directory "only when the parent exists, never a missing parent".

**What ships.** `writeState` and the notice's one-time write create the full path recursively
(`fs.mkdirSync(leaf, { recursive: true })`). Reads still create nothing.

**Why it changed.** Observed, three trials, on three genuinely fresh `CODEX_HOME` directories:
**Codex never creates `<CODEX_HOME>/plugins/data/`**. Refusing a missing parent therefore meant
`ttak on` could never succeed on a fresh Codex profile, and the first-session notice — the plugin's
only discovery path, since it ships OFF — never fired either. TTAK could not be enabled on one of its
two hosts. Claude Code pre-creates the leaf; Codex does not. The observations, the blocked
activation, and the same observation re-run against the fix are in
`docs/analysis/codex-cli/2026-09-04-host-integration.md` §3.1–§3.3, with the deviation declared at
that document's "Design deviation, deliberate, recorded here rather than in the design" note and the
contrasting host behaviour at `docs/analysis/claude-code/2026-09-04-host-integration.md` §1.3.

This is the one item where the code moved and the document was held. That order is the right one —
the branch shipped a working plugin on both hosts and declared the deviation, rather than shipping a
document-conformant plugin that could not be turned on — but it is also the item where
`[HANDOFF-005]` bites hardest, and it is why this amendment is a document rather than a commit
message.

**The safety the old rule protected is preserved elsewhere.** `dataRoot()` returns `null` unless the
host named a root, so a recursive create can only ever happen under a directory the host chose. Every
other guard is unchanged: a leaf that exists and is not a directory, and a state path that exists and
is not a file, both still refuse.

**Amended to.**

- §4.1's read rule **stands unchanged** — reads create nothing, now stated at every depth and pinned
  by a test at every depth. The stale half of that bullet was the classification, not the
  prohibition: a missing parent is now `absent` when the nearest existing ancestor is a traversable
  directory, where the old text called it `unavailable`.
- §4.4's "never a missing parent" is replaced by: a deliberate write creates the full path under the
  host-designated root. The observation is recorded as the basis, by citation.
- Recorded in the same section because it is the same concern: state classification now asks `lstat`
  whether a name exists and `stat` whether it can be traversed, so a name occupied by something
  unusable — a plain file where a directory belongs, a dangling junction — reports `unavailable`
  rather than a confident `absent`.

**Sections changed.** Design §4.1, the Codex-data-directory bullet, split into three; design §4.4,
the bolded notice rule plus a new basis paragraph. Design §8.1's test list already names both
"missing leaf" and "missing parent" as scenarios and is still accurate; it was not touched.

---

## 5. Application procedure

Followed on 2026-09-06, in this order:

1. Baseline recorded before any edit: `node scripts/check-id-sets.cjs` → `ID sets match: 157 ids`,
   exit 0; `node --test --test-concurrency=1 tests/ttak.test.cjs` → 68 pass, 1 skip, 0 fail.
2. English specification edited first (`[DOC-003]`): `..._v0.2_EN.md` §5.1 and §19.3.
3. Korean specification mirrored in the same commit, carrying equal force: `..._v0.2_KO.md` §5.1 and
   §19.3. `[DOC-002]` requires identical requirement IDs, decisions, scope and meaning; `[AC-011]`
   requires identical normative ID sets, checked by the automated diff rather than by hand.
4. Design document edited: §4.1, §4.4, §5.3, §5.4 and the §9 risks row. English only — there is no
   Korean design document, and none is required: `[DOC-002]` and `[AC-011]` bind the specification.
5. Both gates re-run and recorded in §6.

**The specification files were not renamed to `v0.3`.** The v0.2 amendment renamed `v0.1` → `v0.2` on
application; this one does not, for a mechanical reason: `scripts/check-id-sets.cjs` and
`tests/ttak.test.cjs` read `docs/TTAK_Plugin_Product_Definition_v0.2_EN.md` and `..._KO.md` by exact
path, and this amendment's own rule is that it changes no product code and no test. A rename would
have made a document-only amendment edit the test suite. The version field in both documents
therefore still reads `0.2`; the header's amendment row and the §24 revision history record that this
amendment is applied in place, so the file name is not the only thing a reader has to go on. **If a
later task renames these files, those two path constants are what it must update.**

**`[AC-012]` is not closed by this amendment.** It required this amendment as one input, and it also
requires a human ruling on `docs/COPIED_TEXT_INVENTORY.md` finding F4. It stays open, and so does
`[LIC-007]` behind it.

---

## 6. Verification

| Check | Command | Result |
|---|---|---|
| Requirement-ID parity, before | `node scripts/check-id-sets.cjs` | `ID sets match: 157 ids`, exit 0 |
| Requirement-ID parity, after | `node scripts/check-id-sets.cjs` | `ID sets match: 157 ids`, exit 0 |
| Deterministic suite, before | `node --test --test-concurrency=1 tests/ttak.test.cjs` | 69 tests, 68 pass, 1 skip, 0 fail, exit 0 |
| Deterministic suite, after | `node --test --test-concurrency=1 tests/ttak.test.cjs` | 69 tests, 68 pass, 1 skip, 0 fail, exit 0 |
| Line endings and encoding | byte scan of every changed file | zero CR bytes, valid UTF-8, no BOM |
| Persona absence, re-run | case-insensitive search for the four persona terms over `policy/`, `skills/`, `hooks/`, all four manifests and both READMEs | no match |
| Shipped headings | `grep -n '^#' policy/*.md` | `# Response contract`, `# Invariants`, `# Precedence` |
| Frame in packaging | search for `displayName` across the manifests | present in three of the four |

The single skip is pre-existing and unrelated: the logo asset is still the 68-byte placeholder from
task 8. It is not touched by this amendment.

The deterministic suite is not a check *of* this amendment — no test reads these documents' amended
sentences — but it is the evidence that a document-only change stayed document-only. That is the
claim being made, and it is the check that can falsify it.

---

## 7. Findings recorded, not fixed

Read while reconciling the four items above. **None is fixed here.** Three are staleness in files this
amendment is not scoped to touch, and one is a question the brief's list of four did not contain.
Recorded because a list that turns out to be incomplete is worth knowing before the branch review.

| # | Finding | Where | Why not fixed here |
|---|---|---|---|
| A | **The precedence question between the specification and the design is unsettled, and the ruling that raised it said it "joins the v0.3 list".** This amendment does not settle it. It did not have to: item 2 turns on §19.3's clause being stale, not on either document outranking the other, and §1–§4 are written so that no item depends on the answer. But the ruling asked for it and it is not delivered. | `docs/COPIED_TEXT_INVENTORY.md`, "Controller ruling" | Not among the four items this amendment was scoped to, and settling document precedence is a decision, not a reconciliation. It needs a ruling, not an edit |
| B | The Status table row **"v0.2 section 5.1 upstream attribution of `[TTAK-TRIM-009]` — Incorrect. Specification correction pending"** is stale. §5.1 already carries the correction, in both languages: it records `[TTAK-TRIM-009]` as originating with `SRC-LEANCLARITY` and says the earlier draft credited it upstream in error | `docs/COPIED_TEXT_INVENTORY.md`, Status | It is an evidence file, out of this amendment's scope, and its finding F2 is still accurate — only the Status row lags |
| C | The same Status table's row **"v0.2 section 19.3 direct derivation — Not satisfied … A v0.3 amendment must reconcile it"**, and the closing sentence of F1, both describe this amendment as pending. It has now landed | `docs/COPIED_TEXT_INVENTORY.md`, Status and F1 | Same reason as B. Whoever closes `[AC-012]` will have to re-read that file anyway, and it is the natural place to refresh both rows |
| D | The design document's header still reads **"Status: Design. Approved for planning; not implemented"**, and its §10 still speaks of the v0.2 amendment as awaiting application. Both were true when written and are not now | `docs/superpowers/specs/2026-09-04-ttak-design.md`, header and §10 | Not one of the four deviations, and not a spec-artifact disagreement — a design document describing its own status at the time of writing. Flagged rather than quietly rewritten |

---

## 8. Revision history

| Version | Date | Status | Summary |
|---|---|---|---|
| 0.3 | 2026-09-06 | Applied | Second amendment, documents only. Reconciles four recorded deviations: §19.3's unsatisfiable direct-derivation MUST becomes a SHOULD with a recorded two-step chain; the restored-unit list drops the persona, which does not ship; design §5.3's frame-as-headings sentence is corrected to the manifests' `displayName`; design §4.1 and §4.4 are brought to the shipped recursive create, with the read prohibition unchanged. No requirement ID added, retired or renumbered; the set stays at 157. No product code, policy text, manifest, README or test changed |
