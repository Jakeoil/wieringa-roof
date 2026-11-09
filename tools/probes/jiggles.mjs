// Which of the decagon's ten states does a jiggle produce?
//
//   node tools/probes/jiggles.mjs
//
// A jiggle is a nudge of gamma that keeps the sum at zero. **One +e/-e pair is the
// simple phase flip** — a three-line crossing resolving, the `couple` preset — and it
// does not resolve the five-fold: all twenty such nudges leave ten rhombi at the centre
// that match no legal reading. **Two pairs do**, which is Jake's "deca moves two pairs
// of intersection away from the center to form a resolution".
//
// So the family swept here is one index left alone and the other four split + + - -.
// Thirty of those exist; ten land on a reading, one reading apiece, and they organise
// exactly as the control wants:
//
//     the AXIS is the gamma index left alone
//     the DIRECTION is which of the other four goes up
//
// with every axis giving precisely two. That is the 5 x 2 of EXCEPTIONAL.md section 7.4
// arrived at from the grid instead of from F20's symmetry, and the two directions of an
// axis turn out to be the two ways of splitting its four neighbours into mirror pairs.
import { pentaPatch, GAMMA_SINGULAR } from "/Users/jakeoil/projects/claude-projects/math-legacy/wieringa-roof/dist/pentapatch.js";
import { readingsOf } from "/Users/jakeoil/projects/claude-projects/math-legacy/wieringa-roof/dist/readings.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// the lifted generators, exactly as the page reads them off the roof
function gensOf(d) {
    const E = new Array(5);
    for (const f of d.faces) {
        const c = f.vids.map((v) => d.point(v));
        if (!E[f.dirs[0]]) E[f.dirs[0]] = sub(c[1], c[0]);
        if (!E[f.dirs[1]]) E[f.dirs[1]] = sub(c[3], c[0]);
    }
    return E;
}

const base = pentaPatch({ gamma: GAMMA_SINGULAR, window: 6 });
const E = gensOf(base);
const angleOf = (g) => Math.atan2(E[g][1], E[g][0]);
const pointOf = (K) => {
    const p = [0, 0];
    for (let k = 0; k < 5; k++) if ((K >> k) & 1) { p[0] += E[k][0]; p[1] += E[k][1]; }
    return p;
};
const readings = readingsOf([0, 1, 2, 3, 4], angleOf, pointOf, 0);
console.log(`the decagon has ${readings.length} legal readings`);

// a reading, as the set of its ten rhomb centres measured from the pole
const R4 = 1e4;
// measured from the group's own centroid: a general nudge slides the decagon off the
// origin, and only the mirror-symmetric one leaves it there
const sig = (pts) => {
    const cx = pts.reduce((s2, q) => s2 + q[0], 0) / pts.length;
    const cy = pts.reduce((s2, q) => s2 + q[1], 0) / pts.length;
    return pts.map(([x, y]) => `${Math.round((x - cx) * R4)},${Math.round((y - cy) * R4)}`).sort().join(";");
};
const readingSig = readings.map((T) =>
    sig(T.map((r) => {
        const b = pointOf(r.S);
        return [b[0] + (E[r.a][0] + E[r.b][0]) / 2, b[1] + (E[r.a][1] + E[r.b][1]) / 2];
    })),
);

// the decagon's own radius: the ten rhombi of a reading reach this far
const reach = Math.max(...readings[0].map((r) => {
    const b = pointOf(r.S);
    return Math.hypot(b[0] + (E[r.a][0] + E[r.b][0]) / 2, b[1] + (E[r.a][1] + E[r.b][1]) / 2);
})) + 1e-6;

/** the ten rhombi a jiggle puts where the decagon was */
function stateOf(gamma) {
    const d = pentaPatch({ gamma, window: 6 });
    if (!d) return null;
    const mid = d.faces.map((f) => {
        const c = f.vids.map((v) => d.point(v));
        return [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2];
    });
    // the ten nearest, since a nudged decagon is no longer centred on the origin
    const near = mid.map((m) => ({ m, r: Math.hypot(m[0], m[1]) }))
        .sort((a, b) => a.r - b.r).slice(0, 10).map((x) => x.m);
    if (near.length !== 10) return { n: near.length, hit: -1 };
    const s = sig(near);
    return { n: 10, hit: readingSig.indexOf(s) };
}

const EPS = 0.001;
// **Two pairs, not one.** A single +e/-e pair keeps the sum at zero and resolves a
// three-line crossing — the simple phase flip, the `couple` preset. The five-fold needs
// more: Jake, "deca moves two pairs of intersection away from the center to form a
// resolution". So the family is one index left alone and the other four split +,+,-,-.
console.log("\ntwo-pair nudges: one index fixed, the other four split + + - -");
const seen = new Map();
for (let fixed = 0; fixed < 5; fixed++) {
    const rest = [0, 1, 2, 3, 4].filter((x) => x !== fixed);
    for (let m = 0; m < 16; m++) {
        const up = rest.filter((_, q) => (m >> q) & 1);
        if (up.length !== 2) continue;
        const g = [0, 0, 0, 0, 0];
        for (const q of rest) g[q] = up.includes(q) ? EPS : -EPS;
        const r = stateOf(g);
        if (r && r.hit >= 0) {
            if (!seen.has(r.hit)) seen.set(r.hit, []);
            seen.get(r.hit).push(`fix ${fixed} up ${up.join("")}`);
        } else if (r) {
            console.log(`  fix ${fixed} up ${up.join("")}  ->  ${r.n} rhombi, no match`);
        }
    }
}
console.log(`\nreadings reached: ${seen.size} of ${readings.length}`);
for (const k of [...seen.keys()].sort((x, y) => x - y))
    console.log(`  reading ${String(k).padStart(2)}  by ${seen.get(k).length} nudge(s), e.g. ${seen.get(k)[0]}`);

// the mirror-symmetric nudge the catalog calls `deca`
const deca = stateOf([0, EPS, -EPS, -EPS, EPS]);
console.log(`\ndeca (the queen, gamma1=gamma4, gamma2=gamma3): ${deca && deca.hit >= 0 ? `reading ${deca.hit}` : JSON.stringify(deca)}`);
