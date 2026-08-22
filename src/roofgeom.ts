// The roof surface as plain numbers — positions, edge segments, contour segments.
//
// No three.js here on purpose. The two 3D pages that draw the roof both need exactly
// this arithmetic, and it is the part where a mistake is invisible until someone
// notices the picture is subtly wrong in a browser. Keeping it free of rendering
// means `tools/roofview-check.mjs` can compare it against a frozen copy of the
// original inline version, in node, without a WebGL context.
//
// Everything here is computed from the patch currently loaded in `geometry.ts`, the
// way `roof3d.ts` has always done it: call `generatePatch()` first.

import {
    allRhombs,
    vertexList,
    vertexMap,
    edgeMap,
    roundKey,
    computeLift,
    pos3D,
} from "./geometry.js";
import type { V3 } from "./geometry.js";

export interface RoofFaceInfo {
    id: number;
    /** the four corner vertex ids */
    vids: number[];
    thick: boolean;
    cluster: string;
    /** the two generators the rhombus is spanned by, ascending. The roof lifts on five
     *  of the six icosahedral axes, so this is a pair of K₆ with the sixth — the
     *  vertical — never used, which is what lets the triacontahedron's five-colouring
     *  be read straight off it. */
    pair: [number, number];
}

export interface RoofData {
    /** lifted corner positions with the flip applied but **not** the vertical scale
     *  and **not** recentered. Raw on purpose: the original multiplied by the scale
     *  at the point of use, and interpolating a contour before scaling rather than
     *  after gives answers that differ in the last bit. Layers should call `point()`
     *  rather than reading this. */
    P: (V3 | null)[];
    /** vertical scale, |vscale| — already folded into `offset` and into `point()` */
    k: number;
    faces: RoofFaceInfo[];
    /** bounding-box center of the surface, the offset every layer must subtract */
    offset: V3;
    /** index range across the whole patch, so shading is absolute rather than
     *  per-tile: a rhombus rising 1→3 must not draw like one rising 2→4 */
    idxLo: number;
    idxHi: number;
    span: number;
    flip: boolean;
    /** height index at a vertex, with the flip already applied */
    indexAt(vid: number): number;
    /** a vertex where it actually belongs in the scene: scaled and recentered. Every
     *  extra layer must go through this, or it lands somewhere else entirely. */
    point(vid: number): V3;
}

/** One triangle corner: which face it belongs to, and which vertex. */
export interface TriRef {
    face: number;
    vid: number;
}

/** Everything that does not depend on the vertical scale, computed once. */
function assemble(
    P: (V3 | null)[],
    faces: RoofFaceInfo[],
    idxLo: number,
    idxHi: number,
    flip: boolean,
    k: number,
): RoofData {
    // Bounding box over every face corner — the same set the mesh measures, so the
    // offset is the number the mesh itself would produce.
    const lo: V3 = [Infinity, Infinity, Infinity];
    const hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (const f of faces) {
        for (const vid of f.vids) {
            const p = P[vid];
            if (!p) continue;
            const z = p[2] * k;
            if (p[0] < lo[0]) lo[0] = p[0];
            if (p[0] > hi[0]) hi[0] = p[0];
            if (p[1] < lo[1]) lo[1] = p[1];
            if (p[1] > hi[1]) hi[1] = p[1];
            if (z < lo[2]) lo[2] = z;
            if (z > hi[2]) hi[2] = z;
        }
    }
    const offset: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];

    return {
        P,
        k,
        faces,
        offset,
        idxLo,
        idxHi,
        span: idxHi - idxLo || 1,
        flip,
        indexAt: (vid: number) =>
            flip ? idxLo + idxHi - vertexList[vid].index : vertexList[vid].index,
        point: (vid: number) => {
            const p = P[vid]!;
            return [p[0] - offset[0], p[1] - offset[1], p[2] * k - offset[2]];
        },
    };
}

/**
 * The same roof at a different vertical scale, without re-lifting it.
 *
 * `computeLift` is the expensive half — 31 ms at 16,475 rhombi — and the scale does
 * not touch it: the lift is the same integer vectors whatever the depth. Only the
 * scale factor and the recentering offset move. That is what makes the flattening
 * animation affordable at every generation the page offers.
 */
export function rescale(d: RoofData, vscale: number): RoofData {
    return assemble(d.P, d.faces, d.idxLo, d.idxHi, d.flip, Math.abs(vscale));
}

/**
 * Lift the current patch. Returns `null` for an empty patch, which is a legitimate
 * answer — the star family emits no rhombs until a generation later — and which the
 * caller must handle rather than framing a zero-radius bounding sphere and poisoning
 * the camera with NaN for the rest of the session.
 */
export function buildRoof(vscale: number, flip: boolean): RoofData | null {
    if (allRhombs.length === 0) return null;

    const lift = computeLift();
    const P: (V3 | null)[] = lift.n.map((nv) => (nv ? pos3D(nv, flip) : null));

    const faces: RoofFaceInfo[] = allRhombs.map((r) => {
        const vids = r.verts.map((pt) => vertexMap.get(roundKey(pt))!.id);
        const n0 = lift.n[vids[0]]!;
        const d1 = lift.n[vids[1]]!.map((x, i) => x - n0[i]);
        const d3 = lift.n[vids[3]]!.map((x, i) => x - n0[i]);
        const a = d1.findIndex((x) => x !== 0);
        const b = d3.findIndex((x) => x !== 0);
        return {
            id: r.id,
            vids,
            thick: r.thick,
            cluster: r.cluster,
            pair: [Math.min(a, b), Math.max(a, b)] as [number, number],
        };
    });

    let idxLo = Infinity;
    let idxHi = -Infinity;
    for (const v of vertexList) {
        if (v.index < idxLo) idxLo = v.index;
        if (v.index > idxHi) idxHi = v.index;
    }

    return assemble(P, faces, idxLo, idxHi, flip, Math.abs(vscale));
}

/**
 * Two triangles per rhombus, non-indexed — so `computeVertexNormals` yields one
 * normal per triangle and the mesh is flat-shaded inherently. Positions are scaled
 * but not recentered; the caller translates the geometry by `-offset`, exactly as
 * the mesh always did.
 */
export function surfacePositions(d: RoofData): { pos: number[]; refs: TriRef[] } {
    const pos: number[] = [];
    const refs: TriRef[] = [];
    for (let fi = 0; fi < d.faces.length; fi++) {
        const v = d.faces[fi].vids;
        for (const vid of [v[0], v[1], v[2], v[0], v[2], v[3]]) {
            const p = d.P[vid]!;
            pos.push(p[0], p[1], p[2] * d.k);
            refs.push({ face: fi, vid });
        }
    }
    return { pos, refs };
}

/** One segment per tiling edge, already recentered, so creases read as creases. */
export function edgeSegments(d: RoofData): number[] {
    const out: number[] = [];
    for (const e of edgeMap.values()) {
        const a = d.P[e.v1];
        const b = d.P[e.v2];
        if (!a || !b) continue;
        out.push(
            a[0] - d.offset[0],
            a[1] - d.offset[1],
            a[2] * d.k - d.offset[2],
            b[0] - d.offset[0],
            b[1] - d.offset[1],
            b[2] * d.k - d.offset[2],
        );
    }
    return out;
}

/**
 * Isoglosses — contour lines, already recentered. Seven per rhombus, dividing the
 * long diagonal into eight, which puts them on quarter-index height steps. The long
 * diagonal runs between the extreme corners and a rhombus has perpendicular
 * diagonals, so a line across it perpendicular to that axis is a level set of height.
 * Heights match along shared edges, so the contours carry on unbroken from tile to
 * tile.
 *
 * The lowest corner is found by search rather than assumed to be a fixed position:
 * anything reading a rhomb's corners must not assume an index, since the unfolder
 * reorders them and the same mistake once made half the tiles render flat.
 */
export function isoglossSegments(d: RoofData): number[] {
    const out: number[] = [];
    const at = (u: number, w: number, s: number): [number, number, number] => {
        const a = d.P[u]!;
        const b = d.P[w]!;
        return [
            a[0] + (b[0] - a[0]) * s - d.offset[0],
            a[1] + (b[1] - a[1]) * s - d.offset[1],
            (a[2] + (b[2] - a[2]) * s) * d.k - d.offset[2],
        ];
    };
    for (const f of d.faces) {
        let k = 0;
        for (let i = 1; i < 4; i++) {
            if (vertexList[f.vids[i]].index < vertexList[f.vids[k]].index) k = i;
        }
        const lo = f.vids[k];
        const r1 = f.vids[(k + 1) % 4];
        const hi = f.vids[(k + 2) % 4];
        const r3 = f.vids[(k + 3) % 4];
        for (let i = 1; i <= 7; i++) {
            const t = i / 8;
            let L: [number, number, number];
            let R: [number, number, number];
            if (t <= 0.5) {
                const s = t * 2;
                L = at(lo, r3, s);
                R = at(lo, r1, s);
            } else {
                const s = (t - 0.5) * 2;
                L = at(r3, hi, s);
                R = at(r1, hi, s);
            }
            out.push(L[0], L[1], L[2], R[0], R[1], R[2]);
        }
    }
    return out;
}
