// Does generation N+1 contain generation N, with the parity reversed?
import { seedTypes, generatePatch, allRhombs, vertexList, vertexMap, roundKey } from "../../dist/geometry.js";

function snap(seed, gen) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    console.log = q;
    const verts = new Map();          // position key -> index
    for (const v of vertexList) verts.set(roundKey(v.pos), v.index);
    const rhombs = new Set();
    for (const r of allRhombs) {
        const c = r.verts.reduce((a, p) => [a[0] + p.x / 4, a[1] + p.y / 4], [0, 0]);
        rhombs.add(`${Math.round(c[0] * 1e4)},${Math.round(c[1] * 1e4)}`);
    }
    return { verts, rhombs, n: allRhombs.length };
}

console.log("seed  N→N+1 | rhombi N | shared | N covered | index relation on shared vertices");
console.log("-".repeat(96));
for (const seed of seedTypes.map((s) => s.label)) {
    for (const gen of [2, 3, 4]) {
        const A = snap(seed, gen);
        const B = snap(seed, gen + 1);
        if (!A.n) continue;
        let shared = 0;
        for (const k of A.rhombs) if (B.rhombs.has(k)) shared++;

        // index relation over vertices present in both
        const sums = new Map();       // iA + iB  -> count   (opposite parity => constant)
        const diffs = new Map();      // iB - iA        (same parity => constant)
        for (const [k, iA] of A.verts) {
            const iB = B.verts.get(k);
            if (iB === undefined) continue;
            sums.set(iA + iB, (sums.get(iA + iB) ?? 0) + 1);
            diffs.set(iB - iA, (diffs.get(iB - iA) ?? 0) + 1);
        }
        const one = (m) => (m.size === 1 ? [...m.keys()][0] : null);
        const s1 = one(sums), d1 = one(diffs);
        const verdict = s1 !== null
            ? `iB = ${s1} − iA   OPPOSITE parity`
            : d1 !== null
              ? `iB = iA ${d1 >= 0 ? "+" : "−"} ${Math.abs(d1)}   SAME parity`
              : `neither: sums ${JSON.stringify([...sums])} diffs ${JSON.stringify([...diffs])}`;
        console.log(
            `${seed.padEnd(5)} ${gen}→${gen + 1}  | ${String(A.n).padStart(8)} | ${String(shared).padStart(6)} |` +
            ` ${(shared === A.n ? "all" : `${((100 * shared) / A.n).toFixed(1)}%`).padStart(9)} | ${verdict}`,
        );
    }
}
