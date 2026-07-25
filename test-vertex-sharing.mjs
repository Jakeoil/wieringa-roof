// Check whether adjacent penta clusters share vertices / near-miss vertices
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

// Collect ALL vertices from rhombs for Pe5 gen=2
const Pe5 = { name: 'Pe5', kind: 'penta', twist: [0, 0, 0, 0, 0], diamond: [] };
const Pe3 = { name: 'Pe3', kind: 'penta', twist: [0, 0, -1, 1, 0], diamond: [0] };
const Pe1 = { name: 'Pe1', kind: 'penta', twist: [0, -1, 1, -1, 1], diamond: [1, 4] };
const St5 = { name: 'St5', kind: 'star', color: ['y', 'y', 'y', 'y', 'y'] };
const St3 = { name: 'St3', kind: 'star', color: ['y', 'y', null, null, 'y'] };
const St1 = { name: 'St1', kind: 'star', color: ['y', null, null, null, null] };

// Collect all raw vertex positions with their source info
const allVerts = [];
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

let allRhombs = [];
let rhombId = 0;

function emitRhomb(loc, shape, thick, isHeads, fill, source) {
    const verts = shape.map(v => loc.tr(v));
    allRhombs.push({ id: rhombId++, verts, thick, isHeads, fill, source });
}

function emitRhombs(type, angle, isHeads, loc, gen, source) {
    if (!rhombShapes.has(gen)) {
        rhombShapes.set(gen, makeRhombShapes(gen));
    }
    const shapes = rhombShapes.get(gen);
    const thicks = shapes.thick;
    const thins = shapes.thin;
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const t = shift.tenths;
        switch (type) {
            case Pe5:
                emitRhomb(loc, thicks[t], true, isHeads, '#9292e3', source);
                break;
            case Pe3:
                switch (i) {
                    case 0:
                        emitRhomb(loc, thins[t], false, isHeads, '#e6e68e', source);
                    case 1: case 4:
                        emitRhomb(loc, thicks[t], true, isHeads, '#e6e68e', source);
                        break;
                }
                break;
            case Pe1:
                switch (i) {
                    case 0:
                        emitRhomb(loc, thicks[t], true, isHeads, '#eec09b', source);
                        break;
                    case 1: case 4:
                        emitRhomb(loc, thins[t], false, isHeads, '#eec09b', source);
                        break;
                }
                break;
        }
    }
}

function expandPenta(type, angle, isHeads, loc, gen, depth = 0) {
    if (type.kind === 'star') { expandStar(type, angle, isHeads, loc, gen, depth); return; }
    if (gen === 0) return;
    if (gen === 1) { emitRhombs(type, angle, isHeads, loc, gen, `penta(${type.name},gen=${gen},depth=${depth})`); return; }
    const pWheel = wheels.p[gen].w;
    const sWheel = wheels.s[gen].w;
    expandPenta(Pe5, angle.inv, !isHeads, loc, gen - 1, depth + 1);
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const locPenta = loc.tr(pWheel[shift.tenths]);
        const childType = type.twist[i] === 0 ? Pe3 : Pe1;
        const childAngle = shift.rot(type.twist[i]);
        expandPenta(childType, childAngle, !isHeads, locPenta, gen - 1, depth + 1);
        if (type.diamond.includes(i)) {
            const locDiamond = loc.tr(sWheel[shift.inv.tenths]);
            expandStar(St1, shift.inv, isHeads, locDiamond, gen - 1, depth + 1);
        }
    }
}

function expandStar(type, angle, isHeads, loc, gen, depth = 0) {
    if (gen === 0) return;
    const sWheel = wheels.s[gen].w;
    const tWheel = wheels.t[gen].w;
    expandStar(St5, angle.inv, isHeads, loc, gen - 1, depth + 1);
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        if (type.color[i] != null) {
            expandPenta(Pe1, shift.inv, isHeads, loc.tr(sWheel[shift.tenths]), gen - 1, depth + 1);
            expandStar(St3, shift, !isHeads, loc.tr(tWheel[shift.tenths]), gen - 1, depth + 1);
        }
    }
}

// Run Pe5 gen=2
expandPenta(Pe5, ang(0, false), true, p(0, 0), 2);

console.log(`Total rhombs: ${allRhombs.length}`);

// Collect all vertex positions
const rawVerts = [];
for (const r of allRhombs) {
    for (let i = 0; i < 4; i++) {
        rawVerts.push({ x: r.verts[i].x, y: r.verts[i].y, rhombId: r.id, vertIdx: i, source: r.source });
    }
}

// Find near-misses: pairs of vertices from different rhombs that are close but not identical
rawVerts.sort((a, b) => a.x - b.x || a.y - b.y);

console.log(`\nLooking for near-miss vertices (different rounding but close):`);
let nearMisses = 0;
let exactMatches = 0;
const round4 = (v) => `${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)}`;
const round3 = (v) => `${Math.round(v.x * 1e3)},${Math.round(v.y * 1e3)}`;

// Group by round4 key
const groups4 = new Map();
const groups3 = new Map();
for (const v of rawVerts) {
    const k4 = round4(v);
    const k3 = round3(v);
    if (!groups4.has(k4)) groups4.set(k4, []);
    groups4.get(k4).push(v);
    if (!groups3.has(k3)) groups3.set(k3, []);
    groups3.get(k3).push(v);
}

console.log(`Unique vertices at 1e4 rounding: ${groups4.size}`);
console.log(`Unique vertices at 1e3 rounding: ${groups3.size}`);

// Check for groups that merge at lower precision
let mergedAt3 = 0;
for (const [k3, verts] of groups3) {
    const keys4 = new Set(verts.map(v => round4(v)));
    if (keys4.size > 1) {
        mergedAt3++;
        if (mergedAt3 <= 5) {
            console.log(`\nNear-miss group (same at 1e3, different at 1e4):`);
            for (const k4 of keys4) {
                const sample = verts.find(v => round4(v) === k4);
                console.log(`  ${k4}: exact=(${sample.x}, ${sample.y}) from rhomb ${sample.rhombId}[${sample.vertIdx}] ${sample.source}`);
            }
        }
    }
}
console.log(`\nTotal near-miss groups: ${mergedAt3}`);

// Also check: for each pair of adjacent rhombs (sharing a round4 vertex),
// count how many rhombs from different sources share vertices
const sourcesByRound4 = new Map();
for (const v of rawVerts) {
    const k = round4(v);
    if (!sourcesByRound4.has(k)) sourcesByRound4.set(k, new Set());
    sourcesByRound4.get(k).add(v.source);
}
let multiSource = 0;
for (const [k, sources] of sourcesByRound4) {
    if (sources.size > 1) multiSource++;
}
console.log(`Vertices shared by multiple source clusters: ${multiSource}`);
