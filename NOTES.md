# Working notes

Running record of decisions, findings and open questions. `PLAN.md` describes what
the project *is*; this is what we have argued about and what is still unsettled.

---

## Naming and vocabulary

**Penrose vertex figures.** Conway named the seven vertex figures of the P2
(kite-and-dart) tiling: sun · star · ace · deuce · jack · queen · king. (The ace is
sometimes the *fool's kite*; naming varies between sources.)

**The three symmetric tilings** — Jeff's, after research, and it corrects an
earlier claim of mine that there were two:

- **Sun** and **Star**, each with five mirror axes. They are complementary: there
  is an involution **T** exchanging the `St*` and `Pe*` families, `T(T(x)) = x`.
- **Queen**, the **deca**. Symmetric about the vertical axis only, and its mirror
  is not a plain reflection — the left side melds to the right as Sun does to Star.
  The involution simply reverses the roles.

"Exactly two have global *five-fold* symmetry" is still right; the deca's symmetry
is bilateral. Measured and agrees: the deca has one mirror axis at generations 2, 3
and 4 and no 72° rotation, where Pe5 and St5 have both.

**Spelling.** Use **color**, not colour, in UI labels and prose. (US English.)

**"Mode"** on the Unfold page means *Build by hand* vs *Watch an algorithm*.

---

## Decided

- **Unfold** is the page name (verb against Net's noun). Entry point
  `src/workbench.ts`; `src/unfold.ts` is the algorithms module.
- **Alt-click removes**, not Ctrl — Ctrl-click is right-click on macOS.
- **Overlaps are allowed but flagged.** The user is the search; the tool warns.
- **Trace, not re-enactment.** Algorithms emit a step log; the player replays it.
  Verified: every prefix rebuilds the real net exactly, polygon and corner order.
- **Fit-to-page tests the net's own edge directions** plus perpendiculars — a
  development only uses about nine — scored by worst axis ratio `max(w/PW, h/PH)`.
- **The view is fitted once and held during replay.** Re-fitting per frame lurches.
- **Instructions collapse**; controls sit directly above the canvases.

---

## Open: shading is wrong, and there is one control too many

Two controls exist that should be one, and the thing they control is misdrawn.

**Today.** *Hills up / Dales up* flips the lift (`index → lo+hi−index`) — real
geometry, every mountain becomes a valley. *Heads / Tails* flips only the gradient
direction on each face — pure decoration. They are independent, which is
incoherent: shading depicts height, so flipping the roof must flip the shading.

**And the shading carries no absolute information.** `makeGradient` puts three
stops — white, fill, darkened — along each face's own v0→v2 diagonal. A rhombus
spanning heights 1→3 is therefore shaded identically to one spanning 2→4. But
heights take **four** absolute levels across the whole patch, and within a rhombus
the isoglosses divide its 2-level span into **eight** steps at quarter-index
intervals.

**Done.** Both pages now carry a single **−1 … +1** height slider: sign is the
flip, magnitude the depth, biased `sign(u)·|u|^1.6` so the middle of the travel is
spread out. On 3D the magnitude flattens the surface; on the workbench it sets how
strongly height is shaded, zero leaving flat color. `Heads/Tails` and
`Hills up / Dales up` are both gone.

Shading is now keyed to **absolute** height: one ramp across the patch's whole
index range, with each face drawing the segment its own corners span. Two stops
suffice because height varies affinely along the v0→v2 diagonal — the old third
stop at 2/3 was what encoded the wrong thing. Verified on Pe3 gen 3, which
contains faces spanning 1→3 and 2→4: those two used to render identically and now
differ (luminance 208.6→128.2 against 168.8→88.4).

Color and shading are separate, as they should be: color is the constant tile
property, shading the height layer over it.

### Trap: corner order is not the same on both canvases

Worth writing down because it cost three rounds. The gradient originally took its
two stops from corners **0 and 2**. That is right for the generator, which emits
`i, i+1, i+2, i+1` — scanned across every seed and generation with no exception,
which is precisely what made it feel safe. But `placeAcross` re-orders every rhomb
to begin at the edge it arrived across, so on the **net canvas** the order is
frequently `2,1,2,3`: positions 0 and 2 both hold index 2, the two stops come out
identical, and the tile renders flat. Roughly half of them — 13 of 25 on Pe5 gen 2,
72 of 140 on gen 3.

Take **argmin and argmax** of the four indices instead. Order-independent, and the
extremes of a rhombus are always opposite so the gradient still runs along a
diagonal. `isoglossSegments` had been doing this correctly all along — it searches
for the lowest corner rather than assuming a position — which is why the contours
looked right while the fills did not. The same idea written twice, once right.

**Anything reading a rhomb's corners must not assume a position.** Positions carry
meaning only within the canvas that produced them.

### And the verification was aimed at the wrong thing

The scan that found "no equal-stop tiles anywhere" only ever looked at
`allRhombs`, the tiling view. The bug lived entirely in the unfolder's ordering, so
the check kept certifying the canvas that was not broken and argued against the
evidence. What broke it open was the page reporting `25/25 tiles get two different
stops` while the tiles were visibly flat — a contradiction that can only mean the
measurement and the symptom are looking at different things.

Hence the diagnostics now in place: every build stamps `src/build-id.ts` and the
workbench logs it, so a stale script is one glance to spot; and `generate()`
reports colour mode, shade depth, index range and the equal-stop count **for both
canvases**.

**Done:** isogloss contours are on the workbench too, drawn on both canvases and
switchable at any time — on a finished net as readily as an empty one. Same
construction as 3D: seven per rhombus dividing the long diagonal into eight, which
lands them on quarter-index steps. Verified against Pe3 gen 3, where every
rhombus shows the corner pattern 0,1,2,1, a segment's two endpoints differ in
index by exactly 0, and the eleven levels 1.25 … 3.75 are all quarter steps.

Both height sliders now ease to the nearest of −1, 0, +1 when released. Those
three are the settings that mean anything; the travel between them is how the
surface is seen coming out of the plane, so it stays free and only the landing
snaps.

---

## Settled: `Pe*` are pentagons; use proper names

`gen0-P1-tiles--rhomb-mappings.png` in this directory shows all five tile types
with their rhombs overlaid, and settles it. **`Pe5`, `Pe3` and `Pe1` are
pentagons** — the marked pentagons of P1. `St5`, `St3`, `St1` are the actual star,
boat and diamond.

What confused it: the rhombs a `Pe` tile carries at generation 1 *resemble* the
`St` tiles — `Pe5`'s make a star outline, `Pe3`'s a boat, `Pe1`'s a diamond — so
the cluster colours were named for the shapes they look like. Formally they are
`Pe*`. The measurement agrees and now makes sense: `Pe5`'s convex hull is a regular
pentagon at every generation because `Pe5` *is* a pentagon; its star look comes
from the rhomb overlay reaching past the hull.

**Use the proper names throughout, appearance notwithstanding.** All seven seeds
are offered on every page: `Pe5`/`Pe3`/`Pe1` pentagons, `St5` star, `St3` boat,
`St1` diamond, and `Deca`.

Two further facts from Jeff worth keeping: the `St*` tiles emit **no rhombs at
generation 1** and first contribute a generation later; and the three `Pe` groups
constitute three new shapes that tile the plane periodically, a colouring he
doubts he was first to find. Mapping the full correspondence needs the gen-3 rhombs
of `St*` as well as of `Pe*` — the `Pe*` alone are not sufficient.

---

## Open: the rhombus side, and units

`GOLDEN_SIDE = √5/2 = 1.118034` **inches**, inherited from the first PLAN.md
("side = φ − ½ ≈ 1.118in", canvas "1:1 to inches for print fidelity"). It is not
natively metric. It is a golden-ratio number chosen for tidiness with no physical
merit, and it caps a Letter sheet at roughly twenty rhombi.

Options:

| | |
|---|---|
| **A** | Default **20 mm**, matching the Net page. Two pages then agree, and 20 mm folds crisply in 100–120 gsm. |
| **B** | Default **1 in** — round, imperial, close to what is there now. |
| **C** | Keep √5/2 in and just label it honestly. |
| **D** | Presets (15 / 20 / 25 mm, ½ / ¾ / 1 in) plus free entry. |

**Decided: 1 inch.** Round, and the workbench stays inch-native as it was designed
to be. The box still accepts mm, cm or in, and is labelled so.

---

## Done: patch controls stay live during Watch

`setMode` used to set `pointerEvents: none` on the whole control bar. Now only
`Clear` and `Undo` are disabled — Print stays, since printing the algorithm's
output is the point — and changing seed or generation mid-replay re-runs the
trace.

---

## Open: should Unfold absorb the Net page?

Unfold now has patch and generation selection, all three methods (through Watch),
fit-to-page, a side control, and vector printing at true size. The Net page has
patch, generation, method, side, page, margin, tint, angle labels and printing.

**What Net still does that Unfold does not:** lay a *whole* decomposition out
across multiple sheets, and offer page size and margin. Unfold prints only what is
on its canvas.

**Argument to merge:** two print paths, two side controls, two patch selectors,
already drifting (Net offers generations 2–4, the 3D page 2–5).

**Argument to keep both:** Net is the "give me the answer" page — pick and print.
Unfold is the "show me why" page. Merging risks one page that does both jobs
worse.

**Decided: Unfold absorbs Net.** What Net has that Unfold lacked was printing a
whole decomposition; what Unfold has that Net lacks is the tiling panel showing
which region the output covers.

Step 1 is **done, and turned out to be free**: `printNet` groups by hinge
components, and those are exactly the pieces — checked against `widened`, `bfs` and
`strips` at gen 3, where component counts and sizes match the decomposition
exactly (8/8, 4/4, 28/28). So Print in Watch mode already lays a whole
decomposition across sheets. The only thing blocking it was that Print had been
marked build-only.

Remaining: page and margin controls on the workbench (reusing `PAGES` and
`parseLength` from `sheet.ts`, which `refreshNetView` and `printNet` currently
hardcode), then retire `net.html`. Both wait on browser confirmation.

---

## Plan: cut forests and branch cuts

*Written down deliberately, so it survives a cleared session. This is the next
substantial piece of work and it changes how sheets are handled.*

**Stage A is done — see "Done: branch-cut routing" below. Stage B (paper packing)
is still open.**

### The reframing

Watching a patch unfold, the overlaps are **branch points**, and the cuts that
relieve them are **branch cuts** in exactly the sense of `log` and `√` in complex
analysis. A multivalued function is made single-valued by cutting the plane; a
surface with curvature is made flat by cutting the tiling. When the development
wants to wrap over itself, you either cut, or you go up a level — and in complex
analysis that level is another **sheet** of the Riemann surface, while here it is
another **sheet of paper**. The pun is exact and worth keeping: a branch cut is the
decision point to move up a z coordinate.

### Separate the two constraints

They are currently tangled together in the unfolding methods, which is why the
results are hard to reason about. Split them:

**Stage A — cutting (paper-agnostic).** Ignore paper size entirely. Ignore how big
the result is.

> A **net** is one connected unfolded piece.
> The **cut tree** is the set of edges cut to produce it; over several nets, a
> **cut forest**.
> *Find a cut forest whose every component unfolds overlap-free, minimising the
> number of connected components, and secondarily minimising orphans — the tiny
> one- and two-rhomb pieces.*

Hard constraint: each component overlap-free. Objective: fewest components. Tie
break: avoid slivers. Nothing about paper enters here.

**Stage B — packing (physical).** Take those nets and fit them to real sheets.
Where a net is too big for the paper, introduce *further* branch cuts to divide it.
That is a separate decision, made later, and it is allowed to be crude — a cut for
paper is not a cut for geometry.

Jeff's preference at Stage A is **large nets**. A second or third sheet to absorb
an overlap is fine; many small pieces are not.

### What exists to build on

`src/unfold.ts` has three greedy methods — `unfoldPatch` (BFS), `ribbonGrowPatch`
(widened ribbons, the default), `stripPatch` (pure de Bruijn ribbons). All three
place faces through `placeSeed` / `placeAcross`, test with `convexOverlap` on
polygons shrunk to 0.94, and emit a trace. The invariant `|hinges| = faces − pieces`
holds for all of them: hinges are a spanning forest of the face dual graph, and
**every other interior edge is a cut** — those are the branch cuts, and they are
exactly the edges bounding the angular-defect wedges.

Measured at generations 2–4: widened ribbons put 80–90% of a patch into one piece
but leave many slivers; BFS gets fewer components overall but more of them big
enough to be real work; strips are provably overlap-free at any length yet need
5× the pieces. None of them optimises anything — they are all first-fit.

`src/sheet.ts` already does Stage B mechanically: `layoutSheets` shelf-packs and
`renderSheet` draws at true size. What it lacks is the ability to *split* a net
that will not fit.

### Notes toward Stage A

- Minimising components subject to overlap-freeness is a global problem and the
  current greedy is only a baseline. Worth trying, roughly in order of effort:
  seed search (already there for BFS, capped at 150 faces); a merge pass that
  attempts to join two components across a cut edge and keeps the join if it stays
  overlap-free; local search that removes a cut and repairs elsewhere.
- Overlap is not monotone in an obvious way — adding a face can only make a
  component harder to place, but *which* face you added earlier changes what is
  reachable. That is what makes greedy weak here.
- The angular defect is the source of every forced cut: a saddle vertex has more
  than 360° of paper meeting at a point, so the faces around it can never all stay
  joined.

**But saddles do not bound the number of components, and measuring that is the most
useful thing found so far.** Counted:

| patch | rhombi | interior vertices | saddles | widened pieces | BFS pieces |
|---|---|---|---|---|---|
| Pe3 gen 2 | 23 | 15 | 4 | 1 | 1 |
| Deca gen 3 | 80 | 66 | 18 | 2 | 1 |
| Pe1 gen 3 | 138 | 111 | 31 | 7 | 4 |
| Pe5 gen 3 | 140 | 111 | 35 | 8 | 6 |
| Pe3 gen 4 | 878 | 770 | 239 | 61 | 51 |

Pe3 gen 2 has four saddles and still unfolds into **one** piece. So a saddle forces
a **cut**, not a **component** — and that is the complex-analysis picture exactly. A
branch cut runs from the branch point out to the boundary and the plane stays
connected; here a cut runs from the saddle out to the patch edge and the net stays
in one piece. Components only appear when a cut *cannot* reach the boundary without
the piece overlapping itself, or when a greedy method simply gives up and starts
again.

That suggests Stage A is posed wrongly as "grow pieces and split when stuck". The
better formulation is:

> Route a branch cut from every saddle vertex out to the boundary, choosing routes
> that leave the development overlap-free. Components are a failure mode, not the
> unit of work.

Which is a path-routing problem on the dual graph, not a region-growing one, and
plausibly does far better than the greedy methods on exactly the patches where they
do worst — note BFS needs 51 pieces at gen 4 against 239 saddles, so the two
numbers are not even proportional.

### Open

- Is there a lower bound on component count from the defect structure alone?
- Should Stage B's paper cuts be preferred along ribbon boundaries, where the
  geometry is already straight and a join is easy to align?

## Done: branch-cut routing

Stage A of the plan above, implemented in `src/cuttree.ts` as `cutTreeUnfold`.
It replaces guessing with a construction.

### The idea

The three older methods grow a region greedily and start a new piece whenever a
placement collides, so the number of pieces is an *outcome* rather than a choice.
It need not be. Measured across every patch, with no deviation:

```
E_int = V_int + F − 1          so a one-piece net cuts exactly V_int edges
```

which is the classical cut-tree duality. Contract the whole patch boundary to a
single node R, and **a one-piece net is exactly a spanning tree of the vertex
graph rooted at R**. Every interior vertex must carry an incident cut — the faces
around it form a cycle in the dual, and a forest has none — and the tree's
branches run from interior vertices out to the boundary. They are branch cuts in
the sense of `log` and `√`.

So connectivity stops being something to optimise: it is guaranteed by
construction, and the only remaining problem is overlap. That is a far better
shaped search, because *every* candidate is already a valid one-piece net and can
be graded by a count rather than a yes/no.

### How it searches

1. **Candidates.** Shortest-route tree from R (each interior vertex cuts along its
   shortest path to the boundary — literally "branch cuts to the edge"), plus
   jittered and randomised weights through Kruskal, for diversity.
2. **Develop.** The hinges are the interior edges *not* cut; they form a spanning
   tree of the dual by construction, walked with the same `placeSeed`/`placeAcross`
   as every other method. No greedy choices survive — the cut set determines the
   net completely, which is why the trace replays bit-exactly.
3. **Local search.** Take an overlapping pair, find the hinges on the dual-tree
   path *between* them — cutting anything off that path cannot change how those two
   sit relative to each other — and swap one in: adding a hinge to the cut set
   closes exactly one cycle in the vertex graph, so removing any other edge of that
   cycle restores a spanning tree. Six drop candidates are tried per swap and the
   best kept; sideways moves are accepted about a third of the time, which is what
   gets off the plateaus. The cut set stays valid throughout, so every intermediate
   state is still a one-piece net.

An interior edge with *both* ends on the boundary becomes a self-loop at R and can
never be chosen — correctly, since cutting it would sever the patch.

### Results

One piece, zero overlaps, on **every** patch through generation 3 — in under half
a second. Against the older methods:

| patch | rhombi | branch cuts | flat variant | widened | BFS |
|---|---|---|---|---|---|
| any seed, gen 2 | 3–25 | **1 piece, 0 overlaps** | 1 | 1–2 | 1–2 |
| any seed, gen 3 | 45–165 | **1 piece, 0 overlaps** | 1 | 2–8 | 1–6 |
| Pe5 gen 4 | 835 | 1 piece, 5 overlaps | 3 | 57 | 50 |
| Pe3 gen 4 | 878 | **1 piece, 0 overlaps** | 1 | 61 | 51 |
| Pe1 gen 4 | 921 | 1 piece, 2 overlaps | 2 | 64 | 50 |
| Deca gen 4 | 610 | **1 piece, 0 overlaps** | 1 | 31 | 28 |
| St5 gen 4 | 1380 | 1 piece, 1 overlap | 3 | 73 | 73 |
| St3 gen 4 | 894 | **1 piece, 0 overlaps** | 1 | 47 | 40 |
| St1 gen 4 | 408 | **1 piece, 0 overlaps** | 1 | 19 | 21 |

Gen 4 runs to a 20 s budget; it converges steadily rather than stalling (Pe5:
405 → 124 → 18 → 5 overlaps at 3/6/12/25 s), so the remainder is throughput, not a
dead end.

**Both answers are reported**, as agreed. The one-piece result carries its residual
overlap count — those are the places that would go up a z coordinate onto another
physical sheet — and `result.flat` is the fully-flat alternative, obtained by
adding hinges to the cut set without removing anything, which severs the dual tree
and buys one extra piece per cut. Free when the one-piece net is already clean.

### Saddles force cuts, not pieces

Worth restating, because it is what made the old methods look inevitable: Pe3 gen 2
has 4 saddle vertices and unfolds whole; Pe3 gen 4 has 239 saddles against BFS's 51
pieces, and now unfolds whole too. Negative curvature demands a *cut*. It never
demanded a second piece.

### Verified

All 14 seed/generation combinations through gen 3, zero failures: `cuts == V_int`;
`hinges == F − pieces`; `cuts + hinges == E_int`; the cut set acyclic *and* spanning
in the boundary-contracted graph; developed edge lengths within 1e-9 of 1 and every
corner angle within 1e-4 of 63.4349°/116.5651°; the grid overlap count equal to the
O(n²) sweep exactly, not merely agreeing on the verdict; the flat variant actually
flat; and the trace replaying every net with **0.0 deviation**.

### Retired: ribbon strips

`stripPatch` is gone, along with `--mode=strips` and the two UI options. The
theorem stands and is kept on `info.html`: every crease in a de Bruijn ribbon is
parallel, so a strip is a generalized cylinder and **provably cannot self-overlap
at any length**, with crease spacing exactly `2/√5`. But a ribbon only reaches the
two fifths of rhombi sharing its direction, so strips cost about five times the
pieces — 41–46 at gen 3 where branch cuts need 1. It is still the reason a widened
ribbon makes a good backbone. `makeRunFinder` and the `Run`/`StripLink` machinery
stay, because `ribbonGrowPatch` uses them.

### Still open

The gen-3 nets are one piece but far too big for one sheet — 336×391 mm at 20 mm
side against Letter's usable 191×254. That is precisely Stage B, untouched: cutting
a finished net down to paper, and packing the rectangles onto sheets.

## The rhombohedra are the real components

Worth keeping in mind, because the site presents the roof as a surface and it is
easy to forget what it is the surface *of*.

The two golden rhombohedra — **acute** (prolate) and **obtuse** (oblate) — are the
actual three-dimensional components. They tile space aperiodically, and the
Wieringa roof is the boundary of a layer of them: every rhomb you fold is a face of
one, and the fold angles are the dihedral angles where two of them meet. The
surface is the visible part; the solids are the thing.

**Equal numbers of the two build a rhombic triacontahedron** — ten of each. This is
classical, not something found here. Confirmed numerically along the way:

| | volume | dihedral |
|---|---|---|
| acute (prolate) | 0.76085 s³ | 72° throughout |
| obtuse (oblate) | 0.47023 s³ | 144° throughout |

`10 × (0.76085 + 0.47023) = 12.31073 = 4√(5+2√5) · s³`, which is the
triacontahedron's volume exactly. Their volumes stand in the ratio φ, and each
solid has a single dihedral angle throughout — unusual, and what makes them so
easy to build.

Both are on `polyhedra.html`, turnable, in the same colours and contours as the
roof.

## Known and deliberate

- **Gen 5 is on the 3D page but not Net.** The unfolding methods take 1.2–2.5 s at
  5,719 rhombi against 48–76 ms at gen 4.
- **`Pe5` closes the loop exactly; `Pe3` and `Pe1` do not — and the reason is the
  substitution's symmetry.** Each pentagon expands to a blue centre with five
  petals, but only Pe5's petals are all alike: blue + 5 yellow, against Pe3's
  3 yellow + 2 orange and Pe1's 1 yellow + 4 orange. The rules say the same thing —
  `Pe5` has `twist [0,0,0,0,0]` and no diamonds, so its substitution is unchanged
  by a 72° turn, while `Pe3` and `Pe1` have twists that differ position to
  position.

  So a Pe5 patch is five-fold symmetric at *every* generation (measured: 72°
  rotational symmetry yes for Pe5, no for Pe3/Pe1), and a five-fold-symmetric
  convex hull on a tiling with five edge directions can only be a regular pentagon.
  Hence the support-function differences of ~1e-16 and the ratio
  1.236068 = 1/cos 36°. The other two break the symmetry and their outlines drift
  toward the substitution's own attractor, 0.16 and 0.21 from their seeds.

  Recorded because it was listed as an open question for a while: the two
  measurements — exact pentagon hull, and exact 72° symmetry — were two faces of
  one fact, and were taken separately without noticing.
- **Canvas pixels are not CSS pixels.** Both canvases size at `devicePixelRatio`;
  every hit test must scale by `canvas.width / rect.width`. This bit once and is
  invisible at dpr 1.

---

## Testing reality

Everything is verified numerically and by loading pages. Interaction is barely
tested in a browser. The least-exercised parts, in order: the transport controls,
the two canvas hit-tests, and printing.

Two failures so far were browser-only and cost hours each — a stale cached script,
and a rendering bug on the canvas the numerical checks did not cover. Both are now
instrumented rather than argued about:

- `npm run serve` (`tools/serve.py`) sends `no-store`, so a reload genuinely
  reloads. Do not use `python3 -m http.server`, which sends `Last-Modified` and no
  `Cache-Control` and lets the browser invent a freshness window.
- Every build stamps itself; the console line `workbench build HH:MM:SS` settles
  "am I even running this code" immediately.
- `site.js` shows a red banner for any uncaught error, so a page that silently
  fails to start says why.
