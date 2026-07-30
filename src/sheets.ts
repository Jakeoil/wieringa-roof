// Sheets page — take the net the workbench made, split it across paper, print it.
//
// The workbench decides what the net *is*; this decides how it reaches paper. They
// are separate jobs with separate controls, which is why they are separate pages.
//
// What crosses over is the hinge set, handed through localStorage. Hinges determine
// the development completely given the patch, so this rebuilds the workbench's exact
// net rather than re-running the search — which matters, because the branch-cut
// search is stochastic and a re-run would quietly give a different net. It also means
// a hand-built net travels exactly as well as a replayed one.

import { seedTypes, generatePatch, allRhombs, vertexList } from "./geometry.js";
import { analysePatch, ekey } from "./unfold.js";
import type { Analysis, Placed } from "./unfold.js";
import { developFromCuts } from "./cuttree.js";
import { paginateBest, renderPage, fitTabHeights, TAB_MM } from "./paginate.js";
import type { Pagination } from "./paginate.js";
import { PAGES } from "./sheet.js";
import { BUILD_ID } from "./build-id.js";

interface NetHandoff {
    seed: number;
    gen: number;
    flip: boolean;
    sideIn: number;
    hinges: string[];
    label: string;
    method: string;
}

const MARGIN_IN = 0.5;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ── rendering settings, which live here because they are print decisions ──
let shading = true;
let isoglosses = false;
let backside = false;

let handoff: NetHandoff | null = null;
let analysis: Analysis | null = null;
let placed: Map<number, Placed> = new Map();
let hinges = new Set<string>();
let pagination: Pagination | null = null;
let current = 0;

function load(): boolean {
    const raw = localStorage.getItem("wr-net");
    if (!raw) return false;
    try {
        handoff = JSON.parse(raw) as NetHandoff;
    } catch {
        return false;
    }
    if (!handoff || !Array.isArray(handoff.hinges) || !handoff.hinges.length) {
        return false;
    }

    const saved = console.log;
    console.log = () => {};
    generatePatch(handoff.seed, true, handoff.gen);
    analysis = analysePatch(handoff.flip);
    console.log = saved;

    hinges = new Set(handoff.hinges);
    // Cuts are the interior edges that are not hinges; developFromCuts wants those.
    const cuts = new Set<string>();
    for (const k of analysis.creases.keys()) if (!hinges.has(k)) cuts.add(k);
    const dev = developFromCuts(analysis, cuts);
    placed = dev.placed;
    return true;
}

function pageOpts() {
    const [pw, ph] = PAGES.letter;
    return {
        sideMm: handoff!.sideIn * 25.4,
        pageW: pw,
        pageH: ph,
        margin: MARGIN_IN * 25.4,
        fillMode: "cluster" as const,
        shading,
        isoglosses,
        // The height slider on the workbench says which way up the surface sits; a
        // flat setting carries no hills-or-dales information, so rendering falls
        // back to hills. "Back side" swaps it, for printing the underside.
        dales: backside ? !handoff!.flip : handoff!.flip,
        indexOf: (v: number) => vertexList[v]?.index ?? 1,
        indexRange: [1, 4] as [number, number],
    };
}

function repaginate(): void {
    if (!handoff) return;
    const [pw, ph] = PAGES.letter;
    const tabIn = TAB_MM / 25.4;
    const netW = (pw / 25.4 - 2 * MARGIN_IN - 2 * tabIn) / handoff.sideIn;
    const netH = (ph / 25.4 - 2 * MARGIN_IN - 2 * tabIn) / handoff.sideIn;
    pagination = paginateBest(placed, hinges, netW, netH, ekey);
    pagination.tabH = fitTabHeights(pagination, placed, pageOpts());
    if (current >= pagination.pages.length) current = 0;
}

function svgFor(i: number, standalone = false): string {
    return renderPage(pagination!, i, placed, analysis!.creases, hinges, ekey, {
        ...pageOpts(),
        standalone,
    });
}

function printOne(i: number): void {
    el("printout").innerHTML = svgFor(i);
    window.print();
}

function printAll(): void {
    el("printout").innerHTML = pagination!.pages
        .map((_, i) => svgFor(i))
        .join("\n");
    window.print();
}

function draw(): void {
    if (!pagination || !handoff) return;
    const list = el("list");
    list.innerHTML = "";

    pagination.pages.forEach((page, i) => {
        const row = document.createElement("div");
        row.className = "row" + (i === current ? " on" : "");

        const pick = document.createElement("button");
        pick.className = "pick";
        const joins = pagination!.joins
            .filter((j) => j.sheetA === i || j.sheetB === i)
            .map((j) => `${j.letter}▸${(j.sheetA === i ? j.sheetB : j.sheetA) + 1}`)
            .sort()
            .join(" ");
        pick.innerHTML =
            `<strong>Sheet ${i + 1}</strong> · ${page.faceIds.length} rhombi` +
            `<br><span class="j">${joins || "no joins"}</span>`;
        pick.addEventListener("click", () => {
            current = i;
            draw();
        });

        const pr = document.createElement("button");
        pr.className = "one";
        pr.textContent = "Print";
        pr.title = `Print sheet ${i + 1} on its own`;
        pr.addEventListener("click", (e) => {
            e.stopPropagation();
            printOne(i);
        });

        row.appendChild(pick);
        row.appendChild(pr);
        list.appendChild(row);
    });

    el("view").innerHTML = svgFor(current, false);

    const nJoins = pagination.joins.length;
    el("status").textContent =
        `${handoff.label} gen ${handoff.gen}, ${allRhombs.length} rhombi, ` +
        `${handoff.sideIn} in side — ${pagination.pages.length} sheets, ` +
        `${nJoins} taped join${nJoins === 1 ? "" : "s"}, one shared orientation. ` +
        `Method: ${handoff.method}. Build ${BUILD_ID}.`;
}

// ── wiring ────────────────────────────────────────────────────────

if (!load()) {
    el("empty").style.display = "";
    el("main").style.display = "none";
} else {
    el("empty").style.display = "none";
    repaginate();
    draw();

    const toggle = (id: string, get: () => boolean, set: (v: boolean) => void) => {
        const cb = el<HTMLInputElement>(id);
        cb.checked = get();
        cb.addEventListener("change", () => {
            set(cb.checked);
            draw();
        });
    };
    toggle("shade", () => shading, (v) => (shading = v));
    toggle("iso", () => isoglosses, (v) => (isoglosses = v));
    toggle("back", () => backside, (v) => (backside = v));

    el("printall").addEventListener("click", printAll);
    el("side").addEventListener("change", () => {
        const v = parseFloat(el<HTMLInputElement>("side").value);
        if (!isFinite(v) || v <= 0) return;
        handoff!.sideIn = v;
        repaginate();
        draw();
    });
    el<HTMLInputElement>("side").value = String(handoff!.sideIn);
}

console.log(`sheets build ${BUILD_ID}`);
