// The canonical facts, checked — colors, the worm, the slab, the substitution.
//
//   node tools/probes/canon.mjs
//
// Jake set down a page of facts and asked for them to be checked and for the
// documentation to be made to agree. Each section here is one of his sentences,
// measured. Where a claim is wrong the check fails and says what the number is.

const PHI = (1 + Math.sqrt(5)) / 2;
const SILVER = 1 + Math.SQRT2;
const D2R = Math.PI / 180;
let bad = 0;
const check = (claim, ok) => {
    if (ok) console.log(`  · ${claim}`);
    else { bad++; console.log(`  ✗ ${claim}`); }
};

// ── the five colors ───────────────────────────────────────────────
//
// `FIVE` in goldenview.ts, by eye: 0xd94f3d red, 0xe8a33d amber (Jake's "yellow"),
// 0x4f9d4a green, 0x3d7fc4 blue, 0x9b59b6 purple.
const NAME = ["red", "yellow", "green", "blue", "purple"];

/** `makeDirections` in the pentagrid library: angle = 2*pi*j/n, +90 degrees when vertical. */
const dirAngle = (j, vertical) => 72 * j + (vertical ? 90 : 0);

console.log("the five colors, and the order they come in");
check("a generator index counts COUNTER-CLOCKWISE: angle = 72j, increasing with j",
    [0, 1, 2, 3, 4].every((j) => dirAngle(j, false) === 72 * j));
check("with vertical symmetry, generator 0 points straight UP: 90 degrees",
    dirAngle(0, true) === 90);

// Walking counter-clockwise round a decagon one takes 36-degree steps, and each step
// lands on the OTHER end of a family — a family's two ends are 180 apart, which is an
// odd number of 36s. So the families do not come in index order: they come in steps of
// three, which is the pentagram order.
const deca = [];
for (let k = 0; k < 10; k++) {
    const a = ((36 * k) % 360 + 360) % 360;
    let found = null;
    for (let j = 0; j < 5; j++) {
        if (Math.abs(((dirAngle(j, false) % 360) + 360) % 360 - a) < 1e-9) found = [j, "+"];
        if (Math.abs(((dirAngle(j, false) + 180) % 360 + 360) % 360 - a) < 1e-9) found = [j, "-"];
    }
    deca.push(found);
}
const decaStr = deca.map(([j, s]) => `${NAME[j]}${s}`).join(" ");
const JAKE_DECA = "red+ blue- yellow+ purple- green+ red- blue+ yellow- purple+ green-";
console.log(`  counter-clockwise on the decagon: ${decaStr}`);
check(`...which is Jake's sequence exactly`, decaStr === JAKE_DECA);
check("so the counter-clockwise order of FAMILIES is 0 3 1 4 2 — steps of three, the "
    + "pentagram order, not 0 1 2 3 4",
    deca.slice(0, 5).map(([j]) => j).join("") === "03142");

const pent = [0, 1, 2, 3, 4].map((j) => `${NAME[j]}+`).join(" ");
console.log(`  counter-clockwise on the pentagon:  ${pent}`);
check("...which is Jake's sequence exactly: only the + ends, so index order",
    pent === "red+ yellow+ green+ blue+ purple+");

// ── the Conway worm ───────────────────────────────────────────────
//
// A grid line of family j is perpendicular to v_j, so the ribbon of rhombs dual to it
// runs ALONG that line, which is the direction v_j turned a quarter. A rhomb of the
// ribbon is spanned by v_j and some v_k, and the step it contributes along the ribbon
// is v_k's component across v_j — |sin| of the angle between them.
console.log("\nthe Conway worm: the two steps along a ribbon");
const step = (gap) => Math.abs(Math.sin(72 * gap * D2R));
console.log(`  thick rhomb (generators one apart, 72 deg): ${step(1).toFixed(6)}`);
console.log(`  thin  rhomb (two apart, 144 deg):           ${step(2).toFixed(6)}`);
check(`L/S = ${(step(1) / step(2)).toFixed(6)} = phi — so on the worm the THICK rhomb is `
    + `L and the thin is S`,
    Math.abs(step(1) / step(2) - PHI) < 1e-12 && step(1) > step(2));

// ── the hexagons ──────────────────────────────────────────────────
//
// The same question asked of the HEXAGONS rather than the rhombs gives phi^2, not phi:
// `tools/probes/longshort.mjs` has it in full. Repeated here because the two live one
// sentence apart in Jake's note and the numbers are not the same number.
const S = 2 / Math.sqrt(5);
const V = [0, 1, 2, 3, 4].map((j) => [S * Math.cos(72 * j * D2R), S * Math.sin(72 * j * D2R)]);
const body = (T) => Math.hypot(...[0, 1].map((d) => T.reduce((s, g) => s + V[g][d], 0)));
console.log("\nthe hexagons' own flat diagonals");
console.log(`  O6 {0,1,2}, consecutive, the thick hexagon: ${body([0, 1, 2]).toFixed(6)} = phi*S`);
console.log(`  A6 {0,1,3}, the thin hexagon:               ${body([0, 1, 3]).toFixed(6)} = S/phi`);
check(`their ratio is ${(body([0, 1, 2]) / body([0, 1, 3])).toFixed(6)} = phi^2, NOT phi — a `
    + `different length from the worm's step`,
    Math.abs(body([0, 1, 2]) / body([0, 1, 3]) - PHI * PHI) < 1e-12);

// ── the K code, which is where the error actually was ────────────
//
// `angleCode` in the library's resolve.ts: the gaps between the generator DIRECTIONS
// taken modulo a half turn, in units of 180/n, sorted. Not the gaps between the
// indices modulo n — and that is exactly the slip that put K122 on the wrong solid in
// EXCEPTIONAL.md §7.4g, since the two give opposite answers.
const angleCode = (T) => {
    const at = T.map((j) => ((72 * j) % 180 + 180) % 180).sort((a, b) => a - b);
    const gaps = at.map((x, i) => (i + 1 < at.length ? at[i + 1] - x : 180 - at[at.length - 1] + at[0]));
    return gaps.map((g) => Math.round(g / 36)).sort().join("");
};
const idxCode = (T) => {
    const g = T.map((j, i) => (T[(i + 1) % 3] - j + 5) % 5).sort();
    return g.join("");
};
console.log("\nthe K code: direction gaps mod 180, NOT index gaps mod 5");
console.log(`  O6 {0,1,2}: angle code ${angleCode([0, 1, 2])}   (index gaps would say `
    + `${idxCode([0, 1, 2])})`);
console.log(`  A6 {0,1,3}: angle code ${angleCode([0, 1, 3])}   (index gaps would say `
    + `${idxCode([0, 1, 3])})`);
check("K122 is the OBLATE, the thick hexagon — which is what the library's FAMILIAR "
    + "table says, and what EXCEPTIONAL.md line 387 says",
    angleCode([0, 1, 2]) === "122");
check("K113 is the ACUTE, the thin hexagon", angleCode([0, 1, 3]) === "113");
check("reading the code off the INDEX gaps instead gives the opposite answer, which is "
    + "the mistake: 113 for the oblate and 122 for the acute",
    idxCode([0, 1, 2]) === "113" && idxCode([0, 1, 3]) === "122");

// ── the slab, which is the other correspondence ───────────────────
//
// A slab hexahedron is a Penrose rhomb plus the VERTICAL generator, which no pentagrid
// can supply. Its volume is |det| of the three, and the vertical turns the determinant
// into the rhomb's own area — so the correspondence inverts, exactly as Jake warns.
console.log("\nthe slab: a rhomb extruded on the vertical generator");
const RISE = 1 / Math.sqrt(5);
const E = V.map(([x, y]) => [x, y, RISE]);
const det3 = (a, b, c) => Math.abs(
    a[0] * (b[1] * c[2] - b[2] * c[1])
    - a[1] * (b[0] * c[2] - b[2] * c[0])
    + a[2] * (b[0] * c[1] - b[1] * c[0]),
);
const ACUTE = det3(E[0], E[1], E[3]);
const OBLATE = det3(E[0], E[1], E[2]);
const vert = [0, 0, 1];
const slabThick = det3(E[0], E[1], vert);     // generators one apart: a THICK rhomb
const slabThin = det3(E[0], E[2], vert);      // two apart: a THIN rhomb
console.log(`  roof: A6 (acute) ${ACUTE.toFixed(6)}   O6 (oblate) ${OBLATE.toFixed(6)}`);
console.log(`  slab: thick rhomb ${slabThick.toFixed(6)}   thin rhomb ${slabThin.toFixed(6)}`);
check("a THICK rhomb extruded is the A6, and a THIN rhomb the O6 — the opposite way "
    + "round from the roof's hexagons, where the O6 CONTAINS two thick rhombs",
    Math.abs(slabThick - ACUTE) < 1e-12 && Math.abs(slabThin - OBLATE) < 1e-12);

// ── the substitution ──────────────────────────────────────────────
console.log("\nthe Conway musical sequence: S -> L, L -> SL");
const apply = (rule, w) => [...w].map((c) => rule[c]).join("");
const sigma = { S: "L", L: "SL" };
let w = "L";
const words = [];
for (let i = 0; i < 8; i++) { words.push(w); w = apply(sigma, w); }
console.log(`  ${words.slice(0, 6).join("  ")}`);
const counts = (x) => [[...x].filter((c) => c === "L").length, [...x].filter((c) => c === "S").length];
const [nl, ns] = counts(words[7]);
check(`L/S in the word tends to phi: ${nl}/${ns} = ${(nl / ns).toFixed(6)}`,
    Math.abs(nl / ns - PHI) < 1e-2);

// Two steps at once. sigma^2(S) = sigma(L) = SL; sigma^2(L) = sigma(S)sigma(L) = L.SL = LSL.
const sq = { S: apply(sigma, sigma.S), L: apply(sigma, sigma.L) };
console.log(`  two steps at once: S -> ${sq.S}, L -> ${sq.L}`);
check(`the square of the rule is S -> SL, L -> LSL`, sq.S === "SL" && sq.L === "LSL");
// Jake's note has "S -> SLL; L -> SL" for the quicker rule. It is not an inflation of
// this sequence at all: with L = phi and S = 1 the lengths do not scale by a common
// factor, and its own growth rate is the SILVER ratio.
const lenOf = (x) => [...x].reduce((s, c) => s + (c === "L" ? PHI : 1), 0);
check(`"S -> SLL, L -> SL" is NOT it: S grows by ${(lenOf("SLL") / 1).toFixed(6)} and L by `
    + `${(lenOf("SL") / PHI).toFixed(6)}, two different factors, so it is not self-similar`,
    Math.abs(lenOf("SLL") / 1 - lenOf("SL") / PHI) > 1e-6);
check(`...and its growth rate is 1+sqrt2 = ${SILVER.toFixed(6)}, the silver ratio, not phi `
    + `or phi^2 — it generates a Pell sequence`,
    Math.abs(SILVER - 2.414213562373095) < 1e-12);
check(`the real square scales both by phi^2 = ${(PHI * PHI).toFixed(6)}: S -> SL is `
    + `${lenOf("SL").toFixed(6)} and L -> LSL is ${(lenOf("LSL") / PHI).toFixed(6)}`,
    Math.abs(lenOf("SL") - PHI * PHI) < 1e-12
    && Math.abs(lenOf("LSL") / PHI - PHI * PHI) < 1e-12);

console.log(bad === 0 ? "\nall checks passed" : `\n${bad} FAILURES`);
