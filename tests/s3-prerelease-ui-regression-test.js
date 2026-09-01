"use strict";
const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/game.css", "utf8");

assert.match(app, /const TEST_MATCH_CONTROLS_ENABLED = DEV_MODE;/);
const devEnabled = (search) => new URLSearchParams(search).get("dev") === "1";
assert.strictEqual(devEnabled(""), false, "normal query disables forced match controls");
assert.strictEqual(devEnabled("?dev=1"), true, "dev query enables forced match controls");

const preview = app.slice(app.indexOf("function squadFormationPreviewMarkup"), app.indexOf("function squadFormationOptionsMarkup"));
assert.match(preview, /FormationLayout\.displayRows\(formation\)/);
assert.match(preview, /--mini-rows:\$\{rows\.length\}/);
assert.match(css, /grid-template-rows: repeat\(var\(--mini-rows, 4\), 1fr\)/);

const champion = app.slice(app.indexOf("function championFormationMarkup"), app.indexOf("function championFiveVFiveMarkup"));
assert.match(champion, /team\.finalFormation/);
assert.match(champion, /FormationLayout\.displayRows/);
assert.match(champion, /splice\(0, layout\.count\)/, "TQ consumes the first MF before the three-player MF row");
assert.match(champion, /data-display-role=/);

assert.match(css, /\.inventory-tactical-slot \{[^}]*width: min\(100%, var\(--pitch-card-size, 96px\)\);[^}]*max-width: var\(--pitch-card-size, 96px\)/s);
assert.match(css, /\.inventory-tactical-slot > \.squad-player-card \{[^}]*width: 100%;[^}]*max-width: none;/s);
assert.doesNotMatch(css, /custom_0001|nakata/i);
assert.match(app, /inventoryEquipmentPlayerCard/);

console.log("s3-prerelease-ui-regression-test: dev gate, formation rows and uniform inventory slots OK");
