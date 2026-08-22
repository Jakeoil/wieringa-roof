// Chapter 4, part 4 — the roof as the boundary of a layer of golden rhombohedra.
//
// The local fact is exact and is not in doubt (jake/Triacontrahedrons are golden.md):
// every generator pair meets at 63.4349° or 116.5651°, so **any three** of the five
// lifting axes span a golden rhombohedron, and every roof rhomb is a face of one. The
// open question there is global — *"which third edge vector is chosen for each cell"* —
// and that is what this module attempts.
//
// A rhomb spans axes {j,k}; extruding it by −E_l for one of the three remaining axes
// puts a cell directly beneath it. Every generator points up, all sharing z = +1/√5, so
// −E_l is the only way down. The choice of l is free per rhomb, and the cells must not
// overlap.
//
// **It does not close.** Greedily, about 57% of rhombi can be given a cell; the rest
// have no free choice left. That is measured, not proved — a greedy assignment is not a
// proof of impossibility — but it is the honest state of the question, and it matches
// the file's own guess that the answer would be "almost" rather than "exactly".

import { allRhombs, vertexMap, roundKey, computeLift, pos3D, E5 } from "./geometry.js";
import type { V3 } from "./geometry.js";

export interface HexCell {
    /** the roof rhomb this cell hangs from */
    rhomb: number;
    /** the three axes it is spanned by */
    triple: [number, number, number];
    /** centre, and the three half-edge vectors */
    center: V3;
    e: [V3, V3, V3];
    corners: V3[];
    faces: V3[][];
    acute: boolean;
}

export interface HexLayer {
    cells: HexCell[];
    /** rhombi that got a cell, by rhomb id */
    covered: Set<number>;
    total: number;
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Interiors only — cells of a layer are meant to meet along faces. */
function disjoint(P: HexCell, Q: HexCell): boolean {
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

function makeCell(rhomb: number, m: number[], triple: [number, number, number]): HexCell {
    const base = pos3D(m);
    const e = triple.map((a) => E5[a].map((x) => x / 2) as V3) as [V3, V3, V3];
    const center: V3 = [0, 1, 2].map((d) => base[d] + e[0][d] + e[1][d] + e[2][d]) as V3;
    const corners: V3[] = [];
    for (let b = 0; b < 8; b++) {
        const p: V3 = [...center];
        for (let q = 0; q < 3; q++) {
            const s = b & (1 << q) ? 1 : -1;
            for (let d = 0; d < 3; d++) p[d] += s * e[q][d];
        }
        corners.push(p);
    }
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
    // Acute when the three axes are pairwise adjacent in the five-fold order — the same
    // sign-of-the-dot-products test the triacontahedron's cells use, read off the gaps.
    const gaps = [
        [0, 1],
        [0, 2],
        [1, 2],
    ]
        .map(([x, y]) => {
            const a = triple[x];
            const b = triple[y];
            return Math.min((a - b + 5) % 5, (b - a + 5) % 5);
        })
        .sort()
        .join("");
    return { rhomb, triple, center, e, corners, faces, acute: gaps === "111" || gaps === "122" };
}

/**
 * A layer of cells hung beneath the roof, one per rhomb where one will fit.
 *
 * Greedy, most-constrained first. Call after `generatePatch()`.
 */
export function hexLayer(): HexLayer {
    const lift = computeLift();
    const options: HexCell[][] = allRhombs.map((r) => {
        const vids = r.verts.map((pt) => vertexMap.get(roundKey(pt))!.id);
        const nlo = vids
            .map((v) => lift.n[v]!)
            .reduce((a, b) => a.map((x, i) => Math.min(x, b[i])));
        const [j, k] = r.pair;
        const out: HexCell[] = [];
        for (let l = 0; l < 5; l++) {
            if (l === j || l === k) continue;
            const m = nlo.slice();
            m[l]--;
            out.push(makeCell(r.id, m, [j, k, l]));
        }
        return out;
    });

    const order = allRhombs.map((_, i) => i).sort((a, b) => options[a].length - options[b].length);
    const cells: HexCell[] = [];
    const covered = new Set<number>();
    // Bucketed, because the naive check is quadratic and a generation-4 patch would ask
    // for a hundred million comparisons. A cell reaches at most 1.192 from its centre,
    // so nothing outside the neighbouring cells of a 2.5 grid can touch it.
    const CELL = 2.5;
    const grid = new Map<string, HexCell[]>();
    const keyOf = (c: V3) =>
        `${Math.floor(c[0] / CELL)},${Math.floor(c[1] / CELL)},${Math.floor(c[2] / CELL)}`;
    const near = (c: HexCell): HexCell[] => {
        const [a, b, d] = [0, 1, 2].map((i) => Math.floor(c.center[i] / CELL));
        const out: HexCell[] = [];
        for (let x = a - 1; x <= a + 1; x++)
            for (let y = b - 1; y <= b + 1; y++)
                for (let z = d - 1; z <= d + 1; z++) {
                    const hit = grid.get(`${x},${y},${z}`);
                    if (hit) out.push(...hit);
                }
        return out;
    };
    for (const i of order) {
        for (const c of options[i]) {
            if (near(c).every((p) => disjoint(p, c))) {
                cells.push(c);
                covered.add(c.rhomb);
                const k = keyOf(c.center);
                const cur = grid.get(k);
                if (cur) cur.push(c);
                else grid.set(k, [c]);
                break;
            }
        }
    }
    return { cells, covered, total: allRhombs.length };
}
