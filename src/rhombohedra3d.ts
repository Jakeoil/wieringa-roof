// Chapter 4, part 1 — the cage.
//
// The triacontahedron opened up: its twenty golden rhombic hexahedra, ten acute and ten
// obtuse, shown as a wireframe cage and pulled apart. The dissection itself is in
// `dissect.ts` and is checked by `tools/dissect.mjs`; everything here is presentation.
//
// And not only the triacontahedron. Drop an axis and the zonohedron on the remaining
// five is the **golden icosahedron**, twenty faces and ten cells; drop another and it
// is the **golden dodecahedron**, Bilinski's, twelve faces and four. Since every pair
// of the six axes meets at the same angle, all three are the same rhombus and the same
// two hexahedra throughout — the family is one parameter, and the page hands it over.
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
import {
    dissection, faceColor, cageFaces,
    SOLIDS, solidCounts, solidVolume, groupOrder, allDissections,
    classCount, pairColorOn, poles,
} from "./dissect.js";
import type { AxisSet, DissectionKind } from "./dissect.js";
import type { Cell } from "./dissect.js";
import type { V3 } from "./solids.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};
const view = el<HTMLDivElement>("view");
const solidSel = el<HTMLSelectElement>("solid");
const explodeInput = el<HTMLInputElement>("explode");
const explodeOut = el<HTMLElement>("explodeOut");
const colorSel = el<HTMLSelectElement>("color");
const showSel = el<HTMLSelectElement>("show");
const faceSel = el<HTMLSelectElement>("facemode");
const edgeSel = el<HTMLSelectElement>("edgemode");
const cageSel = el<HTMLSelectElement>("cagemode");
const flipChk = el<HTMLInputElement>("flip");
const flipLabel = el<HTMLLabelElement>("fliplabel");
const spinChk = el<HTMLInputElement>("spin");
const orthoChk = el<HTMLInputElement>("ortho");
const eyeChk = el<HTMLInputElement>("eyelight");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-rhombohedra";
const PREF_DEFAULTS = { solid: "rt", ortho: false, eyelight: false, explode: 0, color: "five", show: "all", facemode: "solid", edgemode: "edges", cagemode: "cage", flip: false, spin: true };
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1e8);
// Two cameras rather than one, because a projection cannot be changed on a camera that
// already has one. The reader picks between them and the view carries over: same eye
// point, same target, and the orthographic frustum is sized from the distance the
// perspective camera was at, so the solid does not jump size when the box is ticked.
const persp = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
const ortho = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 200);
for (const c of [persp, ortho]) {
    c.position.set(3.4, -4.2, 3.0);
    c.up.set(0, 0, 1);
}
let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = persp;
/** Half the height of the orthographic frustum, in world units. */
let orthoHalf = 1.9;
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

// The two directional lights live in a group, because where that group hangs decides
// something the reader can see. Hung in the scene, the lights stand still in the world
// while the camera walks round: the lit side of the solid stays put in the world and
// slides across the screen, which reads as a viewer circling a statue. Hung on the
// camera, they travel with the eye: the lit side stays where the reader is and the
// faces brighten and dim as they turn through it, which reads as the solid turning.
//
// It matters most where there is least else to go on. A lone golden rhombic hexahedron
// has six faces of the same rhombus and no feature to tell one from another — the
// Necker-cube case — and with the lights standing off in the world it can be read
// inside out. Carried with the eye, the shading says which way is which.
const lamps = new THREE.Group();
const key = new THREE.DirectionalLight(0xffffff, 1.35);
const rim = new THREE.DirectionalLight(0xffffff, 0.32);
lamps.add(key, rim);
// A directional light shines from where it is toward its target, and the target sits at
// the world origin, which is where the solid is and where the controls point. So the
// offsets are directions rather than places, and they need to be different in the two
// modes: in the world they are absolute, on the camera they are right / up / toward the
// viewer.
const LAMPS_WORLD: Array<[number, number, number]> = [[4, -6, 8], [-6, 4, -2]];
const LAMPS_EYE: Array<[number, number, number]> = [[3, 4, 5], [-4, -2, -1]];
scene.add(lamps);
// Both cameras join the scene graph so that whichever one is carrying the lights has
// its children traversed. A camera draws nothing itself, so this costs nothing.
scene.add(persp, ortho);

/** Hang the lights where the reader asked: on the camera, or out in the world. */
function setLighting(): void {
    const eye = eyeChk.checked;
    const offsets = eye ? LAMPS_EYE : LAMPS_WORLD;
    key.position.set(...offsets[0]);
    rim.position.set(...offsets[1]);
    const host: THREE.Object3D = eye ? camera : scene;
    if (lamps.parent !== host) host.add(lamps);
}

const ACUTE = new THREE.Color(0xd98d3a);
const OBTUSE = new THREE.Color(0x4a7fb5);
// twenty hues, so a cell can be followed as it moves out
const WHEEL = Array.from({ length: 20 }, (_, i) => new THREE.Color().setHSL(i / 20, 0.52, 0.55));
// One color per axis, spread over however many the solid has: on four axes the four
// hues are a quarter of the circle apart rather than a sixth, so they stay as far from
// each other as the solid allows. At six axes this is the wheel it always was.
const AXIS_HUES = new Map<number, THREE.Color[]>();
function axisColor(pos: number, k: number): THREE.Color {
    let hues = AXIS_HUES.get(k);
    if (!hues) {
        hues = Array.from({ length: k }, (_, i) => new THREE.Color().setHSL(i / k, 0.5, 0.55));
        AXIS_HUES.set(k, hues);
    }
    return hues[pos];
}
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

/** The solid on show, and its axes. `rt` is six axes, which is how the page opens. */
function chosen(): { key: string; label: string; axes: AxisSet } {
    return SOLIDS.find((s) => s.key === solidSel.value) ?? SOLIDS[0];
}

// Cells and cage, worked out on first sight of each solid and kept. Lazily, rather
// than all at once on load as this used to be: with three solids and two kinds that
// would be six dissections computed before the first frame, five of which the reader
// may never ask for.
const CELLS: Record<string, ReturnType<typeof dissection>> = {};
const CAGES: Record<string, ReturnType<typeof cageFaces>> = {};
const NDISS: Record<string, number> = {};

/** How many dissections the solid has with its position fixed in space. */
function labelledCount(axes: AxisSet, key: string): number {
    if (NDISS[key] === undefined) NDISS[key] = allDissections(axes).length;
    return NDISS[key];
}

/**
 * How far back the camera stands, per unit of the solid's circumradius.
 *
 * Read off the opening view of the triacontahedron — 6.1806 at a circumradius of φ — so
 * that view is exactly what it was and the rest of the family is framed to match it. The
 * family's sizes are not alike: circumradii run 1.6180, 1.4644, 1.3764 and 0.9867, so a
 * frame built for the triacontahedron leaves a lone hexahedron small and far off, which
 * is the one place perspective was doing least work. Fitting brings it in to 3.7690.
 */
const FIT = Math.hypot(3.4, 4.2, 3.0) / ((1 + Math.sqrt(5)) / 2);

/** The furthest any corner of the solid reaches from its center. */
function solidRadius(cells: Cell[]): number {
    let r = 0;
    for (const c of cells) for (const p of c.corners) r = Math.max(r, Math.hypot(p[0], p[1], p[2]));
    return r;
}

/** Which solid the view is currently framed for, so refitting happens on a change
 *  of solid and never underneath a reader who has just zoomed. */
let framedFor = "";

/**
 * Stand the camera back far enough to hold the solid, keeping the direction it is
 * already looking from. Distance only — the reader's chosen angle is theirs.
 */
function frame(radius: number): void {
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (dir.lengthSq() < 1e-12) dir.set(3.4, -4.2, 3.0);
    dir.setLength(radius * FIT);
    camera.position.copy(controls.target).add(dir);
    if (camera === ortho) {
        // An orthographic camera cannot frame by standing back, so its frustum is what
        // has to change: the height the perspective camera would show at that distance.
        orthoHalf = radius * FIT * Math.tan((persp.fov / 2) * (Math.PI / 180));
        ortho.zoom = 1;
        resize();
    }
    controls.update();
}

/** The cells and cage of one solid and kind, worked out once. */
function cellsOf(solid: { key: string; axes: AxisSet }, kind: DissectionKind): Cell[] {
    const ck = `${kind}|${solid.key}`;
    if (!CELLS[ck]) {
        CELLS[ck] = dissection(kind, solid.axes);
        CAGES[ck] = cageFaces(kind, solid.axes);
    }
    return CELLS[ck];
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
const colorOf = (c: Cell, face: number, axes: AxisSet): THREE.Color => {
    if (colorSel.value === "five") return FIVE[faceColor(c, face, axes)];
    if (colorSel.value === "cell") return WHEEL[c.id];
    if (colorSel.value === "axis") return axisColor(axes.indexOf(c.triple[0]), axes.length);
    return c.acute ? ACUTE : OBTUSE;
};
// When there is only one cell the filter is meaningless, and asking for "the ten acute"
// of an oblate hexahedron would empty the view. So a disabled Show means all — which
// also lets the reader's choice survive a trip through the hexahedra and back.
const visible = (c: Cell): boolean =>
    showSel.disabled || showSel.value === "all" || showSel.value === "singularity" ||
    (showSel.value === "acute") === c.acute;

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
    // On the triacontahedron only two dissections exist up to symmetry, and they differ
    // by a single flip inside one Bilinski dodecahedron — four cells and six internal
    // faces, everything else identical. So the choice is a toggle rather than a list.
    // On the smaller solids there is no choice at all: their labelled dissections form
    // a single orbit, so the toggle is disabled rather than offered as a fiction.
    const solid = chosen();
    const hasFlip = solid.axes.length === 6;
    const kind: DissectionKind = hasFlip && flipChk.checked ? "chiral" : "symmetric";
    const cells = cellsOf(solid, kind);
    const cage = CAGES[`${kind}|${solid.key}`];
    // Deleting the poles: a vertex goes, and with it everything that carries it — the
    // five faces and five edges on each, three faces from each of the three cells that
    // reach it. Edges here are drawn as a face's own boundary, and every edge at a pole
    // lies only in faces at that pole, so dropping the faces takes the edges with them
    // and the five-and-five follows rather than being arranged. The cage stays whole.
    const POLE = showSel.value === "singularity" ? poles(solid.axes) : [];
    const atPole = (q: V3): boolean =>
        POLE.some((p) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6 && Math.abs(q[2] - p[2]) < 1e-6);
    let cutFaces = 0;
    if (framedFor !== solid.key) {
        framedFor = solid.key;
        frame(solidRadius(cells));
    }
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
            for (const q of c.corners) {
                if (atPole(q)) continue;
                beads.push([q[0] + o[0], q[1] + o[1], q[2] + o[2]]);
            }
            // the twelve edges: each corner joined to the three that differ in one sign
            for (let b = 0; b < 8; b++) {
                for (let q = 0; q < 3; q++) {
                    const b2 = b | (1 << q);
                    if (b2 === b) continue;
                    const p1 = c.corners[b];
                    const p2 = c.corners[b2];
                    if (atPole(p1) || atPole(p2)) continue;
                    rods.push([
                        [p1[0] + o[0], p1[1] + o[1], p1[2] + o[2]],
                        [p2[0] + o[0], p2[1] + o[1], p2[2] + o[2]],
                    ]);
                }
            }
        }
        c.faces.forEach((f, fi) => {
            if (f.some(atPole)) {
                cutFaces++;
                return;
            }
            const col = colorOf(c, fi, solid.axes);
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
            const col = colorSel.value === "five" ? FIVE[pairColorOn(f.i, f.j, solid.axes)] : CAGE;
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
    const k = solid.axes.length;
    const nClass = classCount(solid.axes);
    // Five is the triacontahedron's number, not the family's: the demand is a proper
    // edge coloring of K_k, and χ′(K_k) is k−1 for even k and k for odd.
    const note = colorSel.value !== "five"
        ? ""
        : ` · Kowalewski ${WORD[nClass] ?? nClass} on K${SUB[k]}` +
          (k === 6
              ? ": every rosette shows all five, opposite faces of each hexahedron agree, each wears three of the five"
              : k === 4
                  ? ": three is all K₄ needs, where restricting the six-axis five would have spent all five"
                  : `: ${WORD[nClass] ?? nClass} is the least K${SUB[k]} admits, and opposite faces still agree`);
    if (cells.length === 1) {
        const only = cells[0];
        statusEl.textContent =
            `one cell — the ${only.acute ? "acute" : "oblate"} golden rhombic hexahedron, volume ` +
            `${only.volume.toFixed(6)}${only.acute ? ", which is φ times the oblate one" : ", and the acute one is φ times it"} · ` +
            `three axes: the two shapes every larger solid in the family is built from, ` +
            `so there is nothing to explode and no cage within${note}`;
        return;
    }
    // Below six axes there is nothing to flip: the labelled dissections are one orbit,
    // and saying so is more use than an inert checkbox.
    const kindNote = !hasFlip
        ? ` · one dissection only — its ${labelledCount(solid.axes, solid.key)} labelled ones are a single orbit under the solid's group of ${groupOrder(solid.axes)}`
        : kind === "symmetric"
            ? " · unflipped — the dissection that keeps a three-fold axis"
            : " · flipped — one Bilinski dodecahedron turned over, and the three-fold axis is gone";
    const vol = solidVolume(solid.axes);
    const volNote = hasFlip
        ? `together 4√(5+2√5) = ${vol.toFixed(6)}, the triacontahedron's own volume`
        : `together ${vol.toFixed(6)}, the solid's own volume — the three stand in the ratio 2 : 5 : 10`;
    const singNote = POLE.length === 0
        ? ""
        : ` · singularity: both poles deleted — ${cutFaces} of the ${6 * cells.length} cell faces gone, ` +
          `three from each of the ${cells.filter((c) => c.faces.some((f) => f.some(atPole))).length} cells that reach a pole, ` +
          `and the rim each leaves is a decagon on ten vertices · the cage is left whole`;
    statusEl.textContent =
        `${shown} of ${cells.length} cells — ${nAcute} acute at 0.760845, ${shown - nAcute} obtuse at 0.470228, ` +
        `in the ratio φ · ${volNote} · ` +
        `explode ${(100 * u).toFixed(0)}%${kindNote}${singNote}${note}`;
}

// The wording the flip control carries when there is something to flip. Taken from the
// page rather than repeated here, so the two cannot drift apart.
const FLIP_TITLE = flipLabel.title;
const WORD: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 10: "ten", 20: "twenty" };
/** Subscript digits, for naming K₆ and its smaller relatives in the status line. */
const SUB = "₀₁₂₃₄₅₆";

/**
 * Make the controls say what the chosen solid actually holds. "All twenty" is true of
 * the triacontahedron alone; on the golden icosahedron it is ten and on the golden
 * dodecahedron four, five and two by type.
 */
function relabel(): void {
    const solid = chosen();
    const cells = cellsOf(solid, "symmetric");
    const nA = cells.filter((c) => c.acute).length;
    const nO = cells.length - nA;
    showSel.options[0].text = `All ${WORD[cells.length] ?? cells.length}`;
    showSel.options[1].text = nA ? `The ${WORD[nA] ?? nA} acute` : "No acute cell";
    showSel.options[2].text = nO ? `The ${WORD[nO] ?? nO} obtuse` : "No obtuse cell";
    // Singularity is offered only where there is a singularity to delete, which is the
    // golden icosahedron alone. A stored choice that no longer applies falls back rather
    // than naming a mode the solid cannot show.
    const singOpt = showSel.options[3];
    const hasPoles = poles(solid.axes).length > 0;
    singOpt.hidden = !hasPoles;
    singOpt.disabled = !hasPoles;
    if (!hasPoles && showSel.value === "singularity") showSel.value = "all";
    // A single cell has nothing to filter and nothing to pull apart: its center is the
    // origin, so the travel it would explode along is zero.
    const single = cells.length === 1;
    showSel.disabled = single;
    explodeInput.disabled = single;
    const hasFlip = solid.axes.length === 6;
    flipChk.disabled = !hasFlip;
    flipLabel.style.opacity = hasFlip ? "" : "0.45";
    flipLabel.title = hasFlip
        ? FLIP_TITLE
        : "Only the triacontahedron has two dissections. On the smaller solids every labelled dissection is the same one differently placed, so there is nothing to flip.";
}

solidSel.value = prefs.solid || PREF_DEFAULTS.solid;
explodeInput.value = String(prefs.explode);
colorSel.value = prefs.color || PREF_DEFAULTS.color;
showSel.value = prefs.show || PREF_DEFAULTS.show;
faceSel.value = prefs.facemode || PREF_DEFAULTS.facemode;
edgeSel.value = prefs.edgemode || PREF_DEFAULTS.edgemode;
cageSel.value = prefs.cagemode || PREF_DEFAULTS.cagemode;
// A select handed a stored value that no option carries reports "" rather than rejecting
// it, so each falls back explicitly.
for (const [sel, def] of [
    [solidSel, PREF_DEFAULTS.solid],
    [colorSel, PREF_DEFAULTS.color], [showSel, PREF_DEFAULTS.show],
    [faceSel, PREF_DEFAULTS.facemode], [edgeSel, PREF_DEFAULTS.edgemode],
    [cageSel, PREF_DEFAULTS.cagemode],
] as Array<[HTMLSelectElement, string]>) if (!sel.value) sel.value = def;
flipChk.checked = prefs.flip;
spinChk.checked = prefs.spin;
orthoChk.checked = prefs.ortho;
eyeChk.checked = prefs.eyelight;
controls.autoRotate = spinChk.checked;
setLighting();

function rebuild(): void {
    relabel();
    explodeOut.textContent = `${(100 * Number(explodeInput.value)).toFixed(0)}%`;
    build();
}
explodeInput.addEventListener("input", rebuild);
for (const c of [solidSel, colorSel, showSel, faceSel, edgeSel, cageSel, flipChk]) c.addEventListener("change", rebuild);

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
orthoChk.addEventListener("change", setProjection);
eyeChk.addEventListener("change", setLighting);

function persist(): void {
    savePrefs(PREFS_KEY, {
        solid: solidSel.value,
        explode: Number(explodeInput.value), color: colorSel.value,
        show: showSel.value, facemode: faceSel.value, edgemode: edgeSel.value,
        cagemode: cageSel.value, flip: flipChk.checked,
        spin: spinChk.checked, ortho: orthoChk.checked, eyelight: eyeChk.checked,
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
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    // An orthographic frustum has no field of view to stretch, so the aspect has to be
    // put into its width by hand or the solid comes out squashed.
    ortho.top = orthoHalf;
    ortho.bottom = -orthoHalf;
    ortho.right = (orthoHalf * w) / h;
    ortho.left = -ortho.right;
    ortho.updateProjectionMatrix();
}

/**
 * Hand the controls whichever camera is wanted, carrying the view across.
 *
 * Going orthographic, the frustum is sized to the perspective camera's apparent height
 * at the target — `distance · tan(fov/2)` — so ticking the box changes the projection
 * and nothing else. Coming back, the eye point is already where the reader left it.
 */
function setProjection(): void {
    const next = orthoChk.checked ? ortho : persp;
    if (next === camera) return;
    if (next === ortho) {
        const d = persp.position.distanceTo(controls.target);
        orthoHalf = d * Math.tan((persp.fov / 2) * (Math.PI / 180));
        ortho.zoom = 1;
    }
    next.position.copy(camera.position);
    next.up.copy(camera.up);
    camera = next;
    if (eyeChk.checked) next.add(lamps);
    // The typings give `object` as a perspective camera, but OrbitControls branches on
    // `isOrthographicCamera` throughout and drives both — so this is the types catching
    // up, not a shortcut past them.
    (controls as unknown as { object: THREE.Camera }).object = next;
    resize();
    controls.update();
}
window.addEventListener("resize", resize);

console.log(`rhombohedra build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}
resize();
// The stored projection has to be applied after the first resize, since going
// orthographic sizes the frustum from where the perspective camera stands.
if (orthoChk.checked) {
    orthoChk.checked = false;
    orthoChk.checked = true;
    setProjection();
}
rebuild();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
