(function (global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const CAMPAIGN_ID = "rtg-ie-trilogy";
  const ACTIVE_SEASON_IDS = Object.freeze(["ie1"]);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const id = (value) => String(value ?? "").trim();
  const uniqueIds = (values) => Array.from(new Set((Array.isArray(values) ? values : []).map(id).filter(Boolean)));
  const integer = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
  };

  function squadDefaults() {
    return { formationId: null, lineup: [], bench: [], activeRoleVariantByPlayerId: {} };
  }

  function createInitial({ campaignSeed } = {}) {
    const seed = id(campaignSeed);
    if (!seed) throw Object.assign(new Error("RTG campaign seed required"), { code: "rtg-state-missing-seed" });
    return {
      schemaVersion: SCHEMA_VERSION,
      campaignId: CAMPAIGN_ID,
      campaignSeed: seed,
      activeSeasonId: "ie1",
      seasonComplete: false,
      tokens: 0,
      lives: 2,
      checkpointMainIndex: -1,
      currentNodeId: "main:occult",
      furthestNodeIndex: 0,
      defeatedTeamIds: [],
      firstClearMatchIds: [],
      gachaAcquiredPlayerIds: [],
      gacha: { pullCount: 0 },
      squads: { ie1: squadDefaults() },
      attemptsByNode: {},
      activeMatch: null,
    };
  }

  function normalizeSquad(raw) {
    const squad = raw && typeof raw === "object" ? raw : {};
    const roles = squad.activeRoleVariantByPlayerId && typeof squad.activeRoleVariantByPlayerId === "object"
      ? clone(squad.activeRoleVariantByPlayerId)
      : {};
    return {
      formationId: squad.formationId == null ? null : id(squad.formationId),
      lineup: uniqueIds(squad.lineup),
      bench: uniqueIds(squad.bench),
      activeRoleVariantByPlayerId: roles,
    };
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? clone(raw) : null;
    if (!source) return null;
    const version = integer(source.schemaVersion, SCHEMA_VERSION);
    if (version > SCHEMA_VERSION) {
      throw Object.assign(new Error("Versione RTG non supportata"), {
        code: "rtg-state-unsupported-schema",
        schemaVersion: version,
      });
    }
    const initial = createInitial({ campaignSeed: source.campaignSeed || "invalid-seed" });
    const squadsSource = source.squads && typeof source.squads === "object" ? source.squads : {};
    const squads = { ...clone(squadsSource), ie1: normalizeSquad(squadsSource.ie1) };
    const attemptsByNode = source.attemptsByNode && typeof source.attemptsByNode === "object" ? clone(source.attemptsByNode) : {};
    const gachaSource = source.gacha && typeof source.gacha === "object" ? source.gacha : {};
    return {
      ...initial,
      schemaVersion: SCHEMA_VERSION,
      campaignId: id(source.campaignId || CAMPAIGN_ID),
      campaignSeed: id(source.campaignSeed || initial.campaignSeed),
      activeSeasonId: id(source.activeSeasonId || "ie1"),
      seasonComplete: typeof source.seasonComplete === "boolean" ? source.seasonComplete : false,
      tokens: Math.max(0, integer(source.tokens, 0)),
      lives: Math.max(0, Math.min(2, integer(source.lives, 2))),
      checkpointMainIndex: Math.max(-1, integer(source.checkpointMainIndex, -1)),
      currentNodeId: id(source.currentNodeId || "main:occult"),
      furthestNodeIndex: Math.max(0, integer(source.furthestNodeIndex, 0)),
      defeatedTeamIds: uniqueIds(source.defeatedTeamIds),
      firstClearMatchIds: uniqueIds(source.firstClearMatchIds),
      gachaAcquiredPlayerIds: uniqueIds(source.gachaAcquiredPlayerIds),
      gacha: { ...clone(gachaSource), pullCount: Math.max(0, integer(gachaSource.pullCount, 0)) },
      squads,
      attemptsByNode,
      activeMatch: source.activeMatch == null ? null : clone(source.activeMatch),
    };
  }

  function fail(code, message, extra = {}) {
    throw Object.assign(new Error(message), { code, ...extra });
  }

  function validate(raw) {
    if (!raw || typeof raw !== "object") fail("rtg-state-invalid", "Stato RTG non valido");
    const rawVersion = integer(raw.schemaVersion, SCHEMA_VERSION);
    if (rawVersion > SCHEMA_VERSION) fail("rtg-state-unsupported-schema", "Versione RTG non supportata", { schemaVersion: rawVersion });
    if (id(raw.campaignId || CAMPAIGN_ID) !== CAMPAIGN_ID) fail("rtg-state-invalid-campaign", "Campagna RTG non valida");
    if (Number(raw.tokens) < 0) fail("rtg-state-invalid-tokens", "Gettoni RTG non validi");
    if (!ACTIVE_SEASON_IDS.includes(id(raw.activeSeasonId || "ie1"))) fail("rtg-state-invalid-season", "Season RTG non supportata");
    if (typeof raw.seasonComplete !== "boolean") fail("rtg-state-invalid-season-complete", "Flag completamento Season non valido");
    if (raw.activeMatch != null && typeof raw.activeMatch !== "object") fail("rtg-state-invalid-active-match", "Partita RTG attiva non valida");
    const normalized = normalize(raw);
    const squad = normalized.squads.ie1;
    const rawSquad = raw.squads?.ie1 || {};
    const rawLineup = (Array.isArray(rawSquad.lineup) ? rawSquad.lineup : []).map(id).filter(Boolean);
    const rawBench = (Array.isArray(rawSquad.bench) ? rawSquad.bench : []).map(id).filter(Boolean);
    if (new Set(rawLineup).size !== rawLineup.length) fail("rtg-state-duplicate-lineup", "Titolari RTG duplicati");
    if (new Set(rawBench).size !== rawBench.length) fail("rtg-state-duplicate-bench", "Panchina RTG duplicata");
    const lineupSet = new Set(squad.lineup);
    if (squad.bench.some((playerId) => lineupSet.has(playerId))) fail("rtg-state-lineup-bench-overlap", "Giocatore presente sia tra titolari sia in panchina");
    return normalized;
  }

  global.RoadToGloryState = Object.freeze({ SCHEMA_VERSION, CAMPAIGN_ID, ACTIVE_SEASON_IDS, createInitial, normalize, validate, clone });
})(globalThis);
