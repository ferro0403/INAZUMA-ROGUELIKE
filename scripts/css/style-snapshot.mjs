// Impronta dello stile calcolato di una pagina: per ogni elemento (e i suoi ::before / ::after) un hash di
// TUTTE le proprieta' calcolate dal browser. Due versioni del CSS producono la stessa impronta solo se ogni
// elemento ha esattamente lo stesso stile. Usata da capture.mjs con --styles=<file> e da compare-styles.mjs.

// Gira dentro la pagina. detail: se true, al posto dell'hash restituisce le proprieta' (per capire cosa cambia).
export function pageStyleSnapshot(detail = false) {
  const fnv = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  };
  const pathOf = (el) => {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== document.documentElement; node = node.parentElement) {
      let index = 1;
      for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) if (sib.tagName === node.tagName) index += 1;
      parts.unshift(`${node.tagName.toLowerCase()}:${index}`);
    }
    return parts.join(">");
  };
  const serialize = (style) => {
    const out = [];
    for (let i = 0; i < style.length; i += 1) out.push(`${style[i]}:${style.getPropertyValue(style[i])}`);
    return out.join(";");
  };
  const result = {};
  for (const el of document.querySelectorAll("body, body *")) {
    if (el.closest("script, style, template, [data-dev-diagnostics-menu], #run-dev-quick-tools, #rtg-dev-quick-tools")) continue;
    const style = getComputedStyle(el);
    if (style.display === "none") continue;
    let text = serialize(style);
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content && ps.content !== "none" && ps.content !== "normal") text += `|${pseudo}|${serialize(ps)}`;
    }
    result[pathOf(el)] = detail ? text : fnv(text);
  }
  return result;
}
