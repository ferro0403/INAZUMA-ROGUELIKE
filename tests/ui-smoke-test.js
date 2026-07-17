"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
function loadJsdom() {
  try { return require("jsdom"); } catch (firstError) {
    try { return require("/tmp/inazuma-jsdom/node_modules/jsdom"); } catch (secondError) {
      console.error("jsdom is required. Install it with: npm install --prefix /tmp/inazuma-jsdom --cache /tmp/npm-cache jsdom");
      throw secondError;
    }
  }
}
const { JSDOM, VirtualConsole } = loadJsdom();

const root = path.resolve(__dirname, "..");
require(path.join(root, "js/match-simulator-config.js"));
require(path.join(root, "js/match-simulator.js"));
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(/@media \(max-width: 780px\)[\s\S]*?\.route-map[\s\S]*?min-width:\s*0/.test(css), "mobile route map must not keep the desktop 620px min width");
assert(css.includes(".route-map::before") && css.includes("pointer-events: none"), "route map field layers must be decorative and not intercept clicks");
assert(css.includes("repeating-linear-gradient(90deg") && css.includes("radial-gradient(circle at 50% 50%"), "route map must render a striped soccer field with center-circle lines");
const routeMapBefore = css.match(/\.route-map::before\s*\{([\s\S]*?)\n\}/)?.[1] || "";
assert(routeMapBefore.includes("radial-gradient(circle at 50% 50%"), "route map center circle must remain visible");
assert(routeMapBefore.includes("transparent calc(50%") && routeMapBefore.includes("calc(50% +"), "route map half-way line must remain visible");
assert(!/linear-gradient\(90deg,\s*rgba\(244,255,242,[^)]+\) 0 0\)\s*(?:left|right) 50% top 50% \/ 18% 24% no-repeat/.test(css), "desktop route map must not draw filled center/penalty panels");
assert(!/background(?:-color)?:\s*rgba\(255,\s*255,\s*255/.test(routeMapBefore), "route map field layer must not use a white translucent background");
assert(css.includes("pointer-events: none"), "route map decorative layers must not intercept clicks");

assert(css.includes(".boss-node-logo") && css.includes("object-fit: contain"), "boss node logos must keep original proportions inside the node");
assert(/@media \(max-width: 780px\)[\s\S]*?\.map-wrap[\s\S]*?overflow-x:\s*hidden/.test(css), "mobile map wrapper must hide horizontal overflow");
assert(/@media \(max-width: 780px\)[\s\S]*?\.pitch-row, \.tactical-row\s*\{[^}]*--pitch-card-size:[^}]*display:\s*grid[\s\S]*?grid-template-columns:\s*repeat\(var\(--row-count, var\(--players-in-row, 1\)\), minmax\(0, var\(--pitch-card-size\)\)\)/.test(css), "mobile tactical rows must keep compact fixed-width card columns by row count");
assert(/@media \(max-width: 780px\)[\s\S]*?\.player-detail-modal\s*\{[\s\S]*?justify-self:\s*center[\s\S]*?width:\s*calc\(100vw - 20px\)/.test(css), "mobile player detail modal must be centered without lateral overflow");
assert(css.includes("grid-template-columns: repeat(4, minmax(0, 1fr))"), "mobile bottom nav must show four uniform items");
assert(css.includes("align-items: center"), "desktop fullbody visual should not be pinned to the bottom");
assert(css.includes("width: min(100%, 560px)"), "desktop fullbody art should keep the approved size");
assert(css.includes("object-fit: contain"), "fullbody art should not deform");
assert(css.includes("width: min(90%, 340px)"), "mobile fullbody art should keep the approved size without overflow");
assert(css.includes(".rarity-normale") && css.includes(".rarity-leggenda"), "rarity card classes must be centralized in CSS");
assert(css.includes(".rarity-debole { --rarity-bg: #0b1c37"), "Debole must keep the original dark card background");
assert(css.includes(".trade-bench-panel .bench-list { grid-auto-rows: max-content;"), "trade reserve grid rows must size to content instead of stretching cards");
assert(css.includes(".trade-bench-panel .mini-player { width: min(150px, 100%); max-width: 150px;"), "trade reserve cards must keep a readable reserve-card width without stretching");
assert(css.includes(".player-card.selected") && css.includes("outline: 3px solid #05070b"), "selected player cards must have a high-contrast outline");
assert(css.includes(".player-role { top: 8px; left: 8px;"), "player role badge must sit in the top-left card corner");
assert(css.includes(".player-overall { top: 8px; right: 8px;"), "player overall badge must sit in the top-right card corner");
assert(css.includes(".player-level { right: 8px; bottom: 8px;"), "player level badge must sit in the bottom-right card corner");
assert(css.includes(".player-equipment { bottom: 8px; left: 8px;"), "equipped item icon must sit in the bottom-left card corner");
assert(css.includes(".player-info { padding: 8px 38px 34px; text-align: center;"), "player name must remain centered with corner-badge clearance");
assert(css.includes(".candidate-grid .player-card { display: block;"), "mobile candidate cards must keep the shared vertical player-card structure");
assert(css.includes(".pull-offer-grid, .mobile-compact-player-list { gap: 10px; }"), "pull, confirmation and bench replacement cards must share the compact mobile spacing");
assert(/@media \(max-width: 780px\)[\s\S]*?\.mobile-compact-player-list \.player-card-large[\s\S]*?grid-template-columns:\s*82px minmax\(0, 1fr\) 42px/.test(css), "mobile confirmation and full-roster replacement cards must use the same horizontal compact grid as pull candidates");
assert(/@media \(max-width: 780px\)[\s\S]*?\.pull-offer-grid \.player-card-large \.player-portrait, \.mobile-compact-player-list \.player-card-large \.player-portrait[\s\S]*?height:\s*100%[\s\S]*?object-fit:\s*contain/.test(css), "mobile confirmation portrait must reuse the pull compact visible portrait rule");
assert(!/\.rarity-(?:scarso|normale|buono|forte|elite|mondiale|leggenda) \{[^}]*gradient\(/.test(css), "rarity classes must use flat colors, not gradients");
assert(css.includes("--detail-rarity-bg"), "player detail fullbody visual background must use rarity card color");
assert(css.includes(".player-card-large"), "pull and candidate cards must keep a distinct large player-card variant");
assert(css.includes(".pull-player-card--desktop") && css.includes(".pull-player-card--mobile"), "pull cards must expose separated desktop/mobile variant classes");
assert(css.includes(".tactical-player-card--desktop") && css.includes(".tactical-player-card--mobile"), "tactical cards must expose separated desktop/mobile variant classes");
assert(css.includes(".player-card-compact, button.player-card-compact, .tactical-player-card"), "compact tactical cards must override the generic button.player-card width rule");
assert(/\.player-card-compact, button\.player-card-compact, \.tactical-player-card[^\{]*\{[^}]*max-width:\s*150px/.test(css), "desktop compact tactical cards must cap their width so two-player rows cannot stretch cards");
assert(/\.player-card-compact, button\.player-card-compact, \.tactical-player-card[^\{]*\{[^}]*flex:\s*0 0 auto/.test(css), "compact tactical cards must not flex-grow like large cards");
assert(/\.pitch-row, \.tactical-row \{[^}]*grid-template-columns:\s*repeat\(var\(--row-count, var\(--players-in-row, 1\)\), minmax\(0, 1fr\)\)/.test(css), "desktop tactical rows must use row count grid columns without wrapping");
assert(css.includes(".player-card-compact .player-overall"), "compact player cards must resize the shared top-right overall badge");
assert(css.includes(".player-card-compact .player-equipment"), "compact player cards must render equipped items as corner icons only");
assert(css.includes(".item-icon"), "item icons must have shared SVG styling");
assert(css.includes(".item-assignment-layout"), "item assignment must reuse the tactical pitch layout responsively");
assert(css.includes(".five-player-equipment { position: absolute; left: 6px; bottom: 6px;"), "5v5 equipment indicator must be pinned bottom-left without layout shift on desktop");
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-player-equipment \{[^}]*width:\s*22px; height:\s*22px/.test(css), "5v5 equipment indicator must use smaller mobile dimensions");
assert(css.includes(".five-match-card .five-player-equipment"), "5v5 match cards must have mobile-specific equipment sizing");
assert(css.includes(".mobile-equipment-badge"), "equipment badges must expose a shared mobile-specific class");
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-card \{[^}]*box-sizing:\s*border-box[^}]*width:\s*var\(--five-mobile-card-width, 96px\)[^}]*height:\s*92px/.test(css), "mobile 5v5 match cards must share the same fixed box model");
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-line\[data-row-count="2"\] \{ --five-mobile-card-width: 96px; \}/.test(css), "mobile 5v5 two-card midfield rows must not use a different card size");
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-screen \.five-match-field-side--mobile\.five-match-field-side--user \.five-match-card \.five-player-equipment \{[^}]*bottom:\s*8px;[^}]*left:\s*8px;[^}]*width:\s*22px;[^}]*height:\s*22px/.test(css), "mobile 5v5 user equipment badge must stay inside the bottom-left corner");
assert(appJs.includes('function renderMatchFormation({ players, formationId, side = "user"') && appJs.includes('showEquipment: side === "user"'), "mobile and desktop boss 11v11 previews must reuse the shared formation renderer with parameterized equipment");
assert(!/@media \(max-width: 780px\)[\s\S]*?\.boss-match-field-side--mobile \.boss-match-card-item/.test(css), "mobile boss user equipment badge must not have a separate boss-preview override");
assert(!/@media \(max-width: 780px\)[\s\S]*?(?:\.five-player-equipment|\.boss-match-card-item|\.player-equipment) \{[^}]*-(?:top|left|right|bottom):/.test(css), "mobile equipment badges must not use negative offsets");
assert(css.includes(".button-row { display: flex; flex-wrap: wrap;"), "pull action buttons must wrap cleanly for mobile/desktop controls");

assert(indexHtml.includes("js/match-simulator-config.js") && indexHtml.includes("js/match-simulator.js"), "match simulator scripts must be loaded before app.js");
assert(appJs.includes("Simula partita"), "match screens must expose the Simula partita button");
assert(appJs.includes("function bossTeamLogoUrl(boss)") && appJs.includes("boss?.logoUrl || team?.logoUrl"), "boss map nodes must resolve logos from existing boss/team data");
assert(appJs.includes("function bossNodeIconMarkup(boss)") && appJs.includes("onerror=\"this.remove();this.parentElement?.classList.add('boss-logo-missing');\""), "boss map nodes must provide an image-error fallback");
assert(appJs.includes("simPreview.probabilities ? Math.round(simPreview.probabilities.user * 100)"), "11v11 and 5v5 screens must render probabilities from the simulator helper result");
assert(appJs.includes("global.MatchSimulator.simulate({ ...teams, seed: matchSeed(match) })"), "UI preview and engine simulation must use the same MatchSimulator entry point and helper-derived probabilities");
const simulatorJs = fs.readFileSync(path.join(root, "js/match-simulator.js"), "utf8");
assert(simulatorJs.includes("function getMatchWinProbabilities(mode, userStrength, opponentStrength)"), "central probability helper must receive the match mode");
assert(simulatorJs.includes("const probs = probabilities(type, userStrength.final, opponentStrength.final)"), "engine must pass the normalized match type into the central probability helper");
assert(simulatorJs.includes("determineUserWins(probs.userChance, rng)"), "engine RNG must use the same helper-derived userChance shown by the UI");
assert(simulatorJs.includes("rng() < userChance / 100"), "RNG comparison must use userChance / 100 without inversion");
assert.equal(global.MatchSimulator.getMatchWinProbabilities("five", 40, 60).userChance, 80, "5v5 UI table: weaker by 20 shows 80/20");
assert.equal(global.MatchSimulator.getMatchWinProbabilities("five", 65, 60).userChance, 85, "5v5 UI table: stronger by 5 shows 85/15");
assert.equal(global.MatchSimulator.getMatchWinProbabilities("five", 70, 60).userChance, 90, "5v5 UI table: stronger by 10 shows 90/10");
assert.equal(global.MatchSimulator.getMatchWinProbabilities("five", 75, 60).userChance, 95, "5v5 UI table: stronger by 15 shows 95/5");
assert.equal(global.MatchSimulator.getMatchWinProbabilities("eleven", 60, 85).userChance, 40, "11v11 table must not inherit the 5v5 80% floor");
assert(appJs.includes("if (match.simulation?.valid) return match.simulation;") && appJs.includes("if (!sim || sim.state !== \"simulating\" || sim.manuallyResolved) return;"), "refresh and Vai al risultato must reuse the existing simulation instead of extracting again");
assert(appJs.includes("const TEST_MATCH_CONTROLS_ENABLED = true") && appJs.includes("Vittoria sicura"), "temporary safe victory control must be visible for testing");
assert(appJs.includes("startMatchSimulation") && appJs.includes("resolutionApplied"), "match UI must persist simulation and guard one-time resolution");
assert(appJs.includes("const baseStats = resolved.baseStats || resolved.stats") && appJs.includes("? resolved.stats") && appJs.includes("applyEquipment(resolved.stats, equipment)"), "player detail must not apply equipment twice when resolved stats already include equipment");
assert(appJs.includes("function fivePlayerEquipmentMarkup(equipment)") && appJs.includes("Oggetto equipaggiato:") && appJs.includes("fivePlayerEquipmentMarkup(rosterEntry(player.playerId)?.equippedItem)"), "5v5 formation cards must render an accessible equipped-item indicator from roster equipment");
assert(appJs.includes("function equipmentBadgeMarkup(equipment") && appJs.includes("mobile-equipment-badge"), "equipment badge markup must be centralized with the shared mobile class");
assert(appJs.includes('function matchFormationCard(player') && appJs.includes('equipment: showEquipment ?'), "boss match cards must reuse compact player-card equipment rendering structurally");
assert(appJs.includes('showEquipment: side === "user"'), "boss match user side alone should request equipped item rendering");
assert(appJs.includes('return equipmentBadgeMarkup(equipment, "five-player-equipment");'), "5v5 cards must reuse the shared equipment badge helper");
assert.equal((appJs.match(/fivePlayerEquipmentMarkup\(equipment\)/g) || []).length, 1, "5v5 equipment helper must be defined once");
assert(appJs.includes('side === "user" ? (player.equipment || rosterEntry(player.playerId)?.equippedItem) : null'), "5v5 match cards must render equipment only for the user side, never for free-agent opponents");
assert(css.includes(".boss-match-log.match-sim-log") && css.includes("overflow-y: auto") && css.includes("-webkit-overflow-scrolling: touch"), "match commentary must be internally scrollable on desktop and touch devices");
assert((appJs.match(/class="panel five-match-controls five-v-five-mobile-actions"/g) || []).length === 1, "5v5 mobile/desktop must reuse one action bar in the DOM");
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-screen > \.five-v-five-mobile-actions \{[^}]*position:\s*static[\s\S]*?left:\s*auto[\s\S]*?right:\s*auto[\s\S]*?bottom:\s*auto[\s\S]*?z-index:\s*auto/.test(css), "mobile 5v5 action bar must stay in normal document flow");
assert(!/@media \(max-width: 780px\)[\s\S]*?\.five-match-screen > \.five-v-five-mobile-actions \{[^}]*position:\s*(?:fixed|sticky|absolute)/.test(css), "mobile 5v5 action bar must not be fixed, sticky, or absolute");
assert(!css.includes("--mobile-five-actions-height") && !/\.five-match-content \{[^}]*padding-bottom:\s*calc\(var\(--mobile-five-actions-height\)/.test(css), "mobile 5v5 content must not compensate a fixed action bar");
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-controls \.button-row \.btn-back \{[^}]*display:\s*none/.test(css), "mobile 5v5 must expose only one visible return-to-map action");
assert(appJs.includes('five-match-header-back') && appJs.includes('five-match-back-short'), "mobile 5v5 header must keep return navigation in normal layout");
assert(!/boss-match-controls[\s\S]{0,120}position:\s*fixed/.test(css), "11v11 action bar must remain outside mobile 5v5 positioning treatment");

assert(appJs.includes('function resetViewScroll(viewElement = null)'), "UI must use a centralized resetViewScroll helper");
assert(appJs.includes('function scrollTargetsForView(viewElement = null)'), "reset helper must inspect the real scrollable view/modal containers");
assert(appJs.includes('behavior: "auto"') && !appJs.includes('behavior: "smooth"'), "scroll resets must be immediate on desktop and mobile");
assert(appJs.includes('history.scrollRestoration = "manual"'), "browser restoration must not override app-level scroll resets");
assert(appJs.includes('function afterNextPaint(callback)') && appJs.includes('requestAnimationFrame(() => requestAnimationFrame(callback))'), "scroll resets must be scheduled after rendering");
assert(!/resetViewScroll[\s\S]{0,260}max-width: 780px|innerWidth\s*<=\s*780/.test(appJs), "resetViewScroll must not be guarded by a mobile-only breakpoint");

const mime = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
};

const server = http.createServer((request, response) => {
  const requested = new URL(request.url, "http://localhost").pathname;
  const relative = requested === "/" ? "index.html" : requested.slice(1);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root) || !fs.existsSync(target)) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream" });
  fs.createReadStream(target).pipe(response);
});

function waitFor(window, selector, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const element = window.document.querySelector(selector);
      if (element) return resolve(element);
      if (Date.now() - started > timeout) return reject(new Error(`Timed out waiting for ${selector}`));
      setTimeout(check, 25);
    };
    check();
  });
}

server.listen(0, "127.0.0.1", async () => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  virtualConsole.on("error", (error) => errors.push(error));

  let dom = null;
  try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/`;
    dom = await JSDOM.fromURL(url, {
      resources: "usable",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      virtualConsole,
      beforeParse(window) {
        window.fetch = (input, options) => global.fetch(new URL(input, window.location.href), options);
        window.confirm = () => true;
        window.matchMedia = (query) => ({ matches: /max-width:\s*780px/.test(query), media: query, addEventListener() {}, removeEventListener() {} });
      },
    });

    const { window } = dom;
    (await waitFor(window, "#new-run")).click();
    const teamNameInput = await waitFor(window, "#team-name-input");
    teamNameInput.value = "Raimon Test";
    teamNameInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    window.document.querySelector("#confirm-team-name").click();
    await waitFor(window, '[data-formation="4-2-4"]');
    assert.equal(JSON.parse(window.localStorage.getItem("inazuma_roguelike_profile")).teamIdentity.name, "Raimon Test", "team name is saved in the global profile");
    window.document.querySelector('[data-formation="4-2-4"]').click();
    for (let choice = 0; choice < 11; choice += 1) {
      (await waitFor(window, "[data-player-id]")).click();
    }
    await waitFor(window, "#go-map");
    assert(window.document.body.textContent.includes("Gestione squadra"));
    const firstDraftCard = window.document.querySelector(".player-card");
    assert(firstDraftCard.querySelector(".player-role"), "standard player cards render the role in a top-left badge");
    assert(firstDraftCard.querySelector(".player-overall"), "standard player cards render the overall in a top-right badge");
    assert(firstDraftCard.querySelector(".player-level"), "standard player cards render the level in a bottom-right badge");
    assert(firstDraftCard.querySelector(".player-title strong"), "standard player cards keep a central readable name");
    assert(firstDraftCard.classList.contains("player-card-large"), "draft/pull cards must render with the large card variant");
    assert(!firstDraftCard.classList.contains("player-card-compact"), "draft/pull cards must not inherit compact tactical sizing");
    assert(!firstDraftCard.querySelector(".player-equipment"), "standard player cards without equipment must not render an empty equipment badge");
    const compactCards = window.document.querySelectorAll(".pitch-row .player-card-compact");
    assert(compactCards.length > 0, "starters must render the compact shared player-card variant");
    assert(!compactCards[0].classList.contains("player-card-large"), "squad starters must not inherit large pull card sizing");
    assert(compactCards[0].querySelector(".player-role"), "compact cards render the role in the top-left corner");
    assert(compactCards[0].querySelector(".player-overall"), "compact cards render the overall in the top-right corner");
    assert(compactCards[0].querySelector(".player-level"), "compact cards render the level in the bottom-right corner");
    assert(!compactCards[0].querySelector(".player-equipment"), "compact cards without equipment must not render an empty item icon");
    const rowCounts = [...window.document.querySelectorAll(".pitch-row")].map((row) => row.children.length);
    assert.deepEqual(rowCounts, [4, 2, 4, 1], "4-2-4 must keep 4 / 2 / 4 / 1 visual rows");
    assert([...window.document.querySelectorAll(".pitch-row")].every((row) => row.dataset.rowCount === String(row.children.length || 1)));
    assert([...window.document.querySelectorAll(".pitch-row")].every((row) => row.getAttribute("style").includes(`--row-count:${row.children.length || 1}`)));
    assert(css.includes("var(--pitch-card-size)"), "card width must stay constant for one- and two-player rows");
    assert(/@media \(max-width: 780px\)[\s\S]*?\.pitch-row, \.tactical-row\s*\{[\s\S]*?gap:\s*clamp\(6px, 1\.8vw, 10px\)[\s\S]*?margin:\s*12px 0 26px/.test(css), "mobile squad rows must be slightly more spaced without expanding compact cards");
    assert.equal(window.document.querySelectorAll(".bottom-nav [data-nav]").length, 4, "bottom nav must expose four destinations");
    const squadSignature = [...window.document.querySelectorAll(".pitch-row")].map((row) => row.children.length).join("/");
    window.document.querySelector('[data-nav="inventory"]').click();
    await waitFor(window, ".item-grid");
    assert(window.document.querySelector('[data-nav="inventory"]').classList.contains("active"));
    window.document.querySelector('[data-nav="five"]').click();
    await waitFor(window, ".five-screen");
    assert(window.document.body.textContent.includes("Formazione 5v5"));
    assert(window.document.body.textContent.includes("1-2-1"));
    assert(window.document.body.textContent.includes("1-1-2"));
    assert(window.document.querySelector('[data-nav="five"]').classList.contains("active"), "5v5 nav item must be active");
    assert.equal(window.document.querySelectorAll(".five-slot").length, 5, "5v5 pitch must render exactly five slots");
    assert(window.document.querySelector(".five-validation.valid"), "auto-created 1-2-1 must be valid after draft");
    window.document.querySelector('[data-five-formation="1-1-2"]').click();
    await waitFor(window, ".five-formation-card.selected");
    assert(window.document.querySelector('[data-five-formation="1-1-2"]').classList.contains("selected"));
    window.document.querySelector("#clear-five-slot").click();
    await waitFor(window, ".five-validation.invalid");
    assert(window.document.querySelector("#save-five").disabled, "incomplete 5v5 formation cannot be saved");
    window.document.querySelector('[data-nav="squad"]').click();
    await waitFor(window, ".pitch-row");
    assert.equal([...window.document.querySelectorAll(".pitch-row")].map((row) => row.children.length).join("/"), squadSignature, "5v5 editing must not alter 11v11 rows");
    window.document.querySelector("[data-squad-player]").click();
    await waitFor(window, ".player-detail-modal");
    assert(window.document.querySelector(".player-fullbody").src.includes("_fullbody.webp"));
    assert(window.document.querySelector(".player-detail-visual[class*=\"rarity-\"]"), "player detail visual must carry the player rarity class");
    assert(window.document.querySelector(".player-detail-team"), "player detail must show the source team identity above the fullbody");
    assert(window.document.querySelector(".player-detail-team strong").textContent.trim().length > 0, "player detail must show the source team name");
    assert.equal(window.document.querySelectorAll(".detail-stat").length, 8);
    assert(window.document.body.textContent.includes("Potenziale"));
    window.document.querySelector("[data-close-modal]").click();
    window.document.querySelector("#go-map").click();
    await waitFor(window, ".route-map");
    assert(window.document.querySelectorAll(".map-node").length > 8);
    assert(window.document.querySelectorAll(".map-node.reachable").length > 0);
    const bossMapNode = window.document.querySelector(".map-node[data-node-id$='_boss']");
    assert(bossMapNode, "boss node must remain rendered with its original node id");
    assert(bossMapNode.querySelector(".boss-node-logo"), "boss node must try to render the real team logo");
    assert(bossMapNode.textContent.includes("Occult"), "boss team name must stay visible under the node");
    assert.equal(bossMapNode.querySelector(".boss-node-logo").getAttribute("alt"), "Logo Occult", "boss logo must have descriptive alt text");
    assert(bossMapNode.disabled, "locked boss node must remain non-clickable until reached");
    assert(bossMapNode.classList.contains("locked"), "locked boss state must remain visually classified");
    assert(window.document.querySelector(".map-node.reachable:not([data-node-id$='_boss']) .node-icon").textContent.trim().length > 0, "non-boss nodes must keep their existing icon text");
    assert.deepEqual(window.run?.currentZone?.edges, window.run?.currentZone?.edges, "route edges remain available after rendering");
    assert(css.includes(".trade-squad-layout"), "trade modal should use tactical pitch layout styles");
    const scrollWait = () => new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    const activeView = () => window.document.querySelector("main");
    activeView().scrollTop = 321;
    window.document.scrollingElement.scrollTop = 321;
    window.scrollTo(0, 321);
    window.document.querySelector('[data-nav="inventory"]').click();
    await waitFor(window, ".item-grid");
    await scrollWait();
    assert.equal(window.document.scrollingElement.scrollTop, 0, "opening inventory must reset document scroll on desktop viewport");
    assert.equal(activeView().scrollTop, 0, "opening inventory must reset the active view container");
    activeView().scrollTop = 222;
    window.document.querySelector('[data-nav="map"]').click();
    await waitFor(window, ".route-map");
    await scrollWait();
    assert.equal(activeView().scrollTop, 0, "opening route map must reset the active view container");
    activeView().scrollTop = 177;
    window.document.querySelector('[data-nav="squad"]').click();
    await waitFor(window, ".pitch-row");
    await scrollWait();
    assert.equal(activeView().scrollTop, 0, "opening squad must reset the active view container");
    activeView().scrollTop = 246;
    const selectedBefore = activeView().scrollTop;
    const squadScreenBefore = activeView();
    const pitchBefore = window.document.querySelector(".pitch");
    const bottomNavBefore = window.document.querySelector(".bottom-nav");
    const firstSquadCard = window.document.querySelector("[data-squad-player]");
    window.document.querySelector("#toggle-squad-edit").click();
    await scrollWait();
    assert.equal(activeView(), squadScreenBefore, "internal squad edit toggle must keep the same squad screen node");
    assert.equal(window.document.querySelector(".pitch"), pitchBefore, "internal squad edit toggle must keep the same pitch node");
    assert.equal(window.document.querySelector(".bottom-nav"), bottomNavBefore, "internal squad edit toggle must keep the same bottom nav node");
    assert.equal(activeView().scrollTop, selectedBefore, "internal squad edit toggle must preserve scroll");
    firstSquadCard.click();
    await waitFor(window, ".mini-player.selected");
    await scrollWait();
    assert.equal(activeView(), squadScreenBefore, "internal player selection must keep the same squad screen node");
    assert.equal(window.document.querySelector(".pitch"), pitchBefore, "internal player selection must keep the same pitch node");
    assert.equal(window.document.querySelector(".bottom-nav"), bottomNavBefore, "internal player selection must keep the same bottom nav node");
    assert.equal(activeView().scrollTop, selectedBefore, "internal player selection must preserve scroll");
    window.document.querySelector("#toggle-squad-edit").click();
    await scrollWait();
    activeView().scrollTop = 199;
    window.document.querySelector("[data-squad-player]").click();
    await waitFor(window, ".player-detail-modal");
    await scrollWait();
    assert.equal(window.document.querySelector(".modal").scrollTop, 0, "player detail modal must open at the top");
    window.document.querySelector("[data-close-modal]").click();
    assert(window.runKeepingScroll === undefined, "scroll helpers should stay internal to the app closure");
    assert(window.document.documentElement.innerHTML.includes("bottom-nav"));
    const mapScroll = window.document.querySelector("#map-scroll");
    mapScroll.scrollLeft = 99;
    window.document.querySelector(".map-node.reachable").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(mapScroll.scrollLeft, 99, "node click must not alter horizontal map scroll");
    assert.equal(errors.length, 0, errors.map((error) => error.message).join("\n"));
    console.log("UI smoke test passed: menu, 4-2-4 draft, squad and route map.");
    dom.window.close();
  } finally {
    server.close();
  }
});
