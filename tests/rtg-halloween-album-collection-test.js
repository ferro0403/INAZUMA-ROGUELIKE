const { withLiteralTokens } = require("./helpers/css-tokens");
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const { loadEvents } = require("./helpers/events");

const context={
  RoadToGloryCoaches:{
    catalog:()=>Array.from({length:11},(_,i)=>({id:"coach"+i})),
    owned:()=>new Set(["coach0"])
  },
  RoadToGloryConfig:{season:()=>({})}
};
// Eventi dal file dati (data/events/), come nel gioco.
loadEvents(context);
vm.runInNewContext(fs.readFileSync("js/road-to-glory/rtg-album-view.js","utf8"),context);
const view=context.RoadToGloryAlbumView.create({
  escapeHtml:s=>String(s??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;"),
  seasonNumber:()=>1,teamEmblemMarkup:()=>"",albumRarityClass:()=>"",
  albumCoverUrl:"cover.jpg",albumSeason2CoverUrl:"cover2.jpg"
});
const eighteen=Array.from({length:18},(_,i)=>String(i+1));
const acquired=ids=>ids.map(cardId=>({cardId}));
const render=(ownedIds=[],cardIds=ownedIds.map(id=>"halloween2026::"+id))=>view.albumCollectionMarkup({
  state:{activeSeasonId:"ie1",gachaAcquiredCards:acquired(cardIds)},
  // RTG campaign snapshots do not include the separate halloween.ownedIds projection.
  collections:[{seasonId:"ie1",total:30,unlocked:2}]
});
const halloween=html=>(html.split('data-rtg-album-halloween')[1]||"").split("</button>")[0];
const zero=halloween(render());
assert.match(zero,/0 \/ 18 giocatori sbloccati/);
assert.match(zero,/0%/);
assert.match(zero,/album-collection-progress-bar/);
assert.doesNotMatch(zero,/19 giocatori/,"Secret must not be advertised when locked");
const one=halloween(render(["1"]));
assert.match(one,/1 \/ 18 giocatori sbloccati/);
assert.match(one,/6%/);
assert.match(one,/width:6%/);
const beforeUnlock=halloween(render(eighteen,eighteen.map(id=>"halloween2026::"+id)));
assert.match(beforeUnlock,/18 \/ 18 giocatori sbloccati/);
assert.match(beforeUnlock,/100%/);
assert.doesNotMatch(beforeUnlock,/19 \/ 19/,"No premature 19th slot");
const bonus="halloween2026::custom_0003";
const afterUnlock=halloween(render(eighteen,[...eighteen.map(id=>"halloween2026::"+id),bonus]));
assert.match(afterUnlock,/19 \/ 19 giocatori sbloccati/);
assert.match(afterUnlock,/100%/);
assert.match(afterUnlock,/width:100%/);
const withDuplicate=halloween(render(eighteen,[...eighteen.map(id=>"halloween2026::"+id),bonus,bonus]));
assert.match(withDuplicate,/19 \/ 19/,"No double-counting saved cards or event IDs");
const coachCard=render().split('data-rtg-album-coaches-open')[1].split("</button>")[0];
assert.match(coachCard,/1 \/ 11 allenatori sbloccati/);
assert.match(coachCard,/9%/);
const css=withLiteralTokens(fs.readFileSync("css/rtg-coaches.css","utf8"));
assert.match(css,/\.album-collections-screen \.rtg-coach-album-collection \.album-collection-cover img\s*\{/);
assert.match(css,/transform:\s*scale\(1\.52\)/);
assert.match(css,/transform-origin:\s*50% 78%/);
assert.doesNotMatch(css,/\.rtg-halloween-album-collection \.album-collection-cover img[^}]*scale\(/,
  "Only the coaches cover must be zoomed");
const index=fs.readFileSync("index.html","utf8");
assert.match(index,/rtg-album-view\.js\?v=20261106-modulo-evento-2/);
assert.match(index,/rtg-coaches\.css\?v=20261105-halloween-card-1/);
console.log("RTG album Halloween progression 0/18, 1/18, 18/18, earned 19/19 and coach-only zoom: PASS");
