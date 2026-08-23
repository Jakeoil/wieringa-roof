// Chapter 3 — the exposed surface of an overlapping ball packing.
//
// The balls on the Packing page overlap, and Jeff's question is what is left of each
// one's surface once the parts buried inside its neighbors are taken away. Every
// neighbor at distance `d < 2r` slices a cap off, bounded by the circle where the two
// spheres meet, and what survives is a spherical patch with circular-arc edges.
//
// Two things make this tractable rather than a general CSG problem:
//
//   * every ball has the **same radius**, so the plane cutting ball `i` on account of
//     ball `j` is the perpendicular bisector of their centers — at `d/2`, always, with
//     no dependence on anything else
//   * a half-space test on a sphere is one dot product, so the whole thing is convex
//     polygon clipping, not surface intersection
//
// Where a triangle edge crosses a cutting plane the crossing point is placed on the
// sphere **exactly** rather than on the chord, by solving for where the great-circle arc
// between its endpoints meets the plane. The boundary vertices are therefore on the true
// intersection circle; only the segments between them are straight, and they shorten with
// the tessellation. `tools/cutaway.mjs` checks this against the analytic two-ball case,
// where the exposed area is known in closed form.

import { RT_FACES, cupIndices } from "./centers.js";
import type { Solid } from "./centers.js";
import type { V3 } from "./geometry.js";

export interface CutawayOpts {
    radius: number;
    /**
     * Keep only the surface under the rhombs the solid actually owns, instead of the
     * whole sphere. A class-10 solid then shows the spherical image of its ten-face cap,
     * a class-4 solid four rhombs' worth, and so on.
     */
    ownFacesOnly: boolean;
    /** subdivision per rhomb edge, or icosahedron subdivisions when showing all of it */
    detail: number;
    /**
     * Which `RT_FACES` indices a ball owns, when `ownFacesOnly`. Supplied by the caller
     * because it needs the whole `Centers` structure to work out, which this module has
     * no other use for. Without it the ten-face cup is used, which is what the solid
     * *could* show rather than what it does.
     */
    facesOf?: (ball: Solid, index: number) => number[];
}

export interface CutSphere {
    ball: number;
    /** triangles in world space, three floats per vertex */
    positions: number[];
    /** exposed area of this ball, by tessellation */
    area: number;
    /** neighbors near enough to cut it */
    cutBy: number;
}

export interface CutawayResult {
    spheres: CutSphere[];
    /** exposed area summed over every ball */
    exposed: number;
    /** what the same balls would have if none of them met: `n · 4πr²` */
    bare: number;
    /** the surface offered before cutting — the whole sphere, or just the owned caps */
    offered: number;
    cutPairs: number;
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / L, a[1] / L, a[2] / L];
};
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

/**
 * Where the great-circle arc from `A` to `B` meets the plane `p·u = h`.
 *
 * Both endpoints lie on the sphere of radius `r`. Writing `V(t) = A + t(B−A)` and
 * `P(t) = r·V/|V|`, the condition `P·u = h` squares to a quadratic in `t`, which is
 * solved directly. Interpolating on the chord instead would put the boundary inside the
 * sphere and the arcs would visibly cut corners.
 */
function arcCross(A: V3, B: V3, u: V3, h: number, r: number): V3 {
    const a = dot(A, u);
    const b = dot(B, u) - a;
    const s = dot(A, B);
    const r2 = r * r;
    const h2 = h * h;
    const qa = r2 * b * b - h2 * (2 * r2 - 2 * s);
    const qb = 2 * r2 * a * b - 2 * h2 * (s - r2);
    const qc = r2 * a * a - h2 * r2;
    let t = -1;
    if (Math.abs(qa) < 1e-14) {
        if (Math.abs(qb) > 1e-14) t = -qc / qb;
    } else {
        const disc = qb * qb - 4 * qa * qc;
        if (disc >= 0) {
            const sq = Math.sqrt(disc);
            for (const cand of [(-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)]) {
                if (cand >= -1e-9 && cand <= 1 + 1e-9) { t = cand; break; }
            }
        }
    }
    if (t < 0 || t > 1) {
        // Degenerate quadratic — fall back on bisection, which cannot fail here because
        // the sign of `P(t)·u − h` differs at the two ends by construction.
        let lo = 0, hi = 1;
        const g = (x: number) => {
            const V: V3 = [A[0] + (B[0] - A[0]) * x, A[1] + (B[1] - A[1]) * x, A[2] + (B[2] - A[2]) * x];
            return dot(scale(norm(V), r), u) - h;
        };
        const g0 = g(0);
        for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            if ((g(mid) > 0) === (g0 > 0)) lo = mid; else hi = mid;
        }
        t = (lo + hi) / 2;
    }
    const V: V3 = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
    return scale(norm(V), r);
}

/** Sutherland–Hodgman against `p·u ≤ h`, with crossings placed on the sphere. */
function clip(poly: V3[], u: V3, h: number, r: number): V3[] {
    if (!poly.length) return poly;
    const out: V3[] = [];
    for (let i = 0; i < poly.length; i++) {
        const A = poly[i];
        const B = poly[(i + 1) % poly.length];
        const da = dot(A, u) - h;
        const db = dot(B, u) - h;
        if (da <= 0) out.push(A);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) out.push(arcCross(A, B, u, h, r));
    }
    return out;
}

const triArea = (a: V3, b: V3, c: V3): number => {
    const x: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const y: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return 0.5 * Math.hypot(
        x[1] * y[2] - x[2] * y[1],
        x[2] * y[0] - x[0] * y[2],
        x[0] * y[1] - x[1] * y[0],
    );
};

/** An icosphere of radius `r`, as a flat list of triangles. */
function icosphere(r: number, subdiv: number): V3[][] {
    const t = (1 + Math.sqrt(5)) / 2;
    let verts: V3[] = [
        [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
        [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
        [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ].map((v) => norm(v as V3));
    let tris: number[][] = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];
    for (let s = 0; s < subdiv; s++) {
        const mids = new Map<string, number>();
        const next: number[][] = [];
        const midOf = (a: number, b: number): number => {
            const key = a < b ? `${a},${b}` : `${b},${a}`;
            const had = mids.get(key);
            if (had !== undefined) return had;
            const id = verts.length;
            verts.push(norm([
                verts[a][0] + verts[b][0], verts[a][1] + verts[b][1], verts[a][2] + verts[b][2],
            ]));
            mids.set(key, id);
            return id;
        };
        for (const [a, b, c] of tris) {
            const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
            next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
        }
        tris = next;
    }
    return tris.map((f) => f.map((i) => scale(verts[i], r)) as V3[]);
}

/** The spherical image of one rhomb face, tessellated as an n×n grid. */
function facePatch(corners: V3[], r: number, n: number): V3[][] {
    const at = (i: number, j: number): V3 => {
        const u = i / n, v = j / n;
        const p: V3 = [0, 0, 0];
        // bilinear on the flat rhomb, then pushed out to the sphere
        for (let d = 0; d < 3; d++) {
            p[d] = corners[0][d] * (1 - u) * (1 - v) + corners[1][d] * u * (1 - v)
                + corners[2][d] * u * v + corners[3][d] * (1 - u) * v;
        }
        return scale(norm(p), r);
    };
    const out: V3[][] = [];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
            out.push([a, b, c], [a, c, e]);
        }
    }
    return out;
}

/**
 * The exposed surface of every ball in a packing of equal spheres.
 *
 * Neighbors are found on a uniform grid of cell size `2r`, so only the 27 cells around
 * each ball are examined — the packing runs to thousands of balls and an O(n²) sweep
 * would dominate everything else on the page.
 */
export function cutaway(balls: Solid[], opts: CutawayOpts): CutawayResult {
    const r = opts.radius;
    const cell = 2 * r;
    const grid = new Map<string, number[]>();
    const key = (p: V3) =>
        `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
    balls.forEach((s, i) => {
        const k = key(s.c);
        const had = grid.get(k);
        if (had) had.push(i); else grid.set(k, [i]);
    });

    const spheres: CutSphere[] = [];
    let exposed = 0;
    let offered = 0;
    let cutPairs = 0;

    for (let i = 0; i < balls.length; i++) {
        const c = balls[i].c;
        // cutting planes, in coordinates local to this ball
        const planes: Array<{ u: V3; h: number }> = [];
        const gi = [Math.floor(c[0] / cell), Math.floor(c[1] / cell), Math.floor(c[2] / cell)];
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
                for (let dz = -1; dz <= 1; dz++) {
                    for (const j of grid.get(`${gi[0] + dx},${gi[1] + dy},${gi[2] + dz}`) ?? []) {
                        if (j === i) continue;
                        const v: V3 = [balls[j].c[0] - c[0], balls[j].c[1] - c[1], balls[j].c[2] - c[2]];
                        const d = Math.hypot(v[0], v[1], v[2]);
                        if (d >= 2 * r - 1e-9 || d < 1e-9) continue;
                        planes.push({ u: norm(v), h: d / 2 });
                    }
                }
        cutPairs += planes.length;

        const source = opts.ownFacesOnly
            ? (opts.facesOf ? opts.facesOf(balls[i], i) : cupIndices(balls[i]))
                .flatMap((fi) => facePatch(RT_FACES[fi], r, Math.max(1, opts.detail)))
            : icosphere(r, Math.max(0, Math.min(4, opts.detail)));

        const positions: number[] = [];
        let area = 0;
        for (const tri of source) {
            offered += triArea(tri[0], tri[1], tri[2]);
            let poly: V3[] = tri;
            for (const pl of planes) {
                poly = clip(poly, pl.u, pl.h, r);
                if (poly.length < 3) break;
            }
            for (let k = 1; k + 1 < poly.length; k++) {
                area += triArea(poly[0], poly[k], poly[k + 1]);
                for (const p of [poly[0], poly[k], poly[k + 1]]) {
                    positions.push(p[0] + c[0], p[1] + c[1], p[2] + c[2]);
                }
            }
        }
        exposed += area;
        if (positions.length) spheres.push({ ball: i, positions, area, cutBy: planes.length });
    }

    return {
        spheres,
        exposed,
        bare: balls.length * 4 * Math.PI * r * r,
        offered,
        cutPairs: cutPairs / 2,
    };
}
