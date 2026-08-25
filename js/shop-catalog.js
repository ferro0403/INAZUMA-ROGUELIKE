(function (global) {
  "use strict";
  const EMBLEM_TIERS = Object.freeze({ base: Object.freeze({ label: "BASE", coins: 200, cups: 0 }), rare: Object.freeze({ label: "RARO", coins: 400, cups: 0 }), epic: Object.freeze({ label: "EPICO", coins: 600, cups: 1 }), iconic: Object.freeze({ label: "ICONICO", coins: 600, cups: 2 }) });
  const SECTION_ORDER = Object.freeze(["general", "ie1", "ie1_s2", "ie1_s3", "ie2", "orion"]);
  const SPECIAL = Object.freeze({
    ie1: { royal: "rare", zeus: "epic" },
    ie1_s2: { genesis: "epic", chaos: "epic", diamond_dust: "rare", prominence: "rare", epsilon_plus: "rare", royal_academy_redux: "rare", dark_emperors: "rare" },
    ie1_s3: { team_ogre: "iconic", inazuma_national: "iconic", orpheus: "epic", the_kingdom: "epic", little_gigantes: "epic", big_waves: "rare", desert_lions: "rare", fire_dragon: "rare", queen_s_knights: "rare", the_empire: "rare", unicorn: "rare" },
    ie2: { alia_academy: "rare", royal_academy_ares: "rare", zeus_ares: "epic", polestar_academy: "epic", lunar_prime_academy: "epic", barcelona_orb: "iconic" },
    orion: {
      raging_bulls: "base",
      eternal_dancers: "base",
      arabian_firebirds: "base",
      ace_invaders: "rare",
      avenging_acrobats: "rare",
      fallen_angels: "rare",
      pitch_perfectionists: "epic",
      guardians_of_the_queen: "epic",
      los_invencibles: "epic",
      the_sambassadors: "epic",
      inazuma_national_2: "iconic",
      orion_eclipse: "iconic",
      zhao_eclipse: "iconic",
    },
  });
  const EXCLUDED = Object.freeze({ ie1_s2: new Set(["zeus"]), ie2: new Set(["alpine", "kirkwood"]) });
  const BOSS_ONLY_SEASONS = Object.freeze(new Set(["orion"]));
  const canonicalName = (name) => String(name || "").toLocaleLowerCase("en").replace(/\bie2\b|\bares\b|\binazuma eleven 2\b/g, "").replace(/academy/g, "").replace(/[^a-z0-9]+/g, "");
  const bossTeamIds = (database) => new Set((database?.bossOrder || []).map((boss) => String(boss?.teamId || boss?.id || "")).filter(Boolean));
  function build() {
    const seen = new Set(), catalog = [];
    for (const seasonId of SECTION_ORDER.slice(1)) {
      const database = global.SeasonRegistry?.database?.(seasonId);
      const allowedBosses = BOSS_ONLY_SEASONS.has(seasonId) ? bossTeamIds(database) : null;
      for (const team of database?.teams || []) {
        const teamId = String(team.teamId || team.id), name = String(team.teamName || team.name || teamId), key = canonicalName(name);
        if (allowedBosses && !allowedBosses.has(teamId)) continue;
        if (EXCLUDED[seasonId]?.has(teamId) || (seasonId === "ie1_s3" && seen.has(key))) continue;
        if (seasonId !== "ie2") seen.add(key);
        const rarity = SPECIAL[seasonId]?.[teamId] || "base", tier = EMBLEM_TIERS[rarity];
        catalog.push(Object.freeze({ teamId, name, seasonId, shopSection: seasonId, emblemId: `team:${seasonId}:${teamId}`, rarity, ...tier }));
      }
    }
    return Object.freeze(catalog);
  }
  global.ShopCatalog = { EMBLEM_TIERS, SECTION_ORDER, build };
  if (typeof module !== "undefined" && module.exports) module.exports = global.ShopCatalog;
})(typeof globalThis !== "undefined" ? globalThis : window);
