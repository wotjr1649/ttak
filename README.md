# TTAK — Track · Trim · Adapt · Keep

<img src="assets/logo.png" alt="TTAK" width="128" align="right">

An opt-in instruction set for Claude Code and Codex CLI, plus one audience-adaptive explainer skill.
It changes what the model is told. **It is not known to change what the model does well**: no
measurement in this project or in the predecessor it is built from has shown an improvement in model
output, and the predecessor's paired studies found no resolvable difference at all. Read
[What is measured](#what-is-measured) before installing it for a benefit.

한국어: [README.ko.md](README.ko.md)

## What it is

Two independent pieces.

- **The operating discipline.** Three short policy files — where this guidance ranks against
  everything else, engineering invariants, and a response contract — injected by host lifecycle hooks
  at session start and subagent start, but only when you have turned it on.
- **The explainer.** One model-invocable skill that adapts an explanation to a stated or inferred
  reader, defaulting to a capable adult who may be unfamiliar with the topic. It works whether or not
  the discipline is on.

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

Codex **will not run a plugin's hooks until you enable them, and installing is not enough.** TTAK
declares three — session start, user prompt submit, subagent start — and each is enabled separately.
The CLI's `/hooks` lists them per event with an installed and an active count; the ChatGPT desktop
app's hook settings list the plugin by name with one toggle per event. The run behind this paragraph
used the desktop app. Turn all three on.

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

There is no slash-command form, and `/ttak` is not a synonym for it. What the host does with the
sigil depends on the host, and on Claude Code also on what follows it. Through `claude -p` on
`2.1.261`, both `/ttak` and `/ttak on` answer `Unknown command: /ttak`, 3/3. In the interactive TUI
`/ttak on` answers the same way, 5/5 — but a bare `/ttak` submitted on its own runs this plugin's own
`/ttak:ttak-explain` and loads the explainer instead, 4/4. The sigil and the plugin's skill namespace
share the prefix `/ttak`, and nothing inside the plugin changes that. On Codex CLI `0.153.4` —
measured through `codex exec`; its interactive session is not verified — the same text arrives as an
ordinary prompt and goes to the model. In none of these does the plugin see the prompt, and the bare
word stays the only trigger.

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

## The explainer

Invoke it directly:

- Claude Code: `/ttak:ttak-explain`
- Codex CLI: `$ttak:ttak-explain`

On Claude Code the bare `/ttak-explain` also resolves, but that slot can be taken by any
model-invocable skill with the same bare name, so the namespaced form is the one to use. Both hosts
may also invoke it on their own when a request matches its description.

**Two of the three are verified; the bare form is not.** `/ttak:ttak-explain what a mutex is` on
Claude Code and `$ttak:ttak-explain what a mutex is` on Codex both resolve and produce the
explanation. The bare `/ttak-explain` remains unverified, and not for want of trying: typed twice on
Claude Code, the host recorded the namespaced form both times, so there is no submission of the bare
form to judge. **Use the namespaced form.** If one does not work, ask for the explanation in plain
language instead — the host-invoked route needs no syntax.

## What is measured

**TTAK has not measured its own effect on a model's output, and the figures below are not its
measurements.** They come from an earlier plugin by the same author, built for the same two hosts,
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

**Running TTAK alongside `ponytail` is not recommended.** If overlapping instruction sets are
installed, disable one through the host's own plugin controls; TTAK does not detect, disable or
remove anything else. And regardless of what is installed: review destructive changes yourself. This
is one synthetic case on two pinned models, not a survey — but it is the measurement that exists, and
none of these instruction sets is a guard.

### Size of the injected text

Measured from the shipped `policy/*.md` files:

| Scope | Bytes | Approx. tokens (~4 chars/token) |
|---|---|---|
| Session start (precedence + invariants + contract) | 2,977 | 744 |
| Subagent start (precedence + invariants) | 2,000 | 499 |

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
inherits passes — it does not, and it has not been re-run. **Cross-host conformance does not
pass either**: the runner has been pointed at a model once — Claude Code, 2026-09-07, sixteen cases
in both arms, graded by a single LLM judge, rows in `tests/conformance/runs/` — and the gate reads
`FAIL`, because one hard criterion's only case and one of another's three could not be exercised at
all. Nothing there is claimed about how the policy text changes a response: the one difference
between the arms is a single row, it goes against TTAK, and at one trial per cell that is noise
rather than a result. Codex has not been run. Activation reliability and context overhead *are*
measured, on both live hosts, in the two documents linked above — but what they measure is the
plumbing, not the output.

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

Pre-release. The gates still open are the copied-content review, the inherited `LCL-BEH-001`
behaviour gate (not re-run), the interactive surface of both hosts and the explainer's invocation
syntax — the non-interactive surface is verified in the two host-integration documents — the
cross-host conformance run, and the required human adversarial review of the English policy text.
