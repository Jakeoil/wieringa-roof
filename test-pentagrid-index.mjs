// Test pentagrid index formula: I(x,y) = Σⱼ floor(dot(pt, eⱼ) / d) + 4
// Verifies every edge has |index diff| = 1 for all seed types and gen levels

const SQRT5 = Math.sqrt(5);
const PHI = (SQRT5 + 1) / 2;

class Pt {
    constructor(x, y) { this.x = x; this.y = y; }
    tr(v) { return new Pt(this.x + v.x, this.y + v.y); }
    get vr() { return new Pt(this.x, -this.y); }
    get hr() { return new Pt(-this.x, this.y); }
    get neg() { return new Pt(-this.x, -this.y); }
    get copy() { return new Pt(this.x, this.y); }
    mult(m) { return new Pt(this.x * m, this.y * m); }
}
function p(x, y) { return new Pt(x, y); }
function mod5(n) { return ((n % 5) + 5) % 5; }
function mod10(n) { return ((n % 10) + 10) % 10; }

class Angle {
    constructor(fifths, isDown) { this.fifths = mod5(fifths); this.isDown = isDown; }
    rot(n) { return new Angle(mod5(this.fifths + n), this.isDown); }
    get inv() { return new Angle(this.fifths, !this.isDown); }
    get tenths() { return (this.fifths * 2 + (this.isDown ? 5 : 0)) % 10; }
}
function ang(f, d) { return new Angle(f, d); }

class Wheel {
    constructor(p0, p1, p2) {
        this.w = [p0.copy, p1.copy, p2.copy, p2.vr, p1.vr, p0.vr, p1.neg, p2.neg, p2.hr, p1.hr];
    }
}

function interpolateWheel(p0, p1, p2) {
    const { x: a0, y: b0 } = p0;
    const { x: a1, y: b1 } = p1;
    const { x: a2, y: b2 } = p2;
    return [p(a0, b0 - b2 - b2), p(-a0 - a0 + a1 + a1 - a2, b2), p(a2 - a1 + a0, b1 - b0 + b2)];
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
        pW.push(new Wheel(pp[1].tr(pp[0]).tr(pp[9]), pp[2].tr(pp[1]).tr(pp[0]), pp[3].tr(pp[2]).tr(pp[1])));
        const ps = sW[i].w;
        sW.push(new Wheel(pp[1].tr(pp[0]).tr(ps[9]), pp[2].tr(pp[1]).tr(ps[0]), pp[3].tr(pp[2]).tr(ps[1])));
        const ss = sW[i].w;
        tW.push(new Wheel(
            ss[1].tr(pp[9]).tr(pp[0]).tr(pp[1]).tr(ss[9]),
            ss[2].tr(pp[0]).tr(pp[1]).tr(pp[2]).tr(ss[0]),
            ss[3].tr(pp[1]).tr(pp[2]).tr(pp[3]).tr(ss[1])
        ));
        const dd = dW[i].w;
        dW.push(new Wheel(dd[0].tr(pp[0]), dd[1].tr(pp[1]), dd[2].tr(pp[2])));
    }
    return { p: pW, s: sW, t: tW, d: dW };
}

function computeRealSeeds() {
    const c_0 = 1, c_1 = (SQRT5 - 1) / 4, c_2 = (SQRT5 + 1) / 4;
    const s_0 = 0, s_1 = Math.sqrt(10 + 2 * SQRT5) / 4, s_2 = Math.sqrt(10 - 2 * SQRT5) / 4;
    const unitUp = [p(s_0, -c_0), p(s_1, -c_1), p(s_2, c_2), p(-s_2, c_2), p(-s_1, -c_1)];
    const a = 4;
    const pgon_R = Math.sqrt(50 + 10 * SQRT5) / 10;
    const pgon_r = Math.sqrt(25 + 10 * SQRT5) / 10;
    const pgram_a = (3 - SQRT5) / 2;
    const pgram_R = Math.sqrt((25 - 11 * SQRT5) / 10);
    const pgram_y = Math.sqrt((25 - 11 * SQRT5) / 2) / 2;
    const pMag = pgon_r * a * 2;
    const sMag = pgon_R * a + pgram_R * (a / pgram_a);
    const tMag = (pgram_R * (a / pgram_a) + pgram_y * (a / pgram_a)) * 2;
    const dMag = pgon_r * a;
    function makeSeed(mag) {
        return [unitUp[0].mult(mag), unitUp[3].neg.mult(mag), unitUp[1].mult(mag)];
    }
    return { pSeed: makeSeed(pMag), sSeed: makeSeed(sMag), tSeed: makeSeed(tMag), dSeed: makeSeed(dMag) };
}

const seeds = computeRealSeeds();
const wheels = makeWheels(seeds.pSeed, seeds.sSeed, seeds.tSeed, seeds.dSeed);

// Pentagrid index formula
const GRID_DIRS = [];
for (let j = 0; j < 5; j++) {
    const theta = Math.PI * 3 / 10 + 2 * Math.PI * j / 5;
    GRID_DIRS.push({ x: Math.cos(theta), y: Math.sin(theta) });
}
const tw0 = wheels.t[1].w[0];
const gridSpacing = Math.sqrt(tw0.x * tw0.x + tw0.y * tw0.y);

function computeIndex(pt) {
    let sum = 0;
    for (let j = 0; j < 5; j++) {
        const dot = pt.x * GRID_DIRS[j].x + pt.y * GRID_DIRS[j].y;
        sum += Math.floor(dot / gridSpacing + 1e-9);
    }
    return sum + 4;
}

// Tile types
const Pe5 = { name: 'Pe5', kind: 'penta', twist: [0, 0, 0, 0, 0], diamond: [] };
const Pe3 = { name: 'Pe3', kind: 'penta', twist: [0, 0, -1, 1, 0], diamond: [0] };
const Pe1 = { name: 'Pe1', kind: 'penta', twist: [0, -1, 1, -1, 1], diamond: [1, 4] };
const St5 = { name: 'St5', kind: 'star', color: ['y', 'y', 'y', 'y', 'y'] };
const St3 = { name: 'St3', kind: 'star', color: ['y', 'y', null, null, 'y'] };
const St1 = { name: 'St1', kind: 'star', color: ['y', null, null, null, null] };

let allRhombs = [];
let rhombId = 0;
let rhombShapes = new Map();

function makeRhombShapes(gen) {
    const tWheel = wheels.t[gen].w;
    const thickAll = [], thinAll = [];
    for (let tenth = 0; tenth < 10; tenth++) {
        const o = p(0, 0);
        const o1 = o.tr(tWheel[mod10(tenth + 9)]);
        const o2 = o1.tr(tWheel[mod10(tenth + 1)]);
        const o3 = o2.tr(tWheel[mod10(tenth + 4)]);
        thickAll.push([o, o1, o2, o3]);
        const t0 = p(0, 0);
        const t1 = t0.tr(tWheel[mod10(tenth + 3)]);
        const t2 = t1.tr(tWheel[mod10(tenth + 7)]);
        const t3 = t2.tr(tWheel[mod10(tenth + 8)]);
        thinAll.push([t0, t1, t2, t3]);
    }
    return { thick: thickAll, thin: thinAll };
}

function emitRhomb(loc, shape, thick, isHeads, fill) {
    const verts = shape.map(v => loc.tr(v));
    allRhombs.push({ id: rhombId++, verts, thick, isHeads, fill });
}

function emitRhombs(type, angle, isHeads, loc, gen) {
    if (!rhombShapes.has(gen)) rhombShapes.set(gen, makeRhombShapes(gen));
    const shapes = rhombShapes.get(gen);
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const t = shift.tenths;
        switch (type) {
            case Pe5: emitRhomb(loc, shapes.thick[t], true, isHeads, '#000'); break;
            case Pe3:
                switch (i) {
                    case 0: emitRhomb(loc, shapes.thin[t], false, isHeads, '#000');
                    case 1: case 4: emitRhomb(loc, shapes.thick[t], true, isHeads, '#000'); break;
                } break;
            case Pe1:
                switch (i) {
                    case 0: emitRhomb(loc, shapes.thick[t], true, isHeads, '#000'); break;
                    case 1: case 4: emitRhomb(loc, shapes.thin[t], false, isHeads, '#000'); break;
                } break;
        }
    }
}

function expandPenta(type, angle, isHeads, loc, gen) {
    if (type.kind === 'star') { expandStar(type, angle, isHeads, loc, gen); return; }
    if (gen === 0) return;
    if (gen === 1) { emitRhombs(type, angle, isHeads, loc, gen); return; }
    const pWheel = wheels.p[gen].w;
    const sWheel = wheels.s[gen].w;
    expandPenta(Pe5, angle.inv, !isHeads, loc, gen - 1);
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const locPenta = loc.tr(pWheel[shift.tenths]);
        const childType = type.twist[i] === 0 ? Pe3 : Pe1;
        const childAngle = shift.rot(type.twist[i]);
        expandPenta(childType, childAngle, !isHeads, locPenta, gen - 1);
        if (type.diamond.includes(i)) {
            const locDiamond = loc.tr(sWheel[shift.inv.tenths]);
            expandStar(St1, shift.inv, isHeads, locDiamond, gen - 1);
        }
    }
}

function expandStar(type, angle, isHeads, loc, gen) {
    if (gen === 0) return;
    const sWheel = wheels.s[gen].w;
    const tWheel = wheels.t[gen].w;
    expandStar(St5, angle.inv, isHeads, loc, gen - 1);
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        if (type.color[i] != null) {
            expandPenta(Pe1, shift.inv, isHeads, loc.tr(sWheel[shift.tenths]), gen - 1);
            expandStar(St3, shift, !isHeads, loc.tr(tWheel[shift.tenths]), gen - 1);
        }
    }
}

function roundKey(pt) { return `${Math.round(pt.x * 1e4)},${Math.round(pt.y * 1e4)}`; }

function run(seedType, genLevel, isHeads = true) {
    allRhombs = []; rhombId = 0; rhombShapes.clear();
    if (seedType.kind === 'penta') {
        expandPenta(seedType, ang(0, false), isHeads, p(0, 0), genLevel);
    } else {
        expandStar(seedType, ang(0, false), isHeads, p(0, 0), genLevel);
    }

    // Build vertex map and compute indices via pentagrid formula
    const vMap = new Map();
    for (const r of allRhombs) {
        for (let i = 0; i < 4; i++) {
            const key = roundKey(r.verts[i]);
            if (!vMap.has(key)) {
                vMap.set(key, { pt: r.verts[i], index: computeIndex(r.verts[i]) });
            }
        }
    }

    // Check edges: every edge of every rhomb should have |index diff| = 1
    let badEdges = 0;
    const badDiffs = {};
    for (const r of allRhombs) {
        for (let i = 0; i < 4; i++) {
            const k1 = roundKey(r.verts[i]);
            const k2 = roundKey(r.verts[(i + 1) % 4]);
            const idx1 = vMap.get(k1).index;
            const idx2 = vMap.get(k2).index;
            const diff = Math.abs(idx1 - idx2);
            if (diff !== 1) {
                badEdges++;
                badDiffs[diff] = (badDiffs[diff] || 0) + 1;
            }
        }
    }

    // Index histogram
    const hist = {};
    for (const [, { index }] of vMap) {
        hist[index] = (hist[index] || 0) + 1;
    }

    const status = badEdges === 0 ? '✓' : '✗';
    console.log(`${status} ${seedType.name} gen=${genLevel} isHeads=${isHeads}: ${allRhombs.length} rhombs, ${vMap.size} vertices`);
    console.log(`  Index histogram: ${JSON.stringify(hist)}`);
    if (badEdges > 0) {
        console.log(`  BAD EDGES: ${badEdges}, diffs: ${JSON.stringify(badDiffs)}`);
    }
    console.log();
}

console.log(`Grid spacing d = ${gridSpacing.toFixed(6)}`);
console.log(`Grid dirs: ${GRID_DIRS.map(e => `(${e.x.toFixed(4)}, ${e.y.toFixed(4)})`).join(', ')}`);
console.log();

console.log('=== Pentagrid Index Formula Test ===\n');
for (const seed of [Pe5, Pe3, Pe1, St5, St3, St1]) {
    for (const g of [1, 2, 3]) {
        run(seed, g);
    }
}
