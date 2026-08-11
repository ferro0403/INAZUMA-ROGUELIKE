'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const sandbox = { console, Date, Math, JSON, localStorage: new MemoryStorage(), dispatchEvent() {}, CustomEvent: class {}, SeasonRegistry: { activeId: () => 'ie1', normalizeSeasonId: id => id || 'ie1', team: (id, season) => id === 'zeus' && season === 'ie1' ? { teamId: id, logoUrl: 'https://cdn.example/zeus.webp' } : null, list: () => [{ id: 'ie1' }] } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const file of ['season1-config.js', 'team-emblems.js', 'run-state.js']) vm.runInContext(fs.readFileSync(`js/${file}`, 'utf8'), sandbox, { filename: file });

assert.deepStrictEqual(JSON.parse(JSON.stringify(sandbox.RunState.normalizeTeamIdentity({ name: 'ferro', logo: 'inazuma-lightning' }))), { name: 'ferro', emblemId: 'default-lightning' });
assert.strictEqual(sandbox.RunState.normalizeTeamIdentity({ name: 'ferro' }).emblemId, 'default-lightning');
assert.strictEqual(sandbox.RunState.normalizeTeamIdentity({ name: 'ferro', emblemId: 'free-agents' }).emblemId, 'free-agents');

const free = sandbox.TeamEmblems.resolveTeamEmblem({ specialType: 'free-agents' });
assert.strictEqual(free.src, 'assets/emblems/free-agents.svg');
const zeus = sandbox.TeamEmblems.resolveTeamEmblem({ teamId: 'zeus', seasonId: 'ie1' });
assert.strictEqual(zeus.src, 'https://cdn.example/zeus.webp');
assert.strictEqual(zeus.fallbackSrc, 'assets/emblems/neutral-team.svg');
const equippedZeus = sandbox.TeamEmblems.resolveTeamEmblem({ teamIdentity: { emblemId: 'team:ie1:zeus' } });
assert.strictEqual(equippedZeus.src, zeus.src);
const image = { dataset: { emblemFallback: zeus.fallbackSrc }, src: zeus.src };
sandbox.TeamEmblems.handleImageError(image);
assert.strictEqual(image.src, 'assets/emblems/neutral-team.svg');

sandbox.RunState.saveProfileTeamIdentity({ name: 'ferro', emblemId: 'free-agents' });
assert.strictEqual(sandbox.RunState.loadProfile().teamIdentity.emblemId, 'free-agents');
const run = sandbox.RunState.createRun({ name: 'ferro', emblemId: 'free-agents' }, 'ie1');
sandbox.RunState.createCheckpoint(run);
assert.strictEqual(run.checkpoint.teamIdentity.emblemId, 'free-agents');
assert.strictEqual(sandbox.RunState.load('ie1').teamIdentity.emblemId, 'free-agents');
assert.strictEqual(sandbox.RunState.load('ie1').checkpoint.teamIdentity.emblemId, 'free-agents');

const app = fs.readFileSync('js/app.js', 'utf8');
const banner = app.slice(app.indexOf('<div class="five-match-vs">'), app.indexOf('</section>', app.indexOf('<div class="five-match-vs">')));
assert(!banner.includes('⚡') && !banner.includes('⚽'), '5v5 banner must not contain hardcoded crest emoji');
assert(banner.includes('userEmblemMarkup') && banner.includes('opponentEmblemMarkup'));
const css = fs.readFileSync('css/five-match-reference-polish.css', 'utf8');
assert(!/five-match-team strong[^}]*text-overflow:\s*ellipsis/s.test(css));
assert(css.includes('object-fit: contain'));
for (const asset of ['default-lightning.svg', 'free-agents.svg', 'neutral-team.svg']) assert(fs.existsSync(`assets/emblems/${asset}`));
console.log('team-emblems-test: migration, persistence, resolver, fallback and 5v5 renderer OK');
