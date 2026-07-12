"use strict";

const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { JSDOM, VirtualConsole } = require("/tmp/inazuma-jsdom/node_modules/jsdom");

const root = path.resolve(__dirname, "..");
require(path.join(root, "js/match-simulator-config.js"));
require(path.join(root, "js/match-simulator.js"));
const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
assert(/@media \(max-width: 780px\)[\s\S]*?\.route-map[\s\S]*?min-width:\s*0/.test(css), "mobile route map must not keep the desktop 620px min width");
assert(css.includes(".route-map::before") && css.includes("pointer-events: none"), "route map field layers must be decorative and not intercept clicks");
assert(css.includes("repeating-linear-gradient(90deg") && css.includes("radial-gradient(circle at 50% 50%"), "route map must render a striped soccer field with center-circle lines");
assert(css.includes(".boss-node-logo") && css.includes("object-fit: contain"), "boss node logos must keep original proportions inside the node");
assert(/@media \(max-width: 780px\)[\s\S]*?\.map-wrap[\s\S]*?overflow-x:\s*hidden/.test(css), "mobile map wrapper must hide horizontal overflow");
assert(/@media \(max-width: 780px\)[\s\S]*?\.pitch-row, \.tactical-row\s*\{[^}]*--pitch-card-size:[^}]*display:\s*grid[\s\S]*?grid-template-columns:\s*repeat\(var\(--row-count, var\(--players-in-row, 1\)\), minmax\(0, var\(--pitch-card-size\)\)\)/.test(css), "mobile tactical rows must keep compact fixed-width card columns by row count");
assert(/@media \(max-width: 780px\)[\s\S]*?\.player-detail-modal\s*\{[\s\S]*?justify-self:\s*center[\s\S]*?width:\s*min\(100%, calc\(100vw - 24px\)\)/.test(css), "mobile player detail modal must be centered without lateral overflow");
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
assert(css.includes("background: var(--rarity-bg, #0b1c37)"), "player detail fullbody visual background must use rarity card color");
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
assert(css.includes(".button-row { display: flex; flex-wrap: wrap;"), "pull action buttons must wrap cleanly for mobile/desktop controls");

const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
assert(appJs.includes("Vittoria sicura"), "manual safe victory control must remain visible");
assert(appJs.includes("startMatchSimulation") && appJs.includes("resolutionApplied"), "match UI must persist simulation and guard one-time resolution");
assert(css.includes(".boss-match-log.match-sim-log") && css.includes("overflow-y: auto") && css.includes("-webkit-overflow-scrolling: touch"), "match commentary must be internally scrollable on desktop and touch devices");

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

  try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/`;
    const dom = await JSDOM.fromURL(url, {
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
    (await waitFor(window, '[data-formation="4-2-4"]')).click();
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
