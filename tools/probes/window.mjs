// Closing 2a: does a one-axis shift always leave the band a home has to occupy?
//
// From §5E: a center is m (six odd integers), M = sum of the first five, and a face of
// orientation {j,k} has low-corner index (M - 2 - T)/2 with T a constant of the rhomb
// type and side — ±3 thick, ±1 thin. The roof has four index levels, so a rhombus's low
// corner must be 1 or 2. That admits thick or thin or both, and only the "both" band
// can hold more than five faces.
//
// A shift by one axis is m -> m ± 2e_i. For i < 5 that is M -> M ± 2 with the side
// unchanged; for i = 5 it flips m5, which is the side itself.
import { seedTypes, generatePatch, allRhombs } from "../../dist/geometry.js";
import { triacontahedra } from "../../dist/centers.js";

const K = (m) => m.join(",");
for (const [seed, gen] of [["Sun", 3], ["Sun", 4], ["Star", 4]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    const c = triacontahedra(); console.log = q;
    const byM = new Map(); for (const s of c.solids) byM.set(K(s.m), s);

    // band of each (M, m5) class, from the face types that actually occur in it
    const cls = new Map();
    for (const s of c.solids) {
        const M = s.m.slice(0, 5).reduce((a, b) => a + b, 0);
        const key = `${M}|${s.m[5]}`;
        if (!cls.has(key)) cls.set(key, { thick: false, thin: false, n: 0, max: 0 });
        const e = cls.get(key);
        e.n++;
        e.max = Math.max(e.max, s.faces.length);
        for (const fid of s.faces) (c.byRhomb[fid].thick ? (e.thick = true) : (e.thin = true));
    }
    const bandOf = (s) => {
        const M = s.m.slice(0, 5).reduce((a, b) => a + b, 0);
        const e = cls.get(`${M}|${s.m[5]}`);
        if (!e) return "?";
        return e.thick && e.thin ? "both" : e.thick ? "thickOnly" : e.thin ? "thinOnly" : "empty";
    };

    console.log(`\n=== ${seed} gen ${gen} ===`);
    console.log("  (M, m5) classes — band, count, largest group:");
    for (const [k, e] of [...cls.entries()].sort((a, b) => Number(a[0].split("|")[0]) - Number(b[0].split("|")[0]))) {
        const band = e.thick && e.thin ? "both" : e.thick ? "thickOnly" : e.thin ? "thinOnly" : "empty";
        console.log(`     M=${k.split("|")[0].padStart(3)} m5=${k.split("|")[1].padStart(2)}  ${band.padEnd(9)} ${String(e.n).padStart(5)} solids, max ${e.max}`);
    }
    // one-axis pairs, by band combination
    const combo = {};
    let bothPopulated = 0;
    for (const s of c.solids) for (let i = 0; i < 6; i++) for (const d of [2, -2]) {
        const m2 = s.m.slice(); m2[i] += d;
        const t = byM.get(K(m2)); if (!t || t.id < s.id) continue;
        const a = bandOf(s), b = bandOf(t);
        const key = [a, b].sort().join(" + ") + (i === 5 ? "   [vertical axis]" : "");
        combo[key] = (combo[key] ?? 0) + 1;
        if (s.faces.length >= 2 && t.faces.length >= 2) bothPopulated++;
    }
    console.log("  one-axis pairs by band combination:");
    for (const [k, v] of Object.entries(combo).sort((a, b) => b[1] - a[1])) console.log(`     ${k.padEnd(34)} ${v}`);
    console.log(`  pairs where BOTH hold two or more faces: ${bothPopulated}`);
}
