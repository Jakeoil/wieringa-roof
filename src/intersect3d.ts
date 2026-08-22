// Chapter 4, part 2 — what two triacontahedra share.
//
// The packing on the Centers page has solids overlapping at a handful of offsets, and
// this asks what the overlap actually is. Both solids are intersections of the same
// fifteen slabs, so the shared region is an intersection of fifteen slabs too — a
// convex polytope, centrally symmetric about half the offset. `dissect.ts` finds it by
// exact vertex enumeration rather than by sampling, which is what makes the volumes
// here trustworthy to the last digit.
//
// Only the one-axis offset gives a named solid. Translating a zonohedron by one of its
// own generators and intersecting deletes that generator, so the shared body is the
// zonohedron on the other five — the rhombic icosahedron, exactly half the volume. A
// diagonal is not a generator and no such statement is available for it.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { intersection, OFFSETS, shellFaces, RT_VOLUME } from "./dissect.js";
import type { V3 } from "./solids.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};
const view = el<HTMLDivElement>("view");
const offsetSel = el<HTMLSelectElement>("offset");
const sepInput = el<HTMLInputElement>("sep");
const sepOut = el<HTMLElement>("sepOut");
const bodySel = el<HTMLSelectElement>("body");
const edgesChk = el<HTMLInputElement>("edges");
const parentsChk = el<HTMLInputElement>("parents");
const spinChk = el<HTMLInputElement>("spin");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-intersect";
const PREF_DEFAULTS = {
    offset: "axis",
    sep: 1,
    body: "solid",
    edges: true,
    parents: true,
    spin: true,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1e8);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
camera.position.set(3.6, -4.6, 3.2);
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
controls.addEventListener("start", () => {
    controls.autoRotate = false;
    spinChk.checked = false;
});

scene.add(new THREE.AmbientLight(0xffffff, 0.68));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(4, -6, 8);
scene.add(keyLight);
const rim = new THREE.DirectionalLight(0xffffff, 0.32);
rim.position.set(-6, 4, -2);
scene.add(rim);

// A face of the shared body lies on a plane of one parent or the other — or, where the
// two coincide, of both. Colouring by that says at a glance which solid is doing the
// cutting, and the split is always even, as central symmetry requires.
const FROM_A = new THREE.Color(0x3d7fc4);
const FROM_B = new THREE.Color(0xd98d3a);
const FROM_BOTH = new THREE.Color(0x4f9d4a);
const SHELL = shellFaces();

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

/** One parent, as open windows with a narrow rim, so both can be seen through. */
function shellStrips(o: V3, col: THREE.Color, cp: number[], cc: number[]): void {
    const W = 0.15;
    for (const f of SHELL) {
        const mid: V3 = [0, 0, 0];
        for (const q of f.corners) for (let d = 0; d < 3; d++) mid[d] += q[d] / 4;
        const inner = f.corners.map(
            (q) =>
                [
                    mid[0] + (q[0] - mid[0]) * (1 - W),
                    mid[1] + (q[1] - mid[1]) * (1 - W),
                    mid[2] + (q[2] - mid[2]) * (1 - W),
                ] as V3,
        );
        for (let k = 0; k < 4; k++) {
            const a = f.corners[k];
            const b = f.corners[(k + 1) % 4];
            const c2 = inner[(k + 1) % 4];
            const d2 = inner[k];
            for (const q of [a, b, c2, a, c2, d2]) {
                cp.push(q[0] + o[0], q[1] + o[1], q[2] + o[2]);
                cc.push(col.r, col.g, col.b);
            }
        }
    }
}

function build(): void {
    clear();
    const u = Number(sepInput.value);
    const off = OFFSETS.find((o) => o.key === offsetSel.value) ?? OFFSETS[0];
    const t: V3 = [off.t[0] * u, off.t[1] * u, off.t[2] * u];
    const r = intersection(t);
    const bodyMode = bodySel.value;

    if (bodyMode !== "invisible" && r.faces.length) {
        const pos: number[] = [];
        const col: number[] = [];
        for (const f of r.faces) {
            const c = f.from === "a" ? FROM_A : f.from === "b" ? FROM_B : FROM_BOTH;
            // fan-triangulate: the corners are already ordered round the face
            for (let i = 1; i + 1 < f.corners.length; i++) {
                for (const q of [f.corners[0], f.corners[i], f.corners[i + 1]]) {
                    pos.push(q[0], q[1], q[2]);
                    col.push(c.r, c.g, c.b);
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(
            g,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.6,
                metalness: 0.03,
                flatShading: true,
                side: THREE.DoubleSide,
                transparent: bodyMode === "transparent",
                opacity: bodyMode === "transparent" ? 0.5 : 1,
                depthWrite: bodyMode !== "transparent",
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
            }),
        );
        scene.add(mesh);
        drawn.push(mesh);
    }

    if (edgesChk.checked && r.faces.length) {
        const seg: number[] = [];
        for (const f of r.faces) {
            for (let k = 0; k < f.corners.length; k++) {
                const a = f.corners[k];
                const b = f.corners[(k + 1) % f.corners.length];
                seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
            }
        }
        const eg = new LineSegmentsGeometry();
        eg.setPositions(seg);
        const em = new LineMaterial({
            color: 0x23262c,
            linewidth: 2.2,
            worldUnits: false,
            alphaToCoverage: true,
        });
        em.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
        edgeMats.push(em);
        const lines = new LineSegments2(eg, em);
        lines.renderOrder = 2;
        scene.add(lines);
        drawn.push(lines);
    }

    if (parentsChk.checked) {
        const cp: number[] = [];
        const cc: number[] = [];
        shellStrips([0, 0, 0], FROM_A, cp, cc);
        shellStrips(t, FROM_B, cp, cc);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(
            g,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.7,
                metalness: 0.02,
                flatShading: true,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.45,
                depthWrite: false,
            }),
        );
        scene.add(mesh);
        drawn.push(mesh);
    }

    const at = Math.abs(u - 1) < 1e-6 ? ` — the ${off.label.toLowerCase()} offset` : "";
    const byParent: Record<string, number> = {};
    for (const f of r.faces) byParent[f.from] = (byParent[f.from] ?? 0) + 1;
    statusEl.textContent =
        `centres ${Math.hypot(t[0], t[1], t[2]).toFixed(4)} apart${at} · ` +
        `shared ${r.volume.toFixed(6)} of ${RT_VOLUME.toFixed(6)} ` +
        `(${((100 * r.volume) / RT_VOLUME).toFixed(2)}%) · ` +
        `${r.vertices} vertices, ${r.faces.length} faces ` +
        `(${byParent.a ?? 0} from the first, ${byParent.b ?? 0} from the second` +
        `${byParent.both ? `, ${byParent.both} shared` : ""}) · ` +
        `${r.zonohedron ? "every face a parallelogram — a zonohedron" : "not a zonohedron"}`;
}

offsetSel.value = prefs.offset || PREF_DEFAULTS.offset;
sepInput.value = String(prefs.sep);
bodySel.value = prefs.body || PREF_DEFAULTS.body;
edgesChk.checked = prefs.edges;
parentsChk.checked = prefs.parents;
spinChk.checked = prefs.spin;
controls.autoRotate = spinChk.checked;

function rebuild(): void {
    sepOut.textContent = `${(100 * Number(sepInput.value)).toFixed(0)}%`;
    build();
}
for (const c of [offsetSel, bodySel, edgesChk, parentsChk]) c.addEventListener("change", rebuild);
sepInput.addEventListener("input", rebuild);
spinChk.addEventListener("change", () => {
    controls.autoRotate = spinChk.checked;
});
// Scrolling over the slider works it, which is what a slider under the pointer ought to
// do. Bound non-passively so the page does not scroll away underneath.
sepInput.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const step = (e.shiftKey ? 0.002 : 0.02) * (e.deltaY > 0 ? -1 : 1);
        sepInput.value = String(Math.min(1, Math.max(0, Number(sepInput.value) + step)));
        rebuild();
    },
    { passive: false },
);

function persist(): void {
    savePrefs(PREFS_KEY, {
        offset: offsetSel.value,
        sep: Number(sepInput.value),
        body: bodySel.value,
        edges: edgesChk.checked,
        parents: parentsChk.checked,
        spin: spinChk.checked,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);
el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the intersection view to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});

function resize(): void {
    const w = view.clientWidth;
    const h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    for (const m of edgeMats) m.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

console.log(`intersect build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}
resize();
rebuild();
renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});
