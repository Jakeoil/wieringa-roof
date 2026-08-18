// A center is settled when its ten candidate faces lie inside the patch's OUTER
// boundary. Holes are legitimate absences — the rhomb layer comes only from the P1
// pentagons, so star-family tiles leave gaps of fixed size at constant density, at
// every generation. A solid truncated by a hole is genuinely truncated; one truncated
// by the cut edge is not classified at all.
import { seedTypes, generatePatch, allRhombs, allP1Tiles, vertexList, edgeMap, computeLift } from "../../dist/geometry.js";
import { triacontahedra, A6 } from "../../dist/centers.js";
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const ORI=[]; for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){let u=nrm(crs(A6[j],A6[k]));if(u[2]<0)u=mul(u,-1);
  ORI.push({j,k,u,thick:Math.min((j-k+5)%5,(k-j+5)%5)===1});}
function candidates(m){const sz=Math.sign(m[5]);return ORI.map(({j,k,u,thick})=>{const n=new Array(5);
  for(let i=0;i<5;i++)n[i]=(i===j||i===k)?(m[i]-1)/2:(m[i]-(Math.sign(dot(mul(u,sz),A6[i]))||1))/2;
  const bump=(a,i)=>{const c=a.slice();c[i]++;return c;};
  return {thick,corners:[n,bump(n,j),bump(bump(n,j),k),bump(n,k)]};});}
const planar=(n)=>{let x=0,y=0;for(let i=0;i<5;i++){const t=2*Math.PI*i/5;
  x+=n[i]*(2/Math.sqrt(5))*Math.cos(t);y+=n[i]*(2/Math.sqrt(5))*Math.sin(t);}return [x,y];};

/** The outer boundary polygon: walk the cycles of boundary edges, keep the largest. */
function outerRing(P) {
    const adj = new Map();
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 1) continue;
        for (const [a, b] of [[e.v1, e.v2], [e.v2, e.v1]]) {
            if (!adj.has(a)) adj.set(a, []);
            adj.get(a).push(b);
        }
    }
    const seen = new Set();
    const rings = [];
    for (const start of adj.keys()) {
        if (seen.has(start)) continue;
        const ring = [];
        let cur = start, prev = -1;
        for (let guard = 0; guard < 1e6; guard++) {
            ring.push(cur); seen.add(cur);
            const next = (adj.get(cur) ?? []).find((x) => x !== prev && !seen.has(x));
            if (next === undefined) break;
            prev = cur; cur = next;
        }
        if (ring.length > 2) rings.push(ring);
    }
    let best = null, bestA = 0;
    for (const r of rings) {
        let a = 0;
        for (let i = 0; i < r.length; i++) {
            const p = P[r[i]], q = P[r[(i + 1) % r.length]];
            a += p[0] * q[1] - q[0] * p[1];
        }
        if (Math.abs(a) > Math.abs(bestA)) { bestA = a; best = r; }
    }
    return best ? best.map((v) => P[v]) : null;
}
const inPoly = (poly, q) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > q[1]) !== (b[1] > q[1]) &&
            q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
};

console.log("seed gen | rhombi | holes | settled |        class over settled centers        | 2 complete");
console.log("-".repeat(104));
const tot = {};
for (const seed of seedTypes.map((s) => s.label)) for (const gen of [2, 3, 4]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    console.log = q;
    if (!allRhombs.length) continue;
    const lift = computeLift(), cen = triacontahedra();
    const P = vertexList.map((v) => [v.pos.x, v.pos.y]);
    const ring = outerRing(P);
    if (!ring) { console.log(`${seed} ${gen}: no outer ring`); continue; }
    // planar coordinates of the lift are a linear image; anchor to vertex 0
    const anchorN = planar(lift.n[0]), anchorP = P[0];
    const scale = (() => { // one edge, both ways, gives the scale
        const e = [...edgeMap.values()][0];
        const dl = Math.hypot(...[0,1].map(k => planar(lift.n[e.v1])[k] - planar(lift.n[e.v2])[k]));
        const dp = Math.hypot(P[e.v1][0]-P[e.v2][0], P[e.v1][1]-P[e.v2][1]);
        return dp / dl;
    })();
    const toPatch = (n) => { const a = planar(n); return [anchorP[0] + (a[0]-anchorN[0])*scale, anchorP[1] + (a[1]-anchorN[1])*scale]; };

    const present = new Set(cen.faces.map((f) => [...f.vids].sort((a,b)=>a-b).join(",")));
    const byN = new Map(); lift.n.forEach((nv, id) => { if (nv) byN.set(nv.join(","), id); });
    const cls = {};
    let settled = 0;
    for (const s of cen.solids) {
        const cand = candidates(s.m);
        const allIn = cand.every((c) => c.corners.every((n) => inPoly(ring, toPatch(n))));
        if (!allIn) continue;
        settled++;
        let count = 0;
        for (const c of cand) {
            const ids = c.corners.map((n) => byN.get(n.join(",")));
            if (!ids.some((x) => x === undefined) && present.has([...ids].sort((a,b)=>a-b).join(","))) count++;
        }
        cls[count] = (cls[count] ?? 0) + 1;
        tot[count] = (tot[count] ?? 0) + 1;
    }
    const holes = allP1Tiles.filter((t) => t.rhombIds.length === 0).length;
    const both = cen.faces.filter((f) => f.solids.every((x) => cen.solids[x].complete)).length;
    const row = Object.keys(cls).map(Number).sort((a,b)=>a-b).map((k)=>`${k}:${cls[k]}`).join(" ");
    console.log(`${seed.padEnd(4)} ${gen}   | ${String(allRhombs.length).padStart(6)} | ${String(holes).padStart(5)} |`+
        ` ${String(settled).padStart(7)} | ${row.padEnd(40)} | ${both}`);
}
console.log("-".repeat(104));
console.log("classes over all settled centers:", JSON.stringify(tot));
