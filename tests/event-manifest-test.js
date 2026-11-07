"use strict";
// Passo 3: controllo dei file evento (data/events/*.json). Ogni evento deve avere carte esistenti con la rarita'
// giusta, un allenatore con un potere valido e almeno una carta a cui applicarlo, date coerenti, prezzi validi.
// Per Halloween controlla anche la PARITA' con i valori che prima erano scritti nel codice.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { console };
context.globalThis = context;
vm.createContext(context);
for (const file of ["js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-coaches.js", "js/events/event-registry.js",
  "js/road-to-glory/rtg-economy.js", "js/road-to-glory/rtg-coach-power-types.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
const { RoadToGloryConfig: config, RoadToGloryCoaches: coaches, GameEvents: events } = context;
const RARITIES = Array.from(context.RoadToGloryEconomy?.RARITIES ||
  ["Scarso", "Debole", "Normale", "Buono", "Forte", "Elite", "Mondiale", "Leggenda", "Aurico"]);
const DIR = "data/events";
const index = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8"));
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
// Eventi finti (solo sviluppo, Passo 3.5): stessi controlli, ma mai nell'indice e salvataggio solo in "dev:".
const DEV_DIR = path.join(DIR, "dev");
const devFiles = fs.existsSync(DEV_DIR) ? fs.readdirSync(DEV_DIR).filter((f) => f.endsWith(".json")) : [];
assert.deepStrictEqual([...index.events].sort(), files.map((f) => f.replace(/\.json$/, "")).sort(),
  "index.json deve elencare esattamente i file evento presenti");

const seen = { id: new Set(), badge: new Set(config.SEASON_IDS.map((id) => config.seasonShortLabel(id))), prefix: new Set() };
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const okImage = (value) => typeof value === "string" && (/^https:\/\//.test(value) || fs.existsSync(value));

for (const file of [...files, ...devFiles.map((f) => `dev/${f}`)]) {
  const m = readJson(path.join(DIR, file));
  const isDev = file.startsWith("dev/");
  if (isDev) {
    assert.strictEqual(m.dev, true, `evento ${file}: un file in dev/ deve avere dev: true`);
    assert(!index.events.includes(m.id), `evento ${file}: un evento finto non va in index.json`);
    assert(m.save.storagePrefix.startsWith("dev:"), `evento ${file}: salvataggio fuori da dev:`);
    assert(!m.save.key, `evento ${file}: un evento finto non scrive campi dell'account vero`);
  } else {
    assert.notStrictEqual(m.dev, true, `evento ${file}: un evento finto va in data/events/dev/`);
  }
  const where = `evento ${file}`;
  const problems = Array.from(events.validate(m));
  assert.strictEqual(problems.length, 0, `${where}: forma non valida: ${problems.join("; ")}`);
  assert.strictEqual(`${m.id}.json`, path.basename(file), `${where}: id diverso dal nome del file`);

  // Unici tra eventi e Season.
  assert(!config.SEASON_IDS.includes(m.id) && !seen.id.has(m.id), `${where}: id gia' usato`);
  assert(!seen.badge.has(m.labels.badge), `${where}: sigla ${m.labels.badge} gia' usata da una Season o un evento`);
  assert(!seen.prefix.has(m.save.cardIdPrefix), `${where}: prefisso carte gia' usato`);
  seen.id.add(m.id); seen.badge.add(m.labels.badge); seen.prefix.add(m.save.cardIdPrefix);

  // Date: fine dopo l'inizio, durata ragionevole.
  const start = Date.parse(m.window.start), end = Date.parse(m.window.end);
  assert(end > start, `${where}: la fine deve essere dopo l'inizio`);
  assert(end - start <= 90 * 86400000, `${where}: evento piu' lungo di 90 giorni`);
  assert(config.SEASON_IDS.includes(m.baseSeasonId), `${where}: baseSeasonId ${m.baseSeasonId} non e' una Season`);

  // Squadra e carte.
  for (const key of ["players", "lineup", "moves"]) assert(fs.existsSync(m.team.files[key]), `${where}: manca ${m.team.files[key]}`);
  const team = readJson(m.team.files.players).find((t) => t.teamId === m.team.teamId);
  assert(team, `${where}: la squadra ${m.team.teamId} non e' nel file giocatori`);
  const players = new Map(team.players.map((p) => [String(p.playerId), p]));
  const moves = readJson(m.team.files.moves).players;
  for (const card of m.cards) {
    const player = players.get(card.playerId);
    assert(player, `${where}: la carta ${card.playerId} non esiste nel file giocatori`);
    assert(RARITIES.includes(card.rarity), `${where}: rarita' ${card.rarity} non valida (${card.playerId})`);
    assert.strictEqual(card.rarity, player.category, `${where}: rarita' della carta ${card.playerId} diversa dai dati`);
    assert.strictEqual(moves[card.playerId]?.moves?.length, 4, `${where}: la carta ${card.playerId} deve avere 4 mosse`);
    if (card.fullbody !== undefined) assert(okImage(card.fullbody), `${where}: immagine non valida (${card.playerId})`);
  }
  assert.strictEqual(players.size, m.team.rosterSize, `${where}: il file giocatori non ha ${m.team.rosterSize} carte`);
  const lineup = readJson(m.team.files.lineup).teams.find((t) => t.teamId.replaceAll("_", "-") === m.team.teamId);
  assert(lineup, `${where}: formazione della squadra mancante`);
  assert.strictEqual(new Set(lineup.startingXI.map(String)).size, m.team.startersSize, `${where}: titolari ripetuti o mancanti`);
  for (const id of lineup.startingXI) assert(m.cards.some((c) => c.playerId === String(id)), `${where}: titolare ${id} fuori dalle carte`);

  // Premio finale: non e' una carta del distributore.
  if (m.completionReward) {
    assert(!m.cards.some((c) => c.playerId === m.completionReward.playerId), `${where}: il premio finale e' gia' tra le carte`);
    assert(RARITIES.includes(m.completionReward.rarity), `${where}: rarita' del premio finale non valida`);
    if (m.completionReward.player) {
      assert.strictEqual(m.completionReward.player.playerId, m.completionReward.playerId, `${where}: premio finale incoerente`);
      assert.strictEqual(m.completionReward.moves?.length, 4, `${where}: il premio finale deve avere 4 mosse`);
    }
    if (m.completionReward.requires?.coachId) {
      assert(m.coaches.some((c) => c.id === m.completionReward.requires.coachId), `${where}: il premio chiede un allenatore assente`);
    }
  }

  // Le carte dell'evento devono essere ammesse dal controllo del salvataggio (save.ownedIdPattern).
  if (m.save.ownedIdPattern) {
    const pattern = new RegExp(m.save.ownedIdPattern);
    for (const card of m.cards) assert(pattern.test(card.playerId), `${where}: ${card.playerId} rifiutata dal salvataggio`);
  }

  // Allenatori: potere valido e almeno una carta a cui applicarlo.
  for (const coach of m.coaches || []) {
    // Stesso registro dei tipi usato dal gioco (rtg-coach-power-types.js).
    const errors = Array.from(context.RoadToGloryCoachPowerTypes.problems(coach.power));
    assert.strictEqual(errors.length, 0, `${where}: potere di ${coach.id} non valido: ${errors.join("; ")}`);
    const targets = coach.power.params.cardScope === "event" ? m.cards : [...players.values()];
    assert(targets.length >= coach.power.params.picks, `${where}: nessuna carta a cui applicare il potere di ${coach.id}`);
    const known = coaches.BY_ID[coach.id];
    if (isDev) {
      // Passo 4.1: l'allenatore di un evento finto non entra mai nel catalogo reale (ne' quindi nel salvataggio).
      assert(!known, `${where}: l'allenatore finto ${coach.id} non deve stare nel catalogo reale`);
      assert(/^https:\/\//.test(coach.imageUrl || "") || fs.existsSync(coach.imageUrl || ""), `${where}: immagine allenatore`);
      continue;
    }
    assert(known, `${where}: allenatore ${coach.id} assente dal catalogo`);
    assert.strictEqual(coach.name, known.name, `${where}: nome dell'allenatore ${coach.id} diverso dal catalogo`);
    assert.strictEqual(coach.power.name, known.powerName, `${where}: nome del potere diverso dal catalogo`);
  }

  // Immagini (per ora possono restare indirizzi esterni, come deciso il 5 nov).
  for (const value of [m.team.logo, m.currency?.icon, m.assets?.banner, m.assets?.background].filter(Boolean)) {
    assert(okImage(value), `${where}: immagine non valida ${value}`);
  }
}

// Passo 4.2: l'evento finto ha squadra, carte, allenatore e valuta propri, che non si mescolano con gli eventi veri.
for (const devFile of devFiles) {
  const fake = readJson(path.join(DEV_DIR, devFile));
  for (const file of files) {
    const real = readJson(path.join(DIR, file));
    const where = `evento dev/${devFile} accanto a ${file}`;
    assert.notStrictEqual(fake.team.teamId, real.team.teamId, `${where}: stessa squadra`);
    for (const key of ["players", "lineup", "moves"]) assert.notStrictEqual(fake.team.files[key], real.team.files[key], `${where}: stesso file ${key}`);
    const realIds = new Set(real.cards.map((c) => c.playerId));
    assert(!fake.cards.some((c) => realIds.has(c.playerId)), `${where}: carte con gli stessi giocatori`);
    const realCoaches = new Set((real.coaches || []).map((c) => c.id));
    assert(!(fake.coaches || []).some((c) => realCoaches.has(c.id)), `${where}: stesso allenatore`);
    assert.notStrictEqual(fake.currency.id, real.currency.id, `${where}: stessa valuta`);
    assert.notStrictEqual(fake.save.currencyField || "balance", real.save.currencyField || "balance", `${where}: stesso campo valuta`);
  }
}

// Passo 4.4: ogni evento a capsule ha tutti i testi dell'interfaccia, la valuta e gli id partita nel suo file.
const UI_KEYS = ["entryEyebrow", "entryTitle", "entrySubtitle", "completionTitle", "short", "appAria", "brand",
  "nextMatchAria", "challengeEyebrow", "challengeTitle", "capsuleEyebrow", "vendingTitle", "vendingTitleLong",
  "vendingStation", "vendingAria", "icon", "walletTitle", "tag", "albumPath", "prizeCredited", "devTitle"];
const capsuleEvents = [...files.map((f) => path.join(DIR, f)), ...devFiles.map((f) => path.join(DEV_DIR, f))]
  .map(readJson).filter((m) => m.kind === "capsuleEvent");
for (const m of capsuleEvents) {
  assert.deepStrictEqual(Object.keys(m.labels.ui).sort(), [...UI_KEYS].sort(), `${m.id}: testi dell'interfaccia`);
  for (const key of UI_KEYS) assert(key === "challengeTitle" ? m.labels.ui[key].length >= 1 : typeof m.labels.ui[key] === "string"
    && m.labels.ui[key].trim(), `${m.id}: testo ${key} vuoto`);
  for (const key of ["name", "unit", "unitUpper", "iconAlt"]) assert(m.currency[key], `${m.id}: currency.${key}`);
  for (const key of ["matchIdPrefix", "matchNodeId"]) assert(m.save[key], `${m.id}: save.${key}`);
}
// Passo 3.6a: ogni evento a capsule ha i suoi colori base (theme.colors) e un aspetto diverso dagli altri.
const THEME_KEYS = Array.from(events.THEME_COLORS);
for (const m of capsuleEvents) {
  assert.deepStrictEqual(Object.keys(m.theme.colors).sort(), [...THEME_KEYS].sort(), `${m.id}: colori base dell'evento`);
}
// Passo 3.6b: carte, schede e allenatori di un evento prendono la classe del loro evento e la loro pelle.
const reg = context.GameEvents;
for (const m of capsuleEvents) if (!reg.get(m.id)) reg.register(JSON.parse(JSON.stringify(m)), { dev: m.dev === true });
assert.strictEqual(reg.eventClasses("halloween2026", "card"), "rtg-event-card rtg-event--halloween2026 halloween-event-card",
  "Halloween tiene la sua pelle delle carte, identica a prima");
assert.strictEqual(reg.eventClasses("halloween2026", "coach"), "rtg-event-coach rtg-event--halloween2026 rtg-coach-halloween");
assert.strictEqual(reg.eventClasses("prova_dev", "card"), "rtg-event-card rtg-event--prova_dev rtg-event-card-base",
  "un evento senza pelle propria usa la pelle base con i suoi colori");
assert.strictEqual(reg.eventClasses("ie1", "card"), "", "le carte normali non ricevono classi di evento");
const playerView = fs.readFileSync("js/player/player-view.js", "utf8");
assert.doesNotMatch(playerView, /"halloween-event-(card|detail)"/, "la carta non nomina piu' la pelle di Halloween");
assert.doesNotMatch(fs.readFileSync("js/road-to-glory/rtg-coaches-view.js", "utf8"), /rtg-coach-halloween/);
const baseSkin = fs.readFileSync("css/rtg-halloween-event.css", "utf8");
assert.match(baseSkin, /\.player-card\.rtg-event-card\.rtg-event-card-base\{/, "pelle base delle carte evento");
assert.doesNotMatch(baseSkin.match(/Passo 3\.6b[\s\S]*?player-detail-rtg-legacy-badge\{[^}]*\}/)[0], /!important|::before|::after/,
  "la pelle base non usa !important e non tocca la striscia della rarita'");
// Passo 3.6c: distributore e moneta dell'evento con i colori e la moneta del suo file.
const vendingCss = fs.readFileSync("css/rtg-halloween-event.css", "utf8");
const vendingRules = vendingCss.match(/[^{}]*(vending|pull-result|pull-balance|pull-continue|currency)[^{}]*\{[^{}]*\}/g) || [];
const fixedVending = vendingRules.filter((rule) => !/player-|card|legacy|badge|reveal/.test(rule.split("{")[0]))
  .filter((rule) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(rule.split("{")[1]));
assert.deepStrictEqual(fixedVending, [], `distributore con colori fissi: ${fixedVending.join(" | ").slice(0, 300)}`);
assert.match(vendingCss, /border-radius:var\(--event-coin-radius\);object-fit:cover;mix-blend-mode:var\(--event-coin-blend\)/);
assert.strictEqual(reg.themeVars("halloween2026")["--event-coin-blend"], "screen", "la zucca resta fusa con lo sfondo");
// Passo 3.6d: pezzi aggiuntivi. I vampiri sono il pezzo di Halloween; la parte comune non decide piu' "vampiro".
const { loadEvents: loadWithExtensions } = require("./helpers/events");
const ext = loadWithExtensions({ console }).GameEvents;
assert.strictEqual(ext.extraClasses({ legacySeasonId: "halloween2026", halloweenVampire: true }, "card"), "halloween-vampire-player");
assert.strictEqual(ext.extraClasses({ legacySeasonId: "halloween2026", halloweenVampire: false }, "card"), "", "le 2 speciali no");
assert.strictEqual(ext.extraClasses({ cardId: "halloween2026::38", halloweenVampire: true }, "duel"), "halloween-vampiro");
assert.strictEqual(ext.extraClasses({ legacySeasonId: "ie1", halloweenVampire: true }, "card"), "", "carte normali: niente");
for (const file of ["js/player/player-view.js", "js/road-to-glory/rtg-match-view.js", "js/road-to-glory/rtg-halloween-event.js"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(source, /halloween-vampir|halloween-detail-vampire/, `${file}: l'aspetto vampiro sta nel pezzo di Halloween`);
}
for (const m of capsuleEvents) for (const src of m.extensions || []) {
  assert(fs.existsSync(src), `${m.id}: pezzo aggiuntivo ${src} mancante`);
  assert(src.startsWith(`js/events/${m.id}/`), `${m.id}: un pezzo aggiuntivo sta nella cartella del suo evento`);
}
const primaries = capsuleEvents.map((m) => m.theme.colors.primary.toLowerCase());
assert.strictEqual(new Set(primaries).size, primaries.length, "ogni evento ha il suo colore principale");
// Le schermate degli eventi prendono i colori dall'evento: nelle regole comuni non restano gli sfondi di Halloween.
const eventCss = fs.readFileSync("css/rtg-halloween-event.css", "utf8");
assert.match(eventCss, /:root\{--event-primary:/, "valori neutri della grafica comune degli eventi");
assert.doesNotMatch(eventCss, /depositphotos/, "lo sfondo della home dell'evento viene dal file dell'evento");
const eventModule = fs.readFileSync("js/road-to-glory/rtg-halloween-event.js", "utf8");
assert.match(eventModule, /GameEvents\?\.applyTheme\?\.\(app,EVENT_ID\)/, "i colori dell'evento si applicano all'apertura");
assert.match(eventModule, /GameEvents\?\.clearTheme\?\.\(app\)/, "e si tolgono all'uscita");
const seenTitles = new Set();
for (const m of capsuleEvents) {
  assert(!seenTitles.has(m.labels.ui.entryTitle), `${m.id}: titolo dell'ingresso uguale a un altro evento`);
  seenTitles.add(m.labels.ui.entryTitle);
}
const banners = capsuleEvents.map((m) => m.assets.banner);
assert.strictEqual(new Set(banners).size, banners.length, "ogni evento ha la sua immagine di ingresso");

// Parita' di Halloween con i valori che prima erano scritti nel codice: si spostano, non cambiano.
const h = readJson(path.join(DIR, "halloween2026.json"));
assert.deepStrictEqual(JSON.parse(JSON.stringify(h.economy)), { pullPrice: 200, winPrize: 300, luckyPrize: 600, luckyChancePercent: 10 });
assert.strictEqual(Date.parse(h.window.end), Date.UTC(2026, 10, 6, 22, 59, 59), "fine evento: 6 nov 2026 23:59:59 ore italiane");
assert.strictEqual(h.window.start, "2026-10-28T01:38:58+01:00", "inizio: primo commit dell'evento su main (647c4672)");
assert.strictEqual(h.team.teamId, "occult-2");
assert.strictEqual(h.save.key, "halloween", "Halloween resta in shared.halloween");
assert.strictEqual(h.save.currencyField, "pumpkins", "le zucche restano nel campo di prima");
assert.strictEqual(h.save.ownedIdPattern, "^(?:[0-9]+|custom_000[12])$", "stesso controllo del salvataggio di prima");
assert.strictEqual(h.kind, "capsuleEvent");
assert.deepStrictEqual(JSON.parse(JSON.stringify(h.labels.ui)), {
  entryEyebrow: "EVENTO LIMITATO · 2026", entryTitle: "🎃 EVENTO HALLOWEEN", entrySubtitle: "OCCULT HALLOWEEN",
  completionTitle: "🎃 EVENTO HALLOWEEN 2026", short: "Halloween", appAria: "Road to Glory Halloween", brand: "HALLOWEEN",
  nextMatchAria: "Prossima partita Halloween", challengeEyebrow: "SFIDA EVENTO · IL CIMITERO STREGATO",
  challengeTitle: ["OCCULT", "HALLOWEEN"], capsuleEyebrow: "CAPSULE HALLOWEEN", vendingTitle: "DISTRIBUTORE STREGATO",
  vendingTitleLong: "IL DISTRIBUTORE STREGATO", vendingStation: "CAPSULE STATION · HALLOWEEN",
  vendingAria: "Distributore Halloween", icon: "🎃", walletTitle: "ZUCCHE HALLOWEEN", tag: "OCCULT · HALLOWEEN",
  albumPath: "ALBUM → EVENTO HALLOWEEN", prizeCredited: "PREMIO HALLOWEEN ACCREDITATO", devTitle: "DEV HALLOWEEN",
}, "Passo 4.4: i testi di Halloween si spostano nel file, identici a quelli che erano nel codice");
assert.deepStrictEqual([h.currency.name, h.currency.unit, h.currency.unitUpper, h.currency.iconAlt],
  ["Zucche", "zucche", "ZUCCHE", "Zucca Halloween"]);
assert.deepStrictEqual([h.save.matchIdPrefix, h.save.matchNodeId], ["halloween-2026:", "event:occult-halloween"],
  "le partite gia' salvate restano valide");
assert.strictEqual(h.team.name, "Occult Halloween");
// Il modulo non ha piu' testi di Halloween scritti dentro: arrivano tutti dal file dell'evento.
const WORDS = "HALLOWEEN|Halloween|ZUCCH|[Zz]ucch|STREGAT|OCCULT|Occult|CIMITERO|🎃|occult-halloween|halloween-2026:";
const literal = new RegExp(`>[^<>'"\\n]*(${WORDS})[^<>'"\\n]*<|"[^"\\n]*(${WORDS})[^"\\n]*"|'[^'\\n]*(${WORDS})[^'\\n]*'`, "g");
const technical = /class=|data-halloween|\[(RTG )?Halloween\]|fail\(|^["']halloween-[\w-]*["']$|^["'][\w-]*halloween-[\w-]*["']$/;
const leftovers = fs.readFileSync("js/road-to-glory/rtg-halloween-event.js", "utf8").split("\n")
  .filter((line) => !/^\s*\/\//.test(line))
  .flatMap((line) => line.match(literal) || []).filter((text) => !technical.test(text));
assert.deepStrictEqual(leftovers, [], `testi di Halloween ancora nel modulo: ${leftovers.join(" | ")}`);
assert.deepStrictEqual([h.completionReward.playerId, h.completionReward.rarity, h.completionReward.overall,
  h.completionReward.level], ["custom_0003", "Leggenda", 97, 20], "premio finale (Shawn) invariato");
assert.strictEqual(h.save.cardIdPrefix, "halloween2026::", "gli id delle carte gia' possedute non cambiano");
const rarityCount = h.cards.reduce((acc, c) => ({ ...acc, [c.rarity]: (acc[c.rarity] || 0) + 1 }), {});
assert.deepStrictEqual(rarityCount, { Forte: 14, Elite: 2, Leggenda: 2 });
assert.deepStrictEqual(h.cards.filter((c) => !c.vampire).map((c) => c.playerId).sort(), ["custom_0001", "custom_0002"]);
assert.strictEqual(h.coaches[0].id, "halloween-coach-54");
assert.deepStrictEqual(JSON.parse(JSON.stringify(h.coaches[0].power.params)),
  { amount: 15, picks: 1, target: "ownStarter", cardScope: "event" });

console.log(`event-manifest-test: PASS (${files.length} eventi, ${devFiles.length} finti)`);
