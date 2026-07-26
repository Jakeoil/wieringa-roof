// BFS edge-unfolding of Wieringa roof patches.
//
// Does not use assignIndicesFromPentagrid — that formula is only valid at one
// generation. Instead the lift is derived from first principles: each planar
// edge is matched to one of the five directions ζ^j, every vertex gets an
// integer vector n ∈ Z^5 by BFS, and the 3D position is Σ n_j E_j.
//
//   node tools/bfs-unfold.mjs [--side=20] [--gen=2]

import { seedTypes, generatePatch, allRhombs } from "../dist/geometry.js";

const SQRT5 = Math.sqrt(5);
const EPS = 1e-6;

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    }),
);
const SIDE_MM = Number(args.side ?? 20);
const GEN = Number(args.gen ?? 2);

// Letter, 0.5" margins
const PAGE_W = 190.5;
const PAGE_H = 254.0;

// ── the five icosahedral generators ───────────────────────────────

const E = [];
for (let j = 0; j < 5; j++) {
    const t = (2 * Math.PI * j) / 5;
    E.push([
        (2 / SQRT5) * Math.cos(t),
        (2 / SQRT5) * Math.sin(t),
        1 / SQRT5,
    ]);
}

const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm(a) {
        const l = this.len(a);
        return [a[0] / l, a[1] / l, a[2] / l];
    },
    cross: (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ],
};

// ── planar topology ───────────────────────────────────────────────

function buildTopology(rhombs) {
    const vkey = (pt) => `${Math.round(pt.x * 1e4)},${Math.round(pt.y * 1e4)}`;
    const vid = new Map();
    const vpos = [];
    const getV = (pt) => {
        const k = vkey(pt);
        if (!vid.has(k)) {
            vid.set(k, vpos.length);
            vpos.push([pt.x, pt.y]);
        }
        return vid.get(k);
    };

    const faces = rhombs.map((r) => ({
        id: r.id,
        thick: r.thick,
        v: r.verts.map(getV),
    }));

    // edge -> faces
    const edges = new Map();
    const ekey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    for (const f of faces) {
        for (let i = 0; i < 4; i++) {
            const a = f.v[i];
            const b = f.v[(i + 1) % 4];
            const k = ekey(a, b);
            if (!edges.has(k)) edges.set(k, { a, b, faces: [] });
            edges.get(k).faces.push(f.id);
        }
    }
    return { faces, vpos, edges, ekey };
}

// ── match planar edges to the five directions ─────────────────────

function classifyDirections(vpos, edges) {
    let L = 0;
    for (const e of edges.values()) {
        L += Math.hypot(
            vpos[e.b][0] - vpos[e.a][0],
            vpos[e.b][1] - vpos[e.a][1],
        );
    }
    L /= edges.size;

    // collect distinct undirected directions
    const dirs = [];
    for (const e of edges.values()) {
        let dx = vpos[e.b][0] - vpos[e.a][0];
        let dy = vpos[e.b][1] - vpos[e.a][1];
        const l = Math.hypot(dx, dy);
        dx /= l;
        dy /= l;
        if (dy < -EPS || (Math.abs(dy) <= EPS && dx < 0)) {
            dx = -dx;
            dy = -dy;
        }
        let ang = Math.atan2(dy, dx);
        if (!dirs.some((d) => Math.abs(d - ang) < 1e-3)) dirs.push(ang);
    }
    dirs.sort((a, b) => a - b);
    if (dirs.length !== 5) {
        throw new Error(`expected 5 edge directions, found ${dirs.length}`);
    }

    // The collected representatives are UNDIRECTED (forced to y >= 0), and as
    // undirected lines they sit 36° apart, not 72°. Two of them are therefore
    // the negatives of the true ζ^j — using them as-is silently negates two
    // components of n. So rebuild the five DIRECTED generators as a 72°-spaced
    // fan from one representative; edgeDirection then resolves ± itself.
    //
    // Which representative seeds the fan only relabels j (j -> j+c or -j),
    // which is a rotation/reflection of the 3D frame: heights and dihedrals
    // are unaffected because every E_j shares the same z.
    const theta0 = dirs[0];
    const directed = [];
    for (let j = 0; j < 5; j++) directed.push(theta0 + (2 * Math.PI * j) / 5);
    return { L, dirs: directed };
}

function edgeDirection(vpos, a, b, L, dirs) {
    const dx = vpos[b][0] - vpos[a][0];
    const dy = vpos[b][1] - vpos[a][1];
    const l = Math.hypot(dx, dy);
    for (let j = 0; j < 5; j++) {
        const ux = Math.cos(dirs[j]);
        const uy = Math.sin(dirs[j]);
        const d = (dx * ux + dy * uy) / l;
        if (Math.abs(d - 1) < 1e-4) return { j, s: +1, L: l };
        if (Math.abs(d + 1) < 1e-4) return { j, s: -1, L: l };
    }
    throw new Error("edge matches no direction");
}

// Guard the labelling: a thick rhomb must span generators |Δj| = 1, a thin
// rhomb |Δj| = 2. If this trips, the direction→generator map is wrong.
function checkLabelling(faces, vpos, L, dirs) {
    let bad = 0;
    for (const f of faces) {
        const j0 = edgeDirection(vpos, f.v[0], f.v[1], L, dirs).j;
        const j1 = edgeDirection(vpos, f.v[1], f.v[2], L, dirs).j;
        const d = Math.min(Math.abs(j0 - j1), 5 - Math.abs(j0 - j1));
        if (f.thick ? d !== 1 : d !== 2) bad++;
    }
    if (bad) throw new Error(`${bad}/${faces.length} rhombi mislabelled`);
}

// ── lift: assign n ∈ Z^5 per vertex, then Σ n_j E_j ───────────────

function lift(vpos, edges, L, dirs) {
    const adj = new Map();
    for (const e of edges.values()) {
        if (!adj.has(e.a)) adj.set(e.a, []);
        if (!adj.has(e.b)) adj.set(e.b, []);
        adj.get(e.a).push(e.b);
        adj.get(e.b).push(e.a);
    }

    const n = new Array(vpos.length).fill(null);
    let conflicts = 0;
    const start = 0;
    n[start] = [0, 0, 0, 0, 0];
    const q = [start];
    while (q.length) {
        const v = q.shift();
        for (const w of adj.get(v) ?? []) {
            const { j, s } = edgeDirection(vpos, v, w, L, dirs);
            const cand = n[v].slice();
            cand[j] += s;
            if (n[w] === null) {
                n[w] = cand;
                q.push(w);
            } else if (n[w].some((x, i) => x !== cand[i])) {
                conflicts++;
            }
        }
    }
    const unreached = n.filter((x) => x === null).length;

    // consistency: does Σ n_j u_j reproduce the planar position?
    let maxErr = 0;
    for (let v = 0; v < vpos.length; v++) {
        if (!n[v]) continue;
        let x = 0;
        let y = 0;
        for (let j = 0; j < 5; j++) {
            x += n[v][j] * Math.cos(dirs[j]) * L;
            y += n[v][j] * Math.sin(dirs[j]) * L;
        }
        const dx = x - (vpos[v][0] - vpos[start][0]);
        const dy = y - (vpos[v][1] - vpos[start][1]);
        maxErr = Math.max(maxErr, Math.hypot(dx, dy) / L);
    }

    const P = n.map((nv) => {
        if (!nv) return null;
        let acc = [0, 0, 0];
        for (let j = 0; j < 5; j++) acc = v3.add(acc, v3.mul(E[j], nv[j]));
        return acc;
    });
    const index = n.map((nv) => (nv ? nv.reduce((a, b) => a + b, 0) : null));
    return { n, P, index, conflicts, unreached, maxErr };
}

// ── unfolding ─────────────────────────────────────────────────────

function placeSeed(face, P) {
    const [A, B, C, D] = face.v.map((i) => P[i]);
    const ex = v3.norm(v3.sub(B, A));
    let ey = v3.sub(D, A);
    ey = v3.sub(ey, v3.mul(ex, v3.dot(ey, ex)));
    ey = v3.norm(ey);
    const to2 = (X) => {
        const d = v3.sub(X, A);
        return [v3.dot(d, ex), v3.dot(d, ey)];
    };
    return [to2(A), to2(B), to2(C), to2(D)];
}

// place P given |P-A|, |P-B| and net positions a,b; side chosen away from `ref`
function trilaterate(a, b, dA, dB, ref) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    const ex = [dx / d, dy / d];
    const ey = [-ex[1], ex[0]];
    const x = (dA * dA - dB * dB + d * d) / (2 * d);
    const y2 = Math.max(0, dA * dA - x * x);
    const y = Math.sqrt(y2);
    const sideRef = (ref[0] - a[0]) * ey[0] + (ref[1] - a[1]) * ey[1];
    const sgn = sideRef > 0 ? -1 : +1;
    return [
        a[0] + ex[0] * x + ey[0] * sgn * y,
        a[1] + ex[1] * x + ey[1] * sgn * y,
    ];
}

const centroid = (poly) => [
    poly.reduce((s, q) => s + q[0], 0) / poly.length,
    poly.reduce((s, q) => s + q[1], 0) / poly.length,
];

function shrink(poly, f) {
    const c = centroid(poly);
    return poly.map((q) => [c[0] + (q[0] - c[0]) * f, c[1] + (q[1] - c[1]) * f]);
}

function convexOverlap(p1, p2) {
    for (const poly of [p1, p2]) {
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const ax = -(b[1] - a[1]);
            const ay = b[0] - a[0];
            let min1 = Infinity;
            let max1 = -Infinity;
            let min2 = Infinity;
            let max2 = -Infinity;
            for (const q of p1) {
                const v = q[0] * ax + q[1] * ay;
                min1 = Math.min(min1, v);
                max1 = Math.max(max1, v);
            }
            for (const q of p2) {
                const v = q[0] * ax + q[1] * ay;
                min2 = Math.min(min2, v);
                max2 = Math.max(max2, v);
            }
            if (max1 < min2 || max2 < min1) return false;
        }
    }
    return true;
}

// Place `face` across shared edge (ea,eb) already placed in `hostPoly`.
function placeAcross(face, P, ea, eb, hostPoly, hostVerts) {
    const i = face.v.indexOf(ea);
    const jj = face.v.indexOf(eb);
    if (i < 0 || jj < 0) return null;
    // walk the face cycle starting at ea so that eb is next
    const order =
        face.v[(i + 1) % 4] === eb
            ? [0, 1, 2, 3].map((k) => face.v[(i + k) % 4])
            : [0, 1, 2, 3].map((k) => face.v[(i - k + 4) % 4]);
    const [A, B, C, D] = order;

    const hi = hostVerts.indexOf(A);
    const hj = hostVerts.indexOf(B);
    const a = hostPoly[hi];
    const b = hostPoly[hj];
    const ref = centroid(hostPoly);

    const dist = (u, w) => v3.len(v3.sub(P[u], P[w]));
    const c = trilaterate(a, b, dist(C, A), dist(C, B), ref);
    const d = trilaterate(a, b, dist(D, A), dist(D, B), ref);
    return { poly: [a, b, c, d], verts: [A, B, C, D] };
}

function unfold(faces, edges, P, ekey, firstSeed = null) {
    const byId = new Map(faces.map((f) => [f.id, f]));
    const neighbours = new Map(faces.map((f) => [f.id, []]));
    for (const e of edges.values()) {
        if (e.faces.length !== 2) continue;
        neighbours.get(e.faces[0]).push({ other: e.faces[1], a: e.a, b: e.b });
        neighbours.get(e.faces[1]).push({ other: e.faces[0], a: e.a, b: e.b });
    }

    const placed = new Map(); // faceId -> {poly, verts, net}
    const nets = [];
    const remaining = new Set(faces.map((f) => f.id));

    while (remaining.size) {
        // seed: the remaining face with most already-unplaced neighbours is a
        // poor heuristic; use the most central remaining face instead.
        let seedId = null;
        if (nets.length === 0 && firstSeed !== null && remaining.has(firstSeed)) {
            seedId = firstSeed;
        } else {
            let best = Infinity;
            for (const id of remaining) {
                const f = byId.get(id);
                const c = centroid(f.v.map((i) => [P[i][0], P[i][1]]));
                const r = Math.hypot(c[0], c[1]);
                if (r < best) {
                    best = r;
                    seedId = id;
                }
            }
        }

        const netId = nets.length;
        const net = { id: netId, faces: [] };
        nets.push(net);

        const seed = byId.get(seedId);
        const poly = placeSeed(seed, P);
        placed.set(seedId, { poly, verts: seed.v.slice(), net: netId });
        net.faces.push(seedId);
        remaining.delete(seedId);

        const q = [seedId];
        const rejected = [];
        while (q.length) {
            const cur = q.shift();
            const host = placed.get(cur);
            for (const nb of neighbours.get(cur)) {
                if (!remaining.has(nb.other)) continue;
                const cand = placeAcross(
                    byId.get(nb.other),
                    P,
                    nb.a,
                    nb.b,
                    host.poly,
                    host.verts,
                );
                if (!cand) continue;
                const test = shrink(cand.poly, 0.94);
                let clash = false;
                for (const fid of net.faces) {
                    if (fid === cur) continue;
                    if (convexOverlap(test, shrink(placed.get(fid).poly, 0.94))) {
                        clash = true;
                        break;
                    }
                }
                if (clash) {
                    rejected.push(nb.other);
                    continue;
                }
                placed.set(nb.other, { ...cand, net: netId });
                net.faces.push(nb.other);
                remaining.delete(nb.other);
                q.push(nb.other);
            }
        }
        net.rejected = rejected.filter((id) => remaining.has(id)).length;
    }
    return { placed, nets };
}

// ── report ────────────────────────────────────────────────────────

function bbox(polys) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const poly of polys)
        for (const q of poly) {
            x0 = Math.min(x0, q[0]);
            y0 = Math.min(y0, q[1]);
            x1 = Math.max(x1, q[0]);
            y1 = Math.max(y1, q[1]);
        }
    return { w: x1 - x0, h: y1 - y0 };
}

function foldAngles(faces, edges, P, placed) {
    const hist = new Map();
    const byId = new Map(faces.map((f) => [f.id, f]));
    for (const e of edges.values()) {
        if (e.faces.length !== 2) continue;
        const [f1, f2] = e.faces.map((id) => byId.get(id));
        const A = P[e.a];
        const B = P[e.b];
        const dir = v3.norm(v3.sub(B, A));
        const off = (f) => {
            const other = f.v.find((v) => v !== e.a && v !== e.b);
            let w = v3.sub(P[other], A);
            w = v3.sub(w, v3.mul(dir, v3.dot(w, dir)));
            return v3.norm(w);
        };
        const w1 = off(f1);
        const w2 = off(f2);
        const dih =
            (Math.acos(Math.max(-1, Math.min(1, v3.dot(w1, w2)))) * 180) /
            Math.PI;
        const key = Math.round(180 - dih);
        hist.set(key, (hist.get(key) ?? 0) + 1);
    }
    return hist;
}

const TARGETS = [
    ["Pe5", "star"],
    ["Pe3", "boat"],
    ["Pe1", "diamond"],
];

console.log(
    `BFS edge-unfolding — gen ${GEN}, side ${SIDE_MM} mm, page ${PAGE_W}×${PAGE_H} mm\n`,
);

for (const [label, nick] of TARGETS) {
    const idx = seedTypes.findIndex((s) => s.label === label);
    generatePatch(idx, true, GEN);
    const rhombs = allRhombs.map((r) => ({
        id: r.id,
        thick: r.thick,
        verts: r.verts,
    }));

    const { faces, vpos, edges, ekey } = buildTopology(rhombs);
    const { L, dirs } = classifyDirections(vpos, edges);
    checkLabelling(faces, vpos, L, dirs);
    const { P, index, conflicts, unreached, maxErr } = lift(
        vpos,
        edges,
        L,
        dirs,
    );

    const interior = [...edges.values()].filter(
        (e) => e.faces.length === 2,
    ).length;

    console.log(`── ${label} (${nick}) ──`);
    console.log(
        `   ${faces.length} rhombi (${faces.filter((f) => f.thick).length}T/` +
            `${faces.filter((f) => !f.thick).length}t), ` +
            `${vpos.length} vertices, ${edges.size} edges (${interior} interior)`,
    );

    const idxHist = {};
    for (const i of index) if (i !== null) idxHist[i] = (idxHist[i] ?? 0) + 1;
    const lo = Math.min(...Object.keys(idxHist).map(Number));
    console.log(
        `   lift: conflicts=${conflicts} unreached=${unreached} ` +
            `posErr=${maxErr.toExponential(1)}  ` +
            `index levels ${JSON.stringify(
                Object.fromEntries(
                    Object.entries(idxHist).map(([k, v]) => [k - lo + 1, v]),
                ),
            )}`,
    );

    const fh = foldAngles(faces, edges, P, null);
    console.log(
        `   fold angles: ` +
            [...fh.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([k, v]) => `${k}°×${v}`)
                .join("  "),
    );

    // Try every rhomb as the initial seed and keep the best outcome:
    // fewest nets first, then the largest primary net.
    let bestRun = null;
    for (const f of faces) {
        const run = unfold(faces, edges, P, ekey, f.id);
        const primary = Math.max(...run.nets.map((n) => n.faces.length));
        const score = [run.nets.length, -primary];
        if (
            !bestRun ||
            score[0] < bestRun.score[0] ||
            (score[0] === bestRun.score[0] && score[1] < bestRun.score[1])
        ) {
            bestRun = { ...run, score, seed: f.id };
        }
    }
    const { placed, nets } = bestRun;
    console.log(`   nets: ${nets.length}  (best of ${faces.length} seeds, seed #${bestRun.seed})`);
    for (const net of nets) {
        const polys = net.faces.map((id) => placed.get(id).poly);
        const bb = bbox(polys);
        const wmm = bb.w * SIDE_MM;
        const hmm = bb.h * SIDE_MM;
        const fitsUp = wmm <= PAGE_W && hmm <= PAGE_H;
        const fitsRot = hmm <= PAGE_W && wmm <= PAGE_H;
        console.log(
            `     net ${net.id}: ${net.faces.length} rhombi, ` +
                `${wmm.toFixed(0)}×${hmm.toFixed(0)} mm  ` +
                `${fitsUp ? "fits" : fitsRot ? "fits (rotated)" : "TOO BIG"}`,
        );
    }
    console.log("");
}
