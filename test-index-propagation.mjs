// Test index propagation through recursion
// Goal: determine the correct centerIndex deltas for each child type

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

const Pe5 = { name: 'Pe5', kind: 'penta', twist: [0, 0, 0, 0, 0], diamond: [] };
const Pe3 = { name: 'Pe3', kind: 'penta', twist: [0, 0, -1, 1, 0], diamond: [0] };
const Pe1 = { name: 'Pe1', kind: 'penta', twist: [0, -1, 1, -1, 1], diamond: [1, 4] };
const St5 = { name: 'St5', kind: 'star', color: ['y', 'y', 'y', 'y', 'y'] };
const St3 = { name: 'St3', kind: 'star', color: ['y', 'y', null, null, 'y'] };
const St1 = { name: 'St1', kind: 'star', color: ['y', null, null, null, null] };

// Use de Bruijn pentagrid index computation
// For our tiling, we need to find the grid spacing and offsets

// The 5 grid directions
const e = [];
for (let j = 0; j < 5; j++) {
    const theta = 2 * Math.PI * j / 5 + Math.PI / 2; // rotated to match our tiling orientation
    e.push({ x: Math.cos(theta), y: Math.sin(theta) });
}

// Dot product of a point with grid direction j
function dot(pt, j) {
    return pt.x * e[j].x + pt.y * e[j].y;
}

// For our tiling, the grid spacing relates to the edge length.
// In the de Bruijn construction with unit grid spacing, the rhomb edge length is 1/(2*sin(π/5)).
// Our edge length at gen 1 is |tWheel[1][0]|.
// So our grid spacing d = edgeLength * 2 * sin(π/5)

// Actually, let's determine d empirically.
// For Pe5 gen=1, the center vertex should have maximum index.
// The vertices at the outer ring should have index one less.

// Let me compute grid spacing from the known vertex positions
// For Pe5 gen=1: center=(0,0), one ring vertex = tWheel[1][9] (first step of thick rhomb)

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

// Get all vertices from Pe5 gen=1
const shapes1 = makeRhombShapes(1);
const thick0 = shapes1.thick[0]; // First thick rhomb at tenth=0
console.log('Thick rhomb 0 vertices:');
for (let i = 0; i < 4; i++) {
    console.log(`  v${i}: (${thick0[i].x.toFixed(4)}, ${thick0[i].y.toFixed(4)})`);
    for (let j = 0; j < 5; j++) {
        console.log(`    dot(e${j}) = ${dot(thick0[i], j).toFixed(6)}`);
    }
}

// For the de Bruijn construction: x·eⱼ / d = Kⱼ + γⱼ
// where Kⱼ is an integer and γⱼ ∈ (0,1)
//
// At the origin (center of Pe5): all dots are 0
// So 0/d = Kⱼ + γⱼ → Kⱼ = 0 and γⱼ = 0 (if we set γⱼ = 0)
// Or Kⱼ = -1 and γⱼ = 1/d * 0 + ... hmm this depends on the convention
//
// Actually, the standard convention is:
// Kⱼ(x) = ceil(x·eⱼ/d - γⱼ)   (the strip index for family j)
// Index = sum of Kⱼ

// The key relationship: for an edge of the rhomb, crossing grid family j changes Kⱼ by ±1.
// An edge vector of the rhomb is proportional to the dual of eⱼ (perpendicular to eⱼ in 2D with specific orientation).

// Let me compute the edge length and grid spacing.
const edgeLen = Math.sqrt(thick0[1].x ** 2 + thick0[1].y ** 2);
console.log(`\nEdge length (|v1|): ${edgeLen.toFixed(6)}`);

// In de Bruijn: edge length = 1 / (2 * sin(π/5)) when grid spacing = 1
// So grid spacing d = edgeLen * 2 * sin(π/5)
const d = edgeLen * 2 * Math.sin(Math.PI / 5);
console.log(`Grid spacing d: ${d.toFixed(6)}`);

// Now compute index for each vertex of the thick rhomb
console.log('\nIndices via pentagrid:');
// We need to determine γ values. At origin, all dot products are 0.
// If we want origin to have index 4, we need sum of Kⱼ = 4 at origin.
// With Kⱼ = ceil(0/d - γⱼ) = ceil(-γⱼ), we need sum(ceil(-γⱼ)) = 4
// For 5 values, if γⱼ = -0.5 + ε (small positive ε) for all j:
//   ceil(0.5 - ε) = 1 for each → sum = 5. Too high.
// If γⱼ = 0.1 for all j: ceil(-0.1) = 0 → sum = 0. Too low.
// If γⱼ = -0.8 for all j: ceil(0.8) = 1 → sum = 5.

// Let me try: γⱼ = γ for all j, and find γ such that center = 4
// At origin: Kⱼ = ceil(-γ). Want sum = 4.
// If ceil(-γ) = 0 for one j and ceil(-γ) = 1 for four → not possible if all same γ
// If ceil(-γ) = 1 for all → sum = 5
// Hmm, we need a way to get sum = 4.

// Actually, the convention might be: Kⱼ = floor(x·eⱼ/d + γⱼ)
// At origin: Kⱼ = floor(γⱼ). Want sum = 4.
// If γⱼ = 0.9 for all: floor(0.9) = 0 for each → sum = 0
// If γⱼ = 1.0: floor(1.0) = 1 → sum = 5
// Need 4 values with floor = 1 and 1 with floor = 0.
// Possible if 4 of the γⱼ ≥ 1 and 1 of them < 1.

// Hmm, let me try a different convention.
// Singmaster defines: Kⱼ = floor(x·eⱼ/d + γⱼ) + 1
// At origin: Kⱼ = floor(γⱼ) + 1. Want sum = 4.
// If γⱼ = 0 for 4 families: floor(0) + 1 = 1, and γ₄ = -0.5: floor(-0.5) + 1 = 0
// Sum = 4. ✓ But this breaks the 5-fold symmetry.

// For the Pe5 tiling, we DO have 5-fold symmetry, so γⱼ should all be equal.
// With γⱼ = γ for all: sum = 5 * (floor(γ) + 1)
// For sum = 4: not possible with integer * 5!
// Unless we're at a special point where some Kⱼ differ.

// Actually, for a Pe5 center, the 5-fold symmetry means x·eⱼ = 0 for all j.
// This is ON a grid line for all 5 families (when γⱼ = 0).
// Being on a grid line is degenerate — floor vs ceil matters.

// The de Bruijn condition requires that no point lies on more than 2 grid lines simultaneously.
// The origin lying on all 5 grid lines (when γⱼ = 0) would be very degenerate.
// In practice, the γ values are chosen to avoid this.

// For the standard "star-centered" Penrose tiling:
// γⱼ = (1 + 1/√5) / 2 for all j? Or some other value.
// The constraint is: sum(γⱼ) ∈ Z (necessary for the de Bruijn index to be well-defined)

// Let me try: for a Pe5 center at origin with index 4:
// We need sum of Kⱼ at origin = 4.
// With all γⱼ equal to γ:
// Kⱼ = floor(0 + γ) = floor(γ)
// Sum = 5 * floor(γ) = 0 or 5. Neither is 4.

// So a 5-fold symmetric γ CANNOT give index 4 at origin. We need asymmetric γ.
// Or perhaps the convention is different.

// Let me try the convention where Kⱼ = round(x·eⱼ/d - γⱼ) and use
// the fact that x·eⱼ/d at origin equals 0 for all j.

// Actually, let me just use the empirical approach. I'll compute x·eⱼ/d for
// the BFS-known vertices (Pe5 gen=1) and figure out the Kⱼ values.

console.log('\n=== Empirical pentagrid analysis for Pe5 gen=1 ===');
console.log('BFS-verified indices: center=4, ring=3, tips=2');
console.log();

// Collect all unique vertices from Pe5 gen=1
const verts = new Map();
function addVert(pt) {
    const key = `${Math.round(pt.x * 1e4)},${Math.round(pt.y * 1e4)}`;
    if (!verts.has(key)) verts.set(key, { pt, rhombs: [] });
    return key;
}

for (let tenth = 0; tenth < 10; tenth += 2) { // Pe5 uses all 5 tenths (0,2,4,6,8)
    const shape = shapes1.thick[tenth];
    const loc = p(0, 0);
    for (let i = 0; i < 4; i++) {
        const v = loc.tr(shape[i]);
        addVert(v);
    }
}

// For each vertex, compute x·eⱼ/d
for (const [key, { pt }] of verts) {
    const dots = [];
    for (let j = 0; j < 5; j++) {
        dots.push(dot(pt, j) / d);
    }
    const dotsStr = dots.map(d => d.toFixed(3)).join(', ');
    console.log(`(${pt.x.toFixed(3)}, ${pt.y.toFixed(3)}): dots/d = [${dotsStr}]`);
}
