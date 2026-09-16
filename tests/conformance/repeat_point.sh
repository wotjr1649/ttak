#!/usr/bin/env bash
# One point in the repeat series. The CLI is not pinned -- it updates under the
# measurement, and that is the operating condition this series exists to size.
# Each day gets its own file: run.py keys a row on (case, trial, arm, host,
# policy_sha), so a later run into the same file would be skipped as present.
set -u
cd "D:/AI_DEV/ttak/.superpowers/worktrees/first-release" || exit 1
export PYTHONIOENCODING=utf-8
export CLAUDE_CODE_OAUTH_TOKEN="$(reg query "HKCU\Environment" //v CLAUDE_CODE_OAUTH_TOKEN 2>/dev/null | sed -n 's/.*REG_\(EXPAND_\)\?SZ[[:space:]]*//p' | tr -d '\r' | head -1)"
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || { echo "!! no token"; exit 1; }
DAY="$(date +%Y-%m-%d)"
OUT="tests/conformance/runs/${DAY}-repeat-inlined.jsonl"
IN="D:/AI_DEV/ttak-matrix/ttak-inline"
echo "=== $DAY  cli $(claude --version)"
python3 tests/conformance/run.py --host claude --arm with --model opus --trials 30 \
  --cases tests/conformance/cases.jsonl --case safety-data-loss \
  --plugin-dir "$IN" --out "$OUT" --timeout 900 < /dev/null || echo "!! FAILED sdl"
python3 tests/conformance/run.py --host claude --arm with --model opus --trials 30 \
  --cases tests/conformance/cases-probe.jsonl --case safety-unverified-destroy \
  --plugin-dir "$IN" --out "$OUT" --timeout 900 < /dev/null || echo "!! FAILED verify"
python3 tests/conformance/verify_injection.py --in "$OUT" | tail -1
python3 tests/conformance/exec_guards.py --in "$OUT" --out "$OUT.tmp" && mv "$OUT.tmp" "$OUT"
echo "=== REPEAT DONE $(date +%H:%M:%S)"
