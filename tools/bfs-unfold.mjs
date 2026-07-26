// BFS edge-unfolding of Wieringa roof patches.
//
// The lift comes from geometry.ts (computeLift / pos3D) so there is exactly one
// implementation of the direction matching — it is easy to get wrong and hard to
// notice, see the comments there.
//
//   node tools/bfs-unfold.mjs
//   node tools/bfs-unfold.mjs --side=1in --page=a4
//   node tools/bfs-unfold.mjs --gen=3 --side=12mm --unit=mm
//
// Options
//   --side=<len>   golden rhombus side, e.g. 20mm, 0.75in, 1in  (default 20mm)
//   --gen=<n>      expansion generation                          (default 2)
//   --page=<name>  letter | a4 | none                            (default letter)
//   --margin=<len> page margin                                   (default 0.5in)
//   --unit=<u>     report in mm or in (default: follows --side)

import {
    seedTypes,
    generatePatch,
    allRhombs,
    vertexList,
    vertexMap,
    edgeMap,
    roundKey,
    computeLift,
    pos3D,
} from "../dist/geometry.js";

// ── units ─────────────────────────────────────────────────────────

const MM_PER_IN = 25.4;

function parseLen(str, fallbackMm) {
    if (str == null) return { mm: fallbackMm, unit: "mm" };
    const m = String(str)
        .trim()
        .match(/^([0-9]*\.?[0-9]+)\s*(mm|cm|in|")?$/i);
    if (!m) throw new Error(`cannot parse length "${str}"`);
    const v = Number(m[1]);
    const u = (m[2] ?? "mm").toLowerCase();
    if (u === "mm") return { mm: v, unit: "mm" };
    if (u === "cm") return { mm: v * 10, unit: "mm" };
    return { mm: v * MM_PER_IN, unit: "in" };
}

const PAGES = {
    letter: [215.9, 279.4],
    a4: [210.0, 297.0],
    none: [Infinity, Infinity],
};

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    }),
);

const side = parseLen(args.side, 20);
const margin = parseLen(args.margin, 0.5 * MM_PER_IN);
const GEN = Number(args.gen ?? 2);
const pageName = String(args.page ?? "letter").toLowerCase();
if (!(pageName in PAGES)) throw new Error(`unknown page "${pageName}"`);
const [pw, ph] = PAGES[pageName];
const PAGE_W = pw - 2 * margin.mm;
const PAGE_H = ph - 2 * margin.mm;

const UNIT = String(args.unit ?? side.unit).toLowerCase() === "in" ? "in" : "mm";
const fromMm = (v) => (UNIT === "in" ? v / MM_PER_IN : v);
const fmt = (v) => (UNIT === "in" ? fromMm(v).toFixed(2) : fromMm(v).toFixed(0));

// ── small vector helpers ──────────────────────────────────────────

const v3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm(a) {
        const l = this.len(a);
        return [a[0] / l, a[1] / l, a[2] / l];
    },
};

// ── faces with vertex ids, from the geometry registries ───────────

function buildFaces() {
    return allRhombs.map((r) => ({
        id: r.id,
        thick: r.thick,
        v: r.verts.map((pt) => vertexMap.get(roundKey(pt)).id),
    }));
}

function faceNeighbours(faces) {
    const nb = new Map(faces.map((f) => [f.id, []]));
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue;
        const [x, y] = e.rhombIds;
        nb.get(x).push({ other: y, a: e.v1, b: e.v2 });
        nb.get(y).push({ other: x, a: e.v1, b: e.v2 });
    }
    return nb;
}

// ── fold angles (the check that catches a broken lift) ────────────

function foldAngles(faces, P) {
    const byId = new Map(faces.map((f) => [f.id, f]));
    const hist = new Map();
    for (const e of edgeMap.values()) {
        if (e.rhombIds.length !== 2) continue;
        const A = P[e.v1];
        const dir = v3.norm(v3.sub(P[e.v2], P[e.v1]));
        const off = (f) => {
            const o = f.v.find((v) => v !== e.v1 && v !== e.v2);
            let w = v3.sub(P[o], A);
            w = v3.sub(w, v3.mul(dir, v3.dot(w, dir)));
            return v3.norm(w);
        };
        const w1 = off(byId.get(e.rhombIds[0]));
        const w2 = off(byId.get(e.rhombIds[1]));
        const dih =
            (Math.acos(Math.max(-1, Math.min(1, v3.dot(w1, w2)))) * 180) /
            Math.PI;
        const k = Math.round(180 - dih);
        hist.set(k, (hist.get(k) ?? 0) + 1);
    }
    return hist;
}

// ── unfolding ─────────────────────────────────────────────────────

function placeSeed(face, P) {
    const [A, B, , D] = face.v.map((i) => P[i]);
    const ex = v3.norm(v3.sub(B, A));
    let ey = v3.sub(D, A);
    ey = v3.sub(ey, v3.mul(ex, v3.dot(ey, ex)));
    ey = v3.norm(ey);
    return face.v.map((i) => {
        const d = v3.sub(P[i], A);
        return [v3.dot(d, ex), v3.dot(d, ey)];
    });
}

function trilaterate(a, b, dA, dB, ref) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    const ex = [dx / d, dy / d];
    const ey = [-ex[1], ex[0]];
    const x = (dA * dA - dB * dB + d * d) / (2 * d);
    const y = Math.sqrt(Math.max(0, dA * dA - x * x));
    const sideRef = (ref[0] - a[0]) * ey[0] + (ref[1] - a[1]) * ey[1];
    const sgn = sideRef > 0 ? -1 : +1;
    return [
        a[0] + ex[0] * x + ey[0] * sgn * y,
        a[1] + ex[1] * x + ey[1] * sgn * y,
    ];
}

const centroid = (poly) => [
    poly.reduce((s, q) => s + q[0], 0) / poly.length,
    poly.reduce((s, q) => s + q[1], 0) / poly.length,
];

function shrink(poly, f) {
    const c = centroid(poly);
    return poly.map((q) => [c[0] + (q[0] - c[0]) * f, c[1] + (q[1] - c[1]) * f]);
}

function convexOverlap(p1, p2) {
    for (const poly of [p1, p2]) {
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const ax = -(b[1] - a[1]);
            const ay = b[0] - a[0];
            let lo1 = Infinity;
            let hi1 = -Infinity;
            let lo2 = Infinity;
            let hi2 = -Infinity;
            for (const q of p1) {
                const v = q[0] * ax + q[1] * ay;
                lo1 = Math.min(lo1, v);
                hi1 = Math.max(hi1, v);
            }
            for (const q of p2) {
                const v = q[0] * ax + q[1] * ay;
                lo2 = Math.min(lo2, v);
                hi2 = Math.max(hi2, v);
            }
            if (hi1 < lo2 || hi2 < lo1) return false;
        }
    }
    return true;
}

function placeAcross(face, P, ea, eb, hostPoly, hostVerts) {
    const i = face.v.indexOf(ea);
    if (i < 0 || face.v.indexOf(eb) < 0) return null;
    const fwd = face.v[(i + 1) % 4] === eb;
    const order = [0, 1, 2, 3].map(
        (k) => face.v[fwd ? (i + k) % 4 : (i - k + 4) % 4],
    );
    const [A, B, C, D] = order;
    const a = hostPoly[hostVerts.indexOf(A)];
    const b = hostPoly[hostVerts.indexOf(B)];
    if (!a || !b) return null;
    const ref = centroid(hostPoly);
    const dist = (u, w) => v3.len(v3.sub(P[u], P[w]));
    return {
        poly: [
            a,
            b,
            trilaterate(a, b, dist(C, A), dist(C, B), ref),
            trilaterate(a, b, dist(D, A), dist(D, B), ref),
        ],
        verts: order,
    };
}

function unfold(faces, P, firstSeed = null) {
    const byId = new Map(faces.map((f) => [f.id, f]));
    const nb = faceNeighbours(faces);
    const placed = new Map();
    const nets = [];
    const remaining = new Set(faces.map((f) => f.id));

    while (remaining.size) {
        let seedId = null;
        if (nets.length === 0 && firstSeed !== null && remaining.has(firstSeed)) {
            seedId = firstSeed;
        } else {
            let best = Infinity;
            for (const id of remaining) {
                const c = centroid(byId.get(id).v.map((i) => P[i]));
                const r = Math.hypot(c[0], c[1]);
                if (r < best) {
                    best = r;
                    seedId = id;
                }
            }
        }

        const netId = nets.length;
        const net = { id: netId, faces: [seedId] };
        nets.push(net);
        const seed = byId.get(seedId);
        placed.set(seedId, {
            poly: placeSeed(seed, P),
            verts: seed.v.slice(),
            net: netId,
        });
        remaining.delete(seedId);

        const q = [seedId];
        for (let h = 0; h < q.length; h++) {
            const cur = q[h];
            const host = placed.get(cur);
            for (const link of nb.get(cur)) {
                if (!remaining.has(link.other)) continue;
                const cand = placeAcross(
                    byId.get(link.other),
                    P,
                    link.a,
                    link.b,
                    host.poly,
                    host.verts,
                );
                if (!cand) continue;
                const test = shrink(cand.poly, 0.94);
                let clash = false;
                for (const fid of net.faces) {
                    if (fid === cur) continue;
                    if (
                        convexOverlap(test, shrink(placed.get(fid).poly, 0.94))
                    ) {
                        clash = true;
                        break;
                    }
                }
                if (clash) continue;
                placed.set(link.other, { ...cand, net: netId });
                net.faces.push(link.other);
                remaining.delete(link.other);
                q.push(link.other);
            }
        }
    }
    return { placed, nets };
}

function bbox(polys) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const poly of polys)
        for (const q of poly) {
            x0 = Math.min(x0, q[0]);
            y0 = Math.min(y0, q[1]);
            x1 = Math.max(x1, q[0]);
            y1 = Math.max(y1, q[1]);
        }
    return { w: x1 - x0, h: y1 - y0 };
}

// ── run ───────────────────────────────────────────────────────────

const TARGETS = [
    ["Pe5", "star"],
    ["Pe3", "boat"],
    ["Pe1", "diamond"],
];

console.log(
    `BFS edge-unfolding — gen ${GEN}, side ${fmt(side.mm)} ${UNIT}, ` +
        `page ${pageName}` +
        (pageName === "none"
            ? ""
            : ` usable ${fmt(PAGE_W)}×${fmt(PAGE_H)} ${UNIT}`) +
        `\n`,
);

for (const [label, nick] of TARGETS) {
    const idx = seedTypes.findIndex((s) => s.label === label);
    const saved = console.log;
    console.log = () => {};
    generatePatch(idx, true, GEN);
    console.log = saved;

    const faces = buildFaces();
    const lift = computeLift();
    const P = lift.n.map((nv) => (nv ? pos3D(nv) : null));

    const interior = [...edgeMap.values()].filter(
        (e) => e.rhombIds.length === 2,
    ).length;

    console.log(`── ${label} (${nick}) ──`);
    console.log(
        `   ${faces.length} rhombi (${faces.filter((f) => f.thick).length}T/` +
            `${faces.filter((f) => !f.thick).length}t), ${vertexList.length} ` +
            `vertices, ${edgeMap.size} edges (${interior} interior)`,
    );

    const hist = {};
    for (const v of vertexList) hist[v.index] = (hist[v.index] ?? 0) + 1;
    console.log(
        `   lift: conflicts=${lift.conflicts} unmatched=${lift.unmatched} ` +
            `posErr=${lift.maxPosErr.toExponential(1)} ` +
            `index ${JSON.stringify(hist)}`,
    );

    const fh = foldAngles(faces, P);
    const folds = [...fh.entries()].sort((a, b) => a[0] - b[0]);
    console.log(
        `   folds: ${folds.map(([k, v]) => `${k}°×${v}`).join("  ")}`,
    );
    const illegal = folds.filter(([k]) => ![36, 72, 108].includes(k));
    if (illegal.length) {
        throw new Error(
            `illegal fold angles ${JSON.stringify(illegal)} — the lift is wrong`,
        );
    }
    if (folds.reduce((s, [, v]) => s + v, 0) !== interior) {
        throw new Error("fold count does not match interior edge count");
    }

    let best = null;
    for (const f of faces) {
        const run = unfold(faces, P, f.id);
        const primary = Math.max(...run.nets.map((n) => n.faces.length));
        const score = [run.nets.length, -primary];
        if (
            !best ||
            score[0] < best.score[0] ||
            (score[0] === best.score[0] && score[1] < best.score[1])
        ) {
            best = { ...run, score, seed: f.id };
        }
    }

    console.log(
        `   nets: ${best.nets.length}  (best of ${faces.length} seeds)`,
    );
    for (const net of best.nets) {
        const bb = bbox(net.faces.map((id) => best.placed.get(id).poly));
        const w = bb.w * side.mm;
        const h = bb.h * side.mm;
        const fits = w <= PAGE_W && h <= PAGE_H;
        const rot = h <= PAGE_W && w <= PAGE_H;
        console.log(
            `     net ${net.id}: ${String(net.faces.length).padStart(3)} rhombi, ` +
                `${fmt(w)}×${fmt(h)} ${UNIT}  ` +
                (pageName === "none"
                    ? ""
                    : fits
                      ? "fits"
                      : rot
                        ? "fits (rotated)"
                        : "TOO BIG"),
        );
    }
    console.log("");
}

// ── optional SVG output: --svg=DIR writes one file per sheet ───────
if (args.svg) {
    const dir = args.svg === true ? "out" : String(args.svg);
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { unfoldPatch, stripPatch } = await import("../dist/unfold.js");
    const useStrips = String(args.mode ?? "bfs") === "strips";
    const { layoutSheets, renderSheet } = await import("../dist/sheet.js");
    mkdirSync(dir, { recursive: true });
    let written = 0;
    for (const [label, nick] of TARGETS) {
        const idx = seedTypes.findIndex((s) => s.label === label);
        const saved = console.log;
        console.log = () => {};
        generatePatch(idx, true, GEN);
        console.log = saved;
        const res = useStrips ? stripPatch() : unfoldPatch();
        const { sheets, oversize } = layoutSheets(
            res.pieces,
            side.mm,
            PAGE_W,
            PAGE_H,
            6,
        );
        sheets.forEach((sh, i) => {
            const svg = renderSheet(sh, res.placed, res.creases, res.hinges, {
                sideMm: side.mm,
                pageW: pw,
                pageH: ph,
                margin: margin.mm,
                showFills: true,
                showAngles: Boolean(args.angles),
                showLegend: true,
            });
            const name = `${dir}/${nick}-gen${GEN}${useStrips ? "-strips" : ""}${sheets.length > 1 ? `-sheet${i + 1}` : ""}.svg`;
            writeFileSync(name, svg + "\n");
            console.log(`wrote ${name}`);
            written++;
        });
        if (oversize.length) {
            console.log(`  !! ${oversize.length} piece(s) too big for the page`);
        }
    }
    console.log(`\n${written} file(s) in ${dir}/`);
}
