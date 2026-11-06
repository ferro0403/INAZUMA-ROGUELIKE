"use strict";
// Passo 3.4: lo stato di un evento nel salvataggio condiviso. Halloween resta in shared.halloween; un evento nuovo
// (senza save.key) usa shared.events.<id>, un campo AGGIUNTO. Un salvataggio vecchio, senza `events`, deve restare
// identico: stesso contenuto letto e nessun campo nuovo scritto finche' un evento nuovo non serve.
const assert = require("assert");
const { loadEvents } = require("./helpers/events");

const context = loadEvents({ console });
const events = context.GameEvents;
const halloween = events.get("halloween2026");
const plain = (value) => JSON.parse(JSON.stringify(value));

// Salvataggio vecchio (com'era prima del Passo 3): nessun campo `events`.
const OLD_SAVE = Object.freeze({
  tokens: 1200, coachOwnedIds: ["208", "halloween-coach-54"], developmentByCardId: {},
  gachaAcquiredCards: [{ cardId: "halloween2026::38", playerId: "38", legacySeasonId: "halloween2026" }],
  halloween: { pumpkins: 450, ownedIds: ["38", "custom_0001"], pullCount: 2, completedIds: ["m1"], luckyWins: 1 },
});

assert.deepStrictEqual(Array.from(events.ledgerPath(halloween)), ["halloween"], "Halloween resta in shared.halloween");
assert.deepStrictEqual(plain(events.ledger(OLD_SAVE, halloween)), plain(OLD_SAVE.halloween), "lettura identica");
const halloweenWrite = plain(events.withLedger(OLD_SAVE, halloween, OLD_SAVE.halloween));
assert.deepStrictEqual(Object.keys(halloweenWrite), ["halloween"], "Halloween non scrive shared.events");
assert.deepStrictEqual(plain({ ...OLD_SAVE, ...halloweenWrite }), plain(OLD_SAVE), "salvataggio vecchio invariato");

// Evento nuovo: shared.events.<id>, senza toccare gli altri campi ne' gli altri eventi.
const fresh = { ...plain(halloween), id: "prova", save: { cardIdPrefix: "prova::" } };
assert.deepStrictEqual(Array.from(events.ledgerPath(fresh)), ["events", "prova"]);
assert.strictEqual(events.ledger(OLD_SAVE, fresh), undefined, "un salvataggio vecchio non ha lo stato dell'evento nuovo");
const ledger = { balance: 5, ownedIds: [], pullCount: 0, completedIds: [], luckyWins: 0 };
const next = { ...plain(OLD_SAVE), ...events.withLedger(OLD_SAVE, fresh, ledger) };
assert.deepStrictEqual(plain(next.events), { prova: ledger });
assert.deepStrictEqual(plain(next.halloween), plain(OLD_SAVE.halloween), "Halloween non cambia");
const withOther = { ...next, ...events.withLedger({ ...next, events: { altro: { x: 1 }, prova: ledger } }, fresh, ledger) };
assert.deepStrictEqual(Object.keys(withOther.events).sort(), ["altro", "prova"], "gli altri eventi restano");

// Carte: l'evento si riconosce dal prefisso del suo file.
assert.strictEqual(events.forCardId("halloween2026::38")?.id, "halloween2026");
assert.strictEqual(events.forCardId("ie1::38"), null);
assert.strictEqual(events.badge("halloween2026"), "HW");
assert.strictEqual(events.isEvent("ie1"), false);

// Il registro rifiuta save.key "events" (scriverebbe sopra gli eventi nuovi).
assert(Array.from(events.validate({ ...plain(halloween), save: { ...halloween.save, key: "events" } }))
  .some((error) => /save\.key/.test(error)));

console.log("event-save-compat-test: PASS (salvataggio vecchio invariato, shared.events.<id> solo aggiunto)");
