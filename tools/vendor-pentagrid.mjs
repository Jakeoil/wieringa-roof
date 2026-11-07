// Vendor the pentagrid library — the four modules of `lib/grow.js`'s closure, plus
// their typings.
//
//   node tools/vendor-pentagrid.mjs
//
// Two sources, in order: a **sibling checkout** at `../pentagrid` if there is one, and
// otherwise the **published site**. Local work then uses whatever is on disk, which may
// be ahead of the deploy, while CI — which has no sibling — fetches the same files
// GitHub Pages serves to anyone else. `npm run vendor` already does this shape for
// three.js out of `node_modules`; this is the same move with a second fallback,
// because pentagrid is not an npm package and `vendor/` is gitignored and rebuilt by
// the deploy workflow.
//
// The layout is preserved exactly — `lib/` beside `dist/geometry/` — because
// `grow.js` imports `../dist/geometry/*.js` by relative path and nothing rewrites it.

import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const FILES = [
    "lib/grow.js",
    "lib/grow.d.ts",
    "dist/geometry/growth.js",
    "dist/geometry/growth.d.ts",
    "dist/geometry/roof.js",
    "dist/geometry/roof.d.ts",
    "dist/geometry/pentagrid.js",
    "dist/geometry/pentagrid.d.ts",
    "dist/geometry/types.js",
    "dist/geometry/types.d.ts",
];
const OUT = "vendor/pentagrid";
const SIBLING = "../pentagrid";
const PUBLISHED = "https://jakeoil.github.io/pentagrid";

const local = existsSync(join(SIBLING, "lib/grow.js"));
let bytes = 0;
for (const f of FILES) {
    const dest = join(OUT, f);
    mkdirSync(dirname(dest), { recursive: true });
    if (local) {
        copyFileSync(join(SIBLING, f), dest);
    } else {
        const r = await fetch(`${PUBLISHED}/${f}`);
        if (!r.ok) throw new Error(`${PUBLISHED}/${f} -> ${r.status}`);
        const body = Buffer.from(await r.arrayBuffer());
        writeFileSync(dest, body);
        bytes += body.length;
    }
}
console.log(
    `vendored ${FILES.length} pentagrid files from ${local ? `${SIBLING} (sibling checkout)` : `${PUBLISHED} (published)`}` +
    (bytes ? `, ${(bytes / 1024).toFixed(1)} KB` : ""),
);
