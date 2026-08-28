// Chapter 5 — the slab: the layer of hexahedra taken as one closed solid.
//
// `hexlayer.ts` gives the cells. A cell has six faces, but a cell buried in the middle
// of the patch contributes only two of them to the outside of the model: its top and
// its floor. Its four side walls are pressed against the walls of its neighbors and
// are never seen, never cut, never folded. Only where a rhomb sits on the edge of the
// patch does a wall reach the surface.
//
// So the slab's boundary is:
//
//   * `F` roof rhombi on top,
//   * `F` floor rhombi underneath — the same surface translated down by `e_z`,
//   * one wall per **boundary edge** of the patch, forming a single closed **rim**.
//
// and that is the whole model. Three facts make it worth having as its own module:
//
//   * **One cut shape.** A wall is spanned by `E_m` and `e_z`, and `E_m · e_z = 1/√5`
//     like every other pair among the six axes, so a wall is the *same golden rhombus*
//     as every roof face.
//   * **The rim is one simple closed curve** on every patch measured, so the collar is
//     a single ring with no islands and no case analysis.
//   * **The boundary closes to a sphere**: `2V − (2E + B) + (2F + B) = 2` exactly.
//
// Nothing here lays anything out. This is the solid; unfolding it is somebody else's
// job, and the faces come out shaped the way `solidnet.ts` wants to be handed them.

import { allRhombs, vertexMap, roundKey } from "./geometry.js";
import type { V3, Pt } from "./geometry.js";
import { hexLayer, VERTICAL_AXIS } from "./hexlayer.js";
import type { SolidFace, Net, P2 } from "./solidnet.js";
// `unfold.ts` has a Crease of its own — fold plus mountain, which is what the sheet
// draws — while this module's Crease also says which faces and of what kind.
import type { Placed, Piece, Crease as SheetCrease, Analysis, Face } from "./unfold.js";
import { faceLinks } from "./unfold.js";
import type { CutSurface } from "./cuttree.js";

export type Role = "top" | "floor" | "wall";

export interface SlabFace extends SolidFace {
    role: Role;
    /**
     * The two of the six axes this face spans, so the five-coloring reads on it.
     * A top or a floor spans the rhomb's own pair; a wall spans its axis and the
     * vertical, and `pairColor(m, 5) = m`, so a wall wears its own axis.
     */
    pair: [number, number];
    /** the rhomb this face belongs to — the cell it is a face of, either way */
    rhomb: number;
    /** which pentagon group that rhomb came from, so a face can be colored */
    group: string;
    thick: boolean;
    /** walls only: which of the five lifting axes the top edge runs along */
    axis?: number;
    /** walls only: position round the rim, 1…B in ring order */
    rim?: number;
}

export interface RimEdge {
    /** 1-based, in ring order, with the patch on the left going a → b */
    n: number;
    /** vertex ids of the tiling edge this wall stands on */
    a: number;
    b: number;
    /** their height indices. They always differ by exactly one — every roof edge does */
    ia: number;
    ib: number;
    axis: number;
    /** the cell the wall hangs from */
    rhomb: number;
    /** id of the wall face */
    face: number;
}

export interface Crease {
    /** the two faces, and the fold angle between them in degrees */
    a: number;
    b: number;
    /** 180° − the solid's dihedral: how far the paper bends from flat */
    fold: number;
    kind: "top|top" | "floor|floor" | "top|wall" | "floor|wall" | "wall|wall" | "floor|top";
}

export interface Slab {
    faces: SlabFace[];
    top: SlabFace[];
    floor: SlabFace[];
    wall: SlabFace[];
    /** the rim, in order, exactly one cycle */
    rim: RimEdge[];
    creases: Crease[];
    counts: {
        /** of the patch */
        V: number;
        Eint: number;
        B: number;
        F: number;
        /** of the closed boundary surface */
        slabV: number;
        slabE: number;
        slabF: number;
        euler: number;
    };
}

const KEY = 1e6;
const vkey = (p: V3) => p.map((x) => Math.round(x * KEY)).join(",");
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/**
 * The angle the paper bends through, along an edge shared by two faces.
 *
 * Taken from the two faces' own corners rather than from a lookup, so the fold set the
 * page claims — 36°, 72°, 108° and nothing else — is measured rather than asserted.
 */
function foldAngle(P: V3, Q: V3, u: V3, v: V3): number {
    const e = scale(sub(Q, P), 1 / len(sub(Q, P)));
    const pu = sub(sub(u, P), scale(e, dot(sub(u, P), e)));
    const pv = sub(sub(v, P), scale(e, dot(sub(v, P), e)));
    const dihedral = (Math.acos(dot(pu, pv) / (len(pu) * len(pv))) * 180) / Math.PI;
    return 180 - dihedral;
}

/**
 * The slab under the current patch. Call after `generatePatch()`.
 *
 * Linear in the rhomb count. Nothing is searched for and nothing is chosen: which
 * walls survive is decided by the patch's boundary, and the rim's order by walking it.
 */
export function slab(): Slab {
    const layer = hexLayer();
    const vid = (p: Pt) => vertexMap.get(roundKey(p))!;

    // Which tiling edges have only one rhomb on them? Those are the boundary, and they
    // are the only edges that get a wall.
    const use = new Map<string, number>();
    const ekey = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    for (const r of allRhombs) {
        const ids = r.verts.map((p) => vid(p).id);
        for (let i = 0; i < 4; i++) use.set(ekey(ids[i], ids[(i + 1) % 4]), (use.get(ekey(ids[i], ids[(i + 1) % 4])) ?? 0) + 1);
    }

    const faces: SlabFace[] = [];
    const top: SlabFace[] = [];
    const floor: SlabFace[] = [];
    const wall: SlabFace[] = [];
    /** boundary edge key -> the wall standing on it, before the ring is ordered */
    const wallOf = new Map<string, { face: SlabFace; a: number; b: number }>();

    for (const c of layer.cells) {
        const r = allRhombs[c.rhomb];
        const ids = r.verts.map((p) => vid(p).id);
        const common = { rhomb: c.rhomb, group: r.group, thick: r.thick, pair: c.pair };
        const t: SlabFace = { id: faces.length, corners: c.faces[0], role: "top", ...common };
        faces.push(t);
        top.push(t);
        // The floor is wound the other way round: it is the same rhomb seen from
        // underneath, and a closed solid wants every face facing out.
        const f: SlabFace = {
            id: faces.length,
            corners: [...c.faces[1]].reverse(),
            role: "floor",
            ...common,
        };
        faces.push(f);
        floor.push(f);
        for (let i = 0; i < 4; i++) {
            const k = ekey(ids[i], ids[(i + 1) % 4]);
            if ((use.get(k) ?? 0) !== 1) continue; // interior: pressed against a neighbor
            // Reversed for the same reason the floor is: a rhomb is stored
            // counter-clockwise seen from above, so a wall built by walking that
            // traversal comes out facing *into* the solid. A closed solid wants every
            // face facing out, and `tools/slab.mjs` checks it by enclosing a volume.
            const w: SlabFace = {
                id: faces.length,
                corners: [...c.faces[2 + i]].reverse(),
                role: "wall",
                axis: c.wallAxis[i],
                ...common,
                pair: [c.wallAxis[i], VERTICAL_AXIS] as [number, number],
            };
            faces.push(w);
            wall.push(w);
            wallOf.set(k, { face: w, a: ids[i], b: ids[(i + 1) % 4] });
        }
    }

    // ── the rim, in order ─────────────────────────────────────────
    //
    // Every boundary vertex has exactly two boundary edges on every patch measured, so
    // walking is unambiguous: arrive at a vertex, leave by the edge you did not come
    // in on. Each wall already knows its edge as a *directed* pair, running the way the
    // rhomb was traversed — which keeps the patch on one side all the way round.
    const out = new Map<number, Array<{ k: string; a: number; b: number }>>();
    for (const [k, w] of wallOf) {
        if (!out.has(w.a)) out.set(w.a, []);
        out.get(w.a)!.push({ k, a: w.a, b: w.b });
    }
    const rim: RimEdge[] = [];
    const first = wallOf.values().next().value;
    if (first) {
        let at = first.a;
        const seen = new Set<string>();
        for (let n = 1; n <= wallOf.size; n++) {
            const step = (out.get(at) ?? []).find((e) => !seen.has(e.k));
            if (!step) break; // more than one cycle, or a pinch: the checker will say so
            seen.add(step.k);
            const w = wallOf.get(step.k)!;
            w.face.rim = n;
            rim.push({
                n,
                a: step.a,
                b: step.b,
                ia: vertexMap.get(roundKey(allRhombs[w.face.rhomb].verts[0]))!.index, // replaced below
                ib: 0,
                axis: w.face.axis!,
                rhomb: w.face.rhomb,
                face: w.face.id,
            });
            at = step.b;
        }
    }
    // The heights come from the vertex list rather than from the walk, so a wrong turn
    // in the walk cannot quietly produce plausible-looking numbers.
    const indexOf = new Map<number, number>();
    for (const r of allRhombs) for (const p of r.verts) { const v = vid(p); indexOf.set(v.id, v.index); }
    for (const e of rim) {
        e.ia = indexOf.get(e.a)!;
        e.ib = indexOf.get(e.b)!;
    }

    // ── creases ───────────────────────────────────────────────────
    const byEdge = new Map<string, Array<{ f: SlabFace; i: number }>>();
    for (const f of faces)
        for (let i = 0; i < 4; i++) {
            const p = f.corners[i], q = f.corners[(i + 1) % 4];
            const k = vkey(p) < vkey(q) ? `${vkey(p)}/${vkey(q)}` : `${vkey(q)}/${vkey(p)}`;
            if (!byEdge.has(k)) byEdge.set(k, []);
            byEdge.get(k)!.push({ f, i });
        }
    const creases: Crease[] = [];
    for (const [, pair] of byEdge) {
        if (pair.length !== 2) continue; // the checker asserts there are none of these
        const [A, B] = pair;
        const P = A.f.corners[A.i], Q = A.f.corners[(A.i + 1) % 4];
        // Sorted, so a crease is named the same way whichever face is found first.
        // "floor|top" is in the union only because the checker has to be able to
        // report it: a roof rhomb and a floor rhombus are a whole unit apart and can
        // never share an edge, and if one ever does the geometry is wrong.
        creases.push({
            a: A.f.id,
            b: B.f.id,
            fold: foldAngle(P, Q, A.f.corners[(A.i + 2) % 4], B.f.corners[(B.i + 2) % 4]),
            kind: [A.f.role, B.f.role].sort().join("|") as Crease["kind"],
        });
    }

    const V = indexOf.size;
    const B = wallOf.size;
    const F = layer.cells.length;
    const Eint = use.size - B;
    return {
        faces, top, floor, wall, rim, creases,
        counts: {
            V, Eint, B, F,
            slabV: 2 * V,
            slabE: 2 * (Eint + B) + B,
            slabF: 2 * F + B,
            euler: 2 * V - (2 * (Eint + B) + B) + (2 * F + B),
        },
    };
}


// ── the slab as a document the sheet machinery understands ────────
//
// `sheet.ts` and `paginate.ts` were written for the roof and their comments said
// "tiling vertex id" throughout, which read like a requirement and is not one: nothing
// downstream asks what an id means, only that two faces meeting at a corner name it
// the same. So the slab needs no refactor of that machinery — it needs to number its
// own corners, which it can do by position, and to say how high each one is.

/** What `renderSheet` and `paginateNet` take, built from a `solidnet` unfolding. */
export interface SlabDocument {
    placed: Map<number, Placed>;
    pieces: Piece[];
    creases: Map<string, SheetCrease>;
    hinges: Set<string>;
    /** height of a corner id, on the roof's own index scale */
    indexOf: (v: number) => number;
    indexRange: [number, number];
}

const ckey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * Adapt an unfolding of slab faces into the roof's document shape.
 *
 * Corners are numbered by position, so a corner shared by a top face and the wall
 * hanging from it gets one id and the crease between them is found the same way a
 * crease between two rhombi is. Height is the z of the corner in units of `s/√5`,
 * which is the roof's index extended downward — a floor corner under an index-3 roof
 * corner comes out at 3 − √5, and the shading ramp handles the wider range on its own.
 */
export function slabDocument(S: Slab, net: Net): SlabDocument {
    const KEY = 1e6;
    const idOf = new Map<string, number>();
    const heightAt = new Map<number, number>();
    const cid = (p: V3): number => {
        const k = p.map((x) => Math.round(x * KEY)).join(",");
        let id = idOf.get(k);
        if (id === undefined) {
            id = idOf.size;
            idOf.set(k, id);
            heightAt.set(id, p[2] * Math.sqrt(5));
        }
        return id;
    };

    const byId = new Map(S.faces.map((f) => [f.id, f]));
    const placed = new Map<number, Placed>();
    for (const pf of net.placed) {
        const f = byId.get(pf.id)!;
        placed.set(pf.id, {
            faceId: pf.id,
            thick: f.thick,
            group: f.group,
            pair: f.pair,
            poly: pf.poly as P2[],
            verts: f.corners.map(cid),
            piece: pf.piece,
        });
    }

    // Pieces, with the bounding box `layoutSheets` packs them by.
    const pieces: Piece[] = [];
    for (const pf of net.placed) {
        let piece = pieces[pf.piece];
        if (!piece) piece = pieces[pf.piece] = { id: pf.piece, faceIds: [], w: 0, h: 0, minX: Infinity, minY: Infinity };
        piece.faceIds.push(pf.id);
    }
    for (const piece of pieces) {
        const pts = piece.faceIds.flatMap((id) => placed.get(id)!.poly);
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        piece.minX = Math.min(...xs);
        piece.minY = Math.min(...ys);
        piece.w = Math.max(...xs) - piece.minX;
        piece.h = Math.max(...ys) - piece.minY;
    }

    // Creases, keyed by corner id like the roof's, with mountain read from the solid
    // rather than from the fold angle — `foldAngle` is an arccos and cannot tell a
    // reflex dihedral from its supplement.
    const creases = new Map<string, SheetCrease>();
    for (const cr of S.creases) {
        const A = byId.get(cr.a)!, B = byId.get(cr.b)!;
        const shared = A.corners.map(cid).filter((v) => B.corners.map(cid).includes(v));
        if (shared.length !== 2) continue;
        creases.set(ckey(shared[0], shared[1]), { fold: cr.fold, mountain: convex(A, B, cid) });
    }
    const hinges = new Set<string>();
    for (const [a, b] of net.hinges) {
        const A = byId.get(a)!, B = byId.get(b)!;
        const shared = A.corners.map(cid).filter((v) => B.corners.map(cid).includes(v));
        if (shared.length === 2) hinges.add(ckey(shared[0], shared[1]));
    }

    const hs = [...heightAt.values()];
    return {
        placed, pieces, creases, hinges,
        indexOf: (v) => heightAt.get(v) ?? 0,
        indexRange: [Math.min(...hs), Math.max(...hs)],
    };
}

/**
 * Is the edge between two faces convex, seen from outside?
 *
 * With every face wound outward, it is convex exactly when the neighbor's far corner
 * lies on the inner side of this face's plane — and a convex edge read from outside is
 * a ridge, which is a mountain.
 */
function convex(A: SlabFace, B: SlabFace, cid: (p: V3) => number): boolean {
    const u = sub(A.corners[1], A.corners[0]);
    const v = sub(A.corners[3], A.corners[0]);
    const n: V3 = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    const mine = new Set(A.corners.map(cid));
    const far = B.corners.find((c) => !mine.has(cid(c)))!;
    return dot(sub(far, A.corners[0]), n) < 0;
}


/**
 * The slab as something `cuttree.ts` can route branch cuts through.
 *
 * The roof reads its faces off the tiling registries; a closed surface has to hand
 * them over. `P` is indexed by corner id, which is why the ids are dense — the
 * developer indexes into it directly.
 */
export function slabSurface(S: Slab): {
    analysis: Analysis;
    edges: CutSurface;
    /** height of a corner id, on the roof's index scale continued downward */
    indexOf: (v: number) => number;
    indexRange: [number, number];
} {
    const KEY = 1e6;
    const idOf = new Map<string, number>();
    const P: (V3 | null)[] = [];
    const cid = (p: V3): number => {
        const k = p.map((x) => Math.round(x * KEY)).join(",");
        let id = idOf.get(k);
        if (id === undefined) { id = idOf.size; idOf.set(k, id); P[id] = p; }
        return id;
    };

    const faces: Face[] = S.faces.map((f) => ({
        id: f.id,
        thick: f.thick,
        group: f.group,
        pair: f.pair,
        v: f.corners.map(cid),
    }));

    // Edge use counts, so `buildCutGraph` can tell an interior edge from a rim one.
    // On a closed slab every edge carries two faces and nothing is contracted.
    const used = new Map<string, { v1: number; v2: number; faces: number }>();
    for (const f of faces)
        for (let i = 0; i < 4; i++) {
            const a = f.v[i], b = f.v[(i + 1) % 4];
            const k = ckey(a, b);
            const cur = used.get(k);
            if (cur) cur.faces++;
            else used.set(k, { v1: Math.min(a, b), v2: Math.max(a, b), faces: 1 });
        }

    // Mountain comes off the solid, not off the fold angle — `foldAngle` is an arccos
    // and reports a reflex dihedral as its supplement.
    const byId = new Map(S.faces.map((f) => [f.id, f]));
    const creases = new Map<string, SheetCrease>();
    for (const cr of S.creases) {
        const A = byId.get(cr.a)!, B = byId.get(cr.b)!;
        const av = A.corners.map(cid), bv = B.corners.map(cid);
        const shared = av.filter((v) => bv.includes(v));
        if (shared.length === 2)
            creases.set(ckey(shared[0], shared[1]), { fold: cr.fold, mountain: convex(A, B, cid) });
    }

    const hs = P.map((q) => q![2] * Math.sqrt(5));
    return {
        analysis: { faces, P, links: faceLinks(faces), creases },
        edges: { vertices: [...idOf.values()], edges: [...used.values()] },
        indexOf: (v) => hs[v] ?? 0,
        indexRange: [Math.min(...hs), Math.max(...hs)],
    };
}
