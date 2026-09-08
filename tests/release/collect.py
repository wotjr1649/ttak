"""Collect one native-host trial in a pre-provisioned task-local profile.

Default is a dry run. This does not install plugins, copy credentials, approve hook trust,
grade responses, execute generated code or claim successful instruction delivery.
"""
import argparse
from contextlib import nullcontext
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import tomllib
import uuid

from prepare import ROOT, HERE, activation_skills, load_suite, verify_freeze
from codex_profile import original_selection


def activation_prompts(case, condition, host, readiness):
    prompts = []
    names = readiness.get("skill_invocations", {})
    for skill in activation_skills(case, condition):
        package = "ttak" if skill.startswith("ttak-") else ("ponytail" if skill == "ponytail-review" else skill)
        allowed = {skill, f"{package}:{skill}"}
        native_name = names.get(skill)
        if native_name not in allowed:
            raise ValueError(f"missing or unsupported native invocation for {skill}")
        prefix = "/" if host == "claude" else "$"
        prompts.append(f"{prefix}{native_name} Load this skill for the upcoming task. "
                       "No task artifact is supplied yet; do not invent one or claim work is complete.")
    return prompts


def command(host, model, effort, session=None, plugin_roots=()):
    if host == "claude":
        args = ["claude", "-p", "--model", model, "--effort", effort,
                "--output-format", "json", "--tools", "Skill",
                "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']
        for root in plugin_roots:
            args += ["--plugin-dir", str(root)]
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


def selected_plugins(profile, readiness, case, condition):
    if condition == "baseline":
        return []
    sources = (["ttak"] if condition == "ttak" else
               ["ponytail", "eli5", "i-have-adhd"] if case["original"] == "all" else
               ["ponytail" if case["original"] == "ponytail-review" else case["original"]])
    selected = []
    for source in sources:
        relative = readiness.get("source_roots", {}).get(source)
        if relative not in readiness.get("plugin_roots", []):
            raise ValueError(f"missing prepared native plugin for {source}")
        root = (profile / relative).resolve(strict=True)
        if not root.is_relative_to(profile.resolve()):
            raise ValueError("native plugin escaped the trial profile")
        selected.append(root)
    return selected


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


def native_environment(host, profile, model, effort, environ=None):
    """Build a process-local subscription environment without forwarding API billing keys."""
    if host not in ("claude", "codex"):
        raise ValueError("unknown host")
    source = os.environ if environ is None else environ
    env = {key: value for key, value in source.items()
           if key.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT",
                              "SYSTEMDRIVE", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "TEMP", "TMP"}}
    env["CODEX_HOME" if host == "codex" else "CLAUDE_CONFIG_DIR"] = str(profile)
    if host == "claude":
        # Forward existing native subscription authentication only to the first-party CLI.
        # Never log this dictionary or copy credential files into a prepared profile.
        if "CLAUDE_CODE_OAUTH_TOKEN" in source:
            env["CLAUDE_CODE_OAUTH_TOKEN"] = source["CLAUDE_CODE_OAUTH_TOKEN"]
        env["DISABLE_AUTOUPDATER"] = "1"
        env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1"
        # --model alone leaves WebFetch/background processing on a different default model.
        env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = model
        env["CLAUDE_CODE_EFFORT_LEVEL"] = effort
    return env


def preflight(profile, experiment, host, condition):
    profile = profile.resolve(strict=True)
    if not profile.is_dir() or not profile.is_relative_to((ROOT / ".superpowers").resolve()):
        raise ValueError("profile must be inside this worktree's task-local runtime directory")
    if profile.name != f"{host}-{condition}":
        raise ValueError("profile directory must identify its host and condition")
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
                          "activation_skills": activation_skills(case, row["condition"]),
                          "status": "dry run; no host invoked"}, indent=2))
        return
    profile = preflight(profile, experiment, row["host"], row["condition"])
    readiness = json.loads((profile / "readiness.json").read_text(encoding="utf-8"))
    activations = activation_prompts(case, row["condition"], row["host"], readiness)
    plugin_roots = selected_plugins(profile, readiness, case, row["condition"])
    destination = experiment / "trials" / trial_id
    if destination.exists():
        raise ValueError("trial already has state; inspect it instead of silently rerunning")
    destination.mkdir(parents=True)
    work = destination / "work"
    work.mkdir()
    if "fixture" in case:
        shutil.copyfile(HERE / "fixtures" / case["fixture"], work / case["fixture"])
    env = native_environment(row["host"], profile, row["model"], row["effort"])
    record = {**row, "turns": [], "activation_turns": [], "delivery_verified": False, "actual_model_verified": False,
              "effort_verified": False, "release_qualified": False,
              "scope": "native skill use with supplied source; generated code is checked separately"}
    session = None
    original_names = sorted({"ponytail" if name == "ponytail-review" else name
                             for name in activation_skills(case, "original")})
    selection_context = (original_selection(profile, original_names, env, ROOT / ".superpowers")
                         if row["host"] == "codex" and row["condition"] == "original" else nullcontext())
    try:
        with selection_context as selection:
            if selection is not None:
                record["plugin_selection"] = selection
            conversation = [("activation_turns", prompt) for prompt in activations]
            conversation += [("turns", prompt) for prompt in case["turns"]]
            for index, (phase, prompt) in enumerate(conversation):
                if phase == "turns" and not record["turns"] and "fixture" in case:
                    prompt += "\n\nSupplied project.py:\n```python\n" + (work / case["fixture"]).read_text(encoding="utf-8") + "\n```"
                args = command(row["host"], row["model"], row["effort"], session, plugin_roots)
                args[0] = shutil.which(args[0]) or args[0]
                started = time.monotonic()
                result = subprocess.run(args, input=prompt, cwd=work, env=env, capture_output=True,
                                        text=True, encoding="utf-8", errors="strict", timeout=timeout)
                if result.returncode:
                    raise ValueError(f"host exit {result.returncode}; no retry attempted")
                turn = parse(row["host"], result.stdout)
                if phase == "activation_turns" and re.search(r"unknown (?:command|skill)|skill not found", turn["answer"], re.I):
                    raise ValueError("native skill activation failed; no task turn will be scored")
                session = turn["session"] or session
                if index < len(conversation) - 1 and not session:
                    raise ValueError("cannot continue without an observed session id")
                record[phase].append({**turn, "duration_s": round(time.monotonic() - started, 3)})
                if row["host"] == "claude" and turn["observed_models"] != [row["model"]]:
                    raise ValueError("native model usage differs from the requested model; stop further turns")
        record["status"] = "collected; runtime evidence and grading pending"
    except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError) as error:
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
