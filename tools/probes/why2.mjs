import { seedTypes, generatePatch, allRhombs, vertexList, vertexMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5),RHO=Math.sqrt(1+2/S5);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const A6=[...E5.map(v=>[...v]),[0,0,1]];
const vec=(k)=>k.reduce((acc,ki,i)=>add(acc,mul(A6[i],ki)),[0,0,0]);
const q0=console.log;console.log=()=>{};generatePatch(seedTypes.findIndex(t=>t.label==="Deca"),true,3);console.log=q0;
const lift=computeLift(),N=lift.n,P=N.map(nv=>nv?pos3D(nv):null);
const g=new Map();
for(const r of allRhombs){
  const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id),qv=vid.map(v=>P[v]);
  let u=nrm(crs(sub(qv[1],qv[0]),sub(qv[3],qv[0])));if(u[2]<0)u=mul(u,-1);
  const n0=vid.map(v=>N[v]).reduce((a,b)=>a.map((x,i)=>Math.min(x,b[i])));
  const d1=N[vid[1]].map((x,i)=>x-N[vid[0]][i]),d3=N[vid[3]].map((x,i)=>x-N[vid[0]][i]);
  const j=d1.findIndex(x=>x!==0),k=d3.findIndex(x=>x!==0);
  for(const sz of [1,-1]){
    const m=new Array(6);
    for(let i=0;i<5;i++)m[i]=(i===j||i===k)?2*n0[i]+1:2*n0[i]+(Math.sign(dot(mul(u,sz),A6[i]))||1);
    m[5]=Math.sign(dot(mul(u,sz),A6[5]))||1;
    const kk=m.join(",");
    if(!g.has(kk))g.set(kk,{m,M:m.slice(0,5).reduce((a,b)=>a+b,0),f:[],vids:new Set(),thick:0});
    const e=g.get(kk);e.f.push(r.id);vid.forEach(v=>e.vids.add(v));if(r.thick)e.thick++;
  }
}
const C=[...g.values()];
// joint face-count distribution by separation
const tab=new Map();
for(let i=0;i<C.length;i++)for(let j=i+1;j<C.length;j++){
  const k=C[i].m.map((x,t)=>(x-C[j].m[t])/2);
  const L=Math.hypot(...vec(k)).toFixed(6);
  if(Number(L)>1.72)continue;
  const a=Math.min(C[i].f.length,C[j].f.length),b=Math.max(C[i].f.length,C[j].f.length);
  const key=`${L}  min|A|,|B| = ${a},${b}`;
  tab.set(key,(tab.get(key)??0)+1);
}
console.log("Deca gen 3 — face counts of solid pairs at the three shortest separations:");
for(const [k,v] of [...tab.entries()].sort())console.log(`   ${k}  ×${v}`);
// for minimal >=2 pairs: do they share roof vertices / faces?
const D=C.filter(c=>c.f.length>=2);
let shareF=0,shareV=0,n=0,samSide=0;
for(let i=0;i<D.length;i++)for(let j=i+1;j<D.length;j++){
  const k=D[i].m.map((x,t)=>(x-D[j].m[t])/2);
  if(Math.abs(Math.hypot(...vec(k))-1.701302)>1e-6)continue;
  n++;
  if(D[i].f.some(f=>D[j].f.includes(f)))shareF++;
  if([...D[i].vids].some(v=>D[j].vids.has(v)))shareV++;
  if(D[i].m[5]===D[j].m[5])samSide++;
  if(n<=3)console.log(`   example: M=${D[i].M}/${D[j].M} m5=${D[i].m[5]}/${D[j].m[5]} faces ${D[i].f.length}/${D[j].f.length} k=[${k}]`);
}
console.log(`\n  minimal (long-diagonal) pairs among ≥2-face solids: ${n}; sharing a face ${shareF}; sharing a roof vertex ${shareV}; same side ${samSide}`);
