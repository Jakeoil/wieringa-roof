// Verification for src/dissect.ts — the dissection of the golden zonohedra.
//
//   node tools/dissect.mjs
//
// Checks 1-9 are the triacontahedron, in detail: the last of them would catch a wrong
// dissection rather than a wrong count, since the cells must not overlap and together
// they must fill the solid. Check 10 then sweeps the rest of the family, where the same
// argument has to hold on four and five axes as well.

import {
    dissection, RT_VOLUME, disjoint, pairColor, faceColor, cellColors,
    SOLIDS, solidCounts, solidVolume, groupOrder, allDissections, stabilizerOrder,
    shellFaces, cageFaces, classCount, pairColorOn, poles,
} from "../dist/dissect.js";
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

// 7 · the five-coloring is a proper edge coloring of K6
let rosetteBad = 0;
for (let i = 0; i < 6; i++) {
    const seen = new Set();
    for (let j = 0; j < 6; j++) if (i !== j) seen.add(pairColor(i, j));
    if (seen.size !== 5) rosetteBad++;
}
if (rosetteBad) fail(`${rosetteBad} of 6 rosettes do not show all five colors`);

// 8 · opposite faces of every cell share a color, and each cell wears three
let oppBad = 0, triBad = 0;
for (const c of cells) {
    for (let q = 0; q < 3; q++) if (faceColor(c, 2*q) !== faceColor(c, 2*q+1)) oppBad++;
    if (new Set(cellColors(c)).size !== 3) triBad++;
}
if (oppBad) fail(`${oppBad} opposite face pairs differ in color`);
if (triBad) fail(`${triBad} cells do not wear exactly three colors`);

// 9 · the ten acute and the ten obtuse carry the same ten 3-subsets, C(5,3) = 10
const sigA = new Set(acute.map((c) => cellColors(c).join("")));
const sigB = new Set(obtuse.map((c) => cellColors(c).join("")));
if (sigA.size !== 10 || sigB.size !== 10) fail(`color-triples: ${sigA.size} acute, ${sigB.size} obtuse, expected 10 each`);
if ([...sigA].sort().join("|") !== [...sigB].sort().join("|")) fail("acute and obtuse carry different color-triple sets");

// 10 · the rest of the family — same argument, fewer axes
const FAMILY = [];
for (const sol of SOLIDS) {
    const { faces, cells: want } = solidCounts(sol.axes);
    const d = dissection("chiral", sol.axes);
    const sh = shellFaces(sol.axes);
    const cg = cageFaces("chiral", sol.axes);
    const outer = cg.filter((f) => f.outer).length;
    if (d.length !== want) fail(`${sol.key}: ${d.length} cells, expected C(k,3) = ${want}`);
    if (sh.length !== faces) fail(`${sol.key}: ${sh.length} shell faces, expected k(k-1) = ${faces}`);
    if (outer !== faces) fail(`${sol.key}: cage has ${outer} faces on the surface, expected ${faces}`);
    // the cells fill it: volumes sum to the solid's, and no two overlap
    const vol = d.reduce((a, c) => a + c.volume, 0);
    if (Math.abs(vol - solidVolume(sol.axes)) > 1e-9) fail(`${sol.key}: cells sum to ${vol}, solid is ${solidVolume(sol.axes)}`);
    let ov = 0;
    for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) if (!disjoint(d[i], d[j])) ov++;
    if (ov) fail(`${sol.key}: ${ov} overlapping cell pairs`);
    // every face is the same golden rhombus, which is the point of equal pair angles
    for (const c of d) for (const f of c.faces) {
        const L = [0,1,2,3].map((k) => Math.hypot(...f[(k+1)%4].map((x,i) => x - f[k][i])));
        if (Math.max(...L) - Math.min(...L) > 1e-9) fail(`${sol.key}: a face is not a rhombus`);
        const d1 = Math.hypot(...f[2].map((x,i) => x - f[0][i]));
        const d2 = Math.hypot(...f[3].map((x,i) => x - f[1][i]));
        const r = Math.max(d1,d2) / Math.min(d1,d2);
        if (Math.abs(r - PHI) > 1e-9) fail(`${sol.key}: diagonal ratio ${r} is not phi`);
    }
    // the coloring is proper and uses no more colors than K_k needs: chi'(K_k) is
    // k-1 for even k and k for odd
    const k = sol.axes.length;
    const chi = k % 2 === 0 ? k - 1 : k;
    if (classCount(sol.axes) !== chi) fail(`${sol.key}: coloring uses ${classCount(sol.axes)} colors, chi'(K${k}) = ${chi}`);
    let clash = 0, gap = 0;
    for (const a of sol.axes) {
        const seen = new Set();
        for (const b of sol.axes) if (a !== b) {
            const col = pairColorOn(a, b, sol.axes);
            if (col < 0 || col >= chi) gap++;
            if (seen.has(col)) clash++;
            seen.add(col);
        }
    }
    if (clash) fail(`${sol.key}: ${clash} face pairs share an axis and a color`);
    if (gap) fail(`${sol.key}: ${gap} faces colored outside 0..${chi - 1}`);
    // opposite faces of a cell still agree, and a cell still wears three distinct colors
    let opp = 0, tri = 0;
    for (const c of d) {
        for (let q = 0; q < 3; q++)
            if (faceColor(c, 2*q, sol.axes) !== faceColor(c, 2*q+1, sol.axes)) opp++;
        if (new Set(cellColors(c, sol.axes)).size !== 3) tri++;
    }
    if (opp) fail(`${sol.key}: ${opp} opposite face pairs differ in color`);
    if (tri) fail(`${sol.key}: ${tri} cells do not wear three distinct colors`);
    // acute and obtuse in equal number, except on the lone rhombohedron which is one cell
    const ac = d.filter((c) => c.acute).length;
    if (d.length > 1 && ac * 2 !== d.length) fail(`${sol.key}: ${ac} acute of ${d.length}`);
    // and the labelled dissections account for themselves: orbit sizes must sum to the count
    const all = allDissections(sol.axes);
    const G = groupOrder(sol.axes);
    const stabs = all.map((x) => stabilizerOrder(x, sol.axes));
    const tally = {};
    for (const st of stabs) tally[st] = (tally[st] || 0) + 1;
    let orbits = 0;
    for (const [st, n] of Object.entries(tally)) {
        const size = G / Number(st);
        if (n % size) fail(`${sol.key}: ${n} dissections at stabiliser ${st} is not a whole number of orbits of ${size}`);
        orbits += n / size;
    }
    FAMILY.push({ key: sol.key, label: sol.label, k, faces, cells: d.length, ac, vol, all: all.length, G, orbits, colors: chi });
}
// only the triacontahedron has a choice
const rt = FAMILY.find((f) => f.k === 6);
if (rt.orbits !== 2) fail(`triacontahedron: ${rt.orbits} orbits, expected 2`);
for (const f of FAMILY) if (f.k < 6 && f.orbits !== 1) fail(`${f.key}: ${f.orbits} orbits, expected 1`);
// the two hexahedra are the two shapes, one each, in the ratio phi
const hx = FAMILY.filter((f) => f.k === 3);
if (hx.length !== 2 || hx.filter((f) => f.ac === 1).length !== 1)
    fail(`three axes: expected one acute hexahedron and one oblate, got ${JSON.stringify(hx.map((f) => [f.key, f.ac]))}`);
const [vAc, vOb] = [hx.find((f) => f.ac === 1).vol, hx.find((f) => f.ac === 0).vol];
if (Math.abs(vAc / vOb - PHI) > 1e-9) fail(`hexahedra ${vAc} / ${vOb} is not phi`);
// volumes in the ratio 2 : 5 : 10
const [vd, vi, vr] = ["dod", "ico", "rt"].map((key) => FAMILY.find((f) => f.key === key).vol);
if (Math.abs(vi / vd - 2.5) > 1e-9 || Math.abs(vr / vd - 5) > 1e-9)
    fail(`volumes ${vd} : ${vi} : ${vr} are not in the ratio 2 : 5 : 10`);

// 11 · the poles — the two vertices where all five zones meet, and what deleting them takes
const vkey = (p) => p.map((x) => Math.round(x * 1e6)).join(",");
let poleLine = "";
for (const sol of SOLIDS) {
    const P = poles(sol.axes);
    if (sol.axes.length !== 5) {
        if (P.length) fail(`${sol.key}: ${P.length} poles, expected none off five axes`);
        continue;
    }
    if (P.length !== 2) fail(`${sol.key}: ${P.length} poles, expected 2`);
    // antipodal
    if (P[0].some((x, i) => Math.abs(x + P[1][i]) > 1e-9)) fail(`${sol.key}: the poles are not antipodal`);
    const shell = shellFaces(sol.axes);
    const d = dissection("chiral", sol.axes);
    let cut = 0;
    const touched = new Set();
    for (const p of P) {
        // five faces and five edges on the pole, and the rim left behind is a decagon
        const at = shell.filter((f) => f.corners.some((q) => vkey(q) === vkey(p)));
        if (at.length !== 5) fail(`${sol.key}: ${at.length} shell faces at a pole, expected 5`);
        const ec = new Map();
        for (const f of at) for (let e = 0; e < 4; e++) {
            const k = [vkey(f.corners[e]), vkey(f.corners[(e + 1) % 4])].sort().join("|");
            ec.set(k, (ec.get(k) || 0) + 1);
        }
        const onPole = [...ec.values()].filter((n) => n === 2).length;
        const rim = [...ec.entries()].filter(([, n]) => n === 1);
        if (onPole !== 5) fail(`${sol.key}: ${onPole} edges at a pole, expected 5`);
        const rimV = new Set(rim.flatMap(([k]) => k.split("|")));
        if (rim.length !== 10 || rimV.size !== 10) fail(`${sol.key}: rim is ${rim.length} edges on ${rimV.size} vertices, expected 10 and 10`);
        // three cells reach it, two oblate and one acute, each losing three of six faces
        const cs = d.filter((c) => c.corners.some((q) => vkey(q) === vkey(p)));
        if (cs.length !== 3) fail(`${sol.key}: ${cs.length} cells at a pole, expected 3`);
        if (cs.filter((c) => c.acute).length !== 1) fail(`${sol.key}: ${cs.filter((c) => c.acute).length} acute cells at a pole, expected 1`);
        for (const c of cs) {
            const n = c.faces.filter((f) => f.some((q) => vkey(q) === vkey(p))).length;
            if (n !== 3) fail(`${sol.key}: a cell has ${n} faces at a pole, expected 3`);
            cut += n;
            touched.add(c.id);
        }
    }
    if (cut !== 18) fail(`${sol.key}: ${cut} cell faces cut, expected 18`);
    if (touched.size !== 6) fail(`${sol.key}: ${touched.size} cells touched, expected 6`);
    poleLine =
        `poles: 2 antipodal five-valent vertices · 5 faces and 5 edges each, rim a decagon on 10 vertices · ` +
        `3 cells each (2 oblate, 1 acute) · ${cut} of ${6 * d.length} cell faces cut from ${touched.size} of ${d.length} cells`;
}

console.log(`five-coloring: all 6 rosettes show all 5 · opposite faces agree · ${sigA.size} color-triples on each family, the same ten`);
console.log(`20 cells: ${acute.length} acute at ${acute[0].volume.toFixed(6)}, ${obtuse.length} obtuse at ${obtuse[0].volume.toFixed(6)}, ratio ${ratio.toFixed(9)}`);
console.log(`total volume ${total.toFixed(6)} = 4√(5+2√5) = ${RT_VOLUME.toFixed(6)}`);
console.log(`${tested} interior points sampled: all in exactly one cell` + (none || many ? " — NO" : ""));
if (poleLine) console.log(poleLine);
for (const f of FAMILY)
    console.log(
        `${f.label.padEnd(21)} k=${f.k}  ${String(f.faces).padStart(2)} faces  ` +
        `${String(f.cells).padStart(2)} cell${f.cells > 1 ? "s" : " "} (${f.ac} acute)  vol ${f.vol.toFixed(6)}  ` +
        `${String(f.all).padStart(3)} labelled / group ${String(f.G).padStart(3)} = ${f.orbits} orbit${f.orbits > 1 ? "s" : ""}` +
        `  ·  ${f.colors} colors`,
    );
console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
