# Check: on a first scan x->y with y gray, y is a proper ancestor of x (not its parent) -> back, never cross.
import random, itertools
from q14_adjudicate import connected
def run(adj, s):
    n=len(adj); color=[0]*n; par=[-1]*n; seen=set(); bad=0; backs=0
    def anc(y,x):
        z=par[x]
        while z!=-1:
            if z==y: return True
            z=par[z]
        return False
    def visit(x):
        nonlocal bad, backs
        color[x]=1
        for y in adj[x]:
            e=(min(x,y),max(x,y))
            if e in seen: continue
            seen.add(e)
            if color[y]==0: par[y]=x; visit(y)
            elif color[y]==1:
                backs+=1
                if not anc(y,x) or par[x]==y: bad+=1
            else: bad+=1
        color[x]=2
    visit(s); return bad, backs
rng=random.Random(7); B=0; K=0; R=0
for _ in range(200000):
    n=rng.randint(3,8)
    E=[e for e in itertools.combinations(range(n),2) if rng.random()<0.5]
    ok,adj=connected(n,E)
    if not ok: continue
    for v in range(n): rng.shuffle(adj[v])
    b,k=run(adj,0); B+=b; K+=k; R+=1
print('runs',R,'gray-far-end first scans',K,'violations (not proper non-parent ancestor, or black)',B)
