# TTAK — Track · Trim · Adapt · Keep

<img src="assets/logo.png" alt="TTAK" width="128" align="right">

An opt-in instruction set for Claude Code and Codex CLI with focused review and audience-adaptive
explanation. It supports lean development and visible progress during long work.
**This is an unqualified release candidate.** Its four capabilities and current shipping gate are defined
in [the current release scope](docs/RELEASE.md). Historical measurements below concern the earlier
policy; they do not validate this candidate or establish general improvements in quality or cost.

한국어: [README.ko.md](README.ko.md)

## What it is

One short operating discipline, two task-specific references, and a settings skill.

- **The discipline.** A single policy file — track the actual goal and the evidence, trim work that
  adds no present value while preserving required behavior and safeguards, fit the depth and language
  to the reader, keep progress and completion honest — injected by a host lifecycle hook at session
  start, and only when you have turned it on.
- **The references.** Reader-aware explanation and focused complexity review are reference files the
  discipline names rather than skills you invoke. The model reads whichever the task calls for, and
  neither for an ordinary short answer.
- **The settings skill.** `ttak` reports the saved setting; `ttak on` and `ttak off` change it.
  Nothing else in the plugin touches settings, and the skill cannot reach the setting itself — see
  [Turning it on](#turning-it-on).
- **Progress guidance.** The discipline keeps useful state changes visible across longer work and
  reconnects an interruption to the unfinished goal, from records it can actually reach.

Explanation and review are no longer separately invocable skills; the predecessor's versions are
still in this repository and are not what the marketplaces serve. **Subagents receive nothing.**
Session-start context does not reach them — measured 2026-09-15, a subagent asked for the first line
of any TTAK guidance in its context answered `NONE` — and this plugin does not inject at subagent
start.

## What it is not

- **Not a guard.** Not an enforcement mechanism, not a security control, not a correctness guarantee.
  It is text the model reads and interprets, and the model can ignore it. Permissions, sandboxing and
  approval prompts remain the only things that actually constrain what happens.
- **Not a claim of better output.** See [What is measured](#what-is-measured).
- **Not always on.** Nothing is injected until you turn it on, per host.

## Install

`node` must be on the PATH the host uses to run hooks. The plugin has no dependencies and makes no
network calls.

### Claude Code

```text
/plugin marketplace add wotjr1649/ttak
/plugin install ttak@ttak
```

Send those as two separate prompts. The same from a terminal:

```text
claude plugin marketplace add wotjr1649/ttak
claude plugin install ttak@ttak --scope local
```

`--scope local` enables it for the current project only; `--scope project` or `--scope user` widen
it. Start a new session afterwards.

### Codex CLI

```text
codex plugin marketplace add wotjr1649/ttak
codex plugin add ttak@ttak
```

Codex **will not run a plugin's hooks until you enable them, and installing is not enough.** The
candidate declares two events, `SessionStart` and `UserPromptSubmit`, with one command handler each.
Enable both.
The CLI's `/hooks` lists them per event with an installed and an active count; the ChatGPT desktop
app's hook settings list the plugin by name with one toggle per event. The run behind this paragraph
used the desktop app and covered the original three events. The current candidate adds evidence
recording, independent fact and final explanation checks, and session cleanup; its current validation
is recorded in the [release work log](docs/RELEASE_RESUME_2026-09-14.ko.md).

Until they are on, the failure is worse than silence. `ttak on` is not consumed by the plugin, so it
reaches the model as an ordinary prompt — and the model may answer as though it had worked. In one
observed run it read the explainer's own skill file and replied that it had turned an explain mode
on. Nothing had been saved. **If `ttak` does not answer with `TTAK saved setting: …`, the hooks are
not enabled yet.**

Hooks are on by default: on Codex CLI `0.153.4` they ran with no `[features]` block in
`~/.codex/config.toml` at all, three trials, so `[features] hooks = true` is only needed if you have
turned the feature off. Whether an older Codex required it is **not verified**. Codex has no
per-project enablement: the plugin applies to the whole user profile until you remove it (see
[Removing it](#removing-it)).

## Turning it on

**TTAK ships off.** Installing it injects nothing. Three prompts control it, per host:

| Prompt | Effect |
|---|---|
| `ttak on` | Save the setting as on for this host |
| `ttak off` | Save the setting as off for this host |
| `ttak` | Report the saved setting |

The prompt must be exactly one of those three. On Claude Code `/ttak off` and `/ttak:ttak on`
reach the same hook, measured on `2.1.270`. The matcher also accepts `$ttak`, which has not been run
on Codex. A quotation, a trailing comment or a second command
on the same line is not a control prompt and is left alone.

**The settings skill cannot change the setting.** Neither host puts the plugin data directory in the
environment the model's shell gets, so `node hooks/ttak.cjs on` run from the skill reports the
setting as unavailable on both. The skill says so and points at the prompt forms above, which run in
the hook's own environment. Measured on both hosts, 2026-09-15.

The setting is saved per host and the two hosts are never synchronised. It takes effect at the next
session start, on all four of the sources the hook's matcher covers: a new session, a resumed one,
`/clear` and `/compact`. All four were observed injecting the full text, 3/3 each
(`docs/analysis/claude-code/2026-09-04-host-integration.md`) — re-injecting after a compaction is
one of the reasons this is a hook and not a skill. A `fork` is the one session source the matcher
leaves out. Turning it off does not remove text already injected into the conversation you are in,
so `ttak` reports the *saved setting*, not a claim about that conversation.

### A control prompt is consumed and does not reach the model

This is the part worth knowing before it surprises you. The three strings above are matched against
the **whole** prompt after trimming and lowercasing. When one matches, the plugin answers and the
turn is blocked: **the model never receives it.** So a message consisting only of the word `ttak` is
not a question you asked the model — it is a plugin command, and if you meant it as a question, it is
gone. Add any other word (`ttak status`, `what is ttak`, `ttak.`) and it is an ordinary prompt that
reaches the model normally.

The slash form depends on the host, the version and which plugin is loaded, and the candidate changed
it. Through `claude -p` on `2.1.261` with the predecessor, both `/ttak` and `/ttak on` answered
`Unknown command: /ttak`, 3/3; in the interactive TUI `/ttak on` answered the same way, 5/5, while a
bare `/ttak` ran that plugin's own `/ttak:ttak-explain` and loaded the explainer instead, 4/4 — the
sigil and that plugin's skill namespace shared the prefix. On `2.1.270` with the candidate, `/ttak
off` and `/ttak:ttak on` both reach the hook and are consumed by it, measured 2026-09-15 through
`claude -p`; the interactive TUI has not been re-measured. On Codex CLI `0.153.4` — measured through
`codex exec`; its interactive session is not verified — the same text arrives as an ordinary prompt
and goes to the model. The bare word is the form that has worked throughout.

### What you see when a prompt is consumed depends on the host

Observed on live hosts, three trials each
(`docs/analysis/claude-code/2026-09-04-host-integration.md`,
`docs/analysis/codex-cli/2026-09-04-host-integration.md`):

- **Claude Code `2.1.261`** shows the plugin's reply framed by the host: a line reading
  `UserPromptSubmit operation blocked by hook:`, then the reply, then
  `Original prompt: <what you typed>`. The interactive session frames it the same way, three trials,
  and it is not flagged as an error either place — the host records it at the same level it gives an
  ordinary notice like `Unknown command`.
- **Codex CLI `0.153.4`** shows **nothing** in `codex exec --json` — the turn completes with zero
  tokens and the reply text appears nowhere in the output. **The interactive UI does show it**, as
  `Blocked by hook` followed by the reply. Two differences from Claude Code: the frame is shorter,
  and Codex does not echo your prompt back. So `ttak on` gives you a confirmation on both hosts
  interactively, and on neither under `-p`/`exec`.

In both cases the model never received the prompt.

## The references

There is nothing to invoke. Ask for the explanation or the review in plain language and the
discipline points the model at the matching file; an ordinary short answer reads neither.

**Measured on Claude Code 2.1.270, one trial each, in a profile with nothing else loaded.** A
factual one-liner read no reference and used no tools. An audience-tailored request read the
explanation reference once. A complexity review read the review reference, kept a compatibility
adapter that twelve external consumers depend on, and stated that it had not inspected any code.

That selection also appeared to move the data-loss case in [What is measured](#what-is-measured), in
a profile with nothing else loaded. **That no longer reproduces.** The case now fails wherever the
model has to reach the file for itself: 0 of 30 on each of six model configurations in the matrix,
where each trial runs in an empty directory and the read is denied outright, and 0 of 3 through the
original harness at the original working directory, where it is not. What does move it is the same
words injected instead of pointed at — 27 of 30 on `claude-opus-5`. **Guidance the model has to open
a file to receive is guidance that may not arrive**, and with the user's own instruction files
present it opened the reference and returned the script without its safeguards anyway.

## What is measured

**The figures in this opening subsection concern the predecessor.** TTAK's own later experiments
and their limitations are recorded below and in `docs/FINDINGS.md`.
The predecessor figures come from an earlier plugin by the same author, built for the same two hosts,
whose policy text TTAK's was adapted from. They are published here, unfavourable ones included,
because they are the closest evidence that exists for this kind of guidance and because leaving them
out would make TTAK look untested rather than tested-and-null. That plugin's repository is being
retired, so these numbers cannot be checked against it — read them as inherited, not as observed
here.

- **No resolvable behaviour difference.** Two paired on/off studies. **All eight case-by-host cells
  returned Fisher `p = 1.0000`**, and nothing among 24 tests survived Holm correction. The one
  behaviour the first study did resolve turned out to be redundant with text `ponytail` already
  carried. This is the reason the top of this file does not claim better output.
- **The predecessor's own behaviour gate failed.** `LCL-BEH-001`: **5 of 17** frozen cases did not
  pass over 102 runs. Release was recorded as `NOT VERIFIED` and complete sign-off was never granted.
  One of the five has a recorded cause — a prohibition appended to a rule the upstream did not have.
  It failed 6 of 6 across both hosts on the frozen candidate, and 3 of 3 again on Claude after a
  revision built specifically to fix it; TTAK drops that clause. A second failed 24 of 24 at every
  compression level and is classified in the same evidence as a constraint that opposes the model's
  defaults, which published work measures failing regardless of how it is worded. TTAK has not
  re-run the gate, so it inherits the failure until it does.
- **Instrument noise is large.** Run-to-run reproducibility was about 0.96, which puts the 95% upper
  bound on the true failure rate at 39.3%. Part of the 5 is noise. That cuts both ways: it is also
  why a single-run improvement would not be evidence of one.
- **Context size, the one reproducible positive.** 11,584 characters of upstream guidance were
  consolidated to 2,486. Its own evidence puts that in proportion: roughly 620 tokens, about 0.06% of
  a 1M-token context window, on the order of $0.002 per session at Claude Opus 5 rates. The
  percentage saved is large; the base is negligible.

### Guidance does not compose safely, and TTAK does not fix that

Measured on 2026-08-30 with [`ponytail`](https://github.com/DietrichGebert/ponytail) loaded alongside
and both hosts at high reasoning effort: asked to shorten a function that deletes records,
**data-loss guards were observed removed in 8 of 24 runs**, observed intact in 11, and in the
remaining 5 the checker could not reach the destructive path at all.

Three things about that figure:

- It is itself a published correction. The earlier number was **13 of 24**, which had counted
  observation failures as removals. 8 is the corrected count, and it is the one to use.
- **The rate was the same whether the predecessor was on or off.** Superseding it does not remove the
  condition. TTAK inherits it.
- A follow-up tried to separate "another instruction set was loaded" from "reasoning effort was
  high" and could not. Read both as conditions of the measurement, not as its established cause.
- `ponytail`'s own clause forbidding exactly that did not hold, and the predecessor's did not restore
  it. Neither will TTAK's.
- **That last sentence is now an observation rather than an expectation.** Asked to simplify a
  cleanup script carrying a path-containment check, a `--yes` gate and a dry-run preview, the
  candidate returns it with all three removed — and so does the baseline. Six model
  configurations, thirty trials per arm, **0% in both arms on every one of them**. The returned
  scripts were then executed: 350 of 359 deleted files outside their own project root. The
  predecessor's Codex runs did separate from their baseline, but that was a different and larger
  policy on an older CLI, and it is not this candidate's result. See *What v1 claims* below.

**Running TTAK alongside `ponytail` is not recommended.** If overlapping instruction sets are
installed, disable one through the host's own plugin controls; TTAK does not detect, disable or
remove anything else. And regardless of what is installed: review destructive changes yourself. This
is one synthetic case on two pinned models, not a survey — but it is the measurement that exists, and
none of these instruction sets is a guard.

### Size of the injected text

**The candidate injects one file.** At session start it is `policy/core.md` with its two reference
paths resolved: 1,740 bytes in the profile measured here, about 435 tokens at four characters per
token. The exact size moves with the length of the install path. At subagent start it injects
nothing. Nothing is injected at all until you turn it on.

**It was 1,224 bytes until 2026-09-17.** The safeguard paragraph of `references/review.md` is now
inlined rather than pointed at, because the pointer delivered nothing — `[AC-001]` reads 0/33 with
it and 27/30 with the paragraph inlined, on the same CLI build, Fisher p = 8.3e-15. The added 516
bytes are about 129 tokens; this repository's own accounting of a 620-token saving calls that base
negligible. What the change does **not** buy is in
[`docs/INLINE_EXPERIMENT_2026-09-16.md`](docs/INLINE_EXPERIMENT_2026-09-16.md) §4: three data-loss
safeguards the paragraph does not name were measured under the same policy, and two of them moved
not at all.

**The predecessor** is still in this repository and is what `scripts/measure-injection.cjs` measures,
so its table stays as recorded:

| Scope | Bytes | Approx. tokens (~4 chars/token) |
|---|---|---|
| Session start (precedence + invariants + contract) | 3,645 | 911 |
| Subagent start (precedence + invariants) | 2,303 | 575 |

These are byte counts taken directly from the shipped files with the composition the hook performs,
plus a token approximation at four characters per token — an estimate, not an exact token count.
Reproduce both with `node scripts/measure-injection.cjs`. The figures in this table fail the suite if
the policy files or this table drift from what that command prints.

**The subagent row is what TTAK injects, not what a subagent ends up holding.** On Codex a subagent
is a fork of the thread that spawned it, so the parent's conversation — including the parent's own
2,977-byte injection, response contract and all — is carried into it alongside the 2,000. Narrowing
the payload does not narrow the context there, and no hook can undo it: a hook adds text, it cannot
remove text already in a conversation. Observed 2026-09-06 and recorded in the codex-cli document. Host tooling is not used for this
number because `claude plugin details` does not count hook-injected content.

## What v1 claims, and what it does not

**Claims.** It injects the text in `policy/` when you turn it on, and nothing when you do not. It
states to the model where it ranks and that it yields to host, repository and user instructions. It
ships an explainer that defaults to an adult reader rather than to a child. It costs the bytes in the
table above. It has zero dependencies, makes no network calls, and writes only to the host's own
plugin data directory.

**Does not claim.** Better output, higher correctness, fewer defects, faster work, or any benchmark
result. Safe composition with other instruction sets — measured otherwise. That the behaviour gate it
inherits passes — it does not, and it has not been re-run. **The candidate's own conformance gate
does not pass, and the measurement behind that is now a large one.** Every hard MUST — `[AC-001]`
through `[AC-004]`, six cases — at thirty trials per arm on six pinned model configurations:
`claude opus/high`, `claude sonnet/high`, `claude haiku`, `gpt-5.6-sol/high`, `gpt-5.6-terra/high`
and `gpt-5.6-luna/high`. 2,160 rows, every one verified against its host's own transcript, read by
two blind graders from different model families — 90.0% agreement, kappa 0.739 — with their
disagreements held out and every figure reported three ways: as the graders agreed it, and with the
held-out rows counted each way in turn.

**Not one of the 24 configuration × criterion comparisons survives an adverse reading of the
held-out rows.** The one that keeps its direction does so at Fisher p = 1. `[AC-001]`, the data-loss
criterion, is **0 in both arms on every one of the six** — 0 of 180 graded treated rows and 0 of
179 graded baseline rows. Executed rather than read, 350 of 359 returned scripts deleted files
outside their own project root. **TTAK did not prevent that, and
its absence did not cause it.**

**Part of why is a delivery defect, and that part is measured.** What the candidate says about
safeguards is not in the text it injects — it is in `references/review.md`, behind a pointer the
model often cannot follow. Injected inline instead, the same words take `[AC-001]` from 0/30 to
**27/30** on `claude-opus-5`. Two data-loss safeguards those words never name were then measured the
same way: one went to **11/30**, the other stayed at **0/30**. The pointer beat the baseline on none
of the three. So what is established is narrow and uneven: **delivering the text works, it works
best on the safeguard the text names, it reaches some it does not name, and it does not reach all of
them.** Which is which, and why, is in
[`docs/INLINE_EXPERIMENT_2026-09-16.md`](docs/INLINE_EXPERIMENT_2026-09-16.md) §4 — with the reading
that fits those three numbers labelled as the hypothesis it is.

Two figures elsewhere in this repository belong to the **predecessor**, not to this candidate. The
Codex arm separation — 11 of 30 against 0 of 30, 7 of 30 under the settled criterion — was measured
on a 2,977-byte policy on codex-cli 0.153.4; the candidate, on three GPT models at n=30, is 0/30 in
both arms. And an `[AC-001]` result of 7 of 10 recorded on 2026-09-14 **does not reproduce**: 0 of
63 two days later, across two harnesses, two reasoning-effort settings and two working directories,
with no cause identified.

The candidate's record is in [`docs/MATRIX_FINDINGS_2026-09-16.md`](docs/MATRIX_FINDINGS_2026-09-16.md)
and [`docs/INLINE_EXPERIMENT_2026-09-16.md`](docs/INLINE_EXPERIMENT_2026-09-16.md);
[`docs/FINDINGS.md`](docs/FINDINGS.md) is the predecessor's. Activation reliability and context
overhead *are* measured, on both live hosts, in the two documents linked above — but what they
measure is the plumbing, not the output.

## Removing it

**To stop the injection without removing anything, send `ttak off`.** That is the reversible
option, and it takes effect on the same session sources listed above.

To remove the plugin itself, two commands per host — the plugin, then the marketplace entry:

```text
/plugin                                  # Claude Code: uninstall ttak
/plugin marketplace remove ttak
```

```text
codex plugin remove ttak@ttak            # Codex CLI
codex plugin marketplace remove ttak
```

**On Codex, removal does not delete the saved setting.** `codex plugin remove` removes the local
cache and the marketplace command removes the listing; the state file lives in the host's plugin
data directory and survives both, so a reinstall comes back on if it was on. **Claude Code does the
opposite.** Uninstalling there removes `~/.claude/plugins/data/ttak-ttak/` along with the plugin, so
a reinstall comes back off. This was expected to match Codex and does not; it was checked on
2026-09-06 and the two hosts differ. To clear the setting yourself on Codex, or to be sure of it on
either host, delete the data directory as well:

```text
rm -rf ~/.claude/plugins/data/ttak-ttak/   # Claude Code
rm -rf ~/.codex/plugins/data/ttak-ttak/    # Codex CLI
```

That directory holds only `state.json` and the `.notified` flag. The specification defers uninstall
workflows, so no test covers these paths; they are the commands the host documents plus the data
directory this plugin writes.

## Licence and attribution

TTAK is under the MIT licence (see `LICENSE`).

`[LIC-007]` requires that the final licence be confirmed by a copied-content review rather than
assumed. That review has been done — [`docs/COPIED_TEXT_INVENTORY.md`](docs/COPIED_TEXT_INVENTORY.md)
tracks every paragraph of shipped instruction text to the file and pinned revision it derives from —
and its two open findings were ruled on 2026-09-07. MIT is confirmed by that review, not assumed.

**The derivation is not one step for all of it.** `policy/precedence.md` and the explainer skill are
written from the upstream sources directly. `policy/invariants.md` and `policy/contract.md` reproduce
the predecessor's policy files, which in turn derive from those upstreams — two steps, measured and
recorded, and a deviation from a requirement this project set itself. The inventory states it plainly
rather than implying a cleaner lineage than the text has.

Verbatim upstream notices are in [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md), covering
`DietrichGebert/ponytail`, `ayghri/i-have-adhd` and `DreambigOu/ELI5`. Those projects are named
there and here as factual attribution. **None of their authors endorses TTAK.**

## Status

Pre-release. Current qualification focuses on factual correctness, essential requirements,
execution and state recovery, and truthful completion. Correct wording differences are accepted;
the 192-subject comparison and repeated superiority are optional follow-up evaluation.
The latest known factual defect, observed checks and remaining work are recorded in the
[release work log](docs/RELEASE_RESUME_2026-09-14.ko.md). The native checks use Claude Code
2.1.266 and Codex CLI 0.154.0 on Windows; they do not establish interactive UI or automatic
skill-selection behavior on every host version.
The gates still open are the inherited `LCL-BEH-001` behaviour gate (not re-run), TTAK's own
conformance gate, which does not pass on either host, and both hosts' interactive surface.
