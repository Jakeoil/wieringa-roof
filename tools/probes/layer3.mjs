// Part 4, the actual question. Every roof rhomb, extruded by one of the three axes it
// does not already use, becomes a golden rhombohedron — that much is exact and local.
// What Jeff's file leaves open is global: can a third axis be chosen for every rhomb so
// that the cells fit together without overlapping?
//
// Extruding downward, by -E_l, puts the cell beneath the roof. Every generator points
// up (all share z = +1/√5), so -E_l is the only way down.
import { seedTypes, generatePatch, allRhombs, vertexList, vertexMap, roundKey, computeLift, pos3D, E5 } from "../../dist/geometry.js";

const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const crs = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];

/** Interiors only: cells of a layer are meant to touch along faces. */
function disjoint(P, Q) {
    const axes = [];
    for (const p of [P, Q]) for (let i = 0; i < 3; i++) axes.push(crs(p.e[i], p.e[(i+1)%3]));
    for (const u of P.e) for (const v of Q.e) axes.push(crs(u, v));
    const d = sub(Q.c, P.c);
    for (const L of axes) {
        const n = Math.hypot(...L); if (n < 1e-12) continue;
        const u = L.map((x) => x / n);
        const r1 = P.e.reduce((s, e) => s + Math.abs(dot(e, u)), 0);
        const r2 = Q.e.reduce((s, e) => s + Math.abs(dot(e, u)), 0);
        if (Math.abs(dot(d, u)) > r1 + r2 - 1e-7) return true;
    }
    return false;
}

for (const [seed, gen] of [["Pe3", 2], ["Pe3", 3], ["Sun", 3]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    const lift = computeLift();
    console.log = q;

    // candidate cells: rhomb r extruded down by -E_l
    const cands = allRhombs.map((r) => {
        const vi = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
        const nlo = vi.map((v) => lift.n[v]).reduce((a, b) => a.map((x, i) => Math.min(x, b[i])));
        const [j, k] = r.pair;
        const out = [];
        for (let l = 0; l < 5; l++) {
            if (l === j || l === k) continue;
            const m = nlo.slice(); m[l]--;
            const base = pos3D(m);
            const e = [j, k, l].map((a) => E5[a].map((x) => x / 2));
            const c = [0, 1, 2].map((d) => base[d] + e[0][d] + e[1][d] + e[2][d]);
            // acute when the three axes are pairwise adjacent in the five-fold order
            const gaps = [[0,1],[0,2],[1,2]].map(([x, y]) => {
                const a = [j, k, l][x], b = [j, k, l][y];
                return Math.min((a-b+5)%5, (b-a+5)%5);
            }).sort().join("");
            out.push({ rhomb: r.id, l, c, e, acute: gaps === "111" || gaps === "122" });
        }
        return out;
    });

    // greedy, most-constrained first: give every rhomb a cell if one will fit
    const order = allRhombs.map((_, i) => i).sort((a, b) => cands[a].length - cands[b].length);
    const chosen = [];
    const assigned = new Map();
    for (const i of order) {
        for (const c of cands[i]) {
            if (chosen.every((p) => disjoint(p, c))) { chosen.push(c); assigned.set(i, c); break; }
        }
    }
    const acute = chosen.filter((c) => c.acute).length;
    // does every rhomb get one?
    console.log(`\n${seed} gen ${gen}: ${allRhombs.length} rhombi`);
    console.log(`  rhombi given a cell beneath, greedily: ${assigned.size} of ${allRhombs.length}` +
        ` (${((100*assigned.size)/allRhombs.length).toFixed(1)}%)`);
    console.log(`  cells placed: ${chosen.length} — ${acute} acute, ${chosen.length - acute} obtuse` +
        `${chosen.length ? `, ratio ${(acute/Math.max(1,chosen.length-acute)).toFixed(3)}` : ""}`);
    // how many distinct cells would a full layer need?  A cell has three upper faces,
    // so if every rhomb were an upper face the count would be rhombi/3.
    console.log(`  a layer with every rhomb an upper face would need ${(allRhombs.length/3).toFixed(1)} cells`);
}
