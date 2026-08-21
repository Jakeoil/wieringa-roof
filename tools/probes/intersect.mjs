// Part 2 — what two triacontahedra share, and whether it is made of whole cells.
//
// RT = {x : |u·x| <= rho} over the fifteen face normals. RT + t is the same with the
// bounds shifted, so the intersection is an intersection of fifteen slabs: a convex
// polytope, centrally symmetric about t/2. Volume by exact vertex enumeration rather
// than by sampling — solve every triple of bounding planes, keep the feasible points,
// and sum the face pyramids.
import { A6, RHO } from "../../dist/centers.js";
import { dissection } from "../../dist/dissect.js";

const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const crs = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const nrm = (a) => { const L = Math.hypot(...a); return a.map((x) => x / L); };

const U = [];
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) U.push(nrm(crs(A6[i], A6[j])));

/** Volume of {x : lo_k <= u_k.x <= hi_k}. */
function slabVolume(lo, hi) {
    const planes = [];
    U.forEach((u, k) => {
        planes.push({ n: u, d: hi[k] });
        planes.push({ n: u.map((x) => -x), d: -lo[k] });
    });
    const feas = (p) => U.every((u, k) => {
        const v = dot(u, p);
        return v >= lo[k] - 1e-9 && v <= hi[k] + 1e-9;
    });
    const verts = [];
    const seen = new Set();
    for (let a = 0; a < planes.length; a++)
    for (let b = a + 1; b < planes.length; b++)
    for (let c = b + 1; c < planes.length; c++) {
        const A = planes[a], B = planes[b], C = planes[c];
        const det = dot(A.n, crs(B.n, C.n));
        if (Math.abs(det) < 1e-9) continue;
        const bc = crs(B.n, C.n), ca = crs(C.n, A.n), ab = crs(A.n, B.n);
        const p = [0, 1, 2].map((i) => (A.d*bc[i] + B.d*ca[i] + C.d*ab[i]) / det);
        if (!feas(p)) continue;
        const k = p.map((x) => Math.round(x * 1e7)).join(",");
        if (seen.has(k)) continue;
        seen.add(k);
        verts.push(p);
    }
    if (verts.length < 4) return { vol: 0, verts: 0 };
    let vol = 0;
    for (const pl of planes) {
        const on = verts.filter((v) => Math.abs(dot(pl.n, v) - pl.d) < 1e-7);
        if (on.length < 3) continue;
        const ctr = [0, 1, 2].map((i) => on.reduce((s, v) => s + v[i], 0) / on.length);
        const e1 = nrm(sub(on[0], ctr));
        const e2 = crs(pl.n, e1);
        const ang = (p) => Math.atan2(dot(sub(p, ctr), e2), dot(sub(p, ctr), e1));
        const ord = [...on].sort((p, q) => ang(p) - ang(q));
        let area = 0;
        for (let i = 0; i < ord.length; i++) {
            const p1 = sub(ord[i], ctr), p2 = sub(ord[(i + 1) % ord.length], ctr);
            area += Math.abs(dot(pl.n, crs(p1, p2))) / 2;
        }
        vol += (pl.d * area) / 3;
    }
    // Face census: a zonohedron's faces are all centrally symmetric, and here that
    // means every one is a parallelogram. Anything else says the region is not a
    // zonohedron, however tidy its volume looks.
    const faces = [];
    for (const pl of planes) {
        const on = verts.filter((v) => Math.abs(dot(pl.n, v) - pl.d) < 1e-7);
        if (on.length >= 3) faces.push(on.length);
    }
    const shape = {};
    for (const n of faces) shape[n] = (shape[n] ?? 0) + 1;
    return { vol, verts: verts.length, faces: faces.length, shape };
}

const zvol = (idx) => {
    let v = 0;
    for (let i = 0; i < idx.length; i++)
    for (let j = i + 1; j < idx.length; j++)
    for (let k = j + 1; k < idx.length; k++)
        v += Math.abs(dot(A6[idx[i]], crs(A6[idx[j]], A6[idx[k]])));
    return v;
};
const RTV = zvol([0, 1, 2, 3, 4, 5]);
const NAMES = [
    ["triacontahedron", RTV],
    ["rhombic icosahedron", zvol([0, 1, 2, 3, 4])],
    ["Bilinski dodecahedron", zvol([0, 1, 2, 3])],
];
const ACUTE = 0.7608452130, OBTUSE = 0.4702282018;

const OFFS = [
    ["one axis  a_i", A6[0]],
    ["short diagonal a_i-a_j", sub(A6[0], A6[1])],
    ["long diagonal  a_i+a_j", A6[0].map((x, q) => x + A6[1][q])],
    ["face contact 2rho*n", nrm(crs(A6[0], A6[1])).map((x) => x * 2 * RHO)],
];

console.log("offset                     |t|     shared volume     share   identified");
console.log("-".repeat(94));
const results = [];
for (const [name, t] of OFFS) {
    const lo = U.map((u) => Math.max(-RHO, dot(u, t) - RHO));
    const hi = U.map((u) => Math.min(RHO, dot(u, t) + RHO));
    if (U.some((u, k) => lo[k] > hi[k] + 1e-12)) {
        console.log(`${name.padEnd(24)} ${Math.hypot(...t).toFixed(4)}   ${"0".padStart(12)}    0.00%   they do not overlap`);
        continue;
    }
    const { vol, verts, faces, shape } = slabVolume(lo, hi);
    let id = "";
    for (const [nm, v] of NAMES) if (Math.abs(vol - v) < 1e-6) id = nm;
    if (!id) {
        for (let na = 0; na <= 20 && !id; na++)
            for (let no = 0; no <= 20; no++)
                if (Math.abs(vol - (na * ACUTE + no * OBTUSE)) < 1e-6) { id = `${na} acute + ${no} obtuse`; break; }
    }
    console.log(`${name.padEnd(24)} ${Math.hypot(...t).toFixed(4)}   ${vol.toFixed(6).padStart(12)}   ${(100*vol/RTV).toFixed(2).padStart(6)}%   ${id || "not a whole number of cells"}   (${verts} vertices, ${faces} faces ${JSON.stringify(shape)})`);
    if (vol > 0) results.push({ name, t, vol });
}

// Note on the face-contact row below: the region has zero volume, so "split" there
// counts cells merely touching the shared face, not cells genuinely cut.
console.log("\nIs the shared region a union of whole cells of a dissection?");
const inRegion = (p, t) => U.every((u) => {
    const v = dot(u, p), w = dot(u, sub(p, t));
    return Math.abs(v) <= RHO + 1e-9 && Math.abs(w) <= RHO + 1e-9;
});
for (const kind of ["symmetric", "chiral"]) {
    const cells = dissection(kind);
    for (const { name, t } of results) {
        let inside = 0, outside = 0, split = 0;
        for (const c of cells) {
            let anyIn = false, anyOut = false;
            for (let a = 0; a <= 6 && !(anyIn && anyOut); a++)
            for (let b = 0; b <= 6 && !(anyIn && anyOut); b++)
            for (let d = 0; d <= 6 && !(anyIn && anyOut); d++) {
                const s = [a, b, d].map((x) => (x / 6) * 2 - 1);
                const p = [0, 1, 2].map((i) => c.center[i] + s[0]*c.e[0][i] + s[1]*c.e[1][i] + s[2]*c.e[2][i]);
                if (inRegion(p, t)) anyIn = true; else anyOut = true;
            }
            if (anyIn && anyOut) split++; else if (anyIn) inside++; else outside++;
        }
        console.log(`  ${kind.padEnd(10)} ${name.padEnd(24)} in ${String(inside).padStart(2)}, out ${String(outside).padStart(2)}, split ${String(split).padStart(2)}` +
            (split === 0 ? "   <- a union of whole cells" : ""));
    }
}
