const fs=require("fs");
const c=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8"),v=fs.readFileSync("js/road-to-glory/rtg-economy-view.js","utf8");
if(!/DEVELOPMENT_PLAYER_PAGE_SIZE\s*=\s*24/.test(c)||!/developmentVisibleCount/.test(c)||!/data-rtg-development-load-more/.test(c))throw Error("lazy batches missing");
if(/data-rtg-development-page/.test(c))throw Error("old pages remain");
if(!/width:58px;height:58px/.test(v))throw Error("token sizing missing");
console.log("RTG development focused regression passed");
