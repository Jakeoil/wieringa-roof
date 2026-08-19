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

### The nine makeups, and what a patch is entitled to classify

Jeff's objection, and it was right: a solid can be short because the tiling is short
there, or because the rhombi that would have closed it were cut off, and only the
first is a class. A solid is **settled** when its whole ten-face footprint lies inside
the patch — its ten candidate faces are fixed by its integer coordinates, so the
question is answerable. Holes are a different matter and count as genuine absences:
this generator draws rhombi from the P1 pentagons alone, so every star, boat and
diamond leaves a gap, at a density that does not fall with generation (Sun: 35 gaps at
gen 2, 240 at gen 3, 1665 at gen 4, against 365, 2440 and 16475 rhombi). **The rhomb
layer is a permanently partial tiling, not an approximation to a complete one**, and a
solid truncated by a gap is honestly truncated.

*A test that was nearly circular, recorded so it is not repeated: requiring all forty
corners of the ten candidate faces to be patch vertices reports that every settled
solid is complete. Of course it does — that is very close to requiring the faces
themselves. Use the outline, not the corners.*

Settled classes, Sun gen 4 (14,516 of 14,886 solids settled):

| class | makeup | count |
|---|---|---|
| 1 | 1T · 1t | 6235 · 2585 |
| 2 | 2t · 2T | 1840 · **70** |
| 3 | 3T | 995 |
| 4 | 4T | 565 |
| 5 | 3T+2t · 5T | 1315 · 240 |
| 10 | 5T+5t | **671 = the Pe5 rosette count exactly** |

**Only nine makeups ever occur.** No `1T+1t`, no `2T+1t`, no `3T+1t` — thick and thin
mix only at `5=3T+2t` and at the complete ten. Class 2 is real, against the guess that
it might not be, and it is overwhelmingly two *thin*.

Projected to the plane the ten faces tile a **decagon** exactly — five thick round the
pole in a Pe5 rosette, five thin filling the notches, 16 corners, area ratio
1.000000000. So a class is a picture, which is what the page draws. The arrangements
are nearly rigid too: each makeup has one pattern up to rotation, except `2=2t` and
`3=3T`, which have two.

### Proper rhombs, and the four classes

Jeff's framing, and it is the right one: **a proper rhomb is a rhomb with all of its
normals** — one whose home solid shows the roof a whole configuration rather than a
scrap. There are exactly four, and they are told apart by *makeup* rather than by
size, because class 5 comes in two quite different shapes:

| class | makeup | share of proper solids |
|---|---|---|
| **4** | 4 thick | ≈18% |
| **5a** | 5 thick — the whole rosette | see below |
| **5b** | 3 thick + 2 thin | see below |
| **10** | 5 thick + 5 thin — complete | ≈23% |

5a and 5b together are ≈58%; splitting them is what the page now does, and the two are
not close relatives — 5a is a bare Pe5 rosette, 5b a contiguous run of five round the
decagon.

Everything else is **demoted**: class 3 is never anything's home at all, and classes 1
and 2 fall away with patch size. Demoted rhombi stay drawn, shaded and contoured, but
colorless — they are not a class, they are what is left.

*(Recorded because it took a correction: Jeff's note wrote "5a (4 thick)", which reads
as a slip for 5 thick, since 4 thick is class 4. Implemented as 5a = 5 thick.)*

### Cup coverage: why there is daylight

Reported by Jeff, with the surface invisible and every class's cups at full size. Not a
gap in the geometry — measured, **every roof rhomb on a drawn solid lies in that
solid's own cup, 0 exceptions**, so the ten-face selection is on the right side. A
rhomb is covered iff *its home solid is drawn*, and two kinds are held back:

| Sun gen 4, 16,475 rhombi | uncovered |
|---|---|
| home edge-truncated | 1,200 |
| home demoted (class 2) | 60 |
| home demoted (class 1) | 10 |
| **total** | **1,270 = 7.7%** |

**The daylight is all boundary, even where it looks interior.** Measured on Sun gen 4:
every unsettled solid lies within **2 edges of a real boundary edge**, none further.
It looks like the middle of the patch because the boundary is not the outline the eye
draws: the star-family gaps are **bays open to the outside**, not islands, so the
covered region is one deeply indented simply-connected patch and its boundary reaches
far inside the convex hull. Sun gen 4 has 270 withheld solids more than 10 edges from
the hull and *zero* more than 2 edges from the boundary — both true at once.

Draw **every** home solid instead and coverage is **exactly 100%** — 0 uncovered on
every patch — which is not luck: every rhomb has a home and a home's cup contains it.
The gaps fall as the patch grows (38.8% → 13.5% → 7.7% on Pe3 gen 3, Sun gen 3, Sun
gen 4) because they are dominated by the fringe. The interior residue is the class-1
and class-2 homes, and the class-1 count is the constant ten.

### Nail heads — half the population is the far end of something else

Spotted by Jeff, looking at Sun gen 2: a complete cap's normals converge on one side,
and on the other side each of those faces has its own separate class-1 centre. Those
are not classes. Every face names **two** centres by construction, so a solid holding
one face is usually just the far end of a normal whose point is somewhere else — a
**nail head**.

Define a face's **home** as the larger of its two solids. A solid no face calls home
is a nail head. Measured, this is not a small correction:

- a complete cap generates **ten** of them, one per face — all ten, not five;
- **99.9%** of one-face solids are nail heads. Of Sun gen 4's 8,072 one-face solids
  only **10** have a one-face solid on the far side too, and that number is constant
  with generation — those ten are the true boundary orphans of the next section;
- nail heads outnumber home solids roughly **four to one**.

Held back, the classification changes shape completely:

| home solids only | 1 | 2 | 3 | 4 | 5 | 10 |
|---|---|---|---|---|---|---|
| Sun gen 3 | 2.62% | 5.25% | **0** | 13.12% | 52.49% | 26.51% |
| Sun gen 5 | 0.05% | 0.89% | **0** | 17.51% | 57.70% | 23.85% |
| Star gen 5 | 0.00% | 1.79% | **0** | 18.13% | 57.28% | 22.80% |
| Deca gen 5 | 0.07% | 1.87% | **0** | 17.90% | 57.10% | 23.06% |

**Class 3 is empty among settled solids — no three-face solid is ever a home.** Near
the cut it can be: unsettled class-3 homes number 50, 210 and 850 on Sun at generations
3, 4 and 5, growing with the boundary rather than the area, and each is a truncation of
something larger that the patch cannot see.
Classes 1 and 2 fall away with patch size (Sun: 17.9, 2.7, 0.4, 0.05 percent at
generations 2 to 5), so they look like boundary residue rather than classes. What
survives is three: **4 at ≈18%, 5 at ≈58%, complete at ≈23%**, agreeing across three
seeds.

This supersedes the share table below, which counted every centre. That one is a
statement about the construction; this one is about the roof.

### The asymptote, and what the substitution matrix pins exactly

Jeff's point: for large patches the class frequencies should converge, since the
thick-to-thin ratio does. They do — but the convex hull had been hiding it. A Star or
a Queen patch is deeply concave, the hull spans the bays, and solids sitting in open
air were counted as settled with a bias that differed per seed. That is how the fault
was found: for a substitution tiling the frequencies **must** agree in the limit, and
Deca, Sun and Star did not. With the real outer boundary they agree to about half a
point at generation 5:

| gen 5 | class 1 | 2 | 3 | 4 | 5 | 10 |
|---|---|---|---|---|---|---|
| Deca, 31,360 rhombi | 60.62% | 12.95% | 6.07% | 3.72% | 11.86% | 4.79% |
| Sun, 111,925 | 61.03% | 12.53% | 6.38% | 3.55% | 11.69% | 4.83% |
| Star, 104,240 | 60.68% | 12.84% | 6.12% | 3.76% | 11.87% | 4.73% |

Some of the limit is not merely measured. The substitution over the six P1 types, read
straight off `geometry.ts`, has Perron eigenvalue **φ⁴ = 6.854102** and frequencies
that are all powers of φ:

```
Pe1 = φ⁻²   Pe3 = φ⁻³   St1 = φ⁻⁴   St3 = φ⁻⁵   Pe5 = φ⁻³/√5   St5 = φ⁻⁵/√5
```

verified against the numerical eigenvector to 6e-17. From those:

- **rhombi per P1 tile = φ² exactly** (`5·Pe5 + 4·Pe3 + 3·Pe1`);
- **thick : thin = φ exactly** — `(5·Pe5 + 3·Pe3 + Pe1) / (Pe3 + 2·Pe1)`, difference
  0.0e0, so Jeff's premise is a theorem here and not an observation. Finite patches
  approach it slowly and from both sides: at generation 5, Pe3 is still at 1.76 and
  Deca at 1.54;
- **class-10 solids per rhomb = φ⁻⁵/√5 = 0.0403252**, exactly, because class 10 is
  the Pe5 rosette count (§5.2) and Pe5 has that frequency. Measured: Sun 0.041393 →
  0.040728 → 0.040527 at generations 3, 4, 5, and Star and Deca approach the same
  number from below.

The other five classes converge but no closed form has been derived for them. They
depend on two-tile configurations rather than on tile frequencies alone, so the
eigenvector is not enough.

### Face classes, and the orphans

Give each face the size of the larger of its two solids — which is what largest-first
assignment gives it anyway — and the roof partitions into six classes, `1 2 3 4 5 10`,
with nothing between five and ten here either:

| patch | 1 | 2 | 3 | 4 | 5 | 10 |
|---|---|---|---|---|---|---|
| Pe5 gen 3 | — | — | 35 | 20 | 25 | 60 |
| Pe3 gen 3 | **2** | 6 | 25 | 16 | 30 | 60 |
| Pe1 gen 3 | **4** | 12 | 15 | 12 | 35 | 60 |
| St5 gen 3 | — | 50 | — | 10 | 55 | 50 |
| Deca gen 3 | **10** | 50 | — | 30 | 290 | 230 |
| Sun gen 4 | **10** | 220 | 420 | 1340 | 7775 | 6710 |
| Star gen 4 | **10** | 530 | — | 1000 | 7455 | 5850 |

Pe5 patches have no class 1 and no class 2 at all: every face sits in a group of at
least three.

**Class 1 — orphans — are real, and they are entirely a boundary effect.** A class-1
face lies on two triacontahedra and is the only face on either, so it shares a solid
with nothing. Measured over all 27 seed/generation combinations, without exception:

- every orphan is on the **patch boundary** (100 of 100);
- every orphan is **thin**, with only **two of its four neighbors present**, meeting
  both of them at **72° and 108°** — and 36° is the fold that makes two faces share a
  solid (§5.1), so the two absent neighbors are precisely the ones that would have
  given it one;
- their number **does not grow with the patch**: Pe3 has 2 at generations 2, 3 and 4
  alike, Pe1 has 2/4/4, Deca 4/10/10, Sun and Star 10 at every generation, against
  face counts running from 23 to 16,475.

A fixed count against a growing area means they are a feature of where the patch was
cut, not of the tiling. **An unbounded Wieringa roof has no orphans**: every face
shares a triacontahedron with at least one neighbor.

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
- **A cross-check must not be statistical when it can be exact.** Check 8 in
  `tools/centers.mjs` first asserted that ρ is the *most common* equal radius. True
  on every real patch, and it failed on St1 gen 2 — three rhombi, one concurrence,
  which happened to land at ρ/φ³. The check was wrong, not the geometry. It now
  asserts set equality instead: the pairs the ρ-free pass finds at ρ are exactly the
  co-solid pairs of check 7. That is a stronger claim *and* it is well defined on a
  three-rhomb patch, where 0 = 0.
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
2a. **Why does a solid one axis away never hold a second face?** This is the residue
   of §5E. The long-diagonal minimum reduces to it exactly: separations of 1 and
   1.0515 are permitted by the lattice, permitted by the index window, and occur
   between real centers — yet the nearer solid always ends up with exactly one face,
   in every pair of every patch measured. Settle this and the minimum separation is a
   theorem rather than an observation.
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
- **hills up / dales up** — a two-state flip, **not** the 3D page's continuous
  vertical slider. Decided with Jeff: scaling the vertical is an affine map, so the
  roof stays honest at any setting, but a squashed triacontahedron is not a
  triacontahedron — its normals stop meeting at a point, which is the page's entire
  claim. Rather than grey the solids out between stops, the intermediate settings
  simply do not exist here. Vertical scale is ±1 and nothing else.

  Implementation: compute the lift and the centers **unflipped**, then negate z on
  the whole scene — surface, centers and solids together. A mirrored triacontahedron
  is still a triacontahedron, so this is exact, and it swaps every hat for a bowl,
  which is what flipping the roof ought to mean.

  Two consequences worth having: **shading loses its strength control** and becomes a
  plain on/off, since the roof is never flat here and there is always height to shade
  — no contradiction with the rule in NOTES.md, which only forbids shading a *flat*
  sheet. And the snap animation, the `|u|^1.6` bias and the vscale preference all stay
  behind on `roof3d.ts` instead of moving into the shared module.
- **normal length**: 0 → ρ → beyond, so the pencils of normals can be watched
  converging. At exactly ρ every normal ends on its center, which is the moment the
  whole idea is visible in one frame. The slider should be marked at ρ, and it should
  keep going past it — the concurrences at ρ√5, 3ρ and ρφ³ are real (§5A) and worth
  seeing fail the tangency test rather than being hidden. This is the page's one
  continuous control, and it moves the *rendering*, never the geometry.
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

New module `src/centers.ts`, pure geometry, no three.js. **Built — see the order of
work.** What it exports:

```ts
const A6: V3[]            // the six icosahedral axes, the five roof generators + e_z
const RHO: number         // √(1 + 2/√5)
function centerOf(m: number[]): V3

interface Solid { id; m: number[]; c: V3; faces: number[]; thick; hat; complete }
interface Face  { id; vids; c: V3; u: V3; pair: [number, number]; thick;
                  solids: [number, number] }
interface Centers { solids; faces; byRhomb; residual }

function triacontahedra(): Centers          // reads the current patch, like roof3d.ts
function assignLargestFirst(c): number[]    // a policy, deliberately not in the above
function pe5Rosettes(): number[]
```

`hat` rather than `side: 1 | -1`, because "the center is below its faces" is what the
caller actually wants to ask and the sign convention is an implementation detail —
and a solid never shows the roof faces from both sides, so one face settles it.
`assignLargestFirst` is separate because a face lies on two solids and nothing in the
geometry prefers either: any single-valued coloring is a choice, and it should not be
able to pass for a fact.

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

### 8.4a Sharing the viewer, and three traps

The page is `roof3d.html` with more layers, and should read as its sibling — same
`.bar` control strip, same `#view` at `min(70vh, 620px)`, same `#status` beneath,
same import map. But of `roof3d.ts`'s 491 lines only about 100 are roof-specific:

```
scene / camera / renderer / controls / lights   42
palettes                                        28
mesh, color and the absolute shading ramp       83
edge overlay                                    24
isoglosses                                      55
framing                                         10
controls, prefs, snap                           77   ← stays on roof3d
resize / persist / animation loop               39
```

Copying the file would put a second copy of the empty-patch NaN guard and the
absolute shading ramp in the tree, which is the failure NOTES.md already records
under "the same idea written twice, once right". So: extract `src/roofview.ts` —
scene, framing, prefs, and the roof mesh with its edges and isoglosses, with hooks
for extra layers and extra controls — **as its own commit that leaves `roof3d.html`
behaving identically**. That commit is reviewable on its own and its test is that the
3D page does not change. Only then build `centers3d.ts` on it.

Three traps, all visible in the current code:

1. **The recentering offset.** `build()` does `geo.translate(-c.x, -c.y, -c.z)` and
   the edge and isogloss layers subtract the same `c` by hand. Centers, solids and
   normals must subtract it too or they land φ away from where they belong. This is
   the first thing that will go wrong.
2. **Framing.** A solid reaches φ below the surface where the roof's whole relief is
   1.342, so the bounding sphere roughly triples when the solids layer is on, and
   `build()` reframes only on a patch change. Frame to the solids-on extent always,
   rather than lurching when the box is ticked.
3. **The vertical scale** — settled above: ±1 only.

### 8.5 Wiring it in

Agreed with Jeff: **the index points at it.** A page reachable only by typing its
URL is not finished, so the wiring lands with the page and not afterwards.

| file | change |
|---|---|
| `index.html` | a seventh `.card`, placed after Polyhedra since it depends on it |
| `index.html`, `roof3d.html`, `info.html`, `polyhedra.html`, `unfold.html`, `tools.html`, `utilities.html` | one more `<a>` in `<nav>` — seven identical edits |
| `centers.html` | its own copy of the nav, `aria-current="page"` moved to its own entry |
| `polyhedra.html` | a prose cross-link: the solid on that page is the one under the roof on this one |
| `README.md`, `PLAN.md` | a row in each page table |
| `centers.html` | a `<details>` "How it works", with the **build stamp in its `<summary>`** |

The build stamp is the workbench's pattern, verbatim — `unfold.html:181` carries
`<span class="mono" id="buildtag">` inside the `<summary>` and `workbench.ts` fills
it with `· build HH:MM:SS`. The comment there earns it: working out whether the
browser is running a stale script has cost this project three debugging sessions, and
telling someone to open developer tools is not an answer. **`roof3d.html` does not
have it and does not even log a build line**, so it is the one page that cannot
answer the question — and the centers page would inherit that by being built on it.
Fix both, but *after* stage 2: the extraction's whole test is that `roof3d.html` does
not change, so the stamp goes on in its own commit once that has been shown.

The nav is hand-duplicated in all seven pages, and the way to get this wrong is to
miss one. `grep -L "centers.html" *.html` afterwards should come back empty. It sets
`flex-wrap: wrap`, so a ninth entry costs nothing; `.cards` is
`auto-fit, minmax(230px, 1fr)`, so a seventh card reflows without touching the CSS.

Card copy:

```html
<a class="card" href="./centers.html" draggable="false">
    <h3>Centers</h3>
    <p>Follow each face's normal and watch where they meet — every concurrence is a
    triacontahedron the roof is the lid of.</p>
</a>
```

### 8.6 Order of work

1. ~~`src/centers.ts` + `tools/centers.mjs`~~ **done.** All eight checks pass on all
   27 seed/generation combinations, to 16,475 rhombi, in 0.8 s. Residual runs
   6.7e-16 to 3.0e-14; complete solids equal Pe5 rosettes everywhere; the ρ-free
   pass recovers the co-solid pairs exactly (`425/425 at ρ` on Pe5 gen 3,
   `2793/2793` on Pe3 gen 4) and is skipped above 1300 faces where O(F²) stops being
   worth it. `node tools/centers.mjs`.
2. Lift `triacontahedron()` into a shared module; `polyhedra3d.ts` uses it from there.
   Same commit or the next: `src/roofview.ts`, whose test is that `roof3d.html` is
   unchanged (§8.4a).
2a. Then, deliberately visible: the build stamp on `roof3d.html` as well, and a
   `console.log` build line from the shared viewer, so no page on the site can leave
   you guessing whether the script is stale.
3. `centers.html` + `src/centers3d.ts`: roof, centers, complete solids, group
   coloring — **and the wiring of §8.5 in the same step**, so the page is reachable
   the first time it exists. That is enough to look at the finding.
4. ~~Normals layer and the length slider~~ **done**, with the shrink slider — Jeff's
   idea, after looking at stage 3 and seeing the shells crowd. Each face sends a
   segment both ways, colored by the solid at that end, and at exactly ρ every
   endpoint lands on its own marker (verified to 2.7e-15, flipped and not).
   **Shrinking a solid toward its center is safe where squashing the vertical is
   not**: a shrunk triacontahedron is still a triacontahedron, its faces stay
   parallel to the roof faces, and its normals still meet at the same point, so no
   setting of that slider can show anything false. It also fixes a rendering fault
   rather than only crowding — the shells are translucent, so where they overlap the
   blending is order-dependent. Detents at φ⁻¹, φ⁻², φ⁻³, and on the normals at ρ.
5. ~~Threshold, side filter, click-to-inspect~~ **done.** One filter governs markers,
   shells and normals together — having them disagree would make the picture
   unreadable — so "faces per solid" at ten is the complete solids and the page opens
   there. Winding it down on Pe3 gen 3 gives 6 → 12 → 32 → 51 → 137 solids at ≥10, 5,
   3, 2, 1, which is what the solid-size slider is for. The side filter splits them by
   `hat`. Picking works off the surface mesh directly: it is non-indexed with two
   triangles per rhombus, so a raycast's `faceIndex >> 1` is the face's position in
   the build's own list, with no second index to keep in step (verified over all 1220
   triangles of Deca gen 3). The selection survives a rebuild and is drawn whatever
   the filters hide, since the point of asking about one face is to get the answer
   even when the filters have hidden it.
6. ~~Prose~~ **done.** "How it works" rewritten against what the page actually does
   after six stages, since it had drifted — it still described a faces-per-solid
   threshold that no longer exists. Reorganized to match the controls: why a normal
   finds a center, ten is the ceiling, proper rhombs and the four classes with the
   nine illustrations, nail heads, then the controls themselves. `NOTES.md` now points
   here, which nothing did before.

All six stages are done. The controls were then reorganized into Global / Rhombs /
Normals / Triacontahedra / per-class, on Jeff's layout.

---

## Probe scripts

Everything above was measured by throwaway scripts in `tools/probes/`, kept only
until stage 1 folds them into `tools/centers.mjs`. They import `../../dist/geometry.js`,
so `npm run build` first.

| script | what it established |
|---|---|
| `rt-probe.mjs` | ρ, and the first clustering of candidate centers |
| `rt-probe2.mjs` | the 5·5·10·5·5 banding, hats and bowls |
| `rt-probe3.mjs` | the 36° fold equivalence |
| `rt-probe4.mjs`, `rt-probe5.mjs` | exact integer centers, the Pe5 correspondence, connectivity |
| `sweep.mjs` | all 27 seed/generation combinations |
| `zono.mjs` | the isohedrality table of §1 |
| `packing.mjs` | separation of the complete solids |
| `agnostic2.mjs` | the ρ-free line intersection (§5A); exports `faces` and `meet` |
| `balls.mjs` | concurrence clusters, tangency vs supporting-plane counts |
| `weak.mjs` | uniqueness, the vertex triples, overlap, the plane arrangement |
| `diag.mjs` | the shortest center separations and their lattice vectors |
| `why.mjs`, `why2.mjs` | the index window (§5E) and the face counts at each separation |
