// Emit sheets.html — the printable nets, at true size, ready to cut.
//
//   node tools/make-sheets.mjs
//
// Only models that actually fit a page at a foldable rhombus size are included.
// A net too big for one sheet needs splitting, which is Stage B; a net squeezed
// below about 12 mm has 72° dihedrals too small to fold cleanly. Both are refused
// here rather than emitted as something that looks printable and is not.
//
// Every sheet is verified before it is written: one piece, zero overlaps by exact
// area, and it fits inside the printable frame. A model that fails is reported and
// skipped, so the page never contains a net that cannot be built.

import { writeFileSync, mkdirSync } from "node:fs";
import { seedTypes, generatePatch, allRhombs } from "../dist/geometry.js";
import { cutTreeUnfold, overlapPairs } from "../dist/cuttree.js";
import { layoutSheets, renderSheet, PAGES } from "../dist/sheet.js";

const MM_PER_IN = 25.4;
const MARGIN_IN = 0.5;
const MARGIN_MM = MARGIN_IN * MM_PER_IN;
const [PW, PH] = PAGES.letter;
const MIN_SIDE = 12; // mm; below this the sharp creases stop being foldable

// seed, generation, rhombus side in INCHES.
//
// Every generation-2 seed fits a Letter sheet at exactly 1 inch, so that is the
// standard: one inch, one model, one page, no arithmetic. Generation 3 is bigger
// than a page at that size — only St1 and Deca fit at all, and they need reducing.
// The rest of generation 3 needs a net split across sheets, which is Stage B.
//
// One inch is the rhombus EDGE, and unfold.html uses the same default, so the two
// pages agree. (GOLDEN_SIDE in geometry.ts is sqrt(5)/2 -- that is the tiling's
// internal unit, not a print size, and the two are unrelated.)
const MODELS = [
    ["St1", 2, 1, "The diamond: three rhombi. Print this one first to check your scale."],
    ["St3", 2, 1, "The boat at one generation — nine rhombi, an afternoon's work."],
    ["Deca", 2, 1, "The decagon: ten rhombi, five thick and five thin, one mirror axis."],
    ["St5", 2, 1, "The star: fifteen rhombi, five-fold symmetric."],
    ["Pe1", 2, 1, "Pe1 pentagon, twenty-one rhombi."],
    ["Pe3", 2, 1, "Pe3 pentagon, twenty-three rhombi."],
    ["Pe5", 2, 1, "Pe5 pentagon, twenty-five rhombi, with a regular pentagonal hull."],
    ["St1", 3, 0.7, "The diamond at two generations: forty-five rhombi."],
    ["Deca", 3, 0.5, "Decagon, second generation — eighty rhombi, the largest net that fits one page."],
];

mkdirSync("sheets", { recursive: true });

const out = [];
const rows = [];
let ok = 0;
let skipped = 0;

for (const [label, gen, sideIn, blurb] of MODELS) {
    const sideMm = sideIn * MM_PER_IN;
    const idx = seedTypes.findIndex((s) => s.label === label);
    const saved = console.log;
    console.log = () => {};
    generatePatch(idx, true, gen);
    const res = cutTreeUnfold({});
    console.log = saved;

    const n = allRhombs.length;
    const overlaps = overlapPairs(res.placed, true).length;
    const { sheets, oversize } = layoutSheets(
        res.pieces,
        sideMm,
        PW - 2 * MARGIN_MM,
        PH - 2 * MARGIN_MM,
        6,
    );

    const problems = [];
    if (res.pieces.length !== 1) problems.push(`${res.pieces.length} pieces`);
    if (overlaps !== 0) problems.push(`${overlaps} overlaps`);
    if (sideMm < MIN_SIDE)
        problems.push(`side ${sideMm.toFixed(1)} mm below ${MIN_SIDE} mm`);
    if (oversize.length) problems.push(`${oversize.length} piece(s) too big for the page`);
    if (sheets.length !== 1) problems.push(`${sheets.length} sheets`);

    if (problems.length) {
        console.log(`SKIP  ${label} gen ${gen}: ${problems.join(", ")}`);
        skipped++;
        continue;
    }

    const svg = renderSheet(sheets[0], res.placed, res.creases, res.hinges, {
        sideMm,
        pageW: PW,
        pageH: PH,
        margin: MARGIN_MM,
        fillMode: "cluster",
        showAngles: false,
        showLegend: true,
        standalone: false,
    });

    const p = res.pieces[0];
    const label_side =
        sideIn === 1 ? `1 in` : `${sideIn} in`;
    const win = (p.w * sideIn).toFixed(2);
    const hin = (p.h * sideIn).toFixed(2);
    const folds = [...res.foldHistogram.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => `${k}°×${v}`)
        .join("  ");

    out.push(
        `<section class="sheet-page">\n` +
            `<div class="cap noprint"><strong>${label} · generation ${gen}</strong> — ` +
            `${n} rhombi, ${label_side} side, ${win}×${hin} in. ${blurb}<br>` +
            `<span class="mono">1 piece · 0 overlaps · ${res.cuts.size} cuts · folds ${folds}</span></div>\n` +
            svg +
            `\n</section>`,
    );
    rows.push(
        `<tr><td>${label}</td><td>${gen}</td><td>${n}</td><td>${label_side}</td>` +
            `<td>${win}×${hin} in</td><td>${res.cuts.size}</td></tr>`,
    );
    // also as a standalone file, for sending to a print shop
    const alone = renderSheet(sheets[0], res.placed, res.creases, res.hinges, {
        sideMm,
        pageW: PW,
        pageH: PH,
        margin: MARGIN_MM,
        fillMode: "cluster",
        showAngles: false,
        showLegend: true,
    });
    const slug = String(sideIn).replace(".", "p");
    writeFileSync(`sheets/${label.toLowerCase()}-gen${gen}-${slug}in.svg`, alone);
    console.log(
        `ok    ${label} gen ${gen}: ${String(n).padStart(3)} rhombi, ${label_side}, ` +
            `${win}×${hin} in, ${res.cuts.size} cuts`,
    );
    ok++;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sheets to Cut — Wieringa Roof</title>
<link rel="stylesheet" href="./site.css">
<style>
    .sheet-page svg {
        display: block;
        max-width: 100%;
        height: auto;
        border: 1px solid var(--rule);
        background: #fff;
        margin: 0 0 8px;
    }
    .cap { font-size: 14px; color: var(--ink-soft); margin: 26px 0 8px; }
    .cap .mono { color: var(--ink-faint); font-size: 13px; }

    @media print {
        nav, .noprint { display: none !important; }
        body { background: #fff; }
        .wrap { max-width: none; padding: 0; }
        .sheet-page svg { border: 0; margin: 0; max-width: none; }
        .sheet-page { break-after: page; page-break-after: always; }
        .sheet-page:last-of-type { break-after: auto; page-break-after: auto; }
    }
    @page { margin: 0; }
</style>
</head>
<body>

<nav>
    <span class="brand">Wieringa Roof</span>
    <a href="./index.html" draggable="false">Home</a>
    <a href="./roof3d.html" draggable="false">3D</a>
    <a href="./info.html" draggable="false">Mathematics</a>
    <a href="./polyhedra.html" draggable="false">Polyhedra</a>
    <a href="./unfold.html" draggable="false">Unfold</a>
    <a href="./tools.html" draggable="false">Tools</a>
    <a href="./sheets.html" draggable="false" aria-current="page">Sheets</a>
</nav>

<div class="wrap">

<h1 class="noprint">Sheets to Cut</h1>
<p class="lede noprint">
    Finished nets at true size, one model per page. Every one is a
    <strong>single connected piece with no overlaps</strong> — cut the outline, score
    the creases, fold. Print at 100% with no scaling and no "fit to page".
</p>

<div class="note noprint">
    <strong>Check the scale before you cut anything.</strong> Print one page and
    measure a rhombus edge against the side length in its caption. Browsers and
    drivers silently rescale; everything else here is exact, so this is the only
    step that can go wrong.
    <br><br>
    Creases are dashed by fold angle — 36°, 72°, 108° — and coloured
    <span style="color:#c0392b">red for mountain</span>,
    <span style="color:#2469b8">blue for valley</span>. Solid black is a cut.
    Those numbers are the turn away from flat; the angle between the two finished
    panels is the supplement, 144°/108°/72°. See <a href="./tools.html">Tools</a>
    for gauges and jigs cut to those angles.
</div>

<div class="tbl-scroll noprint">
<table>
<tr><th>seed</th><th>gen</th><th>rhombi</th><th>rhombus side</th><th>net size</th><th>cuts</th></tr>
${rows.join("\n")}
</table>
</div>

<p class="noprint" style="font-size:14px;color:var(--ink-soft)">
    Printing this page gives every sheet in order. To print one model, use your
    dialog's page range — the models appear in the order of the table above. Each is
    also in <span class="mono">sheets/</span> as a standalone SVG, sized in
    millimetres, if you would rather send one to a print shop.
</p>

${out.join("\n\n")}

</div>

<script src="./site.js"></script>
</body>
</html>
`;

writeFileSync("sheets.html", html);
console.log(`\nsheets.html written: ${ok} sheets, ${skipped} skipped`);
