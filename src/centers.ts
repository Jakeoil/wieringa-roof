// Which triacontahedron does a roof face belong to?
//
// The rhombic triacontahedron is isohedral, so all thirty of its face planes are
// tangent to one insphere, and — because every face has a 2-fold axis through its
// own center — each touches at the face's centroid rather than anywhere else. So a
// golden rhombus that is a face of a triacontahedron fixes that solid's center to
// one of exactly two points, `centroid ± ρ·n̂`. Faces of the same solid name the same
// point, and the grouping falls out.
//
// ρ = √(1 + 2/√5) = φ²/√(φ²+1) = 1.3763819…
//
// This works for the triacontahedron and nothing else in the family. The rhombic
// icosahedron, the Bilinski dodecahedron and the two rhombohedra are not isohedral:
// their face planes sit at two or three different distances from the center, and the
// offset is not even parallel to the face normal. See TRIACONTAHEDRA.md §1.
//
// Two things make this exact rather than approximate:
//
//   * The roof lifts on five of the six icosahedral five-fold axes; the sixth is
//     vertical. Adding it back, every center is `½ Σ m_i a_i` with all six m_i odd
//     integers, so solids are compared by integer equality and there is no
//     clustering tolerance anywhere. TRIACONTAHEDRA.md §3.
//   * The roof can only ever hold ten of a solid's thirty faces — the five |Δj|=1
//     (thick, the top cap) and the five |Δj|=2 (thin, the ring). The other ten use
//     the vertical generator and stand exactly vertical, which a single-valued roof
//     cannot contain. Ten is a ceiling, not a high-water mark. §2.

import {
    allRhombs,
    allP1Tiles,
    vertexMap,
    roundKey,
    computeLift,
    pos3D,
    E5,
    SQRT5,
} from "./geometry.js";
import type { V3 } from "./geometry.js";

// ── the six axes ──────────────────────────────────────────────────

/** The five roof generators plus the vertical — the six icosahedral 5-fold axes.
 *  Every pairwise dot product is ±1/√5, which is what makes them that set. */
export const A6: V3[] = [...E5.map((v) => [...v] as V3), [0, 0, 1]];

/** Inradius of a triacontahedron of unit edge. Every one of its thirty faces is
 *  this far from the center, and touches the insphere at its own centroid. */
export const RHO = Math.sqrt(1 + 2 / SQRT5);

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** The center named by an integer coordinate vector: `c = ½ Σ m_i a_i`. */
export function centerOf(m: number[]): V3 {
    let c: V3 = [0, 0, 0];
    for (let i = 0; i < 6; i++) c = add(c, mul(A6[i], m[i] / 2));
    return c;
}

// ── types ─────────────────────────────────────────────────────────

/** The six class sizes that occur. There are no others, at any patch or generation. */
export const CLASSES = [1, 2, 3, 4, 5, 10];

export interface Solid {
    id: number;
    /** six odd integers; the solid's identity, and the key it is grouped by */
    m: number[];
    /** center, `½ Σ m_i a_i` */
    c: V3;
    /** ids of the roof rhombi lying on this solid */
    faces: number[];
    /** how many of those are thick (|Δj| = 1, the solid's top cap) */
    thick: number;
    /** true when the center is below its faces — a hat the roof caps, rather than a
     *  bowl resting on the roof. A solid never shows the roof faces from both sides,
     *  so one face settles it for all of them. */
    hat: boolean;
    /** all ten available faces present: a whole triacontahedron, and always exactly
     *  the five thick rhombi of one Pe5 tile plus the five thin ones ringing them */
    complete: boolean;
    /**
     * True when the solid's whole ten-face footprint lies inside the patch, so its
     * count is a **class** and not merely a lower bound.
     *
     * An unsettled solid may be short only because the rhombi that would have closed
     * it were cut off, and there is no way to tell from this patch which. Holes are a
     * different matter and are counted as the genuine absences they are: this
     * generator draws rhombi from the P1 pentagons alone, so every star, boat and
     * diamond leaves a gap, at a density that does not fall with generation. A solid
     * truncated by a gap is honestly truncated.
     */
    settled: boolean;
    /** e.g. `"5=3T+2t"`. Only nine of these ever occur — see TRIACONTAHEDRA.md. */
    makeup: string;
}

export interface Face {
    id: number;
    /** the four corner vertex ids, in the tiling's own order */
    vids: number[];
    /** face centroid, lifted */
    c: V3;
    /** unit normal, oriented upward — the roof has no vertical faces, so this is
     *  never ambiguous */
    u: V3;
    /** the two generators the rhombus is spanned by */
    pair: [number, number];
    thick: boolean;
    /** the two solids this face lies on, above and below. Always exactly two. */
    solids: [number, number];
}

export interface Centers {
    solids: Solid[];
    faces: Face[];
    /** rhomb id → its Face. Rhomb ids are dense from 0, so this is an array. */
    byRhomb: Face[];
    /** largest residual between the integer center and the geometric one. A real
     *  number rather than an assertion so callers can report it; it runs ~2e-15. */
    residual: number;
}

// ── the ten candidate faces, and whether the patch can see them all ───

/** The ten roof-facing orientations, with the upward normal of each. */
const ORI = (() => {
    const out: Array<{ j: number; k: number; u: V3; thick: boolean }> = [];
    for (let j = 0; j < 5; j++) {
        for (let k = j + 1; k < 5; k++) {
            let u = norm(cross(A6[j], A6[k]));
            if (u[2] < 0) u = mul(u, -1);
            out.push({ j, k, u, thick: Math.min((j - k + 5) % 5, (k - j + 5) % 5) === 1 });
        }
    }
    return out;
})();

/**
 * The ten faces the solid `m` *could* show the roof, as lattice corners — present or
 * not. Reading them off the integer coordinates rather than searching the tiling is
 * what makes the settled test possible at all: you cannot ask whether a face is
 * missing until you know where it would have been.
 */
function candidateCorners(m: number[]): Array<{ thick: boolean; corners: number[][] }> {
    const sz = Math.sign(m[5]);
    return ORI.map(({ j, k, u, thick }) => {
        const n = new Array<number>(5);
        for (let i = 0; i < 5; i++) {
            n[i] =
                i === j || i === k
                    ? (m[i] - 1) / 2
                    : (m[i] - (Math.sign(dot(mul(u, sz), A6[i])) || 1)) / 2;
        }
        const bump = (a: number[], i: number): number[] => {
            const c = a.slice();
            c[i]++;
            return c;
        };
        return { thick, corners: [n, bump(n, j), bump(bump(n, j), k), bump(n, k)] };
    });
}

type P2 = [number, number];
const planar = (n: number[]): P2 => {
    const p = pos3D(n);
    return [p[0], p[1]];
};

/** Convex hull, counter-clockwise. The patch outline stands in for its outer boundary:
 *  holes are interior to it, which is exactly right, since a gap is a real absence. */
function convexHull(pts: P2[]): P2[] {
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const crs2 = (o: P2, a: P2, b: P2) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (q: P2[]): P2[] => {
        const h: P2[] = [];
        for (const x of q) {
            while (h.length > 1 && crs2(h[h.length - 2], h[h.length - 1], x) <= 0) h.pop();
            h.push(x);
        }
        return h;
    };
    const lo = half(p);
    const hi = half([...p].reverse());
    lo.pop();
    hi.pop();
    return lo.concat(hi);
}

/** Signed distance into a counter-clockwise hull; negative outside. */
function hullDepth(h: P2[], q: P2): number {
    let best = Infinity;
    for (let i = 0; i < h.length; i++) {
        const a = h[i];
        const b = h[(i + 1) % h.length];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const d = ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / L;
        if (d < best) best = d;
    }
    return best;
}

// ── the construction ──────────────────────────────────────────────

/**
 * Every triacontahedron the current patch touches.
 *
 * Call after `generatePatch()`, exactly as `roof3d.ts` does — this reads the module
 * state in `geometry.ts` rather than taking a patch as an argument, so that there is
 * one notion of "the patch we are looking at".
 *
 * Computed **unflipped**. Hills-up and dales-up are the same roof reflected in
 * z = 0, and a mirrored triacontahedron is still a triacontahedron, so a caller
 * wanting the flipped picture negates z on the finished scene — surface, centers and
 * solids together — rather than asking for a second computation. That also swaps
 * every hat for a bowl, which is what flipping a roof ought to mean.
 */
export function triacontahedra(): Centers {
    const lift = computeLift();
    const P: (V3 | null)[] = lift.n.map((nv) => (nv ? pos3D(nv) : null));

    const byKey = new Map<string, Solid>();
    const solids: Solid[] = [];
    const faces: Face[] = [];
    const byRhomb: Face[] = [];
    let residual = 0;

    for (const r of allRhombs) {
        const vids = r.verts.map((pt) => vertexMap.get(roundKey(pt))!.id);
        const q = vids.map((v) => P[v]!);

        // Orient the normal upward. Safe because the roof has no vertical faces:
        // the five orientations that would be vertical are exactly the ones needing
        // the vertical generator, and the roof does not have it.
        let u = norm(cross(sub(q[1], q[0]), sub(q[3], q[0])));
        if (u[2] < 0) u = mul(u, -1);
        const c = mul(
            q.reduce((a, b) => add(a, b), [0, 0, 0] as V3),
            1 / 4,
        );

        // The lattice corner and the two edge generators, taken from the integer
        // coordinates rather than measured off the geometry. For a rhombus with low
        // corner n the four corners are n, n+e_j, n+e_k, n+e_j+e_k, so the
        // componentwise minimum *is* n.
        const nv = vids.map((v) => lift.n[v]!);
        const n0 = nv.reduce((a, b) => a.map((x, i) => Math.min(x, b[i])));
        const d1 = nv[1].map((x, i) => x - nv[0][i]);
        const d3 = nv[3].map((x, i) => x - nv[0][i]);
        const j = d1.findIndex((x) => x !== 0);
        const k = d3.findIndex((x) => x !== 0);

        const pairIds: number[] = [];
        for (const side of [1, -1]) {
            // m_i = 2n_i + 1 on the two edge generators, 2n_i ± 1 on the other three,
            // ±1 on the vertical — the sign being which way the solid lies. The roof
            // lattice has no vertical component at all, which is why m[5] is only
            // ever ±1 and never larger.
            const m = new Array<number>(6);
            for (let i = 0; i < 5; i++) {
                m[i] =
                    i === j || i === k
                        ? 2 * n0[i] + 1
                        : 2 * n0[i] + (Math.sign(dot(mul(u, side), A6[i])) || 1);
            }
            m[5] = Math.sign(dot(mul(u, side), A6[5])) || 1;

            const cc = centerOf(m);
            residual = Math.max(
                residual,
                Math.hypot(...sub(cc, add(c, mul(u, side * RHO)))),
            );

            const key = m.join(",");
            let s = byKey.get(key);
            if (!s) {
                s = {
                    id: solids.length,
                    m,
                    c: cc,
                    faces: [],
                    thick: 0,
                    hat: cc[2] < c[2],
                    complete: false,
                    settled: false,
                    makeup: "",
                };
                byKey.set(key, s);
                solids.push(s);
            }
            s.faces.push(r.id);
            if (r.thick) s.thick++;
            pairIds.push(s.id);
        }

        const f: Face = {
            id: r.id,
            vids,
            c,
            u,
            pair: [Math.min(j, k), Math.max(j, k)],
            thick: r.thick,
            solids: [pairIds[0], pairIds[1]],
        };
        faces.push(f);
        byRhomb[r.id] = f;
    }

    // Settledness. The cheap disc test decides almost every solid — only the ones
    // straddling the outline need their forty corners looked at individually.
    const hull = convexHull(faces.flatMap((f) => f.vids.map((v) => planar(lift.n[v]!))));
    const FOOTPRINT = Math.max(
        ...candidateCorners(solids[0]?.m ?? [1, 1, 1, 1, 1, 1]).flatMap((c) =>
            c.corners.map((n) => {
                const q = planar(n);
                const c0 = solids[0] ? solids[0].c : [0, 0, 0];
                return Math.hypot(q[0] - c0[0], q[1] - c0[1]);
            }),
        ),
    );
    for (const s of solids) {
        s.complete = s.faces.length === 10;
        const t = s.faces.filter((fid) => byRhomb[fid].thick).length;
        s.makeup = `${s.faces.length}=${t}T+${s.faces.length - t}t`;
        const d = hullDepth(hull, [s.c[0], s.c[1]]);
        s.settled =
            d >= FOOTPRINT ||
            (d > 0 &&
                candidateCorners(s.m).every((c) =>
                    c.corners.every((n) => hullDepth(hull, planar(n)) > 1e-9),
                ));
    }

    return { solids, faces, byRhomb, residual };
}

// ── policies, kept visibly separate from the geometry ──────────────

/**
 * One solid per face, largest group first.
 *
 * A face lies on exactly two solids and nothing in the geometry prefers either, so
 * any single-valued coloring of the roof is a *choice*. This is the obvious one and
 * it is not canonical: it covers a patch with far more solids than the complete caps
 * alone, and ties are broken by whatever order `solids` happens to be in. Kept out of
 * `triacontahedra()` so that it cannot be mistaken for a fact about the roof.
 *
 * Returns rhomb id → solid id.
 */
export function assignLargestFirst(cen: Centers): number[] {
    const out: number[] = [];
    const taken = new Set<number>();
    const order = [...cen.solids].sort((a, b) => b.faces.length - a.faces.length);
    for (const s of order) {
        for (const fid of s.faces) {
            if (taken.has(fid)) continue;
            taken.add(fid);
            out[fid] = s.id;
        }
    }
    return out;
}

/** The Pe5 tiles of the P1 layer that emitted a full five-rhomb rosette. Every one
 *  of them carries a complete triacontahedron, and nothing else does — the census
 *  `tools/centers.mjs` checks. */
export function pe5Rosettes(): number[] {
    return allP1Tiles
        .filter((t) => t.type === "Pe5" && t.rhombIds.length === 5)
        .map((t) => t.id);
}
