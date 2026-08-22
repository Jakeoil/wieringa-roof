// Chapter 4, part 4 — the roof as the boundary of a layer of golden hexahedra.
//
// **One hexahedron per rhomb, and there is no choice to make.** A roof rhomb spans two
// of the five lifting axes; the third edge of its cell is the **vertical**, which is the
// sixth icosahedral axis. Every generator satisfies `|E_j| = 1` and `E_j · e_z = 1/√5`
// exactly, so `{E_j, E_k, e_z}` is a golden rhombohedron like any other triple of the
// six — and the cell hangs straight down from the rhomb rather than leaning along some
// other generator.
//
// Everything follows from that:
//
//   * **thick → acute, thin → obtuse.** For a thick rhomb `E_j · E_k = +1/√5`, so all
//     three pairwise dots are positive and the cell is the prolate one, volume 0.760845.
//     For a thin rhomb the pair dot is negative and the cell is oblate, 0.470228. So the
//     acute-to-obtuse ratio is the thick-to-thin ratio, which tends to φ.
//   * **The cells never overlap, by construction rather than by search.** Each is a
//     vertical prism under its own rhomb, and the rhombi project to a tiling of the
//     plane — disjoint shadows, therefore disjoint prisms, whatever their heights.
//   * **The lower surface is the roof itself, translated down by `e_z`.** The bottom
//     faces are the top faces moved one unit vertically, so the second Penrose surface
//     beneath is congruent to the first and exactly parallel to it.
//
// An earlier version of this module searched for a third axis among the other four
// generators and got 57% coverage by greedy assignment. That was the wrong question:
// the third axis is the vertical one, and the answer is complete and forced.

import { allRhombs, vertexMap, roundKey, computeLift, pos3D, E5 } from "./geometry.js";
import type { V3 } from "./geometry.js";

/** Volume of the parallelepiped on three edge vectors. */
const det3 = (e: [V3, V3, V3]): number =>
    e[0][0] * (e[1][1] * e[2][2] - e[1][2] * e[2][1]) -
    e[0][1] * (e[1][0] * e[2][2] - e[1][2] * e[2][0]) +
    e[0][2] * (e[1][0] * e[2][1] - e[1][1] * e[2][0]);

/** The vertical — the sixth icosahedral axis, and the one the roof surface never uses. */
export const EZ: V3 = [0, 0, 1];

export interface HexCell {
    /** the roof rhomb it hangs from, one to one */
    rhomb: number;
    /** the two lifting axes of that rhomb; the third edge is always `EZ` */
    pair: [number, number];
    center: V3;
    e: [V3, V3, V3];
    corners: V3[];
    faces: V3[][];
    /** prolate for a thick rhomb, oblate for a thin one */
    acute: boolean;
    volume: number;
}

export interface HexLayer {
    cells: HexCell[];
    acute: number;
    obtuse: number;
    /** the roof's own faces, translated down by `e_z` — the surface underneath */
    floor: V3[][];
}

/**
 * The layer under the current patch. Call after `generatePatch()`.
 *
 * Linear in the rhomb count, with nothing to search: every rhomb gets exactly one cell.
 */
export function hexLayer(): HexLayer {
    const lift = computeLift();
    const cells: HexCell[] = [];
    const floor: V3[][] = [];
    let acute = 0;

    for (const r of allRhombs) {
        const vids = r.verts.map((pt) => vertexMap.get(roundKey(pt))!.id);
        const top = vids.map((v) => pos3D(lift.n[v]!));
        const bottom = top.map((p) => [p[0], p[1], p[2] - 1] as V3);
        floor.push(bottom);

        // The three edge vectors, at full length: two lifting axes and the vertical.
        // Each is a unit vector, and all three pairwise dots are ±1/√5, which is what
        // makes the cell a golden rhombohedron.
        const [j, k] = r.pair;
        const e: [V3, V3, V3] = [E5[j], E5[k], [0, 0, -1]];
        const center: V3 = [
            (top[0][0] + top[2][0]) / 2,
            (top[0][1] + top[2][1]) / 2,
            (top[0][2] + top[2][2]) / 2 - 0.5,
        ];
        // The six faces: the rhomb on top, its translate beneath, and four vertical
        // sides. The sides stand perpendicular to the horizontal plane, with their edges
        // running straight down — which is what makes the cell a prism and the shadows
        // disjoint.
        const faces: V3[][] = [top, bottom];
        for (let i = 0; i < 4; i++) {
            const a = top[i];
            const b = top[(i + 1) % 4];
            faces.push([a, b, [b[0], b[1], b[2] - 1], [a[0], a[1], a[2] - 1]]);
        }
        const corners = [...top, ...bottom];
        if (r.thick) acute++;
        cells.push({
            rhomb: r.id,
            pair: [j, k],
            center,
            e,
            corners,
            faces,
            acute: r.thick,
            volume: Math.abs(det3(e)),
        });
    }
    return { cells, acute, obtuse: cells.length - acute, floor };
}
