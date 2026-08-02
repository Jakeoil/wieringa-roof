// Emit inline SVG for the three solids on polyhedra.html.
//
// The triacontahedron is built as a zonohedron on the six icosahedral 5-fold
// axes, so its faces are golden rhombi by construction rather than by hand-typed
// coordinates. The rhombohedra are parallelepipeds on three unit vectors with
// equal mutual angle (63.4349° acute, 116.5651° obtuse).
//
//   node tools/make-solid-svgs.mjs > /tmp/solids.svg

const PHI = (1 + Math.sqrt(5)) / 2;
const S5 = Math.sqrt(5);

const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(...a);
const norm = (a) => mul(a, 1 / len(a));

// ── the three solids ──────────────────────────────────────────────

function triacontahedron() {
    // six 5-fold axes: one per antipodal pair of icosahedron vertices
    const g = [
        [0, 1, PHI],
        [0, -1, PHI],
        [1, PHI, 0],
        [-1, PHI, 0],
        [PHI, 0, 1],
        [PHI, 0, -1],
    ].map(norm);

    const faces = [];
    for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
            for (const flip of [1, -1]) {
                const n = mul(cross(g[i], g[j]), flip);
                // the zonotope face for this pair sits at the extreme in +n
                let base = [0, 0, 0];
                for (let k = 0; k < 6; k++) {
                    if (k === i || k === j) continue;
                    base = add(base, mul(g[k], Math.sign(dot(n, g[k])) / 2));
                }
                const a = mul(g[i], 0.5);
                const b = mul(g[j], 0.5);
                faces.push([
                    sub(sub(base, a), b),
                    add(sub(base, b), a),
                    add(add(base, a), b),
                    sub(add(base, b), a),
                ]);
            }
        }
    }
    return faces;
}

function rhombohedron(acute) {
    const d = acute ? 1 / S5 : -1 / S5;
    const cosA = Math.sqrt((d + 0.5) / 1.5);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const v = [0, 1, 2].map((i) => {
        const t = (2 * Math.PI * i) / 3;
        return [sinA * Math.cos(t), sinA * Math.sin(t), cosA];
    });
    const faces = [];
    for (let k = 0; k < 3; k++) {
        const a = v[k];
        const b = v[(k + 1) % 3];
        const c = v[(k + 2) % 3];
        for (const off of [[0, 0, 0], c]) {
            faces.push([off, add(off, a), add(add(off, a), b), add(off, b)]);
        }
    }
    // center it
    const mid = mul(add(add(v[0], v[1]), v[2]), 0.5);
    return faces.map((f) => f.map((q) => sub(q, mid)));
}

// ── render ────────────────────────────────────────────────────────

function render(faces, opts) {
    const { size = 260, pad = 14, view, light = [0.4, 0.5, 1], hue } = opts;

    // orthographic frame looking along -view
    const w = norm(view);
    let up = [0, 0, 1];
    if (Math.abs(dot(w, up)) > 0.95) up = [0, 1, 0];
    const ex = norm(cross(up, w));
    const ey = cross(w, ex);
    const project = (q) => [dot(q, ex), -dot(q, ey), dot(q, w)];

    const projected = faces.map((f) => {
        const pts = f.map(project);
        const c = pts.reduce((s, q) => add(s, q), [0, 0, 0]).map((x) => x / 4);
        const n3 = norm(cross(sub(f[1], f[0]), sub(f[3], f[0])));
        const outward = dot(n3, f[0].map ? f[0] : n3) >= 0 ? n3 : mul(n3, -1);
        return { pts, depth: c[2], n: outward, center: c };
    });

    // convex: keep only faces whose outward normal points at the camera
    const visible = projected.filter((f) => dot(f.n, w) < -1e-9);
    visible.sort((a, b) => a.depth - b.depth);

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const f of projected)
        for (const q of f.pts) {
            x0 = Math.min(x0, q[0]);
            y0 = Math.min(y0, q[1]);
            x1 = Math.max(x1, q[0]);
            y1 = Math.max(y1, q[1]);
        }
    const scale = (size - 2 * pad) / Math.max(x1 - x0, y1 - y0);
    const ox = pad + (size - 2 * pad - (x1 - x0) * scale) / 2 - x0 * scale;
    const oy = pad + (size - 2 * pad - (y1 - y0) * scale) / 2 - y0 * scale;
    const to = (q) => [
        (q[0] * scale + ox).toFixed(2),
        (q[1] * scale + oy).toFixed(2),
    ];

    const L = norm(light);
    const out = [];
    for (const f of visible) {
        const lam = Math.max(0, dot(f.n, L));
        const lightness = 34 + 46 * lam;
        const fill = `hsl(${hue} 42% ${lightness.toFixed(1)}%)`;
        const pts = f.pts.map(to).map((q) => q.join(",")).join(" ");
        out.push(
            `    <polygon points="${pts}" fill="${fill}" stroke="hsl(${hue} 30% 22%)" stroke-width="1" stroke-linejoin="round"/>`,
        );
    }
    return { body: out.join("\n"), size };
}

const SOLIDS = [
    {
        id: "rt",
        label: "Rhombic triacontahedron",
        faces: triacontahedron(),
        view: [0.62, 0.42, 0.66],
        hue: 248,
    },
    {
        id: "acute",
        label: "Acute (prolate) rhombohedron",
        faces: rhombohedron(true),
        view: [0.72, 0.5, 0.48],
        hue: 208,
    },
    {
        id: "obtuse",
        label: "Obtuse (oblate) rhombohedron",
        faces: rhombohedron(false),
        view: [0.72, 0.5, 0.48],
        hue: 28,
    },
];

for (const s of SOLIDS) {
    const r = render(s.faces, { view: s.view, hue: s.hue });
    console.log(
        `<svg viewBox="0 0 ${r.size} ${r.size}" role="img" aria-label="${s.label}">`,
    );
    console.log(r.body);
    console.log(`</svg>`);
    console.log("");
}

// sanity report to stderr
for (const s of SOLIDS) {
    const edges = new Set();
    let minE = Infinity;
    let maxE = -Infinity;
    const angles = new Set();
    for (const f of s.faces) {
        for (let i = 0; i < 4; i++) {
            const a = f[i];
            const b = f[(i + 1) % 4];
            const l = len(sub(b, a));
            minE = Math.min(minE, l);
            maxE = Math.max(maxE, l);
            const c = f[(i + 3) % 4];
            const u = norm(sub(b, a));
            const v = norm(sub(c, a));
            angles.add(((Math.acos(dot(u, v)) * 180) / Math.PI).toFixed(4));
        }
        edges.add(f.length);
    }
    process.stderr.write(
        `${s.id}: ${s.faces.length} faces, edge ${minE.toFixed(6)}..${maxE.toFixed(6)}, ` +
            `corner angles {${[...angles].sort().join(", ")}}\n`,
    );
}
