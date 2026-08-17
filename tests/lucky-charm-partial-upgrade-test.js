const assert = require("assert");
const fs = require("fs");
const source = fs.readFileSync("js/app.js", "utf8");

assert(source.includes('if (index < 0 || index >= ordered.length - 1) return null;'), "Leggenda deve essere non migliorabile");
assert(source.includes('if (pullType !== "pull_unlocked_teams") return null;'), "Il pool speciale deve distinguere il Pull squadre");
assert(source.includes('return { players: seasonDb.players || [], source, database: seasonDb };'), "Il Talismano nel Pull squadre deve poter usare tutta la Season");
assert(source.includes('const upgradedCandidates = [];') && source.includes('let upgradedCount = 0;'), "Il builder deve supportare miglioramenti parziali");
assert(source.includes('upgradedCandidates.push(candidate);'), "Un candidato non migliorabile deve restare invariato");
assert(source.includes('if (!upgradeResult || upgradeResult.upgradedCount < 1)'), "Il Talismano deve fallire solo quando nessun candidato è migliorabile");
assert(source.includes('upgradedCount: upgradeResult.upgradedCount'), "Le statistiche devono registrare quanti candidati sono stati migliorati");
assert(!source.includes('if (!upgradedCandidates || upgradedCandidates.length !== 3) return toast("Non è stato possibile migliorare tutti i candidati.");'), "La vecchia regola all-or-nothing non deve restare attiva");
console.log("Lucky charm partial-upgrade regression checks passed");
