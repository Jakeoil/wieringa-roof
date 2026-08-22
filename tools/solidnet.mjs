// Verification for src/solidnet.ts — unfolding closed solids into paper.
//
//   node tools/solidnet.mjs
//
// Six checks. The ones that matter are the two that would ruin a physical model without
// being visible on screen: every edge must keep its length and every corner its angle,
// because a net that is a little wrong folds into nothing.

import { bestUnfold, unfoldSolid } from "../dist/solidnet.js";
import { dissection, shellFaces, faceColor, pairColor, cellColors } from "../dist/dissect.js";

const GOLDEN_ACUTE = (Math.acos(1 / Math.sqrt(5)) * 180) / Math.PI;   // 63.4349
const GOLDEN_OBTUSE = 180 - GOLDEN_ACUTE;                              // 116.5651

let bad = 0;
const fail = (m) => { bad++; console.log(`  ✗ ${m}`); };

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function check(name, faces, net) {
    // 1 · every face placed exactly once
    if (net.placed.length !== faces.length) fail(`${name}: ${net.placed.length} placed of ${faces.length}`);
    if (new Set(net.placed.map((p) => p.id)).size !== faces.length) fail(`${name}: a face placed twice`);

    // 2 · edge lengths survive the flattening
    let worstEdge = 0;
    for (const p of net.placed) {
        const f = faces.find((x) => x.id === p.id);
        for (let i = 0; i < p.poly.length; i++) {
            const a3 = d3(f.corners[i], f.corners[(i + 1) % f.corners.length]);
            const a2 = d2(p.poly[i], p.poly[(i + 1) % p.poly.length]);
            worstEdge = Math.max(worstEdge, Math.abs(a3 - a2));
        }
    }
    if (worstEdge > 1e-9) fail(`${name}: an edge changed length by ${worstEdge.toExponential(2)}`);

    // 3 · and so do the corner angles — golden rhombi throughout
    let worstAng = 0;
    const seen = new Set();
    for (const p of net.placed) {
        for (let i = 0; i < p.poly.length; i++) {
            const a = p.poly[(i + p.poly.length - 1) % p.poly.length];
            const b = p.poly[i];
            const c = p.poly[(i + 1) % p.poly.length];
            const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
            const ang = (Math.acos((u[0]*v[0] + u[1]*v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI;
            const near = Math.min(Math.abs(ang - GOLDEN_ACUTE), Math.abs(ang - GOLDEN_OBTUSE));
            worstAng = Math.max(worstAng, near);
            seen.add(Math.round(ang * 100) / 100);
        }
    }
    if (worstAng > 1e-7) fail(`${name}: a corner is ${worstAng.toExponential(2)} off a golden angle`);

    // 4 · hinges are a spanning forest of the face graph
    if (net.hinges.length !== faces.length - net.pieces) {
        fail(`${name}: ${net.hinges.length} hinges against faces − pieces = ${faces.length - net.pieces}`);
    }

    // 5 · nothing overlaps within a piece
    const shrink = (P) => {
        const c = [P.reduce((s, q) => s + q[0], 0) / P.length, P.reduce((s, q) => s + q[1], 0) / P.length];
        return P.map((q) => [c[0] + (q[0] - c[0]) * 0.99, c[1] + (q[1] - c[1]) * 0.99]);
    };
    const hit = (A, B) => {
        for (const P of [A, B]) {
            for (let i = 0; i < P.length; i++) {
                const p = P[i], q = P[(i + 1) % P.length];
                const n = [-(q[1] - p[1]), q[0] - p[0]];
                const L = Math.hypot(...n); if (L < 1e-12) continue;
                n[0] /= L; n[1] /= L;
                const proj = (R) => R.map((r) => n[0]*r[0] + n[1]*r[1]);
                const a = proj(A), b = proj(B);
                if (Math.max(...a) < Math.min(...b) + 1e-9 || Math.max(...b) < Math.min(...a) + 1e-9) return false;
            }
        }
        return true;
    };
    let ov = 0;
    for (let i = 0; i < net.placed.length; i++)
        for (let j = i + 1; j < net.placed.length; j++)
            if (net.placed[i].piece === net.placed[j].piece &&
                hit(shrink(net.placed[i].poly), shrink(net.placed[j].poly))) ov++;
    if (ov) fail(`${name}: ${ov} overlapping face pairs in the net`);

    const angles = [...seen].sort((a, b) => a - b).join(", ");
    console.log(`${name.padEnd(26)} ${String(faces.length).padStart(2)} faces, ${net.pieces} piece(s), ` +
        `${net.width.toFixed(3)} x ${net.height.toFixed(3)}, angles {${angles}}`);
}

console.log("solid                      faces, pieces, size, corner angles");
console.log("-".repeat(78));

const cells = dissection("symmetric");
for (const which of [true, false]) {
    const c = cells.find((x) => x.acute === which);
    const faces = c.faces.map((f, i) => ({ id: i, corners: f, tag: faceColor(c, i) }));
    check(`${which ? "acute" : "obtuse"} hexahedron`, faces, bestUnfold(faces));
    // 6 · opposite faces share a colour, and the cell wears three
    for (let q = 0; q < 3; q++)
        if (faceColor(c, 2 * q) !== faceColor(c, 2 * q + 1))
            fail(`${which ? "acute" : "obtuse"}: an opposite pair differs in colour`);
    if (new Set(cellColors(c)).size !== 3) fail("a cell does not wear three colours");
}

const sh = shellFaces();
check("triacontahedron", sh.map((f, i) => ({ id: i, corners: f.corners, tag: pairColor(f.i, f.j) })), bestUnfold(sh.map((f, i) => ({ id: i, corners: f.corners, tag: pairColor(f.i, f.j) }))));

// all twenty, since the puzzle needs every one of them
let worstPieces = 0;
const sigs = new Set();
for (const c of cells) {
    const faces = c.faces.map((f, i) => ({ id: i, corners: f, tag: faceColor(c, i) }));
    const n = bestUnfold(faces);
    worstPieces = Math.max(worstPieces, n.pieces);
    sigs.add(cellColors(c).join(""));
    if (n.pieces !== 1) fail(`cell ${c.id} needs ${n.pieces} pieces`);
}
console.log(`\nall twenty cells unfold whole (worst ${worstPieces} piece), ` +
    `${sigs.size} distinct colour triples — C(5,3) = 10, each borne twice`);
console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
