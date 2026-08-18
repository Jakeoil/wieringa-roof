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
    solids: true,
    markers: true,
    shade: true,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

const rv = createRoofView(view);

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

const SIZE_LO = new THREE.Color(0xe4e5ea);
const SIZE_HI = new THREE.Color(0x2f5f9e);

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
            if (mode === "size") {
                const t = (s.faces.length - 1) / 9;
                return SIZE_LO.clone().lerp(SIZE_HI, t);
            }
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
            for (const [side, sid] of [
                [1, rf.solids[0]],
                [-1, rf.solids[1]],
            ] as Array<[number, number]>) {
                const c = solidColor(cen.solids[sid]);
                seg.push(
                    p[0], p[1], p[2],
                    p[0] + u[0] * nlen * side,
                    p[1] + u[1] * nlen * side,
                    p[2] + u[2] * nlen * side,
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
    if (solidsChk.checked && complete.length && sscale > 0) {
        const tris: number[] = [];
        const cols: number[] = [];
        const lines: number[] = [];
        for (const s of complete) {
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
        let shown = 0;
        for (const s of cen.solids) {
            if (s.faces.length < 2) continue;
            shown++;
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
        if (shown) {
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
        `normals ${nlen.toFixed(3)} = ${(nlen / RHO).toFixed(2)}ρ · ${ms} ms`;
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
edgesChk.checked = prefs.edges;
solidsChk.checked = prefs.solids;
markersChk.checked = prefs.markers;
shadeChk.checked = prefs.shade;

function rebuild(reframe: boolean): void {
    const nl = Number(nlenInput.value);
    nlenOut.textContent = `${(nl / RHO).toFixed(2)}ρ`;
    sscaleOut.textContent = `${Number(sscaleInput.value).toFixed(2)}×`;
    rv.clear();
    build(reframe);
}
for (const c of [patchSel, genSel]) c.addEventListener("change", () => rebuild(true));
for (const c of [colorSel, flipChk, edgesChk, normalsChk, solidsChk, markersChk, shadeChk]) {
    c.addEventListener("change", () => rebuild(false));
}
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
        flip: flipChk.checked,
        edges: edgesChk.checked,
        normals: normalsChk.checked,
        nlen: Number(nlenInput.value),
        sscale: Number(sscaleInput.value),
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

console.log(`centers build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}

rv.resize();
rebuild(true);
rv.start();
