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
pull apart: explode slider, colour by acute/obtuse or one hue per cell or by axis, show
either family alone, faces on or off, auto-turn.

`src/dissect.ts` holds the dissection and `tools/dissect.mjs` checks it — twenty cells
one per triple, ten and ten, ratio φ, volumes summing to `4√(5+2√5)`, every corner
inside the solid, **no two cells overlapping**, and 93,809 sampled interior points each
in exactly one cell. The dissection is found by backtracking and the module says so
rather than pretending it is canonical: many dissections exist, this is one.

Exploding moves each cell along the direction of its own centre, so zero reassembles
exactly and full travel is the same arrangement magnified. Faces go translucent while
the cells are close, since assembled they share every internal face.

### Part 2 — the intersections found in `centers.html`

The offsets that actually occur in the packing, and what each shares. One is already
exact (§1); the other two are open:

| offset | \|t\| | shared | identified? |
|---|---|---|---|
| one axis `aᵢ` | 1.0000 | 50% | **yes — the rhombic icosahedron** |
| short diagonal | 1.0515 | ≈47% | no |
| long diagonal | 1.7013 | ≈22% | no |
| face contact | 2.7528 | 0% | — |

The question for this part: **are those intersections unions of whole cells?** If they
are, the packing of chapter 3 and the dissection of chapter 4 are the same
combinatorics twice, and that is the link Jeff is after.

### Part 3 — construction

The colouring workbench and the nets. Schemes for the triacontahedron and for the two
hexahedra — by cell type, by seating signature, by axis, by shell — printed at true size
through the existing `sheet.ts` machinery, which already knows how to put golden rhombi
on paper.

### Part 4 — the roof from hexahedra

A roof page built from the cells rather than from the surface. Jeff: *"well known.
nothing to do with RT's, but here's hoping."* The classical construction is that the
roof is the boundary of a layer of acute and obtuse rhombohedra, which is prior work;
what would be new is any link back to the triacontahedra, and there is no reason yet to
expect one.

## 3. Open questions

1. **Are the short- and long-diagonal intersections named solids?** The one-axis case
   is the rhombic icosahedron exactly. 47% and 22% do not match ½, ¼ or any obvious
   member of the family, so they are probably not zonohedra on a sub-family — but the
   test is cheap and has not been run.
2. **Which reading is "5 × 2"?** The acute ten split 5 + 5 by signature; the total is
   10 + 10. Settle before naming.
3. **Does the roof's layer of rhombohedra have a canonical thickness?** Chapter 2 found
   every rhomb belongs to two solids, one above and one below. The cells between them
   are what chapter 4 F would build from.
4. **Do the packing's overlaps decompose into cells?** Chapter 3 found 4,645
   overlapping ball pairs. If the corresponding RT intersections are unions of whole
   cells, the packing and the dissection are the same combinatorics twice.

---

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
