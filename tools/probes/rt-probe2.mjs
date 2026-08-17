// Probe 2: structure of the triacontahedron centers.
import {
    seedTypes, generatePatch, allRhombs, vertexList, vertexMap,
    roundKey, computeLift, pos3D, E5, allP1Tiles,
} from "../../dist/geometry.js";

const S5 = Math.sqrt(5), PHI=(1+S5)/2;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const RHO = Math.sqrt(1+2/S5);

const A=[...E5.map(v=>[...v]),[0,0,1]];

// classify the 30 RT faces by band when stood on the 6th (vertical) axis
{
  const bands={};
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
    const u0=nrm(crs(A[i],A[j]));
    for(const s of [1,-1]){
      const u=mul(u0,s);
      let off=[0,0,0];
      for(let m=0;m<6;m++){if(m===i||m===j)continue;off=add(off,mul(A[m],Math.sign(dot(u,A[m]))/2));}
      const z=off[2].toFixed(4);
      const usesZ = (i===5||j===5);
      const k=`z=${z} usesVertical=${usesZ} uz=${u[2].toFixed(4)}`;
      bands[k]=(bands[k]??0)+1;
    }
  }
  console.log("RT faces by band (face-center height, edge=1), stood on a 5-fold axis:");
  for(const [k,v] of Object.entries(bands).sort()) console.log(`  ${v} faces  ${k}`);
}

function run(seed,gen,verbose){
  const quiet=console.log; console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  console.log=quiet;
  const lift=computeLift();
  const P=lift.n.map(nv=>nv?pos3D(nv):null);
  const N=lift.n;
  const key=(c)=>c.map(x=>Math.round(x*1e6)).join(",");
  const votes=new Map();
  const faces=[];
  for(const r of allRhombs){
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id);
    const q=vid.map(v=>P[v]);
    const u=nrm(crs(sub(q[1],q[0]),sub(q[3],q[0])));
    if(u[2]<0) u.forEach((_,i)=>u[i]=-u[i]);   // orient upward
    const ctr=mul(q.reduce((a,b)=>add(a,b),[0,0,0]),1/4);
    const f={id:r.id,ctr,u,cluster:r.cluster,thick:r.thick,vid,idx:vid.map(v=>vertexList[v].index)};
    faces.push(f);
    for(const s of [+1,-1]){
      const c=add(ctr,mul(u,s*RHO));
      const kk=key(c);
      if(!votes.has(kk))votes.set(kk,{c,f:[],side:s});
      votes.get(kk).f.push(f);
    }
  }
  const zs=faces.flatMap(f=>f.vid.map(v=>P[v][2]));
  const zlo=Math.min(...zs), zhi=Math.max(...zs);
  const hist={};
  for(const v of votes.values())hist[v.f.length]=(hist[v.f.length]??0)+1;
  // above / below split for centers with >=2 votes
  const cls={};
  for(const v of votes.values()){
    if(v.f.length<2)continue;
    // is the center above or below its own faces?
    const above = v.c[2] > v.f[0].ctr[2];
    const k=`${v.f.length}-${above?"above(bowl)":"below(hat)"}`;
    cls[k]=(cls[k]??0)+1;
  }
  console.log(`\n=== ${seed} gen ${gen}: ${allRhombs.length} rhombi, z ${zlo.toFixed(3)}..${zhi.toFixed(3)} ===`);
  console.log("  vote histogram:",JSON.stringify(hist));
  console.log("  by side:",JSON.stringify(cls));
  const full=[...votes.values()].filter(v=>v.f.length===10);
  console.log(`  full 10-face caps: ${full.length}`);
  if(verbose && full.length){
    const v=full[0];
    console.log("  sample full cap center:",v.c.map(x=>x.toFixed(4)).join(","));
    // apex vertex = the vertex shared by all 10? and the vertex set
    const cnt=new Map();
    for(const f of v.f) for(const q of f.vid) cnt.set(q,(cnt.get(q)??0)+1);
    const byCount={};
    for(const c of cnt.values()) byCount[c]=(byCount[c]??0)+1;
    console.log("  vertex incidence within cap:",JSON.stringify(byCount),"distinct verts",cnt.size);
    const apex=[...cnt.entries()].filter(([,c])=>c===5).map(([q])=>q);
    console.log("  vertices in 5 cap faces:",apex.length, apex.map(q=>`idx${vertexList[q].index} z${P[q][2].toFixed(3)}`).join(" "));
    console.log("  cap face thick/thin:",v.f.filter(f=>f.thick).length,"thick,",v.f.filter(f=>!f.thick).length,"thin");
    console.log("  cap clusters:",JSON.stringify(v.f.reduce((a,f)=>(a[f.cluster]=(a[f.cluster]??0)+1,a),{})));
  }
  // do centers with >=2 votes sit on a nice lattice?  c*2 in the Z-span of the 6 axes
  const strong=[...votes.values()].filter(v=>v.f.length>=2);
  console.log(`  centers ≥2 votes: ${strong.length}; distinct z: ${[...new Set(strong.map(v=>Math.round(v.c[2]*1e6)/1e6))].sort((a,b)=>a-b).map(z=>z.toFixed(4)).join(" ")}`);
  // coverage
  const cov=new Set(); for(const v of votes.values()) if(v.f.length===10) for(const f of v.f) cov.add(f.id);
  console.log(`  faces on a full cap: ${cov.size}/${allRhombs.length} (${(100*cov.size/allRhombs.length).toFixed(1)}%)`);
  return {votes,faces,P,zlo,zhi};
}

for(const [s,g] of [["Pe5",2],["Pe5",3],["Pe3",3],["Pe1",3],["St5",3],["Deca",3],["Pe3",4]]) run(s,g,s==="Pe5"&&g===3);
