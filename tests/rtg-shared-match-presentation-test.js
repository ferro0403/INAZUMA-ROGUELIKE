"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-encounter-runtime.js","utf8"),c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),c);

const sharedCard=(player,opts={})=>`<button type="button" class="player-card player-card-compact run-tactical-card match-player-card boss-match-card SHARED-NORMAL-MATCH-CARD side-${opts.side||"user"}"><span class="player-portrait-wrap"><img class="player-portrait" src="${player.portraitUrl||""}" /></span><strong>${player.name}</strong></button>`;
const formationLayout={displayRows:formation=>[
 {role:"FW",count:Number(formation.requirements.FW||0)},
 {role:"MF",count:Number(formation.requirements.MF||0)},
 {role:"DF",count:Number(formation.requirements.DF||0)},
 {role:"GK",count:Number(formation.requirements.GK||0)}
].filter(row=>row.count)};
const formationById=id=>id==="3-5-2"?{id,requirements:{FW:2,MF:5,DF:3,GK:1}}:{id,requirements:{FW:3,MF:3,DF:4,GK:1}};
const view=c.RoadToGloryMatchView.create({escapeHtml:s=>String(s),matchFormationCardMarkup:sharedCard,formationLayout,formationById});
const p=(id,name,role,overall,move=null)=>({playerId:id,name,normalizedRole:role,position:role,overall,portraitUrl:"x.webp",move});
const lineup=[
 p("fw1","Canon Evans","FW",88),p("fw2","Johan Tassman","FW",81),
 p("mf1","Verne Spring","MF",86),p("mf2","Olivia Baker","MF",70),p("mf3","Beat Scatton","MF",70),p("mf4","Dotty Hickman","MF",70),p("mf5","Ben Feuer","MF",70),
 p("df1","Red Dayers","DF",80),p("df2","Al Stringer","DF",74),p("df3","Emma Barres","DF",70),p("gk","Ted Autumn","GK",86)
];
const opp=[
 p("of1","Gary Primo","FW",77),p("of2","Rune Sigil","FW",76),p("of3","Khefren Chepren","FW",76),
 p("om1","Ram Horner","MF",77),p("om2","Carey Bean","MF",76),p("om3","Patch Borgnine","MF",77),
 p("od1","Dirk Byker","DF",76),p("od2","Liddy Gan","DF",76),p("od3","Kath Leaflin","DF",76),p("od4","Hans Frees","DF",76),p("og","Les Knightley","GK",76)
];
const match={period:"second_half",status:"active",score:{user:1,opponent:1},possession:"opponent",fieldZone:"midfield",userSquad:{formationId:"3-5-2",lineup,bench:[]},opponentSquad:{name:"Svincolati",formationId:"4-3-3",lineup:opp,bench:[]},moveUsesByPlayerId:{},log:[]};

const prematch=view.preMatchMarkup(match);
assert.strictEqual((prematch.match(/SHARED-NORMAL-MATCH-CARD/g)||[]).length,22);
assert.match(prematch,/boss-match-line[^"]*" data-row-count="5"/);
assert.doesNotMatch(prematch,/rtg-prematch-player-card/);

const live=view.matchMarkup(match);
assert.strictEqual((live.match(/SHARED-NORMAL-MATCH-CARD/g)||[]).length,22);
assert.match(live,/boss-match-line[^"]*" data-row-count="5"/);
assert.doesNotMatch(live,/rtg-live-player-card/);
assert.match(live,/development-squad-card-scope/);

const duelMatch={...match,pendingEncounter:{encounterId:"e1",minute:55,kind:"midfield",actorSide:"opponent",opponentSide:"user",actorPlayerId:"om1",opponentPlayerId:"mf1",userSide:"user",userPlayerId:"mf1",aiPlayerId:"om1",userKind:"midfield",aiKind:"midfield",userBaseActionLabel:"Contrasta",normalPreviewProbability:68.8}};
const duel=view.encounterMarkup(duelMatch,{userPlayer:lineup[2],opponentPlayer:opp[3]});
assert.match(duel,/Verne Spring contrasta/i);
assert.match(duel,/Ram Horner prova a conquistare (?:palla|il possesso)/i);
assert.doesNotMatch(duel,/attacca il possesso/i);
assert.match(duel,/rtg-duel-versus-board/);
assert.match(duel,/rtg-duel-portrait-panel--user/);
assert.match(duel,/rtg-duel-portrait-panel--opponent/);
assert.match(duel,/rtg-duel-vs-core/);
assert.doesNotMatch(duel,/rtg-duel-stage--revolution/);

const bench=[p("b1","Jerry Bates","FW",70),p("b2","Syon Blaze","FW",85),p("b3","Tom Skipper","FW",85),p("b4","Rob Cardson","DF",85)];
const half=view.halftimeMarkup({formationId:"3-5-2",lineup,bench},{match});
assert.match(half,/rtg-halftime-revolution/);
assert.match(half,/boss-match-line[^"]*" data-row-count="5"/);
assert.doesNotMatch(half,/Controlla il campo\. Tocca un titolare/i);
assert.doesNotMatch(half,/rtg-halftime-change-box/);
assert.match(half,/CAMBIO RUOLO PER RUOLO/i);

const app=fs.readFileSync("js/app.js","utf8");
assert.match(app,/matchFormationCardMarkup:\s*\(\.\.\.args\)\s*=>\s*matchPresentation\.matchFormationCard\(\.\.\.args\)/);

console.log("rtg-shared-match-presentation-test: PASS");
