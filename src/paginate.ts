// Stage B: split one finished net across pages, with labelled joins.
//
// The net that comes out of branch-cut routing is a single connected piece, and at
// generation 3 it is much bigger than a sheet of paper. Splitting it is not the same
// problem as unfolding it: the unfolding is fixed and correct, and all that remains
// is deciding where to *stop* a page and carry on to the next.
//
// A split runs along a hinge, never through a rhombus, so every face lands whole on
// exactly one sheet. The severed hinge stops being a fold and becomes a taped join —
// which is the thing that needs a label, since the two halves end up on different
// pages and have to be matched by eye.
//
// Two facts make this tractable:
//
//   * The hinges form a spanning tree of the faces. Removing k tree edges gives
//     exactly k+1 components, so **parts = cuts + 1**: minimising the number of
//     taped joins and minimising the number of sheets are the same objective. There
//     is nothing to trade off.
//   * All sheets share one orientation. Each page is then an axis-aligned rectangle
//     in a fixed frame, so "does this set of faces fit" is a bounding-box test. It
//     costs a little paper against rotating each sheet to fit, and buys the ability
//     to lay the printed pages on a table and see them line up.

import { edgeRole } from "./unfold.js";
import type { Placed, Crease } from "./unfold.js";
import { CLUSTER_TINTS, M_COLOR, V_COLOR } from "./sheet.js";

type P2 = [number, number];

export interface Join {
    letter: string; // A, B, … AA, AB — unique per severed hinge
    key: string; // edge key of the severed hinge
    va: number;
    vb: number; // its two tiling vertices
    faceA: number;
    faceB: number; // the faces it used to hold together
    sheetA: number;
    sheetB: number; // 0-based; page numbers are these + 1
}

export interface Page {
    index: number; // 0-based
    faceIds: number[];
    // bounding box in net units, in the shared orientation
    minX: number;
    minY: number;
    w: number;
    h: number;
}

export interface Pagination {
    pages: Page[];
    joins: Join[];
    angle: number; // the one orientation every page uses, radians
    fits: boolean; // false if some single rhombus cannot fit, which is hopeless
}

const rot = (q: P2, a: number): P2 => [
    q[0] * Math.cos(a) - q[1] * Math.sin(a),
    q[0] * Math.sin(a) + q[1] * Math.cos(a),
];

// A, B, … Z, AA, AB, … — spreadsheet columns, so labels stay short and ordered.
export function joinLabel(n: number): string {
    let s = "";
    n += 1;
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

const merge = (a: Box, b: Box): Box => ({
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
});

const fitsBox = (b: Box, pw: number, ph: number): boolean =>
    b.x1 - b.x0 <= pw + 1e-9 && b.y1 - b.y0 <= ph + 1e-9;

type Adjacency = Map<number, Array<{ other: number; key: string }>>;

// Two faces share a hinge iff they share that edge, so index faces by edge key and
// read the pairs off. Adjacency does not depend on orientation, so paginateBest
// builds it once and hands it to every angle.
export function buildAdjacency(
    placed: Map<number, Placed>,
    hinges: Set<string>,
    ekey: (a: number, b: number) => string,
): Adjacency {
    const byEdge = new Map<string, number[]>();
    for (const [id, p] of placed) {
        for (let i = 0; i < 4; i++) {
            const key = ekey(p.verts[i], p.verts[(i + 1) % 4]);
            if (!hinges.has(key)) continue;
            let arr = byEdge.get(key);
            if (!arr) byEdge.set(key, (arr = []));
            arr.push(id);
        }
    }
    const adj: Adjacency = new Map();
    for (const id of placed.keys()) adj.set(id, []);
    for (const [key, faces] of byEdge) {
        if (faces.length !== 2) continue;
        const [a, b] = faces;
        adj.get(a)!.push({ other: b, key });
        adj.get(b)!.push({ other: a, key });
    }
    return adj;
}

// The development only ever uses about nine edge directions, so the orientations
// worth trying are those directions and their perpendiculars — a couple of dozen
// angles, checked exhaustively rather than searched.
export function candidateAngles(placed: Map<number, Placed>): number[] {
    const seen = new Set<string>();
    const out: number[] = [];
    for (const p of placed.values()) {
        for (let i = 0; i < 4; i++) {
            const a = p.poly[i] as P2;
            const b = p.poly[(i + 1) % 4] as P2;
            let t = Math.atan2(b[1] - a[1], b[0] - a[0]);
            t = ((t % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); // mod 90°
            const k = t.toFixed(6);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(-t);
        }
        if (out.length > 40) break;
    }
    if (!out.some((a) => Math.abs(a) < 1e-9)) out.push(0);
    return out;
}

/**
 * Paginate at whichever single orientation needs the fewest sheets. All pages share
 * that angle, so the printed sheets still lie together the way they will assemble.
 */
export function paginateBest(
    placed: Map<number, Placed>,
    hinges: Set<string>,
    pageW: number,
    pageH: number,
    ekey: (a: number, b: number) => string,
): Pagination {
    let best: Pagination | null = null;
    const adj = buildAdjacency(placed, hinges, ekey);
    for (const angle of candidateAngles(placed)) {
        const p = paginateNet(placed, hinges, pageW, pageH, angle, ekey, adj);
        if (!p.fits) continue;
        const waste = p.pages.reduce((s, x) => s + (pageW * pageH - x.w * x.h), 0);
        if (
            !best ||
            p.pages.length < best.pages.length ||
            (p.pages.length === best.pages.length &&
                waste <
                    best.pages.reduce(
                        (s, x) => s + (pageW * pageH - x.w * x.h),
                        0,
                    ))
        ) {
            best = p;
        }
    }
    return best ?? paginateNet(placed, hinges, pageW, pageH, 0, ekey, adj);
}

/**
 * Split a one-piece net into pages.
 *
 * `pageW`/`pageH` are the printable area **in net units** — that is, physical
 * printable size divided by the rhombus side, so the caller owns the unit choice.
 */
export function paginateNet(
    placed: Map<number, Placed>,
    hinges: Set<string>,
    pageW: number,
    pageH: number,
    angle: number,
    ekey: (a: number, b: number) => string,
    adjIn?: Adjacency,
): Pagination {
    const ids = [...placed.keys()];

    // rotated corner positions, computed once
    const poly = new Map<number, P2[]>();
    const box = new Map<number, Box>();
    for (const id of ids) {
        const pts = placed.get(id)!.poly.map((q) => rot(q as P2, angle));
        poly.set(id, pts);
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const q of pts) {
            if (q[0] < x0) x0 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0];
            if (q[1] > y1) y1 = q[1];
        }
        box.set(id, { x0, y0, x1, y1 });
    }

    // A single rhombus larger than the page is unsalvageable — say so rather than
    // emitting one sheet per face.
    for (const id of ids) {
        if (!fitsBox(box.get(id)!, pageW, pageH)) {
            return { pages: [], joins: [], angle, fits: false };
        }
    }

    // Hinge adjacency: the spanning tree of faces. Indexed by edge key rather than
    // searched — the inner scan over every other face made this O(n²), and
    // paginateBest calls it once per candidate angle.
    const adj = adjIn ?? buildAdjacency(placed, hinges, ekey);

    // Root near the middle so the accumulation grows outward rather than sweeping
    // from one end, which produces more evenly filled pages.
    let cx = 0;
    let cy = 0;
    for (const id of ids) {
        const b = box.get(id)!;
        cx += (b.x0 + b.x1) / 2;
        cy += (b.y0 + b.y1) / 2;
    }
    cx /= ids.length;
    cy /= ids.length;
    let root = ids[0];
    let bestD = Infinity;
    for (const id of ids) {
        const b = box.get(id)!;
        const d = Math.hypot((b.x0 + b.x1) / 2 - cx, (b.y0 + b.y1) / 2 - cy);
        if (d < bestD) {
            bestD = d;
            root = id;
        }
    }

    // Iterative post-order, since a 1380-face tree would risk the call stack.
    const parent = new Map<number, { face: number; key: string }>();
    const order: number[] = [];
    const seen = new Set<number>([root]);
    const stack = [root];
    while (stack.length) {
        const cur = stack.pop()!;
        order.push(cur);
        for (const link of adj.get(cur) ?? []) {
            if (seen.has(link.other)) continue;
            seen.add(link.other);
            parent.set(link.other, { face: cur, key: link.key });
            stack.push(link.other);
        }
    }
    order.reverse(); // children before parents

    // Bottom-up accumulation. Invariant: every pending set fits a page, so emitting
    // one is always legal. A child that will not merge becomes its own sheet and its
    // hinge to the parent becomes a join.
    const pendingFaces = new Map<number, number[]>();
    const pendingBox = new Map<number, Box>();
    const pages: Page[] = [];
    const joins: Join[] = [];

    const emit = (faces: number[], b: Box): number => {
        pages.push({
            index: pages.length,
            faceIds: faces,
            minX: b.x0,
            minY: b.y0,
            w: b.x1 - b.x0,
            h: b.y1 - b.y0,
        });
        return pages.length - 1;
    };
    const sheetOf = new Map<number, number>();

    for (const node of order) {
        let faces = [node];
        let b = { ...box.get(node)! };

        const kids = (adj.get(node) ?? [])
            .filter((l) => parent.get(l.other)?.face === node)
            .map((l) => ({
                ...l,
                n: (pendingFaces.get(l.other) ?? []).length,
            }))
            // Biggest first: a large subtree that cannot merge is better discovered
            // before the page has been filled with small ones.
            .sort((x, y) => y.n - x.n);

        for (const kid of kids) {
            const kf = pendingFaces.get(kid.other);
            const kb = pendingBox.get(kid.other);
            if (!kf || !kb || !kf.length) continue;
            const m = merge(b, kb);
            if (fitsBox(m, pageW, pageH)) {
                faces = faces.concat(kf);
                b = m;
            } else {
                const sheet = emit(kf, kb);
                for (const f of kf) sheetOf.set(f, sheet);
                joins.push({
                    letter: "",
                    key: kid.key,
                    va: -1,
                    vb: -1,
                    faceA: node,
                    faceB: kid.other,
                    sheetA: -1,
                    sheetB: sheet,
                });
            }
            pendingFaces.delete(kid.other);
            pendingBox.delete(kid.other);
        }
        pendingFaces.set(node, faces);
        pendingBox.set(node, b);
    }

    // whatever is still pending at the root is the last sheet
    const rootFaces = pendingFaces.get(root)!;
    const rootSheet = emit(rootFaces, pendingBox.get(root)!);
    for (const f of rootFaces) sheetOf.set(f, rootSheet);

    // Resolve the parent side of every join now that all faces have a sheet, and
    // recover the vertex pair from the shared edge.
    joins.forEach((j, i) => {
        j.sheetA = sheetOf.get(j.faceA)!;
        j.letter = joinLabel(i);
        const pa = placed.get(j.faceA)!;
        const pb = placed.get(j.faceB)!;
        const shared = pa.verts.filter((v) => pb.verts.includes(v));
        j.va = shared[0] ?? -1;
        j.vb = shared[1] ?? -1;
    });

    return { pages, joins, angle, fits: true };
}

// ── rendering one page ────────────────────────────────────────────
//
// Close to renderSheet, but a paginated page is a different thing: a subset of the
// faces, all pages sharing one orientation, and — the point of the exercise — the
// severed hinges carrying a letter and the page number of their partner, so the
// two halves can be found and taped without hunting.

const DASH: Record<number, string> = { 36: "2 2", 72: "6 3", 108: "11 3" };
export const TAB_MM = 5.0; // tab altitude: enough for 3 mm text with air around it

// The tab on a cut edge, shaped as the adjoining rhombus truncated at height `h`.
// Its slanted sides therefore carry that rhombus's own angles, so the tab reads as
// the beginning of the piece that continues on the other sheet.
function tabQuad(
    a: P2,
    b: P2,
    inward: P2,
    partner: Placed,
    va: number,
    vb: number,
    map: (q: P2) => P2,
    h: number,
): { quad: P2[]; cx: number; cy: number; deg: number } {
    // The partner's two corners away from the shared edge give its offset direction.
    const idxA = partner.verts.indexOf(va);
    const idxB = partner.verts.indexOf(vb);
    let d: P2 = [0, 0];
    if (idxA >= 0 && idxB >= 0) {
        const oppA = map(partner.poly[(idxA + 2) % 4] as P2);
        const pa = map(partner.poly[idxA] as P2);
        d = [oppA[0] - pa[0], oppA[1] - pa[1]];
    }
    // Perpendicular to the edge, pointing away from the face this tab hangs off.
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;
    const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if ((mid[0] - inward[0]) * nx + (mid[1] - inward[1]) * ny < 0) {
        nx = -nx;
        ny = -ny;
    }
    // Scale the partner's offset so its perpendicular component is exactly h; fall
    // back to a square tab if the partner geometry is unavailable.
    const perp = d[0] * nx + d[1] * ny;
    const off: P2 =
        Math.abs(perp) > 1e-6
            ? [(d[0] * h) / perp, (d[1] * h) / perp]
            : [nx * h, ny * h];

    const quad: P2[] = [a, b, [b[0] + off[0], b[1] + off[1]], [a[0] + off[0], a[1] + off[1]]];
    let deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (deg > 90) deg -= 180;
    if (deg < -90) deg += 180;
    return {
        quad,
        cx: mid[0] + off[0] / 2,
        cy: mid[1] + off[1] / 2,
        deg,
    };
}
const n3 = (v: number) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(3));

export interface PageRenderOpts {
    sideMm: number;
    pageW: number; // physical page, mm
    pageH: number;
    margin: number; // mm
    fillMode: "none" | "type" | "cluster";
    showLegend?: boolean;
    standalone?: boolean;
    // Height-derived decoration. Whether these appear is a *rendering* choice,
    // independent of the height slider — the slider says which way up the surface
    // sits and how strongly the screen shades it, these say what reaches the paper.
    shading?: boolean;
    isoglosses?: boolean;
    // Which way up to render. The slider decides, except that a flat setting carries
    // no hills-or-dales information, so rendering falls back to hills.
    dales?: boolean;
    // Height index per tiling vertex, and the range, so paginate need not import the
    // tiling itself.
    indexOf?: (v: number) => number;
    indexRange?: [number, number];
}

// Light-to-dark along the height gradient. Kept at full strength for print: the
// screen slider may be set shallow for looking at, but a printed sheet either shows
// the relief legibly or should not bother.
function shadeStops(fill: string): [string, string] {
    return [mixHex(fill, "#ffffff", 0.5), mixHex(fill, "#000000", 0.4)];
}

function mixHex(a: string, b: string, t: number): string {
    const p = (h: string) => [
        parseInt(h.slice(1, 3), 16),
        parseInt(h.slice(3, 5), 16),
        parseInt(h.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = p(a);
    const [r2, g2, b2] = p(b);
    const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
    return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

// The seven quarter-index contours across a rhombus, from its lowest corner.
function isoSegments(pts: P2[], idx: number[]): Array<[P2, P2]> {
    let k = 0;
    for (let i = 1; i < 4; i++) if (idx[i] < idx[k]) k = i;
    const lo = pts[k];
    const r1 = pts[(k + 1) % 4];
    const hi = pts[(k + 2) % 4];
    const r3 = pts[(k + 3) % 4];
    const mix = (a: P2, b: P2, s: number): P2 => [
        a[0] + (b[0] - a[0]) * s,
        a[1] + (b[1] - a[1]) * s,
    ];
    const out: Array<[P2, P2]> = [];
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

export function renderPage(
    pg: Pagination,
    pageIndex: number,
    placed: Map<number, Placed>,
    creases: Map<string, Crease>,
    hinges: Set<string>,
    ekey: (a: number, b: number) => string,
    o: PageRenderOpts,
): string {
    const page = pg.pages[pageIndex];
    const { pageW, pageH, margin, sideMm } = o;
    const usableW = pageW - 2 * margin;
    const usableH = pageH - 2 * margin;

    // Centre this page's own bounding box inside the printable area. The rotation is
    // shared, so pages still relate to one another; only the offset differs.
    const cx = margin + (usableW - page.w * sideMm) / 2;
    const cy = margin + (usableH - page.h * sideMm) / 2;
    const map = (q: P2): P2 => {
        const r = rot(q, pg.angle);
        return [cx + (r[0] - page.minX) * sideMm, cy + (r[1] - page.minY) * sideMm];
    };

    const out: string[] = [];
    out.push(
        `<svg class="sheet"${o.standalone === false ? "" : ' xmlns="http://www.w3.org/2000/svg"'} ` +
            `width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    );
    out.push(`<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#fff"/>`);

    const onThisPage = new Set(page.faceIds);
    // Severed hinges touching this page, by edge key, with the partner page.
    const joinHere = new Map<
        string,
        { letter: string; partner: number; partnerFace: number }
    >();
    for (const j of pg.joins) {
        if (j.sheetA === pageIndex) {
            joinHere.set(j.key, {
                letter: j.letter,
                partner: j.sheetB,
                partnerFace: j.faceB,
            });
        } else if (j.sheetB === pageIndex) {
            joinHere.set(j.key, {
                letter: j.letter,
                partner: j.sheetA,
                partnerFace: j.faceA,
            });
        }
    }

    const defs: string[] = [];
    const isoLines: string[] = [];
    const [idxLo, idxHi] = o.indexRange ?? [1, 4];
    const heightOf = (v: number): number => {
        const raw = o.indexOf ? o.indexOf(v) : 1;
        return o.dales ? idxLo + idxHi - raw : raw;
    };

    const fills: string[] = [];
    const creaseLines: string[] = [];
    const cutLines: string[] = [];
    const joinLines: string[] = [];
    const labels: string[] = [];
    const drawn = new Set<string>();

    for (const fid of page.faceIds) {
        const p = placed.get(fid)!;
        const pts = p.poly.map((q) => map(q as P2));

        if (o.fillMode !== "none") {
            const base =
                o.fillMode === "cluster"
                    ? (CLUSTER_TINTS[p.cluster] ?? "#f4f4f4")
                    : p.thick
                      ? "#f2f2fa"
                      : "#fdf4ea";
            const shape = pts.map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ");
            const vidx = p.verts.map(heightOf);
            if (o.shading) {
                // Gradient along the tile's own fall line, low corner to high.
                let cLo = 0;
                let cHi = 0;
                for (let t = 1; t < 4; t++) {
                    if (vidx[t] < vidx[cLo]) cLo = t;
                    if (vidx[t] > vidx[cHi]) cHi = t;
                }
                const [s0, s1] = shadeStops(base);
                const gid = `g${pageIndex}_${fid}`;
                defs.push(
                    `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" ` +
                        `x1="${n3(pts[cLo][0])}" y1="${n3(pts[cLo][1])}" ` +
                        `x2="${n3(pts[cHi][0])}" y2="${n3(pts[cHi][1])}">` +
                        `<stop offset="0" stop-color="${s0}"/>` +
                        `<stop offset="1" stop-color="${s1}"/></linearGradient>`,
                );
                fills.push(`<polygon points="${shape}" fill="url(#${gid})"/>`);
            } else {
                fills.push(`<polygon points="${shape}" fill="${base}"/>`);
            }
            if (o.isoglosses) {
                for (const [u1, u2] of isoSegments(pts, vidx)) {
                    isoLines.push(
                        `<line x1="${n3(u1[0])}" y1="${n3(u1[1])}" x2="${n3(u2[0])}" y2="${n3(u2[1])}" ` +
                            `stroke="#7a7a7a" stroke-width="0.12" stroke-opacity="0.75"/>`,
                    );
                }
            }
        }

        let ccx = 0;
        let ccy = 0;
        for (const q of pts) {
            ccx += q[0] / 4;
            ccy += q[1] / 4;
        }

        for (let i = 0; i < 4; i++) {
            const va = p.verts[i];
            const vb = p.verts[(i + 1) % 4];
            const a = pts[i];
            const b = pts[(i + 1) % 4];
            const key = ekey(va, vb);

            const join = joinHere.get(key);
            if (join) {
                // A severed hinge: cut it, then say where its other half went.
                if (!drawn.has(key)) {
                    drawn.add(key);
                    joinLines.push(
                        `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                            `stroke="#111" stroke-width="0.6" stroke-linecap="round"/>`,
                    );
                }
                // The label goes *outside* the cut, on a tab shaped like the start of
                // the rhombus it joins to. Because a rhombus's adjacent angles are
                // supplementary, truncating the neighbour at a constant height gives a
                // parallelogram rather than a general trapezoid — the tab really is a
                // slice of the piece that belongs there.
                const tab = tabQuad(
                    a,
                    b,
                    [ccx, ccy],
                    placed.get(join.partnerFace)!,
                    p.verts[i],
                    p.verts[(i + 1) % 4],
                    map,
                    TAB_MM,
                );
                labels.push(
                    `<polygon points="${tab.quad.map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ")}" ` +
                        `fill="#fff" stroke="#111" stroke-width="0.3" stroke-dasharray="1.6 1.2"/>`,
                );
                // Text runs parallel to the cut, upright whichever way the edge lies.
                labels.push(
                    `<text x="${n3(tab.cx)}" y="${n3(tab.cy)}" ` +
                        `transform="rotate(${n3(tab.deg)} ${n3(tab.cx)} ${n3(tab.cy)})" ` +
                        `font-size="3" font-family="sans-serif" font-weight="bold" fill="#111" ` +
                        `text-anchor="middle" dominant-baseline="central">` +
                        `${join.letter}▸${join.partner + 1}</text>`,
                );
                continue;
            }

            // A hinge whose neighbour is on this page is a crease; anything else,
            // including a hinge to a face that is simply absent, is a cut.
            const cr = edgeRole(va, vb, hinges, creases);
            const neighbourHere =
                cr &&
                page.faceIds.some(
                    (g) =>
                        g !== fid &&
                        placed.get(g)!.verts.includes(va) &&
                        placed.get(g)!.verts.includes(vb),
                );
            if (cr && neighbourHere) {
                if (drawn.has(key)) continue;
                drawn.add(key);
                creaseLines.push(
                    `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                        `stroke="${cr.mountain ? M_COLOR : V_COLOR}" stroke-width="0.28" ` +
                        `stroke-dasharray="${DASH[cr.fold] ?? "2 2"}"/>`,
                );
            } else {
                cutLines.push(
                    `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                        `stroke="#111" stroke-width="0.5" stroke-linecap="round"/>`,
                );
            }
        }
    }
    void onThisPage;

    if (defs.length) out.push(`<defs>${defs.join("")}</defs>`);
    out.push(...fills, ...isoLines, ...creaseLines, ...cutLines, ...joinLines, ...labels);

    // Sheet number, and the joins on this page, so you know what to look for.
    const partners = [...joinHere.values()]
        .map((j) => `${j.letter}▸${j.partner + 1}`)
        .sort()
        .join("  ");
    out.push(
        `<text x="${n3(margin)}" y="${n3(pageH - margin + 5)}" font-size="4" ` +
            `font-family="sans-serif" font-weight="bold" fill="#111">` +
            `Sheet ${pageIndex + 1} of ${pg.pages.length}</text>`,
    );
    if (partners) {
        out.push(
            `<text x="${n3(margin + 32)}" y="${n3(pageH - margin + 5)}" font-size="3.4" ` +
                `font-family="sans-serif" fill="#555">joins: ${partners}</text>`,
        );
    }
    out.push(
        `<text x="${n3(pageW - margin)}" y="${n3(pageH - margin + 5)}" font-size="3.2" ` +
            `font-family="sans-serif" fill="#888" text-anchor="end">` +
            `${page.faceIds.length} rhombi · side ${(sideMm / 25.4).toFixed(3)} in</text>`,
    );

    out.push(thumbnail(pg, pageIndex, placed, o, cx, cy, page));
    out.push("</svg>");
    return out.join("\n");
}

// ── the locator thumbnail ─────────────────────────────────────────
//
// A sheet on its own tells you nothing about where it belongs. This is the whole net
// at a glance with the current sheet picked out and every join marked — so before
// cutting you can see which end you are holding, and after cutting you can find the
// piece a tab points at.
//
// It goes in whichever corner of the printable area is least covered by the net, so
// it lands in real whitespace rather than on top of the work.

// Sized by area, not by side: a long thin net scaled to fit a 40 mm box comes out
// well under "a couple of square inches". Aim at the area and cap the long side.
const THUMB_AREA_MM2 = 1500; // ≈ 2.3 square inches
const THUMB_MAX_MM = 54;

function thumbnail(
    pg: Pagination,
    pageIndex: number,
    placed: Map<number, Placed>,
    o: PageRenderOpts,
    contentX: number,
    contentY: number,
    page: Page,
): string {
    const { pageW, pageH, margin, sideMm } = o;

    // whole net, in the shared orientation
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const rotated = new Map<number, P2[]>();
    for (const [id, p] of placed) {
        const pts = p.poly.map((q) => rot(q as P2, pg.angle));
        rotated.set(id, pts);
        for (const q of pts) {
            if (q[0] < x0) x0 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0];
            if (q[1] > y1) y1 = q[1];
        }
    }
    const netW = x1 - x0;
    const netH = y1 - y0;
    let k = Math.sqrt(THUMB_AREA_MM2 / (netW * netH)); // mm per net unit
    k = Math.min(k, THUMB_MAX_MM / Math.max(netW, netH));
    const tw = netW * k;
    const th = netH * k;

    // Least-covered corner of the printable area, scored against the *faces* rather
    // than their overall bounding box: these nets are snakey, so there is usually
    // real whitespace inside the box and the box would hide it.
    const boxes: Array<[number, number, number, number]> = [];
    for (const fid of page.faceIds) {
        const pts = rotated.get(fid)!;
        let bx0 = Infinity;
        let by0 = Infinity;
        let bx1 = -Infinity;
        let by1 = -Infinity;
        for (const q of pts) {
            const X = contentX + (q[0] - page.minX) * sideMm;
            const Y = contentY + (q[1] - page.minY) * sideMm;
            if (X < bx0) bx0 = X;
            if (Y < by0) by0 = Y;
            if (X > bx1) bx1 = X;
            if (Y > by1) by1 = Y;
        }
        boxes.push([bx0, by0, bx1, by1]);
    }
    const pad = 2;
    const corners: Array<[number, number]> = [
        [margin + pad, margin + pad],
        [pageW - margin - tw - pad, margin + pad],
        [margin + pad, pageH - margin - th - pad - 6],
        [pageW - margin - tw - pad, pageH - margin - th - pad - 6],
    ];
    let best = corners[1];
    let bestOverlap = Infinity;
    for (const c of corners) {
        let ov = 0;
        for (const b of boxes) {
            ov +=
                Math.max(0, Math.min(c[0] + tw, b[2]) - Math.max(c[0], b[0])) *
                Math.max(0, Math.min(c[1] + th, b[3]) - Math.max(c[1], b[1]));
        }
        if (ov < bestOverlap - 1e-9) {
            bestOverlap = ov;
            best = c;
        }
    }
    const [tx, ty] = best;
    const T = (q: P2): P2 => [tx + (q[0] - x0) * k, ty + (q[1] - y0) * k];

    const g: string[] = [];
    g.push(
        `<rect x="${n3(tx - 1.5)}" y="${n3(ty - 1.5)}" width="${n3(tw + 3)}" height="${n3(th + 3)}" ` +
            `fill="#fff" fill-opacity="0.92" stroke="#ddd" stroke-width="0.25"/>`,
    );

    const here = new Set(page.faceIds);
    const others: string[] = [];
    const mine: string[] = [];
    for (const [id, pts] of rotated) {
        const d = pts.map((q) => T(q));
        const poly = d.map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ");
        if (here.has(id)) {
            mine.push(
                `<polygon points="${poly}" fill="#6a5acd" fill-opacity="0.5" stroke="#6a5acd" stroke-width="0.12"/>`,
            );
        } else {
            others.push(
                `<polygon points="${poly}" fill="none" stroke="#c8c8c8" stroke-width="0.12"/>`,
            );
        }
    }
    g.push(...others, ...mine);

    // Joins: every one marked, the ones on this sheet lettered.
    for (const j of pg.joins) {
        const pa = placed.get(j.faceA);
        const pb = placed.get(j.faceB);
        if (!pa || !pb) continue;
        const ia = pa.verts.indexOf(j.va);
        const ib = pa.verts.indexOf(j.vb);
        if (ia < 0 || ib < 0) continue;
        const ra = rotated.get(j.faceA)!;
        const m: P2 = [
            (ra[ia][0] + ra[ib][0]) / 2,
            (ra[ia][1] + ra[ib][1]) / 2,
        ];
        const q = T(m);
        const onThis = j.sheetA === pageIndex || j.sheetB === pageIndex;
        g.push(
            `<circle cx="${n3(q[0])}" cy="${n3(q[1])}" r="${onThis ? 1.1 : 0.6}" ` +
                `fill="${onThis ? "#c0392b" : "#fff"}" stroke="#c0392b" stroke-width="0.25"/>`,
        );
        if (onThis) {
            g.push(
                `<text x="${n3(q[0] + 1.7)}" y="${n3(q[1] - 1.1)}" font-size="2.4" ` +
                    `font-family="sans-serif" font-weight="bold" fill="#c0392b">${j.letter}</text>`,
            );
        }
    }

    g.push(
        `<text x="${n3(tx)}" y="${n3(ty + th + 3.4)}" font-size="2.6" font-family="sans-serif" ` +
            `fill="#666">whole net · sheet ${pageIndex + 1} shaded</text>`,
    );
    return g.join("\n");
}
