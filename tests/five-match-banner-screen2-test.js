"use strict";

const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("css/five-match-banner-screen2.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 92px minmax\(0, 1fr\);/, "desktop banner must keep equal sides around a fixed VS column");
assert.match(css, /\.five-match-team \{[\s\S]*grid-template-rows: 1fr;/, "team sides must be one horizontal row, not stacked name-over-logo");
assert.match(css, /first-child \{[\s\S]*grid-template-columns: 68px minmax\(0, 1fr\);/, "user side must render emblem then name");
assert.match(css, /last-child \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 68px;/, "opponent side must render name then emblem");
assert.match(css, /first-child > strong \{[\s\S]*grid-column: 2;/, "user name must sit to the right of the emblem");
assert.match(css, /last-child > \.five-match-logo \{[\s\S]*grid-column: 2;/, "opponent emblem must sit to the right of its name");
assert.match(css, /\.five-match-vs-badge \{[\s\S]*clip-path: polygon\(19% 0, 100% 0, 81% 100%, 0 100%\);/, "VS must be the large central trapezoid from the reference");
assert.match(css, /\.five-match-logo \{[\s\S]*background: transparent;[\s\S]*border: 0;/, "emblem slots must not add the old card-like frame");
assert.match(css, /\.five-match-emblem \{[\s\S]*object-fit: contain;/, "dynamic emblems must stay undistorted");
assert.match(css, /@media \(max-width: 390px\)[\s\S]*minmax\(0, 1fr\) 70px minmax\(0, 1fr\)/, "390px layout must keep symmetric sides around VS");

const actionIndex = index.indexOf("css/five-match-action-assets.css");
const bannerIndex = index.indexOf("css/five-match-banner-screen2.css");
assert(actionIndex >= 0 && bannerIndex > actionIndex, "screen-2 banner stylesheet must load last so legacy banner rules cannot regress it");

console.log("five-match-banner-screen2-test: horizontal reference banner and dynamic emblem slots OK");
