"use strict";
const assert = require("assert"), fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const expected = ["js/persistence-recovery-guard.js", "js/cloud-save-core.js", "js/storage/cloud-permanent-storage-adapter.js",
  "js/road-to-glory/rtg-persistence-runtime.js", "js/road-to-glory/rtg-storage.js", "js/road-to-glory/rtg-state.js",
  "js/road-to-glory/rtg-cloud-snapshot.js", "js/road-to-glory/rtg-cloud-local-adapter.js",
  "js/road-to-glory/rtg-cloud-restore-adapter.js", "js/road-to-glory/rtg-cloud-bridge.js"];
const positions = expected.map(path => html.indexOf(`src="${path}?v=`));
assert(positions.every((value, index) => value >= 0 && (!index || value > positions[index - 1])), "production must load the complete guarded RTG adapter chain");
assert.match(fs.readFileSync("js/storage/permanent-cloud-bootstrap-gate.js", "utf8"), /firebase-cloud-save\.js\?v=20261030-cloud-hall-batch-v2/);
assert.match(html, /type="module"[^>]+permanent-cloud-bootstrap-gate/);
console.log("rtg-cloud-production-wiring-test: PASS (guarded adapters, classic/module order, cache versions)");
