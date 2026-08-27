# The six P1 tiles, built solid

A plan, and its own project. The site's other work is in [PLAN.md](PLAN.md) and
[NOTES.md](NOTES.md); nothing here changes those pages except the coloring in Part 1.

## The target

Six physical models — `Pe5`, `Pe3`, `Pe1`, `St5`, `St3`, `St1` — each built as the
layer of golden hexahedra under its own patch. Three pentagons, a star, a boat and a
diamond: the complete P1 alphabet, in the hand, and **interlocking into a larger map**.

Generation 2 is the set to build.

| set | what | rhombi | slab faces | note |
|---|---|---|---|---|
| **gen 1, `Pe*` only** | 3 models | 5, 4, 3 | 20, 16, 12 | `St*` emit no rhombi at gen 1 — there is nothing to build |
| **gen 2, all six** | 6 models | 96 total | **286 total** | the interlocking set; a dozen sheets for the lot |
| gen 3, all six | 6 models | 732 total | 1846 total | one model at a time, at most |

Generation 3 was the first target and it is over-ambitious for a map: `St5` alone is
430 faces with 100 walls, and the six together are ten times the paper of the gen-2
set. The gen-3 numbers stay in this document because they are measured and because the
method does not change with size — but the project is gen 2, with gen 1 as the first
thing to cut out.

Why all six rather than the pentagons alone: from NOTES, *"Settled: `Pe*` are
pentagons"* — the `St*` tiles emit no rhombi at generation 1 and first contribute a
generation later, and **mapping the full P1 ↔ P3 correspondence needs the gen-3 rhombi
of `St*` as well as of `Pe*`.** In model terms, one generation lower: the gen-2 `St*`
are the first star, boat and diamond that exist as solids at all.

---

## Part 1 — Rhomb groups, and one list of schemes — **done**

**The name is "rhomb groups".** There are three of them — star, boat and diamond — and
that is what the controls now say. It also settles a naming collision that had been
sitting in the source: the *P1 tiles* `Pe5`, `Pe3`, `Pe1` are pentagons, while the
*rhomb groups* they emit are shaped like a star, a boat and a diamond. Two different
things; calling the coloring "rhomb groups" lets both keep their proper names.

The three palettes are the same scheme three times over, so they are named together:

| scheme | source | character |
|---|---|---|
| **Rhomb groups** | `GROUP_COLORS` | the screen strengths: pale blue-purple, yellow, tan |
| **Classic rhomb groups** | `CLASSIC_COLORS` | penrose-mosaic's own start-up colors, verbatim: blue, yellow, orange — the deep version of the palette above |
| **Plate rhomb groups** | `PLATE_COLORS` | sampled from `deca-shape-expansion.png`; meant to be used *with* the shading and isoglosses |

### What the harmonizing found

Five pages offered the roof's colorings and every one wrote its own `<option>` list.
Four labels covered two schemes — "Cluster", "Star / boat / diamond", "Mosaic classic",
"Mosaic plate" — and a reader moving between pages had no way to know which agreed.
Worse, the palettes themselves had drifted apart:

- **thick / thin** was `#9292e3` / `#eec09b` on paper and `0x8f8fdc` / `0xe2b184` on
  screen — the same bug the sheets were fixed for once already, still live between the
  flat pages and the three-dimensional ones.
- **height** was a four-color ramp in 3D against an eight-color wrapping palette on the
  canvas, although a vertex index is only ever 1, 2, 3 or 4.
- the **five** were declared three times, and `roof3d.ts` kept a fourth private copy.

`FILL_MODES` in `geometry.ts` is now the one list, `tileFill` the one flat answer, and
`roofFill` in `roofview.ts` the same answer as a `THREE.Color`, derived from the same
strings. `src/schemes.ts` fills a `<select>` from the list, so a scheme added once
appears on every page at once. A page with colorings of its own — Centers colors by
proper class — answers those first and delegates the rest.

### Which schemes a tile set can actually wear

A physical tile is one piece of card. If a scheme's pattern changes when the tile is
turned or turned over, you need one piece per variant. Counting distinct pieces among
the generation-1 tiles of `Sun` gen 4 and `Deca` gen 5 (thousands of each type):

| scheme | Pe5 | Pe3 | Pe1 |
|---|---|---|---|
| Kowalewski five — flat drawing | 1 | **5** | **5** |
| Kowalewski five — with heights | 2 | **10** | **10** |
| rhomb groups | 1 | 1 | 1 |
| tinted rhomb groups | 1 | 1 | 1 |

**The Kowalewski five cannot color a tile set.** It is a coloring of the six axes, so
turning a tile permutes it. Jake met this in penrose-mosaic and had to cut five of each
— that is the flat row, and it reproduces exactly. In three dimensions it doubles: a
180° turn about the vertical preserves the flat five-coloring but **inverts the lift**,
because the five generators sit 72° apart while the planar edge directions sit 36°
apart, so a half turn maps each direction to its own negative and every height with it.
Turning the tile over does not merge them back, since a mirrored five-coloring is not a
rotation of any five-coloring.

**The group schemes are the ones that survive.** A rhomb's group is which generation-1
pentagon it came from, which no isometry can change, so the pattern travels with the
tile: one piece per type, either way up.

### Tinted rhomb groups

The groups are not three kinds of rhomb — a boat is three thick and one thin, a diamond
one thick and two thin — so a flat group color hides which rhombus you are looking at.
`tintThin` carries each group's thin rhomb to the same hue and saturation at a lower
lightness, deeper rather than muddier:

| group | thick | thin |
|---|---|---|
| star `Pe5` | `#9292e3` | — |
| boat `Pe3` | `#e6e68e` | `#d6d645` |
| diamond `Pe1` | `#eec09b` | `#e08d4a` |

**The star group has no thin rhomb** and never will: `Pe5` emits five thick and
nothing else, so no rhomb in that group is ever thin. The scheme is five colors, not
six. (The other two are exact by construction — `Pe3` is 3:1 thick to thin and `Pe1` is
1:2, on every patch.)

### The rim as a matching rule

The top and the floor of a slab are spoken for — they carry the surface. The **rim** is
free, and it is exactly where a matching rule can live. A wall spans one lifting axis
`E_m` and the vertical, and `pairColor(m, 5) = m`, so **a wall's Kowalewski color is
its own axis** — the one place the five-coloring is a plain fact about the edge rather
than an orientation-dependent scheme.

That gives two marks, and between them they pin down the two things a builder can get
wrong:

- **the axis** — five colors — says how the tile is **turned**;
- **the rise**, which end of the wall's top edge is high, says **which way up** it is,
  since turning the tile over inverts every height.

Both are sound by construction: two tiles abutting on a shared edge see the same edge,
so a correct placement always agrees. Whether agreement everywhere *forces* a correct
placement is not proved and is worth testing.

Visible now on `hexroof.html` under **Rim**: *Same as cell* (the default, and the
expectation — a group color runs over the top, the floor and the walls alike), *By
axis*, and *By axis + rise*.

**One deliberate exception**, recorded where it lives: the favicon designer keeps its
own deeper group colors. A favicon is read at 16 px against browser chrome of unknown
color, and the page strengths — chosen to be shaded over and crossed by isoglosses —
go to mush at that size.

## Part 2 — What a slab is

The layer is a **prism**. Every cell hangs straight down, so the whole solid is the
roof surface swept one unit along `e_z`:

> **slab** = { (x, y, z) : (x, y) in the patch, h(x,y) − s ≤ z ≤ h(x,y) }

**The boundary is a sphere of golden rhombi, and nothing else.** Top and floor are `F`
rhombi each; the rim is one vertical rhomb per boundary edge. A wall is spanned by
`E_m` and `e_z`, and `E_m · e_z = 1/√5` like every other pair among the six axes — so
a wall is the *same golden rhombus* as every roof face. **One cut shape for the entire
model**, walls included.

**No new fold angle and no new gauge.** Computed exactly:

| crease | dihedral | fold |
|---|---|---|
| roof \| roof | 144°, 108°, 72° | 36°, 72°, 108° |
| roof \| wall (along a rim edge) | **108° or 144°** | 72° or 36° |
| wall \| wall (along a vertical edge) | 72°, 144°, 216°, 288° | 108°, 36°, and the same two folded outward |

The union of fold magnitudes is **{36°, 72°, 108°}** — the roof's own set, unchanged.
The three gauge notches already specified on `tools.html` (144° / 108° / 72°) measure
every crease in the model, the reflex ones from the outside.

### Heads and tails

The floor is a *translate* of the roof, so as a surface it is the same surface, with
the same colors on the same cells — a hexahedron's top and bottom faces carry the same
`pairColor(j,k)`. It does not follow that the two pieces are one drawing printed twice.

**The coloring lives on the outside of the solid.** The roof's outside faces up; the
floor's outside faces *down*. So the floor's sheet is the surface **seen from below**,
and that is a mirror:

- **hills and dales exchange** — a ridge seen from underneath is a trough;
- **mountain and valley exchange** with them;
- **the drawing is reflected**, and a reflection permutes the five axes.

The last one is the reason the two sheets cannot be shared. Colorings that depend only
on the rhomb — rhomb groups, thick/thin, height index — survive the patch's own mirror
and will look alike on both sides. **The Kowalewski five will not**: it is a coloring
of the six axes, a mirror sends axis `j` to `−j`, and the five-coloring is not
invariant under that permutation. There is no re-labeling of the palette that recovers
it.

So: **heads and tails, rendered separately.** Two sheets, mirror images, clearly
labeled so they cannot be swapped at the bench. The vocabulary and the controls for
this already exist — the parity radio, and Sheets' **Back side**, which NOTES records
as turning over *both* halves: `dales` carries the height, `backside` the folds. The
slab needs exactly that, applied to a whole second sheet rather than as an option on
the first.

### Measured

`V`, `E`, `F` are of the roof patch; the slab's counts follow. Heads parity.

| seed | gen | rhombi | thick/thin | V | E int | **walls** | slab faces | collar |
|---|---|---|---|---|---|---|---|---|
| Pe5 | 1 | 5 | 5/0 | 11 | 5 | 10 | 20 | 8.9 s |
| Pe3 | 1 | 4 | 3/1 | 9 | 4 | 8 | 16 | 7.2 s |
| Pe1 | 1 | 3 | 1/2 | 7 | 3 | 6 | 12 | 5.4 s |
| **Pe5** | **2** | 25 | 20/5 | 36 | 40 | 20 | 70 | 17.9 s |
| **Pe3** | **2** | 23 | 16/7 | 33 | 37 | 18 | 64 | 16.1 s |
| **Pe1** | **2** | 21 | 12/9 | 30 | 34 | 16 | 58 | 14.3 s |
| **St5** | **2** | 15 | 5/10 | 26 | 20 | 20 | 50 | 17.9 s |
| **St3** | **2** | 9 | 3/6 | 17 | 11 | 14 | 32 | 12.5 s |
| **St1** | **2** | 3 | 1/2 | 7 | 3 | 6 | 12 | 5.4 s |
| Pe5 | 3 | 140 | 100/40 | 171 | 250 | 60 | 340 | 53.7 s |
| Pe3 | 3 | 139 | 93/46 | 169 | 249 | 58 | 336 | 51.9 s |
| Pe1 | 3 | 138 | 86/52 | 167 | 248 | 56 | 332 | 50.1 s |
| St5 | 3 | 165 | 80/85 | 216 | 280 | 100 | 430 | 89.4 s |
| St3 | 3 | 105 | 50/55 | 141 | 175 | 70 | 280 | 62.6 s |
| St1 | 3 | 45 | 20/25 | 65 | 71 | 38 | 128 | 34.0 s |

Four facts fell out, each load-bearing:

- **Every patch boundary is a simple closed curve.** One loop, no pinch vertices, on
  all fifteen. The rim is a single ring — no islands, no figure-eights, no case
  analysis.
- **Euler = 1 on the patch**, so each is a disc and the slab boundary closes to a
  sphere: `2V − (2E + B) + (2F + B) = 2` exactly.
- **The rim spans a single height step** — 1..2 or 2..3 — at *every* generation
  measured. The collar's zigzag is therefore one step, `s/√5`, and its band height is
  exactly `(1 + 1/√5) s = 1.4472 s`, 36.8 mm at a 1 in side. Measured, not proved.
- **The bays are a gen-3 problem.** Boundary interior angles are always a multiple of
  72°, and the 288° notches are the bays a finger cannot enter:

| | Pe5 | Pe3 | Pe1 | St5 | St3 | St1 |
|---|---|---|---|---|---|---|
| 288° notches, gen 2 | **0** | **0** | **0** | 5 | 2 | **0** |
| 288° notches, gen 3 | 5 | 6 | 7 | 25 | 16 | 8 |

At generation 2 the three pentagons have no notch at all and the star family has
seven between them. Most of Part 4's cleverness is not needed at the size we are
building — which is a good reason to build that size.

---

## Part 3 — The distribution

Jake's question, and the answer is exact. The substitution matrix, counted directly —
row is the parent, column the gen-1 children inside one gen-2 tile:

| parent | Pe5 | Pe3 | Pe1 | St5 | St3 | St1 | total |
|---|---|---|---|---|---|---|---|
| Pe5 | 1 | 5 | 0 | 0 | 0 | 0 | 6 |
| Pe3 | 1 | 3 | 2 | 0 | 0 | 1 | 7 |
| Pe1 | 1 | 1 | 4 | 0 | 0 | 2 | 8 |
| St5 | 0 | 0 | 5 | 1 | 5 | 0 | 11 |
| St3 | 0 | 0 | 3 | 1 | 3 | 0 | 7 |
| St1 | 0 | 0 | 1 | 1 | 1 | 0 | 3 |

Its Perron eigenvalue is **φ⁴ = 6.854102** — tile count multiplies by φ⁴ per
generation, so the linear scale factor is φ². The eigenvector gives the limiting
frequencies, and every one of them is a power of φ:

| tile | frequency | closed form |
|---|---|---|
| `Pe1` diamond-group pentagon | **38.1966%** | φ⁻² |
| `Pe3` boat-group pentagon | **23.6068%** | φ⁻³ |
| `Pe5` star-group pentagon | **10.5573%** | φ⁻³/√5 |
| `St1` diamond | **14.5898%** | φ⁻⁴ |
| `St3` boat | **9.0170%** | φ⁻⁵ |
| `St5` star | **4.0325%** | φ⁻⁵/√5 |

Three relations hold exactly, and they are prettier than the percentages:

- **Each pentagon is φ² times as common as its star-family partner** —
  `Pe5:St5 = Pe3:St3 = Pe1:St1 = φ²`, all three.
- **Both families have the same internal ratio, `1 : √5 : √5 φ`** — for `Pe5:Pe3:Pe1`
  and for `St5:St3:St1` alike.
- **Pentagons are 72.3607% of all tiles** (= φ/√5), the star family 27.6393%
  (= 1/(φ√5)). Their ratio is again φ².

### Rhomb groups

A pentagon emits its group and the star family emits nothing: `Pe5` → 5 thick, `Pe3` →
3 thick + 1 thin, `Pe1` → 1 thick + 2 thin. Weighting the frequencies by those counts:

| rhomb group | share of all rhombi | closed form |
|---|---|---|
| star (from `Pe5`) | **20.1626%** | √5 / φ⁵ |
| boat (from `Pe3`) | **36.0680%** | 4 / φ⁵ |
| diamond (from `Pe1`) | **43.7694%** | 3φ / φ⁵ |

so **star : boat : diamond = √5 : 4 : 3φ**, and the three add to φ⁵ = 11.090170.
The average P1 tile carries **φ² = 2.618034 rhombi**.

The same weighting gives thick = φ and thin = 1 — **thick : thin = φ exactly**, which
is the check that the eigenvector is right, since that ratio was known independently.

**A finite patch will not show these numbers.** Convergence is slow and
boundary-dominated: `Pe5` at generation 6 has 12,161 tiles and still reads `St3` at
6.25% against the limiting 9.02%. Verify against the eigenvector, never against a
patch.

---

## Part 4 — Three documents, not one net

**Recommendation: do not unfold the slab as a closed surface.** Record the reason,
because the temptation is real and the mathematics is inviting.

The branch-cut argument generalizes cleanly. On the roof, a disc, `E_int = V_int + F −
1` and the cut set is a spanning tree of the vertex graph with the boundary contracted
to a point. On a sphere, `V − E + F = 2` gives `E = (F − 1) + (V − 1)` — hinges `F −
1`, cuts `V − 1`, and the cut set is a spanning tree of the **whole** vertex graph with
no contraction at all. `src/cuttree.ts` would need the contraction step dropped and
nothing else structural.

It is still the wrong thing to build. A one-piece net of a closed slab puts its seams
wherever the search likes, and a human has to close a cavity `s` deep along them. The
seams a builder wants are the two he would choose himself: **the top rim and the
bottom rim.** So the model is three documents:

| piece | what | how it is produced |
|---|---|---|
| **heads** | the patch's `F` rhombi, seen from above | the existing pipeline, unchanged |
| **tails** | the same `F` rhombi, seen from below | the same pipeline, mirrored — Part 2 |
| **collar** | `B` walls in rim order | new, and trivial |

**The collar needs no search.** Every crease in it is vertical, so the collar is a
genuine generalized cylinder and unrolls to a straight band with a guarantee of no
overlap at any length — the retired ribbon-strip theorem, which finally has the case it
was made for. Each wall advances the strip by `2/√5 = 0.894 s` and steps up or down by
`1/√5`. Nothing to optimize: lay it out, cut it at sheet width, letter the cuts with
the existing join machinery. At gen 2 every collar is 5.4–17.9 s long — a single strip,
one sheet, for any of the six.

---

## Part 5 — Getting a human to tape it together

**The governing constraint: once the tails piece is on, the cavity is closed.** It is
`s` deep and no hand goes in. Every join must be either reachable from outside the
finished model, or made before the last piece goes on.

### Assembly order

1. **Fold heads.** Alone, both hands free. The hard and interesting part, first.
2. **Fold tails.** The mirror sheet, folded the same way its own creases say.
3. **Fold the collar.** All creases parallel; one pass with a scoring comb.
4. **Tape the collar to heads**, working round the rim with the piece upside down on
   the bench. Every one of these joins is made into an open bowl and is reachable.
5. **Close with tails.** The one operation that cannot be inspected.

### The closure

Three ways to make step 5 human, in increasing order of cleverness:

- **Outside tape.** The collar's bottom edge butts the tails rim, and matte tape covers
  the seam from outside. Honest, reliable, visible — and impossible inside a bay.
- **A glue ledge.** Tabs on the collar's bottom edge fold inward; glue them, drop the
  piece on, press. Invisible and strong, but blind, and you get one attempt.
- **Tab through slit — recommended.** Give each tab a slit in the tails piece to pass
  through, just inside the corresponding rim edge, and fold it flat against the
  outside. **This converts an interior join into an exterior one**: you can see it,
  reach it, correct it, and it holds mechanically before any adhesive. The slits fall
  along tiling edges the sheet already prints, so they add no new line to the drawing.

Two aids that cost nothing and decide whether the thing is buildable:

- **Number the ring.** Boundary edges 1…B, printed three times: on the heads rim edge,
  on the collar's top edge, on the tails rim edge. Every face in this model is the same
  rhombus; without numbers there is nothing to align against, and a one-step slip is
  invisible until the ring fails to close.
- **Mark up, and mark which sheet is which.** An arrow on every wall — the collar band
  is 1.4472 s tall with a single-step zigzag, so it is nearly symmetric and will go on
  upside down at least once. And heads and tails are mirror images of each other, which
  is exactly the kind of pair that gets swapped at the bench.

### The bays

Where the rim turns through 288° the roof and the collar meet in a 72° slot that no
tape reaches. **At generation 2 the pentagons have none of these and the star family
has seven in total**, so this is a small, local problem at the size being built — but
it is worth solving properly because gen 3 is made of it.

**Hinge the bay walls, strip the rest.** A wall need not live on the collar; it can
hang off the heads net as a fold-down flap along its own rim edge, arriving already
attached. Run each bay's walls as a *contiguous chain* hinged at one end — the chain is
itself a straight strip, so it costs nothing to draw, and it folds into the bay from a
piece that is still open and flat.

The limit is angular and known in advance: at a boundary vertex of developed interior
angle 288°, only 72° of free plane remains, so **two flaps cannot both hang at a reflex
corner** — hence a chain hinged at one end, not a flap per edge. The chain still has to
be overlap-tested against the rest of the net, with machinery `unfold.ts` already has.

So the wall policy is a per-wall choice of three homes — *collar strip*, *hinged to
heads*, *hinged to tails* — hinging every wall a human cannot otherwise reach and
leaving the rest on one strip. That is the one real search in this project, and at
gen 2 it can be skipped entirely for the pentagons.

### Supports

Two paper surfaces `s` apart, joined only at the rim, will not hold their separation
across a long span. At gen 2 the spans are short and the rim may well be enough —
**build one before drawing any support**. If they are needed:

- Any set of walls standing on a **connected path of tiling edges** unrolls to a
  straight strip, exactly like the collar. Interior bulkheads are as free to draw as
  the rim is.
- A bulkhead cannot generally be hinged along its top edge, because that edge is a
  bent path in the net and a strip hinged along a bent path is not one piece.
- **But a single wall can hang off a cut.** The net's cuts open into the angular-defect
  wedges — real empty plane in the middle of the sheet. A support panel hinged along a
  cut edge folds down to exactly where the surface is weakest, arrives attached, and
  needs only a bottom tab. *This is the idea to try first.*

---

## Part 6 — What changes in the workbench

The workbench is the master document today: patch, method, one net, then split. The
slab is a second kind of document over the same patch, and most of the pipeline is
reused untouched.

**New — `src/slab.ts`.** Takes the current patch plus `hexLayer()` and emits the slab
boundary as roles rather than an anonymous face list: `top[]`, `floor[]`, `wall[]` in
rim order, the rim ring as an ordered cycle of boundary edges with their numbers, and
each wall's two dihedrals. Pure geometry, no layout. Everything in Part 2 is checkable
here.

**New — the collar layout.** A few dozen lines: walk the ring, advance `2/√5`, step
`±1/√5`, emit a strip.

**Reused unchanged.** `cuttree.ts` for the net. `paginate.ts` for splitting it —
including tab shapes, letters, the locator mini and the Map, all of which apply to the
collar strip as-is once it is a `Placed` map. `sheet.ts` for the SVG at true size.

**Extended.**

- **Mirrored rendering, as a first-class output rather than a checkbox.** Sheets'
  *Back side* already turns over both the height and the fold halves; the slab needs it
  to produce a *second sheet* alongside the first, with the Kowalewski five re-derived
  rather than re-labeled.
- `unfold.ts` gains flap placement: hang a chain of faces off a named edge of an
  existing piece and overlap-test it. Bay chains and cut-hung supports are one
  operation.
- `paginate.ts` gains **slits** as a drawn primitive and **rim numbers** as a label
  kind.
- One shared rim numbering, computed in `slab.ts`, printed on all three documents.

**UI.** A **Slab** mode on `unfold.html` beside the method selector, and when it is on:
a wall-policy control (*all on the strip* / *hinge the bays* / *hinge what fits*), a
closure control (*outside tape* / *glue ledge* / *tab and slit*), and a support count.
Print-all produces heads, tails, collar, supports and the Map, in build order.

**Verification — `tools/slab.mjs`,** in the style of `tools/hexlayer.mjs`: one wall per
boundary edge; the rim is a single cycle; `2V − (2E + B) + (2F + B) = 2`; every face
congruent to the golden rhombus to 1e-9; the fold set is exactly {36°, 72°, 108°}; the
collar strip has zero overlaps and its ends meet; the tails net is congruent to the
heads net by *reflection*, not translation. All six seeds, generations 1 through 3.

---

## Part 7 — Paper

At the standard 1 in side the existing pagination puts roughly 28 rhombi on a sheet.
For the gen-2 set of six — 286 faces in total:

| model | heads + tails | collar | sheets |
|---|---|---|---|
| Pe5 | 50 | 20 | ~3 |
| Pe3 | 46 | 18 | ~3 |
| Pe1 | 42 | 16 | ~2 |
| St5 | 30 | 20 | ~2 |
| St3 | 18 | 14 | ~2 |
| St1 | 6 | 6 | 1 |
| | | | **~13 sheets for all six** |

Add the three gen-1 pentagons for two more. That is a weekend, not a campaign — which
is the point of downsizing. The gen-3 set, for contrast, is roughly 70 sheets.

**Stay at 1 in for gen 2.** The models are small enough that shrinking buys little, and
`tools.html` puts the floor at about 12 mm side, below which a 72° crease has nothing
to grip. `St1` gen 2 is three cells; at 1 in it is barely 2½ inches across.

---

## Open, and worth settling before building

1. **Do the six interlock?** This is now the point of the set, not a curiosity.
   Adjacent P1 tiles share an edge, so their rhomb patches should abut wall to wall and
   height to height. Two things are unverified: whether the parity and index offsets
   agree across a shared edge, and how the gaps behave, since the star-family tiles at
   the bottom level emit no rhombi and leave holes in the assembled map. **There is a
   ready-made test**: the composite seeds. `Sun` is one `Pe5` ringed by five `Pe3` and
   `Star` is five `Pe1` ringed by five `Pe3` — generate those at gen 2 and check that
   their rhombi are exactly the union of the separately-generated pieces, correctly
   placed. If that holds, the models interlock.
2. **Double walls where models meet.** If they interlock, two abutting models put two
   thicknesses of paper between them. Accept it, or key them with alternating tab and
   slot on the collar.
3. **Is the rim always one height step?** True at every generation measured. If it is
   general, the collar band height is a constant of the construction and belongs on the
   page.
4. **Are supports needed at all at gen 2?** Only building one answers it.
5. **Settled: the gen-2 star family is one color under rhomb groups.** `St5`, `St3` and
   `St1` at generation 2 are *entirely* diamond group — 15, 9 and 3 rhombi, all `Pe1`.
   The scheme says nothing on exactly the three models it might have been most wanted
   on, and only comes alive a generation later (`St1` gen 3 is 36 diamond, 5 star, 4
   boat). Nothing to fix — but for the star family at gen 2, color by Kowalewski five
   or by height instead.

---

## Tasks, in order

**A. Rhomb groups** — **done**
1. ~~One shared scheme list across the five pages that offer one.~~
2. ~~`cluster` renamed to `group` throughout; the palettes renamed with it.~~
3. ~~Page checks and the tool suite.~~

**B. The geometry** *(nothing visible ships)*
4. `src/slab.ts` — roles, rim ring, rim numbering, dihedrals.
5. `tools/slab.mjs` — the checks in Part 6, all six seeds, generations 1–3.
6. Settle open question 1 with the `Sun` / `Star` composite test. It decides whether
   the set is a map or six ornaments.

**C. Build the smallest thing that exists**
7. `Pe1` at generation 1: three cells, twelve faces, one sheet. Heads, tails, collar,
   outside tape. Everything in Parts 4 and 5 is tested by it in an afternoon.

**D. The collar and the sheets**
8. Strip layout, paginated with the existing join machinery.
9. Mirrored tails rendering as a second sheet.
10. Rim numbering on all three documents.

**E. Assembly refinements** *(only what the first build proves necessary)*
11. Slits and tabs in `paginate.ts`; the closure control.
12. Flap placement in `unfold.ts`; bay chains, for the gen-2 star family.
13. Cut-hung support panels.

**F. The set, and the page**
14. All six at generation 2.
15. A chapter-5 page, or an extension of `hexroof.html`, carrying Part 2's mathematics
    and the print buttons.
