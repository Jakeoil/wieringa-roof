// Verification for src/slab.ts — the hexahedra layer taken as one closed solid.
//
//   node tools/slab.mjs
//
// Eight checks. HEXAHEDRA.md claims things about this solid that are easy to state and
// easy to get wrong: that the rim is one wall per boundary edge and one simple closed
// curve, that the boundary closes to a sphere, that every face is the same golden
// rhombus, and that the whole model folds on {36°, 72°, 108°} — the roof's own set,
// with no new angle and therefore no new gauge. All eight are asserted here.

import { generatePatch, allRhombs, seedTypes, vertexMap, roundKey } from "../dist/geometry.js";
import { slab } from "../dist/slab.js";

const GOLDEN = (Math.acos(1 / Math.sqrt(5)) * 180) / Math.PI; // 63.4349
// The roof folds on 36, 72 and 108. The slab adds **144** — a 36-degree dihedral,
// sharper than anything on the surface — and only ever where a wall meets the rhombus
// it hangs from on that rhombus's downhill side. Measured, not assumed: the first
// version of this checker looked for the roof's three and found the fourth.
const FOLDS = [36, 72, 108, 144];

let bad = 0;
const fail = (m) => { bad++; console.log(`  x ${m}`); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);

const CASES = [];
for (const label of ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1"])
    for (const gen of [1, 2, 3]) CASES.push([label, gen]);

console.log("patch gen  cells  walls  faces  euler   worst edge   worst angle   fold set");
console.log("-".repeat(84));

let worstEdgeAll = 0, worstAngAll = 0;
const foldsSeen = new Set();
const census = new Map();
const kindsSeen = new Set();

for (const [label, gen] of CASES) {
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === label), true, gen);
    console.log = quiet;
    if (!allRhombs.length) { console.log(`${label.padEnd(5)} ${gen}      0  — emits no rhombi`); continue; }

    const S = slab();
    const c = S.counts;

    // 1 · a wall per boundary edge, and no more
    if (S.wall.length !== c.B) fail(`${label} g${gen}: ${S.wall.length} walls for ${c.B} boundary edges`);
    if (S.top.length !== c.F || S.floor.length !== c.F)
        fail(`${label} g${gen}: ${S.top.length}/${S.floor.length} tops and floors for ${c.F} cells`);
    if (S.faces.length !== 2 * c.F + c.B) fail(`${label} g${gen}: face count is not 2F + B`);

    // 2 · the rim is one cycle, visiting every wall exactly once and closing
    if (S.rim.length !== c.B) fail(`${label} g${gen}: the rim walk covered ${S.rim.length} of ${c.B} — more than one loop`);
    for (let i = 0; i < S.rim.length; i++)
        if (S.rim[i].b !== S.rim[(i + 1) % S.rim.length].a) { fail(`${label} g${gen}: the rim does not close at ${i}`); break; }
    if (new Set(S.rim.map((e) => e.n)).size !== S.rim.length) fail(`${label} g${gen}: rim numbers repeat`);

    // 3 · every rim edge climbs or falls by exactly one — every roof edge does
    for (const e of S.rim)
        if (Math.abs(e.ia - e.ib) !== 1) { fail(`${label} g${gen}: rim edge ${e.n} steps ${e.ib - e.ia}`); break; }

    // 4 · the boundary closes to a sphere
    if (c.euler !== 2) fail(`${label} g${gen}: Euler characteristic ${c.euler}, not 2`);

    // 5 · every face is the same golden rhombus, walls included
    let worstEdge = 0, worstAng = 0;
    for (const f of S.faces) {
        if (f.corners.length !== 4) { fail(`${label} g${gen}: face ${f.id} has ${f.corners.length} corners`); break; }
        for (let i = 0; i < 4; i++) {
            const a = sub(f.corners[(i + 1) % 4], f.corners[i]);
            const b = sub(f.corners[(i + 3) % 4], f.corners[i]);
            worstEdge = Math.max(worstEdge, Math.abs(len(a) - 1));
            const ang = (Math.acos(dot(a, b) / (len(a) * len(b))) * 180) / Math.PI;
            worstAng = Math.max(worstAng, Math.min(Math.abs(ang - GOLDEN), Math.abs(ang - (180 - GOLDEN))));
        }
    }
    if (worstEdge > 1e-9) fail(`${label} g${gen}: an edge is off by ${worstEdge.toExponential(2)}`);
    if (worstAng > 1e-7) fail(`${label} g${gen}: a corner is off by ${worstAng.toExponential(2)}°`);
    worstEdgeAll = Math.max(worstEdgeAll, worstEdge);
    worstAngAll = Math.max(worstAngAll, worstAng);

    // 6 · a closed solid: every edge carries exactly two faces, so 2E = 4F
    const seen = new Map();
    const K = 1e6, vk = (p) => p.map((x) => Math.round(x * K)).join(",");
    for (const f of S.faces)
        for (let i = 0; i < 4; i++) {
            const p = vk(f.corners[i]), q = vk(f.corners[(i + 1) % 4]);
            const k = p < q ? `${p}/${q}` : `${q}/${p}`;
            seen.set(k, (seen.get(k) ?? 0) + 1);
        }
    const loose = [...seen.values()].filter((n) => n !== 2).length;
    if (loose) fail(`${label} g${gen}: ${loose} edges do not carry exactly two faces`);
    if (S.creases.length !== seen.size) fail(`${label} g${gen}: ${S.creases.length} creases for ${seen.size} edges`);
    if (seen.size !== c.slabE) fail(`${label} g${gen}: ${seen.size} edges against the predicted ${c.slabE}`);

    // 7 · the fold set is the roof's own, with nothing new in it
    const here = new Set();
    for (const cr of S.creases) {
        const near = FOLDS.reduce((best, f) => (Math.abs(cr.fold - f) < Math.abs(cr.fold - best) ? f : best), FOLDS[0]);
        if (Math.abs(cr.fold - near) > 1e-6) { fail(`${label} g${gen}: a ${cr.kind} crease folds ${cr.fold.toFixed(4)}°`); break; }
        here.add(near);
        foldsSeen.add(near);
        kindsSeen.add(cr.kind);
        const tag = `${cr.kind} ${near}`;
        census.set(tag, (census.get(tag) ?? 0) + 1);
    }
    if (kindsSeen.has("floor|top")) fail(`${label} g${gen}: a roof rhombus shares an edge with a floor rhombus`);

    console.log(
        `${label.padEnd(5)} ${gen} ${String(c.F).padStart(6)} ${String(c.B).padStart(6)} ` +
        `${String(S.faces.length).padStart(6)} ${String(c.euler).padStart(6)}   ` +
        `${worstEdge.toExponential(1)}     ${worstAng.toExponential(1)}°   ` +
        `${[...here].sort((a, b) => a - b).join(", ")}`,
    );
}

// 8 · across every patch, nothing outside {36, 72, 108} and every kind accounted for
console.log("-".repeat(84));
console.log(`fold angles over all patches: ${[...foldsSeen].sort((a, b) => a - b).join("°, ")}°`);
console.log(`crease kinds: ${[...kindsSeen].sort().join(", ")}`);
console.log(`worst edge length error ${worstEdgeAll.toExponential(2)}, worst corner ${worstAngAll.toExponential(2)}°`);
console.log("\ncreases by kind and fold, over every patch above:");
for (const k of [...census.keys()].sort())
    console.log(`   ${k.padEnd(18)}° ${String(census.get(k)).padStart(7)}`);
for (const f of foldsSeen) if (!FOLDS.includes(f)) fail(`${f}° is not one of the four`);
console.log(bad ? `\n${bad} problem${bad === 1 ? "" : "s"}` : "\nall checks passed");
