// Golden rhombi in space, drawn the way the Cage draws them.
//
// Everything on `rhombohedra.html` that is about *looking* rather than about the
// dissection: faces as flat quads or as crossing ribbons, a frame of edges or of ball
// and stick, two cameras for the two projections, and lights that hang either in the
// world or on the eye. The Cage still carries its own copy; this module exists because
// the Exceptional page wants the same language for a different subject, and copying a
// renderer is how two pages come to disagree about what a colour means.
//
// The subject is a bag of **golden rhombi**, each with the two axes it is spanned by.
// That is all the schemes need: `Kowalewski five` colours a face by its axis pair, and
// `bands` colours it by the two ribbons crossing it. Where the rhombi come from — the
// cells of a zonohedron, or a Wieringa roof lifted out of the plane — is not this
// module's business.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { pairColorOn } from "./dissect.js";
import type { AxisSet } from "./dissect.js";
import type { V3 } from "./solids.js";

/**
 * One rhombus to draw.
 *
 * `corners` wound in order, and `dirs` naming the generator each pair of edges runs
 * along: edges 0 and 2 (corner 0→1, 2→3) lie along `dirs[0]`, edges 1 and 3 along
 * `dirs[1]`. Sorting them would lose which is which, and a ribbon cannot be drawn
 * without knowing — the same fact `bandAxes` carries for a cell face.
 */
export interface GoldenFace {
    corners: [V3, V3, V3, V3];
    dirs: [number, number];
}

export type FaceMode = "solid" | "transparent" | "invisible";
export type EdgeMode = "edges" | "ballstick" | "invisible";
export type Scheme = "five" | "bands";

/**
 * A cover over one or more faces.
 *
 * `group` is what the rim is computed per: edges are counted within a group, and an
 * edge belonging to one face of it is a boundary. `edges` decides what is drawn —
 * `rim` the boundary only, which is right for a cap laid over part of a surface, and
 * `all` for a **closed solid**, which has no boundary at all, every edge belonging to
 * two of its faces, so a rim there would come out empty.
 */
export interface Cap {
    color: THREE.Color;
    group: number;
    edges?: "rim" | "all";
    /**
     * Draw the face banded rather than flat, with `color` as its ground and **only the
     * ribbon of this generator** shown. A skewb carries one band: the two rhombi of the
     * ribbon segment take it and the third, which does not run along that generator,
     * stays bare — which is the figure itself, a ribbon with a third rhomb added.
     */
    band?: number;
    /** colour the rim by the generator each edge runs along, rather than one colour */
    rimByBand?: boolean;
}

export interface DrawOptions {
    scheme: Scheme;
    faceMode: FaceMode;
    edgeMode: EdgeMode;
    /** which axes the solid stands on, so the colouring can be minimal on it */
    axes: AxisSet;
    /** ribbon width as a fraction of the face, `bands` only */
    ribbon: number;
    /** paint the part of a face outside its ribbons, `bands` only */
    ground: boolean;
    /** darken a face by this much, 0 to 1 — the caller's own shading, by height or
     *  anything else. One number per face, or omitted for none. */
    shadeOf?: (f: GoldenFace, i: number) => number;
    /**
     * Cover a face rather than draw it: return a colour and the rhombus is painted flat
     * in it with **no edges of its own**, so a run of capped faces reads as one surface
     * and not as the tiling underneath. The boundary of the capped region is then drawn
     * as a `rim` — the edges belonging to exactly one capped face — which is how a
     * singularity shows as a solid covering its own shadow.
     */
    capOf?: (f: GoldenFace, i: number) => Cap | null;
    /** the rim around the capped regions */
    rimColor?: number;
}

// ── the palettes ──────────────────────────────────────────────────

/** The Kowalewski five, at the strengths the three-dimensional pages use. */
export const FIVE = [0xd94f3d, 0xe8a33d, 0x4f9d4a, 0x3d7fc4, 0x9b59b6].map(
    (h) => new THREE.Color(h),
);
/** One per axis for the ribbons: the five, plus a teal for a sixth axis. */
export const BAND = [...FIVE, new THREE.Color(0x2f9e9e)];
/** What a face shows outside its ribbons: the page's own background. */
export const BAND_GROUND = new THREE.Color(0xf4f1e8);

const bandColor = (axis: number, axes: AxisSet): THREE.Color =>
    BAND[axes.indexOf(axis)] ?? BAND_GROUND;

const CROSS = new Map<string, THREE.Color>();
function crossColor(a: THREE.Color, b: THREE.Color): THREE.Color {
    const k = `${a.getHex()},${b.getHex()}`;
    let hit = CROSS.get(k);
    if (!hit) CROSS.set(k, (hit = new THREE.Color((a.r + b.r) / 2, (a.g + b.g) / 2, (a.b + b.b) / 2)));
    return hit;
}

const DARK = new Map<string, THREE.Color>();
function darken(c: THREE.Color, t: number): THREE.Color {
    if (t <= 0.001) return c;
    const k = `${c.getHex()},${Math.round(t * 64)}`;
    let hit = DARK.get(k);
    if (!hit) {
        const f = 1 - 0.55 * t;
        DARK.set(k, (hit = new THREE.Color(c.r * f, c.g * f, c.b * f)));
    }
    return hit;
}

// ── the view ──────────────────────────────────────────────────────

export interface GoldenView {
    scene: THREE.Scene;
    controls: OrbitControls;
    /** the camera in use — swapped by `setProjection`, so read it, do not keep it */
    camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera;
    /** world-fixed lights, or lights carried with the eye */
    setLighting(eye: boolean): void;
    /** perspective, or parallel */
    setProjection(ortho: boolean): void;
    setSpin(on: boolean): void;
    /** stand back far enough to hold a sphere of this radius, keeping the direction */
    frame(radius: number): void;
    /** replace what is drawn */
    draw(faces: GoldenFace[], opts: DrawOptions): void;
    clear(): void;
    resize(): void;
    start(): void;
    /** how many triangles the last draw emitted, for the readout */
    triangles(): number;
}

const FOV = 34;
/** The opening eye point, and the distance the fit factor is read off. */
const EYE: V3 = [3.4, -4.2, 3.0];
const LAMPS_WORLD: V3[] = [[4, -6, 8], [-6, 4, -2]];
const LAMPS_EYE: V3[] = [[3, 4, 5], [-4, -2, -1]];
/** Where a face is cut for its ribbons, in half-edge coordinates. */
const cutsAt = (w: number) => [-1, -w, w, 1];

export function createGoldenView(host: HTMLElement, background = 0xf4f1e8): GoldenView {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);

    // Two cameras, because a projection cannot be changed on a camera that has one.
    const persp = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
    const ortho = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 400);
    for (const c of [persp, ortho]) {
        c.position.set(EYE[0], EYE[1], EYE[2]);
        c.up.set(0, 0, 1);
    }
    let cam: THREE.PerspectiveCamera | THREE.OrthographicCamera = persp;
    let orthoHalf = 1.9;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(persp, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotateSpeed = 1.0;
    controls.addEventListener("start", () => { controls.autoRotate = false; });

    scene.add(new THREE.AmbientLight(0xffffff, 0.68));
    const lamps = new THREE.Group();
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    const rim = new THREE.DirectionalLight(0xffffff, 0.32);
    lamps.add(key, rim);
    scene.add(lamps);
    // Both cameras join the graph so whichever carries the lights has its children
    // traversed. A camera draws nothing itself, so this costs nothing.
    scene.add(persp, ortho);

    let drawn: THREE.Object3D[] = [];
    let edgeMats: LineMaterial[] = [];
    let tris = 0;

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

    function resize(): void {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        for (const m of edgeMats) m.resolution.set(w, h);
        persp.aspect = w / h;
        persp.updateProjectionMatrix();
        // An orthographic frustum has no field of view to stretch, so the aspect has to
        // go into its width by hand or the solid comes out squashed.
        ortho.top = orthoHalf;
        ortho.bottom = -orthoHalf;
        ortho.right = (orthoHalf * w) / h;
        ortho.left = -ortho.right;
        ortho.updateProjectionMatrix();
    }

    function setLighting(eye: boolean): void {
        const offs = eye ? LAMPS_EYE : LAMPS_WORLD;
        key.position.set(offs[0][0], offs[0][1], offs[0][2]);
        rim.position.set(offs[1][0], offs[1][1], offs[1][2]);
        const hostObj: THREE.Object3D = eye ? cam : scene;
        if (lamps.parent !== hostObj) hostObj.add(lamps);
    }

    function setProjection(wantOrtho: boolean): void {
        const next = wantOrtho ? ortho : persp;
        if (next === cam) return;
        if (next === ortho) {
            // size the frustum to the perspective camera's apparent height, so ticking
            // the box changes the projection and nothing else
            const d = persp.position.distanceTo(controls.target);
            orthoHalf = d * Math.tan((FOV / 2) * (Math.PI / 180));
            ortho.zoom = 1;
        }
        next.position.copy(cam.position);
        next.up.copy(cam.up);
        const carried = lamps.parent === cam;
        cam = next;
        if (carried) next.add(lamps);
        // The typings give `object` as a perspective camera; OrbitControls branches on
        // `isOrthographicCamera` throughout and drives both.
        (controls as unknown as { object: THREE.Camera }).object = next;
        resize();
        controls.update();
    }

    /** The distance the camera stands per unit radius, read off the opening view. */
    const FIT = Math.hypot(EYE[0], EYE[1], EYE[2]) / ((1 + Math.sqrt(5)) / 2);

    function frame(radius: number): void {
        const dir = new THREE.Vector3().subVectors(cam.position, controls.target);
        if (dir.lengthSq() < 1e-12) dir.set(EYE[0], EYE[1], EYE[2]);
        dir.setLength(Math.max(radius, 1e-6) * FIT);
        cam.position.copy(controls.target).add(dir);
        if (cam === ortho) {
            orthoHalf = radius * FIT * Math.tan((FOV / 2) * (Math.PI / 180));
            ortho.zoom = 1;
            resize();
        }
        controls.update();
    }

    /**
     * A face painted as its two ribbons crossing.
     *
     * The face is `center + s·u + t·v` over `s,t ∈ [−1,1]`, with `u` along `dirs[0]` and
     * `v` along `dirs[1]`. The ribbon of the first joins the two edges that run along
     * it, which sit at `t = ±1`, so it spans `t` entirely and is narrow in `s`; the
     * other is the same the other way about. Cut both at width `w` and the rhombus falls
     * into nine patches: two per band, one crossing, and four corners of ground — or, if
     * no ground is wanted, four that are not drawn at all.
     */
    function emitBands(
        f: GoldenFace, w: number, ground: THREE.Color | null, shade: number,
        axes: AxisSet, out: number[], cols: number[],
    ): void {
        const cut = cutsAt(w);
        const c = f.corners;
        const ctr = [0, 1, 2].map((d) => (c[0][d] + c[1][d] + c[2][d] + c[3][d]) / 4);
        const u = [0, 1, 2].map((d) => (c[1][d] - c[0][d]) / 2);
        const v = [0, 1, 2].map((d) => (c[3][d] - c[0][d]) / 2);
        const cu = bandColor(f.dirs[0], axes);
        const cv = bandColor(f.dirs[1], axes);
        const at = (s: number, t: number): V3 =>
            [0, 1, 2].map((d) => ctr[d] + s * u[d] + t * v[d]) as V3;
        for (let a = 0; a < 3; a++) {
            for (let b = 0; b < 3; b++) {
                const onU = a === 1, onV = b === 1;
                const col = onU && onV ? crossColor(cu, cv) : onU ? cu : onV ? cv : ground;
                if (!col) continue;
                const s0 = cut[a], s1 = cut[a + 1], t0 = cut[b], t1 = cut[b + 1];
                if (Math.abs(s1 - s0) < 1e-9 || Math.abs(t1 - t0) < 1e-9) continue;
                const q = darken(col, shade);
                const p00 = at(s0, t0), p10 = at(s1, t0), p11 = at(s1, t1), p01 = at(s0, t1);
                for (const p of [p00, p10, p11, p00, p11, p01]) {
                    out.push(p[0], p[1], p[2]);
                    cols.push(q.r, q.g, q.b);
                    tris++;
                }
            }
        }
    }

    function draw(faces: GoldenFace[], o: DrawOptions): void {
        clear();
        tris = 0;
        const bands = o.scheme === "bands";
        const ground = o.ground ? BAND_GROUND : null;

        const pos: number[] = [];
        const cols: number[] = [];
        const seg: number[] = [];
        const segCol: number[] = [];
        const beads: V3[] = [];
        const rods: Array<[V3, V3, number]> = [];
        const seen = new Set<string>();
        const vkey = (p: V3) =>
            `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;

        // edges of capped faces, counted **within each group**, so one count means a
        // boundary of that group and not merely of the capped region as a whole
        const capEdge = new Map<string, {
            a: V3; b: V3; n: number; all: boolean; col: THREE.Color | null;
        }>();

        faces.forEach((f, i) => {
            const shade = o.shadeOf ? o.shadeOf(f, i) : 0;
            const cap = o.capOf ? o.capOf(f, i) : null;
            if (cap) {
                const q = darken(cap.color, shade);
                const c = f.corners;
                if (o.faceMode !== "invisible") {
                    if (cap.band !== undefined && f.dirs.includes(cap.band)) {
                        // one band only: the face is cut across the generator the
                        // ribbon runs on, the rest left as ground
                        const which = f.dirs[0] === cap.band ? 0 : 1;
                        const u = [0, 1, 2].map((dd) => (c[1][dd] - c[0][dd]) / 2);
                        const v = [0, 1, 2].map((dd) => (c[3][dd] - c[0][dd]) / 2);
                        const ctr = [0, 1, 2].map((dd) => (c[0][dd] + c[1][dd] + c[2][dd] + c[3][dd]) / 4);
                        const at = (a: number, b: number): V3 =>
                            [0, 1, 2].map((dd) => ctr[dd] + a * u[dd] + b * v[dd]) as V3;
                        const bc = darken(bandColor(cap.band, o.axes), shade);
                        const cut = cutsAt(o.ribbon);
                        for (let a = 0; a < 3; a++) {
                            const onBand = which === 0 ? a === 1 : a === 1;
                            const col2 = onBand ? bc : q;
                            // the band of dirs[0] is narrow in s; of dirs[1], narrow in t
                            const s0 = which === 0 ? cut[a] : -1, s1 = which === 0 ? cut[a + 1] : 1;
                            const t0 = which === 0 ? -1 : cut[a], t1 = which === 0 ? 1 : cut[a + 1];
                            if (Math.abs(s1 - s0) < 1e-9 || Math.abs(t1 - t0) < 1e-9) continue;
                            for (const pt of [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t0), at(s1, t1), at(s0, t1)]) {
                                pos.push(pt[0], pt[1], pt[2]);
                                cols.push(col2.r, col2.g, col2.b);
                                tris++;
                            }
                        }
                    } else {
                        for (const pt of [c[0], c[1], c[2], c[0], c[2], c[3]]) {
                            pos.push(pt[0], pt[1], pt[2]);
                            cols.push(q.r, q.g, q.b);
                            tris++;
                        }
                    }
                }
                for (let k = 0; k < 4; k++) {
                    const a = c[k], b = c[(k + 1) % 4];
                    const ka = vkey(a), kb = vkey(b);
                    const key = `${cap.group}:${ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`}`;
                    const hit = capEdge.get(key);
                    if (hit) hit.n++;
                    // a rim edge takes the generator it runs along, so it reads
                    // continuous with the ribbons passing it in the field
                    else capEdge.set(key, {
                        a, b, n: 1, all: cap.edges === "all",
                        col: cap.rimByBand ? bandColor(f.dirs[k % 2], o.axes) : null,
                    });
                }
                return;
            }
            const flat = darken(
                bands
                    ? crossColor(bandColor(f.dirs[0], o.axes), bandColor(f.dirs[1], o.axes))
                    : FIVE[pairColorOn(f.dirs[0], f.dirs[1], o.axes)] ?? FIVE[0],
                shade,
            );
            if (o.faceMode !== "invisible") {
                if (bands) emitBands(f, o.ribbon, ground, shade, o.axes, pos, cols);
                else {
                    const c = f.corners;
                    for (const p of [c[0], c[1], c[2], c[0], c[2], c[3]]) {
                        pos.push(p[0], p[1], p[2]);
                        cols.push(flat.r, flat.g, flat.b);
                        tris++;
                    }
                }
            }
            if (o.edgeMode === "edges") {
                for (let k = 0; k < 4; k++) {
                    const a = f.corners[k], b = f.corners[(k + 1) % 4];
                    // Under bands an edge wears its own generator at full strength, that
                    // being the point of the scheme; otherwise it is the face darkened.
                    const e = bands ? bandColor(f.dirs[k % 2], o.axes) : null;
                    const r = e ? e.r : flat.r * 0.35;
                    const g = e ? e.g : flat.g * 0.35;
                    const bl = e ? e.b : flat.b * 0.35;
                    seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
                    segCol.push(r, g, bl, r, g, bl);
                }
            }
            if (o.edgeMode === "ballstick") {
                // Deduplicated, unlike the Cage's: there the cells come apart and each
                // must carry its own beads, but a roof is one surface and coincident
                // beads at a shared corner are simply the same bead drawn five times.
                for (let k = 0; k < 4; k++) {
                    const a = f.corners[k], b = f.corners[(k + 1) % 4];
                    const ka = vkey(a);
                    if (!seen.has(ka)) { seen.add(ka); beads.push(a); }
                    const ke = ka < vkey(b) ? `${ka}|${vkey(b)}` : `${vkey(b)}|${ka}`;
                    if (seen.has(ke)) continue;
                    seen.add(ke);
                    rods.push([a, b, f.dirs[k % 2]]);
                }
            }
        });

        if (pos.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
            g.computeVertexNormals();
            const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.72,
                metalness: 0.02,
                flatShading: true,
                side: THREE.DoubleSide,
                transparent: o.faceMode === "transparent",
                opacity: o.faceMode === "transparent" ? 0.34 : 1,
                depthWrite: o.faceMode !== "transparent",
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
            }));
            scene.add(mesh);
            drawn.push(mesh);
        }

        // The rim: the boundary of the capped region, and nothing inside it.
        const rim: number[] = [];
        const rimCol: number[] = [];
        const plain = new THREE.Color(o.rimColor ?? 0x4a4458);
        for (const { a, b, n, all, col } of capEdge.values()) {
            if (!all && n !== 1) continue;
            rim.push(a[0], a[1], a[2], b[0], b[1], b[2]);
            const c2 = col ?? plain;
            rimCol.push(c2.r, c2.g, c2.b, c2.r, c2.g, c2.b);
        }
        if (rim.length) {
            const rg2 = new LineSegmentsGeometry();
            rg2.setPositions(rim);
            rg2.setColors(rimCol);
            const rm2 = new LineMaterial({
                vertexColors: true, linewidth: 2.6, worldUnits: false, alphaToCoverage: true,
            });
            rm2.resolution.set(host.clientWidth || 1, host.clientHeight || 1);
            edgeMats.push(rm2);
            const rl = new LineSegments2(rg2, rm2);
            rl.renderOrder = 3;
            scene.add(rl);
            drawn.push(rl);
        }

        if (seg.length) {
            const eg = new LineSegmentsGeometry();
            eg.setPositions(seg);
            eg.setColors(segCol);
            const em = new LineMaterial({
                vertexColors: true, linewidth: 1.4, worldUnits: false, alphaToCoverage: true,
            });
            em.resolution.set(host.clientWidth || 1, host.clientHeight || 1);
            edgeMats.push(em);
            const lines = new LineSegments2(eg, em);
            lines.renderOrder = 2;
            scene.add(lines);
            drawn.push(lines);
        }

        if (beads.length) {
            const m4 = new THREE.Matrix4();
            const mat = new THREE.MeshStandardMaterial({
                color: 0xd8dae0, metalness: 0.92, roughness: 0.24,
            });
            const bg = new THREE.SphereGeometry(0.055, 14, 10);
            const bm = new THREE.InstancedMesh(bg, mat, beads.length);
            const v3 = new THREE.Vector3();
            const q0 = new THREE.Quaternion();
            const one = new THREE.Vector3(1, 1, 1);
            beads.forEach((p, i) => {
                v3.set(p[0], p[1], p[2]);
                bm.setMatrixAt(i, m4.compose(v3, q0, one));
            });
            bm.instanceMatrix.needsUpdate = true;
            scene.add(bm);
            drawn.push(bm);

            // Under bands the sticks carry the colours, and a metal at 0.92 would put
            // them into the reflection rather than show them. So they get their own
            // near-dielectric material, white, for the per-instance colour to pass
            // through as itself.
            const rmat = bands
                ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.12 })
                : mat;
            const rg = new THREE.CylinderGeometry(0.022, 0.022, 1, 10, 1);
            const rm = new THREE.InstancedMesh(rg, rmat, rods.length);
            const up = new THREE.Vector3(0, 1, 0);
            const dir = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const pos3 = new THREE.Vector3();
            const scl = new THREE.Vector3();
            rods.forEach(([a, b], i) => {
                dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
                const len = dir.length();
                quat.setFromUnitVectors(up, dir.clone().normalize());
                pos3.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
                scl.set(1, len, 1);
                rm.setMatrixAt(i, m4.compose(pos3, quat, scl));
            });
            rm.instanceMatrix.needsUpdate = true;
            if (bands) {
                rods.forEach(([, , axis], i) => rm.setColorAt(i, bandColor(axis, o.axes)));
                if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
            }
            scene.add(rm);
            drawn.push(rm);
        }
    }

    setLighting(false);

    return {
        scene,
        controls,
        camera: () => cam,
        setLighting,
        setProjection,
        setSpin: (on: boolean) => { controls.autoRotate = on; },
        frame,
        draw,
        clear,
        resize,
        start: () => renderer.setAnimationLoop(() => {
            controls.update();
            renderer.render(scene, cam);
        }),
        triangles: () => tris,
    };
}
