// Chapter 4, part 1 — the cage.
//
// The triacontahedron opened up: its twenty golden rhombic hexahedra, ten acute and ten
// obtuse, shown as a wireframe cage and pulled apart. The dissection itself is in
// `dissect.ts` and is checked by `tools/dissect.mjs`; everything here is presentation.
//
// Exploding moves each cell along the direction of its own center, so at zero they
// reassemble into the solid exactly and at full travel they sit in the arrangement they
// occupy within it, magnified. Nothing rotates and nothing is reordered — the picture
// only ever spreads.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { dissection } from "./dissect.js";
import type { Cell } from "./dissect.js";
import type { V3 } from "./solids.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};
const view = el<HTMLDivElement>("view");
const explodeInput = el<HTMLInputElement>("explode");
const explodeOut = el<HTMLElement>("explodeOut");
const colorSel = el<HTMLSelectElement>("color");
const showSel = el<HTMLSelectElement>("show");
const facesChk = el<HTMLInputElement>("faces");
const spinChk = el<HTMLInputElement>("spin");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-rhombohedra";
const PREF_DEFAULTS = { explode: 0, color: "type", show: "all", faces: true, spin: true };
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1e8);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
camera.position.set(3.4, -4.2, 3.0);
camera.up.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
view.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.autoRotate = prefs.spin;
controls.autoRotateSpeed = 1.0;
// a solid you have taken hold of should stop turning by itself
controls.addEventListener("start", () => {
    controls.autoRotate = false;
    spinChk.checked = false;
});

scene.add(new THREE.AmbientLight(0xffffff, 0.68));
const key = new THREE.DirectionalLight(0xffffff, 1.35);
key.position.set(4, -6, 8);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 0.32);
rim.position.set(-6, 4, -2);
scene.add(rim);

const ACUTE = new THREE.Color(0xd98d3a);
const OBTUSE = new THREE.Color(0x4a7fb5);
// twenty hues, so a cell can be followed as it moves out
const WHEEL = Array.from({ length: 20 }, (_, i) => new THREE.Color().setHSL(i / 20, 0.52, 0.55));
// one colour per axis-pair the cell's faces use
const AXIS = Array.from({ length: 6 }, (_, i) => new THREE.Color().setHSL(i / 6, 0.5, 0.55));

const cells = dissection();
let drawn: THREE.Object3D[] = [];
let edgeMats: LineMaterial[] = [];

function clear(): void {
    for (const o of drawn) {
        scene.remove(o);
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
    }
    drawn = [];
    edgeMats = [];
}

const colorOf = (c: Cell): THREE.Color => {
    if (colorSel.value === "cell") return WHEEL[c.id];
    if (colorSel.value === "axis") return AXIS[c.triple[0]];
    return c.acute ? ACUTE : OBTUSE;
};
const visible = (c: Cell): boolean =>
    showSel.value === "all" || (showSel.value === "acute") === c.acute;

function build(): void {
    clear();
    // Biased so the early travel is spread out: the interesting part is the moment the
    // cells separate, not the far end where they are just scattered.
    const u = Number(explodeInput.value);
    const t = Math.pow(u, 1.4) * 2.6;

    const tris: number[] = [];
    const cols: number[] = [];
    const seg: number[] = [];
    const segCol: number[] = [];
    let shown = 0;

    for (const c of cells) {
        if (!visible(c)) continue;
        shown++;
        const col = colorOf(c);
        const o: V3 = [c.center[0] * t, c.center[1] * t, c.center[2] * t];
        if (facesChk.checked) {
            for (const f of c.faces) {
                for (const q of [f[0], f[1], f[2], f[0], f[2], f[3]]) {
                    tris.push(q[0] + o[0], q[1] + o[1], q[2] + o[2]);
                    cols.push(col.r, col.g, col.b);
                }
            }
        }
        for (const f of c.faces) {
            for (let i = 0; i < 4; i++) {
                const a = f[i];
                const b = f[(i + 1) % 4];
                seg.push(a[0] + o[0], a[1] + o[1], a[2] + o[2], b[0] + o[0], b[1] + o[1], b[2] + o[2]);
                segCol.push(col.r * 0.35, col.g * 0.35, col.b * 0.35, col.r * 0.35, col.g * 0.35, col.b * 0.35);
            }
        }
    }

    if (tris.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(tris, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(
            g,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.72,
                metalness: 0.02,
                flatShading: true,
                side: THREE.DoubleSide,
                // Assembled, the cells share every internal face, so opaque faces would
                // hide the whole dissection behind the solid's own surface. Translucent
                // until they are well apart.
                transparent: t < 1.1,
                opacity: t < 1.1 ? 0.32 + 0.55 * Math.min(1, t) : 1,
                depthWrite: t >= 1.1,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
            }),
        );
        scene.add(mesh);
        drawn.push(mesh);
    }

    // The cage itself: every cell edge, drawn as camera-facing quads so the width means
    // something. LineBasicMaterial ignores linewidth in WebGL.
    const eg = new LineSegmentsGeometry();
    eg.setPositions(seg);
    eg.setColors(segCol);
    const em = new LineMaterial({
        vertexColors: true,
        linewidth: 2.0,
        worldUnits: false,
        alphaToCoverage: true,
    });
    em.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
    edgeMats.push(em);
    const lines = new LineSegments2(eg, em);
    lines.renderOrder = 2;
    scene.add(lines);
    drawn.push(lines);

    const nAcute = cells.filter((c) => visible(c) && c.acute).length;
    statusEl.textContent =
        `${shown} of 20 cells — ${nAcute} acute at 0.760845, ${shown - nAcute} obtuse at 0.470228, ` +
        `in the ratio φ · together 4√(5+2√5) = 12.310734, the triacontahedron's own volume · ` +
        `explode ${(100 * u).toFixed(0)}%`;
}

explodeInput.value = String(prefs.explode);
colorSel.value = prefs.color || PREF_DEFAULTS.color;
showSel.value = prefs.show || PREF_DEFAULTS.show;
facesChk.checked = prefs.faces;
spinChk.checked = prefs.spin;
controls.autoRotate = spinChk.checked;

function rebuild(): void {
    explodeOut.textContent = `${(100 * Number(explodeInput.value)).toFixed(0)}%`;
    build();
}
explodeInput.addEventListener("input", rebuild);
for (const c of [colorSel, showSel, facesChk]) c.addEventListener("change", rebuild);
spinChk.addEventListener("change", () => { controls.autoRotate = spinChk.checked; });

function persist(): void {
    savePrefs(PREFS_KEY, {
        explode: Number(explodeInput.value), color: colorSel.value,
        show: showSel.value, faces: facesChk.checked, spin: spinChk.checked,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);
el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the cage to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});

function resize(): void {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    for (const m of edgeMats) m.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

console.log(`rhombohedra build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}
resize();
rebuild();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
