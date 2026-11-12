# Issues to file against `pentagrid`

**The special place.** Jake: *"report problems in pentagrid library in a special place so
I can coordinate a fix for that project."* Each entry below is written to be filed as
is: where it is, what happens, and what would fix it. Nothing here is a wieringa-roof
problem — those live in `EXCEPTIONAL.md` and `pentagrid-lib.md` — and nothing here has
been changed in the sibling checkout.

The companion document is `pentagrid-lib.md`, which is the consumer's *view* of the
library: what it offers, what it costs, what flows back. This file is only the defect
list.

Status: **open** unless marked otherwise.
Last swept: 2026-11-12, against the sibling checkout at `../pentagrid`.

---

## P1 · `makeDirections(verticalSymmetry, n)` takes a boolean first, and a number is truthy

`src/geometry/pentagrid.ts`

```ts
export function makeDirections(verticalSymmetry: boolean, n: number = NUM_GRIDS): Vec2[]
```

A consumer writing `makeDirections(5)` — the natural guess from the published `.d.ts`,
which re-exports names without signatures — gets the **vertical-symmetry fan at n = 5**
rather than an error. The result is a perfectly good set of five directions, rotated 18°
from the one asked for, so nothing throws and nothing looks wrong.

**It cost a wrong published conclusion in this project.** The claim "the two projects'
lifts differ by 18°" was measured, written up and committed before the source was read;
with `false` the lifts agree index-for-index to 0.000e+0 after the `√5/2` scale.

Fix, cheapest first:

1. `makeDirections(n: number, opts?: { vertical?: boolean })` — the dimension first, as
   every other function in the module takes it, and the flag named at the call site.
2. Failing that, `if (typeof verticalSymmetry === "number") throw` — ugly, but it turns
   a silently wrong answer into a loud one.
3. At minimum, a one-line usage example in the doc comment. The module's header
   documents the *tile* contract thoroughly and no function's arguments.

Same shape, lower stakes: `generator(pg, j)` takes the pentagrid object first, which is
the other call this project got wrong on the first try. See `pentagrid-lib.md` §4.2.

---

## P2 · Two different things are called `K`

`src/geometry/resolve.ts`, `src/geometry/pentagrid.ts`

The library uses `K` for both:

* **de Bruijn's index function**, `K_j(x) = ⌈x·v_j + γ_j⌉`, which is the whole
  construction and is cited that way in the literature; and
* the **prefix on the angle code**, as in `describeResolution`'s
  `"K122 thick hexagon · 2 thick + 1 thin"`.

The second is the library's *own* naming — `angleCode` builds it from the gaps between
generator directions modulo a half turn, in units of 180/n — but the `K` reads like a
citation, and alongde de Bruijn's genuine `K` it reads like *his* citation. Jake went
looking for "de Bruijn's K122" in de Bruijn and in Schwartz's notes and could not find
it, which is the correct outcome of looking.

This is only a documentation fix, and a sentence does it: say at `AngleCode` that the
code is this project's own shape name and that the `K` is not de Bruijn's `K_j`. A
different prefix (`A122`, or none) would end it outright.

**Related, and worth knowing: the library is RIGHT about which hexagon is which.**
`FAMILIAR` has `122 → thick hexagon`, `113 → thin hexagon`; `hunt.ts`'s presets `1 thick`
(γ = `[0,0,0,10,10]`) and `1 thin` (γ = `[0,0,10,0,10]`) resolve to the K122 and the K113
respectively; and the angles in `hunt.ts`'s note, `144/144/72` against `144/108/108`,
are the thin and the thick in that order. All correct, checked from the γ up in
`tools/probes/canon.mjs`. **No fix needed, and that is the finding** — the disagreement
reported from this side in `EXCEPTIONAL.md` §7.4g was this project reading the code off
the *index* gaps mod 5 instead of the direction gaps mod 180°, which gives the opposite
answer. Corrected in §7.4h.

---

## P3 · No consumer pins the published surface

Nothing outside the pentagrid repo imports the library in a check, so a published name
can vanish without any consumer noticing until a page goes blank.

This one is **owed from this side**, not that one — `pentagrid-lib.md` §4.1 says so, and
the fix belongs in wieringa-roof's `tools/`: fetch the published `lib/grow.js` and import
it, as `tools/vendor-pentagrid.mjs` already knows how to do. Listed here so the two lists
do not drift.

---

## Checked and found sound

Written down so the same ground is not swept twice.

* **`hunt.ts`'s exact singularity rule.** `γ_L` integral and `γ_P + γ_Q` integral, over
  rational phases with an explicit denominator. The rational-only assumption is stated in
  the header, the 4-fold-swallowed-by-5-fold argument is written out, and
  `tools/probes/canon.mjs` reproduces the preset-to-hexagon mapping from the γ.
* **`makeDirections`'s geometry** (as distinct from its signature): `angle = 2πj/n`, so
  the index counts counter-clockwise, and `+π/2` under vertical symmetry, so generator 0
  points straight up. Both as documented.
* **The thick/thin hexagon naming** — see P2.
