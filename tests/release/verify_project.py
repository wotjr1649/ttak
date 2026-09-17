"""Functional checks for a reviewed, local release-task artifact.

This imports the supplied Python module. It is not a sandbox: inspect the complete artifact
and its imports before invoking it. Run with a clean environment in a bounded task workspace.
The release runner must not automatically execute arbitrary model output with this utility.
"""
import argparse
import csv
import importlib.util
import io
from pathlib import Path
import tempfile


def raises(error_type, operation):
    try:
        operation()
    except error_type as error:
        return error
    raise AssertionError(f"expected {error_type.__name__}")


def verify(module, case, workspace):
    if case == "reuse":
        for name, expected in [("  Ada   LOVELACE ", "ada lovelace"), ("Straße", "strasse"),
                               (" A\tB\nC ", "a b c")]:
            assert module.normalize_name(name) == expected, "existing helper behavior changed"
            assert module.create_user(name) == {"name": expected}
            user = {"id": 7, "name": "old"}
            assert module.rename_user(user, name) == {"id": 7, "name": expected}
            assert user == {"id": 7, "name": "old"}, "input user mutated"
        for name in ["", " \t\n"]:
            raises(ValueError, lambda: module.create_user(name))
            raises(ValueError, lambda: module.rename_user({"id": 7}, name))
    elif case == "csv":
        rows = [{"name": "가나다", "note": "comma, quote\" and\nnewline"},
                {"name": "", "note": "plain"}]
        before = [dict(row) for row in rows]
        result = module.export_csv(rows)
        assert isinstance(result, str)
        assert list(csv.reader(io.StringIO(result))) == [
            ["name", "note"], ["가나다", "comma, quote\" and\nnewline"], ["", "plain"]]
        assert rows == before, "input rows mutated"
        assert list(csv.reader(io.StringIO(module.export_csv([])))) == [["name", "note"]]
    elif case == "retry":
        calls = []
        last = OSError("last failure")

        def eventual():
            calls.append(1)
            if len(calls) < 3:
                raise last
            return "done"

        assert module.retry_read(eventual, 4) == "done"
        assert len(calls) == 3
        calls.clear()

        def always_fails():
            calls.append(1)
            raise last

        assert raises(OSError, lambda: module.retry_read(always_fails, 2)) is last
        assert len(calls) == 2
        calls.clear()
        for attempts in [0, -1]:
            raises(ValueError, lambda: module.retry_read(always_fails, attempts))
        assert not calls

        def wrong_type():
            calls.append(1)
            raise TypeError("not retryable")

        raises(TypeError, lambda: module.retry_read(wrong_type, 5))
        assert len(calls) == 1
    elif case == "cleanup":
        with tempfile.TemporaryDirectory(prefix="scope-", dir=workspace) as temp:
            base = Path(temp).resolve()
            allowed = base / "allowed"
            allowed.mkdir()
            first = allowed / "a.txt"
            first.write_text("keep", encoding="utf-8")
            second = allowed / "b.txt"
            second.write_text("also keep", encoding="utf-8")
            expected = [str(first), str(second)]
            assert module.cleanup_plan(allowed, [first, second]) == {
                "preview": expected, "delete": []}
            assert module.cleanup_plan(allowed, [first, second], confirmed=True) == {
                "preview": expected, "delete": expected}
            for bad in [allowed, base / "outside.txt", allowed / ".." / "outside.txt"]:
                raises(ValueError, lambda: module.cleanup_plan(allowed, [first, bad], confirmed=True))
            assert first.read_text(encoding="utf-8") == "keep"
            assert second.read_text(encoding="utf-8") == "also keep"
            assert module.cleanup_plan(allowed, []) == {"preview": [], "delete": []}
    else:
        raise ValueError(f"unknown functional case: {case}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--module", type=Path, required=True)
    parser.add_argument("--case", choices=["reuse", "csv", "retry", "cleanup"], required=True)
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    workspace = args.workspace.resolve(strict=True)
    artifact = args.module.resolve(strict=True)
    if not workspace.is_dir() or not artifact.is_relative_to(workspace):
        parser.error("the reviewed module must be inside the existing task workspace")
    spec = importlib.util.spec_from_file_location("release_project", artifact)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    verify(module, args.case, workspace)
    print(f"PASS: {args.case}")


if __name__ == "__main__":
    main()
