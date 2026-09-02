// The color controls: a scheme, and a palette for it.
//
// A scheme decides what class a face is in and a palette decides what color the class
// gets — see `SCHEMES` and `PALETTES` in `geometry.ts`. They were one flat list, which
// is how the pages came to carry four labels for two schemes: `Cluster`, `Star / boat /
// diamond`, `Mosaic classic` and `Mosaic plate` were all rhomb groups, and nobody could
// tell from the menus which of them agreed.
//
// These live apart from `geometry.ts` because it has no business touching the DOM — the
// probes in `tools/` import it under node — and apart from `bars.ts` because the favicon
// designer wants the menus without the bars around them.

import { SCHEMES, PALETTES, palettesFor } from "./geometry.js";

export interface SchemeOptionsOpts {
    /** schemes this page cannot answer */
    omit?: string[];
    /** page-specific schemes to offer first, as [value, label, title?] */
    lead?: Array<[string, string, string?]>;
    /** page-specific schemes to offer last, same shape */
    trail?: Array<[string, string, string?]>;
}

const add = (sel: HTMLSelectElement, value: string, label: string, title?: string) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (title) opt.title = title;
    sel.appendChild(opt);
};

/** Replace a select's options with the color schemes, keeping its value if it can. */
export function schemeOptions(sel: HTMLSelectElement, o: SchemeOptionsOpts = {}): void {
    const want = sel.value;
    sel.textContent = "";
    for (const [v, l, t] of o.lead ?? []) add(sel, v, l, t);
    for (const s of SCHEMES) {
        if (o.omit?.includes(s.value)) continue;
        add(sel, s.value, s.label, s.title);
    }
    for (const [v, l, t] of o.trail ?? []) add(sel, v, l, t);
    // A saved preference from before a scheme was renamed points at nothing; leaving
    // the select blank would be worse than falling back to the first entry.
    sel.value = want;
    if (!sel.value) sel.selectedIndex = 0;
}

/**
 * Fill a select with the palettes a scheme can wear, and answer which one is chosen.
 *
 * A three-color palette cannot serve the Kowalewski five, so it is not offered there —
 * and if the palette in hand is one of those, the choice falls back rather than
 * painting two of the five out of a palette that does not have them.
 */
export function paletteOptions(sel: HTMLSelectElement, scheme: string, want: string): string {
    const ok = palettesFor(scheme);
    sel.textContent = "";
    for (const p of ok) add(sel, p.value, p.label);
    sel.value = ok.some((p) => p.value === want) ? want : ok[0]?.value ?? "";
    // One palette is no choice at all, and a menu that cannot be used is clutter.
    sel.disabled = ok.length < 2;
    return sel.value;
}

export { PALETTES, SCHEMES };
