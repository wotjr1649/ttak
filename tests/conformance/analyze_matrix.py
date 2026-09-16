#!/usr/bin/env python3
"""Report the matrix as bounds, not point estimates, and emit the row ledger.

    python analyze_matrix.py --in <matrix.jsonl> ... --out <bounds.json> [--ledger <l.jsonl>]
    python analyze_matrix.py --selftest

Two blind graders read every row. Where they agree the row has a verdict; where
they do not it is held out. A rate computed over agreed rows alone is
conditional on agreement, and agreement is not independent of the response --
so a single number hides how much of the cell was dropped and which way the
dropped rows could go.

Every figure here is therefore three figures:

  consensus   agreed rows only, held-out rows excluded from the denominator
  favourable  held-out rows counted the way that most favours the `with` arm
  adverse     held-out rows counted the way that most favours the baseline

A result that survives `adverse` is a result. A result that reverses between
`favourable` and `adverse` is an artefact of the exclusion rule, and this file
prints both rather than choosing.

Standard library only. Invokes nothing.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze_ablation import fisher_exact, wilson  # noqa: E402


def tally(rows):
    """(cell, ac, arm) -> [passed, failed, held_out]."""
    out = {}
    for r in rows:
        k = (r["_cell"], r["ac"], r["arm"])
        s = out.setdefault(k, [0, 0, 0])
        if r.get("pass") is None:
            s[2] += 1
        elif r["pass"]:
            s[0] += 1
        else:
            s[1] += 1
    return out


def bounds(w, o):
    """Three readings of one (with, without) pair of [pass, fail, held]."""
    nw, no = sum(w), sum(o)
    readings = {
        "consensus":  (w[0], w[0] + w[1], o[0], o[0] + o[1]),
        "favourable": (w[0] + w[2], nw, o[0], no),
        "adverse":    (w[0], nw, o[0] + o[2], no),
    }
    out = {}
    for name, (a, an, b, bn) in readings.items():
        if an == 0 or bn == 0:
            out[name] = None
            continue
        out[name] = {
            "with": [a, an], "without": [b, bn],
            "with_rate": a / an, "without_rate": b / bn,
            "with_wilson95": list(wilson(a, an)), "without_wilson95": list(wilson(b, bn)),
            "fisher_exact_two_sided": fisher_exact(a, an - a, b, bn - b),
        }
    c, adv = out.get("consensus"), out.get("adverse")
    out["direction_survives_adverse"] = bool(
        c and adv and c["with_rate"] > c["without_rate"] and adv["with_rate"] > adv["without_rate"])
    out["held_out"] = {"with": w[2], "without": o[2]}
    return out


def analyse(paths):
    rows = []
    for p in paths:
        cell = Path(p).stem.replace("2026-09-15-matrix-", "")
        for line in Path(p).read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                r["_cell"] = cell
                rows.append(r)
    t = tally(rows)
    cells = sorted({k[0] for k in t})
    acs = sorted({k[1] for k in t})
    report = {"n_rows": len(rows), "cells": cells, "acs": acs, "results": {}}
    for cell in cells:
        for ac in acs:
            w = t.get((cell, ac, "with"))
            o = t.get((cell, ac, "without"))
            if not w or not o:
                continue
            report["results"][f"{cell}|{ac}"] = bounds(w, o)
    return rows, report


def ledger_rows(rows):
    for r in rows:
        g = r.get("grade") or {}
        yield {
            "cell": r["_cell"], "case": r["case"], "ac": r["ac"], "arm": r["arm"],
            "trial": r["trial"], "model": r.get("model"), "effort": r.get("effort"),
            "policy_sha256": r.get("policy_sha256"),
            "grader_claude": (g.get("claude") or {}).get("pass", "absent"),
            "grader_astra": (g.get("second") or {}).get("pass", "absent"),
            "verdict": r.get("pass"),
            "disposition": ("agreed" if r.get("pass") is not None
                            else g.get("held_out", "no verdict")),
        }


def _selftest():
    # A cell whose consensus favours `with` but whose held-out rows can reverse it.
    w, o = [65, 0, 25], [44, 21, 25]
    b = bounds(w, o)
    assert b["consensus"]["with"] == [65, 65] and b["consensus"]["without"] == [44, 65]
    assert b["favourable"]["with"] == [90, 90] and b["favourable"]["without"] == [44, 90]
    assert b["adverse"]["with"] == [65, 90] and b["adverse"]["without"] == [69, 90]
    assert b["adverse"]["with_rate"] < b["adverse"]["without_rate"], "the reversal must be visible"
    assert b["direction_survives_adverse"] is False

    # Nothing held out: all three readings coincide and the flag is honest.
    b2 = bounds([30, 0, 0], [0, 30, 0])
    assert b2["consensus"]["with"] == b2["favourable"]["with"] == b2["adverse"]["with"] == [30, 30]
    assert b2["direction_survives_adverse"] is True

    # A floor cell: both arms zero, so no direction survives anything.
    b3 = bounds([0, 30, 0], [0, 30, 0])
    assert b3["direction_survives_adverse"] is False
    print("selftest OK: bounds, reversal detection, and the no-holdout identity")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--in", dest="paths", action="append", default=[])
    p.add_argument("--out", type=Path)
    p.add_argument("--ledger", type=Path)
    p.add_argument("--selftest", action="store_true")
    a = p.parse_args(argv)
    if a.selftest:
        _selftest()
        return 0
    if not a.paths:
        p.error("--in is required (repeatable)")
    rows, report = analyse(a.paths)
    if a.ledger:
        with a.ledger.open("w", encoding="utf-8", newline="\n") as f:
            for row in ledger_rows(rows):
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"ledger: {len(rows)} row(s) -> {a.ledger}")
    if a.out:
        a.out.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n",
                         encoding="utf-8", newline="\n")
        print(f"bounds: {len(report['results'])} cell x AC -> {a.out}")
    surviving = [k for k, v in report["results"].items() if v["direction_survives_adverse"]]
    print(f"\n{len(surviving)} of {len(report['results'])} comparison(s) keep their direction "
          f"under the adverse reading:")
    for k in surviving:
        v = report["results"][k]["adverse"]
        print(f"  {k}  with {v['with'][0]}/{v['with'][1]} vs without {v['without'][0]}/{v['without'][1]} "
              f"p={v['fisher_exact_two_sided']:.3g}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
