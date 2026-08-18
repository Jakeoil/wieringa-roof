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
import { buildRoof } from "./roofgeom.js";
import { createRoofView, CLUSTER_3D, CLUSTER_FALLBACK, PLAIN_COLOR } from "./roofview.js";
import { triacontahedra, assignLargestFirst, pe5Rosettes, A6, RHO } from "./centers.js";
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

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};

const view = el<HTMLDivElement>("view");
const patchSel = el<HTMLSelectElement>("patch");
const genSel = el<HTMLSelectElement>("gen");
const colorSel = el<HTMLSelectElement>("color");
const flipChk = el<HTMLInputElement>("flip");
const edgesChk = el<HTMLInputElement>("edges");
const normalsChk = el<HTMLInputElement>("normals");
const solidsChk = el<HTMLInputElement>("solids");
const nlenInput = el<HTMLInputElement>("nlen");
const nlenOut = el<HTMLElement>("nlenOut");
const sscaleInput = el<HTMLInputElement>("sscale");
const sscaleOut = el<HTMLElement>("sscaleOut");
const minInput = el<HTMLInputElement>("minsize");
const minOut = el<HTMLElement>("minsizeOut");
const sideSel = el<HTMLSelectElement>("side");
const pickEl = el<HTMLElement>("pick");
const markersChk = el<HTMLInputElement>("markers");
const shadeChk = el<HTMLInputElement>("shade");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-centers";
const PREF_DEFAULTS = {
    patch: "Pe3",
    gen: 3,
    color: "solid",
    flip: false,
    edges: true,
    normals: false,
    nlen: Math.sqrt(1 + 2 / Math.sqrt(5)),
    sscale: 1,
    minsize: 10,
    side: "both",
    solids: true,
    markers: true,
    shade: true,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

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
const HUES = [
    0x4a7fb5, 0xc4643f, 0x54a598, 0xb1618f, 0xd9b463, 0x6a6fc0,
    0x8aa06a, 0x9f7b4f, 0x5f9e5a, 0xc07a7a, 0x7d8fa8, 0xa8894a,
].map((h) => new THREE.Color(h));

const HILITE = new THREE.Color(0xd6402f);
// Faces per solid is a classification, not a scale: the sizes that occur are
// 1, 2, 3, 4, 5 and 10 and nothing else, ever, over every patch measured. So each
// class gets its own color rather than a position on a ramp. Class 1 is deliberately
// an alarm color — a face whose every solid holds only itself is worth being able to
// find at a glance, and on any finite patch there are a handful of them.
const CLASS_COLORS: Record<number, THREE.Color> = {
    1: new THREE.Color(0xd6402f),
    2: new THREE.Color(0xe08a3c),
    3: new THREE.Color(0xd9b463),
    4: new THREE.Color(0x7ba05b),
    5: new THREE.Color(0x54a598),
    10: new THREE.Color(0x2f5f9e),
};
const CLASS_ORDER = [1, 2, 3, 4, 5, 10];

function solidColor(s: Solid): THREE.Color {
    const base = HUES[s.id % HUES.length];
    return s.complete ? base.clone() : base.clone().lerp(WASH, 0.7);
}

// ── the triacontahedron, drawn in the roof's own frame ────────────
//
// zonohedron(A6) rather than the polyhedra page's triacontahedron(), which stands the
// solid on a five-fold axis for display. Here the frame is already right: the roof's
// five generators plus the vertical *are* the six axes, so every solid on this page
// is a translate of this one, never a rotation.

const RT_FACES = zonohedron(A6).map(faceOutward);
const RT_TRIS: number[] = [];
for (const f of RT_FACES) {
    for (const q of [f[0], f[1], f[2], f[0], f[2], f[3]]) RT_TRIS.push(q[0], q[1], q[2]);
}
const RT_EDGES: number[] = (() => {
    const out: number[] = [];
    const seen = new Set<string>();
    const key = (a: V3, b: V3) => {
        const r = (p: V3) => p.map((x) => x.toFixed(5)).join(",");
        const ka = r(a);
        const kb = r(b);
        return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    };
    for (const f of RT_FACES) {
        for (let i = 0; i < 4; i++) {
            const a = f[i];
            const b = f[(i + 1) % 4];
            const k = key(a, b);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
    }
    return out;
})();

// a low-poly ball for the center markers
const BALL = new THREE.IcosahedronGeometry(1, 1);
const BALL_POS = BALL.getAttribute("position").array as ArrayLike<number>;

// ── build ─────────────────────────────────────────────────────────

function build(reframe: boolean): void {
    const seedIdx = seedTypes.findIndex((s) => s.label === patchSel.value);
    const gen = Number(genSel.value);
    const t0 = performance.now();

    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedIdx, true, gen);
    console.log = quiet;

    const flip = flipChk.checked;
    const d = buildRoof(1, flip);
    if (!d) {
        statusEl.textContent =
            `${patchSel.value} generation ${gen}: no rhombs at this generation. ` +
            `Star-type seeds emit none until one generation later — try ${gen + 1}.`;
        rv.renderer.render(rv.scene, rv.camera);
        return;
    }

    const cen = triacontahedra();
    const assign = assignLargestFirst(cen);
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

    rv.drawRoof(d, {
        colorOf: (f) => {
            const s = cen.solids[assign[f.id]];
            if (mode === "cluster") return CLUSTER_3D[f.cluster] ?? CLUSTER_FALLBACK;
            if (mode === "complete")
                return s.complete ? solidColor(s) : WASH.clone();
            if (mode === "class")
                return CLASS_COLORS[s.faces.length] ?? CLUSTER_FALLBACK;
            return solidColor(s);
        },
        shade: shadeChk.checked ? 1 : 0,
        useVertexColors: true,
        flatColor: PLAIN_COLOR,
        transparent: false,
        edges: edgesChk.checked,
        isoglosses: false,
    });

    const complete = cen.solids.filter((s) => s.complete);
    const nlen = Number(nlenInput.value);
    const sscale = Number(sscaleInput.value);
    const minSize = Number(minInput.value);
    const side = sideSel.value;
    last = { faces: d.faces };

    // One filter, applied to everything: markers, shells and normals all mean "the
    // solids currently under consideration", and having them disagree would make the
    // picture impossible to read. At ten only the complete solids survive, which is
    // where the page opens.
    const passes = (s: Solid): boolean =>
        s.faces.length >= minSize &&
        (side === "both" || (side === "hat") === s.hat);
    const shown = cen.solids.filter(passes);

    // The normals themselves. Each face sends a segment both ways — above the map and
    // below — colored by the solid at that end, so at exactly ρ every segment lands on
    // a marker of its own color and the pencils belonging to one solid arrive
    // together. Past ρ they carry on through, which is the point: normals meet at
    // other radii too, and none of those builds anything.
    if (normalsChk.checked && nlen > 0) {
        const seg: number[] = [];
        const col: number[] = [];
        for (const rf of cen.faces) {
            const p = place(rf.c);
            const u: V3 = [rf.u[0], rf.u[1], rf.u[2] * zsign];
            for (const [dir, sid] of [
                [1, rf.solids[0]],
                [-1, rf.solids[1]],
            ] as Array<[number, number]>) {
                if (!passes(cen.solids[sid])) continue;
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
        const ng = new THREE.BufferGeometry();
        ng.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
        ng.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
        rv.add(
            new THREE.LineSegments(
                ng,
                new THREE.LineBasicMaterial({
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.75,
                }),
            ),
        );
    }

    // The solids themselves. Only the complete ones: a partial group names a real
    // triacontahedron too, but drawing all of them fills the view with overlapping
    // shells — they interpenetrate freely, centers as close as one long diagonal,
    // where the complete ones are never nearer than φ³ and read as separate objects.
    if (solidsChk.checked && shown.length && sscale > 0) {
        const tris: number[] = [];
        const cols: number[] = [];
        const lines: number[] = [];
        for (const s of shown) {
            const p = place(s.c);
            const col = solidColor(s);
            for (let i = 0; i < RT_TRIS.length; i += 3) {
                tris.push(
                    RT_TRIS[i] * sscale + p[0],
                    RT_TRIS[i + 1] * sscale + p[1],
                    RT_TRIS[i + 2] * sscale + p[2],
                );
                cols.push(col.r, col.g, col.b);
            }
            for (let i = 0; i < RT_EDGES.length; i += 3) {
                lines.push(
                    RT_EDGES[i] * sscale + p[0],
                    RT_EDGES[i + 1] * sscale + p[1],
                    RT_EDGES[i + 2] * sscale + p[2],
                );
            }
        }
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
                    transparent: true,
                    opacity: 0.38,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                }),
            ),
        );
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
            const r = 0.05 + 0.022 * s.faces.length;
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
            const c = place(cen.solids[sid].c);
            const t = Math.max(sscale, 0.14);
            for (let i = 0; i < RT_EDGES.length; i += 3) {
                hp.push(RT_EDGES[i] * t + c[0], RT_EDGES[i + 1] * t + c[1], RT_EDGES[i + 2] * t + c[2]);
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
    for (const f of d.faces) {
        const n = cen.solids[assign[f.id]].faces.length;
        cls[n] = (cls[n] ?? 0) + 1;
    }
    const clsText = CLASS_ORDER.filter((k) => cls[k]).map((k) => `${k}:${cls[k]}`).join(" ");
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
        `showing ${shown.length} · face classes ${clsText}` +
        `${cls[1] ? ` — ${cls[1]} orphan${cls[1] === 1 ? "" : "s"}, all on the boundary` : ""} · ` +
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
flipChk.checked = prefs.flip;
normalsChk.checked = prefs.normals;
nlenInput.value = String(prefs.nlen);
sscaleInput.value = String(prefs.sscale);
minInput.value = String(prefs.minsize);
sideSel.value = prefs.side;
if (!sideSel.value) sideSel.value = PREF_DEFAULTS.side;
edgesChk.checked = prefs.edges;
solidsChk.checked = prefs.solids;
markersChk.checked = prefs.markers;
shadeChk.checked = prefs.shade;

function rebuild(reframe: boolean): void {
    const nl = Number(nlenInput.value);
    nlenOut.textContent = `${(nl / RHO).toFixed(2)}ρ`;
    sscaleOut.textContent = `${Number(sscaleInput.value).toFixed(2)}×`;
    minOut.textContent = `≥ ${minInput.value}`;
    rv.clear();
    build(reframe);
}
for (const c of [patchSel, genSel]) c.addEventListener("change", () => rebuild(true));
for (const c of [colorSel, sideSel, flipChk, edgesChk, normalsChk, solidsChk, markersChk, shadeChk]) {
    c.addEventListener("change", () => rebuild(false));
}
for (const c of [nlenInput, sscaleInput, minInput]) {
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
        flip: flipChk.checked,
        edges: edgesChk.checked,
        normals: normalsChk.checked,
        nlen: Number(nlenInput.value),
        sscale: Number(sscaleInput.value),
        minsize: Number(minInput.value),
        side: sideSel.value,
        solids: solidsChk.checked,
        markers: markersChk.checked,
        shade: shadeChk.checked,
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

window.addEventListener("resize", () => rv.resize());

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
