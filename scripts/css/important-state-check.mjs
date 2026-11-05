// Controllo per capture.mjs --page-check: tra gli `!important` tolti (argomento: [{file, pos, selector, decl}]) trova
// quelli che la misura con le animazioni ferme e senza mouse non poteva giudicare:
//  - stesso elemento e stessa proprieta' di una regola di stato (:hover, :focus, :active, ...): l'`!important`
//    bloccava l'effetto al passaggio del mouse o al tocco;
//  - stesso elemento e stessa proprieta' di un'animazione CSS: l'`!important` vince sulle animazioni, la regola
//    normale no.
// Ritorna [{ id: "file#pos", why }] per la schermata corrente. Gira dentro la pagina: deve restare autosufficiente.
export default function importantStateCheck(demoted) {
  const STATE = /:(hover|focus-visible|focus-within|focus|active)(?![\w-])/g;
  const PSEUDO = /::?(before|after|placeholder|marker|selection|first-line|first-letter)/g;
  const longhandCache = new Map();
  const longhands = (prop) => {
    if (prop.startsWith("--")) return [prop];
    if (longhandCache.has(prop)) return longhandCache.get(prop);
    const el = document.createElement("div");
    el.style.setProperty(prop, "inherit");
    const out = [];
    for (let i = 0; i < el.style.length; i += 1) out.push(el.style[i]);
    const list = out.length ? out : [prop];
    longhandCache.set(prop, list);
    return list;
  };
  const stateProps = new Map(); // elemento -> Map(proprieta' -> selettore della regola di stato)
  const keyframes = new Map(); // nome -> Set(proprieta')
  const visit = (rules) => {
    for (const rule of rules) {
      if (rule.styleSheet) { try { visit(rule.styleSheet.cssRules); } catch { /* */ } continue; }
      if (rule.type === CSSRule.KEYFRAMES_RULE) {
        const set = keyframes.get(rule.name) || new Set();
        for (const frame of rule.cssRules) for (let i = 0; i < frame.style.length; i += 1) set.add(frame.style[i]);
        keyframes.set(rule.name, set);
        continue;
      }
      if (rule.cssRules && !rule.selectorText) { visit(rule.cssRules); continue; }
      if (!rule.selectorText || !rule.style) continue;
      STATE.lastIndex = 0;
      if (!STATE.test(rule.selectorText)) continue;
      const props = [];
      for (let i = 0; i < rule.style.length; i += 1) props.push(rule.style[i]);
      for (const part of rule.selectorText.split(",")) {
        STATE.lastIndex = 0;
        if (!STATE.test(part)) continue;
        const probe = part.replace(STATE, "").replace(PSEUDO, "").replace(/:not\(\s*\)/g, "").trim() || "*";
        let els = [];
        try { els = document.querySelectorAll(probe); } catch { continue; }
        for (const el of els) {
          const map = stateProps.get(el) || new Map();
          for (const p of props) if (!map.has(p)) map.set(p, part.trim());
          stateProps.set(el, map);
        }
      }
    }
  };
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode?.dataset?.testOnly) continue;
    try { visit(sheet.cssRules); } catch { /* foglio non leggibile */ }
  }
  const hits = [];
  for (const d of demoted) {
    const prop = d.decl.split(":")[0].trim().toLowerCase();
    const hands = longhands(prop);
    const probe = d.selector.replace(PSEUDO, "").replace(STATE, "").trim() || "*";
    let els = [];
    try { els = document.querySelectorAll(probe); } catch { continue; }
    let why = "";
    for (const el of els) {
      const map = stateProps.get(el);
      const p = map && hands.find((h) => map.has(h));
      if (p) { why = `stato: ${map.get(p)} (${p})`; break; }
      const names = getComputedStyle(el).animationName.split(",").map((n) => n.trim()).filter((n) => n && n !== "none");
      const animated = names.find((n) => hands.some((h) => keyframes.get(n)?.has(h)));
      if (animated) { why = `animazione: ${animated}`; break; }
    }
    if (why) hits.push({ id: `${d.file}#${d.pos}`, why });
  }
  return hits;
}
