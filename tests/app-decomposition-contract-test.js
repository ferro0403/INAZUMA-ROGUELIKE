const assert = require("assert");
const fs = require("fs");

const index = fs.readFileSync("index.html", "utf8");
const identityPos = index.indexOf("js/recruitment/player-identity.js");
const poolPos = index.indexOf("js/recruitment-pool.js");

assert(identityPos >= 0, "PlayerIdentity is loaded by index.html");
assert(poolPos >= 0, "RecruitmentPoolRuntime is loaded by index.html");
assert(identityPos < poolPos, "PlayerIdentity loads before RecruitmentPoolRuntime");

const architecture = fs.readFileSync("docs/app-js-decomposition.md", "utf8");
for (const required of [
  "Run: solo locale",
  "partite 11v11 secondarie",
  "profilo",
  "negozio/economia permanente",
  "Centro di Sviluppo",
  "Album",
  "Albo d'Oro",
]) {
  assert(architecture.includes(required), `architecture contract documents ${required}`);
}

console.log("decomposition contract: module load order and run/cloud ownership documented");
