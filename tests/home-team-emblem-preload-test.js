"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("js/home/home-controller.js", "utf8");
const context = { globalThis: null, console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context);

async function testPreload({ active, loaded, identity, expectedLoads }) {
  let activeSeasonId = active;
  const loadCalls = [];
  context.TeamEmblems = {
    parseTeamEmblemId(value) {
      const match = /^team:([^:]+):/.exec(value || "");
      return match ? { seasonId: match[1] } : null;
    },
  };
  context.SeasonRegistry = {
    activeId: () => activeSeasonId,
    setActive: (value) => {
      activeSeasonId = value;
    },
    isSeasonSource: (value) => ["ie1", "ie1_s3"].includes(value),
    database: (value) => (loaded.includes(value) ? {} : null),
    async loadDatabase(value) {
      loadCalls.push(value);
      activeSeasonId = value;
    },
  };

  const controller = context.HomeController.create({});
  await controller.ensureHomeTeamEmblemSeasonLoaded(identity);
  assert.deepEqual(loadCalls, expectedLoads);
  assert.equal(
    activeSeasonId,
    active,
    "the active Season must always be restored",
  );
}

(async () => {
  await testPreload({
    active: "ie1_s3",
    loaded: ["ie1_s3"],
    identity: { emblemId: "team:ie1:raimon" },
    expectedLoads: ["ie1"],
  });
  await testPreload({
    active: "ie1",
    loaded: ["ie1"],
    identity: { emblemId: "team:ie1_s3:inazuma_japan" },
    expectedLoads: ["ie1_s3"],
  });
  await testPreload({
    active: "ie1_s3",
    loaded: ["ie1_s3"],
    identity: { emblemId: "team:ie1_s3:inazuma_japan" },
    expectedLoads: [],
  });
  await testPreload({
    active: "ie1",
    loaded: ["ie1"],
    identity: { emblemId: "default-lightning" },
    expectedLoads: [],
  });
  await testPreload({
    active: "ie1",
    loaded: ["ie1"],
    identity: null,
    expectedLoads: [],
  });
  await testPreload({
    active: "ie1",
    loaded: ["ie1"],
    identity: {},
    expectedLoads: [],
  });
  assert.match(source, /await ensureHomeTeamEmblemSeasonLoaded/);
  console.log(
    "home-team-emblem-preload-test: full preload and active-Season restoration matrix OK",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
