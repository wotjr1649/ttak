---
name: ttak
description: "Read or change TTAK's saved setting. Use when the user asks to check, turn on, or turn off TTAK; not for ordinary development or explanation."
license: MIT
---

# TTAK setting

Send `ttak` as the whole prompt to read the saved setting, `ttak on` or `ttak off` to change it. Those three are the only forms that work: the host's own hook consumes them before the model sees them, in an environment that has the plugin data directory. This skill's environment does not have it, so nothing runnable from here can read or change the setting.

Relay that. Do not run a command to do it, do not choose a directory to look in, and do not report a setting you have not been shown. Quoted commands and questions about what a setting means are not requests to change it.

The saved value applies to guidance loaded at the next session start. Text already in a conversation stays; a fresh conversation is what excludes it. This skill controls settings only; it does not load development, explanation, or review guidance.
