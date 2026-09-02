"use strict";
const assert = require("assert");
const { spawnSync } = require("child_process");
for (const file of [
  "tests/five-prematch-commit-boundary-test.js",
  "tests/five-postmatch-navigation-boundary-test.js",
  "tests/shared-match-same-mounted-continue-freeze-test.js",
]) {
  const result = spawnSync(process.execPath, [file], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
}
console.log("shared Match Engine production E2E: five_v_five, boss and special_match entry-to-destination paths OK");
