// Sheet layout and SVG rendering for printable nets.
//
// Pure string/geometry work, no DOM — shared by net.ts (browser) and
// tools/bfs-unfold.mjs (writes .svg files).

import { edgeRole } from "./unfold.js";
import type { Placed, Piece, Crease } from "./unfold.js";

type P2 = [number, number];

export const MM_PER_IN = 25.4;

export const PAGES: Record<string, [number, number]> = {
    letter: [215.9, 279.4],
    a4: [210.0, 297.0],
    a3: [297.0, 420.0],
};

// ── lengths, mm or inches ─────────────────────────────────────────

export function parseLength(raw: string): { mm: number; label: string } | null {
    const m = String(raw)
        .trim()
        .match(/^([0-9]*\.?[0-9]+)\s*(mm|cm|in|in\.|")?$/i);
    if (!m) return null;
    const v = Number(m[1]);
    if (!(v > 0)) return null;
    const u = (m[2] ?? "mm").toLowerCase();
    if (u === "mm") return { mm: v, label: `${v} mm` };
    if (u === "cm") return { mm: v * 10, label: `${v} cm` };
    return { mm: v * MM_PER_IN, label: `${v} in` };
}

// ── crease styling ────────────────────────────────────────────────

export const DASH: Record<number, string> = {
    36: "1.4 1.4",
    72: "3.2 1.6",
    108: "6 1.8",
};
export const M_COLOR = "#c0392b";
export const V_COLOR = "#2469b8";

// ── layout ────────────────────────────────────────────────────────

export interface Placement {
    piece: Piece;
    x: number; // mm, relative to the margin corner
    y: number;
    rotated: boolean;
    w: number; // mm, after any rotation
    h: number;
}

export interface Sheet {
    placements: Placement[];
}

export function layoutSheets(
    pieces: Piece[],
    sideMm: number,
    usableW: number,
    usableH: number,
    gap: number,
): { sheets: Sheet[]; oversize: Piece[] } {
    const sheets: Sheet[] = [];
    const oversize: Piece[] = [];

    let sheet: Sheet = { placements: [] };
    let shelfY = 0;
    let shelfH = 0;
    let cursorX = 0;

    const flush = () => {
        if (sheet.placements.length) sheets.push(sheet);
        sheet = { placements: [] };
        shelfY = 0;
        shelfH = 0;
        cursorX = 0;
    };

    for (const piece of pieces) {
        let w = piece.w * sideMm;
        let h = piece.h * sideMm;
        let rotated = false;
        if (w > usableW || h > usableH) {
            if (h <= usableW && w <= usableH) {
                [w, h] = [h, w];
                rotated = true;
            } else {
                oversize.push(piece);
                continue;
            }
        }
        if (cursorX > 0 && cursorX + w > usableW) {
            shelfY += shelfH + gap;
            shelfH = 0;
            cursorX = 0;
        }
        if (shelfY + h > usableH) flush();
        sheet.placements.push({ piece, x: cursorX, y: shelfY, rotated, w, h });
        cursorX += w + gap;
        shelfH = Math.max(shelfH, h + 5); // room for the caption
    }
    flush();
    return { sheets, oversize };
}

// ── SVG ───────────────────────────────────────────────────────────

const n3 = (v: number) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(3));

export interface RenderOpts {
    sideMm: number;
    pageW: number;
    pageH: number;
    margin: number;
    showFills: boolean;
    showAngles: boolean;
    showLegend: boolean;
    standalone?: boolean; // emit xmlns (needed for a .svg file)
}

export function renderSheet(
    sheet: Sheet,
    placed: Map<number, Placed>,
    creases: Map<string, Crease>,
    hinges: Set<string>,
    o: RenderOpts,
): string {
    const { pageW, pageH, margin } = o;

    // centre the placed block within the usable area
    let usedW = 0;
    let usedH = 0;
    for (const pl of sheet.placements) {
        usedW = Math.max(usedW, pl.x + pl.w);
        usedH = Math.max(usedH, pl.y + pl.h);
    }
    const cx = Math.max(0, (pageW - 2 * margin - usedW) / 2);
    const cy = Math.max(0, (pageH - 2 * margin - usedH) / 2);

    const out: string[] = [];
    out.push(
        `<svg class="sheet"${o.standalone === false ? "" : ' xmlns="http://www.w3.org/2000/svg"'} ` +
            `width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    );
    out.push(`<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#fff"/>`);

    for (const pl of sheet.placements) {
        const { piece } = pl;
        const map = (q: P2): P2 => {
            const ax = (q[0] - piece.minX) * o.sideMm;
            const ay = (q[1] - piece.minY) * o.sideMm;
            const bx = pl.rotated ? piece.h * o.sideMm - ay : ax;
            const by = pl.rotated ? ax : ay;
            return [margin + cx + pl.x + bx, margin + cy + pl.y + by];
        };

        const fills: string[] = [];
        const creaseLines: string[] = [];
        const cutLines: string[] = [];
        const labels: string[] = [];
        const drawn = new Set<string>();

        for (const fid of piece.faceIds) {
            const p = placed.get(fid)!;
            const pts = p.poly.map(map);

            if (o.showFills) {
                fills.push(
                    `<polygon points="${pts
                        .map((q) => `${n3(q[0])},${n3(q[1])}`)
                        .join(" ")}" fill="${p.thick ? "#f2f2fa" : "#fdf4ea"}"/>`,
                );
            }

            for (let i = 0; i < 4; i++) {
                const va = p.verts[i];
                const vb = p.verts[(i + 1) % 4];
                const a = pts[i];
                const b = pts[(i + 1) % 4];
                const key = va < vb ? `${va}-${vb}` : `${vb}-${va}`;
                const cr = edgeRole(va, vb, hinges, creases);
                if (cr) {
                    if (drawn.has(key)) continue;
                    drawn.add(key);
                    const col = cr.mountain ? M_COLOR : V_COLOR;
                    creaseLines.push(
                        `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                            `stroke="${col}" stroke-width="0.28" stroke-dasharray="${DASH[cr.fold] ?? "2 2"}"/>`,
                    );
                    if (o.showAngles) {
                        labels.push(
                            `<text x="${n3((a[0] + b[0]) / 2)}" y="${n3((a[1] + b[1]) / 2)}" ` +
                                `font-size="2.1" font-family="sans-serif" fill="${col}" ` +
                                `text-anchor="middle" dominant-baseline="central">${cr.fold}</text>`,
                        );
                    }
                } else {
                    cutLines.push(
                        `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                            `stroke="#111" stroke-width="0.5" stroke-linecap="round"/>`,
                    );
                }
            }
        }

        out.push(...fills, ...creaseLines, ...cutLines, ...labels);
        const nRh = piece.faceIds.length;
        out.push(
            `<text x="${n3(margin + cx + pl.x)}" y="${n3(margin + cy + pl.y + pl.h + 4)}" ` +
                `font-size="3.2" font-family="sans-serif" fill="#aaa">` +
                `${piece.id + 1} · ${nRh} rhomb${nRh === 1 ? "" : "i"}` +
                `${pl.rotated ? " · rotated" : ""}</text>`,
        );
    }

    if (o.showLegend) {
        const ly = pageH - margin + 4.5;
        let x = margin;
        const txt = (s: string, col: string) => {
            out.push(
                `<text x="${n3(x)}" y="${n3(ly)}" font-size="3" font-family="sans-serif" fill="${col}">${s}</text>`,
            );
        };
        const line = (col: string, dash: string | null, wid: number) => {
            out.push(
                `<line x1="${n3(x)}" y1="${n3(ly - 1)}" x2="${n3(x + 12)}" y2="${n3(ly - 1)}" ` +
                    `stroke="${col}" stroke-width="${wid}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`,
            );
            x += 15;
        };
        txt("cut", "#666");
        x += 9;
        line("#111", null, 0.5);
        for (const f of [36, 72, 108]) {
            txt(`${f}°`, "#666");
            x += f === 108 ? 9 : 7;
            line("#666", DASH[f], 0.28);
        }
        txt("mountain", M_COLOR);
        x += 20;
        txt("valley", V_COLOR);
    }

    out.push(`</svg>`);
    return out.join("\n");
}
