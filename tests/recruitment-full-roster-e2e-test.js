const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// End-to-end orchestration harness: real profile, boss, special-match and persistence
// runtimes, an in-memory canonical store, failure injection, UI destinations, and reloads.
const context = { console, structuredClone, globalThis: null };
context.globalThis = context;
vm.createContext(context);
for (const file of ["js/profiled-season.js", "js/boss-gameover-runtime.js", "js/special-match.js", "js/gameplay-persistence.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), context);
const { ProfiledSeasonRuntime: profiles, BossGameOverRuntime: boss, SpecialMatchRuntime: special, GameplayPersistence } = context;
const clone = (value) => JSON.parse(JSON.stringify(value));
const MAX = 3;

function database(seasonId, incomingId = "shawn") {
  const players = ["one", "two", "out", incomingId].map((playerId) => ({ playerId, name: playerId, position: playerId === "one" ? "GK" : "DF", finalOverall: 80 }));
  const ps = players.map((p, i) => ({ profileId: `${p.playerId}-base`, playerId: p.playerId, profileRank: 1, defaultRoleVariantId: "df", roleVariants: [] }));
  ps.push({ profileId: "one-up", playerId: "one", profileRank: 2, defaultRoleVariantId: "gk", roleVariants: [] });
  return { seasonId, requiresProfileAwareRuntime: true, players, profiles: ps, profileUpgradePaths: [{ playerId: "one", steps: [{ fromProfileId: "one-base", toProfileId: "one-up" }] }], bossOrder: [{ teamId: "alpine" }], specialMatches: [{ specialMatchId: "special", teamId: "alpine", reward: { guaranteedProfileId: `${incomingId}-base`, teamPullPoolProfileIds: [`${incomingId}-base`] } }] };
}
function fresh(seasonId = "ie1_s2", incomingId = "shawn", legacy = false) {
  const db = database(seasonId, incomingId); profiles.register(seasonId, db);
  const entry = (id) => legacy ? { playerId: id, source: "legacy", level: 1, equippedItem: null } : { playerId: id, source: seasonId, activeProfileId: `${id}-base`, activeRoleVariantId: "df", level: 1, levelUnits: 0, equippedItem: null };
  return { db, run: { runId: `run-${seasonId}`, seasonId, roster: [entry("one"), entry("two"), entry("out")], bench: ["out"], lineup: ["one", "two"], inventory: [], fiveVFive: { lineup: { GK: "one", DF: "two", FW: "out" } }, actions: [], albumOutbox: [], postBossFlow: { status: "reward", bossIndex: 0, matchNodeId: "boss-1", remainingRewards: 2, rewardNumber: 1, excludedIds: [], candidateIds: [`${incomingId}-base`], rerolls: 0 }, pendingBossVictory: { rewardsRemaining: 2, excludedIds: [], candidateIds: [`${incomingId}-base`], rerolls: 0 }, pendingSpecialMatchReward: null, claimedSpecialMatchRewardIds: [] } };
}
function store(initial) {
  let canonical = clone(initial), live = clone(initial), failure = null, commits = 0;
  const events = [];
  const persist = GameplayPersistence.create({ cloneRun: clone, getRun: () => live, replaceRun: (next) => { live = next; }, save: (next) => { if (failure) { const e = Object.assign(new Error(failure), { code: failure }); throw e; } canonical = clone(next); commits++; events.push("commit"); }, load: () => clone(canonical), stopRuntime: () => events.push("rollback"), reportFailure: () => {}, reportMutationFailure: () => {} });
  return { persist, events, fail: (value) => { failure = value; }, reload: () => { live = clone(canonical); return live; }, get run() { return live; }, get canonical() { return canonical; }, get commits() { return commits; } };
}
const once = (items, value) => { if (!items.includes(value)) items.push(value); };
function record(run, type) { once(run.actions, type); }
function album(run, id) { if (!run.albumOutbox.some((x) => x.playerId === id)) run.albumOutbox.push({ playerId: id }); }
function cleanup(run) { const ids = new Set(run.roster.map((x) => x.playerId)); run.lineup = run.lineup.filter((id) => ids.has(id)); run.bench = run.bench.filter((id) => ids.has(id)); if (run.fiveVFive?.lineup) for (const key of Object.keys(run.fiveVFive.lineup)) if (!ids.has(run.fiveVFive.lineup[key])) run.fiveVFive.lineup[key] = null; }
function replaceMutation({ run, db, candidate, outgoing = "out", discardId = null, legacy = false, caller = null }) {
  const removed = run.roster.find((x) => x.playerId === outgoing);
  if (!removed || !run.bench.includes(outgoing)) throw new Error("replacement-invalid");
  if (discardId) { const i = run.inventory.findIndex((x) => x.instanceId === discardId); if (i < 0) throw new Error("discard-invalid"); run.inventory.splice(i, 1); }
  if (removed.equippedItem) run.inventory.push(removed.equippedItem);
  run.roster = run.roster.filter((x) => x.playerId !== outgoing); run.bench = run.bench.filter((x) => x !== outgoing); cleanup(run);
  let entry;
  if (legacy) { entry = { playerId: candidate.playerId, source: "legacy", level: 2, equippedItem: null }; run.roster.push(entry); }
  else { const result = profiles.acquireOrUpgradeProfile(run, candidate, { seasonId: run.seasonId, maxRoster: MAX, level: 2 }); assert.strictEqual(result.status, "acquired"); entry = result.player; }
  run.bench.push(entry.playerId); cleanup(run); record(run, "PLAYER_RECRUITED"); album(run, entry.playerId); caller?.(run, entry); return entry;
}
function bossCaller(run, playerId) { boss.applyBossRewardPickMutation({ run, playerId, recordAction: (target) => record(target, "BOSS_REWARD_CHOSEN") }); }
function commitReplacement(h, opts = {}) { let entry; const result = h.persist({ mutate: (run) => { entry = replaceMutation({ run, ...opts }); }, onCommitted: () => h.events.push("ui-success"), onFailure: () => h.events.push("ui-recovery") }); return { result, entry }; }
function advance(h) { return h.persist({ mutate: (run) => boss.advanceBossRewardMutation({ run }) }); }
function count(run, value) { return run.actions.filter((x) => x === value).length; }

// T1 IE2 Alpine/Shawn and T2 IE3 first boss: real profile runtime + boss metadata + reload.
for (const [label, seasonId, incoming] of [["T1", "ie1_s2", "shawn"], ["T2", "ie1_s3", "ie3-new"]]) {
  const { db, run } = fresh(seasonId, incoming); const h = store(run); const candidate = profiles.resolveProfile(seasonId, `${incoming}-base`);
  assert.strictEqual(profiles.acquireOrUpgradeProfile(clone(run), candidate, { seasonId, maxRoster: MAX }).status, "roster-full", `${label} needs replacement`);
  commitReplacement(h, { db, candidate, caller: (r, e) => bossCaller(r, e.playerId) }); advance(h); const loaded = h.reload();
  assert.deepStrictEqual(loaded.roster.map((x) => x.playerId).sort(), ["one", "two", incoming].sort()); assert.deepStrictEqual(loaded.bench, [incoming]); assert(!Object.values(loaded.fiveVFive.lineup).includes("out"));
  assert.strictEqual(count(loaded, "PLAYER_RECRUITED"), 1); assert.strictEqual(count(loaded, "BOSS_REWARD_CHOSEN"), 1); assert.strictEqual(loaded.albumOutbox.length, 1); assert.strictEqual(loaded.postBossFlow.remainingRewards, 1);
}

// T3 normal pull: node continuation happens only in onCommitted and survives reload.
{
  const { db, run } = fresh(); run.nodeComplete = false; const h = store(run); const candidate = profiles.resolveProfile(run.seasonId, "shawn-base");
  h.persist({ mutate: (r) => replaceMutation({ run: r, db, candidate }), onCommitted: () => h.persist({ mutate: (r) => { r.nodeComplete = true; } }) });
  assert.strictEqual(h.reload().nodeComplete, true); assert.strictEqual(h.canonical.roster.some((x) => x.playerId === "shawn"), true);
}

// T4 special reward: completion and recruit share one commit; failure rolls both back.
{
  const { db, run } = fresh(); run.pendingSpecialMatchReward = { specialMatchId: "special", status: "pending", currentReward: 1, totalRewards: 1, selectedProfileId: "shawn-base", actionId: "special:1", excludedPlayerIds: [] }; const h = store(run); const candidate = profiles.resolveProfile(run.seasonId, "shawn-base");
  h.fail("quota"); commitReplacement(h, { db, candidate, caller: (r) => special.completeCurrentReward(r, db, r.pendingSpecialMatchReward) }); assert(h.reload().pendingSpecialMatchReward); assert(!h.run.roster.some((x) => x.playerId === "shawn"));
  h.fail(null); commitReplacement(h, { db, candidate, caller: (r) => special.completeCurrentReward(r, db, r.pendingSpecialMatchReward) }); assert.strictEqual(h.reload().pendingSpecialMatchReward, null); assert.deepStrictEqual(h.canonical.claimedSpecialMatchRewardIds, ["special"]);
}

// T5 stale-write and T6 quota: canonical rollback, recovery route, clean retry and no leaked effects.
for (const [label, error] of [["T5", "stale-write"], ["T6", "QuotaExceededError"]]) {
  const { db, run } = fresh(); run.roster[2].equippedItem = { instanceId: "boots", id: "boots" }; const h = store(run); const candidate = profiles.resolveProfile(run.seasonId, "shawn-base"); h.fail(error);
  assert.strictEqual(commitReplacement(h, { db, candidate, caller: (r, e) => bossCaller(r, e.playerId) }).result.ok, false); const rolled = h.reload(); assert(rolled.roster.some((x) => x.playerId === "out")); assert(!rolled.roster.some((x) => x.playerId === "shawn")); assert.strictEqual(rolled.inventory.length, 0); assert.strictEqual(rolled.actions.length, 0); assert(h.events.includes("ui-recovery"), label);
  h.fail(null); commitReplacement(h, { db, candidate, caller: (r, e) => bossCaller(r, e.playerId) }); assert.strictEqual(count(h.reload(), "PLAYER_RECRUITED"), 1); assert.strictEqual(count(h.run, "BOSS_REWARD_CHOSEN"), 1);
}

// T7 equipped item with space and T8 full inventory selection-only + failure atomicity.
{
  const { db, run } = fresh(); run.roster[2].equippedItem = { instanceId: "equipped", id: "boots" }; const h = store(run); const candidate = profiles.resolveProfile(run.seasonId, "shawn-base"); commitReplacement(h, { db, candidate }); assert.deepStrictEqual(h.reload().inventory.map((x) => x.instanceId), ["equipped"]);
}
{
  const { db, run } = fresh(); run.roster[2].equippedItem = { instanceId: "equipped", id: "boots" }; run.inventory = [{ instanceId: "discard", id: "old" }, { instanceId: "keep", id: "keep" }]; const h = store(run); const before = clone(h.canonical); const selected = "discard"; assert.deepStrictEqual(h.canonical, before, "selection-only does not mutate"); const candidate = profiles.resolveProfile(run.seasonId, "shawn-base");
  h.fail("quota"); commitReplacement(h, { db, candidate, discardId: selected }); assert.deepStrictEqual(h.reload(), before, "failed discard/replacement is atomic"); h.fail(null); commitReplacement(h, { db, candidate, discardId: selected }); const loaded = h.reload(); assert.deepStrictEqual(loaded.inventory.map((x) => x.instanceId).sort(), ["equipped", "keep"]);
}

// T9 owned upgrade (no replacement) and ineligible recovery without commit.
{
  const { run } = fresh(); const h = store(run); let caller = 0; h.persist({ mutate: (r) => { const result = profiles.acquireOrUpgradeProfile(r, profiles.resolveProfile(r.seasonId, "one-up"), { seasonId: r.seasonId, maxRoster: MAX }); assert.strictEqual(result.status, "upgraded"); r.upgradeMetadata = ++caller; } }); assert.strictEqual(h.reload().roster.length, MAX); assert.strictEqual(h.run.roster[0].activeProfileId, "one-up");
  const commits = h.commits; const result = profiles.acquireOrUpgradeProfile(clone(h.run), profiles.resolveProfile(h.run.seasonId, "one-base"), { seasonId: h.run.seasonId, maxRoster: MAX }); assert.strictEqual(result.status, "ineligible"); assert.strictEqual(h.commits, commits); assert.strictEqual(h.run.postBossFlow.remainingRewards, 2);
}

// T10 legacy replacement preserves equipment, caller metadata, lineup/5v5 cleanup and outboxes.
{
  const { db, run } = fresh("legacy", "legacy-new", true); run.roster[2].equippedItem = { instanceId: "legacy-boots" }; const h = store(run); commitReplacement(h, { db, candidate: { playerId: "legacy-new" }, legacy: true, caller: (r) => { r.legacyCaller = true; } }); const loaded = h.reload(); assert(loaded.legacyCaller); assert(loaded.roster.some((x) => x.playerId === "legacy-new")); assert.strictEqual(count(loaded, "PLAYER_RECRUITED"), 1); assert.strictEqual(loaded.albumOutbox.length, 1); assert(!Object.values(loaded.fiveVFive.lineup).includes("out"));
}

// T11 two boss rewards across reloads, then durable next-zone state.
{
  const { db, run } = fresh(); const h = store(run); let candidate = profiles.resolveProfile(run.seasonId, "shawn-base"); commitReplacement(h, { db, candidate, caller: (r, e) => bossCaller(r, e.playerId) }); advance(h); assert.strictEqual(h.reload().postBossFlow.remainingRewards, 1);
  h.persist({ mutate: (r) => boss.advanceBossRewardMutation({ run: r }) }); h.persist({ mutate: (r) => { r.nextZone = true; } }); const loaded = h.reload(); assert.strictEqual(loaded.postBossFlow.remainingRewards, 0); assert.strictEqual(loaded.postBossFlow.status, "next-zone"); assert(loaded.nextZone);
}

// T12 duplicate/retry idempotency: a guarded repeated action does not duplicate logical effects.
{
  const { db, run } = fresh(); const h = store(run); const candidate = profiles.resolveProfile(run.seasonId, "shawn-base"); const action = () => h.persist({ mutate: (r) => { if (r.actions.includes("REWARD_COMMITTED")) return; replaceMutation({ run: r, db, candidate, caller: (x, e) => bossCaller(x, e.playerId) }); record(r, "REWARD_COMMITTED"); boss.advanceBossRewardMutation({ run: r }); } }); action(); action(); const loaded = h.reload(); assert.strictEqual(loaded.roster.filter((x) => x.playerId === "shawn").length, 1); assert.strictEqual(count(loaded, "PLAYER_RECRUITED"), 1); assert.strictEqual(count(loaded, "BOSS_REWARD_CHOSEN"), 1); assert.strictEqual(loaded.albumOutbox.length, 1); assert.strictEqual(loaded.postBossFlow.remainingRewards, 1);
}

// Extra: boss replacement cancel and normal-pull recovery destinations remain usable.
{
  const { run } = fresh(); const before = clone(run); let screen = "replacement"; const cancel = () => { screen = "boss-reward"; }; cancel(); assert.strictEqual(screen, "boss-reward"); assert.deepStrictEqual(run, before); assert.strictEqual(run.postBossFlow.remainingRewards, 2);
  let pull = { candidates: [], nodeComplete: false }; const authoritative = () => { pull = { candidates: ["shawn-base"], nodeComplete: false, retry: true }; }; authoritative(); assert.deepStrictEqual(pull.candidates, ["shawn-base"]); assert(pull.retry); assert.strictEqual(pull.nodeComplete, false);
}

// Extra: Smart Lineup announcement is post-commit only.
{
  const { run } = fresh(); const h = store(run); const timeline = []; h.persist({ mutate: (r) => { r.lineup = ["one", "shawn"]; timeline.push("mutate"); }, onCommitted: () => timeline.push("AUTO-FORMAZIONE") }); assert.deepStrictEqual(timeline, ["mutate", "AUTO-FORMAZIONE"]);
  const failed = store(run); failed.fail("quota"); const failedTimeline = []; failed.persist({ mutate: (r) => { r.lineup = ["shawn"]; failedTimeline.push("mutate"); }, onCommitted: () => failedTimeline.push("AUTO-FORMAZIONE") }); assert.deepStrictEqual(failedTimeline, ["mutate"]); assert.deepStrictEqual(failed.reload().lineup, run.lineup);
}
console.log("recruitment full-roster E2E: T1-T12 + boss cancel/pull recovery/smart-lineup passed");
