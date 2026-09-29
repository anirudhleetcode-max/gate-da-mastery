"""Independent adjudication check for GATE DA 2024 S1 Q14 (DFS edge classification).

Undirected DFS (CLRS style, white/gray/black). An undirected edge is classified
the FIRST time it is scanned, by the colour of the far endpoint:
  white -> tree, gray -> back, black -> 'black' (should never happen: asserted).
For every edge first scanned x->y we record the class, and test two readings of d[.]:
  SP   : d = BFS shortest-path length from s   (literal stem)
  DISC : d = DFS discovery timestamp           (CLRS DFS notation d[u] / u.d)
"""
import itertools, random, sys, time
from collections import deque, Counter
from multiprocessing import Pool

sys.setrecursionlimit(10000)

def bfs(adj, s):
    n = len(adj); d = [-1] * n; d[s] = 0; q = deque([s])
    while q:
        x = q.popleft()
        for y in adj[x]:
            if d[y] < 0:
                d[y] = d[x] + 1; q.append(y)
    return d

def dfs_first_scans(adj, s):
    """Return list of (x, y, cls) for each edge, x->y being its first-scan direction,
    plus discovery times."""
    n = len(adj)
    color = [0] * n       # 0 white, 1 gray, 2 black
    disc = [0] * n
    seen = set()
    out = []
    t = [0]
    def visit(x):
        color[x] = 1; t[0] += 1; disc[x] = t[0]
        for y in adj[x]:
            e = (x, y) if x < y else (y, x)
            if e in seen:
                continue
            seen.add(e)
            c = color[y]
            if c == 0:
                out.append((x, y, 'tree')); visit(y)
            elif c == 1:
                out.append((x, y, 'back'))
            else:
                out.append((x, y, 'black'))
        color[x] = 2
    visit(s)
    return out, disc

def connected(n, edges):
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b); adj[b].append(a)
    return all(x >= 0 for x in bfs(adj, 0)), adj

# ---------------------------------------------------------------- (a) counterexample
def check_counterexample():
    names = ['s', 'a', 'u', 'v', 'w']
    idx = {c: i for i, c in enumerate(names)}
    lists = {'s': ['a', 'u'], 'a': ['s', 'v'], 'u': ['s', 'w', 'v'],
             'v': ['a', 'w', 'u'], 'w': ['v', 'u']}
    adj = [[idx[y] for y in lists[x]] for x in names]
    d = bfs(adj, 0)
    scans, disc = dfs_first_scans(adj, 0)
    trace = [(names[x], names[y], c) for x, y, c in scans]
    uv = [t for t in trace if {t[0], t[1]} == {'u', 'v'}][0]
    dd = {names[i]: d[i] for i in range(5)}
    ok = uv == ('u', 'v', 'back') and dd['u'] < dd['v']
    # verifier's variant (u scans s, v, w)
    lists2 = dict(lists); lists2['u'] = ['s', 'v', 'w']
    adj2 = [[idx[y] for y in lists2[x]] for x in names]
    scans2, _ = dfs_first_scans(adj2, 0)
    uv2 = [(names[x], names[y], c) for x, y, c in scans2 if {names[x], names[y]} == {'u', 'v'}][0]
    return {'d': dd, 'first_scans': trace, 'uv': uv, 'verified': ok, 'verifier_variant_uv': uv2}

# ---------------------------------------------------------------- (b)/(c) exhaustive
def run_graph(args):
    n, edges = args
    ok, adj = connected(n, edges)
    if not ok:
        return None
    d = bfs(adj, 0)
    perms = [list(itertools.permutations(adj[v])) for v in range(n)]
    c = Counter()
    for orders in itertools.product(*perms):
        scans, disc = dfs_first_scans([list(o) for o in orders], 0)
        c['orders'] += 1
        run_back = False
        for x, y, cls in scans:
            assert cls != 'black', 'black far end on first scan'
            if d[x] < d[y]:
                assert d[y] == d[x] + 1
                c['sp_' + cls] += 1
                if cls == 'back':
                    run_back = True
            if disc[x] < disc[y]:
                c['disc_' + cls] += 1
            # DFS-tree-depth reading is equivalent to discovery-order for ancestors; skip
        if run_back:
            c['orders_with_sp_back'] += 1
    c['graphs'] = 1
    c['graphs_with_sp_back'] = 1 if c['orders_with_sp_back'] else 0
    return c

def exhaustive(n, pool):
    V = range(n); E = list(itertools.combinations(V, 2))
    jobs = []
    for mask in range(1 << len(E)):
        edges = [E[i] for i in range(len(E)) if mask >> i & 1]
        jobs.append((n, edges))
    tot = Counter()
    for r in pool.imap_unordered(run_graph, jobs, chunksize=4):
        if r is not None:
            tot.update(r)
    return dict(tot)

# ---------------------------------------------------------------- random sample n=6..8
def random_sample(seed, trials):
    rng = random.Random(seed)
    tot = Counter()
    for _ in range(trials):
        n = rng.randint(6, 8)
        E = [e for e in itertools.combinations(range(n), 2) if rng.random() < rng.choice([0.3, 0.5, 0.7])]
        ok, adj = connected(n, E)
        if not ok:
            continue
        d = bfs(adj, 0)
        for v in range(n):
            rng.shuffle(adj[v])
        scans, disc = dfs_first_scans(adj, 0)
        tot['runs'] += 1
        for x, y, cls in scans:
            assert cls != 'black'
            if d[x] < d[y]:
                tot['sp_' + cls] += 1
            if disc[x] < disc[y]:
                tot['disc_' + cls] += 1
    return dict(tot)

if __name__ == '__main__':
    t0 = time.time()
    ce = check_counterexample()
    print('(a) counterexample:', ce)
    res = {}
    with Pool(4) as pool:
        for n in range(1, 6):
            res[n] = exhaustive(n, pool)
            print(f'(b/c) n={n}:', res[n], f'[{time.time()-t0:.1f}s]', flush=True)
    samp = Counter()
    for s in range(4):
        samp.update(random_sample(s, 25000))
    print('random n=6..8:', dict(samp), f'[{time.time()-t0:.1f}s]')
    smallest = min((n for n in res if res[n].get('sp_back', 0) > 0), default=None)
    print('smallest n with SP back outcome:', smallest)
