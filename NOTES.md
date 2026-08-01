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

## Sun and Star: the three wholes

`Deca` is now labelled **Queen**, and two 5-fold composites join it. Both are
specified by what they *emit*, since the star family emits nothing:

| | composition | gen 1 | 5-fold | mirrors | disc fill |
|---|---|---|---|---|---|
| Sun | 1 `Pe5` + 5 `Pe3` | 25 rhombs | yes | 5 | 66.7 / 67.6 / 64.3% |
| Star | 5 `Pe1` + 5 `Pe3` | 35 rhombs | yes | 5 | **84.6** / 75.2 / 65.2% |
| Queen | 1 `Pe3` + 2 `Pe1` | 10 rhombs | no | 1 | 91.9 / 93.3 / 82.6% |

**Star gen 1 at 84.6% is the best 5-fold result** — against St5's 49%, which is what
it is built on. That is the "fill a circular space" goal met.

### The Sun is Pe5 seen a generation later

`Pe5.twist = [0,0,0,0,0]` with no diamonds, so `expandPenta(Pe5)` *is* a Pe5 ringed
by five Pe3. Sun is that substitution taken one step, so its numbers match Pe5's
shifted by one. It earns its place as a named whole, not as new geometry.

The Star is genuinely new: St5 gives the five `Pe1` free, but puts *boats* in the
outer ring, and boats emit nothing. The five `Pe3` there are the composite's own
contribution and the reason the figure fills where St5 does not.

### Read the arrangement, do not derive it

Both were read off a real tiling — centred on a `Pe5`, the neighbours at radius
14.414 are exactly five `Pe3`; centred on an `St5`, radius 14.414 holds five `Pe1`
and radius 23.322 holds five `Pe3` beside five `St3`.

But **only the arrangement transfers, not the orientations.** The tiles around a
star in a finished tiling were placed by the wider recursion, and in `expandStar`'s
own indexing a boat at tenth 5 points at 90° while the `Pe3` belonging at tenth 5
points at 270°. Copying the measured tenths gave a figure that was 5-fold and
**chiral** — no mirror at all, confirmed against 720 candidate axes — because those
orientations are a local accident. Searching the ten tenths per ring found the pair
that restores all five mirror axes while keeping the patch valid.

### Seed order is load-bearing

The workbench and the 3D page persist a seed *index*, so new seeds go on the **end**
of `seedTypes`. Prepending them silently turned a saved `seed: 1` from Pe3 into
Star. Menu grouping is a display question and belongs in the UI.

## The P1 layer, and how its scale is pinned

The rhombs are P3. P1 is the layer they came from — pentagons, stars, boats,
diamonds — and every rhomb belongs to exactly one P1 tile. `allP1Tiles` now records
the tiles the expansion laid down, which it used to discard after emitting rhombs.

**The point is the tiles that emit nothing.** The star family produces no rhombs at
all, so a gap in the rhomb picture is invisible there while being a perfectly
definite tile on the P1 side. Those are the places a composite can be extended, and
they cannot be picked if they cannot be seen. `unfold.html` gains a P1/P3 view,
side by side or overlaid.

### The view needs its own transform

The main transform is fitted to the tiling canvas, whose pixel size is its CSS width
times `devicePixelRatio`. Reusing it for a fixed 500×500 canvas drew everything about
twice too large and mostly off the edge — "the tiles are huge, nothing to compare".
The P1 view sizes its own canvases and fits both layers together, and **both panels
share that one transform**, which is the only way the layers can be compared.

The fit has to include the P1 outlines, not just the rhombs: a star's points reach
well past any rhomb, so fitting to the rhombs alone clips them.

### Scale is derived, not asserted

Two wrong turns worth recording, since both looked plausible:

- **A pentagon does not contain its own rhombs.** A `Pe5` tile's rhombs form a
  *star*, which is the whole "gen-1 Pe5 looks like St5" observation. Testing
  containment as a validation fails for correct geometry.
- **`wheels.d[k]` is not the apothem at generation k.** It grows by *three* per
  index, not φ² — the wheel entries are not uniform — so picking an index and
  hoping is exactly how this goes wrong.

What pins it is that P1 and P3 must share one scale, so derive one from the other:

```
pentagon circumradius == rhomb edge length
```

which puts adjacent pentagons exactly two apothems apart, edge to edge, as P1
requires. Measured: circumradius 8.9081 against rhomb edge 8.9081, centre-to-centre
14.4137 against 2 × apothem 14.4137.

**Verified: no P1 tile overlaps another**, on every seed at generations 2 and 3 —
6 to 256 tiles per patch. That is the check that validates the whole layer.

### What it shows

`St5` gen 2 makes the case on its own: five orange `Pe1` pentagons around a
**central star gap**, plus five more star gaps outside — six gap tiles, against 15
rhombs from the five pentagons. The right-hand panel shows none of it. That is the
"Star contains St5, with bigger cracks" claim, visible.

It also settles what sits at the centre of a Star: **a star-shaped gap**, not five
diamonds meeting at a point.

A useful thing fell out: `Pe5` gen 2 is six pentagons and *zero* gap tiles, so its
ten cracks are space no P1 tile covers at all. `Pe3` places one diamond
(`diamond: [0]`), `Pe1` places two. That difference is what a Sun or Star composite
would be choosing about.

---

## 3D shading follows the vertical scale

The obvious way to add height shading is a strength control of its own. That is
wrong here, and the reason is worth keeping: the vertical scale slider already runs
from dales-up through **flat** to hills-up, and a flat roof has no height to shade.
An independent strength would happily shade a flat sheet, which is a picture of
something that does not exist.

So the strength *is* `|vscale|` — the same number that flattens the surface. At the
middle of the travel it is zero and the shading is simply gone; every position in
between gets its share, and no control can contradict the geometry.

Within a patch the ramp is signed about **mid-height**, not about the bottom:
`t = ((idx − lo)/span − 0.5) × 2`, so the middle of the range keeps its own colour
and only the extremes move — lighter above, darker below. Flip is applied to the
index first, so inverting the roof inverts the shading with it rather than leaving
the highlights on what are now the low points.

---

## Settled: a composite seed does not spend a generation

`Deca` is not a shape that substitutes — it is an *arrangement* of six shapes that
already exist: **1× Pe3 (yellow), 2× Pe1 (orange), 2× St1, 1× St3**. (Jeff cited it
as 2 Pe3 and 1 Pe1; the counts settle it, since gen-1 emission is Pe3 = 4 rhombi and
Pe1 = 3, so 1×4 + 2×3 = 10 is what Deca emits and 2×4 + 1×3 = 11 is not.)

Because arranging is not substituting, **a composite must expand its parts at `gen`,
not `gen − 1`**. `expandDeca` did the latter, which put Deca a whole generation behind
every other seed — "Deca gen 2" carried the same amount of substitution as "Pe3
gen 1" — and made generation 1 completely empty, since the parts were then asked for
gen 0. One of the four menu entries did nothing.

The fix has two halves, and the second is easy to miss:

| | |
|---|---|
| parts | `gen − 1` → `gen` |
| offsets | `wheels[gen]` → `wheels[gen + 1]` |

**Wheel index `k` places children of generation `k − 1`** — that is the rule
`expandPenta` and `expandStar` already follow. Moving the children without moving the
offsets leaves the right shapes at the wrong spacing: 9 duplicate rhombi at gen 2 and,
by gen 3, 116 duplicates, 276 lift conflicts and vertex indices running to 14 instead
of staying in `{1,2,3,4}`. Counts alone looked fine throughout, which is why this
needs a geometry check and not a headcount.

Deca now reads 10 / 80 / 610 / 4430 at generations 1–4, no duplicates, no lift
conflicts, indices in `{1,2,3,4}`, folds in `{36,72,108}`. No other seed moved.

Any further composite follows the same rule.

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

## PDF: verified at true size, not assumed

`sh tools/make-pdf.sh` → `sheets/wieringa-sheets.pdf`, nine Letter pages, then
`tools/check-pdf.py` measures it: edges land at exactly **72.00 pt (1 in)**,
50.40 pt (0.7 in) and 36.00 pt (0.5 in). The browser's own Save-as-PDF gives the
same file; the script exists so it can be *checked*.

Reading geometry back out of a PDF has two traps, both of which bit:

- PDF numbers may be written with a **leading dot** — `.23999999`. A number regex of
  `-?\d+\.?\d*` silently fails to match those, which shifts the whole operand
  stream and makes every transform wrong. It first looked as though the mm units
  were being read as CSS pixels and the output was a third of true size. It was the
  measurement that was broken, not the PDF.
- **Font and image streams** decompress into binary that parses as plausible path
  data. Filter to streams that are ≥95% printable ASCII.

The transform must be walked with the `q`/`Q` stack: Chrome nests a page-level
`0.24` scale with a `3.125` factor for CSS pixels (0.24 × 3.125 = 0.75, so 96 px →
72 pt) and an `11.811` factor inside an SVG sized in millimetres (0.24 × 11.811 =
2.8346, so 25.4 mm → 72 pt). Both routes land on one inch, which is the check.

---

## Settled: the rhombus side is 1 inch

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

**Decided: 1 inch**, and implemented — `sideIn = 1`, the box reads `1in`. Round, and
the workbench stays inch-native as designed. The box still accepts mm, cm or in.

The **side is always the rhombus edge**, never a diagonal. At 1 in the diagonals are
1.7013 in and 1.0515 in.

The help text on `unfold.html` went on advertising 1.118" long after the code
changed, which is worse than a stale comment: it is a visible claim about behaviour,
and it fooled me into repeating it in PLAN.md and telling Jeff the default still
needed changing when it had been right all along. Prose that states a default has to
be checked against the default.

`GOLDEN_SIDE = √5/2` remains in `geometry.ts`, but that is the tiling's internal
planar unit and has nothing to do with print size — the development normalises every
edge to exactly 1 and `renderSheet` scales by the requested side. `sheets.html` uses
1 in for every generation-2 model, so the two pages agree.

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

**Settled:** `net.html` is gone. The layer selector moved to `unfold.html` first, so
nothing was lost in the move. Page, margin, tint and multi-sheet layout went with
it and belong to Stage B, which is where paring giant sheets down to office size
lives anyway.

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

### Corrected: the overlap test was blind, and every method was wrong

Reported from the browser — a tiny overlap while the last boat went down on Pe3
gen 2, and two of them on Pe3 gen 3. Both real. The measurement said zero.

`convexOverlap(shrink(a, 0.94), shrink(b, 0.94))` was the culprit. The shrink was
there for a good reason — faces that share an edge or a corner touch, and would
otherwise register as overlapping — but a 6% margin also hides any genuine overlap
thinner than that. The slivers measured 0.12–0.48% of a face, comfortably inside
the blind spot. **The test was blind to exactly the defect it existed to find**,
and it was not just the new method: `ribbonGrowPatch` and `unfoldPatch` use the
same test to reject placements, and both were shipping nets with hidden overlaps
at gen 3.

Replaced by exact convex intersection (Sutherland–Hodgman) judged by area, in
`unfold.ts` so all three methods share one honest test. Touching faces give zero
area and need no fudge factor at all; only real double-covering registers.

Consequences, all of them good:

- The search can now *see* the slivers, so it fixes them. Every patch at gen 2 and
  gen 3 is one piece with genuinely zero overlaps, confirmed by a second,
  independent area implementation.
- The flat fallback was counting overlaps **between different pieces**, which never
  reach paper — `layoutSheets` repositions every piece by its own bounding box. It
  now counts intra-piece only, and converges.
- Pe3 gen 3 exposed a real weakness: the descent can strand itself in a basin, and
  reached zero from some starting trees but stuck on one overlap from others. Added
  restarts on stagnation (250 non-improving swaps → fresh random tree, keep the
  global best). Pe3 gen 3 now reaches zero from every seed tried, in about a second.

Two invariants I got wrong while checking this, worth recording because both are
tempting and both are false:

- *"Faces sharing a vertex cannot overlap."* False — a vertex whose developed
  angles exceed 360° wraps its fan over itself, and the two extreme faces share
  that vertex and genuinely overlap. Pe3 gen 2 has four such vertices, excess
  63.4349°; gen 3 also shows 84.0446°.
- *"Faces sharing an edge cannot overlap."* Also false, unless that edge is a
  **hinge**. Across a cut edge the two faces arrived by different routes and are
  under no constraint at all. Only hinged pairs are guaranteed disjoint, and that
  is the invariant now asserted.

The saddle vertices are resolved the way the theory says they must be: such a
vertex receives **two or more cuts**, splitting the fan, which a spanning tree is
perfectly free to do.

### Saddles force two cuts — and the move that was missing

Reported from the browser again: a ghastly collision of two boats on Pe5 gen 3.
Real, and this time not a blind test — a genuinely un-converged search. The page
gave gen 3 a 1120 ms cap and Pe5 failed to reach zero about **half the time**; the
8 s budgets used for measurement had hidden that completely. Measuring the
algorithm at a budget the product never uses is worth nothing.

Three fixes, in increasing order of interest.

**1. The developed angle sum is intrinsic.** It comes from the lift, not from how
you cut — identical across every cut set, verified to 4e-13. So the saddle
vertices can be found once, up front, before any searching.

**2. A saddle needs at least two cuts, and that is forced.** With a single incident
cut its faces form one fan spanning more than a full turn, so the ends of the fan
must lap over each other. Measured: in every overlap-free solution, all 35 saddles
of Pe5 gen 3 have degree ≥ 2 in the cut tree, none below. This is now enforced when
candidates are built (`enforceSaddles`) rather than left for the search to
rediscover by luck.

**3. The move set was one-sided.** Every move added a cut. But when two overlapping
faces are neighbours in the tiling across an edge that is currently *cut*, they got
where they are by different routes and collided — and the sharp fix is the
opposite move: make that edge a **hinge**, which removes the overlap by
construction, since hinged faces cannot overlap. Removing an edge from a spanning
tree splits it, so a reconnecting arc is added in its place. That reverse move was
simply absent.

**Budget.** The cap is not a cost — the search stops the instant it reaches zero,
and Pe5 gen 3 has a mean of ~0.9 s against a 4 s cap. Raising the cap is therefore
almost free and buys the tail. Page budget is now `35 ms × rhombi`, floor 5 s, cap
12 s.

Result at the page's own settings: **0 failures in 210 runs** across all seven
seeds at generations 2 and 3, worst case 1.9 s, most patches under 300 ms.

### Regression: the budget went with the Net page

Deleting `net.html` took the search-budget scaling with it, because I had put it in
the page rather than the library. The Unfold page fell back to the flat 900 ms
default, and generation 4 came out with **813 overlaps and five layers** instead of
14 and two — the exact failure the scaling existed to prevent, reintroduced by
removing the only thing that applied it.

The budget now defaults inside `cutTreeUnfold`: `35 ms × faces`, floor 1.5 s, cap
12 s. It belongs there — it is a property of the problem size, not of whoever is
asking. Nothing outside needs to know.

Same for the feedback. `runTrace` now announces the search and yields once so the
message paints before the thread blocks, and takes the caller's follow-up as a
callback, since that work has to happen after the trace exists rather than
immediately. Four call sites, all updated.

Costs at generation 4, measured: layer recompute on the workbench is 57 ms at 835
faces and 84 ms at 1380, once, behind a dirty flag — `drawNet` runs on pointer
moves and must not pay it. The search itself uses its full 12 s on the three hard
seeds and returns early on the other four.

Cross-checked: the workbench's own layer count, reconstructed from `netHinges` plus
placement order, agrees with the algorithm's on every seed at generation 4.

### Open: gen-4 layer count disagrees between browser and node

**Unresolved, and parked deliberately — generation 4 is research, not a model we
print.** Recorded so it is not rediscovered from scratch.

On `unfold.html`, St5 and Pe5 at generation 4 report **1 layer** and hide the
selector. Every measurement outside the browser says 2 and 3. Facts established:

- The method really was branch cuts. `unfoldPatch` and `ribbonGrowPatch` both emit
  consider/reject trace events, so the reported "considered 0, rejected 0" can only
  come from `cutTreeUnfold`.
- Zero overlaps is **not** reachable for St5 gen 4 — five seeds gave 5, 20, 36, 42,
  68 at the full budget. So a 1-layer result is not the search quietly succeeding.
- Simulating the page's exact sequence in node — same flip, same trace option, net
  rebuilt from `res.placed`, hinges empty as the page had them — returns 2 and 3
  correctly. The discrepancy does not reproduce outside the browser.
- `layerCount === 1` happens only when `overlapPairs` finds nothing, so the page and
  the library disagree about the same geometry, which should be impossible.

Best remaining hypothesis: **partial script caching.** The build stamp only proves
`workbench.js` is fresh; a stale `cuttree.js` would produce exactly this. That has
cost this project two debugging sessions already.

Two real bugs were found while looking, both fixed and both worth keeping fixed
regardless of the above:

- `runTraceBody` cleared `netHinges` and never refilled it, so the layering ran with
  **no parent tree**, silently degrading continuation to plain lowest-fit — the
  confetti it exists to avoid. The count often still came out right, so it was
  invisible while being exactly wrong.
- The page reconstructed layers from the net on screen when `cutTreeUnfold` had
  already computed them from the real hinge tree. It now adopts `res.layer`
  directly. Two paths that can only agree at best and disagree silently at worst
  should have been one.

The readout now always states method, overlaps, cuts and layers, and says
`⚠ INCONSISTENT` when overlaps and layers contradict, falling back to layering the
net on screen so the control still works. Whoever picks this up should start there.

### Layers: the z coordinate, taken literally

Interim step before Stage B, and the visualization asked for. Where the net wraps
over itself it need not be cut — the offending faces can climb a level, which is
the next sheet of the Riemann surface in complex analysis and the next sheet of
paper here. `assignLayers` colours the overlap graph (greedy, most-constrained
first), so **every layer is flat by construction**. Almost everything stays on
layer 0; only the branch points climb.

Two layers cover the converged gen-4 results (Pe5 835 rhombi → L0:824 L1:11). The
count tracks how far the search got rather than anything intrinsic: St5 at a 6 s
budget leaves 294 overlaps and wants 4 layers, at 20 s leaves 1 and wants 2.

The Net page grows a **Layer** selector whenever a net needs more than one. It
draws the chosen layer solid and ghosts the rest, so you can see where the part
you are about to print sits inside the whole net. Selecting a layer only redraws —
the search is stochastic, so re-running it would hand back a *different* net and
the layers would stop corresponding to what you were just looking at. For the same
reason the fill and angle controls now redraw rather than rebuild.

The give-and-take between layers to balance net proportions is Stage B.

### Presentation

Vertex index labels are gone from the net canvas. They were redundant — the
shading and the isoglosses already say height — and they put four numbers on every
tile. The tiling canvas keeps them, where they are the point.

### Still open

The gen-3 nets are one piece but too big for one sheet at any foldable side — at
1 in only St1 and Deca fit, and the rest would need to go below the 12 mm floor. That is precisely Stage B, untouched: cutting
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
