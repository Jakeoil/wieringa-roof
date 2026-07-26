# Wieringa Roof

A small site for exploring the Wieringa roof and producing printable nets of
golden rhombi for physical models.

## Pages

| page | content | state |
|---|---|---|
| `index.html` | splash — what the surface is, links to everything | done |
| `net.html` | patch selector → ribbon-strip decomposition → PDF | placeholder |
| `roof3d.html` | three.js prototype of the surface | placeholder |
| `info.html` | the maths: golden rhombus, heights, fold angles, defects, solids | done |
| `legacy.html` | original two-canvas explorer, kept for reference | done (as-is) |

`src/legacy.ts` (formerly `src/main.ts`) is the original explorer, untouched.
`site.css` is the shared shell. `tsc` compiles all of `src/` → `dist/`.

Planned additions: `src/geometry.ts` (shared lift + tiling), `src/net.ts`,
`src/roof3d.ts`.

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

## Net method

**Ribbon strips.** In a de Bruijn ribbon, consecutive rhombi share an edge
parallel to the same `E_j`, so all creases in a strip are parallel; the strip is
therefore a generalized cylinder and develops into a straight band with parallel
creases at monotonically increasing positions.

⇒ **Ribbon strips cannot self-overlap at any length**, with no test required.
This replaces the earlier BFS-unfolding plan, which needed overlap detection.

Each rhomb belongs to two ribbons, so no single family partitions a patch. Use
greedy maximal-strip extraction: repeatedly take the longest dual-graph path
whose consecutive shared edges are parallel.

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

Side `s` = 20 mm. Strips advance 17.9 mm per face, ten faces to a Letter row;
rough estimate ~60 rhombi per sheet. Render as SVG at exact physical units with
a print stylesheet and use the browser's Save as PDF — no PDF library, reliable
1:1 scale. Annotate each crease with its fold angle and mountain/valley.

## Open

- Expansion generation per seed, to be picked against real rhomb counts.
- Vendor `three.module.js` + import map for `roof3d.html`.
- Six loose `test-*.mjs` probes from the vertex-index investigation are still in
  the tree; they are in git history and can be cleared out.
