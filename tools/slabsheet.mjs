// The slab, printed by the roof's own sheet machinery.
//
//   node tools/slabsheet.mjs
//
// HEXAHEDRA.md task 2. `sheet.ts` and `paginate.ts` were written for the roof and
// their comments said "tiling vertex id" throughout, which read like a requirement.
// It is not one: nothing downstream asks what an id means, only that two faces meeting
// at a corner name it the same. So the slab needs no refactor of that machinery — it
// needs to number its own corners, which `slabDocument` does by position.
//
// This is the check that the claim is true rather than plausible: a slab, with floor
// faces and wall faces that are not rhombi at all, goes through `layoutSheets` and
// `renderSheet` and a sheet comes out with every face, every crease and every cut on
// it. Writes out/pe1-sheets.svg to look at.

import { writeFileSync } from "node:fs";
import { generatePatch, allRhombs, seedTypes } from "../dist/geometry.js";
import { slab, slabDocument } from "../dist/slab.js";
import { bestUnfold } from "../dist/solidnet.js";
import { MM_PER_IN } from "../dist/sheet.js";
import { paginateBest, renderPage, TAB_MM } from "../dist/paginate.js";

const quiet = (f) => { const l = console.log; console.log = () => {}; const r = f(); console.log = l; return r; };
const idx = (l) => seedTypes.findIndex((s) => s.label === l);

const SIDE = MM_PER_IN;            // 1 in
const PAGE = [215.9, 279.4];
const MARGIN = 12;

let bad = 0;
const fail = (m) => { bad++; console.log(`  x ${m}`); };

console.log("patch gen  faces  pieces  sheets  faces drawn  creases drawn  cuts drawn");
console.log("-".repeat(78));

let firstSvg = null;
for (const [label, gen, how] of [
    ["Pe1", 1, "whole"], ["Pe1", 2, "whole"], ["St1", 2, "whole"],
    ["Pe1", 2, "documents"], ["Pe3", 2, "documents"], ["St5", 2, "documents"],
]) {
    quiet(() => generatePatch(idx(label), true, gen));
    if (!allRhombs.length) continue;
    const S = slab();

    // "whole" unfolds the closed solid in one go; "documents" keeps heads, tails and
    // the collar apart, which is what a big model wants (HEXAHEDRA.md Part 4).
    const groups = how === "whole" ? [S.faces] : [S.top, S.floor, S.wall];
    const svgs = [];
    let faces = 0, pieces = 0, sheetCount = 0, drawnFaces = 0, drawnCreases = 0, drawnCuts = 0;

    // Pagination rather than plain packing: a gen-2 collar is 17.9 side lengths long
    // and no page holds it whole, so the net has to be split along hinges and the
    // severed ones lettered. That is `paginate.ts`, and it takes the same document.
    const ekey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const usableW = (PAGE[0] - 2 * MARGIN - 2 * TAB_MM) / SIDE;
    const usableH = (PAGE[1] - 2 * MARGIN - 2 * TAB_MM) / SIDE;
    let joins = 0;

    for (const g of groups) {
        const net = bestUnfold(g);
        const doc = slabDocument(S, net);
        faces += g.length;
        pieces += doc.pieces.length;

        const pg = paginateBest(doc.placed, doc.hinges, usableW, usableH, ekey);
        if (!pg.fits) { fail(`${label} g${gen} ${how}: a single face will not fit the page`); continue; }
        sheetCount += pg.pages.length;
        joins += pg.joins.length;

        for (let i = 0; i < pg.pages.length; i++) {
            const svg = renderPage(pg, i, doc.placed, doc.creases, doc.hinges, ekey, {
                sideMm: SIDE, pageW: PAGE[0], pageH: PAGE[1], margin: MARGIN,
                fillMode: "groups", indexOf: doc.indexOf, indexRange: doc.indexRange,
                shading: true, showLegend: true, standalone: true,
            });
            svgs.push(svg);
            drawnFaces += (svg.match(/<polygon/g) ?? []).length;
            drawnCreases += (svg.match(/stroke-dasharray/g) ?? []).length;
            drawnCuts += (svg.match(/<line/g) ?? []).length;
        }
        // pages = joins + 1, per piece: the hinges are a spanning tree, so removing k
        // of them gives exactly k+1 components.
        if (pg.pages.length !== pg.joins.length + 1)
            fail(`${label} g${gen} ${how}: ${pg.pages.length} pages against ${pg.joins.length} joins`);
    }

    // Every face has to reach a sheet. A face silently dropped is exactly the failure
    // this whole exercise is about, and it would look like a perfectly good sheet.
    const onSheets = new Set();
    for (const g of groups) for (const f of g) onSheets.add(f.id);
    if (onSheets.size !== faces) fail(`${label} g${gen} ${how}: ${onSheets.size} of ${faces} faces reached a sheet`);
    // A face split across pages is drawn once per page it appears on, never fewer
    // times than there are faces.
    if (drawnFaces < faces) fail(`${label} g${gen} ${how}: ${drawnFaces} polygons drawn for ${faces} faces`);
    if (!drawnCreases) fail(`${label} g${gen} ${how}: no creases drawn`);

    console.log(
        `${label.padEnd(5)} ${gen}  ${how.padEnd(10)} ${String(faces).padStart(4)} ` +
        `${String(pieces).padStart(6)} ${String(sheetCount).padStart(6)} ` +
        `${String(drawnFaces).padStart(11)} ${String(drawnCreases).padStart(13)} ${String(drawnCuts).padStart(10)}` +
        `  ${joins} joins`,
    );
    if (!firstSvg && how === "whole" && label === "Pe1" && gen === 1) firstSvg = svgs[0];
}

if (firstSvg) {
    writeFileSync("out/pe1-sheets.svg", firstSvg);
    console.log("\nwrote out/pe1-sheets.svg — Pe1 gen 1, the whole slab as one piece,");
    console.log("drawn by the site's own renderPage rather than by hand.");
}
console.log(bad ? `\n${bad} problem${bad === 1 ? "" : "s"}` : "\nall checks passed");
