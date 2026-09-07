"""Independent readable rules and recursive turn oracle. No geometry DP imports."""
from collections import Counter
from functools import lru_cache
from itertools import product
from math import factorial

def bonus(s):
    return -30 if s<0 else 0 if s<=10 else 30

def school_score(n,m,roll):
    if n not in range(1,7) or m not in range(6) or roll not in range(1,5):
        raise ValueError('invalid school score arguments')
    return n*(m-3)+(n if roll==1 and m>=3 else 0)

def standard_score(counts,c,roll):
    faces=[i+1 for i,k in enumerate(counts) for _ in range(k)]
    v=Counter(faces); points=0
    if c in (0,2,5,6):
        n={0:2,2:3,5:4,6:5}[c]
        points=max([n*x for x in v if v[x]>=n] or [0])
    elif c in (1,4):
        n=2 if c==1 else 3
        points=max([n*a+2*b for a in v for b in v if v[a]>=n and v[b]>=2 and (a!=b or v[a]>=n+2)] or [0])
    elif c==3:
        points=sum(faces) if sorted(faces) in ([1,2,3,4,5],[2,3,4,5,6]) else 0
    else: raise ValueError('category')
    return points*(2 if roll==1 else 1)+(50 if c==6 and points else 0)

def declarations(counts,mask,roll):
    out=[]
    for c in range(13):
        if not mask>>c&1: continue
        if c<7:
            out.append((c,0))
            q=standard_score(counts,c,roll)
            if q: out.append((c,q))
        else: out.append((c,school_score(c-6,counts[c-7],roll)))
    return out

@lru_cache(None)
def outcomes(n):
    # Enumerate ordered elementary outcomes independently, then compress only
    # identical count vectors. Unlike production no (hold,total) graph exists.
    freq=Counter()
    for dice in product(range(6),repeat=n):
        v=[0]*6
        for x in dice:v[x]+=1
        freq[tuple(v)]+=1
    return tuple((c,k/(6**n)) for c,k in freq.items())

class Oracle:
    def __init__(self,get,a,h,s):
        self.get=get;self.a=a;self.h=h;self.s=s
    def stop(self,counts,r,e):
        out=[]
        for c,q in declarations(counts,self.a|(self.h<<7),r):
            ev=q+(self.get(self.a^(1<<c),self.h,self.s,e) if c<7 else self.get(self.a,self.h^(1<<(c-7)),self.s+q,e))
            out.append(dict(type='score',category=c,points=q,ev=ev))
        return out
    @lru_cache(None)
    def value(self,counts,locked,r,e):
        return max(x['ev'] for x in self.actions(counts,locked,r,e))
    def actions(self,counts,locked,r,e):
        out=self.stop(counts,r,e)
        if r<3 or (r==3 and e):
            for keep in product(*(range(locked[j],counts[j]+1) for j in range(6))):
                n=5-sum(keep)
                if n==0: continue
                ev=sum(p*self.value(tuple(keep[j]+v[j] for j in range(6)),keep,r+1,0 if r==3 else e) for v,p in outcomes(n))-(10 if r==3 else 0)
                out.append(dict(type='reroll',hold=list(keep),ev=ev))
        return out
