// Chapter 4, part 3 — nets for the triacontahedron and its twenty hexahedra.
//
// The unfolding is `solidnet.ts`; this is the workbench over it: pick a solid, pick a
// colouring, set the side length, print at true size. Everything is drawn as SVG in
// physical units so what comes off the printer is the size it says.
//
// The colourings are the ones that mean something about the solid rather than the ones
// that look nice. **Kowalewski five** is the reason this page exists: it is a proper
// edge colouring of K₆ on the six axes, so every rosette of the triacontahedron shows
// all five, every hexahedron's opposite faces agree, and each hexahedron wears three of
// the five — the ten 3-subsets, borne once by an acute cell and once by an obtuse one.
// Cut the twenty out and you have the pieces of the classical Kowalewski puzzle, not
// merely a picture of it.

import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { dissection, shellFaces, faceColor, pairColor, cellColors } from "./dissect.js";
import { bestUnfold } from "./solidnet.js";
import type { Net, SolidFace } from "./solidnet.js";
import { FIVE_COLORS } from "./geometry.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};
const out = el<HTMLDivElement>("out");
const solidSel = el<HTMLSelectElement>("solid");
const schemeSel = el<HTMLSelectElement>("scheme");
const sideInput = el<HTMLInputElement>("side");
const foldsChk = el<HTMLInputElement>("folds");
const labelsChk = el<HTMLInputElement>("labels");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-nets";
const PREF_DEFAULTS = { solid: "rt", scheme: "five", side: "1in", folds: true, labels: true };
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);

/** Lengths in millimetres, however they were typed. */
function parseLength(s: string): number {
    const m = /^\s*([0-9.]+)\s*(mm|cm|in|")?\s*$/.exec(s);
    if (!m) return 25.4;
    const v = Number(m[1]);
    switch (m[2]) {
        case "cm": return v * 10;
        case "mm": return v;
        default: return v * 25.4; // inches, and the default when no unit is given
    }
}

const TYPE_COLORS = ["#d98d3a", "#4a7fb5"];
const AXIS_COLORS = ["#d94f3d", "#e8a33d", "#4f9d4a", "#3d7fc4", "#9b59b6", "#8a8578"];

interface Job {
    name: string;
    faces: SolidFace[];
    /** an extra caption under the net — the colour triple, for a puzzle piece */
    note?: string;
}

function jobs(): Job[] {
    const cells = dissection("symmetric");
    const scheme = schemeSel.value;
    const tagCell = (c: (typeof cells)[number], i: number): number => {
        if (scheme === "five") return faceColor(c, i);
        if (scheme === "type") return c.acute ? 0 : 1;
        if (scheme === "axis") return c.triple[i >> 1];
        return -1;
    };
    switch (solidSel.value) {
        case "rt": {
            const sh = shellFaces();
            return [{
                name: "Rhombic triacontahedron",
                faces: sh.map((f, i) => ({
                    id: i,
                    corners: f.corners,
                    tag: scheme === "five" ? pairColor(f.i, f.j) : scheme === "axis" ? f.i : -1,
                })),
            }];
        }
        case "acute":
        case "obtuse": {
            const want = solidSel.value === "acute";
            const c = cells.find((x) => x.acute === want)!;
            return [{
                name: `${want ? "Acute" : "Obtuse"} golden hexahedron`,
                faces: c.faces.map((f, i) => ({ id: i, corners: f, tag: tagCell(c, i) })),
                note: scheme === "five" ? `colours ${cellColors(c).join(", ")}` : undefined,
            }];
        }
        default:
            return cells.map((c) => ({
                name: `${c.acute ? "acute" : "obtuse"} · ${c.triple.join("")}`,
                faces: c.faces.map((f, i) => ({ id: i, corners: f, tag: tagCell(c, i) })),
                note: scheme === "five" ? cellColors(c).join(", ") : undefined,
            }));
    }
}

function fillOf(tag: number | undefined): string {
    if (tag === undefined || tag < 0) return "#f2f2f4";
    const scheme = schemeSel.value;
    if (scheme === "five") return FIVE_COLORS[tag];
    if (scheme === "type") return TYPE_COLORS[tag];
    if (scheme === "axis") return AXIS_COLORS[tag % 6];
    return "#f2f2f4";
}

/** One net as an SVG, at true size. */
function svgFor(job: Job, net: Net, side: number): string {
    const xs = net.placed.flatMap((p) => p.poly.map((q) => q[0]));
    const ys = net.placed.flatMap((p) => p.poly.map((q) => q[1]));
    const pad = 3;
    const w = (Math.max(...xs) - Math.min(...xs)) * side + pad * 2;
    const h = (Math.max(...ys) - Math.min(...ys)) * side + pad * 2;
    const X = (v: number) => (v - Math.min(...xs)) * side + pad;
    // SVG y runs down; flip so the net reads the same way it was computed
    const Y = (v: number) => h - ((v - Math.min(...ys)) * side + pad);

    const parts: string[] = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}">`,
    ];
    for (const p of net.placed) {
        const pts = p.poly.map((q) => `${X(q[0]).toFixed(3)},${Y(q[1]).toFixed(3)}`).join(" ");
        parts.push(`<polygon points="${pts}" fill="${fillOf(p.tag)}" stroke="none"/>`);
    }
    // Folds inside, cuts outside. An edge shared by two placed faces is a fold; every
    // other edge is where the scissors go, and the difference has to be visible on
    // paper or the model cannot be built.
    const edgeCount = new Map<string, number>();
    const key = (a: [number, number], b: [number, number]) => {
        const ka = `${X(a[0]).toFixed(3)},${Y(a[1]).toFixed(3)}`;
        const kb = `${X(b[0]).toFixed(3)},${Y(b[1]).toFixed(3)}`;
        return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    };
    for (const p of net.placed)
        for (let i = 0; i < p.poly.length; i++) {
            const k = key(p.poly[i], p.poly[(i + 1) % p.poly.length]);
            edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
        }
    for (const [k, n] of edgeCount) {
        const [a, b] = k.split("|").map((s) => s.split(",").map(Number));
        if (n === 2) {
            if (foldsChk.checked)
                parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#9aa0a8" stroke-width="0.25" stroke-dasharray="2.2 1.6"/>`);
        } else {
            parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#23262c" stroke-width="0.5"/>`);
        }
    }
    if (labelsChk.checked) {
        parts.push(`<text x="${pad}" y="${(h - 1).toFixed(2)}" font-family="system-ui,sans-serif" font-size="3" fill="#5a5f66">${job.name}${job.note ? ` — ${job.note}` : ""}</text>`);
    }
    parts.push("</svg>");
    return parts.join("");
}

function build(): void {
    const side = parseLength(sideInput.value);
    const list = jobs();
    const html: string[] = [];
    let worst = 0;
    let totalPieces = 0;
    for (const job of list) {
        const net = bestUnfold(job.faces);
        totalPieces += net.pieces;
        worst = Math.max(worst, net.pieces);
        html.push(`<div class="net">${svgFor(job, net, side)}</div>`);
    }
    out.innerHTML = html.join("");
    const mm = side.toFixed(1);
    statusEl.textContent =
        `${list.length} net${list.length === 1 ? "" : "s"} · side ${mm} mm ` +
        `(${(side / 25.4).toFixed(3)} in) · ${totalPieces} piece${totalPieces === 1 ? "" : "s"} in all` +
        `${worst > 1 ? ` · worst ${worst} pieces for one solid` : " · every solid unfolds whole"} · ` +
        `long diagonal ${(side * 1.7013).toFixed(1)} mm, short ${(side * 1.0515).toFixed(1)} mm`;
}

solidSel.value = prefs.solid || PREF_DEFAULTS.solid;
schemeSel.value = prefs.scheme || PREF_DEFAULTS.scheme;
sideInput.value = prefs.side || PREF_DEFAULTS.side;
foldsChk.checked = prefs.folds;
labelsChk.checked = prefs.labels;

for (const c of [solidSel, schemeSel, foldsChk, labelsChk]) c.addEventListener("change", build);
sideInput.addEventListener("change", build);
el<HTMLButtonElement>("print").addEventListener("click", () => window.print());

function persist(): void {
    savePrefs(PREFS_KEY, {
        solid: solidSel.value, scheme: schemeSel.value, side: sideInput.value,
        folds: foldsChk.checked, labels: labelsChk.checked,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);
el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the nets page to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});

console.log(`nets build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}
build();
