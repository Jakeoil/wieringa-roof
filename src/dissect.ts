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

/** Total cell volume, which must be the triacontahedron's own. */
export const RT_VOLUME = 4 * Math.sqrt(5 + 2 * Math.sqrt(5));
export { disjoint };
