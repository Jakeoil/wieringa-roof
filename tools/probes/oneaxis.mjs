// Open question 2a: two RT centres one axis apart (separation exactly 1 edge length,
// not 2rho). Is the one-face partner just an edge effect?
import { seedTypes, generatePatch, allRhombs, edgeMap } from "../../dist/geometry.js";
import { triacontahedra, A6, centerOf } from "../../dist/centers.js";
const K = (m) => m.join(",");
for (const [seed, gen] of [["Sun", 3], ["Sun", 4], ["Star", 4]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    const c = triacontahedra(); console.log = q;
    const byM = new Map(); for (const s of c.solids) byM.set(K(s.m), s);
    // a shift by one axis a_i is m -> m + 2*e_i  (centres are half-lattice, all odd)
    const pairs = [];
    for (const s of c.solids) {
        for (let i = 0; i < 6; i++) {
            const m2 = s.m.slice(); m2[i] += 2;
            const t = byM.get(K(m2));
            if (t) pairs.push([s, t]);
        }
    }
    const lens = new Set(pairs.map(([a, b]) =>
        Math.hypot(...[0,1,2].map(k => a.c[k] - b.c[k])).toFixed(6)));
    const sizes = {};
    let bothTwo = 0, oneIsOne = 0, settledOnes = 0, homeOnes = 0;
    for (const [a, b] of pairs) {
        const lo = Math.min(a.faces.length, b.faces.length);
        const hi = Math.max(a.faces.length, b.faces.length);
        sizes[`${lo}+${hi}`] = (sizes[`${lo}+${hi}`] ?? 0) + 1;
        if (lo >= 2) bothTwo++;
        else {
            oneIsOne++;
            const one = a.faces.length === 1 ? a : b;
            if (one.settled) settledOnes++;
            if (one.homeCount > 0) homeOnes++;
        }
    }
    console.log(`${seed} gen ${gen}: ${pairs.length} centre pairs one axis apart, separation ${[...lens].join("/")}`);
    console.log(`   face counts: ${Object.entries(sizes).sort().map(([k,v])=>`${k}:${v}`).join("  ")}`);
    console.log(`   pairs where BOTH hold 2 or more: ${bothTwo}`);
    console.log(`   of the ${oneIsOne} single-face partners: ${settledOnes} are settled (interior), ${homeOnes} are some rhomb's home`);
}
