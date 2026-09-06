# Task 12, Part B — command sheet

Part A settled everything reachable without changing host configuration. What is left is here.
Each item says what to run, what answer to look for as a yes or no, which document row it fills, and
how many times.

Paste shell lines into a Claude Code session with a leading `!`, or into a plain terminal. Items
marked **(interactive)** are things to do inside a running session, not commands to paste.

Read this first:

- **Run section A in the order given.** A1 must come before A3, because A3 turns the setting on and
  that makes A1's check impossible to fail.
- **Three trials is this task's standard.** Items marked **1 pass** are deliberate deviations: they
  confirm something already observed 3/3 under isolation, so one pass is enough to catch a
  contradiction, not to establish a rate.
- **B1 is not a check.** It records a defect Part A found and the fix rounds fixed, with its own
  three-trial re-run. Nothing to do.

---

## A. Claude Code — interactive surface (no install needed)

`--plugin-dir` loads the plugin for one session only, so no install is needed. **But A3 and A5 do
write**, so point the plugin's data directory at a throwaway first — otherwise A3 leaves `.notified`
and `state.json` in your real `~/.claude/plugins/data/ttak-inline/`, and section A has no undo:

```
export PLUGIN_DATA="$(mktemp -d)/ttak-ttak"
cd "$(mktemp -d)" && claude --setting-sources "" --model haiku --plugin-dir '<repo>'
```

Keep that one session for A1–A4. `echo "$PLUGIN_DATA"` first if you want to inspect it afterwards;
deleting its **parent** — the `mktemp -d` directory, not just the `ttak-ttak` leaf inside it — is the
whole cleanup for A1–A4.

### A1 — the notice fires, and fires once — **1 pass**, and it must be first

**(interactive)** This is the very first turn of a fresh session with a fresh `PLUGIN_DATA`. Send
`hello`.

Look for: **yes or no** — does the reply show or act on the line
`TTAK is installed and off. Send the prompt "ttak on" to turn it on for this host …`?
Then `/clear` and send `hello` again: **yes or no** — is that line absent the second time?

Do not run A3 first. A3 writes the state file, and with a state file present the notice cannot fire
at all, so the check would pass no matter what the code did.

Fills: claude-code doc → §1.3 (already observed across four `SessionStart` firings in `-p`, 3/3).

### A2 — does the TUI intercept `/ttak on`? — **3 times**

**(interactive)** Type `/ttak on` and press Enter. Then type `/ttak` and press Enter.

Look for: **yes or no** — do you see `Unknown command: /ttak`? If instead you see TTAK's own
`TTAK saved setting: ON.`, say so; it changes the Step 0 ruling and the README sentence that rests
on it.

Fills: claude-code doc → "Step 0", the interactive scope caveat.

### A3 — what a block looks like in the TUI — **3 times**

**(interactive)** Type `ttak on`, Enter. Then `ttak`, Enter. Then `ttak off`, Enter.

Look for, for each: **yes or no** on three separate things — (a) does the reason text appear at all
(`TTAK saved setting: ON.`)? (b) is it wrapped in `UserPromptSubmit operation blocked by hook:` and
`Original prompt: ttak on`? (c) is it styled as an error?

Fills: claude-code doc → §1.5, "How this renders in the interactive TUI is NOT VERIFIED", and the
README's per-host visibility paragraph, which currently scopes this claim to `-p` mode.

### A4 — `/clear` and `/compact` re-inject — **1 pass**

**(interactive)** Send `ttak on` (A3 left it off). Then `/clear`. Then send:
`Does your context contain a line reading exactly "# Response contract"? Answer yes or no.`
Then `/compact`, and send the same question again.

Look for: **yes** both times.

Fills: claude-code doc → §1.1 (already observed as `SessionStart:clear` and `SessionStart:compact`
injecting 2977 characters in `-p` mode, 3/3).

### A5 — real install, and the setting surviving a restart — **1 pass**

This is the only Claude item that changes your configuration, and the only one that writes to your
real profile. `/plugin` undoes it.

**(interactive)** `/plugin marketplace add <repo>`, then install and enable `ttak`.
Then in a session: `ttak on`. Then **quit Claude Code entirely and start it again**, and send `ttak`.

Look for: **yes or no** — does the reply say `TTAK saved setting: ON.`, and does this print
`{"enabled":true}`?

```
cat ~/.claude/plugins/data/ttak-ttak/state.json
```

Fills: claude-code doc → §1.7 and the "real install" NOT VERIFIED row.
Undo: `/plugin` → uninstall `ttak`, then `/plugin marketplace remove ttak`. Then remove
`~/.claude/plugins/data/ttak-ttak/` if you want the profile back exactly as it was.

---

## B. Codex CLI

### B1 — found and fixed, nothing to run

Part A observed, 3/3: on a profile where `<CODEX_HOME>/plugins/data/` does not exist, `ttak on`
returned `{"decision":"block","reason":"TTAK could not read or write its saved setting. Nothing was
changed."}` and created nothing. Codex never creates that directory, so TTAK could not be enabled on
a fresh Codex install at all.

Fixed across two rounds: `writeState` and the notice's write create the whole path, and a missing
path reads `absent` at any depth *provided the nearest existing ancestor is a directory* — the
second round added that proviso, because without it a file where a directory should be read as
`absent` and the status prompt answered a confident `OFF` for an unwritable path. Re-run on three
genuinely fresh `CODEX_HOME` directories, 3/3. See `docs/analysis/codex-cli/…` §3.2 and §3.3.

Your own `~/.codex/plugins/data/` already exists, so your profile could never have reproduced it —
which is exactly why it would have shipped unnoticed.

### B2 — install prerequisite — **1 pass**

`codex plugin add` resolves the plugin from `source.url` in `.agents/plugins/marketplace.json`,
never from a local checkout. That URL (`https://github.com/wotjr1649/ttak.git`) is currently an
empty repository, so installation fails with
`error: pathspec 'main' did not match any file(s) known to git`.

```
git ls-remote --heads https://github.com/wotjr1649/ttak.git
```

Look for: **yes or no** — is there at least one `refs/heads/main` line? If no, push `main` first;
B3–B5 cannot run until then.

Fills: codex-cli doc → F1.

### B3 — install and the `/hooks` trust review — **1 pass**

```
codex plugin marketplace add https://github.com/wotjr1649/ttak.git
codex plugin add ttak@ttak
```

Then **(interactive)** start `codex`, run `/hooks`, and review/trust TTAK's hooks.

Look for, in order:
1. Before trusting, send `ttak on`. **Yes or no** — does anything at all happen or appear? Part A
   observed that an untrusted plugin hook does not run and Codex says nothing about it.
2. What `/hooks` shows: the plugin name, the three events, the command string. Copy the exact
   wording of the trust prompt — the install instructions have to name this step and should quote it.
3. After trusting, send `ttak on`. **Yes or no** — does it answer now?

Fills: codex-cli doc → §3.7 and the "interactive `/hooks` trust review flow" NOT VERIFIED row.

Undo, all three lines: `codex plugin remove ttak@ttak`, then
`codex plugin marketplace remove ttak`, then delete `~/.codex/plugins/data/ttak-ttak/`. The first
removes the local cache and the second the marketplace entry; **neither removes the saved setting.**
This item sends `ttak on` twice against your real profile, so `state.json` is left behind unless you
delete it — the same line A5 already carries for the Claude side.

### B4 — what a block looks like in the Codex TUI — **3 times**

**(interactive)** In `codex`, send `ttak on`, then `ttak`, then `ttak off`.

Look for: **yes or no** — does the reason text (`TTAK saved setting: ON.`) appear on screen at all?
In `codex exec --json` it appears nowhere — the turn completes with zero tokens. If the TUI is also
silent, `ttak on` gives the user no feedback on Codex and that needs a product decision.

Fills: codex-cli doc → §3.6, and the README's per-host visibility paragraph.

### B5 — `clear` and `compact` on Codex — **1 pass**

**(interactive)** With the setting ON, use the Codex session's compact and clear equivalents if it
has them, then ask:
`Does your context contain a line reading exactly "# Response contract"? Answer yes or no.`

Look for: **yes** after each.

`resume` is **not** on this sheet any more: `SessionStart:resume` was verified under isolation,
3/3 — see codex-cli doc §3.8. `clear` and `compact` are interactive-only by measurement, not by
assumption: the review enumerated the `codex exec` surface and tested `--thread-source clear` and
`--thread-source compact`, the one flag that looked like it might carry a source, and both still
report `"source":"startup"`. Do not re-open that question without new evidence.

Fills: codex-cli doc → NOT VERIFIED, "`SessionStart` sources `clear` and `compact`".

### B6 — subagent scope on Codex — **3 times**

**(interactive)** With the setting ON, ask Codex to delegate something to a subagent, and have the
subagent report the headings of any operating-guidance text in its context.

Look for: **yes or no** — does it name `Precedence` and `Invariants` **and not** `Response
contract`?

Fills: codex-cli doc → NOT VERIFIED, "`SubagentStart` scope on Codex".

---

### B7 — the explainer's invocation syntax, all three forms — **1 pass each**

**(interactive)** Three published invocations, none of them ever observed resolving. One item because
they are one claim: that the READMEs' explainer section works as written.

In a Claude Code session with the plugin loaded, send each of these as its own prompt:

```
/ttak:ttak-explain what a mutex is
/ttak-explain what a mutex is
```

In a Codex session with the plugin installed:

```
$ttak:ttak-explain what a mutex is
```

Look for, each time: **yes or no** — does the explainer answer, rather than the host reporting an
unknown command or the text going to the model as an ordinary prompt? For the bare `/ttak-explain`,
also say whether anything else claimed that name.

Fills: claude-code doc → NOT VERIFIED, "the explainer's invocation syntax"; codex-cli doc → NOT
VERIFIED, "the explainer's invocation syntax". Between them these are the last unsourced
host-behaviour claims in the shipped READMEs.

Undo: none. Nothing here writes state; the explainer only produces text.

---

### B8 — removal, and what removal leaves behind — **1 pass per host**

**This is the only item that removes things, so run it last.** It settles the READMEs' removal
section, every line of which comes from host documentation and the undo lines above rather than from
an observation.

Do it on a host where `ttak on` has been sent at least once, so there is a setting to survive.
**(interactive)** on Claude Code, then the same shape on Codex:

```
/plugin                                    # Claude Code: uninstall ttak
/plugin marketplace remove ttak
cat ~/.claude/plugins/data/ttak-ttak/state.json
```

```
codex plugin remove ttak@ttak              # Codex CLI
codex plugin marketplace remove ttak
cat ~/.codex/plugins/data/ttak-ttak/state.json
```

Look for, per host, three things: **yes or no** — (a) do both commands succeed? (b) does the `cat`
still print `{"enabled":true}` after removal — that is, **does the saved setting survive?** (c) start
a session and confirm nothing is injected.

The Codex answer to (b) is expected to be yes: the Part A re-review established that
`codex plugin remove` removes the local **cache**, not `plugins/data/ttak-ttak/state.json`. **The
Claude Code answer to (b) has never been checked by anyone** — the README states it for both hosts on
the strength of the Codex finding alone, so if Claude Code does delete its plugin data on uninstall,
that sentence is wrong in one direction and needs splitting per host.

Fills: the READMEs' `Removing it` / `제거하기` sections, both languages, which currently carry no
observation behind them.

Undo: reinstall per the README if you want the plugin back. To finish cleaning up, delete
`~/.claude/plugins/data/ttak-ttak/` and `~/.codex/plugins/data/ttak-ttak/`.

---

## C. If any answer differs from Part A

Say which item, what you saw, and paste the literal text. Part A's rows are all `3/3` with no
disagreement, so a single contradicting observation is a finding, not noise.
