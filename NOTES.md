# Working notes

Running record of decisions, findings and open questions. `PLAN.md` describes what
the project *is*; this is what we have argued about and what is still unsettled.

---

## Naming and vocabulary

**Penrose vertex figures.** Conway named the seven vertex figures of the P2
(kite-and-dart) tiling. The usual list:

> sun · star · ace · deuce · jack · queen · king

Only **sun** and **star** have five-fold symmetry — there is no third. That is the
same fact as "exactly two Penrose tilings have global five-fold symmetry". The card
ranks belong to this one list, not to a separate scheme. (The ace is sometimes
called the *fool's kite*; naming varies slightly between sources.)

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

**Agreed direction.**

- Shading becomes a function of **absolute height**, not a per-tile ramp.
- Four levels is the floor; the isogloss subdivision (quarter-index, eight steps
  across a face) is the natural continuous version and matches the 3D page.
- **Color** and **shading** separate cleanly: color is a constant property of a
  tile (cluster, thick/thin, index band); shading is a yes/no depiction of height.
- **One** heads/tails control, flipping the surface — shading follows from it.

Still to settle: whether shading is stepped into four bands or ramped continuously
with the isogloss contours drawn over it.

---

## Open: is `Pe5` a star or a pentagon?

The tables on `info.html` and `PLAN.md` call `Pe5` the **star**. But
`penrose-mosaic/penrose.js` names the same constant `BLUE_PENTA`, and the
measurement above says its convex hull is a **regular pentagon** at every
generation, exactly. Meanwhile `St5` is `BLUE_STAR` there.

So the P1-tile column may be mislabelled: the `Pe*` family look like the pentagons
and the `St*` family the star/boat/diamond. The rhomb counts (5 thick / 3 thick +
1 thin / 1 thick + 2 thin) are confirmed from `emitRhombs` and are not in doubt —
only what to *call* them. Worth settling, because it appears in three places and
the hull result now argues for one reading.

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

Recommendation: **A**, with the box continuing to accept mm/cm/in. The two pages
disagreeing on default size is the only real problem here, and √5/2 inches is a
coincidence rather than a reason.

---

## Open: Type is disabled during Watch

`setMode("watch")` sets `pointerEvents: none` on the whole control bar, which
includes Type, Generation, Color and Side. Only Clear, Undo and Print are
build-specific. Fix: disable those three, leave the rest live, so you can change
patch and generation while watching.

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

Recommendation: give Unfold *print all pieces across sheets* so it is
self-sufficient, then decide whether Net still earns its keep. That is a small step
— `printNet` already groups pieces and calls `layoutSheets`. Deferred, not decided.

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
