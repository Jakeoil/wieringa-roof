// Are there faces whose every triacontahedron holds only them?
import { seedTypes, generatePatch, allRhombs, edgeMap, vertexList } from "../../dist/geometry.js";
import { triacontahedra } from "../../dist/centers.js";

console.log("seed  gen | rhombi |            class sizes (best of a face's two solids)            | orphans | on the boundary");
console.log("-".repeat(118));
for (const seed of seedTypes.map((s) => s.label)) {
    for (const gen of [2, 3, 4]) {
        const q = console.log; console.log = () => {};
        generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
        console.log = q;
        if (!allRhombs.length) continue;
        const cen = triacontahedra();

        // boundary faces: any face with an edge that only one rhomb uses
        const bnd = new Set();
        for (const e of edgeMap.values()) if (e.rhombIds.length === 1) bnd.add(e.rhombIds[0]);

        const cls = {};
        const orphans = [];
        for (const f of cen.faces) {
            const n = Math.max(...f.solids.map((s) => cen.solids[s].faces.length));
            cls[n] = (cls[n] ?? 0) + 1;
            if (n === 1) orphans.push(f.id);
        }
        const onB = orphans.filter((id) => bnd.has(id)).length;
        const row = Object.keys(cls).map(Number).sort((a, b) => a - b)
            .map((k) => `${k}:${cls[k]}`).join(" ");
        console.log(
            `${seed.padEnd(5)} ${gen}   | ${String(allRhombs.length).padStart(6)} | ${row.padEnd(62)} |` +
            ` ${String(orphans.length).padStart(7)} | ${orphans.length ? `${onB}/${orphans.length}` : "—"}`,
        );
    }
}

// ── what is an orphan actually like? ──────────────────────────────
console.log("\nOrphans in detail. An orphan shares no solid with any neighbor, and two faces");
console.log("share one exactly when their fold is 36°, so an orphan is a face with no 36° fold.\n");
import { computeLift, pos3D } from "../../dist/geometry.js";
const nrm = (a) => { const L = Math.hypot(...a); return a.map((x) => x / L); };
const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
for (const [seed, gen] of [["Pe3", 3], ["Deca", 3], ["Sun", 3]]) {
    const q = console.log; console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
    console.log = q;
    const cen = triacontahedra();
    const lift = computeLift();
    const P = lift.n.map((nv) => (nv ? pos3D(nv) : null));
    const orphans = cen.faces.filter((f) => f.solids.every((s) => cen.solids[s].faces.length === 1));
    const stat = { thick: 0, thin: 0, deg: {}, folds: {} };
    for (const f of orphans) {
        f.thick ? stat.thick++ : stat.thin++;
        let deg = 0;
        for (const e of edgeMap.values()) {
            if (!e.rhombIds.includes(f.id) || e.rhombIds.length !== 2) continue;
            deg++;
            const other = cen.byRhomb[e.rhombIds.find((x) => x !== f.id)];
            const ea = P[e.v1], axis = nrm(sub(P[e.v2], ea));
            const perp = (v) => { const w = sub(v, ea); return sub(w, mul(axis, dot(w, axis))); };
            const arm = (g) => nrm(mul(g.vids.filter((v) => v !== e.v1 && v !== e.v2)
                .map((v) => perp(P[v])).reduce((a, b) => add(a, b)), 0.5));
            const fold = Math.round(180 - Math.acos(Math.max(-1, Math.min(1, dot(arm(f), arm(other))))) * 180 / Math.PI);
            stat.folds[fold] = (stat.folds[fold] ?? 0) + 1;
        }
        stat.deg[deg] = (stat.deg[deg] ?? 0) + 1;
    }
    console.log(`${seed} gen ${gen}: ${orphans.length} orphans — ${stat.thick} thick, ${stat.thin} thin;` +
        ` neighbors present ${JSON.stringify(stat.deg)} (of 4); folds to them ${JSON.stringify(stat.folds)}`);
}
