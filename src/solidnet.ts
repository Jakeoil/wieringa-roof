// Edge-unfolding a closed polyhedron into a flat net.
//
// `unfold.ts` already unfolds the roof, but it is built around the roof's own data —
// rhombi indexed by tiling vertex, hinges from a cut tree. A triacontahedron and a
// golden hexahedron are closed solids with no tiling behind them, so they need a
// general unfolder: faces as lists of 3D corners, adjacency worked out from shared
// edges, a spanning tree, and each face rotated about its hinge into the plane.
//
// The construction is exact in the sense that matters for paper: every edge keeps its
// length and every corner its angle, because a face is placed by expressing its corners
// in a frame built on the shared edge and re-planting that frame in two dimensions.
// `tools/solidnet.mjs` asserts both, and asserts that the pieces do not overlap.

export type V3 = [number, number, number];
export type P2 = [number, number];

export interface SolidFace {
    id: number;
    corners: V3[];
    /** carried through untouched, so a net can be coloured by whatever the caller knows */
    tag?: number;
}

export interface PlacedFace {
    id: number;
    poly: P2[];
    tag?: number;
    /** which piece it landed in — a net may need more than one */
    piece: number;
}

export interface Net {
    placed: PlacedFace[];
    pieces: number;
    /** hinges kept, as face-id pairs: these are folds, everything else is a cut */
    hinges: Array<[number, number]>;
    overlaps: number;
    width: number;
    height: number;
}

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a: V3): V3 => {
    const L = len3(a);
    return [a[0] / L, a[1] / L, a[2] / L];
};

const KEY = 1e6;
const vkey = (p: V3) => p.map((x) => Math.round(x * KEY)).join(",");
const ekey = (a: V3, b: V3) => {
    const ka = vkey(a);
    const kb = vkey(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

/** Do two convex polygons overlap in area? Touching along an edge does not count. */
function overlaps(A: P2[], B: P2[]): boolean {
    // shrink both a hair about their centroids, so shared hinges register as touching
    const shrink = (P: P2[]): P2[] => {
        const c: P2 = [
            P.reduce((s, q) => s + q[0], 0) / P.length,
            P.reduce((s, q) => s + q[1], 0) / P.length,
        ];
        return P.map((q) => [c[0] + (q[0] - c[0]) * 0.998, c[1] + (q[1] - c[1]) * 0.998] as P2);
    };
    const a = shrink(A);
    const b = shrink(B);
    // separating axis over the edge normals of both
    for (const P of [a, b]) {
        for (let i = 0; i < P.length; i++) {
            const p = P[i];
            const q = P[(i + 1) % P.length];
            const n: P2 = [-(q[1] - p[1]), q[0] - p[0]];
            const L = Math.hypot(n[0], n[1]);
            if (L < 1e-12) continue;
            n[0] /= L;
            n[1] /= L;
            let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
            for (const r of a) {
                const v = n[0] * r[0] + n[1] * r[1];
                if (v < a0) a0 = v;
                if (v > a1) a1 = v;
            }
            for (const r of b) {
                const v = n[0] * r[0] + n[1] * r[1];
                if (v < b0) b0 = v;
                if (v > b1) b1 = v;
            }
            if (a1 < b0 + 1e-9 || b1 < a0 + 1e-9) return false;
        }
    }
    return true;
}

/**
 * Unfold a closed polyhedron.
 *
 * BFS from `seed` over the face graph, placing each face across the edge it arrived by.
 * A placement that would overlap something already down starts a new piece instead —
 * so the result is always valid paper, and the piece count says how much had to be cut.
 */
export function unfoldSolid(faces: SolidFace[], seed = 0): Net {
    // adjacency by shared edge
    const byEdge = new Map<string, Array<{ f: number; i: number }>>();
    faces.forEach((f, fi) => {
        for (let i = 0; i < f.corners.length; i++) {
            const k = ekey(f.corners[i], f.corners[(i + 1) % f.corners.length]);
            const cur = byEdge.get(k);
            if (cur) cur.push({ f: fi, i });
            else byEdge.set(k, [{ f: fi, i }]);
        }
    });

    const placed = new Map<number, PlacedFace>();
    const hinges: Array<[number, number]> = [];
    let piece = 0;
    let overlapCount = 0;

    /** Face `fi` laid flat, with its 3D edge (p,q) landing on the 2D segment (P,Q). */
    const layFlat = (fi: number, p: V3, q: V3, P: P2, Q: P2, away: P2 | null): P2[] => {
        const f = faces[fi];
        const u3 = norm3(sub3(q, p));
        const n3 = norm3(
            cross3(sub3(f.corners[1], f.corners[0]), sub3(f.corners[2], f.corners[0])),
        );
        const v3 = cross3(n3, u3);
        const du: P2 = [Q[0] - P[0], Q[1] - P[1]];
        const dl = Math.hypot(du[0], du[1]);
        const ux: P2 = [du[0] / dl, du[1] / dl];
        const vx: P2 = [-ux[1], ux[0]];
        const build = (s: number): P2[] =>
            f.corners.map((c) => {
                const d = sub3(c, p);
                const a = dot3(d, u3);
                const b = dot3(d, v3) * s;
                return [P[0] + ux[0] * a + vx[0] * b, P[1] + ux[1] * a + vx[1] * b] as P2;
            });
        if (!away) return build(1);
        // choose the side that puts the new face away from the parent's interior
        const one = build(1);
        const c1: P2 = [
            one.reduce((s, r) => s + r[0], 0) / one.length,
            one.reduce((s, r) => s + r[1], 0) / one.length,
        ];
        const mid: P2 = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
        const toParent = [away[0] - mid[0], away[1] - mid[1]];
        const toChild = [c1[0] - mid[0], c1[1] - mid[1]];
        return toParent[0] * toChild[0] + toParent[1] * toChild[1] > 0 ? build(-1) : one;
    };

    const remaining = new Set(faces.map((_, i) => i));
    let start = seed;
    while (remaining.size) {
        if (!remaining.has(start)) start = remaining.values().next().value as number;
        // seed the piece: lay it in its own plane
        const f0 = faces[start];
        const root = layFlat(start, f0.corners[0], f0.corners[1], [0, 0],
            [len3(sub3(f0.corners[1], f0.corners[0])), 0], null);
        placed.set(start, { id: f0.id, poly: root, tag: f0.tag, piece });
        remaining.delete(start);
        const queue = [start];

        for (let h = 0; h < queue.length; h++) {
            const cur = queue[h];
            const f = faces[cur];
            const curPlaced = placed.get(cur)!;
            for (let i = 0; i < f.corners.length; i++) {
                const a = f.corners[i];
                const b = f.corners[(i + 1) % f.corners.length];
                const share = byEdge.get(ekey(a, b)) ?? [];
                const other = share.find((s) => s.f !== cur);
                if (!other || !remaining.has(other.f)) continue;
                const P = curPlaced.poly[i];
                const Q = curPlaced.poly[(i + 1) % curPlaced.poly.length];
                const centroid: P2 = [
                    curPlaced.poly.reduce((s, r) => s + r[0], 0) / curPlaced.poly.length,
                    curPlaced.poly.reduce((s, r) => s + r[1], 0) / curPlaced.poly.length,
                ];
                const poly = layFlat(other.f, a, b, P, Q, centroid);
                let bad = false;
                for (const q of placed.values()) {
                    if (q.piece !== piece) continue;
                    if (q.id === curPlaced.id) continue;
                    if (overlaps(poly, q.poly)) { bad = true; break; }
                }
                if (bad) { overlapCount++; continue; }
                placed.set(other.f, { id: faces[other.f].id, poly, tag: faces[other.f].tag, piece });
                hinges.push([f.id, faces[other.f].id]);
                remaining.delete(other.f);
                queue.push(other.f);
            }
        }
        piece++;
    }

    const all = [...placed.values()];
    const xs = all.flatMap((p) => p.poly.map((q) => q[0]));
    const ys = all.flatMap((p) => p.poly.map((q) => q[1]));
    return {
        placed: all,
        pieces: piece,
        hinges,
        overlaps: overlapCount,
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
    };
}

/** Try every seed and keep the net with fewest pieces, then smallest. */
export function bestUnfold(faces: SolidFace[]): Net {
    let best: Net | null = null;
    for (let s = 0; s < faces.length; s++) {
        const n = unfoldSolid(faces, s);
        if (
            !best ||
            n.pieces < best.pieces ||
            (n.pieces === best.pieces && n.width * n.height < best.width * best.height)
        ) {
            best = n;
        }
    }
    return best!;
}
