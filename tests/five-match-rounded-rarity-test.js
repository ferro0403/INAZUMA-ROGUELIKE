"use strict";

const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("css/five-match-rounded-rarity.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");

assert.match(css, /\.five-match-screen \.five-match-card,[\s\S]*overflow: hidden;[\s\S]*border-left: 1px solid rgba\(17, 18, 22, \.88\);/, "half card must clip rarity artwork to its rounded silhouette and stop using the thick coloured physical border");
assert.match(css, /\.five-match-screen \.five-match-card::before \{[\s\S]*top: 0;[\s\S]*left: 0;[\s\S]*background: var\(--rarity-border[\s\S]*clip-path: polygon\(0 0, 100% 0, 84% 100%, 0 100%\);/, "top rarity accent must stay inside the rounded card and retain its diagonal end");
assert.match(css, /\.five-match-screen \.five-match-card::after \{[\s\S]*top: 0;[\s\S]*bottom: 0;[\s\S]*left: 0;[\s\S]*border-radius: 8px 0 0 8px;[\s\S]*background: var\(--rarity-border/, "vertical rarity edge must follow the rounded left corners");
assert.match(css, /\.five-match-screen \.five-match-card\.is-active \{[\s\S]*border-color: #ffd21f;/, "yellow selection state must remain independent from rarity");
assert(!css.includes(".five-match-versus"), "rarity polish must not touch the matchup banner");
assert(!css.includes(".five-match-controls"), "rarity polish must not touch the action panel");
assert(index.includes("css/five-match-rounded-rarity.css"), "rounded rarity stylesheet must be loaded");
assert(index.indexOf("css/five-match-rounded-rarity.css") > index.indexOf("css/five-match-banner-clean.css"), "rounded rarity polish must load after the existing 5v5 styles");

console.log("five-match-rounded-rarity-test: rounded rarity accent OK");
