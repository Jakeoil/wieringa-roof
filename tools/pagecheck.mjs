// Static checks on the page modules — the mistakes that leave a page silently blank.
//
//   node tools/pagecheck.mjs
//
// None of these are geometry. They are the wiring errors that survive a clean compile and
// a matching build stamp: the page loads, the controls appear, the console prints, and
// the canvas stays empty. Every one here has actually happened.

import { readFileSync, readdirSync } from "node:fs";

let bad = 0;
const fail = (m) => { bad++; console.log(`  ✗ ${m}`); };

const pages = readdirSync("src").filter((n) => n.endsWith(".ts"));
const html = readdirSync(".").filter((n) => n.endsWith(".html"));

// 1 · a roof view renders nothing until start(), and is unsized until resize(). Both are
//     single lines at the foot of a module, and both are invisible when absent.
let views = 0;
for (const f of pages) {
    const src = readFileSync(`src/${f}`, "utf8");
    if (!src.includes("createRoofView(") || f === "roofview.ts") continue;
    views++;
    for (const call of ["resize", "start"]) {
        if (!src.includes(`.${call}()`)) fail(`src/${f} opens a roof view but never calls ${call}()`);
    }
}

// 2 · every el<...>("id") must exist in the page that loads the module, or the page dies
//     on the first line of script with nothing drawn.
let ids = 0;
for (const page of html) {
    const body = readFileSync(page, "utf8");
    const m = /<script type="module" src="\.\/dist\/([A-Za-z0-9_-]+)\.js">/.exec(body);
    if (!m) continue;
    const modPath = `src/${m[1]}.ts`;
    let src;
    try { src = readFileSync(modPath, "utf8"); } catch { continue; }
    for (const g of src.matchAll(/\bel<[^>]*>\("([A-Za-z0-9_-]+)"\)/g)) {
        ids++;
        if (!body.includes(`id="${g[1]}"`)) fail(`${page} has no #${g[1]}, wanted by ${modPath}`);
    }
    // 3 · a <select> given a stored value no <option> carries reports "" and every
    //     comparison against it quietly fails. Each one needs an explicit fallback.
    for (const g of src.matchAll(/\bel<HTMLSelectElement>\("([A-Za-z0-9_-]+)"\)/g)) {
        const name = new RegExp(`const\\s+(\\w+)\\s*=\\s*el<HTMLSelectElement>\\("${g[1]}"\\)`).exec(src);
        if (!name) continue;
        const v = name[1];
        const assigns = src.includes(`${v}.value =`);
        // `x.value = prefs.y || DEFAULT` is not a guard. It covers a missing key, but not
        // the case that actually bites: a stored value whose <option> has since been
        // renamed or removed, which a select accepts and then reports as "". Only an
        // explicit `if (!x.value)` or a fallback loop counts.
        const guarded = src.includes(`!${v}.value`) || new RegExp(`\\[${v},`).test(src);
        if (assigns && !guarded) fail(`${modPath}: select ${v} restores a stored value with no fallback`);
    }
}

console.log(`${views} pages open a roof view · ${ids} element ids checked across ${html.length} pages`);
console.log(bad === 0 ? "all checks passed" : `${bad} FAILURES`);
process.exit(bad === 0 ? 0 : 1);
