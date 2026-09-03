"use strict";

const fs = require("fs");
const path = "tests/recruitment-production-path-e2e-test.js";
let source = fs.readFileSync(path, "utf8");
const before = '"js/five-v-five/five-v-five-controller.js","js/five-v-five/five-v-five-view.js","js/special-match/special-match-view.js"';
const after = '"js/five-v-five/five-v-five-controller.js","js/five-v-five/five-v-five-view.js","js/five-v-five/five-match-presentation.js","js/special-match/special-match-view.js"';
if (!source.includes(before)) throw new Error("manual recruitment loader target not found");
if (source.includes('"js/five-v-five/five-match-presentation.js"')) throw new Error("five-match presentation already loaded");
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log("recruitment manual loader updated");
