// Verification for src/centers.ts — the triacontahedron census.
//
// The page built on this is worth nothing if the grouping is wrong, and the failure
// mode is quiet: a plausible picture assembled from a subtly bad center. So the
// checks run before the page is trusted, over every seed and generation, and they
// check the things that actually caught mistakes while the result was being found
// (TRIACONTAHEDRA.md §6) rather than the things that are easy to assert.
//
//   node tools/centers.mjs                all nine seeds, generations 2-4
//   node tools/centers.mjs --gen=3        one generation
//   node tools/centers.mjs --seed=Pe3
//   node tools/centers.mjs --no-agnostic  skip the expensive cross-check
//
// Seven exact checks, plus one that refuses to assume the answer:
//
//   1  the integer center reproduces the geometric one
//   2  every center coordinate is odd
//   3  no solid holds more than ten faces
//   4  no solid holds six, seven, eight or nine
//   5  complete solids number exactly the Pe5 rosettes, five thick faces each
//   6  two faces share a solid exactly when their fold is 36 degrees
//   7  no two faces share two solids
//   8  intersecting the normal lines with rho NOT supplied finds exactly the same
//      face pairs, at radius rho
//   9  a solid's cup lands on its own roof faces — AT BOTH PARITIES
//
// Check 9 exists because everything else in this project ran hills-up, so the flipped
// path had no test at all — and a real fault lived there for a week. The
// triacontahedron is not symmetric under z to -z: it takes a 36 degree turn as well,
// so a mirrored scene needs a mirrored solid, and drawing the unmirrored one put every
// solid a tenth of a turn out of register. Invisible at one parity, obvious at the
// other. Check both.
//
// Check 8 exists because checks 1-7 all start from rho and could in principle be
// confirming their own premise. It starts from nothing but the lines, and it is an
// equality rather than a majority: the pairs it finds at rho must be precisely the
// co-solid pairs counted in check 7. That also makes it meaningful on a three-rhomb
// patch, where "the most common radius" means nothing at all — an earlier draft
// asserted dominance and duly failed on St1 gen 2 for no good reason.
//
// It is O(F^2), so it runs only on patches small enough to afford it.

import {
    seedTypes,
    generatePatch,
    allRhombs,
    edgeMap,
    computeLift,
    pos3D,
} from "../dist/geometry.js";
import { triacontahedra, pe5Rosettes, cupIndices, solidFace, RHO } from "../dist/centers.js";
import { buildRoof } from "../dist/roofgeom.js";

const arg = (k, d) => {
    const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : d;
};
const noAgnostic = process.argv.includes("--no-agnostic");
const AGNOSTIC_MAX = Number(arg("agnostic-max", 1300));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => mul(a, 1 / Math.hypot(...a));

/** Dihedral along every interior edge, as a fold angle. */
function folds(cen, P) {
    const out = [];
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue;
        const A = cen.byRhomb[e.rhombIds[0]];
        const B = cen.byRhomb[e.rhombIds[1]];
        const ea = P[e.v1];
        const axis = norm(sub(P[e.v2], ea));
        const perp = (v) => {
            const w = sub(v, ea);
            return sub(w, mul(axis, dot(w, axis)));
        };
        const arm = (f) => {
            const o = f.vids
                .filter((v) => v !== e.v1 && v !== e.v2)
                .map((v) => perp(P[v]));
            return norm(mul(add(o[0], o[1]), 0.5));
        };
        const cosang = Math.max(-1, Math.min(1, dot(arm(A), arm(B))));
        out.push({ a: A, b: B, fold: Math.round(180 - (Math.acos(cosang) * 180) / Math.PI) });
    }
    return out;
}

/** Closest approach of two normal lines. No radius assumed anywhere. */
function meet(A, B) {
    const w0 = sub(A.c, B.c);
    const b = dot(A.u, B.u);
    const d = dot(A.u, w0);
    const e = dot(B.u, w0);
    const den = 1 - b * b; // both normals are unit
    if (Math.abs(den) < 1e-12) return null; // parallel: the same face orientation
    const t = (b * e - d) / den;
    const s = (e - b * d) / den;
    return {
        t,
        s,
        miss: Math.hypot(...sub(add(A.c, mul(A.u, t)), add(B.c, mul(B.u, s)))),
    };
}

/** Every pair of faces whose normals meet at one point, at equal distance. */
function agnosticPairs(cen) {
    const F = cen.faces;
    const atRho = new Set();
    let concurrent = 0;
    let equal = 0;
    let unequal = 0;
    const radii = new Map();
    for (let i = 0; i < F.length; i++) {
        for (let j = i + 1; j < F.length; j++) {
            const m = meet(F[i], F[j]);
            if (!m || m.miss > 1e-9) continue;
            concurrent++;
            const rA = Math.abs(m.t);
            const rB = Math.abs(m.s);
            if (Math.abs(rA - rB) > 1e-9) {
                unequal++;
                continue;
            }
            equal++;
            const key = rA.toFixed(6);
            radii.set(key, (radii.get(key) ?? 0) + 1);
            if (Math.abs(rA - RHO) < 1e-9) atRho.add(`${F[i].id}-${F[j].id}`);
        }
    }
    return { atRho, concurrent, equal, unequal, radii };
}

const seeds = arg("seed") ? [arg("seed")] : seedTypes.map((s) => s.label);
const gens = arg("gen") ? [Number(arg("gen"))] : [2, 3, 4];

let failures = 0;
const fail = (patch, msg) => {
    failures++;
    console.log(`  ✗ ${patch}: ${msg}`);
};

console.log("seed  gen | rhombi | solids | max | complete | Pe5 | hat/bowl | residual | agnostic");
console.log("-".repeat(92));

for (const seed of seeds) {
    for (const gen of gens) {
        const idx = seedTypes.findIndex((s) => s.label === seed);
        if (idx < 0) {
            console.log(`unknown seed ${seed}`);
            process.exit(2);
        }
        const quiet = console.log;
        console.log = () => {};
        generatePatch(idx, true, gen);
        console.log = quiet;
        const patch = `${seed} gen ${gen}`;
        if (allRhombs.length === 0) {
            console.log(`${seed.padEnd(5)} ${gen}   | (empty — the star family emits nothing this early)`);
            continue;
        }

        const cen = triacontahedra();
        const lift = computeLift();
        const P = lift.n.map((nv) => (nv ? pos3D(nv) : null));

        // 1 · the integer center is the geometric one
        if (!(cen.residual < 1e-12)) fail(patch, `residual ${cen.residual.toExponential(2)}`);

        // 2 · all six coordinates odd
        const even = cen.solids.filter((s) => s.m.some((x) => Math.abs(x % 2) !== 1)).length;
        if (even) fail(patch, `${even} solids carry an even coordinate`);

        // 3, 4 · the ceiling of ten, and nothing between five and ten
        const sizes = cen.solids.map((s) => s.faces.length);
        const max = Math.max(...sizes);
        if (max > 10) fail(patch, `a solid holds ${max} faces`);
        const between = sizes.filter((n) => n >= 6 && n <= 9).length;
        if (between) fail(patch, `${between} solids hold six to nine faces`);

        // 5 · complete solids are exactly the Pe5 rosettes
        const complete = cen.solids.filter((s) => s.complete);
        const pe5 = pe5Rosettes().length;
        if (complete.length !== pe5) fail(patch, `${complete.length} complete solids against ${pe5} Pe5 rosettes`);
        const wrongCap = complete.filter((s) => s.thick !== 5).length;
        if (wrongCap) fail(patch, `${wrongCap} complete solids without a five-thick cap`);

        // 6 · sharing a solid is the thirty-six-degree relation
        let bad36 = 0;
        let badSharp = 0;
        let badFold = 0;
        for (const { a, b, fold } of folds(cen, P)) {
            if (![36, 72, 108].includes(fold)) badFold++;
            const shares = a.solids.some((x) => b.solids.includes(x));
            if (fold === 36 && !shares) bad36++;
            if (fold !== 36 && shares) badSharp++;
        }
        if (badFold) fail(patch, `${badFold} edges fold outside {36,72,108}`);
        if (bad36) fail(patch, `${bad36} thirty-six-degree edges whose faces share no solid`);
        if (badSharp) fail(patch, `${badSharp} sharper edges whose faces do share one`);

        // 7 · no face pair on two solids.  Counted through the solids: over all pairs
        //     of faces it would be 1.4e8 comparisons at Sun gen 4.
        const coSolid = new Set();
        let twice = 0;
        for (const s of cen.solids) {
            for (let i = 0; i < s.faces.length; i++) {
                for (let j = i + 1; j < s.faces.length; j++) {
                    const [x, y] = s.faces[i] < s.faces[j] ? [s.faces[i], s.faces[j]] : [s.faces[j], s.faces[i]];
                    const key = `${x}-${y}`;
                    if (coSolid.has(key)) twice++;
                    else coSolid.add(key);
                }
            }
        }
        if (twice) fail(patch, `${twice} face pairs lie on two solids`);

        // 9 · the cup lands on the roof, hills up and dales up alike
        for (const flip of [false, true]) {
            const d = buildRoof(1, flip);
            if (!d) continue;
            let worst = 0;
            for (const s of cen.solids) {
                if (!s.complete) continue;
                const cup = cupIndices(s).map((i) => solidFace(s, i, flip, 1, d.offset));
                const mid = (f) => [0, 1, 2].map((k) => f.reduce((a, p) => a + p[k], 0) / f.length);
                for (const fid of s.faces) {
                    const corners = cen.byRhomb[fid].vids.map((v) => d.point(v));
                    const c = mid(corners);
                    let best = Infinity;
                    for (const cf of cup) {
                        const q = mid(cf);
                        best = Math.min(best, Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]));
                    }
                    worst = Math.max(worst, best);
                }
            }
            if (!(worst < 1e-9)) {
                fail(patch, `cup misses the roof by ${worst.toFixed(4)} ${flip ? "with dales up" : "with hills up"}`);
            }
        }

        // 8 · the same pairs, found without rho
        let ag = "—";
        if (!noAgnostic && cen.faces.length <= AGNOSTIC_MAX) {
            const r = agnosticPairs(cen);
            const missing = [...coSolid].filter((k) => !r.atRho.has(k)).length;
            const extra = [...r.atRho].filter((k) => !coSolid.has(k)).length;
            if (missing || extra) {
                fail(patch, `agnostic pass differs: ${missing} missing, ${extra} extra of ${coSolid.size}`);
            }
            ag = `${r.atRho.size}/${coSolid.size} at ρ · ${r.equal} equal, ${r.unequal} unequal, ${r.radii.size} radii`;
        }

        const hats = complete.filter((s) => s.hat).length;
        console.log(
            `${seed.padEnd(5)} ${gen}   | ${String(allRhombs.length).padStart(6)} |` +
                ` ${String(cen.solids.length).padStart(6)} | ${String(max).padStart(3)} |` +
                ` ${String(complete.length).padStart(8)} | ${String(pe5).padStart(3)} |` +
                ` ${`${hats}/${complete.length - hats}`.padStart(8)} |` +
                ` ${cen.residual.toExponential(1).padStart(8)} | ${ag}`,
        );
    }
}

console.log("-".repeat(92));
console.log(failures === 0 ? "all checks passed" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
