const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const orion = JSON.parse(fs.readFileSync("data/ORION_season_compact.json", "utf8"));
const context = {
  fetch: async (url) => ({ ok: url === "data/ORION_season_compact.json", json: async () => orion }),
  ProfiledSeasonRuntime: { register: (seasonId, database) => { context.registered = { seasonId, database }; } },
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync("js/season-registry.js", "utf8"), context, { filename: "season-registry.js" });

(async () => {
  const registry = context.SeasonRegistry;
  const seasons = Array.from(registry.list());
  assert.strictEqual(seasons.at(-2).id, "ie2");
  assert.strictEqual(seasons.at(-1).id, "orion");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(registry.get("orion"))), { id: "orion", name: "Inazuma Eleven Orion", displaySeasonNumber: "1", database: "data/ORION_season_compact.json", albumCollectionId: "orion" });
  assert.strictEqual(await registry.loadDatabase("orion"), orion);
  assert.strictEqual(registry.database("orion"), orion);
  assert.strictEqual(context.registered.seasonId, "orion");
  assert.strictEqual(context.registered.database, orion);
  console.log("orion-season-registry-test: registered after Ares and database validation/load OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
