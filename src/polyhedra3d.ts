// The three solids, live: rhombic triacontahedron and the two golden rhombohedra.
//
// Every face of all three is the same golden rhombus, so they get the same
// treatment as the roof — cluster colors, isogloss contours, dark edges — and the
// family resemblance does the explaining.
//
// The triacontahedron is built as a zonohedron on the six icosahedral five-fold
// axes, so its faces come out golden by construction rather than by typed-in
// coordinates. Stood on one of those axes it bands 5 · 5 · 10 · 5 · 5, and that
// cap of five is a Pe5 rosette in all but name, so it takes the blue.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// LineBasicMaterial's linewidth is ignored by WebGL — every edge comes out one
// device pixel, which at devicePixelRatio 2 is half a CSS pixel and reads as thin
// and gray. LineSegments2 draws lines as camera-facing quads, so a width in pixels
// actually means something.
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import {
    triacontahedron,
    rhombohedron,
    faceOutward,
    add,
    sub,
    mul,
    len,
} from "./solids.js";
import type { V3, Face } from "./solids.js";

// The three solids themselves now live in `solids.ts`, so the centers page can draw
// the same triacontahedron in the roof's own frame rather than growing a second
// copy of the zonohedron construction. Everything below is presentation: contours,
// palette, and the viewer.

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
    // guess, the neighboring slices cover the same ground
    return hits.length === 2 ? [hits[0], hits[1]] : null;
}

// Seven lines running PARALLEL TO THE LONG DIAGONAL, which means dividing the
// short one into eight. The equatorial faces stand perfectly vertical, so the
// pole-to-pole slices meet them at the tightest spacing anywhere on the solid and
// read as clutter; lines along the long diagonal give them the grain the rest of
// the surface has.
function perFaceContours(f: Face): Array<[V3, V3]> {
    const d02 = len(sub(f[0], f[2]));
    const d13 = len(sub(f[1], f[3]));
    // divide the SHORT diagonal, so the lines lie along the long one
    const k = d02 >= d13 ? 1 : 0;
    const lo = f[k];
    const r1 = f[(k + 1) % 4];
    const hi = f[(k + 2) % 4];
    const r3 = f[(k + 3) % 4];
    const mix = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));

    const out: Array<[V3, V3]> = [];
    for (let i = 1; i <= 7; i++) {
        const t = i / 8;
        if (t <= 0.5) {
            const u = t * 2;
            out.push([mix(lo, r3, u), mix(lo, r1, u)]);
        } else {
            const u = (t - 0.5) * 2;
            out.push([mix(r3, hi, u), mix(r1, hi, u)]);
        }
    }
    return out;
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
function bandColor(f: Face): THREE.Color {
    const z = f.reduce((s, p) => s + p[2], 0) / 4;
    const a = Math.abs(z);
    if (a > 0.95) return BLUE;
    if (a > 0.4) return YELLOW;
    return ORANGE;
}

// Three faces meet at each apex of a rhombohedron. Blue at the apexes, the accent
// round the waist — yellow for the acute solid, orange for the obtuse, so the two
// stay tellable apart at a glance.
function apexColor(accent: THREE.Color) {
    return (f: Face): THREE.Color => {
        const z = f.reduce((s, p) => s + p[2], 0) / 4;
        return z > 0 ? BLUE : accent;
    };
}

// ── viewer ────────────────────────────────────────────────────────

function makeViewer(
    host: HTMLElement,
    faces: Face[],
    colorOf: (f: Face) => THREE.Color,
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
        const c = colorOf(f);
        for (const q of [f[0], f[1], f[2], f[0], f[2], f[3]]) {
            pos.push(q[0], q[1], q[2]);
            col.push(c.r, c.g, c.b);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const surfaceMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.58,
        metalness: 0.04,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
    });
    scene.add(new THREE.Mesh(geo, surfaceMat));

    // Opaque. Transparency was tried and made the picture busy: the far side's
    // contours showed through and competed with the near ones.

    // every edge is shared by two faces, so draw each once
    const edge: number[] = [];
    const seen = new Set<string>();
    const edgeKey = (a: V3, b: V3) => {
        const r = (p: V3) => p.map((x) => x.toFixed(4)).join(",");
        const ka = r(a);
        const kb = r(b);
        return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    };
    for (const f of faces) {
        for (let i = 0; i < 4; i++) {
            const a = f[i];
            const b = f[(i + 1) % 4];
            const k = edgeKey(a, b);
            if (seen.has(k)) continue;
            seen.add(k);
            edge.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
    }
    const eg = new LineSegmentsGeometry();
    eg.setPositions(edge);
    const edgeMat = new LineMaterial({
        color: 0x23262c,
        linewidth: 2.6, // pixels, and here it is honored
        worldUnits: false,
        alphaToCoverage: true,
    });
    const edges = new LineSegments2(eg, edgeMat);
    edges.renderOrder = 1;
    scene.add(edges);

    // Pole-to-pole latitude slices everywhere except the vertical equatorial band,
    // which takes lines along its long diagonal instead.
    const equator = faces.filter((f) => colorOf(f) === ORANGE);
    const rest = faces.filter((f) => colorOf(f) !== ORANGE);
    const segs = isoglosses(rest).concat(equator.flatMap(perFaceContours));
    const arr: number[] = [];
    for (const [a, b] of segs) arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    const ig = new THREE.BufferGeometry();
    ig.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    const isoLines = new THREE.LineSegments(
        ig,
        new THREE.LineBasicMaterial({
            color: 0x2b2e35,
            transparent: true,
            opacity: 0.5,
        }),
    );
    isoLines.renderOrder = 2;
    scene.add(isoLines);

    // r / sin(halfFov) is the distance at which the bounding sphere exactly fills
    // the frame, so it wants a margin *above* it. The previous /1.35 pulled the
    // camera closer than touching and cropped the solid against its border.
    geo.computeBoundingSphere();
    const r = geo.boundingSphere!.radius;
    const fit = r / Math.sin((camera.fov * Math.PI) / 360);
    camera.position.setLength(fit * 1.18);
    controls.minDistance = fit * 0.6;
    controls.maxDistance = fit * 3;
    controls.update();

    const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        edgeMat.resolution.set(w, h);
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
if (rt) makeViewer(rt, triacontahedron(), bandColor);
if (ac) makeViewer(ac, rhombohedron(true), apexColor(YELLOW));
if (ob) makeViewer(ob, rhombohedron(false), apexColor(ORANGE));
