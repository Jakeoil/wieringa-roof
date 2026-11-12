// Which skewb is LONG? — the measurement, because the two answers disagree.
//
//   node tools/probes/longshort.mjs
//
// Jake's note on the singularity controls says
//
//     "O_6 is the thick hex/Long/L.  It projects 2 thicks and a thin on each side."
//     "A_6 is the thin hex/Short/S.  It projects a thick and two thins on each side."
//
// while `exceptional.ts` has `long: isAcute(tri)` — long = acute = A6. Both cannot be
// the same claim, so this measures every reading of "long" there is and says which
// claim each one supports. The projections settle A6/O6 themselves, independently of
// any name: they are checkable and they are not in dispute.

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;
const S = 2 / Math.sqrt(5);          // the plane scale, so the edge is 1
const RISE = 1 / Math.sqrt(5);
/** the five lifted generators: unit edge, all the same height */
const E = [0, 1, 2, 3, 4].map((j) => [
    S * Math.cos((TAU * j) / 5), S * Math.sin((TAU * j) / 5), RISE,
]);

const sub = (a, b) => a.map((x, i) => x - b[i]);
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a) => Math.hypot(...a);

const TRIPLES = [];
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) {
    TRIPLES.push([a, b, c]);
}
const consecutive = (T) =>
    [0, 1, 2, 3, 4].some((s) => [s, (s + 1) % 5, (s + 2) % 5].every((g) => T.includes(g)));
/** a rhomb spanned by i,j: generators one apart are the THICK rhomb, two apart the thin */
const gap = (i, j) => Math.min(Math.abs(i - j), 5 - Math.abs(i - j));

let bad = 0;
const rows = [];
for (const T of TRIPLES) {
    const [a, b, c] = T.map((g) => E[g]);
    const vol = Math.abs(dot(a, cross(b, c)));
    const obl = consecutive(T);
    const pairs = [[T[0], T[1]], [T[0], T[2]], [T[1], T[2]]];
    const thick = pairs.filter(([i, j]) => gap(i, j) === 1).length;
    // the body diagonal, in the plane: anchor to the far corner of the hexagon
    const body = [0, 1, 2].map((d) => a[d] + b[d] + c[d]);
    const flat = norm([body[0], body[1]]);
    // ...and the hexagon's extent along each of its own three generator directions,
    // in the plane. A spoke runs along one generator, so this is the step it takes.
    const along = T.map((g) => {
        const u = [E[g][0], E[g][1]];
        const n = norm(u);
        return Math.abs(body[0] * u[0] + body[1] * u[1]) / n;
    });
    rows.push({ T: T.join(""), kind: obl ? "O6" : "A6", vol, thick, thin: 3 - thick, flat, along });
}

console.log("  triple  kind   |det|   projects      flat diagonal   extent along its own three");
for (const r of rows) {
    console.log(`  ${r.T}     ${r.kind}   ${r.vol.toFixed(6)}  ${r.thick} thick ${r.thin} thin`
        + `   ${r.flat.toFixed(6)}      ${r.along.map((x) => x.toFixed(4)).join(" ")}`);
}

const O = rows.filter((r) => r.kind === "O6");
const A = rows.filter((r) => r.kind === "A6");
const same = (xs, f) => xs.every((x) => Math.abs(f(x) - f(xs[0])) < 1e-9);
const check = (claim, ok) => { if (!ok) { bad++; console.log(`  ✗ ${claim}`); } else console.log(`  · ${claim}`); };

console.log("\nthe projections — not in dispute, and they name the solids on their own");
check("O6 is the cyclically consecutive triple, and projects 2 thick + 1 thin",
    O.length === 5 && O.every((r) => r.thick === 2));
check("A6 is the non-consecutive triple, and projects 1 thick + 2 thin",
    A.length === 5 && A.every((r) => r.thick === 1));
check("so Jake's two projection sentences are exact: O6 = 2 thicks and a thin, A6 = a thick and two thins",
    O.every((r) => r.thick === 2) && A.every((r) => r.thick === 1));

console.log("\nLONG, read three ways");
check(`by VOLUME, A6 is long: ${A[0].vol.toFixed(6)} against O6's ${O[0].vol.toFixed(6)}, ratio `
    + `${(A[0].vol / O[0].vol).toFixed(6)} = phi`,
    same(A, (r) => r.vol) && same(O, (r) => r.vol)
    && Math.abs(A[0].vol / O[0].vol - PHI) < 1e-9);
// In the plane a generator is `S` long, not 1 — the lift puts the rest of the unit
// edge into the rise — so the diagonals come out phi*S and S/phi, and it is their
// RATIO that is clean. Reading phi off the figure directly was the first draft's
// error and it was off by exactly that factor.
check(`by the FLAT DIAGONAL, O6 is long: ${O[0].flat.toFixed(6)} = phi*S against A6's `
    + `${A[0].flat.toFixed(6)} = S/phi, ratio ${(O[0].flat / A[0].flat).toFixed(6)} = phi^2`,
    Math.abs(O[0].flat - PHI * S) < 1e-9 && Math.abs(A[0].flat - S / PHI) < 1e-9
    && Math.abs(O[0].flat / A[0].flat - PHI * PHI) < 1e-9);
// the step a spoke takes: the extent along the generator the chain runs on. Every
// triple carries three of the five, so each has three such steps; the largest is the
// one a spoke of that figure advances by.
const step = (r) => Math.max(...r.along);
check(`by the STEP along its own generator, O6 is long: ${step(O[0]).toFixed(6)} against `
    + `A6's ${step(A[0]).toFixed(6)}, ratio ${(step(O[0]) / step(A[0])).toFixed(6)}`,
    step(O[0]) > step(A[0]));

console.log(`\n  so: the VOLUME says A6 is long, the PLANE says O6 is.`);
console.log(`  The musical sequence lives on a spoke, which is a line in the plane, so`);
console.log(`  Jake's L/S is the planar one and the code's \`long: isAcute\` is the volume.`);
console.log(bad === 0 ? "\nall checks passed" : `\n${bad} FAILURES`);
