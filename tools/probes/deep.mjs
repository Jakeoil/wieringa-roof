// Classes for centers that are unambiguously interior.
//
// The earlier "all forty corners present" test was near-circular and is dropped. This
// one is geometric and checkable: take the patch's convex hull, shrink it by the
// planar radius of a triacontahedron's own ten-face footprint, and keep only centers
// whose whole footprint is inside. Holes are interior to the hull and so are counted
// as the genuine absences they are. Restricted to the roughly round seeds, where the
// hull really is the outer boundary.
import { seedTypes, generatePatch, allRhombs, allP1Tiles, vertexList, computeLift, pos3D } from "../../dist/geometry.js";
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
const xy=(n)=>{const p=pos3D(n);return [p[0],p[1]];};

function hull(pts){const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=(q)=>{const h=[];for(const x of q){while(h.length>1&&cr(h[h.length-2],h[h.length-1],x)<=0)h.pop();h.push(x);}return h;};
  const lo=half(p),hi=half([...p].reverse());lo.pop();hi.pop();return lo.concat(hi);}
// signed distance inside a ccw hull (positive = inside)
const depth=(h,q)=>Math.min(...h.map((a,i)=>{const b=h[(i+1)%h.length];
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]);
  return ((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]))/L;}));

console.log("seed gen | rhombi | holes | deep centers |                  class : count (thick+thin makeup)");
console.log("-".repeat(112));
for(const seed of ["Pe5","Pe3","Pe1","Deca","Sun"]) for(const gen of [3,4]){
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);console.log=q;
  const lift=computeLift(), cen=triacontahedra();
  const H=hull(lift.n.filter(Boolean).map(xy));
  const present=new Set(cen.faces.map(f=>[...f.vids].sort((a,b)=>a-b).join(",")));
  const byN=new Map(); lift.n.forEach((nv,id)=>{if(nv)byN.set(nv.join(","),id);});
  const cls={}, makeup={};
  let deep=0;
  for(const s of cen.solids){
    const cand=candidates(s.m);
    const pts=cand.flatMap(c=>c.corners.map(xy));
    if(pts.some(p=>depth(H,p)<1e-9)) continue;   // footprint must be strictly inside
    deep++;
    let n=0,t=0;
    for(const c of cand){
      const ids=c.corners.map(x=>byN.get(x.join(",")));
      if(ids.some(x=>x===undefined))continue;
      if(present.has([...ids].sort((a,b)=>a-b).join(","))){n++; if(c.thick)t++;}
    }
    cls[n]=(cls[n]??0)+1;
    const key=`${n}=${t}T+${n-t}t`; makeup[key]=(makeup[key]??0)+1;
  }
  const row=Object.keys(makeup).sort((a,b)=>Number(a.split("=")[0])-Number(b.split("=")[0])||a.localeCompare(b))
      .map(k=>`${k}:${makeup[k]}`).join("  ");
  console.log(`${seed.padEnd(4)} ${gen}   | ${String(allRhombs.length).padStart(6)} |`+
    ` ${String(allP1Tiles.filter(t=>!t.rhombIds.length).length).padStart(5)} | ${String(deep).padStart(12)} | ${row}`);
}
