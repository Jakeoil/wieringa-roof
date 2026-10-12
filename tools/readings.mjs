// Verification for src/readings.ts — the readings of a singularity, and legality.
//
//   node tools/readings.mjs
//
// The star table is the load-bearing part, so it is re-derived from the patches the
// site can build rather than trusted: if a real tiling ever shows an eighth star, or
// stops showing one of the seven, this fails.

import { seedTypes, generatePatch, allRhombs, vertexList, computeLift } from "../dist/geometry.js";
import { buildRoof } from "../dist/roofgeom.js";
import {
    LEGAL_STARS, starSig, tilingsOf, readingsOf, indexLegal, starLegal,
} from "../dist/readings.js";

let bad = 0;
const fail = (m) => { bad++; console.log(`  ✗ ${m}`); };
const K = (p) => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)}`;

// 1 · the seven stars, re-derived from every patch the site can build
const seen = new Map();
let patches = 0, stars = 0;
for (let s = 0; s < seedTypes.length; s++) for (let gen = 1; gen <= 4; gen++) {
    const quiet = console.log; console.log = () => {};
    let ok = true;
    try { generatePatch(s, true, gen); } catch { ok = false; }
    console.log = quiet;
    if (!ok || allRhombs.length === 0 || vertexList.length > 4000) continue;
    patches++;
    const byId = new Map(allRhombs.map((r) => [r.id, r]));
    for (const v of vertexList) {
        const angs = [];
        for (const id of v.rhombIds) {
            const r = byId.get(id);
            const i = r.verts.findIndex((p) => K(p) === K(v.pos));
            if (i < 0) continue;
            const a = r.verts[(i + 3) % 4], b = r.verts[(i + 1) % 4], o = r.verts[i];
            const u = [a.x - o.x, a.y - o.y], w = [b.x - o.x, b.y - o.y];
            angs.push(Math.round(Math.acos((u[0]*w[0] + u[1]*w[1]) / (Math.hypot(...u) * Math.hypot(...w))) * 180 / Math.PI));
        }
        if (Math.abs(angs.reduce((x, y) => x + y, 0) - 360) > 2) continue;
        stars++;
        seen.set(starSig(angs), (seen.get(starSig(angs)) || 0) + 1);
    }
}
for (const k of seen.keys()) if (!LEGAL_STARS.has(k)) fail(`a patch shows the star ${k}, which the table does not list`);
for (const k of LEGAL_STARS) if (!seen.has(k)) fail(`the table lists ${k}, which no patch shows`);
console.log(`stars: ${stars} complete ones across ${patches} patches, ${seen.size} distinct, matching the table of ${LEGAL_STARS.size}`);

// 2 · the readings of the decagon and of the two hexagons
generatePatch(seedTypes.findIndex((s) => s.label === "Deca"), true, 3);
const lift = computeLift();
const d = buildRoof(1, false);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const E = new Array(5);
for (const f of d.faces) {
    const c = f.vids.map((v) => d.point(v));
    if (!E[f.dirs[0]]) E[f.dirs[0]] = sub(c[1], c[0]);
    if (!E[f.dirs[1]]) E[f.dirs[1]] = sub(c[3], c[0]);
}
const angleOf = (g) => Math.atan2(E[g][1], E[g][0]);
const pointOf = (K2) => {
    const p = [0, 0];
    for (let k = 0; k < 5; k++) if ((K2 >> k) & 1) { p[0] += E[k][0]; p[1] += E[k][1]; }
    return p;
};
const all = tilingsOf([0,1,2,3,4], angleOf);
if (all.length !== 62) fail(`${all.length} tilings of the decagon, expected 62`);
const idx = all.filter((T) => indexLegal(T, 5));
if (idx.length !== 40) fail(`${idx.length} meet the index condition, expected 40`);
const ten = readingsOf([0,1,2,3,4], angleOf, pointOf);
if (ten.length !== 10) fail(`${ten.length} readings of the decagon, expected 10`);
console.log(`decagon: ${all.length} tilings · ${idx.length} with every index in 1..4 · ${ten.length} with legal stars too`);

// every reading is ten rhombi, one per pair, five thick and five thin
for (const T of ten) {
    if (T.length !== 10) fail(`a reading has ${T.length} rhombi, expected 10`);
    if (new Set(T.map((r) => `${r.a}${r.b}`)).size !== 10) fail("a reading does not cover all ten pairs");
}

// the hexagons: three generators, two readings each, and both legal on their own
// 3 · the hexagons, tested where they actually sit in the patch
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) {
    const t = tilingsOf([i, j, k], angleOf);
    if (t.length !== 2) fail(`hexagon ${i}${j}${k} has ${t.length} tilings, expected 2`);
}
const at = new Map();
d.faces.forEach((f, n) => { for (const v of f.vids) { if (!at.has(v)) at.set(v, []); at.get(v).push(n); } });
let skewbs = 0, twoEach = 0;
const spans = new Map(), los = new Map();
for (const [vid, fs] of at) {
    if (fs.length !== 3) continue;
    const gens = [...new Set(fs.flatMap((n) => d.faces[n].dirs))].sort((a, b) => a - b);
    if (gens.length !== 3) continue;
    const vs = [...new Set(fs.flatMap((n) => d.faces[n].vids))];
    const ns = vs.map((w) => lift.n[w]);
    if (ns.some((x) => !x)) continue;
    skewbs++;
    // the figure's own least corner: its three bits all off, the rest as they stand
    const least = ns[0].slice();
    for (const g of gens) least[g] = Math.min(...ns.map((n) => n[g]));
    const lo = least.reduce((x, y) => x + y, 0) + 1;         // +1, the lift's offset
    const idx = ns.map((n) => n.reduce((x, y) => x + y, 0) + 1);
    spans.set(Math.max(...idx) - Math.min(...idx), (spans.get(Math.max(...idx) - Math.min(...idx)) || 0) + 1);
    los.set(lo, (los.get(lo) || 0) + 1);
    if (readingsOf(gens, angleOf, pointOf, lo).length === 2) twoEach++;
}
console.log(`skewbs in the patch: ${skewbs} · index spans ${JSON.stringify([...spans].sort())} · least corners at ${JSON.stringify([...los].sort())}`);
console.log(`  offering two readings where they sit: ${twoEach} of ${skewbs}`);
if (skewbs === 0) fail("no skewbs found in the patch");
if (twoEach !== skewbs) fail(`${skewbs - twoEach} skewbs do not offer two readings in place`);

console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
