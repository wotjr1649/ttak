"""Full fixed-suite conversation construction; no native calls or generated-code execution."""
import unittest
import low_models
from prepare import load_suite
from normal_trial import conversation, selected_packages


class NormalTrialTests(unittest.TestCase):
    def test_all_192_conversations_preserve_388_requests_and_original_turn_order(self):
        cases={case['id']:case for case in load_suite()['cases']}
        rows=low_models.plan()
        total=0
        for row in rows:
            case=cases[row['case']]
            steps=conversation(case,row['condition'])
            self.assertEqual([s['skill'] for s in steps if s['phase']=='activation_turns'],row['activation_skills'])
            turns=[s['prompt'] for s in steps if s['phase']=='turns']
            self.assertEqual(len(turns),len(case['turns']))
            self.assertEqual(turns[1:],case['turns'][1:])
            self.assertTrue(turns[0].startswith(case['turns'][0]))
            self.assertEqual('Supplied project.py:' in turns[0],'fixture' in case)
            total+=len(steps)
        self.assertEqual(len(rows),192)
        self.assertEqual(total,388)

    def test_review_and_mixed_select_installed_packages_without_adding_activations(self):
        cases={case['id']:case for case in load_suite()['cases']}
        self.assertEqual(selected_packages(cases['review-redundancy'],'original'),['ponytail'])
        self.assertEqual(selected_packages(cases['mixed-review-explain'],'original'),['eli5','i-have-adhd','ponytail'])
        for case in cases.values():
            self.assertEqual(selected_packages(case,'baseline'),[])
            self.assertEqual(selected_packages(case,'ttak'),['ttak'])
        with self.assertRaises(ValueError):selected_packages(cases['develop-csv'],'unknown')
