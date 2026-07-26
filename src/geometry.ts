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

// ── The five icosahedral generators ───────────────────────────────

// Every E_j shares z = 1/√5, so a vertex's height is (Σ n_j) · s/√5 and the
// de Bruijn index is simply Σ n_j. Because the z components are all equal,
// heights and dihedral angles are invariant under relabelling of j.
type V3 = [number, number, number];

const E5: V3[] = [];
for (let j = 0; j < 5; j++) {
    const t = (2 * Math.PI * j) / 5;
    E5.push([(2 / SQRT5) * Math.cos(t), (2 / SQRT5) * Math.sin(t), 1 / SQRT5]);
}

function pos3D(n: number[]): V3 {
    const acc: V3 = [0, 0, 0];
    for (let j = 0; j < 5; j++) {
        acc[0] += n[j] * E5[j][0];
        acc[1] += n[j] * E5[j][1];
        acc[2] += n[j] * E5[j][2];
    }
    return acc;
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

// ── The lift: n ∈ Z⁵ per vertex ────────────────────────────────────

// Match every planar edge to one of five DIRECTED generator directions.
//
// Two traps here. As *undirected* lines the five edge directions sit 36° apart,
// not 72°. And normalising representatives to one half-plane makes two of the
// five the negatives of the true ζ^j, which silently negates two components of
// n. Both are avoided by building the generators as a 72°-spaced directed fan
// from a single representative and resolving ± per edge. Which representative
// seeds the fan only relabels j, which is harmless (see E5 above).
function classifyDirections(): { L: number; dirs: number[] } {
    let L = 0;
    for (const e of edgeMap.values()) {
        const a = vertexList[e.v1].pos;
        const b = vertexList[e.v2].pos;
        L += Math.hypot(b.x - a.x, b.y - a.y);
    }
    L /= edgeMap.size;

    let theta0 = Infinity;
    for (const e of edgeMap.values()) {
        const a = vertexList[e.v1].pos;
        const b = vertexList[e.v2].pos;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (dy < 0 || (dy === 0 && dx < 0)) {
            dx = -dx;
            dy = -dy;
        }
        theta0 = Math.min(theta0, Math.atan2(dy, dx));
    }

    const dirs: number[] = [];
    for (let j = 0; j < 5; j++) dirs.push(theta0 + (2 * Math.PI * j) / 5);
    return { L, dirs };
}

function edgeDir(
    a: Pt,
    b: Pt,
    dirs: number[],
): { j: number; s: number } | null {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy);
    for (let j = 0; j < 5; j++) {
        const d = (dx * Math.cos(dirs[j]) + dy * Math.sin(dirs[j])) / l;
        if (Math.abs(d - 1) < 1e-4) return { j, s: +1 };
        if (Math.abs(d + 1) < 1e-4) return { j, s: -1 };
    }
    return null;
}

interface Lift {
    n: (number[] | null)[];
    dirs: number[];
    L: number;
    conflicts: number;
    unreached: number;
    unmatched: number;
    maxPosErr: number;
}

// Integrate n along edges by BFS. Exact at every generation — unlike the old
// pentagrid formula, which could only ever be right at one scale because the
// pentagrid and the tiling are dual spaces, not the same plane.
function computeLift(): Lift {
    const { L, dirs } = classifyDirections();

    const adj: number[][] = vertexList.map(() => []);
    for (const e of edgeMap.values()) {
        adj[e.v1].push(e.v2);
        adj[e.v2].push(e.v1);
    }

    const n: (number[] | null)[] = vertexList.map(() => null);
    let conflicts = 0;
    let unmatched = 0;

    for (let seed = 0; seed < vertexList.length; seed++) {
        if (n[seed] !== null) continue;
        n[seed] = [0, 0, 0, 0, 0];
        const q = [seed];
        for (let h = 0; h < q.length; h++) {
            const v = q[h];
            for (const w of adj[v]) {
                const d = edgeDir(vertexList[v].pos, vertexList[w].pos, dirs);
                if (!d) {
                    unmatched++;
                    continue;
                }
                const cand = n[v]!.slice();
                cand[d.j] += d.s;
                if (n[w] === null) {
                    n[w] = cand;
                    q.push(w);
                } else if (n[w]!.some((x, i) => x !== cand[i])) {
                    conflicts++;
                }
            }
        }
    }

    // Consistency: does Σ n_j u_j reproduce the planar position? This is a weak
    // check — it holds even under the sign traps above — so it is reported
    // alongside the index range rather than relied on alone.
    let maxPosErr = 0;
    const origin = vertexList[0]?.pos;
    if (origin) {
        for (let v = 0; v < vertexList.length; v++) {
            const nv = n[v];
            if (!nv) continue;
            let x = 0;
            let y = 0;
            for (let j = 0; j < 5; j++) {
                x += nv[j] * Math.cos(dirs[j]) * L;
                y += nv[j] * Math.sin(dirs[j]) * L;
            }
            maxPosErr = Math.max(
                maxPosErr,
                Math.hypot(
                    x - (vertexList[v].pos.x - origin.x),
                    y - (vertexList[v].pos.y - origin.y),
                ) / L,
            );
        }
    }

    return {
        n,
        dirs,
        L,
        conflicts,
        unreached: n.filter((x) => x === null).length,
        unmatched,
        maxPosErr,
    };
}

let lastLift: Lift | null = null;

function assignIndices(): void {
    if (vertexList.length === 0) {
        lastLift = null;
        return;
    }
    const lift = computeLift();
    lastLift = lift;

    // index = Σ n_j, shifted so the lowest level is 1 (de Bruijn's convention)
    let lo = Infinity;
    for (const nv of lift.n) {
        if (nv) lo = Math.min(lo, nv.reduce((a, b) => a + b, 0));
    }
    for (let v = 0; v < vertexList.length; v++) {
        const nv = lift.n[v];
        vertexList[v].index = nv
            ? nv.reduce((a, b) => a + b, 0) - lo + 1
            : -999;
    }

    for (const r of allRhombs) {
        for (let i = 0; i < 4; i++) {
            const v = vertexMap.get(roundKey(r.verts[i]));
            if (v) r.vertIndices[i] = v.index;
        }
    }

    let badEdges = 0;
    for (const e of edgeMap.values()) {
        const diff = Math.abs(vertexList[e.v1].index - vertexList[e.v2].index);
        if (diff !== 1) badEdges++;
    }
    const hist: Record<number, number> = {};
    for (const v of vertexList) hist[v.index] = (hist[v.index] || 0) + 1;

    console.log(
        `assignIndices: ${vertexList.length} vertices, ${badEdges} bad edges ` +
            `(|diff|≠1), conflicts=${lift.conflicts}, unmatched=${lift.unmatched}, ` +
            `posErr=${lift.maxPosErr.toExponential(1)}`,
    );
    console.log("Index histogram:", hist);
}

function getLift(): Lift | null {
    return lastLift;
}

// ── Seed types ────────────────────────────────────────────────────

type SeedType = "Pe5" | "Pe3" | "Pe1" | "St5" | "St3" | "St1";

const seedTypes: { label: string; type: TileType; kind: "penta" | "star" }[] = [
    { label: "Pe5", type: Pe5, kind: "penta" },
    { label: "Pe3", type: Pe3, kind: "penta" },
    { label: "Pe1", type: Pe1, kind: "penta" },
    { label: "St5", type: St5, kind: "star" },
    { label: "St3", type: St3, kind: "star" },
    { label: "St1", type: St1, kind: "star" },
];

// ── Generate a patch ──────────────────────────────────────────────

function generatePatch(seedIdx: number, isHeads: boolean, gen: number): void {
    const seeds = computeRealSeeds();
    wheels = makeWheels(seeds.pSeed, seeds.sSeed, seeds.tSeed, seeds.dSeed);
    rhombShapes.clear();

    allRhombs = [];
    rhombId = 0;

    const seed = seedTypes[seedIdx];
    const angle = ang(0, false);
    const initialCI = 4;

    if (seed.kind === "penta") {
        expandPenta(seed.type, angle, isHeads, p(0, 0), gen, initialCI);
    } else {
        expandStar(seed.type, angle, isHeads, p(0, 0), gen, initialCI);
    }

    buildRegistries();
    assignIndices();
}

// ── Exports ───────────────────────────────────────────────────────

export {
    SQRT5,
    PHI,
    GOLDEN_SIDE,
    Pt,
    p,
    Angle,
    ang,
    allRhombs,
    vertexList,
    vertexMap,
    edgeMap,
    roundKey,
    edgeKey,
    seedTypes,
    generatePatch,
    E5,
    pos3D,
    computeLift,
    getLift,
};
export type { Rhomb, Vertex, Edge, TileType, SeedType, Lift, V3 };
