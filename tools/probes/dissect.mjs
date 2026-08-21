// The RT's dissection into golden rhombohedra, and what two RTs share.
import { A6, RHO } from "../../dist/centers.js";
const S5 = Math.sqrt(5), PHI = (1 + S5) / 2;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>{const L=Math.hypot(...a);return a.map(x=>x/L);};

// A zonohedron on n generators dissects into C(n,3) parallelepipeds, one per triple.
console.log("The 20 cells, one per triple of the six axes:\n");
const cells = [];
for (let i = 0; i < 6; i++) for (let j = i+1; j < 6; j++) for (let k = j+1; k < 6; k++) {
    const g = [A6[i], A6[j], A6[k]];
    const vol = Math.abs(dot(g[0], crs(g[1], g[2])));
    // mutual angles decide the shape: all-same-sign is the acute (prolate) one
    const d = [dot(g[0],g[1]), dot(g[0],g[2]), dot(g[1],g[2])];
    const neg = d.filter((x) => x < 0).length;
    cells.push({ ijk: [i,j,k], vol, neg, d });
}
const byVol = {};
for (const c of cells) byVol[c.vol.toFixed(6)] = (byVol[c.vol.toFixed(6)] ?? 0) + 1;
console.log("  cell volumes:", JSON.stringify(byVol));
const acute = 4/(S5*Math.sqrt(5+2*S5)) , _u=0;
console.log(`  acute rhombohedron volume  = ${(2/(S5*PHI**0)/2).toFixed(6)}?  measured set above`);
const vols = Object.keys(byVol).map(Number).sort((a,b)=>a-b);
console.log(`  two distinct volumes: ${vols.join(" and ")}   ratio ${(vols[1]/vols[0]).toFixed(9)}  φ = ${PHI.toFixed(9)}`);
console.log(`  counts: ${byVol[vols[0].toFixed(6)]} of the smaller, ${byVol[vols[1].toFixed(6)]} of the larger`);
const total = cells.reduce((s,c)=>s+c.vol,0);
console.log(`  total ${total.toFixed(6)}   RT volume 4√(5+2√5) = ${(4*Math.sqrt(5+2*S5)).toFixed(6)}`);

// which triples give which
const shape = {};
for (const c of cells) {
    const key = `${c.vol > vols[0]*1.5 ? "acute " : "obtuse"} negDots=${c.neg}`;
    shape[key] = (shape[key] ?? 0) + 1;
}
console.log("  by mutual-angle signature:", JSON.stringify(shape));

// ── what do two RTs share? ────────────────────────────────────────
const N = []; for (let i=0;i<6;i++) for (let j=i+1;j<6;j++) N.push(nrm(crs(A6[i],A6[j])));
const inRT = (p, c) => N.every((u) => Math.abs(dot(u,[p[0]-c[0],p[1]-c[1],p[2]-c[2]])) <= RHO + 1e-12);
function sharedVolume(t, n = 4000000) {
    // Monte Carlo in the bounding box of the RT
    let hit = 0, R = PHI + 0.01;
    for (let s = 0; s < n; s++) {
        const p = [ (Math.random()*2-1)*R, (Math.random()*2-1)*R, (Math.random()*2-1)*R ];
        if (inRT(p,[0,0,0]) && inRT(p,t)) hit++;
    }
    return (hit / n) * (2*R)**3;
}
console.log("\nTwo RTs, one translated — the volume they share:");
const RTVOL = 4*Math.sqrt(5+2*S5);
for (const [name, t] of [
    ["one axis  a_i", A6[0]],
    ["long diagonal a_i+a_j", A6[0].map((x,q)=>x+A6[1][q])],
    ["short diagonal a_i−a_j", A6[0].map((x,q)=>x-A6[1][q])],
    ["face contact 2ρ·n̂", nrm(crs(A6[0],A6[1])).map(x=>x*2*RHO)],
]) {
    const v = sharedVolume(t);
    console.log(`  ${name.padEnd(24)} |t|=${Math.hypot(...t).toFixed(4)}  shared ≈ ${v.toFixed(3)}  = ${(v/RTVOL*100).toFixed(1)}% of an RT  ≈ ${(v/vols[0]).toFixed(2)} obtuse cells`);
}
