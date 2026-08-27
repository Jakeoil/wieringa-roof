// The color schemes, as a control.
//
// Five pages offer the roof surface's colorings and every one of them used to write
// its own `<option>` list. They had drifted into four labels for two schemes —
// "Cluster", "Star / boat / diamond", "Mosaic classic", "Mosaic plate" — so a reader
// moving between pages had no way to know which of them agreed. `FILL_MODES` in
// `geometry.ts` is now the one list; this fills a `<select>` from it.
//
// It is a separate module because `geometry.ts` has no business touching the DOM (the
// probes in `tools/` import it under node) and `roofview.ts` drags in three.js, which
// the workbench and the favicon designer do not want.

import { FILL_MODES } from "./geometry.js";
import type { FillMode } from "./geometry.js";

export interface FillOptionsOpts {
    /** label `type` as acute/obtuse — for a page coloring cells rather than rhombi */
    cells?: boolean;
    /** schemes this page cannot answer: the favicon has no axis pair, so no five */
    omit?: FillMode[];
    /** page-specific schemes to offer first, as [value, label, title?] */
    lead?: Array<[string, string, string?]>;
    /** page-specific schemes to offer last, same shape */
    trail?: Array<[string, string, string?]>;
}

/** Replace a select's options with the shared color schemes, keeping its value. */
export function fillOptions(sel: HTMLSelectElement, o: FillOptionsOpts = {}): void {
    const want = sel.value;
    sel.textContent = "";
    const add = (value: string, label: string, title?: string) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (title) opt.title = title;
        sel.appendChild(opt);
    };
    for (const [value, label, title] of o.lead ?? []) add(value, label, title);
    for (const m of FILL_MODES) {
        if (o.omit?.includes(m.value)) continue;
        add(m.value, (o.cells && m.cellLabel) || m.label, m.title);
    }
    for (const [value, label, title] of o.trail ?? []) add(value, label, title);
    // A saved preference from before a scheme was renamed points at nothing; leaving
    // the select blank would be worse than falling back to the first entry.
    sel.value = want;
    if (!sel.value) sel.selectedIndex = 0;
}
