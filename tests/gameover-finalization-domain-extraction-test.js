"use strict";
const assert = require("assert");
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
for (const file of ["gameover/gameover-view.js", "gameover/gameover-controller.js", "finalization/finalization-view.js", "finalization/finalization-controller.js"]) {
  const source = fs.readFileSync(`js/${file}`, "utf8");
  assert.match(source, /\(function \(global\)/);
  assert.doesNotMatch(source, /firebase|cloud/i, `${file} must preserve the local-run boundary`);
  assert(html.indexOf(`js/${file}`) < html.indexOf("js/app.js"), `${file} loads before app.js`);
}
assert.match(app, /global\.GameOverController\.create/);
assert.match(app, /global\.FinalizationController\.create/);
assert.doesNotMatch(fs.readFileSync("js/gameover/gameover-view.js", "utf8"), /RunState|PermanentEffects|persistGameplayMutation/);
assert.doesNotMatch(fs.readFileSync("js/finalization/finalization-view.js", "utf8"), /RunState|PermanentEffects|persistGameplayMutation/);
console.log("gameover/finalization extraction: load order, wiring, and view ownership OK");
