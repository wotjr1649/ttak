"""Selection computation and preservation rules only; no native controls."""
import unittest
from normal_profile import target_selection


class NormalProfileTests(unittest.TestCase):
    def setUp(self):
        self.saved={'ttak@personal':False,'ttak@ttak-release':True,'ttak@ttak-values201':False,
                    'eli5@ttak-original-codex-v4':False}
        self.allowed=['ttak@ttak-values201','eli5@ttak-original-codex-v4']

    def test_baseline_and_original_preserve_saved_state_and_personal_entry(self):
        baseline=target_selection(self.saved,[],self.allowed)
        self.assertFalse(any(baseline.values()))
        original=target_selection(self.saved,['eli5@ttak-original-codex-v4'],self.allowed)
        self.assertEqual([key for key,value in original.items() if value],['eli5@ttak-original-codex-v4'])
        self.assertTrue(self.saved['ttak@ttak-release'])
        self.assertFalse(original['ttak@personal'])

    def test_missing_duplicate_or_unrelated_active_targets_block_clean_comparison(self):
        for selected,allowed in [(['missing'],self.allowed),([self.allowed[0]]*2,self.allowed),
                                  ([],self.allowed+['missing'])]:
            with self.assertRaises(ValueError):target_selection(self.saved,selected,allowed)
        for saved in ({**self.saved,'ttak@personal':True},{**self.saved,'other@outside':True},
                      {**self.saved,'ttak@ttak-release':1}):
            with self.assertRaises(ValueError):target_selection(saved,[],self.allowed)
