// How deep inside the patch are the uncovered rhombs, and the unsettled solids?
import { seedTypes, generatePatch, allRhombs, edgeMap, computeLift, pos3D } from "../../dist/geometry.js";
import { triacontahedra, A6 } from "../../dist/centers.js";
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const ORI=[]; for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){let u=nrm(crs(A6[j],A6[k]));if(u[2]<0)u=mul(u,-1);ORI.push({j,k,u});}
function candidates(m){const sz=Math.sign(m[5]);return ORI.map(({j,k,u})=>{const n=new Array(5);
  for(let i=0;i<5;i++)n[i]=(i===j||i===k)?(m[i]-1)/2:(m[i]-(Math.sign(dot(mul(u,sz),A6[i]))||1))/2;
  const bump=(a,i)=>{const c=a.slice();c[i]++;return c;};
  return [n,bump(n,j),bump(bump(n,j),k),bump(n,k)];});}
const PROPER=new Set(["4=4T+0t","5=5T+0t","5=3T+2t","10=5T+5t"]);

for (const [seed,gen] of [["Sun",3],["Sun",4],["Deca",4]]) {
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  const cen=triacontahedra(); const lift=computeLift(); console.log=q;

  // graph distance of each face from the patch edge (a face with a lone edge = 0)
  const adj=new Map(); for(const f of cen.faces) adj.set(f.id,[]);
  const edgeFaces=new Set();
  for(const e of edgeMap.values()){
    if(e.rhombIds.length===1){edgeFaces.add(e.rhombIds[0]);continue;}
    adj.get(e.rhombIds[0]).push(e.rhombIds[1]); adj.get(e.rhombIds[1]).push(e.rhombIds[0]);
  }
  const dist=new Map(); const qq=[...edgeFaces]; qq.forEach(x=>dist.set(x,0));
  for(let h=0;h<qq.length;h++){const x=qq[h];
    for(const y of adj.get(x)) if(!dist.has(y)){dist.set(y,dist.get(x)+1);qq.push(y);}}
  const maxD=Math.max(...dist.values());

  const byN=new Map(); lift.n.forEach((nv,id)=>{if(nv)byN.set(nv.join(","),id);});
  const fkey=v=>[...v].sort((a,b)=>a-b).join(",");
  const faceOf=new Map(); for(const f of cen.faces) faceOf.set(fkey(f.vids), f.id);
  const drawn=cen.solids.filter(s=>PROPER.has(s.makeup)&&s.settled&&s.homeCount>0);
  const covered=new Set();
  for(const s of drawn) for(const c of candidates(s.m)){
    const ids=c.map(n=>byN.get(n.join(","))); if(ids.some(x=>x===undefined))continue;
    const id=faceOf.get(fkey(ids)); if(id!==undefined)covered.add(id);}

  const unc=cen.faces.filter(f=>!covered.has(f.id));
  const hist={};
  for(const f of unc){const d=dist.get(f.id)??-1; const b=d<=1?"0-1":d<=3?"2-3":d<=6?"4-6":d<=12?"7-12":"13+";
    hist[b]=(hist[b]??0)+1;}
  // and the same for unsettled home solids
  const uns={};
  for(const s of cen.solids){ if(s.settled||s.homeCount===0)continue;
    const d=Math.min(...s.faces.map(fid=>dist.get(fid)??0));
    const b=d<=1?"0-1":d<=3?"2-3":d<=6?"4-6":d<=12?"7-12":"13+"; uns[b]=(uns[b]??0)+1;}
  console.log(`${seed} gen ${gen}: ${cen.faces.length} rhombi, max depth from edge ${maxD}`);
  console.log(`   uncovered by depth: ${JSON.stringify(hist)}`);
  console.log(`   unsettled homes by depth: ${JSON.stringify(uns)}`);
}
