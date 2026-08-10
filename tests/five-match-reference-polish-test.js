"use strict";

const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("css/five-match-reference-polish.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert(css.includes(".five-match-screen .five-match-vs .five-match-team small"), "matchup metadata selector must exist");
assert(css.includes("display: none;"), "matchup formation/OVR/strength metadata must be hidden");
assert(css.includes("five-match-action-cta--primary::after"), "primary action football decoration must exist");
assert(css.includes("viewBox='0 0 120 120'"), "primary action must use the football SVG decoration");
assert(css.includes("five-match-tactics-icon"), "secondary action tactical-board icon must exist");
assert(css.includes("viewBox='0 0 48 54'"), "secondary action must use the tactical-board SVG");
assert(index.includes("css/five-match-reference-polish.css"), "reference polish stylesheet must be loaded after the base 5v5 styles");

console.log("five-match-reference-polish-test: OK");
