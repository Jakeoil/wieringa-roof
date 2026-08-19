// The nine class makeups, drawn as flat rosettes in the site's own look.
//
// The ten faces a triacontahedron can show a roof project, in plan, to a decagon:
// five thick rhombi around the pole in a Pe5 rosette, five thin filling the notches.
// So a class is a picture — which of those ten are present — and it is drawn here the
// way the roof is drawn everywhere else: flat fill, dark edges, and the isogloss
// contours dividing each long diagonal into eight.
//
//   node tools/make-class-svgs.mjs           write the block into centers.html
//   node tools/make-class-svgs.mjs --print   dump it instead

import { readFileSync, writeFileSync } from "node:fs";
import { E5, pos3D } from "../dist/geometry.js";

const A6 = [...E5.map((v) => [...v]), [0, 0, 1]];
const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const crs = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const nrm = (a) => mul(a, 1 / Math.hypot(...a));

const ORI = [];
for (let j = 0; j < 5; j++) for (let k = j + 1; k < 5; k++) {
    let u = nrm(crs(A6[j], A6[k])); if (u[2] < 0) u = mul(u, -1);
    ORI.push({ j, k, u, thick: Math.min((j-k+5)%5, (k-j+5)%5) === 1 });
}
ORI.sort((a, b) => Math.atan2(a.u[1], a.u[0]) - Math.atan2(b.u[1], b.u[0]));

// the ten candidate faces of one canonical solid
const m = [1, 1, 1, 1, 1, 1];
const FACES = ORI.map(({ j, k, u, thick }) => {
    const n = new Array(5);
    for (let i = 0; i < 5; i++) {
        n[i] = (i === j || i === k) ? (m[i]-1)/2 : (m[i] - (Math.sign(dot(u, A6[i])) || 1))/2;
    }
    const bump = (a, i) => { const c = a.slice(); c[i]++; return c; };
    const corners = [n, bump(n, j), bump(bump(n, j), k), bump(n, k)];
    return {
        thick,
        pts: corners.map((c) => { const p = pos3D(c); return [p[0], p[1]]; }),
        idx: corners.map((c) => c.reduce((a, b) => a + b, 0)),
    };
});

const all = FACES.flatMap((f) => f.pts);
const lo = [Math.min(...all.map(p=>p[0])), Math.min(...all.map(p=>p[1]))];
const hi = [Math.max(...all.map(p=>p[0])), Math.max(...all.map(p=>p[1]))];
const idxLo = Math.min(...FACES.flatMap((f) => f.idx));
const idxHi = Math.max(...FACES.flatMap((f) => f.idx));

const SIZE = 132, PAD = 7;
const sc = (SIZE - 2*PAD) / Math.max(hi[0]-lo[0], hi[1]-lo[1]);
// y flipped so the picture reads the same way up as the 3D view
const X = (p) => PAD + (p[0] - lo[0]) * sc;
const Y = (p) => SIZE - PAD - (p[1] - lo[1]) * sc;

/** seven contours per rhombus, dividing the long diagonal into eight */
function isoglosses(f) {
    let k = 0;
    for (let i = 1; i < 4; i++) if (f.idx[i] < f.idx[k]) k = i;
    const [a, b, c, d] = [f.pts[k], f.pts[(k+1)%4], f.pts[(k+2)%4], f.pts[(k+3)%4]];
    const mix = (p, q, t) => [p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t];
    const out = [];
    for (let i = 1; i <= 7; i++) {
        const t = i / 8;
        out.push(t <= 0.5
            ? [mix(a, d, t*2), mix(a, b, t*2)]
            : [mix(d, c, (t-0.5)*2), mix(b, c, (t-0.5)*2)]);
    }
    return out;
}

// The four proper classes carry the page's signature colors; the demoted ones are
// colorless, as they are on the surface. 5a and 5b are the same size and quite
// different shapes, so they are colored apart rather than together.
const CLASS_COLORS = { c4:"#e0a12b", c5a:"#3f9d58", c5b:"#8b4fc8", c10:"#2f6fb5", other:"#ececed" };
const shade = (hex, t) => {
    // t in -1..1; lighten above mid, darken below, the absolute ramp the roof uses
    const n = parseInt(hex.slice(1), 16);
    const c = [n>>16 & 255, n>>8 & 255, n & 255];
    const k = Math.abs(t) * 0.42;
    const to = t >= 0 ? 255 : 0;
    return "#" + c.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, "0")).join("");
};

function svg(pattern, cls) {
    const bits = pattern.split("").map(Number);
    const parts = [`<svg viewBox="0 0 ${SIZE} ${SIZE}" role="img">`];
    FACES.forEach((f, i) => {
        const on = bits[i] === 1;
        const d = `M ${f.pts.map((p) => `${X(p).toFixed(2)} ${Y(p).toFixed(2)}`).join(" L ")} Z`;
        if (!on) {
            parts.push(`<path d="${d}" fill="#f2f2f5" stroke="#cfd0d6" stroke-width="0.7" stroke-dasharray="2 2"/>`);
            return;
        }
        // two stops along the height gradient, as on the workbench
        const t0 = ((Math.min(...f.idx) - idxLo) / (idxHi - idxLo) - 0.5) * 2;
        const t1 = ((Math.max(...f.idx) - idxLo) / (idxHi - idxLo) - 0.5) * 2;
        const gid = `g${String(cls).replace(/[^a-z0-9]/gi,"")}_${i}`;
        const lowP = f.pts[f.idx.indexOf(Math.min(...f.idx))];
        const hiP = f.pts[f.idx.indexOf(Math.max(...f.idx))];
        parts.push(
            `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse"` +
            ` x1="${X(lowP).toFixed(2)}" y1="${Y(lowP).toFixed(2)}"` +
            ` x2="${X(hiP).toFixed(2)}" y2="${Y(hiP).toFixed(2)}">` +
            `<stop offset="0" stop-color="${shade(CLASS_COLORS[cls], t0)}"/>` +
            `<stop offset="1" stop-color="${shade(CLASS_COLORS[cls], t1)}"/></gradient></defs>`,
            `<path d="${d}" fill="url(#${gid})"/>`,
        );
        for (const [p, q] of isoglosses(f)) {
            parts.push(`<line x1="${X(p).toFixed(2)}" y1="${Y(p).toFixed(2)}" x2="${X(q).toFixed(2)}" y2="${Y(q).toFixed(2)}" stroke="#1d2026" stroke-width="0.45" opacity="0.5"/>`);
        }
        parts.push(`<path d="${d}" fill="none" stroke="#23262c" stroke-width="1.1"/>`);
    });
    parts.push("</svg>");
    return parts.join("");
}

// the nine makeups, each with the arrangement measured in tools/probes/patterns.mjs
const MAKEUPS = [
    { cls: "c4",   makeup: "class 4 — 4 thick",           pattern: "0010101010", note: "four of the five cap faces, one short of the rosette" },
    { cls: "c5a",  makeup: "class 5a — 5 thick",          pattern: "1010101010", note: "the whole Pe5 rosette, with none of its ring" },
    { cls: "c5b",  makeup: "class 5b — 3 thick + 2 thin", pattern: "0000111110", note: "a contiguous run of five: the only mixed class short of complete" },
    { cls: "c10",  makeup: "class 10 — 5 thick + 5 thin", pattern: "1111111111", note: "complete. A Pe5 rosette and the ring that closes it — a whole triacontahedron" },
    { cls: "other", makeup: "3 thick",  pattern: "0010001010", note: "demoted: never anything's home. A run of three also occurs." },
    { cls: "other", makeup: "2 thin",   pattern: "0000010001", note: "demoted: two apart round the ring; a second arrangement puts them adjacent" },
    { cls: "other", makeup: "2 thick",  pattern: "0000001010", note: "demoted, and rare — 70 against 1840 of the pair above" },
    { cls: "other", makeup: "1 thick",  pattern: "0000000010", note: "demoted: a lone thick rhomb" },
    { cls: "other", makeup: "1 thin",   pattern: "0000000001", note: "demoted: a lone thin rhomb" },
];

const block =
    '<div class="classgrid">\n' +
    MAKEUPS.map((k) =>
        `    <figure class="classfig"><div class="classsvg">${svg(k.pattern, k.cls)}</div>` +
        `<figcaption><strong>${k.makeup}</strong><span>${k.note}</span></figcaption></figure>`,
    ).join("\n") +
    "\n</div>";

if (process.argv.includes("--print")) {
    console.log(block);
} else {
    const p = "centers.html";
    const s = readFileSync(p, "utf8");
    const A = "<!-- class-illustrations -->";
    const B = "<!-- /class-illustrations -->";
    if (!s.includes(A)) { console.error(`no ${A} marker in ${p}`); process.exit(1); }
    const out = s.slice(0, s.indexOf(A) + A.length) + "\n" + block + "\n" + s.slice(s.indexOf(B));
    writeFileSync(p, out);
    console.log(`wrote ${MAKEUPS.length} class figures into ${p}`);
}
