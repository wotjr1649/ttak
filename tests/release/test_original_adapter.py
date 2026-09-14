"""Verify pinned bodies, licenses and explicit-only metadata without installing."""
import unittest

import original_adapter as adapter
import prepare


class OriginalAdapterTests(unittest.TestCase):
    def test_every_pinned_body_and_license_is_preserved(self):
        for host in ('claude', 'codex'):
            for name in adapter.PACKAGES:
                files, translations = adapter.package_files(host, name)
                self.assertIn('LICENSE', files)
                for record in prepare.source_records():
                    if not record['path'].startswith(name + '/'):
                        continue
                    relative = record['path'][len(name) + 1:].replace('skill-source.md', 'SKILL.md')
                    original = (prepare.SOURCES / record['path']).read_bytes()
                    if relative.endswith('/SKILL.md'):
                        self.assertEqual(files[relative].split(b'\n---\n', 1)[1], original.split(b'\n---\n', 1)[1])
                    if host == 'claude' or name != 'i-have-adhd' or relative == 'LICENSE':
                        self.assertEqual(files[relative], original)
                self.assertEqual(len(translations), int(host == 'codex' and name == 'i-have-adhd'))
                if translations:
                    self.assertIn(b'allow_implicit_invocation: false', files['skills/i-have-adhd/agents/openai.yaml'])
                    self.assertNotIn(b'disable-model-invocation:', files['skills/i-have-adhd/SKILL.md'].split(b'\n---\n', 1)[0])

    def test_translation_changes_only_the_frontmatter_policy_line(self):
        raw = b'---\nname: test\ndescription: fixture\ndisable-model-invocation: true\n---\nBody\ndisable-model-invocation: true\n'
        translated, policy = adapter.adapt_skill(raw, 'codex')
        self.assertEqual(translated, raw.replace(b'disable-model-invocation: true\n', b'', 1))
        self.assertIsNotNone(policy)
        self.assertEqual(adapter.adapt_skill(raw, 'claude'), (raw, None))
        for invalid in [raw.replace(b'name: test', b'disable-model-invocation: true'), raw.replace(b': true\n---', b': maybe\n---'), b'no frontmatter']:
            with self.assertRaises(ValueError):
                adapter.adapt_skill(invalid, 'codex')

    def test_unknown_hosts_or_packages_fail_without_writes(self):
        for host, name in [('other', 'ponytail'), ('codex', '../ponytail'), ('claude', 'unknown')]:
            with self.assertRaises(ValueError):
                adapter.package_files(host, name)
