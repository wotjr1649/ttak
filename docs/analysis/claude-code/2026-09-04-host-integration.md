# Claude Code host integration — observed evidence

Every claim below points at an observation. Anything this run could not reach is marked
**NOT VERIFIED** with the reason, and no expectation is written beside it.

## Environment

| Item | Value |
|---|---|
| Claude Code | `2.1.261` (`claude --version`) |
| Node | `v24.19.0` |
| OS | Windows 11 Pro 10.0.26200, Git Bash (MSYS2) |
| Model pinned for every trial | `haiku` → resolved `claude-haiku-4-5-20251001` |
| Repository commit under test | `72fe42d` on `feat/ttak-v1`. **Every observation in this document is pre-fix.** The fix rounds that followed (`9e4eb01` and fix round 2, the commit carrying this sentence) changed only the branch taken when part of the plugin data path is missing, and Claude Code pre-creates that path (§1.3), so it is not on this host's path. That is reasoning, not a re-observation. The final fix round then changed the `ttak` status reply, which §-tables below quote verbatim as observed: it named two of the four `SessionStart` sources the matcher covers when the observations in this document show all four injecting. The quoted strings are left as observed and are historical from that round on. |
| Date of run | 2026-09-05 |
| Claude invocations | 61, total `$0.3089` |

> **`2977` in this document is a character count, and it is not the byte figure the READMEs
> publish.** Every length here is `additionalContext.length` — UTF-16 code units, as the host
> reports them. The READMEs publish `Buffer.byteLength`. `policy/invariants.md` carries two em
> dashes at three UTF-8 bytes each, so bytes exceed characters by exactly four in every scope that
> includes it. When these observations were taken, `compose()` produced **2981 bytes / 2977
> characters** for the session scope and **2000 / 1996** for the subagent scope. The final fix
> round then shortened `policy/contract.md` by four bytes, so the current composition is
> **2977 bytes / 2973 characters** — which makes today's published byte figure numerically equal
> to this document's character figure **by coincidence, about two different texts**. Nothing below
> is edited for it: these are observations of commit `72fe42d` and they stay as observed.
> Re-derive the current figures with `node scripts/measure-injection.cjs`.

## Method, and why nothing was installed

The plugin was **never installed and never enabled**. No settings file was written. Every trial
loaded the working tree for one session only:

```
cd <empty temp dir>
MSYS2_ARG_CONV_EXCL="*" PLUGIN_DATA="<temp>\pd\<case>" \
claude -p --output-format stream-json --include-hook-events --verbose \
       --setting-sources "" --model haiku [--tools ""] \
       --plugin-dir '<local-clone>' "<prompt>"
```

- `--plugin-dir` loads a plugin directory **"for this session only"** (`claude --help`, verbatim).
- `--setting-sources ""` stops the operator's own settings, hooks and output style from loading.
  Confirmed by observation: in every stream, the only `hook_started`/`hook_response` pairs are
  TTAK's. The operator's enabled `ponytail` never fired.
- `PLUGIN_DATA` is read by `dataRoot()` **before** `CLAUDE_PLUGIN_DATA`, so no state file was ever
  written into a live host directory. This machine has an ambient
  `CLAUDE_PLUGIN_DATA=<home>/.claude/plugins/data/codex-openai-codex`; the override made it
  inert. Verified after the run: no `.notified` or `state.json` exists anywhere under
  `~/.claude/plugins/data/` that this run created.
- The working directory was an empty temp directory, never the repository, so the model could not
  read TTAK's own specification.

**The instrument is `--include-hook-events`.** With `--output-format stream-json` the host emits a
`{"type":"system","subtype":"hook_response", ...}` event per hook carrying `hook_name`,
`exit_code`, `outcome` and the hook's **literal `stdout`**. Nothing below depends on the model
reporting what it saw; the injected bytes are read straight off the host's own event stream. A
second, independent witness is the filesystem: `.notified` and `state.json` appearing (or not) in
the `PLUGIN_DATA` directory.

**Three trials per row.** Where three trials agreed, the row says `3/3`. No row disagreed.

### One discarded trial set, and why

The first three `/ttak on` trials measured nothing: MSYS2 rewrote the argument `/ttak on` to
`C:/Program Files/Git/ttak on` before `claude` ever saw it, and the model replied about a partial
Git path. Re-run under `MSYS2_ARG_CONV_EXCL="*"`, verified with
`node -e 'console.log(process.argv)' "/ttak on"` printing `["/ttak on"]`. Only the corrected runs
are reported.

---

## Step 0 — does a sigil-prefixed prompt reach the hook?

**No. Settled by observation, 3/3 for each of two forms.** Claude Code intercepts the prompt as a
slash command before any hook runs.

| Prompt | `UserPromptSubmit` hook fired? | Host output | `num_turns` / cost | Trials |
|---|---|---|---|---|
| `/ttak on` | **No hook event of any kind** | `Unknown command: /ttak` | `0` / `$0` | 3/3 |
| `/ttak` | **No hook event of any kind** | `Unknown command: /ttak` | `0` / `$0` | 3/3 |

The `SessionStart:startup` hook fired normally in all six trials, so the plugin was loaded; the
`UserPromptSubmit` hook simply never ran. `state.json` was unchanged (`{"enabled":false}`) after
every trial — the hook had no chance to act.

**Consequence.** The sigil form cannot be accepted alongside the bare word, because on this host it
never arrives. The bare word `ttak` stands as the only whole-prompt trigger, and the README must say
plainly that a prompt whose entire content is `ttak` is consumed by the plugin and never reaches the
model.

**Interactive TUI — command sheet A2, 2026-09-06.** One `--plugin-dir` session, read back from the
host's own session transcript rather than off the screen.

| Prompt | Host output | Hook event | Trials |
|---|---|---|---|
| `/ttak on` | `Unknown command: /ttak` and `Args from unknown skill: on` — two records, both `level: "warning"` | none | 5/5 |
| `/ttak` | **runs `/ttak:ttak-explain`** — the explainer's skill body is loaded and the model acts on it | none | 4/4 |

The ruling above stands: the sigil form still never reaches the hook, in every one of the nine
trials. What does not stand is the reason both READMEs gave for it. On this surface a bare `/ttak`
is not answered with `Unknown command` at all; it runs the plugin's own explainer, because the sigil
and the plugin's skill namespace share the prefix `/ttak` and the completion has a candidate to
take. `-p` has no completion, which is the shape the two measurements fit — but this run established
the outcome, not the mechanism. A second limit belongs on the record: the transcript stores what was
submitted, not what was typed, so that a bare `/ttak` was typed is the operator's report and not
something these bytes show.

---

## Step 1 — lifecycle, control prompts, subagent

### 1.1 Injection at every `SessionStart` source

All four sources in the `hooks.json` matcher were reached under isolation. `startup` from a plain
invocation; `resume` from `claude -p --resume <session-id>`; `compact` and `clear` from
`claude -p --resume <session-id> "/compact"` and `"/clear"` (each of those two invocations emits a
`SessionStart:resume` first, then the second source — both are recorded below).

| Source | `hook_name` | `additionalContext` | Trials |
|---|---|---|---|
| startup | `SessionStart:startup` | 2977 bytes, contains `# Precedence`, `# Invariants`, `# Response contract` | 3/3 |
| resume | `SessionStart:resume` | 2977 bytes, same three documents | 3/3 |
| compact | `SessionStart:compact` | 2977 bytes, same three documents | 3/3 |
| clear | `SessionStart:clear` | 2977 bytes, same three documents | 3/3 |

Raw `stdout` of one `SessionStart:startup` hook_response with state `{"enabled":true}` (whitespace
as emitted, truncated only in the middle of the policy body):

```
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"# Precedence\n\nThis guidance ranks below the host's own system and developer instructions, below any repository or project instruction file, and below the user's explicit request. […] \n\n# Invariants\n\n- Understand the request and the flow it touches before changing anything. […] \n\n# Response contract\n\n- Lead with the answer, conclusion, code, cause or action the request calls for. […] - Confirm before a destructive effect."}}
```

`exit_code: 0`, `outcome: "success"`, `stderr: ""` in all twelve trials.

The documents appear in the order `precedence`, `invariants`, `contract`, joined by a blank line,
matching `compose()`'s `SCOPES.main`. The figure is bytes; the same payload is 2973 characters, the
difference being four bytes of multi-byte punctuation. Earlier rounds of this table said "chars"
while counting bytes — the number was right and the unit was not.

**Interactive TUI — command sheet A4, 1 pass.** Observed 2026-09-06 with two instruments that agree.
The host's own session transcript stores what a hook injected as a `hook_additional_context`
attachment, so the bytes can be read directly instead of inferred from what the hook emitted:

| Step | `hook_additional_context` | The model, asked whether `# Response contract` is in its context |
|---|---|---|
| `/clear` | `SessionStart`, 2977 bytes | `Yes.` |
| `/compact` | `SessionStart`, 2977 bytes, byte-identical to the first | `Yes.` |

The two payloads hash the same, and each carries exactly one `# Precedence`, one `# Invariants` and
one `# Response contract` — the same shape as the `-p` rows above. `/compact` refuses on a session
that has just been cleared (`Not enough messages to compact.`), so three ordinary turns were placed
between the two steps; they are recorded in §1.6.

**The setting does not apply to the session that sets it.** A first attempt ran the steps in the
other order — `/clear` while the state was still `{"enabled":false}`, then `ttak on`, then the
question. The answer was `No.`, and that session's transcript holds zero `hook_additional_context`
records. This is what the status reply already promised, "it takes effect at the next session
start", observed rather than assumed, 1/1.

### 1.2 Nothing injected while off

| State on disk | `SessionStart:startup` stdout | Trials |
|---|---|---|
| `{"enabled":false}` | `""` (empty) | 3/3 |

The prompt still reached the model and was answered normally (`num_turns: 1`).

### 1.3 The first-session notice, and that it fires exactly once

| Condition | `SessionStart` stdout | `PLUGIN_DATA` after | Trials |
|---|---|---|---|
| Leaf directory missing, parent exists | notice, 108 chars | leaf created, containing `.notified` only | 3/3 |
| Leaf directory exists and is empty | notice, 108 chars | `.notified` created | 3/3 |
| Same `PLUGIN_DATA`, a second process | `""` | unchanged | 3/3 |

Raw notice stdout:

```
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"TTAK is installed and off. Send the prompt \"ttak on\" to turn it on for this host, \"ttak off\" to turn it off."}}
```

**Exactly once across four `SessionStart` firings.** A sequence of three processes sharing one
`PLUGIN_DATA` — `startup`, then `--resume`, then `--resume "/compact"` (which fires `resume` *and*
`compact`) — produced the notice on the first `SessionStart` and empty stdout on the other three, in
3/3 rounds. No `state.json` was ever created by a lifecycle read; only `.notified`.

The host itself created `~/.claude/plugins/data/ttak-inline/` (empty) when `--plugin-dir` loaded the
plugin — so on Claude Code the data leaf exists before the hook first runs, which is the
leaf-exists-and-is-empty row above. That directory was removed after the run (it was empty and
task-created).

**That one fact is why design §4.1's "never create a missing parent" rule looked safe and was not.**
Claude Code pre-creates the plugin data leaf; Codex creates no part of its data root at all, which
made `ttak on` impossible there. The rule was replaced in fix round 1 with a recursive create under
the host-named root. The deviation from §4.1 and §4.4 is deliberate and is written up, with the
re-run that verifies it, in `docs/analysis/codex-cli/2026-09-04-host-integration.md` §3.3. Neither
the design nor the specification was edited by this task; reconciling them is a v0.3 amendment item.
Fix round 2 corrected that fix in turn: its first version reported `absent` for *any* `ENOENT`, which
on Windows also covers "an ancestor is a file", so the status prompt answered a confident `OFF` for
an unusable path. Reads and writes now both require the nearest existing ancestor to be a directory.
See the codex-cli document §3.3.

**Interactive TUI, 1 pass — command sheet A1.** Observed live on 2026-09-06 in a session started
with `--plugin-dir` and a throwaway `PLUGIN_DATA`. On the first turn the notice was present in that
session's context, quoted back verbatim from `SessionStart` additional context, and `PLUGIN_DATA`
held a 0-byte `.notified` and no `state.json`. After `/clear` and a second `hello` the notice was
absent from the injected context and `PLUGIN_DATA` was unchanged. The host again created
`~/.claude/plugins/data/ttak-inline/` empty, 134 ms before the hook's own write, so the TUI path
takes the leaf-exists-and-is-empty row above as well.

Method, and its limit. The context answers came from the observed session's own model over a
cross-session message, not from a person reading the screen, and the probe had to quote the notice
line in order to ask about it — so it was asked to separate that quotation from injected context,
and it did. What a human sees rendered is a different question, and it belongs to A2 and A3 rather
than to this row.

### 1.4 Subagent scope

Forced with `--agents '{"probe":{…}}' --tools Task` and a prompt instructing one `Task` call.

| Hook | `additionalContext` length | Documents present | Trials |
|---|---|---|---|
| `SessionStart:startup` | 2977 | `# Precedence`, `# Invariants`, `# Response contract` | 3/3 |
| `SubagentStart:probe` | **1996** | `# Precedence`, `# Invariants` — **`# Response contract` absent** | 3/3 |

The 981-character difference is `policy/contract.md` (980 bytes on disk plus the joining blank
line). The subagent hook name carries the agent type: `SubagentStart:probe`.

Also observed, not part of the plan's list: a `UserPromptSubmit` hook fires a second time for the
subagent's own prompt (`"go"`), producing empty stdout — an ordinary prompt, correctly a no-op.

Incidental anomaly, recorded and not chased: in one of the three trials the model emitted a
`tool_use` block naming `mcp__claude_ai_Google_Drive__download_file_content` although `init` reported
`mcp_servers: []`. It did not affect any hook observation.

### 1.5 Control prompts blocked, and the observed shape of a block

**This is the item Task 5 recorded as "not settled by reading" and deferred here. It is now settled
by observation.** Claude Code `2.1.261` honours the `{"decision":"block","reason":…}` JSON shape on
`UserPromptSubmit`.

| Prompt | State before | Hook stdout (literal) | State after | Trials |
|---|---|---|---|---|
| `ttak on` | `{"enabled":false}` | `{"decision":"block","reason":"TTAK saved setting: ON."}` | `{"enabled":true}` | 3/3 |
| `ttak off` | `{"enabled":true}` | `{"decision":"block","reason":"TTAK saved setting: OFF."}` | `{"enabled":false}` | 3/3 |
| `ttak` | `{"enabled":true}` | `{"decision":"block","reason":"TTAK saved setting: ON. It applies from the next clean session boundary; resumed or compacted contexts may retain earlier text."}` | unchanged | 3/3 |

Hook process: `exit_code: 0`, `outcome: "success"`, `stderr: ""`.

**What the host does with it, and what the user sees.** For every blocked prompt the host emitted,
in this order:

```
{"type":"system","subtype":"informational","content":"UserPromptSubmit operation blocked by hook:\nTTAK saved setting: ON.\n\nOriginal prompt: ttak on","level":"warning","prevent_continuation":true, …}
```

and then a terminal result:

```
{"type":"result","subtype":"success","is_error":false,"result":"UserPromptSubmit operation blocked by hook:\nTTAK saved setting: ON.\n\nOriginal prompt: ttak on","num_turns":0,"total_cost_usd":0, …}
```

Three things follow, each from the bytes above:

1. **The reason text is shown to the user**, wrapped by the host in
   `UserPromptSubmit operation blocked by hook:` … `Original prompt: <prompt>`. TTAK does not control
   that framing, and the host echoes the original prompt back.
2. **The prompt never reached the model**: `num_turns: 0` and `total_cost_usd: 0`. No `assistant`
   message appears in the stream at all.
3. **A block is not an error**: `is_error: false`, `subtype: "success"`, process exit code 0.

**Interactive TUI — command sheet A3, 3/3.** Three rounds of `ttak on`, `ttak`, `ttak off` on
2026-09-06, byte-identical across rounds, read from the session transcript. Each block is recorded
by the host as `type: "system"`, `subtype: "informational"`, `level: "warning"`, carrying
`preventContinuation`, and the wrapping matches the `-p` bytes above exactly.

So (a) the reason text does appear and (b) it is wrapped, as in `-p`. On (c) — whether the TUI
styles it as an error — the host's own classification answers: `level` is `warning`, the same level
it gives `Unknown command: /ttak`, which is an ordinary notice. The two are told apart by
`preventContinuation`, which only the block carries, not by severity. Nothing in the record is an
error class, which agrees with `-p`'s `is_error: false`. What that warning level looks like rendered
was not separately captured; this row is the host's classification, not its pixels.

### 1.6 An ordinary prompt is never blocked

| Prompt | `UserPromptSubmit` stdout | Model answered | Trials |
|---|---|---|---|
| `What is 2+2? Answer with the number only.` | `""` | yes, `4` | 3/3 |
| `Say OK.` (states absent / off / on) | `""` | yes, `OK.` | 3/3 each |
| `ttak on
ttak
ttak off` as one prompt (interactive TUI) | `""` | not blocked — a `user` record carries it into the conversation | 1/1 |
| `what is 2+2`, `name three colours` — setting **on**, interactive TUI | no block record | yes, `4` and `Red, blue, green.` | 1/1 each |

The last row was not planned; it was found in the transcript after an operator pasted three lines as
one prompt. It is the stronger negative control, because the prompt *contains* all three control
words and still passes: the match is against the whole prompt, so an internal newline defeats it.
Whether the model then answered is not observed — the turn appears to have been interrupted — but
the prompt was accepted rather than consumed, which is what this section claims.

### 1.7 The saved setting survives a restart

`ttak on` was sent in one process; a *separate* `claude` process was then started against the same
`PLUGIN_DATA`. `SessionStart:startup` injected the full 2977-byte policy, 3/3. State on disk is
the only carrier — there is no in-memory session state involved.

This is process-level persistence, and it was measured with `--plugin-dir`.

**Real install, real relaunch — command sheet A5, 1 pass.** Observed 2026-09-06 against the live
profile with `PLUGIN_DATA` unset, the marketplace added from a local clone.

| Step | What the host said, or recorded |
|---|---|
| `/plugin marketplace add <local-clone>` | `Successfully added marketplace: ttak` |
| install and enable | `✓ Installed TTAK — Track · Trim · Adapt · Keep. Plugin is now active.` |
| `ttak on`, same session | blocked: `TTAK saved setting: ON.` Nothing injected — the plugin was installed mid-session |
| quit, relaunch | `SessionStart:startup`, 2977 bytes |
| `ttak` | blocked: `TTAK saved setting: ON. It takes effect at the next session start …` |
| `~/.claude/plugins/data/ttak-ttak/state.json` | `{"enabled":true}` |

That the relaunch was a relaunch and not a `/clear` is not taken on trust. The new session's first
record is a `hook_success` attachment naming `SessionStart:startup`, and neither session holds a
`/clear` command record — §1.1's run shows that a `/clear` writes one.

Two things here could not be reached with `--plugin-dir`. The policy text injects from a **real
install**, every earlier measurement in this document having loaded the plugin from a directory; and
the install confirmation renders the manifest's `displayName`, which until now had only been read out
of the manifest file.

The install landed as `scope: "local"` against the clone's own path, cached under
`~/.claude/plugins/cache/ttak/ttak/0.1.0` and pinned to the commit that was `HEAD` at install time.
Removal, B8, has to account for that scope; both READMEs describe removal without naming one.

### 1.8 The explainer's invocation, and what removal takes with it

**B7, and one of the two forms could not be reached.** `/ttak:ttak-explain what a mutex is` resolves
and answers: the skill body loads and an explanation follows, twice on 2026-09-06. The bare
`/ttak-explain` was typed twice and **the transcript records `/ttak:ttak-explain` both times**, with
`what a mutex is` in `command-args`. So the namespaced form is settled and the bare form is not: no
submission of it exists to judge.

That is the same shape as Step 0's finding. A completion sits between the keystrokes and the
submission, and the transcript stores the submission — so the bare form may have been replaced
before it was sent, or may never have been typed. Nothing here distinguishes those, and the READMEs
should not claim the bare form works on the strength of this run.

**B8 — removal, and the two hosts disagree.** `/plugin` uninstalled the plugin and
`/plugin marketplace remove ttak` answered `✔ Removed 1 marketplace`; `installed_plugins.json` no
longer names `ttak@ttak`. **`~/.claude/plugins/data/ttak-ttak/` is gone with it, `state.json` and
all.** Codex keeps its equivalent — see the codex-cli document — so a reinstall comes back **off**
here and **on** there.

Both READMEs expected the two hosts to match, and said so while marking the Claude Code half
unverified. The expectation was wrong; the sentence is now split per host.

One control on the deletion, because a manual cleanup would have looked identical: the cleanup
commands drawn up for this run also delete `~/.claude/plugins/data/ttak-inline/` and the A1–A4
throwaway. Both still exist, so the cleanup was not run and the removal is what took the directory.

---

## NOT VERIFIED

Each row names the sheet item that settles it, or says that none does. The sheet is
[`../task-12-partB-commands.md`](../task-12-partB-commands.md); the user runs it by hand before
submission, and these rows stay open until then.

| Item | Why isolation could not reach it | Settled by |
|---|---|---|
| Interactive-mode handling of `/ttak on` and `/ttak` | `-p` mode has no TUI; the slash-command parser may differ. **Settled 2026-09-06 — it does differ, and a bare `/ttak` runs the explainer. See Step 0.** | **A2** |
| How a block renders in the interactive TUI | Same. **Settled 2026-09-06, 3/3 — see §1.5. The host classifies a block at `level: "warning"`, not as an error.** | **A3** |
| Interactive `/clear` and `/compact` | The `-p` equivalents were observed; the TUI's own commands were not. **Settled 2026-09-06 — both inject 2977 bytes and the model reports the text present. See §1.1.** | **A4** |
| Real install (`/plugin marketplace add` + install + enable) and everything that depends on it | Installing or enabling changes host-global configuration, which this run was barred from doing. **Settled 2026-09-06 — see §1.7. It installs, enables and injects.** | **A5** |
| The setting surviving a host restart / real plugin data directory | Requires a real install; `--plugin-dir` state lives under `<data>/ttak-inline`. **Settled 2026-09-06 — the setting survived a quit and relaunch, and `<data>/ttak-ttak/state.json` reads `{"enabled":true}`. See §1.7.** | **A5** |
| Whether removing the plugin deletes the saved setting | Requires a real install to remove. Established for Codex — `codex plugin remove` clears the local cache, not the state file — and never checked here, though both READMEs describe removal. **Settled 2026-09-06 (§1.8): it does delete it. The two hosts differ, and the expectation the READMEs carried was wrong.** | **B8** |
| The explainer's invocation syntax: `/ttak:ttak-explain` and the bare `/ttak-explain` | Neither form was invoked when this was written. **The namespaced form is settled (§1.8): it resolves and answers. The bare `/ttak-explain` is not — it was typed twice and the transcript records the namespaced form both times, so no submission of the bare form exists to judge.** | **B7** |
| Injected text actually reaching a model response | The instrument is hook `stdout` off the host event stream, which shows what the hook emitted, not what entered the model's context. Same standard as the Codex table, which already carried this row. On **neither** host has the policy text been observed entering a model's context. | **No item.** Nothing on the sheet reads a model's context on either host; closing this needs an instrument that does not exist yet. **Settled on Claude Code, 2026-09-06 (§1.1). Two instruments were found, and they agree: the host's session transcript stores the injected bytes as a `hook_additional_context` attachment, and the model, asked, reported `# Response contract` present after both `/clear` and `/compact`. Neither existed when this row was written. Still open on Codex, where nothing is known to read either.** |
| Any behaviour with a model other than `haiku` | Every trial pinned `haiku`. Hook behaviour is model-independent by construction, but this was not measured on another model. | **No item.** Out of scope for v1. |
| Behaviour on a non-Windows platform | Single machine, Windows only. | **No item.** Needs a second machine. |
