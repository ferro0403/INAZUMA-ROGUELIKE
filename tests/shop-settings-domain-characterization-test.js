"use strict";

const assert = require("assert");
const fs = require("fs");

const files = {
  shopController: "js/shop/shop-controller.js",
  shopView: "js/shop/shop-view.js",
  settingsController: "js/settings/settings-controller.js",
  settingsView: "js/settings/settings-view.js",
};
const source = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, fs.readFileSync(file, "utf8")]));
const combined = Object.values(source).join("\n");

for (const file of Object.values(files)) assert.ok(fs.existsSync(file), `${file} must exist`);
assert.doesNotMatch(combined, /Firebase|Firestore|CloudRestore|InazumaCloudSave|cloud-sync|cloud-save/i);
assert.doesNotMatch(combined, /RunState\.save\s*\(|persistGameplayMutation|GameplayPersistence|activeMatch|currentZone|bossIndex|postBossFlow|pendingBossVictory|\blives\b/);
assert.doesNotMatch(combined, /getRun\s*\(|getAccount\s*\(|getUi\s*\(/);
assert.match(source.shopController, /DevelopmentAccountV3\.purchaseProject/);
assert.match(source.shopController, /DevelopmentAccountV3\.purchaseEmblem/);
assert.match(source.shopController, /button\.onclick = \(\) => render\(button\.dataset\.shopTab\)/);
assert.doesNotMatch(source.shopController, /addEventListener\("click", render\)|onclick = render\b/);
assert.match(source.shopView, /shop-wallet/);
assert.match(source.shopView, /TIER_ORDER/);
assert.doesNotMatch(source.shopView, /purchaseProject|purchaseEmblem|addEventListener/);
assert.match(source.settingsController, /RunState\.loadProfile\(\)/);
assert.match(source.settingsController, /RunState\.saveProfilePreferences/);
assert.match(source.settingsController, /RunState\.saveProfileTeamIdentity/);
assert.match(source.settingsController, /renderShop\("general"\)/);
assert.doesNotMatch(source.settingsView, /saveProfile|DevelopmentAccountV3|addEventListener/);
assert.match(source.settingsView, /PROFILO SQUADRA/);
assert.match(source.settingsView, /AUTO-FORMAZIONE INTELLIGENTE/);

console.log("shop/settings domain characterization: ownership, callback safety, cloud and gameplay boundaries OK");
