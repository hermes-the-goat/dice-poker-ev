#!/usr/bin/env python3
"""Hash the real LUT; generate and independently verify actual action fixtures."""
import hashlib,json,struct,subprocess
from pathlib import Path
from reference import Oracle
ROOT=Path(__file__).resolve().parent.parent
meta=json.loads((ROOT/'school-model.json').read_text())
raw=(ROOT/'school-values.bin').read_bytes()
values=struct.unpack('<960512d',raw)
def get(a,h,s,e):
    return values[(a*meta['sumStride']+meta['sumOffsets'][h]+meta['sumsByRemaining'][h].index(s))*2+e]
def key(x):
    return (x['type'],x.get('category',-1),x.get('points',0),tuple(x.get('hold',[])))
# A,H,s,e,r,counts,locks, independent full-turn verification.
cases=[
 (127,63,0,1,1,[0,0,1,1,0,3],[0]*6,False),
 (127,63,0,0,1,[1,1,1,1,1,0],[0]*6,False),
 (127,63,0,1,2,[0,0,1,1,0,3],[0,0,0,0,0,3],True),
 (73,17,-1,1,3,[2,0,0,0,1,2],[2,0,0,0,1,0],True),
 (1,32,0,1,3,[0,1,1,0,0,3],[0,0,0,0,0,3],True),
 (64,1,10,0,2,[2,0,0,0,0,3],[0,0,0,0,0,3],True),
 (0,32,11,1,3,[0,0,0,0,2,3],[0,0,0,0,2,1],True),
 (0,32,-1,0,3,[0,0,0,0,2,3],[0,0,0,0,2,1],True),
 (0,1,0,0,4,[0,1,1,1,1,1],[0,1,1,1,0,0],True),
 (1,1,-1,0,3,[0,0,1,1,1,2],[0,0,1,1,1,0],True),
 (127,0,11,1,3,[0,0,0,0,0,5],[0,0,0,0,0,3],True),
 (127,0,-1,0,2,[0,0,0,0,0,5],[0,0,0,0,0,3],True),
 (0,2,10,1,2,[1,3,1,0,0,0],[0,3,0,0,0,0],True),
 (0,4,-12,0,2,[1,0,3,1,0,0],[0,0,3,0,0,0],True),
]
positions=[];checked=0;max_error=0
for i,(a,h,s,e,r,counts,locks,verify) in enumerate(cases):
    args=[str(ROOT/'model-school/generate'),'--query',str(ROOT),a,h,s,e,r,*counts,*locks]
    actions=json.loads(subprocess.check_output(list(map(str,args))))
    if verify:
        oracle=Oracle(get,a,h,s)
        expected={key(x):x['ev'] for x in oracle.actions(tuple(counts),tuple(locks),r,e)}
        actual={key(x):x['ev'] for x in actions}
        assert actual.keys()==expected.keys(),(i,actual.keys(),expected.keys())
        error=max(abs(actual[k]-expected[k]) for k in actual)
        assert error<2e-10,(i,error)
        max_error=max(max_error,error);checked+=1
        oracle.value.cache_clear()
    actions.sort(key=lambda x:(-x['ev'],key(x)))
    positions.append(dict(id=f'school-{i+1}',state=dict(mask=a|(h<<7),standardMask=a,schoolRemaining=h,schoolSum=s,extra=e,roll=r,counts=counts,locked=locks),ev=actions[0]['ev'],actions=actions,independentlyVerified=verify))
meta.update(sha256=hashlib.sha256(raw).hexdigest(),generator='model-school/generate.cpp',floatFormat='IEEE-754 binary64',valueSemantics='Future points minus future fourth-roll cost plus terminal school bonus; excludes all past points and costs',standardBaseline='All 256 H=0,s=0 values equal values.json exactly (binary64)',fixtureOracle='Independent recursive ordered-dice expectimax on permanent holds')
(ROOT/'school-model.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
(ROOT/'school-fixtures.json').write_text(json.dumps(dict(version=1,source='Exact C++ LUT and current-turn Bellman DP',independentlyVerifiedPositions=checked,maxAbsoluteOracleError=max_error,positions=positions),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(positions=len(positions),independent=checked,maxError=max_error,sha256=meta['sha256'],startValue=meta['startValue'])))
