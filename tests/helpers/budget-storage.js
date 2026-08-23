"use strict";
class BudgetStorage {
  constructor(budget = Infinity, entries = {}) { this.budget = budget; this.map = new Map(Object.entries(entries)); this.fail = null; }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  bytes(next = this.map) { return [...next].reduce((n, [k, v]) => n + 2 * (String(k).length + String(v).length), 0); }
  getItem(key) { this._fault("getItem", key); return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this._fault("setItem", key); const next = new Map(this.map); next.set(String(key), String(value)); if (this.bytes(next) > this.budget) { const e = new Error("Quota exceeded"); e.name = "QuotaExceededError"; e.code = 22; throw e; } this.map = next; }
  removeItem(key) { this._fault("removeItem", key); this.map.delete(String(key)); }
  clear() { this.map.clear(); }
  _fault(method, key) { if (this.fail?.method === method && (!this.fail.key || String(key).includes(this.fail.key))) { const e = new Error("Storage inaccessible"); e.name = "SecurityError"; throw e; } }
}
module.exports = BudgetStorage;
