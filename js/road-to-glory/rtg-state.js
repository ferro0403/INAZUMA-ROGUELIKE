(function (global) {
  "use strict";

  const SCHEMA_VERSION = 3;
  const CAMPAIGN_ID = "rtg-ie-trilogy";
  const ACTIVE_SEASON_IDS = Object.freeze(["ie1", "ie1_s2"]);
  const cards = () => global.RoadToGloryCardIdentity;
  const PROJECT_RARITIES = Object.freeze(["Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
  const DEVELOPMENT_RARITIES = Object.freeze(["Normale",...PROJECT_RARITIES]);

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const id = (value) => String(value ?? "").trim();
  const uniqueIds = (values) => Array.from(new Set((Array.isArray(values) ? values : []).map(id).filter(Boolean)));
  const integer = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
  };

  function squadDefaults() {
    return { formationId: null, lineup: [], bench: [], activeRoleVariantByCardId: {} };
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
      projects: Object.fromEntries(PROJECT_RARITIES.map((rarity) => [rarity, 0])),
      developmentByCardId: {},
      seasonTransitionRewardedIds: [],
      lives: 2,
      checkpointMainIndex: -1,
      currentNodeId: "main:occult",
      furthestNodeIndex: 0,
      defeatedTeamIds: [],
      firstClearMatchIds: [],
      gachaAcquiredCards: [],
      gacha: { pullCount: 0 },
      squads: { ie1: squadDefaults() },
      attemptsByNode: {},
      activeMatch: null,
    };
  }

  function normalizeOwnedCards(source = {}) {
    const api = cards();
    if (!api) throw new Error("RoadToGloryCardIdentity required");
    const rawCards = Array.isArray(source.gachaAcquiredCards) ? source.gachaAcquiredCards : [];
    const migrated = rawCards.length
      ? rawCards.map((entry) => api.record(entry, source.activeSeasonId || "ie1"))
      : uniqueIds(source.gachaAcquiredPlayerIds).map((playerId) => api.record({ playerId, legacySeasonId: "ie1" }));
    const seen = new Set();
    return migrated.filter((entry) => {
      if (!entry.cardId || seen.has(entry.cardId)) return false;
      seen.add(entry.cardId);
      return true;
    }).map((entry) => clone(entry));
  }

  function legacySquadCardId(value, ownedCards) {
    const api = cards();
    const raw = id(value);
    if (!raw) return "";
    if (api.isCardId(raw)) return api.parse(raw).cardId;
    const owned = (ownedCards || []).filter((entry) => id(entry.playerId) === raw);
    if (owned.length === 1) return owned[0].cardId;
    return api.cardIdForFreeAgent(raw);
  }

  function normalizeSquad(raw, ownedCards = []) {
    const squad = raw && typeof raw === "object" ? raw : {};
    const lineup = uniqueIds(squad.lineup).map((value) => legacySquadCardId(value, ownedCards)).filter(Boolean);
    const bench = uniqueIds(squad.bench).map((value) => legacySquadCardId(value, ownedCards)).filter(Boolean);
    const sourceRoles = squad.activeRoleVariantByCardId && typeof squad.activeRoleVariantByCardId === "object"
      ? squad.activeRoleVariantByCardId
      : (squad.activeRoleVariantByPlayerId && typeof squad.activeRoleVariantByPlayerId === "object" ? squad.activeRoleVariantByPlayerId : {});
    const activeRoleVariantByCardId = {};
    for (const [key, roleVariantId] of Object.entries(sourceRoles)) {
      const cardId = legacySquadCardId(key, ownedCards);
      if (cardId && roleVariantId != null && id(roleVariantId)) activeRoleVariantByCardId[cardId] = id(roleVariantId);
    }
    return {
      formationId: squad.formationId == null ? null : id(squad.formationId),
      lineup: uniqueIds(lineup),
      bench: uniqueIds(bench),
      activeRoleVariantByCardId,
    };
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? clone(raw) : null;
    if (!source) return null;
    const version = integer(source.schemaVersion, 1);
    if (version > SCHEMA_VERSION) {
      throw Object.assign(new Error("Versione RTG non supportata"), {
        code: "rtg-state-unsupported-schema",
        schemaVersion: version,
      });
    }
    const initial = createInitial({ campaignSeed: source.campaignSeed || "invalid-seed" });
    const acquiredCards = normalizeOwnedCards(source);
    const squadsSource = source.squads && typeof source.squads === "object" ? source.squads : {};
    const squadKeys = new Set(["ie1", "ie1_s2", ...Object.keys(squadsSource)]);
    const squads = {};
    for (const seasonId of squadKeys) squads[seasonId] = normalizeSquad(squadsSource[seasonId], acquiredCards);
    const attemptsByNode = source.attemptsByNode && typeof source.attemptsByNode === "object" ? clone(source.attemptsByNode) : {};
    const gachaSource = source.gacha && typeof source.gacha === "object" ? source.gacha : {};
    const rawProjects = source.projects && typeof source.projects === "object" ? source.projects : {};
    const projects = Object.fromEntries(PROJECT_RARITIES.map((rarity) => [rarity, Math.max(0, integer(rawProjects[rarity], 0))]));
    const rawDevelopment = source.developmentByCardId && typeof source.developmentByCardId === "object" ? source.developmentByCardId : {};
    const developmentByCardId = {};
    for (const [cardId, rawRecord] of Object.entries(rawDevelopment)) {
      const key = id(cardId);
      if (!key || !rawRecord || typeof rawRecord !== "object") continue;
      const targetPotential = Math.max(0, Math.min(99, integer(rawRecord.targetPotential, 0)));
      const currentRarity = DEVELOPMENT_RARITIES.includes(id(rawRecord.currentRarity)) ? id(rawRecord.currentRarity) : null;
      if (!targetPotential || !currentRarity) continue;
      developmentByCardId[key] = {
        targetPotential,
        currentRarity,
        evolutionCount: Math.max(0, integer(rawRecord.evolutionCount, 0)),
        updatedAt: rawRecord.updatedAt == null ? null : id(rawRecord.updatedAt),
      };
    }
    return {
      ...initial,
      schemaVersion: SCHEMA_VERSION,
      campaignId: id(source.campaignId || CAMPAIGN_ID),
      campaignSeed: id(source.campaignSeed || initial.campaignSeed),
      activeSeasonId: id(source.activeSeasonId || "ie1"),
      seasonComplete: typeof source.seasonComplete === "boolean" ? source.seasonComplete : false,
      tokens: Math.max(0, integer(source.tokens, 0)),
      projects,
      developmentByCardId,
      seasonTransitionRewardedIds: uniqueIds(source.seasonTransitionRewardedIds),
      lives: Math.max(0, Math.min(2, integer(source.lives, 2))),
      checkpointMainIndex: Math.max(-1, integer(source.checkpointMainIndex, -1)),
      currentNodeId: id(source.currentNodeId || "main:occult"),
      furthestNodeIndex: Math.max(0, integer(source.furthestNodeIndex, 0)),
      defeatedTeamIds: uniqueIds(source.defeatedTeamIds),
      firstClearMatchIds: uniqueIds(source.firstClearMatchIds),
      gachaAcquiredCards: acquiredCards,
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
    const rawVersion = integer(raw.schemaVersion, 1);
    if (rawVersion > SCHEMA_VERSION) fail("rtg-state-unsupported-schema", "Versione RTG non supportata", { schemaVersion: rawVersion });
    if (id(raw.campaignId || CAMPAIGN_ID) !== CAMPAIGN_ID) fail("rtg-state-invalid-campaign", "Campagna RTG non valida");
    if (Number(raw.tokens) < 0) fail("rtg-state-invalid-tokens", "Gettoni RTG non validi");
    if (!ACTIVE_SEASON_IDS.includes(id(raw.activeSeasonId || "ie1"))) fail("rtg-state-invalid-season", "Season RTG non supportata");
    if (typeof raw.seasonComplete !== "boolean") fail("rtg-state-invalid-season-complete", "Flag completamento Season non valido");
    if (raw.activeMatch != null && typeof raw.activeMatch !== "object") fail("rtg-state-invalid-active-match", "Partita RTG attiva non valida");
    for (const [seasonId, rawSquad] of Object.entries(raw.squads || {})) {
      const rawLineup = (Array.isArray(rawSquad?.lineup) ? rawSquad.lineup : []).map(id).filter(Boolean);
      const rawBench = (Array.isArray(rawSquad?.bench) ? rawSquad.bench : []).map(id).filter(Boolean);
      if (new Set(rawLineup).size !== rawLineup.length) fail("rtg-state-duplicate-lineup", "Titolari RTG duplicati", { seasonId });
      if (new Set(rawBench).size !== rawBench.length) fail("rtg-state-duplicate-bench", "Panchina RTG duplicata", { seasonId });
      const rawLineupSet = new Set(rawLineup);
      if (rawBench.some((cardId) => rawLineupSet.has(cardId))) fail("rtg-state-lineup-bench-overlap", "Carta presente sia tra titolari sia in panchina", { seasonId });
    }
    const normalized = normalize(raw);
    for (const rarity of PROJECT_RARITIES) {
      const value = normalized.projects?.[rarity];
      if (!Number.isInteger(value) || value < 0) fail("rtg-state-invalid-projects", "Inventario Progetti RTG non valido", { rarity });
    }
    for (const [cardId, record] of Object.entries(normalized.developmentByCardId || {})) {
      if (!id(cardId)) fail("rtg-state-invalid-development-card", "Carta evoluta RTG non valida");
      if (!Number.isInteger(record.targetPotential) || record.targetPotential < 1 || record.targetPotential > 99) fail("rtg-state-invalid-development-potential", "Potenziale evoluzione RTG non valido", { cardId });
      if (!DEVELOPMENT_RARITIES.includes(record.currentRarity)) fail("rtg-state-invalid-development-rarity", "Rarità evoluzione RTG non valida", { cardId });
      if (!Number.isInteger(record.evolutionCount) || record.evolutionCount < 0) fail("rtg-state-invalid-development-count", "Conteggio evoluzioni RTG non valido", { cardId });
    }
    if (new Set(normalized.seasonTransitionRewardedIds || []).size !== (normalized.seasonTransitionRewardedIds || []).length) fail("rtg-state-duplicate-season-reward", "Bonus cambio Season RTG duplicato");
    const ownedIds = normalized.gachaAcquiredCards.map((entry) => id(entry.cardId));
    if (new Set(ownedIds).size !== ownedIds.length) fail("rtg-state-duplicate-card", "Carta RTG duplicata nella collezione");
    for (const [seasonId, squad] of Object.entries(normalized.squads || {})) {
      const lineup = (squad.lineup || []).map(id).filter(Boolean);
      const bench = (squad.bench || []).map(id).filter(Boolean);
      if (new Set(lineup).size !== lineup.length) fail("rtg-state-duplicate-lineup", "Titolari RTG duplicati", { seasonId });
      if (new Set(bench).size !== bench.length) fail("rtg-state-duplicate-bench", "Panchina RTG duplicata", { seasonId });
      const lineupSet = new Set(lineup);
      if (bench.some((cardId) => lineupSet.has(cardId))) fail("rtg-state-lineup-bench-overlap", "Carta presente sia tra titolari sia in panchina", { seasonId });
    }
    return normalized;
  }

  global.RoadToGloryState = Object.freeze({ SCHEMA_VERSION, CAMPAIGN_ID, ACTIVE_SEASON_IDS, PROJECT_RARITIES, DEVELOPMENT_RARITIES, createInitial, normalize, validate, clone });
})(globalThis);
