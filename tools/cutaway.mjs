// Verification for src/cutaway.ts — the exposed surface of an overlapping ball packing.
//
//   node tools/cutaway.mjs
//
// The clipper is checked against cases whose answer is known in closed form before it is
// trusted on a real packing. Two equal spheres at distance d < 2r each lose a spherical
// cap of height r − d/2, and a cap's area is exactly 2πrh — no approximation in it at
// all. If the tessellated clipper cannot reproduce that, nothing it says about a
// thousand-ball packing is worth reading.

import { cutaway } from "../dist/cutaway.js";
import { RHO, MIDRADIUS } from "../dist/centers.js";

let bad = 0;
const fail = (m) => { bad++; console.log(`  ✗ ${m}`); };
const ball = (id, c) => ({ id, m: [], c, faces: [], thick: 0, hat: false,
    complete: false, settled: true, makeup: "", homeCount: 1 });

// ── 1 · two balls, exact ──────────────────────────────────────────────────────
console.log("two balls: tessellated exposed area against 4πr² − 2πrh, h = r − d/2");
console.log("  d/r    detail   exact        measured     rel.err");
const r = 1;
for (const dr of [1.9, 1.5, 1.0, 0.5]) {
    for (const detail of [3, 4]) {
        const d = dr * r;
        const res = cutaway([ball(0, [0, 0, 0]), ball(1, [d, 0, 0])],
            { radius: r, ownFacesOnly: false, detail });
        const h = r - d / 2;
        const exact = 2 * (4 * Math.PI * r * r - 2 * Math.PI * r * h);
        const err = Math.abs(res.exposed - exact) / exact;
        console.log(`  ${dr.toFixed(2)}   ${detail}       ${exact.toFixed(6)}    ` +
            `${res.exposed.toFixed(6)}     ${err.toExponential(2)}`);
        // A flat tessellation always undershoots a sphere, so the error is one-sided and
        // must fall as the mesh refines — that is the property worth asserting.
        if (res.exposed > exact * 1.0001) fail(`d/r=${dr} detail=${detail}: overshoots the exact area`);
        if (err > 0.02) fail(`d/r=${dr} detail=${detail}: ${(100 * err).toFixed(2)}% off`);
    }
}

// refinement really does converge
{
    const d = 1.4;
    const h = r - d / 2;
    const exact = 2 * (4 * Math.PI * r * r - 2 * Math.PI * r * h);
    let prev = Infinity;
    for (const detail of [1, 2, 3, 4]) {
        const res = cutaway([ball(0, [0, 0, 0]), ball(1, [d, 0, 0])],
            { radius: r, ownFacesOnly: false, detail });
        const err = Math.abs(res.exposed - exact) / exact;
        if (err > prev) fail(`refinement made it worse at detail ${detail}`);
        prev = err;
    }
    console.log(`  refinement is monotone, down to ${(100 * prev).toFixed(3)}% at detail 4`);
}

// ── 2 · a ball on its own loses nothing ───────────────────────────────────────
{
    const res = cutaway([ball(0, [0, 0, 0])], { radius: r, ownFacesOnly: false, detail: 4 });
    if (res.cutPairs !== 0) fail("a lone ball reports cutting pairs");
    if (Math.abs(res.exposed - res.offered) > 1e-9) fail("a lone ball loses surface");
    console.log(`\none ball, nothing near it: exposed = offered = ${res.exposed.toFixed(6)} ` +
        `of 4πr² = ${(4 * Math.PI).toFixed(6)}`);
}

// ── 3 · balls further than 2r apart never cut ─────────────────────────────────
{
    const res = cutaway([ball(0, [0, 0, 0]), ball(1, [2.001, 0, 0])],
        { radius: r, ownFacesOnly: false, detail: 3 });
    if (res.cutPairs !== 0) fail("balls at more than 2r were cut");
    console.log(`two balls at 2.001r: ${res.cutPairs} cuts, as it should be`);
}

// ── 4 · the real packing, at both candidate radii ─────────────────────────────
const { generatePatch, seedTypes } = await import("../dist/geometry.js");
const { triacontahedra } = await import("../dist/centers.js");
const { properBalls } = await import("../dist/packing.js");

console.log("\npatch      balls   radius      exposed / bare   cut pairs   ms");
for (const [label, gen] of [["Pe5", 2], ["Pe3", 2], ["Pe3", 3]]) {
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === label), true, gen);
    const balls = properBalls(triacontahedra());
    console.log = quiet;
    for (const [name, rad] of [["insphere", RHO], ["midsphere", MIDRADIUS]]) {
        const t0 = Date.now();
        const res = cutaway(balls, { radius: rad, ownFacesOnly: false, detail: 3 });
        const ms = Date.now() - t0;
        const frac = res.exposed / res.bare;
        if (frac > 1.0001) fail(`${label} g${gen} ${name}: exposed exceeds bare surface`);
        if (frac <= 0) fail(`${label} g${gen} ${name}: nothing exposed at all`);
        console.log(`${label} g${gen}  ${String(balls.length).padStart(5)}   ` +
            `${name.padEnd(10)} ${(100 * frac).toFixed(2)}%          ` +
            `${String(res.cutPairs).padStart(6)}   ${String(ms).padStart(4)}`);
    }
}

console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
