"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/app/ui-shell.js", "utf8");
for (const forbidden of ["RunState.save", "GameplayPersistence", "Firebase", "Firestore", "CloudSave", "CloudRestore"]) {
  assert.ok(!source.includes(forbidden), `UI shell must not own ${forbidden}`);
}

function classList() {
  const values = new Set();
  return { add: (...items) => items.forEach(x => values.add(x)), remove: (...items) => items.forEach(x => values.delete(x)), contains: x => values.has(x) };
}
function element() {
  const attrs = new Map();
  return {
    innerHTML: "", firstElementChild: null, scrollTop: 0, scrollLeft: 0, scrollHeight: 0, clientHeight: 0, scrollWidth: 0, clientWidth: 0,
    classList: classList(), children: [], handlers: {},
    setAttribute(k,v){ attrs.set(k,String(v)); }, getAttribute(k){ return attrs.has(k) ? attrs.get(k) : null; }, removeAttribute(k){ attrs.delete(k); },
    appendChild(child){ this.children.push(child); },
    addEventListener(type, fn){ this.handlers[type] = fn; },
    querySelector(selector){ if (selector === ".modal" && this.innerHTML.includes("class=\"modal")) return this._modal || null; if (selector.includes("data-close-modal")) return this._close || null; return null; },
    querySelectorAll(){ return []; },
    scrollTo({top=0,left=0}){ this.scrollTop=top; this.scrollLeft=left; },
    focus(){ this.focused = true; }, remove(){ this.removed = true; },
  };
}

const app = element();
const modalRoot = element();
const toastRoot = element();
const body = element();
const documentElement = element();
const main = element();
app.querySelector = selector => selector === "main" ? main : null;
const document = {
  body, documentElement, scrollingElement: body, activeElement: null,
  createElement(){ return element(); }, contains(){ return true; },
};
const windowObj = {
  scrollX: 4, scrollY: 7, history: { scrollRestoration: "auto" },
  scrollTo({top=0,left=0}){ this.scrollX=left; this.scrollY=top; },
  getComputedStyle(){ return { overflowY:"visible", overflowX:"visible", overflow:"visible" }; },
};
let run = { teamIdentity: { name: "Raimon & Co" }, roster: [{ playerId:"p1" }], lives: 1.5, seasonId:"ie1", teamLevel: 3 };
const context = {
  console, document, window: windowObj, globalThis: null, setTimeout: fn => { context.lastTimeout = fn; return 1; },
  requestAnimationFrame: fn => fn(),
  CSS: { escape: value => `escaped-${value}` },
  RunState: { runLivesLimit: () => 3 },
  SEASON1_CONFIG: { maxRunLives: 3, startingLives: 3 },
  LevelProgression: { formatLevel: () => "3½" },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "ui-shell.js" });

const shell = context.AppUiShell.create({
  app, modalRoot, toastRoot,
  getRun: () => run,
  normalizeTeamIdentity: identity => identity || {},
  averageOverall: () => 77,
});

assert.strictEqual(windowObj.history.scrollRestoration, "manual");
assert.strictEqual(shell.escapeHtml(`<A & \"B\">`), "&lt;A &amp; &quot;B&quot;&gt;");
assert.strictEqual(shell.getSectionRootDestination("match").destination, "map");
assert.strictEqual(shell.getSectionRootDestination("unknown").destination, "home");
assert(shell.sectionRootButton("run").includes('data-section-root="run"'));
assert(shell.lifeHeartsMarkup(1.5).includes("life-heart--half"));
assert.strictEqual(shell.formatDuration(90 * 60000), "1h 30m");
assert(shell.topbar("Percorso").includes("Raimon &amp; Co"));
assert(shell.topbar("Percorso").includes("77"));
assert(shell.bottomNav("map").includes('data-nav="map" class="active"'));
assert.strictEqual(shell.cssEscape("a b"), "escaped-a b");
assert(shell.inazumaLogoMarkup("small").includes("inazuma-logo small"));

shell.toast("Salva & continua", "error");
assert.strictEqual(toastRoot.children.length, 1);
assert(toastRoot.children[0].innerHTML.includes("Salva &amp; continua"));
assert(toastRoot.children[0].className.includes("toast--error"));
context.lastTimeout();
assert.strictEqual(toastRoot.children[0].removed, true);

let closed = 0;
const closeButton = element();
const modal = element();
modalRoot._close = closeButton;
modalRoot._modal = modal;
Object.defineProperty(modalRoot, "firstElementChild", { configurable:true, get(){ return this.innerHTML ? modal : null; } });
document.activeElement = element();
shell.openModal("<p>Test</p>", { className:"test-modal", onClose: () => closed++ });
assert(modalRoot.innerHTML.includes("test-modal"));
assert(modalRoot.classList.contains("has-open-modal"));
assert(app.classList.contains("modal-scroll-locked"));
assert.strictEqual(typeof closeButton.handlers.click, "function");
closeButton.handlers.click();
assert.strictEqual(modalRoot.innerHTML, "");
assert.strictEqual(closed, 1);
assert(!app.classList.contains("modal-scroll-locked"));

run = { teamIdentity:{name:"Seconda"}, roster:[], lives:3, seasonId:"ie1" };
assert.strictEqual(shell.bottomNav("map"), "", "dynamic getRun must be read at call time");
assert(shell.topbar("Home").includes("Seconda"));

console.log("app UI shell: markup, modal/scroll, toast, dynamic run and no persistence ownership OK");
