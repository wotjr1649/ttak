# TTAK — Part B host verification, and what follows it

You are continuing work on **TTAK**, an opt-in plugin for Claude Code and Codex CLI in this
repository (`D:\AI_DEV\ttak`). When a user turns it on with the plain prompt `ttak on`, lifecycle
hooks inject a small policy text; it also ships one audience-adaptive explainer skill. It is off by
default.

**The build is finished. What is left is observation, one push, and a retirement.** Do not restart
design work, do not rewrite code that is already reviewed, and do not re-open decisions listed under
*Settled* below.

---

## State now

| | |
|---|---|
| Branch | `main` at `753c0ce`, working tree clean |
| Pushed | **No.** `origin` is `https://github.com/wotjr1649/ttak.git` and is still an empty repository |
| `node --test --test-concurrency=1 tests/ttak.test.cjs` | 72 tests, 72 pass, 0 fail, **0 skipped** |
| `node scripts/check-id-sets.cjs` | `ID sets match: 157 ids` |
| `python tests/conformance/run.py --selftest` | `selftest OK` |

The concurrency flag is mandatory — a host guard matches the command text — and the file form is
required; a bare `tests/` argument fails on this Node version.

**What the green gates do and do not mean.** Every one of them checks bytes, structure or
consistency. **Not one measures whether TTAK changes a model's response.** The conformance runner
in `tests/conformance/` has never been pointed at a model; `selftest OK` exercises its plumbing.
Do not describe this project as measured.

## The task: run A1–A5

The command sheet is `docs/analysis/task-12-partB-commands.md`. It has eleven items. **A1–A5 are
yours now; B1–B8 are blocked until `main` is pushed** (B2 is the gate — `codex plugin add` resolves
from `source.url`, never a local checkout, and that URL is empty).

Each item states the command, a yes-or-no thing to look for, a repeat count, and an undo where it
changes anything. Report the yes/no answers.

**Traps, in order of how much they cost:**

1. **A1 must run first.** The first-session notice fires only when the saved state is *absent*.
   A3 writes state. Once it has, A1's "fires at most once" check is vacuously true forever and
   cannot be recovered without deleting the plugin data directory.
2. **This session is the first one where the environment is clean.** Plugin enable/disable takes
   effect at the next session, and the disables below were made during the previous one. Running
   A-items in any session started before them measures the wrong thing.
3. **A5 is the only A-item that touches the real profile**, and it carries its own undo.

### Environment, already prepared

Disabled so that **TTAK is the only plugin hooking `UserPromptSubmit`** — A2 and A3 observe what a
blocked control prompt does, and another plugin's hook on the same event would answer for it:

- `ponytail@ponytail` — hooked `SessionStart`, `SubagentStart`, `UserPromptSubmit` (all three)
- `claude-mem@thedotmack` — hooked `SessionStart`, `UserPromptSubmit`
- `leanclarity@leanclarity` — **removed** from Codex (it was enabled there)

Deliberately left on: `superpowers@superpowers-marketplace` (**0 hooks**) and `codex@openai-codex`
(`SessionStart` only, keeps the Claude↔Codex bridge working).

**Restore after Part B finishes — not before:**

```
claude plugin enable ponytail@ponytail
claude plugin enable claude-mem@thedotmack
```

`leanclarity` and `leancue` are **not** restored; they are retired. `leancue` and `adhd-mode` were
never installed as plugins — only cache directories remain.

### After the answers come in

Fill the matching rows in `docs/analysis/claude-code/2026-09-04-host-integration.md` and
`docs/analysis/codex-cli/2026-09-04-host-integration.md`. Both have a `Settled by` column naming
which sheet item settles each `NOT VERIFIED` row, and a test enforces that every such reference
names an item that exists.

**If an answer contradicts what a document records, section C of the sheet governs.** Adjudicate
each one; do not average them away and do not quietly soften the document.

## What follows, in order

1. **Push `main`** (only `main`, not the feature branch). This is the first execution of
   `.github/workflows/ci.yml` on any platform — every observation in this project is Windows-only
   and CI pins `ubuntu-latest` with Node 22.
2. **B1–B8.** B4 settles the one open product question: a blocked control prompt's reason text
   appears nowhere in Codex `exec --json` (the turn ends silently, zero tokens) while Claude Code
   shows it. If the Codex TUI is silent too, `ttak on` has no feedback on one of two hosts — that
   is a documentation outcome, not a code fix, because the hook's only channel is the block reason.
3. **LeanClarity retirement.** Publish the retirement notice **first, then archive** — see
   *Unverified* below.

## Settled — do not re-open

- **Sequence** A-items → logo → push → B-items. The logo was done first, deliberately: nothing is
  public yet, and A5 observes a real install, so it should install the real listing asset.
- **Brand images.** `assets/logo.png` is a 512×512 RGBA downsample of a ChatGPT-generated image
  made from the author's own prompts. Originals live in `docs/images/` and are **gitignored**;
  `brand-image.png` does not ship. Provenance is recorded in `ATTRIBUTIONS.md` under *Brand image*
  although nothing obliged it.
- **Persona.** The mark is a woodpecker. **The READMEs carry the image and no persona prose.**
  Specification §19.3 and design §5.3 both say the persona is a brand device carried by the name,
  the logo, the READMEs and the manifests' `displayName`, with persona prose in the injected text
  gated on the `OPEN-12` ablation. Shipping the image and no sentence is what that says.
- **LeanClarity.** The public repository is **archived, not deleted.** TTAK cites it in 41 places
  and every published measurement resolves to commit `7dfe5b2`; deleting it would leave TTAK
  publishing numbers nobody can check. Locally it is retired for good.
- **No agent makes host-global configuration changes.** Plugin enable/disable, installs and the
  `/hooks` trust review are run by the user. Ask; do not do them.

## Unverified — check before acting

- **GitHub archived repositories are read-only.** If that holds, the retirement notice must be
  published *before* archiving, or archiving has to be undone to add it. **This was reasoned, not
  checked against GitHub's current documentation.** Verify it before touching that repository.
- **All eleven sheet items.** Nothing on either host's interactive surface has been observed.
- **`[AC-012]` and `[LIC-007]` are open by design** and stay open; `[AC-012]` waits on a human
  ruling over findings F1 and F4 in `docs/COPIED_TEXT_INVENTORY.md`.

## The rule this project runs on

**A claim needs an observation behind it.** Say which findings you proved by running something and
which you reached by reading, and mark anything unverified as `NOT VERIFIED` rather than writing a
plausible expectation where a result belongs.

This is not decoration. Eleven tasks of careful reading missed a shipping blocker — on a fresh
Codex profile the plugin could not be turned on at all, because Codex never creates
`<CODEX_HOME>/plugins/data/` and the code refused to create a missing parent. One observation on a
real profile found it. Two later fixes to that same function each opened a new hole, and review
caught both, because each fix had been tested against the hole it closed and never against the hole
it opened.

**If something does not fit — an answer contradicts a document, a step will not run, a decision
above turns out to rest on a false premise — use `grilling` to settle it before proceeding rather
than guessing.** Prior rounds of that interview are what produced the settled list above, and one
of them had to be reopened when the facts I gave turned out to be wrong.
