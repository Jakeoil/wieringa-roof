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
import { triacontahedra, ownedFaceIndices, RHO, MIDRADIUS } from "./centers.js";
import { cutaway } from "./cutaway.js";
import { patchSize, patchBalls, MAX_GENERATION } from "./patchsize.js";
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
const cutModeSel = el<HTMLSelectElement>("cutmode");
const cutRadiusSel = el<HTMLSelectElement>("cutradius");
const cutFacesSel = el<HTMLSelectElement>("cutfaces");
const cutDetailSel = el<HTMLSelectElement>("cutdetail");
const statusEl = el<HTMLElement>("status");

// What the cutaway costs is clipping, not drawing: every triangle of every ball is tested
// against every neighbor plane. Measured at detail 3, a thousand balls is about half a
// second per rebuild, and it grows linearly in balls and fourfold per detail step. So the
// generations are ghosted on the **ball** count and the limits are tighter in cutaway
// mode than for plain spheres.
// The two vertex shells. There is no circumsphere — the solid is face-transitive and
// edge-transitive but not vertex-transitive, so its 32 vertices sit at two radii.
const VERT_OUTER = (1 + Math.sqrt(5)) / 2;                       // 12 fivefold vertices
const VERT_INNER = Math.sqrt(RHO * RHO + 1 / (VERT_OUTER * Math.sqrt(5))); // the other 20

const CUT_BUSY = 150;
const CUT_LIMIT = 1000;

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
    cutmode: "balls",
    cutradius: "rho",
    cutfaces: "all",
    cutdetail: "3",
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
let cache: {
    balls: Solid[];
    pk: ReturnType<typeof packing>;
    offset: [number, number, number];
    owned: number[][];
} | null = null;

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
        cache = {
            balls,
            pk: packing(cen, balls),
            offset: d ? d.offset : [0, 0, 0],
            // Worked out once with the patch rather than on every rebuild: it needs the
            // whole Centers structure and does not change while the patch stands.
            owned: balls.map((b) => ownedFaceIndices(cen, b)),
        };
    }
    const { balls, pk, offset, owned } = cache;
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
    const cutting = cutModeSel.value === "cut";
    let cutInfo = "";

    if (cutting && shown.length) {
        // Only the balls actually on screen are cut, but every ball is offered as a
        // cutter — a hidden neighbor still buries part of a visible sphere, and pretending
        // otherwise would show surface that is not really exposed.
        // The vertex shells are two, not one: the triacontahedron is not vertex-transitive
        // and has no circumsphere. 12 of its 32 vertices sit at φ and the other 20 at
        // 1.4733704, so both are offered rather than a made-up single figure.
        const radius = cutRadiusSel.value === "mid" ? MIDRADIUS
            : cutRadiusSel.value === "inner" ? VERT_INNER
            : cutRadiusSel.value === "outer" ? VERT_OUTER
            : cutRadiusSel.value === "custom" ? RHO * scale
            : RHO;
        const res = cutaway(balls, {
            radius,
            ownFacesOnly: cutFacesSel.value === "own",
            detail: Number(cutDetailSel.value),
            facesOf: (_b, i) => owned[i] ?? [],
        });
        const pos: number[] = [];
        const col: number[] = [];
        let exposedShown = 0;
        let bareShown = 0;
        for (const sp of res.spheres) {
            if (!keep[sp.ball]) continue;
            exposedShown += sp.area;
            bareShown += 4 * Math.PI * radius * radius;
            const c = colorOf(sp.ball);
            for (let i = 0; i < sp.positions.length; i += 3) {
                const p3 = place([sp.positions[i], sp.positions[i + 1], sp.positions[i + 2]]);
                pos.push(p3[0], p3[1], p3[2]);
                col.push(c.r, c.g, c.b);
            }
        }
        if (pos.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
            g.computeVertexNormals();
            rv.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.36, metalness: 0.04,
                side: THREE.DoubleSide, flatShading: false,
            })));
        }
        const label = cutRadiusSel.value === "mid" ? "midsphere"
            : cutRadiusSel.value === "inner" ? "inner vertex shell"
            : cutRadiusSel.value === "outer" ? "outer vertex shell φ"
            : cutRadiusSel.value === "custom" ? `${scale.toFixed(3)}ρ` : "insphere ρ";
        cutInfo = `cutaway at ${label} = ${radius.toFixed(4)} · ` +
            `${(pos.length / 9).toFixed(0)} triangles · ` +
            `exposed ${(100 * exposedShown / Math.max(1e-9, bareShown)).toFixed(1)}% of bare sphere` +
            `${cutFacesSel.value === "own" ? ", under owned rhombs only" : ""} · ` +
            `${res.cutPairs} cutting pairs · `;
    }

    if (!cutting && shown.length && scale > 0) {
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
        `${shown.length} balls${cutting ? "" : ` of radius ρ=${RHO.toFixed(4)}`} · ` +
        cutInfo +
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
if (!patchSel.value) patchSel.value = PREF_DEFAULTS.patch;

/**
 * Fill the generation list for the current patch and mode, ghosting what will not run.
 *
 * The limit depends on the mode. Drawing spheres is cheap and scales with the ball count;
 * cutting them is not, so in cutaway mode the ceiling drops by more than an order of
 * magnitude. Ghosting the choice is better than letting it be made and then quietly
 * doing something cheaper instead.
 */
function fillGenerations(prefer?: number): void {
    const code = patchSel.value || PREF_DEFAULTS.patch;
    const cutting = cutModeSel.value === "cut";
    const keep = prefer ?? Number(genSel.value);
    genSel.textContent = "";
    const usable = (g: number): boolean => {
        if (patchSize(code, g) <= 0) return false;
        if (!cutting) return patchSize(code, g) <= 45000;
        const b = patchBalls(code, g);
        return b > 0 && b <= CUT_LIMIT;
    };
    for (let g = 1; g <= MAX_GENERATION; g++) {
        const n = patchSize(code, g);
        const b = patchBalls(code, g);
        const o = document.createElement("option");
        o.value = String(g);
        if (n <= 0) {
            o.textContent = `Generation ${g} — none`;
            o.disabled = true;
            o.title = `${code} does not exist at generation ${g}`;
        } else if (!usable(g)) {
            o.textContent = `Generation ${g} — ${cutting && b > 0 ? `${b.toLocaleString()} balls` : `${n.toLocaleString()} rhombs`}`;
            o.disabled = true;
            o.title = cutting
                ? "too many balls to cut away — every triangle is clipped against every neighbor"
                : `${n.toLocaleString()} rhombs is past what this page can draw`;
        } else {
            const busy = cutting && b > CUT_BUSY;
            o.textContent = `Generation ${g} — ${b > 0 ? `${b.toLocaleString()} balls` : `${n.toLocaleString()} rhombs`}${busy ? " (slow)" : ""}`;
            o.title = `${n.toLocaleString()} rhombs, ${b > 0 ? b.toLocaleString() : "?"} proper solids`;
        }
        genSel.appendChild(o);
    }
    let g = keep || PREF_DEFAULTS.gen;
    if (!usable(g)) {
        let best = 0;
        for (let i = 1; i <= MAX_GENERATION; i++) if (usable(i) && (i <= g || best === 0)) best = i;
        g = best || 2;
    }
    genSel.value = String(g);
    if (!genSel.value) {
        const first = Array.from(genSel.options).find((o) => !o.disabled);
        if (first) genSel.value = first.value;
    }
}
colorSel.value = prefs.color || PREF_DEFAULTS.color;
sizeInput.value = String(prefs.size);
contactsChk.checked = prefs.contacts;
roofOnlyChk.checked = prefs.roofonly;
roofChk.checked = prefs.roof;
kissChk.checked = prefs.kiss;
biggestChk.checked = prefs.biggest;

cutModeSel.value = prefs.cutmode || PREF_DEFAULTS.cutmode;
cutRadiusSel.value = prefs.cutradius || PREF_DEFAULTS.cutradius;
cutFacesSel.value = prefs.cutfaces || PREF_DEFAULTS.cutfaces;
cutDetailSel.value = String(prefs.cutdetail ?? PREF_DEFAULTS.cutdetail);
for (const [sel, def] of [
    [cutModeSel, PREF_DEFAULTS.cutmode], [cutRadiusSel, PREF_DEFAULTS.cutradius],
    [cutFacesSel, PREF_DEFAULTS.cutfaces], [cutDetailSel, PREF_DEFAULTS.cutdetail],
] as Array<[HTMLSelectElement, string]>) if (!sel.value) sel.value = def;
fillGenerations(Number(prefs.gen) || PREF_DEFAULTS.gen);

function rebuild(reframe: boolean): void {
    sizeOut.textContent =
        `${Number(sizeInput.value).toFixed(2)}ρ = ${(RHO * Number(sizeInput.value)).toFixed(4)}`;
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
patchSel.addEventListener("change", () => { fillGenerations(); rebuild(true); });
genSel.addEventListener("change", () => rebuild(true));
cutModeSel.addEventListener("change", () => { fillGenerations(); rebuild(false); });
for (const c of [cutRadiusSel, cutFacesSel, cutDetailSel]) {
    c.addEventListener("change", () => rebuild(false));
}
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
        cutmode: cutModeSel.value, cutradius: cutRadiusSel.value,
        cutfaces: cutFacesSel.value, cutdetail: cutDetailSel.value,
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
