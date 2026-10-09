(function (global) {
  "use strict";

  function hashSeed(value) {
    const text = String(value ?? "");
    let hash = 2166136261 >>> 0;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function float(seed, stream, index) {
    const mixed = `${String(seed ?? "")}::${String(stream ?? "")}::${Math.max(0, Math.floor(Number(index) || 0))}`;
    let a = hashSeed(mixed) || 1;
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  function int(seed, stream, index, maxExclusive) {
    const max = Math.max(0, Math.floor(Number(maxExclusive) || 0));
    if (!max) return 0;
    return Math.floor(float(seed, stream, index) * max);
  }

  function weightedPick(items, weightFn, roll) {
    const list = Array.isArray(items) ? items : [];
    const getWeight = typeof weightFn === "function" ? weightFn : (() => 0);
    const weighted = list
      .map((item) => ({ item, weight: Math.max(0, Number(getWeight(item)) || 0) }))
      .filter((entry) => entry.weight > 0);
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (!(total > 0)) return null;
    const normalized = Math.min(0.9999999999999999, Math.max(0, Number(roll) || 0));
    let cursor = normalized * total;
    for (const entry of weighted) {
      if (cursor < entry.weight) return entry.item;
      cursor -= entry.weight;
    }
    return weighted.at(-1)?.item || null;
  }

  global.RoadToGloryRng = Object.freeze({ hashSeed, float, int, weightedPick });
})(globalThis);
