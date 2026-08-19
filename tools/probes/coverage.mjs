// With every proper class drawn as a full cup, which roof rhombs are left uncovered?
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

for (const [seed,gen] of [["Pe3",3],["Sun",3],["Sun",4]]) {
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  const cen=triacontahedra(); const lift=computeLift(); console.log=q;
  const byN=new Map(); lift.n.forEach((nv,id)=>{if(nv)byN.set(nv.join(","),id);});
  const fkey=(vids)=>[...vids].sort((a,b)=>a-b).join(",");
  const faceOf=new Map(); for(const f of cen.faces) faceOf.set(fkey(f.vids), f.id);

  const MODE = process.argv.includes("--all") ? "every home" : "proper + settled only";
  const drawn = process.argv.includes("--all")
    ? cen.solids.filter(s=>s.homeCount>0)
    : cen.solids.filter(s=>PROPER.has(s.makeup)&&s.settled&&s.homeCount>0);
  const covered=new Set();
  let wrongSide=0;
  for(const s of drawn){
    const cand=candidates(s.m).map(c=>c.map(n=>byN.get(n.join(","))));
    const keys=cand.filter(ids=>!ids.some(x=>x===undefined)).map(fkey);
    for(const k of keys){const id=faceOf.get(k); if(id!==undefined)covered.add(id);}
    // every roof face actually on this solid must be among its candidates
    for(const fid of s.faces) if(!keys.includes(fkey(cen.byRhomb[fid].vids))) wrongSide++;
  }
  const uncovered=cen.faces.filter(f=>!covered.has(f.id));
  const why={};
  for(const f of uncovered){
    const h=cen.solids[cen.home[f.id]];
    const k = !h.settled ? `home edge-truncated (${h.makeup})`
            : !PROPER.has(h.makeup) ? `home demoted (${h.makeup})`
            : "home drawn but face uncovered ??";
    why[k]=(why[k]??0)+1;
  }
  // shape of the gaps: connected components of uncovered faces
  const adj=new Map(); for(const f of cen.faces) adj.set(f.id,[]);
  for(const e of edgeMap.values()) if(e.rhombIds.length===2){
    adj.get(e.rhombIds[0]).push(e.rhombIds[1]); adj.get(e.rhombIds[1]).push(e.rhombIds[0]);}
  const un=new Set(uncovered.map(f=>f.id)); const seen=new Set(); const comp={};
  for(const id of un){ if(seen.has(id))continue; let n=0; const st=[id]; seen.add(id);
    while(st.length){const x=st.pop();n++;for(const y of adj.get(x))if(un.has(y)&&!seen.has(y)){seen.add(y);st.push(y);}}
    comp[n]=(comp[n]??0)+1;}
  console.log(`${seed} gen ${gen} [${MODE}]: ${cen.faces.length} rhombi, ${drawn.length} cups drawn`);
  console.log(`   covered ${covered.size}  uncovered ${uncovered.length} (${(100*uncovered.length/cen.faces.length).toFixed(1)}%)`);
  console.log(`   why: ${JSON.stringify(why)}`);
  console.log(`   gap component sizes: ${JSON.stringify(comp)}`);
  console.log(`   roof faces on a drawn solid but not in its own cup: ${wrongSide}`);
}
