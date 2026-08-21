// Jeff's claim as stated: gen N+1 contains gen N of the SAME seed, with opposite
// parity. Brute-force over the tiling's 20 symmetries and every translation that maps
// one rhomb onto another — nothing assumed about where the copy sits.
import { seedTypes, generatePatch, allRhombs, vertexList } from "../../dist/geometry.js";

function snap(seed, gen) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    console.log = q;
    return {
        n: allRhombs.length,
        cent: allRhombs.map((r) => r.verts.reduce((a, p) => [a[0] + p.x / 4, a[1] + p.y / 4], [0, 0])),
        verts: vertexList.map((v) => ({ x: v.pos.x, y: v.pos.y, i: v.index })),
    };
}
const K = (x, y) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)}`;

for (const seed of ["Pe5", "Pe3", "Pe1", "St5", "St3", "Deca", "Sun", "Star"]) {
    for (const gen of [3]) {
        const A = snap(seed, gen), B = snap(seed, gen + 1);
        if (!A.n) continue;
        const OB = new Set(B.cent.map(([x, y]) => K(x, y)));
        let best = { hits: -1 };
        for (let k = 0; k < 10; k++) for (const mir of [1, -1]) {
            const a = (Math.PI * k) / 5, c = Math.cos(a), s = Math.sin(a);
            const R = (x, y) => [x * c - y * s, mir * (x * s + y * c)];
            const rot = A.cent.map(([x, y]) => R(x, y));
            for (const [bx, by] of B.cent) {
                const dx = bx - rot[0][0], dy = by - rot[0][1];
                let hits = 0;
                for (const [x, y] of rot) if (OB.has(K(x + dx, y + dy))) hits++;
                if (hits > best.hits) best = { hits, k, mir, dx, dy, R };
            }
            if (best.hits === A.n) break;
        }
        // index relation under the winning transform
        const VB = new Map(); for (const v of B.verts) VB.set(K(v.x, v.y), v.i);
        const sums = new Map(), diffs = new Map();
        for (const v of A.verts) {
            const [x, y] = best.R(v.x, v.y);
            const ib = VB.get(K(x + best.dx, y + best.dy));
            if (ib === undefined) continue;
            sums.set(v.i + ib, (sums.get(v.i + ib) ?? 0) + 1);
            diffs.set(ib - v.i, (diffs.get(ib - v.i) ?? 0) + 1);
        }
        const one = (m) => (m.size === 1 ? [...m.keys()][0] : null);
        const s1 = one(sums), d1 = one(diffs);
        const rel = s1 !== null ? `newIndex = ${s1} − oldIndex   PARITY REVERSED`
                  : d1 !== null ? `newIndex = oldIndex ${d1 >= 0 ? "+" : "−"} ${Math.abs(d1)}   parity kept`
                  : "mixed";
        console.log(
            `${seed.padEnd(5)} gen ${gen}→${gen + 1}: ${String(A.n).padStart(5)} rhombi, ` +
            `${best.hits === A.n ? "ALL inside" : `${best.hits}/${A.n} inside`}` +
            `  (rotate ${best.k * 36}°${best.mir < 0 ? " + mirror" : ""}, translate) · ${rel}`,
        );
    }
}
