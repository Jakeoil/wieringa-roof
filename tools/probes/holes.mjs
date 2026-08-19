// Is the interior daylight at the rims of the tiling's own gaps?
import { seedTypes, generatePatch, allRhombs, allP1Tiles, edgeMap, vertexList, computeLift } from "../../dist/geometry.js";
import { triacontahedra, A6 } from "../../dist/centers.js";
import { pos3D } from "../../dist/geometry.js";
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const ORI=[]; for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){let u=nrm(crs(A6[j],A6[k]));if(u[2]<0)u=mul(u,-1);ORI.push({j,k,u});}
function candidates(m){const sz=Math.sign(m[5]);return ORI.map(({j,k,u})=>{const n=new Array(5);
  for(let i=0;i<5;i++)n[i]=(i===j||i===k)?(m[i]-1)/2:(m[i]-(Math.sign(dot(mul(u,sz),A6[i]))||1))/2;
  const bump=(a,i)=>{const c=a.slice();c[i]++;return c;};
  return [n,bump(n,j),bump(bump(n,j),k),bump(n,k)];});}
const PROPER=new Set(["4=4T+0t","5=5T+0t","5=3T+2t","10=5T+5t"]);

for (const [seed,gen] of [["Sun",3],["Sun",4]]) {
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  const cen=triacontahedra(); const lift=computeLift(); console.log=q;
  const P=lift.n.map(nv=>nv?(p=>[p[0],p[1]])(pos3D(nv)):null);

  // boundary cycles: the largest by area is the outline, the rest are holes
  const edges=[]; const inc=new Map();
  for(const e of edgeMap.values()){ if(e.rhombIds.length!==1)continue;
    const id=edges.length; edges.push([e.v1,e.v2,e.rhombIds[0]]);
    for(const v of [e.v1,e.v2]){ if(!inc.has(v))inc.set(v,[]); inc.get(v).push(id);} }
  const used=new Array(edges.length).fill(false); const rings=[];
  for(let s0=0;s0<edges.length;s0++){ if(used[s0])continue; used[s0]=true;
    const ring=[s0]; let cur=edges[s0][1];
    for(;;){ const nx=(inc.get(cur)??[]).find(id=>!used[id]); if(nx===undefined)break;
      used[nx]=true; ring.push(nx); const [a,b]=edges[nx]; cur=a===cur?b:a; }
    rings.push(ring); }
  const areaOf=r=>{const vs=[];for(const id of r){vs.push(edges[id][0]);}
    let a=0; for(let i=0;i<vs.length;i++){const p=P[vs[i]],w=P[vs[(i+1)%vs.length]];a+=p[0]*w[1]-w[0]*p[1];}
    return Math.abs(a/2);};
  let outer=rings[0]; for(const r of rings) if(areaOf(r)>areaOf(outer)) outer=r;
  const outerFaces=new Set(outer.map(id=>edges[id][2]));
  const holeFaces=new Set();
  for(const r of rings){ if(r===outer)continue; for(const id of r) holeFaces.add(edges[id][2]); }

  const byN=new Map(); lift.n.forEach((nv,id)=>{if(nv)byN.set(nv.join(","),id);});
  const fkey=v=>[...v].sort((a,b)=>a-b).join(",");
  const faceOf=new Map(); for(const f of cen.faces) faceOf.set(fkey(f.vids), f.id);
  const drawn=cen.solids.filter(s=>PROPER.has(s.makeup)&&s.settled&&s.homeCount>0);
  const covered=new Set();
  for(const s of drawn) for(const c of candidates(s.m)){
    const ids=c.map(n=>byN.get(n.join(","))); if(ids.some(x=>x===undefined))continue;
    const id=faceOf.get(fkey(ids)); if(id!==undefined)covered.add(id);}
  const unc=cen.faces.filter(f=>!covered.has(f.id));
  let onOuter=0,onHole=0,neither=0;
  for(const f of unc){
    if(outerFaces.has(f.id))onOuter++;
    else if(holeFaces.has(f.id))onHole++;
    else neither++;
  }
  console.log(`${seed} gen ${gen}: ${rings.length} boundary cycles — 1 outline, ${rings.length-1} holes`);
  console.log(`   uncovered ${unc.length}: on the outline ${onOuter}, on a hole rim ${onHole}, touching neither ${neither}`);
}
