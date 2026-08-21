// Verification for src/dissect.ts — the twenty-cell dissection.
//
//   node tools/dissect.mjs
//
// Six checks. The last two are the ones that would catch a wrong dissection rather than
// a wrong count: the cells must not overlap, and together they must fill the solid.

import { dissection, RT_VOLUME, disjoint } from "../dist/dissect.js";
import { A6, RHO } from "../dist/centers.js";

const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const crs = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const nrm = (a) => { const L = Math.hypot(...a); return a.map((x) => x / L); };
const PHI = (1 + Math.sqrt(5)) / 2;

let bad = 0;
const fail = (m) => { bad++; console.log(`  ✗ ${m}`); };
const cells = dissection();

// 1 · twenty cells, one per triple
if (cells.length !== 20) fail(`${cells.length} cells, expected 20`);
if (new Set(cells.map((c) => c.triple.join(""))).size !== 20) fail("triples are not distinct");

// 2 · ten of each, in the ratio phi
const acute = cells.filter((c) => c.acute), obtuse = cells.filter((c) => !c.acute);
if (acute.length !== 10 || obtuse.length !== 10) fail(`${acute.length} acute / ${obtuse.length} obtuse`);
const ratio = acute[0].volume / obtuse[0].volume;
if (Math.abs(ratio - PHI) > 1e-9) fail(`volume ratio ${ratio} is not phi`);

// 3 · volumes sum to the triacontahedron's
const total = cells.reduce((s, c) => s + c.volume, 0);
if (Math.abs(total - RT_VOLUME) > 1e-9) fail(`total ${total} vs RT ${RT_VOLUME}`);

// 4 · every corner inside the solid
const N = []; for (let i = 0; i < 6; i++) for (let j = i+1; j < 6; j++) N.push(nrm(crs(A6[i], A6[j])));
const inRT = (p) => N.every((u) => Math.abs(dot(u, p)) <= RHO + 1e-9);
let out = 0;
for (const c of cells) for (const p of c.corners) if (!inRT(p)) out++;
if (out) fail(`${out} cell corners outside the solid`);

// 5 · no two cells overlap
let ov = 0;
for (let i = 0; i < cells.length; i++) for (let j = i+1; j < cells.length; j++) if (!disjoint(cells[i], cells[j])) ov++;
if (ov) fail(`${ov} overlapping cell pairs`);

// 6 · and together they fill it — every point of the solid in exactly one cell
const inCell = (p, c) => {
    const [a, b, cc] = c.triple.map((m) => A6[m]);
    const det = dot(a, crs(b, cc));
    const d = [p[0]-c.center[0], p[1]-c.center[1], p[2]-c.center[2]];
    const t1 = dot(d, crs(b, cc)) / det * 2, t2 = dot(a, crs(d, cc)) / det * 2, t3 = dot(a, crs(b, d)) / det * 2;
    return Math.abs(t1) <= 1+1e-9 && Math.abs(t2) <= 1+1e-9 && Math.abs(t3) <= 1+1e-9;
};
let tested = 0, none = 0, many = 0;
for (let s = 0; s < 300000; s++) {
    const p = [0,1,2].map(() => (Math.random()*2-1) * 1.7);
    if (!inRT(p)) continue;
    tested++;
    const n = cells.filter((c) => inCell(p, c)).length;
    if (n === 0) none++; else if (n > 1) many++;
}
if (none) fail(`${none} of ${tested} interior points in no cell`);
if (many) fail(`${many} of ${tested} interior points in more than one cell`);

console.log(`20 cells: ${acute.length} acute at ${acute[0].volume.toFixed(6)}, ${obtuse.length} obtuse at ${obtuse[0].volume.toFixed(6)}, ratio ${ratio.toFixed(9)}`);
console.log(`total volume ${total.toFixed(6)} = 4√(5+2√5) = ${RT_VOLUME.toFixed(6)}`);
console.log(`${tested} interior points sampled: all in exactly one cell` + (none || many ? " — NO" : ""));
console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
