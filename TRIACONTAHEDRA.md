# Where the normals meet

*Research note for a new page. Nothing here is built yet — this is the argument and
the measurements it rests on, so the page can be designed against facts rather than
hopes. Every number below was computed against the real generator in `dist/`, not
derived on paper and hoped for; the probe scripts are listed at the end.*

The site currently presents the roof as a **surface** and the triacontahedron as a
**separate exhibit** on `polyhedra.html`. They are the same object seen twice, and
nothing on the site says so. This is the page that would.

---

## The question

> Take the normal of each face of the roof and extend it, above the map and below.
> Where do the normals meet? A point where several concur is the center of the
> triacontahedron those faces belong to.

That is the whole idea, and it works — but only because of one specific property of
the triacontahedron, which is worth stating before anything else, because it is what
makes the test mean something.

---

## 1. Why a normal locates a center at all

The rhombic triacontahedron is **isohedral**: its symmetry group is transitive on
its thirty faces. Two consequences follow, and both are needed.

- **All thirty face planes are tangent to one sphere.** Every face is the same
  distance ρ from the center.
- **Each face has a 2-fold axis through its own center**, so the tangent point is
  the face's centroid, not some other point in the face.

Put together: if a golden rhombus is a face of a triacontahedron, then that
triacontahedron's center lies on the line through the rhombus's centroid along its
normal, at distance exactly ρ. There are two such points, one on each side, and a
monotone surface can be a cap of either — hence Jeff's "above or below the map".

For unit edge, measured over all thirty faces:

```
ρ = 1.376381920471    identical on all 30 faces to 5.6e-16
                      offset from face centroid to solid center parallel to
                      the face normal to 5.6e-16

ρ = √(1 + 2/√5) = φ²/√(φ²+1)
```

**This does not work for the other golden zonohedra, and that is a feature.** Built
on the same axes but with fewer of them, none of them is isohedral, and the test
fails for both reasons at once — measured:

| solid | axes | faces | distinct face-plane distances | offset ∥ normal? |
|---|---|---|---|---|
| triacontahedron | 6 | 30 | one: 1.376382 | yes, 5.6e-16 |
| rhombic icosahedron | 5 | 20 | two: 0.951057, 1.113516 | no, residual 0.43 |
| Bilinski dodecahedron | 4 | 12 | three: 0.525731, 0.688191, 0.850651 | no, residual 0.50 |
| golden rhombohedron | 3 | 6 | one: 0.262866 | no, residual 0.43 |

So a concurrence of normals at distance ρ identifies a **triacontahedron
specifically**. Nothing else in the family answers to it.

---

## 2. The six axes, and why ten is the ceiling

`geometry.ts` lifts with five generators
`E_j = (2/√5·cos 72j°, 2/√5·sin 72j°, 1/√5)`. Add the vertical `e_z = (0,0,1)` and
you have **the six icosahedral five-fold axes** — verified, all fifteen pairwise dot
products are ±1/√5. The triacontahedron is the zonohedron on those six, which is
exactly how `polyhedra3d.ts` already builds it.

The roof uses only the five non-vertical ones. So:

- Faces of the roof take `C(5,2) = 10` orientations, out of the fifteen a
  triacontahedron has. The five it can never use are precisely the ones that need
  `e_z` as an edge direction.
- Stood on the vertical axis, the thirty faces band **5 · 5 · 10 · 5 · 5** by face
  height `1.1708 / 0.7236 / 0 / −0.7236 / −1.1708`. The middle ten are exactly the
  faces built from `e_z`, and they are **vertical** (`n·e_z = 0`). A single-valued
  roof can never contain a vertical face.
- What remains is ten faces up and ten down. **Ten is the ceiling for any one
  triacontahedron, and the measurement never exceeds it.**

The ten split by rhomb type, and the split is forced rather than observed:

| roof faces | generator pair | `n·e_z` | tilt from horizontal | band |
|---|---|---|---|---|
| **thick** | \|Δj\| = 1 | 0.850651 | 31.7175° | top cap, 5 faces |
| **thin** | \|Δj\| = 2 | 0.525731 | 58.2825° | upper ring, 5 faces |

`|E_j × E_k| = √(4/5)` for both, so `n·e_z = (4/5)·sin 72°Δ / √(4/5)`, which is
0.8507 at Δ=1 and 0.5257 at Δ=2. Verified `thick ⟺ |Δj| = 1` on every rhomb of
every patch, no exceptions.

**Every triacontahedron implicated is a translate of one fixed solid.** The roof's
face orientations are fixed, so nothing is ever rotated: every one of them stands on
the same vertical five-fold axis. That is what makes the picture drawable.

---

## 3. Exact arithmetic — no clustering tolerance

Clustering float points would work and would be the obvious implementation. It is
not necessary, and avoiding it removes a whole class of tuning.

For a face with low corner `n ∈ Z⁵` and edge generators `j, k`, the center is

```
c = Σ n_i E_i + ½(E_j + E_k) + ½ Σ_{i ∉ {j,k}} σ_i a_i ,   σ_i = sign(±n̂ · a_i)
```

where the sum on the right runs over all six axes `a_i` (the five `E_i` plus `e_z`)
and the sign of `n̂` picks the side. Collecting terms,

```
c = ½ Σ_{i=0..5} m_i a_i        with m ∈ Z⁶ and every m_i odd
```

— `2n_i + 1` on the two edge generators, `2n_i ± 1` on the other three, `±1` on the
vertical. So **centers are the all-odd points of the six-axis half-lattice**, which
is the usual body-centering of the icosahedral lattice, and two faces belong to the
same solid exactly when their six integers agree. Integer equality, no epsilon.

Verified: the integer construction reproduces the floating-point center to
**1.9e-15**, and every coordinate is odd, on every patch tested.

---

## 4. What the measurement says

Each face votes for two centers, so a patch of F faces casts 2F votes. Group size
= how many roof faces lie on that one solid.

All nine seeds, generations 2–4:

| seed | gen | rhombi | distinct centers | max group | complete (10) caps | hat / bowl | Pe5 tiles | groups of size 6–9 | faces on a complete cap |
|---|---|---|---|---|---|---|---|---|---|
| Pe5 | 2 | 25 | 26 | 10 | 1 | 1 / 0 | 1 | 0 | 40% |
| Pe5 | 3 | 140 | 136 | 10 | 6 | 5 / 1 | 6 | 0 | 43% |
| Pe5 | 4 | 835 | 781 | 10 | 36 | 26 / 10 | 36 | 0 | 43% |
| Pe3 | 3 | 139 | 137 | 10 | 6 | 5 / 1 | 6 | 0 | 43% |
| Pe3 | 4 | 878 | 822 | 10 | 37 | 27 / 10 | 37 | 0 | 42% |
| Pe1 | 4 | 921 | 863 | 10 | 38 | 28 / 10 | 38 | 0 | 41% |
| St5 | 2 | 15 | 16 | **5** | 0 | — | **0** | 0 | 0% |
| St5 | 3 | 165 | 166 | 10 | 5 | 0 / 5 | 5 | 0 | 30% |
| St5 | 4 | 1380 | 1311 | 10 | 50 | 10 / 40 | 50 | 0 | 36% |
| St1 | 3 | 45 | 49 | 10 | 1 | 0 / 1 | 1 | 0 | 22% |
| Deca | 3 | 610 | 576 | 10 | 23 | 10 / 13 | 23 | 0 | 38% |
| Deca | 4 | 4430 | 4036 | 10 | 173 | 83 / 90 | 173 | 0 | 39% |
| Sun | 3 | 2440 | 2241 | 10 | 101 | 65 / 36 | 101 | 0 | 41% |
| Sun | 4 | 16475 | 14886 | 10 | 671 | 396 / 275 | 671 | 0 | 41% |
| Star | 4 | 14845 | 13421 | 10 | 585 | 320 / 265 | 585 | 0 | 39% |

(27 seed/generation combinations were run; the table is a representative slice. The
full sweep had **zero** anomalies.)

Two columns deserve to be read twice.

**Group sizes are 1, 2, 3, 4, 5 or 10 — never 6, 7, 8 or 9.** Over 27 patches and up
to 16,475 rhombi. A triacontahedron shows the roof either a partial rosette of at
most five faces, or its complete ten-face cap. There is no in-between.

**The complete-cap count equals the Pe5 tile count, exactly, in every case.** Which
brings us to the finding.

---

## 5. Findings

### 5.1 Sharing a center is the same relation as a 36° fold

Two roof faces that meet along an edge belong to the same triacontahedron **if and
only if their fold angle is 36°** — that is, dihedral 144°, which is the
triacontahedron's own dihedral angle, the same at every edge. Measured on Pe5, Pe3,
St5 and Deca at generation 3 and Pe3 at generation 4:

```
36° edges whose two faces share a center:      180 / 172 / 150 / 760 / 1140
36° edges whose two faces do NOT:                0 /   0 /   0 /   0 /    0
non-36° edges whose two faces DO share one:      0 /   0 /   0 /   0 /    0
```

This is a clean local test that needs no centers computed at all, and it ties the
new page directly to the fold-angle work already on `info.html`.

**But the relation is not transitive, and assuming it was would be the first
mistake to make.** The connected components of the 36°-fold graph run to 171 faces
on Pe3 gen 4, while no group of faces sharing a center ever exceeds 10. Walking a
chain of 36° folds drifts from one solid to the next. The center is the invariant;
the fold angle is only a necessary local condition.

### 5.2 A complete cap is exactly a Pe5 tile

For every complete ten-face cap, in every patch:

- the five **thick** faces come from **one** P1 tile, and that tile is always a
  **Pe5** pentagon — its whole rhomb emission, the five-thick rosette;
- the five **thin** faces are the ring contributed by the neighboring Pe3 and Pe1
  tiles, in the combinations `Pe5×5 + Pe3×5`, `Pe5×5 + Pe3×3 + Pe1×2`, and
  `Pe5×5 + Pe1×4 + Pe3×1`;
- the number of complete caps **equals** the number of Pe5 tiles emitting five
  rhombs — 1, 6, 36, 23, 173, 671 … with no discrepancy anywhere in the sweep;
- the cap's apex — the vertex shared by all five thick faces — is the rosette hub,
  a degree-5 vertex, and it sits at an **extreme** index: 4 (a summit) or 1 (a pit).
  Of the 36–241 degree-5 vertices in a patch only these carry caps.

> **Every Pe5 pentagon of the P1 layer marks a complete rhombic triacontahedron.**
> The pentagon's five thick rhombs are the solid's top cap; the ring of five thin
> rhombs around them is its temperate band; and the solid's five-fold pole is the
> rosette hub itself.

That is the sentence the page exists to make visible. The P1 layer is already
computed (`allP1Tiles`) and already drawn on `unfold.html`, so the page can show the
correspondence rather than assert it.

### 5.3 Hats and bowls, and exactly how far clear

The hub's index decides the side:

| hub index | solid sits | name |
|---|---|---|
| 4 (summit) | **below** the roof | hat — the roof caps a solid standing under it |
| 1 (pit) | **above** the roof | bowl — the roof is the underside of a solid resting on it |

The center is **exactly φ = 1.618 s vertically from the hub** — verified to 1e-9 on
all caps, with zero horizontal offset. That is the triacontahedron's own pole
distance, `(5·(1/√5) + 1)/2 = φ`, so the picture is the obvious one: the solid hangs
its five-fold axis straight down (or up) from the rosette.

Since the roof's total relief is `3/√5 = 1.342 s`, a cap center clears the slab by

```
φ − 3/√5 = 1/(φ√5) = 0.2764 s
```

exactly — above the top or below the bottom, never inside. And the solid itself is
`2φ = 3.236 s` from pole to pole, **two and a half times the roof's entire
relief**: what the roof shows of a triacontahedron is a thin lid on something much
deeper.

### 5.4 The complete solids never collide

Between any two complete triacontahedra in a patch, the minimum center separation is

```
4.2360680 = φ³        against 2ρ = 2.7528 for face-to-face contact
                      and 2φ = 3.236 for circumsphere contact
```

— identical on Pe5 gen 3, Deca gen 3, Sun gen 3 and Pe3 gen 4. Interpenetrating
pairs: **0 of 15 / 253 / 5050 / 666**. Touching pairs: 0. So the complete solids form
a sparse, strictly separated family, never nearer than φ³ edge lengths. They are not
a packing of the space under the roof; they are isolated markers in it.

### 5.5 What the rest of the roof is doing

Complete caps account for 22–48% of faces. The remainder belongs only to partial
groups, whose makeup is also quantized:

```
10 = 5 thick + 5 thin      (complete cap)
 5 = 5 thick + 0 thin      (a bare Pe5 rosette, no ring)
 5 = 3 thick + 2 thin
 4 = 4 thick               3 = 3 thick               2 = 2 thick  or  2 thin
 1 = 1 thick  or  1 thin
```

Within a group, no two faces ever share a generator pair — as they must not, since
a triacontahedron has one face per orientation per side. Groups are usually but
**not always** edge-connected on the roof: 10 of 136 on Pe5 gen 3, 125 of 822 on
Pe3 gen 4 are split into pieces. A solid can show the roof two separated scraps of
itself.

A greedy largest-first assignment (each face to its bigger group) covers a patch
completely: 31 solids for 140 faces at Pe5 gen 3, 190 for 878 at Pe3 gen 4, 935 for
4430 at Deca gen 4. That is a segmentation, not a canonical decomposition, and
whether a canonical one exists is open — see below.

---

## 5A. The agnostic test — ρ not assumed

Everything above computed `centroid ± ρ·n̂` and clustered. That assumes the answer.
Jeff's framing is stronger and was run separately: intersect the normal **lines**,
with no radius in hand, and track two tolerances independently — how closely the
lines meet, and whether the two distances agree.

All pairs of faces, exact arithmetic, generation 3:

| | Pe3 | Pe5 | St5 | Deca |
|---|---|---|---|---|
| pairs | 9,591 | 9,730 | 13,530 | 185,745 |
| parallel (same face orientation — never meet) | 1,024 | 1,090 | 1,280 | 18,800 |
| **exactly concurrent** (miss < 1e-9) | 1,153 | 1,160 | 1,310 | 10,593 |
| … at **equal** radius | 773 | 810 | 885 | 5,465 |
| … at **unequal** radius | 380 | 350 | 425 | 5,128 |

Two generic lines in space do not meet at all, so 1,153 exact concurrences out of
8,567 non-parallel pairs is the first result on its own: **the roof's normal
congruence is enormously degenerate.**

The radius test matters exactly as predicted. A third of the concurrences have
*unequal* radii — `2.2270 / 3.6034`, `0.8507 / 0.5257`, `4.1291 / 5.8304` — normals
that meet without defining a common tangent sphere. Discarding those is not
bookkeeping; it removes a third of the candidates.

Among the equal-radius concurrences, **ρ falls out of the data as the dominant
radius without ever being assumed**: 421 of 773 on Pe3 gen 3, 425 of 810 on Pe5,
1,890 of 5,465 on Deca. Nothing else comes close.

### The other radii are real, and they are not solids

The equal radii are quantized, every one of them an algebraic integer of `Z[φ]`
when divided by ρ. Clustering the concurrence points and counting how many faces are
tangent at each (Pe3 gen 3 / St5 gen 3):

| r/ρ | r | points | **max faces tangent** | max faces in a supporting plane |
|---|---|---|---|---|
| 1/φ³ = 0.236068 | 0.324920 | 22 / 50 | 2 | 9 / 14 |
| **1** | **1.376382** | 53 / 91 | **10** | **41 / 43** |
| (8−2√5)/2 = 1.763932 | 2.427844 | 10 / 10 | 2 | 10 / 11 |
| √5 = 2.236068 | 3.077684 | 49 / 62 | 3 / 5 | 14 / 35 |
| 3 | 4.129146 | 19 / 50 | 5 / 2 | 10 / 14 |
| φ³ = 4.236068 | 5.830447 | 57 / 60 | 5 / 4 | 24 / 30 |
| φ³+2 = 6.236068 | 8.583211 | 37 / 26 | 3 / 5 | 10 / 16 |
| (10+4√5)/2 = 9.472136 | 13.037277 | 26 / 21 | 2 / 5 | 12 / 14 |

**Only r = ρ produces a large tangency set.** Every other radius tops out at two to
five faces — coincidences of a lattice dense with parallel directions, not solids.
The ping-pong ball has one size, and the agnostic test found it.

The last column is a different question and is the seed of the stellation idea —
see §5D.

## 5B. The weak requirement, answered

> *Given a local roof configuration, is there a **unique** triacontahedron whose face
> set contains those rhombs with exactly those mutual angles?*

Counted over all face pairs — how many triacontahedra contain both:

```
Pe3 gen 3:   0 centers: 9170     1 center: 421     2 centers: 0
Deca gen 3:  0 centers: 183855   1 center: 1890    2 centers: 0
```

**Never two.** So:

- **One face** lies on exactly **two** triacontahedra — one above, one below. Not
  unique, and cannot be: that is the whole above-or-below choice.
- **Two faces** that lie on a common solid determine it **uniquely** — and trivially
  so, since two non-parallel lines meet in at most one point. No search, no ambiguity.
- Two faces lie on a common solid **iff** their fold is 36° when adjacent (§5.1); the
  421 sharing pairs at Pe3 gen 3 are far more than its 172 thirty-six-degree edges,
  because non-adjacent faces of the same cap count too.

So the weak requirement **holds, in the strongest available form, as soon as two
faces are in hand** — but it **fails for 72° and 108° folds**, and that failure is
structural, not a gap in the patch. A triacontahedron's dihedral is 144° at every
one of its sixty edges, so two faces meeting at 108° or 72° on the roof cannot both
belong to one. The triacontahedral domains of the roof are therefore **bounded by
the 72° and 108° creases** — the domain walls are exactly the sharper folds.

### The triples — and the guess needs correcting

Jeff's "two thick plus a thin" is the natural candidate, being the rhombohedral
corner. It is not the one that works. Over every triple of faces meeting at a
vertex, the fraction lying on a common triacontahedron:

| triple | Pe3 gen 3 | Deca gen 3 |
|---|---|---|
| 3 thick | **107 / 135 = 79%** | **490 / 615 = 80%** |
| 2 thick + 1 thin | 40 / 320 = 13% | 205 / 1630 = 13% |
| 1 thick + 2 thin | 35 / 205 = 17% | 160 / 1110 = 14% |
| 3 thin | **0 / 28 = 0%** | **0 / 140 = 0%** |

**Three thick is the reliable signature; three thin never happens at all.** The
reason is §2: the five thick orientations are the solid's top cap, meeting at its
pole, so any three of them around a rosette hub concur. The five thin are the
temperate ring, which never closes on itself — a thin face needs the cap's
orientation fixed before it can join, which is why the mixed triples are so weak.

## 5C. The balls do overlap — and that is the picture

§5.4 reported that *complete* triacontahedra never interpenetrate and never even
touch, minimum separation φ³. That is true and it is only about the complete ones.
Take every solid carrying **two or more** faces:

| | solids | interpenetrating pairs | min center distance |
|---|---|---|---|
| Pe3 gen 3 | 51 | **161 / 1275** | 1.7013 (= the long diagonal) |
| Deca gen 3 | 231 | **892 / 26565** | 1.7013 |

So the ping-pong balls genuinely intersect, deeply — centers as close as one long
diagonal, against 2ρ = 2.7528 for mere face contact. The roof is a patchwork of
tangent planes drawn from a family of **overlapping** equal-radius solids, exactly
as Jeff pictured it, with the completed ones standing isolated inside that family
like the grains in it.

That reframes §5.4 rather than contradicting it: *completion* is what forces
separation. A solid that shows the roof all ten of its available faces has claimed
enough space that no other complete solid can come nearer than φ³.

## 5E. Why the overlap minimum is the long diagonal

Half answered, and the half that is answered also explains the missing group sizes.

### It is not a lattice fact

Both centers are all-odd points of the six-axis half-lattice, so their difference is
`Σ k_i a_i` with `k ∈ Z⁶` — an ordinary lattice vector. That lattice contains vectors
much shorter than 1.7013: a single axis has length **1**, and `a_i − a_j` with
`a_i·a_j = +1/√5` has length **1.0515**, the golden rhombus's *short* diagonal. Both
occur between real centers. Counting over **all** candidate centers, Deca gen 3:

```
separation 1.000000  ×685      k = a single axis
separation 1.051462  ×180      k = ±a_i ∓ a_j        (short diagonal)
separation 1.701302  ×1375     k = ±a_i ± a_j        (long diagonal)
```

So nothing forbids the shorter separations. The minimum is a fact about *which
solids hold two or more faces*, not about where centers may sit.

### What actually happens

Break the same pairs down by how many faces each solid carries:

| separation | face counts (min, max) seen |
|---|---|
| 1.000000 | 1,1 · 1,2 · 1,3 · 1,4 · 1,5 |
| 1.051462 | 1,1 · 1,2 |
| **1.701302** | 1,1 · 1,2 … **2,2 · 2,3 · 2,4 · 2,5 · 2,10 · 5,5** |

**At both shorter separations, one of the two solids always has exactly one face** —
every pair, both patches. A solid that close to a populated one can only ever pick up
a single face, so it never counts as a solid at all. The long diagonal is simply the
shortest separation at which *both* can be populated.

And the minimal pairs have a clean signature: of the 290 long-diagonal pairs among
≥2-face solids at Deca gen 3, **0 share a face and 290 share a roof vertex.** Two
triacontahedra at the minimum separation are two solids meeting the roof at one
common point.

### The mechanism, as far as it goes: the index window

This part is proved, and it is worth more than the minimum-separation question.

Write `M = Σ_{i<5} m_i`, and let `T = Σ_{i ∉ {j,k}, i<5} σ_i` for a candidate face of
orientation `{j,k}`. Computed over all ten orientations, **T is a constant of the
rhomb type and the side**:

| side | thick (\|Δj\|=1) | thin (\|Δj\|=2) |
|---|---|---|
| roof above the center (bowl) | T = +3 | T = +1 |
| roof below the center (hat) | T = −3 | T = −1 |

The face's low corner has index `(M − 2 − T)/2` up to the patch's global offset. A
rhombus spans three index levels and **the roof has only four**, so the low corner
must be 1 or 2 — exactly two admissible values — while thick and thin differ by one
level. Therefore every solid falls into one of three classes per side:

```
thick only   →  at most 5 faces
thick + thin →  up to 10          ← the only class that can complete
thin only    →  at most 5 faces
```

Verified exactly. Deca gen 3, the six `(M, m₅)` classes partition with no leakage:

```
M=−1 m₅=−1   105 solids   sizes {1,2,3,4,5}   T {−3}       thick only
M=+1 m₅=−1   104 solids   sizes {1,2,5,10}    T {−3,−1}    both  ← hats complete here
M=+3 m₅=−1    95 solids   sizes {1,2}         T {−1}       thin only
M=+3 m₅=+1    80 solids   sizes {1,2}         T {+1}       thin only
M=+5 m₅=+1    99 solids   sizes {1,2,5,10}    T {+1,+3}    both  ← bowls complete here
M=+7 m₅=+1    93 solids   sizes {1,2,3,4,5}   T {+3}       thick only
```

Equivalently in heights: a face centroid can only sit at two levels, and a hat's two
tangency bands are `0.7236` and `1.1708` below its center, so a hat center takes one
of exactly **three** heights, `1/√5` apart — the −0.2764 / 0.1708 / 0.6180 seen
throughout §4.

**This is most of the answer to the 6–9 gap.** A solid outside the middle class can
draw on five orientations at most, full stop. Only the middle class can exceed five,
and there the tiling supplies the whole Pe5 rosette and its ring together (§5.2). The
residue — why the middle class never lands on 6, 7, 8 or 9 — still needs the vertex
figures and is not settled here.

### Still open

The index window does not by itself forbid the shorter separations: a shift by one
axis moves a solid to an adjacent height class, and a short-diagonal shift keeps it in
the *same* class, and in both cases the neighbor could in principle hold two faces. It
does not, in any patch measured. **That last step is empirical, not proved.** The
right next move is probably to work out which face of a neighbor solid survives —
the same orientation on the neighbor is the original face translated by `a_t`, so the
question reduces to when that translate is present in the tiling.

## 5D. Stellation, glimpsed

Deferred, but the supporting-plane column of §5A already shows why it will pay.
Extend every face of the roof to its full plane. Because there are only ten face
orientations, the planes fall into **ten parallel families**. Their offsets within a
family, measured (Pe3 gen 3, 64 distinct planes; Deca gen 3, 166):

```
consecutive gaps:  S = 0.525731   L = 0.850651   L/S = 1.618034 = φ exactly
                   (plus L − S = 0.324920 in larger patches, and sums of S and L
                    where the finite patch simply has no plane)
```

Two gaps in ratio φ is a **Fibonacci chain**. So stellating the Wieringa roof gives
ten families of parallel planes, each family quasiperiodically spaced — a
three-dimensional relative of the pentagrid the plane tiling came from. And 41 of
the 139 faces of Pe3 gen 3 lie in the thirty supporting planes of a *single* edge-1
triacontahedron, against the 10 that are tangent to it: the roof hugs one solid's
plane arrangement four times as often as it touches its surface.

This wants its own investigation and possibly its own page. It is not folded into
the plan below beyond a note.

*Caveat: the offsets were bucketed by string rounding, which produced five spurious
zero gaps on Deca. Cluster with a tolerance before quoting these numbers again.*

## 6. Traps, recorded before they are re-hit

- **Do not use the 36°-fold components as the grouping.** They are far too coarse
  (§5.1). It is tempting because the local test is exact.
- **Do not assume a group is connected.** 15% of them are not, at generation 4.
- **Do not carry the ρ-tangency trick over to the rhombic icosahedron or the
  Bilinski dodecahedron.** Neither is isohedral and the construction is simply
  false for them (§1). If those solids are wanted, they need a different test.
- **Get the closest-approach formula right.** The first agnostic run reported
  *zero* concurrences on every patch — a flatly impossible answer given §5, and the
  cause was a sign slip in the line-to-line closest approach, not a finding. Any
  version of this test should be sanity-checked against the known ρ result before
  its negative answers are believed.
- **Equal radius is not enough.** A third of the exact concurrences have unequal
  radii (§5A). Track the two tolerances separately, as Jeff specified.
- **A common center does not imply a solid.** Concurrences occur at r/ρ = 1/φ³, √5,
  3, φ³ and beyond, all in `Z[φ]`, and all of them coincidental — their tangency
  sets never exceed five faces. Only r = ρ builds anything.
- **The two candidate centers of a face are a set, not a labeled pair.** A sign
  error in the `σ_i` while deriving §3 swapped which center was called "above" per
  face and produced *identical* group statistics, because both signs are enumerated
  anyway. The vote histogram cannot catch that error; only the above/below labeling
  and the reconstruction residual can. Check the residual.
- **`vertexList[v].index` is patch-relative** (shifted so the lowest level is 1), so
  "hub at index 4" means "at the top of *this* patch". The hat/bowl distinction is
  better derived from the center's own position relative to the face than from the
  index.

---

## 7. Open questions

1. **Is "complete cap ⟺ Pe5 tile" a theorem?** It holds in 27 out of 27 patches with
   no exception, which is strong, but the proof should be short: a Pe5 emits five
   thick rhombs sharing a hub, the hub's height is extreme, and the five thin
   neighbors are then forced by the vertex figures. Worth writing out — and worth
   checking whether a Pe5 lying **on the patch boundary** can lose its ring. None did,
   which is itself slightly surprising.
2. **Do the hats and bowls interleave in a regular way?** The minimum separation is
   exactly φ³ everywhere (§5.4). Is φ³ attained only between same-side pairs, or also
   between a hat and a bowl? The centers form a point set of their own — is it a
   quasi-lattice, and which one?
2a. **Why does a solid one axis away never hold two faces?** Partly answered in §5E: the long-diagonal minimum?** Partial solids come as
   close as 1.7013 (§5C) and never closer, on both patches measured. That is the
   golden rhombus's own long diagonal, which cannot be a coincidence; a two-line
   proof probably exists and would pin the structure of the overlapping family.
3. **What is the material between the solids?** The roof is the boundary of a layer
   of the two golden rhombohedra (NOTES.md, "The rhombohedra are the real
   components"), and 10 + 10 of them make a triacontahedron. The complete caps
   identify some of those clusters. Is the remainder a union of rhombohedra that
   *fails* to complete, or a differently-shaped cluster the test cannot see?
4. **Is there a canonical segmentation?** Greedy largest-first is arbitrary. A
   segmentation that respects the P1 layer — every Pe5 takes its own solid first,
   then the rest by some rule — would be defensible and would color the roof
   meaningfully.
5. **Do the five unusable orientations mean anything?** Every triacontahedron here
   also has ten vertical faces the roof can never touch. They stand on the boundary
   between what is under the roof and what is beside it. Are they the interfaces
   between neighboring solids?
6. **Is the vertical direction special, or an artifact?** `e_z` is the sixth axis
   only because the lift chose it. A different choice of five axes out of the six
   would give a roof over a different plane. The construction should be
   direction-agnostic, and confirming that would be a good check on the whole
   framework.

---

## 8. The page

**Name.** `centers.html`, nav label **Centers**, title *Where the normals meet*.
(`polyhedra.html` is taken, and "Triacontahedra" is too long for the nav bar.)
Placed after Polyhedra, since it depends on knowing what the solid is.

The page is a research instrument first and an exposition second — but the finding
in §5.2 is good enough to lead with, so the exposition should not be an afterthought.

### 8.1 What it shows

One three.js viewer, the roof in the middle, with layers that can be turned on:

| layer | content | default |
|---|---|---|
| **roof** | the surface as `roof3d.html` draws it, same palette and controls | on |
| **normals** | a segment of length ρ from each face centroid toward its chosen center | off |
| **centers** | a marker at each center, radius scaled by group size | on |
| **solids** | the complete triacontahedra, drawn as wireframe or translucent | on |
| **P1** | the Pe5 pentagons of the P1 layer, on the ground plane | off |

Coloring the roof **by group** is the main readout: complete caps in a strong color,
partial groups washed out, so the Pe5 correspondence is visible without being
labeled. A second mode colors by group *size* (1…10) on a single ramp.

### 8.2 Controls

- patch and generation — the same nine seeds, same persistence as `roof3d.html`
- **group size threshold**: show only centers with ≥ n votes (n = 1…10). Sliding it
  to 10 leaves only the complete solids, which is the picture worth printing.
- **above / below / both**: hats only, bowls only, or everything. This is Jeff's
  "above or below the map" made into a control.
- **normal length**: 0 → ρ → beyond, so the pencils of normals can be watched
  converging. At exactly ρ every normal ends on its center, which is the moment the
  whole idea is visible in one frame. The slider should be marked at ρ, and it should
  keep going past it — the concurrences at ρ√5, 3ρ and ρφ³ are real (§5A) and worth
  seeing fail the tangency test rather than being hidden.
- **complete only / all solids**: the difference between §5.4 and §5C is the whole
  difference between "isolated grains" and "overlapping ping-pong balls", and it is
  one checkbox.
- click a face → highlight its two candidate centers, its group, and the solid it
  completes if it does. Clicking a *second* face should show that the pair pins one
  solid and only one (§5B) — the uniqueness result made tangible.

### 8.3 Readout

Below the viewer, the numbers already established: rhombi, distinct centers, the
group-size histogram, complete caps against Pe5 tile count (they should always
agree — and if a patch ever makes them disagree, that is a finding, so the page
should say so loudly rather than quietly).

### 8.4 Implementation

New module `src/centers.ts`, pure geometry, no three.js:

```
interface Solid { m: number[]; c: V3; faces: number[]; side: 1 | -1; complete: boolean }
function triacontahedra(): Solid[]
```

built on `computeLift()` / `pos3D()` from `geometry.ts` exactly as `roof3d.ts` does,
using the **integer** center of §3 so grouping is a `Map` keyed on
`m.join(",")` — no tolerance, no clustering pass. Cost is O(F) with two map inserts
per face; at 16,475 rhombi the probe ran in well under a second in node, so no
budgeting is needed.

Entry point `src/centers3d.ts` for the page, reusing `prefs.ts` and the vertical
scale slider from `roof3d.ts`. The triacontahedron mesh is already written —
`triacontahedron()` in `polyhedra3d.ts` — and wants lifting into a shared module
rather than copying, since a third copy of the zonohedron construction is how the
three drift apart.

Verification, as a `tools/centers.mjs` script run before the page is trusted:
integer center residual < 1e-12; all coordinates odd; no group above 10; no group of
size 6–9; complete caps = Pe5 tiles; every 36° edge shares a center and no other
edge does; no face pair shares two centers. Those are the seven checks that carried
this note, and they are cheap.

The same script should keep the **agnostic** path as a cross-check, not just as
history: all-pairs line intersection with the two tolerances reported separately, and
an assertion that the dominant equal radius comes out as ρ without ρ being supplied.
It is O(F²) and so only runs to generation 3, which is enough — its job is to prove
the fast integer path is not assuming its own answer.

### 8.5 Order of work

1. `src/centers.ts` + `tools/centers.mjs`, with the six checks passing on all
   27 seed/generation combinations. Nothing visual yet — if the checks fail the page
   is not worth building.
2. Lift `triacontahedron()` into a shared module; `polyhedra3d.ts` uses it from there.
3. `centers.html` + `src/centers3d.ts`: roof, centers, complete solids, group
   coloring. That is enough to look at the finding.
4. Normals layer and the length slider — the part that *shows* the argument rather
   than its conclusion.
5. Threshold, side filter, click-to-inspect.
6. Prose: §1, §2, §5.2 and §5.3, with the numbers, and a link from `polyhedra.html`
   saying that the solid on that page is the one under the roof on this one.

Stages 1–3 are the deliverable; 4–6 are what make it a page rather than a probe.

---

## Probe scripts

The measurements above came from five throwaway scripts against `dist/geometry.js`:
`rt-probe.mjs` (ρ, first clustering), `rt-probe2.mjs` (bands, hats and bowls),
`rt-probe3.mjs` (the 36° equivalence), `rt-probe4.mjs`/`rt-probe5.mjs` (exact integer
centers, the Pe5 correspondence, connectivity), `sweep.mjs` (all 27 combinations),
`zono.mjs` (the isohedrality table), `packing.mjs` (separation). They should be
folded into `tools/centers.mjs` at stage 1 rather than kept.
