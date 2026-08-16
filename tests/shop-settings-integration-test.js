const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const css = fs.readFileSync(require.resolve("../css/game.css"), "utf8");
const development = fs.readFileSync(require.resolve("../js/development-v2.js"), "utf8");

assert.match(app, /id: "open-shop-home", label: "Negozio"/);
assert.match(app, /id="open-settings-home" aria-label="Impostazioni"/);
assert.doesNotMatch(app.match(/const developmentCard = `[^`]+`/)[0], /NEGOZIO/);
assert.match(app, /document\.querySelector\("\.shop-back"\)\.onclick = renderHome/);
assert.match(app, /selectingEmblem \? renderSettings\(\) : renderHome\(\)/);
assert.doesNotMatch(app.slice(app.indexOf("async function renderShop"), app.indexOf("function renderSettings")), /data-equip-emblem|>SELEZIONA</);
assert.match(app, /const choices = \[\{ emblemId: "default-lightning"/);
assert.match(app, /ShopCatalog\.build\(\)\.filter\(\(item\) => owned\.has\(item\.emblemId\)\)/);
assert.match(development, /ie1: .*ttzfl1b8nbe\.png/);
assert.match(development, /ie1_s2: .*am1r5xc99es\.png/);
assert.match(development, /ie1_s3: .*8kamtdks40c\.png/);
assert.match(development, /ie2: .*radfiq7yd5u\.png/);
assert.match(css, /\.shop-product \.btn\{[^}]*background:#ffd21f!important/);
console.log("shop-settings-integration-test: navigation, ownership, cup assets and scoped visuals OK");
