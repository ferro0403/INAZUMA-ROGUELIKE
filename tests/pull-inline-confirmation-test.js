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
assert(appJs.includes('data-pull-action="confirm"') && appJs.includes('data-pull-action="cancel"') && appJs.includes('data-pull-action="detail"'), "SÌ, NO and SCHEDA actions are present inline");
assert(appJs.includes('choiceGrid?.addEventListener("click"'), "pull actions use one delegated listener");
assert(appJs.includes('option.classList.toggle("is-selected", selected)'), "only the selected wrapper receives selection state");
assert(appJs.includes('actions?.classList.toggle("is-active", selected)'), "selection updates only the active candidate action area without hiding the three action sets");
assert(appJs.includes('options.onPick(player);'), "Sì reuses the existing pick logic with the selected player");
assert(appJs.includes('showPlayerDetailsFor(player') && appJs.includes('updateInlinePullSelection(restoredGrid'), "Scheda opens the standard Player Detail and restores selection on close");
assert(appJs.includes('aria-expanded="false"') && appJs.includes('aria-pressed="false"') && appJs.includes('aria-controls="${panelId}"'), "card triggers expose accessible expanded/controlled state");
assert(css.includes('.pull-choice-actions') && css.includes('.pull-choice-option.is-selected'), "inline pull confirmation has scoped styling");
assert(css.includes('.pull-selection-modal .pull-offer-grid') && css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), "desktop pull keeps three comparable candidates");
assert(css.includes('.pull-selection-modal .pull-choice-option { display: grid; grid-template-columns: minmax(0, 1fr) 118px'), "mobile pull keeps compact horizontal cards with candidate actions attached");
assert(appJs.includes('className: `pull-selection-modal ${options.legendary ? "pull-selection-modal--legendary" : ""}`'), "legendary pull prestige remains a scoped presentation variant");
assert(appJs.includes('onReroll: scoutToken && !legendaryPull ? rerollPull : null') && appJs.includes('showLuckyCharm: luckyCompatible'), "legendary pulls keep scout and lucky-charm controls out of the visible action bar");
assert(appJs.includes('class="player-grid mobile-compact-player-list bench-replacement-grid"') && appJs.includes('className: "pull-selection-modal bench-replacement-modal"'), "full roster replacement reuses the Pull card system");
assert(!playerCardMatch[0].includes('pull-choice-actions') && !playerCardMatch[0].includes('data-pull-action'), "shared card renderer remains free of pull confirmation markup");
assert(!appJs.includes("Vuoi aggiungere undefined"), "inline confirmation copy never hardcodes undefined player text");

console.log("Pull inline confirmation regression test passed.");
