// Raccoglie quali selettori CSS trovano almeno un elemento nella pagina, mentre il gioco viene usato.
// Si attiva solo con la variabile d'ambiente CSS_USAGE_OUT=<cartella>: le prove nel browser e lo script
// degli screenshot chiamano collectCssUsage(page) dopo ogni passo e flushCssUsage(nome) alla fine.
// Il risultato si legge con: node scripts/css/css-usage-report.mjs <cartella>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.CSS_USAGE_OUT || "";
export const cssUsageEnabled = Boolean(OUT);

const all = new Map(); // chiave -> { file, media, selector, important, rule }
const used = new Set();
const states = new Set(); // "schermata: ..." e "pop-up: ..."
const marks = new Set(); // classi di stati notevoli viste a schermo

// Gira dentro la pagina. Ritorna tutte le regole note e quelle che trovano almeno un elemento.
function pageCollector() {
  const STATE_PSEUDO =
    /::?(before|after|placeholder|selection|marker|first-line|first-letter|backdrop|-webkit-[a-z-]+|-moz-[a-z-]+)|:(hover|focus|focus-visible|focus-within|active|visited|link|target)(?![\w-])/g;
  const cache = (globalThis.__cssUsageCache ||= new Set());
  const rules = [];
  const usedNow = [];
  const fileOf = (sheet) => {
    let s = sheet;
    while (s && !s.href) s = s.parentStyleSheet;
    if (!s?.href) return "index.html <style>";
    return new URL(s.href).pathname.replace(/^\//, "");
  };
  const splitSelectors = (text) => {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const ch of text) {
      if (ch === "(" || ch === "[") depth += 1;
      if (ch === ")" || ch === "]") depth -= 1;
      if (ch === "," && depth === 0) { parts.push(current.trim()); current = ""; } else current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  };
  const walk = (list, sheet, media) => {
    for (const rule of list) {
      if (rule.styleSheet) { walk(rule.styleSheet.cssRules, rule.styleSheet, media); continue; }
      if (rule.cssRules && !rule.selectorText) {
        const cond = rule.conditionText || rule.media?.mediaText || rule.name || "";
        walk(rule.cssRules, sheet, media ? `${media} & ${cond}` : cond);
        continue;
      }
      if (!rule.selectorText) continue;
      let important = 0;
      for (let i = 0; i < rule.style.length; i += 1) if (rule.style.getPropertyPriority(rule.style[i])) important += 1;
      const file = fileOf(sheet);
      for (const selector of splitSelectors(rule.selectorText)) {
        const key = `${file}|${media}|${selector}`;
        rules.push([key, file, media, selector, important, rule.selectorText]);
        if (cache.has(key)) { usedNow.push(key); continue; }
        const probe = selector.replace(STATE_PSEUDO, "").replace(/\s*>\s*$/, "").trim() || "*";
        try {
          if (document.querySelector(probe)) { cache.add(key); usedNow.push(key); }
        } catch {
          // selettore non valido per querySelector (es. pseudo-classi rare): resta "non visto"
        }
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, sheet, ""); } catch { /* foglio esterno non leggibile */ }
  }
  // Cosa c'era a schermo: la schermata (<main> in #app), i pop-up aperti e gli stati notevoli presenti.
  const tidy = (el) => [...el.classList].filter((c) => !/^(screen|modal|panel|active|content|narrow)$/.test(c)).slice(0, 3).join(".");
  const screens = [...document.querySelectorAll("#app > main, #app > section")].map(tidy).filter(Boolean);
  const modals = [...document.querySelectorAll("#modal-root .modal, [role=dialog], [aria-modal=true]")]
    .filter((el) => el.getClientRects().length).map(tidy).filter(Boolean);
  const MARK = /(penalt|halftime|half-|interval|result|gameover|game-over|victory|defeat|celebration|summary|special|duel|reward|offer|trade|pull|legendary|final|toast|confirm|evolution|picker|detail|vending)/;
  const marks = new Set();
  for (const el of document.querySelectorAll("[class]")) {
    if (!el.getClientRects().length) continue;
    for (const c of el.classList) if (MARK.test(c)) marks.add(c);
  }
  return { rules, used: usedNow, state: { screens, modals, marks: [...marks] } };
}

export async function collectCssUsage(page) {
  if (!cssUsageEnabled) return;
  try {
    const result = await page.evaluate(pageCollector);
    for (const [key, file, media, selector, important, rule] of result.rules) {
      if (!all.has(key)) all.set(key, { file, media, selector, important, rule });
    }
    for (const key of result.used) used.add(key);
    for (const x of result.state.screens) states.add(`schermata: ${x}`);
    for (const x of result.state.modals) states.add(`pop-up: ${x}`);
    for (const x of result.state.marks) marks.add(x);
  } catch {
    // pagina in navigazione o chiusa: si salta questo campione
  }
}

export function flushCssUsage(name) {
  if (!cssUsageEnabled) return;
  mkdirSync(OUT, { recursive: true });
  const rows = [...all.entries()].map(([key, r]) => ({ ...r, used: used.has(key) }));
  writeFileSync(join(OUT, `${name}-${process.pid}.json`), JSON.stringify({ rules: rows, states: [...states], marks: [...marks] }));
}
