// Wieringa Roof — legacy two-canvas explorer (rendering + UI).
// Tiling generation lives in geometry.ts.

import {
    edgeMap,
    vertexMap,
    roundKey,
    Pt,
    p,
    allRhombs,
    vertexList,
    seedTypes,
    generatePatch,
} from "./geometry.js";
import type { Rhomb, Vertex } from "./geometry.js";
import {
    analysePatch,
    placeSeed,
    placeAcross,
    convexOverlap,
    shrink,
    ekey,
    unfoldPatch,
    ribbonGrowPatch,
} from "./unfold.js";
import { cutTreeUnfold, assignLayers } from "./cuttree.js";
import type { Analysis, Placed, TraceEvent } from "./unfold.js";
import { parseLength, layoutSheets, renderSheet, PAGES } from "./sheet.js";
import { BUILD_ID } from "./build-id.js";

// ── UI State ──────────────────────────────────────────────────────

let currentSeedIdx = 1; // Pe3, the boat — 23 rhombi at gen 2, a sane place to land
const currentIsHeads = true;
let gen = 2;

// One control for height, matching the 3D page. Sign is the flip — real geometry,
// the dual roof, every hill a dale. Magnitude is how strongly height is shaded,
// 0 leaving the tiles flat colour. Biased so the middle of the travel is spread
// out, which is where small differences are worth seeing.
//
// This replaces two buttons that did one job badly: Hills up/Dales up flipped the
// lift while Heads/Tails flipped only the gradient direction, and since shading
// depicts height they cannot be independent.
let heightU = 1; // slider position, −1 … +1
let shadeDepth = 1; // |biased(heightU)|

function biasedHeight(u: number): number {
    return Math.sign(u) * Math.pow(Math.abs(u), 1.6);
}

// Face colouring in the tiling view. "Coloured by type or by vertex index" was in
// the original spec and never got built.
type TileColour = "cluster" | "type" | "index";
let tileColour: TileColour = "cluster";

function faceIndexLow(r: Rhomb): number {
    return Math.min(...r.vertIndices);
}

// Height flip — the dual roof, hills for dales. The tiling fixes the surface only
// up to a reflection in the horizontal plane, so every vertex height can be read
// either way round. Mirroring the index about the patch's observed range is the
// same thing as negating z and renormalising the lowest level back to 1, which is
// why it is a mirror rather than a negation.
let flipHeight = false;
let idxLo = 1;
let idxHi = 4;

function displayIndex(i: number): number {
    if (i === -999) return i;
    return flipHeight ? idxLo + idxHi - i : i;
}

function generate() {
    generatePatch(currentSeedIdx, currentIsHeads, gen);
    idxLo = Infinity;
    idxHi = -Infinity;
    for (const v of vertexList) {
        if (v.index === -999) continue;
        if (v.index < idxLo) idxLo = v.index;
        if (v.index > idxHi) idxHi = v.index;
    }
    if (!Number.isFinite(idxLo)) {
        idxLo = 1;
        idxHi = 4;
    }
    analysis = allRhombs.length ? analysePatch(flipHeight) : null;

    // Reports what the shading path actually computes, so a flat-looking tile can
    // be traced without guessing. Two wrong diagnoses have already been paid for.
    if (allRhombs.length) {
        let distinct = 0;
        const pairs = new Map<string, number>();
        for (const r of allRhombs) {
            const a = displayIndex(r.vertIndices[0]);
            const c = displayIndex(r.vertIndices[2]);
            pairs.set(`${a}->${c}`, (pairs.get(`${a}->${c}`) ?? 0) + 1);
            if (shadeOf(r.fill, a) !== shadeOf(r.fill, c)) distinct++;
        }
        console.log(
            `shading: color=${tileColour} depth=${shadeDepth.toFixed(2)} ` +
                `range ${idxLo}..${idxHi} · ${distinct}/${allRhombs.length} tiles ` +
                `get two different stops · spans ${JSON.stringify(Object.fromEntries(pairs))}`,
        );
        let netFlat = 0;
        for (const nr of netRhombs) {
            const q = nr.verts.map((v) => displayIndex(vertexList[v].index));
            const [a, b] = extremeCorners(q);
            if (shadeOf("#9292e3", q[a]) === shadeOf("#9292e3", q[b])) netFlat++;
        }
        console.log(
            `  net canvas: ${netRhombs.length} placed, ${netFlat} with equal stops`,
        );
    }
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

// Emit integer hex rather than rgb() with fractional components. Canvas parses
// colour strings through CSS, and a value like rgb(205.95,205.95,242.39999999999998)
// is at the mercy of that parser; a stop it rejects throws out of addColorStop and
// takes the whole draw with it. Hex has no such ambiguity, and the values were
// never meaningfully fractional anyway.
function lerpColor(start: string, end: string, alpha: number): string {
    const a = Math.max(0, Math.min(1, alpha));
    const [r1, g1, b1] = hexToRGB(toHex(start));
    const [r2, g2, b2] = hexToRGB(toHex(end));
    const ch = (x: number, y: number) =>
        Math.max(0, Math.min(255, Math.round(x * (1 - a) + y * a)))
            .toString(16)
            .padStart(2, "0");
    return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

// Shading is a depiction of HEIGHT, and height has four absolute levels across a
// patch. The old version ran white → fill → dark along each face's own diagonal,
// which meant a rhomb spanning levels 1→3 was drawn exactly like one spanning
// 2→4: the shading carried no height information at all, only which way the face
// tilted.
//
// Now the ramp is absolute. shadeOf maps a level to a colour once, for the whole
// patch, and a face simply draws the segment of that ramp between its own two
// extreme corners. Height varies affinely along the v0→v2 diagonal, so two stops
// are exact — the old third stop at 2/3 was what encoded the wrong thing.
//
// Colour and shading stay separate: colour is the constant tile property, shading
// is the height layer over it.
// Which corners are the height extremes. NOT positions 0 and 2 in general: the
// generator emits them that way, but placeAcross re-orders each rhomb to start at
// the edge it arrived across, so on the net canvas the extremes land wherever they
// land — and assuming 0/2 there gave two identical stops, hence a flat fill, on
// slightly over half the tiles. In a rhombus the extremes are always opposite, so
// argmin and argmax are enough.
function extremeCorners(idx: number[]): [number, number] {
    let lo = 0;
    let hi = 0;
    for (let i = 1; i < 4; i++) {
        if (idx[i] < idx[lo]) lo = i;
        if (idx[i] > idx[hi]) hi = i;
    }
    return [lo, hi];
}

function shadeOf(fill: string, index: number): string {
    const span = idxHi - idxLo || 1;
    const t = Math.max(0, Math.min(1, (index - idxLo) / span));
    // shadeDepth 0 leaves the tile flat; 1 is the full light-to-dark range
    const lo = lerpColor(fill, "#ffffff", 0.55 * shadeDepth);
    const hi = lerpColor(fill, "#000000", 0.42 * shadeDepth);
    return lerpColor(lo, hi, t);
}

function makeGradient(
    ctx: CanvasRenderingContext2D,
    fill: string,
    pLow: { x: number; y: number },
    pHigh: { x: number; y: number },
    iLow: number,
    iHigh: number,
): CanvasGradient {
    const grad = ctx.createLinearGradient(pLow.x, pLow.y, pHigh.x, pHigh.y);
    grad.addColorStop(0, shadeOf(fill, iLow));
    grad.addColorStop(1, shadeOf(fill, iHigh));
    return grad;
}

// lerpColor needs hex on both sides; shadeOf feeds it its own rgb() output, so
// accept that too.
function toHex(c: string): string {
    if (c.startsWith("#")) return c;
    const m = c.match(/rgb\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/);
    if (!m) return "#888888";
    const h = (v: string) =>
        Math.max(0, Math.min(255, Math.round(Number(v))))
            .toString(16)
            .padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
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

        const vi = r.vertIndices.map(displayIndex);
        const [cLo, cHi] = extremeCorners(vi);
        const faceFill = (): string | CanvasGradient => {
            if (tileColour === "type") return r.thick ? "#9292e3" : "#eec09b";
            if (tileColour === "index") return indexColor(vi[cLo]);
            return makeGradient(
                ctx,
                r.fill,
                sv[cLo],
                sv[cHi],
                vi[cLo],
                vi[cHi],
            );
        };
        const role = mode === "watch" ? traceRoles.get(r.id) : undefined;
        const hint = mode === "watch" ? undefined : moveHints.get(r.id);
        if (role) {
            ctx.fillStyle = faceFill();
            ctx.fill();
            ctx.fillStyle =
                role === "current"
                    ? "rgba(106, 90, 205, 0.55)"
                    : role === "rejected"
                      ? "rgba(192, 57, 43, 0.35)"
                      : "rgba(255, 200, 0, 0.45)";
            ctx.fill();
            ctx.strokeStyle =
                role === "current"
                    ? "#6a5acd"
                    : role === "rejected"
                      ? "#c0392b"
                      : "#c9a227";
            ctx.lineWidth = role === "current" ? 3 : 1.2;
            ctx.stroke();
            continue;
        }
        // Placed tiles used to be painted solid yellow *instead of* their fill,
        // which threw away their shading — on a five-rhomb patch with four placed
        // you saw four flat tiles and one shaded. Paint the fill first and wash the
        // marker over it, exactly as the watch-mode roles above do.
        ctx.fillStyle = faceFill();
        if (r.id === hoveredRhomb) ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (placedRhombs.has(r.id)) {
            ctx.fillStyle = altDown
                ? "rgba(192, 57, 43, 0.45)"
                : "rgba(255, 200, 0, 0.45)";
            ctx.fill();
        }

        // move preview: green = a route exists that does not overlap,
        // red = every route from here collides with the net as it stands
        if (hint) {
            ctx.fillStyle =
                hint === "clean"
                    ? "rgba(46, 160, 67, 0.30)"
                    : "rgba(192, 57, 43, 0.30)";
            ctx.fill();
            ctx.strokeStyle = hint === "clean" ? "#2ea043" : "#c0392b";
            ctx.lineWidth = r.id === hoveredRhomb ? 2.5 : 1.5;
            ctx.stroke();
        } else {
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        if (showIsogloss) {
            ctx.strokeStyle = r.thick
                ? "rgba(30,32,38,0.55)"
                : "rgba(30,32,38,0.38)";
            ctx.lineWidth = r.thick ? 1 : 0.7;
            for (const [a, b] of isoglossSegments(
                sv.map((q) => [q.x, q.y] as [number, number]),
                r.vertIndices,
            )) {
                ctx.beginPath();
                ctx.moveTo(a[0], a[1]);
                ctx.lineTo(b[0], b[1]);
                ctx.stroke();
            }
        }

        // brushed twin: this rhomb is the one under the pointer on the net canvas.
        // The path has to be rebuilt — the isogloss loop above calls beginPath per
        // segment, so by here the current path is a contour line, not the tile.
        if (r.id === hoveredNetId) {
            ctx.beginPath();
            ctx.moveTo(sv[0].x, sv[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(sv[i].x, sv[i].y);
            ctx.closePath();
            ctx.strokeStyle = "#6a5acd";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    // Vertex dots
    if (mirror.onTiling) {
        const q = toScreen(mirror.onTiling);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(106, 90, 205, 0.85)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    for (const v of vertexList) {
        if (v.index === -999) continue; // skip unassigned
        const sv = toScreen(v.pos);
        ctx.fillStyle = indexColor(displayIndex(v.index));
        ctx.beginPath();
        ctx.arc(sv.x, sv.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// ── Isoglosses ────────────────────────────────────────────────────
//
// Contour lines: seven per rhombus dividing its long diagonal into eight, which
// puts them on quarter-index height steps. Index runs i, i+1, i+2, i+1 around the
// cycle, so the long diagonal is the height gradient, and a rhombus has
// perpendicular diagonals — so a line across it perpendicular to that axis is a
// level set of height. Heights agree along shared edges, so they run on unbroken
// from tile to tile. Same construction as the 3D page, in two dimensions.
//
// Flipping does not change them: reversing heights reverses which end is low, and
// seven lines dividing a diagonal into eight are the same seven either way.
type Seg = [[number, number], [number, number]];

function isoglossSegments(
    pts: Array<[number, number]>,
    idx: number[],
): Seg[] {
    let k = 0;
    for (let i = 1; i < 4; i++) if (idx[i] < idx[k]) k = i;
    const lo = pts[k];
    const r1 = pts[(k + 1) % 4];
    const hi = pts[(k + 2) % 4];
    const r3 = pts[(k + 3) % 4];
    const mix = (
        a: [number, number],
        b: [number, number],
        s: number,
    ): [number, number] => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];

    const out: Seg[] = [];
    for (let i = 1; i <= 7; i++) {
        const t = i / 8;
        if (t <= 0.5) {
            const s = t * 2;
            out.push([mix(lo, r3, s), mix(lo, r1, s)]);
        } else {
            const s = (t - 0.5) * 2;
            out.push([mix(r3, hi, s), mix(r1, hi, s)]);
        }
    }
    return out;
}

let showIsogloss = false;

// Ease a range input from one value to another, calling back each frame. Used to
// snap the height sliders to their meaningful settings on release rather than
// letting them stop at an arbitrary 0.34.
let sliderAnim = 0;
function animateSlider(
    input: HTMLInputElement,
    from: number,
    to: number,
    onFrame: () => void,
    ms = 260,
): void {
    cancelAnimationFrame(sliderAnim);
    if (Math.abs(from - to) < 1e-3) {
        input.value = String(to);
        onFrame();
        return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3); // ease out
        input.value = String(from + (to - from) * e);
        onFrame();
        if (k < 1) sliderAnim = requestAnimationFrame(step);
    };
    sliderAnim = requestAnimationFrame(step);
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

// Nearest interior tiling edge within a few pixels of the pointer. Clicking an
// edge names the hinge to unfold across, which is the only way to choose when a
// rhomb touches the net along more than one edge.
// In screen pixels; scaled to canvas pixels at use, since the backing store is
// devicePixelRatio times larger and an unscaled threshold would be that much
// stingier on a retina display.
const EDGE_PICK_PX = 7;

function findEdgeAt(
    sx: number,
    sy: number,
): { a: number; b: number; rhombIds: number[] } | null {
    let best: { a: number; b: number; rhombIds: number[] } | null = null;
    const cssW = tilingCanvas.getBoundingClientRect().width || tilingCanvas.width;
    let bestD = EDGE_PICK_PX * (tilingCanvas.width / cssW);
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue;
        const A = toScreen(vertexList[e.v1].pos);
        const B = toScreen(vertexList[e.v2].pos);
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const L2 = dx * dx + dy * dy;
        if (L2 === 0) continue;
        let t = ((sx - A.x) * dx + (sy - A.y) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(sx - (A.x + dx * t), sy - (A.y + dy * t));
        if (d < bestD) {
            bestD = d;
            best = { a: e.v1, b: e.v2, rhombIds: e.rhombIds.slice() };
        }
    }
    return best;
}

// ── Net canvas ────────────────────────────────────────────────────
//
// Hand-driven unfolding, which is what this page was always meant to be. Click a
// rhomb in the tiling and it is unfolded onto the work canvas across the edge it
// shares with whatever is already placed; click an *edge* to name that hinge
// yourself, which matters whenever a rhomb touches the net along more than one.
// Overlaps are allowed — you are the search — but they are called out.
//
// Placement uses the same placeSeed/placeAcross primitives as the automatic
// methods, so the geometry is identical: exact isometry via the 3D lift, not a
// 2D reflection.

interface NetRhomb {
    sourceId: number;
    poly: [number, number][]; // side units
    verts: number[]; // tiling vertex ids, matching poly order
    overlapping: boolean;
}

const netRhombs: NetRhomb[] = [];
const netHinges = new Set<string>();

// ── layers ────────────────────────────────────────────────────────
//
// Where the net wraps over itself it need not be cut: it can continue on the next
// sheet, which is the branch-cut picture taken literally. The layering lives in
// cuttree.ts; all this has to do is feed it the net as it currently stands.
//
// NetRhomb carries no parent pointer, but it does not need one — the net is built
// incrementally, so a rhomb's parent is the earliest already-placed neighbour it
// shares a hinge with. That reconstructs the tree the layering needs without
// changing the data model, and works the same whether the net was built by hand or
// replayed from an algorithm.
let netLayer = new Map<number, number>();
let netLayerCount = 1;
let activeLayer: number | null = null;
let layersDirty = true;
// During a replay the layering belongs to the *finished* net, not to whatever
// prefix is on screen: a partial net has different overlaps, so recomputing per
// step would make the layer count flicker as you scrub and would cost an O(n²)
// pass every frame. So the trace pins it once and the steps leave it alone.
let layersPinned = false;

function markNetChanged(): void {
    layersDirty = true;
    layersPinned = false;
}
// Facts about the last algorithm run, shown on the page. Diagnosing a layer
// problem from a screenshot needs the method, the overlap count and the layer
// count together — and nobody should have to open developer tools to get them.
let lastRun: {
    method: string;
    faces: number;
    overlaps: number | null;
    layers: number;
    cuts: number | null;
} | null = null;

let layerSelect: HTMLSelectElement | null = null;
let layerLabel: HTMLLabelElement | null = null;

function syncLayerBar(): void {
    if (!layerSelect || !layerLabel) return;
    if (netLayerCount <= 1) {
        layerLabel.style.display = "none";
        activeLayer = null;
        return;
    }
    layerLabel.style.display = "";
    const keep = layerSelect.value;
    layerSelect.innerHTML = "";
    const add = (v: string, t: string) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        layerSelect!.appendChild(o);
    };
    add("all", `All ${netLayerCount} layers`);
    for (let L = 0; L < netLayerCount; L++) add(String(L), `Layer ${L}`);
    layerSelect.value = Array.from(layerSelect.options).some(
        (o) => o.value === keep,
    )
        ? keep
        : "all";
    activeLayer = layerSelect.value === "all" ? null : Number(layerSelect.value);
}

function netAsPlaced(): Map<number, Placed> {
    const m = new Map<number, Placed>();
    for (const nr of netRhombs) {
        const src = allRhombs[nr.sourceId];
        m.set(nr.sourceId, {
            faceId: nr.sourceId,
            thick: src.thick,
            cluster: src.cluster,
            poly: nr.poly,
            verts: nr.verts,
            piece: 0,
        });
    }
    return m;
}

function netParents(): Map<number, number> {
    const parent = new Map<number, number>();
    for (let i = 1; i < netRhombs.length; i++) {
        const nr = netRhombs[i];
        for (let j = 0; j < i; j++) {
            const prev = netRhombs[j];
            const shared = nr.verts.filter((v) => prev.verts.includes(v));
            if (shared.length < 2) continue;
            if (!netHinges.has(ekey(shared[0], shared[1]))) continue;
            parent.set(nr.sourceId, prev.sourceId);
            break;
        }
    }
    return parent;
}

function recomputeLayers(): void {
    if (!netRhombs.length) {
        netLayer = new Map();
        netLayerCount = 1;
        activeLayer = null;
        return;
    }
    const r = assignLayers(netAsPlaced(), netParents());
    netLayer = r.layer;
    netLayerCount = r.count;
    if (activeLayer != null && activeLayer >= netLayerCount) activeLayer = null;
    syncLayerBar();
}

// Move preview. For every unplaced rhomb touching the net, try each hinge it
// could arrive on: "clean" if at least one lands without overlapping, "overlap"
// if every route collides. Showing this before the click is what turns the page
// from guessing into exploring — you can watch the red spread as you work round
// a saddle vertex, which is curvature appearing as a constraint on your choices.
type MoveClass = "clean" | "overlap";
const moveHints = new Map<number, MoveClass>();

// Brushing and linking — the coordinated-views convention. Hovering either canvas
// highlights the same rhomb in the other, and places a marker at the
// *corresponding point* inside it. The two rhombi are not congruent (72° against
// 63.43°), so there is no rigid mirror; instead the pointer is expressed in the
// hovered rhomb's edge coordinates (s,t) and the same (s,t) is applied in its
// twin. Exact, and it tracks corners and edges perfectly.
let hoveredNetId = -1;
let mirror: { onTiling: Pt | null; onNet: [number, number] | null } = {
    onTiling: null,
    onNet: null,
};

// Ghost previews — every placement a hovered rhomb could take, one per hinge it
// shares with the net, green where it lands clean and red where it collides.
interface Ghost {
    poly: [number, number][];
    clean: boolean;
    a: number;
    b: number;
}
let ghosts: Ghost[] = [];
let ghostFocus: { a: number; b: number } | null = null;

// Solve P = c0 + s·(c1−c0) + t·(c3−c0) for a parallelogram.
function edgeCoords(
    px: number,
    py: number,
    c0: [number, number],
    c1: [number, number],
    c3: [number, number],
): [number, number] {
    const ax = c1[0] - c0[0];
    const ay = c1[1] - c0[1];
    const bx = c3[0] - c0[0];
    const by = c3[1] - c0[1];
    const det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-12) return [0, 0];
    const rx = px - c0[0];
    const ry = py - c0[1];
    return [(rx * by - ry * bx) / det, (ax * ry - ay * rx) / det];
}

// Line up the two corner orderings by tiling vertex id, so (s,t) means the same
// thing in both: the net poly's order is whatever the unfolding produced.
function cornerPermutation(rid: number, netVerts: number[]): number[] | null {
    const r = allRhombs[rid];
    const tids = r.verts.map((v) => vertexMap.get(roundKey(v))?.id ?? -1);
    const perm = tids.map((id) => netVerts.indexOf(id));
    return perm.some((k) => k < 0) ? null : perm;
}

function tilingToNet(rid: number, mp: Pt): [number, number] | null {
    const nr = netRhombs.find((n) => n.sourceId === rid);
    if (!nr) return null;
    const perm = cornerPermutation(rid, nr.verts);
    if (!perm) return null;
    const r = allRhombs[rid];
    const [st0, st1] = edgeCoords(
        mp.x,
        mp.y,
        [r.verts[0].x, r.verts[0].y],
        [r.verts[1].x, r.verts[1].y],
        [r.verts[3].x, r.verts[3].y],
    );
    const n0 = nr.poly[perm[0]];
    const n1 = nr.poly[perm[1]];
    const n3 = nr.poly[perm[3]];
    return [
        n0[0] + st0 * (n1[0] - n0[0]) + st1 * (n3[0] - n0[0]),
        n0[1] + st0 * (n1[1] - n0[1]) + st1 * (n3[1] - n0[1]),
    ];
}

function netToTiling(nr: NetRhomb, x: number, y: number): Pt | null {
    const perm = cornerPermutation(nr.sourceId, nr.verts);
    if (!perm) return null;
    const r = allRhombs[nr.sourceId];
    const [st0, st1] = edgeCoords(
        x,
        y,
        nr.poly[perm[0]],
        nr.poly[perm[1]],
        nr.poly[perm[3]],
    );
    const t0 = r.verts[0];
    const t1 = r.verts[1];
    const t3 = r.verts[3];
    return p(
        t0.x + st0 * (t1.x - t0.x) + st1 * (t3.x - t0.x),
        t0.y + st0 * (t1.y - t0.y) + st1 * (t3.y - t0.y),
    );
}

// Alt is the modifier for removal. Not Ctrl: on macOS Ctrl-click is right-click,
// so it would fight the context menu. Alt/Option is the conventional destructive
// modifier and is free in both browsers.
let altDown = false;

// Hinges are what hold the net together, so removing an interior rhomb can leave
// two islands that only look like one net. Worth saying so rather than letting it
// pass silently.
function netIsConnected(): boolean {
    if (netRhombs.length < 2) return true;
    const adj = new Map<number, number[]>();
    for (const n of netRhombs) adj.set(n.sourceId, []);
    for (const k of netHinges) {
        const [a, b] = k.split("-").map(Number);
        const e = edgeMap.get(ekey(a, b));
        if (!e || e.rhombIds.length !== 2) continue;
        const [x, y] = e.rhombIds;
        if (!adj.has(x) || !adj.has(y)) continue;
        adj.get(x)!.push(y);
        adj.get(y)!.push(x);
    }
    const seen = new Set<number>([netRhombs[0].sourceId]);
    const q = [netRhombs[0].sourceId];
    for (let i = 0; i < q.length; i++) {
        for (const w of adj.get(q[i]) ?? []) {
            if (!seen.has(w)) {
                seen.add(w);
                q.push(w);
            }
        }
    }
    return seen.size === netRhombs.length;
}

function computeGhosts(rid: number): void {
    ghosts = [];
    if (!analysis || placedRhombs.has(rid) || netRhombs.length === 0) return;
    const { faces, P, links } = analysis;
    for (const l of links.get(rid) ?? []) {
        if (!placedRhombs.has(l.other)) continue;
        const host = netRhombs.find((n) => n.sourceId === l.other);
        if (!host) continue;
        const cand = placeAcross(faces[rid], P, l.a, l.b, asPlaced(host));
        if (!cand) continue;
        const poly = cand.poly as [number, number][];
        ghosts.push({
            poly,
            clean: !netOverlaps(poly, rid),
            a: l.a,
            b: l.b,
        });
    }
}

// Undo by snapshot rather than inverse operations: the state is small enough that
// copying it is free, and it cannot drift out of step with the real thing.
interface Snapshot {
    rhombs: NetRhomb[];
    hinges: string[];
}
const history: Snapshot[] = [];
const HISTORY_LIMIT = 300;

function snapshot(): Snapshot {
    return {
        rhombs: netRhombs.map((n) => ({
            sourceId: n.sourceId,
            poly: n.poly.map((q) => [q[0], q[1]] as [number, number]),
            verts: [...n.verts],
            overlapping: n.overlapping,
        })),
        hinges: [...netHinges],
    };
}

function pushHistory(): void {
    history.push(snapshot());
    if (history.length > HISTORY_LIMIT) history.shift();
}

function restore(s: Snapshot): void {
    netRhombs.length = 0;
    markNetChanged();
    netRhombs.push(...s.rhombs);
    markNetChanged();
    netHinges.clear();
    for (const h of s.hinges) netHinges.add(h);
    placedRhombs.clear();
    for (const n of netRhombs) placedRhombs.add(n.sourceId);
    recheckOverlaps();
    recomputeMoveHints();
    refreshNetView();
}

function undo(): string {
    const s = history.pop();
    if (!s) return "Nothing to undo.";
    restore(s);
    return `Undone. ${netRhombs.length} rhomb${netRhombs.length === 1 ? "" : "s"} on the net, ${history.length} step${history.length === 1 ? "" : "s"} back available.`;
}

function recomputeMoveHints(): void {
    moveHints.clear();
    if (!analysis || netRhombs.length === 0) return;
    const { faces, P, links } = analysis;
    for (const nr of netRhombs) {
        for (const l of links.get(nr.sourceId) ?? []) {
            if (placedRhombs.has(l.other)) continue;
            const cand = placeAcross(faces[l.other], P, l.a, l.b, asPlaced(nr));
            if (!cand) continue;
            const clean = !netOverlaps(cand.poly as [number, number][], l.other);
            if (clean) moveHints.set(l.other, "clean");
            else if (!moveHints.has(l.other)) moveHints.set(l.other, "overlap");
        }
    }
}
let analysis: Analysis | null = null;
const DPI = 96;

// Paper, in inches. The net is oriented and centred against the printable area;
// the sheet edge is drawn too, and a net is allowed to spill past both — that is
// the point, since a net a little too big is one you snip in two rather than one
// you cannot have.
// Rhombus side, in inches — the edge, not a diagonal. One inch: every
// generation-2 patch fits a Letter sheet at that size, and it folds comfortably.
// A sheet holds roughly twenty rhombi, so the orientation search alone cannot make
// a large net fit; the side is the real lever, and it is adjustable.
//
// It was √5/2 ≈ 1.118" originally, which makes each edge's rise s/√5 exactly half
// an inch — elegant for measuring heights, arbitrary for paper.
let sideIn = 1; // inches

const PAPER: [number, number] = [8.5, 11];
const MARGIN_IN = 0.5;
const PRINTABLE: [number, number] = [
    PAPER[0] - 2 * MARGIN_IN,
    PAPER[1] - 2 * MARGIN_IN,
];

// The view maps net space (side units) to canvas pixels: rotate, scale, offset.
interface NetView {
    angle: number; // radians applied to net space before scaling
    scale: number; // px per side unit
    ox: number;
    oy: number;
    fits: boolean;
    overIn: [number, number]; // inches past the printable area, per axis
    sizeIn: [number, number]; // the net's own footprint, oriented
}
let netView: NetView = {
    angle: 0,
    scale: DPI * sideIn,
    ox: 0,
    oy: 0,
    fits: true,
    overIn: [0, 0],
    sizeIn: [0, 0],
};

function rot2(q: [number, number], a: number): [number, number] {
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return [q[0] * c - q[1] * sn, q[0] * sn + q[1] * c];
}

const viewToPx = (q: [number, number]): Pt => {
    const r = rot2(q, netView.angle);
    return p(netView.ox + r[0] * netView.scale, netView.oy + r[1] * netView.scale);
};

const viewFromPx = (x: number, y: number): [number, number] => {
    const r: [number, number] = [
        (x - netView.ox) / netView.scale,
        (y - netView.oy) / netView.scale,
    ];
    return rot2(r, -netView.angle);
};

// Candidate orientations. The minimum-area enclosing rectangle has a side flush
// with a convex-hull edge, and the development only ever uses about nine edge
// directions (the golden rhombus angles together with the angular defects, since
// unfolding round a vertex rotates by its defect). So this is not an optimisation
// at all — enumerate the directions, add their perpendiculars, test each.
function candidateAngles(): number[] {
    const set = new Set<number>([0]);
    for (const nr of netRhombs) {
        for (let i = 0; i < 4; i++) {
            const a = nr.poly[i];
            const b = nr.poly[(i + 1) % 4];
            let t = Math.atan2(b[1] - a[1], b[0] - a[0]);
            t = ((t % Math.PI) + Math.PI) % Math.PI;
            set.add(Math.round(t * 1e6) / 1e6);
        }
    }
    const out: number[] = [];
    for (const t of set) {
        out.push(-t);
        out.push(-t + Math.PI / 2);
    }
    return out;
}

// The work canvas has no business being a fixed 850x1000. Size it from the space
// actually available, at the paper's aspect ratio, and give it a device-pixel
// backing store so the creases stay crisp. All the px maths reads netCanvas.width,
// and the pointer conversion scales by width/clientWidth, so this is DPR-safe.
function sizeTilingCanvas(): void {
    const workspace = tilingCanvas.closest(".workspace") as HTMLElement | null;
    const total = workspace?.clientWidth ?? 1120;
    const cssW = Math.max(300, Math.min(Math.round(total * 0.42), 560));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tilingCanvas.style.width = `${cssW}px`;
    tilingCanvas.style.height = `${cssW}px`;
    tilingCanvas.width = Math.round(cssW * dpr);
    tilingCanvas.height = Math.round(cssW * dpr);
}

function sizeNetCanvas(): void {
    const workspace = netCanvas.closest(".workspace") as HTMLElement | null;
    const avail = workspace
        ? workspace.clientWidth - tilingCanvas.offsetWidth - 24
        : 620;
    const cssW = Math.max(320, Math.min(avail, 780));
    const cssH = Math.round(cssW * (PAPER[1] / PAPER[0]));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    netCanvas.style.width = `${cssW}px`;
    netCanvas.style.height = `${cssH}px`;
    netCanvas.width = Math.round(cssW * dpr);
    netCanvas.height = Math.round(cssH * dpr);
}

function refreshNetView(): void {
    const pts: [number, number][] = [];
    for (const nr of netRhombs) for (const q of nr.poly) pts.push(q);

    const canvasW = netCanvas.width;
    const canvasH = netCanvas.height;
    const pad = 14;

    if (pts.length === 0) {
        const sc = Math.min(
            (canvasW - 2 * pad) / (PAPER[0] * DPI),
            (canvasH - 2 * pad) / (PAPER[1] * DPI),
        );
        netView = {
            angle: 0,
            scale: sc * DPI * sideIn,
            ox: canvasW / 2 - (sc * PAPER[0] * DPI) / 2,
            oy: canvasH / 2 - (sc * PAPER[1] * DPI) / 2,
            fits: true,
            overIn: [0, 0],
            sizeIn: [0, 0],
        };
        return;
    }

    // Score by the worst axis ratio, max(w/PW, h/PH): scale-invariant, ≤1 exactly
    // when it fits, and it picks the orientation that comes closest when it does
    // not. Summing the two overflows instead would trade a small excess on one
    // axis against a large one on the other. Ties go to the tighter box.
    let best = {
        angle: 0,
        w: Infinity,
        h: Infinity,
        over: Infinity,
        area: Infinity,
    };
    for (const a of candidateAngles()) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const q of pts) {
            const r = rot2(q, a);
            if (r[0] < x0) x0 = r[0];
            if (r[1] < y0) y0 = r[1];
            if (r[0] > x1) x1 = r[0];
            if (r[1] > y1) y1 = r[1];
        }
        const wIn = (x1 - x0) * sideIn;
        const hIn = (y1 - y0) * sideIn;
        const over = Math.max(wIn / PRINTABLE[0], hIn / PRINTABLE[1]);
        const area = wIn * hIn;
        if (
            over < best.over - 1e-9 ||
            (Math.abs(over - best.over) < 1e-9 && area < best.area)
        ) {
            best = { angle: a, w: wIn, h: hIn, over, area };
        }
    }

    // centre the oriented net on the sheet
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const q of pts) {
        const r = rot2(q, best.angle);
        if (r[0] < x0) x0 = r[0];
        if (r[1] < y0) y0 = r[1];
        if (r[0] > x1) x1 = r[0];
        if (r[1] > y1) y1 = r[1];
    }
    const netCx = ((x0 + x1) / 2) * sideIn;
    const netCy = ((y0 + y1) / 2) * sideIn;

    // fit sheet and net together into the canvas, so spill stays visible
    const halfW = Math.max(PAPER[0] / 2, best.w / 2);
    const halfH = Math.max(PAPER[1] / 2, best.h / 2);
    const sc = Math.min(
        (canvasW - 2 * pad) / (2 * halfW * DPI),
        (canvasH - 2 * pad) / (2 * halfH * DPI),
    );
    const pxPerIn = sc * DPI;

    netView = {
        angle: best.angle,
        scale: pxPerIn * sideIn,
        ox: canvasW / 2 - netCx * pxPerIn,
        oy: canvasH / 2 - netCy * pxPerIn,
        fits: best.over <= 1 + 1e-9,
        overIn: [
            Math.max(0, best.w - PRINTABLE[0]),
            Math.max(0, best.h - PRINTABLE[1]),
        ],
        sizeIn: [best.w, best.h],
    };
}

function asPlaced(nr: NetRhomb): Placed {
    const src = allRhombs[nr.sourceId];
    return {
        faceId: nr.sourceId,
        thick: src.thick,
        cluster: src.cluster,
        poly: nr.poly,
        verts: nr.verts,
        piece: 0,
    };
}

function netOverlaps(poly: [number, number][], skip: number): boolean {
    const test = shrink(poly, 0.94);
    for (const nr of netRhombs) {
        if (nr.sourceId === skip) continue;
        if (convexOverlap(test, shrink(nr.poly, 0.94))) return true;
    }
    return false;
}

function recheckOverlaps(): void {
    for (const nr of netRhombs) {
        nr.overlapping = netOverlaps(nr.poly, nr.sourceId);
    }
}

// Place `rid`, optionally across a named hinge edge. Returns a status message.
function placeRhomb(rid: number, viaEdge?: { a: number; b: number }): string {
    if (placedRhombs.has(rid)) return `Rhomb ${rid} is already on the net.`;
    pushHistory();
    if (!analysis) return "No patch.";
    const { faces, P, links } = analysis;
    const face = faces[rid];
    if (!face) return `Rhomb ${rid} not found.`;

    let poly: [number, number][];
    let verts: number[];
    let note = "";

    if (netRhombs.length === 0) {
        poly = placeSeed(face, P) as [number, number][];
        verts = face.v.slice();
        // no need to position it: refreshNetView centres whatever is there
        note = `Seeded with rhomb ${rid}.`;
    } else {
        // candidate hinges: edges to rhombs already placed
        const cands = (links.get(rid) ?? []).filter((l) =>
            placedRhombs.has(l.other),
        );
        if (cands.length === 0) {
            history.pop();
            return `Rhomb ${rid} does not touch the net — click one adjacent to it, or Clear to start over.`;
        }
        let chosen = cands[cands.length - 1];
        if (viaEdge) {
            const want = ekey(viaEdge.a, viaEdge.b);
            const match = cands.find((l) => ekey(l.a, l.b) === want);
            if (!match) {
                history.pop();
                return `That edge does not join rhomb ${rid} to the net.`;
            }
            chosen = match;
        } else {
            // default to the most recently placed neighbour
            for (let i = netRhombs.length - 1; i >= 0; i--) {
                const m = cands.find((l) => l.other === netRhombs[i].sourceId);
                if (m) {
                    chosen = m;
                    break;
                }
            }
        }
        const host = netRhombs.find((n) => n.sourceId === chosen.other)!;
        const cand = placeAcross(face, P, chosen.a, chosen.b, asPlaced(host));
        if (!cand) {
            history.pop();
            return `Could not unfold rhomb ${rid} across that edge.`;
        }
        poly = cand.poly as [number, number][];
        verts = cand.verts;
        netHinges.add(ekey(chosen.a, chosen.b));
        note =
            cands.length > 1 && !viaEdge
                ? `Placed ${rid} across its edge with ${chosen.other} — it touches the net on ${cands.length} edges, click an edge to choose.`
                : `Placed ${rid} across its edge with ${chosen.other}.`;
    }

    const overlapping = netOverlaps(poly, rid);
    netRhombs.push({ sourceId: rid, poly, verts, overlapping });
    markNetChanged();
    placedRhombs.add(rid);
    recheckOverlaps();
    recomputeMoveHints();
    refreshNetView();

    const nOver = netRhombs.filter((n) => n.overlapping).length;
    if (overlapping) {
        note += `  ⚠ overlaps — placed anyway (${nOver} overlapping in the net).`;
    }
    note += `  ${fitReport()}`;
    return note;
}

// A short account of how the net sits on the sheet, including the orientation the
// fit chose and how far it spills if it does.
function fitReport(): string {
    const [w, h] = netView.sizeIn;
    const deg = ((-netView.angle * 180) / Math.PI + 360) % 180;
    const size = `${w.toFixed(1)}×${h.toFixed(1)}"`;
    if (netView.fits) {
        return `Fits the printable area at ${deg.toFixed(1)}° (${size}).`;
    }
    const [ow, oh] = netView.overIn;
    return `${size} at ${deg.toFixed(1)}° — over by ${ow.toFixed(1)}" × ${oh.toFixed(1)}", snip along the frame.`;
}

function removeRhomb(rid: number): string {
    const i = netRhombs.findIndex((n) => n.sourceId === rid);
    if (i < 0) return "";
    pushHistory();
    netRhombs.splice(i, 1);
    markNetChanged();
    placedRhombs.delete(rid);
    // a hinge only survives while both its rhombs are placed
    for (const k of [...netHinges]) {
        const [a, b] = k.split("-").map(Number);
        const e = edgeMap.get(ekey(a, b));
        if (!e || e.rhombIds.some((id: number) => !placedRhombs.has(id))) {
            netHinges.delete(k);
        }
    }
    recheckOverlaps();
    recomputeMoveHints();
    refreshNetView();
    return (
        `Removed rhomb ${rid}. ${netRhombs.length} left on the net.` +
        (netIsConnected() ? "" : "  ⚠ the net is now in more than one piece.")
    );
}

const FOLD_DASH: Record<number, number[]> = {
    36: [2, 2],
    72: [6, 3],
    108: [11, 3],
};

function drawNet() {
    const ctx = netCtx;
    ctx.clearRect(0, 0, netCanvas.width, netCanvas.height);

    // Layering is O(n²) in the net, so recompute only when the net has actually
    // changed — not on every redraw, which happens on pointer moves.
    if (layersDirty) {
        layersDirty = false;
        recomputeLayers();
    }

    // Sheet and printable area, drawn axis-aligned in canvas space: the net is
    // rotated to meet the paper, not the other way round.
    const pxPerIn = netView.scale / sideIn;
    const cx = netCanvas.width / 2;
    const cy = netCanvas.height / 2;
    const sheet = [PAPER[0] * pxPerIn, PAPER[1] * pxPerIn];
    const inner = [PRINTABLE[0] * pxPerIn, PRINTABLE[1] * pxPerIn];
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - sheet[0] / 2, cy - sheet[1] / 2, sheet[0], sheet[1]);
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - sheet[0] / 2, cy - sheet[1] / 2, sheet[0], sheet[1]);
    ctx.strokeStyle = netView.fits ? "#ddd" : "#e8b4ae";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx - inner[0] / 2, cy - inner[1] / 2, inner[0], inner[1]);
    ctx.setLineDash([]);

    const toPx = viewToPx;

    if (traceGhost) {
        const gv = traceGhost.poly.map(toPx);
        ctx.beginPath();
        ctx.moveTo(gv[0].x, gv[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(gv[i].x, gv[i].y);
        ctx.closePath();
        const col =
            traceGhost.kind === "reject"
                ? "#c0392b"
                : traceGhost.kind === "consider"
                  ? "#c9a227"
                  : "#6a5acd";
        ctx.fillStyle = col + "44";
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.setLineDash(traceGhost.kind === "reject" ? [5, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ghost placements for the rhomb under the pointer in the tiling view
    for (const gh of ghosts) {
        const focused =
            !ghostFocus || (ghostFocus.a === gh.a && ghostFocus.b === gh.b);
        const gv = gh.poly.map(toPx);
        ctx.beginPath();
        ctx.moveTo(gv[0].x, gv[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(gv[i].x, gv[i].y);
        ctx.closePath();
        ctx.fillStyle = gh.clean
            ? `rgba(46, 160, 67, ${focused ? 0.28 : 0.1})`
            : `rgba(192, 57, 43, ${focused ? 0.28 : 0.1})`;
        ctx.fill();
        ctx.strokeStyle = gh.clean ? "#2ea043" : "#c0392b";
        ctx.lineWidth = focused ? 2 : 1;
        ctx.setLineDash(focused ? [] : [4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    for (const nr of netRhombs) {
        const sv = nr.poly.map(toPx);
        ctx.beginPath();
        ctx.moveTo(sv[0].x, sv[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(sv[i].x, sv[i].y);
        ctx.closePath();

        // Off the selected layer: outline only. Context, not something to cut
        // along — you need to see where this sheet sits inside the whole net.
        if (activeLayer != null && (netLayer.get(nr.sourceId) ?? 0) !== activeLayer) {
            ctx.fillStyle = "#fafafa";
            ctx.fill();
            ctx.strokeStyle = "#dcdcdc";
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.stroke();
            continue;
        }

        const src = allRhombs[nr.sourceId];
        const nvi = nr.verts.map((v) => displayIndex(vertexList[v].index));
        const [nLo, nHi] = extremeCorners(nvi);
        ctx.fillStyle = makeGradient(
            ctx,
            src.fill,
            { x: sv[nLo].x, y: sv[nLo].y },
            { x: sv[nHi].x, y: sv[nHi].y },
            nvi[nLo],
            nvi[nHi],
        );
        ctx.globalAlpha = nr.overlapping ? 0.65 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;

        // edges: hinge -> crease styled by fold angle and M/V, else a cut
        for (let i = 0; i < 4; i++) {
            const va = nr.verts[i];
            const vb = nr.verts[(i + 1) % 4];
            const a = sv[i];
            const b = sv[(i + 1) % 4];
            const key = ekey(va, vb);
            const cr = netHinges.has(key)
                ? analysis?.creases.get(key)
                : undefined;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            if (cr) {
                ctx.strokeStyle = cr.mountain ? "#c0392b" : "#2469b8";
                ctx.lineWidth = 1;
                ctx.setLineDash(FOLD_DASH[cr.fold] ?? [3, 3]);
            } else {
                ctx.strokeStyle = "#222";
                ctx.lineWidth = 1.6;
                ctx.setLineDash([]);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (nr.overlapping) {
            ctx.beginPath();
            ctx.moveTo(sv[0].x, sv[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(sv[i].x, sv[i].y);
            ctx.closePath();
            ctx.strokeStyle = "#c0392b";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (showIsogloss) {
            ctx.strokeStyle = src.thick
                ? "rgba(30,32,38,0.55)"
                : "rgba(30,32,38,0.38)";
            ctx.lineWidth = src.thick ? 1 : 0.7;
            for (const [a, b] of isoglossSegments(
                sv.map((q) => [q.x, q.y] as [number, number]),
                nr.verts.map((v) => vertexList[v].index),
            )) {
                ctx.beginPath();
                ctx.moveTo(a[0], a[1]);
                ctx.lineTo(b[0], b[1]);
                ctx.stroke();
            }
        }

        // brushed twin: this is the rhomb under the pointer in the tiling view
        if (nr.sourceId === hoveredRhomb) {
            ctx.beginPath();
            ctx.moveTo(sv[0].x, sv[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(sv[i].x, sv[i].y);
            ctx.closePath();
            ctx.strokeStyle = "#6a5acd";
            ctx.lineWidth = 3;
            ctx.stroke();
        }

    }

    if (mirror.onNet) {
        const q = toPx(mirror.onNet);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(106, 90, 205, 0.85)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

// ── Trace player ──────────────────────────────────────────────────
//
// Replay works by rebuilding the net from a prefix of the trace, so the ordinary
// renderer draws it exactly as if it had been built by hand — one renderer, two
// drivers. Nothing here re-implements the algorithms; it reads their step log.
//
// The view is deliberately fitted once, to the *final* net, and then held. Letting
// it re-fit each frame makes the whole picture lurch about and is unwatchable.

type Mode = "build" | "watch";
let mode: Mode = "build";

// Buttons that only make sense while building by hand. Print is deliberately not
// among them: in Watch mode the canvas holds a complete decomposition, and its
// hinge components are exactly the pieces, so printing there gives what the sheet
// page gives.
const buildOnly: HTMLButtonElement[] = [];

let traceEvents: TraceEvent[] = [];
let traceIndex = 0; // number of events applied
let tracePlaying = false;
let traceSpeed = 15; // events per second, 0 = uncapped
let traceMethod = "cuttree";

// roles for the tiling view at the current step
const traceRoles = new Map<number, "placed" | "rejected" | "current">();
let traceGhost: { poly: [number, number][]; kind: TraceEvent["kind"] } | null =
    null;

// The branch-cut search blocks the thread while it runs, and on a generation-4
// patch that is seconds rather than milliseconds. Announce it and yield once so the
// message actually paints, then run. Callers pass their follow-up work as `after`,
// because it has to happen once the trace exists rather than immediately.
function runTrace(after?: () => void): void {
    const n = allRhombs.length;
    const heavy = traceMethod === "cuttree" && n > 300;
    const go = () => {
        runTraceBody();
        after?.();
    };
    if (heavy) {
        say(
            `${n} rhombi — routing branch cuts. This takes a few seconds at this size; ` +
                `the page is busy, not stuck.`,
        );
        setTimeout(go, 0);
    } else {
        go();
    }
}

function runTraceBody(): void {
    traceEvents = [];
    const fn =
        traceMethod === "bfs"
            ? unfoldPatch
            : traceMethod === "cuttree"
              ? cutTreeUnfold
              : ribbonGrowPatch;
    const res = fn({ flip: flipHeight, trace: traceEvents });

    // fit to the finished net once, then hold it for the whole replay
    netRhombs.length = 0;
    markNetChanged();
    netHinges.clear();
    placedRhombs.clear();
    for (const pl of res.placed.values()) {
        netRhombs.push({
            sourceId: pl.faceId,
            poly: pl.poly as [number, number][],
            verts: pl.verts,
            overlapping: false,
        });
        placedRhombs.add(pl.faceId);
    }
    // The finished net's hinges. These used to be left empty here and only filled
    // in per step by applyPrefix, which meant the layering below ran with *no*
    // parent tree at all — degrading continuation back to plain lowest-fit, the
    // very confetti it exists to avoid.
    for (const k of res.hinges) netHinges.add(k);
    refreshNetView();

    // Layers for the completed net, pinned for the whole replay.
    //
    // Take the algorithm's own assignment when it has one rather than
    // reconstructing it. cutTreeUnfold already layered this exact net from the real
    // hinge tree; recomputing from the net on screen can only agree at best, and
    // silently disagree at worst.
    const withLayers = res as {
        layer?: Map<number, number>;
        layerCount?: number;
        overlaps?: number;
        cuts?: Set<string>;
    };
    if (withLayers.layer && withLayers.layerCount) {
        netLayer = withLayers.layer;
        netLayerCount = withLayers.layerCount;
        if (activeLayer != null && activeLayer >= netLayerCount) activeLayer = null;
        syncLayerBar();
    } else {
        layersPinned = false;
        layersDirty = true;
        recomputeLayers();
    }
    // A net that overlaps cannot honestly be one layer. If the adopted numbers say
    // otherwise, distrust them and layer the net on screen instead, so the control
    // still works while the readout reports the contradiction.
    if (
        withLayers.overlaps != null &&
        withLayers.overlaps > 0 &&
        netLayerCount === 1
    ) {
        layersPinned = false;
        layersDirty = true;
        recomputeLayers();
    }

    layersDirty = false;
    layersPinned = true;
    lastRun = {
        method: traceMethod,
        faces: netRhombs.length,
        overlaps: withLayers.overlaps ?? null,
        layers: netLayerCount,
        cuts: withLayers.cuts ? withLayers.cuts.size : null,
    };

    traceIndex = 0;
    applyPrefix(0);
}

// Rebuild rather than undo: a prefix is only a few thousand array pushes, and
// rebuilding cannot drift the way incremental undo can.
function applyPrefix(k: number): void {
    traceIndex = Math.max(0, Math.min(k, traceEvents.length));
    netRhombs.length = 0;
    if (!layersPinned) layersDirty = true;
    netHinges.clear();
    placedRhombs.clear();
    traceRoles.clear();
    traceGhost = null;

    const rejected = new Set<number>();
    for (let i = 0; i < traceIndex; i++) {
        const e = traceEvents[i];
        if (e.kind === "seed" || e.kind === "place") {
            netRhombs.push({
                sourceId: e.face,
                poly: e.poly as [number, number][],
                verts: e.verts.slice(),
                overlapping: false,
            });
            placedRhombs.add(e.face);
            rejected.delete(e.face);
            if (e.kind === "place") netHinges.add(ekey(e.a, e.b));
        } else if (e.kind === "reject") {
            rejected.add(e.face);
        }
    }
    for (const id of placedRhombs) traceRoles.set(id, "placed");
    for (const id of rejected) {
        if (!placedRhombs.has(id)) traceRoles.set(id, "rejected");
    }

    const cur = traceEvents[traceIndex - 1];
    if (cur && cur.kind !== "newPiece") {
        traceRoles.set(cur.face, "current");
        if (cur.poly) {
            traceGhost = {
                poly: cur.poly as [number, number][],
                kind: cur.kind,
            };
        }
    }
}

function traceLabel(): string {
    if (traceEvents.length === 0) return "No trace yet.";
    const e = traceEvents[traceIndex - 1];
    const at = `${traceIndex} / ${traceEvents.length}`;
    if (!e) return `${at} — start`;
    const what =
        e.kind === "newPiece"
            ? `new piece ${e.piece}`
            : e.kind === "reject"
              ? `reject ${e.face} (${e.reason})`
              : e.kind === "seed"
                ? `seed ${e.face}`
                : e.kind === "consider"
                  ? `consider ${e.face} from ${e.from}`
                  : `place ${e.face} from ${e.from}`;
    const counts = { seed: 0, place: 0, consider: 0, reject: 0 };
    for (let i = 0; i < traceIndex; i++) {
        const k = traceEvents[i].kind;
        if (k in counts) counts[k as keyof typeof counts]++;
    }
    // Everything needed to diagnose a layer question, on the page. A hidden control
    // and a silent "1" look identical on screen, and the method and overlap count
    // are what distinguish "correctly one layer" from "something is wrong".
    let diag = "";
    if (lastRun) {
        const bits = [`method ${lastRun.method}`];
        if (lastRun.overlaps != null) bits.push(`overlaps ${lastRun.overlaps}`);
        if (lastRun.cuts != null) bits.push(`cuts ${lastRun.cuts}`);
        bits.push(
            lastRun.layers > 1
                ? `${lastRun.layers} layers — use the Layer control`
                : `1 layer`,
        );
        diag = ` · ${bits.join(", ")}`;
        // An overlapping net on a single layer is a contradiction; say so rather
        // than quietly showing "1 layer".
        if (lastRun.overlaps != null && lastRun.overlaps > 0 && lastRun.layers === 1) {
            diag += ` ⚠ INCONSISTENT: ${lastRun.overlaps} overlaps but 1 layer`;
        }
    }
    return (
        `${at} · ${what} · placed ${counts.place + counts.seed}, ` +
        `considered ${counts.consider}, rejected ${counts.reject}${diag}`
    );
}

// ── Events ────────────────────────────────────────────────────────

function say(msg: string): void {
    infoSpan.textContent = msg;
}

// The mirrored cursor has to follow continuous motion, so redraws are coalesced
// to one per animation frame. At gen 5 a full repaint is not cheap.
let redrawQueued = false;
function scheduleRedraw(): void {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => {
        redrawQueued = false;
        drawTiling();
        drawNet();
    });
}

function netPointFromEvent(e: MouseEvent): [number, number] {
    const rect = netCanvas.getBoundingClientRect();
    return viewFromPx(
        (e.clientX - rect.left) * (netCanvas.width / rect.width),
        (e.clientY - rect.top) * (netCanvas.height / rect.height),
    );
}

// Pointer to backing-store pixels. The canvas is sized at devicePixelRatio, so
// CSS pixels and canvas pixels are not the same thing and everything drawn is in
// the latter. Getting this wrong offsets every hit test by the DPR.
function tilingPointFromEvent(e: MouseEvent): [number, number] {
    const rect = tilingCanvas.getBoundingClientRect();
    return [
        (e.clientX - rect.left) * (tilingCanvas.width / rect.width),
        (e.clientY - rect.top) * (tilingCanvas.height / rect.height),
    ];
}

function netRhombAt(x: number, y: number): NetRhomb | null {
    for (let i = netRhombs.length - 1; i >= 0; i--) {
        const q = netRhombs[i].poly;
        if (
            pointInQuad(p(x, y), [
                p(q[0][0], q[0][1]),
                p(q[1][0], q[1][1]),
                p(q[2][0], q[2][1]),
                p(q[3][0], q[3][1]),
            ])
        ) {
            return netRhombs[i];
        }
    }
    return null;
}

tilingCanvas.addEventListener("mousemove", (e) => {
    const [sx, sy] = tilingPointFromEvent(e);
    if (e.altKey !== altDown) altDown = e.altKey;
    const edge = findEdgeAt(sx, sy);
    const rid = findRhombAt(sx, sy);
    tilingCanvas.style.cursor = altDown
        ? "pointer"
        : edge
          ? "col-resize"
          : "crosshair";

    if (rid !== hoveredRhomb) {
        hoveredRhomb = rid;
        if (rid >= 0) computeGhosts(rid);
        else ghosts = [];
    }
    // hovering an edge narrows the ghosts to that one hinge
    ghostFocus = edge ? { a: edge.a, b: edge.b } : null;
    hoveredNetId = -1;
    mirror = {
        onTiling: null,
        onNet: rid >= 0 ? tilingToNet(rid, fromScreen(sx, sy)) : null,
    };
    scheduleRedraw();
    if (edge) {
        const [x, y] = edge.rhombIds;
        const cr = analysis?.creases.get(ekey(edge.a, edge.b));
        say(
            `Edge ${x}|${y}` +
                (cr
                    ? ` · fold ${cr.fold}° ${cr.mountain ? "mountain" : "valley"}`
                    : "") +
                " — click to unfold across this hinge",
        );
    } else if (rid >= 0) {
        const r = allRhombs[rid];
        say(
            `Rhomb ${rid} (${r.thick ? "thick" : "thin"}) idx=[${r.vertIndices
                .map(displayIndex)
                .join(",")}]${flipHeight ? " flipped" : ""}` +
                (placedRhombs.has(rid)
                    ? altDown
                        ? " · alt-click to remove"
                        : " · already placed, alt-click to remove"
                    : moveHints.get(rid) === "clean"
                      ? " · click to place, no overlap"
                      : moveHints.get(rid) === "overlap"
                        ? " · every route from here overlaps"
                        : netRhombs.length === 0
                          ? " · click to seed"
                          : " · does not touch the net"),
        );
    } else {
        say("Click a rhomb to place it; click an edge to choose the hinge");
    }
});

tilingCanvas.addEventListener("click", (e) => {
    if (mode === "watch") {
        say("Watching a replay — switch to Build to place rhombi yourself.");
        return;
    }
    const [sx, sy] = tilingPointFromEvent(e);
    if (e.altKey) {
        const rid = findRhombAt(sx, sy);
        if (rid < 0) return;
        if (!placedRhombs.has(rid)) {
            say(`Rhomb ${rid} is not on the net, so there is nothing to remove.`);
        } else {
            say(removeRhomb(rid));
            if (hoveredRhomb >= 0) computeGhosts(hoveredRhomb);
        }
        drawTiling();
        drawNet();
        return;
    }

    const edge = findEdgeAt(sx, sy);
    if (edge) {
        // unfold whichever of the two rhombs is not yet on the net
        const [x, y] = edge.rhombIds;
        const target = !placedRhombs.has(x)
            ? x
            : !placedRhombs.has(y)
              ? y
              : -1;
        if (target < 0) {
            say(`Both rhombs across that edge are already placed.`);
        } else {
            say(placeRhomb(target, { a: edge.a, b: edge.b }));
        }
    } else {
        const rid = findRhombAt(sx, sy);
        if (rid < 0) return;
        say(placeRhomb(rid));
    }
    if (hoveredRhomb >= 0) computeGhosts(hoveredRhomb);
    drawTiling();
    drawNet();
});

netCanvas.addEventListener("mousemove", (e) => {
    const [mx, my] = netPointFromEvent(e);
    const nr = netRhombAt(mx, my);
    hoveredNetId = nr ? nr.sourceId : -1;
    hoveredRhomb = -1;
    ghosts = [];
    ghostFocus = null;
    mirror = {
        onTiling: nr ? netToTiling(nr, mx, my) : null,
        onNet: null,
    };
    netCanvas.style.cursor = nr ? "pointer" : "default";
    if (nr) {
        const r = allRhombs[nr.sourceId];
        say(
            `Rhomb ${nr.sourceId} (${r.thick ? "thick" : "thin"})` +
                `${nr.overlapping ? " · overlapping" : ""} — click to remove`,
        );
    }
    scheduleRedraw();
});

netCanvas.addEventListener("mouseleave", () => {
    hoveredNetId = -1;
    mirror = { onTiling: null, onNet: null };
    scheduleRedraw();
});

tilingCanvas.addEventListener("mouseleave", () => {
    hoveredRhomb = -1;
    ghosts = [];
    ghostFocus = null;
    mirror = { onTiling: null, onNet: null };
    scheduleRedraw();
});

// Click a placed rhomb on the work canvas to take it off again.
netCanvas.addEventListener("click", (e) => {
    if (mode === "watch") return;
    const [mx, my] = netPointFromEvent(e);
    const nr = netRhombAt(mx, my);
    if (!nr) return;
    say(removeRhomb(nr.sourceId));
    if (hoveredRhomb >= 0) computeGhosts(hoveredRhomb);
    drawTiling();
    drawNet();
});

document.getElementById("btn-clear")!.addEventListener("click", () => {
    pushHistory();
    netRhombs.length = 0;
    markNetChanged();
    netHinges.clear();
    placedRhombs.clear();
    moveHints.clear();
    refreshNetView();
    say("Cleared. Click a rhomb to seed a new net.");
    drawTiling();
    drawNet();
});

// ── Print ─────────────────────────────────────────────────────────
//
// Printing goes through sheet.ts, the shared sheet renderer, so a
// hand-built net comes out as crisp vector at true size rather than a screenshot
// of the canvas. Only the hinges the user actually unfolded across count as
// creases; every other edge is a cut, exactly as on screen.

function printNet(): void {
    if (netRhombs.length === 0) {
        say("Nothing on the net to print yet.");
        return;
    }
    if (!analysis) return;

    const placed = new Map<number, Placed>();
    for (const nr of netRhombs) placed.set(nr.sourceId, asPlaced(nr));

    // one piece per connected group of hinges, so a net in two islands prints as
    // two pieces rather than one bounding box with a hole
    const groups = new Map<number, number>();
    let gi = 0;
    for (const nr of netRhombs) {
        if (groups.has(nr.sourceId)) continue;
        const g = gi++;
        const q = [nr.sourceId];
        groups.set(nr.sourceId, g);
        for (let i = 0; i < q.length; i++) {
            for (const k of netHinges) {
                const [a, b] = k.split("-").map(Number);
                const e = edgeMap.get(ekey(a, b));
                if (!e || e.rhombIds.length !== 2) continue;
                if (!e.rhombIds.includes(q[i])) continue;
                for (const other of e.rhombIds) {
                    if (!placed.has(other) || groups.has(other)) continue;
                    groups.set(other, g);
                    q.push(other);
                }
            }
        }
    }
    const byGroup = new Map<number, number[]>();
    for (const [fid, g] of groups) {
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g)!.push(fid);
    }
    for (const [, ids] of byGroup) {
        for (const fid of ids) placed.get(fid)!.piece = 0;
    }

    const pieces = [...byGroup.values()].map((faceIds, id) => {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const fid of faceIds)
            for (const q of placed.get(fid)!.poly) {
                if (q[0] < x0) x0 = q[0];
                if (q[1] < y0) y0 = q[1];
                if (q[0] > x1) x1 = q[0];
                if (q[1] > y1) y1 = q[1];
            }
        for (const fid of faceIds) placed.get(fid)!.piece = id;
        return { id, faceIds, w: x1 - x0, h: y1 - y0, minX: x0, minY: y0 };
    });
    pieces.sort((a, b) => b.faceIds.length - a.faceIds.length);
    pieces.forEach((pc, id) => {
        pc.id = id;
        for (const fid of pc.faceIds) placed.get(fid)!.piece = id;
    });

    const sideMm = sideIn * 25.4;
    const marginMm = MARGIN_IN * 25.4;
    const [pw, ph] = PAGES.letter;
    const { sheets, oversize } = layoutSheets(
        pieces,
        sideMm,
        pw - 2 * marginMm,
        ph - 2 * marginMm,
        6,
    );

    // Every piece too big for the page means layoutSheets returns nothing, and
    // printing that would spool a blank sheet. Say so instead.
    if (sheets.length === 0) {
        say(
            `Nothing fits: ${oversize.length} piece(s) exceed the printable area at ` +
                `${(sideIn * 25.4).toFixed(1)} mm side. Reduce the side and try again.`,
        );
        return;
    }

    const host = document.getElementById("printout")!;
    host.innerHTML = sheets
        .map((sh) =>
            renderSheet(sh, placed, analysis!.creases, netHinges, {
                sideMm,
                pageW: pw,
                pageH: ph,
                margin: marginMm,
                fillMode: "cluster",
                showAngles: false,
                showLegend: true,
                layer: netLayerCount > 1 ? netLayer : undefined,
                activeLayer,
            }),
        )
        .join("\n");

    say(
        `Printing ${netRhombs.length} rhombi as ${pieces.length} piece${pieces.length === 1 ? "" : "s"} ` +
            `on ${sheets.length} sheet${sheets.length === 1 ? "" : "s"} at ${(sideIn * 25.4).toFixed(1)} mm side.` +
            (netLayerCount > 1
                ? `  Layer ${activeLayer == null ? "all" : activeLayer} of ${netLayerCount}.`
                : "") +
            (oversize.length
                ? `  ⚠ ${oversize.length} piece(s) too big — reduce the side.`
                : ""),
    );
    window.print();
}

// ── Transport ─────────────────────────────────────────────────────

let lastFrame = 0;
let stepDebt = 0;

function tick(now: number): void {
    if (!tracePlaying) return;
    const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
    lastFrame = now;
    if (traceSpeed === 0) {
        applyPrefix(traceEvents.length);
    } else {
        stepDebt += dt * traceSpeed;
        const whole = Math.floor(stepDebt);
        if (whole > 0) {
            stepDebt -= whole;
            applyPrefix(traceIndex + whole);
        }
    }
    if (traceIndex >= traceEvents.length) {
        tracePlaying = false;
        syncTransport();
    }
    drawTiling();
    drawNet();
    if (tracePlaying) requestAnimationFrame(tick);
}

function startPlay(): void {
    if (traceEvents.length === 0) return;
    if (traceIndex >= traceEvents.length) applyPrefix(0);
    tracePlaying = true;
    lastFrame = 0;
    stepDebt = 0;
    syncTransport();
    requestAnimationFrame(tick);
}

function stopPlay(): void {
    tracePlaying = false;
    syncTransport();
}

let syncTransport: () => void = () => {};

function buildTransport(): void {
    const bar = document.getElementById("transport")!;
    bar.innerHTML = "";

    const mk = <K extends keyof HTMLElementTagNameMap>(
        tag: K,
    ): HTMLElementTagNameMap[K] => document.createElement(tag);

    const methodSel = mk("select");
    for (const [v, t] of [
        ["cuttree", "Branch cuts"],
        ["widened", "Widened ribbons"],
        ["bfs", "BFS"],
    ]) {
        const o = mk("option");
        o.value = v;
        o.textContent = t;
        methodSel.appendChild(o);
    }
    methodSel.value = traceMethod;
    methodSel.addEventListener("change", () => {
        traceMethod = methodSel.value;
        stopPlay();
        runTrace(() => {
            syncTransport();
            drawTiling();
            drawNet();
        });
    });
    const methodLabel = mk("label");
    methodLabel.style.fontSize = "13px";
    methodLabel.textContent = "Method: ";
    methodLabel.appendChild(methodSel);
    bar.appendChild(methodLabel);

    const back = mk("button");
    back.textContent = "◀";
    back.title = "Step back (←)";
    back.addEventListener("click", () => {
        stopPlay();
        applyPrefix(traceIndex - 1);
        syncTransport();
        drawTiling();
        drawNet();
    });
    bar.appendChild(back);

    const playBtn = mk("button");
    playBtn.addEventListener("click", () => {
        if (tracePlaying) stopPlay();
        else startPlay();
    });
    bar.appendChild(playBtn);

    const fwd = mk("button");
    fwd.textContent = "▶|";
    fwd.title = "Step forward (→)";
    fwd.addEventListener("click", () => {
        stopPlay();
        applyPrefix(traceIndex + 1);
        syncTransport();
        drawTiling();
        drawNet();
    });
    bar.appendChild(fwd);

    const scrub = mk("input");
    scrub.type = "range";
    scrub.min = "0";
    scrub.step = "1";
    scrub.style.width = "260px";
    scrub.addEventListener("input", () => {
        stopPlay();
        applyPrefix(Number(scrub.value));
        syncTransport();
        drawTiling();
        drawNet();
    });
    bar.appendChild(scrub);

    const speedSel = mk("select");
    for (const [v, t] of [
        ["4", "4 / sec"],
        ["15", "15 / sec"],
        ["60", "60 / sec"],
        ["240", "240 / sec"],
        ["0", "all at once"],
    ]) {
        const o = mk("option");
        o.value = v;
        o.textContent = t;
        speedSel.appendChild(o);
    }
    speedSel.value = String(traceSpeed);
    speedSel.addEventListener("change", () => {
        traceSpeed = Number(speedSel.value);
    });
    const speedLabel = mk("label");
    speedLabel.style.fontSize = "13px";
    speedLabel.textContent = "Speed: ";
    speedLabel.appendChild(speedSel);
    bar.appendChild(speedLabel);

    const readout = mk("span");
    readout.className = "info";
    bar.appendChild(readout);

    syncTransport = () => {
        playBtn.textContent = tracePlaying ? "❚❚ Pause" : "▶ Play";
        scrub.max = String(traceEvents.length);
        scrub.value = String(traceIndex);
        readout.textContent = traceLabel();
    };
    syncTransport();
}

function setMode(next: Mode): void {
    mode = next;
    const transport = document.getElementById("transport")!;
    transport.style.display = next === "watch" ? "flex" : "none";
    // Only Clear, Undo and Print are build-specific. Patch, generation, color,
    // height and side all still mean something while watching, so disabling the
    // whole bar — as this used to — took away controls for no reason.
    for (const b of buildOnly) {
        b.disabled = next === "watch";
        b.style.opacity = next === "watch" ? "0.45" : "1";
    }
    stopPlay();
    if (next === "watch") {
        runTrace(() => {
            buildTransport();
            say("Replaying — Play, or step with the arrow keys.");
        });
    } else {
        netRhombs.length = 0;
        markNetChanged();
        netHinges.clear();
        placedRhombs.clear();
        traceRoles.clear();
        traceGhost = null;
        traceEvents = [];
        moveHints.clear();
        history.length = 0;
        refreshNetView();
        say("Build mode. Click a rhomb to seed a net.");
    }
    drawTiling();
    drawNet();
}

// ── Control panel ─────────────────────────────────────────────────

function buildModeBar(): void {
    const bar = document.getElementById("modebar")!;
    for (const [v, t] of [
        ["build", "Build by hand"],
        ["watch", "Watch an algorithm"],
    ] as Array<[Mode, string]>) {
        const btn = document.createElement("button");
        btn.textContent = t;
        btn.addEventListener("click", () => {
            for (const b of Array.from(bar.querySelectorAll("button"))) {
                b.style.fontWeight = "400";
                b.style.borderColor = "#ccc";
            }
            btn.style.fontWeight = "600";
            btn.style.borderColor = "#6a5acd";
            setMode(v);
        });
        if (v === mode) {
            btn.style.fontWeight = "600";
            btn.style.borderColor = "#6a5acd";
        }
        bar.appendChild(btn);
    }
}

function buildControls() {
    const controls = document.getElementById("controls")!;
    const clearBtn = document.getElementById("btn-clear") as HTMLButtonElement;
    if (clearBtn) buildOnly.push(clearBtn);

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
        if (mode === "watch") {
            runTrace(() => {
                syncTransport();
                drawTiling();
                drawNet();
            });
        }
    });

    const typeLabel = document.createElement("label");
    typeLabel.textContent = "Type: ";
    typeLabel.style.fontSize = "13px";
    typeLabel.appendChild(typeSelect);
    controls.insertBefore(typeLabel, controls.firstChild);

    // Gen selector
    const genSelect = document.createElement("select");
    genSelect.style.cssText = "padding:4px;font-size:13px;";
    // Generation 0 produced nothing at all — expandPenta returns immediately — so
    // it was a dead entry in the menu. Generation 1 stays: it is the smallest real
    // patch for the Pe tiles, and the St tiles being empty there is expected, not
    // an error, since star-type pieces emit no rhombs until a generation later.
    for (let g = 1; g <= 4; g++) {
        const opt = document.createElement("option");
        opt.value = String(g);
        opt.textContent = `Gen ${g}`;
        if (g === gen) opt.selected = true;
        genSelect.appendChild(opt);
    }
    genSelect.addEventListener("change", () => {
        gen = parseInt(genSelect.value);
        regenerate();
        if (mode === "watch") {
            runTrace(() => {
                syncTransport();
                drawTiling();
                drawNet();
            });
        }
    });

    const genLabel = document.createElement("label");
    genLabel.textContent = "Gen: ";
    genLabel.style.fontSize = "13px";
    genLabel.appendChild(genSelect);
    controls.insertBefore(genLabel, typeLabel.nextSibling);

    // one height control: sign flips the roof, magnitude sets shading depth
    const heightWrap = document.createElement("label");
    heightWrap.style.cssText = "font-size:13px;display:flex;align-items:center;gap:6px;";
    const heightOut = document.createElement("span");
    heightOut.className = "mono";
    heightOut.style.minWidth = "5.5em";
    const heightSlider = document.createElement("input");
    heightSlider.type = "range";
    heightSlider.min = "-1";
    heightSlider.max = "1";
    heightSlider.step = "0.02";
    heightSlider.value = "1";
    heightSlider.style.width = "130px";
    heightSlider.title =
        "Height: sign flips hills and dales, magnitude sets how strongly height is shaded";
    const syncHeight = (regen: boolean) => {
        heightU = Number(heightSlider.value);
        const v = biasedHeight(heightU);
        shadeDepth = Math.abs(v);
        const wasFlipped = flipHeight;
        flipHeight = v < 0;
        heightOut.textContent =
            shadeDepth < 0.005
                ? "flat"
                : `${v < 0 ? "dales" : "hills"} ${shadeDepth.toFixed(2)}`;
        // creases follow the lift, so a change of sign needs the analysis rebuilt
        if (regen && flipHeight !== wasFlipped && allRhombs.length) {
            analysis = analysePatch(flipHeight);
        }
        drawTiling();
        drawNet();
    };
    heightSlider.addEventListener("input", () => syncHeight(true));

    // Released, the slider eases to the nearest of −1, 0, +1: dales, flat, hills.
    // The three settings are the ones that mean something, but sliding between
    // them is how you see the surface come up out of the plane, so the travel is
    // free and only the landing is snapped.
    heightSlider.addEventListener("change", () => {
        const from = Number(heightSlider.value);
        const to = from < -0.5 ? -1 : from > 0.5 ? 1 : 0;
        animateSlider(heightSlider, from, to, () => syncHeight(true));
    });

    heightWrap.append(document.createTextNode("Height "), heightSlider, heightOut);
    controls.insertBefore(heightWrap, genLabel.nextSibling);
    syncHeight(false);

    const isoWrap = document.createElement("label");
    isoWrap.style.cssText = "font-size:13px;display:flex;align-items:center;gap:5px;";
    const isoChk = document.createElement("input");
    isoChk.type = "checkbox";
    isoChk.title =
        "Contour lines of constant height — seven per rhombus, on quarter-index steps";
    isoChk.addEventListener("change", () => {
        showIsogloss = isoChk.checked;
        drawTiling();
        drawNet();
    });
    isoWrap.append(isoChk, document.createTextNode("isoglosses"));
    controls.insertBefore(isoWrap, heightWrap.nextSibling);

    const colourSel = document.createElement("select");
    colourSel.style.cssText = "padding:4px;font-size:13px;";
    for (const [v, t] of [
        ["cluster", "Cluster"],
        ["type", "Thick / thin"],
        ["index", "Height index"],
    ] as Array<[TileColour, string]>) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = t;
        colourSel.appendChild(opt);
    }
    colourSel.value = tileColour;
    colourSel.addEventListener("change", () => {
        tileColour = colourSel.value as TileColour;
        drawTiling();
    });
    const colourLabel = document.createElement("label");
    colourLabel.textContent = "Color: ";
    colourLabel.style.fontSize = "13px";
    colourLabel.appendChild(colourSel);
    controls.insertBefore(colourLabel, heightWrap.nextSibling);

    const sideInput = document.createElement("input");
    sideInput.type = "text";
    sideInput.value = "1in";
    sideInput.size = 8;
    sideInput.style.cssText =
        "padding:4px;font-size:13px;border:1px solid #ccc;border-radius:4px;";
    const applySide = () => {
        const parsed = parseLength(sideInput.value);
        if (!parsed) {
            say(`Cannot read "${sideInput.value}" as a length — try 1in, 20mm or 0.75in.`);
            return;
        }
        sideIn = parsed.mm / 25.4;
        refreshNetView();
        drawNet();
        say(`Rhombus side ${parsed.label}. ${fitReport()}`);
    };
    sideInput.addEventListener("change", applySide);
    sideInput.addEventListener("keydown", (ev) => {
        if ((ev as KeyboardEvent).key === "Enter") applySide();
    });
    const sideLabel = document.createElement("label");
    sideLabel.textContent = "Side (mm/cm/in): ";
    sideLabel.style.fontSize = "13px";
    sideLabel.appendChild(sideInput);
    controls.appendChild(sideLabel);

    // Layer selector. Hidden unless the net actually needs more than one, so it
    // stays out of the way on everything up to generation 3, which is one sheet.
    layerLabel = document.createElement("label");
    layerLabel.textContent = "Layer: ";
    layerLabel.style.fontSize = "13px";
    layerLabel.style.display = "none";
    layerSelect = document.createElement("select");
    layerSelect.addEventListener("change", () => {
        activeLayer =
            layerSelect!.value === "all" ? null : Number(layerSelect!.value);
        drawNet();
        say(
            activeLayer == null
                ? `Showing all ${netLayerCount} layers.`
                : `Layer ${activeLayer} of ${netLayerCount}; the rest is ghosted for context.`,
        );
    });
    layerLabel.appendChild(layerSelect);
    controls.appendChild(layerLabel);

    const printBtn = document.createElement("button");
    printBtn.textContent = "Print / PDF";
    printBtn.title = "Print what you have built, at true size";
    printBtn.addEventListener("click", printNet);
    controls.appendChild(printBtn);

    const undoBtn = document.createElement("button");
    undoBtn.textContent = "Undo";
    undoBtn.title = "Step back one placement (⌘Z / Ctrl-Z)";
    undoBtn.addEventListener("click", () => {
        say(undo());
        drawTiling();
        drawNet();
    });
    controls.insertBefore(undoBtn, controls.firstChild?.nextSibling ?? null);
    buildOnly.push(undoBtn);

    window.addEventListener("keydown", (e) => {
        if (e.altKey && !altDown) {
            altDown = true;
            tilingCanvas.style.cursor = "pointer";
            scheduleRedraw();
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            say(undo());
            drawTiling();
            drawNet();
        }
    });

    window.addEventListener("keydown", (e) => {
        if (mode !== "watch") return;
        if (e.key === " ") {
            e.preventDefault();
            if (tracePlaying) stopPlay();
            else startPlay();
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            stopPlay();
            applyPrefix(traceIndex + (e.key === "ArrowRight" ? 1 : -1));
            syncTransport();
            drawTiling();
            drawNet();
        }
    });

    window.addEventListener("keyup", (e) => {
        if (!e.altKey && altDown) {
            altDown = false;
            tilingCanvas.style.cursor = "crosshair";
            scheduleRedraw();
        }
    });
    // a window blur while Alt is down would otherwise leave it stuck on
    window.addEventListener("blur", () => {
        if (altDown) {
            altDown = false;
            scheduleRedraw();
        }
    });
}

function regenerate() {
    netRhombs.length = 0;
    markNetChanged();
    netHinges.clear();
    placedRhombs.clear();
    moveHints.clear();
    history.length = 0;
    generate();
    fitView();
    refreshNetView();
    if (allRhombs.length === 0) {
        const label = seedTypes[currentSeedIdx].label;
        say(
            `${label} produces no rhombs at generation ${gen} — star-type tiles ` +
                `emit none until a generation later. Try ${gen + 1}.`,
        );
    }
    drawTiling();
    drawNet();
}

// ── Init ──────────────────────────────────────────────────────────

// Remember whether the instructions were left open.
const help = document.getElementById("help") as HTMLDetailsElement | null;
if (help) {
    help.open = localStorage.getItem("wr-help-open") === "1";
    help.addEventListener("toggle", () => {
        localStorage.setItem("wr-help-open", help.open ? "1" : "0");
    });
}

// Stamped at build time. If this does not match what was just built, the browser
// is running a cached script — which has now cost us two debugging sessions.
console.log(`workbench build ${BUILD_ID}`);

buildModeBar();
buildControls();
sizeTilingCanvas();
sizeNetCanvas();
generate();
fitView();
refreshNetView();
drawTiling();
drawNet();

window.addEventListener("resize", () => {
    sizeTilingCanvas();
    sizeNetCanvas();
    fitView();
    refreshNetView();
    scheduleRedraw();
});
