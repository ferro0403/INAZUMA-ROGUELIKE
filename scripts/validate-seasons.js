#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const context = { console, globalThis: {}, window: {}, location: { hostname: 'localhost', search: '' } };
context.globalThis = context;
context.window = context;
vm.createContext(context);
['js/season1-config.js','js/season-registry.js','js/roguelike_progression.js','js/match-simulator-config.js','js/match-simulator.js','js/run-state.js'].forEach((file) => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));
const ie1 = JSON.parse(fs.readFileSync('data/IE1_season_compact.json', 'utf8'));
const ie2 = JSON.parse(fs.readFileSync('data/IE2_season_compact.json', 'utf8'));
const expectedBosses = ['Rampart','Kirkwood','Everytown','Royal Academy','Alpine','Polestar Academy','Zeus Ares','Alia Academy','Lunar Prime','Raimon','Barcelona Orb'];
expectedBosses.forEach((name, index) => {
  if (ie2.bossOrder?.[index]?.teamName !== name) throw new Error(`IE2 boss ${index + 1} should be ${name}`);
});
['5-3-2','2-4-4','3-3-4'].forEach((formationId) => {
  if (!ie2.formations.eleven.some((formation) => formation.id === formationId)) throw new Error(`IE2 formation missing: ${formationId}`);
  if (!context.MatchSimulator.formationTactic(formationId).id) throw new Error(`Tactic missing: ${formationId}`);
});
const overlap = ie2.players.find((player) => ie1.players.some((candidate) => String(candidate.playerId) === String(player.playerId) && Number(candidate.finalOverall) !== Number(player.finalOverall)));
if (!overlap) throw new Error('Expected at least one overlapping playerId with different profile');
const ie1Player = ie1.players.find((player) => String(player.playerId) === String(overlap.playerId));
const ie1Profile = context.InazumaProgression.getPlayerAtLevel(ie1Player, 20, ie1);
const ie2Profile = context.InazumaProgression.getPlayerAtLevel(overlap, 20, ie2);
if (ie1Profile.overall === ie2Profile.overall) throw new Error(`Overlapping player ${overlap.playerId} resolved to same overall`);
const memory = new Map();
context.localStorage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, String(value)), removeItem: (key) => memory.delete(key) };
const run1 = context.RunState.createRun({ name: 'Validation', logo: 'inazuma-lightning' }, 'ie1');
const run2 = context.RunState.createRun({ name: 'Validation', logo: 'inazuma-lightning' }, 'ie2');
context.RunState.save(run1);
context.RunState.save(run2);
if (context.RunState.load('ie1')?.seasonId !== 'ie1') throw new Error('IE1 save did not round-trip');
if (context.RunState.load('ie2')?.seasonId !== 'ie2') throw new Error('IE2 save did not round-trip');
memory.set(context.SEASON1_CONFIG.saveKey, JSON.stringify({ version: 2, runId: 'legacy', phase: 'formation', lives: 3, bossIndex: 0, roster: [], lineup: [], bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], activeMatch: null, currentZone: null, postBossFlow: null }));
if (context.RunState.load('ie1')?.seasonId !== 'ie1') throw new Error('Legacy save without seasonId should load as IE1');
console.log(`Validated IE2 bosses, new formations, separated saves, and player ${overlap.playerId}: IE1 ${ie1Profile.overall} vs IE2 ${ie2Profile.overall}.`);
