"use strict";

const assert = require("assert");
const fs = require("fs");

const appJs = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/game.css", "utf8");
const playerCardMatch = appJs.match(/  function playerCard\(player, options = \{\}\) \{[\s\S]*?\n  \}\n\n  function teamLogoMarkup/);

assert(playerCardMatch, "shared large player-card renderer exists");
assert(!appJs.includes("function showPullConfirmation"), "separate pull confirmation modal has been removed");
assert(appJs.includes('class="candidate-grid pull-offer-grid" data-pull-choice-grid'), "pull offers still render one grid for the three candidates");
assert(appJs.includes("options.candidates.map((player, index)"), "inline confirmation wraps each existing candidate without duplicating pull flows");
assert(appJs.includes("pullChoiceActionPanel(player, index)"), "inline confirmation panel is appended outside the shared card renderer");
assert(appJs.includes('data-pull-action="confirm"') && appJs.includes('data-pull-action="cancel"') && appJs.includes('data-pull-action="detail"'), "Sì, Annulla and Scheda actions are present inline");
assert(appJs.includes('choiceGrid?.addEventListener("click"'), "pull actions use one delegated listener");
assert(appJs.includes('option.classList.toggle("is-selected", selected)'), "only the selected wrapper receives selection state");
assert(appJs.includes('actions.hidden = !selected'), "only one inline confirmation can remain visible");
assert(appJs.includes('options.onPick(player);'), "Sì reuses the existing pick logic with the selected player");
assert(appJs.includes('showPlayerDetailsFor(player') && appJs.includes('updateInlinePullSelection(restoredGrid'), "Scheda opens the standard Player Detail and restores selection on close");
assert(appJs.includes('aria-expanded="false"') && appJs.includes('aria-pressed="false"') && appJs.includes('aria-controls="${panelId}"'), "card triggers expose accessible expanded/controlled state");
assert(css.includes('.pull-choice-actions') && css.includes('.pull-choice-option.is-selected'), "inline pull confirmation has scoped styling");
assert(!playerCardMatch[0].includes('pull-choice-actions') && !playerCardMatch[0].includes('data-pull-action'), "shared card renderer remains free of pull confirmation markup");
assert(!appJs.includes("Vuoi aggiungere undefined"), "inline confirmation copy never hardcodes undefined player text");

console.log("Pull inline confirmation regression test passed.");
