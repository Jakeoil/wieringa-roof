// Wieringa Roof — legacy two-canvas explorer (rendering + UI).
// Tiling generation lives in geometry.ts.

import {
    GOLDEN_SIDE,
    PHI,
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
} from "./unfold.js";
import type { Analysis, Placed } from "./unfold.js";

// ── UI State ──────────────────────────────────────────────────────

let currentSeedIdx = 3; // St5
let currentIsHeads = true;
let gen = 3;

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

        const hint = moveHints.get(r.id);
        if (placedRhombs.has(r.id)) {
            ctx.fillStyle = altDown
                ? "rgba(192, 57, 43, 0.45)"
                : "rgba(255, 200, 0, 0.5)";
        } else {
            ctx.fillStyle = makeGradient(ctx, r.fill, sv[0], sv[2], r.isHeads);
            if (r.id === hoveredRhomb) ctx.globalAlpha = 0.9;
        }
        ctx.fill();
        ctx.globalAlpha = 1;

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

        // brushed twin: this rhomb is the one under the pointer on the net canvas
        if (r.id === hoveredNetId) {
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
const EDGE_PICK_PX = 7;

function findEdgeAt(
    sx: number,
    sy: number,
): { a: number; b: number; rhombIds: number[] } | null {
    let best: { a: number; b: number; rhombIds: number[] } | null = null;
    let bestD = EDGE_PICK_PX;
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
    netRhombs.push(...s.rhombs);
    netHinges.clear();
    for (const h of s.hinges) netHinges.add(h);
    placedRhombs.clear();
    for (const n of netRhombs) placedRhombs.add(n.sourceId);
    recheckOverlaps();
    recomputeMoveHints();
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
const SEED_CENTRE: [number, number] = [4.25 / GOLDEN_SIDE, 4.6 / GOLDEN_SIDE];

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
        // drop the seed near the middle of the page
        const cx = poly.reduce((t, q) => t + q[0], 0) / 4;
        const cy = poly.reduce((t, q) => t + q[1], 0) / 4;
        poly = poly.map(
            (q) =>
                [
                    q[0] - cx + SEED_CENTRE[0],
                    q[1] - cy + SEED_CENTRE[1],
                ] as [number, number],
        );
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
    placedRhombs.add(rid);
    recheckOverlaps();
    recomputeMoveHints();

    const nOver = netRhombs.filter((n) => n.overlapping).length;
    if (overlapping) {
        note += `  ⚠ overlaps — placed anyway (${nOver} overlapping in the net).`;
    }
    return note;
}

function removeRhomb(rid: number): string {
    const i = netRhombs.findIndex((n) => n.sourceId === rid);
    if (i < 0) return "";
    pushHistory();
    netRhombs.splice(i, 1);
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

    // Page boundary
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(0, 0, 8.5 * DPI, 10 * DPI);
    ctx.setLineDash([]);

    const toPx = (q: [number, number]) =>
        p(q[0] * GOLDEN_SIDE * DPI, q[1] * GOLDEN_SIDE * DPI);

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

        const src = allRhombs[nr.sourceId];
        ctx.fillStyle = makeGradient(
            ctx,
            src.fill,
            { x: sv[0].x, y: sv[0].y },
            { x: sv[2].x, y: sv[2].y },
            src.isHeads,
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

        // Vertex index labels
        for (let i = 0; i < 4; i++) {
            const idx = displayIndex(vertexList[nr.verts[i]].index);
            ctx.fillStyle = indexColor(idx);
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(idx), sv[i].x, sv[i].y - 4);
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
    return [
        ((e.clientX - rect.left) / (DPI * GOLDEN_SIDE)) *
            (netCanvas.width / rect.width),
        ((e.clientY - rect.top) / (DPI * GOLDEN_SIDE)) *
            (netCanvas.height / rect.height),
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
    const rect = tilingCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
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
    const rect = tilingCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
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
    const rect = netCanvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / (DPI * GOLDEN_SIDE)) *
        (netCanvas.width / rect.width);
    const my = ((e.clientY - rect.top) / (DPI * GOLDEN_SIDE)) *
        (netCanvas.height / rect.height);
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
    netHinges.clear();
    placedRhombs.clear();
    moveHints.clear();
    say("Cleared. Click a rhomb to seed a new net.");
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

    // height flip toggle — redraw only, no regeneration needed
    const flipBtn = document.createElement("button");
    const flipLabel = () => (flipHeight ? "Dales up" : "Hills up");
    flipBtn.textContent = flipLabel();
    flipBtn.title =
        "Flip the roof vertically — the dual surface over the same tiling";
    flipBtn.addEventListener("click", () => {
        flipHeight = !flipHeight;
        flipBtn.textContent = flipLabel();
        // creases depend on the lift, so the analysis is rebuilt
        if (allRhombs.length) analysis = analysePatch(flipHeight);
        drawTiling();
        drawNet();
    });
    controls.insertBefore(flipBtn, headsBtn.nextSibling);

    const undoBtn = document.createElement("button");
    undoBtn.textContent = "Undo";
    undoBtn.title = "Step back one placement (⌘Z / Ctrl-Z)";
    undoBtn.addEventListener("click", () => {
        say(undo());
        drawTiling();
        drawNet();
    });
    controls.insertBefore(undoBtn, controls.firstChild?.nextSibling ?? null);

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
    netHinges.clear();
    placedRhombs.clear();
    moveHints.clear();
    history.length = 0;
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
