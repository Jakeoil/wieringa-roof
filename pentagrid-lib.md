# `pentagrid` as a library — the consumer's side

pentagrid's `LIBRARY.md` is the plan. **This is the same question from here**: what
wieringa-roof can import today, what it is waiting for, and what it owes back. Kept
here because a consumer's complaints belong with the consumer; the supplier's roadmap
stays in its own repo.

Measured 2026-11-06 against the published site, not against a local checkout.

---

## 1. It is published, and it works

Every claim below was taken by fetching `https://jakeoil.github.io/pentagrid/…` and
running what came back.

| | |
|---|---|
| the site | **200**, 14.5 KB |
| `lib/grow.js` | **200**, 2.7 KB |
| the module graph behind it | **4 modules, 23.0 KB, every one 200** |
| bare specifiers in that graph | **none** — nothing for a consumer to import-map |
| typings | `lib/grow.d.ts` and all four `dist/geometry/*.d.ts` it re-exports: **200** |
| an outside consumer | imports it and runs — **16 names**, `makeDirections(5)` returns five directions |

The closure is `lib/grow.js` → `dist/geometry/{growth,roof,pentagrid}.js`. That is the
whole of it: four files, no dependencies, no build step on this side.

The sixteen names: `RISE`, `ROOF_EDGE`, `collectRhombs`, `crossingLerp`, `faceNormal`,
`flatLocal`, `generator`, `liftLocal`, `makeDirections`, `outlineCorner`,
`projectToScreen`, `registrationGain`, `standHeight`, `tileCorner`, `vertexHeight`,
`vertexIndex`.

---

## 2. The lift: agreed exactly, once the scale is applied

`LIBRARY.md` §3 calls the Wieringa lift *"independently derived and already agreed
numerically — the safest possible first merge."* Measured across the two repos, from
the published library against this project's own `dist`:

> **Scale this project's `E5` by `√5/2` and the two agree index for index, to
> `0.000e+0` over all five lifted generators.** Not nearly; exactly.

So there is one convention between them, and it is a scale:

| | pentagrid (`lib/grow.js`) | wieringa (`geometry.ts`) |
|---|---|---|
| edge length | `ROOF_EDGE = √5/2 = 1.118034` | **1**, with the scale applied at use |
| rise per edge | `RISE = 0.5` | `1/√5 = 0.447214` |

`0.447214 × √5/2 = 0.500000000000` exactly. Both projects already name that factor —
`ROOF_EDGE` here, `GOLDEN_SIDE` there, equal to the last bit at `1.118033988749895`.
§3 lists them as "same number, two names, two meanings documented", and the second
meaning is exactly this: one of them is the edge, the other is a scale applied to a
unit edge.

### The phase is a parameter, not a disagreement

The first version of this section reported the fans as differing by 18°, and called
that the interesting half of the merge. **That was wrong, and it was my own miscall.**
`makeDirections(verticalSymmetry, n)` takes a *boolean* first and I passed `5`, which
is truthy, so pentagrid obligingly returned its vertical-symmetry fan:

    verticalSymmetry = true   ->   18   90  162  234  306
    verticalSymmetry = false  ->    0   72  144  216  288
    wieringa E5               ->    0   72  144  216  288

Still worth knowing, as an integration note rather than a conflict: **pentagrid's fan
phase is a switch and this project's is not.** `E5` is fixed at 0° + 72k. A consumer
here must pass `verticalSymmetry = false`, and nothing in the type signature will say
so — see §4.

## 3. What wieringa-roof would actually use

In the order `LIBRARY.md` plans them, with this project's own reading of the value:

| entry | state | what it is worth here |
|---|---|---|
| `lib/grow.js` | **published** | the one thing this project cannot approximate: a patch that assembles out of its own crossings, and a flat-to-roof fold, as two numbers |
| `lib/panel.js` | planned, Stage 1 | `createFloatingPanel`, `createLoupe`, `LayerStack`. New capability, no mathematics to agree about — which is why it is the honest first consumer rather than the reticulum |
| `lib/roof.js` | planned, Stage 2 | the lift — see §2 before touching it |
| `lib/zono.js` | planned, Stage 2 | one zonohedron constructor instead of two. pentagrid's carries masks, cells and volumes; this project's returns `Face[]`, which is what a renderer wants. Both faces of one function |
| `lib/tiling.js`, `lib/gamma.js` | planned, Stage 2 | **not wanted here**, and `LIBRARY.md` says so: `NOTES.md` "Settled: no de Bruijn generator" — the exactly five-fold tilings are the *singular* pentagrids, so a generic γ cannot produce Sun or Star, and the Queen is not a pentagrid tiling at all |

**Nothing in this repo imports any of it yet.** Stage 1 has not started, so the
serving question — sibling checkout or Pages URL — is still undecided in practice, and
`npm run build` here has never type-checked against `lib/*.d.ts`.

---

## 4. Deficiencies, from here

1. **No consumer, so nothing is pinned from this side.** pentagrid's
   `tools/surface.test.mjs` guards the facade from within that repo. Nothing in
   wieringa-roof would notice if a published name vanished — there is no check here
   that fetches the library and imports it. That is the cheapest thing to add and it
   belongs here, not there.
2. **The entry point's contract is not legible from outside, and this is the sharpest
   finding here.** Two calls written from the published surface alone, two wrong:
   `generator(pg, j)` takes a pentagrid object first, and `makeDirections(verticalSymmetry, n)`
   takes a boolean first. The second did not throw — `5` is truthy, so it returned a
   perfectly good fan, the wrong one — and it produced a plausible 18° result that got
   as far as a committed document before the source was read. **A silently wrong answer
   from a library whose types are published is worse than a missing one.** The `.d.ts`
   only re-exports names, so a consumer never sees a signature; the header documents the
   *tile* contract thoroughly — `{j, k, x0, y0, vertices, kTuples}` — and no function's
   arguments. A one-line usage example per exported function would have caught both.
3. **The scale of §2 is undocumented on both sides.** Each repo's numbers are internally
   consistent and each header explains itself; neither says that the other is the same
   lift at `√5/2`. Nor does either mention that pentagrid's fan phase is a switch and
   this project's is fixed.
4. **Three of the four entries are unbuilt**, and the one that exists is the one with no
   duplicate to retire. Every merge in Stage 2 is still ahead.

---

## 5. What this project owes back

`LIBRARY.md` §4 is explicit that this is not a one-way export. Three things flow from
here, and none has moved:

- **`prefs.ts`'s build-id invalidation.** Settings saved by any other build are dropped
  whole, because field-by-field validation catches a value that changed type but not one
  whose *meaning* moved. pentagrid's `store`/`session` has the guards this lacks — a
  throwing accessor, quota, private windows — and not the invalidation.
- **`sheet.ts`'s paper model.** `PAGES`, `MM_PER_IN`, margins, a layout pure enough to
  run in a node tool. pentagrid has no paper at all and its PLAN §5.99 stops at SVG.
- **`palettes.yaml` → `src/palettes.ts`, generated.** pentagrid's PLAN §10 is tabled and
  unbuilt; this project already compiles a YAML palette file into typed TS. Importing it
  retires a tabled section instead of writing it twice.

Which means **this repo needs a `lib/` of its own** — §5's rule is that a facade
re-exports only its own repo's code, so peer facades and no center. Not started.

---

## 6. The duplicates, counted here

`LIBRARY.md` §3's inventory, re-measured on this side (2026-11-06). One correction:

| concept | here | note |
|---|---|---|
| `PHI` | **7 files** — `src/geometry.ts`, `src/solids.ts`, and five under `tools/` | §3 says two; that is `src/` only. Eight definitions of one number across the three repos is the undercount |
| `ICOSA_AXES` | `src/solids.ts:64` | pentagrid spells it `ICO_AXES` |
| `zonohedron(gens)` | `src/solids.ts:38` → `Face[]` | pentagrid's returns a rich object |
| `GOLDEN_SIDE` | `src/geometry.ts:9` = `√5/2` | equals pentagrid's `ROOF_EDGE` exactly — see §2 |

---

## 7. Where the two projects meet

Worth recording, because it is the same object approached from opposite ends.

pentagrid PLAN §8.2 is the spine — `π(C^k)`, one operation at every rung:
`K30 = π(C⁶)` the triacontahedron, **`F20 = π(C⁵)` the rhombic icosahedron**,
`B12 = π(C⁴)`, `A6`/`O6 = π(C³)`, and `π(C²)` the golden rhomb that is every face of all
of them.

`exceptional.html` here is that same `F20`, reached from the roof instead of the grid:
the exceptional singularity *is* `π(C⁵)` with its poles cut, and this project's
`EXCEPTIONAL.md` works out its ten readings, their factoring into a 5-state rotation
times a 2-state flip, and the decagon's ten views. pentagrid PLAN §8.1 states the
division plainly — *"wieringa-roof has the solids but not the grid"* — and pentagrid's
own `bc83fdf` (2026-11-06) now carries it one dimension up, with the icosahedral
hexagrid and `Σ v_j v_jᵀ = (n/d)I` measured at `2I`.

So `lib/zono.js` is not only a duplicate to retire. It is the seam where the two
halves of one subject would finally be written once.
