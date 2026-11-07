"use strict";
// Regola fissa (7 nov 2026): i giocatori sbloccati negli eventi sono giocabili in tutte le run RTG, di qualsiasi
// Season. Per ognuna delle 5 Season RTG una squadra con carte evento possedute e' valida: le carte sono accessibili,
// si risolvono nel giocatore dell'evento (con il resolver vero del gioco) e la formazione e' accettata.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { loadEvents } = require("./helpers/events");

const read = (file) => fs.readFileSync(file, "utf8");
const context = vm.createContext({ console: { warn() {}, log() {}, error() {} } });
context.globalThis = context;
loadEvents(context);
for (const file of ["js/season-registry.js", "js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-card-identity.js",
  "js/road-to-glory/rtg-coaches.js", "js/road-to-glory/rtg-coach-power-types.js", "js/road-to-glory/rtg-squad-runtime.js",
  "js/road-to-glory/rtg-player-resolver.js", "js/road-to-glory/rtg-halloween-completion-reward.js",
  "js/road-to-glory/rtg-halloween-event.js"]) {
  vm.runInContext(read(file), context, { filename: file });
}
const fetcher = async (url) => ({ ok: fs.existsSync(String(url)), json: async () => JSON.parse(read(String(url))) });

(async () => {
  const events = context.GameEvents;
  const SEASONS = Array.from(context.RoadToGloryConfig.SEASON_IDS);
  assert.deepStrictEqual(SEASONS, ["ie1", "ie1_s2", "ie1_s3", "ie2", "orion"], "le 5 Season RTG");
  for (const manifest of events.all().filter((m) => m.kind === "capsuleEvent" && events.module(m.id))) {
    await events.module(manifest.id).prepare(fetcher);
    const lineupFile = JSON.parse(read(manifest.team.files.lineup)).teams[0];
    const starters = lineupFile.startingXI.map(String);
    const bench = manifest.cards.map((c) => c.playerId).filter((id) => !starters.includes(id)).slice(0, 4);
    const cardId = (playerId) => `${manifest.save.cardIdPrefix}${playerId}`;
    const owned = [...starters, ...bench].map((playerId) =>
      JSON.parse(JSON.stringify(context.RoadToGloryCardIdentity.record({ playerId, legacySeasonId: manifest.id }))));
    for (const seasonId of SEASONS) {
      const squad = { formationId: lineupFile.bossFormation, lineup: starters.map(cardId), bench: bench.map(cardId),
        activeRoleVariantByCardId: {} };
      const state = { activeSeasonId: seasonId, gachaAcquiredCards: owned, squads: { [seasonId]: squad } };
      const accessible = context.RoadToGloryRtgSquadRuntime?.accessibleCardIds?.({ state })
        || context.RoadToGlorySquadRuntime.accessibleCardIds({ state });
      for (const id of [...squad.lineup, ...squad.bench]) {
        assert(accessible.includes(id), `${manifest.id} in ${seasonId}: carta ${id} non disponibile`);
      }
      const runtime = context.RoadToGloryRtgSquadRuntime || context.RoadToGlorySquadRuntime;
      const result = runtime.validateSquad({ state, playerResolver: context.RoadToGloryPlayerResolver });
      assert.deepStrictEqual(Array.from(result.reasons), [], `${manifest.id} in ${seasonId}: squadra non valida`);
      assert.strictEqual(result.lineupPlayers[0].cardId, squad.lineup[0], `${manifest.id} in ${seasonId}: giocatore dell'evento`);
      assert.strictEqual(result.lineupPlayers[0].legacySeasonId, manifest.id);
    }
  }
  console.log(`event-cards-all-seasons-test: PASS (carte evento giocabili in ${SEASONS.length} Season RTG)`);
})().catch((error) => { console.error(error); process.exit(1); });
