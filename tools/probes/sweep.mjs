import { seedTypes, generatePatch, allRhombs, allP1Tiles, vertexList, vertexMap, edgeMap,
    roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5),PHI=(1+S5)/2;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const A6=[...E5.map(v=>[...v]),[0,0,1]];
const fromM=(m)=>{let c=[0,0,0];for(let i=0;i<6;i++)c=add(c,mul(A6[i],m[i]/2));return c;};
console.log("seed gen | rhombi | centers | maxGrp | 10-caps hat/bowl | Pe5 tiles | sizes 6..9 | faces on a 10-cap | greedy pieces");
let anomalies=0;
for(const s of seedTypes.map(t=>t.label)) for(const gen of [2,3,4]){
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(t=>t.label===s),true,gen);
  console.log=q;
  if(!allRhombs.length){console.log(`${s} ${gen} | empty`);continue;}
  const lift=computeLift(),N=lift.n,P=N.map(nv=>nv?pos3D(nv):null);
  const tileOf=new Map();for(const t of allP1Tiles)for(const r of t.rhombIds)tileOf.set(r,t.id);
  const groups=new Map();const F=[];
  for(const r of allRhombs){
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id),qv=vid.map(v=>P[v]);
    let u=nrm(crs(sub(qv[1],qv[0]),sub(qv[3],qv[0])));if(u[2]<0)u=mul(u,-1);
    const ctr=mul(qv.reduce((a,b)=>add(a,b),[0,0,0]),1/4);
    const n0=vid.map(v=>N[v]).reduce((a,b)=>a.map((x,i)=>Math.min(x,b[i])));
    const d1=N[vid[1]].map((x,i)=>x-N[vid[0]][i]),d3=N[vid[3]].map((x,i)=>x-N[vid[0]][i]);
    const j=d1.findIndex(x=>x!==0),k=d3.findIndex(x=>x!==0);
    const f={id:r.id,vid,ctr,u,thick:r.thick,tile:tileOf.get(r.id)};F.push(f);
    for(const sz of [1,-1]){const m=new Array(6);
      for(let i=0;i<5;i++)m[i]=(i===j||i===k)?2*n0[i]+1:2*n0[i]+(Math.sign(dot(mul(u,sz),A6[i]))||1);
      m[5]=Math.sign(dot(mul(u,sz),A6[5]))||1;const kk=m.join(",");
      if(!groups.has(kk))groups.set(kk,{m,c:fromM(m),f:[]});groups.get(kk).f.push(f);}
  }
  const sizes=[...groups.values()].map(g=>g.f.length);
  const mid=sizes.filter(x=>x>=6&&x<=9).length;
  const full=[...groups.values()].filter(g=>g.f.length===10);
  let hat=0,bowl=0;for(const g of full){if(g.c[2]<g.f[0].ctr[2])hat++;else bowl++;}
  const pe5=allP1Tiles.filter(t=>t.type==="Pe5"&&t.rhombIds.length===5).length;
  const cov=new Set();for(const g of full)for(const f of g.f)cov.add(f.id);
  const used=new Set();let pieces=0;
  for(const g of [...groups.values()].sort((a,b)=>b.f.length-a.f.length)){const t=g.f.filter(f=>!used.has(f.id));if(!t.length)continue;t.forEach(f=>used.add(f.id));pieces++;}
  if(mid||full.length!==pe5)anomalies++;
  console.log(`${s.padEnd(5)} ${gen} | ${String(allRhombs.length).padStart(5)} | ${String(groups.size).padStart(5)} | ${Math.max(...sizes)} | ${full.length} = ${hat}/${bowl} | ${pe5} | ${mid} | ${cov.size} (${(100*cov.size/allRhombs.length).toFixed(0)}%) | ${pieces}`);
}
console.log("anomalies (size 6-9 groups, or caps != Pe5 count):",anomalies);
