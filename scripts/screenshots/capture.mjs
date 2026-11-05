#!/usr/bin/env node
// Fotografa le schermate principali del gioco (viewport mobile 412x915).
// Uso:
//   node scripts/screenshots/capture.mjs [--out=cartella] [--only=halloween] [--allow-incomplete]
// Predefinito: salva in test-results/screenshots/current/ e scrive report.json.
// Ora e casualita' sono fissate, cosi' due esecuzioni sullo stesso codice danno le stesse immagini.
// Se le immagini esterne (CloudFront ecc.) non si caricano, il report lo dice e lo script
// esce con codice 2: quelle foto NON valgono come baseline.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { startStaticServer } from "./static-server.mjs";
import { scenes } from "./scenes.mjs";
import { collectCssUsage, flushCssUsage } from "../css/css-usage-collector.mjs";
import { pageStyleSnapshot } from "../css/style-snapshot.mjs";
import { pageRuleEffect } from "../css/rule-effect.mjs";
import { pageImportantEffect } from "../css/important-effect.mjs";
import { Game, seededRandom } from "../../tests/browser/harness.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const OUT = opt("out", "test-results/screenshots/current");
const ONLY = opt("only", "");
const ALLOW_INCOMPLETE = args.includes("--allow-incomplete");
// --styles=file.json: salva anche l'impronta dello stile calcolato di ogni schermata (vedi compare-styles.mjs).
const STYLES_OUT = opt("styles", "");
// Le impronte si salvano anche in <file>.partial dopo ogni schermata: se il processo viene interrotto, rilanciando
// lo stesso comando le schermate gia' misurate si saltano.
const STYLES_PARTIAL = STYLES_OUT ? `${STYLES_OUT}.partial` : "";
const styleSnapshots = STYLES_PARTIAL && existsSync(STYLES_PARTIAL) ? JSON.parse(readFileSync(STYLES_PARTIAL, "utf8")) : {};
// --styles-detail=file.json: come --styles ma con tutte le proprieta' (lento e grande: usare con --only).
const STYLES_DETAIL = opt("styles-detail", "");
// --styles-ignore=--ir-: le variabili CSS con questo prefisso non entrano nell'impronta (token appena aggiunti).
const STYLES_IGNORE = opt("styles-ignore", "");
// --page-check=modulo.mjs --page-check-arg=dati.json --page-check-out=risultati.json: in ogni schermata esegue nella
// pagina la funzione esportata di default dal modulo (con i dati come argomento) e salva il risultato per schermata.
const PAGE_CHECK = opt("page-check", "");
const PAGE_CHECK_OUT = opt("page-check-out", "");
const PAGE_CHECK_ARG = opt("page-check-arg", "") ? JSON.parse(readFileSync(opt("page-check-arg", ""), "utf8")) : null;
const pageCheck = PAGE_CHECK ? (await import(new URL(PAGE_CHECK, `file://${process.cwd()}/`).href)).default : null;
const pageCheckResults = PAGE_CHECK_OUT && existsSync(PAGE_CHECK_OUT) ? JSON.parse(readFileSync(PAGE_CHECK_OUT, "utf8")) : {};
// --rule-effect=file.json: in ogni schermata disattiva una regola alla volta e registra quali cambiano lo stile.
const RULE_EFFECT = opt("rule-effect", "");
const ruleEffect = { known: new Set(), removed: new Set(), evaluated: new Set(), skipped: {} };
// --rule-effect-from=file.json: riparte da una misura precedente e ricontrolla solo le regole battute.
const RULE_EFFECT_FROM = opt("rule-effect-from", "");
// --important-effect=file.json (e --important-effect-from=file.json): come --rule-effect, ma per i `!important`.
const IMPORTANT_EFFECT = opt("important-effect", "");
const IMPORTANT_EFFECT_FROM = opt("important-effect-from", "");
// --frozen=a.css,b.css: file che le misure non devono considerare modificabili.
const FROZEN = opt("frozen", "").split(",").filter(Boolean);
// --important-keep=file.json: elenco di chiavi "file|media|selettore|n::proprieta'" da non togliere mai.
const IMPORTANT_KEEP = opt("important-keep", "") ? JSON.parse(readFileSync(opt("important-keep", ""), "utf8")) : [];
const importantEffect = { known: new Set(IMPORTANT_KEEP), demoted: new Set(), evaluated: new Set(), skipped: {} };
if (IMPORTANT_EFFECT_FROM) {
  const prev = JSON.parse(readFileSync(IMPORTANT_EFFECT_FROM, "utf8"));
  importantEffect.known = new Set(prev.necessari);
  importantEffect.demoted = new Set(prev.inutili);
  importantEffect.skipped = prev.saltati || {};
}
const IMPORTANT_PARTIAL = IMPORTANT_EFFECT && existsSync(IMPORTANT_EFFECT) ? JSON.parse(readFileSync(IMPORTANT_EFFECT, "utf8")) : null;
const importantDone = new Set(IMPORTANT_PARTIAL?.scene_fatte || []);
if (IMPORTANT_PARTIAL) {
  importantEffect.known = new Set(IMPORTANT_PARTIAL.necessari);
  importantEffect.demoted = new Set(IMPORTANT_PARTIAL.inutili);
  importantEffect.evaluated = new Set(IMPORTANT_PARTIAL.valutati);
  importantEffect.skipped = IMPORTANT_PARTIAL.saltati || {};
}
const saveImportantEffect = () => writeFileSync(IMPORTANT_EFFECT, JSON.stringify({ necessari: [...importantEffect.known],
  inutili: [...importantEffect.demoted], valutati: [...importantEffect.evaluated], saltati: importantEffect.skipped,
  scene_fatte: [...importantDone] }));
if (RULE_EFFECT_FROM) {
  const prev = JSON.parse(readFileSync(RULE_EFFECT_FROM, "utf8"));
  ruleEffect.known = new Set(prev.necessarie);
  ruleEffect.removed = new Set(prev.battute);
  ruleEffect.skipped = prev.saltate || {};
}
// Ripresa dopo un'interruzione: se il file di uscita esiste gia' (parziale), riparte da li' e salta le scene fatte.
const RULE_EFFECT_PARTIAL = RULE_EFFECT && existsSync(RULE_EFFECT) ? JSON.parse(readFileSync(RULE_EFFECT, "utf8")) : null;
const ruleEffectDone = new Set(RULE_EFFECT_PARTIAL?.scene_fatte || []);
if (RULE_EFFECT_PARTIAL) {
  ruleEffect.known = new Set(RULE_EFFECT_PARTIAL.necessarie);
  ruleEffect.removed = new Set(RULE_EFFECT_PARTIAL.battute);
  ruleEffect.evaluated = new Set(RULE_EFFECT_PARTIAL.valutate);
  ruleEffect.skipped = RULE_EFFECT_PARTIAL.saltate || {};
}
const saveRuleEffect = () => writeFileSync(RULE_EFFECT, JSON.stringify({ necessarie: [...ruleEffect.known],
  battute: [...ruleEffect.removed], valutate: [...ruleEffect.evaluated], saltate: ruleEffect.skipped, scene_fatte: [...ruleEffectDone] }));
const FIXED_TIME = new Date(opt("time", "2026-11-03T12:00:00Z"));
// --viewport=LxA per provare altre larghezze (es. 1280x800). Le foto di riferimento sono a 412x915.
const VIEWPORT = (() => { const [w, h] = opt("viewport", "412x915").split("x").map(Number); return { width: w, height: h }; })();
const STEP_TIMEOUT = 15000;

// Math.random con seme fisso: la mappa e il draft escono sempre uguali.

// Niente animazioni e niente messaggi a comparsa (toast): le foto non dipendono dal momento dello scatto.
const NO_ANIMATIONS = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}
#toast-root{visibility:hidden!important}`;

async function unlockAllFreeAgents(page, maxOverall = Infinity) {
  return page.evaluate(async (max) => {
    const db = await (await fetch("data/FREE_AGENTS_compact.json")).json();
    const ids = db.players.filter((p) => Number(p.finalOverall ?? 0) <= max).map((p) => String(p.playerId));
    globalThis.AlbumProgress.configureFreeAgentIds?.(ids);
    return globalThis.AlbumProgress.unlockAlbumPlayers(globalThis.AlbumProgress.DEFAULT_COLLECTION_ID, ids, {
      firstSource: "screenshot-fixture",
      firstUnlockedAt: "2026-01-01T00:00:00.000Z",
    });
  }, maxOverall);
}

async function waitForHome(page) {
  await page.locator("#home-primary-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(400);
}

async function runStep(page, step) {
  if (step.click) {
    const loc = page.locator(step.click).first();
    await loc.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await loc.click({ timeout: STEP_TIMEOUT });
  } else if (step.text) {
    const loc = page.getByText(step.text, { exact: false }).locator("visible=true").first();
    await loc.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await loc.click({ timeout: STEP_TIMEOUT });
  } else if (step.fill) {
    const loc = page.locator(step.fill[0]).first();
    await loc.waitFor({ state: "visible", timeout: STEP_TIMEOUT });
    await loc.fill(step.fill[1]);
  } else if (step.repeat) {
    const [times, selector] = step.repeat;
    for (let i = 0; i < times; i += 1) {
      const loc = page.locator(selector).first();
      try {
        await loc.waitFor({ state: "visible", timeout: 3000 });
      } catch {
        break;
      }
      await loc.click({ timeout: STEP_TIMEOUT });
      await page.waitForTimeout(250);
    }
  } else if (step.scroll) {
    await page.locator(step.scroll).first().scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT });
  } else if (step.game) {
    // Azione composta del banco di prova (es. attraversare la mappa fino al boss, giocare una partita).
    await new Game(page, page.context(), [])[step.game](...(step.args || []));
  } else if (step.devClick) {
    // Pulsanti degli strumenti di test (?dev=1), a volte coperti da altri elementi: clic via JavaScript.
    await page.waitForFunction((sel) => document.querySelector(sel), step.devClick, { timeout: STEP_TIMEOUT });
    await page.evaluate((sel) => document.querySelector(sel).click(), step.devClick);
    await page.waitForTimeout(1200);
  } else if (step.waitFor) {
    await page.locator(step.waitFor).first().waitFor({ state: "visible", timeout: 30000 });
  } else if (step.wait) {
    await page.waitForTimeout(step.wait);
  }
  await page.waitForTimeout(500);
}

const { server, url } = await startStaticServer();
const browser = await chromium.launch();
// Ripresa di una misura interrotta: le foto gia' fatte restano.
if (!Object.keys(styleSnapshots).length) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const report = { createdAt: new Date().toISOString(), fixedTime: FIXED_TIME.toISOString(), viewport: VIEWPORT, scenes: [] };
const blockedHosts = new Map();
const selected = scenes.filter((s) => !ONLY || s.name.includes(ONLY));

for (const scene of selected) {
  if (ruleEffectDone.has(scene.name) || importantDone.has(scene.name)) continue;
  if (STYLES_PARTIAL && styleSnapshots[scene.name]) continue;
  if (pageCheck && pageCheckResults[scene.name]) continue;
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: "it-IT", timezoneId: "Europe/Rome" });
  const page = await context.newPage();
  // flowingClock: l'orologio parte da FIXED_TIME e scorre (serve per giocare una partita RTG intera).
  if (scene.flowingClock) await page.clock.install({ time: FIXED_TIME });
  else await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(seededRandom(scene.seed ?? 0x2f6b1a3d));
  const errors = [];
  const failedImages = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (req) => {
    const host = new URL(req.url()).host;
    if (host.startsWith("127.0.0.1")) return;
    blockedHosts.set(host, (blockedHosts.get(host) || 0) + 1);
    if (req.resourceType() === "image") failedImages.push(req.url());
  });

  const entry = { name: scene.name, account: scene.account, ok: true, failedStep: null, errors, failedImages: 0 };
  try {
    await page.goto(scene.dev ? `${url}?dev=1` : url, { waitUntil: "domcontentloaded" });
    await waitForHome(page);
    if (scene.account === "sbloccato" || scene.account === "rtg") {
      await unlockAllFreeAgents(page, scene.account === "rtg" ? 74 : Infinity);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForHome(page);
    }
    const testStyle = await page.addStyleTag({ content: NO_ANIMATIONS });
    await testStyle.evaluate((el) => { el.dataset.testOnly = "1"; });
    for (const step of scene.steps) {
      try {
        await runStep(page, step);
        await collectCssUsage(page);
      } catch (e) {
        entry.ok = false;
        entry.failedStep = { step, error: e.message.split("\n")[0] };
        break;
      }
    }
    await page.waitForTimeout(800);
    // Il puntatore resta dove era l'ultimo clic: lo si sposta fuori, cosi' nessun elemento resta in "hover".
    await page.mouse.move(0, 0);
    // Prima della foto: aspetta che la rete si calmi e che tutte le immagini abbiano finito di caricare
    // (anche quelle che falliscono). Senza questa attesa uno stemma poteva comparire o no a caso.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(200);
    await collectCssUsage(page);
    // Foto "stabile": si scatta finche' due scatti consecutivi sono identici (immagini caricate in ritardo).
    let shot = await page.screenshot({ fullPage: !!scene.fullPage });
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(600);
      const again = await page.screenshot({ fullPage: !!scene.fullPage });
      if (again.equals(shot)) break;
      shot = again;
    }
    writeFileSync(join(OUT, `${scene.name}.png`), shot);
    if (pageCheck) {
      pageCheckResults[scene.name] = await page.evaluate(pageCheck, PAGE_CHECK_ARG);
      writeFileSync(PAGE_CHECK_OUT, JSON.stringify(pageCheckResults));
    }
    if (STYLES_OUT) {
      styleSnapshots[scene.name] = await page.evaluate(pageStyleSnapshot, { ignore: STYLES_IGNORE });
      writeFileSync(STYLES_PARTIAL, JSON.stringify(styleSnapshots));
    }
    if (STYLES_DETAIL) styleSnapshots[scene.name] = await page.evaluate(pageStyleSnapshot, { detail: true, ignore: STYLES_IGNORE });
    if (IMPORTANT_EFFECT) {
      const r = await page.evaluate(pageImportantEffect, { known: [...importantEffect.known],
        demoted: [...importantEffect.demoted], recheckOnly: Boolean(IMPORTANT_EFFECT_FROM), frozen: FROZEN });
      importantEffect.known = new Set(r.known);
      importantEffect.demoted = new Set(r.demoted);
      r.evaluated.forEach((k) => importantEffect.evaluated.add(k));
      for (const [k, why] of r.skipped) importantEffect.skipped[k] ||= why;
      importantDone.add(scene.name);
      saveImportantEffect();
    }
    if (RULE_EFFECT) {
      const r = await page.evaluate(pageRuleEffect, { known: [...ruleEffect.known], removed: [...ruleEffect.removed], recheckOnly: Boolean(RULE_EFFECT_FROM), frozen: FROZEN });
      ruleEffect.known = new Set(r.known);
      ruleEffect.removed = new Set(r.removed);
      r.evaluated.forEach((k) => ruleEffect.evaluated.add(k));
      for (const [k, why] of r.skipped) ruleEffect.skipped[k] ||= why;
      ruleEffectDone.add(scene.name);
      saveRuleEffect();
    }
  } catch (e) {
    entry.ok = false;
    entry.failedStep = entry.failedStep || { step: "avvio", error: e.message.split("\n")[0] };
  }
  entry.failedImages = failedImages.length;
  entry.errors = errors.filter((m) => !/firebase|gstatic/i.test(m));
  report.scenes.push(entry);
  const flag = entry.ok ? (entry.failedImages ? "IMG?" : " ok ") : "INCOMPLETA";
  console.log(`[${flag}] ${scene.name}${entry.failedStep ? ` -> ${JSON.stringify(entry.failedStep.step)}: ${entry.failedStep.error}` : ""}`);
  await context.close();
}

await browser.close();
server.close();
flushCssUsage("screenshots");
if (STYLES_OUT || STYLES_DETAIL) writeFileSync(STYLES_OUT || STYLES_DETAIL, JSON.stringify(styleSnapshots));
if (IMPORTANT_EFFECT) {
  saveImportantEffect();
}
if (RULE_EFFECT) {
  saveRuleEffect();
}

report.blockedHosts = Object.fromEntries(blockedHosts);
report.validBaseline = blockedHosts.size === 0 && report.scenes.every((s) => s.ok);
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));

console.log(`\n${report.scenes.filter((s) => s.ok).length}/${report.scenes.length} scene complete. Foto in ${OUT}`);
if (blockedHosts.size) {
  console.log("ATTENZIONE: risorse esterne non raggiungibili (le foto NON valgono come baseline):");
  for (const [host, n] of blockedHosts) console.log(`  - ${host} (${n} richieste fallite)`);
}
if (!report.validBaseline && !ALLOW_INCOMPLETE) process.exit(2);
