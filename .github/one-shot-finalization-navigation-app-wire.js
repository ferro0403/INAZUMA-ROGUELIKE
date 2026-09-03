"use strict";
const fs = require("fs");
const path = "js/app.js";
let source = fs.readFileSync(path, "utf8");
const start = source.indexOf("  const finalizationController = global.FinalizationController.create({");
if (start < 0) throw new Error("FinalizationController wiring block not found");
const anchor = "    recoverCanonicalRun,\n";
const at = source.indexOf(anchor, start);
if (at < 0) throw new Error("recoverCanonicalRun wiring anchor not found");
const line = "    persistMutation: (options) => persistGameplayMutation(options),\n";
if (!source.slice(start, source.indexOf("  });", start)).includes("persistMutation:")) {
  source = source.slice(0, at + anchor.length) + line + source.slice(at + anchor.length);
}
fs.writeFileSync(path, source);
