// "Effetto" delle regole CSS: trova le regole "battute", cioe' che non cambiano lo stile calcolato di nessun
// elemento perche' altre regole le sovrascrivono sempre. Usata da capture.mjs con --rule-effect=<file>.
//
// Metodo, cumulativo per evitare il caso "due regole uguali, ognuna sembra inutile perche' c'e' l'altra":
//  - R = regole candidate alla rimozione (inutili finora), K = regole risultate necessarie.
//  - In ogni schermata: si disattivano tutte le R. Poi, una alla volta, si riattiva ogni R: se lo stile cambia
//    e' necessaria (passa in K e resta attiva), altrimenti torna disattivata.
//  - Poi ogni altra regola che trova elementi viene disattivata: se lo stile non cambia entra in R e RESTA
//    disattivata per i controlli successivi; se cambia entra in K.
// Alla fine R contiene regole che, tolte tutte insieme, non cambiano lo stile in nessuna schermata visitata.
// La verifica finale si fa comunque togliendole dal file e confrontando stile calcolato e screenshot.
// recheckOnly: solo i passi 2-3 (si ricontrollano le candidate, ad es. a un'altra larghezza di schermo).

export function pageRuleEffect({ known, removed, recheckOnly = false }) {
  const K = new Set(known);
  const R = new Set(removed);
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
  const serialize = (el, pseudo) => {
    const style = getComputedStyle(el, pseudo || null);
    const out = [];
    for (let i = 0; i < style.length; i += 1) out.push(`${style[i]}:${style.getPropertyValue(style[i])}`);
    return out.sort().join(";"); // ordinate: l'ordine delle variabili CSS non e' stabile
  };
  // 1. Elenco delle regole, con chiave stabile (file | media | selettore | n-esima occorrenza).
  const rules = [];
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
      rules.push({ rule, key: `${base}|${n}`, mediaOk, css: rule.style.cssText });
    }
  };
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode?.dataset?.testOnly) continue;
    try { visit(sheet.cssRules, sheet, "", true); } catch { /* foglio non leggibile */ }
  }
  const targetsOf = (entry) => {
    const probe = entry.rule.selectorText.replace(PSEUDO_EL, "").trim() || "*";
    let matched;
    try { matched = [...document.querySelectorAll(probe)]; } catch { return null; }
    if (!matched.length) return [];
    const targets = [...matched];
    for (const el of matched) {
      for (const d of el.querySelectorAll("*")) {
        if (targets.length > matched.length + 300) break;
        targets.push(d);
      }
    }
    return targets;
  };
  const pseudosOf = (entry) => [...new Set((entry.rule.selectorText.match(/::?(before|after)/g) || []).map((p) => `::${p.replace(/:/g, "")}`))];
  const snap = (targets, pseudos) => targets.map((el) => serialize(el) + pseudos.map((p) => `|${serialize(el, p)}`).join(""));
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  // 2. Disattiva tutte le candidate.
  for (const e of rules) if (R.has(e.key)) e.rule.style.cssText = "";
  // 3. Riprova ogni candidata: se riattivarla cambia lo stile, e' necessaria.
  for (const e of rules) {
    if (!R.has(e.key) || !e.mediaOk) continue;
    const targets = targetsOf(e);
    if (!targets || !targets.length) continue;
    const pseudos = pseudosOf(e);
    const off = snap(targets, pseudos);
    e.rule.style.cssText = e.css;
    const on = snap(targets, pseudos);
    evaluated.add(e.key);
    if (same(off, on)) e.rule.style.cssText = "";
    else { R.delete(e.key); K.add(e.key); }
  }
  // 4. Prova le regole non ancora classificate (non nel ricontrollo a un'altra larghezza di schermo).
  for (const e of rules) {
    if (recheckOnly) break;
    if (K.has(e.key) || R.has(e.key)) continue;
    if (!e.mediaOk) { skipped.push([e.key, "media non attiva su questo schermo"]); continue; }
    if (STATE.test(e.rule.selectorText)) { skipped.push([e.key, "stato (hover/focus...)"]); continue; }
    if ([...e.rule.style].some((p) => p.startsWith("--"))) { skipped.push([e.key, "definisce variabili CSS"]); continue; }
    const targets = targetsOf(e);
    if (targets === null) { skipped.push([e.key, "selettore non testabile"]); continue; }
    if (!targets.length) continue;
    const pseudos = pseudosOf(e);
    const on = snap(targets, pseudos);
    e.rule.style.cssText = "";
    const off = snap(targets, pseudos);
    evaluated.add(e.key);
    if (same(on, off)) R.add(e.key);
    else { e.rule.style.cssText = e.css; K.add(e.key); }
  }
  // 5. Rimette tutto com'era (la pagina non viene piu' usata, ma per sicurezza).
  for (const e of rules) e.rule.style.cssText = e.css;
  return { known: [...K], removed: [...R], evaluated: [...evaluated], skipped };
}
