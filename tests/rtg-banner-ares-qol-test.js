"use strict";

const assert = require("assert");
const fs = require("fs");

const runCss = fs.readFileSync("css/rtg-run.css", "utf8");
const themeCss = fs.readFileSync("css/rtg-theme.css", "utf8");
const rtgConfig = fs.readFileSync("js/road-to-glory/rtg-config.js", "utf8");
const albumController = fs.readFileSync("js/album/album-controller.js", "utf8");
const indexHtml = fs.readFileSync("index.html", "utf8");

const completionRail = runCss.match(/\.rtg-journey-summary--complete::before\s*\{([^}]*)\}/s)?.[1] || "";
assert(/width\s*:\s*9px/.test(completionRail), "Completed-season hero must keep the narrow yellow rail");
assert(/height\s*:\s*auto/.test(completionRail), "Completed-season rail must reset the generic hero fixed height");
assert(/border\s*:\s*0/.test(completionRail), "Completed-season rail must reset the generic hero border");
assert(/transform\s*:\s*none/.test(completionRail), "Completed-season rail must reset the generic hero rotation");

assert(
  !/\.rtg-squad-shell\.rtg-squad-shell--ares\s*\{[^}]*image\.tmdb\.org/s.test(themeCss),
  "Ares squad must not replace the canonical RTG stadium background with season artwork"
);
assert(themeCss.includes('url("../assets/home/inazuma-stadium-mobile-light.jpeg")'), "RTG squad must retain the canonical mobile stadium background");
assert(themeCss.includes('url("../assets/home/inazuma-stadium-desktop-light.jpeg")'), "RTG squad must retain the canonical desktop stadium background");

const normalAresCover = albumController.match(/ie2:\s*Object\.freeze\(\{\s*coverUrl:\s*"([^"]+)"/s)?.[1];
const rtgAresCover = rtgConfig.match(/const ARES=Object\.freeze\(\{[\s\S]*?albumCover:"([^"]+)"/)?.[1];
assert(normalAresCover, "Normal Run Album Ares cover must be discoverable");
assert.strictEqual(rtgAresCover, normalAresCover, "RTG Ares Album must reuse the exact normal Run Album Ares cover");

assert(themeCss.includes('@import url("./rtg-run.css?v=20261001-rtg-qol-1")'), "RTG run stylesheet cache key must be refreshed");
assert(indexHtml.includes("css/rtg-theme.css?v=20261003-season-team-filters-1"), "RTG theme cache key must be refreshed");
assert(indexHtml.includes("js/road-to-glory/rtg-config.js?v=20261001-rtg-qol-1"), "RTG config cache key must be refreshed");

console.log("rtg-qol-visual-regression-test: PASS");
