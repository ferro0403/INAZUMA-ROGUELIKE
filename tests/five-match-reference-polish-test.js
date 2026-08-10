"use strict";

const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("css/five-match-reference-polish.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

assert(!app.includes('class="five-match-team"><span class="five-match-logo">⚡'), "emoji crests must be replaced by structured crests");
assert(app.includes("five-match-team--user") && app.includes("five-match-team--opponent"), "matchup sides must expose scoped layout hooks");
assert(app.includes('class="crest-ball"') && app.includes('class="crest-bolt"'), "both purpose-built crest illustrations must exist");
assert(!css.includes("text-overflow: ellipsis"), "team and action names must never be ellipsized by the reference stylesheet");
assert(css.includes("white-space:nowrap") || css.includes("white-space: nowrap"), "normal team names must remain on one line");
assert(css.includes("five-match-action-cta--primary::after"), "primary action football decoration must exist");
assert(css.includes("viewBox='0 0 210 210'"), "primary action must use the oversized football decoration");
assert(css.includes("five-match-tactics-icon"), "secondary action tactical-board icon must exist");
assert(app.includes('class="board"') && app.includes('class="tactic"'), "secondary action must use the structured tactical-board SVG");
assert(app.includes('id="simulate-boss-match"') && app.includes('id="edit-five-team"'), "existing action listener targets must be retained");
assert(index.includes("css/five-match-reference-polish.css"), "reference polish stylesheet must be loaded after the base 5v5 styles");

console.log("five-match-reference-polish-test: OK");
