"use strict";
// Execute the actual, JS-compatible revision predicate from firestore.rules.
// Proxy maps model Firestore's missing-key error. This is a narrow predicate
// check, not a replacement for the complete Firestore emulator suite.
const fs = require("fs"), assert = require("assert");
const rules = fs.readFileSync("firestore.rules", "utf8");
const body = rules.split("function validSectorRevisionStep(old, fresh, name) {")[1].split("\n    function ")[0].replace(/\n    }\s*$/, "");
const predicate = new Function("old", "fresh", "name", "isAnyRunSector", body);
function map(value) {
  if (!value || typeof value !== "object") return value;
  return new Proxy(value, { get(target, key) { if (typeof key === "string" && !Object.hasOwn(target, key)) throw Error(`Firestore missing key: ${key}`); return map(target[key]); } });
}
const isRun = name => ["run_ie1", "run_ie2", "run_ie1_s2", "run_ie1_s3", "run_orion"].includes(name);
const old = { revision: 1, sectorRevisions: { profile: 1, album: 1, development: 1, hall_index: 1 } };
const fresh = { revision: 2, sectorRevisions: { profile: 2, album: 2, development: 2, hall_index: 2 } };
for (const name of ["run_ie1", "run_ie2", "run_ie1_s2", "run_ie1_s3", "run_orion"]) {
  assert.equal(predicate(map(old), map(fresh), name, isRun), true, `four-sector accounts must retain absent ${name} metadata`);
}
assert.equal(predicate(map(old), map(fresh), "development", isRun), true);
const historical = { ...old, sectorRevisions: { ...old.sectorRevisions, run_ie1: 1 } };
const preserved = { ...fresh, sectorRevisions: { ...fresh.sectorRevisions, run_ie1: 1 } };
assert.equal(predicate(map(historical), map(preserved), "run_ie1", isRun), true);
assert.throws(() => predicate(map(historical), map(fresh), "run_ie1", isRun), /missing key/);
assert.equal(predicate(map(historical), map({ ...preserved, sectorRevisions: { ...preserved.sectorRevisions, run_ie1: 99 } }), "run_ie1", isRun), false);
console.log("rtg-cloud-rule-revision-compatibility-test: PASS (source predicate, absent legacy run keys, preserved historical revisions)");
