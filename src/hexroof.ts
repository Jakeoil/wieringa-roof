// Chapter 4, part 4 — the roof, and the hexahedra under it.
//
// Two views of one object, in the terms of jake/Triacontrahedrons are golden.md: the
// roof as a surface of golden rhombs, and the roof as the boundary of a layer of acute
// and obtuse golden rhombohedra. The first is chapters 1 and 2; the second is what this
// page is for.
//
// It closes exactly, and with nothing to choose. The third edge of a cell is the
// **vertical**, which is the sixth icosahedral axis — every generator has
// `E_j · e_z = 1/√5` — so each rhomb hangs one hexahedron straight down: acute under a
// thick rhomb, obtuse under a thin one. The cells are vertical prisms under rhombi whose
// shadows tile the plane, so they cannot overlap, and the bottom faces are the roof
// translated down by one unit — a second Penrose surface, congruent and parallel.

import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
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
const floorChk = el<HTMLInputElement>("floor");
const shrinkInput = el<HTMLInputElement>("shrink");
const shrinkOut = el<HTMLElement>("shrinkOut");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-hexroof";
const PREF_DEFAULTS = {
    patch: "Pe3", gen: 3, color: "cluster",
    roofmode: "solid", cellmode: "type", edges: true, flip: false, floor: false, shrink: 1,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);
const rv = createRoofView(view, 0xf4f1e8);

const ACUTE = new THREE.Color(0xd98d3a);
const OBTUSE = new THREE.Color(0x4a7fb5);
const FIVE = FIVE_COLORS.map((h) => new THREE.Color(h));

let edgeMats: LineMaterial[] = [];
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
    edgeMats = [];
    shrinkOut.textContent = `${(100 * Number(shrinkInput.value)).toFixed(0)}%`;
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
            if (mode === "covered") return f.thick ? ACUTE : OBTUSE;
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
    // The floor: the roof translated down by one unit, which is what the cells' bottom
    // faces are. Drawn faintly, since it is the same surface twice.
    if (floorChk.checked) {
        const fp: number[] = [];
        for (const f of layer.floor) {
            const q = f.map((p) => [p[0] - d.offset[0], p[1] - d.offset[1], p[2] * zsign - d.offset[2]]);
            for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) fp.push(v[0], v[1], v[2]);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
        g.computeVertexNormals();
        rv.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({
            color: 0xb9bcc4, roughness: 0.8, metalness: 0.02, flatShading: true,
            side: THREE.DoubleSide, transparent: true, opacity: 0.65,
        })));
    }

    if (cellSel.value !== "invisible" && layer.cells.length) {
        const tris: number[] = [];
        const cols: number[] = [];
        const seg: number[] = [];
        // Shrinking happens about each cell's own center, so nothing moves out of place —
        // the layer keeps its arrangement and only opens up enough to see the walls.
        const k = Number(shrinkInput.value);
        for (const c of layer.cells) {
            const col = cellSel.value === "acute" && !c.acute ? null
                : cellSel.value === "obtuse" && c.acute ? null
                : c.acute ? ACUTE : OBTUSE;
            if (!col && cellSel.value !== "five") continue;
            const ctr = c.center;
            c.faces.forEach((f, fi) => {
                // Face 0 is the roof rhomb itself, point for point. At full size the two
                // are exactly coplanar, and no depth test can separate them — which is
                // what mottled the surface in dales up, where the fixed polygon offset
                // pushes the wrong way. Leave it to the roof unless the roof is hidden
                // or shrink has already pulled the cell clear.
                if (fi === 0 && k === 1 && roofSel.value !== "invisible") return;
                const face = cellSel.value === "five" ? FIVE[c.colors[fi]] : col!;
                const q = f.map((p0) => {
                    const p = k === 1 ? p0 : [
                        ctr[0] + (p0[0] - ctr[0]) * k,
                        ctr[1] + (p0[1] - ctr[1]) * k,
                        ctr[2] + (p0[2] - ctr[2]) * k,
                    ];
                    return [p[0] - d.offset[0], p[1] - d.offset[1], p[2] * zsign - d.offset[2]];
                });
                for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) {
                    tris.push(v[0], v[1], v[2]);
                    cols.push(face.r, face.g, face.b);
                }
                for (let i = 0; i < 4; i++) {
                    const a = q[i], b = q[(i + 1) % 4];
                    seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                }
            });
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
            if (edgesChk.checked && seg.length) {
                // Screen-space width, so the edges hold up at any zoom. `LineBasicMaterial`
                // ignores `linewidth` on every desktop driver, which is why the outlines
                // were hairlines however dark they were set.
                const lg = new LineSegmentsGeometry();
                lg.setPositions(seg);
                const lm = new LineMaterial({
                    color: 0x1b1e24, linewidth: 2.2, worldUnits: false, alphaToCoverage: true,
                });
                lm.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
                edgeMats.push(lm);
                const lines = new LineSegments2(lg, lm);
                lines.renderOrder = 2;
                rv.add(lines);
            }
        }
    }

    if (reframe) rv.frame(rv.roofRadius() + 1.4);

    const vol = layer.cells.reduce((s, c) => s + c.volume, 0);
    statusEl.textContent =
        `${allRhombs.length} rhombi · ${layer.cells.length} hexahedra, one apiece — ` +
        `${layer.acute} acute under the thick, ${layer.obtuse} obtuse under the thin ` +
        `(ratio ${(layer.acute / Math.max(1, layer.obtuse)).toFixed(3)}, φ = 1.618) · ` +
        `volume ${vol.toFixed(3)} · ${Math.round(performance.now() - t0)} ms`;
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
// Capped at 3 deliberately. A quasiperiodic tiling shows its structure at a few hundred
// rhombi; thousands prove nothing extra and only make the page slow. Jeff's rule: ghost
// the setting that taxes the machine rather than write a shortcut to survive it.
for (const g of [2, 3]) {
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
floorChk.checked = prefs.floor;
shrinkInput.value = String(prefs.shrink);

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
// Through `rebuild`, not `build` — `build` only adds to the scene, and it is `rebuild`
// that clears it first. Calling `build` directly stacked a fresh copy of the whole layer
// on every tick of the slider, so the full-size copy stayed on top and nothing appeared
// to shrink at all.
shrinkInput.addEventListener("input", () => rebuild(false));
// Scrolling over the slider works it, as on the Intersection page.
shrinkInput.addEventListener("wheel", (e) => {
    e.preventDefault();
    const step = (e.shiftKey ? 0.002 : 0.02) * (e.deltaY > 0 ? -1 : 1);
    shrinkInput.value = String(Math.min(1, Math.max(0.3, Number(shrinkInput.value) + step)));
    rebuild(false);
}, { passive: false });
for (const c of [colorSel, roofSel, cellSel, edgesChk, flipChk, floorChk]) c.addEventListener("change", () => rebuild(false));

function persist(): void {
    savePrefs(PREFS_KEY, {
        patch: patchSel.value, gen: Number(genSel.value), color: colorSel.value,
        roofmode: roofSel.value, cellmode: cellSel.value,
        edges: edgesChk.checked, flip: flipChk.checked, floor: floorChk.checked,
        shrink: Number(shrinkInput.value),
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
window.addEventListener("resize", () => {
    rv.resize();
    for (const m of edgeMats) m.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
});

console.log(`hexroof build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}
rv.resize();
rebuild(true);
rv.start();
