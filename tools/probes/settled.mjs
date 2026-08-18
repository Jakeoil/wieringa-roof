// Which centers is a patch actually entitled to classify?
//
// A center's ten candidate faces are fixed by its integer coordinates. If one of them
// falls outside the patch, the patch cannot tell whether it is missing from the tiling
// or merely missing from the cut — so the group size is a lower bound, not a class.
// A center is SETTLED when all ten candidate faces lie inside the patch's reach.
import {
    seedTypes, generatePatch, allRhombs, vertexMap, vertexList, edgeMap,
    roundKey, computeLift, pos3D, E5,
} from "../../dist/geometry.js";
import { triacontahedra, A6 } from "../../dist/centers.js";

const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const nrm=(a)=>mul(a,1/Math.hypot(...a));

// the ten roof-facing orientations, with the upward normal of each
const ORI = [];
for (let j = 0; j < 5; j++) for (let k = j + 1; k < 5; k++) {
    let u = nrm(crs(A6[j], A6[k])); if (u[2] < 0) u = mul(u, -1);
    ORI.push({ j, k, u, thick: Math.min((j-k+5)%5,(k-j+5)%5) === 1 });
}

/** The ten candidate faces of the solid with coordinates m, as lattice corners. */
function candidates(m) {
    const sz = Math.sign(m[5]);
    return ORI.map(({ j, k, u, thick }) => {
        const n = new Array(5);
        for (let i = 0; i < 5; i++) {
            n[i] = (i === j || i === k)
                ? (m[i] - 1) / 2
                : (m[i] - (Math.sign(dot(mul(u, sz), A6[i])) || 1)) / 2;
        }
        const bump = (a, i) => { const c = a.slice(); c[i]++; return c; };
        return { thick, corners: [n, bump(n, j), bump(bump(n, j), k), bump(n, k)] };
    });
}

console.log("seed  gen | rhombi | settled centers |          class over SETTLED centers          | orphans among settled");
console.log("-".repeat(112));
const totals = {};
for (const seed of seedTypes.map((s) => s.label)) {
    for (const gen of [2, 3, 4]) {
        const q = console.log; console.log = () => {};
        generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
        console.log = q;
        if (!allRhombs.length) continue;
        const lift = computeLift();
        const cen = triacontahedra();

        // lattice coordinate -> vertex id, and the set of faces actually present
        const byN = new Map();
        lift.n.forEach((nv, id) => { if (nv) byN.set(nv.join(","), id); });
        const faceKey = (vids) => [...vids].sort((a, b) => a - b).join(",");
        const present = new Set(cen.faces.map((f) => faceKey(f.vids)));

        let settled = 0;
        const cls = {};
        for (const s of cen.solids) {
            const cand = candidates(s.m);
            let allIn = true;
            let count = 0;
            for (const c of cand) {
                const ids = c.corners.map((n) => byN.get(n.join(",")));
                if (ids.some((x) => x === undefined)) { allIn = false; break; }
                if (present.has(faceKey(ids))) count++;
            }
            if (!allIn) continue;
            if (count !== s.faces.length) { console.log(`  ⚠ ${seed} ${gen}: candidate count ${count} vs group ${s.faces.length}`); }
            settled++;
            cls[count] = (cls[count] ?? 0) + 1;
            totals[count] = (totals[count] ?? 0) + 1;
        }
        const row = Object.keys(cls).map(Number).sort((a,b)=>a-b).map((k)=>`${k}:${cls[k]}`).join(" ");
        console.log(
            `${seed.padEnd(5)} ${gen}   | ${String(allRhombs.length).padStart(6)} |` +
            ` ${String(settled).padStart(15)} | ${row.padEnd(44)} | ${cls[1] ?? 0}`,
        );
    }
}
console.log("-".repeat(112));
console.log("all settled centers, every patch:", JSON.stringify(totals));
