"use strict";

const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const core = fs.readFileSync("css/rtg-theme-core.css", "utf8");

assert(
  /css\/rtg-theme\.css\?v=20260920-mobile-consistency-1/.test(index),
  "index must cache-bust the current RTG theme so every device gets the same catalog layout"
);
assert(
  /\.rtg-modal\s+\.rtg-catalog-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4\s*,\s*minmax\(0\s*,\s*84px\)\)\s*!important/s.test(core),
  "RTG catalog must keep the approved four-across layout shown in the reference screenshot"
);
assert(
  /\.rtg-duel-card--clean\s+\.rtg-choice-copy\s+strong\s*\{[^}]*overflow-wrap\s*:\s*normal\s*!important[^}]*word-break\s*:\s*normal\s*!important[^}]*white-space\s*:\s*normal\s*!important/s.test(core),
  "move names must wrap only at normal word boundaries instead of stacking letters vertically"
);

console.log("rtg-mobile-asset-consistency-test: PASS");
