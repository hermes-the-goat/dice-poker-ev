"""Independent rules, layout, binary and one-school endgame checks (stdlib only)."""
import importlib.util, json, math, struct, subprocess, unittest
from pathlib import Path
from functools import lru_cache
ROOT=Path(__file__).resolve().parent.parent

class RulesTests(unittest.TestCase):
    def test_reference_rules_exist(self):
        self.assertTrue((ROOT/'model-school/reference.py').exists(), 'reference rules not implemented')
    def test_generator_exists(self):
        self.assertTrue((ROOT/'model-school/generate.cpp').exists(), 'exact generator not implemented')

class ExportTests(unittest.TestCase):
    def test_rank_fixtures_and_hash(self):
        import hashlib
        self.assertTrue((ROOT/'school-fixtures.json').exists(),'independently checked rank fixtures missing')
        fixtures=json.loads((ROOT/'school-fixtures.json').read_text())
        self.assertGreaterEqual(len(fixtures['positions']),12)
        self.assertGreaterEqual(fixtures['independentlyVerifiedPositions'],10)
        meta=json.loads((ROOT/'school-model.json').read_text())
        self.assertEqual(meta['sha256'],hashlib.sha256((ROOT/'school-values.bin').read_bytes()).hexdigest())
        from reference import Oracle
        values=struct.unpack('<960512d',(ROOT/'school-values.bin').read_bytes())
        def get(a,h,s,e):
            return values[(a*3752+meta['sumOffsets'][h]+meta['sumsByRemaining'][h].index(s))*2+e]
        def key(x):return (x['type'],x.get('category',-1),x.get('points',0),tuple(x.get('hold',[])))
        for case in fixtures['positions']:
            if not case['independentlyVerified']:continue
            s=case['state'];oracle=Oracle(get,s['standardMask'],s['schoolRemaining'],s['schoolSum'])
            expected={key(x):x['ev'] for x in oracle.actions(tuple(s['counts']),tuple(s['locked']),s['roll'],s['extra'])}
            actual={key(x):x['ev'] for x in case['actions']}
            self.assertEqual(actual.keys(),expected.keys())
            for k in actual:self.assertAlmostEqual(actual[k],expected[k],delta=2e-10)
            oracle.value.cache_clear()

    def test_rules_exhaustive(self):
        from reference import school_score,bonus,declarations
        for n in range(1,7):
            for m in range(6):
                for r in range(1,5):
                    self.assertEqual(school_score(n,m,r),n*(m-3)+(n if r==1 and m>=3 else 0))
                    counts=[0]*6;counts[n-1]=m;counts[n%6]=5-m
                    self.assertEqual(declarations(counts,1<<(n+6),r),[(n+6,school_score(n,m,r))])
        self.assertEqual([bonus(x) for x in [-1,0,10,11]],[-30,0,0,30])
        self.assertIn((0,0),declarations([0,0,0,0,0,5],1,1))
        self.assertEqual(declarations([0,0,0,0,2,3],1<<12,2),[(12,0)])
        self.assertEqual(declarations([0,0,0,0,2,3],1<<12,1),[(12,6)])

    def test_complete_exact_export(self):
        self.assertTrue((ROOT/'school-model.json').exists(), 'real export not generated')
        m=json.loads((ROOT/'school-model.json').read_text())
        self.assertEqual((m['version'],m['layout'],m['sumStride']),(1,'standard-school-sum-extra',3752))
        raw=(ROOT/'school-values.bin').read_bytes()
        self.assertEqual(len(raw),960512*8)
        values=struct.unpack('<960512d',raw)
        self.assertTrue(all(math.isfinite(x) for x in values))
        self.assertTrue(all(values[k+1]>=values[k]-2e-10 for k in range(0,len(values),2)))
        offset=0
        for h in range(64):
            self.assertEqual(m['sumOffsets'][h],offset)
            expected={0}
            for n in range(1,7):
                if not h>>(n-1)&1:expected={s+k*n for s in expected for k in range(-3,4)}
            self.assertEqual(m['sumsByRemaining'][h],sorted(expected))
            offset+=len(expected)
            for n in range(1,7):
                if h>>(n-1)&1:
                    child=set(m['sumsByRemaining'][h^(1<<(n-1))])
                    self.assertTrue(all(s+k*n in child for s in expected for k in range(-3,4)))
        self.assertEqual(offset,3752)
        def get(a,h,s,e):
            return values[(a*3752+m['sumOffsets'][h]+m['sumsByRemaining'][h].index(s))*2+e]
        baseline=json.loads((ROOT/'values.json').read_text())
        for a in range(128):
            for e in range(2): self.assertEqual(get(a,0,0,e),baseline[a][e])
        for s in m['sumsByRemaining'][0]:
            for e in range(2): self.assertEqual(get(0,0,s,e),-30 if s<0 else 0 if s<=10 else 30)
        # Independent binomial expectimax: for a single school, locking any
        # non-target face never improves the distribution of target matches.
        for n in range(1,7):
            h=1<<(n-1)
            for s in [-12,-1,0,10,11,18]:
                if s not in m['sumsByRemaining'][h]: continue
                for e in range(2):
                    @lru_cache(None)
                    def turn(matches,locked,r,token):
                        q=n*(matches-3)+(n if r==1 and matches>=3 else 0)
                        best=q+(-30 if s+q<0 else 0 if s+q<=10 else 30)
                        if r<3 or (r==3 and token):
                            for keep in range(locked,min(matches,4)+1):
                                free=5-keep
                                ev=sum(math.comb(free,k)*(1/6)**k*(5/6)**(free-k)*turn(keep+k,keep,r+1,0 if r==3 else token) for k in range(free+1))-(10 if r==3 else 0)
                                best=max(best,ev)
                        return best
                    expected=sum(math.comb(5,k)*(1/6)**k*(5/6)**(5-k)*turn(k,0,1,e) for k in range(6))
                    self.assertAlmostEqual(get(0,h,s,e),expected,delta=2e-10)

if __name__=='__main__': unittest.main()
