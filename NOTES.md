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

## Open: the rhombus side, and units

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

**Decided: 1 inch.** Round, and the workbench stays inch-native as it was designed
to be. The box still accepts mm, cm or in, and is labelled so.

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

---

## Known and deliberate

- **Gen 5 is on the 3D page but not Net.** The unfolding methods take 1.2–2.5 s at
  5,719 rhombi against 48–76 ms at gen 4.
- **`Pe5` closes the loop exactly; `Pe3` and `Pe1` do not.** Pe5's hull is a regular
  pentagon at every generation (support-function differences ~1e-16, ratio
  1.236068 = 1/cos 36°). The other two converge to limits 0.16 and 0.21 away from
  their seeds. Why the pentagon and not the others is genuinely open.
- **Canvas pixels are not CSS pixels.** Both canvases size at `devicePixelRatio`;
  every hit test must scale by `canvas.width / rect.width`. This bit once and is
  invisible at dpr 1.

---

## Testing reality

Everything is verified numerically and by loading pages. Interaction is barely
tested in a browser. The least-exercised parts, in order: the transport controls,
the two canvas hit-tests, and printing.
