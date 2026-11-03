// Banco di prova comune per le prove nel browser (Playwright).
// Ogni prova riceve una pagina pulita: niente salvataggi, ora fissa, casualita' con seme fisso.
import { createRequire } from "node:module";
import { startStaticServer } from "../../scripts/screenshots/static-server.mjs";
import { collectCssUsage, flushCssUsage } from "../../scripts/css/css-usage-collector.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

export const VIEWPORT = { width: 412, height: 915 };
export const FIXED_TIME = new Date("2026-11-03T12:00:00Z");
const STEP_TIMEOUT = 15000;

// Casualita' con seme fisso: Math.random per la run, e un generatore separato (stesso seme, altra sequenza)
// per crypto.randomUUID / crypto.getRandomValues, usati dal RTG (seme campagna) e dall'evento Halloween.
// Il generatore separato non consuma numeri di Math.random: le mappe gia' fissate restano uguali.
export const seededRandom = (seed) => `(() => {
  const make = (start) => { let s = start | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  Math.random = make(${seed | 0});
  const cryptoRandom = make(${(seed ^ 0x5bd1e995) | 0});
  const hex = () => Math.floor(cryptoRandom() * 16).toString(16);
  try {
    crypto.randomUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => c === "x" ? hex() : (8 + Math.floor(cryptoRandom() * 4)).toString(16));
    crypto.getRandomValues = (array) => { const max = 2 ** (8 * array.BYTES_PER_ELEMENT);
      for (let i = 0; i < array.length; i += 1) array[i] = Math.floor(cryptoRandom() * max); return array; };
  } catch {}
})();`;

// Errori attesi in locale: Firebase (account cloud) non e' configurato per i test.
const IGNORED_ERRORS = /firebase|gstatic|Failed to fetch dynamically imported module/i;

export async function startHarness() {
  const { server, url } = await startStaticServer();
  const browser = await chromium.launch();
  return {
    url,
    async newGame({ seed = 0x2f6b1a3d, dev = false, flowingClock = false } = {}) {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "it-IT", timezoneId: "Europe/Rome" });
      const page = await context.newPage();
      // Orologio fermo su FIXED_TIME: la run generata e' sempre la stessa.
      // flowingClock: l'orologio parte da FIXED_TIME e poi scorre (serve alle partite RTG, che avanzano a tempo).
      if (flowingClock) await page.clock.install({ time: FIXED_TIME });
      else await page.clock.setFixedTime(FIXED_TIME);
      if (seed !== null) await page.addInitScript(seededRandom(seed));
      const errors = [];
      page.on("pageerror", (e) => { if (!IGNORED_ERRORS.test(e.message)) errors.push(e.message); });
      // dev: apre il gioco con ?dev=1, che mostra gli strumenti di test gia' presenti nel gioco (monete, zucche...).
      await page.goto(dev ? `${url}?dev=1` : url, { waitUntil: "domcontentloaded" });
      await waitForHome(page);
      return new Game(page, context, errors);
    },
    async close() {
      flushCssUsage("browser-tests");
      await browser.close();
      server.close();
    },
  };
}

export async function waitForHome(page) {
  await page.locator("#home-primary-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(400);
}

export class Game {
  constructor(page, context, errors) {
    this.page = page;
    this.context = context;
    this.errors = errors;
  }
  async click(selector) {
    const loc = this.page.locator(selector).locator("visible=true").first();
    await loc.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await collectCssUsage(this.page);
    await loc.click({ timeout: STEP_TIMEOUT });
    await this.page.waitForTimeout(400);
    await collectCssUsage(this.page);
  }
  async clickText(text) {
    const loc = this.page.getByText(text, { exact: false }).locator("visible=true").first();
    await loc.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await loc.click({ timeout: STEP_TIMEOUT });
    await this.page.waitForTimeout(400);
    await collectCssUsage(this.page);
  }
  async visible(selector, timeout = STEP_TIMEOUT) {
    await this.page.locator(selector).locator("visible=true").first().waitFor({ state: "visible", timeout });
    return true;
  }
  async text(selector) {
    return (await this.page.locator(selector).first().innerText({ timeout: STEP_TIMEOUT })).replace(/\s+/g, " ").trim();
  }
  // Aspetta che il testo di selector corrisponda a pattern (riprova fino a timeout). Ritorna il testo.
  async waitText(selector, pattern, timeout = STEP_TIMEOUT) {
    const end = Date.now() + timeout;
    let last = "";
    while (Date.now() < end) {
      last = await this.text(selector).catch(() => "");
      if (pattern.test(last)) return last;
      await this.page.waitForTimeout(200);
    }
    throw new Error(`testo atteso ${pattern} in ${selector}, trovato: "${last.slice(0, 160)}"`);
  }
  // waitFor: cosa aspettare dopo il ricaricamento (predefinito: la home).
  async reload({ waitFor = null } = {}) {
    await this.page.reload({ waitUntil: "domcontentloaded" });
    if (waitFor) await this.visible(waitFor, 60000);
    else await waitForHome(this.page);
  }
  // Account di prova: tutti gli svincolati sbloccati, con le funzioni del gioco stesso.
  // maxOverall: sblocca solo i giocatori fino a quell'overall finale (serve per rispettare i cap RTG).
  async unlockAllFreeAgents({ maxOverall = Infinity } = {}) {
    await this.page.evaluate(async (max) => {
      const db = await (await fetch("data/FREE_AGENTS_compact.json")).json();
      const ids = db.players.filter((p) => Number(p.finalOverall ?? p.overall ?? 0) <= max).map((p) => String(p.playerId));
      globalThis.AlbumProgress.configureFreeAgentIds?.(ids);
      // unlockAlbumPlayers puo' essere asincrona (salvataggio permanente): va attesa prima di ricaricare.
      await globalThis.AlbumProgress.unlockAlbumPlayers(globalThis.AlbumProgress.DEFAULT_COLLECTION_ID, ids, {
        firstSource: "browser-test-fixture",
        firstUnlockedAt: "2026-01-01T00:00:00.000Z",
      });
    }, maxOverall);
    await this.reload();
  }
  // Run classica fino alla squadra: nome → primo modulo → draft automatico (prima carta proposta).
  async startClassicRun(seasonCardIndex = 0) {
    await this.click("#home-primary-cta");
    await this.page.locator("text=INIZIA NUOVA RUN").locator("visible=true").nth(seasonCardIndex).click();
    await this.page.waitForTimeout(400);
    await this.page.locator("input").first().fill("Squadra Test");
    await this.click("#confirm-team-name");
    await this.click(".formation-card");
    for (let i = 0; i < 20; i += 1) {
      const card = this.page.locator(".pull-player-card").first();
      if (!(await card.isVisible().catch(() => false))) break;
      await card.click();
      await this.page.waitForTimeout(250);
    }
    await this.visible("#go-map");
  }
  async isVisible(selector) {
    return this.page.locator(selector).locator("visible=true").first().isVisible().catch(() => false);
  }
  // Gioca una partita gia' aperta (5v5 o boss): simula, salta al risultato. Ritorna il testo del risultato.
  async playOpenMatch() {
    await this.click("#simulate-boss-match");
    await this.click("#skip-match-result");
    await this.visible("#continue-match-result");
    return this.text("#simulate-boss-match");
  }
  // Attraversa la mappa della run classica fino a rendere raggiungibile il boss.
  // Preferisce i nodi 5v5, poi oggetti, pull, scambi, eventi; rinuncia a scambi e offerte.
  async walkToBoss(options = {}) {
    return this.walkTo({ ...options, target: ".map-node.boss-node.reachable" });
  }
  // Come walkToBoss, ma si ferma appena e' raggiungibile un nodo di tipo nodeType (es. "special_match").
  async walkToNode(nodeType, options = {}) {
    return this.walkTo({ ...options, target: `.map-node.reachable[data-node-type=${nodeType}]`, nodeType });
  }
  // Nodi della zona da cui si puo' ancora arrivare a un nodo di tipo nodeType (dalla mappa salvata dal gioco).
  async nodesLeadingTo(nodeType) {
    return this.page.evaluate((type) => {
      const seasons = Object.keys(localStorage).map((k) => k.match(/Run_v2:([a-z0-9_]+)$/)?.[1])
        .filter((id) => id && !/_(head|backup)$/.test(id));
      const runs = seasons.map((id) => { try { return globalThis.RunState.load(id); } catch { return null; } });
      const zone = runs.find((r) => r?.currentZone?.nodes?.some((n) => n.type === type))?.currentZone;
      if (!zone) return [];
      const next = new Map();
      for (const [a, b] of zone.edges || []) next.set(a, [...(next.get(a) || []), b]);
      const memo = new Map();
      const reaches = (id) => {
        if (memo.has(id)) return memo.get(id);
        memo.set(id, false);
        const node = zone.nodes.find((n) => n.id === id);
        const ok = node?.type === type || (next.get(id) || []).some(reaches);
        memo.set(id, ok);
        return ok;
      };
      return zone.nodes.filter((n) => reaches(n.id)).map((n) => n.id);
    }, nodeType);
  }
  async walkTo({ target, nodeType = null, maxSteps = 60 } = {}) {
    const advance = ["#open-hidden-event", "#continue-match-result", "#skip-trade", "#skip-offer",
      "#finish-item-reward", "#continue-run", "[data-claim-item]", "#skip-item"];
    const visited = [];
    for (let i = 0; i < maxSteps; i += 1) {
      if (await this.isVisible(target)) return visited;
      let acted = false;
      for (const selector of advance) {
        if (await this.isVisible(`${selector}:not([disabled])`)) {
          await this.click(`${selector}:not([disabled])`);
          acted = true;
          break;
        }
      }
      if (acted) continue;
      if ((await this.isVisible("#simulate-boss-match")) && /simula partita/i.test(await this.text("#simulate-boss-match"))) {
        await this.playOpenMatch();
        continue;
      }
      let entered = false;
      // Verso un nodo preciso: solo i nodi da cui quel nodo e' ancora raggiungibile.
      const allowed = nodeType ? await this.nodesLeadingTo(nodeType) : null;
      const only = allowed ? allowed.map((id) => `[data-node-id="${id}"]`).join(", ") : "";
      for (const type of ["five_v_five", "item", "pull_free_agents", "trade", "random"]) {
        const base = `.map-node.reachable[data-node-type=${type}]`;
        const node = allowed ? (allowed.length ? `${base}:is(${only})` : `${base}.__nessuno`) : base;
        if (await this.isVisible(node)) {
          await this.click(node);
          visited.push(type);
          entered = true;
          break;
        }
      }
      if (!entered) throw new Error(`Percorso bloccato dopo: ${visited.join(" > ")}`);
    }
    throw new Error(`Nodo non raggiunto: ${target}`);
  }
  // Gioca una partita RTG gia' iniziata fino al risultato, scegliendo sempre la prima mossa.
  // La partita scorre a tempo reale: puo' durare alcuni minuti.
  async playRtgMatch({ maxMs = 8 * 60 * 1000 } = {}) {
    const end = Date.now() + maxMs;
    const enabled = (s) => this.page.locator(`${s}:not([disabled])`).locator("visible=true").first();
    while (Date.now() < end) {
      if (await enabled("[data-rtg-result-continue]").isVisible().catch(() => false)) return true;
      const actions = ["[data-rtg-half-confirm]", "[data-rtg-duel-continue]", "[data-rtg-choice]",
        "[data-rtg-penalty-move]", "[data-rtg-penalty-technique]", "[data-rtg-penalty-direction]"];
      for (const s of actions) {
        const button = enabled(s);
        if (await button.isVisible().catch(() => false)) {
          await collectCssUsage(this.page);
          await button.click({ timeout: 5000 }).catch(() => {});
          // Aspetta che il pulsante sparisca, per non cliccarlo due volte.
          await this.page.locator(`${s}:not([disabled])`).locator("visible=true").first()
            .waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
          break;
        }
      }
      await this.page.waitForTimeout(300);
    }
    return false;
  }
  // Strumento di test del gioco (solo con ?dev=1): porta le zucche Halloween a 99.999.
  async devHalloweenPumpkins() {
    await this.page.waitForFunction(() => document.querySelector("[data-halloween-dev-pumpkins]"));
    await this.page.evaluate(() => document.querySelector("[data-halloween-dev-pumpkins]").click());
    await this.page.waitForFunction(() => /99\.?999/.test(document.querySelector("#toast-root")?.innerText || ""));
  }
  // Gira il Distributore Stregato finche' esce l'allenatore. Ritorna il numero del giro (o -1).
  async spinHalloweenUntilCoach({ maxSpins = 40 } = {}) {
    await this.click("[data-halloween-open-vending]");
    for (let i = 0; i < maxSpins; i += 1) {
      await this.click("[data-halloween-pull]:not([disabled])");
      await this.page.locator("[data-rtg-pull-continue], [data-rtg-coaches-collection]").locator("visible=true").first()
        .waitFor({ timeout: 20000 });
      if (await this.page.locator("#modal-root [data-rtg-coach-detail]").count()) {
        await this.click("#modal-root [data-close-modal]");
        await this.click("[data-halloween-close-vending]").catch(() => {});
        return i;
      }
      await this.click("[data-rtg-pull-continue]");
    }
    return -1;
  }
  // Con l'allenatore Halloween posseduto: lo assegna, mette in campo il primo giocatore Halloween proposto dal
  // cambio giocatore (ottenuto dal distributore), salva, configura il potere "Maschera Maledetta" su di lui.
  // Ritorna l'OVERALL della squadra mostrato prima e dopo il potere.
  async configureHalloweenCoachPower() {
    const overall = async () => (await this.waitText("#app", /OVERALL\s*[\d.]+/)).match(/OVERALL\s*([\d.]+)/)[1];
    await this.click("[data-halloween-tab=squad]");
    await this.click("[data-rtg-squad-coach-select]");
    await this.click("[data-rtg-coaches-equip=halloween-coach-54]");
    if (await this.isVisible("[data-rtg-pull-continue]")) await this.click("[data-rtg-pull-continue]");
    await this.visible("[data-rtg-coach-power-configure]");
    await this.click("[data-rtg-change-player]");
    const pick = this.page.locator("[data-rtg-picker-player^='halloween2026::']").locator("visible=true").first();
    await pick.waitFor({ timeout: STEP_TIMEOUT });
    const halloweenCardId = await pick.getAttribute("data-rtg-picker-player");
    await pick.click();
    await this.page.waitForTimeout(400);
    await this.click("[data-rtg-save-squad]");
    const before = await overall();
    await this.click("[data-rtg-coach-power-configure]");
    await this.click(`.rtg-coach-field-picker [data-rtg-squad-player='${halloweenCardId}']`);
    const preview = await this.waitText(".rtg-coach-power-projection", /→/);
    await this.click("[data-rtg-coach-power-save]:not([disabled])");
    await this.page.waitForTimeout(500);
    const after = await overall();
    return { before, after, preview };
  }
  async readRun() {
    return this.page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => /run/i.test(k) && /ie1/i.test(k)) || Object.keys(localStorage).find((k) => /run/i.test(k));
      try { return { key, run: JSON.parse(localStorage.getItem(key)) }; } catch { return { key, run: null }; }
    });
  }
  async close() {
    await collectCssUsage(this.page);
    await this.context.close();
  }
}
