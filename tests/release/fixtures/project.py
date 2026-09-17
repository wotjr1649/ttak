"""Small local project used by the frozen release tasks; deliberately contains task defects."""
import csv
import io
from pathlib import Path


def normalize_name(name):
    normalized = " ".join(name.split()).casefold()
    if not normalized:
        raise ValueError("empty name")
    return normalized


def create_user(name):
    return {"name": name.lower()}


def rename_user(user, name):
    return {**user, "name": name.strip()}


def export_csv(rows):
    return "name,note\n" + "".join(f"{row['name']},{row['note']}\n" for row in rows)


def retry_read(read, attempts):
    for _ in range(attempts):
        try:
            return read()
        except Exception:
            pass
    return None


class CleanupReport:
    def __init__(self, paths):
        self.paths = paths

    def as_dict(self, confirmed):
        return {"preview": list(self.paths), "delete": list(self.paths) if confirmed else []}


def cleanup_plan(root, candidates, *, confirmed=False):
    """Return checked paths, never delete or write files.

    Unconfirmed calls preview only. Reject root itself and anything outside it, including
    traversal and resolved symlinks. Reject the entire plan if any candidate is invalid.
    """
    root = Path(root).resolve()
    paths = []
    for candidate in candidates:
        path = Path(candidate).resolve()
        if path == root or root not in path.parents:
            raise ValueError("outside allowed descendants")
        paths.append(str(path))
    report = CleanupReport(paths)
    return report.as_dict(confirmed)
