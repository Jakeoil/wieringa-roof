// Part 4, second attempt. The first asked whether a cell's eight corners are all roof
// vertices, and got zero — of course it did. The roof is one surface; a cell's lower
// corners lie on the *second* surface, whose existence is the whole question.
//
// The right local test: take a roof rhomb as the TOP face of a cell, choose the third
// axis, and ask whether the cell's other two upper faces are roof rhombi too. If the
// roof is the top of a layer, they must be — a cell meets the top surface in three
// faces around its apex, not one.
import { seedTypes, generatePatch, allRhombs, vertexList, vertexMap, roundKey, computeLift } from "../../dist/geometry.js";

const K = (n) => n.join(",");
const bump = (n, i) => { const c = n.slice(); c[i]++; return c; };

for (const [seed, gen] of [["Pe3", 3], ["Sun", 3], ["Sun", 4]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    const lift = computeLift();
    console.log = q;

    const byN = new Map();
    lift.n.forEach((nv, id) => { if (nv) byN.set(K(nv), id); });
    const faceKey = (ids) => [...ids].sort((a, b) => a - b).join(",");
    const roof = new Set();
    const rhombOf = new Map();
    for (const r of allRhombs) {
        const vi = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
        roof.add(faceKey(vi));
        rhombOf.set(r.id, { r, vi });
    }
    /** the rhomb with low corner n on axes a,b — present in the roof? */
    const hasFace = (n, a, b) => {
        const ids = [n, bump(n, a), bump(bump(n, a), b), bump(n, b)].map((c) => byN.get(K(c)));
        if (ids.some((x) => x === undefined)) return false;
        return roof.has(faceKey(ids));
    };

    // per rhomb: which third axes give a cell whose other two upper faces are also roof
    const hist = {};
    const perRhomb = new Map();
    for (const r of allRhombs) {
        const vi = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
        const n0 = lift.n[vi[0]];
        const nlo = vi.map((v) => lift.n[v]).reduce((a, b) => a.map((x, i) => Math.min(x, b[i])));
        const [j, k] = r.pair;
        const good = [];
        for (let l = 0; l < 5; l++) {
            if (l === j || l === k) continue;
            // cell low corner m = nlo - e_l; its other two upper faces:
            //   {j,l} at +e_k  -> low corner m + e_k
            //   {k,l} at +e_j  -> low corner m + e_j
            // The cell's bottom corner sits on the *lower* surface and is not required
            // to be a roof vertex — gating on that was a false negative first time round.
            const m = nlo.slice(); m[l]--;
            const f1 = hasFace(bump(m, k), j, l);
            const f2 = hasFace(bump(m, j), k, l);
            if (f1 && f2) good.push(l);
        }
        perRhomb.set(r.id, good);
        hist[good.length] = (hist[good.length] ?? 0) + 1;
    }

    // the same, taking the rhomb as the BOTTOM face of a cell above it
    const histUp = {};
    for (const r of allRhombs) {
        const vi = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
        const nlo = vi.map((v) => lift.n[v]).reduce((a, b) => a.map((x, i) => Math.min(x, b[i])));
        const [j, k] = r.pair;
        let good = 0;
        for (let l = 0; l < 5; l++) {
            if (l === j || l === k) continue;
            // cell low corner nlo; its other two lower faces are {j,l} and {k,l} at nlo
            if (hasFace(nlo, j, l) && hasFace(nlo, k, l)) good++;
        }
        histUp[good] = (histUp[good] ?? 0) + 1;
    }

    console.log(`\n=== ${seed} gen ${gen}: ${allRhombs.length} rhombi ===`);
    console.log(`  as a cell's TOP face — third axes that work: ${JSON.stringify(hist)}`);
    console.log(`  as a cell's BOTTOM face — third axes that work: ${JSON.stringify(histUp)}`);
    const stuck = [...perRhomb.values()].filter((g) => g.length === 0).length;
    console.log(`  rhombi with no legal cell beneath: ${stuck} of ${allRhombs.length}` +
        ` (${((100 * stuck) / allRhombs.length).toFixed(1)}%)`);
}
