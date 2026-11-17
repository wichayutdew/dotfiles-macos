import copy
import unittest
import knowledge_contract as k

class ContractTests(unittest.TestCase):
    def fixture(self):
        link='https://agoda.slack.com/archives/C04SM1C4BNH/p1794405288201679'
        return dict(markdown='\n'.join('## '+h+'\n'+('Verified only on version 2; cause unconfirmed. '+link) for h in k.HEADINGS),
                    sourceLinks=[link],requiredTerms=['version 2','unconfirmed'],pageTags=['oncall','feature:offer-visibility'],
                    parentId='kf-oncall',expectedParentId='kf-oncall')
    def test_identity_rotation_is_provenance_not_page_scope(self):
        self.assertEqual(k.identity('10189','63710')['documentId'],'oncall:10189:63710')
        self.assertNotEqual(k.identity('10189','63710'),k.identity('2','63710'))
        self.assertEqual(k.page_query('offer-visibility','Offer visibility')['tags'],['oncall','feature:offer-visibility'])
    def test_generation_contract_preserves_remediation_and_hypothesis_attribution(self):
        query=k.page_query('queue-saturation','Queue saturation')['sourceQuery']
        self.assertIn('Preserve exact source-supported remediation verbs',query)
        self.assertIn('never add alternative actions or treat different operations as equivalent',query)
        self.assertIn('Preserve hypothesis attribution',query)
        self.assertIn('do not infer who proposed or rejected it',query)
    def test_malformed_identity_or_slug(self):
        for value in ['0','1 OR 1=1',True]:
            with self.assertRaises(ValueError):k.identity(value,'1')
        with self.assertRaises(ValueError):k.page_query('../triage','Bad')
    def test_readback(self):
        self.assertTrue(k.check_page('offer-visibility',self.fixture())['ok'])
    def test_scope_parent_links_and_uncertainty_rejected(self):
        for patch in [dict(pageTags=['triage','feature:offer-visibility']),dict(pageTags=['oncall','feature:offer-visibility','rotation-id:1']),dict(parentId='kf-triage'),dict(requiredTerms=['missing caveat']),dict(sourceLinks=['https://missing.test'])]:
            with self.subTest(patch=patch),self.assertRaises(ValueError):k.check_page('offer-visibility',dict(self.fixture(),**patch))
    def test_empty_final_section_or_wrong_order(self):
        page=self.fixture();page['markdown']=page['markdown'].split('## Evidence')[0]+'## Evidence\n'
        with self.assertRaises(ValueError):k.check_page('offer-visibility',page)
        page=self.fixture();page['markdown']=page['markdown'].replace('## Symptoms','## temp').replace('## Diagnosis','## Symptoms').replace('## temp','## Diagnosis')
        with self.assertRaises(ValueError):k.check_page('offer-visibility',page)

if __name__=='__main__':unittest.main()
