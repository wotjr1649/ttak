"""Collect one native-host trial in a pre-provisioned task-local profile.

Default is a dry run. This does not install plugins, copy credentials, approve hook trust,
grade responses, execute generated code or claim successful instruction delivery.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import tomllib
import uuid

from prepare import ROOT, HERE, load_suite, verify_freeze


def command(host, model, effort, session=None):
    if host == "claude":
        args = ["claude", "-p", "--model", model, "--effort", effort,
                "--output-format", "json", "--tools", "Skill",
                "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']
        if session:
            args += ["--resume", str(uuid.UUID(session))]
    elif host == "codex":
        args = ["codex", "exec"]
        if session:
            args += ["resume", str(uuid.UUID(session))]
        else:
            args += ["--sandbox", "read-only"]
        args += ["--model", model, "-c", f'model_reasoning_effort="{effort}"',
                 "--disable", "shell_tool", "-c", 'web_search="disabled"',
                 "--skip-git-repo-check", "--json", "-"]
    else:
        raise ValueError("unknown host")
    if any("bypass" in arg or "ignore-rules" in arg or "skip-permissions" in arg for arg in args):
        raise ValueError("a release trial cannot bypass host controls")
    return args


def parse(host, stdout):
    if host == "claude":
        row = json.loads(stdout)
        if row.get("is_error"):
            raise ValueError("host reported a failed turn; inspect the host locally")
        answer = row.get("result")
        session = row.get("session_id")
        usage = row.get("usage", {})
        models = sorted(row.get("modelUsage", {}))
    else:
        events = [json.loads(line) for line in stdout.splitlines() if line.strip()]
        if any(e.get("type") in {"error", "turn.failed"} for e in events):
            raise ValueError("host reported a failed turn; inspect the host locally")
        answers = [e["item"]["text"] for e in events
                   if e.get("type") == "item.completed" and
                   e.get("item", {}).get("type") == "agent_message"]
        answer = "\n".join(answers)
        session = next((e.get("thread_id") for e in events if e.get("type") == "thread.started"), None)
        usage = next((e.get("usage", {}) for e in events if e.get("type") == "turn.completed"), {})
        models = []  # Resolve from the host-owned transcript; the requested model is not evidence.
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("no readable model response")
    if re.search(r"\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|Bearer\s+\S{12,})", answer):
        raise ValueError("possible secret in response; nothing will be persisted")
    if session is not None:
        session = str(uuid.UUID(session))
    safe_usage = {key: value for key, value in usage.items()
                  if "token" in key.lower() and isinstance(value, (int, float))}
    return {"answer": answer, "session": session, "usage": safe_usage, "observed_models": models}


def preflight(profile, experiment, host, condition):
    profile = profile.resolve(strict=True)
    if not profile.is_dir() or not profile.is_relative_to(experiment.resolve()):
        raise ValueError("profile must be inside this frozen experiment directory")
    # This contains operator-reviewed preparation evidence, not credentials. None of these
    # declarations proves runtime delivery; that remains a separate transcript inspection.
    readiness = json.loads((profile / "readiness.json").read_text(encoding="utf-8"))
    for key in ["subscription_only", "extra_usage_disabled", "no_external_connectors",
                "native_plugin_setup_verified", "normal_hook_trust_verified"]:
        if readiness.get(key) is not True:
            raise ValueError(f"profile preparation incomplete: {key}")
    if readiness.get("host") != host or readiness.get("condition") != condition:
        raise ValueError("profile is prepared for a different comparison condition")
    if host == "codex":
        config_path = profile / "config.toml"
        config = tomllib.loads(config_path.read_text(encoding="utf-8")) if config_path.exists() else {}
        if config.get("mcp_servers") or config.get("model_provider", "openai") != "openai":
            raise ValueError("trial profile must have no MCP servers or alternate model provider")
        if config.get("model_providers") or config.get("profiles") or config.get("features", {}).get("apps"):
            raise ValueError("trial profile contains additional providers, profiles or app access")
    # Installed plugin roots are evidence locations, not permission to execute their contents.
    # The caller must review their normal hooks and check instruction delivery after the run.
    for relative in readiness.get("plugin_roots", []):
        plugin_root = (profile / relative).resolve(strict=True)
        if not plugin_root.is_relative_to(profile):
            raise ValueError("installed plugin root escaped the trial profile")
        if (plugin_root / ".mcp.json").exists():
            raise ValueError("trial plugins must not supply external connectors")
    return profile


def run_trial(experiment, trial_id, profile, timeout, execute):
    verify_freeze(experiment)
    rows = json.loads((experiment / "plan.json").read_text(encoding="utf-8"))
    matches = [r for r in rows if r["id"] == trial_id]
    if len(matches) != 1:
        raise ValueError("trial id is not in the frozen plan")
    row = matches[0]
    case = next(c for c in load_suite()["cases"] if c["id"] == row["case"])
    args = command(row["host"], row["model"], row["effort"])
    if not execute:
        print(json.dumps({"trial": row, "command": args, "turns": len(case["turns"]),
                          "status": "dry run; no host invoked"}, indent=2))
        return
    profile = preflight(profile, experiment, row["host"], row["condition"])
    destination = experiment / "trials" / trial_id
    if destination.exists():
        raise ValueError("trial already has state; inspect it instead of silently rerunning")
    destination.mkdir(parents=True)
    work = destination / "work"
    work.mkdir()
    if "fixture" in case:
        shutil.copyfile(HERE / "fixtures" / case["fixture"], work / case["fixture"])
    env = {key: value for key, value in os.environ.items()
           if key.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT",
                              "SYSTEMDRIVE", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "TEMP", "TMP"}}
    env["CODEX_HOME" if row["host"] == "codex" else "CLAUDE_CONFIG_DIR"] = str(profile)
    record = {**row, "turns": [], "delivery_verified": False, "actual_model_verified": False,
              "effort_verified": False, "release_qualified": False,
              "scope": "native skill use with supplied source; generated code is checked separately"}
    session = None
    try:
        for index, prompt in enumerate(case["turns"]):
            if index == 0 and "fixture" in case:
                prompt += "\n\nSupplied project.py:\n```python\n" + (work / case["fixture"]).read_text(encoding="utf-8") + "\n```"
            args = command(row["host"], row["model"], row["effort"], session)
            args[0] = shutil.which(args[0]) or args[0]
            started = time.monotonic()
            result = subprocess.run(args, input=prompt, cwd=work, env=env, capture_output=True,
                                    text=True, encoding="utf-8", errors="strict", timeout=timeout)
            if result.returncode:
                raise ValueError(f"host exit {result.returncode}; no retry attempted")
            turn = parse(row["host"], result.stdout)
            session = turn["session"] or session
            if index < len(case["turns"]) - 1 and not session:
                raise ValueError("cannot continue without an observed session id")
            record["turns"].append({**turn, "duration_s": round(time.monotonic() - started, 3)})
        record["status"] = "collected; runtime evidence and grading pending"
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        record["status"] = "stopped; inspect host and child-process state before any continuation"
        record["error_type"] = type(error).__name__
        with (destination / "result.json").open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(record, handle, ensure_ascii=False, indent=2)
        raise
    with (destination / "result.json").open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(record, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"Collected {trial_id}; delivery and grading not verified")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experiment", type=Path, required=True)
    parser.add_argument("--trial", required=True)
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.timeout <= 300:
        parser.error("timeout must be between 1 and 300 seconds per turn")
    if args.execute and not args.profile:
        parser.error("--execute needs a prepared --profile")
    experiment = args.experiment.resolve(strict=True)
    if not experiment.is_relative_to(ROOT.resolve()):
        parser.error("experiment must be inside this worktree")
    run_trial(experiment, args.trial, args.profile, args.timeout, args.execute)


if __name__ == "__main__":
    main()
