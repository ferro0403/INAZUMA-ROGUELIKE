"use strict";

const assert = require("assert");
const fs = require("fs");

const index = fs.readFileSync("index.html", "utf8");
const cssPath = "css/rtg-duel-ivory-gold.css";

assert.match(
  index,
  /css\/rtg-duel-ivory-gold\.css\?v=20260917-figma-ivory-gold-1/,
  "index.html must load the Figma-derived RTG duel stylesheet after road-to-glory.css"
);
assert.ok(fs.existsSync(cssPath), "Figma-derived RTG duel stylesheet must exist");

const css = fs.readFileSync(cssPath, "utf8");

assert.match(css, /--rtg-duel-bg:\s*#f4eedc/i);
assert.match(css, /--rtg-duel-surface:\s*#fffdf7/i);
assert.match(css, /--rtg-duel-ink:\s*#111214/i);
assert.match(css, /--rtg-duel-gold:\s*#e5c65b/i);
assert.match(css, /--rtg-duel-gold-deep:\s*#c9a227/i);

assert.match(css, /\.rtg-duel-card--revolution/);
assert.match(css, /\.rtg-duel-choice-card\.is-selected/);
assert.match(css, /\.rtg-duel-versus-board--resolving/);
assert.match(css, /\.rtg-duel-versus-board--result/);
assert.match(css, /\.is-duel-winner/);
assert.match(css, /\.is-duel-loser/);
assert.match(css, /opacity:\s*\.58/i);
assert.match(css, /border[^;]*#c9a227/i);

assert.match(
  css,
  /--category-accent:\s*var\(--rtg-duel-gold-deep\)/i,
  "special moves must use the approved gold accent instead of category blue/red/green"
);

assert.match(css, /@media\s*\(max-width:\s*430px\)/i);

console.log("rtg-duel-ivory-gold-style-test: PASS");
