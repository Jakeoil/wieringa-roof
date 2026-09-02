// The three.js half of a roof page: scene, lights, camera framing, and the meshes
// built from `roofgeom.ts`.
//
// Two pages draw the roof — the 3D prototype and the centers page — and they differ
// only in what they add on top of it and which controls they offer. Everything they
// share lives here, so the empty-patch camera guard, the absolute shading ramp and
// the polygon-offset that keeps the edge overlay out of z-fighting exist once rather
// than twice. The geometry itself is deliberately elsewhere and free of three.js, so
// it can be checked in node: see `tools/roofview-check.mjs`.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
    surfacePositions,
    edgeSegments,
    isoglossSegments,
} from "./roofgeom.js";
import type { RoofData, RoofFaceInfo } from "./roofgeom.js";
import { tileFill, PLAIN_FILL } from "./geometry.js";

// ── palettes ──────────────────────────────────────────────────────
//
// **Not restated at all, now.** This held six tables derived from the flat ones — the
// groups, the classic and plate palettes, the five, the height ramp, thick and thin —
// each a `THREE.Color` copy kept in step by construction. `tileFill` already answers
// the whole question, so the tables are gone and this asks it, memoizing the conversion
// from hex. A palette is a presentation decision made after the geometry, and it should
// live in one table that everything reads rather than in a copy per renderer.

export const PLAIN_COLOR = Number.parseInt(PLAIN_FILL.slice(1), 16);

const FALLBACK = new THREE.Color(PLAIN_FILL);
const cache = new Map<string, THREE.Color>();
const colorOf = (hex: string): THREE.Color => {
    let c = cache.get(hex);
    if (!c) cache.set(hex, (c = new THREE.Color(hex)));
    return c;
};

export interface FillInfo {
    /** which pentagon group the rhomb came from: Pe5 star, Pe3 boat, Pe1 diamond */
    group: string;
    thick: boolean;
    pair: readonly [number, number];
}

/**
 * One rhomb's color under one scheme — the same answer `tileFill` gives on paper,
 * because it is that answer.
 *
 * A page with schemes of its own — Centers colors by solid and by class — handles
 * those first and calls this for the rest, so the shared names cannot drift apart
 * while the local ones stay local.
 */
export function roofFill(
    scheme: string,
    palette: string,
    f: FillInfo,
    markThin = false,
): THREE.Color {
    return colorOf(tileFill(scheme, palette, markThin, f.group, f.thick, f.pair));
}

const WHITE = new THREE.Color(0xffffff);
const BLACK = new THREE.Color(0x000000);

/**
 * The height ramp: high lighter, low darker.
 *
 * `t` runs −1 at the lowest vertex to +1 at the highest, so the middle of the range
 * keeps its own color and only the extremes move. The ramp is absolute across the
 * patch's whole index range rather than normalized per tile — otherwise a rhombus
 * rising 1→3 draws identically to one rising 2→4, and the shading says only which way
 * a face tilts, never how high it sits.
 */
export function shadeColor(c: THREE.Color, t: number, amount: number): THREE.Color {
    if (amount <= 0) return c;
    return c.clone().lerp(t >= 0 ? WHITE : BLACK, amount * Math.abs(t) * 0.55);
}

/** `t` for a vertex: −1 at the bottom of the patch, +1 at the top. */
export function shadeT(d: RoofData, vid: number): number {
    return ((d.indexAt(vid) - d.idxLo) / d.span - 0.5) * 2;
}

// ── the view ──────────────────────────────────────────────────────

export interface DrawOptions {
    colorOf(face: RoofFaceInfo, vid: number): THREE.Color;
    /** strength of the height ramp, 0 for none */
    shade: number;
    /** false only when a flat single color is wanted and nothing is shading it */
    useVertexColors: boolean;
    flatColor: number;
    transparent: boolean;
    edges: boolean;
    isoglosses: boolean;
    /** draw only the overlays — the centers page can hide the surface and leave the
     *  creases and contours standing, which is how the solids under it become visible */
    skipSurface?: boolean;
}

export interface RoofView {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    /** remove and dispose everything drawn since the last clear */
    clear(): void;
    /** add a layer that lives until the next clear */
    add(obj: THREE.Object3D): void;
    /** the roof surface, its edge overlay and its contours */
    drawRoof(d: RoofData, opts: DrawOptions): void;
    /** bounding-sphere radius of the last roof drawn, for framing */
    roofRadius(): number;
    /** the surface mesh of the last roof drawn, for picking. Non-indexed and two
     *  triangles per rhombus, so a raycast's `faceIndex >> 1` is the face's position
     *  in `RoofData.faces`. */
    surface(): THREE.Mesh | null;
    /** pull the camera back far enough to hold a sphere of this radius */
    frame(radius: number): void;
    resize(): void;
    start(): void;
}

export function createRoofView(host: HTMLElement, background = 0xf4f4f7): RoofView {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
    camera.position.set(9, -11, 9);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

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

    let drawn: THREE.Object3D[] = [];
    let radius = 0;
    let surfaceMesh: THREE.Mesh | null = null;

    const disposeOne = (obj: THREE.Object3D) => {
        const any = obj as THREE.Mesh | THREE.LineSegments;
        if (any.geometry) any.geometry.dispose();
        const m = (any as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m) (m as THREE.Material).dispose();
    };

    const view: RoofView = {
        scene,
        camera,
        renderer,
        controls,

        clear() {
            for (const obj of drawn) {
                scene.remove(obj);
                disposeOne(obj);
                obj.traverse((child) => {
                    if (child !== obj) disposeOne(child);
                });
            }
            drawn = [];
            surfaceMesh = null;
        },

        add(obj) {
            scene.add(obj);
            drawn.push(obj);
        },

        drawRoof(d, opts) {
            const { pos, refs } = surfacePositions(d);
            const col: number[] = [];
            for (const r of refs) {
                const c = shadeColor(
                    opts.colorOf(d.faces[r.face], r.vid),
                    shadeT(d, r.vid),
                    opts.shade,
                );
                col.push(c.r, c.g, c.b);
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
            geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
            geo.computeVertexNormals();
            geo.translate(-d.offset[0], -d.offset[1], -d.offset[2]);

            const mat = new THREE.MeshStandardMaterial({
                vertexColors: opts.useVertexColors,
                color: opts.useVertexColors ? 0xffffff : opts.flatColor,
                roughness: 0.62,
                metalness: 0.04,
                transparent: opts.transparent,
                opacity: opts.transparent ? 0.5 : 1,
                depthWrite: !opts.transparent,
                // The mesh is non-indexed, so computeVertexNormals already yields one
                // normal per triangle — it is flat-shaded inherently and a smooth/flat
                // toggle would do nothing. polygonOffset pushes the faces back so the
                // edge overlay, which is exactly coplanar with them, stops z-fighting.
                flatShading: true,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: 1,
                polygonOffsetUnits: 1,
            });
            surfaceMesh = new THREE.Mesh(geo, mat);
            if (opts.skipSurface) {
                // still built, so picking and framing keep working with nothing drawn
                surfaceMesh.visible = false;
            }
            view.add(surfaceMesh);

            geo.computeBoundingSphere();
            radius = geo.boundingSphere!.radius;

            if (opts.edges) {
                const lg = new THREE.BufferGeometry();
                lg.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute(edgeSegments(d), 3),
                );
                view.add(
                    new THREE.LineSegments(
                        lg,
                        new THREE.LineBasicMaterial({ color: 0x2b2e35 }),
                    ),
                );
            }

            if (opts.isoglosses) {
                const ig = new THREE.BufferGeometry();
                ig.setAttribute(
                    "position",
                    new THREE.Float32BufferAttribute(isoglossSegments(d), 3),
                );
                view.add(
                    new THREE.LineSegments(
                        ig,
                        new THREE.LineBasicMaterial({
                            color: 0x1d2026,
                            transparent: true,
                            opacity: 0.65,
                        }),
                    ),
                );
            }
        },

        roofRadius: () => radius,

        surface: () => surfaceMesh,

        frame(r) {
            if (!(r > 0)) return; // an empty patch must not normalize a zero vector
            controls.target.set(0, 0, 0);
            const dist = r / Math.sin((camera.fov * Math.PI) / 360) / 1.25;
            camera.position.normalize().multiplyScalar(dist);
            controls.update();
        },

        resize() {
            const w = host.clientWidth;
            const h = host.clientHeight;
            renderer.setSize(w, h, false);
            camera.aspect = w / Math.max(1, h);
            camera.updateProjectionMatrix();
        },

        start() {
            renderer.setAnimationLoop(() => {
                controls.update();
                renderer.render(scene, camera);
            });
        },
    };

    return view;
}
