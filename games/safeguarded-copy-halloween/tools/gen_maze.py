#!/usr/bin/env python3
"""Generate and verify 21x21 mazes for the Safeguarded Copy game.

Rules (the same ones the original board was built to): mirror symmetric,
one-tile corridors on the odd lattice (even/even cells are always wall), no
open 2x2 area, every open cell has at least two exits except the nook above
the pen door, the side tunnel on row 9, and the centre pen block kept exactly
as the original.  Usage:

  python3 gen_maze.py verify            # check the built-in boards
  python3 gen_maze.py gen <seed> [n]    # print n new boards as JS string rows
"""
import random, sys

ORIGINAL = [
    "XXXXXXXXXXXXXXXXXXXXX",
    "Xo....X...X...X....oX",
    "X.XXX.X.X.X.X.X.XXX.X",
    "X...X...X.X.X...X...X",
    "XXX.X.XXX.X.XXX.X.XXX",
    "X.....X...X...X.....X",
    "X.XXX.X.XXXXX.X.XXX.X",
    "X.....X.......X.....X",
    "XXX.X.XXXX.XXXX.X.XXX",
    " .......XX=XX....... ",
    "X.X.XXX._____.XXX.X.X",
    "X.X.....XXXXX.....X.X",
    "X.XXXXX.XXXXX.XXXXX.X",
    "X.....X...P...X.....X",
    "XXX.X.XXX.X.XXX.X.XXX",
    "X.....X.......X.....X",
    "X.XXXXX.XXXXX.XXXXX.X",
    "X.X...X...X...X...X.X",
    "X.X.X.XXX.X.XXX.X.X.X",
    "Xo..X.....X.....X..oX",
    "XXXXXXXXXXXXXXXXXXXXX",
]
R = C = 21
TUNNEL = 9
# centre block kept verbatim: rows 8..15, cols 7..13 (pen, door, exit nook, player start)
FR, FC = range(8, 16), range(7, 14)
OPEN = set(".o P_=")  # cells the player can stand on or that are not wall

def is_open(m, r, c):
    return m[r][c % C] != 'X'

def walkable(m, r, c):
    """open for the player: not wall, pen or door"""
    ch = m[r][c % C]
    return ch not in 'X_='

def verify(m):
    errs = []
    if len(m) != R or any(len(r) != C for r in m): return ["not 21x21"]
    for r in range(R):
        if m[r] != m[r][::-1]: errs.append(f"row {r} not symmetric")
    for r in range(R):
        for c in range(C):
            if r % 2 == 0 and c % 2 == 0 and m[r][c] != 'X' and not (r in FR and c in FC) and not (r == TUNNEL and c in (0, C-1)):
                errs.append(f"even/even cell ({r},{c}) open")
    for r in FR:
        for c in FC:
            if m[r][c] != ORIGINAL[r][c]: errs.append(f"centre block differs at ({r},{c})")
    if m[TUNNEL][0] != ' ' or m[TUNNEL][C-1] != ' ': errs.append("tunnel row ends must be open")
    # no 2x2 open
    for r in range(R-1):
        for c in range(C-1):
            if all(walkable(m, rr, cc) for rr in (r, r+1) for cc in (c, c+1)):
                errs.append(f"2x2 open at ({r},{c})")
    # connectivity + degree
    cells = [(r, c) for r in range(R) for c in range(C) if walkable(m, r, c)]
    def nbrs(r, c):
        out = []
        for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
            rr, cc = r+dr, c+dc
            if r == TUNNEL and (cc < 0 or cc >= C): cc %= C
            if 0 <= rr < R and 0 <= cc < C and walkable(m, rr, cc): out.append((rr, cc))
        return out
    seen = {cells[0]}; st = [cells[0]]
    while st:
        cur = st.pop()
        for n in nbrs(*cur):
            if n not in seen: seen.add(n); st.append(n)
    if len(seen) != len(cells): errs.append(f"disconnected: {len(cells)-len(seen)} unreachable cells")
    nook = (8, 10)
    for (r, c) in cells:
        if (r, c) != nook and len(nbrs(r, c)) < 2: errs.append(f"dead end at ({r},{c})")
    if m[1][1] != 'o' or m[19][1] != 'o': errs.append("corner lanterns missing")
    # the top and bottom halves must join in plenty of places, not just the tunnel row's far ends
    up = sum(1 for c in range(C) if walkable(m, 8, c)); down = sum(1 for c in range(C) if walkable(m, 10, c))
    if up < 5: errs.append(f"only {up} crossings on row 8 (need 5)")
    if down < 5: errs.append(f"only {down} crossings on row 10 (need 5)")
    return errs

def generate(seed):
    rng = random.Random(seed)
    g = [['X'] * C for _ in range(R)]
    for r in FR:
        for c in FC: g[r][c] = ORIGINAL[r][c]
    g[TUNNEL][0] = g[TUNNEL][C-1] = ' '
    fixed = lambda r, c: r in FR and c in FC
    # nodes: odd/odd cells not inside the fixed block, left half incl. col 9; the tunnel row's
    # outer nodes (9,1) attach to the wrap cell (9,0)
    nodes = [(r, c) for r in range(1, R, 2) for c in range(1, 10, 2) if not fixed(r, c)]
    for r, c in nodes: g[r][c] = '.'; g[r][C-1-c] = '.'
    def mirror(c): return C-1-c
    def carve(r, c):
        g[r][c] = '.'; g[r][mirror(c)] = '.'
    # candidate edges between lattice nodes (left half); an edge at col 10 joins (r,9) to its mirror
    edges = []
    for r, c in nodes:
        for dr, dc in ((0, 2), (2, 0)):
            rr, cc = r+dr, c+dc
            er, ec = r+dr//2, c+dc//2
            if rr >= R or cc > 10: continue
            if fixed(er, ec): continue
            if cc == 11: continue
            # neighbour must be a node, a fixed open cell, or (for cc==10) the axis
            if cc == 10:
                edges.append(((r, c), (r, 11), (er, ec)))            # axis link to the mirror
            elif fixed(rr, cc):
                if ORIGINAL[rr][cc] not in 'X_=': edges.append(((r, c), (rr, cc), (er, ec)))
            elif (rr, cc) in set(nodes):
                edges.append(((r, c), (rr, cc), (er, ec)))
    # union-find over full-board cells so symmetric carving keeps a single component
    parent = {}
    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    def union(a, b): parent[find(a)] = find(b)
    # fixed block open cells are pre-joined
    fixed_open = [(r, c) for r in FR for c in FC if ORIGINAL[r][c] not in 'X_=']
    for i in range(1, len(fixed_open)): union(fixed_open[0], fixed_open[i])
    # tunnel: (9,1) ~ (9,0) ~ (9,20) ~ (9,19): join through the wrap
    union((9, 1), (9, 19))
    carve(7, 10); union((7, 9), (7, 11)); union((7, 9), (8, 10))
    rng.shuffle(edges)
    def mr(p): return (p[0], mirror(p[1]))
    def add_edge(e):
        a, b, cell = e
        carve(*cell); union(a, b); union(mr(a), mr(b)); union(a, mr(a)) if cell[1] == 10 else None
    # spanning phase
    rest = []
    for e in edges:
        a, b, cell = e
        if find(a) != find(b): add_edge(e)
        else: rest.append(e)
    # braid phase: kill dead ends by adding a spare edge at each degree-1 node
    def deg(r, c):
        d = 0
        for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
            rr, cc = r+dr, c+dc
            if r == TUNNEL and (cc < 0 or cc >= C): cc %= C
            if 0 <= rr < R and g[rr][cc] not in 'X_=': d += 1
        return d
    changed = True
    while changed:
        changed = False
        for r, c in nodes + fixed_open:
            if (r, c) == (8, 10) or deg(r, c) >= 2: continue
            opts = [e for e in rest if (e[0] == (r, c) or e[1] == (r, c)) and g[e[2][0]][e[2][1]] == 'X']
            if not opts: continue
            e = rng.choice(opts); add_edge(e); rest.remove(e); changed = True
    # extra loops so it isn't tree-like; keep corridors 1-wide by construction
    for e in rest:
        if rng.random() < 0.18 and g[e[2][0]][e[2][1]] == 'X': add_edge(e)
    g[1][1] = g[1][C-2] = g[19][1] = g[19][C-2] = 'o'
    return [''.join(row) for row in g]

def js(rows): return ',\n'.join(f'    "{r}"' for r in rows)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'verify'
    if cmd == 'verify':
        errs = verify(ORIGINAL); print('original:', 'ok' if not errs else errs)
        bad = ORIGINAL[:]; bad[3] = "X...X...X.X.X...X...X".replace("X...X", "X..XX", 1)
        print('broken copy rejected:', bool(verify(bad)))
        sys.exit(1 if errs else 0)
    if cmd == 'verify-game':      # check the boards embedded in ../index.html
        import re, os
        src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'index.html')).read()
        bad = 0
        for name, body in re.findall(r"name:'([^']+)'[\s\S]*?map:\[([\s\S]*?)\]", src):
            rows = re.findall(r'"([^"]+)"', body)
            errs = verify(rows); print(name + ':', 'ok' if not errs else errs); bad += bool(errs)
        sys.exit(1 if bad else 0)
    if cmd == 'gen':
        seed = int(sys.argv[2]); n = int(sys.argv[3]) if len(sys.argv) > 3 else 1
        out, s = [], seed
        while len(out) < n:
            m = generate(s); s += 1
            if not verify(m) and m not in out and m != ORIGINAL: out.append((s-1, m))
        for sd, m in out: print(f'  // seed {sd}\n{js(m)}\n')
