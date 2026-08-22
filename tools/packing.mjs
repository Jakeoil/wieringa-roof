// Verification for src/packing.ts — the ping-pong packing.
//
//   node tools/packing.mjs
//
// Six checks. The last is the one that matters most: the bucketed search must agree
// with a plain O(n^2) sweep exactly, not merely approximately, because a grid that
// misses a neighbor fails silently and looks like a finding.

import { seedTypes, generatePatch, allRhombs } from "../dist/geometry.js";
import { triacontahedra, RHO, A6 } from "../dist/centers.js";
import { packing, properBalls } from "../dist/packing.js";

const crs = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm = (a) => { const L = Math.hypot(...a); return a.map((x) => x / L); };
const d3 = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const NORMALS = [];
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) NORMALS.push(nrm(crs(A6[i], A6[j])));

let failures = 0;
const fail = (p, m) => { failures++; console.log(`  ✗ ${p}: ${m}`); };

console.log("seed  gen |  balls | contacts | on roof | overlaps | components | degrees");
console.log("-".repeat(88));
for (const seed of seedTypes.map((s) => s.label)) {
    for (const gen of [2, 3, 4]) {
        const q = console.log; console.log = () => {};
        generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
        console.log = q;
        if (!allRhombs.length) continue;
        const cen = triacontahedra();
        const balls = properBalls(cen);
        const p = packing(cen, balls);
        const patch = `${seed} gen ${gen}`;

        // 1 · every contact is exactly 2rho
        let worst = 0;
        for (const c of p.contacts) worst = Math.max(worst, Math.abs(d3(balls[c.a].c, balls[c.b].c) - 2 * RHO));
        if (worst > 1e-9) fail(patch, `a contact is ${worst.toExponential(1)} off 2rho`);

        // 2 · every contact lies along a face normal, so the polyhedra meet face to face
        let offAxis = 0;
        for (const c of p.contacts) {
            const u = nrm([0,1,2].map((k) => balls[c.b].c[k] - balls[c.a].c[k]));
            if (!NORMALS.some((n) => Math.abs(Math.abs(dot(n, u)) - 1) < 1e-9)) offAxis++;
        }
        if (offAxis) fail(patch, `${offAxis} contacts not along a face normal`);

        // 3 · the on-roof contacts are exactly the shared rhombi
        const shared = new Set();
        const ids = new Set(balls.map((b) => b.id));
        for (const f of cen.faces) if (ids.has(f.solids[0]) && ids.has(f.solids[1])) shared.add(f.id);
        const onRoof = p.contacts.filter((c) => c.onRoof !== null).map((c) => c.onRoof);
        if (onRoof.length !== shared.size || onRoof.some((r) => !shared.has(r))) {
            fail(patch, `on-roof contacts ${onRoof.length} against ${shared.size} shared rhombi`);
        }

        // 4 · and they kiss at that rhomb's own center
        let kissErr = 0;
        for (const c of p.contacts) if (c.onRoof !== null) kissErr = Math.max(kissErr, d3(c.at, cen.byRhomb[c.onRoof].c));
        if (kissErr > 1e-9) fail(patch, `kiss point ${kissErr.toExponential(1)} off the rhomb center`);

        // 5 · coordination is only ever 0, 2, 3 or 4
        const bad = p.degree.filter((d) => ![0, 2, 3, 4].includes(d));
        if (bad.length) fail(patch, `${bad.length} balls with coordination outside {0,2,3,4}: ${[...new Set(bad)]}`);

        // 6 · the bucketed search agrees with a plain sweep
        if (balls.length <= 3000) {
            let c2 = 0, o2 = 0;
            for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
                const d = d3(balls[i].c, balls[j].c);
                if (Math.abs(d - 2 * RHO) < 1e-9) c2++;
                else if (d < 2 * RHO - 1e-9) o2++;
            }
            if (c2 !== p.contacts.length || o2 !== p.overlapPairs) {
                fail(patch, `grid says ${p.contacts.length}/${p.overlapPairs}, sweep says ${c2}/${o2}`);
            }
        }

        const h = {}; for (const d of p.degree) h[d] = (h[d] ?? 0) + 1;
        console.log(
            `${seed.padEnd(5)} ${gen}   | ${String(balls.length).padStart(6)} | ${String(p.contacts.length).padStart(8)} |` +
            ` ${String(onRoof.length).padStart(7)} | ${String(p.overlapPairs).padStart(8)} |` +
            ` ${String(p.components).padStart(10)} | ${JSON.stringify(h)}`,
        );
    }
}
console.log("-".repeat(88));
console.log(failures === 0 ? "all checks passed" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
