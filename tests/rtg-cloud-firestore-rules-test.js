'use strict';

// Static guards: node tests/rtg-cloud-firestore-rules-test.js
// Behavioral rules (local emulator only):
// NODE_PATH=/path/to/scratch/node_modules FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//   node tests/rtg-cloud-firestore-rules-test.js --require-emulator
// Dependencies: @firebase/rules-unit-testing@4.0.1 and firebase@11.10.0.
// Use a scratch Firebase config pointing at firestore.rules; no Firebase login.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, describe, before, beforeEach, after } = require('node:test');
const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');

test('static: RTG is permitted as a permanent sector', () => {
  const allowed = rules.split('function allowedSector(name)')[1].split('\n    function ')[0];
  assert.match(allowed, /'rtg'/);
  const runs = rules.split('function isRunSector(name)')[1].split('function allowedSector(name)')[0];
  assert.doesNotMatch(runs, /'rtg'/);
});

test('static: published RTG checks existence and every required envelope field', () => {
  const declaration = rules.split('function validRtgDeclaration(m)')[1].split('\n    function ')[0];
  for (const proof of ['m.schemaVersion == 1', 'm.sectorRevisions.rtg == m.revision', 'm.sectorHashes.rtg is string']) {
    assert.ok(declaration.includes(proof), proof);
  }
  const staged = rules.split('function stagedRtgMatches(uid, m)')[1].split('\n    function ')[0];
  for (const proof of [
    'users/$(uid)/saveCommits/$(m.cloudCommitId)/sectors/rtg',
    'getAfter(sectorPath)', 'existsAfter(sectorPath)', "staged.data.sector == 'rtg'",
    'staged.data.schemaVersion == 1', 'staged.data.revision == m.sectorRevisions.rtg',
    'staged.data.payloadHash == m.sectorHashes.rtg', 'staged.data.cloudCommitId == m.cloudCommitId'
  ]) assert.ok(staged.includes(proof), proof);
  const published = rules.split('function validPublishedRtg(uid, m)')[1].split('\n    function ')[0];
  assert.match(published, /validRtgDeclaration\(m\) && stagedRtgMatches\(uid, m\)/);
  const metadata = rules.split('match /saveCommits/{commitId}/metadata/{documentId}')[1].split('\n      match /')[0];
  assert.match(metadata, /validRtgDeclaration\(request.resource.data\)/);
});

test('static: both active manifest write paths validate the published RTG bundle', () => {
  const active = rules.split('match /cloudSave/{documentId}')[1].split('match /saveSectors/')[0];
  assert.match(active, /allow create:[\s\S]*?validPublishedRtg\(uid, request.resource.data\)/);
  assert.match(active, /allow update:[\s\S]*?validManifestUpdate\(uid\)/);
  const update = rules.split('function validManifestUpdate(uid)')[1].split('match /users/{uid}')[0];
  assert.match(update, /validPublishedRtg\(uid, fresh\)/);
  assert.match(update, /!hasRtg\(old\) \|\| hasRtg\(fresh\)/);
});

test('static: immutable staging and owner checks remain present', () => {
  for (const collection of ['metadata/{documentId}', 'sectors/{sectorId}', 'hallOfFame/{hallTeamId}']) {
    const block = rules.split(`match /saveCommits/{commitId}/${collection}`)[1].split('\n      match /')[0];
    assert.match(block, /allow read: if isOwner\(uid\)/);
    assert.match(block, /allow create: if isOwner\(uid\)/);
    assert.match(block, /allow update, delete: if false/);
  }
});

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (process.argv.includes('--require-emulator') && !host) {
  test('behavioral rules require FIRESTORE_EMULATOR_HOST', () => {
    assert.fail('No local Firestore emulator configured; behavioral rules were NOT tested.');
  });
}
if (host && !/^(127\.0\.0\.1|localhost):[1-9][0-9]{0,4}$/.test(host)) {
  throw new Error('Refusing non-local Firestore emulator host');
}

describe('Firestore emulator: RTG immutable bundles', { skip: !host && 'Behavioral rules NOT tested: set FIRESTORE_EMULATOR_HOST', timeout: 120000 }, () => {
  let env, api, assertSucceeds, assertFails;
  const uid = 'rtg-owner';
  const permanent = ['profile', 'album', 'development', 'hall_index'];
  const runs = ['run_ie1', 'run_ie2', 'run_ie1_s2', 'run_ie1_s3', 'run_orion'];
  const hash = 'a'.repeat(64);
  const activePath = `users/${uid}/cloudSave/manifest`;
  const sectorPath = commit => `users/${uid}/saveCommits/${commit}/sectors/rtg`;
  const metadataPath = commit => `users/${uid}/saveCommits/${commit}/metadata/manifest`;
  const owner = () => env.authenticatedContext(uid).firestore();
  const ref = (db, target) => api.doc(db, target);
  const write = (db, target, value) => api.setDoc(ref(db, target), value);
  const fixedTime = () => api.Timestamp.fromMillis(1700000000000);

  function manifest(revision = 1, rtg = false, includeRuns = false) {
    const names = [...permanent, ...(includeRuns ? runs : []), ...(rtg ? ['rtg'] : [])];
    return {
      schemaVersion: 1, accountUid: uid, revision, baseRevision: revision - 1,
      cloudCommitId: `commit-${revision}`, initialized: true, source: 'local-first-association',
      createdAt: fixedTime(), updatedAt: api.serverTimestamp(),
      sectors: { profile: true, album: true, development: true, hallOfFameCount: 0, ...(rtg ? { rtg: true } : {}) },
      sectorHashes: Object.fromEntries(names.map(name => [name, hash])),
      sectorRevisions: Object.fromEntries(names.map(name => [name, revision])),
      hallTeamIds: [], hallTeamHashes: {}, hallTeamRevisions: {}
    };
  }

  function sector(revision = 1, overrides = {}) {
    return {
      sector: 'rtg', schemaVersion: 1, revision, targetRevision: revision,
      baseRevision: revision - 1, cloudCommitId: `commit-${revision}`,
      payloadHash: hash, payload: { version: 1, campaigns: {} },
      updatedAt: api.serverTimestamp(), ...overrides
    };
  }

  async function seed(entries) {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const batch = api.writeBatch(db);
      for (const [target, value] of entries) batch.set(ref(db, target), value);
      await batch.commit();
    });
  }

  before(async () => {
    const testing = require('@firebase/rules-unit-testing');
    ({ assertSucceeds, assertFails } = testing);
    api = require('firebase/firestore');
    api.setLogLevel('silent');
    const [hostname, port] = host.split(':');
    env = await testing.initializeTestEnvironment({
      projectId: `demo-rtg-rules-${process.pid}`,
      firestore: { host: hostname, port: Number(port), rules }
    });
  });
  beforeEach(async () => env.clearFirestore());
  after(async () => { if (env) await env.cleanup(); });

  test('legacy four-sector manifest can be created without RTG', async () => {
    await assertSucceeds(write(owner(), activePath, { ...manifest(), createdAt: api.serverTimestamp() }));
  });

  test('legacy four-sector manifest can advance without missing run revision keys', async () => {
    await seed([[activePath, manifest()]]);
    await assertSucceeds(write(owner(), activePath, manifest(2)));
  });

  test('legacy manifest without a sectors map remains compatible', async () => {
    const old = manifest(); delete old.sectors;
    await seed([[activePath, old]]);
    await assertSucceeds(write(owner(), activePath, manifest(2)));
  });

  test('owner can stage RTG metadata before the sector and publish the first bundle', async () => {
    const db = owner(), m = { ...manifest(1, true), createdAt: api.serverTimestamp() };
    await assertSucceeds(write(db, metadataPath(m.cloudCommitId), m));
    await assertSucceeds(write(db, sectorPath(m.cloudCommitId), sector()));
    await assertSucceeds(write(db, activePath, m));
    assert.equal((await api.getDoc(ref(db, activePath))).data().sectors.rtg, true);
  });

  test('owner can introduce RTG on a legacy four-sector account', async () => {
    await seed([[activePath, manifest()]]);
    const db = owner(), m = manifest(2, true);
    await assertSucceeds(write(db, sectorPath(m.cloudCommitId), sector(2)));
    await assertSucceeds(write(db, activePath, m));
  });

  test('owner can advance an RTG bundle with a new immutable sector', async () => {
    await seed([[activePath, manifest(1, true)], [sectorPath('commit-1'), sector()]]);
    const db = owner();
    await assertSucceeds(write(db, sectorPath('commit-2'), sector(2)));
    await assertSucceeds(write(db, activePath, manifest(2, true)));
  });

  test('atomic staging and first publication use the document after the batch', async () => {
    const db = owner(), batch = api.writeBatch(db);
    batch.set(ref(db, sectorPath('commit-1')), sector());
    batch.set(ref(db, activePath), { ...manifest(1, true), createdAt: api.serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  // Seed malformed documents only to isolate publication checks from staging checks.
  // Including legacy run keys here makes the RED denials independent of the known
  // four-sector compatibility bug above.
  const badDocuments = [
    ['missing staged document', null],
    ['wrong sector name', { sector: 'profile' }],
    ['wrong document schema', { schemaVersion: 2 }],
    ['wrong document revision', { revision: 9 }],
    ['wrong document hash', { payloadHash: 'b'.repeat(64) }],
    ['wrong document commit', { cloudCommitId: 'different-commit' }]
  ];
  const badManifests = [
    ['missing commit id', m => { delete m.cloudCommitId; }],
    ['null commit id', m => { m.cloudCommitId = null; }],
    ['wrong manifest schema', m => { m.schemaVersion = 2; }],
    ['missing RTG revision', m => { delete m.sectorRevisions.rtg; }],
    ['RTG revision differs from bundle', m => { m.sectorRevisions.rtg = 9; }],
    ['missing RTG hash', m => { delete m.sectorHashes.rtg; }],
    ['null RTG hash', m => { m.sectorHashes.rtg = null; }]
  ];

  for (const mode of ['create', 'update']) {
    test(`${mode} rejects matching RTG document and sector revision from a different bundle revision`, async () => {
      const revision = mode === 'create' ? 1 : 2;
      const m = manifest(revision, true, true);
      m.sectorRevisions.rtg = 7;
      const entries = [[sectorPath(m.cloudCommitId), sector(7, { cloudCommitId: m.cloudCommitId })]];
      if (mode === 'update') entries.push([activePath, manifest(1, false, true)]);
      else m.createdAt = api.serverTimestamp();
      await seed(entries);
      await assertFails(write(owner(), activePath, m));
    });

    for (const [name, overrides] of badDocuments) {
      test(`${mode} rejects ${name}`, async () => {
        const revision = mode === 'create' ? 1 : 2;
        const m = manifest(revision, true, true);
        const entries = [];
        if (mode === 'update') entries.push([activePath, manifest(1, false, true)]);
        else m.createdAt = api.serverTimestamp();
        if (overrides) entries.push([sectorPath(m.cloudCommitId), sector(revision, overrides)]);
        await seed(entries);
        await assertFails(write(owner(), activePath, m));
      });
    }
    for (const [name, mutate] of badManifests) {
      test(`${mode} rejects ${name}`, async () => {
        const revision = mode === 'create' ? 1 : 2;
        const m = manifest(revision, true, true);
        const entries = [[sectorPath(m.cloudCommitId), sector(revision)]];
        if (mode === 'update') entries.push([activePath, manifest(1, false, true)]);
        else m.createdAt = api.serverTimestamp();
        mutate(m);
        await seed(entries);
        await assertFails(write(owner(), activePath, m));
      });
    }
  }

  for (const omission of ['absent', 'false', 'missing sectors map']) {
    test(`RTG account cannot drop RTG: ${omission}`, async () => {
      await seed([[activePath, manifest(1, true, true)]]);
      const fresh = manifest(2, false, true);
      if (omission === 'false') fresh.sectors.rtg = false;
      if (omission === 'missing sectors map') delete fresh.sectors;
      await assertFails(write(owner(), activePath, fresh));
    });
  }

  test('old client preserving RTG metadata cannot skip staging RTG in the next bundle', async () => {
    const old = manifest(1, true, true), fresh = manifest(2, true, true);
    fresh.sectorRevisions.rtg = 1;
    await seed([[activePath, old], [sectorPath('commit-1'), sector()]]);
    await assertFails(write(owner(), activePath, fresh));
  });

  test('existing RTG account cannot publish a fresh RTG revision without its document', async () => {
    await seed([[activePath, manifest(1, true, true)], [sectorPath('commit-1'), sector()]]);
    await assertFails(write(owner(), activePath, manifest(2, true, true)));
  });

  test('carried RTG payload is accepted when restaged at the new bundle revision', async () => {
    await seed([[activePath, manifest(1, true)], [sectorPath('commit-1'), sector()]]);
    await assertSucceeds(write(owner(), sectorPath('commit-2'), sector(2)));
    await assertSucceeds(write(owner(), activePath, manifest(2, true)));
  });

  test('RTG document in another commit does not satisfy publication', async () => {
    await seed([[sectorPath('other-commit'), sector()]]);
    await assertFails(write(owner(), activePath, { ...manifest(1, true), createdAt: api.serverTimestamp() }));
  });

  test('RTG document in another account does not satisfy publication', async () => {
    await seed([[sectorPath('commit-1').replace(uid, 'someone-else'), sector()]]);
    await assertFails(write(owner(), activePath, { ...manifest(1, true), createdAt: api.serverTimestamp() }));
  });

  for (const identity of ['other-account', null]) {
    test(`${identity || 'unauthenticated'} cannot read, stage, or publish owner data`, async () => {
      const db = identity ? env.authenticatedContext(identity).firestore() : env.unauthenticatedContext().firestore();
      const m = manifest(1, true, true);
      await seed([[sectorPath('commit-1'), sector()], [sectorPath('commit-2'), sector(2)], [metadataPath('commit-1'), m]]);
      await assertFails(write(db, activePath, { ...m, createdAt: api.serverTimestamp() }));
      await seed([[activePath, m]]);
      for (const target of [activePath, sectorPath('commit-1'), metadataPath('commit-1')]) {
        await assertFails(api.getDoc(ref(db, target)));
        await assertFails(api.deleteDoc(ref(db, target)));
      }
      await assertFails(write(db, activePath, manifest(2, true, true)));
      await assertFails(write(db, sectorPath('commit-3'), sector(3)));
      await assertFails(write(db, metadataPath('commit-3'), manifest(3, true)));
    });
  }

  test('owner can read staged RTG and metadata but cannot mutate or delete either', async () => {
    const db = owner(), m = manifest(1, true);
    await assertSucceeds(write(db, metadataPath('commit-1'), m));
    await assertSucceeds(write(db, sectorPath('commit-1'), sector()));
    for (const [target, value] of [[sectorPath('commit-1'), sector()], [metadataPath('commit-1'), m]]) {
      await assertSucceeds(api.getDoc(ref(db, target)));
      await assertFails(write(db, target, value));
      await assertFails(api.deleteDoc(ref(db, target)));
    }
  });

  test('owner cannot delete a published RTG manifest', async () => {
    await seed([[activePath, manifest(1, true)]]);
    await assertFails(api.deleteDoc(ref(owner(), activePath)));
  });

  for (const [name, overrides] of [
    ['wrong commit', { cloudCommitId: 'other' }],
    ['wrong sector', { sector: 'album' }],
    ['wrong schema', { schemaVersion: 2 }],
    ['wrong revision', { revision: 2 }],
    ['wrong base revision', { baseRevision: 4 }],
    ['null payload', { payload: null }],
    ['null hash', { payloadHash: null }]
  ]) {
    test(`staging RTG rejects ${name}`, async () => {
      await assertFails(write(owner(), sectorPath('commit-1'), sector(1, overrides)));
    });
  }

  for (const [name, mutate] of badManifests.filter(([name]) => /RTG/.test(name))) {
    test(`staging manifest rejects ${name}`, async () => {
      const m = manifest(1, true); mutate(m);
      await assertFails(write(owner(), metadataPath('commit-1'), m));
    });
  }

  test('RTG does not become a run sector with a nullable payload and hash', async () => {
    await assertFails(write(owner(), sectorPath('commit-1'), sector(1, { payload: null, payloadHash: null })));
    // Existing legacy run staging remains unchanged; no active run behavior added.
    for (const run of runs) {
      const target = sectorPath('commit-1').replace(/rtg$/, run);
      await assertSucceeds(write(owner(), target, sector(1, { sector: run, payload: null, payloadHash: null })));
    }
  });

  test('legacy present run revision must retain the existing revision step rules', async () => {
    await seed([[activePath, manifest(1, false, true)]]);
    const fresh = manifest(2, false, true); fresh.sectorRevisions.run_ie1 = 9;
    await assertFails(write(owner(), activePath, fresh));
    delete fresh.sectorRevisions.run_ie1;
    await assertFails(write(owner(), activePath, fresh));
    fresh.sectorRevisions.run_ie1 = 1;
    await assertSucceeds(write(owner(), activePath, fresh));
  });
});
