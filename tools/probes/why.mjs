// The index-window argument: a solid's admissible orientations are pinned by M = sum m_i.
import { seedTypes, generatePatch, allRhombs, vertexList, vertexMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5),RHO=Math.sqrt(1+2/S5);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const A6=[...E5.map(v=>[...v]),[0,0,1]];

// T = sum of sigma_i over the three horizontal axes NOT in the pair, per orientation & side
console.log("orientation  |Δj|  side   σ(horiz others)  T    σ_5");
const Ts={};
for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){
  const dj=Math.min((j-k+5)%5,(k-j+5)%5);
  let u=nrm(crs(A6[j],A6[k])); if(u[2]<0)u=mul(u,-1);
  for(const sz of [1,-1]){
    const sig=[];let T=0;
    for(let i=0;i<5;i++){if(i===j||i===k)continue;const s=Math.sign(dot(mul(u,sz),A6[i]));sig.push(s);T+=s;}
    const s5=Math.sign(dot(mul(u,sz),A6[5]));
    Ts[`${j}${k}|${sz}`]=T;
    if(j===0&&k<3)console.log(`  {${j},${k}}      ${dj}   ${sz>0?"+":"−"}    [${sig.join(",")}]        ${T>=0?" ":""}${T}    ${s5>0?"+1":"−1"}`);
  }
}
const byT={};
for(const [k,T] of Object.entries(Ts)){const dj=(()=>{const[j,kk]=k.split("|")[0].split("").map(Number);return Math.min((j-kk+5)%5,(kk-j+5)%5);})();
  const lab=`side ${k.split("|")[1]>0?"+":"−"} ${dj===1?"thick":"thin "}`;byT[lab]=byT[lab]||new Set();byT[lab].add(T);}
console.log("\nT values by side and rhomb type:");
for(const [k,v] of Object.entries(byT).sort())console.log(`  ${k}: T ∈ {${[...v].sort((a,b)=>a-b).join(",")}}`);

for(const [seed,gen] of [["Pe3",3],["Deca",3]]){
  const q=console.log;console.log=()=>{};generatePatch(seedTypes.findIndex(t=>t.label===seed),true,gen);console.log=q;
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
      if(!g.has(kk))g.set(kk,{m,M:m.slice(0,5).reduce((a,b)=>a+b,0),f:[],T:new Set(),thick:0,thin:0});
      const e=g.get(kk);e.f.push(r.id);e.T.add(Ts[`${Math.min(j,k)}${Math.max(j,k)}|${sz}`]);
      if(r.thick)e.thick++;else e.thin++;
    }
  }
  console.log(`\n=== ${seed} gen ${gen} ===`);
  const tab={};
  for(const v of g.values()){
    const key=`M=${v.M} m5=${v.m[5]>0?"+1":"−1"}`;
    tab[key]=tab[key]||{n:0,max:0,sizes:new Set(),Ts:new Set()};
    tab[key].n++;tab[key].max=Math.max(tab[key].max,v.f.length);tab[key].sizes.add(v.f.length);
    for(const t of v.T)tab[key].Ts.add(t);
  }
  console.log("  M, m5 → how many solids, their sizes, the T values their faces use:");
  for(const [k,v] of Object.entries(tab).sort())
    console.log(`    ${k.padEnd(14)} solids ${String(v.n).padStart(4)}  sizes {${[...v.sizes].sort((a,b)=>a-b).join(",")}}  T {${[...v.Ts].sort((a,b)=>a-b).join(",")}}`);
}
