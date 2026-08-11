"use strict";

const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("css/five-match-banner-clean.css", "utf8");
const gameCss = fs.readFileSync("css/game.css", "utf8");
const bridge = fs.readFileSync("js/five-match-banner-clean.js", "utf8");
const freeAgentsEmblem = fs.readFileSync("assets/emblems/free-agents.svg", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert(css.includes(".five-match-versus-card"), "clean banner must use a unique root class");
assert(!css.includes(".five-match-vs .five-match-team"), "clean banner CSS must not reuse legacy matchup selectors");
assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 90px minmax\(0, 1fr\);/, "clean banner must use equal sides around a fixed center");
assert.match(css, /five-match-versus-side--user[\s\S]*five-match-versus-name[\s\S]*right:/, "user name must anchor toward the center from the upper area");
assert.match(css, /five-match-versus-side--user[\s\S]*five-match-versus-emblem[\s\S]*left:/, "user emblem must anchor toward the outer left edge");
assert.match(css, /five-match-versus-side--opponent[\s\S]*five-match-versus-name[\s\S]*left:/, "opponent name must anchor toward the center from the upper area");
assert.match(css, /five-match-versus-side--opponent[\s\S]*five-match-versus-emblem[\s\S]*right:/, "opponent emblem must anchor toward the outer right edge");
assert.match(css, /five-match-versus-center::before[\s\S]*clip-path: polygon\(20% 0, 100% 0, 80% 100%, 0 100%\)/, "center must be the broad black trapezoid");
assert(!css.includes(".five-match-versus-card::after"), "banner must not draw the stray yellow accent under the opponent emblem");
assert.match(css, /five-match-versus-side--opponent::before,[\s\S]*five-match-versus-side--opponent::after\s*\{\s*content: none;\s*display: none;/, "opponent side must suppress inherited decorative pseudo-elements");
assert.match(gameCss, /\.five-match-hero-band\s*\{[^}]*overflow:\s*hidden;/, "match header band must clip its contents");
assert.match(gameCss, /\.five-match-hero-band::after\s*\{\s*content:\s*none;\s*display:\s*none;\s*\}/, "match header band must not render the yellow corner decoration");
assert(!freeAgentsEmblem.includes("#ffd21f"), "free-agents emblem must not contain stray yellow bars");
assert(bridge.includes("cloneNode(true)"), "dynamic emblem image must be cloned with its resolver/fallback attributes intact");
assert(bridge.includes(".five-match-screen .five-match-hero > .five-match-vs"), "bridge must only replace the 5v5 hero matchup, not other match UI");
assert(index.includes("css/five-match-banner-clean.css"), "clean banner stylesheet must be loaded");
assert(index.includes("js/five-match-banner-clean.js"), "clean banner renderer must be loaded");
assert(index.indexOf("css/five-match-banner-clean.css") > index.indexOf("css/five-match-reference-polish.css"), "clean CSS must load after legacy banner CSS");

console.log("five-match-banner-clean-test: isolated screen-2 banner component OK");
