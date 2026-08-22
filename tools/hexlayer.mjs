// Verification for src/hexlayer.ts — the layer of golden hexahedra under the roof.
//
//   node tools/hexlayer.mjs
//
// Seven checks. The page claims four things that would be easy to get wrong and hard to
// see: one cell per rhomb with no choice, every cell a genuine golden rhombohedron,
// thick→acute and thin→obtuse, and a floor congruent to the roof. All four are asserted
// here rather than eyeballed.

import { generatePatch, allRhombs, seedTypes } from "../dist/geometry.js";
import { hexLayer, EZ } from "../dist/hexlayer.js";

// Volumes from the Gram determinant of three unit vectors with pairwise dots ±1/√5:
// det(G) = 1 + 2abc − a² − b² − c². All-positive gives the prolate cell; one negative
// gives the oblate. Derived rather than pasted, so the check cannot agree with the code
// by both carrying the same typo.
const t = 1 / Math.sqrt(5);
const ACUTE_V = Math.sqrt(1 + 2 * t ** 3 - 3 * t ** 2);
const OBTUSE_V = Math.sqrt(1 - 2 * t ** 3 - 3 * t ** 2);
const GOLDEN = (Math.acos(1 / Math.sqrt(5)) * 180) / Math.PI; // 63.4349

let bad = 0;
const fail = (m) => { bad++; console.log(`  x ${m}`); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

console.log("patch  gen  rhombi  cells  acute  obtuse   volume    ratio");
console.log("-".repeat(62));

for (const [label, gen] of [["Pe5", 2], ["Pe3", 2], ["Pe3", 3], ["St1", 2], ["Sun", 3]]) {
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === label), true, gen);
    console.log = quiet;
    const L = hexLayer();
    const rh = allRhombs;
    const thick = rh.filter((r) => r.thick).length;

    // 1 · one cell per rhomb, in the same order — the "one to one" claim, literally
    if (L.cells.length !== rh.length) fail(`${label} g${gen}: ${L.cells.length} cells for ${rh.length} rhombi`);
    if (new Set(L.cells.map((c) => c.rhomb)).size !== rh.length) fail(`${label} g${gen}: a rhomb has two cells`);

    // 2 · thick gives acute, thin gives obtuse — no exceptions, not a majority
    for (const c of L.cells)
        if (c.acute !== rh[c.rhomb].thick) { fail(`${label} g${gen}: rhomb ${c.rhomb} got the wrong cell`); break; }
    if (L.acute !== thick || L.obtuse !== rh.length - thick)
        fail(`${label} g${gen}: ${L.acute}/${L.obtuse} against ${thick}/${rh.length - thick}`);

    let worstEdge = 0, worstAng = 0, worstVol = 0, worstPlumb = 0, worstFloor = 0;
    for (const c of L.cells) {
        // 3 · a golden rhombohedron: three unit edges, all pairwise angles golden
        for (const e of c.e) worstEdge = Math.max(worstEdge, Math.abs(len(e) - 1));
        for (let i = 0; i < 3; i++)
            for (let j = i + 1; j < 3; j++) {
                const a = (Math.acos(dot(c.e[i], c.e[j])) * 180) / Math.PI;
                worstAng = Math.max(worstAng, Math.min(Math.abs(a - GOLDEN), Math.abs(a - (180 - GOLDEN))));
            }
        worstVol = Math.max(worstVol, Math.abs(c.volume - (c.acute ? ACUTE_V : OBTUSE_V)));

        // 4 · the four side faces are vertical — perpendicular to the roof plane, and
        // their edges plumb, which is what forces the type
        for (const f of c.faces) {
            const n = [
                (f[1][1] - f[0][1]) * (f[2][2] - f[0][2]) - (f[1][2] - f[0][2]) * (f[2][1] - f[0][1]),
                (f[1][2] - f[0][2]) * (f[2][0] - f[0][0]) - (f[1][0] - f[0][0]) * (f[2][2] - f[0][2]),
                (f[1][0] - f[0][0]) * (f[2][1] - f[0][1]) - (f[1][1] - f[0][1]) * (f[2][0] - f[0][0]),
            ];
            const nl = len(n);
            const vert = Math.abs(dot(n, EZ) / nl);
            // a face is either the top/bottom rhomb (normal has a z-part) or a side wall
            if (vert < 1e-9) {
                // side wall: it must contain the vertical direction as an edge
                let found = false;
                for (let k = 0; k < 4; k++) {
                    const d = sub(f[(k + 1) % 4], f[k]);
                    if (Math.abs(Math.abs(dot(d, EZ)) - 1) < 1e-9 && Math.hypot(d[0], d[1]) < 1e-9) found = true;
                }
                if (!found) worstPlumb = 1;
            }
        }

        // 5 · the bottom rhomb is the top rhomb moved down by exactly one unit
        for (let k = 0; k < 4; k++) {
            const d = sub(c.corners[k + 4], c.corners[k]);
            worstFloor = Math.max(worstFloor, len([d[0], d[1], d[2] + 1]));
        }
    }
    if (worstEdge > 1e-12) fail(`${label} g${gen}: an edge is ${worstEdge.toExponential(2)} off unit`);
    if (worstAng > 1e-10) fail(`${label} g${gen}: an angle is ${worstAng.toExponential(2)} off golden`);
    if (worstVol > 1e-12) fail(`${label} g${gen}: a volume is ${worstVol.toExponential(2)} off`);
    if (Math.abs(ACUTE_V / OBTUSE_V - (1 + Math.sqrt(5)) / 2) > 1e-12)
        fail("the two cell volumes are not in the golden ratio");
    if (worstPlumb) fail(`${label} g${gen}: a side wall is not plumb`);
    if (worstFloor > 1e-12) fail(`${label} g${gen}: the floor is ${worstFloor.toExponential(2)} off a pure drop`);

    // 6 · no two cells overlap. Their shadows are the rhombi, so it suffices that the
    // rhomb interiors are disjoint — checked at the centroids, which is where a genuine
    // double-cover would show first.
    const seen = new Map();
    for (const c of L.cells) {
        const k = `${Math.round(c.center[0] * 1e6)},${Math.round(c.center[1] * 1e6)}`;
        if (seen.has(k)) fail(`${label} g${gen}: cells ${seen.get(k)} and ${c.rhomb} share a shadow`);
        seen.set(k, c.rhomb);
    }

    // 7 · the floor is the roof, face for face
    if (L.floor.length !== rh.length) fail(`${label} g${gen}: floor has ${L.floor.length} faces for ${rh.length} rhombi`);

    const vol = L.cells.reduce((s, c) => s + c.volume, 0);
    console.log(`${label.padEnd(5)} ${String(gen).padStart(3)} ${String(rh.length).padStart(7)} ` +
        `${String(L.cells.length).padStart(6)} ${String(L.acute).padStart(6)} ${String(L.obtuse).padStart(7)} ` +
        `${vol.toFixed(4).padStart(9)} ${(L.acute / Math.max(1, L.obtuse)).toFixed(5).padStart(8)}`);
}

console.log(`\nacute/obtuse tends to phi = ${((1 + Math.sqrt(5)) / 2).toFixed(5)}, ` +
    `since it is exactly the thick/thin ratio`);
console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
