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
const n3 = (v: number) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(3));

export interface PageRenderOpts {
    sideMm: number;
    pageW: number; // physical page, mm
    pageH: number;
    margin: number; // mm
    fillMode: "none" | "type" | "cluster";
    showLegend?: boolean;
    standalone?: boolean;
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
    const joinHere = new Map<string, { letter: string; partner: number }>();
    for (const j of pg.joins) {
        if (j.sheetA === pageIndex) {
            joinHere.set(j.key, { letter: j.letter, partner: j.sheetB });
        } else if (j.sheetB === pageIndex) {
            joinHere.set(j.key, { letter: j.letter, partner: j.sheetA });
        }
    }

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
            const fill =
                o.fillMode === "cluster"
                    ? (CLUSTER_TINTS[p.cluster] ?? "#f4f4f4")
                    : p.thick
                      ? "#f2f2fa"
                      : "#fdf4ea";
            fills.push(
                `<polygon points="${pts.map((q) => `${n3(q[0])},${n3(q[1])}`).join(" ")}" fill="${fill}"/>`,
            );
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
                // Label just inside the face, pulled off the edge towards the centre
                // so it cannot be confused with the neighbouring page's copy.
                const mx = (a[0] + b[0]) / 2;
                const my = (a[1] + b[1]) / 2;
                const t = 0.3;
                labels.push(
                    `<text x="${n3(mx + (ccx - mx) * t)}" y="${n3(my + (ccy - my) * t)}" ` +
                        `font-size="3.4" font-family="sans-serif" font-weight="bold" fill="#111" ` +
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

    out.push(...fills, ...creaseLines, ...cutLines, ...joinLines, ...labels);

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

    out.push("</svg>");
    return out.join("\n");
}
