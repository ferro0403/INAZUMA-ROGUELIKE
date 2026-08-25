"use strict";
const assert = require("assert"), fs = require("fs"); const rules = fs.readFileSync("firestore.rules", "utf8");
for (const path of ["metadata/{documentId}", "sectors/{sectorId}", "hallOfFame/{hallTeamId}"]) assert(rules.includes(`/saveCommits/{commitId}/${path}`));
assert.match(rules, /request\.resource\.data\.cloudCommitId == commitId/g); assert.match(rules, /allow update, delete: if false;/); assert.match(rules, /'run_orion'/);
console.log("Firebase V12 saveCommits owner/immutable/schema rules source contract: ok (deployment verification required)");
