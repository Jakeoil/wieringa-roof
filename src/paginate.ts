// Stage B: split one finished net across pages, with labeled joins.
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
//     exactly k+1 components, so **parts = cuts + 1**: minimizing the number of
//     taped joins and minimizing the number of sheets are the same objective. There
//     is nothing to trade off.
//   * All sheets share one orientation. Each page is then an axis-aligned rectangle
//     in a fixed frame, so "does this set of faces fit" is a bounding-box test. It
//     costs a little paper against rotating each sheet to fit, and buys the ability
//     to lay the printed pages on a table and see them line up.

import { edgeRole, intersectionArea } from "./unfold.js";
import type { Placed, Crease } from "./unfold.js";
import { M_COLOR, V_COLOR } from "./sheet.js";
import { tileFill } from "./geometry.js";
import type { FillMode } from "./geometry.js";

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
    // Tab height per join edge key, in mm. Full height unless the tab would run
    // over a rhombus that legitimately occupies that space; 0 means no room at all.
    tabH?: Map<string, number>;
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

// ── tab fitting ───────────────────────────────────────────────────
//
// A tab hangs into the space beyond its cut edge, and that space is often occupied:
// the net folds back on itself, so the neighbor across the cut may be absent while
// some *other* rhombus of the same sheet sits right there. A tab drawn over it
// obscures real work and gets cut through.
//
// So each tab is shrunk until it clears every face on its own sheet, and then the
// two halves of a join are given the smaller of their two heights — they are taped
// to each other, so they have to stay congruent.

const TAB_MIN_MM = 2.4; // below this there is no room for the letter; drop the tab

// The faint stroke: unoccupied rhombi on the mini, and the folds inside a sheet.
// One constant for both, since they are meant to read as the same weight and drifted
// apart when they were written out separately.
//
// Darker than it looks like it needs to be. These lines sit on white for the
// unoccupied rhombi but on a colored fill inside a sheet, and a gray that reads
// perfectly well against white all but vanishes against the fill. Chosen by
// measuring contrast rather than by eye: 5.1 against white, 2.45 against the worst
// sheet color. It has to stay clearly lighter than the cuts at #333 and the border
// at #111 — a fold that competes with a cut is worse than a fold you cannot see.
const PATCH_GRAY = "#6e6e6e";

function pageTransform(pg: Pagination, pageIndex: number, o: PageRenderOpts) {
    const page = pg.pages[pageIndex];
    const usableW = o.pageW - 2 * o.margin;
    const usableH = o.pageH - 2 * o.margin;
    const cx = o.margin + (usableW - page.w * o.sideMm) / 2;
    const cy = o.margin + (usableH - page.h * o.sideMm) / 2;
    const map = (q: P2): P2 => {
        const r = rot(q, pg.angle);
        return [
            cx + (r[0] - page.minX) * o.sideMm,
            cy + (r[1] - page.minY) * o.sideMm,
        ];
    };
    return { page, cx, cy, map };
}

/** Largest tab height on one side of a join that touches nothing. */
function safeHeight(
    pg: Pagination,
    pageIndex: number,
    hostFace: number,
    partnerFace: number,
    va: number,
    vb: number,
    placed: Map<number, Placed>,
    o: PageRenderOpts,
): number {
    const { page, map } = pageTransform(pg, pageIndex, o);
    const host = placed.get(hostFace);
    const partner = placed.get(partnerFace);
    if (!host || !partner) return 0;

    const i = host.verts.indexOf(va);
    const j = host.verts.indexOf(vb);
    if (i < 0 || j < 0) return 0;
    const a = map(host.poly[i] as P2);
    const b = map(host.poly[j] as P2);
    let ccx = 0;
    let ccy = 0;
    for (const q of host.poly) {
        const m = map(q as P2);
        ccx += m[0] / 4;
        ccy += m[1] / 4;
    }

    const neighbors = page.faceIds
        .filter((f) => f !== hostFace)
        .map((f) => placed.get(f)!.poly.map((q) => map(q as P2)));

    for (let h = TAB_MM; h >= TAB_MIN_MM - 1e-9; h -= 0.4) {
        const t = tabQuad(a, b, [ccx, ccy], partner, va, vb, map, h);
        let clash = false;
        for (const nb of neighbors) {
            if (intersectionArea(t.quad, nb) > 0.02) {
                clash = true;
                break;
            }
        }
        if (!clash) return h;
    }
    return 0;
}

/** Tab height for every join, shared between its two halves. */
export function fitTabHeights(
    pg: Pagination,
    placed: Map<number, Placed>,
    o: PageRenderOpts,
): Map<string, number> {
    const out = new Map<string, number>();
    for (const j of pg.joins) {
        const hA = safeHeight(pg, j.sheetA, j.faceA, j.faceB, j.va, j.vb, placed, o);
        const hB = safeHeight(pg, j.sheetB, j.faceB, j.faceA, j.va, j.vb, placed, o);
        out.set(j.key, Math.min(hA, hB));
    }
    return out;
}

// ── rendering one page ────────────────────────────────────────────
//
// Close to renderSheet, but a paginated page is a different thing: a subset of the
// faces, all pages sharing one orientation, and — the point of the exercise — the
// severed hinges carrying a letter and the page number of their partner, so the
// two halves can be found and taped without hunting.

// Longer dashes than `sheet.ts` uses, deliberately: a paginated sheet is printed at
// true size and read at arm's length, where the finer pattern closes up. Same order,
// same meaning — dash length grows with the fold angle — and 144 belongs here too,
// since a slab folds through it wherever a wall meets its rhombus downhill.
const DASH: Record<number, string> = { 36: "2 2", 72: "6 3", 108: "11 3", 144: "14 3 3 3" };
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
    // Offset from the shared edge to the partner's opposite edge. This must be the
    // partner's *edge* vector, not its diagonal: the diagonal shears the tab and
    // makes it far too long, and — because the two diagonals differ — makes the
    // shape depend on which end of the edge you start from, so the fitting pass and
    // the renderer disagreed about where the tab was.
    const idxA = partner.verts.indexOf(va);
    const idxB = partner.verts.indexOf(vb);
    let d: P2 = [0, 0];
    if (idxA >= 0 && idxB >= 0) {
        // the neighbor of idxA along the rhombus that is not the shared corner
        const other = (idxA + 1) % 4 === idxB ? (idxA + 3) % 4 : (idxA + 1) % 4;
        const pa = map(partner.poly[idxA] as P2);
        const po = map(partner.poly[other] as P2);
        d = [po[0] - pa[0], po[1] - pa[1]];
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

// Every render gets its own id namespace. The preview and the print copy of a sheet
// live in the same document, so a fixed id appears twice and `url(#id)` resolves to
// whichever came first — the hidden preview — leaving the printed shading blank while
// the unshaded version looked fine.
let renderSerial = 0;

export interface PageRenderOpts {
    sideMm: number;
    pageW: number; // physical page, mm
    pageH: number;
    margin: number; // mm
    fillMode: FillMode;
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
    // Drawn for the underside of the sheet. Shading is structural, so hills and dales
    // cannot exchange on their own: seen from below a mountain is a valley, and the
    // crease colors have to turn over with the shading or the sheet contradicts
    // itself. `dales` carries the height half of that (it also carries the slider's
    // own flip, which is a different thing and not undone here); this carries the
    // fold half.
    backside?: boolean;
    // Height index per tiling vertex, and the range, so paginate need not import the
    // tiling itself.
    /** height at a corner id; see `RenderOpts.indexOf` in `sheet.ts` */
    indexOf?: (v: number) => number;
    indexRange?: [number, number];
    /**
     * Slab only: reflect a second copy of the patch about this line in tiling
     * coordinates. A slab has two Penrose surfaces and the lower one is the upper seen
     * from underneath, so the mini shows the pair hinged open along the rim — the same
     * picture the tiling canvas shows while you are building it.
     */
    tailsAxis?: number;
    /**
     * Slab only: the rim, in tiling coordinates, each edge carrying the color of the
     * sheet its wall went to. The collar stands vertically and has no plan view, so
     * where it attaches shows as a colored edge — on both surfaces, since every wall
     * meets both.
     */
    rim?: Array<{ a: P2; b: P2; color: string }>;
    // The tiling itself, for the locator mini: the planar position of a face in the
    // Penrose patch, which is what you can actually recognize. The developed net is
    // a shape nobody has seen before; the tiling is the picture on every other page.
    tilingPoly?: (faceId: number) => P2[] | null;
    // This sheet's color, and everyone's, so a sheet can be identified at a glance
    // and matched against the map.
    sheetColor?: string;
    sheetColors?: string[];
}

// Distinct, print-safe sheet colors. Spread around the hue circle at a modest
// saturation: strong enough to tell apart, pale enough to draw cut lines over.
export function sheetPalette(n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        const hue = (i * 360) / Math.max(1, n) + 12;
        out.push(hslHex(hue % 360, 0.55, 0.7));
    }
    return out;
}

function hslHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const seg = Math.floor(h / 60) % 6;
    const rgb: [number, number, number] =
        seg === 0
            ? [c, x, 0]
            : seg === 1
              ? [x, c, 0]
              : seg === 2
                ? [0, c, x]
                : seg === 3
                  ? [0, x, c]
                  : seg === 4
                    ? [x, 0, c]
                    : [c, 0, x];
    const hx = (v: number) =>
        Math.round((v + m) * 255)
            .toString(16)
            .padStart(2, "0");
    return `#${hx(rgb[0])}${hx(rgb[1])}${hx(rgb[2])}`;
}

// Dark-to-light along the height gradient — structural shading, so a hill is light
// and folds as a mountain, a dale is dark and folds as a valley. Kept at full
// strength for print: the screen slider may be set shallow for looking at, but a
// printed sheet either shows the relief legibly or should not bother.
//
// The ramp is **absolute**, fixed by the patch's whole index range rather than by
// each tile's own two extremes. Per-tile stops made a tile spanning 1→3 print
// identically to one spanning 2→4, so the shading said only which way a face tilted
// and nothing about how high it sat — the same defect the canvas ramp was rebuilt to
// fix, which the print never got.
function shadeAt(
    fill: string,
    index: number,
    idxLo: number,
    idxHi: number,
): string {
    const t = Math.max(0, Math.min(1, (index - idxLo) / (idxHi - idxLo || 1)));
    return mixHex(mixHex(fill, "#000000", 0.4), mixHex(fill, "#ffffff", 0.5), t);
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
    const scope = `${pageIndex}x${++renderSerial}`;
    const page = pg.pages[pageIndex];
    const { pageW, pageH, margin, sideMm } = o;
    const usableW = pageW - 2 * margin;
    const usableH = pageH - 2 * margin;

    // Center this page's own bounding box inside the printable area. The rotation is
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

        const vidx0 = p.verts.map(heightOf);
        const base = tileFill(
            o.fillMode,
            p.group,
            p.thick,
            Math.min(...vidx0),
            p.pair,
        );
        if (base) {
            const shape = pts.map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ");
            const vidx = vidx0;
            if (o.shading) {
                // Gradient along the tile's own fall line, low corner to high.
                let cLo = 0;
                let cHi = 0;
                for (let t = 1; t < 4; t++) {
                    if (vidx[t] < vidx[cLo]) cLo = t;
                    if (vidx[t] > vidx[cHi]) cHi = t;
                }
                const s0 = shadeAt(base, vidx[cLo], idxLo, idxHi);
                const s1 = shadeAt(base, vidx[cHi], idxLo, idxHi);
                const gid = `g${scope}_${fid}`;
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
                    // **A severed hinge is still a fold.** Cutting it is a papering
                    // decision — the model does not know the net ran out of page — so
                    // once the two halves are taped back together this edge folds
                    // through the angle it always did. Drawing it plain black threw
                    // that away and left the builder to guess at the one crease that
                    // is hardest to judge, being made across a join. It keeps the
                    // heavier stroke, so it still reads as a cut you will tape, and
                    // takes the fold's own color and dash.
                    const jcr = edgeRole(va, vb, hinges, creases);
                    const jm = jcr && (o.backside ? !jcr.mountain : jcr.mountain);
                    joinLines.push(
                        `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                            (jcr
                                ? `stroke="${jm ? M_COLOR : V_COLOR}" stroke-width="0.6" ` +
                                  `stroke-dasharray="${DASH[jcr.fold] ?? "2 2"}"/>`
                                : `stroke="#111" stroke-width="0.6" stroke-linecap="round"/>`),
                    );
                }
                // The label goes *outside* the cut, on a tab shaped like the start of
                // the rhombus it joins to. Because a rhombus's adjacent angles are
                // supplementary, truncating the neighbor at a constant height gives a
                // parallelogram rather than a general trapezoid — the tab really is a
                // slice of the piece that belongs there.
                const h = pg.tabH?.get(key) ?? TAB_MM;
                if (h >= TAB_MIN_MM) {
                    const tab = tabQuad(
                        a,
                        b,
                        [ccx, ccy],
                        placed.get(join.partnerFace)!,
                        p.verts[i],
                        p.verts[(i + 1) % 4],
                        map,
                        h,
                    );
                    labels.push(
                        `<polygon points="${tab.quad.map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ")}" ` +
                            `fill="#fff" stroke="#111" stroke-width="0.3" stroke-dasharray="1.6 1.2"/>`,
                    );
                    // Text runs parallel to the cut, upright whichever way the edge lies.
                    labels.push(
                        `<text x="${n3(tab.cx)}" y="${n3(tab.cy)}" ` +
                            `transform="rotate(${n3(tab.deg)} ${n3(tab.cx)} ${n3(tab.cy)})" ` +
                            `font-size="${h < 4 ? 2.4 : 3}" font-family="sans-serif" font-weight="bold" fill="#111" ` +
                            `text-anchor="middle" dominant-baseline="central">` +
                            `${join.letter}▸${join.partner + 1}</text>`,
                    );
                } else {
                    // No room outside: put the label inside the rhombus instead of
                    // drawing over a neighbor.
                    const mx = (a[0] + b[0]) / 2;
                    const my = (a[1] + b[1]) / 2;
                    labels.push(
                        `<text x="${n3(mx + (ccx - mx) * 0.32)}" y="${n3(my + (ccy - my) * 0.32)}" ` +
                            `font-size="2.8" font-family="sans-serif" font-weight="bold" fill="#111" ` +
                            `text-anchor="middle" dominant-baseline="central">` +
                            `${join.letter}▸${join.partner + 1}</text>`,
                    );
                }
                continue;
            }

            // A hinge whose neighbor is on this page is a crease; anything else,
            // including a hinge to a face that is simply absent, is a cut.
            const cr = edgeRole(va, vb, hinges, creases);
            const neighborHere =
                cr &&
                page.faceIds.some(
                    (g) =>
                        g !== fid &&
                        placed.get(g)!.verts.includes(va) &&
                        placed.get(g)!.verts.includes(vb),
                );
            if (cr && neighborHere) {
                if (drawn.has(key)) continue;
                drawn.add(key);
                const mountain = o.backside ? !cr.mountain : cr.mountain;
                creaseLines.push(
                    `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                        `stroke="${mountain ? M_COLOR : V_COLOR}" stroke-width="0.28" ` +
                        `stroke-dasharray="${DASH[cr.fold] ?? "2 2"}"/>`,
                );
            } else {
            // **A cut is not the same as a free edge.** An interior edge that the
            // unfolding cut still folds in the finished model: you cut it, tape it,
            // and it bends through the angle it always had. Drawing it plain black
            // threw that away — and with a slab, which is closed, *every* cut is one
            // of these, so the whole sheet came out in black outline. Solid says cut,
            // dashed says fold, and the color says which way it goes either way, so
            // the builder can leave a tab on the right side instead of taping.
            // Only an edge with no crease at all is a true boundary.
                const seam = creases.get(key);
                const sm = seam && (o.backside ? !seam.mountain : seam.mountain);
                cutLines.push(
                    `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                        `stroke="${seam ? (sm ? M_COLOR : V_COLOR) : "#111"}" ` +
                        `stroke-width="0.5" stroke-linecap="round"/>`,
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

    // Legend. Went missing when pagination grew its own renderer, and a sheet of
    // dashes means nothing without it: the dash pattern is the fold angle, and the
    // color is which way it folds.
    if (o.showLegend !== false) {
        const ly = pageH - margin + 9.5;
        let lx = margin;
        const txt = (t: string, col: string, size = 2.8) => {
            out.push(
                `<text x="${n3(lx)}" y="${n3(ly)}" font-size="${size}" ` +
                    `font-family="sans-serif" fill="${col}">${t}</text>`,
            );
        };
        const swatch = (col: string, dash: string | null, wid: number) => {
            out.push(
                `<line x1="${n3(lx)}" y1="${n3(ly - 1)}" x2="${n3(lx + 10)}" y2="${n3(ly - 1)}" ` +
                    `stroke="${col}" stroke-width="${wid}"` +
                    `${dash ? ` stroke-dasharray="${dash}"` : ""}/>`,
            );
            lx += 13;
        };
        // The key has to say what the drawing now says: unbroken means cut, dashed
        // means fold, and the color is the direction it goes either way — because a
        // cut edge is taped back to its partner and folds after that, so it needs its
        // direction as much as a crease does. Only a free boundary is plain black.
        txt("cut", "#666");
        lx += 8;
        swatch(M_COLOR, null, 0.5);
        txt("fold", "#666");
        lx += 9;
        for (const f of [36, 72, 108, 144]) {
            txt(`${f}°`, "#666");
            lx += f >= 108 ? 8 : 6.5;
            swatch("#666", DASH[f], 0.28);
        }
        txt("mountain", M_COLOR);
        lx += 17;
        txt("valley", V_COLOR);
        lx += 13;
        txt("tab = tape to like letter", "#666");
    }

    out.push(thumbnail(pg, pageIndex, placed, hinges, ekey, o, cx, cy, page));
    out.push("</svg>");
    return out.join("\n");
}

// ── the locator mini ──────────────────────────────────────────────
//
// A mini of the **Penrose tiling patch**, not of the unfolded net. The tiling is the
// picture on every other page and the thing you can recognize; the development is a
// shape nobody has seen before, so a mini of it locates nothing.
//
// The sheet's own faces are filled in the sheet's color and outlined with their
// cuts, which is exactly the region you are about to hold. Folds are left out: at
// this size they are noise, and the outline is the information.
//
// The same color keys the sheet list and the printable map, so a sheet, its mini
// and its patch on the map all read as one thing.

const THUMB_AREA_MM2 = 1500; // ≈ 2.3 square inches
const THUMB_MAX_MM = 54;

function thumbnail(
    pg: Pagination,
    pageIndex: number,
    placed: Map<number, Placed>,
    hinges: Set<string>,
    ekey: (a: number, b: number) => string,
    o: PageRenderOpts,
    contentX: number,
    contentY: number,
    page: Page,
): string {
    const { pageW, pageH, margin, sideMm } = o;
    const color = o.sheetColor ?? "#6a5acd";

    // Tiling positions when we have them; fall back to the development otherwise.
    const shape = new Map<number, P2[]>();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [id, p] of placed) {
        const pts = o.tilingPoly
            ? o.tilingPoly(id)
            : p.poly.map((q) => rot(q as P2, pg.angle));
        if (!pts) continue;
        shape.set(id, pts);
        for (const q of pts) {
            if (q[0] < x0) x0 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0];
            if (q[1] > y1) y1 = q[1];
        }
    }
    if (!shape.size) return "";
    if (o.tailsAxis != null) {
        const lo = o.tailsAxis - y1, hi = o.tailsAxis - y0;
        if (lo < y0) y0 = lo;
        if (hi > y1) y1 = hi;
    }
    const netW = x1 - x0 || 1;
    const netH = y1 - y0 || 1;
    let k = Math.sqrt(THUMB_AREA_MM2 / (netW * netH));
    k = Math.min(k, THUMB_MAX_MM / Math.max(netW, netH));
    const tw = netW * k;
    const th = netH * k;

    // Least-covered corner, scored against the faces rather than their overall box:
    // these nets are snakey and the box hides the real whitespace inside it.
    const boxes: Array<[number, number, number, number]> = [];
    for (const fid of page.faceIds) {
        const pts = placed.get(fid)!.poly.map((q) => rot(q as P2, pg.angle));
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
    g.push(patchMini(pg, pageIndex, shape, placed, hinges, ekey, T, color, k));
    if (o.tailsAxis != null) {
        const axis = o.tailsAxis;
        const Tm = (q: P2): P2 => T([q[0], axis - q[1]]);
        g.push(patchMini(pg, pageIndex, shape, placed, hinges, ekey, Tm, color, k));
        g.push(rimMini(o.rim, T, Tm, k));
    } else if (o.rim) {
        g.push(rimMini(o.rim, T, null, k));
    }
    g.push(
        `<text x="${n3(tx)}" y="${n3(ty + th + 3.4)}" font-size="2.6" font-family="sans-serif" ` +
            `fill="#666">patch · sheet ${pageIndex + 1}</text>`,
    );
    return g.join("\n");
}

/** The rim, drawn on each surface in the color of the sheet its collar went to. */
function rimMini(
    rim: PageRenderOpts["rim"],
    T: (q: P2) => P2,
    Tm: ((q: P2) => P2) | null,
    k: number,
): string {
    if (!rim?.length) return "";
    const w = Math.max(0.3 * k, 0.4);
    const out: string[] = [];
    for (const e of rim)
        for (const M of Tm ? [T, Tm] : [T]) {
            const a = M(e.a), b = M(e.b);
            out.push(
                `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
                    `stroke="${e.color}" stroke-width="${n3(w)}" stroke-linecap="round"/>`,
            );
        }
    return out.join("\n");
}

/**
 * The patch with one sheet picked out: everything faint, this sheet filled and
 * outlined along its cuts. Shared by the mini and the printable map.
 */
function patchMini(
    pg: Pagination,
    pageIndex: number,
    shape: Map<number, P2[]>,
    placed: Map<number, Placed>,
    hinges: Set<string>,
    ekey: (a: number, b: number) => string,
    T: (q: P2) => P2,
    color: string,
    k: number,
    withFaint = true,
): string {
    const page = pg.pages[pageIndex];
    const here = new Set(page.faceIds);

    // Weights scale with the mini but never vanish: at thumbnail size a width
    // proportional to k alone rounds to nothing and the outline disappears.
    const wFaint = Math.max(0.08 * k, 0.1);
    const wCut = Math.max(0.16 * k, 0.22);
    const wEdge = Math.max(0.26 * k, 0.34);
    const GRAY = PATCH_GRAY;

    const faint: string[] = [];
    const mine: string[] = [];
    for (const [id, pts] of shape) {
        const d = pts.map(T);
        const poly = d.map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ");
        if (here.has(id)) {
            mine.push(
                // 0.70 rather than a solid fill: still unmistakably this sheet's
                // color, but light enough that the fold lines on top of it read.
                `<polygon points="${poly}" fill="${color}" fill-opacity="0.7" ` +
                    `stroke="none"/>`,
            );
        } else if (withFaint) {
            faint.push(
                `<polygon points="${poly}" fill="none" stroke="${GRAY}" stroke-width="${n3(wFaint)}"/>`,
            );
        }
    }

    // Every edge of the sheet's faces, classified. Used once means it is on the
    // region's boundary — that is what you cut round. Used twice means interior,
    // and then a hinge is a fold and anything else is still a cut: the net is cut
    // along those too, and a mini that hides them lies about the work.
    interface E {
        pts: [P2, P2];
        n: number;
        hinge: boolean;
    }
    const seen = new Map<string, E>();
    for (const id of page.faceIds) {
        const pts = shape.get(id);
        const pl = placed.get(id);
        if (!pts || !pl) continue;
        for (let i = 0; i < 4; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % 4];
            const key = ekey(pl.verts[i], pl.verts[(i + 1) % 4]);
            const got = seen.get(key);
            if (got) got.n++;
            else seen.set(key, { pts: [a, b], n: 1, hinge: hinges.has(key) });
        }
    }

    const folds: string[] = [];
    const cuts: string[] = [];
    const border: string[] = [];
    for (const e of seen.values()) {
        const a = T(e.pts[0]);
        const b = T(e.pts[1]);
        const line = (col: string, w: number) =>
            `<line x1="${n3(a[0])}" y1="${n3(a[1])}" x2="${n3(b[0])}" y2="${n3(b[1])}" ` +
            `stroke="${col}" stroke-width="${n3(w)}" stroke-linecap="round"/>`;
        if (e.n === 1) border.push(line("#111", wEdge));
        else if (e.hinge) folds.push(line(GRAY, wFaint));
        else cuts.push(line("#333", wCut));
    }

    return [...faint, ...mine, ...folds, ...cuts, ...border].join("\n");
}

/**
 * The printable map: the whole patch with every sheet in its own color. Before you
 * cut it says how the patch will be divided; after, it says which piece is which.
 */
export function renderMap(
    pg: Pagination,
    placed: Map<number, Placed>,
    hinges: Set<string>,
    ekey: (a: number, b: number) => string,
    o: PageRenderOpts,
): string {
    const { pageW, pageH, margin } = o;
    const colors = o.sheetColors ?? sheetPalette(pg.pages.length);
    const shape = new Map<number, P2[]>();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [id, p] of placed) {
        const pts = o.tilingPoly
            ? o.tilingPoly(id)
            : p.poly.map((q) => rot(q as P2, pg.angle));
        if (!pts) continue;
        shape.set(id, pts);
        for (const q of pts) {
            if (q[0] < x0) x0 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0];
            if (q[1] > y1) y1 = q[1];
        }
    }
    const availW = pageW - 2 * margin;
    const availH = pageH - 2 * margin - 14;
    const k = Math.min(availW / (x1 - x0 || 1), availH / (y1 - y0 || 1));
    const ox = margin + (availW - (x1 - x0) * k) / 2;
    const oy = margin + 8 + (availH - (y1 - y0) * k) / 2;
    const T = (q: P2): P2 => [ox + (q[0] - x0) * k, oy + (q[1] - y0) * k];

    const out: string[] = [];
    out.push(
        `<svg class="sheet"${o.standalone === false ? "" : ' xmlns="http://www.w3.org/2000/svg"'} ` +
            `width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    );
    out.push(`<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#fff"/>`);
    out.push(
        `<text x="${n3(margin)}" y="${n3(margin + 2)}" font-size="5" font-family="sans-serif" ` +
            `font-weight="bold" fill="#111">Map — ${pg.pages.length} sheets</text>`,
    );

    // every face faint, then each sheet in its color, then each sheet's outline
    for (const [, pts] of shape) {
        const d = pts.map(T).map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ");
        out.push(
            `<polygon points="${d}" fill="none" stroke="${PATCH_GRAY}" ` +
                `stroke-width="${n3(Math.max(0.06 * k, 0.12))}"/>`,
        );
    }
    pg.pages.forEach((page, i) => {
        out.push(
            patchMini(pg, i, shape, placed, hinges, ekey, T, colors[i % colors.length], k, false),
        );
        // sheet number at the centroid of its region
        let cx = 0;
        let cy = 0;
        let n = 0;
        for (const fid of page.faceIds) {
            const pts = shape.get(fid);
            if (!pts) continue;
            for (const q of pts.map(T)) {
                cx += q[0];
                cy += q[1];
                n++;
            }
        }
        if (n) {
            out.push(
                `<text x="${n3(cx / n)}" y="${n3(cy / n)}" font-size="7" font-family="sans-serif" ` +
                    `font-weight="bold" fill="#111" text-anchor="middle" ` +
                    `dominant-baseline="central" stroke="#fff" stroke-width="1.6" ` +
                    `paint-order="stroke">${i + 1}</text>`,
            );
        }
    });
    out.push("</svg>");
    return out.join("\n");
}
