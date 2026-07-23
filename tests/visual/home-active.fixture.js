(function (global) {
  "use strict";

  const svgPortrait = (label, background, foreground = "#ffffff") => {
    const safe = String(label).replace(/[<>&"']/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="24" fill="${background}"/><circle cx="80" cy="58" r="30" fill="${foreground}" opacity=".92"/><path d="M31 148c5-37 24-57 49-57s44 20 49 57" fill="${foreground}" opacity=".92"/><text x="80" y="151" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#111">${safe}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const players = [
    { playerId: "fixture-001", name: "Mark Evans", position: "GK", overall: 78, level: 8, category: "Buono", portraitUrl: svgPortrait("ME", "#2E8B57"), equipment: { id: "keeper_gloves", name: "Guanti del portiere", stat: "save", bonus: 2 } },
    { playerId: "fixture-002", name: "Axel Blaze", position: "FW", overall: 88, level: 10, category: "Mondiale", portraitUrl: svgPortrait("AB", "#C93A32") },
    { playerId: "fixture-003", name: "Jude Sharp", position: "MF", overall: 85, level: 9, category: "Elite", portraitUrl: svgPortrait("JS", "#7A4BD4") },
    { playerId: "fixture-004", name: "Nathan Swift", position: "DF", overall: 82, level: 9, category: "Forte", portraitUrl: svgPortrait("NS", "#36A9FF") },
    { playerId: "fixture-005", name: "Jack Wallside", position: "DF", overall: 76, level: 7, category: "Normale", portraitUrl: svgPortrait("JW", "#D8DEE7", "#1b2738") },
    { playerId: "fixture-006", name: "Kevin Dragonfly", position: "FW", overall: 80, level: 8, category: "Buono", portraitUrl: svgPortrait("KD", "#2E8B57") },
    { playerId: "fixture-007", name: "Erik Eagle", position: "MF", overall: 81, level: 8, category: "Forte", portraitUrl: svgPortrait("EE", "#36A9FF") },
    { playerId: "fixture-008", name: "Bobby Shearer", position: "DF", overall: 74, level: 7, category: "Normale", portraitUrl: svgPortrait("BS", "#D8DEE7", "#1b2738") },
    { playerId: "fixture-009", name: "Timmy Saunders", position: "MF", overall: 73, level: 7, category: "Debole", portraitUrl: svgPortrait("TS", "#263345") },
    { playerId: "fixture-010", name: "Maxwell Carson", position: "MF", overall: 72, level: 7, category: "Scarso", portraitUrl: svgPortrait("MC", "#3B3028") },
    { playerId: "fixture-011", name: "Steve Grim", position: "FW", overall: 75, level: 7, category: "Normale", portraitUrl: svgPortrait("SG", "#D8DEE7", "#1b2738") },
    { playerId: "fixture-012", name: "Jim Wraith", position: "DF", overall: 71, level: 6, category: "Debole", portraitUrl: svgPortrait("JW", "#263345") },
    { playerId: "fixture-013", name: "Sam Kincaid", position: "GK", overall: 70, level: 6, category: "Scarso", portraitUrl: svgPortrait("SK", "#3B3028") },
    { playerId: "fixture-014", name: "Shadow Cimmerian", position: "FW", overall: 90, level: 10, category: "Leggenda", portraitUrl: svgPortrait("SC", "#FFD34F", "#111111") },
    { playerId: "fixture-015", name: "David Samford", position: "FW", overall: 79, level: 8, category: "Buono", portraitUrl: svgPortrait("DS", "#2E8B57") }
  ];

  global.HOME_ACTIVE_FIXTURE = Object.freeze({
    fixtureId: "home-active-v1",
    generatedAt: "2026-07-23T08:00:00+02:00",
    season: { id: "ie1", name: "Inazuma Eleven 1" },
    teamIdentity: { name: "Fulmini di Raimon United", logo: "inazuma-lightning" },
    run: {
      runId: "visual-home-active-run-v1",
      phase: "map",
      active: true,
      lives: 2,
      teamLevel: 9,
      bossIndex: 4,
      bossName: "Shuriken",
      bossStep: 5,
      bossTotal: 10,
      zoneProgress: 0.4,
      formationId: "4-3-3",
      formationLabel: "4-3-3",
      averageOverall: 80,
      album: { unlocked: 37, total: 268 },
      hallOfFame: { entries: [] },
      roster: players
    }
  });
})(globalThis);
