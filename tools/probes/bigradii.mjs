// Do the large-radius caps survive a patch big enough to hold them?
//
// The radii found on Sun gen 3 ran out to R ≈ 46 against a patch barely wider than
// that, so the sparse ones were plainly edge-starved. Generation 6 of the same seeds
// reaches 120–270 edge lengths, which is room to spare — and it is the *same seeds*,
// which is the point. de Bruijn would hand back a generic tiling; these are the three
// symmetric ones the project is built on.
import { seedTypes, generatePatch, allRhombs, vertexMap, roundKey, computeLift, pos3D } from "../../dist/geometry.js";
const S5 = Math.sqrt(5), PHI = (1 + S5) / 2, RHO = Math.sqrt(1 + 2 / S5);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>a.map(x=>x*s);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));

// radii observed on Sun gen 3, as multiples of rho
const RATIOS = [1, S5, 3, PHI**3, 5.472136, PHI**3+2, 7.472136, 8.236068, 9.472136,
                10.708204, 11.472136, 12.708204, 14.708204, 15.944272, 16.708204,
                17.944272, 19.180340, 19.944272, 21.180340, 21.944272, 23.180340,
                24.416408, 25.180340, 26.416408, 28.416408, 29.652476, 30.416408,
                31.652475, 33.652476];

for (const [seed, gen] of [["Pe5", 6], ["Deca", 6]]) {
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
    let radius = 0;
    for (const f of F) radius = Math.max(radius, Math.hypot(f.c[0], f.c[1]));
    console.log(`\n=== ${seed} gen ${gen}: ${F.length} rhombi, patch radius ${radius.toFixed(0)} ===`);
    const over = [];
    for (const ratio of RATIOS) {
        const R = RHO * ratio;
        const g = new Map();
        for (const f of F) for (const s of [1, -1]) {
            const c = add(f.c, mul(f.u, s * R));
            const k = c.map((x) => Math.round(x * 1e6)).join(",");
            if (!g.has(k)) g.set(k, []); g.get(k).push(f);
        }
        // Math.max(...sizes) blows the call stack past a few hundred thousand groups.
        let max = 0, n = 0;
        for (const v of g.values()) { if (v.length > max) { max = v.length; n = 1; } else if (v.length === max) n++; }
        const pure = [...g.values()].filter((v) => v.length === max)
            .every((v) => v.every((f) => f.thick) || v.every((f) => !f.thick));
        if (max > 5) over.push({ ratio, max });
        if (ratio === 1 || max >= 5 || ratio > 25)
            console.log(`   R/ρ ${ratio.toFixed(6).padStart(10)}  max ${String(max).padStart(2)}  ×${String(n).padStart(5)}  ${pure ? "pure" : "MIXED"}`);
    }
    console.log(`   radii exceeding 5 faces: ${over.length ? JSON.stringify(over) : "none besides ρ itself"}`);
}
