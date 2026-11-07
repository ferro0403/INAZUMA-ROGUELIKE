#!/usr/bin/env node
// Confronta due impronte di stile calcolato (prodotte da capture.mjs --styles=file.json).
// Uso: node scripts/css/compare-styles.mjs <prima.json> <dopo.json> [--max=10]
// Per ogni schermata: quanti elementi hanno uno stile diverso, quanti compaiono o spariscono.
// Esce con 1 se c'e' almeno una differenza. Per vedere COSA cambia in un elemento si usa
// capture.mjs --only=<scena> --styles-detail=<file> su entrambe le versioni.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const [a, b] = args.filter((x) => !x.startsWith("--"));
const MAX = Number((args.find((x) => x.startsWith("--max=")) || "--max=10").split("=")[1]);
if (!a || !b) {
  console.error("Uso: node scripts/css/compare-styles.mjs <prima.json> <dopo.json> [--max=10]");
  process.exit(2);
}
const before = JSON.parse(readFileSync(a, "utf8"));
const after = JSON.parse(readFileSync(b, "utf8"));
let different = 0;
for (const scene of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
  const x = before[scene];
  const y = after[scene];
  if (!x || !y) {
    console.log(`${scene}: ${x ? "manca dopo" : "nuova"}`);
    different += 1;
    continue;
  }
  const changed = [];
  const gone = [];
  const added = [];
  for (const [path, hash] of Object.entries(x)) {
    if (!(path in y)) gone.push(path);
    else if (y[path] !== hash) changed.push(path);
  }
  for (const path of Object.keys(y)) if (!(path in x)) added.push(path);
  if (changed.length || gone.length || added.length) {
    different += 1;
    console.log(`${scene}: ${changed.length} elementi con stile diverso, ${gone.length} spariti, ${added.length} nuovi`);
    for (const p of [...changed, ...gone, ...added].slice(0, MAX)) console.log(`   ${p}`);
  }
}
console.log(different ? `\n${different} schermate con stile diverso` : "\nStile calcolato identico in tutte le schermate");
process.exit(different ? 1 : 0);
