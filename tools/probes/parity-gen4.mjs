// Every rigid motion that puts gen N wholly inside gen N+1, not just the first found.
// If both a parity-keeping and a parity-reversing embedding exist, then "with opposite
// parity" is a choice of where you place the copy, not a fact about the tiling.
import { seedTypes, generatePatch, allRhombs, vertexList } from "../../dist/geometry.js";
function snap(seed, gen) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    console.log = q;
    return { n: allRhombs.length,
        cent: allRhombs.map((r) => r.verts.reduce((a, p) => [a[0] + p.x / 4, a[1] + p.y / 4], [0, 0])),
        verts: vertexList.map((v) => ({ x: v.pos.x, y: v.pos.y, i: v.index })) };
}
const K = (x, y) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)}`;
for (const seed of ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1", "Deca", "Sun", "Star"]) {
    const gen = 3;
    const A = snap(seed, gen), B = snap(seed, gen + 1);
    if (!A.n) continue;
    const OB = new Set(B.cent.map(([x, y]) => K(x, y)));
    const VB = new Map(); for (const v of B.verts) VB.set(K(v.x, v.y), v.i);
    const found = { reversed: 0, kept: 0, mixed: 0 };
    const detail = new Set();
    for (let k = 0; k < 10; k++) for (const mir of [1, -1]) {
        const a = (Math.PI * k) / 5, c = Math.cos(a), s = Math.sin(a);
        const R = (x, y) => [x * c - y * s, mir * (x * s + y * c)];
        const rot = A.cent.map(([x, y]) => R(x, y));
        const seen = new Set();
        for (const [bx, by] of B.cent) {
            const dx = bx - rot[0][0], dy = by - rot[0][1];
            const tk = K(dx, dy); if (seen.has(tk)) continue; seen.add(tk);
            let hits = 0;
            for (const [x, y] of rot) if (OB.has(K(x + dx, y + dy))) hits++; else break;
            if (hits !== A.n) continue;
            const sums = new Map(), diffs = new Map();
            for (const v of A.verts) {
                const [x, y] = R(v.x, v.y);
                const ib = VB.get(K(x + dx, y + dy));
                if (ib === undefined) continue;
                sums.set(v.i + ib, 1); diffs.set(ib - v.i, 1);
            }
            if (sums.size === 1) { found.reversed++; detail.add(`rev(${k * 36}°${mir < 0 ? "+m" : ""})`); }
            else if (diffs.size === 1) { found.kept++; detail.add(`keep(${k * 36}°${mir < 0 ? "+m" : ""})`); }
            else found.mixed++;
        }
    }
    console.log(`${seed.padEnd(5)} gen ${gen}→${gen + 1}: ${A.n} rhombi · placements that fit — ` +
        `parity reversed ${found.reversed}, parity kept ${found.kept}, mixed ${found.mixed}`);
    console.log(`        ${[...detail].sort().join("  ")}`);
}
