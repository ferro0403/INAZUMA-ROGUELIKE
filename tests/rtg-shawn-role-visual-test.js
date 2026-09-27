const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/road-to-glory/rtg-match-view.js', 'utf8');
const context = { console };
context.globalThis = context;
vm.runInNewContext(source, context);

const view = context.RoadToGloryMatchView.create({
  escapeHtml: (value) => String(value ?? ''),
});

const FW = 'https://dxi4wb638ujep.cloudfront.net/1/k/v/t/vtvoof1qo6m_r0.webp';
const DF = 'https://example.test/shawn-df.webp';
const RAIMON_1166 = 'https://example.test/raimon-1166.webp';

function matchWith(player, event) {
  return {
    status: 'active', period: 'first_half', actionIndex: 1, actionTarget: 22,
    score: { user: 0, opponent: 0 }, possession: 'user', fieldZone: 'attack',
    userSquad: { name: 'User', lineup: [player], bench: [] },
    opponentSquad: { name: 'Opp', lineup: [{ cardId: 'opp', playerId: 'opp', name: 'Opp', position: 'DF', overall: 70, portraitUrl: 'opp.webp' }], bench: [] },
    log: [event],
  };
}

const shawnFw = { cardId: 'ie1_s2::1162', playerId: '1162', name: 'Shawn Froste', position: 'FW', overall: 90, frontFullbodyUrl: 'old-3d.webp', portraitUrl: DF };
const fwHtml = view.matchMarkup(matchWith(shawnFw, { minute: 11, kind: 'dribble', actorSide: 'user', actorPlayerId: 'ie1_s2::1162', opponentPlayerId: 'opp', actorWon: true, manual: true, possessionBefore: 'user', possessionAfter: 'user' }));
assert(fwHtml.includes(FW), '1162 FW must use the supplied FW portrait in duel/ticker');
assert(!fwHtml.includes('old-3d.webp'), '1162 FW must not use the old 3D render');

const shawnDf = { cardId: 'ie1_s2::1162', playerId: '1162', name: 'Shawn Froste', position: 'DF', overall: 90, frontFullbodyUrl: DF, portraitUrl: DF };
const dfHtml = view.matchMarkup(matchWith(shawnDf, { minute: 11, kind: 'dribble', actorSide: 'user', actorPlayerId: 'ie1_s2::1162', opponentPlayerId: 'opp', actorWon: true, manual: true, possessionBefore: 'user', possessionAfter: 'user' }));
assert(dfHtml.includes(DF), '1162 DF must keep its DF render');
assert(!dfHtml.includes(FW), '1162 DF must not be replaced by the FW render');

const raimon = { cardId: 'ie1_s2::1166', playerId: '1166', name: 'Shawn Froste', position: 'FW', overall: 90, frontFullbodyUrl: RAIMON_1166, portraitUrl: RAIMON_1166 };
const raimonHtml = view.matchMarkup(matchWith(raimon, { minute: 11, kind: 'dribble', actorSide: 'user', actorPlayerId: 'ie1_s2::1166', opponentPlayerId: 'opp', actorWon: true, manual: true, possessionBefore: 'user', possessionAfter: 'user' }));
assert(raimonHtml.includes(RAIMON_1166), '1166 must keep its own Raimon render');
assert(!raimonHtml.includes(FW), '1166 must never inherit the 1162 FW override');

console.log('rtg-shawn-role-visual-test: ok');
