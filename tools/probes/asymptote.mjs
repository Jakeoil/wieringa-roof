// Do the class proportions converge?
import { seedTypes, generatePatch, allRhombs, allP1Tiles } from "../../dist/geometry.js";
import { triacontahedra, CLASSES } from "../../dist/centers.js";
const PHI = (1 + Math.sqrt(5)) / 2;
console.log("seed  gen |  rhombi | T:t     | settled |    share of settled solids, by class            | per rhomb");
console.log("-".repeat(116));
const last = {};
for (const seed of ["Pe3", "Deca", "Sun", "Star"]) {
    for (const gen of [3, 4, 5]) {
        const q = console.log; console.log = () => {};
        const t0 = Date.now();
        generatePatch(seedTypes.findIndex((s) => s.label === seed), true, gen);
        if (allRhombs.length > 200000) { console.log = q; continue; }
        const cen = triacontahedra();
        const ms = Date.now() - t0;
        console.log = q;
        const F = allRhombs.length;
        const thick = allRhombs.filter((r) => r.thick).length;
        const set = cen.solids.filter((s) => s.settled);
        const per = CLASSES.map((n) => set.filter((s) => s.faces.length === n).length);
        const tot = per.reduce((a, b) => a + b, 0);
        const share = per.map((x) => (x / tot));
        console.log(
            `${seed.padEnd(5)} ${gen}   | ${String(F).padStart(7)} | ${(thick / (F - thick)).toFixed(4)} |` +
            ` ${String(tot).padStart(7)} | ${share.map((x, i) => `${CLASSES[i]}:${(100*x).toFixed(2)}%`).join(" ")} |` +
            ` ${(tot / F).toFixed(4)}  ${ms}ms`,
        );
        last[seed] = { share, tot, F, per };
    }
}
console.log("-".repeat(116));
console.log("\nLargest patch of each seed — share, and what 1/share looks like:");
for (const [seed, d] of Object.entries(last)) {
    console.log(`  ${seed.padEnd(5)} F=${d.F}`);
    CLASSES.forEach((n, i) => {
        const s = d.share[i];
        if (!s) return;
        const inv = 1 / s;
        // is 1/share close to a small combination a + b*phi ?
        let best = "";
        for (let a = -20; a <= 40 && !best; a++) for (let b = -20; b <= 40; b++) {
            if (Math.abs(a + b * PHI - inv) < 0.02 && (a || b)) { best = `≈ ${a}${b < 0 ? "−" : "+"}${Math.abs(b)}φ`; break; }
        }
        console.log(`     class ${String(n).padStart(2)}: ${(100*s).toFixed(3)}%   1/share = ${inv.toFixed(4)} ${best}`);
    });
}
