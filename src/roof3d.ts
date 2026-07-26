// 3D prototype — the Wieringa roof surface itself, lifted out of the plane.
//
// Almost free: geometry.ts already gives an exact integer vector n per vertex, so
// a corner's position is just pos3D(n). Every generator shares z = 1/√5, so the
// height is (Σ n_j)/√5 and the whole surface is only 1.342 side lengths deep —
// hence the vertical exaggeration control, without which it reads as flat.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
    seedTypes,
    generatePatch,
    allRhombs,
    vertexList,
    vertexMap,
    edgeMap,
    roundKey,
    computeLift,
    pos3D,
    CLUSTER_COLORS,
} from "./geometry.js";

const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

const view = el<HTMLDivElement>("view");
const patchSel = el<HTMLSelectElement>("patch");
const genSel = el<HTMLSelectElement>("gen");
const colorSel = el<HTMLSelectElement>("color");
const exagInput = el<HTMLInputElement>("exag");
const exagOut = el<HTMLElement>("exagOut");
const edgesChk = el<HTMLInputElement>("edges");
const flatChk = el<HTMLInputElement>("flat");
const statusEl = el<HTMLElement>("status");

// ── scene ─────────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f4f7);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
camera.position.set(9, -11, 9);
camera.up.set(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
view.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(4, -6, 10);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 0.35);
rim.position.set(-7, 5, 3);
scene.add(rim);

let surface: THREE.Mesh | null = null;
let wire: THREE.LineSegments | null = null;

function disposeOld(): void {
    for (const obj of [surface, wire]) {
        if (!obj) continue;
        scene.remove(obj);
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
    }
    surface = null;
    wire = null;
}

// ── palettes ──────────────────────────────────────────────────────

const INDEX_COLORS = [
    new THREE.Color(0x2f6fb5),
    new THREE.Color(0x54a598),
    new THREE.Color(0xd9b463),
    new THREE.Color(0xc4643f),
];
const THICK_COLOR = new THREE.Color(0x8f8fdc);
const THIN_COLOR = new THREE.Color(0xe2b184);

// gen-1 P1 clusters, at the penrose-mosaic strengths: Pe5 blue star,
// Pe3 yellow boat, Pe1 orange diamond
const CLUSTER_3D: Record<string, THREE.Color> = Object.fromEntries(
    Object.entries(CLUSTER_COLORS).map(([k, v]) => [k, new THREE.Color(v)]),
);
const CLUSTER_FALLBACK = new THREE.Color(0xbfc2ca);

// ── build ─────────────────────────────────────────────────────────

function build(reframe: boolean): void {
    const seedIdx = seedTypes.findIndex((s) => s.label === patchSel.value);
    const gen = Number(genSel.value);
    const exag = Number(exagInput.value);

    const t0 = performance.now();
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedIdx, true, gen);
    console.log = quiet;

    const lift = computeLift();
    const P = lift.n.map((nv) => (nv ? pos3D(nv) : null));

    // corner ids per rhomb, then two triangles each
    const faces = allRhombs.map((r) => ({
        thick: r.thick,
        cluster: r.cluster,
        v: r.verts.map((pt) => vertexMap.get(roundKey(pt))!.id),
    }));

    const pos: number[] = [];
    const col: number[] = [];
    const mode = colorSel.value;

    const push = (vid: number, c: THREE.Color) => {
        const p = P[vid]!;
        pos.push(p[0], p[1], p[2] * exag);
        col.push(c.r, c.g, c.b);
    };

    for (const f of faces) {
        const tri = [f.v[0], f.v[1], f.v[2], f.v[0], f.v[2], f.v[3]];
        for (const vid of tri) {
            let c: THREE.Color;
            if (mode === "cluster") {
                c = CLUSTER_3D[f.cluster] ?? CLUSTER_FALLBACK;
            } else if (mode === "type") {
                c = f.thick ? THICK_COLOR : THIN_COLOR;
            } else if (mode === "index") {
                const idx = vertexList[vid].index;
                c = INDEX_COLORS[Math.min(3, Math.max(0, idx - 1))];
            } else {
                c = new THREE.Color(0xc9cbd4);
            }
            push(vid, c);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    geo.boundingBox!.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z);

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: mode !== "plain",
        color: mode === "plain" ? 0xc9cbd4 : 0xffffff,
        roughness: 0.62,
        metalness: 0.04,
        flatShading: flatChk.checked,
        side: THREE.DoubleSide,
    });
    surface = new THREE.Mesh(geo, mat);
    scene.add(surface);

    // edges — one segment per tiling edge, so creases read as creases
    if (edgesChk.checked) {
        const lp: number[] = [];
        for (const e of edgeMap.values()) {
            const a = P[e.v1];
            const b = P[e.v2];
            if (!a || !b) continue;
            lp.push(
                a[0] - c.x,
                a[1] - c.y,
                a[2] * exag - c.z,
                b[0] - c.x,
                b[1] - c.y,
                b[2] * exag - c.z,
            );
        }
        const lg = new THREE.BufferGeometry();
        lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
        wire = new THREE.LineSegments(
            lg,
            new THREE.LineBasicMaterial({
                color: 0x33363d,
                transparent: true,
                opacity: 0.5,
            }),
        );
        scene.add(wire);
    }

    // Frame only when the patch itself changes — reframing on every rebuild
    // would fight the user while they drag the exaggeration slider.
    if (reframe) {
        geo.computeBoundingSphere();
        const r = geo.boundingSphere!.radius;
        controls.target.set(0, 0, 0);
        const dist = r / Math.sin((camera.fov * Math.PI) / 360) / 1.25;
        camera.position.normalize().multiplyScalar(dist);
        controls.update();
    }

    const ms = Math.round(performance.now() - t0);
    const hist: Record<number, number> = {};
    for (const v of vertexList) hist[v.index] = (hist[v.index] ?? 0) + 1;
    const cl: Record<string, number> = {};
    for (const r of allRhombs) cl[r.cluster] = (cl[r.cluster] ?? 0) + 1;
    const clText = `${cl.Pe5 ?? 0} in stars, ${cl.Pe3 ?? 0} in boats, ${cl.Pe1 ?? 0} in diamonds`;
    const relief = (3 / Math.sqrt(5)) * exag;
    statusEl.textContent =
        `${allRhombs.length} rhombi · ${vertexList.length} vertices · ` +
        `${clText} · index levels ${JSON.stringify(hist)} · ` +
        `relief ${relief.toFixed(2)} side lengths at ${exag}× ` +
        `(${(3 / Math.sqrt(5)).toFixed(3)} true) · ${ms} ms`;
}

// ── controls ──────────────────────────────────────────────────────

for (const [code, nick] of [
    ["Pe5", "Star"],
    ["Pe3", "Boat"],
    ["Pe1", "Diamond"],
    ["Deca", "Decagon"],
    ["St5", "Star (St5)"],
] as Array<[string, string]>) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = nick;
    patchSel.appendChild(o);
}
patchSel.value = "Pe3";

for (const g of [2, 3, 4]) {
    const o = document.createElement("option");
    o.value = String(g);
    o.textContent = `Generation ${g}`;
    genSel.appendChild(o);
}
genSel.value = "3";

function rebuild(reframe: boolean): void {
    exagOut.textContent = `${Number(exagInput.value).toFixed(1)}×`;
    disposeOld();
    build(reframe);
}

for (const c of [patchSel, genSel]) {
    c.addEventListener("change", () => rebuild(true));
}
for (const c of [colorSel, edgesChk, flatChk]) {
    c.addEventListener("change", () => rebuild(false));
}
exagInput.addEventListener("input", () => rebuild(false));

function resize(): void {
    const w = view.clientWidth;
    const h = view.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

resize();
rebuild(true);

renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});
