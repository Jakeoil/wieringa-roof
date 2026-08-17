import { E5 } from "../../dist/geometry.js";
const S5=Math.sqrt(5);
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
const A6=[...E5.map(v=>[...v]),[0,0,1]];
const names={6:"triacontahedron (6 axes)",5:"rhombic icosahedron (5 axes)",4:"Bilinski dodecahedron (4 axes)",3:"rhombohedron (3 axes)"};
function test(idx){
  const G=idx.map(i=>A6[i]);
  const out=[];
  for(let a=0;a<G.length;a++)for(let b=a+1;b<G.length;b++)for(const s of [1,-1]){
    const u=mul(nrm(crs(G[a],G[b])),s);
    let off=[0,0,0];
    for(let m=0;m<G.length;m++){if(m===a||m===b)continue;off=add(off,mul(G[m],Math.sign(dot(u,G[m]))/2));}
    const d=dot(off,u), perp=Math.hypot(...sub(off,mul(u,d)));
    out.push({pair:[idx[a],idx[b]],d,perp,uz:u[2]});
  }
  const ds=[...new Set(out.map(o=>o.d.toFixed(9)))].sort();
  const maxPerp=Math.max(...out.map(o=>o.perp));
  console.log(`${names[G.length]||G.length+" axes"}  axes=[${idx}]  faces=${out.length}`);
  console.log(`   distinct face-plane distances: ${ds.join(", ")}`);
  console.log(`   max perpendicular residual (center offset ∥ normal?): ${maxPerp.toExponential(2)}`);
}
test([0,1,2,3,4,5]);
test([0,1,2,3,4]);       // rhombic icosahedron: the five roof generators
test([0,1,2,3,5]);       // four horizontal + vertical
test([0,1,2,3]);         // Bilinski candidates
test([0,1,2,5]);
test([0,1,4,5]);
test([0,1,2]);
test([0,1,5]);
