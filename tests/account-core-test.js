'use strict';
const assert = require('assert');
const core = require('../js/account-core.js');

assert.strictEqual(core.normalizeUsername('  Ale_Inazuma  '), 'ale_inazuma');
assert.strictEqual(core.normalizeUsername('ALE_03'), core.normalizeUsername('ale_03'));
assert.strictEqual(core.validateUsername('Ale_03').valid, true);
for (const username of ['ab', 'abcdefghijklmnopq', 'Ale 03', 'Alè03', 'Ale-03', '3Ale']) {
  assert.strictEqual(core.validateUsername(username).valid, false, `${username} must be rejected`);
}
assert.strictEqual(core.validateRegistration({ username: 'Ale_03', email: 'a@b.it', password: '12345678', passwordConfirmation: '87654321' }).valid, false);
assert.match(core.formatAuthError({ code: 'auth/email-already-in-use' }), /già associata/);
assert.match(core.formatAuthError({ code: 'account/username-taken' }), /Username già utilizzato/);
assert.match(core.formatAuthError({ code: 'auth/network-request-failed' }), /Connessione/);
console.log('account-core-test: ok');
