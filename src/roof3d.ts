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
import { BUILD_ID } from "./build-id.js";
import { seedTypes, generatePatch, allRhombs, vertexList } from "./geometry.js";
import { buildRoof } from "./roofgeom.js";
import { buildPatchLine, buildRenderLine } from "./bars.js";
import { createRoofView, roofFill, PLAIN_COLOR } from "./roofview.js";

// Naming the missing id turns a silent null-dereference three frames later into
// an immediate, readable failure.
const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};

const view = el<HTMLDivElement>("view");
const shadeChk = el<HTMLInputElement>("shade");

// Session settings. Same treatment as the workbench: these are preferences, not a
// document, and losing them on every reload turns a look at the model into a round
// of re-setting dials.
const PREFS_KEY = "wr-roof3d";
const PREF_DEFAULTS = {
    patch: "Pe3",
    gen: 3,
    heads: true,
    color: "groups",
    vscale: 1,
    edges: true,
    isogloss: false,
    transparent: false,
    shade: false,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);
const edgesChk = el<HTMLInputElement>("edges");
const transpChk = el<HTMLInputElement>("transparent");
const statusEl = el<HTMLElement>("status");

const rv = createRoofView(view);

// ── build ─────────────────────────────────────────────────────────

function build(reframe: boolean): void {
    const seedIdx = seedTypes.findIndex((s) => s.label === patchLine.values.patch);
    const gen = patchLine.values.gen;

    const t0 = performance.now();
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedIdx, true, gen);
    console.log = quiet;

    // **Two controls now, for two questions.** The slider was doing both: its sign
    // was the parity and its magnitude the flattening, so asking for a shallower roof
    // and asking to see it from underneath were the same dial. Parity is on the patch
    // line, which is where what-this-is lives; the slider keeps the relief, biased so
    // the middle of the travel is spread out, near-flat being where the shape is
    // worth studying.
    const flip = !patchLine.values.heads;
    const vscale = Math.pow(Math.abs(renderLine.values.shading), 1.6);

    // An empty patch is a legitimate answer — the star family emits no rhombs until
    // a generation later — but it used to wreck the view permanently. With no
    // vertices the bounding sphere has radius 0, so the framing distance is 0 and
    // `camera.position.normalize()` on a zero vector yields NaN, which poisons the
    // camera for every frame afterwards. Say so and leave the camera alone.
    const d = buildRoof(vscale, flip);
    if (!d) {
        statusEl.textContent =
            `${patchLine.values.patch} generation ${gen}: no rhombs at this generation. ` +
            `Star-type seeds emit none until one generation later — try ${gen + 1}.`;
        rv.renderer.render(rv.scene, rv.camera);
        return;
    }

    const mode = renderLine.values.color;
    const shade = shadeChk.checked ? Math.abs(vscale) : 0;

    rv.drawRoof(d, {
        // One resolver, shared with the Hexahedra roof and the Centers shadow, so the
        // schemes cannot drift apart page to page. `index` is passed the vertex height
        // rather than the face's, so flipping the surface recolors it.
        colorOf: (f, vid) => roofFill(mode, f, d.indexAt(vid)),
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
        isoglosses: renderLine.values.isoglosses,
    });

    // Frame only when the patch itself changes — reframing on every rebuild
    // would fight the user while they drag the vertical scale slider.
    if (reframe) rv.frame(rv.roofRadius());

    const ms = Math.round(performance.now() - t0);
    const hist: Record<number, number> = {};
    for (const v of vertexList) hist[v.index] = (hist[v.index] ?? 0) + 1;
    const cl: Record<string, number> = {};
    for (const r of allRhombs) cl[r.group] = (cl[r.group] ?? 0) + 1;
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
//
// The patch line and the rendering line come from `src/bars.ts`, so this page offers
// the same two the Workbench and Hexahedra do, in the same order and with the same
// words. What is particular to a three-dimensional view — edges, transparency, and
// whether the height shading reaches the surface at all — stays on a line of its own.

const patchLine = buildPatchLine({
    host: el<HTMLElement>("patchbar"),
    patch: prefs.patch || PREF_DEFAULTS.patch,
    gen: Number(prefs.gen) || PREF_DEFAULTS.gen,
    heads: prefs.heads,
    // Generously: this page draws a surface and nothing else, so it manages patches
    // that the pages carrying solids over them cannot.
    limit: 45000,
    busy: 8000,
    onChange: () => rebuild(true),
});

const renderLine = buildRenderLine({
    host: el<HTMLElement>("renderbar"),
    color: prefs.color || PREF_DEFAULTS.color,
    // **Relief, not shading.** In three dimensions the magnitude is the model's own
    // vertical scale — it really flattens the roof — and the shading follows it, which
    // is why a flattened roof cannot be shaded. On the flat pages the same slider only
    // decides how strongly height is drawn. One control, named for what it does here.
    shading: {
        name: "Relief",
        value: Math.abs(Number(prefs.vscale)),
        slider: true,
        min: 0,
        format: (v: number) => `${Math.pow(Math.abs(v), 1.6).toFixed(2)}×`,
    },
    isoglosses: prefs.isogloss,
    onChange: () => rebuild(false),
});

edgesChk.checked = prefs.edges;
transpChk.checked = prefs.transparent;
shadeChk.checked = prefs.shade;

function rebuild(reframe: boolean): void {
    rv.clear();
    build(reframe);
}
for (const c of [edgesChk, transpChk, shadeChk]) {
    c.addEventListener("change", () => rebuild(false));
}
// The slider used to ease to the nearest of −1, 0, +1 on release — dales up, flat,
// hills up — because those three were the settings that meant anything. With the sign
// gone to the patch line the travel is all magnitude and there is nothing to land on.


function persist(): void {
    savePrefs(PREFS_KEY, {
        patch: patchLine.values.patch,
        gen: patchLine.values.gen,
        heads: patchLine.values.heads,
        color: renderLine.values.color,
        vscale: renderLine.values.shading,
        edges: edgesChk.checked,
        isogloss: renderLine.values.isoglosses,
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

// On the page as well as in the console. Working out whether the browser is running
// a stale script has cost this project three debugging sessions, and asking someone
// to open developer tools to find out is not an answer. The workbench has said so
// since it was written; this page was the one that could not answer the question.
console.log(`roof3d build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}

rv.resize();
rebuild(true);
rv.start();
