# TTAK Design Review Packet

| Field | Value |
|---|---|
| Date | 2026-09-04 |
| Status | Pre-decision. Under adversarial review. Not approved, not implemented. |
| Reviews | This artifact is the single input for all reviewers. |
| Product spec under revision | `docs/TTAK_Plugin_Product_Definition_v0.2_EN.md` (normative), `..._v0.2_KO.md` (translation), `..._v0.1_CANDIDATE_REVIEW_KO.md` (prior adversarial review). The first two were named `..._v0.1_CANDIDATE_EN.md` and `..._KO.md` when this packet was written. |
| Target hosts | Claude Code `2.1.259`, Codex CLI `0.150.1`, Windows 11 Pro 26200 |

---

## 0. What this packet is for

A design was derived for the TTAK plugin from (a) the v0.1 candidate product spec, (b) source-repo
reading, (c) live runtime inspection of both hosts, and (d) a structured interview with the product
owner. Nothing has been implemented. This packet states the design and the evidence behind it so it
can be attacked before any file is written.

Reviewers: assume the design is wrong somewhere and find where. Section 6 lists weaknesses already
known — do not re-report those unless you can show the stated handling is itself wrong. Value is in
what is **not** in section 6.

---

## 1. Product, in one paragraph

TTAK is a persona-carrying instruction plugin for Claude Code and Codex CLI. It consolidates
behavioral guidance from three MIT-licensed upstream projects into one coherent operating model —
`Track · Trim · Adapt · Keep` — under a single persona (a precision problem-solving woodpecker; 딱
means "exactly / just enough" in Korean and also names a woodpecker's tap). It exposes three logical
capabilities: `ttak` (core problem solving), `ttak-review` (adversarial review with a
GO/CONDITIONAL-GO/NO-GO verdict), `ttak-explain` (audience-adapted explanation). Distribution target
is public: GitHub plus both hosts' marketplaces.

---

## 2. Evidence base the design rests on

### 2.1 Prior art by the same author: LeanClarity v1.0.2

The product owner already shipped `leanclarity` (`github.com/wotjr1649/leanclarity`, MIT), described
by its own README as consolidating "the guidance of two upstream projects, Ponytail and
i-have-adhd, into a single always-on plugin." Same two hosts, same Windows target, same docs layout.
It is currently installed and enabled in the owner's Codex, installed and disabled in Claude Code.

LeanClarity's own published measurements:

| Claim | Result |
|---|---|
| Context reduction | 11,584 chars (Ponytail 5,193 + i-have-adhd 6,391) → 2,486 chars, **-78.5%**. Reproducible. |
| Behavior improvement, paired ON/OFF, two studies | **None resolvable.** All eight case×host cells `Fisher p = 1.0000`. The one behavior the first study resolved was redundant with Ponytail's existing text. |
| Own behavior gate `LCL-BEH-001` | **FAIL.** 5 of 17 frozen cases do not pass. `RELEASE GO` = `NOT VERIFIED`, `COMPLETE GO` not granted. |
| Guidance composition safety | With Ponytail loaded alongside at high effort, asked to shorten a record-deleting function: **data-loss guards removed in 8 of 24 runs**, intact in 11, unreachable in 5. Same rate whether LeanClarity was ON or OFF. Ponytail's own clause forbidding this did not hold; LeanClarity's did not restore it. |

### 2.2 Why the 5 failures matter to TTAK's design

From `docs/evidence/LeanClarity_v1.0_GO_EVIDENCE.md`:

| Case | Recorded cause | Fixable by rewording/persona? |
|---|---|---|
| `BEH-GUI-04` | A policy revision was built to fix it. Claude went `FAIL/FAIL/FAIL` before and `FAIL/FAIL/FAIL` after — six consecutive failures across two candidates. Revision discarded. "The wording hypothesis was tested and refuted." | **No — already refuted empirically** |
| `BEH-GUI-07` | "The bullet already says exactly what to do." 24/24 failures at all four compression levels. | **No** |
| `BEH-ENG-02` | Passes on Codex under identical policy text; fails on Claude. | No — host/model variance |
| `BEH-ENG-05` | 3/3 fail on `claude-haiku-4-5`, 0/3 fail on Codex, identical text, every compression level. | No — model variance |
| `BEH-ENG-06` | "Instrument defect, not a product limitation." P2 asserts a different case's spec row. | No — measurement bug |

Governing citation in that document: both persistent failures are what arXiv 2604.07192 classifies
as **counter-intuitive constraints** — constraints opposing model defaults — measured failing at
**10–100% regardless of encoding**, versus 99%+ for conventional constraints.

Two further facts from the same document:

- **Instrument noise**: run-to-run reproducibility ≈ 0.96; the 95% upper bound on the true failure
  rate from the observations is 39.3%. Part of "5 failures" is noise.
- **Rewriting deletes anchors**: the `L3` compression level would drop the enumerated nouns
  `standard library`, `trust-boundary validation`, `data-loss prevention`, `accessibility`,
  `explicit output formats`, `never report a check as passing unless it was run and observed`, and
  breaks 14 of 19 deterministic assertions.

### 2.3 Runtime facts, verified by execution on this machine (not from documentation)

| Fact | How verified |
|---|---|
| Claude Code `2.1.259`; Codex CLI `0.150.1` | `claude --version`, `codex --version` |
| `claude plugin eval` is available locally (not early-access gated) and supports `--ablation with-without`, which adds a no-plugin baseline arm automatically; graders live in `evals/<case>/graders/*.md`; `--json`, `--judge-model`, `--case` supported | `claude plugin eval --help` |
| `claude plugin details <name>` reports projected token cost: always-on total, and per-component always-on vs on-invoke. Hooks are labeled `harness-only — no model context cost` | `claude plugin details ponytail` — output: `Always-on: ~983 tok`, per-skill table |
| `claude plugin validate`, `init`, `tag`, `enable`, `disable`, `install`, `uninstall`, `update`, `marketplace` all exist | `claude plugin --help` |
| Codex CLI has a real plugin system with marketplaces: `codex plugin add / list / marketplace add\|list\|upgrade\|remove` | `codex plugin --help`, `codex plugin list` |
| Codex marketplace manifests resolve at `.agents/plugins/marketplace.json`; three installed marketplaces on this machine use that path | `codex plugin list` output paths |
| Codex has `~/.codex/skills/`, `~/.codex/rules/`, and system skills including `plugin-creator`, `skill-creator`, `skill-installer` | directory listing |
| Both `/ponytail` and `/ponytail:ponytail` are live Claude Code invocation forms | `ponytail/hooks/ponytail-mode-tracker.js:31-33` handles both |
| Codex's counterpart to `disable-model-invocation: true` is `skills/<name>/agents/openai.yaml` with `policy.allow_implicit_invocation: false` | `i-have-adhd/skills/i-have-adhd/agents/openai.yaml`, paired with `disable-model-invocation: true` in the same skill's `SKILL.md` |

### 2.4 Platform constraints from official documentation

- OpenAI's Claude-plugin conversion guide instructs: *"Turn each Markdown command into a skill, move
  reusable agent procedures into skills, and **merge useful persona instructions into the relevant
  skill**."* `commands/` and `agents/` (subagents) are not portable to Codex.
- Codex plugin hooks are **not trusted by installation**. They require a hash-based trust review via
  `/hooks` before they run. "Install and it works" does not hold for a hook-based design on Codex.
- Codex skill catalog budget: 2% of the context window, or 8,000 characters when the window is
  unknown; `skills.max_context_tokens` caps at 10,000. Over budget, descriptions are abbreviated and
  skills may be dropped with a warning.
- Provider-neutral text is required: replace `Claude`-specific references with neutral language such
  as "the model."
- Codex does not support `outputStyles`, `userConfig`, `lspServers`, `settings.json`, or `CLAUDE.md`.
- Codex `AGENTS.md` chain: 32 KiB cap, root→CWD concatenation, injected on the first turn.
- Custom prompts (`~/.codex/prompts/`) are **deprecated**; skills are the replacement.

### 2.5 Source disposition

`anthropics/claude-plugins-community/eli5` at the pinned commit is a stub: after frontmatter, its
body is three lines — a one-line heading, a single sentence directing an HTML-artifact explanation
with large images and minimal text, and an `$ARGUMENTS` topic placeholder. It contains no
instructional content beyond that. (Described rather than quoted: the directory's license status is
unresolved, so this document does not redistribute its text.)

The four items the v0.1 spec §5.5 lists as "adopted" from it (no-prior-knowledge path,
big-picture-first, low information density, one idea at a time) are not in this file. They come from
`DreambigOu/ELI5` or from TTAK's own synthesis. Its license status is ambiguous (manifest declares
MIT; repository root `LICENSE` is Apache-2.0; no directory-local LICENSE) and this is recorded as
`OPEN-01`, severity high.

Retained sources, all MIT with LICENSE files verified: `DietrichGebert/ponytail` @ `2ed6c52`,
`ayghri/i-have-adhd` @ `58494af`, `DreambigOu/ELI5` @ `a766623`. Plus the author's own
`leanclarity` (MIT).

---

## 3. Decisions taken

| ID | Decision | Basis |
|---|---|---|
| D1 | TTAK supersedes LeanClarity. LeanClarity is deprecated and points to TTAK. Both READMEs state the lineage. | Simultaneous activation reproduces the measured unsafe-composition condition (§2.1). Inheriting the negative results is what makes "we promise only what we measured" credible. |
| D2 | The persona is a user-experience and brand device. TTAK does not claim it improves model behavior. | §2.2: the wording hypothesis was built, tested and refuted. A persona is another encoding. |
| D3 | Character lives in the frame (`Track · Trim · Adapt · Keep` headings) and the packaging (name, logo, README, marketplace `interface` block). The enumerated policy nouns are preserved. | §2.2: `L3` deleted those nouns and broke 14 of 19 deterministic assertions. |
| D4 | **Zero hooks.** The runtime artifact is three `SKILL.md` files consumed by both hosts. | §2.4: OpenAI directs persona → skill; Codex hooks need trust review. Removes by construction: Windows PowerShell hook-stdin freeze (ponytail #443), the two Codex `PLUGIN_DATA` defects LeanClarity burned three candidates on, and hook trust friction. |
| D5 | `ttak` core is user-invocation-only: `disable-model-invocation: true` **and** `agents/openai.yaml` with `policy.allow_implicit_invocation: false`. `ttak-review` and `ttak-explain` stay model-invocable. | `ACT-001` (installation must not force global behavior) and `ACT-006` (auto-routing only when predictable and testable). Routing is testable via a `tool_used: Skill` grader. |
| D6 | Evaluation uses native tooling only: `claude plugin details`, `claude plugin validate`, `claude plugin eval --ablation with-without`. Codex gets a manual smoke checklist. | The 2,171-line Python harness measures behavior claims v1 does not make. §8.3 of the spec puts native platform capability above custom machinery. |
| D7 | `SRC-ANTHROPIC-ELI5` is removed from the source set entirely — not copied, not cited as a source. | §2.5: nothing to adopt; closes `OPEN-01` at zero cost. |
| D8 | v1 promises only what is measured: context cost, invocation and deactivation paths, and one coherent contract replacing four instruction sets. No behavior-improvement claim. Known limitations are published, inheriting §2.1–2.2. | Owner decision. |
| D9 | Explicit activation, cross-domain role routing, and three capabilities are all retained. | Owner decision, reaffirmed after being challenged. Recorded as scope the diagnosis did not call for (see §6.1). |
| D10 | License: MIT. `ATTRIBUTIONS.md` carries full MIT notices for the three retained upstreams plus LeanClarity. | All retained sources MIT; `SRC-005`'s required review is complete. |

---

## 4. Proposed structure

```
ttak/
├── .claude-plugin/
│   ├── plugin.json                    # Claude manifest
│   └── marketplace.json               # also read by Codex as legacy-compatible
├── .codex-plugin/
│   └── plugin.json                    # Codex canonical: "skills": "./skills/", interface block
├── .agents/plugins/
│   └── marketplace.json               # Codex native marketplace path
├── skills/
│   ├── ttak/
│   │   ├── SKILL.md                   # disable-model-invocation: true
│   │   └── agents/openai.yaml         # allow_implicit_invocation: false
│   ├── ttak-review/SKILL.md
│   └── ttak-explain/SKILL.md
├── evals/<case>/
│   ├── prompt.md
│   └── graders/*.md
├── docs/                              # existing layout retained
├── README.md, README.ko.md
├── ATTRIBUTIONS.md
└── LICENSE                            # MIT
```

Runtime surface is three `SKILL.md` files and one `openai.yaml`. No Node runtime, no state file, no
hooks, no MCP server, no bundled scripts.

Invocation: Claude Code `/ttak`, `/ttak-review`, `/ttak-explain` (also `/ttak:ttak` etc.). Codex
`$ttak`, `$ttak-review`, `$ttak-explain`. Invocation syntax is **not** hardcoded inside instruction
text, because it differs per host.

Text rules: provider-neutral wording; descriptions short with trigger terms first, to survive Codex
catalog abbreviation.

---

## 5. What v1 claims, and what it does not

Claims, each with a named instrument:
1. Context cost, in tokens, always-on and on-invoke — `claude plugin details`.
2. Structural validity — `claude plugin validate`.
3. Invocation determinism, and that routing of `ttak-review` / `ttak-explain` fires when expected —
   `claude plugin eval --ablation with-without` with `tool_used: Skill` graders.
4. One instruction set replaces four, at a stated size.

Does not claim: improved model output, higher constraint adherence, safety enforcement, or any
benchmark result.

Published as known limitations: the §2.1 composition finding, the §2.2 counter-intuitive-constraint
class, and that none of this is a guard.

---

## 6. Weaknesses already identified — go past these

### 6.1 Scope the diagnosis did not call for
The owner's diagnosis of LeanClarity was one item: it had no character. TTAK nonetheless adds
explicit activation, cross-domain routing, and three capabilities. Each is scope the spec's own
evidence-based YAGNI gate (§8.2) would question, and LeanClarity ran without them. Accepted as an
owner decision (D9), recorded as an assumption rather than a justified requirement.

### 6.2 `ACT-004` cannot be met deterministically with zero hooks
`ACT-004` requires an explicit way to deactivate. With skills only, `"stop ttak"` is a model-
interpreted instruction, not an enforced one. The deterministic paths are `/clear` (drops the
context) and `claude plugin disable ttak` (host-level, survives restart). Planned handling: document
this exactly, per `ACT-005`, rather than implying enforcement. The prior review document
(`REVIEW_KO §12.2`) explicitly forbids asserting session persistence that was not verified.

### 6.3 Session persistence with zero hooks is asserted, not measured
Three independent authors — ponytail, i-have-adhd, LeanClarity — each built hook machinery even
though skills already existed. That is evidence that skill-only persistence drifts. TTAK's design
takes the opposite bet. The plan is to measure adherence across turns before deciding whether hooks
are needed, matching `OPEN-03` ("prove necessity before adding"). Until measured, `ACT-003` is a
hypothesis.

### 6.4 The character delta may be too small to justify a separate product
If the model-facing text is LeanClarity's policy nouns plus four headings, TTAK risks being
LeanClarity with a name. D2 and D3 together deliberately constrain how much the text may change.

### 6.5 No automatic Codex evaluation arm
`claude plugin eval` is Claude-only. Codex coverage is a manual checklist, so any cross-host claim
is weaker on the Codex side.

---

## 7. What reviewers are asked to do

1. Find a technical claim in §2.3, §2.4, §3 or §4 that is false or unverifiable on the stated host
   versions.
2. Find a requirement ID in the v0.1 spec that this design violates, silently drops, or cannot meet
   — beyond `ACT-003` and `ACT-004`, which §6 already covers.
3. Find a licensing or attribution obligation that D7 or D10 leaves unmet for public redistribution.
4. Attack the product rationale: state the strongest case that TTAK should not be built, or should
   be built differently.
5. Name any claim in §5 that the named instrument cannot actually support.

Report findings ordered by severity. For each: the evidence, the consequence, and the correction
direction. A finding that is merely a preference is not a finding.
