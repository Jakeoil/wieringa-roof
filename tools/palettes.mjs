// palettes.yaml -> src/palettes.ts
//
//   node tools/palettes.mjs
//
// Run by `npm run build`, the same way `stamp.mjs` generates the build id. Generating
// a module rather than fetching the file at runtime keeps a YAML parser out of the
// browser, keeps `geometry.ts` synchronous — everything imports it, and making it
// async would ripple through every page — and keeps the probes under `tools/` working,
// since they import `dist/geometry.js` under node with no document to fetch from.
//
// **This reads a strict subset of YAML and refuses the rest**, with a line number.
// Hand-written YAML parsers are a well-known way to be wrong quietly; this one is
// allowed to be small precisely because anything it does not recognize is an error
// rather than a guess. The subset is: comments, blank lines, a top-level `id:` with
// nothing after it, and two-space-indented `label: text` or `colors: [ ... ]`.

import { readFileSync, writeFileSync } from "node:fs";

const SRC = "palettes.yaml";
const OUT = "src/palettes.ts";

const lines = readFileSync(SRC, "utf8").split(/\r?\n/);
const palettes = [];
let cur = null;
let bad = 0;
const fail = (n, msg) => {
    bad++;
    console.error(`  ${SRC}:${n + 1}: ${msg}`);
};

lines.forEach((raw, n) => {
    const line = raw.replace(/\s+$/, "");
    if (!line || /^\s*#/.test(line)) return;

    const top = /^([A-Za-z][\w-]*):$/.exec(line);
    if (top) {
        cur = { id: top[1], label: "", colors: [] };
        palettes.push({ ...cur, line: n });
        cur = palettes[palettes.length - 1];
        return;
    }

    const field = /^ {2}([a-z]+):\s*(.*)$/.exec(line);
    if (!field) return fail(n, `not a palette id or a two-space field: ${JSON.stringify(line)}`);
    if (!cur) return fail(n, "a field before any palette");

    const [, key, value] = field;
    if (key === "label") {
        cur.label = value.replace(/^["']|["']$/g, "");
    } else if (key === "colors") {
        const m = /^\[(.*)\]$/.exec(value);
        if (!m) return fail(n, "colors must be an inline list: [\"#rrggbb\", …]");
        cur.colors = m[1]
            .split(",")
            .map((x) => x.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
    } else {
        fail(n, `unknown field "${key}" — only label and colors`);
    }
});

const seen = new Set();
for (const p of palettes) {
    if (seen.has(p.id)) fail(p.line, `duplicate palette id "${p.id}"`);
    seen.add(p.id);
    if (!p.label) fail(p.line, `"${p.id}" has no label`);
    if (!p.colors.length) fail(p.line, `"${p.id}" has no colors`);
    for (const c of p.colors)
        if (!/^#[0-9a-fA-F]{6}$/.test(c)) fail(p.line, `"${p.id}": ${c} is not #rrggbb`);
}
if (!palettes.length) fail(0, "no palettes at all");
if (bad) {
    console.error(`\n${bad} problem${bad === 1 ? "" : "s"} — src/palettes.ts not written`);
    process.exit(1);
}

const body = palettes
    .map(
        (p) =>
            `    {\n        value: ${JSON.stringify(p.id)},\n` +
            `        label: ${JSON.stringify(p.label)},\n` +
            `        colors: [${p.colors.map((c) => JSON.stringify(c)).join(", ")}],\n    },`,
    )
    .join("\n");

writeFileSync(
    OUT,
    `// Generated from ${SRC} by tools/palettes.mjs. Do not edit — edit the YAML.\n\n` +
        `export interface Palette {\n    value: string;\n    label: string;\n` +
        `    colors: readonly string[];\n}\n\n` +
        `export const PALETTES: readonly Palette[] = [\n${body}\n];\n`,
);

const short = palettes.filter((p) => p.colors.length < 5).map((p) => p.id);
console.log(
    `palettes: ${palettes.length} (${palettes.map((p) => `${p.id}[${p.colors.length}]`).join(" ")})` +
        (short.length ? `\n  under five colors, so not offered to Kowalewski: ${short.join(", ")}` : ""),
);
