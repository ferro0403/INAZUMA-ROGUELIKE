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
  // Id elencati in index.json, anche se il loro file non si e' caricato: le carte "<id>::..." restano carte di quell'evento
  // e non vengono mai scambiate per carte di una Season (gli id delle carte gia' possedute non si riscrivono).
  const listed = new Set();
  let loading = null;

  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const isText = (value) => typeof value === "string" && value.trim() !== "";
  const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
  // Colori base dell'aspetto di un evento (theme.colors nel suo file).
  const THEME_COLORS = Object.freeze(["primary", "secondary", "accent", "text", "ink", "surface", "background"]);
  const isPattern = (value) => { try { return isText(value) && !!new RegExp(value); } catch (error) { return false; } };
  // Data con fuso orario esplicito (es. 2026-11-06T23:59:59+01:00), per leggere le "ore italiane" senza ambiguita'.
  const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  // Squadre e monete di un evento (Parte 2 a): la prima e' sempre team / currency, come per gli eventi di prima.
  function teamsOf(manifest) {
    return Array.isArray(manifest?.teams) && manifest.teams.length ? manifest.teams : manifest?.team ? [manifest.team] : [];
  }
  function currenciesOf(manifest) {
    const first = { ...(manifest?.currency || {}), field: manifest?.save?.currencyField || "balance" };
    if (!Array.isArray(manifest?.currencies) || !manifest.currencies.length) return [first];
    return manifest.currencies.map((c, index) => (index === 0 ? { ...first, ...c, field: first.field } : { ...c }));
  }
  // Squadra di una carta dell'evento (cards[].teamId, altrimenti la prima squadra).
  function teamOfCard(manifest, playerId) {
    const card = (manifest?.cards || []).find((entry) => entry.playerId === String(playerId));
    const teams = teamsOf(manifest);
    return teams.find((entry) => entry.teamId === card?.teamId) || teams[0] || null;
  }

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
    // Parte 2 (a): piu' squadre in un evento (teams, la prima e' team) e piu' monete (currencies, la prima e' currency).
    const allTeams = teamsOf(manifest);
    if (manifest.teams !== undefined) {
      need(Array.isArray(manifest.teams) && manifest.teams.length >= 1 && manifest.teams[0]?.teamId === team.teamId,
        "teams deve iniziare con team");
      need(new Set(allTeams.map((entry) => entry?.teamId)).size === allTeams.length, "squadre ripetute");
      for (const entry of allTeams) {
        need(isText(entry?.teamId) && isText(entry?.name) && isPositiveInt(entry?.rosterSize) &&
          isPositiveInt(entry?.startersSize), `squadra ${entry?.teamId}: dati mancanti`);
        for (const key of ["players", "lineup", "moves"]) need(isText(entry?.files?.[key]), `squadra ${entry?.teamId}: files.${key}`);
      }
    }
    need(cards.length === allTeams.reduce((sum, entry) => sum + (Number(entry?.rosterSize) || 0), 0),
      "il numero di carte deve essere la somma di rosterSize delle squadre");
    for (const card of cards) {
      need(card.teamId === undefined || allTeams.some((entry) => entry?.teamId === card.teamId), `carta ${card.playerId}: squadra sconosciuta`);
    }
    const allCurrencies = currenciesOf(manifest);
    if (manifest.currencies !== undefined) {
      need(Array.isArray(manifest.currencies) && manifest.currencies[0]?.id === manifest.currency?.id, "currencies deve iniziare con currency");
      need(new Set(allCurrencies.map((c) => c.id)).size === allCurrencies.length &&
        new Set(allCurrencies.map((c) => c.field)).size === allCurrencies.length, "monete o campi ripetuti");
      for (const c of allCurrencies) need(isText(c.id) && isText(c.name) && /^[a-zA-Z][a-zA-Z0-9]*$/.test(c.field || ""), `moneta ${c.id}: dati mancanti`);
    }
    for (const key of ["pullCurrency", "winCurrency", "luckyCurrency"]) {
      need(economy[key] === undefined || allCurrencies.some((c) => c.id === economy[key]), `economy.${key}: moneta sconosciuta`);
    }
    need(new Set(cards.map((card) => card.playerId)).size === cards.length, "carte ripetute");
    for (const card of cards) need(isText(card.playerId) && isText(card.rarity), "carta senza playerId o rarity");
    // Evento finto (solo sviluppo, data/events/dev/): tutto il suo salvataggio sta in chiavi locali "dev:...",
    // mai in shared:account (quindi mai nel cloud). Non usa save.key.
    if (manifest.dev !== undefined) {
      const prefix = manifest.save?.storagePrefix;
      need(manifest.dev === true, "dev deve essere true");
      need(isText(prefix) && /^dev:[a-z0-9_-]+:$/.test(prefix), "save.storagePrefix deve essere 'dev:<id>:'");
      need(manifest.save?.key === undefined, "un evento finto non usa save.key");
      for (const key of ["matchKey", "squadKey"]) {
        need(isText(manifest.save?.[key]) && manifest.save[key].startsWith(prefix || "-"), `save.${key} fuori da dev:`);
      }
    } else {
      need(manifest.save?.storagePrefix === undefined, "save.storagePrefix solo per gli eventi finti");
    }
    // Passo 3.6: aspetto dell'evento (colori base). Tutto il resto dei colori si ricava da questi.
    for (const [kind, name] of Object.entries(manifest.theme?.skin || {})) {
      need(["card", "detail", "coach"].includes(kind) && /^[a-z][a-z0-9-]*$/.test(String(name)), `theme.skin.${kind} non valido`);
    }
    const coin = manifest.theme?.coin;
    need(coin === undefined || ((coin.shape === undefined || ["round", "square"].includes(coin.shape)) &&
      (coin.blend === undefined || ["normal", "screen"].includes(coin.blend))), "theme.coin non valido");
    if (manifest.kind === "capsuleEvent") {
      for (const key of THEME_COLORS) {
        need(/^#[0-9a-fA-F]{6}$/.test(manifest.theme?.colors?.[key] || ""), `theme.colors.${key} deve essere #RRGGBB`);
      }
    }
    need(manifest.extensions === undefined || (Array.isArray(manifest.extensions) && manifest.extensions.every((src) =>
      typeof src === "string" && /^js\/events\/[a-z0-9_-]+\/[a-z0-9_-]+\.js$/.test(src))), "extensions non valido");
    for (const coach of manifest.coaches || []) {
      need(isText(coach.id) && isText(coach.name), "allenatore senza id o name");
      need(isText(coach.power?.type) && isObject(coach.power?.params), `allenatore ${coach.id}: potere non valido`);
    }
    return errors;
  }

  // Passo 3.6d: pezzi aggiuntivi di un evento. Un evento puo' elencare nel suo file (extensions) dei piccoli file di
  // codice suoi; il gioco li carica con l'evento e loro si agganciano con extend(id, {...}) a punti fissi:
  //   classes(player, place) -> classi in piu' per una carta dell'evento (place: "card", "detail-visual",
  //     "detail-modal", "match-card", "duel", "event-card", "actor");
  //   homeSection(context)   -> markup di un riquadro in piu' nella home dell'evento.
  // Un errore in un pezzo aggiuntivo non ferma il gioco: quel pezzo non aggiunge niente.
  const extensions = new Map();
  function extend(eventId, hooks) {
    extensions.set(String(eventId), Object.freeze({ ...hooks }));
  }
  function hook(eventId, name, ...args) {
    const fn = extensions.get(String(eventId || ""))?.[name];
    if (typeof fn !== "function") return undefined;
    try {
      return fn(...args);
    } catch (error) {
      global.console?.warn?.(`[eventi] pezzo aggiuntivo di ${eventId} (${name}) non riuscito`, error);
      return undefined;
    }
  }
  // Parte 2 (b): una parte di un pezzo aggiuntivo che non e' una funzione da chiamare (home, screens).
  const extensionPart = (eventId, name) => extensions.get(String(eventId || ""))?.[name] || null;
  const eventIdOf = (player) => {
    const legacy = String(player?.legacySeasonId || "");
    if (listed.has(legacy)) return legacy;
    const cardId = String(player?.cardId || "");
    const cut = cardId.indexOf("::");
    return cut > 0 && listed.has(cardId.slice(0, cut)) ? cardId.slice(0, cut) : "";
  };
  const extraClasses = (player, place) => {
    const eventId = eventIdOf(player);
    return eventId ? String(hook(eventId, "classes", player, place) || "") : "";
  };
  // Carica (una volta) i file dei pezzi aggiuntivi di un evento, nella pagina.
  const loadedExtensions = new Map();
  function loadExtensions(manifest) {
    const doc = global.document;
    if (!doc?.createElement) return Promise.resolve();
    return Promise.all((manifest.extensions || []).map((src) => {
      if (!loadedExtensions.has(src)) loadedExtensions.set(src, new Promise((resolve) => {
        const script = doc.createElement("script");
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => { global.console?.warn?.(`[eventi] pezzo aggiuntivo ${src} non caricato`); resolve(false); };
        doc.head?.appendChild?.(script);
      }));
      return loadedExtensions.get(src);
    }));
  }

  // Evento finto scelto per questa sessione (solo con ?dev=1&evento=<id>): sostituisce gli eventi a capsule veri.
  let devEventId = "";

  // Ora usata dagli eventi (apertura, conto alla rovescia, premio finale). Solo in sviluppo (?dev=1&oraEvento=...)
  // si puo' spostare: il tempo continua a scorrere da li'. L'orologio del dispositivo non cambia e niente si salva.
  let clockOffset = 0;
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  function setEventTime(value) {
    const text = String(value || "").trim();
    // Solo data (2026-11-07): mezzanotte ora italiana d'inverno, come le date degli eventi.
    const iso = DATE_ONLY.test(text) ? `${text}T00:00:00+01:00` : text;
    const ms = ISO_WITH_ZONE.test(iso) ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ms)) return false;
    clockOffset = ms - Date.now();
    return true;
  }
  const now = () => Date.now() + clockOffset;
  const eventTimeShifted = () => clockOffset !== 0;

  function register(manifest, { dev = false } = {}) {
    const errors = validate(manifest);
    if (errors.length) throw Object.assign(new Error(`evento non valido: ${errors.join("; ")}`), { code: "event-invalid" });
    if (manifest.dev === true && !dev) {
      throw Object.assign(new Error("un evento finto si carica solo in sviluppo"), { code: "event-dev-only" });
    }
    // Ogni allenatore appartiene a un solo evento: il suo potere riconosce solo le carte di quell'evento.
    for (const coach of manifest.coaches || []) {
      const owner = all().find((other) => other.id !== manifest.id &&
        (other.coaches || []).some((entry) => String(entry.id) === String(coach.id)));
      if (owner) {
        throw Object.assign(new Error(`allenatore ${coach.id} gia' usato dall'evento ${owner.id}`),
          { code: "event-coach-duplicate" });
      }
    }
    const frozen = deepFreeze(JSON.parse(JSON.stringify(manifest)));
    manifests.set(frozen.id, frozen);
    listed.add(frozen.id);
    injectThemeRule(frozen);
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
  // options.devEventId (solo in sviluppo): carica anche data/events/dev/<id>.json, l'evento finto.
  function load(fetcher = global.fetch && global.fetch.bind(global), options = {}) {
    if (loading) return loading;
    const devId = String(options.devEventId || "");
    if (devId && /^[a-z0-9_-]+$/.test(devId)) devEventId = devId;
    loading = (async () => {
      if (!fetcher) return [];
      if (devEventId) {
        try {
          const file = await fetcher(`data/events/dev/${devEventId}.json`, { cache: "no-store" });
          if (!file.ok) throw new Error(`HTTP ${file.status}`);
          await loadExtensions(register(await file.json(), { dev: true }));
        } catch (error) {
          global.console?.warn?.(`[eventi] evento finto ${devEventId} non caricato`, error);
        }
      }
      const response = await fetcher(INDEX_PATH, { cache: "no-store" });
      if (!response.ok) throw Object.assign(new Error("indice eventi non disponibile"), { code: "event-index" });
      const ids = (await response.json())?.events || [];
      for (const eventId of ids) listed.add(String(eventId));
      const loaded = await Promise.all(ids.map(async (eventId) => {
        try {
          const file = await fetcher(`data/events/${eventId}.json`, { cache: "no-store" });
          if (!file.ok) throw new Error(`HTTP ${file.status}`);
          const manifest = register(await file.json());
          await loadExtensions(manifest);
          return manifest;
        } catch (error) {
          global.console?.warn?.(`[eventi] ${eventId} non caricato`, error);
          return null;
        }
      }));
      return loaded.filter(Boolean);
    })();
    // Se l'indice non arriva, una nuova chiamata a load() riprova.
    loading.catch(() => { loading = null; });
    return loading;
  }

  const get = (eventId) => manifests.get(String(eventId || "")) || null;
  // Eventi attivi in questa sessione: tutti i veri, piu' l'evento finto scelto con ?dev=1&evento=<id> (Passo 4.3:
  // l'evento finto si affianca agli eventi veri, non li sostituisce).
  const isActive = (eventId) => {
    const manifest = get(eventId);
    if (!manifest) return false;
    return manifest.dev !== true || manifest.id === devEventId;
  };

  // Moduli installati, uno per evento attivo (es. un'istanza del modulo degli eventi a capsule per ogni evento).
  // Ordine: prima gli eventi veri, nell'ordine dell'indice, poi quello finto.
  const modules = new Map();
  function registerModule(eventId, api) {
    if (!isActive(eventId)) throw Object.assign(new Error(`evento ${eventId} non attivo`), { code: "event-inactive" });
    modules.set(String(eventId), api);
    return api;
  }
  const module = (eventId) => modules.get(String(eventId || "")) || null;
  const moduleForCard = (cardId) => {
    const value = String(cardId || "");
    const cut = value.indexOf("::");
    return cut > 0 ? module(value.slice(0, cut)) : null;
  };
  const moduleList = () => Array.from(modules.entries())
    .sort(([a], [b]) => Number(get(a)?.dev === true) - Number(get(b)?.dev === true)).map(([, api]) => api);
  const isEvent = (eventId) => listed.has(String(eventId || ""));
  // Carta di un evento elencato: il prefisso e' sempre "<id>::" (controllato da validate()).
  const isEventCard = (cardId) => {
    const value = String(cardId || "");
    const cut = value.indexOf("::");
    return cut > 0 && listed.has(value.slice(0, cut));
  };
  // Evento a cui appartiene una carta ("<id>::<playerId>"), dal prefisso scritto nel manifest.
  const forCardId = (cardId) => {
    const value = String(cardId || "");
    return all().find((manifest) => value.startsWith(manifest.save.cardIdPrefix)) || null;
  };
  const badge = (eventId) => get(eventId)?.labels?.badge || "";

  // Aspetto di un evento per la pagina: i colori base del suo file (--event-primary...) e l'immagine di sfondo.
  // themeStyle() per il markup (attributo style), applyTheme()/clearTheme() per un elemento gia' nella pagina.
  function themeVars(eventId) {
    const manifest = get(eventId);
    if (!manifest?.theme?.colors) return {};
    const vars = Object.fromEntries(THEME_COLORS.map((key) => [`--event-${key}`, manifest.theme.colors[key]]));
    // Moneta (Passo 3.6c): forma "round" o "square", fusione con lo sfondo "normal" o "screen".
    const coin = manifest.theme.coin || {};
    vars["--event-coin-radius"] = coin.shape === "square" ? "6px" : "50%";
    vars["--event-coin-blend"] = coin.blend === "screen" ? "screen" : "normal";
    const background = manifest.assets?.background;
    if (background) vars["--event-background-image"] = `url("${String(background).replace(/["\\]/g, "")}")`;
    return vars;
  }
  const themeStyle = (eventId) => Object.entries(themeVars(eventId)).map(([key, value]) => `${key}:${value}`).join(";")
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  // Passo 3.6b: classi di una carta ("card"), scheda ("detail") o allenatore ("coach") di un evento. Ogni pezzo
  // ha la classe comune (rtg-event-card...), quella dell'evento (rtg-event--<id>, che porta i suoi colori) e la sua
  // pelle: quella nominata nel file dell'evento (theme.skin, es. Halloween) oppure la pelle base comune.
  const SKIN_KINDS = Object.freeze(["card", "detail", "coach"]);
  function eventClasses(eventId, kind) {
    const manifest = get(eventId);
    if (!manifest || !SKIN_KINDS.includes(kind)) return "";
    const skin = manifest.theme?.skin?.[kind] || `rtg-event-${kind}-base`;
    return `rtg-event-${kind} rtg-event--${manifest.id} ${skin}`;
  }
  // I colori di ogni evento come regola della pagina (.rtg-event--<id>), cosi' una carta li ha ovunque compaia.
  function injectThemeRule(manifest) {
    const doc = global.document;
    if (!doc?.createElement || !manifest?.theme?.colors) return;
    let style = doc.getElementById?.("rtg-event-themes");
    if (!style) {
      style = doc.createElement("style");
      style.id = "rtg-event-themes";
      doc.head?.appendChild?.(style);
    }
    const vars = Object.entries(themeVars(manifest.id)).map(([key, value]) => `${key}:${value}`).join(";");
    style.textContent += `.rtg-event--${manifest.id}{${vars}}\n`;
  }
  function applyTheme(element, eventId) {
    if (typeof element?.style?.setProperty !== "function") return;
    clearTheme(element);
    for (const [key, value] of Object.entries(themeVars(eventId))) element.style.setProperty(key, value);
    if (element.dataset) element.dataset.eventTheme = String(eventId);
  }
  function clearTheme(element) {
    if (typeof element?.style?.removeProperty !== "function") return;
    for (const key of [...THEME_COLORS.map((name) => `--event-${name}`), "--event-background-image",
      "--event-coin-radius", "--event-coin-blend"]) {
      element.style.removeProperty(key);
    }
    if (element.dataset) delete element.dataset.eventTheme;
  }
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
    isEvent, isEventCard, isActive, forCardId, THEME_COLORS, themeVars, themeStyle, applyTheme, clearTheme, eventClasses,
    extend, hook, extraClasses, extensionPart, teamsOf, currenciesOf, teamOfCard, registerModule, module, moduleForCard, modules: moduleList, setEventTime, now, eventTimeShifted, badge, label, ledgerPath, ledger, withLedger });
})(globalThis);
