# TTAK — Design

| Field | Value |
|---|---|
| Date | 2026-09-04 |
| Status | Design. Approved for planning; not implemented. |
| Governs | `TTAK_Plugin_Product_Definition_v0.2_EN.md` — the v0.1 candidate with `TTAK_Plugin_Product_Definition_v0.2_AMENDMENT_EN.md` applied |
| Evidence | `docs/analysis/2026-09-04_TTAK_DESIGN_REVIEW_PACKET.md` and four adversarial reviews |
| Hosts | Claude Code `2.1.259`, Codex CLI `0.150.1` |
| Development platform | Windows 11 Pro 26200, Git Bash, `core.autocrlf=true` |
| Amended by | `docs/TTAK_Plugin_Product_Definition_v0.3_AMENDMENT_EN.md`, 2026-09-06 — §4.1, §4.4, §5.3, §5.4 and the §9 risks table reconciled with the shipped artifact |

---

## 1. Scope

**v1 delivers two things.**

**L1 — the operating discipline.** A body of instruction text, injected by host lifecycle hooks when
the user has turned TTAK on. Carries the `Track · Trim · Adapt · Keep` frame, the engineering
invariants, the response contract, the verification-honesty rules, the user-authority clause, and —
the substantive difference from every predecessor — an explicit statement to the model of where TTAK
ranks against host, repository and user instructions.

**L2 — the explainer.** One model-invocable skill that adapts an explanation to a stated or inferred
reader, defaulting to a capable adult unfamiliar with the topic. This is the one slot verified empty:
both ELI5 upstreams default to age five and the Anthropic community variant emits an HTML artifact.

**Not in v1.** `TTAK Review` (deferred to v1.1 per amendment §2.4). Intensity modes, telemetry,
memory, GUI, and everything else in v0.1 §15.2.

### 1.1 Why hooks and not skills

Codex's host system prompt instructs the model: *"Do not carry skills across turns unless
re-mentioned."* A skill-only core cannot persist there. Moving the core out of the skill layer also
removes, by construction: the Codex validator's rejection of `disable-model-invocation: true`, the
namespaced-invocation surprise (`$ttak:ttak` rather than `$ttak`), `openai/codex#42112`,
`claude plugin details` over-reporting user-only skills, the bare-name slot collision between
user-only and model-invocable skills, and the gap where subagents run TTAK-unaware.

It reacquires a Node runtime, a state file, the Windows hook-stdin defense, and the Codex hook
trust-review step. All four have known solutions in prior art the author owns.

### 1.2 Why not an output style on Claude

An output style would persist deterministically in the system prompt with no runtime code. It was
rejected because **output styles are exclusive**: selecting TTAK's style would displace `Concise`,
which is already set on the development machine and which covers part of the same ground for free.
Hook injection composes with whatever style is active. The same policy text then reaches both hosts
through one mechanism.

Output styles remain a candidate v1.1 addition on Claude if measurement shows hook injection
underperforms.

---

## 2. Architecture

```
                 ┌──────────────────────────────┐
                 │  policy/  (canonical text)   │
                 │  invariants.md  contract.md  │
                 └───────────────┬──────────────┘
                                 │ read at hook time
                 ┌───────────────▼──────────────┐
                 │  hooks/ttak.cjs  (one file)  │
                 │  Node stdlib only, no deps   │
                 └───┬──────────────────────┬───┘
                     │                      │
        Claude Code  │                      │  Codex CLI
   SessionStart      │                      │  SessionStart (startup|resume|clear|compact)
   SubagentStart     │                      │  SubagentStart
   UserPromptSubmit  │                      │  UserPromptSubmit
                     │                      │
                 ┌───▼──────────────────────▼───┐
                 │  <PLUGIN_DATA>/state.json    │
                 │  { "enabled": false }        │
                 │  per host, never synced      │
                 └──────────────────────────────┘

   skills/ttak-explain/SKILL.md   ← model-invocable, both hosts, independent of state
```

Two independent surfaces. L1 is stateful and injected; L2 is stateless and invoked. L2 works whether
or not L1 is on — it is self-contained, because a skill loaded in a session where L1 is off must not
silently lose the frame it refers to.

### 2.1 Shared versus host-specific

| Asset | Shared | Note |
|---|---|---|
| `policy/*.md` | Yes | Single canonical text |
| `hooks/ttak.cjs` | Yes | One runtime, host detected at run time |
| `hooks/hooks.json` | Yes | Both hosts read the same event/matcher/handler shape |
| `skills/ttak-explain/SKILL.md` | Yes | Provider-neutral text; no host-specific invocation syntax inside |
| `.claude-plugin/plugin.json` | No | Claude manifest |
| `.codex-plugin/plugin.json` | No | Codex canonical manifest, with the `interface` block |
| `.agents/plugins/marketplace.json` | No | Codex marketplace, object `source` schema |
| `.claude-plugin/marketplace.json` | No | Claude marketplace; Codex reads it only as a legacy fallback and `.agents/` wins |

The two marketplace files have different `source` schemas and no tool checks that their version and
source agree. A CI check must.

---

## 3. File layout

```
ttak/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .codex-plugin/
│   └── plugin.json
├── .agents/plugins/
│   └── marketplace.json
├── assets/
│   └── logo.png
├── policy/
│   ├── invariants.md          # engineering discipline + protected nouns
│   ├── contract.md            # response, verification, user authority
│   └── precedence.md          # the delivered ranking statement
├── hooks/
│   ├── hooks.json
│   └── ttak.cjs
├── skills/
│   └── ttak-explain/
│       └── SKILL.md
├── tests/
│   ├── ttak.test.cjs          # node --test, deterministic
│   └── conformance/           # cross-host runner cases
├── docs/
├── .gitattributes             # * text=auto eol=lf
├── ATTRIBUTIONS.md
├── LICENSE
├── README.md
└── README.ko.md
```

`policy/` is split three ways because the three files have different injection scopes (§4.3), not for
tidiness.

---

## 4. The hook runtime

One file, Node standard library only, no dependencies, no network, no telemetry. The plugin root is
read-only at run time; the only writes go to host-provided plugin data.

### 4.1 State

`<PLUGIN_DATA>/state.json`, exactly one key: `{"enabled": <boolean>}`.

- **Absent state means OFF.** This inverts the predecessor's default and is what makes `[ACT-001]`
  hold: installing the plugin injects nothing.
- Each host owns its own file. They are never synchronized.
- Codex creates no part of `<CODEX_HOME>/plugins/data/`; Claude Code pre-creates its leaf. Observed
  per host in `docs/analysis/codex-cli/2026-09-04-host-integration.md` §3.1 and
  `docs/analysis/claude-code/2026-09-04-host-integration.md` §1.3.
- A path missing at **any** depth is **absent state on read**, provided the nearest name that does
  exist above it is a traversable directory. It is created only by an `on`/`off` write or by the
  §4.4 notice. **Lifecycle reads never create anything, at any depth** — unchanged, and pinned by a
  test at every depth.
- Classification asks two questions, because one answer cannot serve both: `lstat` whether the name
  exists, and `stat` whether it can be traversed. A name occupied by something unusable — a plain
  file where a directory belongs, a dangling junction — therefore reports **unavailable** rather
  than a confident `absent`, as does a stat failure. `unavailable` is distinct from absent, and the
  distinction is what keeps the status prompt from reporting a confident OFF for a path nothing can
  ever be written to.
- Writes are atomic: write a temporary file in the same directory, then rename over the target, then
  read back and verify.

### 4.2 Events

| Event | Matcher | Behavior when ON | Behavior when OFF |
|---|---|---|---|
| `SessionStart` | `startup\|resume\|clear\|compact` | Inject `precedence` + `invariants` + `contract` once for this invocation | Nothing, except the one-time notice (§4.4) |
| `SubagentStart` | none | Inject `precedence` + `invariants` only | Nothing |
| `UserPromptSubmit` | none | Control prompts only (§4.5); ordinary prompts are a no-op | Same |

`compact` is in the `SessionStart` matcher deliberately. Compaction is where a skill-only design loses
its anchors; re-injection after compaction is a primary reason this design uses hooks.

A subagent receives `invariants` and `precedence` but not `contract`, because the response contract
governs what the user reads and a subagent's output goes to its caller.

### 4.3 Injection is all-or-nothing

If `precedence` or `invariants` cannot be read or fails validation, nothing is injected into a main
session — a partial contract is worse than none, because the user believes TTAK is active. A subagent
requires `precedence` and `invariants` only.

The runtime never truncates, summarizes, or substitutes policy text because a context is long. If a
release candidate exceeds a host limit, the canonical policy is edited and the checks are re-run.

### 4.4 First-session notice

When state is absent and a `<PLUGIN_DATA>/.notified` flag does not exist, `SessionStart` injects one
short line naming the activation prompt, then writes the flag. It never repeats. If the flag cannot be
written, the notice is skipped rather than repeated — a nag is worse than a missed hint.

**The notice creates its own directory path, under the same rule `writeState` follows: a deliberate
write creates the full path under the host-designated root.** §4.1's "lifecycle reads never create"
governs reads and is unchanged. The notice is a deliberate one-time write and is exempt.

This is not a detail. Task 5's review found that without the exemption the notice never fires at all
on a fresh profile of the host that does not pre-create the leaf — `readState` correctly reports
`absent`, the notice branch is entered, the flag write throws because the directory is missing, and
the handler returns silently, every session forever. The plugin ships off and this notice is its only
discovery path, so that user never learns it is installed or what prompt turns it on. It is the same
failure the predecessor shipped three candidates to escape, reached from the opposite direction.

This is the ponytail statusline-nudge pattern, which is already shipped and proven.

The earlier rule — create the leaf only, and only when its parent already exists — is replaced
because it made TTAK impossible to enable on one of its two hosts. Codex never creates
`<CODEX_HOME>/plugins/data/`, so on a fresh profile the parent is always missing, `ttak on` returned
its error message every time and the notice never fired. Observed on three genuinely fresh
`CODEX_HOME` directories and re-run against the fix:
`docs/analysis/codex-cli/2026-09-04-host-integration.md` §3.1–§3.3 and its "Design deviation,
deliberate, recorded here rather than in the design" note. The safety the old rule protected is held
by `dataRoot()`, which returns `null` unless the host named a root, so a recursive create can only
ever happen under a directory the host chose.

### 4.5 Control prompts

Three exact strings, matched against the whole prompt after `trim()` and `toLowerCase()`:

```
ttak        → report the saved setting and its boundaries
ttak on     → save enabled = true
ttak off    → save enabled = false
```

Anything else is an ordinary prompt. `/ttak`, `ttak status`, trailing punctuation, extra tokens,
internal newlines, and any mention inside a sentence are ordinary prompts. A recognized control prompt
is blocked from reaching the model with `decision: "block"`; the display text goes in `reason` only.

**Unverified:** the `{"decision":"block"}` shape is documented for the Codex hook contract. Claude
Code's documented blocking route for `UserPromptSubmit` is exit code 2 with stderr, or its own JSON
shape — this is the one place the two hosts may diverge, and it is not settled by reading. Task 5
implements the Codex-documented shape only and does not add a second shape speculatively; Task 12's
host-integration checklist records the observed shape on each live host before this is relied upon.

`ttak` reports the saved setting and the boundaries at which it applies. It does not claim the current
conversation is exactly ON or OFF, because a saved-setting change is not retroactive: `startup` and
`clear` are clean boundaries; `resume`, `compact` and `fork` are inherited.

Plain prompts rather than slash commands because this is the only form that behaves identically on
both hosts. Codex plugin skills are namespaced (`$ttak:ttak-explain`) and there is no plugin-provided
slash command surface there.

### 4.6 Failure behavior

| Condition | Ordinary prompt | Control prompt | Lifecycle injection |
|---|---|---|---|
| Runtime error | Fail open, prompt proceeds | Blocked, bounded error message | No injection |
| State corrupt but readable regular file | Fail open | `on`/`off` may repair | No injection |
| State unreadable or non-regular | Fail open | Blocked, no automatic repair | No injection |
| Data root unavailable | Fail open | Blocked, no directory creation | No injection |
| Policy file invalid | Fail open | Unaffected | No injection (§4.3) |

Errors never emit raw prompt text, paths, state contents, or exception detail. Corrupt state is never
guessed as ON or OFF.

### 4.7 Windows

`UserPromptSubmit` on Claude Code for Windows can be launched through a PowerShell wrapper that
swallows the piped prompt JSON, so `stdin`'s `end` never fires and the session freezes
(ponytail #443). Required defenses, all present in the prior art:

- a 1000 ms fallback timer, `unref()`ed so it adds no latency on the normal path
- an explicit `stdin` `error` handler that finishes and exits 0
- strip a UTF-8 BOM before `JSON.parse`
- never exit non-zero from a lifecycle hook except where a block is intended

Codex supports `commandWindows` for a Windows-specific hook command; the Node invocation is identical
on both platforms, so it is not needed.

---

## 5. Policy text

### 5.1 What goes in

| File | Content | Rationale |
|---|---|---|
| `precedence.md` | Where TTAK ranks against system, host, repository, project and user instructions; that it yields to all of them; that it is guidance and not a guard | Both upstreams told the model their rank and the predecessor dropped both statements. Its own evidence calls this the most important unresolved conflict: the specification knew the ranking and the model did not. |
| `invariants.md` | Understand before changing; reuse order; smallest complete change at the right boundary; root cause over symptom; no unrequested abstraction; **the protected nouns, preserved**; leave one runnable check; analysis-only requests do not mutate code | `[TTAK-TRIM-009]` is new; the protected nouns are covered by the amended `[SRC-002]` |
| `contract.md` | Lead with the task-appropriate answer; numbered steps only for genuinely multi-step work; distinguish run from unrun checks and performed from proposed work; honor requested detail without a brevity or list cap; one next action only when work remains; stop blind iteration after repeated same-reason failure; user authority over simplification | `[TTAK-TRACK-008]` is new; `[RESP-007]` takes its amended conditional-positive form |

### 5.2 What stays out

- Anything a host already enforces. The response section states what `Concise` does not do — the
  run/unrun distinction, the performed/proposed distinction, and the protection of requested detail —
  and does not restate preamble suppression at length.
- Any prohibition appended to an upstream rule that the upstream did not have. That form has a
  measured 6/6 failure across two hosts and two candidates.
- Mechanical output templates, fixed line counts, list caps, mandatory time estimates, and forbidden-
  phrase blacklists. v0.1 §5.3–§5.6 already exclude these; the predecessor's non-mandated list reached
  the same conclusion independently.
- Host-specific invocation syntax. It differs per host and belongs in the README.
- The strings `Claude`, `you are Claude`, and any provider-specific reference. Both hosts read this
  text; OpenAI's conversion guidance requires provider-neutral wording.

### 5.3 Character

The operating frame — `Track · Trim · Adapt · Keep` — appears in the `displayName` of all three
manifests that carry one, and so on the host listing surface. It does **not** appear as headings in
the injected text, whose headings are `# Precedence`, `# Invariants` and `# Response contract`.
Persona prose does not appear in the injected text either, until the three-arm ablation (`OPEN-12`)
shows a user-experience effect. Until then the brand lives in the name, the logo, the README, and the
marketplace `interface` block, which cost no runtime tokens.

This follows the reviewer's argument directly: user experience is observable model behavior. If
operating-frame headings change structure, directness or memorability, that is an effect and must be
measured. If they change nothing, they should not be paid for. That is what `OPEN-12`'s middle arm
is for; until it runs, nothing is paid.

### 5.4 Derivation

Policy text is written from the upstream `SKILL.md` files directly where it can be.
`policy/invariants.md` and `policy/contract.md` were written from the predecessor's policy files
instead; spec §19.3 permits that two-step chain where it is recorded, and it is recorded
(`ATTRIBUTIONS.md`, `wotjr1649/leanclarity`; `docs/COPIED_TEXT_INVENTORY.md` "Controller ruling" and
F1). For two units the one-step chain is not available at all: `policy/invariants.md` I2 and
`policy/contract.md` C5 originate with the predecessor and have no upstream `SKILL.md` source
(`docs/COPIED_TEXT_INVENTORY.md` F2).

TTAK restores two units the predecessor deliberately dropped — the precedence clause and the
user-authority clause — which are absent from its text. The persona is not a third: §5.3 gates
persona prose on `OPEN-12`, and no persona text ships.

---

## 6. The explainer skill

`skills/ttak-explain/SKILL.md`, model-invocable on both hosts. No `disable-model-invocation` (the
Codex validator rejects it) and no `agents/openai.yaml` (implicit invocation is the default and is
wanted here).

Frontmatter:

- `name`, `description`, `license` only.
- The description is **quoted**, front-loads trigger terms, and stays well inside the per-entry limit.
  Front-loading matters because both hosts abbreviate descriptions when the listing overflows, and
  Codex's catalog budget is 2% of the context window or 8,000 characters when it is unknown.
- Quoting matters because `anthropics/claude-code#80890` silently skips a `SKILL.md` with CRLF line
  endings and an unquoted description containing `": "` — and TTAK's natural descriptions contain
  colons.

Body: four default reader profiles (beginner, practitioner, expert, decision-maker), a user-stated
audience overriding the default, purpose before mechanism, accuracy mandatory at every level, analogies
optional and removed when they build a false model, and no inference of age, diagnosis, education or
intelligence.

The body is self-contained. It restates the two invariants it depends on — accuracy is not traded for
simplicity, and no audience inference without evidence — so that a session where L1 is off still gets a
correct explainer.

Invocation is `/ttak:ttak-explain` on Claude Code (the bare `/ttak-explain` also resolves but loses its
slot to any model-invocable skill of the same bare name) and `$ttak:ttak-explain` on Codex.

---

## 7. Distribution

### 7.1 Manifests

`.codex-plugin/plugin.json` is the canonical manifest for Codex local installation and carries the
required `interface` block: `displayName`, `shortDescription`, `longDescription`, `developerName`,
`category`, `capabilities`, `defaultPrompt`, plus `logo` and `composerIcon` pointing at `assets/`.
`name` must be kebab-case and `version` strict semver. The publish validator rejects a `hooks` field in
the manifest even though the runtime supports one, so hooks are declared only in `hooks/hooks.json`.

`.claude-plugin/plugin.json` requires only `name`. Every place a license is declared — both plugin
manifests, both marketplace files, the `LICENSE`, and the skill frontmatter — carries one identical
string, enumerated and checked in CI rather than counted here. The single reason the upstream license
ambiguity existed was a manifest/LICENSE mismatch; reproducing it would be self-refuting.

**Unresolved:** the Codex publish validator rejects a `hooks` field in `plugin.json` while the Codex
runtime supports one, and Ponytail ships that field today. This design declares hooks only in
`hooks/hooks.json` and relies on default discovery, which is how i-have-adhd ships them for Claude
Code — but Codex-side discovery without the manifest field has not been verified. Resolving this is a
first-phase implementation task, not an assumption: if discovery fails, the field is required for the
runtime and must be removed for publication, and those two facts have to be reconciled before
submission.

The explicit `"skills": "./skills/"` entry is redundant — both hosts discover `skills/` by default —
but is kept because it makes the Codex manifest self-describing at review time.

### 7.2 Superseding the predecessor

New plugin identity `ttak`, plus a final `leanclarity` release that removes its active guidance and
points to TTAK. A new identity alone would let both be installed and enabled at once, which is the
opposite of the intent; the tombstone release closes that path. The Anthropic directory mirrors GitHub
changes automatically, so the predecessor's listing description must be updated too, not just its
README.

The README states the lineage and inherits the predecessor's published measurements, including the
negative ones. It also warns against running TTAK alongside Ponytail, because that is the combination
under which guards were measured being removed.

### 7.3 Marketplace prerequisites

Tracked as `OPEN-13`, unbuilt and blocking submission: privacy policy URL, support URL, terms URL,
website, logo, at least three working examples, five positive and three negative test cases, verified
developer identity, and a Console organization role. Listing text must match actual functionality
exactly, which constrains it to §6 of the amendment.

`TTAK` is the designated prefix of Korean national ICT standards issued by TTA in the product's own
target market. Listings carry a distinguishing full form. Trademark clearance is out of scope here and
needs professional review before public listing.

### 7.4 Line endings

`.gitattributes` with `* text=auto eol=lf`. Verified on this machine under `core.autocrlf=true`: the
predecessor's repository, which has this file, checks out with zero CR bytes; Ponytail's, which does
not, checks out with CR bytes in every file including its manifests. Two consequences make this
non-optional: injected-size figures are computed from string length, so CRLF inflates them by one byte
per line and makes a "reproducible" number checkout-dependent; and `#80890` can silently skip a
`SKILL.md` entirely.

---

## 8. Verification

### 8.1 Deterministic — `node --test`, no host, no network

State machine (absent, on, off, corrupt-readable, unreadable, non-regular, missing leaf, missing
parent); atomic write and read-back; concurrent writers; injection presence and content per event and
per state; subagent receiving `invariants` + `precedence` and not `contract`; control-prompt parsing
including every near-miss that must stay an ordinary prompt; the full failure matrix of §4.6; that
output is either empty or exactly one parseable JSON object with the real event name; that no shipped
file contains a CR byte; that the license string is identical across all seven places it appears.

### 8.2 Host integration — manual, evidence recorded

Per host: install, trust hooks where required, observe injection at each lifecycle source, toggle on
and off and confirm the saved setting survives a restart, confirm a subagent receives the reduced
composition, confirm the first-session notice fires exactly once, confirm no context spill when off.
Codex additionally: fresh profile with no pre-created plugin data directory, and the `/hooks` trust
step in the documented order.

### 8.3 Conformance — cross-host runner

`claude plugin eval` is early-access gated on this account, verified by execution. The replacement is
one script:

```
claude -p --output-format json --setting-sources "" --model <pinned> ...
codex exec --ephemeral --ignore-user-config --sandbox read-only --json ...
```

Isolation is the point. Without `--setting-sources ""` and `--ignore-user-config`, the operator's own
plugins, hooks and output style leak into the baseline arm — and on this machine the baseline would
otherwise inherit `Concise` and an enabled Ponytail, measuring TTAK against itself and against a
competitor at once. The model is pinned explicitly and recorded with every published figure.

Cases map to the v0.1 §17.2 scenario groups and score **absolute conformance to TTAK's own
specification**, not superiority over a baseline. A baseline arm still runs, so `[AC-005]`'s
no-regression check is available; a single-run difference is not a regression, since the predecessor
measured run-to-run reproducibility at ≈0.96 with a 39.3% upper bound on the true failure rate.

`OPEN-06` stands: routing measured in an environment where TTAK is the only installed skill cannot
fail and therefore proves nothing. Any routing figure must state the installed-skill set it was
measured under.

### 8.4 Size and structure

Injected size in bytes and tokens, computed from the shipped policy files. `claude plugin details` for
the explainer skill's catalog cost, with the caveat that it does not count hook-injected content.
`claude plugin validate` invoked three times — repository root, plugin manifest path, and skills
directory — because a single root invocation with a `marketplace.json` present checks only that file.

### 8.5 Human review

`[AC-010]` requires a human adversarial review of the final English policy text before release. It is a
release gate, not an optional step, and no automated instrument replaces it.

---

## 9. Risks carried into implementation

| Risk | Handling |
|---|---|
| Codex hook trust review means installation alone does not activate | Documented in the install flow as a required step, not a footnote |
| Windows hook-stdin freeze | §4.7 defenses are mandatory, with a regression test |
| Persona runtime cost unjustified | Frame in packaging only — the manifests' `displayName`, not headings in the injected text; persona prose gated on `OPEN-12` |
| Explainer routing under a realistic skill set | `OPEN-06`; measured figures must name their installed-skill set |
| Guidance does not compose safely | Republished as a limitation; README warns against running alongside Ponytail; TTAK is stated not to be a guard |
| Two marketplace manifests can drift | CI check on version and source agreement |
| Codex hook declaration: validator rejects the manifest field the runtime supports | Verify default discovery from `hooks/hooks.json` on Codex in phase 1; if it fails, the conflict is a submission blocker and must be raised upstream rather than worked around |
| `node --test` and the runner add a toolchain the plugin itself does not need | Test-only; the shipped plugin keeps zero dependencies and the runtime stays Node stdlib |
| `[LIC-001]` inventory does not exist | Blocks `[LIC-007]` and `[AC-012]`; the inventory is a planned deliverable, and MIT is the expected outcome, not a completed decision |
| Review's niche unverified | `OPEN-15`; competitor check before v1.1 scope is set |

---

## 10. What this design does not settle

The v0.2 amendment must be approved and applied to both language documents before implementation
begins; until then the v0.1 candidate is the normative text. Marketplace prerequisites (`OPEN-13`),
trademark clearance (`OPEN-14`), the copied-text inventory, and the persona ablation (`OPEN-12`) are
all outside this document and each blocks a specific later gate.
