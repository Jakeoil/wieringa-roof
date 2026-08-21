// Chapter 3 — the Penrose ping-pong packing.
//
// The centers page uses the balls to explain the roof. This one turns that round: the
// balls are the object, and the roof is a slice through them. Every ball is the
// insphere of one triacontahedron, all of one radius ρ = √(1 + 2/√5), tangent to the
// roof at the exact center of every rhomb its solid carries.
//
// What the packing is, measured: contacts are exact tangencies at 2ρ, always along a
// face normal, so the polyhedra meet face to face. Coordination is only ever 0, 2, 3
// or 4 — never 1, never above 4 — which is far short of the kissing number 12 and
// makes this a sparse network rather than a dense packing. Only about a quarter of the
// contacts happen on the roof; the rest are on faces the surface never reaches.

import * as THREE from "three";
import { loadPrefs, savePrefs, resetPrefs } from "./prefs.js";
import { BUILD_ID } from "./build-id.js";
import { seedTypes, generatePatch, allRhombs } from "./geometry.js";
import { buildRoof } from "./roofgeom.js";
import { createRoofView, PLAIN_COLOR } from "./roofview.js";
import { triacontahedra, RHO } from "./centers.js";
import { packing, properBalls } from "./packing.js";
import type { Solid } from "./centers.js";

const el = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`missing element #${id} (stale cached script?)`);
    return found as T;
};

const view = el<HTMLDivElement>("view");
const patchSel = el<HTMLSelectElement>("patch");
const genSel = el<HTMLSelectElement>("gen");
const colorSel = el<HTMLSelectElement>("color");
const sizeInput = el<HTMLInputElement>("size");
const sizeOut = el<HTMLElement>("sizeOut");
const contactsChk = el<HTMLInputElement>("contacts");
const roofOnlyChk = el<HTMLInputElement>("roofonly");
const roofChk = el<HTMLInputElement>("roof");
const kissChk = el<HTMLInputElement>("kiss");
const biggestChk = el<HTMLInputElement>("biggest");
const statusEl = el<HTMLElement>("status");

const PREFS_KEY = "wr-packing";
const PREF_DEFAULTS = {
    patch: "Sun",
    gen: 3,
    color: "coord",
    size: 1,
    contacts: true,
    roofonly: false,
    roof: false,
    kiss: true,
    biggest: false,
};
const prefs = loadPrefs(PREFS_KEY, PREF_DEFAULTS);
const rv = createRoofView(view, 0xf7f6f2);

// Coordination is the packing's own property, so it gets the strongest palette. Only
// four values occur.
const COORD: Record<number, THREE.Color> = {
    0: new THREE.Color(0xc9cad2),
    2: new THREE.Color(0xe0a12b),
    3: new THREE.Color(0x8b4fc8),
    4: new THREE.Color(0x2f6fb5),
};
const CLASS_COLOR: Record<string, THREE.Color> = {
    "4=4T+0t": new THREE.Color(0xe0a12b),
    "5=5T+0t": new THREE.Color(0x3f9d58),
    "5=3T+2t": new THREE.Color(0x8b4fc8),
    "10=5T+5t": new THREE.Color(0x2f6fb5),
};
const ON_ROOF = new THREE.Color(0xd1477a);
const OFF_ROOF = new THREE.Color(0x7d8fa8);

const BALL_GEO = new THREE.IcosahedronGeometry(1, 3);

let patchKey = "";
function ensurePatch(): void {
    const key = `${patchSel.value}|${genSel.value}`;
    if (patchKey === key) return;
    const quiet = console.log;
    console.log = () => {};
    generatePatch(seedTypes.findIndex((s) => s.label === patchSel.value), true, Number(genSel.value));
    console.log = quiet;
    patchKey = key;
    cache = null;
}
let cache: { balls: Solid[]; pk: ReturnType<typeof packing>; offset: [number, number, number] } | null = null;

function build(reframe: boolean): void {
    const t0 = performance.now();
    ensurePatch();
    if (allRhombs.length === 0) {
        statusEl.textContent = `${patchSel.value} generation ${genSel.value}: no rhombs yet — try a later generation.`;
        rv.renderer.render(rv.scene, rv.camera);
        return;
    }
    if (!cache) {
        const cen = triacontahedra();
        const balls = properBalls(cen);
        const d = buildRoof(1, false);
        cache = { balls, pk: packing(cen, balls), offset: d ? d.offset : [0, 0, 0] };
    }
    const { balls, pk, offset } = cache;
    const place = (c: readonly number[]): [number, number, number] => [
        c[0] - offset[0], c[1] - offset[1], c[2] - offset[2],
    ];

    // The largest contact component, when asked for. The network is fragmented — 410
    // components at Sun generation 4, the biggest holding 41% — so isolating it is the
    // only way to see its shape.
    const adj: number[][] = balls.map(() => []);
    for (const c of pk.contacts) { adj[c.a].push(c.b); adj[c.b].push(c.a); }
    let keep: boolean[] = balls.map(() => true);
    if (biggestChk.checked) {
        const seen = balls.map(() => false);
        let best: number[] = [];
        for (let i = 0; i < balls.length; i++) {
            if (seen[i]) continue;
            const comp: number[] = [];
            const st = [i]; seen[i] = true;
            while (st.length) { const x = st.pop()!; comp.push(x); for (const y of adj[x]) if (!seen[y]) { seen[y] = true; st.push(y); } }
            if (comp.length > best.length) best = comp;
        }
        keep = balls.map(() => false);
        for (const i of best) keep[i] = true;
    }
    if (roofOnlyChk.checked) {
        const touched = balls.map(() => false);
        for (const c of pk.contacts) if (c.onRoof !== null) { touched[c.a] = true; touched[c.b] = true; }
        keep = keep.map((k, i) => k && touched[i]);
    }

    const mode = colorSel.value;
    const scale = Number(sizeInput.value);
    const colorOf = (i: number): THREE.Color => {
        if (mode === "class") return CLASS_COLOR[balls[i].makeup] ?? OFF_ROOF;
        if (mode === "side") return balls[i].hat ? OFF_ROOF : ON_ROOF;
        return COORD[pk.degree[i]] ?? OFF_ROOF;
    };

    const shown = balls.map((_, i) => i).filter((i) => keep[i]);
    if (shown.length && scale > 0) {
        const mesh = new THREE.InstancedMesh(
            BALL_GEO,
            new THREE.MeshStandardMaterial({
                roughness: 0.36, metalness: 0.04,
                transparent: scale < 0.999, opacity: scale < 0.999 ? 0.95 : 0.72,
                depthWrite: true,
            }),
            shown.length,
        );
        const m = new THREE.Matrix4();
        shown.forEach((bi, k) => {
            const r = RHO * scale;
            const p = place(balls[bi].c);
            m.makeScale(r, r, r).setPosition(p[0], p[1], p[2]);
            mesh.setMatrixAt(k, m);
            mesh.setColorAt(k, colorOf(bi));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        rv.add(mesh);
    }

    // Struts between kissing centers. Colored by whether the kiss lands on the roof —
    // a contact on the roof is a shared rhomb, and there are far fewer of those than
    // there are contacts.
    if (contactsChk.checked) {
        const seg: number[] = [];
        const col: number[] = [];
        for (const c of pk.contacts) {
            if (!keep[c.a] || !keep[c.b]) continue;
            const a = place(balls[c.a].c);
            const b = place(balls[c.b].c);
            const t = c.onRoof !== null ? ON_ROOF : OFF_ROOF;
            seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
            col.push(t.r, t.g, t.b, t.r, t.g, t.b);
        }
        if (seg.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
            g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
            rv.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })));
        }
    }

    // A dot at each kiss point. On the roof these sit exactly at a rhomb's center.
    if (kissChk.checked) {
        const pts: number[] = [];
        const col: number[] = [];
        for (const c of pk.contacts) {
            if (!keep[c.a] || !keep[c.b]) continue;
            const p = place(c.at);
            const t = c.onRoof !== null ? ON_ROOF : OFF_ROOF;
            pts.push(p[0], p[1], p[2]);
            col.push(t.r, t.g, t.b);
        }
        if (pts.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
            g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
            rv.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, sizeAttenuation: true })));
        }
    }

    if (roofChk.checked) {
        const d = buildRoof(1, false);
        if (d) {
            rv.drawRoof(d, {
                colorOf: () => new THREE.Color(PLAIN_COLOR),
                shade: 0, useVertexColors: false, flatColor: PLAIN_COLOR,
                transparent: true, edges: false, isoglosses: false,
            });
        }
    }

    if (reframe) {
        let r = 0;
        for (const i of shown) {
            const p = place(balls[i].c);
            r = Math.max(r, Math.hypot(p[0], p[1], p[2]) + RHO);
        }
        rv.frame(r || 6);
    }

    const h: Record<number, number> = {};
    for (let i = 0; i < balls.length; i++) if (keep[i]) h[pk.degree[i]] = (h[pk.degree[i]] ?? 0) + 1;
    const onRoof = pk.contacts.filter((c) => c.onRoof !== null).length;
    statusEl.textContent =
        `${shown.length} balls of radius ρ=${RHO.toFixed(4)} · ` +
        `${pk.contacts.length} contacts, ${onRoof} of them on the roof · ` +
        `${pk.overlapPairs} overlapping pairs · ` +
        `coordination ${JSON.stringify(h)} · ` +
        `${pk.components} components, largest ${pk.largest} · ` +
        `${Math.round(performance.now() - t0)} ms`;
}

for (const [code, nick] of [
    ["Pe5", "Pe5 pentagon"], ["Pe3", "Pe3 pentagon"], ["Pe1", "Pe1 pentagon"],
    ["St5", "St5 star"], ["St3", "St3 boat"], ["St1", "St1 diamond"],
    ["Deca", "Queen (composite)"], ["Sun", "Sun (composite)"], ["Star", "Star (composite)"],
] as Array<[string, string]>) {
    const o = document.createElement("option");
    o.value = code; o.textContent = nick; patchSel.appendChild(o);
}
patchSel.value = prefs.patch || PREF_DEFAULTS.patch;
for (const g of [2, 3, 4, 5]) {
    const o = document.createElement("option");
    o.value = String(g); o.textContent = `Generation ${g}`; genSel.appendChild(o);
}
genSel.value = String(prefs.gen);
if (!genSel.value) genSel.value = String(PREF_DEFAULTS.gen);
colorSel.value = prefs.color || PREF_DEFAULTS.color;
sizeInput.value = String(prefs.size);
contactsChk.checked = prefs.contacts;
roofOnlyChk.checked = prefs.roofonly;
roofChk.checked = prefs.roof;
kissChk.checked = prefs.kiss;
biggestChk.checked = prefs.biggest;

function rebuild(reframe: boolean): void {
    sizeOut.textContent = `${Number(sizeInput.value).toFixed(2)}ρ`;
    if (`${patchSel.value}|${genSel.value}` !== patchKey) {
        rv.clear();
        statusEl.textContent = `building ${patchSel.value} generation ${genSel.value}…`;
        rv.renderer.render(rv.scene, rv.camera);
        requestAnimationFrame(() => build(reframe));
        return;
    }
    rv.clear();
    build(reframe);
}
for (const c of [patchSel, genSel]) c.addEventListener("change", () => rebuild(true));
for (const c of [colorSel, contactsChk, roofOnlyChk, roofChk, kissChk, biggestChk]) {
    c.addEventListener("change", () => rebuild(false));
}
sizeInput.addEventListener("input", () => rebuild(false));

function persist(): void {
    savePrefs(PREFS_KEY, {
        patch: patchSel.value, gen: Number(genSel.value), color: colorSel.value,
        size: Number(sizeInput.value), contacts: contactsChk.checked,
        roofonly: roofOnlyChk.checked, roof: roofChk.checked,
        kiss: kissChk.checked, biggest: biggestChk.checked,
    });
}
window.addEventListener("beforeunload", persist);
window.addEventListener("pagehide", persist);
el<HTMLButtonElement>("reset").addEventListener("click", () => {
    if (confirm("Reset the packing view to default settings?")) {
        window.removeEventListener("beforeunload", persist);
        window.removeEventListener("pagehide", persist);
        resetPrefs(PREFS_KEY);
    }
});
window.addEventListener("resize", () => rv.resize());

console.log(`packing build ${BUILD_ID}`);
{
    const tag = document.getElementById("buildtag");
    if (tag) tag.textContent = `· build ${BUILD_ID}`;
}
rv.resize();
rebuild(true);
rv.start();
