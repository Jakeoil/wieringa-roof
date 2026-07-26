// Wieringa Roof — legacy two-canvas explorer (rendering + UI).
// Tiling generation lives in geometry.ts.

import {
    PHI,
    Pt,
    p,
    allRhombs,
    vertexList,
    seedTypes,
    generatePatch,
} from "./geometry.js";
import type { Rhomb, Vertex } from "./geometry.js";

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
            const idx = displayIndex(src.vertIndices[i]);
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
            infoSpan.textContent = `Rhomb ${rid} (${r.thick ? "thick" : "thin"}) idx=[${r.vertIndices.map(displayIndex)}]${flipHeight ? " flipped" : ""} isHeads=${r.isHeads}`;
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

    // height flip toggle — redraw only, no regeneration needed
    const flipBtn = document.createElement("button");
    const flipLabel = () => (flipHeight ? "Dales up" : "Hills up");
    flipBtn.textContent = flipLabel();
    flipBtn.title =
        "Flip the roof vertically — the dual surface over the same tiling";
    flipBtn.addEventListener("click", () => {
        flipHeight = !flipHeight;
        flipBtn.textContent = flipLabel();
        drawTiling();
        drawNet();
    });
    controls.insertBefore(flipBtn, headsBtn.nextSibling);
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
