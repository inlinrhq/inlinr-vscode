// Converts icon.svg → icon.png (128×128) for the VS Code Marketplace.
// Run once before first publish, then re-run only when the SVG changes.

import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync("icon.svg", "utf8");
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 128 } });
const png = resvg.render().asPng();
writeFileSync("icon.png", png);
console.log(`wrote icon.png (${png.length} bytes)`);
