// Wieringa Roof — legacy two-canvas explorer (rendering + UI).
// Tiling generation lives in geometry.ts.

import {
    GOLDEN_SIDE,
    PHI,
    edgeMap,
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
            return `Rhomb ${rid} does not touch the net — click one adjacent to it, or Clear to start over.`;
        }
        let chosen = cands[cands.length - 1];
        if (viaEdge) {
            const want = ekey(viaEdge.a, viaEdge.b);
            const match = cands.find((l) => ekey(l.a, l.b) === want);
            if (!match) {
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
        if (!cand) return `Could not unfold rhomb ${rid} across that edge.`;
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

    const nOver = netRhombs.filter((n) => n.overlapping).length;
    if (overlapping) {
        note += `  ⚠ overlaps — placed anyway (${nOver} overlapping in the net).`;
    }
    return note;
}

function removeRhomb(rid: number): string {
    const i = netRhombs.findIndex((n) => n.sourceId === rid);
    if (i < 0) return "";
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
    return `Removed rhomb ${rid}. ${netRhombs.length} left on the net.`;
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

        // Vertex index labels
        for (let i = 0; i < 4; i++) {
            const idx = displayIndex(vertexList[nr.verts[i]].index);
            ctx.fillStyle = indexColor(idx);
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.fillText(String(idx), sv[i].x, sv[i].y - 4);
        }
    }
}

// ── Events ────────────────────────────────────────────────────────

function say(msg: string): void {
    infoSpan.textContent = msg;
}

tilingCanvas.addEventListener("mousemove", (e) => {
    const rect = tilingCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const edge = findEdgeAt(sx, sy);
    const rid = findRhombAt(sx, sy);
    tilingCanvas.style.cursor = edge ? "col-resize" : "crosshair";
    if (rid !== hoveredRhomb) {
        hoveredRhomb = rid;
        drawTiling();
    }
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
                (placedRhombs.has(rid) ? " · already placed" : " · click to place"),
        );
    } else {
        say("Click a rhomb to place it; click an edge to choose the hinge");
    }
});

tilingCanvas.addEventListener("click", (e) => {
    const rect = tilingCanvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
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
    drawTiling();
    drawNet();
});

// Click a placed rhomb on the work canvas to take it off again.
netCanvas.addEventListener("click", (e) => {
    const rect = netCanvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / (DPI * GOLDEN_SIDE)) *
        (netCanvas.width / rect.width);
    const my = ((e.clientY - rect.top) / (DPI * GOLDEN_SIDE)) *
        (netCanvas.height / rect.height);
    for (let i = netRhombs.length - 1; i >= 0; i--) {
        const q = netRhombs[i].poly;
        if (
            pointInQuad(p(mx, my), [
                p(q[0][0], q[0][1]),
                p(q[1][0], q[1][1]),
                p(q[2][0], q[2][1]),
                p(q[3][0], q[3][1]),
            ])
        ) {
            say(removeRhomb(netRhombs[i].sourceId));
            drawTiling();
            drawNet();
            return;
        }
    }
});

document.getElementById("btn-clear")!.addEventListener("click", () => {
    netRhombs.length = 0;
    netHinges.clear();
    placedRhombs.clear();
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
}

function regenerate() {
    netRhombs.length = 0;
    netHinges.clear();
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
