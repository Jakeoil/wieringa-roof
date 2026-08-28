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
import { hexLayer } from "./hexlayer.js";
import type { SolidFace } from "./solidnet.js";

export type Role = "top" | "floor" | "wall";

export interface SlabFace extends SolidFace {
    role: Role;
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
        const common = { rhomb: c.rhomb, group: r.group, thick: r.thick };
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
