"use strict";

const fs = require("fs");
const assert = require("assert");

const theme = fs.readFileSync("css/rtg-theme.css", "utf8");

assert(
  /rtg-theme-core\.css\?v=20260920-mobile-consistency-1/.test(theme),
  "final RTG theme must cache-bust its imported core stylesheet"
);
assert(
  /\.rtg-modal\s+\.rtg-catalog-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4\s*,\s*minmax\(0\s*,\s*84px\)\)\s*!important/s.test(theme),
  "RTG catalog must keep the approved four-across layout shown in the reference screenshot"
);
assert(
  /\.rtg-duel-card--clean\s+\.rtg-choice-copy\s+strong\s*\{[^}]*overflow-wrap\s*:\s*normal\s*!important[^}]*word-break\s*:\s*normal\s*!important[^}]*white-space\s*:\s*normal\s*!important/s.test(theme),
  "move names must wrap only at normal word boundaries instead of stacking letters vertically"
);

console.log("rtg-mobile-asset-consistency-test: PASS");
