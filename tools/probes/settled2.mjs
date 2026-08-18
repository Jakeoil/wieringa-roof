// Two follow-ups: is the settled test too strict, and does any rhomb sit on two
// complete solids — one above, one below?
import { seedTypes, generatePatch, allRhombs, vertexList, computeLift, pos3D } from "../../dist/geometry.js";
import { triacontahedra, A6 } from "../../dist/centers.js";
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const ORI=[]; for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){let u=nrm(crs(A6[j],A6[k]));if(u[2]<0)u=mul(u,-1);ORI.push({j,k,u});}
function candidates(m){const sz=Math.sign(m[5]);return ORI.map(({j,k,u})=>{const n=new Array(5);
  for(let i=0;i<5;i++)n[i]=(i===j||i===k)?(m[i]-1)/2:(m[i]-(Math.sign(dot(mul(u,sz),A6[i]))||1))/2;
  const bump=(a,i)=>{const c=a.slice();c[i]++;return c;};
  return [n,bump(n,j),bump(bump(n,j),k),bump(n,k)];});}

// planar hull of the patch, for the "is my test too strict" question
function hull(pts){const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const half=(q)=>{const h=[];for(const x of q){while(h.length>1&&cr(h[h.length-2],h[h.length-1],x)<=0)h.pop();h.push(x);}return h;};
  const lo=half(p),hi=half([...p].reverse());lo.pop();hi.pop();return lo.concat(hi);}
const inHull=(h,q)=>h.every((a,i)=>{const b=h[(i+1)%h.length];
  return (b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0])>=-1e-9;});

console.log("seed gen | centers | settled | excluded but whole footprint inside the hull | faces on TWO complete solids");
console.log("-".repeat(108));
for(const seed of seedTypes.map(s=>s.label)) for(const gen of [2,3,4]){
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);console.log=q;
  if(!allRhombs.length)continue;
  const lift=computeLift(), cen=triacontahedra();
  const byN=new Map(); lift.n.forEach((nv,id)=>{if(nv)byN.set(nv.join(","),id);});
  const pos=(n)=>{let x=0,y=0;for(let i=0;i<5;i++){const t=2*Math.PI*i/5;x+=n[i]*(2/Math.sqrt(5))*Math.cos(t);y+=n[i]*(2/Math.sqrt(5))*Math.sin(t);}return [x,y];};
  const H=hull(vertexList.map((_,i)=>lift.n[i]).filter(Boolean).map(pos));
  let settled=0, strictLoss=0;
  for(const s of cen.solids){
    const cand=candidates(s.m);
    const cornersIn=cand.every(c=>c.every(n=>byN.has(n.join(","))));
    if(cornersIn){settled++;continue;}
    // would the whole footprint fit inside the patch's convex hull anyway?
    if(cand.every(c=>c.every(n=>inHull(H,pos(n))))) strictLoss++;
  }
  const both=cen.faces.filter(f=>f.solids.every(s=>cen.solids[s].complete)).length;
  console.log(`${seed.padEnd(4)} ${gen}   | ${String(cen.solids.length).padStart(7)} | ${String(settled).padStart(7)} |`+
    ` ${String(strictLoss).padStart(43)} | ${both}`);
}
