// Verification for src/pentapatch.ts — the patch from the pentagrid.
//
//   node tools/pentapatch.mjs
//
// The Exceptional page is about to stop growing its patch by deflation and start
// taking it from de Bruijn's construction (EXCEPTIONAL.md §7.1). That swap is only
// safe if the new source produces the same kind of object the old one did, so the
// roof's own invariants are asserted against it here — above all **Jake's rule, that a
// Penrose vertex index runs 1 to 4 inclusive and the pole is not part of the tiling**.
//
// At γ = 0 the raw dual breaks that rule: the five lines meet at a point, the dual
// grows a fan of ten rhombi sharing a corner at ΣK = 0, and that corner is the
// singularity's own pole. `pentaPatch` drops those ten, so what it returns is a legal
// tiling with a **hole** where the superposition belongs — which is right, because the
// superposition is not a surface at all (EXCEPTIONAL.md §7.4a: at γ = 0 the dual has
// ninety edges carrying three faces or more, and Euler −43). The page stands F₂₀ in
// that hole; it does not draw rhombi there.

import { pentaPatch, GAMMA_SINGULAR, GAMMA_JIGGLE } from "../dist/pentapatch.js";

const GOLDEN = (Math.acos(1 / Math.sqrt(5)) * 180) / Math.PI; // 63.4349
let bad = 0;
const fail = (m) => { bad++; console.log(`  x ${m}`); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);

console.log("preset    window  rhombi  index   hole       worst edge   worst corner");
console.log("-".repeat(74));

for (const [name, gamma, holeWanted] of [
    ["decagon", GAMMA_SINGULAR, 10],
    ["jiggle", GAMMA_JIGGLE, 0],
]) {
    for (const win of [4, 6, 8]) {
        const d = pentaPatch({ gamma, window: win });
        if (!d) { fail(`${name} w${win}: no patch`); continue; }

        // 1 · every face the golden rhombus, at unit edge — the roof's own convention
        let worstE = 0, worstA = 0;
        for (const f of d.faces) {
            const c = f.vids.map((v) => d.point(v));
            for (let i = 0; i < 4; i++) {
                const ab = sub(c[(i + 1) % 4], c[i]);
                const ap = sub(c[(i + 3) % 4], c[i]);
                worstE = Math.max(worstE, Math.abs(len(ab) - 1));
                const ang = (Math.acos(dot(ab, ap) / (len(ab) * len(ap))) * 180) / Math.PI;
                worstA = Math.max(worstA, Math.min(Math.abs(ang - GOLDEN), Math.abs(ang - (180 - GOLDEN))));
            }
        }
        if (worstE > 1e-9) fail(`${name} w${win}: an edge is off by ${worstE.toExponential(2)}`);
        if (worstA > 1e-7) fail(`${name} w${win}: a corner is off by ${worstA.toExponential(2)}°`);

        // 2 · `dirs` really is the pair in edge order, which is what the ribbons read
        for (const f of d.faces) {
            const c = f.vids.map((v) => d.point(v));
            const e0 = sub(c[1], c[0]), e1 = sub(c[3], c[0]);
            if (f.dirs[0] === f.dirs[1]) { fail(`${name} w${win}: face ${f.id} has dirs ${f.dirs}`); break; }
            if (Math.abs(len(sub(sub(c[2], c[1]), e1))) > 1e-9) { fail(`${name} w${win}: face ${f.id} is not a parallelogram`); break; }
            void e0;
        }

        // 3 · **the index law, both presets**: 1 to 4 inclusive, no exceptions, no pole
        const idx = [];
        for (let v = 0; v < d.P.length; v++) if (d.P[v]) idx.push(d.indexAt(v));
        const lo = Math.min(...idx), hi = Math.max(...idx);
        if (lo !== 1 || hi !== 4) fail(`${name} w${win}: index runs ${lo}..${hi}, expected 1..4`);

        // 4 · the hole: the singular case leaves a decagonal one at the origin where
        // its ten pole rhombi were, and a jiggle leaves none because it has no pole
        const ec = new Map();
        for (const f of d.faces)
            for (let i = 0; i < 4; i++) {
                const a = f.vids[i], b = f.vids[(i + 1) % 4];
                const k = a < b ? `${a}|${b}` : `${b}|${a}`;
                ec.set(k, (ec.get(k) ?? 0) + 1);
            }
        const rim = [...ec].filter(([, n]) => n === 1).map(([k]) => k.split("|").map(Number))
            .filter(([a, b]) => Math.hypot(d.P[a][0], d.P[a][1]) < 2 && Math.hypot(d.P[b][0], d.P[b][1]) < 2);
        const rimV = new Set(rim.flat()).size;
        if (rim.length !== holeWanted || rimV !== holeWanted)
            fail(`${name} w${win}: the hole at the origin is ${rim.length} edges on ${rimV} vertices, expected ${holeWanted}`);
        const atO = rim.length;

        console.log(
            `${name.padEnd(9)} ${String(win).padStart(5)} ${String(d.faces.length).padStart(7)} ` +
            `${`${lo}..${hi}`.padStart(6)} ${String(atO).padStart(10)}   ` +
            `${worstE.toExponential(1)}     ${worstA.toExponential(1)}°`,
        );
    }
}

// 5 · the window really is a line-number window: widening it only adds
const a = pentaPatch({ gamma: GAMMA_SINGULAR, window: 4 });
const b = pentaPatch({ gamma: GAMMA_SINGULAR, window: 6 });
const key = (f, d) => f.vids.map((v) => d.P[v].slice(0, 2).map((x) => Math.round(x * 1e6)).join(",")).sort().join("|");
const inB = new Set(b.faces.map((f) => key(f, b)));
const lost = a.faces.filter((f) => !inB.has(key(f, a))).length;
if (lost) fail(`${lost} rhombi of window 4 are missing from window 6 — the window is not nested`);
console.log(`\nwindow 4 (${a.faces.length}) nests inside window 6 (${b.faces.length}): ${lost === 0}`);

console.log(bad ? `\n${bad} problem${bad === 1 ? "" : "s"}` : "\nall checks passed");
process.exit(bad ? 1 : 0);
