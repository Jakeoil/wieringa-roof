# Wieringa Roof

Decisions, arguments and open questions live in [NOTES.md](NOTES.md); this file
describes what the project is.

A small site for exploring the Wieringa roof and producing printable nets of
golden rhombi for physical models.

## Pages

| page | content | state |
|---|---|---|
| `index.html` | splash — what the surface is, links to everything | done |
| `roof3d.html` | three.js prototype of the surface | done |
| `info.html` | "Mathematics" — golden rhombus, heights, fold angles, defects | done |
| `polyhedra.html` | triacontahedron + the two rhombohedra, generated diagrams | done |
| `unfold.html` | build or replay a net, layer selector, print at true size | done |
| `tools.html` | true-size templates, fold gauges, forming jigs, kit list | done |
| `sheets.html` | nine finished nets at true size, 1 in to a rhombus, ready to cut | done |

`src/geometry.ts` holds the tiling and the lift; `src/unfold.ts` the two
region-growing methods and `src/cuttree.ts` the branch-cut routing; `src/sheet.ts` layout and SVG;
`src/roof3d.ts` and `src/workbench.ts` are the per-page entry points. `site.css` is the
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

Three, selectable and replayable on `unfold.html`.

**Branch cuts** (`cutTreeUnfold`, `src/cuttree.ts`, the default). Does not grow a
region at all. `E_int = V_int + F − 1` holds exactly on every patch, so a one-piece
net cuts precisely one edge per interior vertex; contract the boundary to a point
and such a cut set is a **spanning tree of the vertex graph**, its branches running
from interior vertices out to the edge — branch cuts in the sense of `log` and `√`.
Connectivity is therefore guaranteed by construction and only overlap remains to be
searched for, by spanning-tree edge swaps aimed at the dual path between an
overlapping pair. **One piece with no overlaps on every patch through generation 3**,
in well under a second. Reports both answers: the one-piece net with its residual
overlap count, and `result.flat`, a fully flat variant costing one extra piece per
added cut.

**Widened ribbons** (`ribbonGrowPatch`). Takes the longest de Bruijn ribbon as a
backbone, places it, then accretes neighbours across any edge — longest backbone
first, so it gets first claim on contested rhombi. Gathers 80–90% of a patch into
one piece.

**BFS unfolding** (`unfoldPatch`). Spreads outward in rings from a seed rhomb,
rejecting overlapping placements; tries every rhomb as seed when the patch is
small enough. Fewer pieces than widened, but more evenly sized, so more real joins.

**Crease vs cut is decided by the hinge set, not piece membership.** An unfolding
keeps only `F − 1` hinges (a spanning tree of the face graph); every other
interior edge is cut even when both its faces are in the same piece. Those are
exactly the edges bounding the angular-defect wedges. `|hinges| = faces − pieces`
is asserted.

**Ribbon strips are retired.** They were provably overlap-free at any length —
every crease in a ribbon is parallel, so it is a generalized cylinder — but a
ribbon reaches only the 2/5 of rhombi sharing its direction, costing ~5× the
pieces. The theorem is kept on `info.html` and in `NOTES.md`.

### Measured

Pieces (and overlaps for the one-piece branch-cut result):

| patch | rhombi | branch cuts | widened | BFS |
|---|---|---|---|---|
| gen 2 | 3–25 | **1 piece, 0 overlaps** | 1–2 | 1–2 |
| gen 3 | 45–165 | **1 piece, 0 overlaps** | 2–8 | 1–6 |
| gen 4 | 408–1380 | 1 piece, 0–5 overlaps | 19–73 | 21–73 |

All validated at generations 2–4: cut sets acyclic and spanning, hinge counts
balance, developed edge lengths exactly `1.000000000`, corner angles exactly
`63.4349°/116.5651°`, grid overlap counts identical to the O(n²) sweep, and traces
replaying with zero deviation.

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

## Sheets

`node tools/make-sheets.mjs` regenerates `sheets.html` plus one standalone SVG per
model in `sheets/`. **One inch is the rhombus side**, and every generation-2 seed
fits a single Letter sheet at exactly that — one inch, one model, one page, no
arithmetic. Generation 3 exceeds a page at 1 in; only St1 (0.7 in) and Deca (0.5 in)
fit reduced, and the rest need a net split across sheets, which is Stage B.

The generator verifies before it writes: one piece, zero overlaps by exact area,
inside the printable frame, and a side of at least 12 mm — below that the 72°
dihedrals stop being foldable. Anything failing is reported and skipped, so the page
never carries a net that cannot be built.

Note `unfold.html` still defaults to 1.118 in, which is `√5/2` and makes each edge's
rise `s/√5` exactly half an inch. Elegant for measuring heights, arbitrary for paper.

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
[--margin=] [--mode=cuttree|widened|bfs] [--budget=ms] [--svg=DIR] [--angles]`.

## Fixed: the pentagrid index formula is gone

`assignIndicesFromPentagrid` was unsalvageable, not merely misconfigured. The
pentagrid and the tiling are **dual spaces**, so `Σ floor(x·u_j/d)` over tiling
coordinates telescopes to a bounded quantity that is not `Σ n_j` at all — in fact
`Σ_k (x·u_k/d) = 0` identically, so the sum of floors can only land in `{−4…0}`.
No choice of `gridSpacing` fixes that; it merely happened to agree at gen 2.
The workbench defaulted to gen 3 at the time, so its index display was wrong as shipped.

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

## Deployment

Live at https://jakeoil.github.io/wieringa-roof/, built from `main` by
`.github/workflows/deploy.yml`. `deca-shape-expansion.png` is kept locally but is
not in the repository; it was purged from history, taking `.git` from 11 MB to
under 300 KB.

## The workbench

`unfold.html` (formerly `legacy.html`, entry point `src/workbench.ts`) does the
hand-driven unfolding the original plan asked for, plus a replay player over the
trace the algorithms emit. Placement goes through the same `placeSeed`/`placeAcross`
primitives as the automatic methods, so its geometry is identical.

The net is oriented and centred on the sheet by testing the net's own edge
directions and their perpendiculars — a development only ever uses about nine, so
this is an exhaustive check of a couple of dozen angles rather than a search,
scored by the worst axis ratio `max(w/PW, h/PH)`.

## Open

- Nothing here has been exercised in a browser beyond loading and looking; the
  transport controls and the two hit-tests are the least-tested parts.
- Generation 5 is offered on the 3D page but not the net page: the unfolding
  methods take 1.2–2.5 s at 5,719 rhombi, against 48–76 ms at gen 4.
- **Stage B — fitting paper.** Branch cuts give one piece, but a gen-3 net is
  336×391 mm at 20 mm side against Letter's usable 191×254. Splitting a finished
  net to fit, and packing the rectangles onto sheets, is the next work.
- `Pe3` and `Pe1` patch outlines converge to a limit that is not their seed shape
  (distance plateaus at 0.16 and 0.21). Only `Pe5` closes the loop exactly, its
  hull being a regular pentagon at every generation. Worth understanding why.
