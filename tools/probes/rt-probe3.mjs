// Probe 3: is "same RT center" the same relation as "fold angle 36 degrees"?
import {
    seedTypes, generatePatch, allRhombs, vertexList, vertexMap, edgeMap,
    roundKey, edgeKey, computeLift, pos3D, E5, allP1Tiles,
} from "../../dist/geometry.js";

const S5=Math.sqrt(5), PHI=(1+S5)/2;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const RHO=Math.sqrt(1+2/S5);

function analyze(seed,gen){
  const quiet=console.log; console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  console.log=quiet;
  const lift=computeLift();
  const P=lift.n.map(nv=>nv?pos3D(nv):null);
  const key=(c)=>c.map(x=>Math.round(x*1e6)).join(",");

  const F=allRhombs.map(r=>{
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id);
    const q=vid.map(v=>P[v]);
    let u=nrm(crs(sub(q[1],q[0]),sub(q[3],q[0])));
    if(u[2]<0)u=mul(u,-1);
    const ctr=mul(q.reduce((a,b)=>add(a,b),[0,0,0]),1/4);
    return {id:r.id,vid,q,u,ctr,thick:r.thick,cluster:r.cluster,
            cAbove:key(add(ctr,mul(u,RHO))),cBelow:key(add(ctr,mul(u,-RHO)))};
  });

  // ── dihedral / fold per interior edge ────────────────────────────
  const eList=[...edgeMap.values()].filter(e=>e.rhombIds.length===2);
  const foldHist={};
  const par=new Array(F.length).fill(0).map((_,i)=>i);
  const find=(x)=>par[x]===x?x:(par[x]=find(par[x]));
  const uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b;};
  let same36=0, diff36=0, same_not36=0;
  for(const e of eList){
    const [a,b]=e.rhombIds;
    const A=F[a],B=F[b];
    // dihedral along the shared edge, measured on the solid
    const ea=P[e.v1],eb=P[e.v2];
    const axis=nrm(sub(eb,ea));
    const proj=(v)=>{const w=sub(v,ea);return sub(w,mul(axis,dot(w,axis)));};
    const oa=A.vid.filter(v=>v!==e.v1&&v!==e.v2).map(v=>proj(P[v]));
    const ob=B.vid.filter(v=>v!==e.v1&&v!==e.v2).map(v=>proj(P[v]));
    const ma=mul(add(oa[0],oa[1]),0.5), mb=mul(add(ob[0],ob[1]),0.5);
    const ang=Math.acos(Math.max(-1,Math.min(1,dot(nrm(ma),nrm(mb)))))*180/Math.PI;
    const dih=Math.round(ang);   // interior dihedral
    const fold=180-dih;
    foldHist[fold]=(foldHist[fold]??0)+1;
    const shared = (A.cAbove===B.cAbove)||(A.cBelow===B.cBelow)||(A.cAbove===B.cBelow)||(A.cBelow===B.cAbove);
    if(fold===36){ if(shared){same36++; uni(a,b);} else diff36++; }
    else if(shared) same_not36++;
  }
  const comp={};
  for(let i=0;i<F.length;i++){const r=find(i);comp[r]=(comp[r]??0)+1;}
  const compSizes={};
  for(const v of Object.values(comp))compSizes[v]=(compSizes[v]??0)+1;

  // ── centers ──────────────────────────────────────────────────────
  const votes=new Map();
  for(const f of F) for(const [k,s] of [[f.cAbove,+1],[f.cBelow,-1]]){
    if(!votes.has(k))votes.set(k,{f:[],s,c:k.split(",").map(x=>x/1e6)});
    votes.get(k).f.push(f);
  }
  const vh={};
  for(const v of votes.values())vh[v.f.length]=(vh[v.f.length]??0)+1;

  console.log(`\n=== ${seed} gen ${gen} — ${F.length} rhombi, ${eList.length} interior edges ===`);
  console.log("  fold histogram:",JSON.stringify(foldHist));
  console.log(`  36° edges whose two faces share a center: ${same36}; that do NOT: ${diff36}`);
  console.log(`  non-36° edges whose two faces DO share a center: ${same_not36}`);
  console.log("  36°-connected component sizes:",JSON.stringify(compSizes));
  console.log("  vote histogram:",JSON.stringify(vh));

  // thick/thin makeup of each vote group
  const mk={};
  for(const v of votes.values()){
    const t=v.f.filter(f=>f.thick).length, n=v.f.length-t;
    mk[`${v.f.length}:${t}T${n}t`]=(mk[`${v.f.length}:${t}T${n}t`]??0)+1;
  }
  console.log("  vote group makeup:",JSON.stringify(mk));

  // where do full caps project to?  compare with P1 tile centers
  const full=[...votes.values()].filter(v=>v.f.length===10);
  const p1={};
  for(const v of full){
    const cl=v.f.reduce((a,f)=>(a[f.cluster]=(a[f.cluster]??0)+1,a),{});
    const sig=Object.entries(cl).sort().map(([k,n])=>`${k}${n}`).join("+");
    p1[`${v.s>0?"bowl":"hat"} ${sig}`]=(p1[`${v.s>0?"bowl":"hat"} ${sig}`]??0)+1;
  }
  console.log("  full caps by cluster makeup:",JSON.stringify(p1));

  // vertex figures at the apex of full caps
  const figs={};
  for(const v of full){
    const cnt=new Map();
    for(const f of v.f) for(const q of f.vid) cnt.set(q,(cnt.get(q)??0)+1);
    const apex=[...cnt.entries()].filter(([,c])=>c===5).map(([q])=>q);
    for(const a of apex){
      const deg=vertexList[a].rhombIds.length;
      figs[`${v.s>0?"bowl":"hat"} apexDeg${deg} idx${vertexList[a].index}`]=
        (figs[`${v.s>0?"bowl":"hat"} apexDeg${deg} idx${vertexList[a].index}`]??0)+1;
    }
  }
  console.log("  full-cap apex vertices:",JSON.stringify(figs));
  return {F,votes,P};
}

for(const [s,g] of [["Pe5",3],["Pe3",3],["St5",3],["Deca",3],["Pe3",4]]) analyze(s,g);
