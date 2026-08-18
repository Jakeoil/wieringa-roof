// Differential test for src/roofgeom.ts.
//
// Stage 2 of the centers-page plan moves the roof's geometry out of roof3d.ts so a
// second page can draw the same surface. The whole claim of that commit is that
// roof3d.html does not change, and "I read it carefully" is not a test — a rendering
// difference in a browser has cost this project hours more than once.
//
// So: `ref` below is a frozen copy of the arithmetic that was inline in roof3d.ts,
// transcribed rather than imported, and this script asserts the new module agrees
// with it exactly. Not approximately — the arrays must be equal to the last bit,
// because nothing here should have been reordered or rounded.
//
//   node tools/roofview-check.mjs
//
// Delete this file only when roofgeom.ts is old enough that nobody remembers what it
// was extracted from. Until then it is the reason the extraction can be trusted.

import {
    seedTypes,
    generatePatch,
    allRhombs,
    vertexList,
    vertexMap,
    edgeMap,
    roundKey,
    computeLift,
    pos3D,
} from "../dist/geometry.js";
import {
    buildRoof,
    surfacePositions,
    edgeSegments,
    isoglossSegments,
} from "../dist/roofgeom.js";

// ── frozen: exactly what roof3d.ts used to do, inline ─────────────

function ref(uSlider) {
    const flip = uSlider < 0;
    const vscale = Math.sign(uSlider) * Math.pow(Math.abs(uSlider), 1.6);
    if (allRhombs.length === 0) return null;

    const lift = computeLift();
    const P = lift.n.map((nv) => (nv ? pos3D(nv, flip) : null));
    const faces = allRhombs.map((r) => ({
        thick: r.thick,
        cluster: r.cluster,
        v: r.verts.map((pt) => vertexMap.get(roundKey(pt)).id),
    }));

    let idxLo = Infinity;
    let idxHi = -Infinity;
    for (const v of vertexList) {
        if (v.index < idxLo) idxLo = v.index;
        if (v.index > idxHi) idxHi = v.index;
    }

    const pos = [];
    for (const f of faces) {
        const tri = [f.v[0], f.v[1], f.v[2], f.v[0], f.v[2], f.v[3]];
        for (const vid of tri) {
            const p = P[vid];
            pos.push(p[0], p[1], p[2] * Math.abs(vscale));
        }
    }

    // three's computeBoundingBox / getCenter, on the array just built
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
        for (let k = 0; k < 3; k++) {
            if (pos[i + k] < lo[k]) lo[k] = pos[i + k];
            if (pos[i + k] > hi[k]) hi[k] = pos[i + k];
        }
    }
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const posT = pos.map((x, i) => x - c[i % 3]);

    const lp = [];
    for (const e of edgeMap.values()) {
        const a = P[e.v1];
        const b = P[e.v2];
        if (!a || !b) continue;
        lp.push(
            a[0] - c[0], a[1] - c[1], a[2] * Math.abs(vscale) - c[2],
            b[0] - c[0], b[1] - c[1], b[2] * Math.abs(vscale) - c[2],
        );
    }

    const ip = [];
    const at = (u, w, s) => {
        const a = P[u];
        const b = P[w];
        return [
            a[0] + (b[0] - a[0]) * s - c[0],
            a[1] + (b[1] - a[1]) * s - c[1],
            (a[2] + (b[2] - a[2]) * s) * Math.abs(vscale) - c[2],
        ];
    };
    for (const f of faces) {
        let k = 0;
        for (let i = 1; i < 4; i++) {
            if (vertexList[f.v[i]].index < vertexList[f.v[k]].index) k = i;
        }
        const lo2 = f.v[k];
        const r1 = f.v[(k + 1) % 4];
        const hi2 = f.v[(k + 2) % 4];
        const r3 = f.v[(k + 3) % 4];
        for (let i = 1; i <= 7; i++) {
            const t = i / 8;
            let L, R;
            if (t <= 0.5) {
                const s = t * 2;
                L = at(lo2, r3, s);
                R = at(lo2, r1, s);
            } else {
                const s = (t - 0.5) * 2;
                L = at(r3, hi2, s);
                R = at(r1, hi2, s);
            }
            ip.push(L[0], L[1], L[2], R[0], R[1], R[2]);
        }
    }

    // the shading ramp, sampled at every vertex
    const span = idxHi - idxLo || 1;
    const ts = vertexList.map((_, vid) => {
        const idx = flip ? idxLo + idxHi - vertexList[vid].index : vertexList[vid].index;
        return ((idx - idxLo) / span - 0.5) * 2;
    });

    return { pos: posT, edges: lp, iso: ip, ts, c };
}

// ── compare ───────────────────────────────────────────────────────

const same = (a, b, label, patch) => {
    if (a.length !== b.length) {
        console.log(`  ✗ ${patch} ${label}: length ${a.length} vs ${b.length}`);
        return 1;
    }
    let worst = 0;
    let at = -1;
    for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d > worst) {
            worst = d;
            at = i;
        }
    }
    if (worst !== 0) {
        console.log(`  ✗ ${patch} ${label}: differs by ${worst.toExponential(2)} at ${at}`);
        return 1;
    }
    return 0;
};

let failures = 0;
const sliders = [1, -1, 0.62, -0.35, 0];
console.log("patch          slider |   positions     edges  isoglosses   shading");
console.log("-".repeat(72));

for (const seed of seedTypes.map((s) => s.label)) {
    for (const gen of [2, 3]) {
        const quiet = console.log;
        console.log = () => {};
        generatePatch(
            seedTypes.findIndex((s) => s.label === seed),
            true,
            gen,
        );
        console.log = quiet;
        const patch = `${seed} gen ${gen}`;

        for (const u of sliders) {
            const r = ref(u);
            const flip = u < 0;
            const vscale = Math.sign(u) * Math.pow(Math.abs(u), 1.6);
            const d = buildRoof(vscale, flip);

            if (r === null || d === null) {
                if ((r === null) !== (d === null)) {
                    console.log(`  ✗ ${patch}: one implementation says empty, the other does not`);
                    failures++;
                }
                continue;
            }

            const s = surfacePositions(d);
            const posT = s.pos.map((x, i) => x - d.offset[i % 3]);
            const ts = vertexList.map((_, vid) => ((d.indexAt(vid) - d.idxLo) / d.span - 0.5) * 2);

            failures += same(r.pos, posT, "positions", patch);
            failures += same(r.edges, edgeSegments(d), "edges", patch);
            failures += same(r.iso, isoglossSegments(d), "isoglosses", patch);
            failures += same(r.ts, ts, "shading", patch);
            failures += same(r.c, d.offset, "offset", patch);
        }
        console.log(
            `${patch.padEnd(14)} ${String(sliders.length).padStart(2)} settings |` +
                `   identical  identical   identical  identical`,
        );
    }
}

console.log("-".repeat(72));
console.log(failures === 0 ? "roofgeom matches the frozen roof3d arithmetic exactly" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
