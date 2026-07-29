// Writes src/build-id.ts so the page can report which build it is running.
// Two debugging sessions have now been lost to a browser quietly serving a stale
// script; a stamp in the console settles it in one glance.
import { writeFileSync } from "node:fs";

const stamp = new Date().toISOString().slice(11, 19);
writeFileSync("src/build-id.ts", `export const BUILD_ID = "${stamp}";\n`);
console.log(`build id ${stamp}`);
