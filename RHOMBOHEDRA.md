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

### A 5 + 5 split inside the acute ten

Sorting the cells by the signs of their three mutual dot products:

```
obtuse   one negative dot     10 cells
acute    two negative dots     5 cells
acute    no negative dots      5 cells
```

The ten acute cells fall into **two fives**, distinguished by orientation signature
rather than by shape — they are congruent, but they sit in the solid two different
ways. *(Jeff wrote "5 × 2 rhombihexahedra"; this 5-and-5 is the only natural such
split I can find, and the total is 10 + 10 = 20. Worth settling which reading was
meant before the page names anything.)*

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

## 2. What to build, in order

**A.** `src/rhombohedra.ts` — the dissection as data, with `tools/rhombohedra.mjs`
checking it: 20 cells, volumes summing to the RT's, the 10/10 split, the 5/5 signature
split, and cells that tile the solid without gap or overlap. No page until that passes,
as with chapters 2 and 3.

**B.** **The cage.** A 3D triacontahedron showing the dissection as a wireframe of the
twenty cells — Jeff: *"That shape alone is worth the price of admission."* Reuses
`createRoofView` and `solids.ts`.

**C.** **The exploding diagram.** One slider moving the twenty cells out along their
own centroid directions, from assembled to fully separated. The same control shows the
nested family if it drives axis count instead — 6 axes to 5 to 4 — which is worth
trying as a second mode.

**D.** **The workbench.** Coloring schemes for the RT and the rhombohedra: by cell type
(acute/obtuse), by the 5/5 signature, by which axes a cell uses, by shell. The schemes
are the point — they are what the nets are printed from.

**E.** **Nets.** For the RT and for each rhombohedron, per coloring scheme, printed at
true size through the existing `sheet.ts` machinery. Chapter 1 already knows how to put
golden rhombi on paper.

**F.** **The roof from rhombohedra** — the eventual chapter page. The roof is the
boundary of a layer of these cells, and this is where that becomes constructible rather
than asserted.

---

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
