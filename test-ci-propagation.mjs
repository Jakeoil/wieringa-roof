// Test CI propagation through recursion
const SQRT5 = Math.sqrt(5);
const PHI = (SQRT5 + 1) / 2;

class Pt {
    constructor(x, y) { this.x = x; this.y = y; }
    tr(v) { return new Pt(this.x + v.x, this.y + v.y); }
    get vr() { return new Pt(this.x, -this.y); }
    get hr() { return new Pt(-this.x, this.y); }
    get neg() { return new Pt(-this.x, -this.y); }
    get copy() { return new Pt(this.x, this.y); }
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
        this.w = [p0.copy, p1.copy, p2.copy, p2.vr, p1.vr, p0.vr, { x: -p1.x, y: -p1.y }, { x: -p2.x, y: -p2.y }, { x: -p2.x, y: p2.y }, { x: -p1.x, y: p1.y }];
    }
}

function interpolateWheel(p0, p1, p2) {
    const { x: a0, y: b0 } = p0;
    const { x: a1, y: b1 } = p1;
    const { x: a2, y: b2 } = p2;
    return [p(a0, b0), p(a0 * PHI + a1, b0 * PHI + b1), p(a0 * (PHI + 1) + a1 * PHI + a2, b0 * (PHI + 1) + b1 * PHI + b2)];
}

function makeWheels(pSeed, sSeed, tSeed, dSeed) {
    const result = { p: [], s: [], t: [], d: [] };
    let pp = [pSeed.copy, p(0, 0), p(0, 0)];
    let ss = [sSeed.copy, p(0, 0), p(0, 0)];
    let tt = [tSeed.copy, p(0, 0), p(0, 0)];
    let dd = [dSeed.copy, p(0, 0), p(0, 0)];
    for (let i = 0; i < 6; i++) {
        result.p.push(new Wheel(...pp));
        result.s.push(new Wheel(...ss));
        result.t.push(new Wheel(...tt));
        result.d.push(new Wheel(...dd));
        pp = interpolateWheel(...pp);
        ss = interpolateWheel(...ss);
        tt = interpolateWheel(...tt);
        dd = interpolateWheel(...dd);
    }
    return result;
}

function computeRealSeeds() {
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
    const angle36 = (2 * Math.PI) / 10;
    return {
        pSeed: p(pMag * Math.sin(angle36), pMag * Math.cos(angle36)),
        sSeed: p(sMag * Math.sin(angle36), sMag * Math.cos(angle36)),
        tSeed: p(tMag * Math.sin(angle36), tMag * Math.cos(angle36)),
        dSeed: p(dMag * Math.sin(angle36), dMag * Math.cos(angle36)),
    };
}

const seeds = computeRealSeeds();
const wheels = makeWheels(seeds.pSeed, seeds.sSeed, seeds.tSeed, seeds.dSeed);

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

function emitRhomb(loc, shape, thick, isHeads, fill, ci) {
    const verts = shape.map(v => loc.tr(v));
    const offsets = isHeads ? [0, -1, -2, -1] : [0, +1, +2, +1];
    const vertIndices = offsets.map(o => ci + o);
    allRhombs.push({ id: rhombId++, verts, vertIndices, thick, isHeads, fill });
}

function emitRhombs(type, angle, isHeads, loc, gen, ci) {
    if (!rhombShapes.has(gen)) rhombShapes.set(gen, makeRhombShapes(gen));
    const shapes = rhombShapes.get(gen);
    const thicks = shapes.thick, thins = shapes.thin;
    const fill = '#000';
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const t = shift.tenths;
        switch (type) {
            case Pe5: emitRhomb(loc, thicks[t], true, isHeads, fill, ci); break;
            case Pe3:
                switch (i) {
                    case 0: emitRhomb(loc, thins[t], false, isHeads, fill, ci);
                    case 1: case 4: emitRhomb(loc, thicks[t], true, isHeads, fill, ci); break;
                } break;
            case Pe1:
                switch (i) {
                    case 0: emitRhomb(loc, thicks[t], true, isHeads, fill, ci); break;
                    case 1: case 4: emitRhomb(loc, thins[t], false, isHeads, fill, ci); break;
                } break;
        }
    }
}

function expandPenta(type, angle, isHeads, loc, gen, ci) {
    if (type.kind === 'star') { expandStar(type, angle, isHeads, loc, gen, ci); return; }
    if (gen === 0) return;
    if (gen === 1) { emitRhombs(type, angle, isHeads, loc, gen, ci); return; }
    const pWheel = wheels.p[gen].w;
    const sWheel = wheels.s[gen].w;
    const childDelta = isHeads ? -1 : +1;
    expandPenta(Pe5, angle.inv, !isHeads, loc, gen - 1, ci);
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const locPenta = loc.tr(pWheel[shift.tenths]);
        const childType = type.twist[i] === 0 ? Pe3 : Pe1;
        const childAngle = shift.rot(type.twist[i]);
        expandPenta(childType, childAngle, !isHeads, locPenta, gen - 1, ci + childDelta);
        if (type.diamond.includes(i)) {
            const locDiamond = loc.tr(sWheel[shift.inv.tenths]);
            expandStar(St1, shift.inv, isHeads, locDiamond, gen - 1, ci + childDelta);
        }
    }
}

function expandStar(type, angle, isHeads, loc, gen, ci) {
    if (gen === 0) return;
    const sWheel = wheels.s[gen].w;
    const tWheel = wheels.t[gen].w;
    const pentaDelta = isHeads ? -1 : +1;
    const boatDelta = isHeads ? -2 : +2;
    expandStar(St5, angle.inv, isHeads, loc, gen - 1, ci);
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        if (type.color[i] != null) {
            expandPenta(Pe1, shift.inv, isHeads, loc.tr(sWheel[shift.tenths]), gen - 1, ci + pentaDelta);
            expandStar(St3, shift, !isHeads, loc.tr(tWheel[shift.tenths]), gen - 1, ci + boatDelta);
        }
    }
}

function roundKey(pt) { return `${Math.round(pt.x * 1e4)},${Math.round(pt.y * 1e4)}`; }

function run(seedType, genLevel, isHeads = true) {
    allRhombs = []; rhombId = 0; rhombShapes.clear();
    const angle = ang(0, false);
    const ci = 4;
    if (seedType.kind === 'penta') {
        expandPenta(seedType, angle, isHeads, p(0, 0), genLevel, ci);
    } else {
        expandStar(seedType, angle, isHeads, p(0, 0), genLevel, ci);
    }

    // Check for conflicts at shared vertices
    const vertexMap = new Map();
    let conflicts = 0;
    for (const r of allRhombs) {
        for (let i = 0; i < 4; i++) {
            const key = roundKey(r.verts[i]);
            const existing = vertexMap.get(key);
            if (existing !== undefined) {
                if (existing !== r.vertIndices[i]) {
                    conflicts++;
                    if (conflicts <= 3) {
                        console.log(`  CONFLICT at ${key}: was ${existing}, got ${r.vertIndices[i]} from rhomb ${r.id}`);
                    }
                }
            } else {
                vertexMap.set(key, r.vertIndices[i]);
            }
        }
    }

    // Index histogram
    const hist = {};
    for (const [, idx] of vertexMap) {
        hist[idx] = (hist[idx] || 0) + 1;
    }

    // Check per-rhomb consistency (each rhomb's edge should diff by ±1)
    let edgeErrors = 0;
    for (const r of allRhombs) {
        const vi = r.vertIndices;
        for (let i = 0; i < 4; i++) {
            const diff = Math.abs(vi[i] - vi[(i + 1) % 4]);
            if (diff !== 1) {
                edgeErrors++;
                break;
            }
        }
    }

    console.log(`${seedType.name} gen=${genLevel} isHeads=${isHeads}: ${allRhombs.length} rhombs, ${vertexMap.size} vertices`);
    console.log(`  Index histogram: ${JSON.stringify(hist)}`);
    console.log(`  Vertex conflicts: ${conflicts}, Edge errors: ${edgeErrors}`);
    console.log();
}

console.log('=== CI Propagation Test ===\n');
for (const seed of [Pe5, Pe3, Pe1, St5, St3, St1]) {
    for (const g of [1, 2, 3]) {
        run(seed, g);
    }
}
