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
const anchor = "  function normalizeTeamIdentity(identity = {}) {\n";
if (!app.includes(anchor)) throw new Error("team profile anchor missing");
app = app.replace(anchor, `  const teamProfileRuntime = global.TeamProfileRuntime.create({\n    getRun: () => run,\n    persistenceWritesAllowed,\n    openModal,\n    closeModal,\n    renderSettings: (...args) => renderSettings(...args),\n    startRunWithIdentity: (...args) => startRunWithIdentity(...args),\n    escapeHtml,\n    inazumaLogoMarkup,\n  });\n\n` + anchor);

for (const name of [
  "normalizeTeamIdentity",
  "loadTeamProfile",
  "savedTeamIdentity",
  "migrateTeamIdentityProfile",
  "seasonDisplayName",
  "normalizedHallSeasonName",
  "savedTeamSummaryMarkup",
  "openTeamNameModal",
  "openEditTeamNameModal",
]) {
  app = replaceFunction(app, name, `  function ${name}(...args) { return teamProfileRuntime.${name}(...args); }`);
}

const validateOld = `  function validateTeamName(value) {\n    const name = String(value || "").trim();\n    if (!name) return { valid: false, message: "Inserisci il nome della squadra." };\n    if (name.length < 2 || name.length > 24) return { valid: false, message: "Usa da 2 a 24 caratteri." };\n    if (!/^[\\p{L}0-9 '\\-]+$/u.test(name)) return { valid: false, message: "Sono ammessi lettere, numeri, spazi, apostrofi e trattini." };\n    return { valid: true, name };\n  }\n`;
if (!app.includes(validateOld)) throw new Error("validateTeamName block missing");
app = app.replace(validateOld, `  function validateTeamName(...args) { return teamProfileRuntime.validateTeamName(...args); }\n`);
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
if (!index.includes("js/profile/team-profile-runtime.js")) {
  const indexAnchor = '    <script src="js/app/app-bootstrap.js?v=20260903-app-bootstrap-1"></script>\n';
  if (!index.includes(indexAnchor)) throw new Error("app bootstrap index anchor missing");
  index = index.replace(indexAnchor, indexAnchor + '    <script src="js/profile/team-profile-runtime.js?v=20260903-team-profile-1"></script>\n');
  fs.writeFileSync("index.html", index);
}

for (const file of ["tests/helpers/production-runtime.js", "tests/recruitment-production-path-e2e-test.js"]) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("profile/team-profile-runtime.js")) continue;
  const candidates = ['"app/app-bootstrap.js"', '"js/app/app-bootstrap.js"'];
  const loaderAnchor = candidates.find((candidate) => text.includes(candidate));
  if (!loaderAnchor) throw new Error(`app bootstrap loader anchor missing: ${file}`);
  const insert = loaderAnchor.startsWith('"js/') ? '"js/profile/team-profile-runtime.js"' : '"profile/team-profile-runtime.js"';
  text = text.replace(loaderAnchor, `${loaderAnchor}, ${insert}`);
  fs.writeFileSync(file, text);
}

console.log("team profile extraction applied");
