# TTAK privacy statement

**Scope.** The TTAK plugin package `design/ttak`, version `0.3.0-design.2`. The `0.2.0` runtime
candidate preserved elsewhere in this repository has different components and is not covered here.

## What TTAK collects

Nothing. There is no telemetry, no analytics, no account and no network code. Both hook scripts
import `node:fs`, `node:path` and `node:crypto` and nothing else: they open no sockets and start no
child processes.

## What TTAK stores

One file, `state.json`, in the plugin data directory the host supplies through `PLUGIN_DATA` or
`CLAUDE_PLUGIN_DATA`. Its entire content is one boolean:

```json
{"enabled": true}
```

If the host supplies no absolute plugin data path, TTAK writes nothing and reports the setting as
unavailable. It never falls back to a home directory or any other location it picked itself.
Deleting that file returns TTAK to its default, OFF.

## What TTAK reads

- The two environment variables named above.
- Its own package files: `policy/core.md` and `references/explain.md`, `references/review.md`.
- The hook event the host sends on standard input. For `UserPromptSubmit` that event carries your
  prompt. TTAK tests it against one fixed pattern — `ttak`, `/ttak`, `/ttak:ttak` or `$ttak`,
  optionally followed by `on` or `off` — and keeps nothing else. The text is never written to disk,
  never logged and never sent anywhere. Input is bounded at 64 KiB and one second.

## Who receives your data

No one. TTAK sends nothing off your machine.

Your host — Claude Code or Codex CLI — handles your prompts and the guidance text TTAK injects under
its own policy. That is the host's policy, not this one.

## Questions

https://github.com/wotjr1649/ttak/issues
