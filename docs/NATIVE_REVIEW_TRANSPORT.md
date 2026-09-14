# Native review transport — diagnostic 48

The Windows CLI connection is implemented and a bounded evidence-role call was audited on
each host. This validates transport on a synthetic Unicode label fixture, not factual-error
detection, the context role, a native repair cycle, installed-product behavior or release quality.

Later outcome: [diagnostic 49](ROLE_SCREEN_49.ko.md) used one further Claude call and stopped
the quality screen on a mandatory claim omission. Its result-bound cross-host ledger is now
stopped; 24 diagnostic calls remain. The 25-call figures below are the diagnostic-48 checkpoint.

## Components

* `review-native-format.cjs`: general role/repair prompts, closed JSON schemas, native argument
  lists, subscription environment selection, result parsing and transcript auditing.
* `review-native.cjs`: a caller-configured invoker with a finite call allowance, fresh attempt
  directories, version/binary checks and retained bounded results. It is compatible with
  `reviewByRoles` through its `invoke` function; importing it launches nothing.
* `bounded-native-process.cjs`, `windows-job.ps1`, `windows-job.cs`: Windows supervision using
  the existing PowerShell 7 installation and an in-memory compiled Win32 helper. No package,
  global runtime, execution-policy, plugin or persistent MCP change was made.

The caller supplies the host, expected CLI version, executable, PowerShell executable, task
root, existing reviewed baseline profile, existing run directory and maximum calls (1–27).
Paths are caller-owned; model output cannot select an executable, command, output directory
or recipient. Profile/run paths must resolve beneath the task root. A changed profile with
configuration files is rejected pending inspection; configuration is not ignored or weakened.
Readiness metadata is a prerequisite, not permission or proof of runtime behavior.

Arguments never use a shell. Claude runs with no built-in tools and an empty, strict MCP
configuration. Codex keeps the read-only sandbox, disables the shell tool and web search,
and uses the already reviewed baseline profile. Normal host controls remain loaded.
Neither command resumes or forks a drafting session. API keys, endpoint overrides and
unrelated environment variables are omitted; existing Claude subscription authentication
is forwarded only in the process environment. Authentication files are not copied or printed.

## Process lifetime and evidence

The native process is created suspended, assigned to a Windows Job Object, then resumed.
The job uses `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` without breakaway permission. On normal
parent exit, timeout or output overflow, the supervisor terminates remaining job processes
and queries the active-process count before returning a cleanup-verified result.

Native limits are 120 seconds, stdout 1 MiB and stderr 64 KiB; job/pipe cleanup has a
10-second allowance. The Node supervisor watchdog additionally allows 20 seconds for helper
startup. A helper/watchdog failure reports cleanup as unverified and stops the invoker.
It does not retry through another process mechanism. Request input is limited to 1 MiB;
the outer JSON envelope has a separate bound. Prompt text goes through UTF-8 stdin.

Each attempt records prompt/schema/binary hashes and its invocation ordinal before launch.
Successful process results record elapsed time, exit status, total job processes and the final
active count. Bounded native stdout/stderr are retained locally only after a possible-secret
pattern check. That check is heuristic, not a general secret detector; the primary exposure
boundary is reviewed public/synthetic input and withholding tools and unrelated context.
Raw transcript contents are not copied. Parser and transport failures stop later calls on
that invoker; the operator still has to enforce the aggregate experiment allowance across hosts.
There is no wrapper retry. CLI-internal requests/retry behavior is distinct from this CLI count.

Audit requires the exact prompt, including a fresh request ID, in a native user message.
Claude assistant records must match the session, CLI version, Sonnet model and medium effort;
unexpected tool use is rejected. Codex session metadata and its single turn context must match
the session, CLI version, Luna model and high effort. Structured values are validated against
the local role contract. Requested flags alone do not satisfy these checks.

## Observed results on 2026-09-09

| Check | Claude | Codex |
|---|---|---|
| CLI version | 2.1.266 | 0.153.4 |
| Actual model / effort | claude-sonnet-5 / medium | gpt-5.6-luna / high |
| Native model calls | 1 | 1 |
| Measured supervised native time | 3.685 s | 11.645 s |
| Exact prompt and two-unit output validation | Passed | Passed |
| Korean/emoji quote retained in output | Passed | Passed |
| Active job processes after cleanup | 0 | 0 |

These times exclude PowerShell startup/compilation and subsequent operator/audit work.
The fixture explicitly supplied a label and status; it was not a quality comparison or a
repeat of the earlier MCP smoke. No source URL was fetched. Both native results and their
settings were actually audited, not represented by fake transport session strings.

Claude reported input_tokens=2, cache_creation_input_tokens=10759,
cache_read_input_tokens=0, output_tokens=293. Codex reported input_tokens=9370,
cached_input_tokens=0, cache_write_input_tokens=0, output_tokens=222 and
reasoning_output_tokens=73. These are host-reported fields with different cache accounting;
they are not quota percentages, money estimates or directly comparable total-cost figures.

Evidence is in `.superpowers/native-transport-48/`: `preflight.json`,
`connectivity-plan.json`, `connectivity-result.json` and two UUID attempt directories.
The connectivity plan recorded six runtime source hashes before execution; those sources
were rechecked unchanged afterward. This is a scoped connectivity record, not the complete
freeze for the quality experiment. A later trailing-space cleanup in the formatter is checked
separately against both recorded prompt/schema hashes without repeating model calls.
The run script creates files exclusively and must not be
rerun to inspect state.

The two calls used the unallocated diagnostic allowance: **25 diagnostic calls remain,
18 reserved for the proposed quality screen and 7 unallocated**. The separate final-comparison
allowance remains 516. Recorded historical subject/grading/diagnostic CLI calls are now
675 = Claude 396 + Codex 279, preserving the prior counting scope and its audit limitations.
Version-only preflight launches used zero model calls and are recorded separately.

## Local verification and remaining work

All 57 related Node tests passed with no skips: the earlier 45 plus seven format/audit tests
and five real Windows process tests. The process tests verify quoting, UTF-8, detached-child
cleanup after normal exit, timeout cleanup, independent stdout/stderr caps and nonzero exits.
An initial Unicode failure was reproduced and fixed by explicitly selecting UTF-8 on the
PowerShell console streams. Format/audit negatives use synthetic records and do not replace
the two observed native calls. No Python/product-wide regression was run for this new path.

Before the 18-call screen: freeze the complete execution dependency set, profile assumptions,
generic prompts and schemas with the prepared inputs; bind the cross-host allowance to a
single execution ledger; and wire independent expected-finding adjudication between calls.
The current invoker only validates structural reports and native delivery. A structurally valid
but factually wrong finding must still stop the screen according to its separate criteria.
Native context/repair/recheck behavior remains to test within that screen.

Official references checked alongside the installed CLI help:
[Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode),
[Claude programmatic use](https://code.claude.com/docs/en/headless),
[Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects),
[CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw).
