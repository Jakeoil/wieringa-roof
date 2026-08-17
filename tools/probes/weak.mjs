// (a) uniqueness & the "two thick + one thin" triple  (b) do the balls overlap  (c) the plane arrangement
import { faces, meet } from "./agnostic2.mjs";
import { seedTypes, generatePatch, allRhombs, vertexList, vertexMap, edgeMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5),PHI=(1+S5)/2,RHO=Math.sqrt(1+2/S5);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const A6=[...E5.map(v=>[...v]),[0,0,1]];

for(const [seed,gen] of [["Pe3",3],["Deca",3]]){
  const F=faces(seed,gen);
  const ctrKey=(f,s)=>add(f.c,mul(f.u,s*RHO)).map(v=>Math.round(v*1e6)).join(",");
  const keys=F.map(f=>[ctrKey(f,1),ctrKey(f,-1)]);
  const grp=new Map(); F.forEach((f,i)=>keys[i].forEach(k=>{if(!grp.has(k))grp.set(k,[]);grp.get(k).push(i);}));

  console.log(`\n=== ${seed} gen ${gen} — ${F.length} faces ===`);

  // (a1) uniqueness: how many centers can two faces share?
  let pairShare=[0,0,0];
  for(let i=0;i<F.length;i++)for(let j=i+1;j<F.length;j++){
    const n=keys[i].filter(k=>keys[j].includes(k)).length; pairShare[n]++;
  }
  console.log(`  face pairs sharing 0 / 1 / 2 centers: ${pairShare.join(" / ")}`);

  // (a2) vertex triples by thick/thin makeup, and whether all three share a center
  const byVert=new Map();
  F.forEach((f,i)=>f.vid.forEach(v=>{if(!byVert.has(v))byVert.set(v,[]);byVert.get(v).push(i);}));
  const trip={};
  for(const [v,ids] of byVert){
    for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++)for(let c=b+1;c<ids.length;c++){
      const s=[ids[a],ids[b],ids[c]];
      const t=s.filter(i=>F[i].thick).length;
      const common=keys[s[0]].filter(k=>keys[s[1]].includes(k)&&keys[s[2]].includes(k)).length;
      const lab=`${t}T+${3-t}t`;
      trip[lab]=trip[lab]||{n:0,share:0};
      trip[lab].n++; if(common>0)trip[lab].share++;
    }
  }
  console.log("  vertex triples, share a common triacontahedron:");
  for(const [k,v] of Object.entries(trip).sort())
    console.log(`    ${k}: ${v.share}/${v.n}  (${(100*v.share/v.n).toFixed(0)}%)`);

  // (b) do the edge-1 solids overlap?  test all groups with >=2 faces
  const cents=[...grp.entries()].filter(([,ids])=>ids.length>=2)
      .map(([k,ids])=>({c:k.split(",").map(x=>x/1e6),n:ids.length}));
  const insideRT2=(d)=>{for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
      const u=nrm(crs(A6[i],A6[j])); if(Math.abs(dot(u,d))>2*RHO+1e-9)return false;} return true;};
  let ov=0,pr=0,minD=Infinity;
  for(let i=0;i<cents.length;i++)for(let j=i+1;j<cents.length;j++){
    const d=sub(cents[i].c,cents[j].c);pr++;minD=Math.min(minD,Math.hypot(...d));
    if(insideRT2(d))ov++;
  }
  console.log(`  solids with ≥2 faces: ${cents.length}; interpenetrating pairs ${ov}/${pr}; min center distance ${minD.toFixed(4)} (2ρ=${(2*RHO).toFixed(4)})`);

  // (c) the plane arrangement — offsets used, per normal direction
  const dirs=new Map();
  for(const f of F){const k=f.pair;const off=dot(f.c,f.u);
    if(!dirs.has(k))dirs.set(k,new Set());dirs.get(k).add(off.toFixed(9));}
  const gaps=new Map();
  for(const [k,set] of dirs){
    const o=[...set].map(Number).sort((a,b)=>a-b);
    for(let i=1;i<o.length;i++){const g=(o[i]-o[i-1]).toFixed(6);gaps.set(g,(gaps.get(g)??0)+1);}
  }
  console.log(`  distinct face planes: ${[...dirs.values()].reduce((a,s)=>a+s.size,0)} in ${dirs.size} directions`);
  console.log("  consecutive plane gaps:",[...gaps.entries()].sort((a,b)=>Number(a[0])-Number(b[0])).map(([g,n])=>`${g}×${n}`).join("  "));
}
console.log(`\n  reference: 1/√5=${(1/S5).toFixed(6)}  2/√5=${(2/S5).toFixed(6)}  φ/√5=${(PHI/S5).toFixed(6)}  short diag=${(Math.sqrt(2-2/S5)).toFixed(6)}  long diag=${(Math.sqrt(2+2/S5)).toFixed(6)}`);
