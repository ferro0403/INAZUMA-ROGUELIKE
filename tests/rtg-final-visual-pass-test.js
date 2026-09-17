"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css", "rtg-theme.css"), "utf8");

assert(
  css.includes('url("../assets/home/inazuma-stadium-mobile-light.jpeg")'),
  "RTG run/squad/prematch should reuse the real mobile stadium background from the game assets"
);
assert(
  css.includes('url("../assets/home/inazuma-stadium-desktop-light.jpeg")'),
  "RTG should switch to the real desktop stadium background on wider screens"
);
assert(
  /\.rtg-prematch-shell\.rtg-prematch-revolution\s*>\s*\.rtg-prematch-topbar\s*\{[^}]*display\s*:\s*none\s*!important/s.test(css),
  "Pre-match must remove the redundant Road to Glory title band"
);
assert(
  /\.rtg-modal\s+\.rtg-catalog-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(2\s*,\s*minmax\(0\s*,\s*1fr\)\)\s*!important/s.test(css),
  "RTG player catalog must use a readable two-column mobile grid"
);
assert(
  /\.rtg-modal\s+\.rtg-catalog-grid\s+\.rtg-catalog-player-card\s*\{[^}]*width\s*:\s*min\(152px\s*,\s*100%\)\s*!important/s.test(css),
  "RTG catalog cards must not be forced into the old 64/66px tiny format"
);
assert(
  /\.rtg-vending-machine-v4\s*\{[^}]*width\s*:\s*230px\s*!important/s.test(css),
  "RTG vending machine should use the larger premium cabinet treatment"
);
assert(
  /\.rtg-vending-globe-v4\s*\{[^}]*border-radius\s*:\s*48%\s+48%\s+44%\s+44%/s.test(css),
  "RTG vending globe should read as a real capsule-machine globe"
);
assert(
  /\.rtg-match-shell\s+\.rtg-duel-result-banner\.is-win\s*\{[^}]*background\s*:\s*#d9efff\s*!important/s.test(css),
  "A duel won by the user should use the blue success banner background"
);
assert(
  /\.rtg-match-shell\s+\.rtg-duel-result-banner\.is-loss\s*\{[^}]*background\s*:\s*#ffe0dc\s*!important/s.test(css),
  "A duel won by the opponent should use the red loss banner background"
);

console.log("rtg-final-visual-pass-test: PASS");
