// Probe: do the face normals of a Wieringa roof meet at triacontahedron centers?
import {
    seedTypes, generatePatch, allRhombs, vertexList, vertexMap,
    roundKey, computeLift, pos3D, E5, allP1Tiles,
} from "../../dist/geometry.js";

const S5 = Math.sqrt(5);
const sub = (a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add = (a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul = (a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs = (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm = (a)=>mul(a,1/Math.hypot(...a));

// ── the six axes ───────────────────────────────────────────────
const A = [...E5.map(v=>[...v]), [0,0,1]];
console.log("pairwise dots (should all be ±1/√5 =", (1/S5).toFixed(6), "):");
for (let i=0;i<6;i++) for (let j=i+1;j<6;j++) {
    const d = dot(A[i],A[j]);
    if (Math.abs(Math.abs(d)-1/S5) > 1e-12) console.log("  BAD", i, j, d);
}
console.log("  all ok");

// ── inradius, and is the touch point the face center? ──────────
let rhos = [];
for (let i=0;i<6;i++) for (let j=i+1;j<6;j++) {
    const u = nrm(crs(A[i],A[j]));
    let off = [0,0,0];
    for (let m=0;m<6;m++) { if (m===i||m===j) continue; off = add(off, mul(A[m], Math.sign(dot(u,A[m]))/2)); }
    // is off parallel to u?
    const par = Math.hypot(...sub(off, mul(u, dot(off,u))));
    rhos.push([dot(off,u), par, i, j]);
}
console.log("\ninradius per face orientation (edge = 1):");
console.log("  min", Math.min(...rhos.map(r=>r[0])).toFixed(12),
            " max", Math.max(...rhos.map(r=>r[0])).toFixed(12),
            " max perp residual", Math.max(...rhos.map(r=>r[1])).toExponential(2));
const RHO = rhos[0][0];
console.log("  ρ =", RHO, " ; φ²/√(φ²+1)? ", (()=>{const P=(1+S5)/2; return P*P/Math.sqrt(P*P+1);})());
console.log("  circumradius of RT (long) =", (()=>{const P=(1+S5)/2;return P*P/ Math.sqrt(2+P);})());

// ── the roof ───────────────────────────────────────────────────
const seed = process.argv[2] ?? "Pe3";
const gen = Number(process.argv[3] ?? 3);
const quiet = console.log; console.log = ()=>{};
generatePatch(seedTypes.findIndex(s=>s.label===seed), true, gen);
console.log = quiet;
const lift = computeLift();
const P = lift.n.map(nv => nv ? pos3D(nv) : null);
const N = lift.n;

console.log(`\n=== ${seed} gen ${gen}: ${allRhombs.length} rhombi, ${vertexList.length} vertices ===`);

const key = (c)=>c.map(x=>Math.round(x*1e6)).join(",");
const votes = new Map();   // center key -> {c, faces:[], sides:[]}
const faceInfo = [];

for (const r of allRhombs) {
    const vid = r.verts.map(pt => vertexMap.get(roundKey(pt)).id);
    const q = vid.map(v=>P[v]);
    const u = nrm(crs(sub(q[1],q[0]), sub(q[3],q[0])));
    const ctr = mul(q.reduce((a,b)=>add(a,b),[0,0,0]), 1/4);
    // which generator pair?
    const nv = vid.map(v=>N[v]);
    const d1 = sub(nv[1],nv[0]).map(x=>x), d3 = sub(nv[3],nv[0]);
    const j = d1.findIndex(x=>x!==0), k = d3.findIndex(x=>x!==0);
    faceInfo.push({r, ctr, u, pair:[Math.min(j,k),Math.max(j,k)], vid});
    for (const s of [+1,-1]) {
        const c = add(ctr, mul(u, s*RHO));
        const kk = key(c);
        if (!votes.has(kk)) votes.set(kk, {c, faces:[], sides:[]});
        votes.get(kk).faces.push(r.id);
        votes.get(kk).sides.push(s);
    }
}

const hist = {};
for (const v of votes.values()) hist[v.faces.length] = (hist[v.faces.length]??0)+1;
console.log("vote histogram (faces per candidate center):", hist);
console.log("distinct candidate centers:", votes.size, " (2 per face =", allRhombs.length*2, ")");

const top = [...votes.values()].sort((a,b)=>b.faces.length-a.faces.length).slice(0,12);
console.log("\ntop centers:");
for (const v of top) {
    const zs = v.c[2];
    // is this center above or below the surface directly beneath it?
    console.log(`  n=${v.faces.length}  c=(${v.c.map(x=>x.toFixed(4)).join(", ")})  z=${zs.toFixed(4)}`);
}

// height quantization of centers with >=3 votes
const strong = [...votes.values()].filter(v=>v.faces.length>=3);
const zset = [...new Set(strong.map(v=>Math.round(v.c[2]*1e6)/1e6))].sort((a,b)=>a-b);
console.log("\ndistinct z of centers with >=3 votes:", zset.map(z=>z.toFixed(4)).join(" "));
console.log("  in units of 1/(2√5):", zset.map(z=>(z*2*S5).toFixed(4)).join(" "));

// how many faces belong to at least one strong center?
const covered = new Set();
for (const v of strong) for (const f of v.faces) covered.add(f);
console.log(`faces on some center with >=3 votes: ${covered.size}/${allRhombs.length}`);

// max possible: 20 (10 orientations x 2)
console.log("max votes seen:", Math.max(...[...votes.values()].map(v=>v.faces.length)));
