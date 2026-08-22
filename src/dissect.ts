// The triacontahedron's dissection into twenty golden rhombic hexahedra.
//
// A zonohedron on n generators falls into C(n,3) parallelepipeds, one per triple of
// generators — the cell those three span. Six icosahedral axes therefore give **twenty**
// cells, and because every pairwise dot product is ±1/√5 every cell is a golden rhombic
// hexahedron: ten obtuse of volume 0.470228 and ten acute of 0.760845, in the ratio φ,
// summing to 4√(5+2√5), the triacontahedron's own volume. That is classical — see
// RHOMBOHEDRA.md for credit — and none of it is chosen here.
//
// What *is* chosen is the dissection. A point of the zonohedron is ½Σcₘaₘ with every
// cₘ ∈ [−1,1], and a cell fixes cₘ = ±1 on three axes while letting the other three
// run. So a cell is a triple plus a sign vector, and a dissection is one sign choice
// per triple such that no two cells overlap. **Many dissections exist**; this module
// finds one by backtracking rather than pretending it is canonical.

import { A6 } from "./centers.js";
import { pairColor } from "./geometry.js";
import type { V3 } from "./solids.js";

export interface Cell {
    id: number;
    /** which three axes the cell is spanned by */
    triple: [number, number, number];
    /** ±1 on each of the other three axes — the cell's place in the solid */
    sign: [number, number, number];
    center: V3;
    /** half-edge vectors, so a corner is `center ± e0 ± e1 ± e2` */
    e: [V3, V3, V3];
    corners: V3[];
    /** the six faces, as four corners each, wound consistently */
    faces: V3[][];
    volume: number;
    /** true for the prolate cell, volume 0.760845; false for the oblate one */
    acute: boolean;
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: V3): V3 => {
    const L = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / L, a[1] / L, a[2] / L];
};

/** Separating-axis test. Interiors only — cells of a dissection touch along faces. */
function disjoint(P: Cell, Q: Cell): boolean {
    const axes: V3[] = [];
    for (const p of [P, Q]) for (let i = 0; i < 3; i++) axes.push(cross(p.e[i], p.e[(i + 1) % 3]));
    for (const u of P.e) for (const v of Q.e) axes.push(cross(u, v));
    const d = sub(Q.center, P.center);
    for (const L of axes) {
        const n = Math.hypot(L[0], L[1], L[2]);
        if (n < 1e-12) continue;
        const u: V3 = [L[0] / n, L[1] / n, L[2] / n];
        const r1 = P.e.reduce((s, e) => s + Math.abs(dot(e, u)), 0);
        const r2 = Q.e.reduce((s, e) => s + Math.abs(dot(e, u)), 0);
        if (Math.abs(dot(d, u)) > r1 + r2 - 1e-7) return true;
    }
    return false;
}

function makeCell(triple: number[], sign: number[], id: number): Cell {
    const rest = [0, 1, 2, 3, 4, 5].filter((m) => !triple.includes(m));
    const center: V3 = [0, 0, 0];
    rest.forEach((m, q) => {
        for (let d = 0; d < 3; d++) center[d] += (sign[q] * A6[m][d]) / 2;
    });
    const e = triple.map((m) => A6[m].map((x) => x / 2) as V3) as [V3, V3, V3];
    const corners: V3[] = [];
    for (let b = 0; b < 8; b++) {
        const p: V3 = [...center];
        for (let q = 0; q < 3; q++) {
            const s = b & (1 << q) ? 1 : -1;
            for (let d = 0; d < 3; d++) p[d] += s * e[q][d];
        }
        corners.push(p);
    }
    // six faces: for each axis, the two extremes, wound round the other two
    const faces: V3[][] = [];
    for (let q = 0; q < 3; q++) {
        const [u, v] = [0, 1, 2].filter((x) => x !== q).map((x) => e[x]);
        for (const s of [1, -1]) {
            const o: V3 = [
                center[0] + s * e[q][0],
                center[1] + s * e[q][1],
                center[2] + s * e[q][2],
            ];
            faces.push([
                [o[0] - u[0] - v[0], o[1] - u[1] - v[1], o[2] - u[2] - v[2]],
                [o[0] + u[0] - v[0], o[1] + u[1] - v[1], o[2] + u[2] - v[2]],
                [o[0] + u[0] + v[0], o[1] + u[1] + v[1], o[2] + u[2] + v[2]],
                [o[0] - u[0] + v[0], o[1] - u[1] + v[1], o[2] - u[2] + v[2]],
            ]);
        }
    }
    const volume = Math.abs(dot(A6[triple[0]], cross(A6[triple[1]], A6[triple[2]])));
    return {
        id,
        triple: triple as [number, number, number],
        sign: sign as [number, number, number],
        center,
        e,
        corners,
        faces,
        volume,
        acute: volume > 0.6,
    };
}

const TRIPLES: number[][] = (() => {
    const t: number[][] = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) t.push([i, j, k]);
    return t;
})();
const TRIPLE_INDEX = new Map(TRIPLES.map((T, i) => [T.join(""), i]));

/** All eight placements of the cell on each triple. */
const OPTIONS: Cell[][] = TRIPLES.map((T, ti) =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((s) =>
        makeCell(T, [s & 1 ? 1 : -1, s & 2 ? 1 : -1, s & 4 ? 1 : -1], ti),
    ),
);

/** Every dissection, as a choice of placement per triple. There are 160. */
function allDissections(): number[][] {
    const okAB: boolean[][][][] = [];
    for (let i = 0; i < 20; i++) {
        okAB[i] = [];
        for (let a = 0; a < 8; a++) {
            okAB[i][a] = [];
            for (let j = 0; j < 20; j++) {
                okAB[i][a][j] = [];
                for (let b = 0; b < 8; b++) {
                    okAB[i][a][j][b] = i === j ? a === b : disjoint(OPTIONS[i][a], OPTIONS[j][b]);
                }
            }
        }
    }
    const out: number[][] = [];
    const pick = new Array<number>(20);
    const go = (i: number): void => {
        if (i === 20) {
            out.push(pick.slice());
            return;
        }
        for (let a = 0; a < 8; a++) {
            let good = true;
            for (let j = 0; j < i && good; j++) if (!okAB[i][a][j][pick[j]]) good = false;
            if (good) {
                pick[i] = a;
                go(i + 1);
            }
        }
    };
    go(0);
    return out;
}

/**
 * The solid's symmetry group, reduced to signed permutations of the six axes — which
 * is what lets a dissection be acted on in integers rather than in floats. Comparing
 * rotated dissections by rounded coordinates is what made an earlier count wrong.
 */
const GROUP: Array<{ pi: number[]; ep: number[] }> = (() => {
    const signed: Array<{ v: V3; m: number; s: number }> = [];
    for (let i = 0; i < 6; i++) for (const s of [1, -1]) signed.push({ v: A6[i].map((x) => x * s) as V3, m: i, s });
    const seen = new Set<string>();
    const out: Array<{ pi: number[]; ep: number[] }> = [];
    for (const u of signed) {
        for (const v of signed) {
            if (Math.abs(dot(u.v, v.v) - dot(A6[0], A6[1])) > 1e-9) continue;
            for (const hand of [1, -1]) {
                const B = [A6[0], A6[1], cross(A6[0], A6[1])];
                const C = [u.v, v.v, cross(u.v, v.v).map((x) => x * hand) as V3];
                const det = dot(B[0], cross(B[1], B[2]));
                const inv = [cross(B[1], B[2]), cross(B[2], B[0]), cross(B[0], B[1])].map(
                    (r) => r.map((x) => x / det) as V3,
                );
                const M = [0, 1, 2].map((r) =>
                    [0, 1, 2].map((c) => C[0][r] * inv[0][c] + C[1][r] * inv[1][c] + C[2][r] * inv[2][c]),
                );
                const apply = (p: V3): V3 =>
                    [0, 1, 2].map((r) => M[r][0] * p[0] + M[r][1] * p[1] + M[r][2] * p[2]) as V3;
                const pi: number[] = [];
                const ep: number[] = [];
                let good = true;
                for (let m = 0; m < 6 && good; m++) {
                    const w = apply(A6[m]);
                    const hit = signed.find(
                        (t) => Math.hypot(w[0] - t.v[0], w[1] - t.v[1], w[2] - t.v[2]) < 1e-9,
                    );
                    if (!hit) good = false;
                    else {
                        pi[m] = hit.m;
                        ep[m] = hit.s;
                    }
                }
                if (!good || new Set(pi).size !== 6) continue;
                const k = pi.join("") + "|" + ep.join("");
                if (seen.has(k)) continue;
                seen.add(k);
                out.push({ pi, ep });
            }
        }
    }
    return out;
})();

/** A dissection as a canonical string, for comparison under the group. */
function canonical(sol: number[]): string {
    return sol
        .map((a, ti) => {
            const c = OPTIONS[ti][a];
            const rest = [0, 1, 2, 3, 4, 5].filter((m) => !c.triple.includes(m));
            return `${c.triple.join("")}:${rest.map((m, q) => `${m}${c.sign[q] > 0 ? "+" : "-"}`).join("")}`;
        })
        .sort()
        .join("|");
}

function actOn(sol: number[], g: { pi: number[]; ep: number[] }): number[] {
    const out = new Array<number>(20);
    sol.forEach((a, ti) => {
        const c = OPTIONS[ti][a];
        const T2 = c.triple.map((m) => g.pi[m]).sort((x, y) => x - y);
        const ti2 = TRIPLE_INDEX.get(T2.join(""))!;
        const rest = [0, 1, 2, 3, 4, 5].filter((m) => !c.triple.includes(m));
        const rest2 = [0, 1, 2, 3, 4, 5].filter((m) => !T2.includes(m));
        const s2 = new Array<number>(3);
        rest.forEach((m, q) => {
            s2[rest2.indexOf(g.pi[m])] = c.sign[q] * g.ep[m];
        });
        let bits = 0;
        s2.forEach((v, q) => {
            if (v > 0) bits |= 1 << q;
        });
        out[ti2] = bits;
    });
    return out;
}

/** How many of the solid's 120 symmetries a dissection keeps. */
export function stabilizerOrder(sol: number[]): number {
    const k = canonical(sol);
    return GROUP.filter((g) => canonical(actOn(sol, g)) === k).length;
}

export type DissectionKind = "chiral" | "symmetric";

const cached = new Map<DissectionKind, Cell[]>();

/**
 * A dissection of the triacontahedron into its twenty cells.
 *
 * **There are exactly two, up to rotation and reflection** — 160 with positions fixed
 * in space, falling into orbits of 120 and 40 under the solid's group of order 120.
 * The large orbit keeps no symmetry at all; the small one keeps a **three-fold axis**.
 * Both are ten acute and ten obtuse.
 */
export function dissection(kind: DissectionKind = "chiral"): Cell[] {
    const hit = cached.get(kind);
    if (hit) return hit;
    const all = allDissections();
    const want = kind === "symmetric" ? 3 : 1;
    const sol = all.find((s) => stabilizerOrder(s) === want);
    if (!sol) throw new Error(`no ${kind} dissection found — the search is wrong, not the solid`);
    const cells = sol.map((a, ti) => ({ ...OPTIONS[ti][a], id: ti }));
    cached.set(kind, cells);
    return cells;
}

/** All 160, for counting. */
export { allDissections };

// ── the five-colouring ────────────────────────────────────────────
//
// Each face of the triacontahedron is spanned by a **pair** of the six axes, and the
// five faces around a five-valent vertex are exactly the five pairs containing that
// vertex's axis. So "every rosette shows all five colours" says that pairs sharing an
// axis must differ — which is a **proper edge colouring of K₆**, and K₆ needs exactly
// five colours (χ′(K₂ₙ) = 2n − 1). A colour class is then a perfect matching, three
// pairs each, five classes covering all fifteen.
//
// Everything Jeff described follows without being imposed:
//
//   * opposite faces of the solid share an axis pair, so they share a colour;
//   * a cell's six faces come in three opposite pairs, one per axis pair of its triple,
//     so **opposite faces of a hexahedron are the same colour** — automatic, not a
//     constraint;
//   * the three pairs of a triple share an axis pairwise, so a cell shows exactly
//     **three distinct colours**;
//   * and there are C(5,3) = 10 such triples, borne once by an acute cell and once by
//     an obtuse one. That is the labelling of the classical Kowalewski puzzle, whose
//     colour-matching assemblies George Hart counts at 320.
//
// Construction: the pentagon 0–4 with axis 5 at the centre. Colour k matches 5 with k
// and the two pairs straddling k.
// The colouring itself lives in `geometry.ts`, at the bottom of the import graph, so
// the roof and the printed nets can reach it without closing a cycle back through here.
export { pairColor };

/** Colour 0–4 of face `f` of a cell. Faces `2q` and `2q+1` are the opposite pair
 *  perpendicular to the cell's `q`-th edge, and are spanned by the other two axes —
 *  which is why they come out the same colour. */
export function faceColor(c: Cell, f: number): number {
    const q = f >> 1;
    return pairColor(c.triple[(q + 1) % 3], c.triple[(q + 2) % 3]);
}

/** The three colours a cell wears, sorted — one of the ten 3-subsets of five. */
export function cellColors(c: Cell): number[] {
    return [0, 2, 4].map((f) => faceColor(c, f)).sort((a, b) => a - b);
}

// ── the shell ─────────────────────────────────────────────────────

export interface ShellFace {
    corners: [V3, V3, V3, V3];
    /** the two axes the face is spanned by — which is what gives it its colour */
    i: number;
    j: number;
    /** on the solid's own surface, rather than inside it. Exactly the faces belonging
     *  to one cell instead of two: thirty out of the seventy-five. */
    outer: boolean;
    /**
     * Per edge `k` (from corner `k` to `k+1`), whether that edge lies on the solid's
     * surface.
     *
     * Needed because dropping the outer *faces* does not drop the outer *outline*: an
     * internal face can reach the surface along an edge, and 54 of the solid's 60 edges
     * are drawn that way. Filtering faces leaves the silhouette behind; filtering edges
     * is what actually strips it.
     */
    edgeOuter: [boolean, boolean, boolean, boolean];
}

/**
 * The thirty faces of the triacontahedron itself, each with the axis pair that spans
 * it. Built here rather than taken from `solids.ts` because the pair is the point: it
 * is what the five-colouring keys on, and a bare list of corners has lost it.
 *
 * Note this is the **shell** only. The cage on the page is a different and larger
 * thing — see `cageFaces`.
 */
export function shellFaces(): ShellFace[] {
    const out: ShellFace[] = [];
    for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
            for (const flip of [1, -1]) {
                const n = cross(A6[i], A6[j]).map((x) => x * flip) as V3;
                const base: V3 = [0, 0, 0];
                for (let m = 0; m < 6; m++) {
                    if (m === i || m === j) continue;
                    const s = Math.sign(dot(n, A6[m]));
                    for (let d = 0; d < 3; d++) base[d] += (s * A6[m][d]) / 2;
                }
                const a = A6[i].map((x) => x / 2) as V3;
                const b = A6[j].map((x) => x / 2) as V3;
                out.push({
                    i,
                    j,
                    outer: true,
                    edgeOuter: [true, true, true, true],
                    corners: [
                        [base[0] - a[0] - b[0], base[1] - a[1] - b[1], base[2] - a[2] - b[2]],
                        [base[0] + a[0] - b[0], base[1] + a[1] - b[1], base[2] + a[2] - b[2]],
                        [base[0] + a[0] + b[0], base[1] + a[1] + b[1], base[2] + a[2] + b[2]],
                        [base[0] - a[0] + b[0], base[1] - a[1] + b[1], base[2] - a[2] + b[2]],
                    ],
                });
            }
        }
    }
    return out;
}

/**
 * Every distinct face of the assembled dissection — the **cage**.
 *
 * Not the shell. This is all six faces of all twenty cells, at their home positions,
 * which is the whole internal skeleton and not merely the outside. Adjacent cells share
 * their common face, so the 120 cell-faces collapse to **75 distinct** ones: the 30 of
 * the shell, belonging to one cell each, and 45 internal, belonging to two.
 *
 * Deduplicating matters rather than being tidy — two coincident copies of an internal
 * face z-fight, which looks like a rendering fault.
 */
export function cageFaces(kind: DissectionKind = "chiral"): ShellFace[] {
    const byKey = new Map<string, { face: ShellFace; n: number }>();
    for (const c of dissection(kind)) {
        c.faces.forEach((f, fi) => {
            const mid = [0, 1, 2].map((d) => f.reduce((s, q) => s + q[d], 0) / 4);
            const key = mid.map((x) => Math.round(x * 1e6)).join(",");
            const hit = byKey.get(key);
            if (hit) {
                hit.n++;
                return;
            }
            // faces 2q and 2q+1 are spanned by the two axes of the triple other than q
            const q = fi >> 1;
            byKey.set(key, {
                n: 1,
                face: {
                    i: c.triple[(q + 1) % 3],
                    j: c.triple[(q + 2) % 3],
                    outer: false,
                    edgeOuter: [false, false, false, false],
                    corners: [f[0], f[1], f[2], f[3]] as [V3, V3, V3, V3],
                },
            });
        });
    }
    // A face belonging to one cell is on the surface; one belonging to two is inside.
    // That is what tells the shell from the interior, and it needs no geometry.
    return [...byKey.values()].map(({ face, n }) => {
        const eo = [0, 1, 2, 3].map((k) => {
            const a = face.corners[k];
            const b = face.corners[(k + 1) % 4];
            const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
            return onSurface(a) && onSurface(b) && onSurface(mid);
        }) as [boolean, boolean, boolean, boolean];
        return { ...face, outer: n === 1, edgeOuter: eo };
    });
}

/** Is a point on the solid's surface — that is, extreme in some face direction? */
function onSurface(p: V3): boolean {
    for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
            const n = cross(A6[i], A6[j]);
            const L = Math.hypot(n[0], n[1], n[2]);
            const h = (Math.abs(dot(p, n)) / L);
            if (Math.abs(h - RT_INRADIUS) < 1e-9) return true;
        }
    }
    return false;
}

const RT_INRADIUS = Math.sqrt(1 + 2 / Math.sqrt(5));

// ── what two triacontahedra share ─────────────────────────────────

export interface Region {
    /** each face, corners in order round it, and which parent's plane it came from */
    faces: Array<{ corners: V3[]; from: "a" | "b" | "both" }>;
    volume: number;
    vertices: number;
    /** true when every face is a parallelogram — that is, when the region is a
     *  zonohedron. Only the one-axis offset manages it. */
    zonohedron: boolean;
}

const FACE_NORMALS: V3[] = (() => {
    const out: V3[] = [];
    for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
            const n = cross(A6[i], A6[j]);
            const L = Math.hypot(n[0], n[1], n[2]);
            out.push([n[0] / L, n[1] / L, n[2] / L]);
        }
    }
    return out;
})();

const RHO_ = Math.sqrt(1 + 2 / Math.sqrt(5));

/**
 * The region shared by the triacontahedron and a copy of it translated by `t`.
 *
 * Both are intersections of the same fifteen slabs, so the shared region is an
 * intersection of fifteen slabs too — a convex polytope, centrally symmetric about
 * `t/2`. Found by solving every triple of bounding planes and keeping the feasible
 * points, which is exact where sampling would not be.
 */
export function intersection(t: V3): Region {
    const lo = FACE_NORMALS.map((u) => Math.max(-RHO_, dot(u, t) - RHO_));
    const hi = FACE_NORMALS.map((u) => Math.min(RHO_, dot(u, t) + RHO_));
    if (FACE_NORMALS.some((_, k) => lo[k] > hi[k] + 1e-12)) {
        return { faces: [], volume: 0, vertices: 0, zonohedron: false };
    }
    // Each bounding plane belongs to the parent it came from — or to both, where the
    // two agree, which is what a shared face looks like.
    const planes: Array<{ n: V3; d: number; from: "a" | "b" | "both" }> = [];
    FACE_NORMALS.forEach((u, k) => {
        const aHi = RHO_;
        const bHi = dot(u, t) + RHO_;
        planes.push({
            n: u,
            d: hi[k],
            from: Math.abs(aHi - bHi) < 1e-9 ? "both" : hi[k] === aHi ? "a" : "b",
        });
        const aLo = -RHO_;
        const bLo = dot(u, t) - RHO_;
        planes.push({
            n: [-u[0], -u[1], -u[2]],
            d: -lo[k],
            from: Math.abs(aLo - bLo) < 1e-9 ? "both" : lo[k] === aLo ? "a" : "b",
        });
    });

    const feasible = (p: V3) =>
        FACE_NORMALS.every((u, k) => {
            const v = dot(u, p);
            return v >= lo[k] - 1e-9 && v <= hi[k] + 1e-9;
        });

    const verts: V3[] = [];
    const seen = new Set<string>();
    for (let a = 0; a < planes.length; a++) {
        for (let b = a + 1; b < planes.length; b++) {
            for (let c = b + 1; c < planes.length; c++) {
                const A = planes[a], B = planes[b], C = planes[c];
                const det = dot(A.n, cross(B.n, C.n));
                if (Math.abs(det) < 1e-9) continue;
                const bc = cross(B.n, C.n), ca = cross(C.n, A.n), ab = cross(A.n, B.n);
                const p: V3 = [0, 1, 2].map(
                    (i) => (A.d * bc[i] + B.d * ca[i] + C.d * ab[i]) / det,
                ) as V3;
                if (!feasible(p)) continue;
                const k = p.map((x) => Math.round(x * 1e7)).join(",");
                if (seen.has(k)) continue;
                seen.add(k);
                verts.push(p);
            }
        }
    }
    if (verts.length < 4) return { faces: [], volume: 0, vertices: verts.length, zonohedron: false };

    const faces: Region["faces"] = [];
    let volume = 0;
    let allParallelogram = true;
    for (const pl of planes) {
        const on = verts.filter((v) => Math.abs(dot(pl.n, v) - pl.d) < 1e-7);
        if (on.length < 3) continue;
        const ctr: V3 = [0, 1, 2].map((i) => on.reduce((s2, v) => s2 + v[i], 0) / on.length) as V3;
        const e1 = norm(sub(on[0], ctr));
        const e2 = cross(pl.n, e1);
        const ang = (p: V3) => Math.atan2(dot(sub(p, ctr), e2), dot(sub(p, ctr), e1));
        const ord = [...on].sort((p, q) => ang(p) - ang(q));
        let area = 0;
        for (let i = 0; i < ord.length; i++) {
            const p1 = sub(ord[i], ctr);
            const p2 = sub(ord[(i + 1) % ord.length], ctr);
            area += Math.abs(dot(pl.n, cross(p1, p2))) / 2;
        }
        volume += (pl.d * area) / 3;
        if (ord.length !== 4) allParallelogram = false;
        else {
            const d1 = sub(ord[1], ord[0]);
            const d2 = sub(ord[2], ord[3]);
            if (Math.hypot(...sub(d1, d2)) > 1e-7) allParallelogram = false;
        }
        faces.push({ corners: ord, from: pl.from });
    }
    return { faces, volume, vertices: verts.length, zonohedron: allParallelogram };
}

/** The offsets worth looking at, being the ones the packing actually produces. */
export const OFFSETS: Array<{ key: string; label: string; t: V3 }> = [
    { key: "axis", label: "One axis", t: A6[0] },
    { key: "short", label: "Short diagonal", t: sub(A6[0], A6[1]) },
    { key: "long", label: "Long diagonal", t: [A6[0][0] + A6[1][0], A6[0][1] + A6[1][1], A6[0][2] + A6[1][2]] },
    {
        key: "contact",
        label: "Face contact",
        t: (() => {
            const n = norm(cross(A6[0], A6[1]));
            return [n[0] * 2 * RHO_, n[1] * 2 * RHO_, n[2] * 2 * RHO_] as V3;
        })(),
    },
];

/** Total cell volume, which must be the triacontahedron's own. */
export const RT_VOLUME = 4 * Math.sqrt(5 + 2 * Math.sqrt(5));
export { disjoint };
