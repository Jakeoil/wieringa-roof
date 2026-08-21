// Every radius at which the normals concur, found without assuming any of them, then
// the group size each one actually supports.
import { seedTypes, generatePatch, allRhombs, vertexMap, roundKey, computeLift, pos3D } from "../../dist/geometry.js";
const S5 = Math.sqrt(5), PHI = (1 + S5) / 2, RHO = Math.sqrt(1 + 2 / S5);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));

const q = console.log; console.log = () => {};
generatePatch(seedTypes.findIndex((s) => s.label === "Sun"), true, 3);
const lift = computeLift(); console.log = q;
const P = lift.n.map((nv) => (nv ? pos3D(nv) : null));
const F = allRhombs.map((r) => {
    const vid = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
    const qv = vid.map((v) => P[v]);
    let u = nrm(crs(sub(qv[1], qv[0]), sub(qv[3], qv[0])));
    if (u[2] < 0) u = mul(u, -1);
    return { u, c: mul(qv.reduce((a,b)=>add(a,b), [0,0,0]), 1/4), thick: r.thick };
});

// all equal-radius concurrences, rho not assumed
const radii = new Map();
for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    const A = F[i], B = F[j];
    const w0 = sub(A.c, B.c), b = dot(A.u, B.u);
    const den = 1 - b * b; if (Math.abs(den) < 1e-12) continue;
    const d = dot(A.u, w0), e = dot(B.u, w0);
    const t = (b * e - d) / den, s = (e - b * d) / den;
    const miss = Math.hypot(...sub(add(A.c, mul(A.u, t)), add(B.c, mul(B.u, s))));
    if (miss > 1e-9) continue;
    if (Math.abs(Math.abs(t) - Math.abs(s)) > 1e-9) continue;
    const key = Math.abs(t).toFixed(6);
    radii.set(key, (radii.get(key) ?? 0) + 1);
}
// group size supported by each radius
const rows = [];
for (const [rs, pairs] of radii) {
    const R = Number(rs);
    const g = new Map();
    for (const f of F) for (const s of [1, -1]) {
        const c = add(f.c, mul(f.u, s * R));
        const k = c.map((x) => Math.round(x * 1e6)).join(",");
        if (!g.has(k)) g.set(k, []); g.get(k).push(f);
    }
    const sizes = [...g.values()].map((v) => v.length);
    const max = Math.max(...sizes);
    const nMax = sizes.filter((x) => x === max).length;
    const pure = [...g.values()].filter((v) => v.length === max)
        .every((v) => v.every((f) => f.thick) || v.every((f) => !f.thick));
    rows.push({ R, ratio: R / RHO, pairs, max, nMax, pure });
}
rows.sort((a, b) => b.max - a.max || a.R - b.R);
console.log("Sun gen 3 — every concurrence radius, and the largest group it supports\n");
console.log("   R          R/ρ        pairs   max group   count   makeup");
for (const r of rows.filter((x) => x.max >= 3)) {
    let tag = "";
    const c = [[1,"ρ"],[PHI,"ρφ"],[PHI**2,"ρφ²"],[PHI**3,"ρφ³"],[PHI**4,"ρφ⁴"],[S5,"ρ√5"],[2,"2ρ"],[3,"3ρ"],[PHI**3+2,"ρ(φ³+2)"]];
    for (const [v, n] of c) if (Math.abs(r.ratio - v) < 1e-6) tag = n;
    console.log(`  ${r.R.toFixed(6).padStart(10)} ${r.ratio.toFixed(6).padStart(10)} ${String(r.pairs).padStart(7)} ${String(r.max).padStart(11)} ${String(r.nMax).padStart(7)}   ${r.pure ? "pure" : "mixed"} ${tag}`);
}
console.log(`\n(${rows.length} distinct radii in all; those supporting only 1 or 2 faces omitted)`);
