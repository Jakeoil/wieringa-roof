// 3D prototype — the Wieringa roof surface itself, lifted out of the plane.
//
// Almost free: geometry.ts already gives an exact integer vector n per vertex, so
// a corner's position is just pos3D(n). Every generator shares z = 1/√5, so the
// height is (Σ n_j)/√5 and the whole surface is 1.342 side lengths deep. Shallow
// on paper, but distinctive enough on screen that no exaggeration is wanted — the
// vertical scale control only ever flattens, down to the bare Penrose tiling.
//
// The surface, its edges and its contours are built by `roofgeom.ts` and drawn by
// `roofview.ts`, which the centers page shares. What is left here is this page: its
// color modes, its vertical-scale slider, and its readout.

import * as THREE from "three";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { seedTypes, generatePatch, allRhombs, vertexList } from "./geometry.js";
import { buildRoof } from "./roofgeom.js";
import {
    createRoofView,
    INDEX_COLORS,
    THICK_COLOR,
    THIN_COLOR,
    PLAIN_COLOR,
    MOSAIC_3D,
    CLASSIC_3D,
    CLUSTER_3D,
    CLUSTER_FALLBACK,
} from "./roofview.js";

// Naming the missing id turns a silent null-dereference three frames later into
// an immediate, readable failure.
const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};

const view = el<HTMLDivElement>("view");
const patchSel = el<HTMLSelectElement>("patch");
const genSel = el<HTMLSelectElement>("gen");
const colorSel = el<HTMLSelectElement>("color");
const vscaleInput = el<HTMLInputElement>("vscale");
const vscaleOut = el<HTMLElement>("vscaleOut");
const shadeChk = el<HTMLInputElement>("shade");

// Session settings. Same treatment as the workbench: these are preferences, not a
// document, and losing them on every reload turns a look at the model into a round
// of re-setting dials.
const PREFS_KEY = "wr-roof3d";
const PREF_DEFAULTS = {
    patch: "Pe3",
    gen: 3,
    color: "cluster",
    vscale: 1,
    edges: true,
    isogloss: false,
    transparent: false,
    shade: false,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);
const edgesChk = el<HTMLInputElement>("edges");
const isoChk = el<HTMLInputElement>("isogloss");
const transpChk = el<HTMLInputElement>("transparent");
const statusEl = el<HTMLElement>("status");

const rv = createRoofView(view);

// ── build ─────────────────────────────────────────────────────────

function build(reframe: boolean): void {
    const seedIdx = seedTypes.findIndex((s) => s.label === patchSel.value);
    const gen = Number(genSel.value);

    const t0 = performance.now();
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedIdx, true, gen);
    console.log = quiet;

    // The slider is one control doing two jobs: sign is the flip, magnitude is the
    // flattening. Biased so the middle of the travel is spread out, since near-flat
    // is where the shape is worth studying.
    const u = Number(vscaleInput.value);
    const flip = u < 0;
    const vscale = Math.sign(u) * Math.pow(Math.abs(u), 1.6);

    // An empty patch is a legitimate answer — the star family emits no rhombs until
    // a generation later — but it used to wreck the view permanently. With no
    // vertices the bounding sphere has radius 0, so the framing distance is 0 and
    // `camera.position.normalize()` on a zero vector yields NaN, which poisons the
    // camera for every frame afterwards. Say so and leave the camera alone.
    const d = buildRoof(vscale, flip);
    if (!d) {
        statusEl.textContent =
            `${patchSel.value} generation ${gen}: no rhombs at this generation. ` +
            `Star-type seeds emit none until one generation later — try ${gen + 1}.`;
        rv.renderer.render(rv.scene, rv.camera);
        return;
    }

    const mode = colorSel.value;
    const shade = shadeChk.checked ? Math.abs(vscale) : 0;

    rv.drawRoof(d, {
        colorOf: (f, vid) => {
            if (mode === "mosaic") return MOSAIC_3D[f.cluster] ?? CLUSTER_FALLBACK;
            if (mode === "classic") return CLASSIC_3D[f.cluster] ?? CLUSTER_FALLBACK;
            if (mode === "cluster") return CLUSTER_3D[f.cluster] ?? CLUSTER_FALLBACK;
            if (mode === "type") return f.thick ? THICK_COLOR : THIN_COLOR;
            if (mode === "index") {
                // color by actual height, so flipping recolors too
                const idx = d.indexAt(vid);
                return INDEX_COLORS[Math.min(3, Math.max(0, idx - 1))];
            }
            return new THREE.Color(PLAIN_COLOR);
        },
        // Shading by height: high lighter, low darker. Its strength is |vscale|, the
        // same number that flattens the surface — so at the middle of the slider,
        // where the roof is flat, there is nothing to shade and the shading is gone.
        // No separate control can then contradict the geometry by shading a flat
        // sheet.
        shade,
        useVertexColors: mode !== "plain" || shade > 0,
        flatColor: PLAIN_COLOR,
        transparent: transpChk.checked,
        edges: edgesChk.checked,
        isoglosses: isoChk.checked,
    });

    // Frame only when the patch itself changes — reframing on every rebuild
    // would fight the user while they drag the vertical scale slider.
    if (reframe) rv.frame(rv.roofRadius());

    const ms = Math.round(performance.now() - t0);
    const hist: Record<number, number> = {};
    for (const v of vertexList) hist[v.index] = (hist[v.index] ?? 0) + 1;
    const cl: Record<string, number> = {};
    for (const r of allRhombs) cl[r.cluster] = (cl[r.cluster] ?? 0) + 1;
    const clText = `${cl.Pe5 ?? 0} in stars, ${cl.Pe3 ?? 0} in boats, ${cl.Pe1 ?? 0} in diamonds`;
    const relief = (3 / Math.sqrt(5)) * Math.abs(vscale);
    statusEl.textContent =
        `${allRhombs.length} rhombi · ${vertexList.length} vertices · ` +
        `${clText} · index levels ${JSON.stringify(hist)} · ` +
        `relief ${relief.toFixed(3)} side lengths` +
        `${Math.abs(vscale) > 0.999 ? " (true)" : ` at ${Math.abs(vscale).toFixed(2)}× of ${(3 / Math.sqrt(5)).toFixed(3)}`}` +
        `${flip ? ", dales up" : ""} · ${ms} ms`;
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

for (const g of [1, 2, 3, 4, 5]) {
    const o = document.createElement("option");
    o.value = String(g);
    o.textContent = `Generation ${g}`;
    genSel.appendChild(o);
}
genSel.value = String(prefs.gen);
// A saved patch or generation that no longer exists must not leave the menu blank.
if (!patchSel.value) patchSel.value = PREF_DEFAULTS.patch;
if (!genSel.value) genSel.value = String(PREF_DEFAULTS.gen);
colorSel.value = prefs.color;
if (!colorSel.value) colorSel.value = PREF_DEFAULTS.color;
vscaleInput.value = String(prefs.vscale);
edgesChk.checked = prefs.edges;
isoChk.checked = prefs.isogloss;
transpChk.checked = prefs.transparent;
shadeChk.checked = prefs.shade;

function rebuild(reframe: boolean): void {
    const uu = Number(vscaleInput.value);
    const vv = Math.sign(uu) * Math.pow(Math.abs(uu), 1.6);
    vscaleOut.textContent = `${vv.toFixed(2)}×`;
    rv.clear();
    build(reframe);
}

for (const c of [patchSel, genSel]) {
    c.addEventListener("change", () => rebuild(true));
}
for (const c of [colorSel, edgesChk, isoChk, transpChk, shadeChk]) {
    c.addEventListener("change", () => rebuild(false));
}
vscaleInput.addEventListener("input", () => rebuild(false));

// Released, the slider eases to the nearest of −1, 0, +1 — dales up, flat, hills
// up. Those three are the settings that mean anything; the travel between them is
// worth having, so it is free and only the landing snaps.
let snapAnim = 0;
vscaleInput.addEventListener("change", () => {
    const from = Number(vscaleInput.value);
    const to = from < -0.5 ? -1 : from > 0.5 ? 1 : 0;
    cancelAnimationFrame(snapAnim);
    if (Math.abs(from - to) < 1e-3) {
        vscaleInput.value = String(to);
        rebuild(false);
        return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 260);
        const e = 1 - Math.pow(1 - k, 3);
        vscaleInput.value = String(from + (to - from) * e);
        rebuild(false);
        if (k < 1) snapAnim = requestAnimationFrame(step);
    };
    snapAnim = requestAnimationFrame(step);
});

function persist(): void {
    savePrefs(PREFS_KEY, {
        patch: patchSel.value,
        gen: Number(genSel.value),
        color: colorSel.value,
        vscale: Number(vscaleInput.value),
        edges: edgesChk.checked,
        isogloss: isoChk.checked,
        transparent: transpChk.checked,
        shade: shadeChk.checked,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);

el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the 3D view to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});

window.addEventListener("resize", () => rv.resize());

rv.resize();
rebuild(true);
rv.start();
