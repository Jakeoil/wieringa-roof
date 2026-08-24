// Independent check of the clip: the algorithm from centers3d.ts, re-implemented here
// and measured against Monte Carlo.
import { seedTypes, generatePatch } from
    "/Users/jakeoil/projects/claude-projects/math-legacy/wieringa-roof/dist/geometry.js";
import { triacontahedra, ownedFaceIndices, RT_FACES, MIDRADIUS } from
    "/Users/jakeoil/projects/claude-projects/math-legacy/wieringa-roof/dist/centers.js";
const R = MIDRADIUS;
const MAKEUP = { "4=4T+0t":"4", "5=5T+0t":"5a", "5=3T+2t":"5b", "10=5T+5t":"10" };
const COLOR = { "4":"amber","5a":"green","5b":"purple","10":"blue" };

// ---- the same unit mesh centers3d.ts uses
function sphericalPatches(faces, steps = 5) {
  const pos = [];
  const unit = (p) => { const L = Math.hypot(p[0],p[1],p[2])||1; return [p[0]/L,p[1]/L,p[2]/L]; };
  for (const fi of faces) { const f = RT_FACES[fi];
    const at = (i,j) => { const u=i/steps, v=j/steps, q=[0,0,0];
      for (let d=0;d<3;d++) q[d]=f[0][d]*(1-u)*(1-v)+f[1][d]*u*(1-v)+f[2][d]*u*v+f[3][d]*(1-u)*v;
      return unit(q); };
    for (let i=0;i<steps;i++) for (let j=0;j<steps;j++) {
      const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),e=at(i,j+1);
      for (const q of [a,b,c,a,c,e]) pos.push(q[0],q[1],q[2]); } }
  return new Float32Array(pos);
}
const MESH = sphericalPatches(RT_FACES.map((_,i)=>i));

function arcCross(a,b,u,k){
  const A=a[0]*u[0]+a[1]*u[1]+a[2]*u[2];
  const B=(b[0]-a[0])*u[0]+(b[1]-a[1])*u[1]+(b[2]-a[2])*u[2];
  const q=2*(1-(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));
  const c2=B*B-k*k*q, c1=2*A*B+k*k*q, c0=A*A-k*k;
  const at=(t)=>{const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
    const L=Math.hypot(x,y,z)||1; return [x/L,y/L,z/L];};
  const miss=(t)=>{const v=at(t); return Math.abs(v[0]*u[0]+v[1]*u[1]+v[2]*u[2]-k);};
  const cand=[];
  if (Math.abs(c2)<1e-12){ if(Math.abs(c1)>1e-12) cand.push(-c0/c1); }
  else { const r=Math.sqrt(Math.max(0,c1*c1-4*c2*c0)); cand.push((-c1+r)/(2*c2),(-c1-r)/(2*c2)); }
  let best=-1,bm=Infinity;
  for(const t of cand){ if(t<-1e-9||t>1+1e-9) continue; const m=miss(t); if(m<bm){bm=m;best=t;} }
  if(bm>1e-9){
    const g=(t)=>{const v=at(t);return v[0]*u[0]+v[1]*u[1]+v[2]*u[2]-k;};
    let lo=0,hi=1; const gLo=g(0);
    for(let i=0;i<40;i++){const mid=(lo+hi)/2; if((g(mid)<0)===(gLo<0)) lo=mid; else hi=mid;}
    best=(lo+hi)/2; bm=Math.abs(g(best));
  }
  return { p: at(Math.min(1,Math.max(0,best))), miss: bm };
}
function clipPoly(poly,u,k,acc){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length];
    const da=a[0]*u[0]+a[1]*u[1]+a[2]*u[2]-k, db=b[0]*u[0]+b[1]*u[1]+b[2]*u[2]-k;
    if(da<0) out.push(a);
    if((da<0)!==(db<0)){ const r=arcCross(a,b,u,k); acc.push(r.miss); out.push(r.p); }
  }
  return out;
}
function voronoiPlanes(c,r,hat,others,reach){
  const out=[{u:[0,0,hat?-1:1],k:0}]; if(reach) reach.push(null);
  for(const o of others){
    const dx=o.c[0]-c[0],dy=o.c[1]-c[1],dz=o.c[2]-c[2],d=Math.hypot(dx,dy,dz);
    if(d<1e-9||d>=r+o.r) continue;
    const k=(d*d+r*r-o.r*o.r)/(2*d*r);
    if(k>=1) continue;
    out.push({u:[dx/d,dy/d,dz/d],k}); if(reach) reach.push(o);
  }
  return out;
}
// solid angle of a spherical triangle (l'Huilier)
function sphTri(a,b,c){
  const ang=(x,y)=>Math.acos(Math.max(-1,Math.min(1,x[0]*y[0]+x[1]*y[1]+x[2]*y[2])));
  const A=ang(b,c),B=ang(a,c),C=ang(a,b),s=(A+B+C)/2;
  const t=Math.tan(s/2)*Math.tan((s-A)/2)*Math.tan((s-B)/2)*Math.tan((s-C)/2);
  return 4*Math.atan(Math.sqrt(Math.max(0,t)));
}
const TRIS_PER_FACE = 5*5*2;
function cellArea(clips,accMiss,owned){
  let area=0;
  for(let t=0,tri=0;t<MESH.length;t+=9,tri++){
    let poly=[[MESH[t],MESH[t+1],MESH[t+2]],[MESH[t+3],MESH[t+4],MESH[t+5]],[MESH[t+6],MESH[t+7],MESH[t+8]]];
    for(const c of (owned.has(Math.floor(tri/TRIS_PER_FACE))?[]:clips)){
      let anyIn=false,anyOut=false;
      for(const v of poly){ if(v[0]*c.u[0]+v[1]*c.u[1]+v[2]*c.u[2]-c.k<0) anyIn=true; else anyOut=true; }
      if(!anyOut) continue;
      if(!anyIn){ poly=[]; break; }
      poly=clipPoly(poly,c.u,c.k,accMiss);
      if(poly.length<3){ poly=[]; break; }
    }
    for(let i=1;i+1<poly.length;i++) area+=sphTri(poly[0],poly[i],poly[i+1]);
  }
  return area/(4*Math.PI);
}

const faceOf=(v)=>{let bi=0,bd=-2;for(let i=0;i<30;i++){const d=v[0]*N30[i][0]+v[1]*N30[i][1]+v[2]*N30[i][2];if(d>bd){bd=d;bi=i;}}return bi;};
const M=40000,GA=Math.PI*(3-Math.sqrt(5)),DIRS=[];
for(let k=0;k<M;k++){const z=1-(2*k+1)/M,r=Math.sqrt(Math.max(0,1-z*z)),t=GA*k;
  DIRS.push([r*Math.cos(t),r*Math.sin(t),z]);}
const N30 = RT_FACES.map((f)=>{const c=[0,0,0];for(const q of f)for(let d=0;d<3;d++)c[d]+=q[d]/4;
  const L=Math.hypot(...c);return [c[0]/L,c[1]/L,c[2]/L];});

for (const seed of ["Sun","Star"]) {
  const idx=seedTypes.findIndex((s)=>s.label===seed);
  const q=console.log; console.log=()=>{}; generatePatch(idx,true,2); console.log=q;
  const cen=triacontahedra();
  const proper=cen.solids.map((s)=>({s,k:MAKEUP[s.makeup]})).filter((x)=>x.k);
  const cells=proper.map((x)=>({c:x.s.c,r:R,k:x.k,s:x.s,hat:x.s.hat}));
  const st={}; const miss=[]; let onOther=0,onOtherBad=0, ownLost=0, ownTot=0;
  for(const b of cells){
    const others=cells.filter((o)=>o!==b);
    const reach=[]; const clips=voronoiPlanes(b.c,b.r,b.s.hat,others,reach);
    const acc=[];
    const ownedSet=new Set(ownedFaceIndices(cen,b.s));
    const area=cellArea(clips,acc,ownedSet);
    miss.push(...acc);
    // Monte Carlo: outside every neighbour ball
    let mc=0, own=0, lost=0;
    const owned=ownedSet;
    for(const v of DIRS){
      const inOwn = owned.has(faceOf(v));
      let out = inOwn || (v[2]*(b.s.hat?1:-1) > 0);
      if(out && !inOwn) for(const o of others){
        const dx=b.c[0]+R*v[0]-o.c[0],dy=b.c[1]+R*v[1]-o.c[1],dz=b.c[2]+R*v[2]-o.c[2];
        if(dx*dx+dy*dy+dz*dz<R*R-1e-12){out=false;break;}
      }
      if(out) mc++;
      let bi=0,bd=-2;
      for(let i=0;i<30;i++){const d=v[0]*N30[i][0]+v[1]*N30[i][1]+v[2]*N30[i][2];if(d>bd){bd=d;bi=i;}}
      if(owned.has(bi)){ own++; if(!out) lost++; }
    }
    ownTot+=own; ownLost+=lost;
    (st[b.k] ??= {n:0,a:0,mc:0,cl:0});
    st[b.k].n++; st[b.k].a+=area; st[b.k].mc+=mc/M; st[b.k].cl+=clips.length;
    // does A's meeting circle with B lie on B's sphere?
    for(let ci=0;ci<clips.length;ci++){ const cl=clips[ci]; const other=reach[ci];
      const rad=Math.sqrt(Math.max(0,1-cl.k*cl.k));
      const seedv=Math.abs(cl.u[2])<0.9?[0,0,1]:[1,0,0];
      const e1=(()=>{const c0=[cl.u[1]*seedv[2]-cl.u[2]*seedv[1],cl.u[2]*seedv[0]-cl.u[0]*seedv[2],cl.u[0]*seedv[1]-cl.u[1]*seedv[0]];
        const L=Math.hypot(...c0);return [c0[0]/L,c0[1]/L,c0[2]/L];})();
      const e2=[cl.u[1]*e1[2]-cl.u[2]*e1[1],cl.u[2]*e1[0]-cl.u[0]*e1[2],cl.u[0]*e1[1]-cl.u[1]*e1[0]];
      if(!other) continue;
      for(let t=0;t<12;t++){
        const a=(t/12)*2*Math.PI;
        const p=[b.c[0]+R*(cl.u[0]*cl.k+(e1[0]*Math.cos(a)+e2[0]*Math.sin(a))*rad),
                 b.c[1]+R*(cl.u[1]*cl.k+(e1[1]*Math.cos(a)+e2[1]*Math.sin(a))*rad),
                 b.c[2]+R*(cl.u[2]*cl.k+(e1[2]*Math.cos(a)+e2[2]*Math.sin(a))*rad)];
        const dd=Math.hypot(p[0]-other.c[0],p[1]-other.c[1],p[2]-other.c[2]);
        onOther++; if(Math.abs(dd-R)>1e-9) onOtherBad++;
      }
    }
  }
  console.log("=".repeat(70));
  console.log(`${seed} gen 2 — Voronoi cell, share of each ball's surface`);
  console.log("  class          n  clips   clipped   monte carlo   n/30 owned");
  for(const k of ["4","5a","5b","10"]){const s=st[k];if(!s)continue;
    const own = k==="4"?4/30:k==="10"?10/30:5/30;
    console.log(`  ${(k+" ("+COLOR[k]+")").padEnd(13)} ${String(s.n).padStart(2)}  ${(s.cl/s.n).toFixed(1).padStart(4)}   ${(100*s.a/s.n).toFixed(2).padStart(6)}%      ${(100*s.mc/s.n).toFixed(2).padStart(6)}%      ${(100*own).toFixed(1)}%`);}
  console.log(`  worst plane-crossing error: ${Math.max(...miss).toExponential(2)}  (${miss.length} crossings)`);
  console.log(`  meeting-circle points that also lie on the other ball: ${onOther-onOtherBad}/${onOther}`);
  console.log(`  footprint kept by the cell: ${(100*(1-ownLost/ownTot)).toFixed(2)}%  (must be 100)`);
  console.log();
}
