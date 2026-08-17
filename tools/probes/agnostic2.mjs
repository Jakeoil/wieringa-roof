import { seedTypes, generatePatch, allRhombs, allP1Tiles, vertexMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5),PHI=(1+S5)/2;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const RHO=Math.sqrt(1+2/S5);
const A6=[...E5.map(v=>[...v]),[0,0,1]];

export function faces(seed,gen){
  const q=console.log;console.log=()=>{};generatePatch(seedTypes.findIndex(t=>t.label===seed),true,gen);console.log=q;
  const lift=computeLift(),N=lift.n,P=N.map(nv=>nv?pos3D(nv):null);
  const tileOf=new Map(),tileTy=new Map();
  for(const t of allP1Tiles){tileTy.set(t.id,t.type);for(const r of t.rhombIds)tileOf.set(r,t.id);}
  return allRhombs.map(r=>{
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id),qv=vid.map(v=>P[v]);
    let u=nrm(crs(sub(qv[1],qv[0]),sub(qv[3],qv[0])));if(u[2]<0)u=mul(u,-1);
    const d1=N[vid[1]].map((x,i)=>x-N[vid[0]][i]),d3=N[vid[3]].map((x,i)=>x-N[vid[0]][i]);
    const j=d1.findIndex(x=>x!==0),k=d3.findIndex(x=>x!==0);
    return {id:r.id,vid,u,c:mul(qv.reduce((a,b)=>add(a,b),[0,0,0]),1/4),thick:r.thick,
            tile:tileOf.get(r.id),tileType:tileTy.get(tileOf.get(r.id)),pair:[Math.min(j,k),Math.max(j,k)].join("-")};
  });
}
// closest approach: P = A.c + t A.u,  Q = B.c + s B.u
export function meet(A,B){
  const w0=sub(A.c,B.c);
  const a=dot(A.u,A.u), b=dot(A.u,B.u), c=dot(B.u,B.u);
  const d=dot(A.u,w0), e=dot(B.u,w0), den=a*c-b*b;
  if(Math.abs(den)<1e-12) return null;
  const t=(b*e-c*d)/den, s=(a*e-b*d)/den;
  const pA=add(A.c,mul(A.u,t)), pB=add(B.c,mul(B.u,s));
  return {t,s,miss:Math.hypot(...sub(pA,pB)),p:mul(add(pA,pB),0.5)};
}
if(process.argv[1].endsWith("agnostic2.mjs")){
for(const [seed,gen] of [["Pe3",3],["Pe5",3],["St5",3],["Deca",3]]){
  const F=faces(seed,gen);
  let parallel=0,exact=0,eq=0,uneq=0;
  const radii=new Map(),missHist={},uneqEx=[],sameSide=new Map();
  for(let i=0;i<F.length;i++)for(let j=i+1;j<F.length;j++){
    const m=meet(F[i],F[j]);
    if(!m){parallel++;continue;}
    const bk=m.miss<1e-9?"<1e-9":m.miss<1e-6?"<1e-6":m.miss<1e-3?"<1e-3":m.miss<0.05?"<0.05":"far";
    missHist[bk]=(missHist[bk]??0)+1;
    if(m.miss<1e-9){exact++;
      const rA=Math.abs(m.t),rB=Math.abs(m.s);
      if(Math.abs(rA-rB)<1e-9){eq++;const k=rA.toFixed(6);radii.set(k,(radii.get(k)??0)+1);
        const side=(m.t>0)===(m.s>0)?"same":"opposite";
        sameSide.set(k+" "+side,(sameSide.get(k+" "+side)??0)+1);}
      else{uneq++;if(uneqEx.length<8)uneqEx.push(`${rA.toFixed(4)}/${rB.toFixed(4)}`);}
    }
  }
  console.log(`\n=== ${seed} gen ${gen}: ${F.length} faces, ${F.length*(F.length-1)/2} pairs ===`);
  console.log("  parallel (same orientation):",parallel,"  miss buckets:",JSON.stringify(missHist));
  console.log(`  exactly concurrent: ${exact}  equal radius: ${eq}  unequal radius: ${uneq}`);
  console.log("  radii among equal-radius concurrences:",[...radii.entries()].sort((a,b)=>b[1]-a[1]).map(([r,n])=>`${r}×${n}`).join("  "));
  console.log("  by side:",[...sameSide.entries()].map(([k,n])=>`${k}×${n}`).join("  "));
  if(uneqEx.length)console.log("  unequal-radius samples:",uneqEx.join(" "));
  console.log(`  ρ = ${RHO.toFixed(6)}`);
}
}
