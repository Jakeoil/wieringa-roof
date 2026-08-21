// The balls as a packing in their own right: contacts, overlaps, connectivity.
import { seedTypes, generatePatch } from "../../dist/geometry.js";
import { triacontahedra, RHO } from "../../dist/centers.js";
const P = new Set(["4=4T+0t", "5=5T+0t", "5=3T+2t", "10=5T+5t"]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
for (const [seed, gen] of [["Sun", 3], ["Sun", 4], ["Star", 4], ["Deca", 4]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    const c = triacontahedra(); console.log = q;
    const B = c.solids.filter((s) => P.has(s.makeup) && s.settled && s.homeCount > 0);
    // grid bucket, cell = 2rho
    const cell = 2 * RHO, key = (p) => p.map((x) => Math.floor(x / cell)).join(",");
    const grid = new Map();
    B.forEach((s, i) => { const k = key(s.c); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
    const near = (i) => {
        const [a, b, cc] = B[i].c.map((x) => Math.floor(x / cell));
        const out = [];
        for (let x = a - 1; x <= a + 1; x++) for (let y = b - 1; y <= b + 1; y++) for (let z = cc - 1; z <= cc + 1; z++)
            for (const j of grid.get(`${x},${y},${z}`) ?? []) if (j !== i) out.push(j);
        return out;
    };
    const contacts = B.map(() => 0), overlaps = B.map(() => 0);
    const adj = B.map(() => []);
    let cPairs = 0, oPairs = 0;
    for (let i = 0; i < B.length; i++) for (const j of near(i)) {
        if (j < i) continue;
        const D = d3(B[i].c, B[j].c);
        if (Math.abs(D - 2 * RHO) < 1e-9) { contacts[i]++; contacts[j]++; adj[i].push(j); adj[j].push(i); cPairs++; }
        else if (D < 2 * RHO - 1e-9) { overlaps[i]++; overlaps[j]++; oPairs++; }
    }
    const hist = (a) => { const h = {}; for (const v of a) h[v] = (h[v] ?? 0) + 1; return h; };
    // connectivity of the contact graph
    const seen = new Array(B.length).fill(false); let comps = 0, biggest = 0;
    for (let i = 0; i < B.length; i++) { if (seen[i]) continue; comps++; let n = 0;
        const st = [i]; seen[i] = true;
        while (st.length) { const x = st.pop(); n++; for (const y of adj[x]) if (!seen[y]) { seen[y] = true; st.push(y); } }
        biggest = Math.max(biggest, n); }
    console.log(`${seed} gen ${gen}: ${B.length} balls, radius ρ=${RHO.toFixed(4)}`);
    console.log(`   contacts ${cPairs} pairs · per ball ${JSON.stringify(hist(contacts))}`);
    console.log(`   overlaps ${oPairs} pairs · per ball ${JSON.stringify(hist(overlaps))}`);
    console.log(`   contact graph: ${comps} components, largest ${biggest} (${((100*biggest)/B.length).toFixed(1)}%)`);
}
