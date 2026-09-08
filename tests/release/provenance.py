"""Measure current instruction overlap against hash-verified vendored upstream skills.

Offline evidence only: lexical overlap does not establish authorship or license clearance.
Prints counts, offsets and hashes, never source passages. Does not write files.
"""
import difflib
import hashlib
import json
import re

from prepare import POLICY, ROOT, SKILLS, SOURCES, source_records


def words(text):
    return re.findall(r"[a-z0-9]+", text.casefold())


def measure():
    sources = [record for record in source_records() if record.get("upstream_path")]
    source_words = {
        record["path"]: words((SOURCES / record["path"]).read_text(encoding="utf-8"))
        for record in sources
    }
    artifacts = []
    for relative in POLICY + SKILLS:
        raw = (ROOT / relative).read_bytes()
        tokens = words(raw.decode("utf-8"))
        matches = []
        for record in sources:
            match = difflib.SequenceMatcher(
                None, tokens, source_words[record["path"]], autojunk=False
            ).find_longest_match()
            matches.append({
                "source": record["path"], "revision": record["revision"],
                "source_sha256": record["sha256"], "shared_words": match.size,
                "artifact_word_offset": match.a, "source_word_offset": match.b,
            })
        artifacts.append({"path": relative, "sha256": hashlib.sha256(raw).hexdigest(),
                          "words": len(tokens), "matches": matches})
    return {
        "scope": "Five current instruction files including frontmatter; four pinned upstream skill files",
        "method": "Case-fold; tokenize with [a-z0-9]+; longest contiguous match; autojunk disabled; zero-based word offsets",
        "historical_metrics_replaced": False, "license_clearance": False,
        "artifacts": artifacts,
    }


if __name__ == "__main__":
    print(json.dumps(measure(), indent=2))
