"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const playerView = fs.readFileSync("js/player/player-view.js", "utf8");
const fiveView = fs.readFileSync("js/five-v-five/five-v-five-view.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const matchController = fs.readFileSync("js/match/match-controller.js", "utf8");
const css = fs.readFileSync("css/game.css", "utf8");

function sourceRange(source, name, nextToken) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} source is available`);
  const end = source.indexOf(nextToken, start + 1);
  assert.ok(end > start, `${name} end marker is available`);
  return source.slice(start, end);
}

const compactCard = sourceRange(
  playerView,
  "compactCard",
  "function detailMarkup",
);
const formationCard = sourceRange(
  fiveView,
  "fiveSlotCard",
  "function fiveRosterCard",
);
const selectionSync = sourceRange(
  fiveView,
  "syncFiveSlotSelection",
  "function openFiveVFiveEditor",
);
const fiveEditor = sourceRange(fiveView, "renderFiveVFive", "return { render:");
const bossRenderer = sourceRange(
  app,
  "matchFormationCard",
  "function renderMatchFormation",
);
const matchRenderer = sourceRange(
  app,
  "fiveMatchCard",
  "function fiveMatchField",
);
const quickDetail = sourceRange(
  app,
  "fiveMatchPlayerDetail",
  "function fiveMatchField",
);

for (const token of [
  "player-role",
  "player-overall",
  "player-title",
  "player-equipment--footer",
]) {
  assert.ok(
    compactCard.includes(token),
    `shared tactical card is missing ${token}`,
  );
}
assert.match(compactCard, /equipmentDefinition\s*\?/);
assert.match(compactCard, /itemIcon\(equipment\)/);
assert.match(compactCard, /equipmentInFooter \? equipmentMarkup/);
for (const renderer of [bossRenderer, formationCard]) {
  assert.match(renderer, /compactPlayerCardMarkup\(player/);
  assert.match(renderer, /equipmentInFooter: true/);
}
for (const token of [
  "five-match-card-portrait",
  "five-match-card-role",
  'aria-pressed="false"',
  "player.name",
]) {
  assert.ok(
    matchRenderer.includes(token),
    `match half card is missing ${token}`,
  );
}
assert.doesNotMatch(matchRenderer, /compactPlayerCardMarkup/);
assert.match(quickDetail, /data-five-detail-close/);
assert.match(quickDetail, /Scheda completa/);
assert.match(
  matchController,
  /preferredLeft[\s\S]*--five-detail-left[\s\S]*--five-detail-top/,
);
assert.match(
  matchController,
  /classList\.toggle\("is-active", card === button\)[\s\S]*aria-pressed/,
);
assert.match(
  matchController,
  /data-five-detail-close[\s\S]*closeFiveMatchPlayerDetail/,
);
assert.doesNotMatch(app + fiveView, /fivePlayerEquipmentMarkup/);
assert.doesNotMatch(css, /five-player-equipment/);

assert.match(
  css,
  /:is\(\.five-screen,\.five-match-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-title strong \{[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/s,
);
assert.match(
  css,
  /:is\(\.five-screen,\.five-match-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-equipment--footer \{[^}]*position: static;[^}]*box-sizing: border-box;[^}]*overflow: hidden;[^}]*border: 2px solid var\(--unified-card-ink\);[^}]*background: var\(--unified-card-yellow\);[^}]*box-shadow: none;/s,
);
assert.match(
  css,
  /\.player-equipment--footer \.item-icon img \{[^}]*object-fit: contain;/s,
);
assert.doesNotMatch(
  css,
  /\.five-match-screen \.five-match-card\.run-tactical-card \.player-equipment--footer/,
);
for (const rarity of ["buono", "forte", "elite", "mondiale", "leggenda"]) {
  assert.match(
    css,
    new RegExp(
      `\\.five-match-screen :is\\(\\.rarity-${rarity}\\) \\{ --rarity-border:`,
    ),
  );
}
assert.match(
  css,
  /\.five-match-screen \.five-match-card::before \{[\s\S]*background:var\(--rarity-border[\s\S]*clip-path:/,
);
assert.match(
  css,
  /\.five-match-screen \.five-match-card\.is-active \{[\s\S]*#ffd21f/,
);
assert.match(
  css,
  /\.five-match-screen \.five-match-player-detail \{[\s\S]*--five-detail-left[\s\S]*width:min\(218px,/,
);

for (const token of [
  'classList.toggle("selected", selected)',
  'setAttribute("aria-selected", selected ? "true" : "false")',
  'querySelectorAll(".five-slot-selected-label")',
  'label.textContent = "SELEZIONATO"',
]) {
  assert.ok(
    selectionSync.includes(token),
    `selection synchronization is missing: ${token}`,
  );
}
assert.match(
  fiveEditor,
  /getUi\(\)\.fiveVFiveSelectedSlot === button\.dataset\.fiveSlot \? null : button\.dataset\.fiveSlot/,
);
assert.match(
  fiveEditor,
  /fiveVFive\.assign[\s\S]*getUi\(\)\.fiveVFiveSelectedSlot = null;[\s\S]*refreshFiveAfterAssignment/,
);
assert.match(
  fiveEditor,
  /fiveVFive\.clearSlot[\s\S]*getUi\(\)\.fiveVFiveSelectedSlot = null;[\s\S]*refreshFiveAfterAssignment/,
);
assert.strictEqual(
  (fiveEditor.match(/addEventListener\("click", onFiveSlotClick\)/g) || [])
    .length,
  2,
);

class FakeSlot {
  constructor(key) {
    this.dataset = { fiveSlot: key };
    this.attributes = {};
    this.labels = [];
    this.classList = {
      toggle: (name, active) => {
        this.selected = name === "selected" && active;
      },
    };
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  querySelectorAll() {
    return this.labels.slice();
  }
  append(label) {
    label.parent = this;
    this.labels.push(label);
  }
}
const slots = ["GK", "DF", "FW"].map((key) => new FakeSlot(key));
const documentStub = {
  querySelectorAll: () => slots,
  createElement: () => ({
    remove() {
      this.parent.labels = this.parent.labels.filter((label) => label !== this);
    },
  }),
};
const selectionContext = { selectedSlot: null, document: documentStub };
vm.runInNewContext(`${selectionSync}; this.sync = syncFiveSlotSelection;`, {
  ...selectionContext,
  getUi: () => selectionContext,
});
for (const key of ["GK", "DF", "FW"]) {
  selectionContext.fiveVFiveSelectedSlot = key;
  vm.runInNewContext(`${selectionSync}; syncFiveSlotSelection(document);`, {
    document: documentStub,
    getUi: () => selectionContext,
  });
  assert.strictEqual(
    slots.filter((slot) => slot.labels.length === 1).length,
    1,
  );
  assert.strictEqual(
    slots.find((slot) => slot.dataset.fiveSlot === key).attributes[
      "aria-selected"
    ],
    "true",
  );
}
selectionContext.fiveVFiveSelectedSlot = null;
vm.runInNewContext(`${selectionSync}; syncFiveSlotSelection(document);`, {
  document: documentStub,
  getUi: () => selectionContext,
});
assert.strictEqual(slots.filter((slot) => slot.labels.length).length, 0);
assert.ok(
  slots.every(
    (slot) => slot.attributes["aria-selected"] === "false" && !slot.selected,
  ),
);

console.log(
  "tactical-player-card-test: full tactical card, selection, quick detail and CSS contracts OK",
);
