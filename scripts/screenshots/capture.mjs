#!/usr/bin/env node
// Fotografa le schermate principali del gioco (viewport mobile 412x915).
// Uso:
//   node scripts/screenshots/capture.mjs [--out=cartella] [--only=halloween] [--allow-incomplete]
// Predefinito: salva in test-results/screenshots/current/ e scrive report.json.
// Ora e casualita' sono fissate, cosi' due esecuzioni sullo stesso codice danno le stesse immagini.
// Se le immagini esterne (CloudFront ecc.) non si caricano, il report lo dice e lo script
// esce con codice 2: quelle foto NON valgono come baseline.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { startStaticServer } from "./static-server.mjs";
import { scenes } from "./scenes.mjs";

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
const FIXED_TIME = new Date(opt("time", "2026-11-03T12:00:00Z"));
const VIEWPORT = { width: 412, height: 915 };
const STEP_TIMEOUT = 15000;

// Math.random con seme fisso: la mappa e il draft escono sempre uguali.
const SEEDED_RANDOM = `(() => {
  let s = 0x2f6b1a3d;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;
// Niente animazioni: le foto non dipendono dal momento esatto dello scatto.
const NO_ANIMATIONS = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}`;

async function unlockAllFreeAgents(page) {
  return page.evaluate(async () => {
    const db = await (await fetch("data/FREE_AGENTS_compact.json")).json();
    const ids = db.players.map((p) => String(p.playerId));
    globalThis.AlbumProgress.configureFreeAgentIds?.(ids);
    return globalThis.AlbumProgress.unlockAlbumPlayers(globalThis.AlbumProgress.DEFAULT_COLLECTION_ID, ids, {
      firstSource: "screenshot-fixture",
      firstUnlockedAt: "2026-01-01T00:00:00.000Z",
    });
  });
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
  } else if (step.wait) {
    await page.waitForTimeout(step.wait);
  }
  await page.waitForTimeout(500);
}

const { server, url } = await startStaticServer();
const browser = await chromium.launch();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const report = { createdAt: new Date().toISOString(), fixedTime: FIXED_TIME.toISOString(), viewport: VIEWPORT, scenes: [] };
const blockedHosts = new Map();
const selected = scenes.filter((s) => !ONLY || s.name.includes(ONLY));

for (const scene of selected) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: "it-IT", timezoneId: "Europe/Rome" });
  const page = await context.newPage();
  await page.clock.setFixedTime(FIXED_TIME);
  await page.addInitScript(SEEDED_RANDOM);
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
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitForHome(page);
    if (scene.account === "sbloccato") {
      await unlockAllFreeAgents(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForHome(page);
    }
    await page.addStyleTag({ content: NO_ANIMATIONS });
    for (const step of scene.steps) {
      try {
        await runStep(page, step);
      } catch (e) {
        entry.ok = false;
        entry.failedStep = { step, error: e.message.split("\n")[0] };
        break;
      }
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, `${scene.name}.png`), fullPage: !!scene.fullPage });
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

report.blockedHosts = Object.fromEntries(blockedHosts);
report.validBaseline = blockedHosts.size === 0 && report.scenes.every((s) => s.ok);
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));

console.log(`\n${report.scenes.filter((s) => s.ok).length}/${report.scenes.length} scene complete. Foto in ${OUT}`);
if (blockedHosts.size) {
  console.log("ATTENZIONE: risorse esterne non raggiungibili (le foto NON valgono come baseline):");
  for (const [host, n] of blockedHosts) console.log(`  - ${host} (${n} richieste fallite)`);
}
if (!report.validBaseline && !ALLOW_INCOMPLETE) process.exit(2);
