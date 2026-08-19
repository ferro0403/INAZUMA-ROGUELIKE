'use strict';
const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

function functionSource(name) {
  const start = app.indexOf(`async function ${name}`);
  assert.notStrictEqual(start, -1, `${name} must exist`);
  const bodyStart = app.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === '{') depth += 1;
    if (app[index] === '}') depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const helperSource = functionSource('ensureHomeTeamEmblemSeasonLoaded');
const runHelper = new Function('global', 'identity', `return (${helperSource})(identity);`);

function registryFixture(activeId, loadedIds = []) {
  let activeSeasonId = activeId;
  const loaded = new Set(loadedIds);
  const loadCalls = [];
  const registry = {
    activeId: () => activeSeasonId,
    setActive: (seasonId) => { activeSeasonId = seasonId; },
    isSeasonSource: (seasonId) => ['ie1', 'ie1_s3'].includes(seasonId),
    database: (seasonId) => loaded.has(seasonId) ? { seasonId } : null,
    loadDatabase: async (seasonId) => {
      loadCalls.push(seasonId);
      loaded.add(seasonId);
      activeSeasonId = seasonId;
      return { seasonId };
    },
  };
  return { registry, loadCalls, activeId: () => activeSeasonId };
}

const TeamEmblems = {
  parseTeamEmblemId(emblemId) {
    const match = /^team:([^:]+):(.+)$/.exec(String(emblemId || ''));
    return match ? { seasonId: match[1], teamId: match[2] } : null;
  },
};

async function testPreload({ active, loaded, identity, expectedLoads, expectedActive }) {
  const fixture = registryFixture(active, loaded);
  await runHelper({ TeamEmblems, SeasonRegistry: fixture.registry }, identity);
  assert.deepStrictEqual(fixture.loadCalls, expectedLoads);
  assert.strictEqual(fixture.activeId(), expectedActive);
}

(async () => {
  await testPreload({ active: 'ie1_s3', loaded: ['ie1_s3'], identity: { emblemId: 'team:ie1:raimon' }, expectedLoads: ['ie1'], expectedActive: 'ie1_s3' });
  await testPreload({ active: 'ie1', loaded: ['ie1'], identity: { emblemId: 'team:ie1_s3:inazuma_japan' }, expectedLoads: ['ie1_s3'], expectedActive: 'ie1' });
  await testPreload({ active: 'ie1_s3', loaded: ['ie1_s3'], identity: { emblemId: 'team:ie1_s3:inazuma_japan' }, expectedLoads: [], expectedActive: 'ie1_s3' });
  await testPreload({ active: 'ie1_s3', loaded: ['ie1_s3'], identity: { emblemId: 'default-lightning' }, expectedLoads: [], expectedActive: 'ie1_s3' });
  await testPreload({ active: 'ie1', loaded: ['ie1'], identity: { emblemId: 'team:ie1_s3:inazuma_japan' }, expectedLoads: ['ie1_s3'], expectedActive: 'ie1' });
  await testPreload({ active: 'ie1', loaded: ['ie1'], identity: null, expectedLoads: [], expectedActive: 'ie1' });
  await testPreload({ active: 'ie1', loaded: ['ie1'], identity: {}, expectedLoads: [], expectedActive: 'ie1' });

  assert.match(app, /await ensureHomeTeamEmblemSeasonLoaded\(homeIdentity\);[\s\S]*?app\.innerHTML = `/, 'the emblem database is ready before Home markup is built');
  console.log('home-team-emblem-preload-test: ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
