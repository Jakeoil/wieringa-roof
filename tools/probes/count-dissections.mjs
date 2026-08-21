// How many dissections of the triacontahedron into twenty golden rhombic hexahedra?
//
// A cell is a triple T of the six axes plus a sign vector on the other three: it fixes
// c_m = ±1 off T and lets the three in T run. That is the standard parameterization of a
// fine zonotopal tiling (offsets 0/1 in the [0,1] convention), so the enumeration below
// is over all of them.
//
// The earlier attempt compared rotated dissections by rounded float keys and concluded
// the set was not closed under rotation. That conclusion was an artifact of the keys.
// Here a group element is reduced to a *permutation with signs* of the six axes, and
// everything after that is integer arithmetic.
import { A6 } from "../../dist/centers.js";
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];

const triples=[]; for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)for(let k=j+1;k<6;k++)triples.push([i,j,k]);
const tIndex=new Map(triples.map((T,i)=>[T.join(""),i]));
const cell=(ti,s)=>{
  const T=triples[ti], rest=[0,1,2,3,4,5].filter(m=>!T.includes(m));
  const sig=[(s&1)?1:-1,(s&2)?1:-1,(s&4)?1:-1];
  const c=[0,0,0];
  rest.forEach((m,q)=>{for(let d=0;d<3;d++)c[d]+=sig[q]*A6[m][d]/2;});
  return {T,rest,sig,c,e:T.map(m=>A6[m].map(x=>x/2))};
};
const CELLS=triples.map((_,ti)=>[0,1,2,3,4,5,6,7].map(s=>cell(ti,s)));

const EPS=1e-7;
function disjoint(P,Q){
  const axes=[];
  for(const p of [P,Q]) for(let i=0;i<3;i++) axes.push(crs(p.e[i],p.e[(i+1)%3]));
  for(const u of P.e) for(const v of Q.e) axes.push(crs(u,v));
  const d=sub(Q.c,P.c);
  for(const L of axes){ const n=Math.hypot(...L); if(n<1e-12)continue;
    const u=L.map(x=>x/n);
    const r1=P.e.reduce((s,e)=>s+Math.abs(dot(e,u)),0), r2=Q.e.reduce((s,e)=>s+Math.abs(dot(e,u)),0);
    if(Math.abs(dot(d,u))>r1+r2-EPS) return true; }
  return false;
}
const ok=[]; for(let i=0;i<20;i++){ok[i]=[];for(let a=0;a<8;a++){ok[i][a]=[];
  for(let j=0;j<20;j++){ok[i][a][j]=[];for(let b=0;b<8;b++) ok[i][a][j][b]= i===j?a===b:disjoint(CELLS[i][a],CELLS[j][b]);}}}
const sols=[]; const pick=new Array(20);
(function go(i){ if(i===20){sols.push(pick.slice());return;}
  for(let a=0;a<8;a++){ let good=true;
    for(let j=0;j<i;j++) if(!ok[i][a][j][pick[j]]){good=false;break;}
    if(good){pick[i]=a;go(i+1);} } })(0);
console.log(`dissections, positions fixed in space: ${sols.length}`);

// ── the symmetry group, as signed permutations of the six axes ────
const signed=[]; for(let i=0;i<6;i++) for(const s of [1,-1]) signed.push({v:A6[i].map(x=>x*s),m:i,s});
const G=[];
for(const u of signed) for(const v of signed){
  if(Math.abs(dot(u.v,v.v)-dot(A6[0],A6[1]))>1e-9) continue;
  for(const hand of [1,-1]){
    const B=[A6[0],A6[1],crs(A6[0],A6[1])], C=[u.v,v.v,crs(u.v,v.v).map(x=>x*hand)];
    const det=dot(B[0],crs(B[1],B[2]));
    const inv=[crs(B[1],B[2]),crs(B[2],B[0]),crs(B[0],B[1])].map(r=>r.map(x=>x/det));
    const M=[0,1,2].map(r=>[0,1,2].map(c=>C[0][r]*inv[0][c]+C[1][r]*inv[1][c]+C[2][r]*inv[2][c]));
    const ap=p=>[0,1,2].map(r=>M[r][0]*p[0]+M[r][1]*p[1]+M[r][2]*p[2]);
    // reduce to a signed permutation of the axes; reject if it is not one
    const pi=[], ep=[]; let good=true;
    for(let m=0;m<6&&good;m++){
      const w=ap(A6[m]);
      const hit=signed.find(t=>Math.hypot(...sub(w,t.v))<1e-9);
      if(!hit){good=false;break;}
      pi[m]=hit.m; ep[m]=hit.s;
    }
    if(good && new Set(pi).size===6) G.push({pi,ep,det:hand});
  }
}
// dedupe
const seenG=new Set(); const GG=[];
for(const g of G){ const k=g.pi.join("")+"|"+g.ep.join(""); if(!seenG.has(k)){seenG.add(k);GG.push(g);} }
console.log(`symmetry group of the solid: ${GG.length} elements (${GG.filter(g=>g.det>0).length} rotations, ${GG.filter(g=>g.det<0).length} with reflection)`);

// ── act on a dissection, combinatorially ──────────────────────────
const canon=(sol)=>{
  // a dissection as a sorted list of "triple:signs on the sorted complement"
  const items=sol.map((a,ti)=>{
    const c=CELLS[ti][a];
    const parts=c.rest.map((m,q)=>`${m}${c.sig[q]>0?"+":"-"}`);
    return `${c.T.join("")}:${parts.join("")}`;
  });
  return items.sort().join("|");
};
const act=(sol,g)=>{
  const out=new Array(20);
  sol.forEach((a,ti)=>{
    const c=CELLS[ti][a];
    const T2=c.T.map(m=>g.pi[m]).sort((x,y)=>x-y);
    const ti2=tIndex.get(T2.join(""));
    const rest2=[0,1,2,3,4,5].filter(m=>!T2.includes(m));
    // sigma'_{pi(m)} = sigma_m * epsilon_m
    const s2=new Array(3);
    c.rest.forEach((m,q)=>{ s2[rest2.indexOf(g.pi[m])] = c.sig[q]*g.ep[m]; });
    let bits=0; s2.forEach((v,q)=>{ if(v>0) bits|=(1<<q); });
    out[ti2]=bits;
  });
  return out;
};
const keys=sols.map(canon);
const keySet=new Set(keys);
let closed=0;
for(const g of GG) for(const sol of [sols[0]]) if(keySet.has(canon(act(sol,g)))) closed++;
console.log(`\nis the set closed under the group? images of dissection 0 that are listed: ${closed} of ${GG.length}`);

// orbits and stabilisers
const idx=new Map(keys.map((k,i)=>[k,i]));
const seen=new Array(sols.length).fill(false);
const orbits=[];
for(let i=0;i<sols.length;i++){
  if(seen[i])continue;
  const orb=new Set();
  for(const g of GG){ const k=canon(act(sols[i],g)); const j=idx.get(k); if(j!==undefined){orb.add(j);seen[j]=true;} }
  orbits.push(orb.size);
}
console.log(`orbits under the full group: ${orbits.length}   sizes ${JSON.stringify(orbits)}`);
console.log(`stabiliser orders: ${JSON.stringify(orbits.map(o=>GG.length/o))}`);
console.log(`\n=> dissections up to rotation and reflection: ${orbits.length}`);

// ── which is which, and what the symmetric one's symmetry is ──────
const orbOf=new Array(sols.length).fill(-1);
{
  let o=0; const done=new Array(sols.length).fill(false);
  for(let i=0;i<sols.length;i++){
    if(done[i])continue;
    for(const g of GG){ const j=idx.get(canon(act(sols[i],g))); if(j!==undefined){done[j]=true;orbOf[j]=o;} }
    o++;
  }
}
// the page's dissection is whatever the backtracking returns first
const pageKey=canon(sols[0]);
console.log(`\nthe page's dissection is in orbit ${orbOf[0]} (size ${orbits[orbOf[0]]}, stabiliser ${GG.length/orbits[orbOf[0]]})`);
// find a representative of the small orbit and describe its stabiliser
const small=orbits.indexOf(40);
const rep=orbOf.indexOf(small);
const stab=GG.filter(g=>canon(act(sols[rep],g))===canon(sols[rep]));
console.log(`the other dissection: orbit size ${orbits[small]}, stabiliser order ${stab.length}`);
for(const g of stab){
  // order of the element, and whether it is a rotation
  let n=1, cur={pi:g.pi.slice(),ep:g.ep.slice()};
  const idp=[0,1,2,3,4,5];
  const compose=(a,b)=>({pi:idp.map(m=>a.pi[b.pi[m]]),ep:idp.map(m=>a.ep[b.pi[m]]*b.ep[m])});
  while(!(cur.pi.every((v,m)=>v===m)&&cur.ep.every(v=>v===1))){ cur=compose(g,cur); n++; if(n>10)break; }
  console.log(`   stabiliser element: order ${n}, ${g.det>0?"rotation":"reflection"}, axis permutation ${g.pi.join("")}`);
}
// makeup: does the symmetric one still have 10 acute + 10 obtuse?
const vol=(T)=>Math.abs(dot(A6[T[0]],crs(A6[T[1]],A6[T[2]])));
for(const [name,si] of [["page's",0],["symmetric",rep]]){
  const ac=sols[si].filter((a,ti)=>vol(triples[ti])>0.6).length;
  console.log(`   ${name} dissection: ${ac} acute, ${20-ac} obtuse`);
}
