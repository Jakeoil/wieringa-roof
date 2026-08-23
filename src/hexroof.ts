// Chapter 4, part 4 — the roof as a layer of golden hexahedra.
//
// **One hexahedron per rhomb, and there is no choice to make.** A roof rhomb spans two
// of the five lifting axes; the third edge of its cell is the **vertical**, which is the
// sixth icosahedral axis. Every generator satisfies `E_j · e_z = 1/√5`, so
// `{E_j, E_k, e_z}` is a golden rhombohedron like any other triple of the six, and the
// cell hangs straight down: acute under a thick rhomb, obtuse under a thin one. See
// `hexlayer.ts` for the construction and `tools/hexlayer.mjs` for the checks.
//
// The cells carry their own upper and lower surfaces, so the roof is an accessory on
// this page rather than the subject — off by default, and useful mainly as a transparent
// film held over the model to read the tiling's own coloring through the solid.

import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { seedTypes, generatePatch, allRhombs, pairColor, FIVE_COLORS } from "./geometry.js";
import { buildRoof } from "./roofgeom.js";
import type { RoofData } from "./roofgeom.js";
import {
    createRoofView, shadeColor, CLUSTER_3D, CLUSTER_FALLBACK,
    THICK_COLOR, THIN_COLOR, PLAIN_COLOR,
} from "./roofview.js";
import { patchSize, MAX_GENERATION } from "./patchsize.js";
import { hexLayer } from "./hexlayer.js";
import type { HexLayer, HexCell } from "./hexlayer.js";
import type { V3 } from "./geometry.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};
const view = el<HTMLDivElement>("view");
const patchSel = el<HTMLSelectElement>("patch");
const genSel = el<HTMLSelectElement>("gen");
const tailsRadio = el<HTMLInputElement>("ptails");
const headsRadio = el<HTMLInputElement>("pheads");
const cellColorSel = el<HTMLSelectElement>("cellcolor");
const cellSel = el<HTMLSelectElement>("cellmode");
const cellShowSel = el<HTMLSelectElement>("cellshow");
const shrinkInput = el<HTMLInputElement>("shrink");
const shrinkOut = el<HTMLElement>("shrinkOut");
const topsChk = el<HTMLInputElement>("tops");
const floorsChk = el<HTMLInputElement>("floors");
const edgesChk = el<HTMLInputElement>("edges");
const shadeChk = el<HTMLInputElement>("shade");
const isoChk = el<HTMLInputElement>("isogloss");
const roofSel = el<HTMLSelectElement>("roofmode");
const roofColorSel = el<HTMLSelectElement>("roofcolor");
const flatChk = el<HTMLInputElement>("flat");
const roofEdgesChk = el<HTMLInputElement>("roofedges");
const roofIsoChk = el<HTMLInputElement>("roofiso");
const roofPanel = el<HTMLDetailsElement>("roofpanel");
const roofState = el<HTMLElement>("roofstate");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-hexroof";
const PREF_DEFAULTS = {
    patch: "Pe3", gen: 3, tails: false,
    cellcolor: "type", cellmode: "solid", cellshow: "both", shrink: 1,
    tops: true, floors: true, edges: true, shade: false, isogloss: false,
    roofmode: "invisible", roofcolor: "cluster", flat: false,
    roofedges: true, roofiso: false, roofopen: false,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);
const rv = createRoofView(view, 0xf4f1e8);

const ACUTE = new THREE.Color(0xd98d3a);
const OBTUSE = new THREE.Color(0x4a7fb5);
const CELL_PLAIN = new THREE.Color(0xc9cbd4);
const FIVE = FIVE_COLORS.map((h) => new THREE.Color(h));
const FLOOR_TINT = 0.72; // floors sit a shade back, so up and down read apart

let edgeMats: LineMaterial[] = [];
let patchKey = "";
let layerCache: HexLayer | null = null;

// Every generation is offered and the ones that would not hold up are ghosted, rather
// than the list being cut to a length that suits the largest patch. Pe5 generation 6 is
// 33,820 rhombs and Sun generation 1 is 55 — capping both at the same number throws away
// most of what the small patches can do.
//
// The limits are on the cell count, since that is what the page actually pays for: each
// cell is six faces and twenty-four edge segments, and the edges are the expensive half.
const BUSY = 8000;   // drawn, but the edge overlay starts to tell
const LIMIT = 45000; // beyond this the page stops being usable, so the option is ghosted

function fillGenerations(prefer?: number): void {
    const code = patchSel.value || PREF_DEFAULTS.patch;
    // On the first call there are no options yet, so the wanted generation has to be
    // handed in rather than read back off the empty select.
    const keep = prefer ?? Number(genSel.value);
    genSel.textContent = "";
    for (let g = 1; g <= MAX_GENERATION; g++) {
        const n = patchSize(code, g);
        const o = document.createElement("option");
        o.value = String(g);
        if (n === 0) {
            // The star seeds have no generation 1 — a star, boat or diamond is not
            // produced until the first deflation.
            o.textContent = `Generation ${g} — none`;
            o.disabled = true;
            o.title = `${code} does not exist at generation ${g}`;
        } else if (n > LIMIT) {
            o.textContent = `Generation ${g} — ${n.toLocaleString()} rhombs`;
            o.disabled = true;
            o.title = `${n.toLocaleString()} rhombs is past what this page can draw`;
        } else {
            o.textContent = `Generation ${g} — ${n.toLocaleString()}${n > BUSY ? " (slow)" : ""}`;
            o.title = `${n.toLocaleString()} rhombs, so ${n.toLocaleString()} hexahedra`;
        }
        genSel.appendChild(o);
    }
    // Keep the current generation if the new patch still supports it, else fall back to
    // the largest one it does support at or below the old choice.
    const usable = (g: number) => {
        const n = patchSize(code, g);
        return n > 0 && n <= LIMIT;
    };
    let g = keep || PREF_DEFAULTS.gen;
    if (!usable(g)) {
        let best = 0;
        for (let i = 1; i <= MAX_GENERATION; i++) if (usable(i) && (i <= g || best === 0)) best = i;
        g = best || 2;
    }
    genSel.value = String(g);
    // Belt and braces: if that value somehow matched no option the select would report
    // "" and every later comparison against it would quietly fail, which is the failure
    // mode `tools/pagecheck.mjs` exists to catch.
    if (!genSel.value) {
        const first = Array.from(genSel.options).find((o) => !o.disabled);
        if (first) genSel.value = first.value;
    }
}
// Codes are what `generatePatch` matches on; the nicknames are for reading.
for (const [code, nick] of [
    ["Pe5", "Pe5 pentagon"], ["Pe3", "Pe3 pentagon"], ["Pe1", "Pe1 pentagon"],
    ["St5", "St5 star"], ["St3", "St3 boat"], ["St1", "St1 diamond"],
    ["Deca", "Queen (composite)"], ["Sun", "Sun (composite)"], ["Star", "Star (composite)"],
] as Array<[string, string]>) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = nick;
    patchSel.appendChild(o);
}

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

/**
 * Height contours across one rhomb face, on the eighths the roof's own isoglosses use.
 *
 * A rhomb always spans exactly 2 index levels — a roof edge changes the index by exactly
 * 1 — so eighths of a face's own span are quarter-index levels globally, and the contours
 * run continuously from one rhomb into the next.
 *
 * Only the tops and floors get these. A side wall is plumb, so height restricted to it
 * depends on nothing but z and its contours would be horizontal lines on every wall
 * alike: dense, uniform, and carrying no information the construction has not already
 * guaranteed. What the walls do encode is that the slab is √5 ≈ 2.236 index levels thick,
 * which is a sentence rather than a drawing.
 */
function contours(poly: V3[], index: number[], out: number[], place: (p: V3) => V3): void {
    let k = 0;
    for (let i = 1; i < 4; i++) if (index[i] < index[k]) k = i;
    const lo = poly[k], r1 = poly[(k + 1) % 4], hi = poly[(k + 2) % 4], r3 = poly[(k + 3) % 4];
    const mid = (a: V3, b: V3, s: number): V3 =>
        [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
    for (let i = 1; i <= 7; i++) {
        const t = i / 8;
        const s = t <= 0.5 ? t * 2 : (t - 0.5) * 2;
        const L = place(t <= 0.5 ? mid(lo, r3, s) : mid(r3, hi, s));
        const R = place(t <= 0.5 ? mid(lo, r1, s) : mid(r1, hi, s));
        out.push(L[0], L[1], L[2], R[0], R[1], R[2]);
    }
}

function lineLayer(seg: number[], color: number, width: number, opacity = 1): void {
    if (!seg.length) return;
    const g = new LineSegmentsGeometry();
    g.setPositions(seg);
    const m = new LineMaterial({
        color, linewidth: width, worldUnits: false, alphaToCoverage: true,
        transparent: opacity < 1, opacity,
    });
    m.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
    edgeMats.push(m);
    const lines = new LineSegments2(g, m);
    lines.renderOrder = 2;
    rv.add(lines);
}

function build(reframe: boolean): void {
    const t0 = performance.now();
    edgeMats = [];
    shrinkOut.textContent = `${(100 * Number(shrinkInput.value)).toFixed(0)}%`;
    ensurePatch();

    const flip = tailsRadio.checked;
    const d = buildRoof(1, flip);
    if (!d) {
        statusEl.textContent = `${patchSel.value} generation ${genSel.value}: no rhombi yet — try a later generation.`;
        rv.renderer.render(rv.scene, rv.camera);
        return;
    }
    if (!layerCache) layerCache = hexLayer();
    const layer = layerCache;

    // Parity is a pure z-reflection, so the cells stay exactly golden under it — which is
    // why this page offers tails and heads but not the vertical-scale slider of the 3D
    // page. Squashing would leave the solids no longer golden, and they are the subject.
    const zsign = flip ? -1 : 1;
    const k = Number(shrinkInput.value);
    const shrinking = k < 1;

    /** Cell-local shrink, then parity, then the shared centering offset. */
    const place = (p: V3, c: HexCell): V3 => {
        const q: V3 = shrinking
            ? [
                c.center[0] + (p[0] - c.center[0]) * k,
                c.center[1] + (p[1] - c.center[1]) * k,
                c.center[2] + (p[2] - c.center[2]) * k,
            ]
            : p;
        return [q[0] - d.offset[0], q[1] - d.offset[1], q[2] * zsign - d.offset[2]];
    };

    // Shading is a hint about which way is up *on screen*, so it keys off the displayed
    // height rather than the index — which means it inverts under tails, and that
    // inversion is itself the cue that the model has been turned over.
    const zLo = Math.min(...layer.cells.flatMap((c) => c.corners.map((p) => p[2] * zsign)));
    const zHi = Math.max(...layer.cells.flatMap((c) => c.corners.map((p) => p[2] * zsign)));
    const span = Math.max(1e-9, zHi - zLo);
    const shading = shadeChk.checked;
    const tOf = (z: number) => ((z * zsign - zLo) / span - 0.5) * 2;

    const cellMode = cellSel.value;
    const showMode = cellShowSel.value;
    const colorMode = cellColorSel.value;
    let drawnCells = 0;
    let topZ = -Infinity;
    // The view used to be framed from `roofRadius()`, but that is only set when the roof
    // is drawn — and the roof is now off by default. The cells have to measure themselves.
    let frameR2 = 0;

    if (cellMode !== "invisible") {
        const tris: number[] = [];
        const cols: number[] = [];
        const seg: number[] = [];
        const iso: number[] = [];
        for (const c of layer.cells) {
            if (showMode === "acute" && !c.acute) continue;
            if (showMode === "obtuse" && c.acute) continue;
            drawnCells++;
            const base = colorMode === "five" ? null
                : colorMode === "plain" ? CELL_PLAIN
                : c.acute ? ACUTE : OBTUSE;
            c.faces.forEach((f, fi) => {
                if (fi === 0 && !topsChk.checked) return;
                if (fi === 1 && !floorsChk.checked) return;
                const face = colorMode === "five" ? FIVE[c.colors[fi]] : base!;
                // A floor is the same rhomb as the top; darkening it a little is the only
                // thing keeping the two surfaces apart when both are on.
                const tinted = fi === 1 ? face.clone().multiplyScalar(FLOOR_TINT) : face;
                const q = f.map((p) => place(p as V3, c));
                for (const i of [0, 1, 2, 0, 2, 3]) {
                    const v = q[i];
                    if (v[2] > topZ) topZ = v[2];
                    const r2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
                    if (r2 > frameR2) frameR2 = r2;
                    tris.push(v[0], v[1], v[2]);
                    const col = shading && fi < 2
                        ? shadeColor(tinted, tOf(f[i][2]), 1)
                        : tinted;
                    cols.push(col.r, col.g, col.b);
                }
                for (let i = 0; i < 4; i++) {
                    const a = q[i], b = q[(i + 1) % 4];
                    seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                }
                if (isoChk.checked && fi < 2) {
                    contours(f as V3[], c.index, iso, (p) => place(p, c));
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
                transparent: cellMode === "transparent",
                opacity: cellMode === "transparent" ? 0.45 : 1,
                depthWrite: cellMode !== "transparent",
                polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
            })));
            if (edgesChk.checked) lineLayer(seg, 0x1b1e24, 2.2);
            lineLayer(iso, 0x2b2f38, 1.2, 0.5);
        }
    }

    // The roof, last and optional. Its rhombs are coplanar with the cell tops point for
    // point, so it is lifted clear of them along the outward direction — otherwise the
    // two coincident surfaces mottle together and neither reads. Collapsed, it becomes
    // the flat Penrose tiling held as a sheet above the whole model.
    if (roofSel.value !== "invisible") {
        const lift = 0.006 * zsign;
        const dRoof: RoofData = flatChk.checked
            ? { ...d, k: 0, offset: [d.offset[0], d.offset[1], -(topZ > -Infinity ? topZ : 0) - 0.35] as V3 }
            : { ...d, offset: [d.offset[0], d.offset[1], d.offset[2] - lift] as V3 };
        const rmode = roofColorSel.value;
        rv.drawRoof(dRoof, {
            colorOf: (f) => {
                if (rmode === "five") return FIVE[pairColor(f.pair[0], f.pair[1])];
                if (rmode === "cluster") return CLUSTER_3D[f.cluster] ?? CLUSTER_FALLBACK;
                if (rmode === "type") return f.thick ? THICK_COLOR : THIN_COLOR;
                return new THREE.Color(PLAIN_COLOR);
            },
            shade: 0,
            useVertexColors: rmode !== "plain",
            flatColor: PLAIN_COLOR,
            transparent: roofSel.value === "transparent",
            edges: roofEdgesChk.checked,
            isoglosses: roofIsoChk.checked,
            skipSurface: false,
        });
    }

    // With the group folded shut its setting would otherwise be invisible, so the header
    // carries it.
    roofState.textContent = roofSel.value === "invisible"
        ? "off"
        : `${flatChk.checked ? "flattened, " : ""}${roofSel.value}, ${roofColorSel.options[roofColorSel.selectedIndex]?.textContent?.toLowerCase() ?? ""}`;

    if (reframe) {
        const r = Math.max(Math.sqrt(frameR2), roofSel.value !== "invisible" ? rv.roofRadius() : 0);
        rv.frame((r > 0 ? r : 4) + 1.4);
    }

    const vol = layer.cells.reduce((s, c) => s + c.volume, 0);
    const shown = drawnCells === layer.cells.length ? "" : ` · ${drawnCells} shown`;
    statusEl.textContent =
        `${allRhombs.length} rhombi · ${layer.cells.length} hexahedra, one apiece — ` +
        `${layer.acute} acute under the thick, ${layer.obtuse} obtuse under the thin ` +
        `(ratio ${(layer.acute / Math.max(1, layer.obtuse)).toFixed(3)}, φ = 1.618) · ` +
        `volume ${vol.toFixed(3)} · slab one rhomb edge thick, √5 = 2.236 index levels` +
        `${shown} · ${Math.round(performance.now() - t0)} ms`;
}

patchSel.value = prefs.patch || PREF_DEFAULTS.patch;
if (!patchSel.value) patchSel.value = PREF_DEFAULTS.patch;
fillGenerations(Number(prefs.gen) || PREF_DEFAULTS.gen);
tailsRadio.checked = !!prefs.tails;
headsRadio.checked = !prefs.tails;
// `cellmode` meant something else in the previous layout — it carried the color scheme
// as well as the surface. A stored value with no matching option leaves a select
// reporting "", so each one falls back explicitly rather than silently reading empty.
cellColorSel.value = prefs.cellcolor || PREF_DEFAULTS.cellcolor;
cellSel.value = prefs.cellmode || PREF_DEFAULTS.cellmode;
cellShowSel.value = prefs.cellshow || PREF_DEFAULTS.cellshow;
for (const [sel, def] of [
    [cellColorSel, PREF_DEFAULTS.cellcolor], [cellSel, PREF_DEFAULTS.cellmode],
    [cellShowSel, PREF_DEFAULTS.cellshow],
] as Array<[HTMLSelectElement, string]>) if (!sel.value) sel.value = def;
shrinkInput.value = String(prefs.shrink ?? 1);
topsChk.checked = prefs.tops;
floorsChk.checked = prefs.floors;
edgesChk.checked = prefs.edges;
shadeChk.checked = prefs.shade;
isoChk.checked = prefs.isogloss;
roofSel.value = prefs.roofmode || PREF_DEFAULTS.roofmode;
roofColorSel.value = prefs.roofcolor || PREF_DEFAULTS.roofcolor;
for (const [sel, def] of [
    [roofSel, PREF_DEFAULTS.roofmode], [roofColorSel, PREF_DEFAULTS.roofcolor],
] as Array<[HTMLSelectElement, string]>) if (!sel.value) sel.value = def;
flatChk.checked = prefs.flat;
roofEdgesChk.checked = prefs.roofedges;
roofIsoChk.checked = prefs.roofiso;
roofPanel.open = !!prefs.roofopen;
roofPanel.addEventListener("toggle", persist);

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

patchSel.addEventListener("change", () => {
    fillGenerations();
    rebuild(true);
});
genSel.addEventListener("change", () => rebuild(true));
for (const c of [
    tailsRadio, headsRadio, cellColorSel, cellSel, cellShowSel, topsChk, floorsChk,
    edgesChk, shadeChk, isoChk, roofSel, roofColorSel, flatChk, roofEdgesChk, roofIsoChk,
]) c.addEventListener("change", () => rebuild(false));

// Through `rebuild`, not `build` — `build` only adds to the scene and `rebuild` is what
// clears it first.
shrinkInput.addEventListener("input", () => rebuild(false));
shrinkInput.addEventListener("wheel", (e) => {
    e.preventDefault();
    const step = (e.shiftKey ? 0.002 : 0.02) * (e.deltaY > 0 ? -1 : 1);
    shrinkInput.value = String(Math.min(1, Math.max(0.3, Number(shrinkInput.value) + step)));
    rebuild(false);
}, { passive: false });

function persist(): void {
    savePrefs(PREFS_KEY, {
        patch: patchSel.value, gen: Number(genSel.value), tails: tailsRadio.checked,
        cellcolor: cellColorSel.value, cellmode: cellSel.value, cellshow: cellShowSel.value,
        shrink: Number(shrinkInput.value),
        tops: topsChk.checked, floors: floorsChk.checked, edges: edgesChk.checked,
        shade: shadeChk.checked, isogloss: isoChk.checked,
        roofmode: roofSel.value, roofcolor: roofColorSel.value, flat: flatChk.checked,
        roofedges: roofEdgesChk.checked, roofiso: roofIsoChk.checked,
        roofopen: roofPanel.open,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);
el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the hexahedra view to default settings?")) {
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
