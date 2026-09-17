"""Collector path/preflight checks only; never launch a native CLI."""
from pathlib import Path
import tempfile
import unittest

from normal_turn import local_directory, run_turn
from prepare import ROOT


class NormalTurnTests(unittest.TestCase):
    def test_local_collection_paths_exclude_root_files_and_traversal(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.superpowers') as temp:
            path = Path(temp)
            self.assertEqual(local_directory(path), path.resolve())
            (path / 'file').write_bytes(b'fixture')
            for invalid in (ROOT, ROOT / '.superpowers', path / 'file', path / 'missing',
                            path / 'missing' / '..'):
                with self.assertRaises((ValueError, OSError)):
                    local_directory(invalid)

    def test_wrong_profile_is_rejected_before_lock_or_collection_creation(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.superpowers') as temp:
            path = Path(temp)
            with self.assertRaises(ValueError):
                run_turn(host='codex', prompt='Synthetic fixture.', profile=path, work=path,
                    record_directory=path / 'record', skills=[], ttak_root=None, session=None,
                    timeout=900, parent_turn_limit=20, internal_verifier_limit=0)
            self.assertEqual(list(path.iterdir()), [])
