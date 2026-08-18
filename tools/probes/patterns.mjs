// For each makeup, which of the ten orientations are present? The rosette has five
// thick faces at even positions and five thin at odd, going round; a pattern is
// written as ten slots.
import { seedTypes, generatePatch, vertexList, computeLift, pos3D } from "../../dist/geometry.js";
import { triacontahedra, A6 } from "../../dist/centers.js";
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const ORI=[]; for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){let u=nrm(crs(A6[j],A6[k]));if(u[2]<0)u=mul(u,-1);
  ORI.push({j,k,u,thick:Math.min((j-k+5)%5,(k-j+5)%5)===1});}
// order the ten by the azimuth of their normals, so "next round the rosette" means it
ORI.sort((a,b)=>Math.atan2(a.u[1],a.u[0])-Math.atan2(b.u[1],b.u[0]));
function candidates(m){const sz=Math.sign(m[5]);return ORI.map(({j,k,u,thick})=>{const n=new Array(5);
  for(let i=0;i<5;i++)n[i]=(i===j||i===k)?(m[i]-1)/2:(m[i]-(Math.sign(dot(mul(u,sz),A6[i]))||1))/2;
  const bump=(a,i)=>{const c=a.slice();c[i]++;return c;};
  return {thick,corners:[n,bump(n,j),bump(bump(n,j),k),bump(n,k)]};});}
const xy=(n)=>{const p=pos3D(n);return [p[0],p[1]];};
function hull(pts){const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=(q)=>{const h=[];for(const x of q){while(h.length>1&&cr(h[h.length-2],h[h.length-1],x)<=0)h.pop();h.push(x);}return h;};
  const lo=half(p),hi=half([...p].reverse());lo.pop();hi.pop();return lo.concat(hi);}
const depth=(h,q)=>Math.min(...h.map((a,i)=>{const b=h[(i+1)%h.length];
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  return ((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]))/L;}));

console.log("thick/thin round the rosette:", ORI.map(o=>o.thick?"T":"t").join(""));
const pats={};
for(const seed of ["Pe5","Pe3","Pe1","Deca","Sun"]) for(const gen of [3,4]){
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);console.log=q;
  const lift=computeLift(), cen=triacontahedra();
  const H=hull(lift.n.filter(Boolean).map(xy));
  const byN=new Map(); lift.n.forEach((nv,id)=>{if(nv)byN.set(nv.join(","),id);});
  const present=new Set(cen.faces.map(f=>[...f.vids].sort((a,b)=>a-b).join(",")));
  for(const s of cen.solids){
    const cand=candidates(s.m);
    if(cand.flatMap(c=>c.corners.map(xy)).some(p=>depth(H,p)<1e-9))continue;
    const bits=cand.map(c=>{const ids=c.corners.map(x=>byN.get(x.join(",")));
      return !ids.some(x=>x===undefined)&&present.has([...ids].sort((a,b)=>a-b).join(","))?1:0;});
    const n=bits.reduce((a,b)=>a+b,0);
    const t=bits.filter((b,i)=>b&&ORI[i].thick).length;
    // canonical form under rotation by two slots (a fifth of a turn keeps T on T)
    let best=null;
    for(let r=0;r<10;r+=2){const rot=bits.map((_,i)=>bits[(i+r)%10]).join("");if(best===null||rot<best)best=rot;}
    const key=`${n}=${t}T+${n-t}t`;
    (pats[key] ??= {})[best]=((pats[key]??{})[best]??0)+1;
  }
}
for(const k of Object.keys(pats).sort((a,b)=>Number(a[0])-Number(b[0])||a.localeCompare(b))){
  const v=pats[k];
  const list=Object.entries(v).sort((a,b)=>b[1]-a[1]).map(([p,c])=>`${p}×${c}`).join("  ");
  console.log(`${k.padEnd(10)} ${Object.keys(v).length} pattern(s): ${list}`);
}
