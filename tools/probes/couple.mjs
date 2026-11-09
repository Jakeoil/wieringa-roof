// The simple phase flip — the `couple` preset, γ = [0,0,0,10,-10]/100.
//
//   node tools/probes/couple.mjs
//
// Jake: "As the gamma value changes, usually two components at a time in order to
// maintain constant (0) sum, a gridline intersection crosses a gridline. Invariably
// this results in an intersection of three gridlines. Not just those three, but other
// sets of three going in two directions all along the line of parallel duals. The
// axis."
//
// Measured, and it is exactly that: the degeneracy is not a point. It lies on one
// straight line across the whole patch, and the crossings along it are spaced in two
// lengths, sin 72° and √5 times it.

import { makeDirections, collectRhombs } from "../../vendor/pentagrid/lib/grow.js";

const GAMMA_COUPLE = [0, 0, 0, 0.1, -0.1];
const dirs = makeDirections(false, 5);
const vk = (v) => `${Math.round(v[0] * 1e6)},${Math.round(v[1] * 1e6)}`;

function degenerate(gamma, W) {
    const R = collectRhombs({ n: 5, directions: dirs, gamma },
        { xMin: -(W + 4), xMax: W + 4, yMin: -(W + 4), yMax: W + 4 }, {})
        .filter((r) => Math.abs(r.nj) <= W && Math.abs(r.nk) <= W);
    const ec = new Map();
    for (const r of R)
        for (let k = 0; k < 4; k++) {
            const p = r.vertices[k], q = r.vertices[(k + 1) % 4];
            const ka = vk(p), kb = vk(q);
            const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
            if (!ec.has(key)) ec.set(key, { mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], n: 0 });
            ec.get(key).n++;
        }
    // An edge carrying more than two faces is where the dual has folded over itself:
    // the mark of a crossing that has not been resolved. There are no overloaded
    // *vertices* — the degeneracy is in the overlap, not in the valence.
    return { R, over: [...ec.values()].filter((e) => e.n > 2).map((e) => e.mid) };
}

const { R, over } = degenerate(GAMMA_COUPLE, 34);
console.log(`couple γ = [0,0,0,0.1,-0.1]: ${R.length} rhombi, ${over.length} edges carrying more than two faces`);

// 1 · they are collinear, and the line is a family's own
const c = over.reduce((s, p) => [s[0] + p[0] / over.length, s[1] + p[1] / over.length], [0, 0]);
let sxx = 0, sxy = 0, syy = 0;
for (const [x, y] of over) { const dx = x - c[0], dy = y - c[1]; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
const off = over.map(([x, y]) => Math.abs(-(x - c[0]) * Math.sin(th) + (y - c[1]) * Math.cos(th)));
const deg = (((th * 180) / Math.PI) + 180) % 180;
console.log(`the axis: a line at ${deg.toFixed(2)}°, worst departure ${Math.max(...off).toExponential(2)}`);
console.log(`  generators sit at 0, 72, 144, 216, 288 — a family's lines run perpendicular to its own,`);
console.log(`  so ${deg.toFixed(0)}° is family ${[0, 1, 2, 3, 4].find((j) => Math.abs(((Math.atan2(dirs[j][1], dirs[j][0]) * 180 / Math.PI + 90) % 180 + 180) % 180 - deg) < 1e-6)},`);
console.log(`  which is the family bisecting the nudged pair 3 and 4 rather than either of them.`);

// 2 · the spacing along it: two lengths, and what they are
const u = [Math.cos(th), Math.sin(th)];
const t = [...new Set(over.map((p) => +(p[0] * u[0] + p[1] * u[1]).toFixed(5)))]
    .filter((x) => Math.abs(x) < 28).sort((a, b) => a - b);
const gaps = [];
for (let i = 1; i < t.length; i++) gaps.push(+(t[i] - t[i - 1]).toFixed(5));
const set = [...new Set(gaps)].sort((a, b) => a - b);
const S = set[0], L = set[set.length - 1];
const word = gaps.map((x) => (Math.abs(x - S) < 1e-4 ? "S" : "L")).join("");
console.log(`\n${t.length} crossings on the interior stretch, ${set.length} distinct gaps:`);
console.log(`  S = ${S.toFixed(6)}  = sin 72° (${Math.sin((2 * Math.PI) / 5).toFixed(6)})`);
console.log(`  L = ${L.toFixed(6)}  = √5 · S, ratio ${(L / S).toFixed(6)} against √5 = ${Math.sqrt(5).toFixed(6)}`);
console.log(`  word  ${word}`);
console.log(`  counts  S ${[...word].filter((x) => x === "S").length}, L ${[...word].filter((x) => x === "L").length}`);
console.log(`\nNot yet settled: whether that word is the Conway musical sequence. The two lengths`);
console.log(`are exact, but the S:L counts have not converged on φ over the windows measured,`);
console.log(`so the sequence wants reading off the skewbs themselves rather than off the grid.`);
