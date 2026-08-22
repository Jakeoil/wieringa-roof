# Chapter 4 — the golden rhombohedra

*Plan and organization. Nothing built yet. The measurements below were computed against
this project's own geometry and are reproducible from `tools/probes/dissect.mjs`; the
mathematics they confirm is classical and is credited at the end.*

Chapter 1 built the roof, chapter 2 found the triacontahedra under it, chapter 3 took
the inspheres as an object in their own right. This chapter goes inside the solid: the
two golden rhombohedra are the actual space-filling components, and the roof is the
boundary of a layer of them.

---

## 1. What is already verified

### The dissection is a special case of a general theorem

A zonohedron on *n* generators dissects into exactly `C(n,3)` parallelepipeds, one per
triple of generators, each being the cell those three span. For the six icosahedral
five-fold axes that gives **C(6,3) = 20 cells**, and because every pairwise dot product
is ±1/√5, every cell is a golden rhombohedron. Measured:

| | volume | count |
|---|---|---|
| **obtuse** (oblate) | 0.470228 | **10** |
| **acute** (prolate) | 0.760845 | **10** |
| ratio | **1.618034** — φ exactly | |
| total | **12.310734** = `4√(5+2√5)` — the RT's volume exactly | 20 |

So the classical "ten of each" is not an arrangement someone found; it is forced by the
triple count, and the shapes are forced by the axes.

### Ten and ten — settled

**Ten obtuse and ten acute golden rhombic hexahedra (parallelepipeds).** Jeff's "5 × 2"
was a slip and is withdrawn; the measurement above stands as the statement.

There is a secondary structure worth noting but not naming anything after: sorting by
the signs of the three mutual dot products gives obtuse with one negative dot (10),
acute with two (5), and acute with none (5). The acute ten are congruent but seated in
the solid two different ways.

### The nested family, and the sub-zonohedra are the same cells

Drop axes one at a time and the dissection is inherited:

| generators | solid | cells | volume | as a fraction of the RT |
|---|---|---|---|---|
| 6 | rhombic triacontahedron | 20 | 12.310734 | 1 |
| 5 | rhombic icosahedron | 10 | 6.155367 | **exactly ½** |
| 4 | Bilinski dodecahedron | 4 | 2.462147 | exactly ¼ |
| 3 | golden rhombohedron | 1 | 0.470228 | — |

### The intersection result — and it answers Jeff's question directly

> *"I am interested in any links between these hexahedra and intersections of RT's."*

There is one, and it is exact:

> **RT ∩ (RT + aᵢ) = the rhombic icosahedron on the other five axes, translated by
> aᵢ/2 — exactly half the triacontahedron's volume.**

Verified by membership test, not by volume alone: 400,000 samples per axis on three
different axes, **100.0000% agreement** each time. Translating a triacontahedron by one
of its own generating axes and intersecting deletes that generator from the zonohedron.

Two RTs at other offsets share less, and the interesting ones are the offsets that
actually occur in this project's packing:

| offset | \|t\| | shared volume | of an RT |
|---|---|---|---|
| one axis `aᵢ` | 1.0000 | 6.155 (the icosahedron) | 50% |
| short diagonal `aᵢ − aⱼ` | 1.0515 | ≈ 5.83 | 47% |
| long diagonal `aᵢ + aⱼ` | 1.7013 | ≈ 2.65 | 22% |
| face contact `2ρ·n̂` | 2.7528 | 0 | 0% |

The long diagonal is §5C's minimum separation between populated solids, and the face
contact is chapter 3's kissing distance. **Whether the short- and long-diagonal
intersections are also named zonohedra is open**, and is the first thing to settle —
the one-axis case suggests they might be.

---

## 2. The four parts

Jeff's organization.

### Part 1 — the cage · **built**

`rhombohedra.html`, nav label **Cage**. The twenty cells as a wireframe you can turn and
pull apart: explode slider, color by acute/obtuse or one hue per cell or by axis, show
either family alone, faces on or off, auto-turn.

`src/dissect.ts` holds the dissection and `tools/dissect.mjs` checks it — twenty cells
one per triple, ten and ten, ratio φ, volumes summing to `4√(5+2√5)`, every corner
inside the solid, **no two cells overlapping**, and 93,809 sampled interior points each
in exactly one cell. The dissection is found by backtracking and the module says so
rather than pretending it is canonical: many dissections exist, this is one.

Exploding moves each cell along the direction of its own center, so zero reassembles
exactly and full travel is the same arrangement magnified. Faces go translucent while
the cells are close, since assembled they share every internal face.

### The interior has no symmetry at all

Noticed by Jeff, looking at the inner cage: *"a rosette but otherwise very little
symmetry."* Measured, and it is starker than that.

The triacontahedron's own rotation group has order 60. Applied to the pieces of the
page's dissection:

| | preserved by |
|---|---|
| the shell, 30 outer faces | **60 of 60** — everything |
| the inner cage, 45 internal faces | **1 of 60** — the identity alone |
| the 20 cell centers | **1 of 60** |

**The exterior is forced and the interior is chosen**, and this choice keeps none of the
solid's symmetry whatever. The rosette Jeff can see is local — five cells meeting round
one five-fold axis — and does not extend to a global symmetry, because there is none to
extend to.

### Settled: there are exactly two dissections

The open question in Jeff's source file — how many dissections there are, which he
could find no clean published count for — now has an answer, and it is small.

| | |
|---|---|
| dissections with positions fixed in space | **160** |
| distinct up to rotation and reflection | **2** |
| in the symmetric orbit (a three-fold axis) | 40 |
| in the chiral orbit (no symmetry at all) | 120 |

160 = 120 + 40, orbit sizes divide the group order 120, and the set is verifiably
closed under the group — 120 of 120 images listed. Jeff's recollection of "only one"
was very nearly right.

**And the two differ by a single flip.** Their shells are identical, all thirty faces;
their inner cages share 39 of 45 faces and differ in **six**. Those six belong to
exactly **four** cells, those cells use exactly **four** axes, and they occupy volume
2.462147 — which is precisely the **Bilinski dodecahedron**, the zonohedron on four
axes, with its four cells and its six internal faces. A four-axis zonohedron admits
exactly two tilings of its own, and swapping between them is the elementary local move:
the **phason flip** of the quasicrystal literature, and the only difference between the
two dissections of the whole solid. The page offers it as a toggle for that reason.

*A wrong answer, kept because the way it failed is instructive.* The first attempt
compared rotated dissections by rounded coordinate keys and concluded the set was not
closed under rotation — 58 images of 60 "not listed". That was entirely an artifact of
the keys: a rotation perturbs the fifteenth digit, which is enough to flip a rounding
boundary. It also produced 160 with all stabilizers trivial, which is self-contradictory
since 160 is not a multiple of 60 — and that contradiction is what exposed it. The fix
was to stop using floats: a symmetry is reduced to a **signed permutation of the six
axes**, and the action on a dissection is integer arithmetic from there.

### Part 2 — the intersections found in `centers.html` · **done, and the answer is no**

The offsets that actually occur in the packing, with the shared region computed exactly
— vertex enumeration over the thirty bounding planes and a sum of face pyramids, not
sampling. The method validates itself on the case already known: it returns exactly half
the triacontahedron's volume, on 22 vertices and 20 faces, which is the rhombic
icosahedron and nothing else.

| offset | \|t\| | shared | vertices | faces | is it a zonohedron? |
|---|---|---|---|---|---|
| one axis `aᵢ` | 1.0000 | **6.155367 — exactly ½** | 22 | 20, all parallelograms | **yes — the rhombic icosahedron** |
| short diagonal `aᵢ−aⱼ` | 1.0515 | 5.836483 (47.41%) | 30 | 28 quads, only 20 parallelograms | no |
| long diagonal `aᵢ+aⱼ` | 1.7013 | 2.655892 (21.57%) | 16 | 10 parallelograms + **8 triangles** | no |
| face contact `2ρ·n̂` | 2.7528 | 0 | — | — | they only touch |

**Only the one-axis intersection is a named solid.** A three-dimensional polytope is a
zonotope exactly when all its faces are centrally symmetric, and the other two fail
that: the long diagonal has eight triangular faces outright, and the short diagonal has
eight quadrilaterals that are not parallelograms. Which is why neither volume has a
closed form — searching `(a + b√5)/c` over small integers finds nothing for either,
where every zonohedral volume in this chapter is such a number.

The one-axis result has a clean reason behind it, and the others do not: translating a
zonohedron by one of its own generators and intersecting **deletes that generator**,
leaving the zonohedron on the other five. No such statement is available for a diagonal
offset, because a diagonal is not a generator.

#### And they are not unions of cells

The sharp question this part was posed to answer — *are the intersections unions of
whole cells, so that chapter 3's packing and chapter 4's dissection are the same
combinatorics twice?* — comes back **no**, for every offset and for both dissections:

| offset | cells wholly in | wholly out | **split** |
|---|---|---|---|
| one axis | 9 | 1 | **10** |
| short diagonal | 1 | 2 | **17** |
| long diagonal | 4 | 5 | **11** |

Identical for the symmetric and the chiral dissection, so it is not an artifact of which
one is chosen.

Even the good case fails, and instructively. The one-axis intersection *is* the rhombic
icosahedron — but it is the icosahedron translated by `aᵢ/2`, **half** an axis, so it
sits half a cell out of step with the dissection and cuts ten of the twenty. The
packing and the dissection are built on the same six axes and are not the same
combinatorics; they are offset from one another by a half-lattice step.

### Part 3 — construction · **built**

`nets.html`. Pick a solid — the triacontahedron, either hexahedron, or all twenty —
pick a coloring, set the side length, print at true size.

`src/solidnet.ts` is a general edge-unfolder for closed polyhedra, which `unfold.ts`
could not be pressed into: that one is built round the roof's own data, rhombi indexed
by tiling vertex with hinges from a cut tree, and a solid has no tiling behind it. Faces
go in as lists of 3D corners, adjacency comes from shared edges, a BFS spanning tree
places each face across the edge it arrived by, and a placement that would overlap
starts a new piece instead — so the output is always valid paper.

**Everything unfolds whole.** The triacontahedron's thirty faces come apart into one
connected net with no overlap, at 7.847 × 8.944 side lengths, and so does every one of
the twenty hexahedra. `tools/solidnet.mjs` checks the things that would ruin a model
without showing on screen: edge lengths preserved to 1e-9, every corner angle within
1e-7 of 63.4349° or 116.5651°, hinges exactly `faces − pieces`, and no overlapping pair
within a piece.

The Kowalewski coloring makes the twenty a **puzzle** rather than a set of models: the
ten 3-subsets of five colors, each borne once by an acute cell and once by an obtuse
one, which is the classical labelling Hart counts 320 assemblies for.

### Part 4 — the roof from hexahedra · **built, and it closes exactly**

`hexroof.html`. The roof in the cluster colors or the Kowalewski five, and the acute
and obtuse hexahedra hung beneath it.

**One hexahedron per rhomb, and nothing to choose.** The third edge of a cell is not
another of the roof's five lifting generators. It is the **vertical** — `e_z`, the sixth
icosahedral axis, the one the roof surface itself never uses. Chapter 2 already had it:
`A6 = [E_0..E_4, e_z]` is exactly the six-axis set whose C(6,3) = 20 triples dissect the
triacontahedron, and every one of the fifteen pairwise dots is ±1/√5. So
`{E_j, E_k, e_z}` is a golden rhombohedron on the same footing as any other triple.

Each cell is therefore a vertical prism: the rhomb on top, the same rhomb translated by
`−e_z` beneath, and four vertical side faces whose edges run plumb — which is precisely
the "faces perpendicular to the plane of the roof, also the edges, straight down" of
Jeff's description.

**Thick gives acute, thin gives obtuse — the determination is that simple.** For a thick
rhomb `E_j · E_k = +1/√5`, so all three pairwise dots of `{E_j, E_k, e_z}` are positive
and the cell is prolate, volume 0.760845. For a thin rhomb that one dot is negative and
the cell is oblate, 0.470228. There is no search and no choice:

| patch | rhombi | cells | acute | obtuse | thick | thin |
|---|---|---|---|---|---|---|
| Pe5 gen 2 | 25 | 25 | 20 | 5 | 20 | 5 |
| Pe3 gen 3 | 139 | 139 | 93 | 46 | 93 | 46 |

The acute-to-obtuse ratio *is* the thick-to-thin ratio, so it tends to φ — the same
statement as chapter 1's, one dimension up.

**They cannot overlap, by construction rather than by search.** Distinct cells are
vertical prisms under distinct rhombi, and the rhombi project onto a tiling of the
plane. Disjoint shadows, disjoint prisms, whatever the heights.

**The Kowalewski five carries down, and it is the same five.** Jeff's question was
whether the roof's five-coloring can be extended to the hexahedra under the rule the
triacontahedron uses — like touches like — and whether it needs new colors. Both answers
are as good as they could be: it is not an analogue of the RT's coloring but literally
the same one, because the layer's six axes *are* `A6`. A zonohedron face takes
`pairColor` of the two axes spanning it, so:

* top and bottom of a cell span `{j, k}` — the rhomb's own roof color, already on screen
* a side wall spans `{m, vertical}` and `pairColor(m, 5) = m`, so a wall wears the color
  of the edge direction it stands on

Like touches like *necessarily*, not by arrangement: two rhombs share an edge along one
axis `m`, so both of their walls over that edge are spanned by `{m, vertical}` and both
take color `m`. Measured, no clashes anywhere:

| patch | cells | shared walls | clashes |
|---|---|---|---|
| Pe5 gen 2 | 25 | 40 | 0 |
| Pe3 gen 3 | 139 | 249 | 0 |
| Sun gen 3 | 2,440 | 4,715 | 0 |

And each cell wears exactly three colors, as on the triacontahedron — `pairColor(j,k)`,
`j`, `k` — distinct because a proper edge coloring of K₆ cannot give a pair the color of
an axis inside it. The `shrink` slider pulls each cell toward its own center so the walls
can be seen without disturbing the arrangement.

`tools/hexlayer.mjs` asserts all of it over five patches — one cell per rhomb, unit
edges, golden angles, both volumes against the Gram determinant, the side walls plumb,
the shadows distinct, and the floor exactly one unit below. Writing it turned up two
real bugs in the module: the edge vectors were being stored at half length, and the two
volumes were pasted constants rather than determinants of the actual edges.

**And the lower surface is the roof again.** Every cell's bottom face is its top face
moved down by exactly one unit, so the second Penrose surface is congruent to the first
and exactly parallel — the quasiperiodic sandwich panel of the source discussion, and
exact rather than approximate. The `floor` checkbox draws it.

*The wrong turn, recorded because it burned most of the work.* The written source
available here asks "which third edge vector is chosen for each cell", which reads as a
choice among the roof's own five generators. Taken that way it is a packing problem, and
greedy assignment settles at ~57% coverage, flat from generation 2 to 4 — a clean,
stable, entirely false answer. The passage that would have settled it, on stacking the
hexahedra, was in Jeff's original conversation but had not been carried into the file.
Either way the sixth axis had been sitting in `centers.ts` since chapter 2, and I should
have looked there before searching.

## 3. Open questions

*Two that stood here have been answered and are struck out rather than deleted, so the
record shows what was asked.*

1. ~~Are the short- and long-diagonal intersections named solids?~~ **No** — part 2. A
   3-polytope is a zonotope exactly when all its faces are centrally symmetric, and
   neither manages it: the long diagonal has eight triangular faces, the short has eight
   non-parallelogram quadrilaterals. Which is why neither volume has a closed form.
2. ~~Which reading is "5 × 2"?~~ **Ten and ten**, settled by Jeff — the acute 5 + 5
   seating split is a secondary observation with nothing named after it.
3. ~~Is a complete layer of hexahedra possible at all?~~ **Yes, and it is forced** —
   part 4. The third axis is the vertical, not a fourth roof generator; every rhomb
   hangs one cell straight down, thick→acute and thin→obtuse, the cells cannot overlap,
   and the floor is a congruent parallel copy of the roof. The question was only ever
   hard because it was posed as a choice.
4. **What is the material between the triacontahedra?** Chapter 2 found every rhomb
   belongs to two solids, one above and one below. Part 2 showed their intersections are
   not unions of cells — offset by a half-lattice step — so whatever fills the space
   between them is not simply the dissection.
5. **Do the packing's overlaps decompose into cells?** Chapter 3 found 4,645
   overlapping ball pairs. Part 2 says no for the four named offsets; whether some other
   decomposition works is untested.

## 4. Credit

The mathematics in §1 is classical. This project verified it; it did not discover it.

- **The zonohedron dissection theorem** — that a zonohedron on *n* generators falls
  into `C(n,3)` parallelepipeds, one per triple — is standard, and is the reason the
  RT's twenty cells and their 10/10 split are forced rather than found.
- **The rhombic triacontahedron's dissection into ten acute and ten obtuse golden
  rhombohedra** is long known and is documented with figures by **George Hart**,
  *Virtual Polyhedra*: <https://www.georgehart.com/virtual-polyhedra/dissection-rt.html>
- **Physical construction of the dissection**, which is where the cage and the nets
  should take their cues, at **orchidpalms.com**:
  <https://www.orchidpalms.com/polyhedra/rhombic/RTC-build/RTC-build.htm>
- **The Bilinski dodecahedron** is due to **Stanko Bilinski** (1960), who showed it to
  be a second rhombic dodecahedron distinct from Kepler's.
- **The two golden rhombohedra as the blocks of a three-dimensional Penrose tiling**
  are **Robert Ammann's**.
- **The Wieringa roof** is **R. M. A. Wieringa's**, by way of de Bruijn.

Both URLs are Jeff's references, cited as given; they have not been fetched or checked
by me.

What is this project's own, so far as I know, is the material in `TRIACONTAHEDRA.md`
§5 — the correspondence between complete caps and Pe5 tiles, the four proper classes,
the nail-head distinction, and chapter 3's contact statistics. The intersection result
in §1 above is elementary enough that it is probably also known; it is stated here as
verified rather than as new.
