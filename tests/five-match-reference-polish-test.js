"use strict";

const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("css/five-match-reference-polish.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert(css.includes(".five-match-screen .five-match-vs .five-match-team small"), "matchup metadata selector must exist");
assert(css.includes("display: none;"), "matchup formation/OVR/strength metadata must be hidden");
assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 72px minmax\(0, 1fr\);/, "desktop matchup must use equal fluid sides and a fixed VS column");
assert.match(css, /@media \(max-width: 780px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\) 56px minmax\(0, 1fr\);/, "mobile matchup must preserve equal fluid sides and a fixed VS column");
assert.match(css, /\.five-match-screen \.five-match-vs \.five-match-emblem \{[\s\S]*object-fit: contain;[\s\S]*max-width: 100%;[\s\S]*max-height: 100%;[\s\S]*\}/, "dynamic emblems must remain contained without distortion");
const opponentSideRule = css.match(/\.five-match-screen \.five-match-vs \.five-match-team:last-child \{([^}]*)\}/)?.[1] || "";
assert(!opponentSideRule.includes("margin-left") && !opponentSideRule.includes("clip-path"), "opponent side must not use a structural offset");
assert(css.includes("five-match-action-cta--primary::after"), "legacy primary action decoration layer must exist");
assert(css.includes("five-match-tactics-icon"), "secondary action tactical-board icon must exist");
assert(index.includes("css/five-match-reference-polish.css"), "reference polish stylesheet must be loaded after the base 5v5 styles");

console.log("five-match-reference-polish-test: OK");
