// Where the normals meet — the roof, and the triacontahedra it is a lid on.
//
// Every face of the roof is a golden rhombus, and the rhombic triacontahedron is
// isohedral: all thirty of its face planes are tangent to one insphere, each touching
// at the face's own centroid. So a face fixes its solid's center to one of exactly
// two points, centroid ± ρ·n̂ — above the map or below it. Faces of the same solid
// name the same point, and the grouping is the picture.
//
// The arithmetic is all in `centers.ts` and is exact: centers are the all-odd points
// of the six-axis half-lattice, compared as integers, with no clustering tolerance
// anywhere. This file is presentation. See TRIACONTAHEDRA.md for the argument and
// `tools/centers.mjs` for the checks.
//
// Vertical scale is ±1 here and nothing between. Scaling the vertical is an affine
// map so the roof stays honest at any setting, but a squashed triacontahedron is not
// a triacontahedron — its normals stop meeting at a point, which is this page's whole
// claim. The flip is applied by negating z on the finished scene, surface and solids
// together, which is exact because a mirrored triacontahedron is still one.

import * as THREE from "three";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { seedTypes, generatePatch, allRhombs, vertexList, pairColor, FIVE_COLORS } from "./geometry.js";
import { buildRoof, rescale } from "./roofgeom.js";
import type { RoofData } from "./roofgeom.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { createRoofView, CLUSTER_3D, CLUSTER_FALLBACK, PLAIN_COLOR } from "./roofview.js";
import {
    triacontahedra, pe5Rosettes, cupIndices, ownedFaceIndices, solidFace,
    RT_FACES, A6, RHO, MIDRADIUS,
} from "./centers.js";
import { patchSize, MAX_GENERATION } from "./patchsize.js";
import type { Solid } from "./centers.js";
import { zonohedron, faceOutward, PHI } from "./solids.js";
import type { V3 } from "./solids.js";

// Detents. Only a handful of settings on either slider mean anything, so those are
// the ones the control lands on; the travel between them is free, which is how the
// normals are watched converging rather than merely found already converged.

const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const nrm = (a: V3): V3 => {
    const L = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / L, a[1] / L, a[2] / L];
};

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};

const view = el<HTMLDivElement>("view");
const patchSel = el<HTMLSelectElement>("patch");
const genSel = el<HTMLSelectElement>("gen");
const colorSel = el<HTMLSelectElement>("color");
const headsRadio = el<HTMLInputElement>("pheads");
const tailsRadio = el<HTMLInputElement>("ptails");
const flatChk = el<HTMLInputElement>("flat");
const headSolidsChk = el<HTMLInputElement>("headsolids");
const tailSolidsChk = el<HTMLInputElement>("tailsolids");
const rhombSel = el<HTMLSelectElement>("rhombmode");
const edgesChk = el<HTMLInputElement>("edges");
const shadeChk = el<HTMLInputElement>("shade");
const isoChk = el<HTMLInputElement>("isogloss");
const normalsChk = el<HTMLInputElement>("normals");

const rtSel = el<HTMLSelectElement>("rtmode");
const rtExtentSel = el<HTMLSelectElement>("rtextent");
const rtEdgesChk = el<HTMLInputElement>("rtedges");
const rtFacesSel = el<HTMLSelectElement>("rtfaces");
const rtShadeChk = el<HTMLInputElement>("rtshade");
const rtIsoChk = el<HTMLInputElement>("rtisogloss");

const classBar = el<HTMLElement>("classlines");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-centers";
const PREF_DEFAULTS = {
    // The Sun at generation 2. The Sun is the patch with a genuine center — a Pe5
    // rosette with the void under it — and at generation 2 it is small enough that
    // every solid in it can be looked at one at a time.
    patch: "Sun",
    gen: 2,
    color: "class",
    parity: "heads",
    flat: false,
    headsolids: true,
    tailsolids: true,
    rhombmode: "solid",
    edges: true,
    shade: true,
    isogloss: false,
    normals: false,
    rtmode: "transparent",
    // Spheres by default. The balls were the object of the exercise and the
    // triacontahedra the means of finding them — and the sphere is also the only
    // extent that survives generation 5, being one instanced mesh however many there
    // are. One dropdown away from the polyhedra when the faces are what you want.
    rtextent: "sphere",
    rtedges: true,
    rtfaces: "full",
    rtshade: true,
    rtisogloss: false,
    classOn: [true, true, true, true],
    classNorm: [true, true, true, true],
    classRT: [true, true, true, true],
    classSize: [1, 1, 1, 1],
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

// Twelve controls, built rather than written out: a checkbox and a size slider per
// class, each carrying its own color so the bar doubles as the legend.
/** Per class: whether to show it at all, its own normals and solids overrides, how big
 *  to draw the solids, and a live population count. The globals above are master
 *  switches — flipping one writes through to all four, and after that the class
 *  controls are the truth, so an individual class really does override. */
interface ClassCtl {
    on: HTMLInputElement;
    norm: HTMLInputElement;
    rt: HTMLInputElement;
    size: HTMLInputElement;
    count: HTMLElement;
}
const classCtl: ClassCtl[] = [];

const rv = createRoofView(view);

// ── palette ───────────────────────────────────────────────────────
//
// One hue per solid, cycled. The point is only that neighbors differ: a complete cap
// should read as one region and the next as another, and no hue means anything in
// itself. Complete solids take the color at strength; partial ones are washed toward
// gray, so the ten-face caps stand out of the field without a legend.

const WASH = new THREE.Color(0xd8d9de);

// A **proper** rhomb is one with all of its normals — one whose home solid shows the
// roof a whole configuration rather than a scrap. Four of the nine makeups qualify,
// and they are told apart by makeup and not by size alone: class 5 comes in two quite
// different shapes and lumping them would hide that.
//
// Everything else — sizes 1, 2 and 3 — is demoted. Class 3 is never anything's home
// at all, and 1 and 2 fall away with patch size (Sun: 17.9, 2.7, 0.4, 0.05 percent at
// generations 2 to 5), so they are boundary residue rather than classes. They stay
// drawn, shaded and contoured, but colorless.
interface ProperClass {
    key: string;
    label: string;
    makeup: string;
    color: THREE.Color;
    hint: string;
}
const PROPER: ProperClass[] = [
    { key: "c4", label: "4", makeup: "4=4T+0t", color: new THREE.Color(0xe0a12b),
      hint: "four of the five cap faces — one short of the rosette" },
    { key: "c5a", label: "5a", makeup: "5=5T+0t", color: new THREE.Color(0x3f9d58),
      hint: "5 thick: the whole Pe5 rosette, with none of its ring" },
    { key: "c5b", label: "5b", makeup: "5=3T+2t", color: new THREE.Color(0x8b4fc8),
      hint: "3 thick + 2 thin: a contiguous run of five, the only mixed class short of complete" },
    { key: "c10", label: "10", makeup: "10=5T+5t", color: new THREE.Color(0x2f6fb5),
      hint: "complete — a whole triacontahedron" },
];
// Colorless, but not invisible. A demoted solid drawn against a near-white page at
// partial opacity disappears entirely, which reads as a rendering fault rather than as
// "this is not a class".
const DEMOTED = new THREE.Color(0xc9cad2);
// Its own color, because it is its own thing: a rhomb whose two solids are BOTH a
// proper class. Always the same pairing, a class 4 against a class 5b, and always a
// thick rhomb — the two flanking the gap in the 4, the two ends of the run in the 5b.
// Left uncolored they take the 5b violet, since home is the larger of the two, so
// every class 4 renders as only two amber faces and its other two go to its neighbor.
// About 5.6% of rhombi.
const SHARED = new THREE.Color(0xd1477a);
const properOf = (s: Solid): number => PROPER.findIndex((p) => p.makeup === s.makeup);

/** Which of the thirty faces each solid actually owns, filled in with the patch. */
let ownedCache: number[][] | null = null;
const ownedOf = (s: Solid): number[] => ownedCache?.[s.id] ?? [];

function solidColor(s: Solid): THREE.Color {
    const i = properOf(s);
    return i < 0 ? DEMOTED.clone() : PROPER[i].color.clone();
}

/** A rhomb lying on two proper solids at once. */
const isShared = (f: { solids: [number, number] }, solids: Solid[]): boolean =>
    properOf(solids[f.solids[0]]) >= 0 && properOf(solids[f.solids[1]]) >= 0;

// ── the triacontahedron, drawn in the roof's own frame ────────────
//
// zonohedron(A6) rather than the polyhedra page's triacontahedron(), which stands the
// solid on a five-fold axis for display. Here the frame is already right: the roof's
// five generators plus the vertical *are* the six axes, so every solid on this page
// is a translate of this one, never a rotation.

// The mesh and its placement live in centers.ts, so that the page and
// tools/centers.mjs are running the same code. Everything below is drawing.
const ALL_FACES = RT_FACES.map((_, i) => i);

/**
 * The triacontahedron's edge net projected radially onto a unit sphere — the **spherical
 * rhombic triacontahedron**, thirty spherical rhombs meeting five and three at a time.
 *
 * The graph is the same at any radius, since projection from the center does not care how
 * far out the sphere is; only the arcs' curvature changes. Two radii are worth drawing it
 * at. On the **insphere** the arcs pass outside the solid's edges, which are further from
 * the center than the faces. On the **midsphere** they pass exactly through the sixty
 * points where the edges are tangent, so the net is pinned to the solid rather than
 * floating over it — which is the whole point of a midsphere existing.
 *
 * Built once at unit radius and then scaled and translated per solid, because at several
 * hundred solids rebuilding sixty arcs apiece on every control change is the difference
 * between a page and a pause.
 */
function sphericalNet(faces: number[], steps = 7): Float32Array {
    const seen = new Set<string>();
    const out: number[] = [];
    const unit = (p: readonly number[]): [number, number, number] => {
        const L = Math.hypot(p[0], p[1], p[2]) || 1;
        return [p[0] / L, p[1] / L, p[2] / L];
    };
    const key = (p: readonly number[]) => p.map((x) => Math.round(x * 1e6)).join(",");
    for (const fi of faces) {
        const f = RT_FACES[fi];
        for (let k = 0; k < 4; k++) {
            const a = f[k];
            const b = f[(k + 1) % 4];
            const ek = [key(a), key(b)].sort().join("|");
            if (seen.has(ek)) continue; // every edge is shared by two faces
            seen.add(ek);
            const A = unit(a);
            const B = unit(b);
            let prev = A;
            for (let i = 1; i <= steps; i++) {
                // slerp, so the segment really follows the great circle rather than the
                // chord — at these arc lengths the difference is plainly visible
                const t = i / steps;
                const q = unit([
                    A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t,
                ]);
                out.push(prev[0], prev[1], prev[2], q[0], q[1], q[2]);
                prev = q;
            }
        }
    }
    return new Float32Array(out);
}

const FIVE = FIVE_COLORS.map((h) => new THREE.Color(h));
/**
 * The **surfaces** the net outlines: each rhomb face projected radially onto the unit
 * sphere and tessellated, so a partial set of faces gives a partial spherical shell
 * rather than a whole ball with lines drawn on it.
 *
 * With all thirty this is pointless — thirty spherical rhombs tile the sphere exactly, so
 * the plain instanced ball is the same picture for a fraction of the cost. It earns its
 * keep under `cups`, where ten of the thirty leave an open cap.
 *
 * Normals are the positions themselves: every point of a sphere has its own outward
 * direction, so there is nothing to average and no faceting to hide.
 */
function sphericalPatches(faces: number[], steps = 5): { pos: Float32Array; nrm: Float32Array } {
    const pos: number[] = [];
    const unit = (p: readonly number[]): [number, number, number] => {
        const L = Math.hypot(p[0], p[1], p[2]) || 1;
        return [p[0] / L, p[1] / L, p[2] / L];
    };
    for (const fi of faces) {
        const f = RT_FACES[fi];
        const at = (i: number, j: number): [number, number, number] => {
            const u = i / steps;
            const v = j / steps;
            const q: [number, number, number] = [0, 0, 0];
            for (let d = 0; d < 3; d++) {
                q[d] = f[0][d] * (1 - u) * (1 - v) + f[1][d] * u * (1 - v)
                    + f[2][d] * u * v + f[3][d] * (1 - u) * v;
            }
            return unit(q);
        };
        for (let i = 0; i < steps; i++) {
            for (let j = 0; j < steps; j++) {
                const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
                for (const q of [a, b, c, a, c, e]) pos.push(q[0], q[1], q[2]);
            }
        }
    }
    const arr = new Float32Array(pos);
    return { pos: arr, nrm: arr.slice() };
}

const ALL_INDICES = RT_FACES.map((_, i) => i);
const NET_FULL = sphericalNet(ALL_INDICES);
const patchCache = new Map<string, { pos: Float32Array; nrm: Float32Array }>();
function patchesFor(faces: number[]): { pos: Float32Array; nrm: Float32Array } {
    const k = faces.slice().sort((a, b) => a - b).join(",");
    const had = patchCache.get(k);
    if (had) return had;
    const made = sphericalPatches(faces);
    // "By class" asks for arbitrary subsets of the thirty rather than the two cup sets, so
    // the key space is no longer small. Bounded, oldest out, rather than left to grow a
    // Float32Array per distinct footprint in the patch.
    if (patchCache.size > 400) patchCache.delete(patchCache.keys().next().value as string);
    patchCache.set(k, made);
    return made;
}
const netCache = new Map<string, Float32Array>();
function netFor(faces: number[]): Float32Array {
    if (faces.length === RT_FACES.length) return NET_FULL;
    const k = faces.slice().sort((a, b) => a - b).join(",");
    const had = netCache.get(k);
    if (had) return had;
    const made = sphericalNet(faces);
    if (netCache.size > 400) netCache.delete(netCache.keys().next().value as string);
    netCache.set(k, made);
    return made;
}

// ── the spherical Voronoi clip ────────────────────────────────────
//
// Balls at the midsphere overlap, and "by class" leaves a seam between every pair of
// them because each wears only the rhombs it owns. Give a ball instead the part of its
// surface **nearer to its own center than to any other drawn center** and the seams
// close by construction: all the balls carry the same radius, so the plane two of them
// meet in is the perpendicular bisector of their centers, and the curve they meet on is
// that plane cut by either sphere. Neighbors meet exactly, nothing is drawn twice, and
// no pair needs a decision of its own.
//
// It is offered at the midsphere only. The rule itself would run at any radius, but the
// measurement it rests on was made there, and at ρ the kissing shell sits exactly on the
// contact so half the pairs meet at a point rather than on a curve.
//
// Measured before it was built, over Sun and Star gen 2 (and confirmed on Pe5 gen 3-4
// and Queen gen 3): every *adjacent* pair of proper solids stands at 1.7013, 2.3840 or
// 2.7528 — all inside 2·midradius = 2.9288 — so every seam that is actually visible
// does close, in 0 exceptions out of 2,615 adjacent pairs. The pairs that can never
// reach each other are 10+10 at φ³ = 4.2361, 5a+5a, and 4+5a at 3.6416, and none of
// those three is ever a neighbor: the surface they would have shared is open space
// either way. See TRIACONTAHEDRA.md §10.
//
// The clip cannot fill a ball, only close its seams. At the midsphere a class-4 ball
// wears 4/30 of its surface and reaches 41%; a class-10 ball 10/30 and reaches 56%. The
// rest faces open space — 52-87% of the hemisphere away from the roof.

/** Keep the part of the unit sphere with `v · u < k`. `k` is in units of the ball's
 *  own radius, so one clip serves the ball whatever the size slider says. */
interface Clip {
    u: V3;
    k: number;
}

/** The whole unit sphere, tessellated exactly as the cups are so that a cell and a cup
 *  drawn on the same ball agree about where their shared rhomb boundaries lie. The
 *  patches come out face by face, so a triangle's index names the rhomb it belongs to. */
const VORONOI_STEPS = 5;
const VORONOI_MESH = sphericalPatches(ALL_INDICES, VORONOI_STEPS).pos;
const TRIS_PER_FACE = VORONOI_STEPS * VORONOI_STEPS * 2;

/** Unit centroid direction of each of the thirty faces; the spherical rhomb of face i
 *  is the set of directions for which `v·n̂ᵢ` is the largest. */
const FACE_DIRS: V3[] = RT_FACES.map((f) => {
    const c: V3 = [0, 0, 0];
    for (const q of f) for (let d = 0; d < 3; d++) c[d] += q[d] / 4;
    return nrm(c);
});
const NO_FACES: Set<number> = new Set();
function faceOfDir(v: V3): number {
    let best = 0;
    let bd = -2;
    for (let i = 0; i < FACE_DIRS.length; i++) {
        const d = v[0] * FACE_DIRS[i][0] + v[1] * FACE_DIRS[i][1] + v[2] * FACE_DIRS[i][2];
        if (d > bd) { bd = d; best = i; }
    }
    return best;
}

/**
 * Where the great-circle arc a→b crosses the plane `v·u = k`.
 *
 * The arc is the chord projected back out to the sphere, so a point on it is
 * `normalize(a + s·(b−a))` and the crossing solves `(a + s d)·u = k·|a + s d|`.
 * Squaring gives a quadratic, whose spurious root is thrown out by testing both
 * against the equation that was not squared.
 *
 * Solved rather than interpolated because the two balls have to land on the *same*
 * circle. An interpolated boundary is off by O(θ²) on each side independently, which
 * is a hairline of daylight between two surfaces whose whole purpose is to meet.
 */
function arcCross(a: V3, b: V3, u: V3, k: number): V3 {
    const A = a[0] * u[0] + a[1] * u[1] + a[2] * u[2];
    const B = (b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1] + (b[2] - a[2]) * u[2];
    const q = 2 * (1 - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const c2 = B * B - k * k * q;
    const c1 = 2 * A * B + k * k * q;
    const c0 = A * A - k * k;
    const at = (t: number): V3 => {
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        const z = a[2] + (b[2] - a[2]) * t;
        const L = Math.hypot(x, y, z) || 1;
        return [x / L, y / L, z / L];
    };
    const miss = (t: number): number => {
        const v = at(t);
        return Math.abs(v[0] * u[0] + v[1] * u[1] + v[2] * u[2] - k);
    };
    const cand: number[] = [];
    if (Math.abs(c2) < 1e-12) {
        if (Math.abs(c1) > 1e-12) cand.push(-c0 / c1);
    } else {
        const r = Math.sqrt(Math.max(0, c1 * c1 - 4 * c2 * c0));
        cand.push((-c1 + r) / (2 * c2), (-c1 - r) / (2 * c2));
    }
    let best = -1;
    let bestMiss = Infinity;
    for (const t of cand) {
        if (t < -1e-9 || t > 1 + 1e-9) continue;
        const m = miss(t);
        if (m < bestMiss) { bestMiss = m; best = t; }
    }
    if (bestMiss > 1e-9) {
        // A near-degenerate quadratic — a vertex sitting on the plane, or an arc almost
        // tangent to it — can put both roots outside the segment. This is only called
        // on an edge whose ends straddle the plane, so the signed distance changes sign
        // across it and bisection cannot fail. Twenty halvings take the residual below
        // 1e-6 of the arc, which is far finer than the tessellation it lands in.
        const g = (t: number): number => {
            const v = at(t);
            return v[0] * u[0] + v[1] * u[1] + v[2] * u[2] - k;
        };
        let lo = 0;
        let hi = 1;
        const gLo = g(0);
        for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            if ((g(mid) < 0) === (gLo < 0)) lo = mid; else hi = mid;
        }
        best = (lo + hi) / 2;
    }
    return at(Math.min(1, Math.max(0, best)));
}

/** Sutherland–Hodgman, with the crossings taken on the sphere rather than the chord. */
function clipPoly(poly: V3[], u: V3, k: number): V3[] {
    const out: V3[] = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const da = a[0] * u[0] + a[1] * u[1] + a[2] * u[2] - k;
        const db = b[0] * u[0] + b[1] * u[1] + b[2] * u[2] - k;
        if (da < 0) out.push(a);
        if ((da < 0) !== (db < 0)) out.push(arcCross(a, b, u, k));
    }
    return out;
}

/**
 * The clips one ball takes from every other drawn ball it reaches.
 *
 * With equal radii this is the perpendicular bisector. The size sliders can leave two
 * balls unequal, and then the plane they actually meet in is the radical plane — the
 * same construction with the radii put back — so that is what is computed, and it
 * collapses to the bisector the moment the two agree.
 *
 * `z` is the parity. The cell is built in unmirrored coordinates and mirrored on the
 * way out, exactly as the cups are, so the neighbor direction has to be unmirrored on
 * the way in.
 */
function voronoiPlanes(
    c: V3, r: number, others: Array<{ c: V3; r: number }>, z: number,
): Clip[] {
    const out: Clip[] = [];
    for (const o of others) {
        const dx = o.c[0] - c[0];
        const dy = o.c[1] - c[1];
        const dz = o.c[2] - c[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-9 || d >= r + o.r) continue; // too far apart to meet at all
        const k = (d * d + r * r - o.r * o.r) / (2 * d * r);
        if (k >= 1) continue;                   // the plane clears this sphere entirely
        out.push({ u: [dx / d, dy / d, (dz / d) * z], k });
    }
    return out;
}

/**
 * The territory, as unit-sphere triangles: the footprint, plus whatever the clips let
 * it grow into.
 *
 * **A rhomb the solid owns is never cut.** This mode is `by class` with its seams
 * closed, not a different partition, and a clip that can remove the footprint is not
 * that. It also fails on the case it most needs to get right: the central blue of Sun
 * gen 2 is a complete hat with five purple bowls resting on it, and their balls cover
 * its dome so thoroughly that a pure nearest-center rule keeps **3.8%** of it. The
 * dome would simply disappear.
 *
 * So the footprint is laid down whole and the clips apply only outside it.
 *
 * **Growth stops at the cup rim**, not at the ball's equator. The cup is the ten faces
 * on the roof's side, and it is where the solid's roof-facing surface finishes; past it
 * the ball has nothing to do with the roof. Run to the equator instead and a cell grows
 * into directions with no neighbour anywhere near, which is the part that reads as
 * unnecessary: green ends in a point and then keeps going. The two are far apart —
 * green 21.0% against 24.6%, amber 23.9% against 30.8% — and the case that settles it is
 * the complete class, which owns its whole cup and so does not move at all: blue stays
 * at 33.3%, exactly what `by class` draws. No cell can ever exceed 10/30.
 *
 * The bound also makes the hemisphere clip redundant: a cup's spherical rhombs span
 * z 0.1876 to 1, well inside their own half.
 */
function voronoiCell(clips: Clip[], owned: Set<number>, cup: Set<number>): V3[][] {
    const out: V3[][] = [];
    const m = VORONOI_MESH;
    for (let t = 0, tri = 0; t < m.length; t += 9, tri++) {
        let poly: V3[] = [
            [m[t], m[t + 1], m[t + 2]],
            [m[t + 3], m[t + 4], m[t + 5]],
            [m[t + 6], m[t + 7], m[t + 8]],
        ];
        const face = Math.floor(tri / TRIS_PER_FACE);
        if (!cup.has(face)) continue;              // outside the roof-facing cup
        for (const c of owned.has(face) ? [] : clips) {
            let anyIn = false;
            let anyOut = false;
            for (const v of poly) {
                if (v[0] * c.u[0] + v[1] * c.u[1] + v[2] * c.u[2] - c.k < 0) anyIn = true;
                else anyOut = true;
            }
            if (!anyOut) continue;              // wholly kept, nothing to do
            if (!anyIn) { poly = []; break; }   // wholly cut away
            poly = clipPoly(poly, c.u, c.k);
            if (poly.length < 3) { poly = []; break; }
        }
        for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]);
    }
    return out;
}

/**
 * One small circle on the unit sphere, `v·u = k`, kept only where the cell keeps it and
 * placed on the solid.
 *
 * Serves both jobs the cell needs a curve for: the meeting curves themselves (one per
 * clip, with `skip` naming the clip that made it so it does not cut its own circle
 * away), and the height contours (`skip` = −1, since a contour is subject to all of
 * them).
 */
function circleOnCell(
    out: number[], u: V3, k: number, clips: Clip[], skip: number,
    r: number, c: V3, z: number, bound: Set<number>, exclude: Set<number>, seg = 120,
): void {
    if (k <= -1 || k >= 1) return;
    const rad = Math.sqrt(Math.max(0, 1 - k * k));
    const seed: V3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = nrm(cross(u, seed));
    const e2 = cross(u, e1);
    let prev: V3 | null = null;
    for (let t = 0; t <= seg; t++) {
        const a = (t / seg) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const v: V3 = [
            u[0] * k + (e1[0] * ca + e2[0] * sa) * rad,
            u[1] * k + (e1[1] * ca + e2[1] * sa) * rad,
            u[2] * k + (e1[2] * ca + e2[2] * sa) * rad,
        ];
        // Held to the same bound the cell is, and suppressed inside the footprint:
        // the clips do not cut the footprint, so a curve drawn there would be a line
        // across a rhomb that `by class` draws unbroken.
        const f = faceOfDir(v);
        let inside = bound.has(f) && !exclude.has(f);
        for (let j = 0; j < clips.length && inside; j++) {
            if (j === skip) continue;
            const cj = clips[j];
            if (v[0] * cj.u[0] + v[1] * cj.u[1] + v[2] * cj.u[2] > cj.k) inside = false;
        }
        if (inside && prev) {
            out.push(
                prev[0] * r + c[0], prev[1] * r + c[1], prev[2] * r * z + c[2],
                v[0] * r + c[0], v[1] * r + c[1], v[2] * r * z + c[2],
            );
        }
        prev = inside ? v : null;
    }
}

// ── the cup's own relief ──────────────────────────────────────────
//
// A whole ball needs no help reading as a solid: its silhouette closes and its lighting
// runs all the way round. A *piece* of one does not. Ten spherical rhombs are the same
// picture whether they are a bowl seen from inside or a dome seen from outside, and the
// eye picks whichever it feels like — which on this page is exactly the question being
// asked, since a cup above the roof and a hat below it are the two parities.
//
// So the cups borrow the roof's own two cues: a light-to-dark ramp with height, and
// level sets of height. Both are functions of z alone, which is what makes them read as
// relief rather than as pattern. They are offered for `cups` and `by class` and not for
// `all 30`, where the surface closes and the cue would only fight the lighting.
//
// Everything here is computed once per face set on the unit solid and then scaled,
// mirrored and translated per solid, exactly as `patchesFor` and `netFor` are.

/** Seven contours, so the spacing is the eighths the roof's isoglosses already use. */
const ISO_LEVELS = 7;

/** Unit-space z range of a triangle soup. */
function zRangeOf(tri: ArrayLike<number>): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 2; i < tri.length; i += 3) {
        if (tri[i] < lo) lo = tri[i];
        if (tri[i] > hi) hi = tri[i];
    }
    return [lo, hi];
}

/** The face set as flat triangles on the unit solid — the polyhedral counterpart of
 *  `sphericalPatches`, used only to slice contours out of. */
function flatTris(faces: number[]): Float32Array {
    const out: number[] = [];
    for (const fi of faces) {
        const f = RT_FACES[fi];
        for (const v of [f[0], f[1], f[2], f[0], f[2], f[3]]) out.push(v[0], v[1], v[2]);
    }
    return new Float32Array(out);
}

/** Level sets of z, marched over the triangles. A plane through a vertex can cut one
 *  edge or three; those are dropped rather than guessed at, since the neighboring
 *  levels cover the same ground. */
function contourSegments(tri: ArrayLike<number>, lo: number, hi: number): Float32Array {
    const out: number[] = [];
    if (!(hi > lo)) return new Float32Array(0);
    for (let k = 1; k <= ISO_LEVELS; k++) {
        const z = lo + ((hi - lo) * k) / (ISO_LEVELS + 1);
        for (let t = 0; t < tri.length; t += 9) {
            const hits: number[] = [];
            for (let e = 0; e < 3; e++) {
                const a = t + e * 3;
                const b = t + ((e + 1) % 3) * 3;
                const da = tri[a + 2] - z;
                const db = tri[b + 2] - z;
                if ((da <= 0 && db > 0) || (db <= 0 && da > 0)) {
                    const u = da / (da - db);
                    hits.push(
                        tri[a] + (tri[b] - tri[a]) * u,
                        tri[a + 1] + (tri[b + 1] - tri[a + 1]) * u,
                        z,
                    );
                }
            }
            if (hits.length === 6) out.push(...hits);
        }
    }
    return new Float32Array(out);
}

interface CupRelief {
    /** unit-space z of the lowest and highest point of the face set */
    lo: number;
    hi: number;
    /** unit-space contour segments, ready to scale and place */
    iso: Float32Array;
}
const reliefCache = new Map<string, CupRelief>();
function reliefFor(faces: number[], spherical: boolean): CupRelief {
    const k = (spherical ? "s:" : "f:") + faces.slice().sort((a, b) => a - b).join(",");
    const had = reliefCache.get(k);
    if (had) return had;
    const tri = spherical ? patchesFor(faces).pos : flatTris(faces);
    const [lo, hi] = zRangeOf(tri);
    const made: CupRelief = { lo, hi, iso: contourSegments(tri, lo, hi) };
    // Bounded like the other two, and for the same reason: "by class" opens the key
    // space up to arbitrary subsets of the thirty.
    if (reliefCache.size > 400) reliefCache.delete(reliefCache.keys().next().value as string);
    reliefCache.set(k, made);
    return made;
}

/**
 * The ramp parameter for one vertex: −1 at the bottom of the cup, +1 at the top.
 *
 * `zUnit` is unit-space and `z` is the parity, so the product is the world-space
 * height and the ramp follows the model over rather than travelling with it. Turning
 * a hat into a bowl therefore turns the shading over too, which is the whole point of
 * having it.
 */
function cupRampT(zUnit: number, r: CupRelief, z: number): number {
    const span = r.hi - r.lo;
    if (!(span > 0)) return 0;
    const wLo = z > 0 ? r.lo : -r.hi;
    return ((zUnit * z - wLo) / span) * 2 - 1;
}

/** `shadeColor` without the allocation — this runs per vertex over a whole patch. */
function pushShaded(out: number[], c: THREE.Color, t: number): void {
    const k = Math.abs(t) * 0.55;
    const to = t >= 0 ? 1 : 0;
    out.push(c.r + (to - c.r) * k, c.g + (to - c.g) * k, c.b + (to - c.b) * k);
}

/**
 * Place unit-space contours on one solid, scaled by `r` and mirrored with the scene.
 *
 * Two shells, one just outside the surface and one just inside, exactly as the
 * spherical net uses: drawn at radius `r` a contour is coplanar with the surface along
 * its whole length and loses the depth test to it, and a single outer shell disappears
 * again the moment you look into the cup from inside.
 */
function placeRelief(out: number[], iso: Float32Array, r: number, c: V3, z: number): void {
    for (const shell of [1.004, 0.996]) {
        const k = r * shell;
        for (let i = 0; i < iso.length; i += 3) {
            out.push(iso[i] * k + c[0], iso[i + 1] * k + c[1], iso[i + 2] * k * z + c[2]);
        }
    }
}

// The insphere, as a mesh. ρ is not a fitted radius — the triacontahedron is
// isohedral, so all thirty face planes are tangent to one sphere and each touches at
// its own face's centroid. So a ball of radius ρ at a solid's center touches the roof
// at the middle of every rhomb that solid carries, and nowhere else. That tangency is
// the whole basis of this page, made literal.
//
// A sphere needs no parity handling at all — it is its own mirror image — so unlike
// the polyhedron it can be placed from the center alone.
const BALL_GEO = new THREE.IcosahedronGeometry(1, 4);

// a low-poly ball for the center markers
const BALL = new THREE.IcosahedronGeometry(1, 1);
const BALL_POS = BALL.getAttribute("position").array as ArrayLike<number>;

// ── build ─────────────────────────────────────────────────────────

// ── z orientation ─────────────────────────────────────────────────
//
// **Heads is the default**, and it is definable rather than merely declared: every
// generator has z = +1/√5, so a vertex sits at exactly `index · s/√5` and heads is the
// orientation in which the index runs *upward*. Tails is its reflection. Nothing about
// the surface itself distinguishes them — it has hills and dales either way — so the
// anchor is the index, the one part of all this that carries no semantics.
//
// `flip` stays the code's word for the reflection; the UI's word is tails.
let flip = false;

// **The shadow.** At rest at a parity the real roof is drawn, with its solids and its
// normals. Flat, and every frame of the transition, is a *different object*: the roof's
// own shadow, which at zero is literally the Penrose tiling the whole site is built on.
// The real roof is invisible throughout, and that is what makes the turn cheap — three
// separate things are free at zero, because there is nothing on screen to see them
// happen:
//
//   * the parity flip — a flat sheet is its own mirror image;
//   * the shading inversion — shading strength is |vscale|, so there is none;
//   * the re-render of the solids, which otherwise visibly spin a tenth of a turn,
//     since mirroring a triacontahedron is a 36° rotation and not the identity.
//
// So the solids never have to be caught mid-change. They are simply rebuilt while
// nothing is looking.
let vmag = 1;
let anim = 0;
// Flat is both a place to stop and a place to pass through, so "am I moving" cannot be
// read off the depth — it needs saying.
let animating = false;

/** LineMaterial needs the viewport in pixels, and needs telling when it changes. */
let normalMats: LineMaterial[] = [];

// Caches. The patch and its triacontahedra depend only on the selection, never on the
// orientation or the scale, and `triacontahedra()` costs 192 ms at 16,475 rhombi — far
// too much to repeat per animation frame. The lift is cached too, and intermediate
// frames come from `rescale`, which is 0.5 ms against buildRoof's 31 ms.
let patchKey = "";
let cenCache: ReturnType<typeof triacontahedra> | null = null;
let roofCache: { key: string; d: RoofData } | null = null;

function ensurePatch(): void {
    const key = `${patchSel.value}|${genSel.value}`;
    if (patchKey === key) return;
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === patchSel.value), true, Number(genSel.value));
    console.log = quiet;
    patchKey = key;
    cenCache = null;
    roofCache = null;
}

function roofAt(v: number): RoofData | null {
    const key = `${patchKey}|${flip}`;
    if (!roofCache || roofCache.key !== key) {
        const base = buildRoof(1, flip);
        if (!base) return null;
        roofCache = { key, d: base };
    }
    return rescale(roofCache.d, v);
}

/** Ease the roof to a new depth, then do whatever has to happen at the far end. */
function animateTo(target: number, then?: () => void): void {
    cancelAnimationFrame(anim);
    const from = vmag;
    const dur = 420 * Math.abs(target - from);
    if (dur < 8) {
        vmag = target;
        animating = false;
        then?.();
        rebuild(false);
        return;
    }
    const t0 = performance.now();
    animating = true;
    const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        vmag = from + (target - from) * (1 - Math.pow(1 - k, 3));
        rebuild(false);
        if (k < 1) {
            anim = requestAnimationFrame(step);
        } else {
            vmag = target;
            // Only the last leg ends the motion: a parity switch passes through flat
            // and keeps going, and `then` is what launches the second leg.
            animating = false;
            then?.();
            if (!animating) rebuild(false);
        }
    };
    anim = requestAnimationFrame(step);
}

function build(reframe: boolean): void {
    normalMats = [];
    const gen = Number(genSel.value);
    const t0 = performance.now();

    ensurePatch();
    const d = roofAt(vmag);
    if (!d) {
        statusEl.textContent =
            `${patchSel.value} generation ${gen}: no rhombs at this generation. ` +
            `Star-type seeds emit none until one generation later — try ${gen + 1}.`;
        rv.renderer.render(rv.scene, rv.camera);
        return;
    }

    if (!cenCache) cenCache = triacontahedra();
    const cen = cenCache;
    if (!ownedCache || ownedCache.length !== cen.solids.length) {
        // Once per patch, not per rebuild: it needs the whole Centers structure and does
        // not change while the patch stands.
        ownedCache = cen.solids.map((s) => ownedFaceIndices(cen, s));
    }
    const assign = cen.home;
    const mode = colorSel.value;

    // Scene coordinates for anything that is not the surface. The centers are
    // computed unflipped, so the flip is applied here — and the recentering offset is
    // the same one the mesh uses, which is the single easiest thing to get wrong.
    const zsign = flip ? -1 : 1;
    const place = (c: V3): V3 => [
        c[0] - d.offset[0],
        c[1] - d.offset[1],
        c[2] * zsign - d.offset[2],
    ];

    // The shadow keeps the roof's colors. A rhomb's class, its cluster, whether it is
    // shared — none of that depends on how deep the roof is, or on which way up it is,
    // so flattening the surface is no reason to discard what it is colored by.
    rv.drawRoof(d, {
        colorOf: (f) => {
            const s = cen.solids[assign[f.id]];
            if (mode === "cluster") return CLUSTER_3D[f.cluster] ?? CLUSTER_FALLBACK;
            // The Kowalewski five: a proper edge coloring of K₆ on the six axes, so it is
            // the triacontahedron's own coloring seen on the roof rather than a scheme
            // invented for the tiling.
            if (mode === "five") return FIVE[pairColor(f.pair[0], f.pair[1])];
            if (mode === "complete")
                return s.complete ? solidColor(s) : WASH.clone();
            if (mode === "class") {
                const rf = cen.byRhomb[f.id];
                return rf && isShared(rf, cen.solids) ? SHARED : solidColor(s);
            }
            if (mode === "type") return f.thick ? CLUSTER_3D.Pe5 ?? CLUSTER_FALLBACK : CLUSTER_FALLBACK;
            return solidColor(s);
        },
        // Shading strength is the depth, so it goes out with it rather than lying
        // about a flat sheet.
        shade: shadeChk.checked ? vmag : 0,
        useVertexColors: mode !== "plain" || shadeChk.checked,
        flatColor: PLAIN_COLOR,
        transparent: rhombSel.value === "transparent",
        edges: edgesChk.checked,
        isoglosses: isoChk.checked,
        skipSurface: rhombSel.value === "invisible",
    });

    // Moving, the roof travels alone: the solids would visibly spin a tenth of a turn
    // at the parity switch, mirroring a triacontahedron being a 36° rotation and not
    // the identity. Stopped — at flat as much as at a parity — everything comes back.
    // At flat that is worth seeing rather than hiding: the solids and normals sit at
    // their true heights while the surface lies flat beneath them, so the structure
    // stands with its roof taken away.
    if (animating) {
        statusEl.textContent =
            `${allRhombs.length} rhombi · turning over — ${(100 * vmag).toFixed(0)}% of full depth`;
        return;
    }

    const complete = cen.solids.filter((s) => s.complete);
    // The normals ran on a length slider that detented at ρ. Everything interesting
    // happens at ρ — it is where every normal lands on its center — so they are simply
    // drawn at ρ now and the slider is gone.
    const nlen = RHO;
    const wantHeadSolids = headSolidsChk.checked;
    const wantTailSolids = tailSolidsChk.checked;

    // One filter, applied to everything: markers, shells and normals all mean "the
    // solids currently under consideration", and having them disagree would make the
    // picture impossible to read.
    // What counts at all. A solid no face calls home is a nail head — the far end of a
    // normal whose point is elsewhere — and those never count. Beyond that, two
    // deliberate exclusions, both of which leave daylight when the cups are drawn:
    //
    //   demoted   home class 1, 2 or 3, so not a proper rhomb;
    //   truncated the ten-face footprint runs off the patch, so the count is a lower
    //             bound rather than a class.
    //
    // Turn both on and coverage is total, necessarily: every rhomb has a home and a
    // home's cup contains it. Verified at 0 uncovered on every patch.
    // Demoted and truncated solids are never drawn now. The class rows carry everything
    // worth steering, and both switches only ever added shapes that are not classes:
    // demoted solids have no class at all, and truncated ones are cut by the patch edge
    // so their count is a lower bound rather than a fact.
    const eligible = (s: Solid): boolean =>
        s.homeCount > 0 && s.settled && properOf(s) >= 0;
    // A **heads solid** sits above the roof in the default orientation, a **tails
    // solid** below it. Intrinsic, and deliberately so: turning the roof over shows you
    // the same solids from underneath rather than swapping them for the other set,
    // which is what turning something over means. `s.hat` is computed unflipped and
    // never moves.
    //
    // Note the hub runs the other way — a hat sits below the roof but its rosette hub
    // is at the *top* index, 396 of 396 measured — so anyone tempted to define this by
    // hub index gets the opposite set.
    const sided = (s: Solid) => (s.hat ? wantTailSolids : wantHeadSolids);
    // Demoted solids have no class row, so the global settings are all they answer to.
    const ctl = (s: Solid): ClassCtl | null => {
        const i = properOf(s);
        return i < 0 ? null : classCtl[i];
    };
    const passes = (s: Solid): boolean =>
        eligible(s) && sided(s) && (ctl(s)?.on.checked ?? true);
    /** how big to draw this class's solids, 0 for not at all */
    const sizeOf = (s: Solid) => Number(ctl(s)?.size.value ?? 1);
    const showNormalsFor = (s: Solid) =>
        passes(s) && (ctl(s)?.norm.checked ?? normalsChk.checked);
    const showRTFor = (s: Solid) => passes(s) && (ctl(s)?.rt.checked ?? true);
    const shown = cen.solids.filter(passes);

    // The normals themselves. Each face sends a segment both ways — above the map and
    // below — colored by the solid at that end, so at exactly ρ every segment lands on
    // a marker of its own color and the pencils belonging to one solid arrive
    // together. Past ρ they carry on through, which is the point: normals meet at
    // other radii too, and none of those builds anything.
    // Nail heads: a small disk lying *on* the rhomb, on the face away from the normal
    // being drawn. Single-sided, so it shows only from the side with no normal — which
    // is the whole signal. Seen from the other side the nail is a nail, not a disk.
    const heads: Array<{ c: V3; n: V3 }> = [];
    if (normalsChk.checked && nlen > 0) {
        const seg: number[] = [];
        const col: number[] = [];
        for (const rf of cen.faces) {
            const p = place(rf.c);
            const u: V3 = [rf.u[0], rf.u[1], rf.u[2] * zsign];
            const homeId = cen.home[rf.id];
            for (const [dir, sid] of [
                [1, rf.solids[0]],
                [-1, rf.solids[1]],
            ] as Array<[number, number]>) {
                if (!showNormalsFor(cen.solids[sid])) {
                    // The other end of a normal whose point is shown gets a small
                    // white head, so a nail reads as a nail: you can see which end
                    // means something and which is only the far side of the same face.
                    if (sid !== homeId && showNormalsFor(cen.solids[homeId])) {
                        heads.push({ c: p, n: [u[0] * dir, u[1] * dir, u[2] * dir] });
                    }
                    continue;
                }
                const c = solidColor(cen.solids[sid]);
                seg.push(
                    p[0], p[1], p[2],
                    p[0] + u[0] * nlen * dir,
                    p[1] + u[1] * nlen * dir,
                    p[2] + u[2] * nlen * dir,
                );
                col.push(c.r, c.g, c.b, c.r, c.g, c.b);
            }
        }
        // LineBasicMaterial ignores linewidth in WebGL — every normal came out one
        // device pixel, which at devicePixelRatio 2 is half a CSS pixel and reads as
        // gray haze rather than as a pencil of lines. LineSegments2 draws them as
        // camera-facing quads, so a width in pixels means something. Same reasoning
        // as the edges on polyhedra.html.
        if (seg.length) {
            const ng = new LineSegmentsGeometry();
            ng.setPositions(seg);
            ng.setColors(col);
            const nm = new LineMaterial({
                vertexColors: true,
                linewidth: 2.1,
                worldUnits: false,
                alphaToCoverage: true,
                transparent: true,
                opacity: 0.92,
            });
            nm.resolution.set(view.clientWidth, view.clientHeight);
            normalMats.push(nm);
            const nl = new LineSegments2(ng, nm);
            nl.renderOrder = 2;
            rv.add(nl);
        }
        if (heads.length) {
            // A four-point disk of radius 0.05 — a tenth of a unit across — lifted off
            // the face by a hair so it does not z-fight with it, and wound so its front
            // faces the direction with no normal. FrontSide then does the hiding for
            // free: no per-frame test, no sorting.
            const R = 0.05;
            const LIFT = 0.004;
            const hp: number[] = [];
            for (const h of heads) {
                const n = h.n;
                // any perpendicular will do; the disk has no preferred orientation
                const seed: V3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
                const a = nrm(cross(n, seed));
                const b = cross(n, a); // (a, b, n) right-handed, so CCW from +n
                const at = (t: number): V3 => [
                    h.c[0] + n[0] * LIFT + (a[0] * Math.cos(t) + b[0] * Math.sin(t)) * R,
                    h.c[1] + n[1] * LIFT + (a[1] * Math.cos(t) + b[1] * Math.sin(t)) * R,
                    h.c[2] + n[2] * LIFT + (a[2] * Math.cos(t) + b[2] * Math.sin(t)) * R,
                ];
                const q = [0, 1, 2, 3].map((k) => at((k * Math.PI) / 2));
                for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) hp.push(v[0], v[1], v[2]);
            }
            const hg = new THREE.BufferGeometry();
            hg.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
            const hm = new THREE.Mesh(
                hg,
                new THREE.MeshBasicMaterial({ color: 0xf7f7fa, side: THREE.FrontSide }),
            );
            hm.renderOrder = 1;
            rv.add(hm);
        }
    }

    // The solids themselves. Only the complete ones: a partial group names a real
    // triacontahedron too, but drawing all of them fills the view with overlapping
    // shells — they interpenetrate freely, centers as close as one long diagonal,
    // where the complete ones are never nearer than φ³ and read as separate objects.
    let rtNote = "";
    const rtMode = rtSel.value;
    const rtExtent = rtExtentSel.value;
    // Which faces of each RT to draw, independent of the extent it is drawn at:
    //
    //   full   all thirty
    //   cups   the ten on the roof's side — a cup above the roof, a hat below it
    //   class  only the rhombs the solid actually owns in this patch, so four, five or
    //          ten. This is the class made visible: a solid wears exactly its own
    //          footprint and nothing it merely could have had.
//   voronoi  no face set at all: the part of the ball nearer to its own center than
//            to any other drawn one, so neighbors meet on a curve instead of leaving
//            a seam. Midsphere only — see the note above `voronoiPlanes`.
    const rtFaces = rtFacesSel.value;
    const voronoi = rtFaces === "voronoi" && rtExtent === "midsphere";
    const rtCup = rtFaces === "cups" || rtFaces === "class";
    const facesOf = (s: Solid): number[] =>
        rtFaces === "cups" ? cupIndices(s)
        // Voronoi wears the footprint's net and nothing else — the skirt it grows has
        // no rhombs in it — so it asks for the same faces `by class` does. Without this
        // the shared net block below draws the whole thirty-rhomb cage.
        : rtFaces === "class" || voronoi ? ownedOf(s)
        : ALL_FACES;
    const spherical = rtExtent === "sphere" || rtExtent === "midsphere";
    const sphereR = rtExtent === "midsphere" ? MIDRADIUS : RHO;
    const surfaceShown = rhombSel.value !== "invisible";
    // The relief cues, live wherever the surface is open — a cup, a class footprint or
    // a Voronoi cell. See `reliefFor` above.
    const partial = rtCup || voronoi;
    const cupShade = partial && rtShadeChk.checked;
    const cupIso = partial && rtIsoChk.checked;
    if (rtMode !== "invisible") {
        // Unit-space contours, scaled and placed per solid, gathered from whichever of
        // the two surface paths runs and drawn once at the end.
        const isoSeg: number[] = [];
        const tris: number[] = [];
        const cols: number[] = [];
        const lines: number[] = [];
        // Spheres go up as one instanced mesh rather than a merged buffer: at 671
        // complete solids on Sun gen 4 a merged ball of this tessellation would be
        // over a million vertices, and they are all the same ball.
        const balls = shown.filter((s) => showRTFor(s) && sizeOf(s) > 0);
        if (voronoi && balls.length) {
            // The territory each ball keeps, and the curves where it hands over. Cut in
            // unmirrored unit coordinates and placed on the way out, exactly as the cups
            // are, so a cell and a cup on the same ball are cut from one tessellation.
            //
            // Every ball is clipped against every other that reaches it, which is O(n²)
            // in the distance test and O(n · mesh · clips) in the clipping. The distance
            // test is the cheap half and the budget is set by the other.
            if (balls.length > 400) {
                rtNote += ` · ${balls.length.toLocaleString()} Voronoi cells is more ` +
                    `clipping than this will do at once — show fewer classes, or drop ` +
                    `a generation.`;
            } else {
                const z = zsign;
                // The partition is a property of the PACKING, not of the view. Every
                // eligible proper solid takes part in the clip whether or not it is
                // currently drawn — class unchecked, RT unchecked, size at zero, its
                // side of the roof hidden, it still clips. Otherwise unchecking blue and
                // purple lets green swell to fill its whole hemisphere, and the curve a
                // ball meets its neighbour on moves every time something is toggled,
                // which makes it a fact about the checkboxes rather than about the
                // solids. Neighbours are taken at full radius for the same reason.
                const partners = cen.solids.filter(eligible)
                    .map((s) => ({ c: place(s.c), r: sphereR, id: s.id }));
                const cells = balls.map((s) => ({ c: place(s.c), r: sphereR * sizeOf(s), s }));
                const pos: number[] = [];
                const nrmls: number[] = [];
                const cell: number[] = [];
                const meet: number[] = [];
                for (const b of cells) {
                    const clips = voronoiPlanes(
                        b.c, b.r, partners.filter((o) => o.id !== b.s.id), z);
                    const col = solidColor(b.s);
                    // Reflecting z reverses the winding, and these carry supplied
                    // normals: see the note in the cup path below.
                    const order = z > 0 ? [0, 1, 2] : [2, 1, 0];
                    const own = new Set(ownedOf(b.s));
                    const cup = new Set(cupIndices(b.s));
                    for (const t of voronoiCell(clips, own, cup)) {
                        for (const oi of order) {
                            const v = t[oi];
                            pos.push(v[0] * b.r + b.c[0], v[1] * b.r + b.c[1], v[2] * b.r * z + b.c[2]);
                            nrmls.push(v[0], v[1], v[2] * z);
                            // The cell can reach anywhere on the ball, so the ramp runs
                            // over the whole sphere rather than over a face set's span.
                            if (cupShade) pushShaded(cell, col, v[2] * z);
                            else cell.push(col.r, col.g, col.b);
                        }
                    }
                    // Two shells for every line, for the reason the spherical net gives.
                    for (const shell of [1.004, 0.996]) {
                        const r = b.r * shell;
                        for (let i = 0; i < clips.length; i++) {
                            circleOnCell(meet, clips[i].u, clips[i].k, clips, i, r, b.c, z, cup, own);
                        }
                        // Contours are a relief cue, not a boundary, so they run over
                        // the footprint as they do in every other mode.
                        if (cupIso) {
                            for (let k = 1; k <= ISO_LEVELS; k++) {
                                circleOnCell(isoSeg, [0, 0, 1], -1 + (2 * k) / (ISO_LEVELS + 1),
                                             clips, -1, r, b.c, z, cup, NO_FACES);
                            }
                        }
                    }
                }
                const g = new THREE.BufferGeometry();
                g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
                g.setAttribute("normal", new THREE.Float32BufferAttribute(nrmls, 3));
                g.setAttribute("color", new THREE.Float32BufferAttribute(cell, 3));
                rv.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({
                    vertexColors: true, roughness: 0.42, metalness: 0.03,
                    side: THREE.DoubleSide,
                    transparent: rtMode === "transparent",
                    opacity: rtMode === "transparent" ? (surfaceShown ? 0.42 : 0.66) : 1,
                    depthWrite: rtMode !== "transparent",
                })));
                // The meeting curves themselves, drawn whatever the edge checkbox says:
                // they are the boundary of the territory rather than a feature of the
                // solid, and without them two cells of one color run together.
                if (meet.length) {
                    const mg = new LineSegmentsGeometry();
                    mg.setPositions(meet);
                    const mm = new LineMaterial({
                        color: 0x1b1e24, linewidth: 1.6, worldUnits: false, alphaToCoverage: true,
                    });
                    mm.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
                    normalMats.push(mm);
                    const ml = new LineSegments2(mg, mm);
                    ml.renderOrder = 2;
                    rv.add(ml);
                }
            }
        } else if (spherical && rtCup && balls.length) {
            // Cups on a sphere: only the ten spherical rhombs, not the whole ball. The
            // patches are built once at unit radius and copied per solid, exactly as the
            // net is, so the two always agree about where the boundary is.
            const per = patchesFor(facesOf(balls[0])).pos.length;
            if ((balls.length * per) / 3 > 1_500_000) {
                rtNote += ` · ${balls.length.toLocaleString()} spherical caps is too much ` +
                    `surface to draw — show fewer classes, or turn cups off.`;
            } else {
                const pos: number[] = [];
                const nrm: number[] = [];
                const cols: number[] = [];
                const z = flip ? -1 : 1;
                for (const s of balls) {
                    const fs = facesOf(s);
                    const { pos: up, nrm: un } = patchesFor(fs);
                    const r = sphereR * sizeOf(s);
                    const c = place(s.c);
                    const col = solidColor(s);
                    const relief = cupShade || cupIso ? reliefFor(fs, true) : null;
                    for (let t = 0; t < up.length; t += 9) {
                        // Reflecting z reverses each triangle's winding, and these carry
                        // **supplied** normals rather than computed ones. Left alone,
                        // `DoubleSide` sees a back face and negates the normal I gave it,
                        // so a mirrored cap ends up lit from the inside — the light
                        // apparently moving underneath the model when parity is switched.
                        // Reversing the winding puts the two back in step.
                        const order = z > 0 ? [0, 3, 6] : [6, 3, 0];
                        for (const o of order) {
                            const i = t + o;
                            pos.push(up[i] * r + c[0], up[i + 1] * r + c[1], up[i + 2] * r * z + c[2]);
                            nrm.push(un[i], un[i + 1], un[i + 2] * z);
                            if (cupShade && relief) pushShaded(cols, col, cupRampT(up[i + 2], relief, z));
                            else cols.push(col.r, col.g, col.b);
                        }
                    }
                    if (cupIso && relief) placeRelief(isoSeg, relief.iso, r, c, z);
                }
                const g = new THREE.BufferGeometry();
                g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
                g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
                g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
                rv.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({
                    vertexColors: true, roughness: 0.42, metalness: 0.03,
                    side: THREE.DoubleSide,
                    transparent: rtMode === "transparent",
                    opacity: rtMode === "transparent" ? (surfaceShown ? 0.42 : 0.66) : 1,
                    depthWrite: rtMode !== "transparent",
                })));
            }
        } else if (spherical && balls.length) {
            // All thirty spherical rhombs tile the sphere, so the whole ball is the same
            // picture and one instanced mesh draws it however many there are.
            const mesh = new THREE.InstancedMesh(
                BALL_GEO,
                new THREE.MeshStandardMaterial({
                    roughness: 0.42,
                    metalness: 0.03,
                    transparent: rtMode === "transparent",
                    opacity: rtMode === "transparent" ? (surfaceShown ? 0.42 : 0.66) : 1,
                    depthWrite: rtMode !== "transparent",
                }),
                balls.length,
            );
            const m = new THREE.Matrix4();
            balls.forEach((s, i) => {
                const r = sphereR * sizeOf(s);
                const c = place(s.c);
                m.makeScale(r, r, r).setPosition(c[0], c[1], c[2]);
                mesh.setMatrixAt(i, m);
                mesh.setColorAt(i, solidColor(s));
            });
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            rv.add(mesh);
        }

        // The spherical triacontahedron, when the extent is a sphere and edges are on.
        // Each solid gets a copy of a precomputed unit net, scaled to its own radius.
        // Two nets are in play under `cups`, not one: `cupIndices` returns the top ten
        // faces for a hat and the bottom ten for a bowl, so hats and bowls carry
        // different halves of the solid. The cache keys on the face set and so holds both.
        //
        // Budgeted like the solids are — the net is 60 arcs of 7 segments, and past a few
        // hundred solids that is more line than anyone can read.
        if (spherical && rtEdgesChk.checked && balls.length) {
            const perSolid = (rtCup || voronoi ? 20 : 60) * 7 * 6 * 2; // two shells, see below
            if (balls.length * perSolid > 4_000_000) {
                rtNote += ` · ${balls.length.toLocaleString()} spherical nets is too much ` +
                    `line to draw — turn edges off or show fewer classes.`;
            } else {
                const seg: number[] = [];
                const z = flip ? -1 : 1;
                // Two shells, one just outside the surface and one just inside.
                //
                // Drawn at exactly `r` the arcs are coplanar with the ball along their
                // whole length and lose the depth test to it, so nothing shows at all. A
                // single shell outside fixes that from the outside and reintroduces it
                // from within — and with a solid surface you are often looking into the
                // cap, where the outer copy is behind the very surface it is drawn on. A
                // pair costs one more line buffer and is visible from either side.
                for (const shell of [1.004, 0.996]) {
                    for (const s of balls) {
                        const net = netFor(facesOf(s));
                        const r = sphereR * sizeOf(s) * shell;
                        const c = place(s.c);
                        // Mirrored with the scene, exactly as the solids are.
                        for (let i = 0; i < net.length; i += 3) {
                            seg.push(net[i] * r + c[0], net[i + 1] * r + c[1], net[i + 2] * r * z + c[2]);
                        }
                    }
                }
                const g = new LineSegmentsGeometry();
                g.setPositions(seg);
                const m = new LineMaterial({
                    color: 0x1b1e24, linewidth: 2.0, worldUnits: false, alphaToCoverage: true,
                });
                m.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
                normalMats.push(m);
                const ls = new LineSegments2(g, m);
                ls.renderOrder = 2;
                rv.add(ls);
            }
        }

        // A budget, because generation 5 can ask for more than is reasonable: 19,056
        // proper solids on the Sun, which at the full thirty faces is 3.4 million
        // vertices rebuilt on every control change. Refuse and say so rather than
        // hanging. Spheres are exempt — they are one instanced mesh however many there
        // are, which is what makes them the answer at this size.
        const drawCount = shown.filter((s) => showRTFor(s) && sizeOf(s) > 0).length;
        const vertsWanted = drawCount * (rtCup ? 10 : 30) * 6;  // ten is the worst case for cups and class alike
        const overBudget = !spherical && vertsWanted > 1_500_000;
        if (overBudget) {
            rtNote =
                ` · ${drawCount.toLocaleString()} ${rtFaces === "class" ? "class footprints" : rtCup ? "cups" : "RTs"} ` +
                `is ${(vertsWanted / 1e6).toFixed(1)}M vertices — too many to draw. ` +
                `Switch Extent to a sphere, or show fewer classes.`;
        }
        for (const s of spherical || overBudget ? [] : shown) {
            if (!showRTFor(s)) continue;
            const t = sizeOf(s);
            if (t <= 0) continue;
            const col = solidColor(s);
            const fs = facesOf(s);
            const relief = cupShade || cupIso ? reliefFor(fs, false) : null;
            for (const i of fs) {
                const f = solidFace(s, i, flip, t, d.offset);
                // The unit face alongside the placed one: the ramp is a function of
                // unit-space height, so it does not have to undo the placement.
                const u = RT_FACES[i];
                for (const k of [0, 1, 2, 0, 2, 3]) {
                    const v = f[k];
                    tris.push(v[0], v[1], v[2]);
                    if (cupShade && relief) pushShaded(cols, col, cupRampT(u[k][2], relief, zsign));
                    else cols.push(col.r, col.g, col.b);
                }
                for (let k = 0; k < 4; k++) {
                    const a = f[k];
                    const b = f[(k + 1) % 4];
                    lines.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                }
            }
            if (cupIso && relief) placeRelief(isoSeg, relief.iso, t, place(s.c), zsign);
        }
        if (tris.length) {
        const sg = new THREE.BufferGeometry();
        sg.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
        sg.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
        sg.computeVertexNormals();
        rv.add(
            new THREE.Mesh(
                sg,
                new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.7,
                    metalness: 0.02,
                    flatShading: true,
                    transparent: rtMode === "transparent",
                    // Transparency needs something to sit against. With the rhombi
                    // drawn, a shell at 0.38 lies over a mid-tone surface and reads as
                    // colored; with them invisible it lies over the near-white page
                    // and washes out — #8b4fc8 composites to #ccb5e5, which looks like
                    // no color at all. So the opacity follows the surface: heavier
                    // when there is nothing behind it to tint.
                    opacity: rtMode === "transparent" ? (surfaceShown ? 0.38 : 0.62) : 1,
                    depthWrite: rtMode !== "transparent",
                    side: THREE.DoubleSide,
                }),
            ),
        );
        if (rtEdgesChk.checked) {
        // Screen-space width, like the normals above. `LineBasicMaterial` ignores
        // `linewidth` on every desktop driver, so these were one-pixel hairlines at half
        // opacity — present in the buffer and all but invisible on the glass.
        const lg = new LineSegmentsGeometry();
        lg.setPositions(lines);
        const lm = new LineMaterial({
            color: 0x1b1e24, linewidth: 2.0, worldUnits: false, alphaToCoverage: true,
        });
        lm.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
        normalMats.push(lm);
        const ll = new LineSegments2(lg, lm);
        ll.renderOrder = 2;
        rv.add(ll);
        }
        }

        // The contours, gathered from whichever surface path ran. Lighter and thinner
        // than the edges they lie between: the creases say where one rhomb stops and
        // the next begins, and these say only how high you are.
        if (isoSeg.length) {
            const ig = new LineSegmentsGeometry();
            ig.setPositions(isoSeg);
            const im = new LineMaterial({
                color: 0x1d2026, linewidth: 1.2, worldUnits: false,
                transparent: true, opacity: 0.6, alphaToCoverage: true,
            });
            im.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
            normalMats.push(im);
            const il = new LineSegments2(ig, im);
            il.renderOrder = 2;
            rv.add(il);
        }
    }

    // Framing is computed as though every solid were showing at full size, whatever
    // the checkboxes and sliders currently say. Any control that moved the camera
    // would lurch the view every time it was touched, and a solid reaches φ from its
    // own center where the roof's whole relief is 1.342 — so the difference is not
    // small enough to ignore either.
    if (reframe) {
        let reach = rv.roofRadius();
        for (const s of cen.solids) {
            if (s.faces.length < 2) continue;
            const p = place(s.c);
            reach = Math.max(reach, Math.hypot(p[0], p[1], p[2]) + (s.complete ? PHI : 0));
        }
        rv.frame(reach);
    }

    const hist: Record<number, number> = {};
    for (const s of cen.solids) hist[s.faces.length] = (hist[s.faces.length] ?? 0) + 1;
    // The face classes: each rhomb takes the size of the larger of its two solids,
    // which is what largest-first assignment gives it anyway.
    const cls: Record<number, number> = {};
    let demoted = 0;
    for (const f of d.faces) {
        const i = properOf(cen.solids[assign[f.id]]);
        if (i < 0) demoted++;
        else cls[i] = (cls[i] ?? 0) + 1;
    }
    const clsText = PROPER.map((p, i) => `${p.label}:${cls[i] ?? 0}`).join(" ");
    // how many solids of each class the patch is entitled to classify
    const perClass = PROPER.map(() => 0);
    for (const s of cen.solids) {
        const i = properOf(s);
        if (i >= 0 && eligible(s)) perClass[i]++;
    }
    // Rhombi whose home solid is not being drawn — the daylight you see through the
    // cups when the surface is invisible. Zero only when demoted and truncated are
    // both on, and then necessarily zero.
    let bare = 0;
    for (const f of d.faces) if (!passes(cen.solids[cen.home[f.id]])) bare++;
    PROPER.forEach((_, i) => { classCtl[i].count.textContent = String(perClass[i]); });
    let sharedFaces = 0;
    for (const f of cen.faces) if (isShared(f, cen.solids)) sharedFaces++;
    sharedCount.textContent = String(sharedFaces);
    const hats = complete.filter((s) => s.hat).length;
    const pe5 = pe5Rosettes().length;
    const onCap = new Set<number>();
    for (const s of complete) for (const f of s.faces) onCap.add(f);
    const ms = Math.round(performance.now() - t0);
    statusEl.textContent =
        `${allRhombs.length} rhombi · ${cen.solids.length} triacontahedra touched · ` +
        `group sizes ${JSON.stringify(hist)} · ` +
        `${complete.length} complete (${hats} below the roof, ${complete.length - hats} above)` +
        `${complete.length === pe5 ? "" : ` ⚠ against ${pe5} Pe5 rosettes`} · ` +
        `${onCap.size} of ${allRhombs.length} faces on a complete cap ` +
        `(${((100 * onCap.size) / allRhombs.length).toFixed(0)}%) · ` +
        `${shown.length} of ${perClass.reduce((a, b) => a + b, 0)} proper solids shown · ` +
        `rhombi by class ${clsText}, ${demoted} demoted · ` +
        `${bare} rhombi with no cup over them${bare ? " (turn on demoted and truncated)" : ""} · ` +
        // What the RT controls are actually doing, spelled out. A toggle that has not
        // taken effect is then visible here instead of being a matter of opinion about
        // what the picture looks like.
        `RTs ${rtSel.value}, ${
            rtExtent === "full"
                ? (rtFaces === "class" ? "by class — each RT wears its own footprint"
                    : rtFaces === "cups" ? "cups — 10 faces each" : "whole RT — 30 faces each")
            : `${rtExtent === "midsphere" ? "midsphere" : "insphere"} r=${sphereR.toFixed(4)}, ` +
              `${voronoi ? "Voronoi cells — each ball nearer its own center than any other"
                  : rtFaces === "class" ? "spherical rhombs by class"
                  : rtFaces === "cups" ? "10 spherical rhombs"
                  : "whole ball (30 rhombs, tiling it)"}` +
              `${rtEdgesChk.checked ? " + net" : ""}`
        } · ${ms} ms${rtNote}`;
}

// ── controls ──────────────────────────────────────────────────────

// Short in the list, long in the tooltip. The caption beside the select already says
// Patch, and the dropdown has to fit a tile.
for (const [code, nick, full] of [
    ["Pe5", "Pe5", "Pe5 pentagon"],
    ["Pe3", "Pe3", "Pe3 pentagon"],
    ["Pe1", "Pe1", "Pe1 pentagon"],
    ["St5", "St5 star", "St5 star"],
    ["St3", "St3 boat", "St3 boat"],
    ["St1", "St1 diamond", "St1 diamond"],
    ["Deca", "Queen", "Queen — a composite of pentagons and stars"],
    ["Sun", "Sun", "Sun — a composite of pentagons and stars"],
    ["Star", "Star", "Star — a composite of pentagons and stars"],
] as Array<[string, string, string]>) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = nick;
    o.title = full;
    patchSel.appendChild(o);
}
patchSel.value = prefs.patch;
if (!patchSel.value) patchSel.value = PREF_DEFAULTS.patch;
/**
 * Fill the generation list for the current patch, ghosting what will not draw.
 *
 * The ceiling depends on the settings, because what this page costs depends on them. A
 * sphere is one instanced mesh however many there are, so the spherical extents reach much
 * further than the full solid does; edges on the spherical net cost per solid again. So the
 * list is refilled whenever those change rather than being fixed once at startup.
 */
function fillGenerations(prefer?: number): void {
    const code = patchSel.value || PREF_DEFAULTS.patch;
    const keep = prefer ?? Number(genSel.value);
    // Voronoi clips a whole-sphere mesh per ball against every neighbour that reaches
    // it, and caps at 400 cells. Proper solids run about 0.14 of the rhomb count, so
    // that ceiling is about 3,000 rhombi — far below anything else here.
    const vor = rtFacesSel.value === "voronoi" && rtExtentSel.value === "midsphere"
        && rtSel.value !== "invisible";
    const cheap = !vor && (rtSel.value === "invisible"
        || ((rtExtentSel.value === "sphere" || rtExtentSel.value === "midsphere")
            && !rtEdgesChk.checked));
    // Worked from the two budgets further down rather than picked. The full solid costs
    // 180 vertices per solid against a 1.5M ceiling, so ~8,300 solids; the spherical net
    // costs 60 arcs x 7 segments x 6 floats = 2,520 against 4M, so ~1,590. Solids run
    // about 0.13 of the rhomb count, which puts the two at ~64,000 and ~12,000 rhombs.
    // A sphere with no edges is one instanced mesh and barely cares.
    const limit = vor ? 3000 : cheap ? 120000 : rtExtentSel.value === "full" ? 45000 : 12000;
    genSel.textContent = "";
    const usable = (g: number) => {
        const n = patchSize(code, g);
        return n > 0 && n <= limit;
    };
    for (let g = 1; g <= MAX_GENERATION; g++) {
        const n = patchSize(code, g);
        const o = document.createElement("option");
        o.value = String(g);
        if (n <= 0) {
            o.textContent = `${g} — none`;
            o.disabled = true;
            o.title = `${code} does not exist at generation ${g}`;
        } else if (!usable(g)) {
            o.textContent = `${g} — ${n.toLocaleString()}`;
            o.disabled = true;
            o.title = `${n.toLocaleString()} rhombs is past what the current settings can draw` +
                `${cheap ? "" : " — turn the solids off, or use a sphere extent without edges"}`;
        } else {
            o.textContent = `${g} — ${n.toLocaleString()}${n > limit / 4 ? " (slow)" : ""}`;
            o.title = `${n.toLocaleString()} rhombs`;
        }
        genSel.appendChild(o);
    }
    let g = keep || PREF_DEFAULTS.gen;
    if (!usable(g)) {
        let best = 0;
        for (let i = 1; i <= MAX_GENERATION; i++) if (usable(i) && (i <= g || best === 0)) best = i;
        g = best || 2;
    }
    genSel.value = String(g);
    if (!genSel.value) {
        const first = Array.from(genSel.options).find((o) => !o.disabled);
        if (first) genSel.value = first.value;
    }
}
colorSel.value = prefs.color;
if (!colorSel.value) colorSel.value = PREF_DEFAULTS.color;
normalsChk.checked = prefs.normals;
flip = prefs.parity === "tails";
headsRadio.checked = !flip;
tailsRadio.checked = flip;
flatChk.checked = prefs.flat;
vmag = flatChk.checked ? 0 : 1;
headSolidsChk.checked = prefs.headsolids;
tailSolidsChk.checked = prefs.tailsolids;
rhombSel.value = prefs.rhombmode || PREF_DEFAULTS.rhombmode;
if (!rhombSel.value) rhombSel.value = PREF_DEFAULTS.rhombmode;
edgesChk.checked = prefs.edges;
shadeChk.checked = prefs.shade;
isoChk.checked = prefs.isogloss;
normalsChk.checked = prefs.normals;
rtSel.value = prefs.rtmode || PREF_DEFAULTS.rtmode;
if (!rtSel.value) rtSel.value = PREF_DEFAULTS.rtmode;
// "Cup only" used to be a third extent and is now a checkbox, so a saved setting from
// before the change is migrated rather than dropped on the floor — a select handed a
// value no option carries reports "" and every comparison against it fails quietly.
const savedExtent = prefs.rtextent === "cup" ? "full" : prefs.rtextent;
rtExtentSel.value = savedExtent || PREF_DEFAULTS.rtextent;
if (!rtExtentSel.value) rtExtentSel.value = PREF_DEFAULTS.rtextent;
rtEdgesChk.checked = prefs.rtedges;
// Migrated twice over now: "cup" was once an extent, then a checkbox, and is now one
// value of this dropdown. Both older shapes are honoured rather than silently dropped.
rtFacesSel.value = prefs.rtfaces
    || (prefs.rtextent === "cup" || (prefs as { rtcups?: boolean }).rtcups ? "cups" : PREF_DEFAULTS.rtfaces);
if (!rtFacesSel.value) rtFacesSel.value = PREF_DEFAULTS.rtfaces;
rtShadeChk.checked = prefs.rtshade ?? PREF_DEFAULTS.rtshade;
rtIsoChk.checked = prefs.rtisogloss ?? PREF_DEFAULTS.rtisogloss;

/**
 * The two relief cues only have work to do where the surface is open.
 *
 * At `All 30` the solid closes and there is nothing ambiguous about it — the lighting
 * and the silhouette already say ball, and a height ramp laid over all thirty faces
 * only argues with them. So the pair goes dead at `All 30` and lives at `Cup` and
 * `By class`. Disabled rather than hidden: a control that vanishes takes the fact that
 * it exists with it.
 */
const voronoiOpt = Array.from(rtFacesSel.options).find((o) => o.value === "voronoi")!;
function syncCupControls(): void {
    // Voronoi is a midsphere construction. It would run at any radius, but the
    // measurement it rests on was made at the midsphere, and at ρ the kissing shell
    // lands exactly on the contact, so half the pairs would meet at a point rather
    // than on a curve. Disabled elsewhere rather than hidden, and a selection that
    // stops being legal falls back to the footprint it is closest to.
    const mid = rtExtentSel.value === "midsphere";
    voronoiOpt.disabled = !mid;
    voronoiOpt.title = mid
        ? "Each ball keeps the part of its surface nearer to its own center than to any "
          + "other, so neighbors meet on a curve instead of leaving a seam"
        : "Midsphere only";
    if (!mid && rtFacesSel.value === "voronoi") rtFacesSel.value = "class";
    const live = rtFacesSel.value !== "full" && rtSel.value !== "invisible";
    for (const c of [rtShadeChk, rtIsoChk]) {
        c.disabled = !live;
        c.parentElement?.classList.toggle("off", !live);
    }
}
// After every select that feeds the limit has been restored, not before — the list that
// gets built depends on the extent and on whether edges are on.
// Before the generation list, which now has a Voronoi ceiling of its own: a saved
// Voronoi selection is illegal the moment the saved extent is not the midsphere.
syncCupControls();
fillGenerations(Number(prefs.gen) || PREF_DEFAULTS.gen);

// One row per proper class: show, its own normals and solids overrides, a size slider
// and a live population. The three globals above are master switches — flipping one
// writes through to every class, and the class controls are the state from then on, so
// an individual class genuinely overrides rather than being ANDed into silence.
PROPER.forEach((p, i) => {
    const wrap = document.createElement("span");
    wrap.className = "cls";
    wrap.style.borderLeftColor = `#${p.color.getHexString()}`;
    wrap.title = p.hint;

    const row1 = document.createElement("span");
    row1.className = "row";
    const on = document.createElement("input");
    on.type = "checkbox";
    on.checked = prefs.classOn[i] ?? true;
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = `#${p.color.getHexString()}`;
    const name = document.createElement("strong");
    name.textContent = p.label;
    const count = document.createElement("span");
    count.className = "count";
    row1.append(on, sw, name, count);

    const row2 = document.createElement("span");
    row2.className = "row";
    const mk = (label: string, checked: boolean) => {
        const l = document.createElement("label");
        l.className = "row";
        const c = document.createElement("input");
        c.type = "checkbox";
        c.checked = checked;
        l.append(c, document.createTextNode(label));
        row2.appendChild(l);
        return c;
    };
    const norm = mk("N", prefs.classNorm[i] ?? true);
    norm.title = `Normals for class ${p.label}`;
    const rt = mk("RT", prefs.classRT[i] ?? true);
    rt.title = `Triacontahedra for class ${p.label}`;

    const size = document.createElement("input");
    size.type = "range";
    size.min = "0";
    size.max = "1";
    size.step = "0.01";
    size.value = String(prefs.classSize[i] ?? 1);
    size.title = `How big to draw class ${p.label} solids`;
    // Beside N and RT, not below them: a third line here would be a third line on
    // every tile, since the bar is only as short as its tallest one.
    row2.appendChild(size);

    wrap.append(row1, row2);
    classBar.appendChild(wrap);
    classCtl.push({ on, norm, rt, size, count });
    for (const c of [on, norm, rt]) c.addEventListener("change", () => rebuild(false));
    size.addEventListener("input", () => rebuild(false));
});

// A legend chip rather than a control: "shared" is a property of a rhomb, not a class
// of solid, so there is nothing to show or size — only something to recognize.
const sharedCount = (() => {
    const wrap = document.createElement("span");
    wrap.className = "cls";
    wrap.style.borderLeftColor = `#${SHARED.getHexString()}`;
    wrap.title =
        "Rhombi lying on two proper solids at once — always a class 4 against a class 5b, always thick";
    const row = document.createElement("span");
    row.className = "row";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = `#${SHARED.getHexString()}`;
    const name = document.createElement("strong");
    name.textContent = "shared";
    const count = document.createElement("span");
    count.className = "count";
    row.append(sw, name, count);
    wrap.append(row);
    classBar.appendChild(wrap);
    return count;
})();

// master switches
normalsChk.addEventListener("change", () => {
    for (const c of classCtl) c.norm.checked = normalsChk.checked;
});
rtSel.addEventListener("change", () => {
    if (rtSel.value !== "invisible") for (const c of classCtl) c.rt.checked = true;
});

function rebuild(reframe: boolean): void {
    // Generating a patch and finding its triacontahedra takes about two seconds at
    // generation 5 — the Sun is 112,000 rhombi — and it blocks the thread. Announce it
    // and yield a frame so the message actually paints first, which is the same
    // treatment the workbench gives its search.
    if (`${patchSel.value}|${genSel.value}` !== patchKey) {
        rv.clear();
        statusEl.textContent = `building ${patchSel.value} generation ${genSel.value}…`;
        rv.renderer.render(rv.scene, rv.camera);
        requestAnimationFrame(() => build(reframe));
        return;
    }
    rv.clear();
    build(reframe);
}
patchSel.addEventListener("change", () => { fillGenerations(); rebuild(true); });
genSel.addEventListener("change", () => rebuild(true));
// These three set the ceiling, so the list is rebuilt when they move. A generation that
// was reachable on spheres may not be on the full solid, and it is better for the option
// to go grey than for the page to try it.
// Registered first, so a selection that has just become illegal is corrected before
// anything downstream reads it.
for (const c of [rtFacesSel, rtSel, rtExtentSel]) {
    c.addEventListener("change", syncCupControls);
}
for (const c of [rtSel, rtExtentSel, rtEdgesChk, rtFacesSel]) {
    c.addEventListener("change", () => { fillGenerations(); rebuild(false); });
}
for (const c of [colorSel, headSolidsChk, tailSolidsChk, rhombSel, edgesChk, shadeChk,
                 isoChk, normalsChk, rtFacesSel, rtShadeChk, rtIsoChk]) {
    c.addEventListener("change", () => rebuild(false));
}
syncCupControls();

// Switching parity runs the roof down to flat, turns it over while nothing is on
// screen, and runs it back out. Already flat, there is nothing to animate — the parity
// simply becomes the one it will rise into.
for (const r of [headsRadio, tailsRadio]) {
    r.addEventListener("change", () => {
        const want = tailsRadio.checked;
        if (want === flip) return;
        if (vmag < 1e-6) {
            // Already flat: asking for the other parity is asking to see it, so leave
            // flat rather than sitting there in the new orientation. It also puts the
            // 36° re-render back under cover — the solids turn over while the motion
            // has them hidden, instead of spinning in place with nothing to hide behind.
            flip = want;
            flatChk.checked = false;
            animateTo(1);
            return;
        }
        // `flat` is a destination, not a waypoint: it does not tick on the way past.
        animateTo(0, () => {
            flip = want;
            animateTo(1);
        });
    });
}
flatChk.addEventListener("change", () => animateTo(flatChk.checked ? 0 : 1));
function persist(): void {
    savePrefs(PREFS_KEY, {
        patch: patchSel.value,
        gen: Number(genSel.value),
        color: colorSel.value,
        parity: flip ? "tails" : "heads",
        flat: flatChk.checked,
        headsolids: headSolidsChk.checked,
        tailsolids: tailSolidsChk.checked,
        rhombmode: rhombSel.value,
        edges: edgesChk.checked,
        shade: shadeChk.checked,
        isogloss: isoChk.checked,
        normals: normalsChk.checked,
        rtmode: rtSel.value,
        rtextent: rtExtentSel.value,
        rtedges: rtEdgesChk.checked,
        rtfaces: rtFacesSel.value,
        rtshade: rtShadeChk.checked,
        rtisogloss: rtIsoChk.checked,
        classOn: classCtl.map((c) => c.on.checked),
        classNorm: classCtl.map((c) => c.norm.checked),
        classRT: classCtl.map((c) => c.rt.checked),
        classSize: classCtl.map((c) => Number(c.size.value)),
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);

el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the centers view to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});

window.addEventListener("resize", () => {
    rv.resize();
    for (const m of normalMats) m.resolution.set(view.clientWidth, view.clientHeight);
});

console.log(`centers build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}

rv.resize();
rebuild(true);
rv.start();
