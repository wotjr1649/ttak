---
name: ttak
description: "Read or change TTAK's saved setting. Use when the user asks to check, turn on, or turn off TTAK; not for ordinary development or explanation."
license: MIT
---

# TTAK setting

Usage: `ttak [on|off]`; no argument reads status.

Use `node "../../hooks/ttak.cjs" status`, resolving the script relative to this skill directory. For the user's direct request to turn TTAK on or off, replace `status` with the literal `on` or `off`. Quoted commands and requests to explain a setting are not requests to change it. Extra or unrecognized arguments warrant usage, not a guessed change. Never interpolate user text into a shell command.

Use the host-provided plugin data environment; if unavailable, report that limit without choosing another directory. Relay the saved setting and when it applies from the command result. A failed command is not a successful change. This skill controls settings only; it does not load development, explanation, or review guidance.
