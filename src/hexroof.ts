// Chapter 4, part 4 — the roof, and the hexahedra under it.
//
// Two views of one object, in the terms of jake/Triacontrahedrons are golden.md: the
// roof as a surface of golden rhombs, and the roof as the boundary of a layer of acute
// and obtuse golden rhombohedra. The first is chapters 1 and 2; the second is what this
// page is for.
//
// The local fit is exact — any three of the five lifting axes span a golden
// rhombohedron, so every rhomb is a face of one. The global fit is the open question,
// and as far as this page can get it, **it does not close**: about 57% of rhombi can be
// given a cell beneath them, the same fraction from generation 2 to generation 4, so it
// is structural rather than an edge effect. See `hexlayer.ts`.

import * as THREE from "three";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { seedTypes, generatePatch, allRhombs, pairColor, FIVE_COLORS } from "./geometry.js";
import { buildRoof } from "./roofgeom.js";
import { createRoofView, CLUSTER_3D, CLUSTER_FALLBACK, THICK_COLOR, THIN_COLOR, PLAIN_COLOR } from "./roofview.js";
import { hexLayer } from "./hexlayer.js";
import type { HexLayer } from "./hexlayer.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};
const view = el<HTMLDivElement>("view");
const patchSel = el<HTMLSelectElement>("patch");
const genSel = el<HTMLSelectElement>("gen");
const colorSel = el<HTMLSelectElement>("color");
const roofSel = el<HTMLSelectElement>("roofmode");
const cellSel = el<HTMLSelectElement>("cellmode");
const edgesChk = el<HTMLInputElement>("edges");
const flipChk = el<HTMLInputElement>("flip");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-hexroof";
const PREF_DEFAULTS = {
    patch: "Pe3", gen: 3, color: "cluster",
    roofmode: "solid", cellmode: "type", edges: true, flip: false,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);
const rv = createRoofView(view, 0xf4f1e8);

const ACUTE = new THREE.Color(0xd98d3a);
const OBTUSE = new THREE.Color(0x4a7fb5);
const FIVE = FIVE_COLORS.map((h) => new THREE.Color(h));

let patchKey = "";
let layerCache: HexLayer | null = null;
function ensurePatch(): void {
    const key = `${patchSel.value}|${genSel.value}`;
    if (patchKey === key) return;
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === patchSel.value), true, Number(genSel.value));
    console.log = quiet;
    patchKey = key;
    layerCache = null;
}

function build(reframe: boolean): void {
    const t0 = performance.now();
    ensurePatch();
    const flip = flipChk.checked;
    const d = buildRoof(1, flip);
    if (!d) {
        statusEl.textContent = `${patchSel.value} generation ${genSel.value}: no rhombi yet — try a later generation.`;
        rv.renderer.render(rv.scene, rv.camera);
        return;
    }
    if (!layerCache) layerCache = hexLayer();
    const layer = layerCache;
    const zsign = flip ? -1 : 1;
    const mode = colorSel.value;

    rv.drawRoof(d, {
        colorOf: (f) => {
            if (mode === "five") return FIVE[pairColor(f.pair[0], f.pair[1])];
            if (mode === "cluster") return CLUSTER_3D[f.cluster] ?? CLUSTER_FALLBACK;
            if (mode === "type") return f.thick ? THICK_COLOR : THIN_COLOR;
            if (mode === "covered") return layer.covered.has(f.id) ? ACUTE : CLUSTER_FALLBACK;
            return new THREE.Color(PLAIN_COLOR);
        },
        shade: 0,
        useVertexColors: mode !== "plain",
        flatColor: PLAIN_COLOR,
        transparent: roofSel.value === "transparent",
        edges: edgesChk.checked,
        isoglosses: false,
        skipSurface: roofSel.value === "invisible",
    });

    // The cells. Their positions come from the unflipped lift, so the flip is applied
    // here, exactly as the Centers page does it — a mirrored rhombohedron is still a
    // rhombohedron, so this is exact rather than approximate.
    if (cellSel.value !== "invisible" && layer.cells.length) {
        const tris: number[] = [];
        const cols: number[] = [];
        const seg: number[] = [];
        for (const c of layer.cells) {
            const col = cellSel.value === "acute" && !c.acute ? null
                : cellSel.value === "obtuse" && c.acute ? null
                : c.acute ? ACUTE : OBTUSE;
            if (!col) continue;
            for (const f of c.faces) {
                const q = f.map((p) => [p[0] - d.offset[0], p[1] - d.offset[1], p[2] * zsign - d.offset[2]]);
                for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) {
                    tris.push(v[0], v[1], v[2]);
                    cols.push(col.r, col.g, col.b);
                }
                for (let i = 0; i < 4; i++) {
                    const a = q[i], b = q[(i + 1) % 4];
                    seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                }
            }
        }
        if (tris.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
            g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
            g.computeVertexNormals();
            rv.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.7, metalness: 0.02, flatShading: true,
                side: THREE.DoubleSide,
                transparent: cellSel.value === "transparent",
                opacity: cellSel.value === "transparent" ? 0.45 : 1,
                depthWrite: cellSel.value !== "transparent",
                polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
            })));
            if (edgesChk.checked) {
                const lg = new THREE.BufferGeometry();
                lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
                rv.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
                    color: 0x3a3f4a, transparent: true, opacity: 0.55,
                })));
            }
        }
    }

    if (reframe) rv.frame(rv.roofRadius() + 1.4);

    const ac = layer.cells.filter((c) => c.acute).length;
    statusEl.textContent =
        `${allRhombs.length} rhombi · ${layer.cells.length} hexahedra beneath — ` +
        `${ac} acute, ${layer.cells.length - ac} obtuse · ` +
        `${layer.covered.size} of ${layer.total} rhombi carry one ` +
        `(${((100 * layer.covered.size) / layer.total).toFixed(1)}%) · ` +
        `${Math.round(performance.now() - t0)} ms`;
}

for (const [code, nick] of [
    ["Pe5", "Pe5 pentagon"], ["Pe3", "Pe3 pentagon"], ["Pe1", "Pe1 pentagon"],
    ["St5", "St5 star"], ["St3", "St3 boat"], ["St1", "St1 diamond"],
    ["Deca", "Queen (composite)"], ["Sun", "Sun (composite)"], ["Star", "Star (composite)"],
] as Array<[string, string]>) {
    const o = document.createElement("option");
    o.value = code; o.textContent = nick; patchSel.appendChild(o);
}
patchSel.value = prefs.patch || PREF_DEFAULTS.patch;
for (const g of [2, 3, 4]) {
    const o = document.createElement("option");
    o.value = String(g); o.textContent = `Generation ${g}`; genSel.appendChild(o);
}
genSel.value = String(prefs.gen);
if (!genSel.value) genSel.value = String(PREF_DEFAULTS.gen);
colorSel.value = prefs.color || PREF_DEFAULTS.color;
roofSel.value = prefs.roofmode || PREF_DEFAULTS.roofmode;
cellSel.value = prefs.cellmode || PREF_DEFAULTS.cellmode;
edgesChk.checked = prefs.edges;
flipChk.checked = prefs.flip;

function rebuild(reframe: boolean): void {
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
for (const c of [patchSel, genSel]) c.addEventListener("change", () => rebuild(true));
for (const c of [colorSel, roofSel, cellSel, edgesChk, flipChk]) c.addEventListener("change", () => rebuild(false));

function persist(): void {
    savePrefs(PREFS_KEY, {
        patch: patchSel.value, gen: Number(genSel.value), color: colorSel.value,
        roofmode: roofSel.value, cellmode: cellSel.value,
        edges: edgesChk.checked, flip: flipChk.checked,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);
el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset this view to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});
window.addEventListener("resize", () => rv.resize());

console.log(`hexroof build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}
rv.resize();
rebuild(true);
rv.start();
