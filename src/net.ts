// Net page — DOM wiring. Layout and SVG live in sheet.ts, unfolding in unfold.ts.

import { seedTypes, generatePatch } from "./geometry.js";
import { unfoldPatch, ribbonGrowPatch } from "./unfold.js";
import { cutTreeUnfold } from "./cuttree.js";
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
const flipChk = el<HTMLInputElement>("flip");
const layerSel = el<HTMLSelectElement>("layer");
const statusEl = el<HTMLElement>("status");
const sheetsEl = el<HTMLElement>("sheets");

const PATCHES: Array<[string, string]> = [
    ["Pe5", "Pe5 pentagon"],
    ["Pe3", "Pe3 pentagon"],
    ["Pe1", "Pe1 pentagon"],
    ["St5", "St5 star"],
    ["St3", "St3 boat"],
    ["St1", "St1 diamond"],
    ["Deca", "Deca"],
];

for (const [code, nick] of PATCHES) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${nick} (${code})`;
    patchSel.appendChild(opt);
}
patchSel.value = "Pe3";

for (const g of [2, 3, 4]) {
    const opt = document.createElement("option");
    opt.value = String(g);
    opt.textContent = `Generation ${g}`;
    genSel.appendChild(opt);
}
genSel.value = "2";

// The search is stochastic, so re-running it on a layer change would hand back a
// different net and the layers would not correspond to what you were just looking
// at. Compute once, keep it, and let the layer selector redraw only.
type Built = {
    res: ReturnType<typeof cutTreeUnfold> | ReturnType<typeof unfoldPatch>;
    sideMm: number;
    sideLabel: string;
    pageW: number;
    pageH: number;
    margin: number;
    ms: number;
};
let built: Built | null = null;

function layerOf(b: Built): { layer?: Map<number, number>; count: number } {
    const r = b.res as ReturnType<typeof cutTreeUnfold>;
    return r.layer ? { layer: r.layer, count: r.layerCount } : { count: 1 };
}

function syncLayerSel(): void {
    const wrap = layerSel.parentElement as HTMLElement;
    if (!built) return;
    const { count } = layerOf(built);
    if (count <= 1) {
        wrap.style.display = "none";
        layerSel.innerHTML = "";
        return;
    }
    wrap.style.display = "";
    const keep = layerSel.value;
    layerSel.innerHTML = "";
    const add = (v: string, t: string) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        layerSel.appendChild(o);
    };
    add("all", "All layers");
    for (let L = 0; L < count; L++) add(String(L), `Layer ${L}`);
    layerSel.value = Array.from(layerSel.options).some((o) => o.value === keep)
        ? keep
        : "all";
}

function draw(): void {
    if (!built) return;
    const b = built;
    const { layer } = layerOf(b);
    const active =
        layerSel.value === "all" || layerSel.value === "" ? null : Number(layerSel.value);

    const { sheets, oversize } = layoutSheets(
        b.res.pieces,
        b.sideMm,
        b.pageW - 2 * b.margin,
        b.pageH - 2 * b.margin,
        6,
    );

    sheetsEl.innerHTML = sheets
        .map((s) =>
            renderSheet(s, b.res.placed, b.res.creases, b.res.hinges, {
                sideMm: b.sideMm,
                pageW: b.pageW,
                pageH: b.pageH,
                margin: b.margin,
                fillMode: fillsSel.value as "none" | "type" | "cluster",
                showAngles: anglesChk.checked,
                showLegend: true,
                layer,
                activeLayer: active,
            }),
        )
        .join("\n");

    const folds = [...b.res.foldHistogram.entries()]
        .sort((a, b2) => a[0] - b2[0])
        .map(([k, v]) => `${k}°×${v}`)
        .join("  ");
    const sizes = b.res.pieces
        .map(
            (p) =>
                `${p.faceIds.length} @ ${(p.w * b.sideMm).toFixed(0)}×${(p.h * b.sideMm).toFixed(0)} mm`,
        )
        .join(" · ");

    const r = b.res as ReturnType<typeof cutTreeUnfold>;
    let layerNote = "";
    if (r.layer && r.layerCount > 1) {
        const pop = new Map<number, number>();
        for (const L of r.layer.values()) pop.set(L, (pop.get(L) ?? 0) + 1);
        layerNote =
            ` ${r.layerCount} layers (` +
            [...pop.entries()]
                .sort((x, y) => x[0] - y[0])
                .map(([L, n]) => `L${L}: ${n}`)
                .join(", ") +
            `) — where the net wraps over itself it goes up a z coordinate` +
            ` instead of being cut. The flat alternative is` +
            ` ${r.flat.pieces.length} piece${r.flat.pieces.length === 1 ? "" : "s"}.`;
    }

    statusEl.className = "info" + (oversize.length ? " bad" : "");
    statusEl.textContent =
        `${b.res.faces.length} rhombi → ${b.res.pieces.length} ` +
        `piece${b.res.pieces.length === 1 ? "" : "s"} ` +
        `on ${sheets.length} sheet${sheets.length === 1 ? "" : "s"}, side ${b.sideLabel}. ` +
        `Folds ${folds}. Pieces: ${sizes}.` +
        layerNote +
        (oversize.length
            ? ` ${oversize.length} piece(s) too big for this page — reduce the side length.`
            : "") +
        ` (${b.ms} ms)`;
}

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
    const opts = { flip: flipChk.checked };
    const res =
        modeSel.value === "cuttree"
            ? cutTreeUnfold(opts)
            : modeSel.value === "widened"
              ? ribbonGrowPatch(opts)
              : unfoldPatch(opts);
    const ms = Math.round(performance.now() - t0);

    built = {
        res,
        sideMm: side.mm,
        sideLabel: side.label,
        pageW,
        pageH,
        margin,
        ms,
    };
    syncLayerSel();
    draw();
}

// Only the first group changes the net; the rest are pure presentation and must
// redraw rather than re-search, or toggling a fill would hand back a different net.
for (const c of [patchSel, modeSel, genSel, pageSel, flipChk]) {
    c.addEventListener("change", rebuild);
}
for (const c of [fillsSel, anglesChk, layerSel]) {
    c.addEventListener("change", draw);
}
for (const c of [sideInput, marginInput]) {
    c.addEventListener("change", rebuild);
    c.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") rebuild();
    });
}
el<HTMLButtonElement>("print").addEventListener("click", () => window.print());

rebuild();
