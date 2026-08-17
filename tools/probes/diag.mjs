// Why is the minimum center separation the long diagonal?
import { seedTypes, generatePatch, allRhombs, vertexMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5),PHI=(1+S5)/2,RHO=Math.sqrt(1+2/S5);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const A6=[...E5.map(v=>[...v]),[0,0,1]];
const vec=(k)=>k.reduce((acc,ki,i)=>add(acc,mul(A6[i],ki)),[0,0,0]);

function centers(seed,gen){
  const q=console.log;console.log=()=>{};generatePatch(seedTypes.findIndex(t=>t.label===seed),true,gen);console.log=q;
  const lift=computeLift(),N=lift.n,P=N.map(nv=>nv?pos3D(nv):null);
  const g=new Map();
  for(const r of allRhombs){
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id),qv=vid.map(v=>P[v]);
    let u=nrm(crs(sub(qv[1],qv[0]),sub(qv[3],qv[0])));if(u[2]<0)u=mul(u,-1);
    const n0=vid.map(v=>N[v]).reduce((a,b)=>a.map((x,i)=>Math.min(x,b[i])));
    const d1=N[vid[1]].map((x,i)=>x-N[vid[0]][i]),d3=N[vid[3]].map((x,i)=>x-N[vid[0]][i]);
    const j=d1.findIndex(x=>x!==0),k=d3.findIndex(x=>x!==0);
    const ctr=mul(qv.reduce((a,b)=>add(a,b),[0,0,0]),1/4);
    for(const sz of [1,-1]){
      const m=new Array(6);
      for(let i=0;i<5;i++)m[i]=(i===j||i===k)?2*n0[i]+1:2*n0[i]+(Math.sign(dot(mul(u,sz),A6[i]))||1);
      m[5]=Math.sign(dot(mul(u,sz),A6[5]))||1;
      const kk=m.join(",");
      if(!g.has(kk))g.set(kk,{m,f:[],side:new Set()});
      // "upper" face of this solid means the face is above the center
      g.get(kk).f.push(r.id); g.get(kk).side.add(sz>0?"lower":"upper");
    }
  }
  return g;
}

for(const [seed,gen] of [["Pe3",3],["Deca",3]]){
  const g=centers(seed,gen);
  console.log(`\n=== ${seed} gen ${gen} — ${g.size} candidate centers ===`);
  // does m5 only ever take +-1 ?
  console.log("  m[5] values:",[...new Set([...g.values()].map(v=>v.m[5]))].join(","));
  // do groups ever mix faces above and below the center?
  const mixed=[...g.values()].filter(v=>v.side.size>1).length;
  console.log(`  groups mixing upper and lower faces of the same solid: ${mixed}`);

  for(const minFaces of [1,2,3]){
    const C=[...g.values()].filter(v=>v.f.length>=minFaces);
    const lens=new Map();
    for(let i=0;i<C.length;i++)for(let j=i+1;j<C.length;j++){
      const k=C[i].m.map((x,t)=>(x-C[j].m[t])/2);
      const L=Math.hypot(...vec(k));
      const key=L.toFixed(6);
      if(!lens.has(key))lens.set(key,{n:0,ks:new Set()});
      const e=lens.get(key);e.n++;
      if(e.ks.size<4)e.ks.add(k.join(""));
    }
    const rows=[...lens.entries()].sort((a,b)=>Number(a[0])-Number(b[0])).slice(0,6);
    console.log(`  solids with ≥${minFaces} faces (${C.length}): shortest separations`);
    for(const [L,e] of rows) console.log(`     ${L}  ×${e.n}   k = ${[...e.ks].join(" | ")}`);
  }
}
console.log(`\n  |a_i| = 1     |a_i − a_j| = ${Math.sqrt(2-2/S5).toFixed(6)} (short diag)   |a_i + a_j| = ${Math.sqrt(2+2/S5).toFixed(6)} (long diag)   2ρ = ${(2*RHO).toFixed(6)}   φ³ = ${(PHI**3).toFixed(6)}`);
