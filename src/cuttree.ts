// Branch-cut routing.
//
// The three older methods grow regions greedily and start a new piece whenever a
// placement collides, so how many pieces you get is an outcome rather than a
// choice. It need not be. Measured across every patch, with no deviation:
//
//     E_int = V_int + F − 1        so a one-piece net cuts exactly V_int edges
//
// which is the classical cut-tree duality. Contract the whole boundary to a single
// node R and a one-piece net is precisely a **spanning tree of the vertex graph**
// rooted at R. Every interior vertex must carry a cut — the faces around it form a
// cycle in the dual and a forest has none — and the tree's branches run from
// interior vertices out to the boundary. They are branch cuts in the sense of log
// and √: the cut is what makes the multivalued thing single-valued.
//
// So connectivity is guaranteed by construction and the only remaining problem is
// overlap. That turns the search from "grow and give up" into "choose a spanning
// tree", which is a far better shaped problem: every candidate is already a valid
// one-piece net, and the search can be graded by overlap count rather than by a
// yes/no.

import { allRhombs, vertexList, edgeMap } from "./geometry.js";
import {
    intersectionArea,
    FACE_AREA,
    AREA_EPS,
    analyzePatch,
    placeSeed,
    placeAcross,
    ekey,
} from "./unfold.js";
import type {
    Analysis,
    Face,
    Placed,
    Piece,
    UnfoldResult,
    TraceEvent,
} from "./unfold.js";

type P2 = [number, number];

// ── overlap counting ──────────────────────────────────────────────
//
// The old sweep is O(n²), which is fine once and hopeless inside a search. Every
// face is a unit rhombus, so a grid of cell size 1 buckets them tightly and only
// same-or-adjacent cells need testing. Counting pairs rather than returning a
// boolean matters: the search needs a gradient to descend.

const CELL = 1.1;

// The overlap test itself lives in unfold.ts and is exact — see the note there on
// why shrinking the polygons first was hiding real overlaps from every method.
//
// Overlaps between *different* pieces are not real: layoutSheets positions every
// piece by its own bounding box, so two pieces that sit on top of each other in
// development coordinates land far apart on paper. Only overlap within a single
// piece survives to the printed sheet, so anything counting pieces must pass
// samePieceOnly.

export function countOverlaps(placed: Map<number, Placed>): number {
    return overlapPairs(placed).length;
}

export function overlapPairs(
    placed: Map<number, Placed>,
    samePieceOnly = false,
): Array<[number, number]> {
    const cells = new Map<number, number[]>();
    const boxes = new Map<number, [number, number, number, number]>();

    for (const p of placed.values()) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const q of p.poly) {
            if (q[0] < x0) x0 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0];
            if (q[1] > y1) y1 = q[1];
        }
        boxes.set(p.faceId, [x0, y0, x1, y1]);
        for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
            for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) {
                const k = (i + 4096) * 8192 + (j + 4096);
                let arr = cells.get(k);
                if (!arr) cells.set(k, (arr = []));
                arr.push(p.faceId);
            }
        }
    }

    const seen = new Set<number>();
    const out: Array<[number, number]> = [];
    for (const bucket of cells.values()) {
        for (let a = 0; a < bucket.length; a++) {
            for (let b = a + 1; b < bucket.length; b++) {
                const i = bucket[a];
                const j = bucket[b];
                const pairKey = i < j ? i * 1e6 + j : j * 1e6 + i;
                if (seen.has(pairKey)) continue;
                seen.add(pairKey);
                const bi = boxes.get(i)!;
                const bj = boxes.get(j)!;
                // cheap reject before the polygon test
                if (bi[2] < bj[0] || bj[2] < bi[0] || bi[3] < bj[1] || bj[3] < bi[1]) {
                    continue;
                }
                if (
                    samePieceOnly &&
                    placed.get(i)!.piece !== placed.get(j)!.piece
                ) {
                    continue;
                }
                if (
                    intersectionArea(
                        placed.get(i)!.poly as P2[],
                        placed.get(j)!.poly as P2[],
                    ) > AREA_EPS
                ) {
                    out.push([i, j]);
                }
            }
        }
    }
    return out;
}

// ── the vertex graph, boundary contracted ─────────────────────────

interface CutGraph {
    node: Map<number, number>; // tiling vertex -> contracted node, boundary = 0
    nodes: number; // 1 + interior vertex count
    arcs: Array<{ key: string; u: number; v: number; a: number; b: number }>;
}

function buildCutGraph(): CutGraph {
    const onBoundary = new Set<number>();
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length === 1) {
            onBoundary.add(e.v1);
            onBoundary.add(e.v2);
        }
    }
    const node = new Map<number, number>();
    let next = 1;
    for (const v of vertexList) {
        node.set(v.id, onBoundary.has(v.id) ? 0 : next++);
    }
    const arcs: CutGraph["arcs"] = [];
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue; // only interior edges are cuttable
        const u = node.get(e.v1)!;
        const v = node.get(e.v2)!;
        // both ends on the boundary is a self-loop at the root: cutting it would
        // sever the patch, and a spanning tree cannot contain it anyway
        if (u === v) continue;
        arcs.push({ key: ekey(e.v1, e.v2), u, v, a: e.v1, b: e.v2 });
    }
    return { node, nodes: next, arcs };
}

// ── spanning trees of that graph = candidate cut sets ─────────────

class DSU {
    p: number[];
    constructor(n: number) {
        this.p = Array.from({ length: n }, (_, i) => i);
    }
    find(x: number): number {
        while (this.p[x] !== x) x = this.p[x] = this.p[this.p[x]];
        return x;
    }
    union(a: number, b: number): boolean {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra === rb) return false;
        this.p[ra] = rb;
        return true;
    }
}

function spanningCutSet(g: CutGraph, weight: (i: number) => number): Set<string> {
    const order = g.arcs.map((_, i) => i).sort((x, y) => weight(x) - weight(y));
    const dsu = new DSU(g.nodes);
    const cuts = new Set<string>();
    for (const i of order) {
        const arc = g.arcs[i];
        if (dsu.union(arc.u, arc.v)) cuts.add(arc.key);
    }
    return cuts;
}

// Distance from the boundary, in edges. The shortest-route tree cuts each interior
// vertex out by its nearest way to the patch edge, which is the natural first guess
// and the most literal reading of "branch cut to the boundary".
function boundaryDistance(g: CutGraph): number[] {
    const adj = new Map<number, number[]>();
    for (const arc of g.arcs) {
        if (!adj.has(arc.u)) adj.set(arc.u, []);
        if (!adj.has(arc.v)) adj.set(arc.v, []);
        adj.get(arc.u)!.push(arc.v);
        adj.get(arc.v)!.push(arc.u);
    }
    const dist = new Array(g.nodes).fill(Infinity);
    dist[0] = 0;
    const q = [0];
    for (let h = 0; h < q.length; h++) {
        for (const w of adj.get(q[h]) ?? []) {
            if (dist[w] === Infinity) {
                dist[w] = dist[q[h]] + 1;
                q.push(w);
            }
        }
    }
    return dist;
}

// ── developing a given cut set ────────────────────────────────────

function developFromCuts(
    A: Analysis,
    cuts: Set<string>,
    trace?: TraceEvent[],
): {
    placed: Map<number, Placed>;
    pieces: number[][];
    hinges: Set<string>;
    parentFace: Map<number, number>;
    parentHinge: Map<number, string>;
} {
    const { faces, P, links } = A;
    const byId = new Map(faces.map((f) => [f.id, f]));
    const hinges = new Set<string>();
    const placed = new Map<number, Placed>();
    const pieces: number[][] = [];
    const parentFace = new Map<number, number>();
    const parentHinge = new Map<number, string>();
    const left = new Set(faces.map((f) => f.id));

    while (left.size) {
        const seedId = left.values().next().value as number;
        const seed = byId.get(seedId)!;
        const mine: number[] = [seedId];
        pieces.push(mine);
        if (trace && pieces.length > 1)
            trace.push({ kind: "newPiece", piece: pieces.length - 1 });
        placed.set(seedId, {
            faceId: seedId,
            thick: seed.thick,
            pair: seed.pair,
            cluster: seed.cluster,
            poly: placeSeed(seed, P),
            verts: seed.v.slice(),
            piece: pieces.length - 1,
        });
        left.delete(seedId);
        if (trace)
            trace.push({
                kind: "seed",
                face: seedId,
                piece: pieces.length - 1,
                poly: placed.get(seedId)!.poly as P2[],
                verts: placed.get(seedId)!.verts,
            });

        const q = [seedId];
        for (let h = 0; h < q.length; h++) {
            const cur = q[h];
            const host = placed.get(cur)!;
            for (const link of links.get(cur) ?? []) {
                if (!left.has(link.other)) continue;
                const key = ekey(link.a, link.b);
                if (cuts.has(key)) continue; // this edge is a branch cut
                const cand = placeAcross(byId.get(link.other)!, P, link.a, link.b, host);
                if (!cand) continue;
                placed.set(link.other, {
                    faceId: link.other,
                    thick: byId.get(link.other)!.thick,
                    pair: byId.get(link.other)!.pair,
                    cluster: byId.get(link.other)!.cluster,
                    poly: cand.poly,
                    verts: cand.verts,
                    piece: pieces.length - 1,
                });
                if (trace)
                    trace.push({
                        kind: "place",
                        face: link.other,
                        from: cur,
                        a: link.a,
                        b: link.b,
                        piece: pieces.length - 1,
                        poly: cand.poly as P2[],
                        verts: cand.verts,
                    });
                hinges.add(key);
                parentFace.set(link.other, cur);
                parentHinge.set(link.other, key);
                mine.push(link.other);
                left.delete(link.other);
                q.push(link.other);
            }
        }
    }
    return { placed, pieces, hinges, parentFace, parentHinge };
}

// Which hinges lie on the dual-tree path between two faces. Cutting any one of
// them is what lets an overlapping pair swing apart — everything else leaves their
// relative placement untouched.
function hingePathBetween(
    x: number,
    y: number,
    parentFace: Map<number, number>,
    parentHinge: Map<number, string>,
): string[] {
    const upX = new Map<number, string>();
    for (let n = x; parentFace.has(n); n = parentFace.get(n)!) {
        upX.set(n, parentHinge.get(n)!);
    }
    const path: string[] = [];
    const seenY: Array<[number, string]> = [];
    let meet = -1;
    for (let n = y; ; n = parentFace.get(n)!) {
        if (upX.has(n) || n === x) {
            meet = n;
            break;
        }
        if (!parentFace.has(n)) break;
        seenY.push([n, parentHinge.get(n)!]);
    }
    if (meet >= 0) {
        for (let n = x; n !== meet && parentFace.has(n); n = parentFace.get(n)!) {
            path.push(parentHinge.get(n)!);
        }
    }
    for (const [, k] of seenY) path.push(k);
    return path;
}

// ── local search ──────────────────────────────────────────────────
//
// The move is the standard spanning-tree swap. Adding a hinge to the cut set
// closes exactly one cycle in the vertex graph; removing any other edge of that
// cycle restores a spanning tree. So the cut set stays valid throughout and every
// intermediate state is still a one-piece net — there is no invalid region to
// stumble through.
//
// Aim it: pick an overlapping pair, take a hinge on the dual path between them,
// and cut that. Nothing off that path changes how the two sit relative to each
// other, so cutting elsewhere would be luck rather than repair.

function cycleInCutTree(
    g: CutGraph,
    cuts: Set<string>,
    addU: number,
    addV: number,
): string[] {
    // adjacency of the current cut tree
    const adj = new Map<number, Array<[number, string]>>();
    for (const arc of g.arcs) {
        if (!cuts.has(arc.key)) continue;
        if (!adj.has(arc.u)) adj.set(arc.u, []);
        if (!adj.has(arc.v)) adj.set(arc.v, []);
        adj.get(arc.u)!.push([arc.v, arc.key]);
        adj.get(arc.v)!.push([arc.u, arc.key]);
    }
    // path from addU to addV through the tree
    const prev = new Map<number, [number, string]>();
    const seen = new Set<number>([addU]);
    const q = [addU];
    for (let h = 0; h < q.length; h++) {
        if (q[h] === addV) break;
        for (const [w, k] of adj.get(q[h]) ?? []) {
            if (seen.has(w)) continue;
            seen.add(w);
            prev.set(w, [q[h], k]);
            q.push(w);
        }
    }
    const path: string[] = [];
    let n = addV;
    while (prev.has(n)) {
        const [p, k] = prev.get(n)!;
        path.push(k);
        n = p;
    }
    return path;
}

// ── saddles: the one structural constraint ────────────────────────
//
// The developed angle around a vertex is intrinsic — it comes from the lift, not
// from how you cut, and is identical across every cut set (verified to 4e-13). So
// the vertices whose angles sum to more than 360° can be found once, up front.
//
// Such a vertex is a saddle, and it forces something exact: with a single incident
// cut its faces form one fan spanning more than a full turn, so the two ends of
// that fan must lap over each other. **Every saddle needs at least two cuts.** In
// every overlap-free solution measured, all 35 saddles of Pe5 gen 3 have degree ≥ 2
// in the cut tree, with none below.
//
// A spanning tree is free to give a node any degree, so this costs nothing — but
// leaving the search to discover it by chance was costing a great deal.

function saddleNodes(A: Analysis, g: CutGraph): Set<number> {
    const sum = new Map<number, number>();
    for (const f of A.faces) {
        for (let k = 0; k < 4; k++) {
            const a = A.P[f.v[k]];
            const b = A.P[f.v[(k + 1) % 4]];
            const c = A.P[f.v[(k + 3) % 4]];
            if (!a || !b || !c) continue;
            const u1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            const u2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
            const dot = u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2];
            const n1 = Math.hypot(u1[0], u1[1], u1[2]);
            const n2 = Math.hypot(u2[0], u2[1], u2[2]);
            const ang = (Math.acos(Math.max(-1, Math.min(1, dot / (n1 * n2)))) * 180) / Math.PI;
            sum.set(f.v[k], (sum.get(f.v[k]) ?? 0) + ang);
        }
    }
    const out = new Set<number>();
    for (const [v, s] of sum) {
        const node = g.node.get(v);
        if (node != null && node !== 0 && s > 360 + 1e-6) out.add(node);
    }
    return out;
}

// Force every saddle to at least two cuts, by spanning-tree swaps that never drop
// another saddle below two. Keeps the cut set a spanning tree throughout.
function enforceSaddles(
    g: CutGraph,
    cuts: Set<string>,
    saddles: Set<number>,
): Set<string> {
    if (!saddles.size) return cuts;
    const incident = new Map<number, typeof g.arcs>();
    for (const arc of g.arcs) {
        if (!incident.has(arc.u)) incident.set(arc.u, []);
        if (!incident.has(arc.v)) incident.set(arc.v, []);
        incident.get(arc.u)!.push(arc);
        incident.get(arc.v)!.push(arc);
    }
    const deg = new Map<number, number>();
    const byKey = new Map(g.arcs.map((a) => [a.key, a]));
    for (const k of cuts) {
        const a = byKey.get(k);
        if (!a) continue;
        deg.set(a.u, (deg.get(a.u) ?? 0) + 1);
        deg.set(a.v, (deg.get(a.v) ?? 0) + 1);
    }

    for (const v of saddles) {
        let guard = 0;
        while ((deg.get(v) ?? 0) < 2 && guard++ < 30) {
            let done = false;
            for (const arc of incident.get(v) ?? []) {
                if (cuts.has(arc.key)) continue;
                const cycle = cycleInCutTree(g, cuts, arc.u, arc.v);
                for (const dropKey of cycle) {
                    const d = byKey.get(dropKey)!;
                    // never rob another saddle, nor v itself
                    const after = (n: number) =>
                        (deg.get(n) ?? 0) - 1 + (n === arc.u || n === arc.v ? 1 : 0);
                    if (
                        (saddles.has(d.u) && after(d.u) < 2) ||
                        (saddles.has(d.v) && after(d.v) < 2)
                    ) {
                        continue;
                    }
                    cuts.delete(dropKey);
                    cuts.add(arc.key);
                    deg.set(d.u, (deg.get(d.u) ?? 0) - 1);
                    deg.set(d.v, (deg.get(d.v) ?? 0) - 1);
                    deg.set(arc.u, (deg.get(arc.u) ?? 0) + 1);
                    deg.set(arc.v, (deg.get(arc.v) ?? 0) + 1);
                    done = true;
                    break;
                }
                if (done) break;
            }
            if (!done) break;
        }
    }
    return cuts;
}

// ── layers: continuation, not coloring ───────────────────────────
//
// The branch-cut picture taken literally. Where the development wants to wrap over
// itself you do not have to cut — you can go up a z coordinate, which in complex
// analysis is the next sheet of the Riemann surface and here is the next sheet of
// paper.
//
// The obvious way to assign layers is to color the overlap graph, and that is what
// this did first. It minimizes the *number* of layers, which turns out to be the
// wrong objective: the promoted faces are individually chosen, so the upper layers
// come out as scattered single rhombi. A sheet of confetti, optimal in a statistic
// nobody cares about.
//
// Continuation instead. Walk the hinge tree from the seed; when a face cannot be
// placed without overlapping what is already on its layer, that face **and its
// whole subtree** continue on the next layer up. Each layer is then a union of
// connected subtrees — real pieces of surface you can fold — and the seam between
// layers is where the net carries on rather than where it was severed.
//
// Three things make this the right construction:
//
//   * layers are connected regions, so every sheet is usable;
//   * all layers stay in one coordinate frame, so the sheets can be registered and
//     overlaid and the surface visibly continues across the seam — unlike the flat
//     variant, which repacks each piece independently and destroys that;
//   * it costs **no extra cuts**. A hinge crossing between layers is still a hinge,
//     a real fold lifting off the page. The net remains one connected piece with
//     exactly V_int cuts; it is only *drawn* across several sheets.

export function assignLayers(
    placed: Map<number, Placed>,
    parentFace?: Map<number, number>,
): { layer: Map<number, number>; count: number } {
    const layer = new Map<number, number>();
    for (const id of placed.keys()) layer.set(id, 0);
    if (!overlapPairs(placed).length) return { layer, count: 1 };

    // Without the tree there is nothing to continue along, so fall back to placing
    // each offending face on the lowest layer that will take it.
    const order = [...placed.keys()];
    if (parentFace) {
        // Parents before children, so a subtree inherits a decision already made.
        const depth = new Map<number, number>();
        const depthOf = (id: number): number => {
            if (depth.has(id)) return depth.get(id)!;
            const p = parentFace.get(id);
            const d = p == null ? 0 : depthOf(p) + 1;
            depth.set(id, d);
            return d;
        };
        for (const id of order) depthOf(id);
        order.sort((a, b) => depth.get(a)! - depth.get(b)!);
    }

    // Faces already committed to each layer, for incremental collision testing.
    const onLayer = new Map<number, number[]>();
    const fits = (id: number, L: number): boolean => {
        for (const other of onLayer.get(L) ?? []) {
            if (
                intersectionArea(
                    placed.get(id)!.poly as P2[],
                    placed.get(other)!.poly as P2[],
                ) > AREA_EPS
            ) {
                return false;
            }
        }
        return true;
    };

    let highest = 0;
    for (const id of order) {
        // Stay with the parent whenever possible — that is what keeps a layer
        // connected, and it is the whole point of continuation rather than
        // coloring.
        const p = parentFace?.get(id);
        const home = p == null ? 0 : layer.get(p)!;
        let L: number;
        if (fits(id, home)) {
            L = home;
        } else {
            // Otherwise take the lowest layer that will have it, including layers
            // *below* the parent. Only ever climbing made the promotion cascade:
            // a subtree pushed off layer 0 would sit on layer 2 while layer 0 had
            // room for it further along, which cost extra sheets and left layer 0
            // holding a fifth of the net.
            L = 0;
            while (L <= highest && !fits(id, L)) L++;
        }
        if (L > highest) highest = L;
        layer.set(id, L);
        if (!onLayer.has(L)) onLayer.set(L, []);
        onLayer.get(L)!.push(id);
    }

    let count = 0;
    for (const L of layer.values()) count = Math.max(count, L + 1);
    return { layer, count };
}

// ── the flat fallback ─────────────────────────────────────────────
//
// When one piece cannot be made overlap-free, the other answer is a net that lies
// flat at the cost of extra pieces. Adding a hinge to the cut set *without*
// removing anything closes a cycle in the vertex graph, which severs the dual tree
// and yields exactly one more piece. Aim those extra cuts at the dual path between
// an overlapping pair, same as the swap move, and repeat until nothing overlaps.

function flattenByCutting(
    A: Analysis,
    cuts: Set<string>,
    rnd: () => number,
    t0: number,
    budget: number,
): { cuts: Set<string>; dev: ReturnType<typeof developFromCuts>; overlaps: number } {
    let flat = new Set(cuts);
    let dev = developFromCuts(A, flat);
    let pairs = overlapPairs(dev.placed, true);
    let guard = 0;
    while (pairs.length && guard++ < 4000 && Date.now() - t0 < budget) {
        const [x, y] = pairs[0];
        const path = hingePathBetween(x, y, dev.parentFace, dev.parentHinge);
        if (!path.length) break;
        // Cut nearest the pair: the shortest dual path segment separates them with
        // the least collateral, which keeps the extra pieces few and large.
        const next = new Set(flat);
        next.add(path[Math.floor(rnd() * path.length)]);
        const dev2 = developFromCuts(A, next);
        const p2 = overlapPairs(dev2.placed, true);
        // Every extra cut buys at most one extra piece, so insist it buys progress.
        if (p2.length >= pairs.length) continue;
        flat = next;
        dev = dev2;
        pairs = p2;
    }
    return { cuts: flat, dev, overlaps: pairs.length };
}

// The reverse move, and the one that was missing. When two overlapping faces are
// neighbors in the tiling across an edge that is currently *cut*, they reached
// their positions by different routes and collided. Forcing that edge to be a
// hinge makes overlap between them impossible — they become rigidly adjacent.
//
// Removing an edge from a spanning tree splits it in two, so a replacement arc
// spanning the split must be added. These are the arcs to try.
function reconnectOptions(
    g: CutGraph,
    cuts: Set<string>,
    dropKey: string,
): Array<{ key: string }> {
    const byKey = new Map(g.arcs.map((a) => [a.key, a]));
    const gone = byKey.get(dropKey);
    if (!gone) return [];
    const adj = new Map<number, Array<[number, string]>>();
    for (const arc of g.arcs) {
        if (!cuts.has(arc.key) || arc.key === dropKey) continue;
        if (!adj.has(arc.u)) adj.set(arc.u, []);
        if (!adj.has(arc.v)) adj.set(arc.v, []);
        adj.get(arc.u)!.push([arc.v, arc.key]);
        adj.get(arc.v)!.push([arc.u, arc.key]);
    }
    const side = new Set<number>([gone.u]);
    const q = [gone.u];
    for (let h = 0; h < q.length; h++) {
        for (const [w] of adj.get(q[h]) ?? []) {
            if (side.has(w)) continue;
            side.add(w);
            q.push(w);
        }
    }
    const out: Array<{ key: string }> = [];
    for (const arc of g.arcs) {
        if (cuts.has(arc.key)) continue;
        if (side.has(arc.u) !== side.has(arc.v)) out.push({ key: arc.key });
    }
    return out;
}

// ── entry point ───────────────────────────────────────────────────

export interface CutTreeOptions {
    flip?: boolean;
    budgetMs?: number;
    seed?: number;
    // Same contract as the other methods: if given, the winning cut set is
    // re-developed with its steps appended here for the replay player.
    trace?: TraceEvent[];
}

// The fully-flat alternative: same routing, extra cuts, more pieces, no overlap.
export interface FlatVariant {
    placed: Map<number, Placed>;
    pieces: Piece[];
    hinges: Set<string>;
    cuts: Set<string>;
    overlaps: number;
}

export interface CutTreeResult extends UnfoldResult {
    flat: FlatVariant;
    // Which z-level each face sits on. Layer 0 holds almost everything; a face
    // climbs only when it would otherwise overlap something already down.
    layer: Map<number, number>;
    layerCount: number;
    cuts: Set<string>;
    overlaps: number;
    interiorVertices: number;
    candidatesTried: number;
}

export function cutTreeUnfold(opts: CutTreeOptions = {}): CutTreeResult {
    const t0 = Date.now();
    const A = analyzePatch(opts.flip);

    // The budget is a *cap*, not a cost: the search returns the moment it reaches
    // zero overlaps, which almost every patch does in a fraction of it. So it has
    // to scale with the patch, and the default has to be the scaled one — a flat
    // 900 ms left an 835-rhomb patch with 813 overlaps and five layers, which makes
    // the whole method look broken when it is only a search cut off early.
    //
    // This lived in the Net page and went with it. It belongs here: it is a
    // property of the problem size, not of whoever is asking.
    const budget =
        opts.budgetMs ?? Math.min(12000, Math.max(1500, A.faces.length * 35));
    const g = buildCutGraph();
    const dist = boundaryDistance(g);

    // deterministic pseudo-random, so a result is reproducible
    let s = (opts.seed ?? 12345) >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

    const saddles = saddleNodes(A, g);

    const score = (arcIdx: number, mode: number): number => {
        const arc = g.arcs[arcIdx];
        const d = Math.min(dist[arc.u], dist[arc.v]);
        // Saddle-incident arcs are wanted, so make them cheap: a saddle needs two
        // cuts and picking these early is how it gets them.
        const bonus =
            (saddles.has(arc.u) ? 1 : 0) + (saddles.has(arc.v) ? 1 : 0);
        if (mode === 0) return d - 2 * bonus;
        if (mode === 1) return d - 2 * bonus + rnd() * 1.5;
        return rnd() - 0.4 * bonus;
    };

    let best: {
        cuts: Set<string>;
        dev: ReturnType<typeof developFromCuts>;
        overlaps: number;
    } | null = null;
    let tried = 0;

    for (let attempt = 0; ; attempt++) {
        if (attempt > 0 && Date.now() - t0 > budget) break;
        const mode = attempt === 0 ? 0 : attempt < 8 ? 1 : 2;
        const cuts = enforceSaddles(
            g,
            spanningCutSet(g, (i) => score(i, mode)),
            saddles,
        );
        const dev = developFromCuts(A, cuts);
        const overlaps = countOverlaps(dev.placed);
        tried++;
        const better =
            !best ||
            overlaps < best.overlaps ||
            (overlaps === best.overlaps && dev.pieces.length < best.dev.pieces.length);
        if (better) best = { cuts, dev, overlaps };
        if (best!.overlaps === 0) break;
        if (attempt > 400) break;
    }

    // Descend from the best candidate by swapping cuts that lie between overlapping
    // faces. Each accepted swap keeps one piece and lowers the overlap count.
    //
    // The descent can strand itself in a basin it cannot swap out of. Restarting
    // from a fresh random tree does escape, but it throws away a net that was one
    // or two overlaps from done and makes it descend the whole way again — which is
    // why Pe5 gen 3 was still failing half the time at the budget the page gives
    // it. Iterated local search instead: on stagnation, go back to the best result
    // so far and *kick* it with a few random swaps, then resume descending. The
    // kick is large enough to leave the basin and small enough to keep the work.
    type Developed = ReturnType<typeof developFromCuts>;
    const arcByKey = new Map(g.arcs.map((a) => [a.key, a]));
    let swaps = 0;
    let accepted = 0;
    let cur = best!;
    let sinceGain = 0;
    const STAGNANT = 120;

    // One random spanning-tree swap, used to perturb a stuck solution.
    const kick = (from: Set<string>): Set<string> => {
        const next = new Set(from);
        for (let guard = 0; guard < 40; guard++) {
            const arc = g.arcs[Math.floor(rnd() * g.arcs.length)];
            if (next.has(arc.key)) continue;
            const cycle = cycleInCutTree(g, next, arc.u, arc.v);
            if (!cycle.length) continue;
            next.delete(cycle[Math.floor(rnd() * cycle.length)]);
            next.add(arc.key);
            return next;
        }
        return next;
    };

    while (cur.overlaps > 0 && Date.now() - t0 < budget) {
        if (sinceGain > STAGNANT) {
            let cuts2 = new Set(best!.cuts);
            const n = 2 + Math.floor(rnd() * 5);
            for (let k = 0; k < n; k++) cuts2 = kick(cuts2);
            cuts2 = enforceSaddles(g, cuts2, saddles);
            const dev2 = developFromCuts(A, cuts2);
            cur = { cuts: cuts2, dev: dev2, overlaps: countOverlaps(dev2.placed) };
            tried++;
            sinceGain = 0;
            continue;
        }
        const pairs = overlapPairs(cur.dev.placed);
        if (!pairs.length) break;
        const [x, y] = pairs[Math.floor(rnd() * pairs.length)];

        // If the pair are tiling neighbors across a cut, try making that cut a
        // hinge. It is the sharpest move available: it removes this overlap by
        // construction rather than hoping a reroute happens to separate them.
        const px = cur.dev.placed.get(x)!;
        const py = cur.dev.placed.get(y)!;
        const shared = px.verts.filter((v) => py.verts.includes(v));
        if (shared.length === 2) {
            const k = ekey(shared[0], shared[1]);
            if (cur.cuts.has(k)) {
                let bestRe: typeof cur | null = null;
                const opts2 = reconnectOptions(g, cur.cuts, k);
                for (let t = 0; t < Math.min(opts2.length, 8); t++) {
                    const pick = opts2[Math.floor(rnd() * opts2.length)];
                    const next = new Set(cur.cuts);
                    next.delete(k);
                    next.add(pick.key);
                    const d2 = enforceSaddles(g, next, saddles);
                    const dev2 = developFromCuts(A, d2);
                    const ov2 = countOverlaps(dev2.placed);
                    tried++;
                    if (!bestRe || ov2 < bestRe.overlaps) {
                        bestRe = { cuts: d2, dev: dev2, overlaps: ov2 };
                    }
                    if (ov2 === 0) break;
                    if (Date.now() - t0 >= budget) break;
                }
                if (bestRe && bestRe.overlaps <= cur.overlaps) {
                    if (bestRe.overlaps < cur.overlaps) sinceGain = 0;
                    else sinceGain++;
                    if (bestRe.overlaps < best!.overlaps) best = bestRe;
                    cur = bestRe;
                    swaps++;
                    continue;
                }
            }
        }

        const path = hingePathBetween(
            x,
            y,
            cur.dev.parentFace,
            cur.dev.parentHinge,
        );
        if (!path.length) break;
        const addKey = path[Math.floor(rnd() * path.length)];
        const arc = arcByKey.get(addKey);
        if (!arc) break;
        swaps++;

        const cycle = cycleInCutTree(g, cur.cuts, arc.u, arc.v);
        if (!cycle.length) continue;

        // Try several ways to pay for the new cut rather than one at random. The
        // cycle can be long and most of its edges are irrelevant to this overlap,
        // so sampling a handful and keeping the best is much steadier than a
        // single blind draw.
        let bestSwap: { cuts: Set<string>; dev: Developed; overlaps: number } | null = null;
        const tries = Math.min(cycle.length, 6);
        const offset = Math.floor(rnd() * cycle.length);
        for (let t = 0; t < tries; t++) {
            const dropKey = cycle[(offset + t) % cycle.length];
            if (dropKey === addKey) continue;
            const next = new Set(cur.cuts);
            next.delete(dropKey);
            next.add(addKey);
            const dev2 = developFromCuts(A, next);
            const ov2 = countOverlaps(dev2.placed);
            tried++;
            if (!bestSwap || ov2 < bestSwap.overlaps) {
                bestSwap = { cuts: next, dev: dev2, overlaps: ov2 };
            }
            if (ov2 === 0) break;
            if (Date.now() - t0 >= budget) break;
        }
        if (!bestSwap) continue;

        // Downhill always; sideways sometimes, which is what gets off a plateau
        // where every single swap is neutral.
        if (bestSwap.overlaps < cur.overlaps) sinceGain = 0;
        else sinceGain++;
        if (
            bestSwap.overlaps < cur.overlaps ||
            (bestSwap.overlaps === cur.overlaps && rnd() < 0.35)
        ) {
            if (bestSwap.overlaps < best!.overlaps) best = bestSwap;
            cur = bestSwap;
            accepted++;
        }
        if (swaps > 20000) break;
    }
    if (cur.overlaps < best!.overlaps) best = cur;
    void accepted;
    void swaps;

    const { cuts, overlaps } = best!;
    // Re-develop the winning cut set with tracing on. The walk is fully determined
    // by the cut set — no greedy choices survive — so this reproduces the very net
    // the search settled on, rather than a re-enactment that might differ.
    const dev = opts.trace
        ? developFromCuts(A, cuts, opts.trace)
        : best!.dev;

    const layers = assignLayers(dev.placed, dev.parentFace);

    // The other answer: flat at the cost of pieces. Free when the one-piece net is
    // already clean, which is the usual case up to generation 3.
    const flatRun =
        overlaps === 0
            ? { cuts, dev, overlaps: 0 }
            : flattenByCutting(A, cuts, rnd, t0, budget + 1500);

    const boxes = (d: ReturnType<typeof developFromCuts>): Piece[] =>
        d.pieces.map((faceIds, id) => {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const fid of faceIds)
            for (const q of d.placed.get(fid)!.poly) {
                if (q[0] < x0) x0 = q[0];
                if (q[1] < y0) y0 = q[1];
                if (q[0] > x1) x1 = q[0];
                if (q[1] > y1) y1 = q[1];
            }
            return { id, faceIds, w: x1 - x0, h: y1 - y0, minX: x0, minY: y0 };
        });
    const pieces = boxes(dev);

    const hist = new Map<number, number>();
    for (const c of A.creases.values())
        hist.set(c.fold, (hist.get(c.fold) ?? 0) + 1);

    return {
        faces: A.faces,
        placed: dev.placed,
        pieces,
        creases: A.creases,
        hinges: dev.hinges,
        foldHistogram: hist,
        interiorEdges: A.creases.size,
        seedsTried: tried,
        cuts,
        overlaps,
        layer: layers.layer,
        layerCount: layers.count,
        flat: {
            placed: flatRun.dev.placed,
            pieces: boxes(flatRun.dev),
            hinges: flatRun.dev.hinges,
            cuts: flatRun.cuts,
            overlaps: flatRun.overlaps,
        },
        interiorVertices: g.nodes - 1,
        candidatesTried: tried,
    };
}

export { buildCutGraph, developFromCuts, intersectionArea };
export type { P2 };
