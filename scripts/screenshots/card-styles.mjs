#!/usr/bin/env node
// Passo 3.6: stile completo degli elementi DENTRO le carte (giocatori e allenatori) nelle schermate dove compaiono
// le carte Halloween. Serve a provare che le carte restano identiche quando cambia la grafica degli eventi.
// Uso: node scripts/screenshots/card-styles.mjs <cartella del ramo> <uscita.json>
//      node scripts/screenshots/card-styles.mjs --confronta prima.json dopo.json
if (process.argv[2] === "--confronta") {
  const { readFileSync } = await import("node:fs");
  const [before, after] = process.argv.slice(3).map((f) => JSON.parse(readFileSync(f, "utf8")));
  let total = 0;
  for (const scene of Object.keys(before)) {
    let n = 0;
    for (const [el, props] of Object.entries(before[scene])) {
      const other = after[scene]?.[el];
      if (!other) { n += 1; continue; }
      for (const p of Object.keys(props)) if (props[p] !== other[p]) n += 1;
    }
    total += n;
    console.log(`${scene}: ${n ? `${n} differenze` : "IDENTICO"} (${Object.keys(before[scene]).length} elementi di carta)`);
  }
  process.exit(total ? 1 : 0);
}
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
const { startHarness } = await import(pathToFileURL(`${root}/tests/browser/harness.mjs`).href);
process.chdir(root);
const h = await startHarness();
const CARD = ".player-card, .tactical-player-card, .rtg-coach-album-card, .player-detail-layout, .rtg-pull-card, .rtg-coach-squad-slot";
const grab = (page) => page.evaluate((sel) => {
  const out = {};
  const path = (el) => { const parts = []; for (let e = el; e && e.parentElement; e = e.parentElement) {
    const i = [...e.parentElement.children].filter((c) => c.tagName === e.tagName).indexOf(e) + 1;
    parts.unshift(`${e.tagName.toLowerCase()}:${i}`); } return parts.join(">"); };
  for (const card of document.querySelectorAll(sel)) for (const el of [card, ...card.querySelectorAll("*")]) {
    const cs = getComputedStyle(el); const props = {};
    for (const p of cs) if (!p.startsWith("--")) props[p] = cs.getPropertyValue(p);
    for (const pseudo of ["::before", "::after"]) { const ps = getComputedStyle(el, pseudo);
      for (const p of ["content", "background-color", "background-image", "border-top-color", "color"]) props[pseudo + p] = ps.getPropertyValue(p); }
    out[path(el)] = props;
  }
  return out;
}, CARD);
const result = {};
async function scene(name, steps) {
  const g = await h.newGame({ dev: true });
  await g.unlockAllFreeAgents();
  await steps(g);
  await g.page.waitForTimeout(800);
  result[name] = await grab(g.page);
  await g.close();
}
const toEventSquad = async (g) => { await g.click("[data-rtg-home-open=campaigns]"); await g.click("[data-rtg-halloween-open]");
  await g.devHalloweenPumpkins(); await g.spinHalloweenUntilCoach(); await g.prepareHalloweenCoachSquad(); };
await scene("squadra-evento", toEventSquad);
await scene("scheda-da-squadra", async (g) => { await toEventSquad(g); await g.click("[data-rtg-player-detail^='halloween2026::']"); });
await scene("evento-card", async (g) => { await g.click("[data-rtg-home-open=campaigns]"); await g.click("[data-rtg-halloween-open]"); await g.click(".tactical-player-card"); });
await scene("album-collezione", async (g) => { await g.giveHalloweenCollection(); await g.click("[data-rtg-home-open=album]");
  await g.click("[data-rtg-album-halloween]"); await g.click("[data-rtg-album-team]"); });
await scene("squadra-rtg", async (g) => { await g.giveHalloweenCollection(); await g.click("[data-rtg-home-open=campaigns]");
  await g.click("[data-rtg-campaign=rtg-ie-trilogy]"); await g.click("[data-rtg-tab=squad]"); await g.click("[data-rtg-change-player]");
  await g.page.locator("[data-rtg-picker-search]").first().fill("Nathan"); });
await scene("allenatori-rtg", async (g) => { await g.giveHalloweenCollection(); await g.click("[data-rtg-home-open=campaigns]");
  await g.click("[data-rtg-campaign=rtg-ie-trilogy]"); await g.click("[data-rtg-tab=squad]"); await g.click("[data-rtg-open-coaches]");
  await g.click("[data-rtg-coaches-tab=collection]"); });
await scene("album-allenatori", async (g) => { await g.giveHalloweenCollection(); await g.click("[data-rtg-home-open=album]");
  await g.click("[data-rtg-album-coaches-open]"); });
await scene("scheda-hekyll", async (g) => { await g.giveHalloweenCollection(); await g.click("[data-rtg-home-open=album]");
  await g.click("[data-rtg-album-coaches-open]"); await g.click(".rtg-coach-album-card"); });
await h.close();
writeFileSync(process.argv[3], JSON.stringify(result));
console.log(Object.entries(result).map(([k, v]) => `${k}: ${Object.keys(v).length} elementi di carta`).join("\n"));
