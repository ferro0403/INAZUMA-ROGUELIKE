(function (global) {
  "use strict";
  function pendingCoins(bossWins, overrides) { return Math.max(0, Number(bossWins || 0)) * global.ProjectConfig.mode(overrides).coinsPerBoss; }
  function redeemableCoins(bossWins, overrides) { const mode = global.ProjectConfig.mode(overrides); return Number(bossWins || 0) >= mode.minimumBossesForCoins ? pendingCoins(bossWins, overrides) : 0; }
  function canRedeem(reason, overrides) { return global.ProjectConfig.mode(overrides).legitimateEndReasons.includes(reason); }
  function redeem(center, { runId, bossWins, reason, modeOverrides }) {
    const id = String(runId || ""); if (!id || center.redeemedRunIds.includes(id)) return { redeemed: false, amount: 0 };
    if (!canRedeem(reason, modeOverrides)) return { redeemed: false, amount: 0 };
    const amount = redeemableCoins(bossWins, modeOverrides); center.redeemedRunIds.push(id);
    center.coinLedger.push({ transactionId: `run-coins:${id}`, runId: id, type: "run-redemption", amount, bossWins: Number(bossWins || 0), reason, createdAt: new Date().toISOString() });
    center.coins += amount; return { redeemed: true, amount, coins: center.coins };
  }
  const api = { pendingCoins, redeemableCoins, canRedeem, redeem };
  global.DevelopmentEconomy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
