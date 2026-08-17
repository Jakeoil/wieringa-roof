// Probe 5: exact centers (sign fixed), phi offset, tilts, connectivity, Pe5 census.
import {
    seedTypes, generatePatch, allRhombs, allP1Tiles, vertexList, vertexMap, edgeMap,
    roundKey, computeLift, pos3D, E5,
} from "../../dist/geometry.js";

const S5=Math.sqrt(5), PHI=(1+S5)/2;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const RHO=Math.sqrt(1+2/S5);
const A6=[...E5.map(v=>[...v]),[0,0,1]];
const fromM=(m)=>{let c=[0,0,0];for(let i=0;i<6;i++)c=add(c,mul(A6[i],m[i]/2));return c;};

console.log("ρ (RT inradius, edge 1) =",RHO, " √(1+2/√5) =",Math.sqrt(1+2/S5), " φ²/√(φ²+1) =",PHI*PHI/Math.sqrt(PHI*PHI+1));
console.log("RT top vertex above center:",(5*(1/S5)+1)/2, " = φ?",PHI);
for(const d of [1,2]){
  const u=nrm(crs(A6[0],A6[d]));
  console.log(`  pair |Δj|=${d}: |u_z|=${Math.abs(u[2]).toFixed(6)}  tilt=${(Math.acos(Math.abs(u[2]))*180/Math.PI).toFixed(4)}°  (${d===1?"thick":"thin"})`);
}

function analyze(seed,gen){
  const quiet=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  console.log=quiet;
  const lift=computeLift();
  const N=lift.n, P=N.map(nv=>nv?pos3D(nv):null);
  const tileOf=new Map(); const tileType=new Map();
  for(const t of allP1Tiles){ tileType.set(t.id,t.type); for(const rid of t.rhombIds) tileOf.set(rid,t.id); }

  const groups=new Map(); const F=[]; let maxErr=0;
  for(const r of allRhombs){
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id);
    const q=vid.map(v=>P[v]);
    let u=nrm(crs(sub(q[1],q[0]),sub(q[3],q[0]))); if(u[2]<0)u=mul(u,-1);
    const ctr=mul(q.reduce((a,b)=>add(a,b),[0,0,0]),1/4);
    const n0=vid.map(v=>N[v]).reduce((a,b)=>a.map((x,i)=>Math.min(x,b[i])));
    const d1=N[vid[1]].map((x,i)=>x-N[vid[0]][i]), d3=N[vid[3]].map((x,i)=>x-N[vid[0]][i]);
    const j=d1.findIndex(x=>x!==0), k=d3.findIndex(x=>x!==0);
    const dj=Math.min((j-k+5)%5,(k-j+5)%5);
    const f={id:r.id,vid,q,u,ctr,thick:r.thick,cluster:r.cluster,tile:tileOf.get(r.id),
             pair:[Math.min(j,k),Math.max(j,k)],dj,idx:vid.map(v=>vertexList[v].index),keys:[]};
    for(const sz of [+1,-1]){
      const m=new Array(6);
      const sig=(i)=>Math.sign(dot(mul(u,sz),A6[i]))||1;
      for(let i=0;i<5;i++) m[i]= (i===j||i===k) ? 2*n0[i]+1 : 2*n0[i]+sig(i);
      m[5]=sig(5);
      const c=fromM(m);
      maxErr=Math.max(maxErr,Math.hypot(...sub(c,add(ctr,mul(u,sz*RHO)))));
      const kk=m.join(",");
      if(!groups.has(kk))groups.set(kk,{m,c,f:[]});
      groups.get(kk).f.push(f); f.keys.push(kk);
    }
    F.push(f);
  }

  console.log(`\n=== ${seed} gen ${gen} — ${F.length} rhombi, ${groups.size} candidate centers ===`);
  console.log(`  exact integer center error: ${maxErr.toExponential(2)}   all coords odd: ${[...groups.values()].every(g=>g.m.every(x=>Math.abs(x%2)===1))}`);
  // thick <-> |Δj|=1 ?
  console.log(`  thick ⟺ |Δj|=1: ${F.every(f=>f.thick===(f.dj===1))}`);

  const full=[...groups.values()].filter(g=>g.f.length===10);
  let phiOK=0;
  for(const g of full){
    const cnt=new Map(); for(const f of g.f) for(const v of f.vid) cnt.set(v,(cnt.get(v)??0)+1);
    const apex=[...cnt.entries()].filter(([,c])=>c===5).map(([q])=>q);
    if(apex.length===1){
      const a=P[apex[0]];
      const d=sub(g.c,a);
      if(Math.hypot(d[0],d[1])<1e-9 && Math.abs(Math.abs(d[2])-PHI)<1e-9) phiOK++;
    }
  }
  console.log(`  full caps: ${full.length}; center exactly φ vertically from the rosette hub: ${phiOK}`);

  // hats vs bowls, by hub index
  const lo=Math.min(...vertexList.map(v=>v.index)), hi=Math.max(...vertexList.map(v=>v.index));
  let hats=0,bowls=0;
  for(const g of full){ if(g.c[2]<g.f[0].ctr[2])hats++;else bowls++; }
  console.log(`  hats (center below): ${hats}   bowls (center above): ${bowls}   index range ${lo}..${hi}`);

  // Pe5 census: how many Pe5 P1 tiles, how many have a full cap
  const pe5=allP1Tiles.filter(t=>t.type==="Pe5"&&t.rhombIds.length===5);
  const capped=new Set(full.map(g=>[...new Set(g.f.filter(f=>f.thick).map(f=>f.tile))][0]));
  const rosetteGroups=[...groups.values()].filter(g=>{
    const th=g.f.filter(f=>f.thick); return th.length===5 && new Set(th.map(f=>f.tile)).size===1;});
  console.log(`  Pe5 tiles emitting 5 rhombs: ${pe5.length}; with a full 10-cap: ${capped.size}; with a full 5-rosette group: ${rosetteGroups.length}`);

  // group connectivity on the roof
  const adj=new Map(); for(const f of F) adj.set(f.id,new Set());
  for(const e of edgeMap.values()) if(e.rhombIds.length===2){adj.get(e.rhombIds[0]).add(e.rhombIds[1]);adj.get(e.rhombIds[1]).add(e.rhombIds[0]);}
  let disconn=0;
  for(const g of groups.values()){
    const ids=new Set(g.f.map(f=>f.id)); const st=[g.f[0].id]; const seen=new Set(st);
    while(st.length){const x=st.pop();for(const y of adj.get(x))if(ids.has(y)&&!seen.has(y)){seen.add(y);st.push(y);}}
    if(seen.size!==ids.size)disconn++;
  }
  console.log(`  groups that are NOT edge-connected on the roof: ${disconn} of ${groups.size}`);

  // group size distribution with thick count
  const mk={}; for(const g of groups.values()){const t=g.f.filter(f=>f.thick).length;mk[`${g.f.length}=${t}T+${g.f.length-t}t`]=(mk[`${g.f.length}=${t}T+${g.f.length-t}t`]??0)+1;}
  console.log("  group makeup:",JSON.stringify(mk));
  // segmentation: assign each face to its larger group; how many faces then land in a group of size>=5
  const assign=new Map();
  const order=[...groups.values()].sort((a,b)=>b.f.length-a.f.length);
  const used=new Set(); const sizes=[];
  for(const g of order){ const take=g.f.filter(f=>!used.has(f.id)); if(!take.length)continue; for(const f of take)used.add(f.id); sizes.push(take.length); }
  const sd={}; for(const s of sizes)sd[s]=(sd[s]??0)+1;
  console.log(`  greedy segmentation: ${sizes.length} triacontahedra cover all ${F.length} faces; piece sizes ${JSON.stringify(sd)}`);
}

for(const [s,g] of [["Pe5",3],["Pe3",3],["St5",3],["Deca",3],["Pe3",4]]) analyze(s,g);
