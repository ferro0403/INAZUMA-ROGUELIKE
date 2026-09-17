"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css", "rtg-theme.css"), "utf8");
const squadView = fs.readFileSync(path.join(root, "js", "road-to-glory", "rtg-squad-view.js"), "utf8");

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
  /compactPlayerCardMarkup\(player,\s*\{/s.test(squadView) && /playerCard\(entry,\s*"catalog"\)/s.test(squadView),
  "RTG catalog must reuse the game's existing compactPlayerCardMarkup renderer"
);
assert(
  /\.rtg-modal\s+\.rtg-catalog-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4\s*,\s*minmax\(0\s*,\s*84px\)\)\s*!important/s.test(css),
  "RTG catalog should use the same four-across compact-card footprint as the squad"
);
assert(
  !/\.rtg-modal\s+\.rtg-catalog-grid\s+\.rtg-catalog-player-card\s+\.player-portrait-wrap/.test(css),
  "RTG catalog must not override the normal card portrait anatomy"
);
assert(
  !css.includes("width:min(152px,100%)!important"),
  "RTG catalog must not force oversized 152px cards"
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
