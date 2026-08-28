"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const protectedLegacy = new Set(["development-v2.js", "development-v3-migration.js", "firebase-cloud-save.js"]);
for (const name of fs.readdirSync(path.join(root, "js")).filter((file) => file.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(root, "js", name), "utf8");
  if (!protectedLegacy.has(name)) {
    assert(!/DevelopmentV2\.(?:evolve|processRunEnd|purchaseProject|purchaseEmblem|addCompletedProject)\s*\(/.test(source), `${name} bypasses canonical V3 account writers`);
    assert(!/DevelopmentV2\.write\s*\(/.test(source), `${name} independently writes the V2 mirror`);
  }
  if (name !== "development-account-v3.js" && name !== "development-v3-migration.js") assert(!/\.developmentV3\s*=/.test(source), `${name} independently assigns canonical V3`);
}
console.log("development-v3 account static guard tests passed");
