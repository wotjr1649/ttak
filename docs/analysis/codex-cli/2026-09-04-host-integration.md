# Codex CLI host integration — observed evidence

Every claim below points at an observation. Anything this run could not reach is marked
**NOT VERIFIED** with the reason, and no expectation is written beside it.

## Environment

| Item | Value |
|---|---|
| Codex CLI | `codex-cli 0.153.4` (`codex --version`) — the plan's brief cited `0.150.1`; the installed version has moved |
| Node | `v24.19.0` |
| OS | Windows 11 Pro 10.0.26200, Git Bash (MSYS2) |
| Repository commit under test | `72fe42d` on `feat/ttak-v1` |
| Date of run | 2026-09-05 |
| Codex invocations | 36 |

## Method, and why nothing was installed into the real profile

The user's real `~/.codex` was **read only** and never written. Every install went into a throwaway
`CODEX_HOME` under the OS temp directory (`codexhome2` … `codexhome6`), each created fresh.

```
CODEX_HOME=<temp>\codexhomeN codex plugin marketplace add <fixture>
CODEX_HOME=<temp>\codexhomeN codex plugin add ttak@ttak
cd <empty temp dir>
env -u PLUGIN_DATA -u CLAUDE_PLUGIN_DATA CODEX_HOME=<temp>\codexhomeN MSYS2_ARG_CONV_EXCL='*' \
  codex exec --ephemeral --sandbox read-only --skip-git-repo-check --json \
             --dangerously-bypass-hook-trust "<prompt>"
```

**Deviation from `tests/conformance/run.py`'s flag set, stated deliberately.** That runner also
passes `--ignore-user-config`. This run does not, because `--ignore-user-config` skips
`$CODEX_HOME/config.toml`, and that is exactly the file `codex plugin add` writes the
`[plugins."ttak@ttak"] enabled = true` entry into. Passing it would have measured an unloaded
plugin. The isolation the flag exists to provide is supplied more completely here by pointing
`CODEX_HOME` itself at a throwaway directory: the real `config.toml`, `auth.json`, marketplaces,
plugin cache and plugin data were all out of reach for the whole run.

`env -u PLUGIN_DATA -u CLAUDE_PLUGIN_DATA` matters on this machine, which carries an ambient
`CLAUDE_PLUGIN_DATA=C:/Users/js/.claude/plugins/data/codex-openai-codex` pointing at a live host
directory.

### The auth limit, and what it costs

A throwaway `CODEX_HOME` has no `auth.json`, so every model call returned `401 Unauthorized`.
Supplying credentials would mean copying the user's credential file into a temp directory, which the
secret-handling rule forbids, so it was not done. The consequence is precise and bounded:

- Lifecycle hooks run **before** the model call and were fully observable — everything in Steps 2
  and 3 below is real.
- Anything that needs a model **reply** (subagent spawning, injected text actually reaching a
  response) is **NOT VERIFIED** on this host.

### Instrumentation, including one instrument that was ruled out

`codex exec --json` does **not** surface hook events. Two instruments were built instead:

1. **A control hook** at `<CODEX_HOME>/hooks.json` — the host's own, unambiguously supported hook
   location — running a probe that appends its stdin and environment to a log. This is the positive
   control that distinguishes "the plugin's hook was not discovered" from "no hook ran at all".
2. **A tee wrapper** (`wrap.cjs`) placed as the plugin's hook command in the fixture. It spawns the
   real `${CLAUDE_PLUGIN_ROOT}/hooks/ttak.cjs` as a child, pipes stdin through unchanged, records
   stdin/stdout/stderr/exit, and forwards stdout. All Step 3 output below is the real
   `hooks/ttak.cjs` speaking.

**Ruled out: `codex debug prompt-input`.** It renders the model-visible prompt without an API call,
which looked like a free witness. It is not: with the control hook installed at
`<CODEX_HOME>/hooks.json`, `codex debug prompt-input` ran **no** hooks at all. It reports nothing
about hook execution and was abandoned. (It did confirm the plugin loads: `ttak` and `ttak-explain`
appear in its 14899-byte output.)

**Three trials per row.** Where three trials agreed, the row says `3/3`. No row disagreed.

---

## Two install findings that precede everything else

### F1 — the shipped marketplace entry cannot install this working tree

`.agents/plugins/marketplace.json` declares the plugin source as
`{"source":"url","url":"https://github.com/wotjr1649/ttak.git","ref":"main"}`. With that manifest,
after `codex plugin marketplace add D:\AI_DEV\ttak` succeeded and `codex plugin list` showed
`ttak@ttak  not installed`, the install failed:

```
Error: git checkout main failed with status exit code: 1
stderr: error: pathspec 'main' did not match any file(s) known to git
```

Cause, verified directly: `git ls-remote --heads https://github.com/wotjr1649/ttak.git` exits 0 and
prints **no refs at all** — the GitHub repository exists but is empty, so there is no `main` to
check out. (Control: the same command against the predecessor's
`https://github.com/wotjr1649/leanclarity.git` prints `refs/heads/main`.)

This is the expected pre-publication state, not a defect in the manifest. It is recorded because it
means **no local install path exists today**: `codex plugin add` always resolves the plugin from the
declared `source`, never from the local marketplace root, so a user cannot install this tree from a
checkout until the repository is published.

### F2 — a non-URL `source.url` is dropped silently

Building a local fixture, setting `source.url` to a bare Windows path
(`C:/Users/js/.../ttaksrc`) made `codex plugin list` print `No marketplace plugins found` — no error,
no warning. Changing it to `file:///C:/Users/js/.../ttaksrc` made the same plugin appear and install.
Worth knowing when a marketplace entry appears to vanish.

### The fixture used for everything below

A throwaway clone of commit `72fe42d` at `<temp>/ttaksrc`, with only `source.url` and `source.ref`
changed to `file:///<temp>/ttaksrc` and `feat/ttak-v1`. **`.codex-plugin/plugin.json` was left
exactly as shipped — no `hooks` field** (verified on the installed copy in `codexhome6`:
`hooks field present: False`), and `hooks/hooks.json` was left with its shipped structure and
matcher (`startup|resume|clear|compact`), only the `command` string swapped for the instrument.

---

## Step 2 — the hook declaration conflict: **resolved, no blocker**

**Codex CLI 0.153.4 discovers `hooks/hooks.json` without a `hooks` field in `plugin.json`.**

| Fixture manifest | Plugin hook fired | Control hook fired | Trials |
|---|---|---|---|
| **no `hooks` field** (as shipped by Task 8) | yes — `SessionStart` + `UserPromptSubmit` | yes | 3/3 |
| `"hooks": "./hooks/hooks.json"` added | yes — `SessionStart` + `UserPromptSubmit` | yes | 3/3 |

The plugin hook's own environment dump proves it is the plugin's hook and not a stray:

```
{"CLAUDE_PLUGIN_ROOT":"…\\codexhome5\\plugins\\cache\\ttak\\ttak\\0.1.0",
 "CODEX_PLUGIN_ROOT":null,
 "PLUGIN_ROOT":"…\\codexhome5\\plugins\\cache\\ttak\\ttak\\0.1.0",
 "PLUGIN_DATA":"…\\codexhome5\\plugins\\data\\ttak-ttak",
 "CLAUDE_PLUGIN_DATA":"…\\codexhome5\\plugins\\data\\ttak-ttak",
 "CODEX_PLUGIN_DATA":null,
 "argv":["…\\probehook2.cjs","ROOTVAR=…\\codexhome5\\plugins\\cache\\ttak\\ttak\\0.1.0"]}
```

Three things fall out of that dump, all needed elsewhere:

- `${CLAUDE_PLUGIN_ROOT}` **is** defined under Codex and **is** expanded inside the `command`
  string, so `hooks/hooks.json`'s `node "${CLAUDE_PLUGIN_ROOT}/hooks/ttak.cjs"` resolves correctly
  with no Codex-specific variant needed. `PLUGIN_ROOT` is set to the same value.
- Codex sets **`PLUGIN_DATA` itself**, to `<CODEX_HOME>/plugins/data/<plugin>-<marketplace>`, and it
  **overrides an externally supplied `PLUGIN_DATA`**. `dataRoot()`'s preference order therefore
  cannot be used to redirect a Codex hook's state.
- `CODEX_PLUGIN_ROOT` / `CODEX_PLUGIN_DATA` do not exist; the Claude-named variables are what Codex
  provides.

**Ruling: the field is not required at run time. Task 8's omission stands. There is no conflict
between the publish validator and the runtime, and nothing to raise upstream.**

### The false negative that preceded this, recorded because it nearly stood

The first attempt concluded the opposite. It ran the real `hooks/ttak.cjs` with an externally set
`PLUGIN_DATA` and looked for `.notified` in that directory. Nothing appeared, and
`<CODEX_HOME>/plugins/` contained only `cache`, which read as "the hook never ran". Both facts had a
different cause: Codex overrides `PLUGIN_DATA` (above), so the hook was looking at
`<CODEX_HOME>/plugins/data/ttak-ttak`, whose **parent does not exist** — which makes `readState()`
return `unavailable` and makes the hook correctly write nothing anywhere. The hook had run the whole
time and left no trace by design. The control hook is what exposed the error.

---

## Step 3 — fresh profile

### 3.1 `<CODEX_HOME>/plugins/data/` is never created — state reads `unavailable`, not `absent`

Observed in every throwaway home, after `codex plugin marketplace add`, `codex plugin add`, and one
or more `codex exec` sessions with the hook running: `<CODEX_HOME>/plugins/` contains
`cache` and `.marketplace-plugin-source-staging`, and **no `data` directory**.

`PLUGIN_DATA` therefore points at `<CODEX_HOME>/plugins/data/ttak-ttak`, whose parent
`<CODEX_HOME>/plugins/data` does not exist. By `readState()`'s own rules that is **`unavailable`**,
not `absent`.

| Condition | `SessionStart` hook stdout | `UserPromptSubmit` stdout | Directories created | Trials |
|---|---|---|---|---|
| Fresh profile, ordinary prompt | `""` | `""` | none | 3/3 |

Design §4.1 says "Codex does not pre-create `<CODEX_HOME>/plugins/data/<plugin>-<marketplace>/`. A
missing leaf directory **whose parent exists** is absent state on read." The observation is that the
parent does not exist either. Step 3's requirement — "confirm the state reads as absent rather than
unavailable" — is **falsified, not confirmed**.

"Lifecycle reads create nothing" is confirmed, 3/3.

### 3.2 Consequence: `ttak on` cannot succeed on a genuinely fresh Codex profile

| Prompt | State before | Hook stdout (literal) | Created | Trials |
|---|---|---|---|---|
| `ttak on` | no `plugins/data` at all | `{"decision":"block","reason":"TTAK could not read or write its saved setting. Nothing was changed."}` | nothing | 3/3 |

`writeState()` refuses when the parent is missing, by design ("only create the leaf, and only when
its parent already exists"). On Codex the parent is *always* missing on a fresh profile, so the
plugin's only activation path returns its error message and the plugin can never be turned on. The
first-session notice never fires either, because `unavailable` is not `absent`.

For contrast, and as evidence that this is a live difference rather than a theoretical one: the
predecessor `leanclarity`, installed on this machine's real Codex, uses
`io.mkdirSync(dataRoot, { mode: 0o700, recursive: true })` (line 185 of its installed
`hooks/leanclarity.cjs`) and does have a populated `~/.codex/plugins/data/leanclarity-leanclarity/`.

**This is a shipping blocker for the Codex host, found by observation, and it is not fixed by
anything in this task.** It is a runtime defect, not an evidence gap; recording it here is this
task's whole contribution to it.

### 3.3 Everything else works once `plugins/data/` exists

With `<CODEX_HOME>/plugins/data/` created by hand (simulating a profile where any plugin has ever
written data) and the leaf `ttak-ttak/` still absent:

| # | Prompt | State before | `SessionStart` stdout | `UserPromptSubmit` stdout | State after | Trials |
|---|---|---|---|---|---|---|
| 1 | `ttak on` | leaf absent | notice, 108 chars | `{"decision":"block","reason":"TTAK saved setting: ON."}` | leaf + `.notified` + `{"enabled":true}` | 3/3 |
| 2 | `Say OK.` | `{"enabled":true}` | 2977 chars: `# Precedence`, `# Invariants`, `# Response contract` | `""` | unchanged | 3/3 |
| 3 | `ttak` | `{"enabled":true}` | 2977 chars, same three | `{"decision":"block","reason":"TTAK saved setting: ON. It applies from the next clean session boundary; resumed or compacted contexts may retain earlier text."}` | unchanged | 3/3 |
| 4 | `ttak off` | `{"enabled":true}` | 2977 chars, same three | `{"decision":"block","reason":"TTAK saved setting: OFF."}` | `{"enabled":false}` | 3/3 |
| 5 | `/ttak on` | `{"enabled":false}` | `""` | `""` | unchanged | 3/3 |

Row 1 is Step 3's "the first `ttak on` creates the whole path", qualified: it creates the **leaf**
and the state file, and the notice fires because with the parent present the state finally reads
`absent`. It does not create the parent.

The hook receives the same `stdin` shape Claude Code sends, with `source` on `SessionStart`:

```
{"session_id":"01a07219-…","transcript_path":null,"cwd":"…\\cwd","hook_event_name":"SessionStart","model":"gpt-6-astra","permission_mode":"bypassPermissions","source":"startup"}
{"session_id":"01a07219-…","turn_id":"01a07219-…","transcript_path":null,"cwd":"…\\cwd","hook_event_name":"UserPromptSubmit","model":"gpt-6-astra","permission_mode":"bypassPermissions","prompt":"Say OK."}
```

Only `source: "startup"` was ever observed; see NOT VERIFIED.

### 3.4 Step 0 on this host: a sigil prompt *does* reach the hook

Row 5 above: `/ttak on` arrived at `UserPromptSubmit` with `prompt` literally `'/ttak on'`, 3/3.
Codex `exec` does **not** intercept it. `parseControl` correctly treated it as an ordinary prompt
(empty stdout) and the turn proceeded to the model.

The two hosts therefore disagree: Codex passes the sigil form through, Claude Code swallows it as an
unknown slash command. Because it must work on both, the sigil form cannot be adopted, and the bare
word `ttak` stands. Scope: `codex exec`; the interactive TUI is **NOT VERIFIED**.

### 3.5 Codex honours `decision: block`, but shows the user nothing

Two independent witnesses that the prompt never reached the model:

| Case | wall time | `401` errors in stream | terminal event |
|---|---|---|---|
| blocked control prompt (`ttak on`, `ttak`, `ttak off`) | 1–2 s | **0** | `turn.completed` with all usage counters `0` |
| unblocked ordinary prompt | 18–20 s | 12 | `turn.failed` after auth retries |

A blocked turn never attempts the API call at all. Process exit code `0`.

**But the `reason` text appears nowhere.** The full `--json` stream for a blocked `ttak on` is:

```
{"type":"thread.started","thread_id":"01a07219-97e6-7673-a03d-dd8ad43039a1"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"`--dangerously-bypass-hook-trust` is enabled. Enabled hooks may run without review for this invocation."}}
{"type":"item.completed","item":{"id":"item_1","type":"error","message":"`--dangerously-bypass-hook-trust` is enabled. Enabled hooks may run without review for this invocation."}}
{"type":"turn.started"}
{"type":"turn.completed","usage":{"input_tokens":0,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":0,"reasoning_output_tokens":0}}
```

Nothing carries `TTAK saved setting: ON.`. In `codex exec` a user who sends `ttak on` sees a turn
complete silently and gets no confirmation that anything happened. This is a sharp divergence from
Claude Code, which surfaces the reason as a warning line plus the result text. Whether the
interactive TUI renders it is **NOT VERIFIED** — command sheet item S6.

### 3.6 `/hooks` trust review is required, and the failure is silent

Dropping `--dangerously-bypass-hook-trust` from an otherwise identical invocation:

| Flag | Plugin hook ran | Anything said about trust in the stream | Trials |
|---|---|---|---|
| with `--dangerously-bypass-hook-trust` | yes | two `--dangerously-bypass-hook-trust is enabled` warnings | 3/3 |
| without it | **no — zero hook invocations** | **nothing at all** | 3/3 |

An untrusted plugin hook does not run and Codex does not say so in `exec --json`. The install
instructions must state the `/hooks` trust review as a required step, because the symptom of
skipping it is a plugin that is installed, enabled, and completely inert with no diagnostic.

The interactive `/hooks` review flow itself is **NOT VERIFIED** — see command sheet item S5.

---

## NOT VERIFIED

Each of these is in `task-12-partB-commands.md` for the user to run.

| Item | Why isolation could not reach it |
|---|---|
| `SubagentStart` scope on Codex (`invariants` + `precedence`, not `contract`) | Requires the model to spawn a subagent; no credentials in a throwaway `CODEX_HOME`. |
| Injected text actually reaching a model response | Same. |
| `SessionStart` sources `resume`, `clear`, `compact` on Codex | `codex exec` only ever produced `source: "startup"`; the other sources need an interactive or resumed session. |
| The interactive `/hooks` trust review flow and its wording | `exec` mode has no review UI. |
| How a blocked prompt renders in the Codex TUI | `exec --json` shows nothing; the TUI may differ. |
| `/ttak on` in the Codex TUI | Only `codex exec` was measured. |
| Install from a published marketplace | The declared repository is empty (F1). |
| Behaviour on a non-Windows platform | Single machine, Windows only. |
