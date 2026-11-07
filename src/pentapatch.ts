// The patch, from the pentagrid instead of from a deflation.
//
// EXCEPTIONAL.md §7.1. The Exceptional page is about one point — the five-fold
// singularity — and it used to hunt for it inside a Queen patch grown by recursive
// deflation. That is why its angles were hard to predict: the decagon sat somewhere
// inside the patch at some orientation, and both had to be measured off the drawing.
//
// De Bruijn's construction puts it at the origin instead, and names it. pentagrid's own
// catalog carries both states this page is about:
//
//     decagon   γ = [0,0,0,0,0]          every phase integral, the unique 5-fold
//     deca      γ = [0,1,-1,-1,1]/1000   what γ = 0 resolves into under a
//                                        mirror-symmetric nudge — Jake's "jiggle"
//
// So unresolved and resolved become two numbers from one generator.
//
// **THE ANGLES ARE NOW ARGUMENTS.** A gridline of family j is the locus `x·vⱼ = const`,
// so it runs perpendicular to `vⱼ`, and the ribbon — the spoke — runs with it. With
// generators at 0° + 72k the five spokes are at 18° + 36k. Nothing is fitted.
//
// **ONE CONVERSION, APPLIED ONCE.** pentagrid's planar edge is 1 and its lift adds
// `RISE = 0.5` per step, so a lifted edge is `√5/2`; this project's `E5` is a unit
// lifted edge, planar part `2/√5` and rise `1/√5`. Everything below is scaled by
// `2/√5` on the way out, so every consumer downstream — `goldenview`, the zonohedra,
// the readings — sees the conventions it already has. pentagrid-lib.md §2.

import { makeDirections, collectRhombs, vertexIndex } from "../vendor/pentagrid/lib/grow.js";
import type { RoofData, RoofFaceInfo } from "./roofgeom.js";
import type { V3 } from "./solids.js";

/** pentagrid's lifted edge against this project's: `√5/2` to 1. */
const TO_UNIT_EDGE = 2 / Math.sqrt(5);
/** pentagrid lifts by this per step; scaled, it is this project's `1/√5`. */
const RISE = 0.5;

/**
 * A roof, plus the one thing de Bruijn has that a deflation does not hand over the
 * same way: the **K-tuple of every vertex**.
 *
 * `geometry.ts` calls it `lift.n[vid]` and the page uses it to recognize figures — a
 * zonohedron's corners are exactly the vertices whose K-tuples differ from a base by 0
 * or 1 in each place. It is the K-tuple the grid was built from, so here it is free
 * rather than integrated along edges.
 */
export interface PentaRoof extends RoofData {
    /** K-tuple per vertex id, parallel to `P` */
    n: (number[] | null)[];
}

export interface PentaPatchOptions {
    /** the five phases. All zero is the singularity; a nudge is a jiggle. */
    gamma?: readonly number[];
    /**
     * How much of the cartwheel: keep a crossing only when **both** its line numbers
     * satisfy `|n| ≤ window`. Jake's control — "compute gridlines where all |k|'s less
     * than x" — and a better one than a generation here, since the singularity is at
     * the origin and the interest falls off with radius.
     */
    window?: number;
    /** turn the surface over, as `buildRoof` does */
    flip?: boolean;
    /** vertical scale, as `buildRoof`'s `vscale` */
    vscale?: number;
}

/** γ for the two presets this page cares about, from pentagrid's `geometry/hunt.ts`. */
export const GAMMA_SINGULAR: readonly number[] = [0, 0, 0, 0, 0];
export const GAMMA_JIGGLE: readonly number[] = [0, 0.001, -0.001, -0.001, 0.001];

const KEY = 1e6;
const vkey = (x: number, y: number) => `${Math.round(x * KEY)},${Math.round(y * KEY)}`;

/**
 * A patch of the pentagrid, shaped as `RoofData` so every existing layer takes it.
 *
 * Returning the roof's own interface rather than a new one is the point: the page's
 * decagon-finding, skewb-finding, readings and drawing all go through `d.faces` and
 * `d.point`, and none of them has to know where the rhombi came from.
 */
export function pentaPatch(o: PentaPatchOptions = {}): PentaRoof | null {
    const gamma = o.gamma ?? GAMMA_SINGULAR;
    const win = o.window ?? 8;
    const flip = o.flip ?? false;
    const vscale = o.vscale ?? 1;

    // The fan at 0° + 72k, matching this project's `E5`, so axis numbering and the
    // five-coloring line up with every other page. `verticalSymmetry` would put the
    // generators at 18° instead — a different object at an angle this page also uses
    // for its spokes, and exactly the confusion pentagrid-lib.md §2 records.
    const dirs = makeDirections(false, 5);
    const pg = { n: 5, directions: dirs, gamma: [...gamma] };

    // A line of family j sits at `x·vⱼ = n − γⱼ`, so lines out to |n| ≤ win reach about
    // `win` from the origin; ask for a little more and then filter exactly.
    const r = win + 2;
    const all = collectRhombs(pg, { xMin: -r, xMax: r, yMin: -r, yMax: r }, {});
    const win_ok = all.filter((t) => Math.abs(t.nj) <= win && Math.abs(t.nk) <= win);

    // **The pole is not part of the tiling.** At γ = 0 the five lines meet at one
    // point, so all ten crossings there are the same crossing and the dual hands back
    // a *fan* of ten rhombi sharing a corner at `ΣK = 0`. That corner is the
    // singularity's lower pole, and a Penrose vertex index runs 1…4 — "no path through
    // an extreme", §4. So the fan is the construction's degenerate answer at the
    // singular point, not a legal reading of it, and the ten are dropped: what is left
    // is a legal tiling with a decagonal hole where the superposition belongs. The page
    // fills that hole with F₂₀ itself, which is the whole claim — a singularity is a
    // solid, and the solid is what stands where no tiling is determined.
    const sum = (K: number[]) => K.reduce((a, b) => a + b, 0);
    const kept = win_ok.filter((t) => t.kTuples.every((K) => {
        const n = sum(K);
        return n >= 1 && n <= 4;
    }));
    if (!kept.length) return null;

    // ── vertices ──────────────────────────────────────────────────
    const idOf = new Map<string, number>();
    const P: (V3 | null)[] = [];
    /**
     * The height index per vertex, kept rather than recovered from `z`.
     *
     * **De Bruijn's `Σ K` is already this project's index, with nothing added.**
     * Measured on both presets: a jiggle gives 1…4, the roof's own range, and the
     * singular case gives the same 1…4 plus a single vertex at **0** — the origin,
     * which is the lower pole, exactly as §4 has it. So the five-fold point is not an
     * exception to the 1…4 rule; it is the pole, and the pole was never on the roof.
     */
    const idx: number[] = [];
    const n: (number[] | null)[] = [];
    const vid = (x: number, y: number, K: number[]): number => {
        const k = vkey(x, y);
        let id = idOf.get(k);
        if (id === undefined) {
            id = idOf.size;
            idOf.set(k, id);
            // The height is de Bruijn's own: the sum of the K-tuple, which is what
            // `vertexIndex` returns and what the lift has always been here too.
            const h = vertexIndex(K);
            idx[id] = h;
            n[id] = [...K];
            P[id] = [x * TO_UNIT_EDGE, y * TO_UNIT_EDGE, h * RISE * TO_UNIT_EDGE * (flip ? -1 : 1)];
        }
        return id;
    };

    // ── faces ─────────────────────────────────────────────────────
    const faces: RoofFaceInfo[] = kept.map((t, id) => {
        const vids = t.vertices.map((v, i) => vid(v[0], v[1], t.kTuples[i]));
        // `dirs` is the pair **in edge order**: which family the edge v0→v1 runs along
        // and which v0→v3 does. Read off the geometry rather than assumed from j, k —
        // `collectRhombs` is free to wind a tile either way and the ribbons need the
        // answer, not a convention.
        const along = (a: number[], b: number[]): number => {
            const dx = b[0] - a[0], dy = b[1] - a[1];
            for (const g of [t.j, t.k]) {
                const u = dirs[g];
                if (Math.abs(Math.abs(dx * u[0] + dy * u[1]) - Math.hypot(dx, dy)) < 1e-9) return g;
            }
            return t.j;
        };
        const d0 = along(t.vertices[0], t.vertices[1]);
        const d1 = d0 === t.j ? t.k : t.j;
        return {
            id,
            vids,
            thick: t.thick,
            // Which pentagon group a rhomb came from is a fact about a deflation, and
            // a pentagrid has no hierarchy to ask. Nothing on this page colors by it.
            group: "",
            pair: [Math.min(t.j, t.k), Math.max(t.j, t.k)] as [number, number],
            dirs: [d0, d1] as [number, number],
        };
    });

    // ── the index range ──────────────────────────────────────────
    let lo = Infinity, hi = -Infinity;
    for (const n of idx) {
        if (n < lo) lo = n;
        if (n > hi) hi = n;
    }
    const indexAt = (v: number): number => (flip ? lo + hi - idx[v] : idx[v]);

    // ── centering, as `buildRoof` does ────────────────────────────
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const p of P) {
        if (!p) continue;
        if (p[0] < x0) x0 = p[0];
        if (p[1] < y0) y0 = p[1];
        if (p[2] * vscale < z0) z0 = p[2] * vscale;
        if (p[0] > x1) x1 = p[0];
        if (p[1] > y1) y1 = p[1];
        if (p[2] * vscale > z1) z1 = p[2] * vscale;
    }
    const offset: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];

    return {
        P,
        n,
        k: Math.abs(vscale),
        faces,
        offset,
        idxLo: lo,
        idxHi: hi,
        span: hi - lo,
        flip,
        indexAt,
        point(v: number): V3 {
            const p = P[v]!;
            return [p[0] - offset[0], p[1] - offset[1], p[2] * vscale - offset[2]];
        },
    };
}
