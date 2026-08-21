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
import { seedTypes, generatePatch, allRhombs, vertexList } from "./geometry.js";
import { buildRoof, rescale } from "./roofgeom.js";
import type { RoofData } from "./roofgeom.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { createRoofView, CLUSTER_3D, CLUSTER_FALLBACK, PLAIN_COLOR } from "./roofview.js";
import { triacontahedra, pe5Rosettes, cupIndices, solidFace, RT_FACES, A6, RHO } from "./centers.js";
import type { Solid } from "./centers.js";
import { zonohedron, faceOutward, PHI } from "./solids.js";
import type { V3 } from "./solids.js";

// Detents. Only a handful of settings on either slider mean anything, so those are
// the ones the control lands on; the travel between them is free, which is how the
// normals are watched converging rather than merely found already converged.
const NLEN_STOPS = [0, Math.sqrt(1 + 2 / Math.sqrt(5))];
const SSCALE_STOPS = [0, 1 / PHI ** 3, 1 / PHI ** 2, 1 / PHI, 1];
const snapTo = (v: number, stops: number[], tol: number): number => {
    for (const s of stops) if (Math.abs(v - s) < tol) return s;
    return v;
};

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
const nlenInput = el<HTMLInputElement>("nlen");
const nlenOut = el<HTMLElement>("nlenOut");
const rtSel = el<HTMLSelectElement>("rtmode");
const rtExtentSel = el<HTMLSelectElement>("rtextent");
const rtEdgesChk = el<HTMLInputElement>("rtedges");
const markersChk = el<HTMLInputElement>("markers");
const demotedChk = el<HTMLInputElement>("rtdemoted");
const truncChk = el<HTMLInputElement>("rttrunc");
const sscaleInput = el<HTMLInputElement>("sscale");
const sscaleOut = el<HTMLElement>("sscaleOut");
const classBar = el<HTMLElement>("classbar");
const pickEl = el<HTMLElement>("pick");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-centers";
const PREF_DEFAULTS = {
    patch: "Pe3",
    gen: 3,
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
    nlen: Math.sqrt(1 + 2 / Math.sqrt(5)),
    rtmode: "transparent",
    rtextent: "full",
    rtedges: true,
    markers: true,
    rtdemoted: false,
    rttrunc: false,
    sscale: 1,
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

/** The rhomb the user last clicked, or null. Survives a rebuild, because changing a
 *  filter should not throw away what you were looking at. */
let selected: number | null = null;
/** What the last build drew, so the pick handler can map a raycast onto a face. */
let last: { faces: { id: number }[] } | null = null;

// ── palette ───────────────────────────────────────────────────────
//
// One hue per solid, cycled. The point is only that neighbors differ: a complete cap
// should read as one region and the next as another, and no hue means anything in
// itself. Complete solids take the color at strength; partial ones are washed toward
// gray, so the ten-face caps stand out of the field without a legend.

const WASH = new THREE.Color(0xd8d9de);

const HILITE = new THREE.Color(0xd6402f);
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
    const nlen = Number(nlenInput.value);
    const sscale = Number(sscaleInput.value);
    const wantHeadSolids = headSolidsChk.checked;
    const wantTailSolids = tailSolidsChk.checked;
    last = { faces: d.faces };

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
    const wantDemoted = demotedChk.checked;
    const wantTrunc = truncChk.checked;
    const eligible = (s: Solid): boolean =>
        s.homeCount > 0 &&
        (s.settled || wantTrunc) &&
        (properOf(s) >= 0 || wantDemoted);
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
    const sizeOf = (s: Solid) => Number(ctl(s)?.size.value ?? 1) * sscale;
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
    const rtMode = rtSel.value;
    const rtExtent = rtExtentSel.value;
    const rtCup = rtExtent === "cup";
    const surfaceShown = rhombSel.value !== "invisible";
    if (rtMode !== "invisible" && sscale > 0) {
        const tris: number[] = [];
        const cols: number[] = [];
        const lines: number[] = [];
        // Spheres go up as one instanced mesh rather than a merged buffer: at 671
        // complete solids on Sun gen 4 a merged ball of this tessellation would be
        // over a million vertices, and they are all the same ball.
        const balls = shown.filter((s) => showRTFor(s) && sizeOf(s) > 0);
        if (rtExtent === "sphere" && balls.length) {
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
                const r = RHO * sizeOf(s);
                const c = place(s.c);
                m.makeScale(r, r, r).setPosition(c[0], c[1], c[2]);
                mesh.setMatrixAt(i, m);
                mesh.setColorAt(i, solidColor(s));
            });
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            rv.add(mesh);
        }

        for (const s of rtExtent === "sphere" ? [] : shown) {
            if (!showRTFor(s)) continue;
            const t = sizeOf(s);
            if (t <= 0) continue;
            const col = solidColor(s);
            for (const i of rtCup ? cupIndices(s) : ALL_FACES) {
                const f = solidFace(s, i, flip, t, d.offset);
                for (const v of [f[0], f[1], f[2], f[0], f[2], f[3]]) {
                    tris.push(v[0], v[1], v[2]);
                    cols.push(col.r, col.g, col.b);
                }
                for (let k = 0; k < 4; k++) {
                    const a = f[k];
                    const b = f[(k + 1) % 4];
                    lines.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                }
            }
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
        const lg = new THREE.BufferGeometry();
        lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
        rv.add(
            new THREE.LineSegments(
                lg,
                new THREE.LineBasicMaterial({
                    color: 0x3a3f4a,
                    transparent: true,
                    opacity: 0.5,
                }),
            ),
        );
        }
        }
    }

    // A marker at every center that holds two faces or more. A center claimed by a
    // single face is not evidence of anything — every face has two of those by
    // construction — so showing them would bury the signal in its own scaffolding.
    if (markersChk.checked) {
        const pts: number[] = [];
        const cols: number[] = [];
        let drawnMarkers = 0;
        for (const s of shown) {
            drawnMarkers++;
            const p = place(s.c);
            const r = (0.05 + 0.022 * s.faces.length) * Math.max(0.35, sizeOf(s));
            const col = solidColor(s);
            for (let i = 0; i < BALL_POS.length; i += 3) {
                pts.push(
                    BALL_POS[i] * r + p[0],
                    BALL_POS[i + 1] * r + p[1],
                    BALL_POS[i + 2] * r + p[2],
                );
                cols.push(col.r, col.g, col.b);
            }
        }
        if (drawnMarkers) {
            const mg = new THREE.BufferGeometry();
            mg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
            mg.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
            mg.computeVertexNormals();
            rv.add(
                new THREE.Mesh(
                    mg,
                    new THREE.MeshStandardMaterial({
                        vertexColors: true,
                        roughness: 0.45,
                        metalness: 0.1,
                        flatShading: true,
                    }),
                ),
            );
        }
    }

    // The clicked face, and the two solids it names — drawn whatever the filters say,
    // since the point of asking about one face is to see the answer even when the
    // filters have hidden it.
    const sel = selected === null ? null : cen.byRhomb[selected];
    if (sel) {
        const hp: number[] = [];
        const corners = sel.vids.map((v) => d.point(v));
        for (let i = 0; i < 4; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            hp.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
        const p = place(sel.c);
        const u: V3 = [sel.u[0], sel.u[1], sel.u[2] * zsign];
        for (const dir of [1, -1]) {
            hp.push(
                p[0], p[1], p[2],
                p[0] + u[0] * RHO * dir,
                p[1] + u[1] * RHO * dir,
                p[2] + u[2] * RHO * dir,
            );
        }
        for (const sid of sel.solids) {
            // Through solidFace like everything else. Drawn from the raw mesh table
            // this had its own copy of the parity bug — a highlight a tenth of a turn
            // off the solid it is highlighting.
            const t = Math.max(sscale, 0.14);
            for (let i = 0; i < RT_FACES.length; i++) {
                const face = solidFace(cen.solids[sid], i, flip, t, d.offset);
                for (let k = 0; k < 4; k++) {
                    const a = face[k];
                    const b = face[(k + 1) % 4];
                    hp.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                }
            }
        }
        const hg = new THREE.BufferGeometry();
        hg.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
        const hl = new THREE.LineSegments(
            hg,
            new THREE.LineBasicMaterial({ color: HILITE, depthTest: false }),
        );
        hl.renderOrder = 3;
        rv.add(hl);

        const say = (sid: number) => {
            const s = cen.solids[sid];
            return (
                `#${s.id} holding ${s.faces.length} face${s.faces.length === 1 ? "" : "s"}` +
                `${s.complete ? ", complete" : ""}, ${s.hat ? "below the roof" : "above it"}`
            );
        };
        // `cluster` is a property of the tiling rather than of the solid, so it comes
        // from the roof's own face list rather than from centers.ts.
        const cluster = d.faces.find((f) => f.id === sel.id)?.cluster ?? "?";
        pickEl.textContent =
            `Rhomb ${sel.id}, ${sel.thick ? "thick" : "thin"}, from a ${cluster} tile · ` +
            `lies on ${say(sel.solids[0])} · and on ${say(sel.solids[1])} · ` +
            `two faces pin a solid uniquely, so a neighbor shares one exactly when the fold is 36°.`;
    } else {
        pickEl.textContent = "Click a face to see which triacontahedra it lies on.";
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
        `normals ${(nlen / RHO).toFixed(2)}ρ · ${ms} ms`;
}

// ── controls ──────────────────────────────────────────────────────

for (const [code, nick] of [
    ["Pe5", "Pe5 pentagon"],
    ["Pe3", "Pe3 pentagon"],
    ["Pe1", "Pe1 pentagon"],
    ["St5", "St5 star"],
    ["St3", "St3 boat"],
    ["St1", "St1 diamond"],
    ["Deca", "Queen (composite)"],
    ["Sun", "Sun (composite)"],
    ["Star", "Star (composite)"],
] as Array<[string, string]>) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = nick;
    patchSel.appendChild(o);
}
patchSel.value = prefs.patch;
for (const g of [1, 2, 3, 4]) {
    const o = document.createElement("option");
    o.value = String(g);
    o.textContent = `Generation ${g}`;
    genSel.appendChild(o);
}
genSel.value = String(prefs.gen);
if (!patchSel.value) patchSel.value = PREF_DEFAULTS.patch;
if (!genSel.value) genSel.value = String(PREF_DEFAULTS.gen);
colorSel.value = prefs.color;
if (!colorSel.value) colorSel.value = PREF_DEFAULTS.color;
normalsChk.checked = prefs.normals;
nlenInput.value = String(prefs.nlen);
sscaleInput.value = String(prefs.sscale);
flip = prefs.parity === "tails";
headsRadio.checked = !flip;
tailsRadio.checked = flip;
flatChk.checked = prefs.flat;
vmag = flatChk.checked ? 0 : 1;
headSolidsChk.checked = prefs.headsolids;
tailSolidsChk.checked = prefs.tailsolids;
rhombSel.value = prefs.rhombmode || PREF_DEFAULTS.rhombmode;
edgesChk.checked = prefs.edges;
shadeChk.checked = prefs.shade;
isoChk.checked = prefs.isogloss;
normalsChk.checked = prefs.normals;
nlenInput.value = String(prefs.nlen);
rtSel.value = prefs.rtmode || PREF_DEFAULTS.rtmode;
rtExtentSel.value = prefs.rtextent || PREF_DEFAULTS.rtextent;
rtEdgesChk.checked = prefs.rtedges;
markersChk.checked = prefs.markers;
demotedChk.checked = prefs.rtdemoted;
truncChk.checked = prefs.rttrunc;
sscaleInput.value = String(prefs.sscale);

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

    wrap.append(row1, row2, size);
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
    const nl = Number(nlenInput.value);
    nlenOut.textContent = `${(nl / RHO).toFixed(2)}ρ`;
    sscaleOut.textContent = `${Number(sscaleInput.value).toFixed(2)}×`;
    rv.clear();
    build(reframe);
}
for (const c of [patchSel, genSel]) c.addEventListener("change", () => rebuild(true));
for (const c of [colorSel, headSolidsChk, tailSolidsChk, rhombSel, edgesChk, shadeChk,
                 isoChk, normalsChk, rtSel, rtExtentSel, rtEdgesChk, markersChk, demotedChk, truncChk]) {
    c.addEventListener("change", () => rebuild(false));
}

// Switching parity runs the roof down to flat, turns it over while nothing is on
// screen, and runs it back out. Already flat, there is nothing to animate — the parity
// simply becomes the one it will rise into.
for (const r of [headsRadio, tailsRadio]) {
    r.addEventListener("change", () => {
        const want = tailsRadio.checked;
        if (want === flip) return;
        if (vmag < 1e-6) {
            flip = want;
            rebuild(false);
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
for (const c of [nlenInput, sscaleInput]) {
    c.addEventListener("input", () => rebuild(false));
}
// Only the landing snaps, as on the 3D page's vertical slider. Dragging is free —
// watching the segments converge is the whole point of the control — but letting go
// near ρ lands on ρ exactly, so the picture that makes the argument is not something
// you have to hit by hand.
nlenInput.addEventListener("change", () => {
    nlenInput.value = String(snapTo(Number(nlenInput.value), NLEN_STOPS, 0.1));
    rebuild(false);
});
sscaleInput.addEventListener("change", () => {
    sscaleInput.value = String(snapTo(Number(sscaleInput.value), SSCALE_STOPS, 0.035));
    rebuild(false);
});

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
        nlen: Number(nlenInput.value),
        rtmode: rtSel.value,
        rtextent: rtExtentSel.value,
        rtedges: rtEdgesChk.checked,
        markers: markersChk.checked,
        rtdemoted: demotedChk.checked,
        rttrunc: truncChk.checked,
        sscale: Number(sscaleInput.value),
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

// Picking. The surface is non-indexed with two triangles per rhombus, so a hit's
// faceIndex >> 1 is the face's position in the build's own list — no separate index
// to keep in step. A drag is an orbit and must not also be a click, so the pointer
// has to come back up within a few pixels of where it went down.
{
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;

    rv.renderer.domElement.addEventListener("pointerdown", (e) => {
        downAt = { x: e.clientX, y: e.clientY };
    });
    rv.renderer.domElement.addEventListener("pointerup", (e) => {
        if (!downAt) return;
        const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
        downAt = null;
        if (moved > 4) return;

        const mesh = rv.surface();
        if (!mesh || !last) return;
        const r = rv.renderer.domElement.getBoundingClientRect();
        ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, rv.camera);
        const hit = ray.intersectObject(mesh, false)[0];
        const next =
            hit && hit.faceIndex != null
                ? (last.faces[hit.faceIndex >> 1]?.id ?? null)
                : null;
        // clicking the same face again lets go of it
        selected = next !== null && next === selected ? null : next;
        rebuild(false);
    });
}

console.log(`centers build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}

rv.resize();
rebuild(true);
rv.start();
