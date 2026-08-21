// The balls as a packing in their own right.
//
// Chapter 2 asks which triacontahedron a rhomb belongs to, and the solids are the
// answer. Here the solids are the means and the **balls** are the object: each is the
// insphere of one triacontahedron, all of one radius ρ, and what matters is how they
// sit against one another rather than what they explain about the roof.
//
// Two relations, and they are different:
//
//   * a **contact** — centers exactly 2ρ apart, so the balls are externally tangent.
//     Every contact turns out to lie along a face normal, so the polyhedra meet face
//     to face and a ball tangency is always a real face tangency.
//   * an **overlap** — centers nearer than 2ρ. The balls interpenetrate. Complete
//     solids never do this; the partial classes do it freely.
//
// A contact whose shared face is an actual rhomb of the roof is the same thing the
// centers page calls a *shared rhomb*, and the two balls kiss at that rhomb's exact
// center. Most contacts are not of that kind: they happen on faces the roof never
// reaches, so the roof is a slice through a contact network larger than itself.

import { RHO } from "./centers.js";
import type { Centers, Solid } from "./centers.js";

export interface Contact {
    /** indices into `Packing.balls` */
    a: number;
    b: number;
    /** the rhomb the two balls kiss on, when the roof reaches that face; else null */
    onRoof: number | null;
    /** the kiss point — the midpoint of the two centers */
    at: [number, number, number];
}

export interface Packing {
    balls: Solid[];
    contacts: Contact[];
    /** contacts per ball, by index into `balls` */
    degree: number[];
    /** overlapping pairs — nearer than 2ρ, not merely touching */
    overlapPairs: number;
    /** overlaps per ball */
    overlapDegree: number[];
    /** connected components of the contact graph, and the size of the largest */
    components: number;
    largest: number;
}

const EPS = 1e-9;

/**
 * Contacts and overlaps among the given balls.
 *
 * Bucketed on a grid of side 2ρ, so it is linear in the ball count rather than
 * quadratic — at generation 5 the Sun offers 19,000 balls and 180 million pairs, which
 * is not a thing to enumerate.
 */
export function packing(cen: Centers, balls: Solid[]): Packing {
    const cell = 2 * RHO;
    const grid = new Map<string, number[]>();
    const cellOf = (c: readonly number[]) =>
        `${Math.floor(c[0] / cell)},${Math.floor(c[1] / cell)},${Math.floor(c[2] / cell)}`;
    balls.forEach((s, i) => {
        const k = cellOf(s.c);
        const cur = grid.get(k);
        if (cur) cur.push(i);
        else grid.set(k, [i]);
    });

    // rhomb id by the pair of solids carrying it, so a contact can be asked whether the
    // roof reaches the face the two balls kiss on
    const roofFace = new Map<string, number>();
    const pk = (x: number, y: number) => (x < y ? `${x},${y}` : `${y},${x}`);
    for (const f of cen.faces) roofFace.set(pk(f.solids[0], f.solids[1]), f.id);

    const contacts: Contact[] = [];
    const degree = balls.map(() => 0);
    const overlapDegree = balls.map(() => 0);
    let overlapPairs = 0;

    for (let i = 0; i < balls.length; i++) {
        const [gx, gy, gz] = [0, 1, 2].map((k) => Math.floor(balls[i].c[k] / cell));
        for (let x = gx - 1; x <= gx + 1; x++) {
            for (let y = gy - 1; y <= gy + 1; y++) {
                for (let z = gz - 1; z <= gz + 1; z++) {
                    for (const j of grid.get(`${x},${y},${z}`) ?? []) {
                        if (j <= i) continue;
                        const d = Math.hypot(
                            balls[i].c[0] - balls[j].c[0],
                            balls[i].c[1] - balls[j].c[1],
                            balls[i].c[2] - balls[j].c[2],
                        );
                        if (Math.abs(d - cell) < EPS) {
                            degree[i]++;
                            degree[j]++;
                            contacts.push({
                                a: i,
                                b: j,
                                onRoof: roofFace.get(pk(balls[i].id, balls[j].id)) ?? null,
                                at: [0, 1, 2].map(
                                    (k) => (balls[i].c[k] + balls[j].c[k]) / 2,
                                ) as [number, number, number],
                            });
                        } else if (d < cell - EPS) {
                            overlapPairs++;
                            overlapDegree[i]++;
                            overlapDegree[j]++;
                        }
                    }
                }
            }
        }
    }

    // components of the contact graph
    const adj: number[][] = balls.map(() => []);
    for (const c of contacts) {
        adj[c.a].push(c.b);
        adj[c.b].push(c.a);
    }
    const seen = new Array<boolean>(balls.length).fill(false);
    let components = 0;
    let largest = 0;
    for (let i = 0; i < balls.length; i++) {
        if (seen[i]) continue;
        components++;
        let n = 0;
        const stack = [i];
        seen[i] = true;
        while (stack.length) {
            const x = stack.pop()!;
            n++;
            for (const y of adj[x]) {
                if (seen[y]) continue;
                seen[y] = true;
                stack.push(y);
            }
        }
        if (n > largest) largest = n;
    }

    return { balls, contacts, degree, overlapPairs, overlapDegree, components, largest };
}

/** The four proper classes, settled, and something's home — the balls worth packing. */
export const PROPER_MAKEUPS = ["4=4T+0t", "5=5T+0t", "5=3T+2t", "10=5T+5t"];
export function properBalls(cen: Centers): Solid[] {
    return cen.solids.filter(
        (s) => PROPER_MAKEUPS.includes(s.makeup) && s.settled && s.homeCount > 0,
    );
}
