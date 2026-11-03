// Parser CSS minimo, senza dipendenze, usato dagli script di misura e di pulizia.
// Riconosce commenti, stringhe, @media/@supports/@container/@layer annidati; salta @keyframes, @font-face ecc.
// Ogni regola: { media, selector, line, start, end, important } con start/end = posizione nel testo originale
// (da start incluso a end escluso c'e' la regola intera "selettore { ... }").

export function splitSelectors(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function parseCss(text) {
  const out = [];
  // I commenti diventano spazi (stessa lunghezza): le posizioni restano quelle del testo originale.
  const src = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const lineStarts = [0];
  for (let i = 0; i < src.length; i += 1) if (src[i] === "\n") lineStarts.push(i + 1);
  const lineAt = (pos) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
  const skip = (from) => {
    let depth = 1;
    let quote = null;
    for (let k = from; k < src.length; k += 1) {
      const c = src[k];
      if (quote) {
        if (c === "\\") k += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) return k + 1;
      }
    }
    return src.length;
  };
  const block = (start, media) => {
    let i = start;
    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i += 1;
      if (i >= src.length || src[i] === "}") return i + 1;
      let j = i;
      let depth = 0;
      let quote = null;
      while (j < src.length) {
        const c = src[j];
        if (quote) {
          if (c === "\\") j += 1;
          else if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === "(") depth += 1;
        else if (c === ")") depth -= 1;
        else if ((c === "{" || c === ";") && depth === 0) break;
        j += 1;
      }
      const prelude = src.slice(i, j).trim();
      if (src[j] === ";") {
        i = j + 1;
        continue;
      }
      if (prelude.startsWith("@")) {
        const name = (prelude.match(/^@([\w-]+)/) || [])[1]?.toLowerCase();
        if (["media", "supports", "container", "layer", "document"].includes(name)) {
          const cond = prelude.replace(/^@[\w-]+\s*/, "");
          i = block(j + 1, media ? `${media} & ${cond}` : cond);
        } else i = skip(j + 1);
        continue;
      }
      const end = skip(j + 1);
      const body = src.slice(j + 1, end - 1);
      out.push({ media, selector: prelude, line: lineAt(i), start: i, end, important: (body.match(/!\s*important/gi) || []).length });
      i = end;
    }
    return i;
  };
  block(0, "");
  return out;
}
