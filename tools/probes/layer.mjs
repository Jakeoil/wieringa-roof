// Part 4 — is the roof the boundary of a layer of golden rhombohedra?
//
// The question in jake/Triacontrahedrons are golden.md, which settles the local fit and
// leaves the global one open: "which third edge vector is chosen for each cell".
//
// There is a counting fact that makes it tractable. A rhombohedron on axes {j,k,l} has
// corners n + any subset, so its eight corners sit at index levels i, i+1, i+1, i+1,
// i+2, i+2, i+2, i+3 — it spans exactly **four** levels. And the roof spans exactly four,
// index 1 to 4. So a layer between them can only ever be **one cell thick**, and every
// cell in it must have its low corner at index 1.
//
// That is a strong constraint and it is checkable: enumerate the cells whose eight
// corners are all roof vertices, and see whether they fit together.
import { seedTypes, generatePatch, allRhombs, vertexList, vertexMap, roundKey, computeLift } from "../../dist/geometry.js";

const KEY = (n) => n.join(",");

for (const [seed, gen] of [["Pe3", 3], ["Sun", 3], ["Sun", 4]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    const lift = computeLift();
    console.log = q;

    // lattice coordinate -> vertex, and its index
    const byN = new Map();
    lift.n.forEach((nv, id) => { if (nv) byN.set(KEY(nv), id); });
    const idxOf = (nv) => {
        const id = byN.get(KEY(nv));
        return id === undefined ? null : vertexList[id].index;
    };

    const levels = {};
    for (const v of vertexList) levels[v.index] = (levels[v.index] ?? 0) + 1;

    // every rhomb, by the index of its low corner
    const lowIdx = {};
    for (const r of allRhombs) {
        const vi = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
        const lo = Math.min(...vi.map((v) => vertexList[v].index));
        lowIdx[lo] = (lowIdx[lo] ?? 0) + 1;
    }

    // candidate cells: low corner at index 1, all eight corners present in the roof
    const triples = [];
    for (let j = 0; j < 5; j++) for (let k = j + 1; k < 5; k++) for (let l = k + 1; l < 5; l++) triples.push([j, k, l]);
    const cells = [];
    let tried = 0;
    for (const [nkey, id] of byN) {
        if (vertexList[id].index !== 1) continue;
        const n = nkey.split(",").map(Number);
        for (const T of triples) {
            tried++;
            const corners = [];
            let ok = true;
            for (let b = 0; b < 8 && ok; b++) {
                const c = n.slice();
                for (let q2 = 0; q2 < 3; q2++) if (b & (1 << q2)) c[T[q2]]++;
                const cid = byN.get(KEY(c));
                if (cid === undefined) ok = false;
                else corners.push(cid);
            }
            if (ok) cells.push({ n, T, corners });
        }
    }

    // which roof rhombi are faces of some cell?
    const faceKey = (ids) => [...ids].sort((a, b) => a - b).join(",");
    const roofFaces = new Map();
    for (const r of allRhombs) {
        const vi = r.verts.map((pt) => vertexMap.get(roundKey(pt)).id);
        roofFaces.set(faceKey(vi), r.id);
    }
    const covered = new Set();
    let cellFaces = 0;
    for (const c of cells) {
        // six faces: for each axis of the triple, the two extremes
        for (let q2 = 0; q2 < 3; q2++) {
            const [a, b] = [0, 1, 2].filter((x) => x !== q2);
            for (const s of [0, 1]) {
                const ids = [];
                for (const bits of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
                    const cc = c.n.slice();
                    if (s) cc[c.T[q2]]++;
                    if (bits[0]) cc[c.T[a]]++;
                    if (bits[1]) cc[c.T[b]]++;
                    ids.push(byN.get(KEY(cc)));
                }
                cellFaces++;
                const fk = faceKey(ids);
                if (roofFaces.has(fk)) covered.add(roofFaces.get(fk));
            }
        }
    }

    console.log(`\n=== ${seed} gen ${gen}: ${allRhombs.length} rhombi ===`);
    console.log(`  vertices by index: ${JSON.stringify(levels)}`);
    console.log(`  rhombi by low-corner index: ${JSON.stringify(lowIdx)}  (the index window: 1 or 2 only)`);
    console.log(`  candidate cells (low corner index 1, all eight corners in the roof): ${cells.length} of ${tried} tried`);
    const byType = {};
    for (const c of cells) {
        // acute when the three axes are pairwise "adjacent" in the 5-fold order
        const d = [[0,1],[0,2],[1,2]].map(([x,y]) => Math.min((c.T[x]-c.T[y]+5)%5, (c.T[y]-c.T[x]+5)%5));
        const key = d.slice().sort().join("");
        byType[key] = (byType[key] ?? 0) + 1;
    }
    console.log(`  cells by axis-gap signature: ${JSON.stringify(byType)}`);
    console.log(`  roof rhombi that are a face of some candidate cell: ${covered.size} of ${allRhombs.length}` +
        ` (${((100 * covered.size) / allRhombs.length).toFixed(1)}%)`);
}
