// BFS edge-unfolding of the currently generated patch.
//
// Pure geometry, no DOM — shared by net.ts (browser) and tools/bfs-unfold.mjs.
// All coordinates are in units of the golden rhombus side; callers scale to mm.

import {
    allRhombs,
    vertexList,
    vertexMap,
    edgeMap,
    roundKey,
    computeLift,
    pos3D,
} from "./geometry.js";
import type { V3 } from "./geometry.js";

// ── vectors ───────────────────────────────────────────────────────

type P2 = [number, number];

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a: V3): V3 => mul3(a, 1 / len3(a));
const cross3 = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

// ── types ─────────────────────────────────────────────────────────

export interface Face {
    id: number;
    thick: boolean;
    cluster: string; // gen-1 P1 cluster: Pe5 star / Pe3 boat / Pe1 diamond
    v: number[]; // tiling vertex ids, cyclic
}

export interface Placed {
    faceId: number;
    thick: boolean;
    cluster: string;
    poly: P2[]; // net-space corners, matching `verts` order
    verts: number[]; // tiling vertex ids in the same order
    piece: number;
}

export interface Piece {
    id: number;
    faceIds: number[];
    w: number;
    h: number;
    minX: number;
    minY: number;
}

export interface Crease {
    fold: number; // 36 | 72 | 108
    mountain: boolean;
}

export interface UnfoldResult {
    faces: Face[];
    placed: Map<number, Placed>;
    pieces: Piece[];
    creases: Map<string, Crease>; // keyed "min-max" of tiling vertex ids
    // Interior edges actually used as hinges during the unfolding — a spanning
    // tree of the face graph, so |hinges| = faces - pieces. Every OTHER interior
    // edge is a cut, even when both its faces land in the same piece: that is
    // exactly what opens the angular-defect wedges in the development.
    hinges: Set<string>;
    foldHistogram: Map<number, number>;
    interiorEdges: number;
    seedsTried: number;
}

const ekey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// ── faces & adjacency from the geometry registries ────────────────

export function buildFaces(): Face[] {
    return allRhombs.map((r) => ({
        id: r.id,
        thick: r.thick,
        cluster: r.cluster,
        v: r.verts.map((pt) => vertexMap.get(roundKey(pt))!.id),
    }));
}

export interface Link {
    other: number;
    a: number;
    b: number;
}

export function faceLinks(faces: Face[]): Map<number, Link[]> {
    const nb = new Map<number, Link[]>(faces.map((f) => [f.id, []]));
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue;
        const [x, y] = e.rhombIds;
        nb.get(x)?.push({ other: y, a: e.v1, b: e.v2 });
        nb.get(y)?.push({ other: x, a: e.v1, b: e.v2 });
    }
    return nb;
}

// ── fold angle and mountain/valley per interior edge ──────────────

function computeCreases(
    faces: Face[],
    P: (V3 | null)[],
): { creases: Map<string, Crease>; hist: Map<number, number>; interior: number } {
    const byId = new Map(faces.map((f) => [f.id, f]));
    const creases = new Map<string, Crease>();
    const hist = new Map<number, number>();
    let interior = 0;

    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue;
        interior++;
        const A = P[e.v1];
        const B = P[e.v2];
        if (!A || !B) continue;
        const dir = norm3(sub3(B, A));

        const offVert = (f: Face) =>
            f.v.find((v) => v !== e.v1 && v !== e.v2)!;
        const perp = (q: number): V3 => {
            let w = sub3(P[q]!, A);
            w = sub3(w, mul3(dir, dot3(w, dir)));
            return norm3(w);
        };

        const f1 = byId.get(e.rhombIds[0])!;
        const f2 = byId.get(e.rhombIds[1])!;
        const w1 = perp(offVert(f1));
        const w2 = perp(offVert(f2));
        const dih =
            (Math.acos(Math.max(-1, Math.min(1, dot3(w1, w2)))) * 180) /
            Math.PI;
        const fold = Math.round(180 - dih);

        // up-facing normal of face 1; face 2 bending below it means a ridge
        let n1 = cross3(dir, w1);
        if (n1[2] < 0) n1 = mul3(n1, -1);
        const mountain = dot3(sub3(P[offVert(f2)]!, A), n1) < 0;

        creases.set(ekey(e.v1, e.v2), { fold, mountain });
        hist.set(fold, (hist.get(fold) ?? 0) + 1);
    }
    return { creases, hist, interior };
}

// ── planar placement ──────────────────────────────────────────────

export function placeSeed(face: Face, P: (V3 | null)[]): P2[] {
    const A = P[face.v[0]]!;
    const B = P[face.v[1]]!;
    const D = P[face.v[3]]!;
    const ex = norm3(sub3(B, A));
    let ey = sub3(D, A);
    ey = sub3(ey, mul3(ex, dot3(ey, ex)));
    ey = norm3(ey);
    return face.v.map((i) => {
        const d = sub3(P[i]!, A);
        return [dot3(d, ex), dot3(d, ey)] as P2;
    });
}

function trilaterate(a: P2, b: P2, dA: number, dB: number, ref: P2): P2 {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    const ex: P2 = [dx / d, dy / d];
    const ey: P2 = [-ex[1], ex[0]];
    const x = (dA * dA - dB * dB + d * d) / (2 * d);
    const y = Math.sqrt(Math.max(0, dA * dA - x * x));
    const refSide = (ref[0] - a[0]) * ey[0] + (ref[1] - a[1]) * ey[1];
    const sgn = refSide > 0 ? -1 : 1;
    return [
        a[0] + ex[0] * x + ey[0] * sgn * y,
        a[1] + ex[1] * x + ey[1] * sgn * y,
    ];
}

const centroid2 = (poly: P2[]): P2 => [
    poly.reduce((s, q) => s + q[0], 0) / poly.length,
    poly.reduce((s, q) => s + q[1], 0) / poly.length,
];

export function shrink(poly: P2[], f: number): P2[] {
    const c = centroid2(poly);
    return poly.map(
        (q) => [c[0] + (q[0] - c[0]) * f, c[1] + (q[1] - c[1]) * f] as P2,
    );
}

export function convexOverlap(p1: P2[], p2: P2[]): boolean {
    for (const poly of [p1, p2]) {
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const ax = -(b[1] - a[1]);
            const ay = b[0] - a[0];
            let lo1 = Infinity;
            let hi1 = -Infinity;
            let lo2 = Infinity;
            let hi2 = -Infinity;
            for (const q of p1) {
                const v = q[0] * ax + q[1] * ay;
                if (v < lo1) lo1 = v;
                if (v > hi1) hi1 = v;
            }
            for (const q of p2) {
                const v = q[0] * ax + q[1] * ay;
                if (v < lo2) lo2 = v;
                if (v > hi2) hi2 = v;
            }
            if (hi1 < lo2 || hi2 < lo1) return false;
        }
    }
    return true;
}

export function placeAcross(
    face: Face,
    P: (V3 | null)[],
    ea: number,
    eb: number,
    host: Placed,
): { poly: P2[]; verts: number[] } | null {
    const i = face.v.indexOf(ea);
    if (i < 0 || face.v.indexOf(eb) < 0) return null;
    const fwd = face.v[(i + 1) % 4] === eb;
    const order = [0, 1, 2, 3].map(
        (k) => face.v[fwd ? (i + k) % 4 : (i - k + 4) % 4],
    );
    const [A, B, C, D] = order;
    const ia = host.verts.indexOf(A);
    const ib = host.verts.indexOf(B);
    if (ia < 0 || ib < 0) return null;
    const a = host.poly[ia];
    const b = host.poly[ib];
    const ref = centroid2(host.poly);
    const dist = (u: number, w: number) => len3(sub3(P[u]!, P[w]!));
    return {
        poly: [
            a,
            b,
            trilaterate(a, b, dist(C, A), dist(C, B), ref),
            trilaterate(a, b, dist(D, A), dist(D, B), ref),
        ],
        verts: order,
    };
}

// ── one BFS run ───────────────────────────────────────────────────

function runBFS(
    faces: Face[],
    P: (V3 | null)[],
    links: Map<number, Link[]>,
    firstSeed: number | null,
): { placed: Map<number, Placed>; pieceFaces: number[][]; hinges: Set<string> } {
    const byId = new Map(faces.map((f) => [f.id, f]));
    const placed = new Map<number, Placed>();
    const hinges = new Set<string>();
    const pieceFaces: number[][] = [];
    const remaining = new Set(faces.map((f) => f.id));

    while (remaining.size) {
        let seedId: number | null = null;
        if (pieceFaces.length === 0 && firstSeed !== null && remaining.has(firstSeed)) {
            seedId = firstSeed;
        } else {
            let best = Infinity;
            for (const id of remaining) {
                const f = byId.get(id)!;
                const c = f.v
                    .map((i) => P[i]!)
                    .reduce((s, q) => [s[0] + q[0], s[1] + q[1]] as P2, [0, 0] as P2);
                const r = Math.hypot(c[0] / 4, c[1] / 4);
                if (r < best) {
                    best = r;
                    seedId = id;
                }
            }
        }

        const pieceId = pieceFaces.length;
        const mine: number[] = [seedId!];
        pieceFaces.push(mine);
        const seed = byId.get(seedId!)!;
        placed.set(seedId!, {
            faceId: seedId!,
            thick: seed.thick,
                    cluster: seed.cluster,
            poly: placeSeed(seed, P),
            verts: seed.v.slice(),
            piece: pieceId,
        });
        remaining.delete(seedId!);

        const q = [seedId!];
        for (let h = 0; h < q.length; h++) {
            const cur = q[h];
            const host = placed.get(cur)!;
            for (const link of links.get(cur) ?? []) {
                if (!remaining.has(link.other)) continue;
                const cand = placeAcross(
                    byId.get(link.other)!,
                    P,
                    link.a,
                    link.b,
                    host,
                );
                if (!cand) continue;
                const test = shrink(cand.poly, 0.94);
                let clash = false;
                for (const fid of mine) {
                    if (fid === cur) continue;
                    if (convexOverlap(test, shrink(placed.get(fid)!.poly, 0.94))) {
                        clash = true;
                        break;
                    }
                }
                if (clash) continue;
                placed.set(link.other, {
                    faceId: link.other,
                    thick: byId.get(link.other)!.thick,
                    cluster: byId.get(link.other)!.cluster,
                    poly: cand.poly,
                    verts: cand.verts,
                    piece: pieceId,
                });
                hinges.add(ekey(link.a, link.b));
                mine.push(link.other);
                remaining.delete(link.other);
                q.push(link.other);
            }
        }
    }
    return { placed, pieceFaces, hinges };
}

// ── public entry point ────────────────────────────────────────────

export interface UnfoldOptions {
    // Try every rhomb as the starting seed and keep the best result. O(F^3), so
    // it is skipped above this many faces.
    maxSeedSearch?: number;
    // Reflect the surface vertically — the dual roof, with every mountain and
    // valley exchanged. Fold magnitudes are unchanged.
    flip?: boolean;
}

export function unfoldPatch(opts: UnfoldOptions = {}): UnfoldResult {
    const maxSeedSearch = opts.maxSeedSearch ?? 150;
    const faces = buildFaces();
    const lift = computeLift();
    const P: (V3 | null)[] = lift.n.map((nv) =>
        nv ? pos3D(nv, opts.flip) : null,
    );
    const links = faceLinks(faces);
    const { creases, hist, interior } = computeCreases(faces, P);

    let best: {
        placed: Map<number, Placed>;
        pieceFaces: number[][];
        hinges: Set<string>;
    } | null = null;
    let bestScore: [number, number] = [Infinity, Infinity];
    let seedsTried = 0;

    const seeds =
        faces.length <= maxSeedSearch ? faces.map((f) => f.id) : [null];
    for (const s of seeds) {
        const run = runBFS(faces, P, links, s);
        seedsTried++;
        const primary = Math.max(...run.pieceFaces.map((p) => p.length));
        const score: [number, number] = [run.pieceFaces.length, -primary];
        if (
            score[0] < bestScore[0] ||
            (score[0] === bestScore[0] && score[1] < bestScore[1])
        ) {
            bestScore = score;
            best = run;
        }
    }

    const { placed, pieceFaces, hinges } = best!;
    const pieces: Piece[] = pieceFaces.map((faceIds, id) => {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const fid of faceIds)
            for (const q of placed.get(fid)!.poly) {
                if (q[0] < x0) x0 = q[0];
                if (q[1] < y0) y0 = q[1];
                if (q[0] > x1) x1 = q[0];
                if (q[1] > y1) y1 = q[1];
            }
        return { id, faceIds, w: x1 - x0, h: y1 - y0, minX: x0, minY: y0 };
    });
    pieces.sort((a, b) => b.faceIds.length - a.faceIds.length);

    return {
        faces,
        placed,
        pieces,
        creases,
        hinges,
        foldHistogram: hist,
        interiorEdges: interior,
        seedsTried,
    };
}

// Is this edge a crease to be scored, or a cut? Only edges actually used as
// hinges are creases. Piece membership is NOT sufficient: two faces can both be
// in a piece yet be separated in the development by an angular-defect wedge.
export function edgeRole(
    va: number,
    vb: number,
    hinges: Set<string>,
    creases: Map<string, Crease>,
): Crease | null {
    const k = ekey(va, vb);
    if (!hinges.has(k)) return null;
    return creases.get(k) ?? null;
}

export { ekey };

// ── interactive unfolding support ─────────────────────────────────

// Everything a hand-driven unfolder needs, computed once per patch: the faces,
// the lifted 3D corner positions, the face adjacency, and the fold angle plus
// mountain/valley of every interior edge. legacy.ts drives placeSeed/placeAcross
// with these so its geometry is identical to the automatic methods'.
export interface Analysis {
    faces: Face[];
    P: (V3 | null)[];
    links: Map<number, Link[]>;
    creases: Map<string, Crease>;
}

export function analysePatch(flip = false): Analysis {
    const faces = buildFaces();
    const lift = computeLift();
    const P: (V3 | null)[] = lift.n.map((nv) => (nv ? pos3D(nv, flip) : null));
    return {
        faces,
        P,
        links: faceLinks(faces),
        creases: computeCreases(faces, P).creases,
    };
}

export type { P2 };

// ── ribbon strips ─────────────────────────────────────────────────
//
// In a de Bruijn ribbon consecutive rhombi share an edge parallel to the same
// generator, so every crease in the strip is parallel to every other. A
// polyhedral surface whose creases are all parallel is a generalized cylinder,
// and its development is a flat band with creases at cumulative cross-section
// arc length. Each face contributes width sin 63.4349° = 2/√5, always positive,
// so crease positions increase monotonically and the band cannot fold back on
// itself — strips are overlap-free at any length, with no test required.
//
// Each rhomb belongs to two ribbons (one per edge direction), so no single
// family partitions a patch. This takes the greedy route: repeatedly extract the
// longest remaining run in any family.

// Which generator is this edge parallel to? Recoverable straight from the lift:
// n differs in exactly one component across an edge.
function edgeFamily(
    v1: number,
    v2: number,
    n: (number[] | null)[],
): number | null {
    const a = n[v1];
    const b = n[v2];
    if (!a || !b) return null;
    let found = -1;
    for (let j = 0; j < 5; j++) {
        if (a[j] !== b[j]) {
            if (found >= 0) return null; // more than one: not a single edge step
            found = j;
        }
    }
    return found < 0 ? null : found;
}

interface StripLink {
    other: number;
    a: number;
    b: number;
}

type Families = Array<Map<number, StripLink[]>>;
type Run = { ids: number[]; links: (StripLink | null)[] };

// Per-family face adjacency. Each face has exactly two edges parallel to each of
// its two directions, so every family graph has degree <= 2 and decomposes into
// paths and cycles. Family j only reaches the 2/5 of rhombi that have direction
// j at all — which is why pure ribbons leave so much behind.
function buildFamilies(n: (number[] | null)[]): Families {
    const fam: Families = [0, 1, 2, 3, 4].map(
        () => new Map<number, StripLink[]>(),
    );
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue;
        const j = edgeFamily(e.v1, e.v2, n);
        if (j === null) continue;
        const [x, y] = e.rhombIds;
        const g = fam[j];
        if (!g.has(x)) g.set(x, []);
        if (!g.has(y)) g.set(y, []);
        g.get(x)!.push({ other: y, a: e.v1, b: e.v2 });
        g.get(y)!.push({ other: x, a: e.v1, b: e.v2 });
    }
    return fam;
}

function makeRunFinder(fam: Families, assigned: Set<number>) {
    const runFrom = (
        j: number,
        start: number,
    ): { ids: number[]; links: (StripLink | null)[] } => {
        const g = fam[j];
        // walk back to an endpoint first
        let head = start;
        const seen = new Set<number>([start]);
        for (;;) {
            const nx = (g.get(head) ?? []).find(
                (l) => !assigned.has(l.other) && !seen.has(l.other),
            );
            if (!nx) break;
            head = nx.other;
            seen.add(head);
        }
        // walk forward collecting the run
        const ids = [head];
        const links: (StripLink | null)[] = [null];
        const used = new Set<number>([head]);
        for (;;) {
            const cur = ids[ids.length - 1];
            const nx = (g.get(cur) ?? []).find(
                (l) => !assigned.has(l.other) && !used.has(l.other),
            );
            if (!nx) break;
            ids.push(nx.other);
            links.push(nx);
            used.add(nx.other);
        }
        return { ids, links };
    };

    return function longestRun(faces: Face[]): Run {
        let best: Run | null = null;
        for (let j = 0; j < 5; j++) {
            for (const fid of fam[j].keys()) {
                if (assigned.has(fid)) continue;
                const run = runFrom(j, fid);
                if (!best || run.ids.length > best.ids.length) best = run;
            }
        }
        if (!best) {
            const solo = faces.find((f) => !assigned.has(f.id))!;
            best = { ids: [solo.id], links: [null] };
        }
        return best;
    };
}

// Measure a placed piece's bounding box in side units.
function pieceBox(faceIds: number[], placed: Map<number, Placed>) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const fid of faceIds)
        for (const q of placed.get(fid)!.poly) {
            if (q[0] < x0) x0 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0];
            if (q[1] > y1) y1 = q[1];
        }
    return { w: x1 - x0, h: y1 - y0, minX: x0, minY: y0 };
}

export function stripPatch(opts: UnfoldOptions = {}): UnfoldResult {
    const faces = buildFaces();
    const lift = computeLift();
    const P: (V3 | null)[] = lift.n.map((nv) =>
        nv ? pos3D(nv, opts.flip) : null,
    );
    const byId = new Map(faces.map((f) => [f.id, f]));
    const { creases, hist, interior } = computeCreases(faces, P);

    const assigned = new Set<number>();
    const longestRun = makeRunFinder(buildFamilies(lift.n), assigned);
    const strips: Run[] = [];

    while (assigned.size < faces.length) {
        const best = longestRun(faces);
        for (const id of best.ids) assigned.add(id);
        strips.push(best);
    }

    strips.sort((a, b) => b.ids.length - a.ids.length);

    // develop each strip as a chain
    const placed = new Map<number, Placed>();
    const hinges = new Set<string>();
    const pieceFaces: number[][] = [];

    strips.forEach((strip, pieceId) => {
        const mine: number[] = [];
        pieceFaces.push(mine);
        for (let i = 0; i < strip.ids.length; i++) {
            const fid = strip.ids[i];
            const face = byId.get(fid)!;
            if (i === 0) {
                placed.set(fid, {
                    faceId: fid,
                    thick: face.thick,
                    cluster: face.cluster,
                    poly: placeSeed(face, P),
                    verts: face.v.slice(),
                    piece: pieceId,
                });
            } else {
                const link = strip.links[i]!;
                const host = placed.get(strip.ids[i - 1])!;
                const cand = placeAcross(face, P, link.a, link.b, host);
                if (!cand) continue;
                placed.set(fid, {
                    faceId: fid,
                    thick: face.thick,
                    cluster: face.cluster,
                    poly: cand.poly,
                    verts: cand.verts,
                    piece: pieceId,
                });
                hinges.add(ekey(link.a, link.b));
            }
            mine.push(fid);
        }
    });

    const pieces: Piece[] = pieceFaces.map((faceIds, id) => ({
        id,
        faceIds,
        ...pieceBox(faceIds, placed),
    }));

    return {
        faces,
        placed,
        pieces,
        creases,
        hinges,
        foldHistogram: hist,
        interiorEdges: interior,
        seedsTried: 0,
    };
}

// ── widened ribbons ───────────────────────────────────────────────
//
// A pure ribbon is one rhomb wide, and family j only reaches the 2/5 of rhombi
// that have direction j at all, so the plain strip decomposition leaves a lot of
// orphans between bands. This takes the longest available ribbon as a *backbone*
// and then accretes neighbouring rhombi onto it across any edge — not just the
// j-parallel ones — largest backbone first, so the longest strip gets first claim
// on the rhombi it could share.
//
// The backbone is still placed first and so is still guaranteed simple, but the
// accreted rhombi break the all-creases-parallel property, so overlap must be
// tested again. What is kept is the straight backbone, which packs well on a page
// and gives a natural folding order. The result is patch-specific: unlike a pure
// ribbon there is no clean rule for which rhomb belongs to which band.

export function ribbonGrowPatch(opts: UnfoldOptions = {}): UnfoldResult {
    const faces = buildFaces();
    const lift = computeLift();
    const P: (V3 | null)[] = lift.n.map((nv) =>
        nv ? pos3D(nv, opts.flip) : null,
    );
    const byId = new Map(faces.map((f) => [f.id, f]));
    const { creases, hist, interior } = computeCreases(faces, P);
    const links = faceLinks(faces);

    const assigned = new Set<number>();
    const longestRun = makeRunFinder(buildFamilies(lift.n), assigned);

    const placed = new Map<number, Placed>();
    const hinges = new Set<string>();
    const pieceFaces: number[][] = [];

    const fits = (poly: P2[], mine: number[], skip: number): boolean => {
        const test = shrink(poly, 0.94);
        for (const fid of mine) {
            if (fid === skip) continue;
            if (convexOverlap(test, shrink(placed.get(fid)!.poly, 0.94)))
                return false;
        }
        return true;
    };

    while (assigned.size < faces.length) {
        const backbone = longestRun(faces);
        const pieceId = pieceFaces.length;
        const mine: number[] = [];
        pieceFaces.push(mine);

        // 1. lay the backbone down as a chain
        for (let i = 0; i < backbone.ids.length; i++) {
            const fid = backbone.ids[i];
            const face = byId.get(fid)!;
            if (i === 0) {
                placed.set(fid, {
                    faceId: fid,
                    thick: face.thick,
                    cluster: face.cluster,
                    poly: placeSeed(face, P),
                    verts: face.v.slice(),
                    piece: pieceId,
                });
            } else {
                const link = backbone.links[i]!;
                const host = placed.get(backbone.ids[i - 1])!;
                const cand = placeAcross(face, P, link.a, link.b, host);
                if (!cand) continue;
                placed.set(fid, {
                    faceId: fid,
                    thick: face.thick,
                    cluster: face.cluster,
                    poly: cand.poly,
                    verts: cand.verts,
                    piece: pieceId,
                });
                hinges.add(ekey(link.a, link.b));
            }
            mine.push(fid);
            assigned.add(fid);
        }

        // 2. accrete outward across any edge
        const q = [...mine];
        for (let h = 0; h < q.length; h++) {
            const cur = q[h];
            const host = placed.get(cur)!;
            for (const link of links.get(cur) ?? []) {
                if (assigned.has(link.other)) continue;
                const cand = placeAcross(
                    byId.get(link.other)!,
                    P,
                    link.a,
                    link.b,
                    host,
                );
                if (!cand) continue;
                if (!fits(cand.poly, mine, cur)) continue;
                placed.set(link.other, {
                    faceId: link.other,
                    thick: byId.get(link.other)!.thick,
                    cluster: byId.get(link.other)!.cluster,
                    poly: cand.poly,
                    verts: cand.verts,
                    piece: pieceId,
                });
                hinges.add(ekey(link.a, link.b));
                mine.push(link.other);
                assigned.add(link.other);
                q.push(link.other);
            }
        }
    }

    pieceFaces.sort((a, b) => b.length - a.length);
    pieceFaces.forEach((ids, id) => {
        for (const fid of ids) placed.get(fid)!.piece = id;
    });
    const pieces: Piece[] = pieceFaces.map((faceIds, id) => ({
        id,
        faceIds,
        ...pieceBox(faceIds, placed),
    }));

    return {
        faces,
        placed,
        pieces,
        creases,
        hinges,
        foldHistogram: hist,
        interiorEdges: interior,
        seedsTried: 0,
    };
}
