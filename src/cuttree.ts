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
    analysePatch,
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

// ── layers ────────────────────────────────────────────────────────
//
// The branch-cut picture taken literally. Where the development wants to wrap over
// itself you do not have to cut — you can go up a z coordinate, which in complex
// analysis is the next sheet of the Riemann surface and here is the next sheet of
// paper. So: assign every face a layer such that no two overlapping faces share
// one, and each layer is flat by construction.
//
// That is a colouring of the overlap graph. It is tiny — a handful of overlapping
// pairs against hundreds of faces — so greedy colouring in descending degree
// (Welsh–Powell) is both fast and, at these sizes, optimal in practice. Almost
// everything stays on layer 0; only the branch points climb.

export function assignLayers(
    placed: Map<number, Placed>,
    pairs?: Array<[number, number]>,
): { layer: Map<number, number>; count: number } {
    const ps = pairs ?? overlapPairs(placed);
    const layer = new Map<number, number>();
    for (const id of placed.keys()) layer.set(id, 0);
    if (!ps.length) return { layer, count: 1 };

    const adj = new Map<number, number[]>();
    for (const [a, b] of ps) {
        if (!adj.has(a)) adj.set(a, []);
        if (!adj.has(b)) adj.set(b, []);
        adj.get(a)!.push(b);
        adj.get(b)!.push(a);
    }
    // Most-constrained first, so the awkward faces pick before the easy ones.
    const order = [...adj.keys()].sort(
        (x, y) => adj.get(y)!.length - adj.get(x)!.length,
    );
    for (const id of order) {
        const taken = new Set<number>();
        for (const nb of adj.get(id)!) {
            if (adj.has(nb) && layer.has(nb)) taken.add(layer.get(nb)!);
        }
        let L = 0;
        while (taken.has(L)) L++;
        layer.set(id, L);
    }
    // A face not in the overlap graph never moves; recompute the count honestly.
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
    const budget = opts.budgetMs ?? 900;
    const t0 = Date.now();
    const A = analysePatch(opts.flip);
    const g = buildCutGraph();
    const dist = boundaryDistance(g);

    // deterministic pseudo-random, so a result is reproducible
    let s = (opts.seed ?? 12345) >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

    const score = (arcIdx: number, mode: number): number => {
        const arc = g.arcs[arcIdx];
        const d = Math.min(dist[arc.u], dist[arc.v]);
        if (mode === 0) return d; // shortest route to the boundary
        if (mode === 1) return d + rnd() * 1.5; // jittered
        return rnd(); // free-for-all
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
        const cuts = spanningCutSet(g, (i) => score(i, mode));
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
    // The descent can strand itself in a basin it cannot swap out of — Pe3 gen 3
    // reaches zero from some starting trees and sticks on one overlap from others.
    // So when progress stops, abandon the basin and restart from a fresh random
    // tree, keeping the best result across all restarts. That turned Pe3 gen 3 from
    // luck-of-the-seed into reliable.
    type Developed = ReturnType<typeof developFromCuts>;
    const arcByKey = new Map(g.arcs.map((a) => [a.key, a]));
    let swaps = 0;
    let accepted = 0;
    let cur = best!;
    let sinceGain = 0;
    const STAGNANT = 250;

    while (cur.overlaps > 0 && Date.now() - t0 < budget) {
        if (sinceGain > STAGNANT) {
            const cuts2 = spanningCutSet(g, () => rnd());
            const dev2 = developFromCuts(A, cuts2);
            cur = { cuts: cuts2, dev: dev2, overlaps: countOverlaps(dev2.placed) };
            tried++;
            sinceGain = 0;
            continue;
        }
        const pairs = overlapPairs(cur.dev.placed);
        if (!pairs.length) break;
        const [x, y] = pairs[Math.floor(rnd() * pairs.length)];
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

    const layers = assignLayers(dev.placed);

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
