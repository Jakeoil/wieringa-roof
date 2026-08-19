// Exactly the ring walk that centers.ts uses, instrumented.
import { seedTypes, generatePatch, allRhombs, edgeMap, computeLift, pos3D } from "../../dist/geometry.js";
for (const [seed,gen] of [["Sun",3],["Sun",4],["Pe3",3],["Deca",4]]) {
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  const lift=computeLift();console.log=q;
  const P=lift.n.map(nv=>{if(!nv)return null;const p=pos3D(nv);return [p[0],p[1]];});

  const edges=[]; const inc=new Map();
  for(const e of edgeMap.values()){ if(e.rhombIds.length!==1)continue;
    const id=edges.length; edges.push([e.v1,e.v2]);
    for(const v of [e.v1,e.v2]){ if(!inc.has(v))inc.set(v,[]); inc.get(v).push(id);} }
  // degree distribution of boundary vertices: 2 means simple cycles, 4 means a pinch
  const deg={}; for(const [,l] of inc) deg[l.length]=(deg[l.length]??0)+1;

  const used=new Array(edges.length).fill(false);
  const areas=[]; let consumed=0;
  for(let s0=0;s0<edges.length;s0++){
    if(used[s0])continue; used[s0]=true;
    const ring=[edges[s0][0],edges[s0][1]]; let cur=edges[s0][1];
    for(;;){ const nx=(inc.get(cur)??[]).find(id=>!used[id]); if(nx===undefined)break;
      used[nx]=true; const [a,b]=edges[nx]; cur=a===cur?b:a; ring.push(cur);
      if(cur===ring[0])break; }
    consumed+=ring.length-1;
    if(ring.length<4)continue;
    const poly=ring.map(v=>P[v]).filter(Boolean);
    let a2=0; for(let i=0;i<poly.length;i++){const p=poly[i],w=poly[(i+1)%poly.length];a2+=p[0]*w[1]-w[0]*p[1];}
    areas.push(Math.abs(a2/2));
  }
  areas.sort((a,b)=>b-a);
  // area a full covering would have: rhomb area x count
  const rhombArea=Math.sqrt(2-2/Math.sqrt(5))*Math.sqrt(2+2/Math.sqrt(5))/2;
  const total=allRhombs.length*rhombArea;
  console.log(`${seed} gen ${gen}: ${edges.length} boundary edges, vertex degrees ${JSON.stringify(deg)}`);
  console.log(`   ${areas.length} cycles; largest areas ${areas.slice(0,5).map(a=>a.toFixed(1)).join(", ")}`);
  console.log(`   largest ${areas[0].toFixed(1)} vs total rhomb area ${total.toFixed(1)}  ratio ${(areas[0]/total).toFixed(3)}`);
}
