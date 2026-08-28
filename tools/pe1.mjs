// Pe1 at generation 1, end to end — the smallest slab that exists.
//
//   node tools/pe1.mjs        writes out/pe1-gen1.svg and out/pe1-gen1.pdf
//
// Three cells, twelve faces, one sheet. HEXAHEDRA.md task C: build the smallest thing
// there is before committing to anything larger, because everything the method claims
// is testable on it in an afternoon — one cut shape, the fold set, the collar as a
// straight strip, heads and tails as mirror images, and outside tape at the rim.
//
// Everything here is measured off the solid rather than laid out by hand. The three
// documents come from the same general unfolder `nets.html` uses on the polyhedra;
// mountain and valley come from the sign of the dihedral against the outward normal.

import { generatePatch, seedTypes } from "../dist/geometry.js";
import { slab } from "../dist/slab.js";
import { bestUnfold } from "../dist/solidnet.js";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { DASH as DASH_SVG, M_COLOR as M_HEX, V_COLOR as V_HEX } from "../dist/sheet.js";

const SIDE_MM = 25.4;              // 1 in, the standard side on the net pages
const PAGE = [215.9, 279.4];       // Letter
const MARGIN = 12;

const sub = (a, b) => a.map((x, i) => x - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const len = (a) => Math.hypot(...a);

const quiet = (f) => { const l = console.log; console.log = () => {}; const r = f(); console.log = l; return r; };
quiet(() => generatePatch(seedTypes.findIndex((s) => s.label === "Pe1"), true, 1));
const S = slab();
const say = [];

// ── the three documents ───────────────────────────────────────────
//
// The tails piece is unfolded from the floor faces rather than mirrored off the heads
// piece, so "the two are mirror images" stays a measurement instead of an assumption.
// Tails is *derived* from heads rather than unfolded on its own. Unfolding it
// separately is the obvious thing and it is wrong: the two surfaces are isometric, so
// both unfoldings are valid, but the search picks its own cut tree for each and you
// end up cutting two different shapes for one model. The floor is the roof translated
// down by exactly one — checked below — so the same cut serves, mirrored, and only the
// mountains and valleys have to be worked out again.
const DOCS = [
    { name: "heads", note: "the roof, printed side up", faces: S.top },
    { name: "collar", note: "six walls, one straight strip", faces: S.wall },
];
/** the floor face under each roof face, cell for cell */
const floorOf = new Map(S.top.map((f, i) => [f.id, S.floor[i].id]));

/** Outward normal of a face, which its winding already knows. */
const normalOf = (f) => {
    const n = cross(sub(f.corners[1], f.corners[0]), sub(f.corners[2], f.corners[0]));
    return n.map((x) => x / len(n));
};

/**
 * Mountain or valley, seen from the printed side.
 *
 * With every face wound outward, an edge is convex exactly when the neighbor's far
 * corner lies on the inner side of this face's plane — and a convex edge read from
 * outside is a ridge, which is a mountain. `foldAngle` cannot answer this on its own:
 * it comes from an arccos, so a reflex dihedral of 288° comes back as 72°.
 */
function creaseKind(a, b) {
    const A = S.faces[a], B = S.faces[b];
    const n = normalOf(A);
    const onEdge = new Set(A.corners.map((c) => c.join(",")));
    const far = B.corners.find((c) => !onEdge.has(c.join(",")));
    return dot(sub(far, A.corners[0]), n) < 0 ? "M" : "V";
}
const creaseAt = new Map();
for (const c of S.creases) {
    creaseAt.set(`${Math.min(c.a, c.b)}|${Math.max(c.a, c.b)}`, c);
}

const signedArea = (p) => {
    let a = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return a / 2;
};

const built = [];
for (const d of DOCS) {
    const net = bestUnfold(d.faces);
    // Which side of the paper are we looking at? A face is wound counter-clockwise
    // seen from outside, so if it lands clockwise the unfolder handed us the inside.
    // Flip the whole piece rather than the labels: the ink has to end up outward.
    const flip = signedArea(net.placed[0].poly) < 0;
    // The collar's creases are all parallel — it is a generalized cylinder — so the
    // strip has a direction, and standing it upright is what makes its band height
    // the 1.4472 s the geometry predicts rather than a diagonal bounding box.
    let turn = 0;
    if (d.name === "collar") {
        const h = net.hinges[0];
        const f = net.placed.find((x) => x.id === h[0]);
        const g = net.placed.find((x) => x.id === h[1]);
        const shared = f.poly.filter((P) => g.poly.some((Q) => Math.hypot(P[0] - Q[0], P[1] - Q[1]) < 1e-9));
        turn = Math.PI / 2 - Math.atan2(shared[1][1] - shared[0][1], shared[1][0] - shared[0][0]);
    }
    const cs = Math.cos(turn), sn = Math.sin(turn);
    const poly = (p) => p.map(([x, y]) => {
        const X = (flip ? -x : x), Y = y;
        return [(X * cs - Y * sn) * SIDE_MM, -(X * sn + Y * cs) * SIDE_MM];
    });
    const placed = net.placed.map((f) => ({ ...f, poly: poly(f.poly) }));
    const xs = placed.flatMap((f) => f.poly.map((p) => p[0]));
    const ys = placed.flatMap((f) => f.poly.map((p) => p[1]));
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.min(...ys) * 0 + Math.max(...ys)];

    // every edge of every placed face, so an edge shared by two placed faces can be
    // told from one on the outline
    const seen = new Map();
    for (const f of placed)
        for (let i = 0; i < f.poly.length; i++) {
            const p = f.poly[i], q = f.poly[(i + 1) % f.poly.length];
            const k = [p, q].map((v) => v.map((x) => Math.round(x * 1e4)).join(",")).sort().join("/");
            if (!seen.has(k)) seen.set(k, { p, q, faces: [] });
            seen.get(k).faces.push(f.id);
        }
    const cuts = [], folds = [];
    const hinge = new Set(net.hinges.map(([a, b]) => `${Math.min(a, b)}|${Math.max(a, b)}`));
    for (const [, e] of seen) {
        if (e.faces.length === 2) {
            const k = `${Math.min(...e.faces)}|${Math.max(...e.faces)}`;
            // A shared edge that the spanning tree did not keep is a cut, even though
            // both its faces are in the same piece — the crease/cut distinction is the
            // hinge set, never piece membership.
            if (hinge.has(k)) {
                const [fa, fb] = k.split("|").map(Number);
                folds.push({ ...e, a: fa, b: fb, fold: creaseAt.get(k).fold, mv: creaseKind(fa, fb) });
                continue;
            }
        }
        cuts.push(e);
    }
    built.push({ ...d, net, placed, box, cuts, folds });
    say.push(`  ${d.name.padEnd(7)} ${String(d.faces.length).padStart(2)} faces  ${net.pieces} piece  ` +
        `${net.overlaps} overlaps  ${folds.length} folds  ${cuts.length} cut edges  ` +
        `${(box[2] - box[0]).toFixed(1)} x ${(box[3] - box[1]).toFixed(1)} mm`);
}

// ── tails, from the same cut ──────────────────────────────────────
const heads = built[0], collar = built[1];
const tails = {
    name: "tails",
    note: "the floor, seen from below — the same cut, mirrored",
    faces: S.floor,
    net: heads.net,
    placed: heads.placed.map((f) => ({ ...f, poly: f.poly.map(([x, y]) => [-x, y]) })),
    box: [-heads.box[2], heads.box[1], -heads.box[0], heads.box[3]],
    cuts: heads.cuts.map((e) => ({ ...e, p: [-e.p[0], e.p[1]], q: [-e.q[0], e.q[1]] })),
    // Same creases at the same angles, but the solid is above the floor and below the
    // roof, so at corresponding edges it lies on opposite sides and every mountain
    // becomes a valley. Recomputed from the floor faces rather than just swapped.
    folds: heads.folds.map((e) => ({
        ...e,
        p: [-e.p[0], e.p[1]],
        q: [-e.q[0], e.q[1]],
        mv: creaseKind(floorOf.get(e.a), floorOf.get(e.b)),
    })),
};
built.splice(1, 0, tails);
say.splice(1, 0, `  ${"tails".padEnd(7)} ${String(S.floor.length).padStart(2)} faces  ` +
    `derived from heads by reflection  ${tails.folds.length} folds  ${tails.cuts.length} cut edges  ` +
    `${(tails.box[2] - tails.box[0]).toFixed(1)} x ${(tails.box[3] - tails.box[1]).toFixed(1)} mm`);

// ── what the build is supposed to demonstrate, checked ────────────
const checks = [];

// every face the same golden rhombus, in the developed plane as well as in space
let worst = 0;
for (const b of built)
    for (const f of b.placed)
        for (let i = 0; i < 4; i++)
            worst = Math.max(worst, Math.abs(Math.hypot(...sub(f.poly[(i + 1) % 4], f.poly[i])) - SIDE_MM));
checks.push([`every developed edge is ${SIDE_MM} mm`, worst < 1e-9, `worst off by ${worst.toExponential(2)} mm`]);

// one piece each, nothing overlapping
checks.push(["each document is one piece with no overlaps",
    built.every((b) => b.net.pieces === 1 && b.net.overlaps === 0),
    built.map((b) => `${b.name} ${b.net.pieces}/${b.net.overlaps}`).join(" ")]);

// the collar is a generalized cylinder: every crease parallel, so it cannot overlap
const dirs = collar.folds.map((f) => {
    const d = sub(f.q, f.p);
    let a = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
    return ((a % 180) + 180) % 180;
});
const spread = dirs.length ? Math.max(...dirs) - Math.min(...dirs) : 0;
checks.push(["the collar's creases are all parallel", spread < 1e-9,
    `${dirs.length} creases, spread ${spread.toExponential(2)}°`]);

// heads and tails are mirror images, not copies
// the floor is the roof translated down by exactly one — what lets tails be the same
// cut mirrored, instead of a second search with a second answer
let drop = 0;
S.top.forEach((f, i) => f.corners.forEach((c, k) => {
    const g = S.floor[i].corners[S.floor[i].corners.length - 1 - k];
    drop = Math.max(drop, Math.hypot(c[0] - g[0], c[1] - g[1], c[2] - 1 - g[2]));
}));
checks.push(["the floor is the roof translated down by exactly one", drop < 1e-12, `worst ${drop.toExponential(2)}`]);

// every mountain on heads is a valley on tails: the solid is below the roof and above
// the floor, so at corresponding edges it lies on opposite sides
const flipped = heads.folds.every((f, i) => f.mv !== tails.folds[i].mv);
checks.push(["every mountain on heads is a valley on tails", flipped,
    `${heads.folds.map((f) => f.mv).join("")} against ${tails.folds.map((f) => f.mv).join("")}`]);

// the collar's measurements against the closed forms
const W = collar.box[2] - collar.box[0], H = collar.box[3] - collar.box[1];
const wantW = S.counts.B * (2 / Math.sqrt(5)) * SIDE_MM, wantH = (1 + 1 / Math.sqrt(5)) * SIDE_MM;
checks.push([`the collar strip is B x 2/sqrt5 by 1 + 1/sqrt5`, Math.abs(W - wantW) < 1e-6 && Math.abs(H - wantH) < 1e-6,
    `${W.toFixed(4)} x ${H.toFixed(4)} against ${wantW.toFixed(4)} x ${wantH.toFixed(4)} mm`]);

console.error(`Pe1 generation 1 — ${S.counts.F} cells, ${S.counts.B} walls, ${S.faces.length} faces, Euler ${S.counts.euler}`);
console.error(say.join("\n"));
const foldCensus = {};
for (const b of built) for (const f of b.folds) foldCensus[`${f.fold.toFixed(0)}° ${f.mv}`] = (foldCensus[`${f.fold.toFixed(0)}° ${f.mv}`] ?? 0) + 1;
console.error(`  folds: ${Object.entries(foldCensus).sort().map(([k, v]) => `${k} x${v}`).join(", ")}`);
for (const [what, ok, detail] of checks) console.error(`  ${ok ? "ok" : "XX"}  ${what} — ${detail}`);

// ── the sheet ─────────────────────────────────────────────────────
//
// Drawn once into a device-independent list in millimetres with y running down, then
// rendered twice. SVG is what you look at; **PDF is what you print**, because it is
// the only one of the two whose units are physically defined — a point is exactly
// 1/72 in and nothing in the chain gets to reinterpret it. `tools/check-pdf.py`
// measures the result and refuses to take the scale on trust.

// The crease styling is the site's, taken from `sheet.ts` rather than restated here —
// a sheet off this tool and a sheet off the Workbench have to be the same drawing.
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const M_COLOR = rgb(M_HEX), V_COLOR = rgb(V_HEX);
const CUT = [0.07, 0.07, 0.07], INK = [0.13, 0.13, 0.13], SOFT = [0.4, 0.4, 0.4];
const DASH = Object.fromEntries(Object.entries(DASH_SVG).map(([k, v]) => [k, v.split(" ").map(Number)]));

const ops = [];
const line = (p, q, color, width, dash) => ops.push({ k: "line", p, q, color, width, dash });
const text = (x, y, t, color = INK, size = 3.6) => ops.push({ k: "text", x, y, t, color, size });

let y = MARGIN + 10;
const put = (b, x0, y0) => {
    const dx = x0 - b.box[0], dy = y0 - b.box[1];
    const T = ([x, yy]) => [x + dx, yy + dy];
    for (const e of b.cuts) line(T(e.p), T(e.q), CUT, 0.5);
    for (const e of b.folds) line(T(e.p), T(e.q), e.mv === "M" ? M_COLOR : V_COLOR, 0.35, DASH[Math.round(e.fold)]);
    text(x0, y0 - 3, `${b.name} — ${b.note}`, SOFT);
    return { w: b.box[2] - b.box[0], h: b.box[3] - b.box[1] };
};

const A = put(heads, MARGIN, y);
const B = put(tails, MARGIN + A.w + 14, y);
y += Math.max(A.h, B.h) + 20;
const C = put(collar, MARGIN, y);
y += C.h + 16;

// The crease key is drawn rather than described, so nothing depends on the reader
// matching a word to a dash pattern.
text(MARGIN, y, `Pe1, generation 1 — side ${SIDE_MM} mm. Three cells, six walls, twelve faces.`, SOFT);
text(MARGIN, y + 5.2, "Solid black cuts. Dashed creases fold, and the dash grows with the angle:", SOFT);
let kx = MARGIN;
for (const f of [36, 72, 108, 144]) {
    line([kx, y + 9.6], [kx + 16, y + 9.6], M_COLOR, 0.35, DASH[f]);
    text(kx + 17.5, y + 10.8, `${f}°`, SOFT, 3.2);
    kx += 27;
}
line([MARGIN, y + 15.4], [MARGIN + 16, y + 15.4], M_COLOR, 0.35, DASH[72]);
text(MARGIN + 17.5, y + 16.6, "mountain", SOFT, 3.2);
line([MARGIN + 54, y + 15.4], [MARGIN + 70, y + 15.4], V_COLOR, 0.35, DASH[72]);
text(MARGIN + 71.5, y + 16.6, "valley — both seen from the printed side", SOFT, 3.2);

const STEPS = [
    "1 · Cut the three pieces out. Score every dashed line before folding.",
    "2 · Fold heads and tails. Each has one short seam inside it that closes on itself — tape it.",
    "3 · Fold the collar at all five creases and tape its two ends together into a ring.",
    "4 · Tape the collar's zigzag top edge to the heads rim, working right round.",
    `5 · Close with tails. Tape on the outside: the cavity is ${SIDE_MM} mm deep and no hand goes in.`,
    "",
    "The rim needs no numbering. The zigzag fits one way round, and one way up.",
];
STEPS.forEach((t, i) => t && text(MARGIN, y + 26 + i * 5.2, t));

// ── SVG ───────────────────────────────────────────────────────────
const hex = (c) => "#" + c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE[0]}mm" height="${PAGE[1]}mm" viewBox="0 0 ${PAGE[0]} ${PAGE[1]}">`,
    `<rect width="${PAGE[0]}" height="${PAGE[1]}" fill="#fff"/>`,
];
for (const o of ops) {
    if (o.k === "line")
        svg.push(`<line x1="${o.p[0].toFixed(3)}" y1="${o.p[1].toFixed(3)}" x2="${o.q[0].toFixed(3)}" y2="${o.q[1].toFixed(3)}" stroke="${hex(o.color)}" stroke-width="${o.width}"${o.dash ? ` stroke-dasharray="${o.dash.join(" ")}"` : ' stroke-linecap="round"'}/>`);
    else
        svg.push(`<text x="${o.x.toFixed(2)}" y="${o.y.toFixed(2)}" font-family="Helvetica, sans-serif" font-size="${o.size}" fill="${hex(o.color)}">${o.t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
}
svg.push("</svg>");
writeFileSync("out/pe1-gen1.svg", svg.join("\n") + "\n");

// ── PDF ───────────────────────────────────────────────────────────
//
// Written out by hand. A drawing of straight lines and a few lines of Helvetica needs
// no library, and a hand-written file is one whose units nothing can quietly rescale:
// the MediaBox is in points, a point is 1/72 in, and that is the whole of it.
const PT = 72 / 25.4;
const X = (v) => (v * PT).toFixed(3);
const Y = (v) => ((PAGE[1] - v) * PT).toFixed(3);
// Helvetica is encoded WinAnsi, so the few non-ASCII characters used go out as octal.
const WINANSI = { "—": "\\227", "·": "\\267", "°": "\\260", "×": "\\327" };
const esc = (t) => t.replace(/[\\()]/g, (c) => "\\" + c).replace(/[^\x20-\x7e]/g, (c) => WINANSI[c] ?? "?");

const cs = [];
for (const o of ops) {
    if (o.k === "line") {
        cs.push(`${o.color.map((v) => v.toFixed(3)).join(" ")} RG ${(o.width * PT).toFixed(3)} w`);
        cs.push(o.dash ? `[${o.dash.map((d) => (d * PT).toFixed(2)).join(" ")}] 0 d` : "[] 0 d 1 J");
        cs.push(`${X(o.p[0])} ${Y(o.p[1])} m ${X(o.q[0])} ${Y(o.q[1])} l S`);
    } else {
        cs.push(`BT ${o.color.map((v) => v.toFixed(3)).join(" ")} rg /F1 ${(o.size * PT).toFixed(2)} Tf ${X(o.x)} ${Y(o.y)} Td (${esc(o.t)}) Tj ET`);
    }
}
// The identity transform is a no-op, and it is here so the file says plainly that it
// has a current transformation matrix — `tools/check-pdf.py` reads the stack to convert
// segment lengths through it, and skips any stream that never mentions one.
const stream = ["1 0 0 1 0 0 cm", ...cs].join("\n");
// Deflated, because that is what a PDF out of a browser looks like and the checker
// should not have to keep two readers.
const packed = deflateSync(Buffer.from(stream, "latin1")).toString("latin1");
const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(PAGE[0] * PT).toFixed(2)} ${(PAGE[1] * PT).toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${packed.length} /Filter /FlateDecode >>\nstream\n${packed}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
];
let pdf = "%PDF-1.4\n";
const offsets = [];
objs.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync("out/pe1-gen1.pdf", Buffer.from(pdf, "latin1"));

console.error(`  wrote out/pe1-gen1.svg and out/pe1-gen1.pdf (Letter, ${PAGE[0]} x ${PAGE[1]} mm)`);
