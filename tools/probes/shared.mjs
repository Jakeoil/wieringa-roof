// Which rhomb of a class 4 is shared with which rhomb of a class 5b?
import { seedTypes, generatePatch, allRhombs } from "../../dist/geometry.js";
import { triacontahedra, A6 } from "../../dist/centers.js";
const mul=(a,s)=>a.map(x=>x*s), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));
// the ten orientations in azimuth order: slots alternate thick, thin
const ORI=[]; for(let j=0;j<5;j++)for(let k=j+1;k<5;k++){let u=nrm(crs(A6[j],A6[k]));if(u[2]<0)u=mul(u,-1);
  ORI.push({j,k,u,thick:Math.min((j-k+5)%5,(k-j+5)%5)===1});}
ORI.sort((a,b)=>Math.atan2(a.u[1],a.u[0])-Math.atan2(b.u[1],b.u[0]));
const slotOf=(pair)=>ORI.findIndex(o=>Math.min(o.j,o.k)===pair[0]&&Math.max(o.j,o.k)===pair[1]);

/** the solid's ten-slot presence string, and the rotation that canonicalizes it */
function canon(bits){
  let best=null,br=0;
  for(let r=0;r<10;r+=2){
    const s=bits.map((_,i)=>bits[(i+r)%10]).join("");
    if(best===null||s<best){best=s;br=r;}
  }
  return {pattern:best,r:br};
}
const PROPER=new Set(["4=4T+0t","5=5T+0t","5=3T+2t","10=5T+5t"]);

const tally={}, per4={}, per5={}, thickness={};
let shared=0;
const seen4=new Set(), seen5=new Set(), all4=new Set(), all5=new Set();
for(const [seed,gen] of [["Sun",3],["Sun",4],["Star",4],["Deca",4]]){
  const q=console.log;console.log=()=>{};
  generatePatch(seedTypes.findIndex(s=>s.label===seed),true,gen);
  const c=triacontahedra();console.log=q;
  const bitsOf=new Map(), canonOf=new Map();
  for(const s of c.solids){
    const b=new Array(10).fill(0);
    for(const fid of s.faces) b[slotOf(c.byRhomb[fid].pair)]=1;
    bitsOf.set(s.id,b); canonOf.set(s.id,canon(b));
  }
  for(const s of c.solids){ if(s.makeup==="4=4T+0t")all4.add(`${seed}${gen}:${s.id}`);
                            if(s.makeup==="5=3T+2t")all5.add(`${seed}${gen}:${s.id}`); }
  const cnt4={}, cnt5={};
  for(const f of c.faces){
    const [A,B]=f.solids.map(i=>c.solids[i]);
    if(!PROPER.has(A.makeup)||!PROPER.has(B.makeup))continue;
    const s4=A.makeup==="4=4T+0t"?A:B, s5=A.makeup==="4=4T+0t"?B:A;
    if(s4.makeup!=="4=4T+0t"||s5.makeup!=="5=3T+2t"){tally[`OTHER ${A.makeup}+${B.makeup}`]=(tally[`OTHER ${A.makeup}+${B.makeup}`]??0)+1;continue;}
    shared++;
    seen4.add(`${seed}${gen}:${s4.id}`); seen5.add(`${seed}${gen}:${s5.id}`);
    cnt4[s4.id]=(cnt4[s4.id]??0)+1; cnt5[s5.id]=(cnt5[s5.id]??0)+1;
    const sl=slotOf(f.pair);
    const idx=(s,slot)=>{const {r}=canonOf.get(s.id);return (slot-r+10)%10;};
    tally[`4@${idx(s4,sl)} + 5b@${idx(s5,sl)}`]=(tally[`4@${idx(s4,sl)} + 5b@${idx(s5,sl)}`]??0)+1;
    thickness[f.thick?"thick":"thin"]=(thickness[f.thick?"thick":"thin"]??0)+1;
  }
  for(const v of Object.values(cnt4)) per4[v]=(per4[v]??0)+1;
  for(const v of Object.values(cnt5)) per5[v]=(per5[v]??0)+1;
}
console.log("canonical patterns:  class 4 = 0010101010    class 5b = 0000111110");
console.log("slot parity: even slots are THICK, odd are THIN\n");
console.log(`shared rhombi: ${shared}   ${JSON.stringify(thickness)}`);
console.log("slot pairing (canonical index in each solid):");
for(const [k,v] of Object.entries(tally).sort((a,b)=>b[1]-a[1])) console.log(`   ${k}  x${v}`);
console.log(`\nshared rhombi per class-4 solid: ${JSON.stringify(per4)}`);
console.log(`shared rhombi per class-5b solid: ${JSON.stringify(per5)}`);
console.log(`class-4 solids involved: ${seen4.size} of ${all4.size}`);
console.log(`class-5b solids involved: ${seen5.size} of ${all5.size}`);
