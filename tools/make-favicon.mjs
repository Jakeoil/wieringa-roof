// Write favicon.svg, using the same generator the Utilities page previews with.
//
//   node tools/make-favicon.mjs [seed] [gen]
//
// Defaults to the Queen at generation 1, unfolded: ten rhombi filling under half
// their own bounding box, which is what still reads at sixteen pixels.

import { writeFileSync } from "node:fs";
import { iconSvg } from "../dist/favicon.js";

const seed = process.argv[2] ?? "Deca";
const gen = Number(process.argv[3] ?? 1);

const svg = iconSvg({
    seed,
    gen,
    subject: "net",
    colour: "cluster",
    stroke: 0,
    background: null,
    pad: 0.06,
    size: 64,
});

if (!svg) {
    console.error(`no icon for ${seed} generation ${gen} — is the patch empty?`);
    process.exit(1);
}

writeFileSync("favicon.svg", svg + "\n");

const polys = (svg.match(/<polygon/g) ?? []).length;
const cols = [...new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]))];
console.log(
    `favicon.svg: ${seed === "Deca" ? "Queen" : seed} gen ${gen} unfolded — ` +
        `${polys} rhombs, ${cols.length} colours (${cols.join(" ")}), ${svg.length} bytes`,
);
