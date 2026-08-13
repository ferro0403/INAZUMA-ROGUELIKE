(function (global) {
  "use strict";

  const storage = global.HallOfFameStorage;
  if (!storage || typeof storage.listSummaries !== "function" || typeof storage.getTeam !== "function") return;

  const originalListSummaries = storage.listSummaries.bind(storage);

  storage.listSummaries = function listSummariesWithSeasonIdentity() {
    return originalListSummaries().map((summary) => {
      const fullTeam = storage.getTeam(summary.hallTeamId);
      if (!fullTeam) return summary;
      return {
        ...summary,
        modeId: fullTeam.modeId ?? summary.modeId ?? null,
        seasonId: fullTeam.seasonId ?? summary.seasonId ?? null,
        modeName: fullTeam.modeName ?? summary.modeName ?? null,
        seasonName: fullTeam.seasonName ?? summary.seasonName ?? null,
      };
    });
  };
})(globalThis);
