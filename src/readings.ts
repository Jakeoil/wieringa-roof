// The readings of a singularity, and what makes one legal.
//
// A singularity's shadow is a zonogon on k of the five generators, and a **reading** is
// a rhombic tiling of it. The hexagon has two — the Necker flip — and the decagon ten.
// This module enumerates them and decides legality, and it touches no DOM so the tools
// under `tools/` can check every word of it.
//
// **Legality is local, and it is two conditions.** See EXCEPTIONAL.md:
//
//   * every vertex **index** — the popcount of its mask — lies in 1…4. Indices 0 and 5
//     are the two masks that collide at the zonogon's center, de Bruijn's condition, and
//     the same thing as Jake's "none of the paths hit the extremes";
//   * every complete **vertex star** is one of seven. Read off 10,639 real stars across
//     thirty patches, there are only seven, and they finish the job: of the forty
//     decagon readings that meet the index condition exactly ten have only legal stars,
//     and those ten are the orbit a real patch actually uses.
//
// Neither condition needs γ, which is what makes a cascade computable: collapse a
// figure, recompute the stars at the corners it touches, and any corner landing outside
// the seven forces a neighbor.

/** A rhombus of a reading: the two generators it spans, and the mask it is based at. */
export interface MaskRhomb {
    a: number;
    b: number;
    /** the generators already "on" at its base corner; bits `a` and `b` are clear */
    S: number;
}

/**
 * The seven complete vertex stars a Penrose rhombus tiling admits, as the sorted angles
 * meeting at the vertex. Two of them are the singularities this page is about:
 * `108+108+144` is the oblate hexagon K122 and `72+144+144` the acute K113.
 *
 * Measured rather than recalled — `tools/readings.mjs` re-derives the list from the
 * patches the site can build and fails if it ever differs.
 */
export const LEGAL_STARS: ReadonlySet<string> = new Set([
    "108+108+144",
    "72+144+144",
    "72+72+72+72+72",
    "72+72+72+144",
    "36+36+72+108+108",
    "36+36+72+72+72+72",
    "36+36+36+36+72+72+72",
]);

/** A star as the tool and the table both spell it: angles in degrees, ascending. */
export const starSig = (angles: number[]): string =>
    angles.slice().sort((x, y) => x - y).join("+");

/**
 * Every rhombic tiling of the zonogon on `gens`.
 *
 * Elnitsky's sweep: run the lower boundary from the generators in angular order to that
 * order reversed, one adjacent swap at a time, each swap laying a rhombus on the pair
 * that crosses. Every tiling arises and none has to be guessed — which matters, because
 * an earlier attempt at this started from a hand-built tiling that was not one, its
 * areas summing correctly while its rhombi overlapped.
 *
 * `angleOf` gives each generator's planar direction. They are folded into a half plane
 * first, since the sweep needs them within 180° of one another; folding **adds** π, and
 * subtracting it instead scrambles the order and yields no legal tilings at all.
 */
export function tilingsOf(gens: number[], angleOf: (g: number) => number): MaskRhomb[][] {
    const folded = (g: number) => {
        const a = angleOf(g);
        return !(a >= -1e-9 && a < Math.PI - 1e-9);
    };
    const key = (g: number) => angleOf(g) + (folded(g) ? Math.PI : 0);
    const ord = [...gens].sort((x, y) => key(x) - key(y));
    const place = new Map(ord.map((g, i) => [g, i]));
    const rev = [...ord].reverse().join(",");

    // A folded generator has its zone reversed, so "crossed" in the sweep means the bit
    // is **off** in the caller's own labeling. Undo that on the way out.
    const unfold = (S: number): number => {
        let K = 0;
        for (const g of gens) {
            const on = (S >> g) & 1 ? true : false;
            if (on !== folded(g)) K |= 1 << g;
        }
        return K;
    };

    const out: MaskRhomb[][] = [];
    const seen = new Set<string>();
    const placed: MaskRhomb[] = [];
    const walk = (perm: number[]): void => {
        if (perm.join(",") === rev) {
            const sig = placed
                .map((r) => `${r.a},${r.b},${r.S}`)
                .sort()
                .join(" ");
            if (seen.has(sig)) return;
            seen.add(sig);
            out.push(placed.map((r) => ({ ...r })));
            return;
        }
        for (let p = 0; p + 1 < perm.length; p++) {
            const x = perm[p], y = perm[p + 1];
            if (place.get(x)! > place.get(y)!) continue;    // already crossed
            let S = 0;
            for (let q = 0; q < p; q++) S |= 1 << perm[q];
            const next = perm.slice();
            next[p] = y;
            next[p + 1] = x;
            const K = unfold(S) & ~((1 << x) | (1 << y));
            placed.push({ a: Math.min(x, y), b: Math.max(x, y), S: K });
            walk(next);
            placed.pop();
        }
    };
    walk(ord);
    return out;
}

/** The four corner masks of a rhombus, in order round it. */
export const maskCorners = (r: MaskRhomb): number[] => [
    r.S, r.S | (1 << r.a), r.S | (1 << r.a) | (1 << r.b), r.S | (1 << r.b),
];

const popcount = (K: number): number => {
    let n = 0;
    for (let k = 0; k < 8; k++) if ((K >> k) & 1) n++;
    return n;
};

/**
 * Does every vertex of this reading have an index in 1…`total − 1`?
 *
 * The extremes — index 0 and index `total` — are the two masks that land on the
 * zonogon's own center, because the generators sum to zero. A reading through either is
 * not Penrose.
 *
 * **`lo` is not optional for a sub-figure.** A hexagon's vertices carry the generators
 * it does not span as well, fixed by where it sits, and it is the *global* index that
 * must be in range — its own three bits give only 0…3. `lo` is the global index of the
 * corner where all its own bits are off, so a vertex at local mask `K` sits at
 * `lo + popcount(K)`.
 *
 * Which corner that is depends on the figure, not only on its generators: folding a
 * direction into the half plane swaps the ends of its zone, so the two local-index
 * extremes need not be the shadow's own outermost corners. Measured rather than
 * assumed — in Deca generation 3 the oblate hexagons span three index levels and the
 * acute ones two.
 */
export function indexLegal(T: MaskRhomb[], total: number, lo = 0): boolean {
    for (const r of T) {
        for (const K of maskCorners(r)) {
            const i = lo + popcount(K);
            if (i === 0 || i === total) return false;
        }
    }
    return true;
}

/**
 * The stars of a reading, keyed by vertex mask: the angles meeting there, and whether
 * they close. A vertex on the zonogon's rim does not close — the surrounding tiling
 * finishes it — so only the complete ones can be judged in isolation.
 */
export function starsOf(
    T: MaskRhomb[], pointOf: (K: number) => [number, number],
): Map<number, { angles: number[]; closed: boolean }> {
    const at = new Map<number, number[]>();
    for (const r of T) {
        const ks = maskCorners(r);
        const ps = ks.map(pointOf);
        for (let i = 0; i < 4; i++) {
            const o = ps[i], u = ps[(i + 3) % 4], v = ps[(i + 1) % 4];
            const a = [u[0] - o[0], u[1] - o[1]];
            const b = [v[0] - o[0], v[1] - o[1]];
            const cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
            const deg = Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
            let l = at.get(ks[i]);
            if (!l) at.set(ks[i], (l = []));
            l.push(deg);
        }
    }
    const out = new Map<number, { angles: number[]; closed: boolean }>();
    for (const [K, angles] of at) {
        const sum = angles.reduce((x, y) => x + y, 0);
        out.set(K, { angles, closed: Math.abs(sum - 360) <= 2 });
    }
    return out;
}

/** Is every star this reading closes one of the seven? */
export function starLegal(T: MaskRhomb[], pointOf: (K: number) => [number, number]): boolean {
    for (const { angles, closed } of starsOf(T, pointOf).values()) {
        if (closed && !LEGAL_STARS.has(starSig(angles))) return false;
    }
    return true;
}

/**
 * The readings of a singularity on `gens`: the tilings of its shadow that are legal on
 * their own account. Two for a hexagon and ten for the decagon.
 *
 * Legal *on their own account* is not the whole story and is not meant to be. A
 * hexagon's two both pass here — its one interior star is K122 or K113, and both are
 * among the seven — and which of them a patch can actually use depends on the rim,
 * which is to say on its neighbors. That dependence is the cascade.
 */
export function readingsOf(
    gens: number[],
    angleOf: (g: number) => number,
    pointOf: (K: number) => [number, number],
    lo = 0,
    total = 5,
): MaskRhomb[][] {
    return tilingsOf(gens, angleOf)
        .filter((T) => indexLegal(T, total, lo))
        .filter((T) => starLegal(T, pointOf));
}
