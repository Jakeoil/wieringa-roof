// The golden zonohedra, as geometry rather than as coordinates.
//
// A zonohedron on a set of unit generators has one pair of faces per pair of
// generators, so six axes give the thirty-face rhombic triacontahedron, five give the
// rhombic icosahedron, three give a rhombohedron. When the generators are icosahedral
// five-fold axes — every pairwise dot product ±1/√5 — every face comes out the same
// golden rhombus by construction, rather than by being typed in.
//
// Lifted out of `polyhedra3d.ts`, which had the triacontahedron to itself, because
// the centers page needs the same solid drawn in the roof's own frame. A third copy
// of a zonohedron construction is how three copies drift apart.

export type V3 = [number, number, number];
export type Face = V3[];

export const PHI = (1 + Math.sqrt(5)) / 2;

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / len(a));

/**
 * Faces of the zonohedron on `gens`, centered on the origin.
 *
 * One face per (pair of generators × sign). The face for `{i,j}` sits at
 * `½ Σ_{m ∉ {i,j}} sign(n·g_m) g_m` and is spanned by `g_i` and `g_j`, which is the
 * standard support-function construction — maximize `n·x` over the zonotope and the
 * two generators perpendicular to `n` are left free.
 */
export function zonohedron(gens: V3[]): Face[] {
    const faces: Face[] = [];
    for (let i = 0; i < gens.length; i++) {
        for (let j = i + 1; j < gens.length; j++) {
            for (const flip of [1, -1]) {
                const n = mul(cross(gens[i], gens[j]), flip);
                let base: V3 = [0, 0, 0];
                for (let m = 0; m < gens.length; m++) {
                    if (m === i || m === j) continue;
                    base = add(base, mul(gens[m], Math.sign(dot(n, gens[m])) / 2));
                }
                const a = mul(gens[i], 0.5);
                const b = mul(gens[j], 0.5);
                faces.push([
                    sub(sub(base, a), b),
                    add(sub(base, b), a),
                    add(add(base, a), b),
                    sub(add(base, b), a),
                ]);
            }
        }
    }
    return faces;
}

/** The six icosahedral five-fold axes, in the orientation `polyhedra.html` uses. */
export const ICOSA_AXES: V3[] = (
    [
        [0, 1, PHI],
        [0, -1, PHI],
        [1, PHI, 0],
        [-1, PHI, 0],
        [PHI, 0, 1],
        [PHI, 0, -1],
    ] as V3[]
).map(norm);

/**
 * Rhombic triacontahedron of unit edge, stood on a five-fold axis so the banding is
 * horizontal: five faces at each pole, five in each temperate band, ten round the
 * equator.
 */
export function triacontahedron(): Face[] {
    const g = ICOSA_AXES;
    const axis = g[0];
    const v = cross(axis, [0, 0, 1]);
    const c = dot(axis, [0, 0, 1]);
    const k = 1 / (1 + c);
    const spin = (p: V3): V3 =>
        add(add(mul(p, c), cross(v, p)), mul(v, dot(v, p) * k));
    return zonohedron(g).map((f) => f.map(spin));
}

/** Acute (prolate) or obtuse (oblate) golden rhombohedron of unit edge, centered. */
export function rhombohedron(acute: boolean): Face[] {
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

/**
 * Wind a face outward.
 *
 * All these solids are convex and centered on the origin, so a face is wound outward
 * exactly when its normal agrees with its own centroid. The zonohedron construction
 * flips the normal for each ± pair, which leaves half the faces wound inward; those
 * get culled outright by a FrontSide material and their flat-shaded normals point
 * into the solid regardless. Fixed once here rather than papered over with DoubleSide.
 */
export function faceOutward(f: Face): Face {
    const n = cross(sub(f[1], f[0]), sub(f[3], f[0]));
    const c = mul(
        f.reduce((a, p) => add(a, p), [0, 0, 0] as V3),
        1 / 4,
    );
    return dot(n, c) >= 0 ? f : [f[0], f[3], f[2], f[1]];
}
