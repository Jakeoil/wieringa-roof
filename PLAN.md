# Wieringa Roof

A small site for exploring the Wieringa roof and producing printable nets of
golden rhombi for physical models.

## Pages

| page | content | state |
|---|---|---|
| `index.html` | splash — what the surface is, links to everything | done |
| `net.html` | patch selector → unfolding → printable SVG sheets | done |
| `roof3d.html` | three.js prototype of the surface | done |
| `info.html` | "Mathematics" — golden rhombus, heights, fold angles, defects | done |
| `polyhedra.html` | triacontahedron + the two rhombohedra, generated diagrams | done |
| `legacy.html` | original two-canvas explorer, kept for reference | done (as-is) |

`src/geometry.ts` holds the tiling and the lift; `src/unfold.ts` the three
decomposition methods; `src/sheet.ts` layout and SVG; `src/net.ts`,
`src/roof3d.ts`, `src/legacy.ts` are the per-page entry points. `site.css` is the
shared shell. `tsc` compiles all of `src/` → `dist/`.

## Geometry

Settled and verified numerically against a 349-rhomb de Bruijn patch. Full
write-up lives on `info.html`; the essentials:

- Lift: `E_j = (2/√5·cos 72j°, 2/√5·sin 72j°, 1/√5)`, j = 0…4. A planar vertex
  `Σ n_j ζ^j` lifts to `Σ n_j E_j`.
- All ten face orientations are the **same golden rhombus** (63.4349° /
  116.5651°, diagonals φ:1). Thick vs thin is only which corner meets the shared
  vertex. One cut shape for the whole model.
- For side `s`: short diagonal `1.0515 s`, long diagonal `1.7013 s`.
- Every edge rises or falls by exactly `s/√5`, inclined `arctan(½) = 26.565°`.
  Vertex height = `index · s/√5`, index ∈ {1,2,3,4} only. Total relief `1.342 s`.
- Fold angles are **36°, 72° or 108°** — never 0°. Every interior edge is a real
  crease. thick|thick → 36°; thick|thin → 36° or 72°; thin|thin → 108°.
  Mountain/valley is per-edge, not derivable from the tile pair.
- Rhomb index offsets are `(0, 1, 2, 1)` for **both** rhomb types. `isHeads` only
  decides whether the low corner is v0 or v2. (`emitRhomb` already does this
  correctly — an earlier note proposing `[0,±1,0,±1]` for thin rhombs was wrong.)

## Net methods

Three, all in `src/unfold.ts`, selectable on `net.html`.

**Widened ribbons** (`ribbonGrowPatch`, the default). Takes the longest de Bruijn
ribbon as a backbone, places it, then accretes neighbours across any edge —
longest backbone first, so it gets first claim on contested rhombi. Gathers
80–90% of a patch into one piece.

**BFS unfolding** (`unfoldPatch`). Spreads outward in rings from a seed rhomb,
rejecting overlapping placements; tries every rhomb as seed when the patch is
small enough. Fewest pieces in total, but more evenly sized, so more real joins.

**Ribbon strips** (`stripPatch`). Pure de Bruijn ribbons, one rhomb wide. All
creases in a strip are parallel, so the strip is a generalized cylinder and
develops into a straight band with creases at monotonically increasing positions
spaced exactly `2/√5` — it **provably cannot self-overlap at any length**. But a
ribbon only reaches the 2/5 of rhombi sharing its direction, so you get many thin
bands: 8–9 pieces at gen 2 where the others need 1–2.

**Crease vs cut is decided by the hinge set, not piece membership.** An unfolding
keeps only `F − 1` hinges (a spanning tree of the face graph); every other
interior edge is cut even when both its faces are in the same piece. Those are
exactly the edges bounding the angular-defect wedges. `|hinges| = faces − pieces`
is asserted.

### Measured

Pieces, and pieces of 5+ rhombi (the ones that are real work to join):

| patch | rhombi | widened | BFS | strips |
|---|---|---|---|---|
| gen 2 | 21–25 | 1–2 (1 big) | 1–2 (1 big) | 8–9 |
| gen 3 | 138–140 | 6–8 (1–2 big) | 4–6 (2–3 big) | 41–46 |
| gen 4 | 835–921 | 57–64 (3–8 big) | 50–51 (9–10 big) | 242–284 |

All three validated at generations 2–4: hinge counts balance, zero overlaps
within a piece, developed edge lengths exactly `1.000000000`, corner angles
exactly `63.4349°/116.5651°`.

## Patches

The P1 tiles map onto rhomb clusters (confirmed in `emitRhombs`):

| shape | cluster | rhombi |
|---|---|---|
| star | `Pe5` | 5 thick |
| boat | `Pe3` | 3 thick + 1 thin |
| diamond | `Pe1` | 1 thick + 2 thin |

Each seed is expanded a generation or two and printed as an **independent
one-sheet model** — no cross-sheet edge matching. `deca-shape-expansion.png` is
the `penrose-mosaic` reference showing four generations.

## Print

Side length, page and margin are all free parameters, in mm, cm or inches —
nothing is pinned to 20 mm. Sheets render as SVG at exact physical units with a
print stylesheet; the browser's Save as PDF gives reliable 1:1 with no PDF
library. Each crease carries its fold angle (36/72/108, dash length) and
mountain or valley (colour).

20 mm is a sensible default: strips advance 17.9 mm per face, ten faces to a
Letter row, and it folds crisply in 100–120 gsm office paper. Below about 12 mm
the 108° creases get fiddly.

From the command line: `node tools/bfs-unfold.mjs [--gen=] [--side=] [--page=]
[--margin=] [--mode=widened|bfs|strips] [--svg=DIR] [--angles]`.

## Fixed: the pentagrid index formula is gone

`assignIndicesFromPentagrid` was unsalvageable, not merely misconfigured. The
pentagrid and the tiling are **dual spaces**, so `Σ floor(x·u_j/d)` over tiling
coordinates telescopes to a bounded quantity that is not `Σ n_j` at all — in fact
`Σ_k (x·u_k/d) = 0` identically, so the sum of floors can only land in `{−4…0}`.
No choice of `gridSpacing` fixes that; it merely happened to agree at gen 2.
`legacy.html` defaults to gen 3, so its index display was wrong as shipped.

Replaced by `computeLift()`, which integrates `n ∈ Z⁵` along edges by BFS. Exact
everywhere: all 21 seed/generation combinations give 0 bad edges, 0 conflicts,
index ⊂ {1,2,3,4}, up to 1380 rhombi.

Two traps when matching planar edges to generators, both of which bit once:
as *undirected* lines the five directions sit 36° apart, not 72°; and
representatives normalised to one half-plane make two of the five the negatives
of the true `ζʲ`, silently negating two components of `n`. The fix is a directed
72°-spaced fan with ± resolved per edge. Note the position-error check is
self-consistent under both bugs and catches neither — what caught them was the
index range `{1,2,3,4}` and the fold-angle set `{36,72,108}`.

## Build

`npm run build` runs `npm run vendor` (copies three.js out of `node_modules`
into `vendor/`) then `tsc`. Both `dist/` and `vendor/` are gitignored, so a fresh
clone needs `npm install && npm run build` before serving.

## Open

- Deployed to GitHub Pages from `main` by `.github/workflows/deploy.yml`.
- `deca-shape-expansion.png` is kept locally but is not in the repository; it was
  purged from history, taking `.git` from 11 MB to under 300 KB.
