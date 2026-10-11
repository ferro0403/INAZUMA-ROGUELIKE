const fs = require("fs");
const path = require("path");
const assert = require("assert");

const loader = fs.readFileSync(path.join(__dirname, "..", "js", "road-to-glory", "rtg-squad-view.js"), "utf8");
const baseView = fs.readFileSync(path.join(__dirname, "..", "js", "road-to-glory", "rtg-squad-view-base.js"), "utf8");
const controller = fs.readFileSync(path.join(__dirname, "..", "js", "road-to-glory", "rtg-squad-controller.js"), "utf8");
const theme = fs.readFileSync(path.join(__dirname, "..", "css", "rtg-theme.css"), "utf8");

assert(!loader.includes("rtg-squad-view-order.js"), "production must not load the old view-level OVR sorter");
assert(!loader.includes("rtg-squad-picker-order-runtime.js"), "production must not load the old Array.sort interception runtime");
assert(baseView.includes("data-rtg-picker-sort"), "replacement picker must expose the canonical OVR control");
assert(baseView.includes("data-rtg-picker-sort-arrow"), "OVR control must keep a dedicated arrow element");
assert(controller.includes("let overallDescending=true"), "controller must own the OVR direction state");
assert(controller.includes("overallDescending=!overallDescending"), "OVR control must toggle controller ordering");
assert(controller.includes("const groups=filteredGroups();"), "ordering must happen before visible-page slicing");
assert(theme.includes(".rtg-picker-ovr-sort"), "canonical OVR control must use RTG styling");
assert(theme.includes("[data-rtg-picker-sort-arrow]"), "OVR arrow must use the RTG yellow control treatment");

console.log("RTG squad picker overall order single-owner contract OK");
