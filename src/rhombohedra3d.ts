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
import { dissection, faceColor, cageFaces, pairColor } from "./dissect.js";
import type { DissectionKind } from "./dissect.js";
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
const faceSel = el<HTMLSelectElement>("facemode");
const edgeSel = el<HTMLSelectElement>("edgemode");
const cageSel = el<HTMLSelectElement>("cagemode");
const flipChk = el<HTMLInputElement>("flip");
const spinChk = el<HTMLInputElement>("spin");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-rhombohedra";
const PREF_DEFAULTS = { explode: 0, color: "five", show: "all", facemode: "solid", edgemode: "edges", cagemode: "cage", flip: false, spin: true };
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
// one color per axis-pair the cell's faces use
const AXIS = Array.from({ length: 6 }, (_, i) => new THREE.Color().setHSL(i / 6, 0.5, 0.55));
// The Kowalewski five. A proper edge coloring of K6, so every rosette of the solid
// shows all five, every hexahedron's opposite faces agree, and each hexahedron wears
// three of the five — the ten 3-subsets borne once by an acute cell and once by an
// obtuse one. Chosen well apart in hue since the whole point is telling them apart.
const FIVE = [0xd94f3d, 0xe8a33d, 0x4f9d4a, 0x3d7fc4, 0x9b59b6].map((h) => new THREE.Color(h));
const CAGE = new THREE.Color(0x8a8578);

// A metallic surface with nothing to reflect renders black — metalness is a statement
// about *reflection*, and an empty scene reflects nothing. So the rods and beads get a
// small gradient sky to work against. Applied to that material alone rather than to
// `scene.environment`, which would also relight the faces and the cage.
const METAL_ENV = (() => {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, "#cdd2da");
    grad.addColorStop(0.62, "#8d939d");
    grad.addColorStop(1, "#3f434b");
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
})();

// Both dissections, cached on first use. There are exactly two up to rotation and
// reflection — see dissect.ts — and the page can show either.
const KINDS: DissectionKind[] = ["symmetric", "chiral"];
const CELLS: Record<string, ReturnType<typeof dissection>> = {};
const CAGES: Record<string, ReturnType<typeof cageFaces>> = {};
for (const k of KINDS) {
    CELLS[k] = dissection(k);
    CAGES[k] = cageFaces(k);
}
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

/** Per face, since the five-coloring is a property of faces and not of cells. */
const colorOf = (c: Cell, face: number): THREE.Color => {
    if (colorSel.value === "five") return FIVE[faceColor(c, face)];
    if (colorSel.value === "cell") return WHEEL[c.id];
    if (colorSel.value === "axis") return AXIS[c.triple[0]];
    return c.acute ? ACUTE : OBTUSE;
};
const visible = (c: Cell): boolean =>
    showSel.value === "all" || (showSel.value === "acute") === c.acute;

function build(): void {
    clear();
    // Far enough that every cell actually leaves the cage, which needs more travel than
    // it looks: a cell moves along its own center, and center magnitudes run 0.2814 to
    // 1.1920, so the innermost goes only a quarter as far as the outermost. Clearing a
    // cage of radius 1.6180 with cells of radius up to 1.1920 therefore takes t ≈ 10 for
    // the worst of them, where the old limit of 2.6 stranded it inside. Squared travel
    // keeps the near end — where the cells separate, and the part worth watching — as
    // fine as it was, and accelerates the rest off screen.
    const u = Number(explodeInput.value);
    const t = Math.pow(u, 2.2) * 12;
    const faceMode = faceSel.value;
    const edgeMode = edgeSel.value;
    // Only two dissections exist up to symmetry, and they differ by a single flip
    // inside one Bilinski dodecahedron — four cells and six internal faces, everything
    // else identical. So the choice is a toggle rather than a list.
    const kind: DissectionKind = flipChk.checked ? "chiral" : "symmetric";
    const cells = CELLS[kind];
    const cage = CAGES[kind];
    // Corners and edges of each cell, for the ball-and-stick frame. Taken per cell
    // rather than deduplicated: assembled, neighboring cells share corners and the
    // beads coincide exactly, which looks like one bead — and once exploded they must
    // travel with their own cell anyway.
    const beads: V3[] = [];
    const rods: Array<[V3, V3]> = [];

    const tris: number[] = [];
    const cols: number[] = [];
    const seg: number[] = [];
    const segCol: number[] = [];
    let shown = 0;

    for (const c of cells) {
        if (!visible(c)) continue;
        shown++;
        const o: V3 = [c.center[0] * t, c.center[1] * t, c.center[2] * t];
        if (edgeMode === "ballstick") {
            for (const q of c.corners) beads.push([q[0] + o[0], q[1] + o[1], q[2] + o[2]]);
            // the twelve edges: each corner joined to the three that differ in one sign
            for (let b = 0; b < 8; b++) {
                for (let q = 0; q < 3; q++) {
                    const b2 = b | (1 << q);
                    if (b2 === b) continue;
                    const p1 = c.corners[b];
                    const p2 = c.corners[b2];
                    rods.push([
                        [p1[0] + o[0], p1[1] + o[1], p1[2] + o[2]],
                        [p2[0] + o[0], p2[1] + o[1], p2[2] + o[2]],
                    ]);
                }
            }
        }
        c.faces.forEach((f, fi) => {
            const col = colorOf(c, fi);
            if (faceMode !== "invisible") {
                for (const q of [f[0], f[1], f[2], f[0], f[2], f[3]]) {
                    tris.push(q[0] + o[0], q[1] + o[1], q[2] + o[2]);
                    cols.push(col.r, col.g, col.b);
                }
            }
            if (edgeMode === "edges") {
                for (let i = 0; i < 4; i++) {
                    const a = f[i];
                    const b = f[(i + 1) % 4];
                    seg.push(a[0] + o[0], a[1] + o[1], a[2] + o[2], b[0] + o[0], b[1] + o[1], b[2] + o[2]);
                    segCol.push(col.r * 0.35, col.g * 0.35, col.b * 0.35, col.r * 0.35, col.g * 0.35, col.b * 0.35);
                }
            }
        });
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
                // Assembled, the twenty cells share every internal face, so solid faces
                // show only the triacontahedron's own surface — an honest picture, but
                // not the dissection. Hence transparent by default; the choice is the
                // user's rather than a function of how far the cells have moved, which
                // an earlier version made it and which fought the control.
                transparent: faceMode === "transparent",
                opacity: faceMode === "transparent" ? 0.34 : 1,
                depthWrite: faceMode !== "transparent",
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
    // Guarded, not returned from. An early return here skipped everything below it —
    // which included the cage, so turning the cells' edges off took the cage with them.
    if (seg.length) {
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
    }

    if (beads.length) {
        const mat = new THREE.MeshStandardMaterial({
            color: 0xd8dae0,
            metalness: 0.92,
            roughness: 0.24,
            envMap: METAL_ENV,
            envMapIntensity: 1.0,
        });
        const bg = new THREE.IcosahedronGeometry(0.062, 2);
        const bm = new THREE.InstancedMesh(bg, mat, beads.length);
        const m4 = new THREE.Matrix4();
        beads.forEach((p, i) => bm.setMatrixAt(i, m4.makeTranslation(p[0], p[1], p[2])));
        bm.instanceMatrix.needsUpdate = true;
        scene.add(bm);
        drawn.push(bm);

        // A cylinder's own axis is +Y, so each rod is a rotation carrying Y onto the
        // edge, scaled to its length and dropped at its midpoint.
        const rg = new THREE.CylinderGeometry(0.026, 0.026, 1, 10, 1);
        const rm = new THREE.InstancedMesh(rg, mat, rods.length);
        const up = new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const pos = new THREE.Vector3();
        const scl = new THREE.Vector3();
        rods.forEach(([a, b], i) => {
            dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            const len = dir.length();
            quat.setFromUnitVectors(up, dir.clone().normalize());
            pos.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
            scl.set(1, len, 1);
            rm.setMatrixAt(i, m4.compose(pos, quat, scl));
        });
        rm.instanceMatrix.needsUpdate = true;
        scene.add(rm);
        drawn.push(rm);
    }

    // The cage: **every** face of the assembled dissection as an open window with a
    // narrow rim — all seventy-five of them, the thirty outside and the forty-five
    // within, not merely the shell. So it is the whole internal skeleton, and each cell
    // has a socket in it shaped exactly like itself. It does not explode: it is what
    // the pieces come out of, and watching them leave it is the point.
    // `inner` drops the thirty faces on the solid's own surface and keeps the
    // forty-five within, which is the internal skeleton with nothing wrapped round it.
    const cageMode = cageSel.value;
    if (cageMode !== "none") {
        const W = 0.15;
        const cp: number[] = [];
        const cc: number[] = [];
        for (const f of cage) {
            if (cageMode === "inner" && f.outer) continue;
            const col = colorSel.value === "five" ? FIVE[pairColor(f.i, f.j)] : CAGE;
            const mid: V3 = [0, 0, 0];
            for (const q of f.corners) for (let d = 0; d < 3; d++) mid[d] += q[d] / 4;
            const inner = f.corners.map(
                (q) => [
                    mid[0] + (q[0] - mid[0]) * (1 - W),
                    mid[1] + (q[1] - mid[1]) * (1 - W),
                    mid[2] + (q[2] - mid[2]) * (1 - W),
                ] as V3,
            );
            for (let k = 0; k < 4; k++) {
                // Dropping the outer faces is not enough to drop the outer outline: an
                // internal face reaches the surface along an edge, and 54 of the solid's
                // 60 edges are drawn that way. So the filter is per strip, not per face.
                if (cageMode === "inner" && f.edgeOuter[k]) continue;
                const a = f.corners[k], b = f.corners[(k + 1) % 4];
                const c2 = inner[(k + 1) % 4], d2 = inner[k];
                for (const q of [a, b, c2, a, c2, d2]) {
                    cp.push(q[0], q[1], q[2]);
                    cc.push(col.r, col.g, col.b);
                }
            }
        }
        if (cp.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(
            g,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.66,
                metalness: 0.03,
                flatShading: true,
                side: THREE.DoubleSide,
            }),
        );
        scene.add(mesh);
        drawn.push(mesh);
        }
    }

    const nAcute = cells.filter((c) => visible(c) && c.acute).length;
    const kindNote = kind === "symmetric"
        ? " · unflipped — the dissection that keeps a three-fold axis"
        : " · flipped — one Bilinski dodecahedron turned over, and the three-fold axis is gone";
    const note = colorSel.value === "five"
        ? " · Kowalewski five: every rosette shows all five, opposite faces of each hexahedron agree, each wears three of the five"
        : "";
    statusEl.textContent =
        `${shown} of 20 cells — ${nAcute} acute at 0.760845, ${shown - nAcute} obtuse at 0.470228, ` +
        `in the ratio φ · together 4√(5+2√5) = 12.310734, the triacontahedron's own volume · ` +
        `explode ${(100 * u).toFixed(0)}%${kindNote}${note}`;
}

explodeInput.value = String(prefs.explode);
colorSel.value = prefs.color || PREF_DEFAULTS.color;
showSel.value = prefs.show || PREF_DEFAULTS.show;
faceSel.value = prefs.facemode || PREF_DEFAULTS.facemode;
edgeSel.value = prefs.edgemode || PREF_DEFAULTS.edgemode;
cageSel.value = prefs.cagemode || PREF_DEFAULTS.cagemode;
// A select handed a stored value that no option carries reports "" rather than rejecting
// it, so each falls back explicitly.
for (const [sel, def] of [
    [colorSel, PREF_DEFAULTS.color], [showSel, PREF_DEFAULTS.show],
    [faceSel, PREF_DEFAULTS.facemode], [edgeSel, PREF_DEFAULTS.edgemode],
    [cageSel, PREF_DEFAULTS.cagemode],
] as Array<[HTMLSelectElement, string]>) if (!sel.value) sel.value = def;
flipChk.checked = prefs.flip;
spinChk.checked = prefs.spin;
controls.autoRotate = spinChk.checked;

function rebuild(): void {
    explodeOut.textContent = `${(100 * Number(explodeInput.value)).toFixed(0)}%`;
    build();
}
explodeInput.addEventListener("input", rebuild);
for (const c of [colorSel, showSel, faceSel, edgeSel, cageSel, flipChk]) c.addEventListener("change", rebuild);

// Scrolling over the slider works it, which is what a slider under the pointer ought to
// do. Bound non-passively so the page does not scroll away underneath.
explodeInput.addEventListener(
    "wheel",
    (e) => {
        e.preventDefault();
        const step = (e.shiftKey ? 0.002 : 0.02) * (e.deltaY > 0 ? -1 : 1);
        const v = Math.min(1, Math.max(0, Number(explodeInput.value) + step));
        explodeInput.value = String(v);
        rebuild();
    },
    { passive: false },
);
spinChk.addEventListener("change", () => { controls.autoRotate = spinChk.checked; });

function persist(): void {
    savePrefs(PREFS_KEY, {
        explode: Number(explodeInput.value), color: colorSel.value,
        show: showSel.value, facemode: faceSel.value, edgemode: edgeSel.value,
        cagemode: cageSel.value, flip: flipChk.checked,
        spin: spinChk.checked,
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
