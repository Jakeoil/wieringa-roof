# Wieringa Roof

Decisions, arguments and open questions live in [NOTES.md](NOTES.md); this file
describes what the project is.

A small site for exploring the Wieringa roof and producing printable nets of
golden rhombi for physical models.

## Pages

| page | content | state |
|---|---|---|
| `index.html` | splash — what the surface is, links to everything | done |
| `roof3d.html` | three.js prototype of the surface, generations 1–5 | done |
| `info.html` | "Mathematics" — golden rhombus, heights, fold angles, defects | done |
| `polyhedra.html` | triacontahedron + the two rhombohedra, generated diagrams | done |
| `unfold.html` | **Workbench** and **Sheets**, two views of one page | done |
| `tools.html` | true-size templates, fold gauges, forming jigs, kit list | done |


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

## Stage B: splitting a net across pages

`src/paginate.ts`, driven from `unfold.html` by **Create sheets**. The workbench is
the master: configure the patch and method, get one net, split it when it looks
right.

Splits run **along hinges**, never through a rhombus, so every face lands whole on
one sheet. A severed hinge stops being a fold and becomes a taped join, labelled with
a capital letter and the page number of its other half — `A▸3` tapes to `A▸1` on
sheet 3. Verified: every letter appears on exactly two sheets and each points back at
the other.

Two facts shape it. The hinges form a **spanning tree**, so removing k edges gives
exactly k+1 components: **pages = joins + 1**, and minimising taped joins *is*
minimising sheets. And all pages share **one orientation**, chosen from the net's own
edge directions to need the fewest sheets — worth 2–4 sheets on some patches
(Pe1 gen 3: 11 → 7). That costs a little paper against rotating each page to fit, and
buys being able to lay the sheets out and see them line up.

Each join is drawn as a **tab outside the cut**, shaped like the adjoining rhombus
truncated at text height. Since a rhombus's adjacent angles are supplementary that
comes out a parallelogram — a slice of the piece that continues elsewhere — and the
letter runs parallel to the cut. Tabs hang outside the page's bounding box, so their
height is reserved on every edge before paginating.

Every sheet carries a **locator thumbnail**: the whole net with this sheet shaded and
every join dotted, ≈2.7 square inches, placed in whichever corner the net's own faces
leave clearest.

**Shading and isoglosses on the printed sheet are separate from the height slider.**
The slider sets which way up the surface sits and how strongly the *screen* shades it;
the render checkboxes decide whether that reaches paper. A flat height setting carries
no hills-or-dales information, so rendering falls back to hills.

Measured at 1 in on Letter with tab allowance: gen 2 is one sheet with no joins;
gen 3 is 4–9 sheets (St5 9, Pe3 8, Pe1 8, Deca 4). Under 100 ms even at 1380 faces.

## Sheets

Sheets is a **second view of the Workbench page**, not a page of its own. Per-sheet
print buttons, print-all, a preview, and the rendering settings — because shading and
isoglosses are print decisions, not modelling ones.

Sharing a document is what makes it simple: the net is already in memory, so there is
nothing to serialise, nothing to rebuild, no format to keep in sync, and switching is
instant. A separate page needed the hinge set passed through `localStorage` and
re-developed on arrival — machinery whose only purpose was surviving a navigation
nobody wanted. The `#sheets` hash deep-links to the view and splits the current net on
arrival.

**The tiling canvas shows the partition.** Once a net is split, each region is drawn
in its sheet's colour on the very canvas the net was built on — before and after in
one picture, keyed to the sheet list, the minis and the Map.

Splitting always uses the **finished** net: a fresh Automatic load parks the scrubber
at step 0, so `createSheets` runs the replay to the end first rather than splitting
whatever prefix happens to be on screen.

Every sheet carries a **locator mini of the patch** — the Penrose tiling, not the
development. The tiling is the picture that can be recognised; the unfolded net is a
shape nobody has seen before, so a mini of it locates nothing. The sheet's rhombi are
filled in that sheet's colour and outlined along its cuts, with folds left out
because at that size the outline is the information.

The **Map** is the same drawing at full size with every sheet in its own colour and
numbered: before cutting it says how the patch divides, after cutting it says which
piece is which. It prints first in *Print all sheets*, and has its own row and print
button. The same colour keys the list, the mini and the map.

**Back side** swaps hills for dales for printing the underside. Reflection is not a
concern: every patch here has a mirror axis.

The previous static `sheets.html` — nine pre-baked models, plus `make-sheets.mjs`,
`make-pdf.sh` and the committed SVG/PDF — is gone. It guessed at the wrong problem:
you want *your* net split, not a fixed menu. `tools/check-pdf.py` survives, since
measuring a PDF for true size is still worth doing.

## Print