// Probe 4: exact integer centers; Pe5 <-> top cap; apex vertices; coverage.
import {
    seedTypes, generatePatch, allRhombs, allP1Tiles, vertexList, vertexMap, edgeMap,
    roundKey, computeLift, pos3D, E5,
} from "../../dist/geometry.js";

const S5=Math.sqrt(5);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const RHO=Math.sqrt(1+2/S5);
const A6=[...E5.map(v=>[...v]),[0,0,1]];
const fromM=(m)=>{let c=[0,0,0];for(let i=0;i<6;i++)c=add(c,mul(A6[i],m[i]/2));return c;};

function analyze(seed,gen,verbose=false){
  const quiet=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  console.log=quiet;
  const lift=computeLift();
  const N=lift.n, P=N.map(nv=>nv?pos3D(nv):null);
  const rhombs=allRhombs.map(r=>r), p1=allP1Tiles.map(t=>t);

  // P1 tile id per rhomb
  const tileOf=new Map();
  for(const t of p1) for(const rid of t.rhombIds) tileOf.set(rid,t.id);

  const groups=new Map();  // m-key -> {m, c, f:[]}
  const F=[];
  let maxErr=0, oddFail=0;
  for(const r of rhombs){
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id);
    const q=vid.map(v=>P[v]);
    let u=nrm(crs(sub(q[1],q[0]),sub(q[3],q[0])));
    if(u[2]<0)u=mul(u,-1);
    const ctr=mul(q.reduce((a,b)=>add(a,b),[0,0,0]),1/4);
    // the generator pair, from the integer coordinates
    const n0=N[vid[0]];
    const d1=N[vid[1]].map((x,i)=>x-n0[i]), d3=N[vid[3]].map((x,i)=>x-n0[i]);
    const j=d1.findIndex(x=>x!==0), k=d3.findIndex(x=>x!==0);
    const f={id:r.id,vid,q,u,ctr,thick:r.thick,cluster:r.cluster,pair:[j,k],
             tile:tileOf.get(r.id), idx:vid.map(v=>vertexList[v].index), m:[]};
    // exact integer centers, both sides
    for(const sz of [+1,-1]){
      const nlo=vid.map(v=>N[v]).reduce((a,b)=>a.map((x,i)=>Math.min(x,b[i])));
      const m=new Array(6);
      for(let i=0;i<5;i++) m[i]=2*nlo[i]+(i===j||i===k?1:0);
      // resolve the sign of the non-edge generators from the true center
      const cTry=(sigs)=>{const mm=m.slice();for(let i=0;i<5;i++) if(i!==j&&i!==k) mm[i]=2*nlo[i]-sigs[i];mm[5]=-sigs[5];return mm;};
      const target=add(ctr,mul(u,sz*RHO));
      const sigs=new Array(6);
      for(let i=0;i<6;i++) sigs[i]=Math.sign(dot(mul(u,sz),A6[i]))||1;
      const mm=cTry(sigs);
      const c=fromM(mm);
      maxErr=Math.max(maxErr,Math.hypot(...sub(c,target)));
      if(mm.some(x=>x%2===0))oddFail++;
      const kk=mm.join(",");
      if(!groups.has(kk))groups.set(kk,{m:mm,c,f:[],side:sz});
      groups.get(kk).f.push(f);
      f.m.push(kk);
    }
    F.push(f);
  }
  const vh={};
  for(const g of groups.values())vh[g.f.length]=(vh[g.f.length]??0)+1;

  console.log(`\n=== ${seed} gen ${gen} — ${F.length} rhombi ===`);
  console.log(`  exact-integer center error: ${maxErr.toExponential(2)}; even coordinates: ${oddFail}`);
  console.log("  vote histogram:",JSON.stringify(vh));

  // full caps: is the 5-thick top cap one P1 Pe5 tile?
  const full=[...groups.values()].filter(g=>g.f.length===10);
  let capOneTile=0, capPe5=0;
  for(const g of full){
    const th=g.f.filter(f=>f.thick);
    const tiles=new Set(th.map(f=>f.tile));
    if(tiles.size===1)capOneTile++;
    if(th.every(f=>f.cluster==="Pe5"))capPe5++;
  }
  console.log(`  full caps: ${full.length}; 5 thick faces from ONE P1 tile: ${capOneTile}; all Pe5: ${capPe5}`);

  // 5-fold rosette vertices at extreme index
  const deg=new Map();
  for(const f of F) for(const v of f.vid) deg.set(v,(deg.get(v)??0)+1);
  let idxs=[...new Set(vertexList.map(v=>v.index))].sort();
  const lo=Math.min(...idxs), hi=Math.max(...idxs);
  let ros=0, rosExtreme=0;
  for(const [v,d] of deg){
    if(d!==5)continue;
    // all five faces thick and sharing the same extreme corner?
    const fs=F.filter(f=>f.vid.includes(v));
    const allThickAtTip=fs.every(f=>f.thick && (vertexList[v].index===lo||vertexList[v].index===hi));
    ros++;
    if(allThickAtTip)rosExtreme++;
  }
  console.log(`  degree-5 vertices: ${ros}; of those all-thick at an extreme index: ${rosExtreme}`);

  // per-face: best group it belongs to
  const best={};
  for(const f of F){const b=Math.max(...f.m.map(k=>groups.get(k).f.length));best[b]=(best[b]??0)+1;}
  console.log("  per-face best group size:",JSON.stringify(best));

  // group size vs side
  const bySide={};
  for(const g of groups.values()){
    const above=g.c[2]>g.f[0].ctr[2];
    bySide[`${g.f.length}${above?"↑bowl":"↓hat"}`]=(bySide[`${g.f.length}${above?"↑bowl":"↓hat"}`]??0)+1;
  }
  console.log("  by side:",JSON.stringify(bySide));

  if(verbose){
    // how many distinct generator pairs in each group size
    const g5=[...groups.values()].filter(g=>g.f.length===5);
    console.log("  5-groups: distinct pairs per group:",g5.map(g=>new Set(g.f.map(f=>f.pair.join(""))).size).join(","));
    const g10=[...groups.values()].filter(g=>g.f.length===10);
    console.log("  10-groups: distinct pairs per group:",g10.map(g=>new Set(g.f.map(f=>f.pair.join(""))).size).join(","));
    const g3=[...groups.values()].filter(g=>g.f.length===3);
    console.log("  3-groups: distinct pairs per group:",g3.map(g=>new Set(g.f.map(f=>f.pair.join(""))).size).join(","));
  }
}

for(const [s,g] of [["Pe5",3],["Pe3",3],["St5",3],["Deca",3],["Pe3",4],["Pe5",4]]) analyze(s,g,s==="Pe5"&&g===3);
