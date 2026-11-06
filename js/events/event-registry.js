// Registro degli eventi (Passo 3): ogni evento e' un file dati `data/events/<id>.json` elencato in
// `data/events/index.json`. Il gioco li carica una volta all'avvio (app.js, prima di mostrare la home); i moduli
// di un evento si registrano con onLoad(id, install) e ricevono il proprio manifest quando e' pronto.
// validate() e' la stessa funzione usata dal test dei dati (tests/event-manifest-test.js).
(function (global) {
  "use strict";

  const INDEX_PATH = "data/events/index.json";
  const manifests = new Map();
  const waiting = new Map();
  const anyWaiting = [];
  let loading = null;

  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const isText = (value) => typeof value === "string" && value.trim() !== "";
  const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
  const isPattern = (value) => { try { return isText(value) && !!new RegExp(value); } catch (error) { return false; } };
  // Data con fuso orario esplicito (es. 2026-11-06T23:59:59+01:00), per leggere le "ore italiane" senza ambiguita'.
  const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  // Controlli che non hanno bisogno di altri file. Ritorna l'elenco degli errori (vuoto = valido).
  function validate(manifest) {
    const errors = [];
    const need = (ok, message) => { if (!ok) errors.push(message); };
    if (!isObject(manifest)) return ["il manifest non e' un oggetto"];
    need(manifest.schemaVersion === 1, "schemaVersion deve essere 1");
    need(isText(manifest.id) && /^[a-z0-9_-]+$/.test(manifest.id), "id mancante o con caratteri non ammessi");
    need(isText(manifest.name), "name mancante");
    need(isObject(manifest.labels) && isText(manifest.labels?.badge), "labels.badge mancante");
    const start = Date.parse(manifest.window?.start), end = Date.parse(manifest.window?.end);
    need(ISO_WITH_ZONE.test(manifest.window?.start || ""), "window.start deve essere una data ISO con fuso");
    need(ISO_WITH_ZONE.test(manifest.window?.end || ""), "window.end deve essere una data ISO con fuso");
    need(Number.isFinite(start) && Number.isFinite(end) && end > start, "window.end deve essere dopo window.start");
    need(isText(manifest.baseSeasonId), "baseSeasonId mancante");
    // save.key: solo per gli eventi nati prima del Passo 3 (Halloween resta in shared.halloween). Senza save.key
    // lo stato dell'evento sta in shared.events.<id> (campo aggiunto, i salvataggi vecchi restano validi).
    need(manifest.save?.key === undefined || (isText(manifest.save.key) && manifest.save.key !== "events"),
      "save.key non valido");
    need(manifest.save?.ownedIdPattern === undefined || isPattern(manifest.save.ownedIdPattern),
      "save.ownedIdPattern non e' un'espressione valida");
    need(manifest.save?.cardIdPrefix === `${manifest.id}::`, "save.cardIdPrefix deve essere '<id>::'");
    const economy = manifest.economy || {};
    for (const key of ["pullPrice", "winPrize", "luckyPrize"]) need(isPositiveInt(economy[key]), `economy.${key} non valido`);
    need(Number.isInteger(economy.luckyChancePercent) && economy.luckyChancePercent >= 0 &&
      economy.luckyChancePercent <= 100, "economy.luckyChancePercent deve essere tra 0 e 100");
    const team = manifest.team || {};
    need(isText(team.teamId), "team.teamId mancante");
    need(isPositiveInt(team.rosterSize) && isPositiveInt(team.startersSize), "team.rosterSize/startersSize non validi");
    for (const key of ["players", "lineup", "moves"]) need(isText(team.files?.[key]), `team.files.${key} mancante`);
    const cards = Array.isArray(manifest.cards) ? manifest.cards : [];
    need(cards.length === team.rosterSize, "il numero di carte deve essere team.rosterSize");
    need(new Set(cards.map((card) => card.playerId)).size === cards.length, "carte ripetute");
    for (const card of cards) need(isText(card.playerId) && isText(card.rarity), "carta senza playerId o rarity");
    for (const coach of manifest.coaches || []) {
      need(isText(coach.id) && isText(coach.name), "allenatore senza id o name");
      need(isText(coach.power?.type) && isObject(coach.power?.params), `allenatore ${coach.id}: potere non valido`);
    }
    return errors;
  }

  function register(manifest) {
    const errors = validate(manifest);
    if (errors.length) throw Object.assign(new Error(`evento non valido: ${errors.join("; ")}`), { code: "event-invalid" });
    const frozen = deepFreeze(JSON.parse(JSON.stringify(manifest)));
    manifests.set(frozen.id, frozen);
    for (const install of waiting.get(frozen.id) || []) install(frozen);
    waiting.delete(frozen.id);
    for (const install of anyWaiting) install(frozen);
    return frozen;
  }

  function deepFreeze(value) {
    if (value && typeof value === "object") Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  // Un modulo di evento chiede il proprio manifest: subito se e' gia' caricato, altrimenti al caricamento.
  function onLoad(eventId, install) {
    const manifest = manifests.get(eventId);
    if (manifest) return install(manifest);
    waiting.set(eventId, [...(waiting.get(eventId) || []), install]);
    return undefined;
  }

  // Un modulo generico (es. il modulo degli eventi a capsule) riceve ogni manifest: quelli gia' caricati subito,
  // gli altri al caricamento. Il modulo sceglie dai campi del manifest se installarsi.
  function onAnyLoad(install) {
    anyWaiting.push(install);
    for (const manifest of manifests.values()) install(manifest);
  }

  // Carica indice e manifest. Un evento con un file mancante o non valido viene saltato (avviso in console).
  function load(fetcher = global.fetch && global.fetch.bind(global)) {
    if (loading) return loading;
    loading = (async () => {
      if (!fetcher) return [];
      const response = await fetcher(INDEX_PATH, { cache: "no-store" });
      if (!response.ok) throw Object.assign(new Error("indice eventi non disponibile"), { code: "event-index" });
      const ids = (await response.json())?.events || [];
      const loaded = await Promise.all(ids.map(async (eventId) => {
        try {
          const file = await fetcher(`data/events/${eventId}.json`, { cache: "no-store" });
          if (!file.ok) throw new Error(`HTTP ${file.status}`);
          return register(await file.json());
        } catch (error) {
          global.console?.warn?.(`[eventi] ${eventId} non caricato`, error);
          return null;
        }
      }));
      return loaded.filter(Boolean);
    })();
    return loading;
  }

  const get = (eventId) => manifests.get(String(eventId || "")) || null;
  const isEvent = (eventId) => manifests.has(String(eventId || ""));
  // Evento a cui appartiene una carta ("<id>::<playerId>"), dal prefisso scritto nel manifest.
  const forCardId = (cardId) => {
    const value = String(cardId || "");
    return all().find((manifest) => value.startsWith(manifest.save.cardIdPrefix)) || null;
  };
  const badge = (eventId) => get(eventId)?.labels?.badge || "";
  const label = (eventId, key) => get(eventId)?.labels?.[key] || "";

  // Stato dell'evento nel salvataggio condiviso: shared.<save.key> per gli eventi vecchi, altrimenti
  // shared.events.<id>. ledger() legge, withLedger() ritorna il solo campo da aggiungere al salvataggio.
  const ledgerPath = (manifest) => (manifest?.save?.key ? [manifest.save.key] : ["events", manifest.id]);
  function ledger(account, manifest) {
    const [first, second] = ledgerPath(manifest);
    return second ? account?.[first]?.[second] : account?.[first];
  }
  function withLedger(account, manifest, value) {
    const [first, second] = ledgerPath(manifest);
    return second ? { [first]: { ...(account?.[first] || {}), [second]: value } } : { [first]: value };
  }
  const all = () => Array.from(manifests.values());
  const startMs = (eventId) => Date.parse(get(eventId)?.window?.start || "");
  const endMs = (eventId) => Date.parse(get(eventId)?.window?.end || "");

  global.GameEvents = Object.freeze({ INDEX_PATH, validate, register, onLoad, onAnyLoad, load, get, all, startMs, endMs,
    isEvent, forCardId, badge, label, ledgerPath, ledger, withLedger });
})(globalThis);
