"""Explicit low-model study settings; historical Sonnet preparation stays unchanged.

This module builds commands and plans only. It never launches a host or changes a profile.
"""
import json
from copy import deepcopy

import collect
import prepare

STUDY = "haiku-luna-2026-09-09"
HOSTS = {
    "claude": {"model": "claude-haiku-4-5-20251001", "effort": None,
               "thinking_budget_tokens": 8192},
    "codex": {"model": "gpt-5.6-luna", "effort": "high",
              "thinking_budget_tokens": None},
}


def settings(host):
    if host not in HOSTS:
        raise ValueError("unsupported low-model host")
    return deepcopy(HOSTS[host])


def command(host, session=None, plugin_roots=(), mcp_config=None):
    selected = settings(host)
    # Reuse reviewed tool restrictions, native activation and resume handling.
    return collect.command(host, selected["model"], selected["effort"], session, plugin_roots, mcp_config)


def native_environment(host, profile, environ=None):
    selected = settings(host)
    env = collect.native_environment(host, profile, selected["model"], selected["effort"], environ)
    return env


def plan():
    # Reuse all sixteen tasks, repetitions, activation and instruction hashes unchanged.
    rows = prepare.plan()
    for row in rows:
        row.update(settings(row["host"]))
        row["study"] = STUDY
        row["id"] = STUDY + "." + row["id"]
    return rows


def budget(rows):
    subject = {condition: sum(row["turn_count"] + len(row["activation_skills"])
                             for row in rows if row["condition"] == condition)
               for condition in ("baseline", "original", "ttak")}
    return {"subject_and_activation": subject, "grading": 128,
            "total": sum(subject.values()) + 128}


if __name__ == "__main__":
    rows = plan()
    print(json.dumps({"study": STUDY, "hosts": HOSTS, "trials": len(rows),
                      "budget": budget(rows), "status": "offline plan; no model invoked"}, indent=2))
