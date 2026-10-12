// Exceptional Singularity — the one point in the Penrose plane where the roof stands up.
//
// See EXCEPTIONAL.md for the plan and `pentagrid/PLAN.md` §5.0 and §5.12 for the
// mathematics. The short of it: the decagon needs every γⱼ integral, and since only
// γⱼ mod 1 matters that is γ ≡ 0 — the one phase vector that is its own class. It is not
// rare, it is **one point**, and no LI 1 or LI 2 tiling has one anywhere.
//
// This is phase 1, and phase 1 is deliberately modest: reproduce the Queen patch as a
// Wieringa roof in the Cage's visual language, and stop. `Deca` — the composite the site
// calls **Queen** — is the cartwheel, and the cartwheel is this singularity, so the
// patch needs no new generator. The skewbs and the F₂₀ at the center come next, once
// Jake has looked at this.
//
// Everything about *looking* is in `goldenview.ts`, which is the Cage's renderer with
// the dissection taken out of it. What is left here is this page: where the rhombi come
// from, how they are shaded, and the readout.

import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { seedTypes, generatePatch, allRhombs, vertexList, computeLift } from "./geometry.js";
import { buildRoof } from "./roofgeom.js";
import * as THREE from "three";
import { createGoldenView } from "./goldenview.js";
import type { GoldenFace, FaceMode, EdgeMode, Scheme, Cap } from "./goldenview.js";
import { readingsOf, starsOf, starSig, LEGAL_STARS } from "./readings.js";
import type { MaskRhomb } from "./readings.js";
import type { V3 } from "./solids.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};

const view = el<HTMLDivElement>("view");
const colorSel = el<HTMLSelectElement>("color");
const faceSel = el<HTMLSelectElement>("facemode");
const edgeSel = el<HTMLSelectElement>("edgemode");
const ribbonInput = el<HTMLInputElement>("ribbon");
const ribbonOut = el<HTMLElement>("ribbonOut");
const ribbonLabel = el<HTMLLabelElement>("ribbonlabel");
const capChk = el<HTMLInputElement>("cap");
const groundChk = el<HTMLInputElement>("clearground");
const groundLabel = el<HTMLLabelElement>("groundlabel");
const spinChk = el<HTMLInputElement>("spin");
const eyeChk = el<HTMLInputElement>("eyelight");
const orthoChk = el<HTMLInputElement>("ortho");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-exceptional";
const PREF_DEFAULTS = {
    color: "five",
    facemode: "solid",
    // Ball and stick by default, which is not the Cage's default: this surface is a
    // single sheet of rhombi rather than twenty solids, and the rods are what give it
    // depth before any of the colouring does.
    edgemode: "ballstick",
    ribbon: 0.5,
    // Off: the cap hides the inner rhombi, and those are the paths.
    cap: false,
    clearground: false,
    spin: true,
    eyelight: false,
    ortho: false,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

const gv = createGoldenView(view);

// The roof lifts on **five** of the six icosahedral axes — the sixth, the vertical, is
// the one a pentagrid can never supply, since a zone is a family of parallel lines and
// that one would need plane normal 0. So the colouring runs on five axes, the same five
// the Cage calls the golden icosahedron, and `pairColorOn` is already minimal there:
// χ′(K₅) = 5, so the Kowalewski five is exactly five here too.
const AXES = [0, 1, 2, 3, 4] as const;

/** Queen generation 3 — `Deca`, the composite, which is the cartwheel. */
const PATCH = "Deca";
const GEN = 3;

/**
 * Light purple for F₂₀, in the reference drawing's own colours. The decagon is covered
 * by the solid rather than showing the ten rhombs that resolve it, which is what the
 * drawing does and what the singularity *is*: the resolution is one of ten readings and
 * the solid is the thing all ten are readings of.
 */
const DECA_PURPLE = 0x9b93c9;
const DECA_RIM = 0x55507a;
/** The skewbs, in the reference drawing's pink. */
const SKEWB_PINK = 0xdaa8d4;

/** what is drawn: the roof, less the decagon's ten, plus F₂₀ standing on it */
let faces: GoldenFace[] = [];
/** index in `faces` where F₂₀'s own twenty begin */
let capFrom = Infinity;
/** the ten rhombi of the reading F₂₀ stands on, which `cap` hides */
let decaFaces = new Set<number>();

/**
 * A singularity the reader can collapse.
 *
 * `state` is **null** while it is superposed — drawn as the solid, all its readings at
 * once — and otherwise the reading it has collapsed to. Clicking advances it and wraps
 * back to null, which is the ambiguity returning.
 */
interface Figure {
    kind: "deca" | "skewb";
    gens: number[];
    /** position of the corner where all its own generators are off */
    anchor: V3;
    /** global index of that corner, which is what decides its readings */
    lo: number;
    readings: MaskRhomb[][];
    /** the roof faces it occupies, as indices into `faces` */
    roof: number[];
    state: number | null;
    /** how many of its readings the rest of the tiling still allows */
    open: number;
}
let figures: Figure[] = [];
/** face index → the figure that owns it, for picking */
let ownerOf = new Map<number, number>();
let gens5: V3[] = [];
/** the roof's own rhombi, by position, so a figure's solid can drop the three it shares */
let roofMids = new Set<string>();
/** what each drawn face belongs to, parallel to the list handed to the view */
let role: Array<number | null> = [];
let decaCount = 0;
/** face index → which skewb it belongs to, numbered from 1 */
let skewbOf = new Map<number, number>();
/** index in `faces` where the skewbs' own hidden faces begin */
let skewbFrom = Infinity;
/** which skewb each of those belongs to */
let skewbBack: number[] = [];
let skewbAcute = 0;
let skewbOblate = 0;
let radius = 1;
let built = "";

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** a face by where its middle is, for telling two copies of one rhombus apart */
const midKey = (f: GoldenFace): string =>
    [0, 1, 2].map((d) => Math.round(
        ((f.corners[0][d] + f.corners[1][d] + f.corners[2][d] + f.corners[3][d]) / 4) * 1e4,
    )).join(",");
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs3 = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];

/**
 * **F₂₀ itself, standing on the decagon.**
 *
 * §5.0's own instruction — *draw the solid, not the outline*. The five lifted
 * generators `Eⱼ = vⱼ + ½ẑ` embed the penteract in the roof's three-space as a
 * zonohedron, with no projection about it, so the solid is the zonotope
 * `{ Σ Kⱼ Eⱼ : K ∈ {0,1}⁵ }` anchored at mask 0. Each `Eⱼ` is read straight off a roof
 * edge, which is why the faces come out the same golden rhombus as everything round
 * them and need no new painter.
 *
 * Two things fall out and are worth knowing. **ΣE is purely vertical** — the planar
 * parts cancel because Σvⱼ = 0 — so mask 0 and mask 31 sit one above the other, √5
 * apart: the two poles, and the ghost of §5.0, the vertex the plane could never realise
 * because it was looking at the shadow. And the volume comes out **6.155367**, which is
 * the Cage's golden icosahedron exactly. The two derivations meet.
 *
 * The anchor is taken from the lift and not from the outline: §5.0 learned the hard way
 * that at k = 5 mask 0 is not a corner of the decagon at all but its center, and
 * anchoring on the outline corner of least index puts the solid half a decagon out.
 */
function zonohedron(E: V3[], gens: number[], anchor: V3): GoldenFace[] {
    const out: GoldenFace[] = [];
    for (let a = 0; a < gens.length; a++) {
        for (let b = a + 1; b < gens.length; b++) {
            const i = gens[a], j = gens[b];
            const nv = crs3(E[i], E[j]);
            for (const flip of [1, -1]) {
                // fix every other generator at whichever end of its zone is extreme in
                // this direction, and let the two of the pair run
                let base: V3 = [...anchor] as V3;
                for (const m of gens) {
                    if (m === i || m === j) continue;
                    if (dot3(nv, E[m]) * flip > 0) base = add3(base, E[m]);
                }
                out.push({
                    corners: [base, add3(base, E[i]), add3(base, add3(E[i], E[j])), add3(base, E[j])],
                    dirs: [i, j],
                });
            }
        }
    }
    return out;
}

/**
 * The **singularity** of a zonohedron: its two extreme vertices along `u` taken away,
 * with every face carrying one.
 *
 * On F₂₀ those are the poles, mask 0 and mask 31, which share a shadow — the one point
 * with index both 0 and 5, because Σvⱼ = 0. Five faces meet at each, so ten of the
 * twenty go and the ten that remain are a band round the equator. This is the Cage's
 * `Show: Singularity` reached from the other side, and it is what the figure actually
 * is: not the whole solid, but the solid with its extremes missing.
 *
 * No pruning follows, unlike the Cage's. There the cut runs over sixty **cell** faces
 * and leaves four hanging; here the twenty are the shell itself, and every one of the
 * survivors touches a vertex that lost a neighbour, so pruning would take the lot.
 */
function cutPoles(faces: GoldenFace[], poles: V3[]): GoldenFace[] {
    const at = (q: V3) => poles.some((p) =>
        Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6 && Math.abs(q[2] - p[2]) < 1e-6);
    return faces.filter((f) => !f.corners.some(at));
}

/**
 * Find the patch's **central** decagon, exactly.
 *
 * A singularity on k generators has its 2^k regions at the corners of a k-cube, so in
 * the lift its vertices are those whose integer vector, less a componentwise base,
 * lies in {0,1}^k — integer arithmetic, no coordinate matching, no tolerance.
 *
 * **The base is not a vertex.** This is §5.0's trap and it cost a day: at k = 5 mask 0
 * is not a corner of the decagon at all but its *centre*, sharing its shadow with mask
 * 31 — the ghost. So a search that only tries bases which are themselves vertices
 * cannot find a singular decagon; it finds only the non-singular ones, where mask 0
 * happens to be realised. Trying `n(v) − mask` over every mask is what finds them: the
 * patch then shows **68** decagons, of which **55** have the ghost.
 *
 * Which is wanted is settled by Jake: *"It is in the center of the patch. That is why
 * the patch is called deca."* And the patch has exact vertical mirror symmetry — all
 * 666 vertices map onto a vertex under x ↦ −x — so the central one sits on that line.
 * It is at (0, −0.52), **0.13** from the patch centre, where the next nearest decagon
 * is at 23.32. Nothing ambiguous about the choice once the search is right.
 */
function findDecagon(d: ReturnType<typeof buildRoof>): { faces: Set<number>; anchor: V3 | null } {
    const empty = { faces: new Set<number>(), anchor: null };
    if (!d) return empty;
    const lift = computeLift();
    // the patch's own centre, from the bounding box of the lifted surface
    let xl = Infinity, xh = -Infinity, yl = Infinity, yh = -Infinity;
    for (const f of d.faces) for (const v of f.vids) {
        const q = d.point(v);
        if (q[0] < xl) xl = q[0];
        if (q[0] > xh) xh = q[0];
        if (q[1] < yl) yl = q[1];
        if (q[1] > yh) yh = q[1];
    }
    const cx = (xl + xh) / 2, cy = (yl + yh) / 2;
    // only the vertices near that centre can belong to the central decagon, which keeps
    // the mask sweep to a few hundred bases instead of twenty thousand
    const near = [...vertexList]
        .filter((v) => lift.n[v.id])
        .sort((a, b) => {
            const pa = d.point(a.id), pb = d.point(b.id);
            return Math.hypot(pa[0] - cx, pa[1] - cy) - Math.hypot(pb[0] - cx, pb[1] - cy);
        })
        .slice(0, 40);
    const tried = new Set<string>();
    let best: { faces: Set<number>; anchor: V3; d: number } | null = null;
    for (const v of near) {
        const n = lift.n[v.id]!;
        for (let m = 0; m < 32; m++) {
            const b = n.map((x, k) => x - ((m >> k) & 1));
            const bk = b.join(",");
            if (tried.has(bk)) continue;
            tried.add(bk);
            const ids = new Set<number>();
            for (const w of vertexList) {
                const n1 = lift.n[w.id];
                if (!n1) continue;
                if (n1.every((x, k) => x - b[k] === 0 || x - b[k] === 1)) ids.add(w.id);
            }
            if (ids.size < 10) continue;
            const fs = new Set<number>();
            d.faces.forEach((f, i2) => {
                if (f.vids.every((x) => ids.has(x))) fs.add(i2);
            });
            if (fs.size !== 10) continue;
            const pairs = new Set<string>();
            for (const i2 of fs) pairs.add(d.faces[i2].pair.join(""));
            if (pairs.size !== 10) continue;
            // its centre, and how far that is from the patch's
            let sx = 0, sy = 0, n4 = 0;
            for (const i2 of fs) for (const w of d.faces[i2].vids) {
                const q = d.point(w);
                sx += q[0]; sy += q[1]; n4++;
            }
            const dist = Math.hypot(sx / n4 - cx, sy / n4 - cy);
            if (best && dist >= best.d) continue;
            // Mask 0 is the lower pole and need not be a vertex, so it is reached from
            // one that is: take any corner and walk back down its own mask.
            const some = [...ids][0];
            const mask = lift.n[some]!.map((x, k) => x - b[k]);
            const E = liftedGenerators(d);
            let anchor = d.point(some);
            for (let k = 0; k < 5; k++) if (mask[k]) anchor = sub3(anchor, E[k]);
            best = { faces: fs, anchor, d: dist };
        }
    }
    return best ? { faces: best.faces, anchor: best.anchor } : empty;
}

/** The five lifted generators, read straight off the roof: an edge along j is Eⱼ. */
function liftedGenerators(d: NonNullable<ReturnType<typeof buildRoof>>): V3[] {
    const E: V3[] = new Array(5);
    for (const f of d.faces) {
        const c = f.vids.map((v) => d.point(v)) as V3[];
        if (!E[f.dirs[0]]) E[f.dirs[0]] = sub3(c[1], c[0]);
        if (!E[f.dirs[1]]) E[f.dirs[1]] = sub3(c[3], c[0]);
    }
    return E;
}

    /** A reading, as rhombi to draw: mask `S` places the corner, `a` and `b` span it. */
function readingFaces(E: V3[], anchor: V3, T: MaskRhomb[]): GoldenFace[] {
    return T.map((r) => {
        let base: V3 = [...anchor] as V3;
        for (let k = 0; k < 5; k++) if ((r.S >> k) & 1) base = add3(base, E[k]);
        return {
            corners: [base, add3(base, E[r.a]), add3(base, add3(E[r.a], E[r.b])), add3(base, E[r.b])],
            dirs: [r.a, r.b] as [number, number],
        };
    });
}

interface Skewb {
    gens: number[];
    anchor: V3;
    /** the roof faces it shows: three of its six */
    roof: number[];
    acute: boolean;
}

function findSkewbs(d: ReturnType<typeof buildRoof>, deca: Set<number>): Skewb[] {
    skewbOf = new Map();
    skewbAcute = 0;
    skewbOblate = 0;
    const found: Skewb[] = [];
    if (!d) return found;
    const lift = computeLift();
    const E = liftedGenerators(d);
    const F = d.faces;
    const ekey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const eF = new Map<string, number[]>();
    const vF = new Map<number, number[]>();
    F.forEach((f, i) => {
        for (let k = 0; k < 4; k++) {
            const key = ekey(f.vids[k], f.vids[(k + 1) % 4]);
            let l = eF.get(key);
            if (!l) eF.set(key, (l = []));
            l.push(i);
        }
        for (const v of f.vids) {
            let l = vF.get(v);
            if (!l) vF.set(v, (l = []));
            l.push(i);
        }
    });
    const ACUTE = new Set(["013", "023", "024", "124", "134"]);
    let group = 0;
    for (let gen = 0; gen < 5; gen++) {
        // the ribbon of `gen`, flooded out from the pieces of it inside the decagon
        const chain = new Set<number>([...deca].filter((i) => F[i].dirs.includes(gen)));
        let front = [...chain];
        while (front.length) {
            const next: number[] = [];
            for (const i of front) {
                const f = F[i];
                for (let k = 0; k < 4; k++) {
                    if (f.dirs[k % 2] !== gen) continue;
                    const nb = (eF.get(ekey(f.vids[k], f.vids[(k + 1) % 4])) ?? []).find((x) => x !== i);
                    if (nb !== undefined && !chain.has(nb)) {
                        chain.add(nb);
                        next.push(nb);
                    }
                }
            }
            front = next;
        }
        // where two of its members meet, a three-valent end closes a hexagon
        for (const i of chain) {
            const f = F[i];
            for (let k = 0; k < 4; k++) {
                if (f.dirs[k % 2] !== gen) continue;
                const key = ekey(f.vids[k], f.vids[(k + 1) % 4]);
                const nb = (eF.get(key) ?? []).find((x) => x !== i);
                if (nb === undefined || !chain.has(nb)) continue;
                for (const v of [f.vids[k], f.vids[(k + 1) % 4]]) {
                    const fs = vF.get(v) ?? [];
                    if (fs.length !== 3) continue;
                    // F₂₀ covers the decagon's ten, so a hexagon reaching into it has
                    // nothing left to draw and would fight the solid for the same rhomb
                    if (fs.some((x) => skewbOf.has(x) || deca.has(x))) continue;
                    const tri = [...new Set(fs.flatMap((x) => F[x].dirs))].sort((a, b) => a - b);
                    if (tri.length !== 3) continue;
                    // The whole rhombohedron, not only the three rhombi on show: its
                    // eight corners are the hexagon's seven plus the one the Necker
                    // reading did not take. Anchor at the componentwise least of the
                    // three generators' coordinates — the same rule F₂₀ needs, and for
                    // the same reason.
                    const vs = [...new Set(fs.flatMap((x) => F[x].vids))];
                    const ns = vs.map((w) => lift.n[w]).filter(Boolean) as number[][];
                    if (ns.length !== vs.length) continue;
                    const base = ns[0].slice();
                    for (const k of tri) base[k] = Math.min(...ns.map((n) => n[k]));
                    let anchor = d.point(vs[0]);
                    const n0 = lift.n[vs[0]]!;
                    for (const k of tri) {
                        for (let t = 0; t < n0[k] - base[k]; t++) anchor = sub3(anchor, E[k]);
                    }
                    group++;
                    const acute = ACUTE.has(tri.join(""));
                    if (acute) skewbAcute++; else skewbOblate++;
                    for (const x of fs) skewbOf.set(x, group * 8 + gen);
                    found.push({ gens: tri, anchor, roof: fs, acute });
                }
            }
        }
    }
    return found;
}

function makeFaces(): void {
    const seedIdx = seedTypes.findIndex((s) => s.label === PATCH);
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedIdx, true, GEN);
    console.log = quiet;

    // Relief at 1, the true depth: the roof is 3/√5 ≈ 1.342 side lengths deep, which is
    // shallow on paper but reads on screen, and flattening it is a question this page
    // does not ask.
    const d = buildRoof(1, false);
    faces = [];
    if (!d) return;

    const found = findDecagon(d);
    decaCount = found.faces.size;
    const skewbs = findSkewbs(d, found.faces);

    const E = liftedGenerators(d);

    // **The roof keeps its ten.** F₂₀ is a superposition of the alternative paths, and
    // the ten rhombi are the one path this patch took — so they belong inside the solid
    // rather than under it. Set the faces transparent and you see the reading through
    // the superposition, which is the whole picture.
    //
    // And the reading is not merely half of the solid's surface. Of the penteract's 32
    // masks only **22** are corners of F₂₀; **ten fall strictly inside** it, five of
    // index 2 and five of index 3 — §5.0's "a region can be interior to its own
    // singularity". So a reading dips through the interior, and only 3 of these ten
    // rhombi are boundary faces of the solid at all. The other seven are genuinely
    // within it, which is why hiding them lost something.
    const out: GoldenFace[] = [];
    const remap = new Map<number, number>();
    decaFaces = new Set();
    d.faces.forEach((f, i) => {
        remap.set(i, out.length);
        if (found.faces.has(i)) decaFaces.add(out.length);
        out.push({ corners: f.vids.map((v) => d.point(v)) as [V3, V3, V3, V3], dirs: f.dirs });
    });
    // dropping the decagon's ten renumbers everything after them, so the skewb map has
    // to follow — an off-by-ten here would pink the wrong hexagons and look plausible
    const moved = new Map<number, number>();
    for (const [i, gnum] of skewbOf) {
        const j = remap.get(i);
        if (j !== undefined) moved.set(j, gnum);
    }
    skewbOf = moved;
    capFrom = out.length;
    if (found.anchor && E.every(Boolean)) {
        const whole = zonohedron(E, [0, 1, 2, 3, 4], found.anchor);
        // the two poles: mask 0 at the anchor, mask 31 at anchor + ΣE
        const top = E.reduce((p, e) => add3(p, e), found.anchor);
        out.push(...cutPoles(whole, [found.anchor, top]));
    }

    // Each skewb's **hidden** three. The other three are the roof's own rhombi, already
    // drawn, so only what the surface does not show is added — the back of the solid,
    // which is what makes it a solid rather than a cap.
    skewbFrom = out.length;
    const roofMid = new Set<string>();
    for (const f of out.slice(0, capFrom)) roofMid.add(midKey(f));
    skewbBack = [];
    for (const sk of skewbs) {
        const grp = (skewbOf.get(sk.roof[0]) ?? 0) >> 3;
        for (const f of zonohedron(E, sk.gens, sk.anchor)) {
            if (roofMid.has(midKey(f))) continue;
            skewbBack.push(grp);
            out.push(f);
        }
    }
    faces = out;

    // ── the figures, and the readings each can collapse to ──
    gens5 = E;
    const angleOf = (g: number) => Math.atan2(E[g][1], E[g][0]);
    const pointOf = (K: number): [number, number] => {
        const p: [number, number] = [0, 0];
        for (let k = 0; k < 5; k++) if ((K >> k) & 1) { p[0] += E[k][0]; p[1] += E[k][1]; }
        return p;
    };
    const lift2 = computeLift();
    const idxAt = (vid: number) => (lift2.n[vid] ?? []).reduce((x, y) => x + y, 0) + 1;
    figures = [];
    ownerOf = new Map();
    if (found.anchor) {
        // F₂₀: its least corner is the lower pole, index 0, so its own five bits carry
        // the whole of the index and the readings come out ten
        figures.push({
            kind: "deca", gens: [0, 1, 2, 3, 4], anchor: found.anchor, lo: 0,
            readings: readingsOf([0, 1, 2, 3, 4], angleOf, pointOf, 0),
            roof: [...decaFaces], state: null, open: 0,
        });
    }
    for (const sk of skewbs) {
        const lo = Math.min(...sk.roof.flatMap((i) => d.faces[i].vids.map(idxAt)));
        figures.push({
            kind: "skewb", gens: sk.gens, anchor: sk.anchor, lo,
            readings: readingsOf(sk.gens, angleOf, pointOf, lo),
            roof: sk.roof.map((i) => remap.get(i)!).filter((x) => x !== undefined),
            state: null, open: 0,
        });
    }
    figures.forEach((fg, n) => { for (const i of fg.roof) ownerOf.set(i, n); });
    roofMids = new Set(out.slice(0, capFrom).map(midKey));

    // Frame on the patch's own extent, which `point` has already centred.
    let r = 0;
    for (const f of out) for (const p of f.corners) r = Math.max(r, Math.hypot(p[0], p[1], p[2]));
    radius = r;
}

/**
 * Shading by height, so the relief reads before any colour does.
 *
 * Taken off the face's own mean height against the patch's full range rather than its
 * own, since a rhombus rising through the middle of the roof must not draw like one
 * rising at the top. The same absolute-range rule `roofgeom` uses for the flat pages.
 */
const DECA_CAP = new THREE.Color(DECA_PURPLE);
const SKEWB_CAP = new THREE.Color(SKEWB_PINK);
let zLo = 0, zHi = 1;
function shadeOf(f: GoldenFace): number {
    const z = (f.corners[0][2] + f.corners[1][2] + f.corners[2][2] + f.corners[3][2]) / 4;
    return zHi > zLo ? 0.85 * (1 - (z - zLo) / (zHi - zLo)) : 0;
}

/**
 * **Is this reading still open to the figure, given everything round it?**
 *
 * A collapse does not move the figure's rim, so nothing propagates through the
 * boundary — what it changes is the **vertex star** at each corner the figure touches,
 * and Penrose legality is a condition on stars. So: lay the reading in, gather every
 * rhombus meeting any of its corners from the rest of the tiling as it now stands, and
 * ask whether every star that closes is one of the seven.
 *
 * No γ anywhere, which is the whole point — the cascade is local arithmetic.
 */
function readingFits(fg: Figure, T: MaskRhomb[], live: GoldenFace[]): boolean {
    const want = readingFaces(gens5, fg.anchor, T);
    const key = (p: V3) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
    const mine = new Set<string>();
    for (const f of want) for (const p of f.corners) mine.add(key(p));
    const at = new Map<string, number[]>();
    const add = (f: GoldenFace) => {
        for (let i = 0; i < 4; i++) {
            const o = f.corners[i];
            const k = key(o);
            if (!mine.has(k)) continue;
            const u = f.corners[(i + 3) % 4], v = f.corners[(i + 1) % 4];
            const a = [u[0] - o[0], u[1] - o[1]];
            const b = [v[0] - o[0], v[1] - o[1]];
            const cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]));
            const deg = Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
            let l = at.get(k);
            if (!l) at.set(k, (l = []));
            l.push(deg);
        }
    };
    for (const f of live) add(f);
    for (const f of want) add(f);
    for (const angles of at.values()) {
        const sum = angles.reduce((x, y) => x + y, 0);
        if (Math.abs(sum - 360) <= 2 && !LEGAL_STARS.has(starSig(angles))) return false;
    }
    return true;
}

/**
 * The surface as it now stands: every roof rhombus except those belonging to a figure
 * that has collapsed, plus the rhombi of each collapsed reading.
 */
function liveSurface(): GoldenFace[] {
    const hidden = new Set<number>();
    for (const fg of figures) if (fg.state !== null) for (const i of fg.roof) hidden.add(i);
    const out: GoldenFace[] = [];
    for (let i = 0; i < capFrom; i++) if (!hidden.has(i)) out.push(faces[i]);
    for (const fg of figures) {
        if (fg.state === null) continue;
        out.push(...readingFaces(gens5, fg.anchor, fg.readings[fg.state]));
    }
    return out;
}

/**
 * Count, for every figure, how many of its readings the rest of the tiling still
 * allows, and collapse any that are down to one. Repeat while anything moves — that is
 * the cascade: a collapse narrows a neighbour, which narrows its neighbour.
 *
 * Bounded, and the bound is reported rather than hidden. A greedy propagation like this
 * can in principle chase its own tail, and saying so is better than looping.
 */
function settle(): { rounds: number; forced: number; stuck: number } {
    let rounds = 0, forced = 0;
    for (; rounds < 12; rounds++) {
        const live = liveSurface();
        let moved = 0;
        for (const fg of figures) {
            const open = fg.state !== null ? 1 : fg.readings.filter((T) => readingFits(fg, T, live)).length;
            fg.open = open;
            if (fg.state === null && open === 1) {
                fg.state = fg.readings.findIndex((T) => readingFits(fg, T, live));
                forced++;
                moved++;
            }
        }
        if (!moved) break;
    }
    const stuck = figures.filter((f) => f.open === 0).length;
    return { rounds, forced, stuck };
}

function build(reframe: boolean): void {
    if (built !== `${PATCH}|${GEN}`) {
        makeFaces();
        built = `${PATCH}|${GEN}`;
        zLo = Infinity; zHi = -Infinity;
        for (const f of faces) for (const p of f.corners) {
            if (p[2] < zLo) zLo = p[2];
            if (p[2] > zHi) zHi = p[2];
        }
    }

    // ── compose the surface from the figures' states ──
    const capped = capChk.checked;
    const hidden = new Set<number>();
    for (const fg of figures) if (fg.state !== null) for (const i of fg.roof) hidden.add(i);
    const drawList: GoldenFace[] = [];
    role = [];
    for (let i = 0; i < capFrom; i++) {
        if (hidden.has(i)) continue;
        if (capped && decaFaces.has(i)) continue;
        drawList.push(faces[i]);
        role.push(ownerOf.get(i) ?? null);
    }
    figures.forEach((fg, n) => {
        const add = (fs: GoldenFace[]) => { for (const f of fs) { drawList.push(f); role.push(n); } };
        if (fg.state !== null) {
            add(readingFaces(gens5, fg.anchor, fg.readings[fg.state]));
            return;
        }
        // superposed: the solid, all its readings at once
        const whole = zonohedron(gens5, fg.gens, fg.anchor);
        if (fg.kind === "deca") {
            const top = fg.gens.reduce((p, g) => add3(p, gens5[g]), fg.anchor);
            add(cutPoles(whole, [fg.anchor, top]));
        } else {
            add(whole.filter((f) => !roofMids.has(midKey(f))));
        }
    });

    const bands = colorSel.value === "bands";
    ribbonInput.disabled = !bands;
    ribbonLabel.style.opacity = bands ? "" : "0.45";
    groundChk.disabled = !bands;
    groundLabel.style.opacity = bands ? "" : "0.45";

    const ribbon = Number(ribbonInput.value);
    gv.draw(drawList, {
        scheme: colorSel.value as Scheme,
        faceMode: faceSel.value as FaceMode,
        edgeMode: edgeSel.value as EdgeMode,
        axes: AXES,
        ribbon,
        ground: !groundChk.checked,
        shadeOf,
        // F₂₀ and the skewbs are not patches laid over the tiling — they are made of
        // the same golden rhombi as everything round them, and they take the same
        // scheme, so a ribbon runs across them unbroken and the banding **matches the
        // surrounding**. What marks them is the rim, which takes the generator each of
        // its edges runs along and so matches too.
        capOf: (_f, i): Cap | null => {
            const n = role[i];
            if (n === null || n === undefined) return null;
            const fg = figures[n];
            const col = fg.kind === "deca" ? DECA_CAP : SKEWB_CAP;
            // `clear ground` means no ground anywhere, the figures included — their
            // own colour is a ground, so leaving it in place made the control look
            // broken on exactly the faces it was most wanted on.
            return {
                color: col,
                ground: groundChk.checked ? undefined : col,
                group: n + 1,
                // a superposed figure is a closed solid and has no boundary, so every
                // edge of it is wanted; a collapsed one is a patch of the surface and
                // only its outline is
                edges: fg.state === null ? "all" : "rim",
                rimByBand: true,
            };
        },
        rimColor: DECA_RIM,
    });
    if (reframe) gv.frame(radius);

    const relief = zHi - zLo;
    const note = bands
        ? ` · bands: five ribbon families, one per generator, carried by the edges · ` +
          `ten kinds of face · ribbon ${(100 * ribbon).toFixed(0)}%` +
          (groundChk.checked ? ", no ground — the roof shows through the gaps" : ", on the background as ground")
        : " · Kowalewski five on K₅: every rosette shows all five, and five is the least K₅ admits";
    statusEl.textContent =
        `Queen generation ${GEN} — ${faces.length} golden rhombi on ${vertexList.length} vertices, ` +
        `${decaCount} of them the reading F₂₀ superposes at the center` +
        `${capped ? ", capped away" : ", kept inside it"} · standing √5 tall on its ` +
        `${figures.filter((f) => f.state !== null).length} of ${figures.length} figures collapsed, ` +
        `${figures.filter((f) => f.state === null && f.open > 1).length} still superposed · ` +
        `${lastCascade || "click a figure to collapse it"} · ` +
        `own two poles · ${skewbAcute + skewbOblate} skewbs outlined on the five ribbons `+
        `out of it (${skewbAcute} A₆, ${skewbOblate} O₆) · both wear the same scheme as `+
        `the roof, so the banding runs across them unbroken and only the rims mark them · ` +
        `every one the same rhombus at a different tilt · relief ${relief.toFixed(3)} ` +
        `(3/√5 = ${(3 / Math.sqrt(5)).toFixed(3)} side lengths) · ` +
        `the five generators are five of the six icosahedral axes; the sixth is the ` +
        `vertical, which no pentagrid can supply${note}`;
}

// ── controls ──────────────────────────────────────────────────────

colorSel.value = prefs.color || PREF_DEFAULTS.color;
faceSel.value = prefs.facemode || PREF_DEFAULTS.facemode;
edgeSel.value = prefs.edgemode || PREF_DEFAULTS.edgemode;
for (const [sel, def] of [
    [colorSel, PREF_DEFAULTS.color], [faceSel, PREF_DEFAULTS.facemode],
    [edgeSel, PREF_DEFAULTS.edgemode],
] as Array<[HTMLSelectElement, string]>) if (!sel.value) sel.value = def;
ribbonInput.value = String(prefs.ribbon ?? PREF_DEFAULTS.ribbon);
capChk.checked = prefs.cap ?? PREF_DEFAULTS.cap;
groundChk.checked = prefs.clearground ?? PREF_DEFAULTS.clearground;
spinChk.checked = prefs.spin ?? PREF_DEFAULTS.spin;
eyeChk.checked = prefs.eyelight ?? PREF_DEFAULTS.eyelight;
orthoChk.checked = prefs.ortho ?? PREF_DEFAULTS.ortho;

gv.setSpin(spinChk.checked);
gv.setLighting(eyeChk.checked);

function rebuild(reframe: boolean): void {
    ribbonOut.textContent = `${(100 * Number(ribbonInput.value)).toFixed(0)}%`;
    build(reframe);
}

for (const c of [colorSel, faceSel, edgeSel, capChk, groundChk]) {
    c.addEventListener("change", () => rebuild(false));
}
ribbonInput.addEventListener("input", () => rebuild(false));
ribbonInput.addEventListener(
    "wheel",
    (e) => {
        if (ribbonInput.disabled) return;
        e.preventDefault();
        const step = (e.shiftKey ? 0.002 : 0.02) * (e.deltaY > 0 ? -1 : 1);
        ribbonInput.value = String(Math.min(1, Math.max(0, Number(ribbonInput.value) + step)));
        rebuild(false);
    },
    { passive: false },
);
spinChk.addEventListener("change", () => gv.setSpin(spinChk.checked));
eyeChk.addEventListener("change", () => gv.setLighting(eyeChk.checked));
orthoChk.addEventListener("change", () => gv.setProjection(orthoChk.checked));

function persist(): void {
    savePrefs(PREFS_KEY, {
        color: colorSel.value, facemode: faceSel.value, edgemode: edgeSel.value,
        ribbon: Number(ribbonInput.value), cap: capChk.checked,
        clearground: groundChk.checked,
        spin: spinChk.checked, eyelight: eyeChk.checked, ortho: orthoChk.checked,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);

el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the Exceptional view to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});

/**
 * Click a singularity to collapse it.
 *
 * Superposed → its first reading → the next → … → superposed again, which is the
 * ambiguity coming back. Each collapse is followed by a settle: every figure is asked
 * how many of its readings the rest of the tiling still allows, and any down to one is
 * collapsed too. That is the cascade, and it runs on vertex stars alone.
 */
let lastCascade = "";
view.addEventListener("click", (ev) => {
    if (dragged) { dragged = false; return; }
    const i = gv.pick(ev);
    if (i === null) return;
    const n = role[i];
    if (n === null || n === undefined) return;
    const fg = figures[n];
    // advance, wrapping back to superposed past the last reading
    fg.state = fg.state === null ? 0 : fg.state + 1 >= fg.readings.length ? null : fg.state + 1;
    // a collapse elsewhere may have been forced only by this one, so let everything go
    // back to superposed before settling again — otherwise the cascade is one-way
    if (fg.state === null) for (const o of figures) if (o !== fg) o.state = null;
    const s = settle();
    lastCascade = fg.state === null
        ? "released — every figure superposed again"
        : `collapsed ${fg.kind === "deca" ? "F₂₀" : "a skewb"} to reading ${fg.state + 1} of ` +
          `${fg.readings.length}; the cascade forced ${s.forced} more in ${s.rounds} round` +
          `${s.rounds === 1 ? "" : "s"}` + (s.stuck ? `, and left ${s.stuck} with no reading at all` : "");
    rebuild(false);
});
// a drag that ends over the canvas must not read as a click
let dragged = false;
view.addEventListener("pointerdown", () => { dragged = false; });
view.addEventListener("pointermove", (e) => { if (e.buttons) dragged = true; });

window.addEventListener("resize", () => gv.resize());

console.log(`exceptional build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}

gv.resize();
rebuild(true);
// The stored projection is applied after the first frame, since going orthographic
// sizes the frustum from where the perspective camera stands.
if (orthoChk.checked) gv.setProjection(true);
gv.start();
