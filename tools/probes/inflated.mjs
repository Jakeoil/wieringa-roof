// Do the normals meet again at an inflated scale?
//
// Section 5A found equal-radius concurrences at radii other than rho and dismissed them
// because their tangency sets were small. But the tiling is self-similar under
// inflation by phi, so an inflated triacontahedron would have inradius rho*phi^k — and
// its face planes would be tangent to a sphere of that radius, touching at the centres
// of ITS faces, which are golden rhombi of edge phi^k. A roof rhomb sitting exactly at
// one of those points would put its normal through the inflated centre.
//
// So: run the same grouping as chapter 2, at radius rho*phi^k.
import { seedTypes, generatePatch, allRhombs, vertexMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5 = Math.sqrt(5), PHI = (1 + S5) / 2, RHO = Math.sqrt(1 + 2 / S5);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>a.map(x=>x*s);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));

for (const [seed, gen] of [["Sun", 3], ["Sun", 4], ["Star", 4]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    const lift = computeLift(); console.log = q;
    const P = lift.n.map((nv) => (nv ? pos3D(nv) : null));
    const F = allRhombs.map((r) => {
        const vid = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
        const qv = vid.map((v) => P[v]);
        let u = nrm(crs(sub(qv[1], qv[0]), sub(qv[3], qv[0])));
        if (u[2] < 0) u = mul(u, -1);
        return { u, c: mul(qv.reduce((a, b) => add(a, b), [0,0,0]), 1/4), thick: r.thick };
    });
    console.log(`\n=== ${seed} gen ${gen}: ${F.length} rhombi ===`);
    for (let k = 0; k <= 4; k++) {
        const R = RHO * PHI ** k;
        const g = new Map();
        for (const f of F) for (const s of [1, -1]) {
            const c = add(f.c, mul(f.u, s * R));
            const key = c.map((x) => Math.round(x * 1e6)).join(",");
            if (!g.has(key)) g.set(key, []);
            g.get(key).push(f);
        }
        const sizes = [...g.values()].map((v) => v.length);
        const hist = {};
        for (const n of sizes) hist[n] = (hist[n] ?? 0) + 1;
        const big = [...g.values()].filter((v) => v.length >= 3);
        const makeup = {};
        for (const v of big) {
            const t = v.filter((f) => f.thick).length;
            makeup[`${v.length}=${t}T+${v.length - t}t`] = (makeup[`${v.length}=${t}T+${v.length - t}t`] ?? 0) + 1;
        }
        console.log(`  R = ρ·φ^${k} = ${R.toFixed(6)}  max group ${Math.max(...sizes)}  sizes ${JSON.stringify(hist)}`);
        if (Object.keys(makeup).length) console.log(`      groups ≥3 by makeup: ${JSON.stringify(makeup)}`);
    }
}
