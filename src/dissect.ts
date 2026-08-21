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

let cached: Cell[] | null = null;

/** One dissection of the triacontahedron into its twenty cells. Cached. */
export function dissection(): Cell[] {
    if (cached) return cached;
    const triples: number[][] = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) triples.push([i, j, k]);
    const options = triples.map((T, ti) => {
        const out: Cell[] = [];
        for (let s = 0; s < 8; s++) {
            out.push(makeCell(T, [s & 1 ? 1 : -1, s & 2 ? 1 : -1, s & 4 ? 1 : -1], ti));
        }
        return out;
    });
    const chosen: Cell[] = [];
    const solve = (i: number): boolean => {
        if (i === options.length) return true;
        for (const c of options[i]) {
            if (!chosen.every((p) => disjoint(p, c))) continue;
            chosen.push(c);
            if (solve(i + 1)) return true;
            chosen.pop();
        }
        return false;
    };
    if (!solve(0)) throw new Error("no dissection found — the search is wrong, not the solid");
    cached = chosen.map((c, i) => ({ ...c, id: i }));
    return cached;
}

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
const PAIR_COLOR: Record<string, number> = (() => {
    const out: Record<string, number> = {};
    const put = (a: number, b: number, k: number) => {
        out[`${Math.min(a, b)},${Math.max(a, b)}`] = k;
    };
    for (let k = 0; k < 5; k++) {
        put(5, k, k);
        put((k + 1) % 5, (k + 4) % 5, k);
        put((k + 2) % 5, (k + 3) % 5, k);
    }
    return out;
})();

/** Colour 0–4 of the face spanned by axes `i` and `j`. */
export function pairColor(i: number, j: number): number {
    return PAIR_COLOR[`${Math.min(i, j)},${Math.max(i, j)}`];
}

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
export function cageFaces(): ShellFace[] {
    const out: ShellFace[] = [];
    const seen = new Set<string>();
    for (const c of dissection()) {
        c.faces.forEach((f, fi) => {
            const mid = [0, 1, 2].map((d) => f.reduce((s, q) => s + q[d], 0) / 4);
            const key = mid.map((x) => Math.round(x * 1e6)).join(",");
            if (seen.has(key)) return;
            seen.add(key);
            // faces 2q and 2q+1 are spanned by the two axes of the triple other than q
            const q = fi >> 1;
            out.push({
                i: c.triple[(q + 1) % 3],
                j: c.triple[(q + 2) % 3],
                corners: [f[0], f[1], f[2], f[3]] as [V3, V3, V3, V3],
            });
        });
    }
    return out;
}

/** Total cell volume, which must be the triacontahedron's own. */
export const RT_VOLUME = 4 * Math.sqrt(5 + 2 * Math.sqrt(5));
export { disjoint };
