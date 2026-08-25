"use strict";
const assert = require("assert"), fs = require("fs"); const source = fs.readFileSync("js/firebase-cloud-save.js", "utf8");
assert.match(source, /const conflict = error\?\.code === "cloud-cas-conflict"/); assert.doesNotMatch(source, /\["permission-denied", "failed-precondition", "cloud-cas-conflict"\]/);
assert.match(source, /dirtySectors\.add\(sector\); if \(\["sync-conflict", "local-conflict", "cloud-update-available"\]/);
assert.doesNotMatch(source, /PersistenceRecoveryGuard\.setBlocked/);
console.log("cloud failure policy: only proven CAS conflicts; dirty local writes remain playable: ok");
