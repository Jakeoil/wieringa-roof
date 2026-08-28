// Do the six tiles interlock?
//
//   node tools/probes/compose.mjs
//
// HEXAHEDRA.md's first open question, and the one that decides whether the set is a
// map or six ornaments. Adjacent P1 tiles share an edge, so their rhomb patches ought
// to abut wall to wall and height to height — but the lift is integrated by BFS from a
// root, so nothing guarantees a tile's heights land where a neighbor expects them.
//
// The test needs no placement arithmetic. `Sun` is one Pe5 ringed by five Pe3, and
// `Star` is five Pe1 ringed by five Pe3, so the composite patches are ready-made
// arrangements of tiles the generator can also produce alone. Generate the tile by
// itself, then look for a rigid motion — a turn about the vertical by a multiple of
// 36°, a translation, and a whole-number shift in height — that drops it into the
// composite. If every constituent fits and together they account for every rhomb, the
// tiles compose by superposition and the set is a kit.

import { generatePatch, allRhombs, seedTypes, vertexMap, roundKey } from "../../dist/geometry.js";

const quiet = (f) => { const l = console.log; console.log = () => {}; const r = f(); console.log = l; return r; };
const idx = (l) => seedTypes.findIndex((s) => s.label === l);
const R = 1e4;

/** A patch as rhombi, each the sorted key of its four lifted corners. */
function patch(label, gen) {
    quiet(() => generatePatch(idx(label), true, gen));
    return allRhombs.map((r) => r.verts.map((p) => {
        const v = vertexMap.get(roundKey(p));
        return [p.x, p.y, v.index];
    }));
}
const rkey = (c) => c.map(([x, y, i]) => `${Math.round(x * R)},${Math.round(y * R)},${i}`).sort().join("|");

/**
 * Every placement of `tile` inside `host`: turn, shift, raise. Candidates come from
 * matching the tile's first rhombus against each of the host's, which pins the motion
 * exactly, so nothing is searched blindly.
 */
function placements(tile, host) {
    const hostSet = new Set(host.map(rkey));
    const found = [];
    const seen = new Set();
    const t0 = tile[0];
    const c0 = t0.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5, cs = Math.cos(a), sn = Math.sin(a);
        // A turn by an *odd* multiple of 36° inverts the lift. The five generators sit
        // 72° apart while the planar edge directions sit 36° apart, so a half-step maps
        // each direction to its own negative and takes every height with it. Rotating a
        // patch without inverting its heights was the first version of this probe, and
        // it found no Pe3 anywhere in the Sun.
        const flip = k % 2 === 1;
        const turn = ([x, y, i]) => [x * cs - y * sn, x * sn + y * cs, flip ? -i : i];
        const rot = tile.map((r) => r.map(turn));
        const rc = [c0[0] * cs - c0[1] * sn, c0[0] * sn + c0[1] * cs];
        for (const h of host) {
            const hc = h.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
            const dx = hc[0] - rc[0], dy = hc[1] - rc[1];
            // height offset: match the lowest corner of the seed rhombus to the lowest
            // of the host's, which is the only shift that can possibly work
            const di = Math.min(...h.map((p) => p[2])) - Math.min(...rot[0].map((p) => p[2]));
            const moved = rot.map((r) => r.map(([x, y, i]) => [x + dx, y + dy, i + di]));
            if (!moved.every((r) => hostSet.has(rkey(r)))) continue;
            const sig = moved.map(rkey).sort().join(";");
            if (seen.has(sig)) continue;
            seen.add(sig);
            found.push({ turn: k * 36, flip, di, rhombi: moved.map(rkey) });
        }
    }
    return found;
}

// The composite seeds hold more than the tiles they are named for — a Sun is a Pe5
// and its ring of Pe3, but also rings of Pe1 and St1 further out — so rather than
// assume an arrangement, try all six and see what fits.
const ALL = ["Pe5", "Pe3", "Pe1", "St5", "St3", "St1"];

for (const [host, gen] of [["Sun", 2], ["Sun", 3], ["Star", 2], ["Star", 3], ["Deca", 3]]) {
    const H = patch(host, gen);
    const hostKeys = new Set(H.map(rkey));
    console.log(`\n${host} generation ${gen}: ${H.length} rhombi`);
    const cover = new Map();
    for (const label of ALL) {
        const T = patch(label, gen);
        if (!T.length) { console.log(`  ${label.padEnd(4)} emits no rhombi at this generation`); continue; }
        const P = placements(T, H);
        if (!P.length) { console.log(`  ${label.padEnd(4)} (${String(T.length).padStart(4)} rhombi)  no placement`); continue; }
        for (const p of P) for (const k of p.rhombi) cover.set(k, (cover.get(k) ?? 0) + 1);
        const turns = [...new Set(P.map((p) => p.turn))].sort((a, b) => a - b);
        console.log(
            `  ${label.padEnd(4)} (${String(T.length).padStart(4)} rhombi)  ${String(P.length).padStart(2)} placement${P.length === 1 ? " " : "s"}` +
            `  ${P.filter((x) => x.flip).length} turned over  turns ${turns.join("/")}°` +
            `  heights {${[...new Set(P.map((x) => x.di))].sort((a, b) => a - b).join(",")}}`,
        );
    }
    const missing = [...hostKeys].filter((k) => !cover.has(k)).length;
    const twice = [...cover.values()].filter((n) => n > 1).length;
    console.log(
        `  covers ${cover.size} of ${H.length}` +
        `${missing ? `, ${missing} uncovered` : ", all of it"}` +
        `${twice ? `, ${twice} covered more than once` : ", none twice"}`,
    );
}
