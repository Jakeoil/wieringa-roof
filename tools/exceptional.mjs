// Verification for the Exceptional page — the Queen patch as a Wieringa roof.
//
//   node tools/exceptional.mjs
//
// Phase 1 draws one patch and nothing else, so what is worth checking is that the patch
// is what the page says it is and that `dirs` — the one fact the ribbons need — is true
// of every edge. See EXCEPTIONAL.md.

import { seedTypes, generatePatch, allRhombs, vertexList, computeLift } from "../dist/geometry.js";
import { buildRoof } from "../dist/roofgeom.js";
import { pairColorOn, solidVolume } from "../dist/dissect.js";
import { A6 } from "../dist/centers.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const AXES = [0, 1, 2, 3, 4];
let bad = 0;
const fail = (m) => { bad++; console.log(`  ✗ ${m}`); };
const crs = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const sub = (a, b) => a.map((x, i) => x - b[i]);

const seedIdx = seedTypes.findIndex((s) => s.label === "Deca");
if (seedIdx < 0) fail("no Deca (Queen) seed");
const quiet = console.log;
console.log = () => {};
generatePatch(seedIdx, true, 3);
console.log = quiet;

const d = buildRoof(1, false);
if (!d) fail("Queen generation 3 built no roof");

// 1 · the patch is there
console.log(`Queen gen 3: ${allRhombs.length} rhombi on ${vertexList.length} vertices, ${d.faces.length} roof faces`);
if (d.faces.length !== allRhombs.length) fail(`${d.faces.length} roof faces against ${allRhombs.length} rhombi`);

// 2 · every face is the same golden rhombus — no thick and thin in space, only tilt
let shape = 0, edgeN = 0;
const lens = [];
for (const f of d.faces) {
    const c = f.vids.map((v) => d.point(v));
    const L = [0,1,2,3].map((k) => Math.hypot(...sub(c[(k+1)%4], c[k])));
    lens.push(...L);
    if (Math.max(...L) - Math.min(...L) > 1e-9) shape++;
    const d1 = Math.hypot(...sub(c[2], c[0])), d2 = Math.hypot(...sub(c[3], c[1]));
    if (Math.abs(Math.max(d1,d2)/Math.min(d1,d2) - PHI) > 1e-9) shape++;
}
if (shape) fail(`${shape} faces are not golden rhombi`);
const eLo = Math.min(...lens), eHi = Math.max(...lens);
if (eHi - eLo > 1e-9) fail(`edge lengths run ${eLo} to ${eHi}; they should all be equal`);

// 3 · dirs names the generator each edge runs along — what the ribbons are drawn from
let dirBad = 0, pairBad = 0;
for (const f of d.faces) {
    const c = f.vids.map((v) => d.point(v));
    for (let k = 0; k < 4; k++) {
        const e = sub(c[(k+1)%4], c[k]);
        const want = A6[f.dirs[k % 2]];
        edgeN++;
        // parallel in the plane; the lift adds a shared vertical to every generator, so
        // compare the planar parts, which is where the generator direction lives
        const cr = e[0]*want[1] - e[1]*want[0];
        if (Math.abs(cr) > 1e-9) dirBad++;
    }
    const srt = [...f.dirs].sort((a,b) => a-b);
    if (srt[0] !== f.pair[0] || srt[1] !== f.pair[1]) pairBad++;
}
if (dirBad) fail(`${dirBad} of ${edgeN} edges do not run along the generator dirs names`);
if (pairBad) fail(`${pairBad} faces whose dirs disagree with their pair`);

// 4 · the five-coloring is proper on these five: every rosette shows all five
const used = new Set();
let clash = 0;
for (const a of AXES) {
    const seen = new Set();
    for (const b of AXES) if (a !== b) {
        const col = pairColorOn(a, b, AXES);
        used.add(col);
        if (seen.has(col)) clash++;
        seen.add(col);
    }
}
if (clash) fail(`${clash} face pairs share a generator and a color`);
if (used.size !== 5) fail(`the coloring uses ${used.size} colors on five axes, expected 5`);

// 5 · the relief is the roof's own, 3/root5 side lengths
let zLo = Infinity, zHi = -Infinity;
for (const f of d.faces) for (const v of f.vids) {
    const z = d.point(v)[2];
    if (z < zLo) zLo = z;
    if (z > zHi) zHi = z;
}
const relief = zHi - zLo;
// 6 · the central decagon, the one F20 covers
//
// The base of a singularity's cube need NOT be a vertex: at k = 5 mask 0 is the
// decagon's centre, not a corner, sharing its shadow with mask 31. A search over bases
// that are themselves vertices therefore finds only the non-singular decagons. Sweeping
// `n(v) - mask` finds them all, and the patch's own centre picks the one wanted.
const lift = computeLift();
let xl = Infinity, xh = -Infinity, yl = Infinity, yh = -Infinity;
for (const f of d.faces) for (const v of f.vids) {
    const p = d.point(v);
    xl = Math.min(xl, p[0]); xh = Math.max(xh, p[0]);
    yl = Math.min(yl, p[1]); yh = Math.max(yh, p[1]);
}
const cx = (xl + xh) / 2, cy = (yl + yh) / 2;
const E = new Array(5);
for (const f of d.faces) {
    const c = f.vids.map((v) => d.point(v));
    if (!E[f.dirs[0]]) E[f.dirs[0]] = sub(c[1], c[0]);
    if (!E[f.dirs[1]]) E[f.dirs[1]] = sub(c[3], c[0]);
}
const nearC = [...vertexList].filter((v) => lift.n[v.id]).sort((a, b) => {
    const pa = d.point(a.id), pb = d.point(b.id);
    return Math.hypot(pa[0]-cx, pa[1]-cy) - Math.hypot(pb[0]-cx, pb[1]-cy);
}).slice(0, 40);
const tried = new Set();
let best = null, allDeca = 0, ghosts = 0;
for (const v of nearC) {
    const n = lift.n[v.id];
    for (let m = 0; m < 32; m++) {
        const b = n.map((x, k) => x - ((m >> k) & 1));
        const bk = b.join(",");
        if (tried.has(bk)) continue;
        tried.add(bk);
        const ids = new Set();
        for (const w of vertexList) {
            const n1 = lift.n[w.id];
            if (!n1) continue;
            if (n1.every((x, k) => x - b[k] === 0 || x - b[k] === 1)) ids.add(w.id);
        }
        if (ids.size < 10) continue;
        const fs = [];
        d.faces.forEach((f, i2) => { if (f.vids.every((x) => ids.has(x))) fs.push(i2); });
        if (fs.length !== 10) continue;
        if (new Set(fs.map((i2) => d.faces[i2].pair.join(""))).size !== 10) continue;
        allDeca++;
        const ghost = ![...ids].some((i2) => lift.n[i2].every((x, k) => x === b[k]));
        if (ghost) ghosts++;
        let sx = 0, sy = 0, n4 = 0;
        for (const i2 of fs) for (const w of d.faces[i2].vids) { const p = d.point(w); sx += p[0]; sy += p[1]; n4++; }
        const dist = Math.hypot(sx/n4 - cx, sy/n4 - cy);
        if (best && dist >= best.dist) continue;
        const some = [...ids][0];
        const mask = lift.n[some].map((x, k) => x - b[k]);
        let anchor = d.point(some);
        for (let k = 0; k < 5; k++) if (mask[k]) anchor = sub(anchor, E[k]);
        best = { fs, ids, dist, b, ghost, anchor };
    }
}
if (!best) fail("no central decagon found");
const deca = best.fs.map((i2) => d.faces[i2]);
if (deca.length !== 10) fail(`the decagon covers ${deca.length} rhombi, expected 10`);
if (new Set(deca.map((f) => f.pair.join(""))).size !== 10) fail("the ten do not cover all ten pairs");
const dThick = deca.filter((f) => f.thick).length;
if (dThick !== 5) fail(`${dThick} thick of the ten, expected 5 and 5`);
if (best.ids.size !== 16) fail(`${best.ids.size} vertices in the cube, expected 16 for one reading`);
// it is at the centre, and it is genuinely singular
if (best.dist > 0.05) fail(`the chosen decagon is ${best.dist} from the patch centre`);
if (!best.ghost) fail("the central decagon realises mask 0, so it is not singular");
// the patch's vertical mirror. Tested on the distinct vertices in tiling coordinates,
// where the mirror line is x = 0 exactly: rounding a roof coordinate and its negation
// can disagree on an exact half, which is a bug in the test and not in the patch.
const tk = (q) => `${Math.round(q.x * 1e5)},${Math.round(q.y * 1e5)}`;
const tset = new Set(vertexList.map((v) => tk(v.pos)));
const mirrored = vertexList.filter((v) => tset.has(tk({ x: -v.pos.x, y: v.pos.y }))).length;
if (mirrored !== vertexList.length)
    fail(`${vertexList.length - mirrored} of ${vertexList.length} vertices have no mirror image in x -> -x`);

// the rim is a decagon
const rimC = new Map();
for (const f of deca) for (let k = 0; k < 4; k++) {
    const a = f.vids[k], b = f.vids[(k+1) % 4];
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    rimC.set(key, (rimC.get(key) || 0) + 1);
}
const rim = [...rimC.entries()].filter(([, n]) => n === 1);
const rimV = new Set(rim.flatMap(([k]) => k.split("|")));
if (rim.length !== 10 || rimV.size !== 10) fail(`rim is ${rim.length} edges on ${rimV.size} vertices, expected 10 and 10`);
console.log(`decagon: at the patch centre, ${best.dist.toFixed(4)} off · base [${best.b.join(",")}] is not a vertex, ` +
    `so mask 0 is the ghost · ${deca.length} rhombi one per pair, ${dThick} thick and ${deca.length-dThick} thin · ` +
    `rim ${rim.length} edges on ${rimV.size} vertices · ${best.ids.size} of the 5-cube's 32 corners, one reading`);
console.log(`patch: ${vertexList.length} vertices, every one mirrored in the vertical line — ${allDeca} decagons in all, ${ghosts} with the ghost`);

// 6b · the skewbs: the hexagons a rhombohedron actually fits under
const at = new Map();
d.faces.forEach((f, i) => { for (const v of f.vids) { if (!at.has(v)) at.set(v, []); at.get(v).push(i); } });
let caps = 0, saddles = 0, peaks = 0, pits = 0;
const capTriples = new Map(), sadTriples = new Map();
const capUse = new Map();
for (const [vid, fs] of at) {
    if (fs.length !== 3) continue;
    const gens = new Set();
    for (const i of fs) for (const x of d.faces[i].dirs) gens.add(x);
    if (gens.size !== 3) continue;
    const nb = new Set();
    for (const i of fs) {
        const v4 = d.faces[i].vids, k = v4.indexOf(vid);
        if (k < 0) continue;
        nb.add(v4[(k+1) % 4]); nb.add(v4[(k+3) % 4]);
    }
    if (nb.size !== 3) fail(`a hexagon centre has ${nb.size} neighbours, expected 3`);
    const z = d.point(vid)[2];
    let up = 0;
    for (const n of nb) if (d.point(n)[2] > z) up++;
    const key = [...gens].sort((a,b)=>a-b).join("");
    if (up === 0 || up === 3) {
        caps++; if (up === 0) peaks++; else pits++;
        capTriples.set(key, (capTriples.get(key) || 0) + 1);
        for (const i of fs) capUse.set(i, (capUse.get(i) || 0) + 1);
    } else { saddles++; sadTriples.set(key, (sadTriples.get(key) || 0) + 1); }
}
// the capping triples are the acute ones and the saddles the oblate ones, with no
// exceptions: in a Wieringa roof only A6 ever presents a cap
const volOf = (t) => {
    const [a, b, c] = t.split("").map(Number);
    const x = crs(E[b], E[c]);
    return Math.abs(E[a][0]*x[0] + E[a][1]*x[1] + E[a][2]*x[2]);
};
for (const t of capTriples.keys()) if (Math.abs(volOf(t) - 0.760845) > 1e-5) fail(`capping triple ${t} has |det| ${volOf(t)}, expected the acute 0.760845`);
for (const t of sadTriples.keys()) if (Math.abs(volOf(t) - 0.470228) > 1e-5) fail(`saddle triple ${t} has |det| ${volOf(t)}, expected the oblate 0.470228`);
if (capTriples.size !== 5 || sadTriples.size !== 5) fail(`${capTriples.size} capping triples and ${sadTriples.size} saddling, expected 5 and 5`);
// and that is why they are disjoint without being chosen
const over = [...capUse.values()].filter((n) => n > 1).length;
if (over) fail(`${over} rhombi are in more than one cap; caps should be disjoint`);
if (caps + saddles !== 310) fail(`${caps + saddles} hexagons, expected 310`);
console.log(`skewbs: ${caps} caps (${peaks} peaks, ${pits} pits) on the five acute triples ` +
    `[${[...capTriples.keys()].sort().join(" ")}] at |det| 0.760845 · ` +
    `${saddles} saddles on the five oblate [${[...sadTriples.keys()].sort().join(" ")}] at 0.470228 · ` +
    `caps use ${capUse.size} rhombi, none twice`);

// 7 · F20 itself, built on the lifted generators and standing on the decagon
if (E.some((e) => !e)) fail("could not read all five lifted generators off the roof");
for (const e of E) if (Math.abs(Math.hypot(...e) - 1) > 1e-9) fail(`generator length ${Math.hypot(...e)}, expected 1`);
const sumE = E.reduce((s2, e) => s2.map((x, i) => x + e[i]), [0, 0, 0]);
// the planar parts cancel, since the five directions sum to zero; the vertical survives
if (Math.hypot(sumE[0], sumE[1]) > 1e-9) fail(`ΣE has a planar part ${sumE[0]}, ${sumE[1]}`);
if (Math.abs(sumE[2] - Math.sqrt(5)) > 1e-9) fail(`ΣE rises ${sumE[2]}, expected √5`);

const anchor = best.anchor;
const f20 = [];
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    const nv = crs(E[i], E[j]);
    for (const flip of [1, -1]) {
        let base = [...anchor];
        for (let m = 0; m < 5; m++) {
            if (m === i || m === j) continue;
            if ((nv[0]*E[m][0] + nv[1]*E[m][1] + nv[2]*E[m][2]) * flip > 0)
                base = base.map((x, k) => x + E[m][k]);
        }
        f20.push([base, base.map((x,k)=>x+E[i][k]), base.map((x,k)=>x+E[i][k]+E[j][k]), base.map((x,k)=>x+E[j][k])]);
    }
}
if (f20.length !== 20) fail(`F20 has ${f20.length} faces, expected 20`);
let f20bad = 0;
for (const c of f20) {
    const L = [0,1,2,3].map((k) => Math.hypot(...sub(c[(k+1)%4], c[k])));
    if (Math.max(...L) - Math.min(...L) > 1e-9) f20bad++;
    const d1 = Math.hypot(...sub(c[2], c[0])), d2 = Math.hypot(...sub(c[3], c[1]));
    if (Math.abs(Math.max(d1,d2)/Math.min(d1,d2) - PHI) > 1e-9) f20bad++;
}
if (f20bad) fail(`${f20bad} of F20's faces are not golden rhombi`);
// and the volume is the Cage's golden icosahedron, which ties the two derivations
const ctr = f20.flat().reduce((s2, q) => s2.map((x, i) => x + q[i]), [0,0,0]).map((x) => x / (4*20));
let vol = 0;
for (const c of f20) for (const t of [[0,1,2],[0,2,3]]) {
    const a = sub(c[t[0]], ctr), b = sub(c[t[1]], ctr), e = sub(c[t[2]], ctr);
    vol += Math.abs(a[0]*(b[1]*e[2]-b[2]*e[1]) + a[1]*(b[2]*e[0]-b[0]*e[2]) + a[2]*(b[0]*e[1]-b[1]*e[0])) / 6;
}
const want = solidVolume([0,1,2,3,4]);
if (Math.abs(vol - want) > 1e-9) fail(`F20 volume ${vol} against the Cage's golden icosahedron ${want}`);
// the singularity: both poles away, with the five faces that carry each
const topPole = E.reduce((a, e) => a.map((x, i) => x + e[i]), anchor);
const atPole = (q) => [anchor, topPole].some((p) =>
    Math.abs(q[0]-p[0]) < 1e-6 && Math.abs(q[1]-p[1]) < 1e-6 && Math.abs(q[2]-p[2]) < 1e-6);
const band = f20.filter((c) => !c.some(atPole));
if (band.length !== 10) fail(`F20 keeps ${band.length} faces with its poles cut, expected 10`);
const bz = band.map((c) => c.reduce((s2, p) => s2 + p[2], 0) / 4);
if (Math.max(...bz) > 0.5 || Math.min(...bz) < -0.5)
    fail(`the surviving faces run ${Math.min(...bz)} .. ${Math.max(...bz)}; they should be an equatorial band`);
console.log(`F20 singularity: 20 faces less 5 at each pole = ${band.length}, a band at ` +
    `${Math.min(...bz).toFixed(3)} .. ${Math.max(...bz).toFixed(3)} against poles at ` +
    `${anchor[2].toFixed(3)} and ${topPole[2].toFixed(3)}`);

console.log(`F20: 20 golden rhombi on the five lifted generators · ΣE purely vertical, ` +
    `the two poles √5 = ${sumE[2].toFixed(6)} apart · volume ${vol.toFixed(6)} = the Cage's golden icosahedron`);

console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
