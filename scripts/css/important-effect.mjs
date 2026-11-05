// Quali `!important` servono davvero. Per ogni dichiarazione con `!important` (proprieta' di una regola), la si
// rende normale e si controlla se il VALORE CALCOLATO di quella proprieta' cambia sugli elementi che la regola
// colpisce (e sui loro ::before/::after se la regola li riguarda). Se il valore non cambia, il risultato della
// cascata per quella proprieta' e' identico: niente altro puo' cambiare, e il `!important` e' inutile.
// Cumulativo, come rule-effect.mjs: un `!important` risultato inutile resta tolto mentre si provano gli altri e
// nelle schermate successive; se in una schermata serve, viene rimesso e segnato come necessario.
// Chiavi: "file|media|selettore|n::proprieta'" (n = n-esima regola con lo stesso selettore nel file).

// frozen: file da non toccare (es. esclusi fino a una data). Le loro regole restano come sono: la misura deve
// tenerne conto, altrimenti potrebbe decidere sapendo "tolto" un !important che in realta' resta.
export function pageImportantEffect({ known, demoted, recheckOnly = false, frozen = [] }) {
  const K = new Set(known);
  const D = new Set(demoted);
  const STATE = /:(hover|focus|focus-visible|focus-within|active|visited|link|target)(?![\w-])/;
  const PSEUDO_EL = /::?(before|after|placeholder|selection|marker|first-line|first-letter|backdrop|-webkit-[a-z-]+|-moz-[a-z-]+)/g;
  const skipped = [];
  const evaluated = new Set();
  const fileOf = (sheet) => {
    let s = sheet;
    while (s && !s.href) s = s.parentStyleSheet;
    if (!s?.href) return "index.html <style>";
    return new URL(s.href).pathname.replace(/^\//, "");
  };
  const entries = [];
  const seenKeys = new Map();
  const visit = (list, sheet, media, mediaOk) => {
    for (const rule of list) {
      if (rule.styleSheet) { visit(rule.styleSheet.cssRules, rule.styleSheet, media, mediaOk); continue; }
      if (rule.cssRules && !rule.selectorText) {
        const cond = rule.conditionText || rule.media?.mediaText || "";
        const isMedia = rule.constructor.name === "CSSMediaRule";
        visit(rule.cssRules, sheet, media ? `${media} & ${cond}` : cond, mediaOk && (!isMedia || !cond || matchMedia(cond).matches));
        continue;
      }
      if (!rule.selectorText || !rule.style) continue;
      const base = `${fileOf(sheet)}|${media}|${rule.selectorText}`;
      const n = (seenKeys.get(base) || 0) + 1;
      seenKeys.set(base, n);
      if (frozen.includes(fileOf(sheet))) continue;
      for (let i = 0; i < rule.style.length; i += 1) {
        const prop = rule.style[i];
        if (rule.style.getPropertyPriority(prop) !== "important") continue;
        const value = rule.style.getPropertyValue(prop);
        // Scorciatoie con variabili CSS: il browser non da' il valore della singola proprieta', non si tocca.
        if (!value) { skipped.push([`${base}|${n}::${prop}`, "valore con variabili CSS"]); continue; }
        entries.push({ rule, prop, value, key: `${base}|${n}::${prop}`, mediaOk });
      }
    }
  };
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode?.dataset?.testOnly) continue;
    try { visit(sheet.cssRules, sheet, "", true); } catch { /* foglio non leggibile */ }
  }
  const matchedCache = new Map();
  const targetsOf = (e) => {
    if (matchedCache.has(e.rule)) return matchedCache.get(e.rule);
    const probe = e.rule.selectorText.replace(PSEUDO_EL, "").trim() || "*";
    let matched;
    try { matched = [...document.querySelectorAll(probe)]; } catch { matched = null; }
    matchedCache.set(e.rule, matched);
    return matched;
  };
  const pseudosOf = (e) => [...new Set((e.rule.selectorText.match(/::?(before|after)/g) || []).map((p) => `::${p.replace(/:/g, "")}`))];
  const read = (els, prop, pseudos) => els.flatMap((el) => [getComputedStyle(el).getPropertyValue(prop),
    ...pseudos.map((p) => getComputedStyle(el, p).getPropertyValue(prop))]);
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const setPriority = (e, important) => e.rule.style.setProperty(e.prop, e.value, important ? "important" : "");

  for (const e of entries) if (D.has(e.key)) setPriority(e, false);
  for (const e of entries) {
    if (!D.has(e.key) || !e.mediaOk) continue;
    const els = targetsOf(e);
    if (!els || !els.length) continue;
    const pseudos = pseudosOf(e);
    const normal = read(els, e.prop, pseudos);
    setPriority(e, true);
    const imp = read(els, e.prop, pseudos);
    evaluated.add(e.key);
    if (same(normal, imp)) setPriority(e, false);
    else { D.delete(e.key); K.add(e.key); }
  }
  for (const e of entries) {
    if (recheckOnly) break;
    if (K.has(e.key) || D.has(e.key)) continue;
    if (!e.mediaOk) { skipped.push([e.key, "media non attiva su questo schermo"]); continue; }
    if (STATE.test(e.rule.selectorText)) { skipped.push([e.key, "stato (hover/focus...)"]); continue; }
    if (/::?(placeholder|selection|marker|first-line|first-letter|backdrop|-webkit-|-moz-)/i.test(e.rule.selectorText)) {
      skipped.push([e.key, "pseudo-elemento non controllabile"]);
      continue;
    }
    const els = targetsOf(e);
    if (els === null) { skipped.push([e.key, "selettore non testabile"]); continue; }
    if (!els.length) continue;
    const pseudos = pseudosOf(e);
    const imp = read(els, e.prop, pseudos);
    setPriority(e, false);
    const normal = read(els, e.prop, pseudos);
    evaluated.add(e.key);
    if (same(imp, normal)) D.add(e.key);
    else { setPriority(e, true); K.add(e.key); }
  }
  for (const e of entries) setPriority(e, true);
  return { known: [...K], demoted: [...D], evaluated: [...evaluated], skipped };
}
