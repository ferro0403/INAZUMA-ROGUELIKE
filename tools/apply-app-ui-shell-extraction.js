"use strict";

const fs = require("fs");

function replaceFunction(source, name, replacement) {
  const marker = `  function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`function not found: ${name}`);
  const brace = source.indexOf("{", start);
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

function removeSectionDestinations(source) {
  const startMarker = "  const SECTION_ROOT_DESTINATIONS = {";
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error("section destinations block missing");
  const end = source.indexOf("  };", start);
  if (end < 0) throw new Error("section destinations end missing");
  let after = end + 4;
  while (source[after] === "\r" || source[after] === "\n") after += 1;
  return source.slice(0, start) + source.slice(after);
}

let app = fs.readFileSync("js/app.js", "utf8");
app = removeSectionDestinations(app);
const roots = '  const toastRoot = document.getElementById("toast-root");\n';
if (!app.includes(roots)) throw new Error("DOM roots anchor missing");
app = app.replace(roots, roots + `  const uiShell = global.AppUiShell.create({\n    app, modalRoot, toastRoot,\n    getRun: () => run,\n    normalizeTeamIdentity: (...args) => normalizeTeamIdentity(...args),\n    averageOverall: (...args) => averageOverall(...args),\n  });\n`);

const adapters = {
  getSectionRootDestination: '  function getSectionRootDestination(...args) { return uiShell.getSectionRootDestination(...args); }',
  sectionRootButton: '  function sectionRootButton(...args) { return uiShell.sectionRootButton(...args); }',
  escapeHtml: '  function escapeHtml(...args) { return uiShell.escapeHtml(...args); }',
  toast: '  function toast(...args) { return uiShell.toast(...args); }',
  closeModal: '  function closeModal(...args) { return uiShell.closeModal(...args); }',
  scrollSnapshot: '  function scrollSnapshot(...args) { return uiShell.scrollSnapshot(...args); }',
  setScrollPosition: '  function setScrollPosition(...args) { return uiShell.setScrollPosition(...args); }',
  restorePageScroll: '  function restorePageScroll(...args) { return uiShell.restorePageScroll(...args); }',
  restoreScroll: '  function restoreScroll(...args) { return uiShell.restoreScroll(...args); }',
  afterNextPaint: '  function afterNextPaint(...args) { return uiShell.afterNextPaint(...args); }',
  runKeepingScroll: '  function runKeepingScroll(...args) { return uiShell.runKeepingScroll(...args); }',
  isScrollableElement: '  function isScrollableElement(...args) { return uiShell.isScrollableElement(...args); }',
  scrollTargetsForView: '  function scrollTargetsForView(...args) { return uiShell.scrollTargetsForView(...args); }',
  resetViewScroll: '  function resetViewScroll(...args) { return uiShell.resetViewScroll(...args); }',
  resetRenderedViewScroll: '  function resetRenderedViewScroll(...args) { return uiShell.resetRenderedViewScroll(...args); }',
  openModal: '  function openModal(...args) { return uiShell.openModal(...args); }',
  hearts: '  function hearts(...args) { return uiShell.hearts(...args); }',
  lifeHeartsMarkup: '  function lifeHeartsMarkup(...args) { return uiShell.lifeHeartsMarkup(...args); }',
  formatDuration: '  function formatDuration(...args) { return uiShell.formatDuration(...args); }',
  topbar: '  function topbar(...args) { return uiShell.topbar(...args); }',
  navIcon: '  function navIcon(...args) { return uiShell.navIcon(...args); }',
  bottomNav: '  function bottomNav(...args) { return uiShell.bottomNav(...args); }',
  cssEscape: '  function cssEscape(...args) { return uiShell.cssEscape(...args); }',
  inazumaLogoMarkup: '  function inazumaLogoMarkup(...args) { return uiShell.inazumaLogoMarkup(...args); }',
};
for (const [name, replacement] of Object.entries(adapters)) app = replaceFunction(app, name, replacement);

const restoration = '  if (window.history && "scrollRestoration" in window.history) {\n    window.history.scrollRestoration = "manual";\n  }\n\n';
if (!app.includes(restoration)) throw new Error("scroll restoration block missing");
app = app.replace(restoration, "");
fs.writeFileSync("js/app.js", app);

let index = fs.readFileSync("index.html", "utf8");
if (!index.includes("js/app/ui-shell.js")) {
  const anchor = '    <script src="js/run/run-roster-runtime.js?v=20260903-run-roster-runtime-1"></script>\n';
  if (!index.includes(anchor)) throw new Error("index run runtime anchor missing");
  index = index.replace(anchor, '    <script src="js/app/ui-shell.js?v=20260903-app-ui-shell-1"></script>\n' + anchor);
  fs.writeFileSync("index.html", index);
}

for (const file of ["tests/helpers/production-runtime.js", "tests/recruitment-production-path-e2e-test.js"]) {
  let text = fs.readFileSync(file, "utf8");
  if (text.includes("app/ui-shell.js")) continue;
  const candidates = ['"run/run-roster-runtime.js"', '"js/run/run-roster-runtime.js"'];
  const anchor = candidates.find(candidate => text.includes(candidate));
  if (!anchor) throw new Error(`run runtime loader anchor missing: ${file}`);
  const prefix = anchor.startsWith('"js/') ? '"js/app/ui-shell.js", ' : '"app/ui-shell.js", ';
  text = text.replace(anchor, prefix + anchor);
  fs.writeFileSync(file, text);
}

console.log("application UI shell extraction applied");
