// Icon rendering: a patch, or its unfolding, as a small square SVG.
//
// Shared by the Utilities page and by tools/make-favicon.mjs so the icon in the
// browser tab is produced by exactly the code that previews it — an icon that
// disagrees with its preview is worse than no preview.
//
// At sixteen pixels almost nothing survives except silhouette and color, so the
// defaults drop strokes and lean on the group palette. The unfolding of a small
// patch is a good subject precisely because it is *sparse*: Queen generation 1 fills
// only 47% of its own bounding box, and that spidery outline still reads when the
// individual rhombs no longer do.

import {
    allRhombs,
    generatePatch,
    seedTypes,
    vertexList,
    PLATE_COLORS,
    CLASSIC_COLORS,
    indexColor,
} from "./geometry.js";
import { cutTreeUnfold } from "./cuttree.js";

export interface IconOpts {
    seed: string; // seed label, e.g. "Deca"
    gen: number;
    /** "net" unfolds the patch; "tiling" uses the flat Penrose patch */
    subject: "net" | "tiling";
    color: "groups" | "plate" | "classic" | "type" | "index" | "mono";
    /** stroke width as a fraction of a rhomb edge; 0 for none */
    stroke: number;
    strokeColor: string;
    background: string | null;
    /** padding as a fraction of the icon */
    pad: number;
    /** whole turns are useless; this is degrees */
    rotate: number;
    size: number;
}

export const ICON_DEFAULTS: IconOpts = {
    seed: "Deca",
    gen: 1,
    subject: "net",
    color: "groups",
    stroke: 0,
    strokeColor: "#111111",
    background: null,
    pad: 0.06,
    rotate: 0,
    size: 64,
};

// **The one deliberate departure from the shared palettes.** Everything else on the
// site now colors from `FILL_MODES` and `tileFill`, but a favicon is read at 16 px
// against a browser chrome of unknown color, and the page strengths — chosen to be
// shaded over and crossed by isoglosses — go to mush at that size. These are the same
// three group colors carried a few steps deeper. The height ramp needs no such help
// and comes from `geometry.ts` like everyone else's.
const GROUPS: Record<string, string> = {
    Pe5: "#6f6fd0", // star
    Pe3: "#d8d15e", // boat
    Pe1: "#e39a5c", // diamond
};

type P2 = [number, number];

/** The polygons to draw, already in a common frame. */
function subjectPolys(o: IconOpts): Array<{ poly: P2[]; fill: string }> {
    const idx = seedTypes.findIndex((s) => s.label === o.seed);
    const quiet = console.log;
    console.log = () => {};
    generatePatch(idx < 0 ? 0 : idx, true, o.gen);
    console.log = quiet;

    const out: Array<{ poly: P2[]; fill: string }> = [];
    const fillFor = (group: string, thick: boolean, lowIndex: number): string => {
        if (o.color === "mono") return "#333333";
        if (o.color === "plate") return PLATE_COLORS[group] ?? "#888888";
        if (o.color === "classic") return CLASSIC_COLORS[group] ?? "#888888";
        if (o.color === "type") return thick ? "#6f6fd0" : "#e39a5c";
        if (o.color === "index") return indexColor(lowIndex);
        return GROUPS[group] ?? "#bbbbbb";
    };

    if (o.subject === "tiling") {
        for (const r of allRhombs) {
            const lo = Math.min(...r.vertIndices);
            out.push({
                poly: r.verts.map((v) => [v.x, v.y] as P2),
                fill: fillFor(r.group, r.thick, lo),
            });
        }
        return out;
    }

    const res = cutTreeUnfold({});
    for (const pl of res.placed.values()) {
        const lo = Math.min(...pl.verts.map((v) => vertexList[v]?.index ?? 1));
        out.push({
            poly: pl.poly.map((q) => [q[0], q[1]] as P2),
            fill: fillFor(pl.group, pl.thick, lo),
        });
    }
    return out;
}

export function iconSvg(opts: Partial<IconOpts> = {}): string {
    const o = { ...ICON_DEFAULTS, ...opts };
    const polys = subjectPolys(o);
    if (!polys.length) return "";

    const a = (o.rotate * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rot = (q: P2): P2 => [q[0] * ca - q[1] * sa, q[0] * sa + q[1] * ca];

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const turned = polys.map((p) => {
        const pts = p.poly.map(rot);
        for (const q of pts) {
            if (q[0] < x0) x0 = q[0];
            if (q[1] < y0) y0 = q[1];
            if (q[0] > x1) x1 = q[0];
            if (q[1] > y1) y1 = q[1];
        }
        return { pts, fill: p.fill };
    });

    // One square frame, the subject centered inside it. A favicon is square whatever
    // the shape is, so fit the longer side and center the other.
    const S = o.size;
    const inner = S * (1 - 2 * o.pad);
    const w = x1 - x0 || 1;
    const h = y1 - y0 || 1;
    const k = inner / Math.max(w, h);
    const ox = S / 2 - ((x0 + x1) / 2) * k;
    const oy = S / 2 + ((y0 + y1) / 2) * k;
    // y is flipped so the icon matches what the pages draw
    const map = (q: P2): P2 => [q[0] * k + ox, -q[1] * k + oy];

    const n = (v: number) => (Math.abs(v) < 1e-9 ? "0" : v.toFixed(2));
    const body: string[] = [];
    if (o.background) {
        body.push(
            `<rect width="${S}" height="${S}" rx="${n(S * 0.14)}" fill="${o.background}"/>`,
        );
    }
    const sw = o.stroke * k;
    for (const p of turned) {
        const d = p.pts.map(map).map((q) => `${n(q[0])},${n(q[1])}`).join(" ");
        body.push(
            `<polygon points="${d}" fill="${p.fill}"` +
                (sw > 0
                    ? ` stroke="${o.strokeColor}" stroke-width="${n(sw)}" stroke-linejoin="round"`
                    : "") +
                `/>`,
        );
    }
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" ` +
        `width="${S}" height="${S}">${body.join("")}</svg>`
    );
}

/** The same SVG as a data URI, for an <img> or a <link rel="icon">. */
export function iconDataUri(opts: Partial<IconOpts> = {}): string {
    return "data:image/svg+xml," + encodeURIComponent(iconSvg(opts));
}
