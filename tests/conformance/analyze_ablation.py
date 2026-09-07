#!/usr/bin/env python3
"""The ablation's numbers: rates with intervals, and three pre-specified tests.

    python analyze_ablation.py --condition "a. no plugin=<file>" ... [--json <out>]

Four comparisons and no more: b vs a (does the shipped policy do anything),
c vs b (does the bullet under test do anything), d vs b (does the sentence
telling the model to yield do anything), e vs b (does the paragraph saying
TTAK is not an enforcement mechanism do anything). Holm-corrected across those
four. Running all ten pairwise comparisons instead would spend the correction
on questions nobody pre-registered.

**The family grew from three to four after the first three returned null, and
that is stated rather than hidden.** The pre-registration named condition e as
an untested candidate in the same document that fixed the family at three, so
e was pre-specified as a question and not as a member of the family. Enlarging
the family is the conservative reading -- it makes every adjusted p larger,
not smaller -- and `--family3` reprints the original three-test correction
beside it so a reader can see exactly what the fourth test cost the others.

Wilson 95% intervals on every rate, because at n=10 the point estimate is the
least informative number on the page: 0/10 and 1/10 have overlapping
intervals and neither excludes the other's point.

A row held out by a checker/judge disagreement is excluded from its
condition's count until `grade.held_out_resolved` records the re-read. The
exclusion is printed, not silent.

Fisher's exact test rather than chi-square: expected cell counts here are
below one, which is exactly where the chi-square approximation stops meaning
anything.

Standard library only. Invokes nothing.
"""
import argparse
import json
import math
import sys
from pathlib import Path

Z = 1.959963984540054  # two-sided 95%


def read_rows(path):
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{lineno}: invalid JSON ({e})") from e
    return rows


def wilson(k, n):
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    d = 1 + Z * Z / n
    centre = (p + Z * Z / (2 * n)) / d
    half = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / d
    return (max(0.0, centre - half), min(1.0, centre + half))


def hypergeom(a, b, c, d):
    """P of the exact 2x2 table [[a, b], [c, d]] under fixed margins."""
    n = a + b + c + d
    return (math.comb(a + b, a) * math.comb(c + d, c)) / math.comb(n, a + c)


def fisher_exact(a, b, c, d):
    """Two-sided p: every table with the same margins whose probability is no
    greater than the observed one."""
    row1, row2, col1 = a + b, c + d, a + c
    observed = hypergeom(a, b, c, d)
    total = 0.0
    for x in range(max(0, col1 - row2), min(row1, col1) + 1):
        p = hypergeom(x, row1 - x, col1 - x, row2 - col1 + x)
        if p <= observed * (1 + 1e-12):
            total += p
    return min(1.0, total)


def holm(pairs):
    """(label, p) -> (label, p, adjusted p), Holm step-down, monotone."""
    ordered = sorted(pairs, key=lambda t: t[1])
    m = len(ordered)
    out = []
    running = 0.0
    for i, (label, p) in enumerate(ordered):
        adj = min(1.0, (m - i) * p)
        running = max(running, adj)
        out.append((label, p, running))
    return out


def write_attempts(rows):
    """Rows where the model tried a tool and was denied. Recorded as an
    outcome, not suppressed: it is the one behavioural difference so far
    observed between the arms, and removing the tools would delete it."""
    n = 0
    for row in rows:
        try:
            denials = json.loads(row.get("stdout") or "")["permission_denials"]
        except (ValueError, KeyError, TypeError):
            continue
        if denials:
            n += 1
    return n


def tally(path):
    rows = read_rows(path)
    counted, held = [], []
    for row in rows:
        grade = row.get("grade") or {}
        if grade.get("held_out") and not grade.get("held_out_resolved"):
            held.append(grade.get("rid"))
            continue
        counted.append(row)
    ungraded = [r["grade"]["rid"] for r in counted if r.get("pass") is None]
    passes = sum(1 for r in counted if r.get("pass") is True)
    return {
        "n": len(counted), "passes": passes,
        "held_out": held, "ungraded": ungraded,
        "write_attempts": write_attempts(counted),
        "policy_sha256": (rows[0].get("policy_sha256") if rows else None),
        "resolved": [r["grade"]["rid"] for r in counted
                     if (r.get("grade") or {}).get("held_out_resolved")],
    }


COMPARISONS = (("b vs a", "b", "a"), ("c vs b", "c", "b"), ("d vs b", "d", "b"),
               ("e vs b", "e", "b"))
PREREGISTERED_THREE = ("b vs a", "c vs b", "d vs b")


def _selftest():
    # Fisher: Fisher's own tea-tasting table, and the two extremes.
    assert abs(fisher_exact(3, 1, 1, 3) - 0.4857142857) < 1e-9, fisher_exact(3, 1, 1, 3)
    assert abs(fisher_exact(10, 0, 0, 10) - 2 / math.comb(20, 10)) < 1e-15
    assert fisher_exact(1, 9, 0, 10) == 1.0, "the observed comparison must come out at p=1"
    assert fisher_exact(0, 10, 0, 10) == 1.0, "two identical zero rates cannot separate"
    # Symmetric in the two rows: swapping the arms must not move p.
    assert abs(fisher_exact(1, 9, 0, 10) - fisher_exact(0, 10, 1, 9)) < 1e-15

    # Wilson: stays inside [0, 1] at the boundaries, and 0/10 does not collapse
    # to the zero-width interval the normal approximation gives there.
    lo, hi = wilson(0, 10)
    assert lo == 0.0 and abs(hi - 0.2775) < 5e-4, (lo, hi)
    lo, hi = wilson(1, 10)
    assert abs(lo - 0.0179) < 5e-4 and abs(hi - 0.4042) < 5e-4, (lo, hi)
    lo, hi = wilson(10, 10)
    # 1 - 1e-16 rather than 1.0: the closed form lands a float short of the
    # exact bound, and rounding it up would be cosmetic, not more correct.
    assert abs(lo - 0.7225) < 5e-4 and abs(hi - 1.0) < 1e-9, (lo, hi)
    assert wilson(0, 0) == (0.0, 1.0), "no data must widen to everything, not to a point"

    # The comparison family is four, and the fourth must make the others'
    # adjusted p-values larger, never smaller. That is the whole reason for
    # declaring the enlargement rather than quietly keeping three.
    p3 = [a for _, _, a in holm([("b", 0.02), ("c", 0.03), ("d", 0.04)])]
    p4 = [a for _, _, a in holm([("b", 0.02), ("c", 0.03), ("d", 0.04), ("e", 0.05)])]
    assert all(x <= y for x, y in zip(p3, p4)), (p3, p4)
    assert len(COMPARISONS) == 4 and set(PREREGISTERED_THREE) < {c[0] for c in COMPARISONS}

    # Holm: step-down, and monotone -- a later test can never come out below an
    # earlier one after adjustment.
    got = {label: round(adj, 10) for label, _, adj in
           holm([("x", 0.01), ("y", 0.04), ("z", 0.03)])}
    assert got == {"x": 0.03, "y": 0.06, "z": 0.06}, got
    assert [a for _, _, a in holm([("x", 1.0), ("y", 1.0), ("z", 1.0)])] == [1.0, 1.0, 1.0], (
        "adjustment must cap at 1, not report 3.0")

    print("selftest OK")
    return True


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--condition", action="append", default=[], metavar="KEY=LABEL=FILE",
                   help="e.g. a=no plugin=runs/....jsonl")
    p.add_argument("--json", dest="json_out", type=Path)
    p.add_argument("--selftest", action="store_true")
    args = p.parse_args(argv)

    if args.selftest:
        return 0 if _selftest() else 1
    if not args.condition:
        p.error("--condition KEY=LABEL=FILE is required (repeat it), or use --selftest")

    conditions = {}
    order = []
    try:
        for spec in args.condition:
            key, label, path = spec.split("=", 2)
            conditions[key] = dict(tally(Path(path)), label=label, file=path)
            order.append(key)
    except (ValueError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    sizes = sorted({c["n"] for c in conditions.values()})
    size = str(sizes[0]) if len(sizes) == 1 else "%d-%d" % (sizes[0], sizes[-1])
    print(f"Rates, with Wilson 95% intervals. n={size} per condition: read the interval, "
          f"not the point.")
    print(f"{'':<3} {'condition':<24} {'pass':>7} {'rate':>7}  {'95% CI':<16} {'denied tool use':>15}")
    for key in order:
        c = conditions[key]
        lo, hi = wilson(c["passes"], c["n"])
        print(f"{key:<3} {c['label']:<24} {c['passes']:>3}/{c['n']:<3} "
              f"{c['passes'] / c['n'] if c['n'] else 0:>6.0%}  "
              f"[{lo:.3f}, {hi:.3f}]     {c['write_attempts']:>3}/{c['n']}")

    for key in order:
        c = conditions[key]
        if c["held_out"]:
            print(f"  {key}: {len(c['held_out'])} row(s) held out of the count "
                  f"pending a re-read: {', '.join(c['held_out'])}")
        if c["resolved"]:
            print(f"  {key}: {len(c['resolved'])} row(s) re-read after a checker/judge "
                  f"disagreement and counted: {', '.join(c['resolved'])}")
        if c["ungraded"]:
            print(f"  {key}: {len(c['ungraded'])} ungraded row(s): {', '.join(c['ungraded'])}")

    tests = []
    for label, x, y in COMPARISONS:
        if x not in conditions or y not in conditions:
            continue
        cx, cy = conditions[x], conditions[y]
        if x not in conditions or y not in conditions:
            continue
        pval = fisher_exact(cx["passes"], cx["n"] - cx["passes"],
                            cy["passes"], cy["n"] - cy["passes"])
        tests.append((f"{label}  ({cx['passes']}/{cx['n']} vs {cy['passes']}/{cy['n']})", pval))

    print(f"\n{len(tests)} comparisons, Fisher exact, Holm-corrected across all of them.")
    results = holm(tests)
    for label, pval, adj in results:
        print(f"  {label:<32} p={pval:.4f}  Holm-adjusted p={adj:.4f}")

    # The family as originally pre-registered, so the cost of enlarging it is
    # visible rather than argued about.
    three = [(label, pval) for label, pval in tests
             if label.split("  ")[0] in PREREGISTERED_THREE]
    if len(three) == len(PREREGISTERED_THREE) and len(tests) > len(three):
        print("\nThe same tests under the pre-registered family of three:")
        for label, pval, adj in holm(three):
            print(f"  {label:<32} p={pval:.4f}  Holm-adjusted p={adj:.4f}")

    if args.json_out:
        args.json_out.write_text(json.dumps(
            {"conditions": conditions,
             "tests": [{"comparison": l, "p": pv, "holm_p": a} for l, pv, a in results]},
            indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
        print(f"\nwrote {args.json_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
