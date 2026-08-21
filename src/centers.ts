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
    p1TileOutline,
    vertexList,
    vertexMap,
    roundKey,
    computeLift,
    pos3D,
    E5,
    SQRT5,
} from "./geometry.js";
import type { V3 } from "./geometry.js";
import { zonohedron, faceOutward } from "./solids.js";

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

// ── placing a solid in the scene ──────────────────────────────────
//
// This lives here, not in the page, because the page is the one place a mistake in it
// cannot be tested — and one duly got through. The triacontahedron is **not**
// symmetric under z → −z: only 10 of its 30 face centers map, and it takes a 36° turn
// as well, because the top and bottom caps are anti-aligned. Drawing an unmirrored
// mesh at a mirrored center therefore puts every solid a tenth of a turn out of
// register with the roof, which is invisible to any check that runs at one parity.
//
// So: mirror the whole picture. Negate z on the mesh along with the scene, and select
// the cup by the solid's own unflipped side.

/** The thirty faces of a unit triacontahedron in the roof's own frame, wound outward. */
export const RT_FACES: V3[][] = zonohedron(A6).map(faceOutward) as V3[][];

const faceHeight = (f: V3[]): number => (f[0][2] + f[1][2] + f[2][2] + f[3][2]) / 4;

/** Indices into `RT_FACES` of the ten faces a roof can lie on — the solid's **cup**.
 *  The other twenty are the ten vertical ones, which use the sixth generator and which
 *  a single-valued surface can never contain, and the ten facing away. */
export function cupIndices(s: Solid): number[] {
    const out: number[] = [];
    for (let i = 0; i < RT_FACES.length; i++) {
        const h = faceHeight(RT_FACES[i]);
        if (s.hat ? h > 0.1 : h < -0.1) out.push(i);
    }
    return out;
}

/** Face `i` of solid `s` as it belongs in the scene: scaled about its own center,
 *  mirrored with the scene when `flip`, and recentered by the roof's own offset. */
export function solidFace(
    s: Solid,
    i: number,
    flip: boolean,
    scale: number,
    offset: V3,
): V3[] {
    const z = flip ? -1 : 1;
    const cx = s.c[0] - offset[0];
    const cy = s.c[1] - offset[1];
    const cz = s.c[2] * z - offset[2];
    return RT_FACES[i].map(
        (v) => [v[0] * scale + cx, v[1] * scale + cy, v[2] * scale * z + cz] as V3,
    );
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
    /**
     * How many faces call this solid **home** — that is, have it as the larger of
     * their two.
     *
     * Zero means a **nail head**: every face touching it is better explained by the
     * solid on its other side. Every face necessarily names two centers, so a solid
     * holding one face is usually just the far end of a normal whose point is
     * somewhere else, and counting those as a class is double counting. Measured, it
     * is not a small effect: 99.9% of one-face solids are nail heads, a complete cap
     * generates ten of them, and over home solids alone class 3 vanishes entirely
     * while classes 1 and 2 fall towards nothing.
     */
    homeCount: number;
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
    /** rhomb id → the solid it calls home, the larger of its two. Ties go to
     *  whichever was built first, which is arbitrary and affects only ties. */
    home: number[];
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

/**
 * Is a point inside the region the tiling was actually generated over?
 *
 * Not the rhomb layer's own boundary, which cannot answer this. The star-family tiles
 * emit no rhombi, and their gaps turn out to be **bays rather than islands** — open to
 * the outside, so the covered region is one deeply indented simply-connected patch
 * whose boundary runs right through the middle of the figure. Measured: Sun gen 3 has
 * exactly one boundary cycle, and it encloses 1590.5 against a covered area of
 * 1590.5, so there is nothing enclosed that is not covered. Testing against that
 * outline therefore calls a gap "outside the patch" and withholds every solid near
 * one — which is the daylight seen in the middle of a large patch with the cups drawn.
 *
 * The P1 layer does know. It records every tile laid down, including the ones that
 * emit nothing, so the union of its outlines is the region the patch decided. A gap
 * inside it is a genuine absence; only its outer edge is a cut.
 *
 * Rasterized once, because there are hundreds of tiles and tens of thousands of points
 * to test.
 */
function insideP1Footprint(): (q: P2) => boolean {
    const polys: P2[][] = [];
    for (const t of allP1Tiles) {
        const o = p1TileOutline(t);
        if (o.length > 2) polys.push(o.map((q) => [q.x, q.y] as P2));
    }
    if (!polys.length) return () => false;

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const poly of polys) {
        for (const q of poly) {
            if (q[0] < x0) x0 = q[0];
            if (q[0] > x1) x1 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[1] > y1) y1 = q[1];
        }
    }
    // an eighth of an edge; the footprint is measured in tiling units, not lift units
    const edge = vertexList.length > 1 ? p1Edge() : 1;
    const CELL = Math.max(edge / 8, 1e-6);
    const W = Math.ceil((x1 - x0) / CELL) + 2;
    const H = Math.ceil((y1 - y0) / CELL) + 2;
    const grid = new Uint8Array(W * H);
    for (const poly of polys) {
        let ylo = Infinity;
        let yhi = -Infinity;
        for (const q of poly) {
            if (q[1] < ylo) ylo = q[1];
            if (q[1] > yhi) yhi = q[1];
        }
        const r0 = Math.max(0, Math.floor((ylo - y0) / CELL));
        const r1 = Math.min(H - 1, Math.ceil((yhi - y0) / CELL));
        for (let r = r0; r <= r1; r++) {
            const y = y0 + (r + 0.5) * CELL;
            const cuts: number[] = [];
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const a = poly[i];
                const b = poly[j];
                if (a[1] > y !== b[1] > y) {
                    cuts.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
                }
            }
            cuts.sort((p, q) => p - q);
            for (let k = 0; k + 1 < cuts.length; k += 2) {
                const c0 = Math.max(0, Math.ceil((cuts[k] - x0) / CELL - 0.5));
                const c1 = Math.min(W - 1, Math.floor((cuts[k + 1] - x0) / CELL - 0.5));
                for (let c = c0; c <= c1; c++) grid[r * W + c] = 1;
            }
        }
    }
    return (q: P2) => {
        const c = Math.round((q[0] - x0) / CELL - 0.5);
        const r = Math.round((q[1] - y0) / CELL - 0.5);
        if (c < 0 || r < 0 || c >= W || r >= H) return false;
        return grid[r * W + c] === 1;
    };
}


/** Mean tiling-coordinate edge length, which is not the lift's unit edge. */
function p1Edge(): number {
    const r = allRhombs[0];
    if (!r) return 1;
    return Math.hypot(r.verts[1].x - r.verts[0].x, r.verts[1].y - r.verts[0].y);
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
                    homeCount: 0,
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

    // Settledness, tested on the ten candidate face *centroids* rather than their
    // corners: a face lying exactly along the edge should not be a coin toss. The
    // centroids are mapped into tiling coordinates, where the P1 footprint lives —
    // the lift's planar image is the same picture at a different scale and rotation.
    const inside = insideP1Footprint();
    const dirs = lift.dirs;
    const L = lift.L;
    const anchorN = lift.n[0];
    const anchorP = vertexList[0]?.pos;
    const tiling = (n: number[]): P2 => {
        let x = 0;
        let y = 0;
        for (let i = 0; i < 5; i++) {
            const d = n[i] - (anchorN ? anchorN[i] : 0);
            x += d * Math.cos(dirs[i]) * L;
            y += d * Math.sin(dirs[i]) * L;
        }
        return [x + (anchorP?.x ?? 0), y + (anchorP?.y ?? 0)];
    };
    // Home before settledness, so the two can be read together.
    const home: number[] = [];
    for (const f of faces) {
        const [a, b] = f.solids;
        home[f.id] = solids[a].faces.length >= solids[b].faces.length ? a : b;
    }
    for (const id of home) if (id !== undefined) solids[id].homeCount++;

    for (const s of solids) {
        s.complete = s.faces.length === 10;
        const t = s.faces.filter((fid) => byRhomb[fid].thick).length;
        s.makeup = `${s.faces.length}=${t}T+${s.faces.length - t}t`;
        s.settled = candidateCorners(s.m).every((c) => {
            let x = 0;
            let y = 0;
            for (const n of c.corners) {
                const q = tiling(n);
                x += q[0] / 4;
                y += q[1] / 4;
            }
            return inside([x, y]);
        });
    }

    return { solids, faces, byRhomb, home, residual };
}

// ── policies, kept visibly separate from the geometry ──────────────

/**
 * Rhomb id → the solid it calls home. Just `Centers.home`, kept as a function because
 * that is how the page asked for it first.
 *
 * A face lies on exactly two solids and nothing in the geometry prefers either, so
 * any single-valued coloring of the roof is a *choice*. Taking the larger of the two
 * is the obvious one, and it is what makes "nail head" definable at all.
 */
export function assignLargestFirst(cen: Centers): number[] {
    return cen.home;
}

/** The Pe5 tiles of the P1 layer that emitted a full five-rhomb rosette. Every one
 *  of them carries a complete triacontahedron, and nothing else does — the census
 *  `tools/centers.mjs` checks. */
export function pe5Rosettes(): number[] {
    return allP1Tiles
        .filter((t) => t.type === "Pe5" && t.rhombIds.length === 5)
        .map((t) => t.id);
}
