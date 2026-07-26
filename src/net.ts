// Net page — DOM wiring. Layout and SVG live in sheet.ts, unfolding in unfold.ts.

import { seedTypes, generatePatch } from "./geometry.js";
import { unfoldPatch, stripPatch, ribbonGrowPatch } from "./unfold.js";
import { PAGES, parseLength, layoutSheets, renderSheet } from "./sheet.js";

const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

const patchSel = el<HTMLSelectElement>("patch");
const modeSel = el<HTMLSelectElement>("mode");
const genSel = el<HTMLSelectElement>("gen");
const sideInput = el<HTMLInputElement>("side");
const pageSel = el<HTMLSelectElement>("page");
const marginInput = el<HTMLInputElement>("margin");
const fillsSel = el<HTMLSelectElement>("fills");
const anglesChk = el<HTMLInputElement>("angles");
const statusEl = el<HTMLElement>("status");
const sheetsEl = el<HTMLElement>("sheets");

const PATCHES: Array<[string, string]> = [
    ["Pe5", "Star"],
    ["Pe3", "Boat"],
    ["Pe1", "Diamond"],
];

for (const [code, nick] of PATCHES) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${nick} (${code})`;
    patchSel.appendChild(opt);
}
patchSel.value = "Pe3";

for (const g of [2, 3]) {
    const opt = document.createElement("option");
    opt.value = String(g);
    opt.textContent = `Generation ${g}`;
    genSel.appendChild(opt);
}
genSel.value = "2";

function rebuild(): void {
    const side = parseLength(sideInput.value);
    if (!side) {
        statusEl.className = "info bad";
        statusEl.textContent = `Cannot read "${sideInput.value}" as a length — try 20mm, 1.5cm or 0.75in.`;
        return;
    }
    const marginParsed = parseLength(marginInput.value);
    if (!marginParsed) {
        statusEl.className = "info bad";
        statusEl.textContent = `Cannot read "${marginInput.value}" as a length — try 0.5in or 12mm.`;
        return;
    }
    const margin = marginParsed.mm;
    const [pageW, pageH] = PAGES[pageSel.value] ?? PAGES.letter;

    const seedIdx = seedTypes.findIndex((s) => s.label === patchSel.value);
    const gen = Number(genSel.value);

    const t0 = performance.now();
    generatePatch(seedIdx, true, gen);
    const res =
        modeSel.value === "strips"
            ? stripPatch()
            : modeSel.value === "widened"
              ? ribbonGrowPatch()
              : unfoldPatch();
    const { sheets, oversize } = layoutSheets(
        res.pieces,
        side.mm,
        pageW - 2 * margin,
        pageH - 2 * margin,
        6,
    );
    const ms = Math.round(performance.now() - t0);

    sheetsEl.innerHTML = sheets
        .map((s) =>
            renderSheet(s, res.placed, res.creases, res.hinges, {
                sideMm: side.mm,
                pageW,
                pageH,
                margin,
                fillMode: fillsSel.value as "none" | "type" | "cluster",
                showAngles: anglesChk.checked,
                showLegend: true,
            }),
        )
        .join("\n");

    const folds = [...res.foldHistogram.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => `${k}°×${v}`)
        .join("  ");
    const sizes = res.pieces
        .map(
            (p) =>
                `${p.faceIds.length} @ ${(p.w * side.mm).toFixed(0)}×${(p.h * side.mm).toFixed(0)} mm`,
        )
        .join(" · ");

    statusEl.className = "info" + (oversize.length ? " bad" : "");
    statusEl.textContent =
        `${res.faces.length} rhombi → ${res.pieces.length} ` +
        `${modeSel.value === "strips" ? "strip" : "piece"}${res.pieces.length === 1 ? "" : "s"} ` +
        `on ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}, side ${side.label}. ` +
        `Folds ${folds}. Pieces: ${sizes}.` +
        (oversize.length
            ? ` ${oversize.length} piece(s) too big for this page — reduce the side length.`
            : "") +
        ` (${ms} ms)`;
}

for (const c of [patchSel, modeSel, genSel, pageSel, fillsSel, anglesChk]) {
    c.addEventListener("change", rebuild);
}
for (const c of [sideInput, marginInput]) {
    c.addEventListener("change", rebuild);
    c.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") rebuild();
    });
}
el<HTMLButtonElement>("print").addEventListener("click", () => window.print());

rebuild();
