// Sharpened: gen G contains gen G-1 of its family's CENTRAL child, at the same place.
// expandPenta puts Pe5 there with !isHeads; expandStar puts St5 there with isHeads.
// So the parity flip should be a pentagon-family fact and not a star-family one.
import { seedTypes, generatePatch, allRhombs, vertexList, roundKey } from "../../dist/geometry.js";

function snap(seed, isHeads, gen) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), isHeads, gen);
    console.log = q;
    return {
        n: allRhombs.length,
        cent: allRhombs.map((r) => r.verts.reduce((a, p) => [a[0] + p.x / 4, a[1] + p.y / 4], [0, 0])),
        verts: vertexList.map((v) => ({ x: v.pos.x, y: v.pos.y, i: v.index })),
    };
}
const key = (x, y) => `${Math.round(x * 1e3)},${Math.round(y * 1e3)}`;
/** best of the 20 symmetries of the tiling: 10 rotations, with and without a mirror */
function bestFit(inner, outer) {
    const O = new Set(outer.cent.map(([x, y]) => key(x, y)));
    let best = { hits: -1 };
    for (let k = 0; k < 10; k++) {
        for (const mir of [1, -1]) {
            const a = (Math.PI * k) / 5, c = Math.cos(a), s = Math.sin(a);
            const T = (x, y) => [ (x * c - y * s), mir * (x * s + y * c) ];
            let hits = 0;
            for (const [x, y] of inner.cent) { const [u, v] = T(x, y); if (O.has(key(u, v))) hits++; }
            if (hits > best.hits) best = { hits, k, mir, T };
        }
    }
    return best;
}
console.log("outer seed  gen | inner              | inner rhombi | inside outer | index relation");
console.log("-".repeat(100));
for (const seed of seedTypes.map((s) => s.label)) {
    const penta = ["Pe5", "Pe3", "Pe1", "Deca", "Sun"].includes(seed);
    const child = penta ? "Pe5" : "St5";
    const childHeads = penta ? false : true;       // expandPenta flips, expandStar does not
    for (const gen of [3, 4]) {
        const outer = snap(seed, true, gen);
        const inner = snap(child, childHeads, gen - 1);
        if (!inner.n || !outer.n) continue;
        const fit = bestFit(inner, outer);
        const OV = new Map();
        for (const v of outer.verts) OV.set(key(v.x, v.y), v.i);
        const sums = new Map(), diffs = new Map();
        for (const v of inner.verts) {
            const [x, y] = fit.T(v.x, v.y);
            const io = OV.get(key(x, y));
            if (io === undefined) continue;
            sums.set(v.i + io, (sums.get(v.i + io) ?? 0) + 1);
            diffs.set(io - v.i, (diffs.get(io - v.i) ?? 0) + 1);
        }
        const one = (m) => (m.size === 1 ? [...m.keys()][0] : null);
        const s1 = one(sums), d1 = one(diffs);
        const rel = s1 !== null ? `outer = ${s1} − inner   REVERSED`
                  : d1 !== null ? `outer = inner ${d1 >= 0 ? "+" : "−"} ${Math.abs(d1)}   preserved`
                  : `mixed`;
        console.log(
            `${seed.padEnd(11)} ${gen}  | ${child} isHeads=${String(childHeads).padEnd(5)} @${gen - 1} |` +
            ` ${String(inner.n).padStart(12)} | ${(fit.hits === inner.n ? "all" : `${fit.hits}/${inner.n}`).padStart(12)} | ${rel}`,
        );
    }
}
