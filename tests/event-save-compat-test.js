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

// Salvataggio nel cloud: con un salvataggio vecchio il risultato e' IDENTICO a quello del codice di prima. L'impronta
// sotto e' stata calcolata con rtg-cloud-snapshot.js del Passo 3.3 (commit b3946e4c), prima di aggiungere events.
const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");
const FILE = "js/road-to-glory/rtg-cloud-snapshot.js";
const OLD_SAVE_CLOUD_SHA1 = "18c47fc62d7ba7c0335da2f7ff300633a5d23c4a";
const sandbox = vm.createContext({ console });
sandbox.globalThis = sandbox;
vm.runInContext(fs.readFileSync(FILE, "utf8"), sandbox, { filename: FILE });
const now = sandbox.RoadToGloryCloudSnapshot;
const project = (shared) => plain(now.project({ shared: plain(shared), trilogy: null, aresOrion: null, album: null }));
const oldProjected = project(OLD_SAVE);
assert.strictEqual(crypto.createHash("sha1").update(JSON.stringify(oldProjected)).digest("hex"), OLD_SAVE_CLOUD_SHA1,
  "salvataggio vecchio: cloud identico a prima");
assert(!("events" in oldProjected.shared), "un salvataggio vecchio non riceve il campo events");
assert.deepStrictEqual(plain(now.validate(oldProjected)), oldProjected, "il salvataggio vecchio si rilegge uguale");

const withEvents = { ...plain(OLD_SAVE), events: { prova: ledger } };
const projected = project(withEvents);
assert.deepStrictEqual(projected.shared.events, { prova: ledger }, "shared.events conservato nel cloud");
assert.deepStrictEqual(projected.shared.halloween, plain(OLD_SAVE.halloween), "Halloween invariato accanto a events");
assert.throws(() => project({ ...plain(OLD_SAVE), events: { prova: { balance: -1 } } }), /rtg-cloud-invalid/);
assert.throws(() => project({ ...plain(OLD_SAVE), events: { "Non Valido": {} } }), /rtg-cloud-invalid-events/);

// Parte 2 (b): dati propri di un evento (events.<id>.extra) conservati nel cloud; troppo grandi o non oggetti: rifiutati.
const withExtra = project({ ...plain(OLD_SAVE), events: { prova: { ...ledger, extra: { creations: 2, note: "ok" } } } });
assert.deepStrictEqual(withExtra.shared.events.prova.extra, { creations: 2, note: "ok" });
assert.throws(() => project({ ...plain(OLD_SAVE), events: { prova: { ...ledger, extra: { big: "x".repeat(9000) } } } }), /rtg-cloud-invalid-events/);
assert.throws(() => project({ ...plain(OLD_SAVE), events: { prova: { ...ledger, extra: "testo" } } }), /rtg-cloud-invalid/);
console.log("event-save-compat-test: PASS anche nel cloud (vecchio identico a prima, events conservato)");

// Passo 4: due eventi attivi insieme (Halloween + evento finto con ?dev=1&evento=prova_dev). Il salvataggio vecchio
// resta identico; Halloween scrive solo shared.halloween dell'account vero; l'evento finto scrive solo nel suo
// account locale "dev:prova_dev:shared:account", nel campo events.prova_dev, e mai nell'account vero.
const { loadEventsWithDev } = require("./helpers/events");
loadEventsWithDev({ console: { warn() {} } }, "prova_dev").then((both) => {
  const pair = both.GameEvents;
  const h = pair.get("halloween2026"), d = pair.get("prova_dev");
  assert(h && d, "i due eventi sono caricati insieme");
  assert.deepStrictEqual(Array.from(pair.ledgerPath(h)), ["halloween"]);
  assert.deepStrictEqual(Array.from(pair.ledgerPath(d)), ["events", "prova_dev"]);
  assert.strictEqual(d.save.storagePrefix, "dev:prova_dev:", "l'evento finto salva solo in chiavi locali dev:");
  assert.notStrictEqual(d.save.cardIdPrefix, h.save.cardIdPrefix, "carte con prefissi diversi");
  assert.notStrictEqual(d.save.currencyField || "balance", h.save.currencyField, "valute in campi diversi");
  // Account vero: una mossa di Halloween su un salvataggio vecchio non aggiunge campi e non tocca altro.
  const real = { ...plain(OLD_SAVE), ...plain(pair.withLedger(OLD_SAVE, h, { ...OLD_SAVE.halloween, pumpkins: 650 })) };
  assert.deepStrictEqual(Object.keys(real).sort(), Object.keys(OLD_SAVE).sort(), "nessun campo nuovo nell'account vero");
  assert.strictEqual(real.halloween.pumpkins, 650);
  // Account finto: parte da una copia dell'account vero e riceve solo events.prova_dev.
  const fakeLedger = { balance: 99799, ownedIds: ["2050"], pullCount: 1, completedIds: [], luckyWins: 0 };
  const sandboxAccount = { ...plain(real), ...plain(pair.withLedger(real, d, fakeLedger)) };
  assert.deepStrictEqual(sandboxAccount.events, { prova_dev: fakeLedger });
  assert.deepStrictEqual(sandboxAccount.halloween, real.halloween, "l'evento finto non tocca lo stato di Halloween");
  assert(!("events" in real), "l'account vero resta senza events");
  // Il cloud (che legge solo l'account vero) da' lo stesso risultato di prima sul salvataggio vecchio.
  assert.strictEqual(crypto.createHash("sha1").update(JSON.stringify(project(OLD_SAVE))).digest("hex"), OLD_SAVE_CLOUD_SHA1);
  console.log("event-save-compat-test: PASS con due eventi (Halloween in shared.halloween, finto solo in dev:)");
}).catch((error) => { console.error(error); process.exit(1); });
