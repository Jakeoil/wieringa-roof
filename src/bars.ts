// The patch line and the rendering line, built once for every page that has them.
//
// **The patch line is what a net is made of** — which patch, which generation, which
// way up, and whether it is the solid. **The rendering line is how it is shown** —
// color, shading, isoglosses. The distinction is the useful one: everything on the
// first is settled the moment a net exists, and everything on the second can be
// changed afterwards, which is why the Workbench ghosts one on the Sheets view and
// leaves the other alone.
//
// They are built here rather than on each page because this project keeps proving what
// happens otherwise. Five hand-built copies of the color menu gave four labels for two
// schemes; two copies of the crease dashes gave two tables; thick-versus-thin drifted
// between paper and screen because each was written where it was used. `fillOptions`
// fixed the first of those by making one list the answer. This is the same move for
// the controls around it.
//
// Pages append their own controls to the same bars afterwards — a Reset button, a
// transparency box, a shrink slider. Only what means the same thing everywhere lives
// here.

import { seedTypes } from "./geometry.js";
import { fillOptions } from "./schemes.js";
import type { FillOptionsOpts } from "./schemes.js";
import { patchSize, MAX_GENERATION } from "./patchsize.js";

/** The names the seeds go by on a control, as against their codes. */
const NICKNAME: Record<string, string> = {
    Pe5: "Pe5 pentagon",
    Pe3: "Pe3 pentagon",
    Pe1: "Pe1 pentagon",
    St5: "St5 star",
    St3: "St3 boat",
    St1: "St1 diamond",
    Deca: "Queen (composite)",
    Sun: "Sun (composite)",
    Star: "Star (composite)",
};

export interface PatchValues {
    patch: string;
    gen: number;
    /** heads is the surface seen from above; tails is the same seen from below */
    heads: boolean;
    slab: boolean;
}

export interface PatchLineOpts {
    host: HTMLElement;
    patch: string;
    gen: number;
    /** omit to leave parity off the page entirely */
    heads?: boolean;
    /** omit where the slab is not a choice — Hexahedra *is* the hexahedra layer */
    slab?: boolean;
    /**
     * How much this page can draw, and where it starts to labour, in rhombi. A
     * generation past `limit` is offered but disabled, with the count and the reason
     * on it: a menu that silently omits the answer looks like the answer is impossible.
     */
    limit: number;
    busy?: number;
    /** what the count is called here — "rhombs", or "hexahedra" for a slab */
    noun?: string;
    onChange: (v: PatchValues) => void;
}

export interface PatchLine {
    values: PatchValues;
    /** re-read the generation menu for the current patch; call after changing it */
    refresh(): void;
    /** disable the whole line, as the Sheets view does with a finished net */
    ghost(on: boolean): void;
}

const label = (text: string, ...kids: Node[]): HTMLLabelElement => {
    const l = document.createElement("label");
    l.style.cssText = "font-size:13px;display:inline-flex;align-items:center;gap:5px";
    if (text) l.appendChild(document.createTextNode(text));
    for (const k of kids) l.appendChild(k);
    return l;
};

export function buildPatchLine(o: PatchLineOpts): PatchLine {
    const values: PatchValues = {
        patch: o.patch,
        gen: o.gen,
        heads: o.heads ?? true,
        slab: o.slab ?? false,
    };
    const busy = o.busy ?? Math.round(o.limit / 5);
    const noun = o.noun ?? "rhombs";

    const patchSel = document.createElement("select");
    patchSel.style.cssText = "padding:4px;font-size:13px;";
    for (const s of seedTypes) {
        const opt = document.createElement("option");
        opt.value = s.label;
        opt.textContent = NICKNAME[s.label] ?? s.label;
        patchSel.appendChild(opt);
    }
    patchSel.value = values.patch;
    if (!patchSel.value) patchSel.value = seedTypes[0].label;

    const genSel = document.createElement("select");
    genSel.style.cssText = "padding:4px;font-size:13px;";

    /**
     * The generation menu, priced.
     *
     * A zero means the patch does not exist yet — the star seeds have no generation 1,
     * a star not being produced until the first deflation — and that is worth saying
     * rather than hiding, since "why can I not pick 1" is otherwise unanswerable.
     */
    const refresh = () => {
        const code = patchSel.value;
        const keep = values.gen;
        genSel.textContent = "";
        for (let g = 1; g <= MAX_GENERATION; g++) {
            const n = patchSize(code, g);
            const opt = document.createElement("option");
            opt.value = String(g);
            if (n === 0) {
                opt.textContent = `Generation ${g} — none`;
                opt.disabled = true;
                opt.title = `${code} does not exist at generation ${g}`;
            } else if (n > o.limit) {
                opt.textContent = `Generation ${g} — ${n.toLocaleString()} ${noun}`;
                opt.disabled = true;
                opt.title = `${n.toLocaleString()} ${noun} is past what this page can draw`;
            } else {
                opt.textContent =
                    `Generation ${g} — ${n.toLocaleString()}${n > busy ? " (slow)" : ""}`;
                opt.title = `${n.toLocaleString()} ${noun}`;
            }
            genSel.appendChild(opt);
        }
        // Keep the generation if this patch has one; otherwise take the largest that
        // it does, which is the nearest thing to what was asked for.
        genSel.value = String(keep);
        if (!genSel.value || (genSel.selectedOptions[0]?.disabled ?? true)) {
            const ok = Array.from(genSel.options).filter((x) => !x.disabled);
            genSel.value = ok.length ? ok[ok.length - 1].value : "";
        }
        values.gen = Number(genSel.value) || keep;
    };
    refresh();

    const emit = () => o.onChange({ ...values });
    patchSel.addEventListener("change", () => {
        values.patch = patchSel.value;
        refresh();
        emit();
    });
    genSel.addEventListener("change", () => {
        values.gen = Number(genSel.value);
        emit();
    });

    o.host.appendChild(label("Patch: ", patchSel));
    o.host.appendChild(label("Gen: ", genSel));

    if (o.heads !== undefined) {
        const wrap = document.createElement("span");
        wrap.style.cssText = "font-size:13px;display:inline-flex;align-items:center;gap:8px";
        wrap.title =
            "Which side of the surface this is. Heads is seen from above, tails from " +
            "below: the same thing mirrored, with hills and dales exchanged.";
        for (const [text, heads] of [["heads", true], ["tails", false]] as Array<[string, boolean]>) {
            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = `parity-${Math.random().toString(36).slice(2, 8)}`;
            radio.checked = values.heads === heads;
            radio.addEventListener("change", () => {
                if (!radio.checked) return;
                values.heads = heads;
                emit();
            });
            wrap.appendChild(label("", radio, document.createTextNode(text)));
        }
        o.host.appendChild(wrap);
    }

    if (o.slab !== undefined) {
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = values.slab;
        box.addEventListener("change", () => {
            values.slab = box.checked;
            emit();
        });
        const l = label("", box, document.createTextNode("slab"));
        l.title =
            "Unfold the solid rather than the surface: the same rhombi on top, the " +
            "same again as a floor one side length down, and a wall on every " +
            "boundary edge.";
        o.host.appendChild(l);
    }

    return {
        values,
        refresh,
        ghost(on: boolean) {
            o.host.style.opacity = on ? "0.5" : "1";
            o.host.style.pointerEvents = on ? "none" : "";
            o.host.querySelectorAll("input, select, button").forEach((el) => {
                (el as HTMLInputElement).disabled = on;
            });
        },
    };
}

// ── the rendering line ────────────────────────────────────────────

export interface RenderValues {
    color: string;
    /** the slider's position, −1 … 1, or the checkbox as 0 and 1 */
    shading: number;
    isoglosses: boolean;
}

export interface RenderLineOpts {
    host: HTMLElement;
    color: string;
    /**
     * The shading control, and **what it is called here**, because the magnitude does
     * not mean the same thing on every page. On the flat pages it is how strongly
     * height is shaded and moves nothing; in three dimensions it is the model's own
     * vertical scale, and the shading follows it so that a flattened roof cannot be
     * shaded. One control, named for what it does.
     */
    shading?: {
        name: string;
        value: number;
        slider: boolean;
        /** −1 where the sign means something, 0 where only the magnitude does */
        min?: number;
        format?: (v: number) => string;
    };
    isoglosses?: boolean;
    /**
     * Page-specific controls, placed between the shading control and the isoglosses.
     * Isoglosses stay last wherever they appear: they are a decoration drawn on top of
     * everything above them, and reading the line in that order is the point of having
     * one.
     */
    extras?: HTMLElement[];
    /** passed through to `fillOptions` — page-specific schemes, and what to leave out */
    schemes?: FillOptionsOpts;
    onChange: (v: RenderValues) => void;
}

export function buildRenderLine(o: RenderLineOpts): { values: RenderValues; sync(): void } {
    const values: RenderValues = {
        color: o.color,
        shading: o.shading?.value ?? 0,
        isoglosses: o.isoglosses ?? false,
    };
    const emit = () => o.onChange({ ...values });

    // Color first: it is the one that changes what you are looking at rather than how
    // brightly, and it is the one reached for most.
    const colorSel = document.createElement("select");
    colorSel.style.cssText = "padding:4px;font-size:13px;";
    fillOptions(colorSel, o.schemes);
    colorSel.value = values.color;
    if (!colorSel.value) colorSel.selectedIndex = 0;
    values.color = colorSel.value;
    colorSel.addEventListener("change", () => {
        values.color = colorSel.value;
        emit();
    });
    o.host.appendChild(label("Color: ", colorSel));

    let out: HTMLElement | null = null;
    let input: HTMLInputElement | null = null;
    if (o.shading) {
        const sh = o.shading;
        input = document.createElement("input");
        if (sh.slider) {
            input.type = "range";
            input.min = String(sh.min ?? -1);
            input.max = "1";
            input.step = "0.01";
            input.style.width = "132px";
        } else {
            input.type = "checkbox";
        }
        if (sh.slider) input.value = String(sh.value);
        else input.checked = sh.value !== 0;
        out = document.createElement("span");
        out.className = "mono";
        out.style.minWidth = "7em";
        const read = () => (sh.slider ? Number(input!.value) : input!.checked ? 1 : 0);
        const show = () => {
            if (out && sh.format) out.textContent = sh.format(values.shading);
        };
        input.addEventListener("input", () => {
            values.shading = read();
            show();
            emit();
        });
        input.addEventListener("change", () => {
            values.shading = read();
            show();
            emit();
        });
        show();
        o.host.appendChild(label(`${sh.name} `, input, out));
    }

    for (const e of o.extras ?? []) o.host.appendChild(e);

    // Isoglosses last: they are a decoration on top of everything above them.
    let isoBox: HTMLInputElement | null = null;
    if (o.isoglosses !== undefined) {
        isoBox = document.createElement("input");
        isoBox.type = "checkbox";
        isoBox.checked = values.isoglosses;
        isoBox.addEventListener("change", () => {
            values.isoglosses = isoBox!.checked;
            emit();
        });
        const l = label("", isoBox, document.createTextNode("isoglosses"));
        l.title = "Contour lines of constant height, running on unbroken from tile to tile";
        o.host.appendChild(l);
    }

    return {
        values,
        sync() {
            colorSel.value = values.color;
            if (input) {
                if (o.shading?.slider) input.value = String(values.shading);
                else input.checked = values.shading !== 0;
                if (out && o.shading?.format) out.textContent = o.shading.format(values.shading);
            }
            if (isoBox) isoBox.checked = values.isoglosses;
        },
    };
}
