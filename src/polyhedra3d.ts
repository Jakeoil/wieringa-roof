// The three solids, live: rhombic triacontahedron and the two golden rhombohedra.
//
// Every face of all three is the same golden rhombus, so they get the same
// treatment as the roof — cluster colours, isogloss contours, dark edges — and the
// family resemblance does the explaining.
//
// The triacontahedron is built as a zonohedron on the six icosahedral five-fold
// axes, so its faces come out golden by construction rather than by typed-in
// coordinates. Stood on one of those axes it bands 5 · 5 · 10 · 5 · 5, and that
// cap of five is a Pe5 rosette in all but name, so it takes the blue.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type V3 = [number, number, number];
type Face = V3[];

const PHI = (1 + Math.sqrt(5)) / 2;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / len(a));

// ── the solids ────────────────────────────────────────────────────

function triacontahedron(): Face[] {
    const g: V3[] = (
        [
            [0, 1, PHI],
            [0, -1, PHI],
            [1, PHI, 0],
            [-1, PHI, 0],
            [PHI, 0, 1],
            [PHI, 0, -1],
        ] as V3[]
    ).map(norm);

    // stand it on a five-fold axis so the banding is horizontal
    const axis = g[0];
    const v = cross(axis, [0, 0, 1]);
    const c = dot(axis, [0, 0, 1]);
    const k = 1 / (1 + c);
    const spin = (p: V3): V3 =>
        add(add(mul(p, c), cross(v, p)), mul(v, dot(v, p) * k));

    const faces: Face[] = [];
    for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
            for (const flip of [1, -1]) {
                const n = mul(cross(g[i], g[j]), flip);
                let base: V3 = [0, 0, 0];
                for (let m = 0; m < 6; m++) {
                    if (m === i || m === j) continue;
                    base = add(base, mul(g[m], Math.sign(dot(n, g[m])) / 2));
                }
                const a = mul(g[i], 0.5);
                const b = mul(g[j], 0.5);
                faces.push(
                    [
                        sub(sub(base, a), b),
                        add(sub(base, b), a),
                        add(add(base, a), b),
                        sub(add(base, b), a),
                    ].map(spin),
                );
            }
        }
    }
    return faces;
}

function rhombohedron(acute: boolean): Face[] {
    const d = acute ? 1 / Math.sqrt(5) : -1 / Math.sqrt(5);
    const cosA = Math.sqrt((d + 0.5) / 1.5);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const v: V3[] = [0, 1, 2].map((i) => {
        const t = (2 * Math.PI * i) / 3;
        return [sinA * Math.cos(t), sinA * Math.sin(t), cosA] as V3;
    });
    const faces: Face[] = [];
    for (let k = 0; k < 3; k++) {
        const a = v[k];
        const b = v[(k + 1) % 3];
        const c = v[(k + 2) % 3];
        for (const off of [[0, 0, 0] as V3, c]) {
            faces.push([off, add(off, a), add(add(off, a), b), add(off, b)]);
        }
    }
    const mid = mul(add(add(v[0], v[1]), v[2]), 0.5);
    return faces.map((f) => f.map((q) => sub(q, mid)));
}

// All three solids are convex and centred on the origin, so a face is wound
// outward exactly when its normal agrees with its own centroid. The zonohedron
// construction flips the normal for each ± pair, leaving half the triacontahedron
// wound inward: those faces were being culled outright by a FrontSide material,
// and their flat-shaded normals pointed into the solid regardless. Fix it once
// here rather than papering over it with DoubleSide.
function faceOutward(f: Face): Face {
    const n = cross(sub(f[1], f[0]), sub(f[3], f[0]));
    const c = mul(f.reduce((a, p) => add(a, p), [0, 0, 0] as V3), 1 / 4);
    return dot(n, c) >= 0 ? f : [f[0], f[3], f[2], f[1]];
}

// ── isoglosses ────────────────────────────────────────────────────
//
// Level sets of height, sliced from north pole to south — the same idea as on the
// roof, where the contours are lines of constant height that run on unbroken from
// tile to tile. Here that makes them lines of latitude, continuous rings round the
// solid, rather than seven marks confined to each face.
//
// Fixed slice spacing, so a slice means the same thickness on all three solids and
// the flat obtuse rhombohedron honestly gets fewer of them than the tall acute one.
const SLICE = 0.1;

function contourSegment(f: Face, z: number): [V3, V3] | null {
    const hits: V3[] = [];
    for (let i = 0; i < 4; i++) {
        const a = f[i];
        const b = f[(i + 1) % 4];
        const da = a[2] - z;
        const db = b[2] - z;
        if ((da <= 0 && db > 0) || (db <= 0 && da > 0)) {
            const t = da / (da - db);
            hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z]);
        }
    }
    // a plane through a vertex can give one or three; skip those rather than
    // guess, the neighbouring slices cover the same ground
    return hits.length === 2 ? [hits[0], hits[1]] : null;
}

function isoglosses(faces: Face[]): Array<[V3, V3]> {
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const f of faces)
        for (const p of f) {
            if (p[2] < zMin) zMin = p[2];
            if (p[2] > zMax) zMax = p[2];
        }
    const out: Array<[V3, V3]> = [];
    // start half a step in, so slices rarely land exactly on a vertex
    for (let z = zMin + SLICE / 2; z < zMax; z += SLICE) {
        for (const f of faces) {
            const seg = contourSegment(f, z);
            if (seg) out.push(seg);
        }
    }
    return out;
}

// ── palette ───────────────────────────────────────────────────────

const BLUE = new THREE.Color("#9292e3");
const YELLOW = new THREE.Color("#e6e68e");
const ORANGE = new THREE.Color("#eec09b");

// Standing on a five-fold axis the thirty faces band 5 · 5 · 10 · 5 · 5. The caps
// of five are Pe5 rosettes, so they take the blue; the rings take yellow and the
// equator orange, mirrored top and bottom.
function bandColour(f: Face): THREE.Color {
    const z = f.reduce((s, p) => s + p[2], 0) / 4;
    const a = Math.abs(z);
    if (a > 0.95) return BLUE;
    if (a > 0.4) return YELLOW;
    return ORANGE;
}

// Three faces meet at each apex of a rhombohedron. Blue at the apexes, the accent
// round the waist — yellow for the acute solid, orange for the obtuse, so the two
// stay tellable apart at a glance.
function apexColour(accent: THREE.Color) {
    return (f: Face): THREE.Color => {
        const z = f.reduce((s, p) => s + p[2], 0) / 4;
        return z > 0 ? BLUE : accent;
    };
}

// ── viewer ────────────────────────────────────────────────────────

function makeViewer(
    host: HTMLElement,
    faces: Face[],
    colourOf: (f: Face) => THREE.Color,
): void {
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(2.4, -3.0, 2.2);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.1;
    // a globe you have taken hold of should stop turning by itself
    controls.addEventListener("start", () => {
        controls.autoRotate = false;
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, -4, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(-5, 3, -2);
    scene.add(rim);

    faces = faces.map(faceOutward);

    const pos: number[] = [];
    const col: number[] = [];
    for (const f of faces) {
        const c = colourOf(f);
        for (const q of [f[0], f[1], f[2], f[0], f[2], f[3]]) {
            pos.push(q[0], q[1], q[2]);
            col.push(c.r, c.g, c.b);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    scene.add(
        new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.58,
                metalness: 0.04,
                flatShading: true,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
            }),
        ),
    );

    const edge: number[] = [];
    for (const f of faces) {
        for (let i = 0; i < 4; i++) {
            const a = f[i];
            const b = f[(i + 1) % 4];
            edge.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.Float32BufferAttribute(edge, 3));
    scene.add(
        new THREE.LineSegments(
            eg,
            new THREE.LineBasicMaterial({ color: 0x23262c }),
        ),
    );

    const iso: number[] = [];
    for (const [a, b] of isoglosses(faces)) {
        iso.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    const ig = new THREE.BufferGeometry();
    ig.setAttribute("position", new THREE.Float32BufferAttribute(iso, 3));
    scene.add(
        new THREE.LineSegments(
            ig,
            new THREE.LineBasicMaterial({
                color: 0x2b2e35,
                transparent: true,
                opacity: 0.5,
            }),
        ),
    );

    geo.computeBoundingSphere();
    const r = geo.boundingSphere!.radius;
    camera.position.setLength(r / Math.sin((camera.fov * Math.PI) / 360) / 1.35);
    controls.update();

    const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    resize();

    renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
    });
}

const rt = document.getElementById("v-rt");
const ac = document.getElementById("v-acute");
const ob = document.getElementById("v-obtuse");
if (rt) makeViewer(rt, triacontahedron(), bandColour);
if (ac) makeViewer(ac, rhombohedron(true), apexColour(YELLOW));
if (ob) makeViewer(ob, rhombohedron(false), apexColour(ORANGE));
