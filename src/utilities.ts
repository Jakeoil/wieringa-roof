// Utilities page. Currently the icon designer; a place for colorings and settings
// to accumulate as they are wanted.

import { seedTypes } from "./geometry.js";
import { iconSvg, iconDataUri, ICON_DEFAULTS } from "./favicon.js";
import type { IconOpts } from "./favicon.js";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const PREFS_KEY = "wr-utilities";
const prefs = loadPrefs(PREFS_KEY, {
    seed: ICON_DEFAULTS.seed,
    gen: ICON_DEFAULTS.gen,
    subject: ICON_DEFAULTS.subject as string,
    color: ICON_DEFAULTS.color as string,
    background: "",
    stroke: ICON_DEFAULTS.stroke,
    strokeColor: ICON_DEFAULTS.strokeColor,
    pad: ICON_DEFAULTS.pad,
    rotate: ICON_DEFAULTS.rotate,
});

const seedSel = el<HTMLSelectElement>("seed");
const genSel = el<HTMLSelectElement>("gen");
const subjectSel = el<HTMLSelectElement>("subject");
const colorSel = el<HTMLSelectElement>("color");
const bgSel = el<HTMLSelectElement>("bg");
const strokeIn = el<HTMLInputElement>("stroke");
const padIn = el<HTMLInputElement>("pad");
const rotIn = el<HTMLInputElement>("rot");
const strokeColSel = el<HTMLSelectElement>("strokeColor");

// Queen reads better than "Deca" everywhere else on the site, so match that here.
const nameOf = (label: string) => (label === "Deca" ? "Queen" : label);
for (const s of seedTypes) {
    const o = document.createElement("option");
    o.value = s.label;
    o.textContent = nameOf(s.label);
    seedSel.appendChild(o);
}
for (let g = 1; g <= 4; g++) {
    const o = document.createElement("option");
    o.value = String(g);
    o.textContent = `Generation ${g}`;
    genSel.appendChild(o);
}

seedSel.value = prefs.seed;
if (!seedSel.value) seedSel.value = ICON_DEFAULTS.seed;
genSel.value = String(prefs.gen);
subjectSel.value = prefs.subject;
colorSel.value = prefs.color;
bgSel.value = prefs.background;
strokeIn.value = String(prefs.stroke);
strokeColSel.value = prefs.strokeColor;
if (!strokeColSel.value) strokeColSel.value = ICON_DEFAULTS.strokeColor;
padIn.value = String(prefs.pad);
rotIn.value = String(prefs.rotate);

function current(size: number): Partial<IconOpts> {
    return {
        seed: seedSel.value,
        gen: Number(genSel.value),
        subject: subjectSel.value as IconOpts["subject"],
        color: colorSel.value as IconOpts["color"],
        background: bgSel.value || null,
        stroke: Number(strokeIn.value),
        strokeColor: strokeColSel.value,
        pad: Number(padIn.value),
        rotate: Number(rotIn.value),
        size,
    };
}

function draw(): void {
    el<HTMLElement>("strokeOut").textContent = Number(strokeIn.value).toFixed(3);
    el<HTMLElement>("padOut").textContent = Number(padIn.value).toFixed(2);
    el<HTMLElement>("rotOut").textContent = `${rotIn.value}°`;

    // One SVG scaled by the <img>, rather than one per size: the geometry is
    // identical at every size, and generating it once keeps the previews honestly
    // the same drawing.
    const svg = iconSvg(current(64));
    const uri = iconDataUri(current(64));
    for (const id of ["big", "s16", "s32", "s48", "s64"]) {
        el<HTMLImageElement>(id).src = uri;
    }
    el<HTMLTextAreaElement>("src").value = svg;

    const polys = (svg.match(/<polygon/g) ?? []).length;
    const cols = new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]));
    el<HTMLElement>("status").textContent =
        `${nameOf(seedSel.value)} generation ${genSel.value}, ` +
        `${subjectSel.value === "net" ? "unfolded" : "flat"} — ${polys} rhombs, ` +
        `${cols.size} color${cols.size === 1 ? "" : "s"}, ${svg.length} bytes. ` +
        `Build ${BUILD_ID}.`;
}

for (const c of [seedSel, genSel, subjectSel, colorSel, bgSel, strokeColSel]) {
    c.addEventListener("change", draw);
}
for (const c of [strokeIn, padIn, rotIn]) {
    c.addEventListener("input", draw);
}

el("apply").addEventListener("click", () => {
    // Swapping the live <link rel=icon> is the only honest preview: a browser
    // rendering the icon at 16 px does not look like a 16 px image on the page.
    const link = el<HTMLLinkElement>("live-favicon");
    link.href = iconDataUri(current(64));
    el<HTMLElement>("status").textContent =
        "Applied to this tab — look at the tab, not at the page.";
});

el("download").addEventListener("click", () => {
    const blob = new Blob([iconSvg(current(64))], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "favicon.svg";
    a.click();
    URL.revokeObjectURL(a.href);
});

el("reset").addEventListener("click", () => {
    window.removeEventListener("beforeunload", persist);
    resetPrefs(PREFS_KEY);
});

function persist(): void {
    savePrefs(PREFS_KEY, {
        seed: seedSel.value,
        gen: Number(genSel.value),
        subject: subjectSel.value,
        color: colorSel.value,
        background: bgSel.value,
        stroke: Number(strokeIn.value),
        strokeColor: strokeColSel.value,
        pad: Number(padIn.value),
        rotate: Number(rotIn.value),
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);

draw();
console.log(`utilities build ${BUILD_ID}`);
