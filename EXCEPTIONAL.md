# Exceptional Singularity

**Breadcrumb:** Exceptional · **Title:** Exceptional Singularity · **File:** `exceptional.html`

A new page, in the Cage's visual language, showing the one point in the Penrose plane
where the roof stands up into solids. Phase 1 renders it. Phase 2 resolves it.

Nothing here is coded yet. Written 2026-10-10 from Jake's brief and the reference image,
against the mathematics already established in `pentagrid/PLAN.md`.

---

## 1. Why this one point

From `pentagrid/PLAN.md` §5.12, the Penrose singularity catalog is **three entries** and
no more:

| state | shows |
|---|---|
| regular | nothing concurrent anywhere |
| one couple | one K122 + one K113 hexagon, and nothing else |
| **Γ = 0** | **five of each, plus the unique decagon** |

The decagon needs every γⱼ integral, and since only γⱼ mod 1 matters, that is γ ≡ 0 —
the one phase vector that is its own class. So the decagon is **not rare, it is one
point**, and no LI 1 or LI 2 tiling has one anywhere. That is what makes it
*exceptional*, and it is why the page is about a single picture rather than a family.

And from §5.0, the thing nobody could see from the plane: where *k* grid lines meet, the
2^k surrounding regions are the corners of a *k*-cube, and lifting each to z = RISE·ΣK
embeds that cube in the roof's own 3-space as a **zonohedron** — not a projection of
one, the solid itself.

| k | regions | corners of the solid | faces | the solid |
|---|---|---|---|---|
| 3 | 8 | 8 | 6 | golden rhombohedron — **A₆ / O₆** |
| 4 | 16 | 14 | 12 | Bilinski's dodecahedron (non-Penrose, never appears here) |
| 5 | 32 | **22** | 20 | the rhombic icosahedron — **F₂₀** |

Every edge is √5/2 and every face has diagonal ratio φ: the roof's own golden rhombus,
the one the whole surface is paved with. **A singularity is not a defect in the roof. It
is a piece of the roof's solid geometry that the plane had been flattening.**

This is the same solid the Cage page now draws as `Golden icosahedron`, reached from the
other side. The Cage builds it from five of the six icosahedral axes; the roof finds it
standing at Γ = 0. They should be congruent, and checking that is the first test.

---

## 2. What the picture shows

Read off Jake's reference image, with the counts from §5.12.

- **One purple decagon at the center** — F₂₀, drawn as a solid, its outline being the
  *rim*. Its shadow is the decagon; its 10 cells are 5 acute and 5 oblate.
- **Pink hexagons around it** — the A₆ and O₆ zonohedra, each outlined by its own rim.
  Jake calls them **skewbs**, and the count question is answered: they are not ten
  isolated objects. **The skewbs run in infinite sequences along the grid lines.** At
  Γ = 0 there are **five sequences emanating in ten directions** from the central F₂₀ —
  five lines through the origin, each a ray in both senses — and along each the A and O
  types alternate in a **musical, Fibonacci word**, `SLLSLSLS…`. §5.12's "five of each"
  is counting *couples*, one K122 and one K113; each couple is the beginning of a
  sequence, not the whole of it. So the many pink regions in the reference are right,
  and they lie on five lines.

  That also says what a skewb *is* in the tiling: **a grid ribbon — two rhombs sharing
  parallel sides — with a third rhomb added.** Which is the shadow of a rhombohedron,
  and why the sequences follow the ribbons.

  The general LI 0 case does the same with the center broken: at, say,
  γ = [0, 1/10, 0, 0, −1/10] the sequences run in two directions rather than ten. Other
  LI classes have far more variety — the B₁₂ / octagon / tesseract, and skipping
  configurations of hexagons — which is a reason this page stays at Γ = 0.
- **The field** — the rest of the roof. The reference draws it gold and blue for thick
  and thin, but that is the reference's own marking and **not** what this page does: here
  it is a Wieringa roof of golden rhombi, every one the same rhombus at a different tilt
  and orientation. Color comes from Kowalewski five or from bands, and the skewbs and the
  decagon wear the same scheme as everything else. Purple and pink were how the
  illustration pointed at them, not a palette to reproduce.
- A small ring marks the center of each singularity.

The reference is a plan view. On this page it will be the roof seen from above, which
`orthogonal` gives exactly.

### The ghost

§5.0's best detail, and the page should make it visible. The decagon's center is the one
point with index both 0 and 5, because Σvⱼ = 0 makes f(∅) = f(𝟙). **On the roof those
are the icosahedron's two opposite poles, 5·½ apart in z** — 32 corners in space against
31 points in the plane. The vertex that can never be realized in the plane is the
solid's far pole, and it looked degenerate only because we were looking at the shadow.

Those two poles are exactly what the Cage's `Singularity` mode deletes. The page inherits
that control, and here it means something physical rather than a demonstration.

---

## 3. Phase 1 — the render

### 3.1 Where the data comes from

The one real architectural decision. Four ways were on the table; **Jake chose (b)**,
and the reasoning for the others is kept because it is the argument for not drifting
back to them.

**(a) Port the pentagrid generator.** `pentagrid/src/geometry/{pentagrid,resolve,hunt,
zonohedron,roof}.ts` already generate the tiling from γ, classify the concurrencies and
build the solids, all tested, all correct at Γ = 0. Copying them in gets it right
immediately — and starts a second divergent copy of a live library, which is the
`math-repo` / `penrose-mosaic` problem this project already pays for daily.

**(b) ✅ Deflate from the site's own seeds.** `geometry.ts` has `expandDeca`, the
composite the site calls **Queen**, and Queen generation 3 is the patch. No new
generator, no second copy of anything, and the roof's lift, shading, schemes and palettes
all apply as they stand.

The cost is that deflation gives a patch, not a *located* singularity: the decagon and
the skewbs have to be found in it afterwards. That is a real cost and the place this page
can go wrong — detection by tolerance is how the earlier `faceLinks` bug got in — so step
2 of the order of work should find them combinatorially, off the ribbon structure (a
ribbon plus a third rhomb), rather than by matching coordinates.

**(c) Build outward from the solids.** Place F₂₀ at the origin, attach the ten
rhombohedra, fill the rest. Exact at the center, and the hard part — the field — is left
undone.

**(d) Precompute, and check the data in.** The page shows **one patch**, at one phase
vector, at one radius. It never changes. So generate it once in `tools/exceptional.mjs`,
using the pentagrid's generator as the *source of truth at generation time only*, and
emit a data file the page imports — the pattern this project already uses for
`stamp.mjs → build-id.ts`, `palettes.mjs → palettes.ts` and `patchsize.mjs`.

Still worth keeping in mind from (d): if the singularities ever do get carried as data,
carry them as **generator masks rather than points**. §5.0 learned that the hard way —
at k = 5 mask 0 is not a corner of the decagon but its center, and anchoring on the
outline corner of least index put the whole solid half a decagon out of position.

### 3.2 What is drawn

Three layers, back to front:

1. **The roof** — the P3 field lifted, as golden rhombi. The site's existing shading,
   schemes and palettes apply unchanged.
2. **The singularity solids** — F₂₀ purple at the center, A₆ and O₆ pink around it,
   standing *on* the roof rather than replacing it. Their faces are golden rhombi of the
   same edge, so they shade and depth-sort with everything else and need no new painter.
3. **The rims** — each solid's outline, which in plan view is its 2k-gon shadow: a
   decagon for F₂₀, a hexagon for each rhombohedron.

### 3.3 The controls

Taken from Cage, with Jake's defaults in **bold**.

| control | options | note |
|---|---|---|
| **Color** | **Kowalewski five** · Bands | the two schemes that key on the axis pair |
| **Ribbon** | slider 0–100%, **50%** | bands only; ghosts out otherwise |
| **clear ground** | **false** | bands only |
| **Faces** | **Solid** · Transparent · Invisible | |
| **Frame** | Edges · **Ball and stick** · Invisible | note the default differs from Cage |
| **Show** | **Singularity** · All ten | F₂₀'s ten cells, poles deleted or whole |
| **turn** | **true** | these solids only read as solid in motion |
| **eye light** | **false** | |
| **orthogonal** | **false** | plan view, matching the reference, is orthogonal + top |
| **Reset** | | |

Not taken from Cage: Solid (there is only one here), Explode, Cage, flip.

Everything on this list already exists in `rhombohedra3d.ts`. The honest move is to lift
the shared parts into a module both pages use rather than copy the file; `bars.ts`
already does this for the Workbench, 3D and Hexahedra pages, and this is the fourth page
to want it.

### 3.4 The status line

In the Cage's register, saying what is actually there: the number of rhombs in the field,
one decagon and five-plus-five hexagons, F₂₀'s 20 faces and 10 cells, and under
`Singularity` the 18 + 4 faces cut and the decagonal rim left behind.

### 3.5 Checks — `tools/exceptional.mjs`

The page is worth no more than its data, so the data gets asserted:

- the field is a legal P3 tiling: every edge shared by exactly two rhombs or on the
  boundary, no overlaps, every face a golden rhombus of diagonal ratio φ;
- **F₂₀ is congruent to the Cage's `Golden icosahedron`** — same 20 faces, same 10 cells,
  5 acute and 5 oblate, same volume 6.155367 — which ties the two derivations together
  and is the single most valuable check on the page;
- the two poles are antipodal and 5·√5/2 apart in z (§5.0's "32 corners against 31");
- hexagons appear in couples, each one K122 and one K113, never one alone (§5.12);
- the singularity count matches the catalog — **pending the §2 recount**;
- every solid's faces are golden rhombi of edge √5/2.

---

## 4. Phase 2 — resolving the singularity

**The reference carries all three states already** — unresolved top, partially resolved
bottom left, an example resolution bottom right — so this is a sketch against real
pictures rather than a guess.

The rule is **stay strictly Penrose — no illegal tiling**. That is the whole difficulty:
the decagon's shadow can be filled many ways, and almost all of them are illegal.

What is already known, from §5.0 and the closed open-item in §5.2:

- The decagon's interior is **C(5,2) = 10 rhombs, five thick and five thin**.
- A rhombic tiling of the shadow is a **monotone surface** of the solid — a *reading*.
  `zonohedron.ts` holds the solid and enumerates its readings, counting them the way Jake
  asked for: nudge the k lines apart so every pair crosses at a point of its own, and the
  rhomb there sits at the corner its crossing reads off.
- A hexagon has **two** readings — the Necker flip. The decagon's reading **fixes all ten
  cells at once**, which is why a completed reading leaves no hexagon ambiguous even
  though a hexagon alone alternates.
- **Jake's ten.** §5.2 closes the open item: *"The ten rhombs inside the decagon are
  resolved: rotating cartwheels. The ten orientations are the ten placements of the one
  reading."* So the ten resolutions are **one legal reading in its ten rotations**, not
  ten different tilings — the orbit of a single object under the decagon's 10-fold
  symmetry. That is a sharper and better statement than "there are ten of them".

### Which hexagons fit — answered by measurement (2026-10-11)

Jake: *"This should make it clear, the only ones that fit: pink."*

Three rhombi round a vertex always *read* as a rhombohedron — that is the Necker cube,
and §5.0's point that the ambiguity is everywhere. But one only **fits** as a cap when
the middle vertex is a peak or a pit, all three of its edges running the same way. If
one runs the other way the vertex is a **saddle**: you are looking at the inside corner,
and there is no solid to seat there.

Measured on Queen generation 3, and the split is total — **no exceptions in 310**:

| triples | \|det\| | what they do | count |
|---|---|---|---|
| {013, 023, 024, 124, 134} | **0.760845** | always cap — 59 peaks, 46 pits | **105**, 21 each |
| {012, 014, 034, 123, 234} | **0.470228** | never cap — all saddles | 205, 41 each |

Those are exactly the acute and oblate sets of §5.0, and exactly the Cage's own two cell
volumes, in the ratio φ. So **the solid that fits is A₆ and only A₆**: in a Wieringa roof
the oblate rhombohedron never presents a cap. The earlier worry — that all 610 rhombi are
in some hexagon and 320 in two, so marking them all would paint everything — dissolves:
**the caps are disjoint for free**, 315 rhombi each in exactly one, because no rhomb can
be in two acute caps. "The only ones that fit" picks itself, with nothing chosen.

Two readings that were tried and are wrong, kept so they are not tried again:
*unshared hexagons* gives 10, all at the patch boundary where the competitor falls
outside, covering 4.9%; *grid concurrency* computed from the lift vectors gives 0 of 310,
the lift vector not being the grid offset.

### Finding the decagon — and the trap, walked into (2026-10-11)

§5.0 warns that at k = 5 **mask 0 is not a corner of the decagon but its center**,
sharing its shadow with mask 31. This plan quoted that warning in §3.1 and the first
implementation then walked straight into it.

The cube test is: a vertex belongs to a singularity when its lift vector, less a base,
lies in {0,1}⁵. The first search only tried bases **that were themselves vertices** — so
it could not find a singular decagon at all, since the singular ones are exactly those
whose mask 0 is the ghost and no vertex. It found the non-singular ones instead, and
settled on one 60 units off center, which threw the ribbons, the skewbs and F₂₀'s anchor
with it.

Sweeping `n(v) − mask` over all 32 masks finds them properly. Queen generation 3 holds
**11 decagons, 9 of them with the ghost**, and the central one is unambiguous:

| | |
|---|---|
| base | `[-1, -3, -1, 2, 2]` — not a vertex |
| from the patch center | **0.0130**, the next nearest being 23.32 |
| rhombi | 10, one per pair, 5 thick and 5 thin, rim 10 edges on 10 vertices |
| poles | **(0, 0, ±1.118034)** — on the vertical axis, √5 apart |

Jake: *"It is in the center of the patch. That is why the patch is called deca. Notice
the vertical mirror symmetry?"* Both now assertions in `tools/exceptional.mjs`: the
chosen decagon within 0.05 of the patch center and carrying the ghost, and all 666
vertices mirrored under x ↦ −x exactly.

Two further lessons, cheap to state and expensive to learn again:

- **Two coordinate systems.** `allRhombs[].verts` is in tiling coordinates and
  `RoofData.point` in recentred roof coordinates. Mixing them is what let a center of
  "(0, 60.407)" look plausible.
- **A symmetric test must be symmetric.** The first mirror check failed on 147 of 2440
  because `round(x·1e4)` and `round(−x·1e4)` disagree on an exact half — a bug in the
  test, not the patch.

### Counting the readings — done (2026-10-11)

Jake: *"I do know that none of the paths hit the extremes. That might be the only
criteria to filter."* And: *"Every wieringa roof has an inverse… that would make 20."*

Both hold, and together they nearly close it. Counted with **Elnitsky's bijection** —
sweep the decagon's boundary from `01234` to `43210` by adjacent swaps, each swap laying
a rhombus on the pair that crosses, so every tiling arises and none has to be guessed:

| | |
|---|---|
| rhombic tilings of the decagon | **62** (the known count, so the enumeration is sound) |
| never put a vertex on an **extreme** | **40** |
| up to the **inverse roof** | **20** |
| under the turn *and* the inverse | **4 orbits of 10** |

The extremes are the only two masks whose points coincide — `01010` and `10101` in the
half-plane labeling, at the decagon's own center, which is §5.0's ghost. Avoiding them
is **necessary but not sufficient**: it cuts 62 to 40, not to ten.

The inverse is the roof turned over, hills for dales, which on the lift is complementing
every vertex and so exchanges the two extremes. It carries all 62 to tilings and all 40
survivors to survivors, and **no tiling is its own inverse** — zero fixed points — so the
40 pair off exactly into 20.

The turn has order 5 and the inverse order 2, so together they act as a group of order
10 and the survivors fall into **four orbits of ten**. That ten is §5.2's own number:
*"the ten orientations are the ten placements of the one reading."* One orbit is one
reading, in its five turns and two parities.

**What is left.** §5.2 says *the* one reading, and there are four orbits. So something
beyond the extremes picks one orbit out of four, and that is the condition Phase 2 wants.
Four candidates is a small enough field to settle by comparison against a legal patch.

Two wrong turns, recorded so they are not repeated: a flip-graph enumeration stalled at
one tiling because the starting tiling was invalid — its areas summed correctly while its
rhombi overlapped, so area is no test of a tiling; and a first attempt at the turn
relabeled `m → m+1`, which in the half-plane convention is a 36° turn with a reflection
in it, not a 72° one. It reported that no tiling survived, which was the tell.

### The ten readings, settled (2026-10-11)

Jake: *"Arrowed rhombs. Used to calculate indexes. Gives penrose rhomb a direction.
indexes are used to calculate wieringa heights among other things."*

**The arrows are already in the lift.** An arrow is an edge's direction, and every edge
of the patch steps one generator by exactly one — 1275 distinct edges, none otherwise,
255 per generator — so the arrow is the step: which generator, and which way. Its
*type* is the index pair it joins, the index is the popcount of the lift vector, and the
height is the index at **1/√5 per step**, measured. (One wrinkle worth knowing:
`vertexList[].index` is Σn **+ 1**, a constant offset, consistent on all 666 vertices.)

de Bruijn's condition for a rhombic tiling to be Penrose is that **every vertex index
lies in 1…4**. Indices 0 and 5 are exactly the two masks that collide at the decagon's
center. So **the arrowed-rhomb matching rule and Jake's "none of the paths hit the
extremes" are the same condition** — which is why applying the arrows did not move the
count.

What did move it was the symmetry group. The decagon's own rotation is **36°**, not 72°:
the direction set is closed under it, since 36° sends each vⱼ to the negative of another
and a rhombus is blind to sign. With that, and then realizability:

| | |
|---|---|
| rhombic tilings of the decagon | **62** |
| arrow condition — every index in 1…4 | **40** |
| orbits under the decagon's own D₁₀ | **3** — two of ten, one of twenty |
| **realizable in a Penrose patch** | **1 — an orbit of ten** |

The last line is a sweep, not an argument: every seed and generation the site can
build — 30 patches — searched for decagons and each classified by its index histogram.

    471 decagons with a vertex at their own center (not singular)
    760 genuinely singular
       orbit 1: 0 · orbit 2: 0 · orbit 3: 760

Seven hundred and sixty singular decagons across nine seed types, and **every one is the
same orbit** — the one Queen generation 3 sits in, histogram `{1:1, 2:7, 3:6, 4:2}`. The
other two orbits, thirty tilings, never occur. That is §5.2's *"the ten orientations are
the ten placements of the one reading"*, with the ten now exhibited as a genuine orbit
and the other thirty ruled out by measurement.

**A correction the sweep forced.** A decagon is singular only when **neither** pole is
realized. Testing mask 0 alone, as an earlier pass did, lets through the 471 that realize
mask 31: those have a vertex at their own center, so the five lines are not concurrent
there and they are no singularity at all. They are also exactly what the arrow condition
rejects, which is the two tests agreeing.

### The local legality test — the cascade needs no γ (2026-10-11)

Jake: *"once a collapse occurs, the neighbors can be tested for compatability (arrows?),
thus forcing it to change. without gammas."* That is right, and the test is now in hand.

A flip does not alter the figure's rim, so nothing propagates through the boundary. What
it alters is the **vertex star** at each of the six corners it touches — the set of
rhombi meeting there — and Penrose legality is a condition on vertex stars. Read off
**10,639 complete stars** across thirty patches, there are only **seven**:

| star | |
|---|---|
| `108+108+144` | the oblate hexagon, K122 |
| `72+144+144` | the acute hexagon, K113 |
| `72+72+72+72+72` | the sun |
| `36+36+72+108+108` · `72+72+72+144` · `36+36+72+72+72+72` · `36+36+36+36+72+72+72` | the rest |

**And the seven finish the filter.** Of the 40 decagon readings meeting the index
condition, exactly **10** have only legal stars — and they are precisely the patch's own
orbit of ten. The thirty rejected ones lean on two stars that sum to 360° and never
occur in any patch:

    36+108+108+108    used 40 times
    36+72+108+144     used 20 times

So the full filter is **index in 1…4, and every complete star one of the seven**, both
purely local. The gap between 40 and 10 was the stars all along.

**What this buys.** The cascade is implementable without γ: collapse a figure, recompute
the stars at the corners it touches, and any corner landing outside the seven forces a
neighbor to change; propagate until it settles. And *superposable* becomes testable
rather than assumed — a figure is a valid singularity exactly when more than one of its
states leaves every star legal.

### The ten readings as geometry, and their two operations

The ten are now drawable in the patch's own coordinates, with the patch's own reading
confirmed among them. Jake: *"the large may have more operations, operations with 2 state
and rotation operations with 5."* Confirmed:

    the 36° turn cycles the orbit: back to the start after 10 steps
    (36°)² equals the 72° turn:                       true
    (36°)⁵ equals the inverse roof, hills for dales:  true
    the 72° turn alone reaches 5; the flip takes those to the other 5

So F₂₀'s ten factor as **a 5-state rotation times a 2-state flip**, and a skewb has only
the flip. The single 36° turn generates both, which is why it is the right step even
though it is not a symmetry of the lift on its own: a 36° turn is a 72° turn plus a
parity flip, and the flip is what repairs the lift.

Two fixes it took. Folding a direction into the half plane **adds** π — subtracting it
scrambles Elnitsky's ordering and yields 0 legal tilings instead of 40. And the orbit
must be matched **in the plane**, since a 36° turn sends `E` to `−v + ẑ/√5`, which is
neither plus nor minus any `E`.

### The right objects are ribbons, not hexagons (Jake, 2026-10-12)

> Singularities are rare and simple in LI(0) aka pure penrose. There are only two kinds.
> One musical ribbon in one of the 5 directions. the other is 5 musical ribbons
> intersecting at the exceptional singularity.

That is the cartwheel on the cover of *Scientific American*, January 1977 — the issue
that announced Penrose tiles, with the bow-ties.

**This is a different unit of account from what the demo was built on.** It treated each
hexagon as a figure with two readings and asked which fit. The measurement that followed
says that cannot be right: with the stars and the no-straight-band rule in force, 300 of
the patch's 310 hexagons are already determined, and the ten that are not lie on a circle
of radius 11.37 in a patch of radius 12.26 — the cut edge, nothing more. A Penrose tiling
is **rigid**, so no single hexagon is ever free, and there is nothing for a click on one
to do.

The singularity is the **whole ribbon**, and the operation is the **gridline nudge**: it
resolves every singularity along the line except the one infinite musical spoke. Which
also explains what was seen earlier from the other end — *"the musical path of collapsing
skewbs resolves onto a musical path of hexagon shaped triple rhombs… mostly it leaves two
of the skewb spokes at a right angle to the propagation."* The path is the object.

Jake is working on a second combinatorial path to this: simulating the movement of
gridlines **without gridlines**. Until that exists the demo stays as it is.

Not done, and recorded so it is not rebuilt by accident: a *force superposition* mode was
written and reverted. It made a figure indefinite and let the indefiniteness spread by
judging stars only where every rhombus meeting a vertex was definite. The mechanism
worked; it was the wrong unit, for the same reason.

### The cascade (Jake, 2026-10-11)

The readings are **not independent**, and that is the whole of phase 2.

- **F₂₀ has ten Necker configurations. A skewb has two.**
- The skewbs **radiate from** the decagon — the five sequences in ten directions of §2,
  each a Fibonacci word of A and O along a grid line.
- **Setting one skewb to a definite value cascades along its line**, changing many
  others, and the cascade reaches the decagon itself: it fixes the F₂₀ penteract
  singularity.

So the ten resolutions are not ten free choices. They are what is left after one local
decision propagates to the end of every line it touches. That is the same fact
`pentagrid/PLAN.md` §5.2 states from the other end — *"the penteract's state fixes all
ten cells at once, which is why a completed reading leaves no hexagon ambiguous even
though a hexagon on its own alternates"* — and the two descriptions meet in the middle:
set the decagon and every skewb follows; set a skewb and the decagon follows.

A consequence worth testing when the time comes: if one skewb determines the decagon,
then the **ten** readings of F₂₀ and the **two** of a skewb cannot be independent
degrees of freedom, and the count of genuinely free choices across a patch is far
smaller than the number of ambiguous figures in it. That is a claim this project can
measure rather than assume.

**Still to settle:** Jake distinguishes *the singularity decagon* from *the exceptional
decagon* — "This is the singularity decagon. And next is the exceptional decagon." Which
is which, and what separates them, waits on the picture.

To settle before building: the total number of rhombic tilings of the decagon, against
which the Penrose-legal ten are the exception. I believe it is **62**, but that is
recollection and must be read off `zonohedron.ts`'s own reading count rather than
asserted — the page should not print a number this project has not measured.

The page then wants three states, matching the three reference images:

1. **Unresolved** — the solids standing, shadows unfilled. Phase 1's picture.
2. **Partially resolved** — some singularities read, others left standing. The reference
   shows a chain of pink surviving through a mostly-resolved field, which suggests the
   control is per-singularity rather than global.
3. **Resolved** — every shadow filled by a legal reading, giving an ordinary Penrose
   tiling with no pink left. The reference's third panel is all gold and blue.

A `reading` stepper, wrapping against each singularity's own count, is what
`pentagrid/roof.html` already uses, and §5.2 notes one control can drive a hexagon and a
decagon at once.

---

## 5. Answered, 2026-10-10

1. **The pink count** — §2. They are sequences along the grid lines, not a fixed ten:
   five of them, in ten directions from the center, each a Fibonacci word of A and O.
2. **Naming** — **F₂₀, after Coxeter**; a golden rhombic icosahedron, and the image of
   the penteract. A₆ and O₆ for the rhombohedra, **skewbs** collectively.
3. **Thick/thin coloring** — no. It is a Wieringa roof of golden rhombi at different
   tilts, colored by Kowalewski five or by bands, the skewbs and decagon included.
4. **turn** — yes, on.
5. **Data source** — **(b), the site's own 3D machinery.** Not the precompute, and not a
   ported pentagrid. Jake: *"a starting point would be to reproduce the 3D version on the
   exception page with the ball and stick."* The patch is **Queen generation 3** —
   `Deca`, the composite the site already calls Queen — which is the cartwheel, and the
   cartwheel is this singularity. §5.2's note that the pentagrid's deca preset "moves a
   thousandth off… within our patch, it's a CARTWHEEL with its bow ties" says the two
   constructions agree where it matters.

   **The center decagon is one of the ten configurations** the purple decagon stands for.
   So the page opens already showing one resolution, and Phase 2's job is to let the
   other nine be reached — which makes the reading stepper the natural control.

### Order of work

1. **Reproduce Queen gen 3 on the new page**, in the Cage's language: ball and stick,
   the Color / Faces / Frame / Show / Ribbon controls, eye light, orthogonal, turn,
   reset. Present it. *This is the step to do first, and the one to stop at.*
2. Then, on Jake's word, the skewbs: find them in the patch, and draw the sequences.
3. Then F₂₀ at the center as a solid, with `Show` cutting its poles as the Cage does.
4. Then Phase 2's readings.

## 6. Sources

- `pentagrid/PLAN.md` §5.0 — singularities are golden zonohedra standing on the roof;
  the k-table, the two rhombohedra and the K122/K113 split, the ghost pole, and why the
  surface is a triacontahedron one zone short.
- `pentagrid/PLAN.md` §5.12 — the Penrose singularity catalog: three entries, no octagon
  is Penrose, hexagons come in couples, the count is 0, 2 or 10.
- `pentagrid/src/geometry/zonohedron.ts` — the solid, its readings, and the mask
  representation.
- `RHOMBOHEDRA.md` §2½ — the golden family on the Cage page, and `poles` /
  `singularityCut` in `src/dissect.ts`, which this page reuses rather than re-derives.
