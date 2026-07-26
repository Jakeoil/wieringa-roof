// Wieringa Roof — Interactive Golden Rhombus Net Builder
// Uses the same recursive deflation as penrose-mosaic, ported to TypeScript.

const SQRT5 = Math.sqrt(5);
const PHI = (SQRT5 + 1) / 2;
const GOLDEN_SIDE = SQRT5 / 2; // φ − ½ ≈ 1.118 inches

// ── Point ─────────────────────────────────────────────────────────

class Pt {
    constructor(
        public x: number,
        public y: number,
    ) {}
    tr(v: Pt): Pt {
        return new Pt(this.x + v.x, this.y + v.y);
    }
    get vr(): Pt {
        return new Pt(this.x, -this.y);
    }
    get hr(): Pt {
        return new Pt(-this.x, this.y);
    }
    get neg(): Pt {
        return new Pt(-this.x, -this.y);
    }
    get copy(): Pt {
        return new Pt(this.x, this.y);
    }
    mult(m: number): Pt {
        return new Pt(this.x * m, this.y * m);
    }
}

function p(x: number, y: number): Pt {
    return new Pt(x, y);
}

// ── Angle (fifths + isDown) ───────────────────────────────────────

function mod5(n: number): number {
    return ((n % 5) + 5) % 5;
}
function mod10(n: number): number {
    return ((n % 10) + 10) % 10;
}

class Angle {
    fifths: number;
    isDown: boolean;
    constructor(fifths: number, isDown: boolean) {
        this.fifths = mod5(fifths);
        this.isDown = isDown;
    }
    rot(n: number): Angle {
        return new Angle(mod5(this.fifths + n), this.isDown);
    }
    get inv(): Angle {
        return new Angle(this.fifths, !this.isDown);
    }
    get tenths(): number {
        return (this.fifths * 2 + (this.isDown ? 5 : 0)) % 10;
    }
}

function ang(fifths: number, isDown: boolean): Angle {
    return new Angle(fifths, isDown);
}

// ── Wheel (10-point radial array) ─────────────────────────────────

class Wheel {
    w: Pt[];
    constructor(p0: Pt, p1: Pt, p2: Pt) {
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

function interpolateWheel(p0: Pt, p1: Pt, p2: Pt): [Pt, Pt, Pt] {
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

interface WheelSet {
    p: Wheel[];
    s: Wheel[];
    t: Wheel[];
    d: Wheel[];
}

function makeWheels(
    pSeed: [Pt, Pt, Pt],
    sSeed: [Pt, Pt, Pt],
    tSeed: [Pt, Pt, Pt],
    dSeed: [Pt, Pt, Pt],
): WheelSet {
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

function computeRealSeeds(): {
    pSeed: [Pt, Pt, Pt];
    sSeed: [Pt, Pt, Pt];
    tSeed: [Pt, Pt, Pt];
    dSeed: [Pt, Pt, Pt];
} {
    const c_0 = 1;
    const c_1 = (SQRT5 - 1) / 4; // cos 72
    const c_2 = (SQRT5 + 1) / 4; // cos 36
    const s_0 = 0;
    const s_1 = Math.sqrt(10 + 2 * SQRT5) / 4; // sin 72
    const s_2 = Math.sqrt(10 - 2 * SQRT5) / 4; // sin 36

    const unitUp: Pt[] = [
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

    // Parallelogram (inner pentagram rhombus) proportions (a = (3-√5)/2 ≈ .382)
    const pgram_a = (3 - SQRT5) / 2;
    const pgram_R = Math.sqrt((25 - 11 * SQRT5) / 10); // .2008
    const pgram_y = Math.sqrt((25 - 11 * SQRT5) / 2) / 2;

    // solve(prop, "a", 4, key) = prop[key] * (4 / prop.a)
    // For pgon:  factor = 4/1 = 4
    // For pgram: factor = 4/pgram_a ≈ 10.47
    const pMag = pgon_r * a * 2; // 2 * apothem at side=4
    const sMag = pgon_R * a + pgram_R * (a / pgram_a); // pgon.R + pgram.R at side=4
    const tMag = (pgram_R * (a / pgram_a) + pgram_y * (a / pgram_a)) * 2;
    const dMag = pgon_r * a; // apothem at side=4

    // Seed: [unitUp[0]*mag, unitDown[3]*mag, unitUp[1]*mag]
    // where unitDown[3] = unitUp[3].neg
    function makeSeedCorrect(mag: number): [Pt, Pt, Pt] {
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

function shapeWheel3(up: Pt[][], won: Pt[][], too: Pt[][]): Pt[][] {
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

function makeRhombShapes(
    wheels: WheelSet,
    gen: number,
): { thick: Pt[][]; thin: Pt[][] } {
    const exp = gen;
    const tWheel = wheels.t[exp].w;

    function thickAt(tenth: number): Pt[] {
        const o = p(0, 0);
        const o1 = o.tr(tWheel[mod10(tenth + 9)]);
        const o2 = o1.tr(tWheel[mod10(tenth + 1)]);
        const o3 = o2.tr(tWheel[mod10(tenth + 4)]);
        return [o, o1, o2, o3];
    }
    function thinAt(tenth: number): Pt[] {
        const o = p(0, 0);
        const o1 = o.tr(tWheel[mod10(tenth + 3)]);
        const o2 = o1.tr(tWheel[mod10(tenth + 7)]);
        const o3 = o2.tr(tWheel[mod10(tenth + 8)]);
        return [o, o1, o2, o3];
    }

    // Build all 10 orientations directly
    const thickAll: Pt[][] = [];
    const thinAll: Pt[][] = [];
    for (let t = 0; t < 10; t++) {
        thickAll.push(thickAt(t));
        thinAll.push(thinAt(t));
    }

    return { thick: thickAll, thin: thinAll };
}

// ── Tile type definitions ─────────────────────────────────────────

interface TileType {
    name: string;
    kind: "penta" | "star";
    twist?: number[];
    diamond?: number[];
    color?: (string | null)[];
}

const Pe5: TileType = {
    name: "Pe5",
    kind: "penta",
    twist: [0, 0, 0, 0, 0],
    diamond: [],
};
const Pe3: TileType = {
    name: "Pe3",
    kind: "penta",
    twist: [0, 0, -1, 1, 0],
    diamond: [0],
};
const Pe1: TileType = {
    name: "Pe1",
    kind: "penta",
    twist: [0, -1, 1, -1, 1],
    diamond: [1, 4],
};
const St5: TileType = {
    name: "St5",
    kind: "star",
    color: ["y", "y", "y", "y", "y"],
};
const St3: TileType = {
    name: "St3",
    kind: "star",
    color: ["y", "y", null, null, "y"],
};
const St1: TileType = {
    name: "St1",
    kind: "star",
    color: ["y", null, null, null, null],
};

// ── Rhomb collection ──────────────────────────────────────────────

interface Rhomb {
    id: number;
    verts: [Pt, Pt, Pt, Pt];
    vertIndices: [number, number, number, number];
    thick: boolean;
    isHeads: boolean;
    fill: string;
}

// Cluster colors (matches penrose-mosaic custom palette)
const CLUSTER_COLORS: Record<string, string> = {
    Pe5: "#9292e3", // [146,146,227]
    Pe3: "#e6e68e", // [230,230,142]
    Pe1: "#eec09b", // [238,192,155]
};

let allRhombs: Rhomb[] = [];
let rhombId = 0;

function emitRhomb(
    loc: Pt,
    shape: Pt[],
    thick: boolean,
    isHeads: boolean,
    fill: string,
    ci: number,
) {
    const verts = shape.map((v) => loc.tr(v)) as [Pt, Pt, Pt, Pt];
    // v0 is at the penta center (ci). Along v0→v2 diagonal: index changes by ±2.
    // isHeads=true → v0 high, v2 low: [ci, ci-1, ci-2, ci-1]
    // isHeads=false → v0 low, v2 high: [ci, ci+1, ci+2, ci+1]
    const offsets: [number, number, number, number] = isHeads
        ? [0, -1, -2, -1]
        : [0, +1, +2, +1];
    const vertIndices: [number, number, number, number] = [
        ci + offsets[0],
        ci + offsets[1],
        ci + offsets[2],
        ci + offsets[3],
    ];
    allRhombs.push({ id: rhombId++, verts, vertIndices, thick, isHeads, fill });
}

// ── Recursive expansion → rhombs ──────────────────────────────────

let wheels: WheelSet;
let rhombShapes: Map<number, { thick: Pt[][]; thin: Pt[][] }> = new Map();

function emitRhombs(
    type: TileType,
    angle: Angle,
    isHeads: boolean,
    loc: Pt,
    gen: number,
    ci: number,
) {
    if (!rhombShapes.has(gen)) {
        rhombShapes.set(gen, makeRhombShapes(wheels, gen));
    }
    const shapes = rhombShapes.get(gen)!;
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

function expandPenta(
    type: TileType,
    angle: Angle,
    isHeads: boolean,
    loc: Pt,
    gen: number,
    ci: number,
) {
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
    // Moving from penta center to pWheel child: index increases when center is a peak
    // (isHeads=true), because the child's center is the LOW point of its own cluster
    // (isHeads flips), and its ring vertices reach back up to match the parent's tips.
    const childDelta = isHeads ? +1 : -1;

    // Central inverted penta (same location → same ci)
    expandPenta(Pe5, angle.inv, !isHeads, loc, gen - 1, ci);

    // 5 surrounding pentas + diamonds
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        const locPenta = loc.tr(pWheel[shift.tenths]);
        const childType = type.twist![i] === 0 ? Pe3 : Pe1;
        const childAngle = shift.rot(type.twist![i]);
        expandPenta(
            childType,
            childAngle,
            !isHeads,
            locPenta,
            gen - 1,
            ci + childDelta,
        );

        if (type.diamond!.includes(i)) {
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

function expandStar(
    type: TileType,
    angle: Angle,
    isHeads: boolean,
    loc: Pt,
    gen: number,
    ci: number,
) {
    if (gen === 0) {
        return;
    }

    const sWheel = wheels.s[gen].w;
    const tWheel = wheels.t[gen].w;

    // Index deltas: Pe1 children are 1 step from star center,
    // St3 (boat) children are 2 steps from star center
    const pentaDelta = isHeads ? -1 : +1;
    const boatDelta = isHeads ? -2 : +2;

    // Central star (same location → same ci)
    expandStar(St5, angle.inv, isHeads, loc, gen - 1, ci);

    // Surrounding pentas and boats
    for (let i = 0; i < 5; i++) {
        const shift = angle.rot(i);
        if (type.color![i] != null) {
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

// ── Pentagrid index computation ───────────────────────────────────

// De Bruijn pentagrid: 5 grid directions at θⱼ = 54° + 72°j
// Index I(x,y) = Σⱼ floor(dot(pt, eⱼ) / d) + 4
// where d = edge length at gen 1 = |tWheel[1].w[0]|

const GRID_DIRS: { x: number; y: number }[] = [];
for (let j = 0; j < 5; j++) {
    const theta = (Math.PI * 3) / 10 + (2 * Math.PI * j) / 5; // 54° + 72°j
    GRID_DIRS.push({ x: Math.cos(theta), y: Math.sin(theta) });
}

let gridSpacing = 0; // set after wheels are built

function computeIndex(pt: Pt): number {
    let sum = 0;
    for (let j = 0; j < 5; j++) {
        const dot = pt.x * GRID_DIRS[j].x + pt.y * GRID_DIRS[j].y;
        const scaled = dot / gridSpacing;
        // Vertices on grid boundaries need consistent rounding.
        // Nudge by tiny epsilon toward the interior (floor side).
        sum += Math.floor(scaled + 1e-9);
    }
    return sum + 4;
}

// ── Vertex registry & index propagation ───────────────────────────

interface Vertex {
    id: number;
    pos: Pt;
    index: number;
    rhombIds: number[];
}

interface Edge {
    v1: number;
    v2: number;
    rhombIds: number[];
}

const vertexMap = new Map<string, Vertex>();
const vertexList: Vertex[] = [];
const edgeMap = new Map<string, Edge>();

function roundKey(pt: Pt): string {
    return `${Math.round(pt.x * 1e4)},${Math.round(pt.y * 1e4)}`;
}

function getOrCreateVertex(pos: Pt): number {
    const key = roundKey(pos);
    const existing = vertexMap.get(key);
    if (existing) return existing.id;
    const v: Vertex = { id: vertexList.length, pos, index: -999, rhombIds: [] };
    vertexList.push(v);
    vertexMap.set(key, v);
    return v.id;
}

function edgeKey(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function buildRegistries() {
    vertexMap.clear();
    vertexList.length = 0;
    edgeMap.clear();

    for (const r of allRhombs) {
        const vids: number[] = [];
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

function assignIndicesFromPentagrid() {
    // Compute vertex indices directly from position using pentagrid formula
    for (const v of vertexList) {
        v.index = computeIndex(v.pos);
    }

    // Also update per-rhomb vertIndices for net labels
    for (const r of allRhombs) {
        for (let i = 0; i < 4; i++) {
            const v = vertexMap.get(roundKey(r.verts[i]));
            if (v) r.vertIndices[i] = v.index;
        }
    }

    // Verify: every edge should have |diff| = 1
    let badEdges = 0;
    for (const e of edgeMap.values()) {
        const diff = Math.abs(vertexList[e.v1].index - vertexList[e.v2].index);
        if (diff !== 1) badEdges++;
    }

    const indexHist: Record<number, number> = {};
    for (const v of vertexList) {
        indexHist[v.index] = (indexHist[v.index] || 0) + 1;
    }
    console.log(
        `assignIndicesFromPentagrid: ${vertexList.length} vertices, ${badEdges} bad edges (|diff|≠1)`,
    );
    console.log("Index histogram:", indexHist);
}

// ── UI State ──────────────────────────────────────────────────────

type SeedType = "Pe5" | "Pe3" | "Pe1" | "St5" | "St3" | "St1";

const seedTypes: { label: string; type: TileType; kind: "penta" | "star" }[] = [
    { label: "Pe5", type: Pe5, kind: "penta" },
    { label: "Pe3", type: Pe3, kind: "penta" },
    { label: "Pe1", type: Pe1, kind: "penta" },
    { label: "St5", type: St5, kind: "star" },
    { label: "St3", type: St3, kind: "star" },
    { label: "St1", type: St1, kind: "star" },
];

let currentSeedIdx = 3; // St5
let currentIsHeads = true;
let gen = 3;

// ── Generate tiling ───────────────────────────────────────────────

function generate() {
    const seeds = computeRealSeeds();
    wheels = makeWheels(seeds.pSeed, seeds.sSeed, seeds.tSeed, seeds.dSeed);
    rhombShapes.clear();

    allRhombs = [];
    rhombId = 0;

    const seed = seedTypes[currentSeedIdx];
    const angle = ang(0, false);

    // Initial center index: 4 for star center, 4 for penta center
    const initialCI = 4;

    if (seed.kind === "penta") {
        expandPenta(seed.type, angle, currentIsHeads, p(0, 0), gen, initialCI);
    } else {
        expandStar(seed.type, angle, currentIsHeads, p(0, 0), gen, initialCI);
    }

    // Grid spacing = edge length at gen 1 = magnitude of tWheel[1].w[0]
    const tw0 = wheels.t[1].w[0];
    gridSpacing = Math.sqrt(tw0.x * tw0.x + tw0.y * tw0.y);

    buildRegistries();
    assignIndicesFromPentagrid();

    console.log(
        `Generated ${allRhombs.length} rhombs, ${vertexList.length} vertices`,
    );
}

// ── Rendering ─────────────────────────────────────────────────────

// Index colors: cycle through palette for indices outside 0-4
const INDEX_PALETTE = [
    "#888",
    "#4a9eda",
    "#2ecc71",
    "#f39c12",
    "#e74c3c",
    "#9b59b6",
    "#1abc9c",
    "#e67e22",
];
function indexColor(idx: number): string {
    if (idx < 0) return "#333";
    return INDEX_PALETTE[idx % INDEX_PALETTE.length] || "#333";
}

function hexToRGB(h: string): [number, number, number] {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(start: string, end: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    const [r1, g1, b1] = hexToRGB(start);
    const [r2, g2, b2] = hexToRGB(end);
    return `rgb(${r1 * (1 - a) + r2 * a},${g1 * (1 - a) + g2 * a},${b1 * (1 - a) + b2 * a})`;
}

function makeGradient(
    ctx: CanvasRenderingContext2D,
    fill: string,
    s0: { x: number; y: number },
    s2: { x: number; y: number },
    isHeads: boolean,
): CanvasGradient {
    const grad = ctx.createLinearGradient(s0.x, s0.y, s2.x, s2.y);
    if (isHeads) {
        grad.addColorStop(0, "#fff");
        grad.addColorStop(2 / 3, fill);
        grad.addColorStop(1, lerpColor(fill, "#000", 1 / 3));
    } else {
        grad.addColorStop(0, lerpColor(fill, "#000", 1 / 3));
        grad.addColorStop(1 / 3, fill);
        grad.addColorStop(1, "#fff");
    }
    return grad;
}

const tilingCanvas = document.getElementById("tiling") as HTMLCanvasElement;
const tilingCtx = tilingCanvas.getContext("2d")!;
const netCanvas = document.getElementById("net") as HTMLCanvasElement;
const netCtx = netCanvas.getContext("2d")!;
const infoSpan = document.getElementById("info")!;

let hoveredRhomb = -1;
const placedRhombs = new Set<number>();

// Auto-fit view
let viewScale = 1;
let viewOffX = 0;
let viewOffY = 0;

function fitView() {
    if (allRhombs.length === 0) return;
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const r of allRhombs) {
        for (const v of r.verts) {
            if (v.x < minX) minX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.x > maxX) maxX = v.x;
            if (v.y > maxY) maxY = v.y;
        }
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const pad = 10;
    viewScale = Math.min(
        (tilingCanvas.width - pad * 2) / w,
        (tilingCanvas.height - pad * 2) / h,
    );
    viewOffX = tilingCanvas.width / 2 - ((minX + maxX) / 2) * viewScale;
    viewOffY = tilingCanvas.height / 2 + ((minY + maxY) / 2) * viewScale;
}

function toScreen(pt: Pt): { x: number; y: number } {
    return { x: viewOffX + pt.x * viewScale, y: viewOffY - pt.y * viewScale };
}

function fromScreen(sx: number, sy: number): Pt {
    return p((sx - viewOffX) / viewScale, -(sy - viewOffY) / viewScale);
}

function drawTiling() {
    const ctx = tilingCtx;
    const W = tilingCanvas.width;
    const H = tilingCanvas.height;
    ctx.clearRect(0, 0, W, H);

    for (const r of allRhombs) {
        const sv = r.verts.map((v) => toScreen(v));
        ctx.beginPath();
        ctx.moveTo(sv[0].x, sv[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(sv[i].x, sv[i].y);
        ctx.closePath();

        if (placedRhombs.has(r.id)) {
            ctx.fillStyle = "rgba(255, 200, 0, 0.5)";
        } else if (r.id === hoveredRhomb) {
            ctx.fillStyle = makeGradient(ctx, r.fill, sv[0], sv[2], r.isHeads);
            ctx.globalAlpha = 0.9;
        } else {
            ctx.fillStyle = makeGradient(ctx, r.fill, sv[0], sv[2], r.isHeads);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    // Vertex dots
    for (const v of vertexList) {
        if (v.index === -999) continue; // skip unassigned
        const sv = toScreen(v.pos);
        ctx.fillStyle = indexColor(v.index);
        ctx.beginPath();
        ctx.arc(sv.x, sv.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// ── Hit testing ───────────────────────────────────────────────────

function pointInQuad(mp: Pt, verts: [Pt, Pt, Pt, Pt]): boolean {
    let pos = 0,
        neg = 0;
    for (let i = 0; i < 4; i++) {
        const a = verts[i],
            b = verts[(i + 1) % 4];
        const cross = (b.x - a.x) * (mp.y - a.y) - (b.y - a.y) * (mp.x - a.x);
        if (cross > 0) pos++;
        if (cross < 0) neg++;
    }
    return pos === 0 || neg === 0;
}

function findRhombAt(sx: number, sy: number): number {
    const mp = fromScreen(sx, sy);
    for (const r of allRhombs) {
        if (pointInQuad(mp, r.verts)) return r.id;
    }
    return -1;
}

// ── Net canvas ────────────────────────────────────────────────────

interface NetRhomb {
    sourceId: number;
    flatVerts: [Pt, Pt, Pt, Pt];
}

const netRhombs: NetRhomb[] = [];
const DPI = 96;

function drawNet() {
    const ctx = netCtx;
    ctx.clearRect(0, 0, netCanvas.width, netCanvas.height);

    // Page boundary
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(0, 0, 8.5 * DPI, 10 * DPI);
    ctx.setLineDash([]);

    for (const nr of netRhombs) {
        const sv = nr.flatVerts.map((v) => p(v.x * DPI, v.y * DPI));
        ctx.beginPath();
        ctx.moveTo(sv[0].x, sv[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(sv[i].x, sv[i].y);
        ctx.closePath();

        const src = allRhombs[nr.sourceId];
        ctx.fillStyle = makeGradient(
            ctx,
            src.fill,
            { x: sv[0].x, y: sv[0].y },
            { x: sv[2].x, y: sv[2].y },
            src.isHeads,
        );
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Vertex index labels (use per-rhomb vertIndices for accuracy)
        for (let i = 0; i < 4; i++) {
            const idx = src.vertIndices[i];
            ctx.fillStyle = indexColor(idx);
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(idx), sv[i].x, sv[i].y - 4);
        }
    }
}

function placeRhomb(rid: number) {
    if (placedRhombs.has(rid)) return;
    const col = netRhombs.length % 4;
    const row = Math.floor(netRhombs.length / 4);
    const cx = 1.5 + col * 2.2;
    const cy = 1.5 + row * 2.2;

    const halfShort = Math.sqrt(3 - PHI) / 2;
    const halfLong = Math.sqrt(2 + PHI) / 2;
    const flatVerts: [Pt, Pt, Pt, Pt] = [
        p(cx, cy - halfLong),
        p(cx + halfShort, cy),
        p(cx, cy + halfLong),
        p(cx - halfShort, cy),
    ];
    netRhombs.push({ sourceId: rid, flatVerts });
    placedRhombs.add(rid);
}

// ── Events ────────────────────────────────────────────────────────

tilingCanvas.addEventListener("mousemove", (e) => {
    const rect = tilingCanvas.getBoundingClientRect();
    const rid = findRhombAt(e.clientX - rect.left, e.clientY - rect.top);
    if (rid !== hoveredRhomb) {
        hoveredRhomb = rid;
        drawTiling();
        if (rid >= 0) {
            const r = allRhombs[rid];
            infoSpan.textContent = `Rhomb ${rid} (${r.thick ? "thick" : "thin"}) idx=[${r.vertIndices}] isHeads=${r.isHeads}`;
        } else {
            infoSpan.textContent = "Click a rhomb to place on net";
        }
    }
});

tilingCanvas.addEventListener("click", (e) => {
    const rect = tilingCanvas.getBoundingClientRect();
    const rid = findRhombAt(e.clientX - rect.left, e.clientY - rect.top);
    if (rid >= 0) {
        placeRhomb(rid);
        drawTiling();
        drawNet();
    }
});

document.getElementById("btn-clear")!.addEventListener("click", () => {
    netRhombs.length = 0;
    placedRhombs.clear();
    drawTiling();
    drawNet();
});

// ── Control panel ─────────────────────────────────────────────────

function buildControls() {
    const controls = document.getElementById("controls")!;

    // Type selector
    const typeSelect = document.createElement("select");
    typeSelect.style.cssText = "padding:4px;font-size:13px;";
    for (let i = 0; i < seedTypes.length; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = seedTypes[i].label;
        if (i === currentSeedIdx) opt.selected = true;
        typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener("change", () => {
        currentSeedIdx = parseInt(typeSelect.value);
        regenerate();
    });

    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Type: ";
    typeLabel.style.fontSize = "13px";
    typeLabel.appendChild(typeSelect);
    controls.insertBefore(typeLabel, controls.firstChild);

    // Gen selector
    const genSelect = document.createElement("select");
    genSelect.style.cssText = "padding:4px;font-size:13px;";
    for (let g = 0; g <= 3; g++) {
        const opt = document.createElement("option");
        opt.value = String(g);
        opt.textContent = `Gen ${g}`;
        if (g === gen) opt.selected = true;
        genSelect.appendChild(opt);
    }
    genSelect.addEventListener("change", () => {
        gen = parseInt(genSelect.value);
        regenerate();
    });

    const genLabel = document.createElement("label");
    genLabel.textContent = "Gen: ";
    genLabel.style.fontSize = "13px";
    genLabel.appendChild(genSelect);
    controls.insertBefore(genLabel, typeLabel.nextSibling);

    // isHeads toggle
    const headsBtn = document.createElement("button");
    headsBtn.textContent = currentIsHeads ? "Heads" : "Tails";
    headsBtn.addEventListener("click", () => {
        currentIsHeads = !currentIsHeads;
        headsBtn.textContent = currentIsHeads ? "Heads" : "Tails";
        regenerate();
    });
    controls.insertBefore(headsBtn, genLabel.nextSibling);
}

function regenerate() {
    netRhombs.length = 0;
    placedRhombs.clear();
    generate();
    fitView();
    drawTiling();
    drawNet();
}

// ── Init ──────────────────────────────────────────────────────────

buildControls();
generate();
fitView();
drawTiling();
drawNet();
