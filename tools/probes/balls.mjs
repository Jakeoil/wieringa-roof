// Ping-pong balls: agnostic concurrence clusters, tangency counts, supporting-plane counts.
import { faces, meet } from "./agnostic2.mjs";
const S5=Math.sqrt(5),PHI=(1+S5)/2,RHO=Math.sqrt(1+2/S5);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// express x as (a + b√5)/2 with a,b integers, if possible
function zphi(x){
  for(let b=-80;b<=80;b++){const a=2*x-b*S5;if(Math.abs(a-Math.round(a))<1e-7)return[Math.round(a),b];}
  return null;
}
function fmt(x){const z=zphi(x);return z?`(${z[0]}${z[1]<0?"−":"+"}${Math.abs(z[1])}√5)/2`:x.toFixed(6);}

for(const [seed,gen] of [["Pe3",3],["St5",3]]){
  const F=faces(seed,gen);
  const pts=new Map();
  for(let i=0;i<F.length;i++)for(let j=i+1;j<F.length;j++){
    const m=meet(F[i],F[j]); if(!m||m.miss>1e-9)continue;
    if(Math.abs(Math.abs(m.t)-Math.abs(m.s))>1e-9)continue;
    const k=m.p.map(v=>Math.round(v*1e6)).join(",");
    if(!pts.has(k))pts.set(k,m.p);
  }
  console.log(`\n=== ${seed} gen ${gen}: ${F.length} faces, ${pts.size} equal-radius concurrence points ===`);
  // for each point, bucket faces by |t| (tangency) and by plane distance (supporting plane)
  const byRatio=new Map();     // r/rho -> {tangentCounts:[], planeCounts:[]}
  for(const p of pts.values()){
    const tang=new Map(), plane=new Map();
    for(const f of F){
      const w=sub(p,f.c);
      const t=dot(w,f.u);
      const perp=Math.hypot(...sub(w,[f.u[0]*t,f.u[1]*t,f.u[2]*t]));
      const rk=Math.abs(t).toFixed(6);
      if(perp<1e-9) tang.set(rk,(tang.get(rk)??0)+1);       // p is ON the normal line
      plane.set(rk,(plane.get(rk)??0)+1);                    // plane at that distance
    }
    for(const [rk,n] of tang){
      const ratio=(Number(rk)/RHO).toFixed(6);
      if(!byRatio.has(ratio))byRatio.set(ratio,{r:Number(rk),tang:[],plane:[]});
      byRatio.get(ratio).tang.push(n);
      byRatio.get(ratio).plane.push(plane.get(rk)??0);
    }
  }
  const rows=[...byRatio.entries()].sort((a,b)=>a[1].r-b[1].r);
  console.log("  r/ρ      r          edge a=r/ρ in Z[φ]?      #points   max tangent   max supporting-plane");
  for(const [ratio,v] of rows){
    if(v.tang.length<3)continue;
    console.log(`  ${Number(ratio).toFixed(6).padStart(10)} ${v.r.toFixed(6).padStart(10)}  ${(fmt(Number(ratio))||"?").padEnd(22)} ${String(v.tang.length).padStart(6)} ${String(Math.max(...v.tang)).padStart(12)} ${String(Math.max(...v.plane)).padStart(14)}`);
  }
}
