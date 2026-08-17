import { seedTypes, generatePatch, allRhombs, allP1Tiles, vertexMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5),PHI=(1+S5)/2;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const A6=[...E5.map(v=>[...v]),[0,0,1]];
const RHO=Math.sqrt(1+2/S5);
// RT support function h(u) = 1/2 sum |u.a_i|
const supp=(u)=>{let s=0;for(const a of A6)s+=Math.abs(dot(u,a));return s/2;};
// two RTs (same orientation) intersect iff difference vector d is inside the Minkowski sum = 2x RT
const insideRT2=(d)=>{ // is d strictly inside 2*RT ?  test all 30 face normals
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const u=nrm(crs(A6[i],A6[j]));
    if(Math.abs(dot(u,d))>2*RHO+1e-9)return false;}
  return true;
};
for(const [s,gen] of [["Pe5",3],["Deca",3],["Sun",3],["Pe3",4]]){
  const q=console.log;console.log=()=>{};generatePatch(seedTypes.findIndex(t=>t.label===s),true,gen);console.log=q;
  const lift=computeLift(),N=lift.n,P=N.map(nv=>nv?pos3D(nv):null);
  const groups=new Map();
  for(const r of allRhombs){
    const vid=r.verts.map(pt=>vertexMap.get(roundKey(pt)).id),qv=vid.map(v=>P[v]);
    let u=nrm(crs(sub(qv[1],qv[0]),sub(qv[3],qv[0])));if(u[2]<0)u=mul(u,-1);
    const ctr=mul(qv.reduce((a,b)=>add(a,b),[0,0,0]),1/4);
    const n0=vid.map(v=>N[v]).reduce((a,b)=>a.map((x,i)=>Math.min(x,b[i])));
    const d1=N[vid[1]].map((x,i)=>x-N[vid[0]][i]),d3=N[vid[3]].map((x,i)=>x-N[vid[0]][i]);
    const j=d1.findIndex(x=>x!==0),k=d3.findIndex(x=>x!==0);
    for(const sz of [1,-1]){const m=new Array(6);
      for(let i=0;i<5;i++)m[i]=(i===j||i===k)?2*n0[i]+1:2*n0[i]+(Math.sign(dot(mul(u,sz),A6[i]))||1);
      m[5]=Math.sign(dot(mul(u,sz),A6[5]))||1;const kk=m.join(",");
      if(!groups.has(kk))groups.set(kk,{m,c:m.reduce((acc,mi,i)=>add(acc,mul(A6[i],mi/2)),[0,0,0]),f:[]});
      groups.get(kk).f.push(r);}
  }
  const full=[...groups.values()].filter(g=>g.f.length===10);
  let minD=Infinity,over=0,pairs=0,touch=0;
  for(let a=0;a<full.length;a++)for(let b=a+1;b<full.length;b++){
    const d=sub(full[a].c,full[b].c);const L=Math.hypot(...d);minD=Math.min(minD,L);pairs++;
    if(insideRT2(d))over++;else{ // check touching: some |u.d| == 2 rho
      for(let i=0;i<6;i++)for(let jj=i+1;jj<6;jj++){const u=nrm(crs(A6[i],A6[jj]));
        if(Math.abs(Math.abs(dot(u,d))-2*RHO)<1e-9){touch++;i=99;break;}}}
  }
  console.log(`${s} gen ${gen}: ${full.length} complete triacontahedra; min center distance ${minD.toFixed(4)} (2ρ=${(2*RHO).toFixed(4)}); interpenetrating pairs ${over}/${pairs}; face-touching pairs ${touch}`);
}
