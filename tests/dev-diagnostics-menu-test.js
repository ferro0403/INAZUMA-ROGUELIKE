"use strict";

const assert = require("assert");
const fs = require("fs");
const source = fs.readFileSync("js/app.js", "utf8");
const devBlock = source.slice(source.indexOf("if (DEV_MODE)"), source.indexOf("const app ="));

assert.match(devBlock, /data-dev-diagnostics-trigger[^>]*aria-expanded=\"false\"/);
assert.match(devBlock, /data-dev-diagnostics-menu hidden/);
for (const action of ["data-persistence-diagnostic", "data-raw-save-diagnostic", "data-persistence-repair"]) assert.match(devBlock, new RegExp(action));
assert.match(devBlock, /top:calc\(env\(safe-area-inset-top, 0px\) \+ 8px\)/);
assert.match(devBlock, /right:calc\(env\(safe-area-inset-right, 0px\) \+ 8px\)/);
assert.match(devBlock, /pointer-events:none/, "the collapsed container cannot intercept page/CTA taps");
assert.match(devBlock, /trigger\.onclick = \(\) => setOpen\(menu\.hidden\)/);
assert.match(devBlock, /!tools\.contains\(event\.target\)\) setOpen\(false\)/, "outside click closes the compact menu");
assert.equal((devBlock.match(/finally \{ setOpen\(false\); \}/g) || []).length, 3, "every unchanged diagnostic action closes the menu");
assert.match(source, /const DEV_MODE = new URLSearchParams[\s\S]*if \(DEV_MODE\) global\.addEventListener/, "the tools are absent outside ?dev=1");

console.log("DEV diagnostics menu is dev-only, safe-area anchored, closed and pointer-safe by default");
