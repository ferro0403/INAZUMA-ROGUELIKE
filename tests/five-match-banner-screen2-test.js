"use strict";

const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("css/five-match-banner-screen2.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 124px minmax\(0, 1fr\);/, "desktop banner must keep equal sides around a wide fixed VS column");
assert.match(css, /\.five-match-team \{[\s\S]*grid-template-rows: 30px minmax\(0, 1fr\);/, "team sides must keep the screen-2 high-name/lower-crest composition");
assert.match(css, /first-child > strong \{[\s\S]*grid-column: 2;[\s\S]*grid-row: 1;/, "user name must sit high to the right of its crest");
assert.match(css, /first-child > \.five-match-logo \{[\s\S]*grid-column: 1;[\s\S]*grid-row: 2;/, "user crest must sit lower on the outer edge");
assert.match(css, /last-child > strong \{[\s\S]*grid-column: 1;[\s\S]*grid-row: 1;/, "opponent name must sit high to the left of its crest");
assert.match(css, /last-child > \.five-match-logo \{[\s\S]*grid-column: 2;[\s\S]*grid-row: 2;/, "opponent crest must sit lower on the outer edge");
assert.match(css, /\.five-match-vs-badge \{[\s\S]*clip-path: polygon\(30% 0, 100% 0, 72% 100%, 0 100%\);/, "VS must be the broad central trapezoid from screen 2");
assert.match(css, /\.five-match-logo \{[\s\S]*background: transparent;[\s\S]*border: 0;/, "dynamic crest slots must remain frameless");
assert.match(css, /\.five-match-emblem \{[\s\S]*object-fit: contain;/, "dynamic emblems must remain undistorted");
assert.match(css, /@media \(max-width: 780px\)[\s\S]*minmax\(0, 1fr\) 98px minmax\(0, 1fr\)/, "mobile banner must keep the wide VS geometry instead of the regressed narrow divider");
assert.match(css, /@media \(max-width: 390px\)[\s\S]*minmax\(0, 1fr\) 94px minmax\(0, 1fr\)/, "390px layout must preserve the screen-2 centre width");

const actionIndex = index.indexOf("css/five-match-action-assets.css");
const bannerIndex = index.indexOf("css/five-match-banner-screen2.css");
assert(actionIndex >= 0 && bannerIndex > actionIndex, "screen-2 banner stylesheet must load last so legacy banner rules cannot regress it");
assert(index.includes("screen2-restored-2"), "screen-2 cache key must be bumped after the restored layout");

console.log("five-match-banner-screen2-test: restored screen-2 geometry with dynamic emblems OK");
