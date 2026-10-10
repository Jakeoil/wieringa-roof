// The golden zonohedra and their dissection into golden rhombic hexahedra.
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

// ── which axes ────────────────────────────────────────────────────
//
// Nothing above says *six*. Take any k of the six axes and the same argument runs: the
// zonohedron on them has k(k−1) faces and C(k,3) cells, and since all fifteen pairs of
// the six meet at the same angle, every face is the same golden rhombus whichever k you
// keep. So this module is written for an **axis set**, and six is only its default.
//
// Indices stay **global** — an axis is its index into `A6`, never renumbered 0…k−1 —
// which is what keeps the five-coloring meaning one thing across the family: `pairColor`
// is defined on pairs of the six, and a smaller solid simply shows fewer of the fifteen.

export type AxisSet = readonly number[];

/** All six: the triacontahedron, and the default throughout this module. */
export const AXES6: AxisSet = [0, 1, 2, 3, 4, 5];

/**
 * The golden zonohedra, by how many of the six axes they stand on.
 *
 * *Which* subset is taken does not matter for the two middle ones — all six 5-subsets
 * are congruent, and so are all fifteen 4-subsets, measured in RHOMBOHEDRA.md §2½. The
 * Three axes are the exception, and there the choice of triple is the whole point: ten
 * of the twenty triples span the acute hexahedron and ten the oblate one, so both are
 * listed. {0,1,3} is an acute triple and {0,1,2} an oblate one. They are the two shapes
 * every larger solid in the family is built from, which is why they belong here even
 * though a single cell has no dissection to show.
 */
export const SOLIDS: Array<{ key: string; label: string; axes: AxisSet }> = [
    { key: "rt", label: "Triacontahedron", axes: AXES6 },
    { key: "ico", label: "Golden icosahedron", axes: [0, 1, 2, 3, 4] },
    { key: "dod", label: "Golden dodecahedron", axes: [0, 1, 2, 3] },
    { key: "acute", label: "Acute hexahedron", axes: [0, 1, 3] },
    { key: "oblate", label: "Oblate hexahedron", axes: [0, 1, 2] },
];

/** Faces and cells of the solid on `axes` — k(k−1) and C(k,3). */
export function solidCounts(axes: AxisSet = AXES6): { faces: number; cells: number } {
    const k = axes.length;
    return { faces: k * (k - 1), cells: (k * (k - 1) * (k - 2)) / 6 };
}

export interface Cell {
    id: number;
    /** which three axes the cell is spanned by */
    triple: [number, number, number];
    /** ±1 on each axis of the set outside the triple — the cell's place in the solid.
     *  One entry per axis beyond the three, so it is empty on a lone rhombohedron and
     *  three long on the triacontahedron. */
    sign: number[];
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

function makeCell(triple: number[], sign: number[], id: number, axes: AxisSet): Cell {
    const rest = axes.filter((m) => !triple.includes(m));
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
        sign,
        center,
        e,
        corners,
        faces,
        volume,
        acute: volume > 0.6,
    };
}

/**
 * Everything that depends on the axis set alone, built once per set.
 *
 * The cost is in `options` and in the pairwise-disjoint table below it, both quadratic
 * in the cell count, so a set is worked out on first use and then kept.
 */
interface Ctx {
    axes: AxisSet;
    /** the C(k,3) triples of the set, in lexicographic order */
    triples: number[][];
    index: Map<string, number>;
    /** all 2^(k−3) placements of the cell on each triple */
    options: Cell[][];
    /** the solid's own symmetries, as signed permutations of the six axes */
    group: Array<{ pi: number[]; ep: number[] }>;
    /**
     * Where each placement goes under each symmetry: `act[g][ti][a]` is the triple and
     * placement that cell lands on. Worked out once, because the alternative is working
     * it out again for every symmetry of every dissection — the stabiliser of all of
     * them is wanted before one can be picked, and at six axes that is 160 × 120.
     */
    act: Array<Array<Array<[number, number]>>>;
}

const CTX = new Map<string, Ctx>();

function ctx(axes: AxisSet = AXES6): Ctx {
    const key = axes.join("");
    const hit = CTX.get(key);
    if (hit) return hit;
    const triples: number[][] = [];
    for (let i = 0; i < axes.length; i++)
        for (let j = i + 1; j < axes.length; j++)
            for (let k = j + 1; k < axes.length; k++) triples.push([axes[i], axes[j], axes[k]]);
    const places = 1 << (axes.length - 3);
    const built: Ctx = {
        axes,
        triples,
        index: new Map(triples.map((T, i) => [T.join(""), i])),
        options: triples.map((T, ti) =>
            Array.from({ length: places }, (_, s) =>
                makeCell(
                    T,
                    Array.from({ length: axes.length - 3 }, (_, q) => (s & (1 << q) ? 1 : -1)),
                    ti,
                    axes,
                ),
            ),
        ),
        // A symmetry of the solid is a symmetry of the six axes that keeps this subset
        // to itself. At six axes that is all 120 of them; at five it is the 20 that fix
        // the axis left out, and at four the 8 that fix the pair left out.
        group: ICO_GROUP.filter((g) => axes.every((m) => axes.includes(g.pi[m]))),
        act: [],
    };
    built.act = built.group.map((g) =>
        triples.map((T, ti) =>
            built.options[ti].map((c) => {
                const T2 = T.map((m) => g.pi[m]).sort((x, y) => x - y);
                const ti2 = built.index.get(T2.join(""))!;
                const rest = axes.filter((m) => !T.includes(m));
                const rest2 = axes.filter((m) => !T2.includes(m));
                let bits = 0;
                rest.forEach((m, q) => {
                    if (c.sign[q] * g.ep[m] > 0) bits |= 1 << rest2.indexOf(g.pi[m]);
                });
                return [ti2, bits] as [number, number];
            }),
        ),
    );
    CTX.set(key, built);
    return built;
}

/** Every dissection of the solid, as a choice of placement per triple. */
function allDissections(axes: AxisSet = AXES6): number[][] {
    const { triples, options } = ctx(axes);
    const n = triples.length;
    const places = options[0].length;
    const okAB: boolean[][][][] = [];
    for (let i = 0; i < n; i++) {
        okAB[i] = [];
        for (let a = 0; a < places; a++) {
            okAB[i][a] = [];
            for (let j = 0; j < n; j++) {
                okAB[i][a][j] = [];
                for (let b = 0; b < places; b++) {
                    okAB[i][a][j][b] = i === j ? a === b : disjoint(options[i][a], options[j][b]);
                }
            }
        }
    }
    const out: number[][] = [];
    const pick = new Array<number>(n);
    const go = (i: number): void => {
        if (i === n) {
            out.push(pick.slice());
            return;
        }
        for (let a = 0; a < places; a++) {
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
 * The icosahedral group, reduced to signed permutations of the six axes — which is what
 * lets a dissection be acted on in integers rather than in floats. Comparing rotated
 * dissections by rounded coordinates is what made an earlier count wrong.
 *
 * There are 120 of them, and a solid on fewer axes keeps the ones that permute its own
 * subset among itself; `ctx` does that filtering.
 */
const ICO_GROUP: Array<{ pi: number[]; ep: number[] }> = (() => {
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

/** A dissection moved by the symmetry `gi`. */
function actOn(sol: number[], gi: number, cx: Ctx): number[] {
    const tab = cx.act[gi];
    const out = new Array<number>(cx.triples.length);
    for (let ti = 0; ti < sol.length; ti++) {
        const [ti2, a2] = tab[ti][sol[ti]];
        out[ti2] = a2;
    }
    return out;
}

/**
 * How many of the solid's own symmetries a dissection keeps — out of 120 on the
 * triacontahedron, 20 on the golden icosahedron, 8 on the golden dodecahedron.
 *
 * No canonical form is needed to compare two dissections: the array *is* one, since
 * position is the triple and the entry is the sign vector on the axes outside it, both
 * in a fixed order. An earlier version spelled each cell out as `triple:signs`, sorted
 * the twenty strings and compared those, which says the same thing far more slowly.
 */
export function stabilizerOrder(sol: number[], axes: AxisSet = AXES6): number {
    const cx = ctx(axes);
    let n = 0;
    for (let gi = 0; gi < cx.group.length; gi++) {
        const moved = actOn(sol, gi, cx);
        let same = true;
        for (let ti = 0; ti < sol.length && same; ti++) if (moved[ti] !== sol[ti]) same = false;
        if (same) n++;
    }
    return n;
}

/** How many symmetries the solid has at all. */
export function groupOrder(axes: AxisSet = AXES6): number {
    return ctx(axes).group.length;
}

export type DissectionKind = "chiral" | "symmetric";

const cached = new Map<string, Cell[]>();

/**
 * A dissection of the solid into its C(k,3) cells.
 *
 * On the triacontahedron **there are exactly two, up to rotation and reflection** — 160
 * with positions fixed in space, falling into orbits of 120 and 40 under the solid's
 * group of order 120. The large orbit keeps no symmetry at all; the small one keeps a
 * **three-fold axis**. Both are ten acute and ten obtuse.
 *
 * The two kinds are asked for by symmetry rather than by number, so they mean something
 * on the smaller solids too: `chiral` is the least symmetric dissection the solid has
 * and `symmetric` the most. **Only the triacontahedron has two**; on the golden
 * icosahedron all ten labelled dissections form a single orbit under its group of 20,
 * on the golden dodecahedron both form one orbit under its group of 8, and the
 * rhombohedron is its own cell. Below six axes the two names return the same thing.
 */
export function dissection(kind: DissectionKind = "chiral", axes: AxisSet = AXES6): Cell[] {
    const key = `${kind}|${axes.join("")}`;
    const hit = cached.get(key);
    if (hit) return hit;
    const cx = ctx(axes);
    const all = allDissections(axes);
    let sol = all[0];
    let best = stabilizerOrder(sol, axes);
    for (let i = 1; i < all.length; i++) {
        if (kind === "chiral" && best === 1) break; // nothing can beat a trivial stabiliser
        const st = stabilizerOrder(all[i], axes);
        if (kind === "symmetric" ? st > best : st < best) {
            best = st;
            sol = all[i];
        }
    }
    const cells = sol.map((a, ti) => ({ ...cx.options[ti][a], id: ti }));
    cached.set(key, cells);
    return cells;
}

/** Every dissection of the solid, for counting. */
export { allDissections };

// ── the five-coloring ────────────────────────────────────────────
//
// Each face of the triacontahedron is spanned by a **pair** of the six axes, and the
// five faces around a five-valent vertex are exactly the five pairs containing that
// vertex's axis. So "every rosette shows all five colors" says that pairs sharing an
// axis must differ — which is a **proper edge coloring of K₆**, and K₆ needs exactly
// five colors (χ′(K₂ₙ) = 2n − 1). A color class is then a perfect matching, three
// pairs each, five classes covering all fifteen.
//
// Everything Jake described follows without being imposed:
//
//   * opposite faces of the solid share an axis pair, so they share a color;
//   * a cell's six faces come in three opposite pairs, one per axis pair of its triple,
//     so **opposite faces of a hexahedron are the same color** — automatic, not a
//     constraint;
//   * the three pairs of a triple share an axis pairwise, so a cell shows exactly
//     **three distinct colors**;
//   * and there are C(5,3) = 10 such triples, borne once by an acute cell and once by
//     an obtuse one. That is the labelling of the classical Kowalewski puzzle, whose
//     color-matching assemblies George Hart counts at 320.
//
// Construction: the pentagon 0–4 with axis 5 at the center. Color k matches 5 with k
// and the two pairs straddling k.
// The coloring itself lives in `geometry.ts`, at the bottom of the import graph, so
// the roof and the printed nets can reach it without closing a cycle back through here.
export { pairColor };

// ── the coloring on fewer axes ────────────────────────────────────
//
// On k axes the same demand — faces sharing an axis must differ — is a proper edge
// coloring of K_k, and χ′(K_k) is k−1 for even k and k for odd. So the number of colors
// is **not** five for the whole family:
//
//   k = 6  five   ·  k = 5  five  ·  k = 4  **three**  ·  k = 3  three
//
// Restricting K₆'s five to a subset is already optimal at five axes and at three: at
// five, each perfect matching loses the one pair through the dropped axis and the other
// two survive, so all five classes stay non-empty; at three, two pairs of a triple
// always share an axis and so never share a class. **Four axes is the exception** — all
// fifteen 4-subsets take colors from all five classes, where three would do — and it
// gets K₄'s own coloring instead, its three perfect matchings.
//
// Where the restriction is used, the classes it leaves are renumbered to run from zero,
// so a scheme still takes colors from the front of a palette rather than from wherever
// the six-axis numbering happened to put them.

interface Coloring {
    /** the class of the face spanned by axes `i` and `j` */
    of: (i: number, j: number) => number;
    /** how many classes there are — the scheme's color count on this solid */
    n: number;
}

const COLORINGS = new Map<string, Coloring>();

function coloring(axes: AxisSet): Coloring {
    const key = axes.join("");
    const hit = COLORINGS.get(key);
    if (hit) return hit;
    let built: Coloring;
    if (axes.length === 4) {
        // K₄'s three perfect matchings, by position in the set rather than by axis, so
        // which four axes they are makes no difference: {01,23}, {02,13}, {03,12}. The
        // partner of a pair {p,q} with p > 0 is {0,r} with r = 6 − p − q, the positions
        // summing to six.
        const pos = new Map(axes.map((m, q) => [m, q]));
        built = {
            n: 3,
            of: (i, j) => {
                const a = pos.get(i)!, b = pos.get(j)!;
                const p = Math.min(a, b), q = Math.max(a, b);
                return p === 0 ? q - 1 : 6 - p - q - 1;
            },
        };
    } else {
        const used = new Set<number>();
        for (let a = 0; a < axes.length; a++)
            for (let b = a + 1; b < axes.length; b++) used.add(pairColor(axes[a], axes[b]));
        const rank = new Map([...used].sort((x, y) => x - y).map((c, r) => [c, r]));
        built = { n: rank.size, of: (i, j) => rank.get(pairColor(i, j))! };
    }
    COLORINGS.set(key, built);
    return built;
}

/** How many colors the five-coloring scheme actually needs on this solid. */
export function classCount(axes: AxisSet = AXES6): number {
    return coloring(axes).n;
}

/** The class of the face spanned by axes `i` and `j`. At six axes this is `pairColor`. */
export function pairColorOn(i: number, j: number, axes: AxisSet = AXES6): number {
    return coloring(axes).of(i, j);
}

/** Color of face `f` of a cell. Faces `2q` and `2q+1` are the opposite pair
 *  perpendicular to the cell's `q`-th edge, and are spanned by the other two axes —
 *  which is why they come out the same color. */
export function faceColor(c: Cell, f: number, axes: AxisSet = AXES6): number {
    const q = f >> 1;
    return pairColorOn(c.triple[(q + 1) % 3], c.triple[(q + 2) % 3], axes);
}

// ── the bands ─────────────────────────────────────────────────────
//
// A face is spanned by two axes, and its four edges run along them two and two. Those
// are the **ribbons** of the de Bruijn picture: the faces sharing an edge direction form
// a strip, and every face lies in exactly two strips — one per axis of its pair. So a
// face belongs to a pair of bands, and with k axes there are k bands and C(k,2) kinds of
// crossing: five and ten on the golden icosahedron, which is the pentagrid's own count.
//
// Which edge runs along which matters for drawing them, and it is not a convention: the
// face `2q` or `2q+1` is built as `o ± u ± v` with `u` and `v` the cell's half-edges on
// the two axes of its triple other than `q`, in ascending order. Corner 1 is corner 0
// plus 2u and corner 3 is corner 0 plus 2v, so **even edges run along the first of the
// pair and odd edges along the second**. Checked on every edge of every cell in
// `tools/dissect.mjs` rather than taken on trust.

/** The two axes a face is spanned by: its pair of bands, in ascending position. */
export function bandAxes(c: Cell, f: number): [number, number] {
    const q = f >> 1;
    const pr = [0, 1, 2].filter((x) => x !== q);
    return [c.triple[pr[0]], c.triple[pr[1]]];
}

/** Which axis edge `k` of face `f` runs along — `k` from corner `k` to corner `k+1`. */
export function edgeAxis(c: Cell, f: number, k: number): number {
    return bandAxes(c, f)[k % 2];
}

/** The colors a cell wears, sorted. Three of them wherever the solid has three axes to
 *  spare — one of the ten 3-subsets of five on the triacontahedron. */
export function cellColors(c: Cell, axes: AxisSet = AXES6): number[] {
    return [0, 2, 4].map((f) => faceColor(c, f, axes)).sort((a, b) => a - b);
}

// ── the shell ─────────────────────────────────────────────────────

export interface ShellFace {
    corners: [V3, V3, V3, V3];
    /** the two axes the face is spanned by — which is what gives it its color */
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
 * The k(k−1) faces of the solid itself, each with the axis pair that spans it — thirty
 * for the triacontahedron, twenty for the golden icosahedron, twelve for the golden
 * dodecahedron. Built here rather than taken from `solids.ts` because the pair is the
 * point: it is what the five-coloring keys on, and a bare list of corners has lost it.
 *
 * Note this is the **shell** only. The cage on the page is a different and larger
 * thing — see `cageFaces`.
 */
export function shellFaces(axes: AxisSet = AXES6): ShellFace[] {
    const out: ShellFace[] = [];
    for (let ii = 0; ii < axes.length; ii++) {
        for (let jj = ii + 1; jj < axes.length; jj++) {
            const i = axes[ii], j = axes[jj];
            for (const flip of [1, -1]) {
                const n = cross(A6[i], A6[j]).map((x) => x * flip) as V3;
                const base: V3 = [0, 0, 0];
                for (const m of axes) {
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
 * Not the shell. This is all six faces of every cell, at their home positions, which is
 * the whole internal skeleton and not merely the outside. Adjacent cells share their
 * common face, so on the triacontahedron the 120 cell-faces collapse to **75 distinct**
 * ones: the 30 of the shell, belonging to one cell each, and 45 internal, belonging to
 * two.
 *
 * Deduplicating matters rather than being tidy — two coincident copies of an internal
 * face z-fight, which looks like a rendering fault.
 */
export function cageFaces(kind: DissectionKind = "chiral", axes: AxisSet = AXES6): ShellFace[] {
    const byKey = new Map<string, { face: ShellFace; n: number }>();
    for (const c of dissection(kind, axes)) {
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
            return onSurface(a, axes) && onSurface(b, axes) && onSurface(mid, axes);
        }) as [boolean, boolean, boolean, boolean];
        return { ...face, outer: n === 1, edgeOuter: eo };
    });
}

// ── the poles ─────────────────────────────────────────────────────

/**
 * The two vertices where **all** the solid's zones meet, when it has such a pair.
 *
 * Five axes have one. The five left standing are arranged about the sixth, which is the
 * solid's own five-fold axis, and the golden icosahedron's extreme vertices along it are
 * the only two of its twenty-two where five faces meet — the others run ten of four and
 * ten of three. Each pole carries five faces and five edges, and belongs to three cells:
 * two oblate and one acute, three of whose six faces reach it.
 *
 * Nowhere else in the family. The triacontahedron has no vertex on six faces at all, its
 * thirty-two running twelve of five and twenty of three. The smaller two have valence-k
 * vertices in quantity rather than in pairs — six on the golden dodecahedron and all
 * eight on a hexahedron, every corner of a parallelepiped being one — so the vertex that
 * is a *singularity* is a five-axis thing, and this returns nothing elsewhere.
 *
 * The vertex itself is ½Σ sign(aₘ·u) aₘ over the axes in hand, `u` being the one left
 * out: the support point of the zonohedron in that direction, which is where every
 * generator agrees.
 */
export function poles(axes: AxisSet = AXES6): V3[] {
    if (axes.length !== 5) return [];
    const out = [0, 1, 2, 3, 4, 5].find((m) => !axes.includes(m));
    if (out === undefined) return [];
    const u = A6[out];
    const p: V3 = [0, 0, 0];
    for (const m of axes) {
        const sg = Math.sign(dot(A6[m], u));
        for (let d = 0; d < 3; d++) p[d] += (sg * A6[m][d]) / 2;
    }
    return [p, [-p[0], -p[1], -p[2]]];
}

/**
 * Deleting the poles, and then whatever that deletion leaves hanging.
 *
 * Taking a pole away removes the five faces and five edges on it, three faces from each
 * of the three cells that reach it. That is not the end of it. Two vertices at each end
 * are left carrying only **two** edges — on the golden icosahedron they sit one ring
 * down, at height ±0.670820 along the five-fold axis — and a vertex with two edges is no
 * longer a corner of anything: the single face still holding it is attached to the rest
 * of the surface along one edge at each side and nothing else. So it goes too, and the
 * face with it. Four faces, two at each pole, each the outer face of one of the four
 * oblate cells that reach a pole.
 *
 * **One round settles it.** After the pruning the lowest degree left is three, so the
 * loop below runs twice and stops — but it is written as a loop rather than as two
 * passes, because "delete what is left hanging" is the rule and the number of rounds is
 * a result.
 *
 * Degrees are counted on **distinct** faces, not on cell faces: an internal face belongs
 * to two cells and its edges are one edge, not two. That is also what the reader sees.
 */
export interface SingularityCut {
    /** the cell faces deleted, keyed `${cell.id}:${faceIndex}` */
    faces: Set<string>;
    /** cell faces lost to the poles themselves */
    atPoles: number;
    /** cell faces lost to the pruning that followed */
    pruned: number;
    /** how many rounds of pruning it took to settle */
    rounds: number;
    /** is this one of the deleted vertices */
    deleted(p: V3): boolean;
}

const CUTS = new WeakMap<Cell[], SingularityCut>();
const vkey = (p: V3): string => p.map((x) => Math.round(x * 1e6)).join(",");

export function singularityCut(cells: Cell[], axes: AxisSet = AXES6): SingularityCut {
    const hit = CUTS.get(cells);
    if (hit) return hit;
    const gone = new Set<string>(poles(axes).map(vkey));
    const faces = new Set<string>();
    const drop = (): number => {
        let n = 0;
        for (const c of cells) {
            c.faces.forEach((f, fi) => {
                const k = `${c.id}:${fi}`;
                if (faces.has(k)) return;
                if (f.some((q) => gone.has(vkey(q)))) {
                    faces.add(k);
                    n++;
                }
            });
        }
        return n;
    };
    const atPoles = gone.size ? drop() : 0;
    let pruned = 0;
    let rounds = 0;
    while (gone.size) {
        rounds++;
        // the surviving surface, one entry per distinct face
        const seen = new Set<string>();
        const live: V3[][] = [];
        for (const c of cells) {
            c.faces.forEach((f, fi) => {
                if (faces.has(`${c.id}:${fi}`)) return;
                const mid = vkey([0, 1, 2].map((d) => f.reduce((t, q) => t + q[d], 0) / 4) as V3);
                if (seen.has(mid)) return;
                seen.add(mid);
                live.push(f);
            });
        }
        const deg = new Map<string, Set<string>>();
        for (const f of live) {
            for (let e = 0; e < 4; e++) {
                const a = vkey(f[e]), b = vkey(f[(e + 1) % 4]);
                const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
                for (const v of [a, b]) {
                    let set = deg.get(v);
                    if (!set) deg.set(v, (set = new Set()));
                    set.add(ek);
                }
            }
        }
        let added = 0;
        for (const [v, edges] of deg) {
            if (edges.size <= 2 && !gone.has(v)) {
                gone.add(v);
                added++;
            }
        }
        if (!added) break;
        pruned += drop();
    }
    const built: SingularityCut = {
        faces,
        atPoles,
        pruned,
        rounds: Math.max(0, rounds - 1),
        deleted: (p: V3) => gone.has(vkey(p)),
    };
    CUTS.set(cells, built);
    return built;
}

/** Is a point on the solid's surface — that is, extreme in some face direction? */
function onSurface(p: V3, axes: AxisSet = AXES6): boolean {
    const ns = faceNormals(axes);
    for (let k = 0; k < ns.length; k++) {
        if (Math.abs(Math.abs(dot(p, ns[k])) - support(ns[k], axes)) < 1e-9) return true;
    }
    return false;
}

/**
 * How far the solid reaches in direction `u` (a unit vector): half the sum of |aₘ·u|,
 * which is what a zonohedron's support function is. On the triacontahedron every face
 * normal gives the same answer, its inradius √(1+2/√5) — that constancy is a fact about
 * six axes rather than about zonohedra, and the smaller solids do not share it.
 */
function support(u: V3, axes: AxisSet = AXES6): number {
    let h = 0;
    for (const m of axes) h += Math.abs(dot(A6[m], u)) / 2;
    return h;
}

/** The unit normals of the solid's k(k−1)/2 face directions, one per axis pair. */
function faceNormals(axes: AxisSet = AXES6): V3[] {
    const key = axes.join("");
    const hit = NORMALS.get(key);
    if (hit) return hit;
    const out: V3[] = [];
    for (let i = 0; i < axes.length; i++) {
        for (let j = i + 1; j < axes.length; j++) {
            const n = cross(A6[axes[i]], A6[axes[j]]);
            const L = Math.hypot(n[0], n[1], n[2]);
            out.push([n[0] / L, n[1] / L, n[2] / L]);
        }
    }
    NORMALS.set(key, out);
    return out;
}

const NORMALS = new Map<string, V3[]>();

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

const RHO_ = Math.sqrt(1 + 2 / Math.sqrt(5));

/**
 * The region shared by the solid and a copy of it translated by `t`.
 *
 * Both are intersections of the same k(k−1)/2 slabs, so the shared region is an
 * intersection of those slabs too — a convex polytope, centrally symmetric about
 * `t/2`. Found by solving every triple of bounding planes and keeping the feasible
 * points, which is exact where sampling would not be.
 *
 * Each slab is as deep as the solid's support function in that direction; on the
 * triacontahedron that is the one number `RHO_` for all fifteen, which is why this
 * used to be written with a constant.
 */
export function intersection(t: V3, axes: AxisSet = AXES6): Region {
    const normals = faceNormals(axes);
    const h = normals.map((u) => support(u, axes));
    const lo = normals.map((u, k) => Math.max(-h[k], dot(u, t) - h[k]));
    const hi = normals.map((u, k) => Math.min(h[k], dot(u, t) + h[k]));
    if (normals.some((_, k) => lo[k] > hi[k] + 1e-12)) {
        return { faces: [], volume: 0, vertices: 0, zonohedron: false };
    }
    // Each bounding plane belongs to the parent it came from — or to both, where the
    // two agree, which is what a shared face looks like.
    const planes: Array<{ n: V3; d: number; from: "a" | "b" | "both" }> = [];
    normals.forEach((u, k) => {
        const aHi = h[k];
        const bHi = dot(u, t) + h[k];
        planes.push({
            n: u,
            d: hi[k],
            from: Math.abs(aHi - bHi) < 1e-9 ? "both" : hi[k] === aHi ? "a" : "b",
        });
        const aLo = -h[k];
        const bLo = dot(u, t) - h[k];
        planes.push({
            n: [-u[0], -u[1], -u[2]],
            d: -lo[k],
            from: Math.abs(aLo - bLo) < 1e-9 ? "both" : lo[k] === aLo ? "a" : "b",
        });
    });

    const feasible = (p: V3) =>
        normals.every((u, k) => {
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

/** The volume of any of the family: the cells' volumes added up. Closed forms exist —
 *  the triacontahedron's is `RT_VOLUME` — but the sum is what the dissection has to
 *  match, so it is the honest thing to check against. */
export function solidVolume(axes: AxisSet = AXES6): number {
    let v = 0;
    for (const T of ctx(axes).triples)
        v += Math.abs(dot(A6[T[0]], cross(A6[T[1]], A6[T[2]])));
    return v;
}
export { disjoint };
