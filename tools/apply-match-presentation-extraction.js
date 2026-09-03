"use strict";

const fs = require("fs");

function functionBodyBrace(source, start) {
  const openParen = source.indexOf("(", start);
  if (openParen < 0) throw new Error("function parameter list missing");
  let depth = 0, quote = null, escaped = false;
  for (let i = openParen; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        const brace = source.indexOf("{", i + 1);
        if (brace < 0) throw new Error("function body missing");
        return brace;
      }
    }
  }
  throw new Error("function parameter list not closed");
}

function replaceFunction(source, name, replacement) {
  const marker = `  function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`function not found: ${name}`);
  const brace = functionBodyBrace(source, start);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        if (source[end] === "\r") end += 1;
        if (source[end] === "\n") end += 1;
        return source.slice(0, start) + replacement + "\n" + source.slice(end);
      }
    }
  }
  throw new Error(`closing brace not found: ${name}`);
}

let app = fs.readFileSync("js/app.js", "utf8");
const runtimeAnchor = "  function recoverCanonicalRun() {\n";
if (!app.includes(runtimeAnchor)) throw new Error("match presentation runtime anchor missing");
app = app.replace(runtimeAnchor, `  const matchPresentation = global.MatchPresentationRuntime.create({\n    getRun: () => run,\n    getUi: () => ui,\n    getSeasonDb: () => seasonDb,\n    getSeasonPlayersById: () => seasonPlayersById,\n    getSeasonTeamsById: () => seasonTeamsById,\n    isProfileAwareSeason: (...args) => isProfileAwareSeason(...args),\n    formationById: (...args) => formationById(...args),\n    resolvedRosterPlayer: (...args) => resolvedRosterPlayer(...args),\n    rosterEntry: (...args) => rosterEntry(...args),\n    compactPlayerCardMarkup: (...args) => compactPlayerCardMarkup(...args),\n    normalizeTeamIdentity: (...args) => normalizeTeamIdentity(...args),\n    escapeHtml: (...args) => escapeHtml(...args),\n    matchEventSideClass: (...args) => matchEventSideClass(...args),\n    openModal: (...args) => openModal(...args),\n    closeModal: (...args) => closeModal(...args),\n    scrollSnapshot: (...args) => scrollSnapshot(...args),\n    showPlayerDetailsFor: (...args) => showPlayerDetailsFor(...args),\n    bossNodeIconMarkup: (...args) => bossNodeIconMarkup(...args),\n    modalRoot,\n  });\n\n` + runtimeAnchor);

for (const line of [
  '  const TACTIC_LABELS = { attack: "Attacco", control: "Controllo", defense: "Difesa", save: "Parata", speed: "Velocità", physical: "Fisico", stamina: "Resistenza" };\n',
  '  const TACTIC_SHORT_LABELS = { attack: "ATT", control: "CON", defense: "DIF", save: "PAR", speed: "VEL", physical: "FIS", stamina: "RES" };\n',
]) {
  if (!app.includes(line)) throw new Error(`tactic constant missing: ${line.slice(0, 30)}`);
  app = app.replace(line, "");
}

const names = [
  "openBossPreviewModal", "shortName", "teamById", "bossTeamPlayers", "userTeamPlayers", "formationRows",
  "bossMatchTeamMeta", "bossMatchAverage", "tacticSummary", "tacticChipMarkup", "tacticPanelMarkup",
  "matchFormationCard", "renderMatchFormation", "bossMatchField", "bossMatchTimeline", "switchBossMatchTab", "bossMatchStatusText",
];
for (const name of names) {
  app = replaceFunction(app, name, `  function ${name}(...args) { return matchPresentation.${name}(...args); }`);
}
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
if (!index.includes("js/match/match-presentation.js")) {
  const anchor = '    <script src="js/match/match-controller.js?v=20260902-match-extraction-1"></script>\n';
  if (!index.includes(anchor)) throw new Error("index match controller anchor missing");
  index = index.replace(anchor, '    <script src="js/match/match-presentation.js?v=20260903-match-presentation-1"></script>\n' + anchor);
  fs.writeFileSync("index.html", index);
}

for (const file of ["tests/helpers/production-runtime.js", "tests/recruitment-production-path-e2e-test.js"]) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("match/match-presentation.js")) continue;
  const candidates = ['"match/match-controller.js"', '"js/match/match-controller.js"'];
  const anchor = candidates.find(candidate => text.includes(candidate));
  if (!anchor) throw new Error(`match controller loader anchor missing: ${file}`);
  const prefix = anchor.startsWith('"js/') ? '"js/match/match-presentation.js", ' : '"match/match-presentation.js", ';
  text = text.replace(anchor, prefix + anchor);
  fs.writeFileSync(file, text);
}

let gate = fs.readFileSync(".github/workflows/stacked-regression.yml", "utf8");
if (!gate.includes("tests/match-presentation-domain-test.js")) {
  const anchor = "            tests/five-match-presentation-domain-test.js\n";
  if (!gate.includes(anchor)) throw new Error("regression gate match test anchor missing");
  gate = gate.replace(anchor, "            tests/match-presentation-domain-test.js\n" + anchor);
  fs.writeFileSync(".github/workflows/stacked-regression.yml", gate);
}

console.log("shared match presentation extraction applied");
