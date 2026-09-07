# TTAK Plugin Product Definition — v0.3 Amendment

> **Applied on 2026-09-06.** This amendment was approved and applied in full per §5. It changes documents only. **No product code, policy text, manifest, README or test was touched by it, and none needs to be:** every item below is a document sentence catching up to an artifact that already shipped and was already reviewed. The resulting normative text is `TTAK_Plugin_Product_Definition_v0.3_EN.md` with `..._v0.3_KO.md` as its official translation, renamed from `..._v0.2_EN.md` and `..._v0.2_KO.md` on application; §6 records the rename and the path constants it moved.

| Field | Value |
|---|---|
| Status | Applied. §9 added in the final fix round on 2026-09-06 |
| Amends | `TTAK_Plugin_Product_Definition_v0.2_EN.md` §5.1 and §19.3 (normative) and `..._v0.2_KO.md` (translation), renamed on application to `..._v0.3_EN.md` and `..._v0.3_KO.md`, and `docs/superpowers/specs/2026-09-04-ttak-design.md` §4.1, §4.4, §5.3, §5.4 and its §9 risks table. The final fix round adds §9 of this amendment, which amends the specification's §19.3 licence-string bullet in both languages |
| Date | 2026-09-06 |
| Normative language | English. `[DOC-003]` — English edited first, Korean mirrored in the same commit, equal force in both |
| Authority | `[HANDOFF-005]` — a platform constraint MAY trigger a proposed product amendment but MUST NOT silently rewrite a requirement. Item 4 is exactly that case; the other three are stale sentences, and this document exists so that neither kind is silent |
| Evidence | `docs/COPIED_TEXT_INVENTORY.md`, `ATTRIBUTIONS.md`, `docs/analysis/codex-cli/2026-09-04-host-integration.md`, `docs/analysis/claude-code/2026-09-04-host-integration.md`. Cited by section throughout; **not restated here** |
| Requirement-ID effect | **None.** No ID added, retired, renumbered or re-worded. §19.3 states on its face that its obligations "carry no separate requirement ID". `node scripts/check-id-sets.cjs` reports `ID sets match: 157 ids` before and after |
| Applied? | Yes, on 2026-09-06. §6 gives the procedure that was followed |

---

## 0. Why this amendment exists

Fourteen tasks built and reviewed the v1 artifact. Four times, execution found the shipped artifact
and a written sentence disagreeing. Each was ruled on when it was found and recorded where its
evidence lives, and each was deliberately left in the documents so that fixing it would be a declared
change rather than a quiet one. A whole-branch review later found a fifth, recorded as §9; §0
through §8 describe the original four.

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
files directly, not from `SRC-PRIOR`'s policy files, because direct derivation "makes the
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

**Amended to.** Direct derivation becomes a SHOULD. A two-step chain through `SRC-PRIOR` is
permitted where it is recorded, and the record is required to carry two things that §19.3 already
required elsewhere and that `ATTRIBUTIONS.md` already contains:

- both pins — the predecessor's own upstream pin and the v0.2 §5.1 pin — for any artifact that
  reaches TTAK through `SRC-PRIOR` (§19.3 already carried this as its pin-recording bullet; the
  amended first bullet points at it rather than restating it);
- a unit that originates with `SRC-PRIOR` recorded as originating there, on its face, rather
  than attributed to an upstream source it does not have.

The licensing outcome is identical either way, which is why the chain is acceptable at all: every
party in the chain is the same author under the same licence, `SRC-PRIOR` is MIT at the pinned
revision, and its notice is reproduced verbatim in `ATTRIBUTIONS.md`, the predecessor.
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
question between the two documents is no longer unsettled: the "Controller ruling" section of
`docs/COPIED_TEXT_INVENTORY.md` raised it and left it open, and **§5 settles it**.

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

## 5. Ruling: the specification outranks the design

Item 2 turned on this and had to derive it in place. It is recorded once here so that the next
conflict does not have to.

> **The specification outranks the design.** Where the design document records a decision the
> specification has not yet absorbed, that is a gap in the specification's currency, closed by
> amending the specification. It is never a licence for the design to win silently.

This is what §2 did rather than what it could have done. §19.3's persona clause was called **stale
and amended**; it was not overruled by design §5.3 and left standing in the specification. Items 3
and 4 run the other way: there the design was the document that had fallen behind the artifact, so
the design was amended, and no specification sentence was bent to cover for it.

Two consequences, because the rule is easy to over-read:

- A design decision is not void for being newer than the specification. Design §5.3's persona gating
  is a real decision and this amendment adopts it — by writing it into the specification, which is
  the only place it becomes normative.
- A conflict is not resolved by deciding which document is right. It is resolved by amending
  whichever one has fallen behind the artifact, and both directions occurred here.

`docs/COPIED_TEXT_INVENTORY.md`'s "Controller ruling" recorded this question as unsettled and placed
it on the v0.3 list. The paragraph above settles it.

---

## 6. Application procedure

Followed on 2026-09-06, in this order:

1. Baseline recorded before any edit: `node scripts/check-id-sets.cjs` → `ID sets match: 157 ids`,
   exit 0; `node --test --test-concurrency=1 tests/ttak.test.cjs` → 68 pass, 1 skip, 0 fail.
2. English specification edited first (`[DOC-003]`): `..._v0.2_EN.md` §5.1 and §19.3.
3. Korean specification mirrored in the same commit, carrying equal force: `..._v0.2_KO.md` §5.1 and
   §19.3. `[DOC-002]` requires identical requirement IDs, decisions, scope and meaning; `[AC-011]`
   requires identical normative ID sets, checked by the automated diff rather than by hand.
4. Design document edited: §4.1, §4.4, §5.3, §5.4 and the §9 risks row. English only — there is no
   Korean design document, and none is required: `[DOC-002]` and `[AC-011]` bind the specification.
5. Both gates re-run and recorded in §7.
6. Fix round 1: the ruling in §5 recorded, the specification files renamed, and the stale rows
   listed in §8 corrected rather than reported.

**The specification files were renamed to `v0.3` on application**, by `git mv`, following the
convention the v0.2 amendment set when it renamed `v0.1` → `v0.2`. A document whose header reads
`0.2` while its own revision history carries a `0.3` row is the same self-contradiction this
amendment exists to remove.

The rename moves file paths that are read by code, so they are enumerated here rather than left to be
discovered. **Three references, not the two expected:**

| Reference | Kind | Effect if missed |
|---|---|---|
| `scripts/check-id-sets.cjs`, the `docs()` helper | The only path constant for both languages | `[AC-011]`'s parity gate cannot open either document |
| `tests/conformance/run.py`, `SPEC_EN` | Path constant, read by `--selftest`, which CI runs | `run.py --selftest` raises `FileNotFoundError`; verified by pointing it back at the old name |
| `tests/conformance/README.md` and one comment in `run.py` | Prose | Nothing breaks; the path is simply wrong |

`tests/ttak.test.cjs` has **no** path constant of its own — it imports `docs()` from
`scripts/check-id-sets.cjs`, so the rename reaches it through that one definition. The suite's own
guidance had assumed a second constant there; there is not one, and the single definition is why.

Prose references in historical documents were left alone where they record what a file was called at
the time of writing: `docs/superpowers/plans/2026-09-04-ttak-v1.md`'s task-0 instructions and
`TTAK_Plugin_Product_Definition_v0.2_AMENDMENT_EN.md`'s account of the v0.1 → v0.2 rename are correct
as history. Live pointers were updated.

**`[AC-012]` is not closed by this amendment.** It required this amendment as one input, and it also
requires a human ruling on `docs/COPIED_TEXT_INVENTORY.md` finding F4. It stays open, and so does
`[LIC-007]` behind it.

---

## 7. Verification

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
| Deterministic suite, fix round 2 | `node --test --test-concurrency=1 tests/ttak.test.cjs` | 70 tests, 69 pass, 1 skip, 0 fail, exit 0 |
| Hash-record guard, mutations | one recorded character changed; one specification byte changed | both fail the new test, and the tree restores byte-for-byte |
| Hash-record guard, evasions | extra row, duplicate row, emptied table, fourth table appended, `docs()` repointed | all five fail; a heading rename with intact rows still passes |

The single skip is pre-existing and unrelated: the logo asset is still the 68-byte placeholder from
task 8. It is not touched by this amendment.

The deterministic suite was not, in the first round, a check *of* this amendment — no test read
these documents' amended sentences — but it was the evidence that a document-only change stayed
document-only. Fix round 2 changed that for one obligation: the recorded specification hashes are
now checked mechanically against the files, and against the same `docs()` definition the parity
gate uses, so a rename or an edit that does not reach the record fails the suite rather than
sitting undetected until someone re-reads the file.

---

## 8. Stale statements found and corrected

Read while reconciling the four items above, and **all fixed in fix round 1** rather than left as
notes. The table is retained because what a document said before it was corrected is part of the
record, and because a "pending" that describes something already shipped is the same honesty defect
these four items exist to remove — it is not a lesser one for flattering rather than damaging.

A fifth entry stood here in the first round: the specification-versus-design precedence question,
which the "Controller ruling" placed on the v0.3 list and the first round did not deliver. It is now
delivered, as §5.

| # | What it said | Where | Corrected to |
|---|---|---|---|
| A | **"v0.2 section 5.1 upstream attribution of `[TTAK-TRIM-009]` — Incorrect. Specification correction pending with the controller"**, when §5.1 already carried the correction in both languages: it records the rule as originating with `SRC-PRIOR` and says an earlier draft credited it upstream in error | `docs/COPIED_TEXT_INVENTORY.md`, Status | Corrected. F2 itself was accurate throughout and is unchanged; only the Status row had lagged |
| B | **"v0.2 section 19.3 direct derivation — Not satisfied … A v0.3 amendment must reconcile it"**, and F1's closing sentence, both describing this amendment as pending after it had landed | `docs/COPIED_TEXT_INVENTORY.md`, Status and F1 | Corrected to record the amendment as applied and to say what it changed. The measurements F1 rests on are untouched; `[AC-012]` still stays open on F4 |
| C | **"Status: Design. Approved for planning; not implemented"** in the header, and a §10 that still spoke of the v0.2 amendment as awaiting application. Both were true when written | `docs/superpowers/specs/2026-09-04-ttak-design.md`, header and §10 | Corrected. The header now records the design as implemented and names the branch; §10 records the v0.2 amendment as applied and keeps the four gates it lists that are genuinely still open |
| D | The recorded SHA-256 hashes for the specification files, which this amendment's own edits invalidated the moment they landed — a defect introduced by this work, not inherited. The record's closing line already required recomputation on any change, and the v0.2 amendment §8 step 3 made it an obligation | `docs/TTAK_Plugin_Product_Definition_v0.1_CANDIDATE_REVIEW_KO.md` | Recomputed and re-recorded under the `v0.3` filenames, with the v0.1 and v0.2 tables kept as history in the shape that file already used. Fix round 2 added the missing instrument: a test that reads the current table, requires its filenames to be exactly the files `docs()` names, and compares each recorded value against the file's actual hash |

---

## 9. Item 5 — §19.3's licence-string sentence names manifests the check does not require

**Found by the whole-branch review and added in the final fix round, 2026-09-06.** Same class as
items 1–4: a normative sentence that never matched the artifact. It survived fourteen per-task
reviews because it spans two surfaces — the manifests and the CI check — and every one of those
reviews looked at a single task's surface.

**What §19.3 said.** *"One license string MUST be identical across `LICENSE`, all plugin and
marketplace manifests, and every `SKILL.md` frontmatter, enforced by a CI check."*

**What ships.** Neither marketplace manifest declares a licence at all: `.claude-plugin/marketplace.json`
and `.agents/plugins/marketplace.json` carry no `license` key. Both plugin manifests declare
`"license": "MIT"`, as do every `SKILL.md` frontmatter and `LICENSE`. `tests/lint/check-hygiene.cjs`
scopes the **presence** requirement to `plugin.json` deliberately, and checks the **value** wherever a
`"license"` key appears in any JSON file. The check has therefore always enforced something narrower
than the sentence.

**The ruling: amend the sentence, not the manifests.** The plan resolved this conditionally — both
marketplace files *if they carry a license field* — and the check implements exactly that. A
marketplace manifest is a listing document, not a distribution unit; adding a licence key to it would
add a second place for the string to drift without adding a licensing guarantee. §19.3's purpose is
one string with no drift, and that is met.

This follows §5: the specification is the document that had fallen behind the artifact, so the
specification is amended. The artifact is not changed to make a sentence true.

**Sections changed.** Specification §19.3, the licence-string bullet, in English and Korean. No
manifest, no check, no test logic. The recorded SHA-256 hashes were recomputed for the same reason
row D gives.

---

## 10. Revision history

| Version | Date | Status | Summary |
|---|---|---|---|
| 0.3 | 2026-09-06 | Applied | Second amendment. Documents, plus the file paths the rename moves. Reconciles four recorded deviations: §19.3's unsatisfiable direct-derivation MUST becomes a SHOULD with a recorded two-step chain; the restored-unit list drops the persona, which does not ship; design §5.3's frame-as-headings sentence is corrected to the manifests' `displayName`; design §4.1 and §4.4 are brought to the shipped recursive create, with the read prohibition unchanged. Records the ruling that the specification outranks the design (§5). No requirement ID added, retired or renumbered; the set stays at 157. Fix round 1 renamed the specification files to `v0.3`, moved the three path references the rename invalidates, and corrected the four stale statements in §8 rather than reporting them. No policy text, manifest, README, or test logic changed |
| 0.3, §9 | 2026-09-06 | Applied | Final fix round, after the whole-branch review. Adds §9, a fifth deviation of the same class: §19.3's licence-string sentence required one string across "all plugin and marketplace manifests" when neither marketplace manifest declares a licence and `tests/lint/check-hygiene.cjs` scopes the presence check to `plugin.json`. The sentence is brought to the artifact and the check in both languages. `[AC-012]`'s stated reason is also corrected in both languages: it named the copied-text inventory as non-existent when it has shipped since `779a379`. The gate stays open on F4. Recorded hashes recomputed. No requirement ID added, retired or renumbered; the set stays at 157 |
