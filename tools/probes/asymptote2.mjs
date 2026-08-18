// Same question, with the outline done properly.
//
// The convex hull is not the outer boundary of a Star or a Queen patch — it spans the
// concave bays, so solids sitting in open air get counted as settled, and the bias
// differs per seed. Walk the real boundary instead: the cycles of edges used by one
// rhomb, largest area wins. Test candidate face CENTROIDS, not corners, so a face
// lying exactly along the outline is not a coin toss.
import { seedTypes, generatePatch, allRhombs, edgeMap, vertexList, computeLift, pos3D } from "../../dist/geometry.js";
import { triacontahedra, CLASSES, A6 } from "../../dist/centers.js";
const PHI=(1+Math.sqrt(5))/2;
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const ORI=[]; for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){let u=nrm(crs(A6[j],A6[k]));if(u[2]<0)u=mul(u,-1);
  ORI.push({j,k,u});}
function candCentroids(m){const sz=Math.sign(m[5]);return ORI.map(({j,k,u})=>{const n=new Array(5);
  for(let i=0;i<5;i++)n[i]=(i===j||i===k)?(m[i]-1)/2:(m[i]-(Math.sign(dot(mul(u,sz),A6[i]))||1))/2;
  const c=n.slice(); // centroid = n + (e_j + e_k)/2
  const p=pos3D(c), pj=pos3D(A6.map((_,i)=>i===j?1:0).slice(0,5)), pk=pos3D(A6.map((_,i)=>i===k?1:0).slice(0,5));
  return [p[0]+(pj[0]+pk[0])/2, p[1]+(pj[1]+pk[1])/2];});}

/** every boundary cycle, walked over EDGES so cycles sharing a vertex do not merge */
function rings(P){
  const inc=new Map();
  const edges=[];
  for(const e of edgeMap.values()){ if(e.rhombIds.length!==1)continue;
    const id=edges.length; edges.push([e.v1,e.v2]);
    for(const v of [e.v1,e.v2]){ if(!inc.has(v))inc.set(v,[]); inc.get(v).push(id); } }
  const used=new Array(edges.length).fill(false);
  const out=[];
  for(let s=0;s<edges.length;s++){
    if(used[s])continue;
    const ring=[]; let [prev,cur]=edges[s]; used[s]=true; ring.push(prev,cur);
    for(let guard=0;guard<2e6;guard++){
      const nxt=(inc.get(cur)??[]).find(id=>!used[id]);
      if(nxt===undefined)break;
      used[nxt]=true;
      const [a,b]=edges[nxt]; const step=a===cur?b:a;
      if(step===undefined)break;
      cur=step; ring.push(cur);
      if(cur===ring[0])break;
    }
    if(ring.length>3)out.push(ring.map(v=>P[v]));
  }
  return out;
}
const area=(r)=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
const inside=(poly,q)=>{let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];
    if((a[1]>q[1])!==(b[1]>q[1]) && q[0]<((b[0]-a[0])*(q[1]-a[1]))/(b[1]-a[1])+a[0]) c=!c;}
  return c;};

console.log("seed  gen |  rhombi | T:t    | settled |          share of settled solids, by class");
console.log("-".repeat(104));
for(const seed of ["Pe3","Deca","Sun","Star"]) for(const gen of [4,5]){
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  const cen=triacontahedra(); const lift=computeLift();
  console.log=q;
  const P=lift.n.map(nv=>{if(!nv)return null;const p=pos3D(nv);return [p[0],p[1]];});
  const R=rings(P); if(!R.length){console.log(`${seed} ${gen}: no rings`);continue;}
  let outer=R[0],ba=area(R[0]);
  for(const r of R){const a=area(r);if(a>ba){ba=a;outer=r;}}
  const per=CLASSES.map(()=>0); let tot=0;
  for(const s of cen.solids){
    if(!candCentroids(s.m).every(c=>inside(outer,c)))continue;
    const i=CLASSES.indexOf(s.faces.length); if(i<0)continue;
    per[i]++; tot++;
  }
  const F=allRhombs.length, thick=allRhombs.filter(r=>r.thick).length;
  console.log(`${seed.padEnd(5)} ${gen}   | ${String(F).padStart(7)} | ${(thick/(F-thick)).toFixed(4)} |`+
    ` ${String(tot).padStart(7)} | ${per.map((x,i)=>`${CLASSES[i]}:${(100*x/tot).toFixed(2)}%`).join(" ")}`);
}
console.log(`\nφ = ${PHI.toFixed(4)}   (rings found are boundary cycles; the largest by area is the outline)`);
