// Test CI propagation using EXACT code from src/main.ts
// (TypeScript types removed, DOM references removed)

const SQRT5 = Math.sqrt(5);
const PHI = (SQRT5 + 1) / 2;
const GOLDEN_SIDE = SQRT5 / 2;

// ── Point ─────────────────────────────────────────────────────────

class Pt {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    tr(v) {
        return new Pt(this.x + v.x, this.y + v.y);
    }
    get vr() {
        return new Pt(this.x, -this.y);
    }
    get hr() {
        return new Pt(-this.x, this.y);
    }
    get neg() {
        return new Pt(-this.x, -this.y);
    }
    get copy() {
        return new Pt(this.x, this.y);
    }
    mult(m) {
        return new Pt(this.x * m, this.y * m);
    }
}

function p(x, y) {
    return new Pt(x, y);
}

// ── Angle (fifths + isDown) ───────────────────────────────────────

function mod5(n) {
    return ((n % 5) + 5) % 5;
}
function mod10(n) {
    return ((n % 10) + 10) % 10;
}

class Angle {
    constructor(fifths, isDown) {
        this.fifths = mod5(fifths);
        this.isDown = isDown;
    }
    rot(n) {
        return new Angle(mod5(this.fifths + n), this.isDown);
    }
    get inv() {
        return new Angle(this.fifths, !this.isDown);
    }
    get tenths() {
        return (this.fifths * 2 + (this.isDown ? 5 : 0)) % 10;
    }
}

function ang(fifths, isDown) {
    return new Angle(fifths, isDown);
}

// ── Wheel (10-point radial array) ─────────────────────────────────

class Wheel {
    constructor(p0, p1, p2) {
        this.w = [
            p0.copy,
            p1.copy,
            p2.copy,
            p2.vr,
            p1.vr,
            p0.vr,
            p1.neg,
            p2.neg,
            p2.hr,
            p1.hr,
        ];
    }
}

function interpolateWheel(p0, p1, p2) {
    const { x: a0, y: b0 } = p0;
    const { x: a1, y: b1 } = p1;
    const { x: a2, y: b2 } = p2;
    const x0 = a0;
    const x1 = -a0 - a0 + a1 + a1 - a2;
    const x2 = a2 - a1 + a0;
    const y0 = b0 - b2 - b2;
    const y1 = b2;
    const y2 = b1 - b0 + b2;
    return [p(x0, y0), p(x1, y1), p(x2, y2)];
}

function makeWheels(pSeed, sSeed, tSeed, dSeed) {
    const pW = [new Wheel(...interpolateWheel(...pSeed))];
    const sW = [new Wheel(...interpolateWheel(...sSeed))];
    const tW = [new Wheel(...interpolateWheel(...tSeed))];
    const dW = [new Wheel(...interpolateWheel(...dSeed))];

    pW.push(new Wheel(...pSeed));
    sW.push(new Wheel(...sSeed));
    tW.push(new Wheel(...tSeed));
    dW.push(new Wheel(...dSeed));

    for (let i = 1; i <= 6; i++) {
        const pp = pW[i].w;
        pW.push(
            new Wheel(
                pp[1].tr(pp[0]).tr(pp[9]),
                pp[2].tr(pp[1]).tr(pp[0]),
                pp[3].tr(pp[2]).tr(pp[1]),
            ),
        );
        const ps = sW[i].w;
        sW.push(
            new Wheel(
                pp[1].tr(pp[0]).tr(ps[9]),
                pp[2].tr(pp[1]).tr(ps[0]),
                pp[3].tr(pp[2]).tr(ps[1]),
            ),
        );
        const ss = sW[i].w;
        tW.push(
            new Wheel(
                ss[1].tr(pp[9]).tr(pp[0]).tr(pp[1]).tr(ss[9]),
                ss[2].tr(pp[0]).tr(pp[1]).tr(pp[2]).tr(ss[0]),
                ss[3].tr(pp[1]).tr(pp[2]).tr(pp[3]).tr(ss[1]),
            ),
        );
        const dd = dW[i].w;
        dW.push(new Wheel(dd[0].tr(pp[0]), dd[1].tr(pp[1]), dd[2].tr(pp[2])));
    }
    return { p: pW, s: sW, t: tW, d: dW };
}

// ── Real mode wheel seeds ─────────────────────────────────────────

function computeRealSeeds() {
    const c_0 = 1;
    const c_1 = (SQRT5 - 1) / 4; // cos 72
    const c_2 = (SQRT5 + 1) / 4; // cos 36
    const s_0 = 0;
    const s_1 = Math.sqrt(10 + 2 * SQRT5) / 4; // sin 72
    const s_2 = Math.sqrt(10 - 2 * SQRT5) / 4; // sin 36

    const unitUp = [
        p(s_0, -c_0),
        p(s_1, -c_1),
        p(s_2, c_2),
        p(-s_2, c_2),
        p(-s_1, -c_1),
    ];

    // Pentagon & parallelogram proportions (from penrose-mosaic Real class)
    // All proportions are for unit side (a=1), then scaled via solve(prop, "a", 4, key)
    const a = 4; // Penrose tile side

    // Pentagon proportions (a=1)
    const pgon_R = Math.sqrt(50 + 10 * SQRT5) / 10; // circumradius .8507
    const pgon_r = Math.sqrt(25 + 10 * SQRT5) / 10; // apothem .688

    // Parallelogram (inner pentagram rhombus) proportions (a = (3-sqrt5)/2 ~ .382)
    const pgram_a = (3 - SQRT5) / 2;
    const pgram_R = Math.sqrt((25 - 11 * SQRT5) / 10); // .2008
    const pgram_y = Math.sqrt((25 - 11 * SQRT5) / 2) / 2;

    // solve(prop, "a", 4, key) = prop[key] * (4 / prop.a)
    // For pgon:  factor = 4/1 = 4
    // For pgram: factor = 4/pgram_a ~ 10.47
    const pMag = pgon_r * a * 2; // 2 * apothem at side=4
    const sMag = pgon_R * a + pgram_R * (a / pgram_a); // pgon.R + pgram.R at side=4
    const tMag = (pgram_R * (a / pgram_a) + pgram_y * (a / pgram_a)) * 2;
    const dMag = pgon_r * a; // apothem at side=4

    // Seed: [unitUp[0]*mag, unitDown[3]*mag, unitUp[1]*mag]
    // where unitDown[3] = unitUp[3].neg
    function makeSeedCorrect(mag) {
        return [
            unitUp[0].mult(mag),
            unitUp[3].neg.mult(mag),
            unitUp[1].mult(mag),
        ];
    }

    return {
        pSeed: makeSeedCorrect(pMag),
        sSeed: makeSeedCorrect(sMag),
        tSeed: makeSeedCorrect(tMag),
        dSeed: makeSeedCorrect(dMag),
    };
}

// ── Dual rhomb shapes (per gen) ───────────────────────────────────

function shapeWheel3(up, won, too) {
    return [
        up[0].map((it) => it.copy),
        won[0].map((it) => it.copy),
        too[0].map((it) => it.copy),
        too[0].map((it) => it.vr),
        won[0].map((it) => it.vr),
        up[0].map((it) => it.vr),
        won[0].map((it) => it.neg),
        too[0].map((it) => it.neg),
        too[0].map((it) => it.hr),
        won[0].map((it) => it.hr),
    ];
}

function makeRhombShapes(wheels, gen) {
    const exp = gen;
    const tWheel = wheels.t[exp].w;

    function thickAt(tenth) {
        const o = p(0, 0);
        const o1 = o.tr(tWheel[mod10(tenth + 9)]);
        const o2 = o1.tr(tWheel[mod10(tenth + 1)]);
        const o3 = o2.tr(tWheel[mod10(tenth + 4)]);
        return [o, o1, o2, o3];
    }
    function thinAt(tenth) {
        const o = p(0, 0);
        const o1 = o.tr(tWheel[mod10(tenth + 3)]);
        const o2 = o1.tr(tWheel[mod10(tenth + 7)]);
        const o3 = o2.tr(tWheel[mod10(tenth + 8)]);
        return [o, o1, o2, o3];
    }

    // Build all 10 orientations directly
    const thickAll = [];
    const thinAll = [];
    for (let t = 0; t < 10; t++) {
        thickAll.push(thickAt(t));
        thinAll.push(thinAt(t));
    }

    return { thick: thickAll, thin: thinAll };
}

// ── Tile type definitions ─────────────────────────────────────────

const Pe5 = {
    name: "Pe5",
    kind: "penta",
    twist: [0, 0, 0, 0, 0],
    diamond: [],
};
const Pe3 = {
    name: "Pe3",
    kind: "penta",
    twist: [0, 0, -1, 1, 0],
    diamond: [0],
};
const Pe1 = {
    name: "Pe1",
    kind: "penta",
    twist: [0, -1, 1, -1, 1],
    diamond: [1, 4],
};
const St5 = {
    name: "St5",
    kind: "star",
    color: ["y", "y", "y", "y", "y"],
};
const St3 = {
    name: "St3",
    kind: "star",
    color: ["y", "y", null, null, "y"],
};
const St1 = {
    name: "St1",
    kind: "star",
    color: ["y", null, null, null, null],
};

// ── Cluster colors ────────────────────────────────────────────────

const CLUSTER_COLORS = {
    Pe5: "#9292e3",
    Pe3: "#e6e68e",
    Pe1: "#eec09b",
};

// ── Rhomb collection (module-level state, reset per test) ─────────

let allRhombs = [];
let rhombId = 0;

function emitRhomb(loc, shape, thick, isHeads, fill, ci) {
    const verts = shape.map((v) => loc.tr(v));
    // v0 is at the penta center (ci). Along v0->v2 diagonal: index changes by +/-2.
    // isHeads=true -> v0 high, v2 low: [ci, ci-1, ci-2, ci-1]
    // isHeads=false -> v0 low, v2 high: [ci, ci+1, ci+2, ci+1]
    const offsets = isHeads
        ? [0, -1, -2, -1]
        : [0, +1, +2, +1];
    const vertIndices = [
        ci + offsets[0],
        ci + offsets[1],
        ci + offsets[2],
        ci + offsets[3],
    ];
    allRhombs.push({ id: rhombId++, verts, vertIndices, thick, isHeads, fill });
}

// ── Recursive expansion -> rhombs ──────────────────────────────────

let wheels;
let rhombShapes = new Map();

function emitRhombs(type, angle, isHeads, loc, gen, ci) {
    if (!rhombShapes.has(gen)) {
        rhombShapes.set(gen, makeRhombShapes(wheels, gen));
    }
    const shapes = rhombShapes.get(gen);
    const thicks = shapes.thick;
    const thins = shapes.thin;

    const fill = CLUSTER_COLORS[type.name];

    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const t = shift.tenths;

        switch (type) {
            case Pe5:
                emitRhomb(loc, thicks[t], true, isHeads, fill, ci);
                break;
            case Pe3:
                switch (i) {
                    case 0:
                        emitRhomb(loc, thins[t], false, isHeads, fill, ci);
                    // fallthrough
                    case 1:
                    case 4:
                        emitRhomb(loc, thicks[t], true, isHeads, fill, ci);
                        break;
                }
                break;
            case Pe1:
                switch (i) {
                    case 0:
                        emitRhomb(loc, thicks[t], true, isHeads, fill, ci);
                        break;
                    case 1:
                    case 4:
                        emitRhomb(loc, thins[t], false, isHeads, fill, ci);
                        break;
                }
                break;
        }
    }
}

function expandPenta(type, angle, isHeads, loc, gen, ci) {
    if (type.kind === "star") {
        expandStar(type, angle, isHeads, loc, gen, ci);
        return;
    }

    if (gen === 0) {
        return;
    }

    // At gen 1, emit rhombs and stop (matches penrose-mosaic rhomb layer short circuit)
    if (gen === 1) {
        emitRhombs(type, angle, isHeads, loc, gen, ci);
        return;
    }

    const pWheel = wheels.p[gen].w;
    const sWheel = wheels.s[gen].w;

    // Index delta: moving from center to child crosses one grid line
    const childDelta = isHeads ? +1 : -1;

    // Central inverted penta (same location -> same ci)
    expandPenta(Pe5, angle.inv, !isHeads, loc, gen - 1, ci);

    // 5 surrounding pentas + diamonds
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const locPenta = loc.tr(pWheel[shift.tenths]);
        const childType = type.twist[i] === 0 ? Pe3 : Pe1;
        const childAngle = shift.rot(type.twist[i]);
        expandPenta(
            childType,
            childAngle,
            !isHeads,
            locPenta,
            gen - 1,
            ci + childDelta,
        );

        if (type.diamond.includes(i)) {
            const locDiamond = loc.tr(sWheel[shift.inv.tenths]);
            expandStar(
                St1,
                shift.inv,
                isHeads,
                locDiamond,
                gen - 1,
                ci + childDelta,
            );
        }
    }
}

function expandStar(type, angle, isHeads, loc, gen, ci) {
    if (gen === 0) {
        return;
    }

    const sWheel = wheels.s[gen].w;
    const tWheel = wheels.t[gen].w;

    // Index deltas: Pe1 children are 1 step from star center,
    // St3 (boat) children are 2 steps from star center
    const pentaDelta = isHeads ? -1 : +1;
    const boatDelta = isHeads ? -2 : +2;

    // Central star (same location -> same ci)
    expandStar(St5, angle.inv, isHeads, loc, gen - 1, ci);

    // Surrounding pentas and boats
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        if (type.color[i] != null) {
            const locPenta = loc.tr(sWheel[shift.tenths]);
            expandPenta(
                Pe1,
                shift.inv,
                isHeads,
                locPenta,
                gen - 1,
                ci + pentaDelta,
            );

            const locBoat = loc.tr(tWheel[shift.tenths]);
            expandStar(St3, shift, !isHeads, locBoat, gen - 1, ci + boatDelta);
        }
    }
}

// ── Vertex registry & index propagation ───────────────────────────

const vertexMap = new Map();
const vertexList = [];
const edgeMap = new Map();

function roundKey(pt) {
    return `${Math.round(pt.x * 1e4)},${Math.round(pt.y * 1e4)}`;
}

function getOrCreateVertex(pos) {
    const key = roundKey(pos);
    const existing = vertexMap.get(key);
    if (existing) return existing.id;
    const v = { id: vertexList.length, pos, index: -999, rhombIds: [] };
    vertexList.push(v);
    vertexMap.set(key, v);
    return v.id;
}

function edgeKey(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function buildRegistries() {
    vertexMap.clear();
    vertexList.length = 0;
    edgeMap.clear();

    for (const r of allRhombs) {
        const vids = [];
        for (const v of r.verts) {
            const vid = getOrCreateVertex(v);
            vertexList[vid].rhombIds.push(r.id);
            vids.push(vid);
        }
        for (let i = 0; i < 4; i++) {
            const key = edgeKey(vids[i], vids[(i + 1) % 4]);
            const existing = edgeMap.get(key);
            if (existing) {
                existing.rhombIds.push(r.id);
            } else {
                edgeMap.set(key, {
                    v1: vids[i],
                    v2: vids[(i + 1) % 4],
                    rhombIds: [r.id],
                });
            }
        }
    }
}

function assignIndicesFromRhombs() {
    // Assign vertex indices from the per-rhomb vertIndices computed during recursion
    let conflicts = 0;
    const conflictDetails = [];
    for (const r of allRhombs) {
        for (let i = 0; i < 4; i++) {
            const v = vertexMap.get(roundKey(r.verts[i]));
            if (!v) continue;
            if (v.index === -999) {
                // First assignment
                v.index = r.vertIndices[i];
            } else if (v.index !== r.vertIndices[i]) {
                conflicts++;
                if (conflictDetails.length < 10) {
                    conflictDetails.push({
                        vertexId: v.id,
                        pos: `(${v.pos.x.toFixed(4)}, ${v.pos.y.toFixed(4)})`,
                        existingIndex: v.index,
                        newIndex: r.vertIndices[i],
                        rhombId: r.id,
                        rhombVertIndices: r.vertIndices,
                        isHeads: r.isHeads,
                        thick: r.thick,
                    });
                }
            }
        }
    }

    const indexHist = {};
    for (const v of vertexList) {
        indexHist[v.index] = (indexHist[v.index] || 0) + 1;
    }

    return { conflicts, conflictDetails, indexHist };
}

// ── Edge diff check within connected components ───────────────────

function checkEdgeDiffs() {
    const edgeDiffHist = {};
    const badEdges = [];
    for (const [key, edge] of edgeMap) {
        const v1 = vertexList[edge.v1];
        const v2 = vertexList[edge.v2];
        if (v1.index === -999 || v2.index === -999) continue;
        const diff = Math.abs(v1.index - v2.index);
        edgeDiffHist[diff] = (edgeDiffHist[diff] || 0) + 1;
        if (diff !== 1) {
            badEdges.push({
                v1Id: edge.v1,
                v2Id: edge.v2,
                v1Index: v1.index,
                v2Index: v2.index,
                diff,
            });
        }
    }
    return { edgeDiffHist, badEdges };
}

// ── Connected-component analysis ──────────────────────────────────

function findConnectedComponents() {
    // Build adjacency from edgeMap
    const adj = new Map();
    for (const v of vertexList) {
        adj.set(v.id, []);
    }
    for (const [key, edge] of edgeMap) {
        adj.get(edge.v1).push(edge.v2);
        adj.get(edge.v2).push(edge.v1);
    }

    const visited = new Set();
    const components = [];

    for (const v of vertexList) {
        if (visited.has(v.id)) continue;
        const comp = [];
        const stack = [v.id];
        while (stack.length > 0) {
            const cur = stack.pop();
            if (visited.has(cur)) continue;
            visited.add(cur);
            comp.push(cur);
            for (const nb of adj.get(cur)) {
                if (!visited.has(nb)) stack.push(nb);
            }
        }
        components.push(comp);
    }

    return components;
}

function checkEdgeDiffsPerComponent() {
    const components = findConnectedComponents();
    const results = [];

    for (let ci = 0; ci < components.length; ci++) {
        const compSet = new Set(components[ci]);
        let totalEdges = 0;
        let badEdges = 0;
        const badDetails = [];

        for (const [key, edge] of edgeMap) {
            if (!compSet.has(edge.v1) || !compSet.has(edge.v2)) continue;
            const v1 = vertexList[edge.v1];
            const v2 = vertexList[edge.v2];
            if (v1.index === -999 || v2.index === -999) continue;
            totalEdges++;
            const diff = Math.abs(v1.index - v2.index);
            if (diff !== 1) {
                badEdges++;
                if (badDetails.length < 3) {
                    badDetails.push({
                        v1Id: edge.v1,
                        v2Id: edge.v2,
                        v1Index: v1.index,
                        v2Index: v2.index,
                        diff,
                    });
                }
            }
        }

        results.push({
            componentIndex: ci,
            numVertices: components[ci].length,
            totalEdges,
            badEdges,
            badDetails,
        });
    }

    return results;
}

// ── Seed type table ───────────────────────────────────────────────

const seedTypes = [
    { label: "Pe5", type: Pe5, kind: "penta" },
    { label: "Pe3", type: Pe3, kind: "penta" },
    { label: "Pe1", type: Pe1, kind: "penta" },
    { label: "St5", type: St5, kind: "star" },
    { label: "St3", type: St3, kind: "star" },
    { label: "St1", type: St1, kind: "star" },
];

// ── Test runner ───────────────────────────────────────────────────

function resetState() {
    allRhombs = [];
    rhombId = 0;
    rhombShapes = new Map();
    vertexMap.clear();
    vertexList.length = 0;
    edgeMap.clear();
}

function runTest(seedLabel, genLevel) {
    resetState();

    const seeds = computeRealSeeds();
    wheels = makeWheels(seeds.pSeed, seeds.sSeed, seeds.tSeed, seeds.dSeed);

    const seed = seedTypes.find((s) => s.label === seedLabel);
    if (!seed) {
        console.log(`  Unknown seed: ${seedLabel}`);
        return;
    }

    const angle = ang(0, false);
    const isHeads = true;
    const initialCI = 4;

    if (seed.kind === "penta") {
        expandPenta(seed.type, angle, isHeads, p(0, 0), genLevel, initialCI);
    } else {
        expandStar(seed.type, angle, isHeads, p(0, 0), genLevel, initialCI);
    }

    buildRegistries();
    const { conflicts, conflictDetails, indexHist } = assignIndicesFromRhombs();

    console.log(`\n  ${seedLabel} gen=${genLevel}: ${allRhombs.length} rhombs, ${vertexList.length} unique vertices`);
    console.log(`  CI conflicts: ${conflicts}`);
    console.log(`  Index histogram:`, indexHist);
    if (conflictDetails.length > 0) {
        console.log(`  First ${Math.min(3, conflictDetails.length)} conflict details:`);
        for (let i = 0; i < Math.min(3, conflictDetails.length); i++) {
            const c = conflictDetails[i];
            console.log(`    vertex ${c.vertexId} at ${c.pos}: existing=${c.existingIndex}, new=${c.newIndex} (rhomb ${c.rhombId}, vertIndices=[${c.rhombVertIndices}], isHeads=${c.isHeads}, thick=${c.thick})`);
        }
    }

    // Global edge diff check
    const { edgeDiffHist, badEdges } = checkEdgeDiffs();
    console.log(`  Edge |diff| histogram:`, edgeDiffHist);
    if (badEdges.length > 0) {
        console.log(`  Edges with |diff| != 1: ${badEdges.length}`);
        for (let i = 0; i < Math.min(3, badEdges.length); i++) {
            const e = badEdges[i];
            console.log(`    edge v${e.v1Id}(idx=${e.v1Index}) -- v${e.v2Id}(idx=${e.v2Index}), |diff|=${e.diff}`);
        }
    } else {
        console.log(`  All edges have |diff| = 1`);
    }

    // Per-component edge check
    const compResults = checkEdgeDiffsPerComponent();
    console.log(`  Connected components: ${compResults.length}`);
    for (const cr of compResults) {
        if (cr.badEdges > 0) {
            console.log(`    Component ${cr.componentIndex}: ${cr.numVertices} verts, ${cr.totalEdges} edges, ${cr.badEdges} BAD edges`);
            for (const bd of cr.badDetails) {
                console.log(`      edge v${bd.v1Id}(idx=${bd.v1Index}) -- v${bd.v2Id}(idx=${bd.v2Index}), |diff|=${bd.diff}`);
            }
        } else {
            console.log(`    Component ${cr.componentIndex}: ${cr.numVertices} verts, ${cr.totalEdges} edges, ALL OK`);
        }
    }
}

// ── Run all tests ─────────────────────────────────────────────────

console.log("=== Wieringa Roof CI Propagation Test ===");
console.log("Using EXACT code from src/main.ts\n");

for (const seed of seedTypes) {
    console.log(`\n--- Seed: ${seed.label} ---`);
    for (const g of [1, 2, 3]) {
        runTest(seed.label, g);
    }
}

console.log("\n=== Done ===");
