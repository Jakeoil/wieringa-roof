// Quick headless test of BFS vertex connectivity
// We'll just read main.ts and extract the logic we need

import { readFileSync } from 'fs';

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
    constructor(fifths, isDown) {
        this.fifths = mod5(fifths);
        this.isDown = isDown;
    }
    rot(n) { return new Angle(mod5(this.fifths + n), this.isDown); }
    get inv() { return new Angle(this.fifths, !this.isDown); }
    get tenths() { return (this.fifths * 2 + (this.isDown ? 5 : 0)) % 10; }
}
function ang(f, d) { return new Angle(f, d); }

class Wheel {
    constructor(p0, p1, p2) {
        this.w = [
            p0.copy, p1.copy, p2.copy,
            p2.vr, p1.vr, p0.vr,
            p1.neg, p2.neg, p2.hr, p1.hr,
        ];
    }
}

function interpolateWheel(p0, p1, p2) {
    const { x: a0, y: b0 } = p0;
    const { x: a1, y: b1 } = p1;
    const { x: a2, y: b2 } = p2;
    const x0 = a0;
    const y0 = b0;
    const x1 = a0 * PHI + a1;
    const y1 = b0 * PHI + b1;
    const x2 = a0 * (PHI + 1) + a1 * PHI + a2;
    const y2 = b0 * (PHI + 1) + b1 * PHI + b2;
    return [p(x0, y0), p(x1, y1), p(x2, y2)];
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

function makeRhombShapes(wheels, gen) {
    const exp = gen;
    const tWheel = wheels.t[exp].w;
    const thickAll = [];
    const thinAll = [];
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

const Pe5 = { name: 'Pe5', kind: 'penta', twist: [0, 0, 0, 0, 0], diamond: [] };
const Pe3 = { name: 'Pe3', kind: 'penta', twist: [0, 0, -1, 1, 0], diamond: [0] };
const Pe1 = { name: 'Pe1', kind: 'penta', twist: [0, -1, 1, -1, 1], diamond: [1, 4] };
const St5 = { name: 'St5', kind: 'star', color: ['y', 'y', 'y', 'y', 'y'] };
const St3 = { name: 'St3', kind: 'star', color: ['y', 'y', null, null, 'y'] };
const St1 = { name: 'St1', kind: 'star', color: ['y', null, null, null, null] };

const CLUSTER_COLORS = { Pe5: '#9292e3', Pe3: '#e6e68e', Pe1: '#eec09b' };

let allRhombs = [];
let rhombId = 0;
let wheels;
let rhombShapes = new Map();

function emitRhomb(loc, shape, thick, isHeads, fill) {
    const verts = shape.map(v => loc.tr(v));
    allRhombs.push({ id: rhombId++, verts, thick, isHeads, fill });
}

function emitRhombs(type, angle, isHeads, loc, gen) {
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
                emitRhomb(loc, thicks[t], true, isHeads, fill);
                break;
            case Pe3:
                switch (i) {
                    case 0:
                        emitRhomb(loc, thins[t], false, isHeads, fill);
                    case 1: case 4:
                        emitRhomb(loc, thicks[t], true, isHeads, fill);
                        break;
                }
                break;
            case Pe1:
                switch (i) {
                    case 0:
                        emitRhomb(loc, thicks[t], true, isHeads, fill);
                        break;
                    case 1: case 4:
                        emitRhomb(loc, thins[t], false, isHeads, fill);
                        break;
                }
                break;
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
            const locPenta = loc.tr(sWheel[shift.tenths]);
            expandPenta(Pe1, shift.inv, isHeads, locPenta, gen - 1);
            const locBoat = loc.tr(tWheel[shift.tenths]);
            expandStar(St3, shift, !isHeads, locBoat, gen - 1);
        }
    }
}

function roundKey(pt) {
    return `${Math.round(pt.x * 1e4)},${Math.round(pt.y * 1e4)}`;
}

function run(seedType, genLevel) {
    allRhombs = [];
    rhombId = 0;
    rhombShapes.clear();
    const seeds = computeRealSeeds();
    wheels = makeWheels(seeds.pSeed, seeds.sSeed, seeds.tSeed, seeds.dSeed);

    const angle = ang(0, false);
    if (seedType.kind === 'penta') {
        expandPenta(seedType, angle, true, p(0, 0), genLevel);
    } else {
        expandStar(seedType, angle, true, p(0, 0), genLevel);
    }

    // Build vertex map
    const vertexMap = new Map();
    const vertexList = [];
    const edgeMap = new Map();

    for (const r of allRhombs) {
        const vids = [];
        for (const v of r.verts) {
            const key = roundKey(v);
            let existing = vertexMap.get(key);
            if (!existing) {
                existing = { id: vertexList.length, pos: v, index: 0, rhombIds: [] };
                vertexList.push(existing);
                vertexMap.set(key, existing);
            }
            existing.rhombIds.push(r.id);
            vids.push(existing.id);
        }
        for (let i = 0; i < 4; i++) {
            const a = vids[i], b = vids[(i + 1) % 4];
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            const existing = edgeMap.get(key);
            if (existing) {
                existing.rhombIds.push(r.id);
            } else {
                edgeMap.set(key, { v1: a, v2: b, rhombIds: [r.id] });
            }
        }
    }

    // Propagate indices (BFS from origin)
    const centerKey = roundKey(p(0, 0));
    const centerV = vertexMap.get(centerKey);
    if (!centerV) {
        console.log(`  No vertex at origin!`);
        return;
    }
    centerV.index = 4;
    const visited = new Set([centerV.id]);
    const queue = [centerV.id];

    while (queue.length > 0) {
        const vid = queue.shift();
        const v = vertexList[vid];
        for (const rid of v.rhombIds) {
            const r = allRhombs[rid];
            const vids = r.verts.map(pt => vertexMap.get(roundKey(pt))?.id);
            const myPos = vids.indexOf(vid);
            if (myPos === -1) continue;
            const offsets = r.isHeads ? [0, -1, -2, -1] : [0, 1, 2, 1];
            const v0Index = v.index - offsets[myPos];
            for (let i = 0; i < 4; i++) {
                const tid = vids[i];
                if (tid === undefined || visited.has(tid)) continue;
                vertexList[tid].index = v0Index + offsets[i];
                visited.add(tid);
                queue.push(tid);
            }
        }
    }

    const unreached = vertexList.length - visited.size;
    const indexHist = {};
    for (const v of vertexList) {
        indexHist[v.index] = (indexHist[v.index] || 0) + 1;
    }

    // Check for index conflicts
    let conflicts = 0;
    for (const r of allRhombs) {
        const vids = r.verts.map(pt => vertexMap.get(roundKey(pt)));
        const indices = vids.map(v => v ? v.index : '?');
        const offsets = r.isHeads ? [0, -1, -2, -1] : [0, 1, 2, 1];
        const expected = indices.map((_, i) => indices[0] + offsets[i] - offsets[0]);
        for (let i = 0; i < 4; i++) {
            if (indices[i] !== expected[i]) {
                conflicts++;
                break;
            }
        }
    }

    console.log(`${seedType.name} gen=${genLevel}: ${allRhombs.length} rhombs, ${vertexList.length} vertices`);
    console.log(`  BFS reached: ${visited.size}/${vertexList.length} (${unreached} unreached)`);
    console.log(`  Index histogram:`, indexHist);
    console.log(`  Rhombs with index conflicts: ${conflicts}/${allRhombs.length}`);

    // Check edges shared by 2 rhombs
    let shared = 0, boundary = 0;
    for (const [, e] of edgeMap) {
        if (e.rhombIds.length >= 2) shared++;
        else boundary++;
    }
    console.log(`  Edges: ${shared} shared, ${boundary} boundary`);
}

console.log('=== Regular rhomb path (tWheel, from pentas at gen 1) ===\n');
for (const seed of [St5, Pe5, Pe3]) {
    for (const g of [1, 2, 3]) {
        run(seed, g);
        console.log();
    }
}
