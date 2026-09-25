const fs=require('fs');
const controller=fs.readFileSync('js/road-to-glory/rtg-controller.js','utf8');
const view=fs.readFileSync('js/road-to-glory/rtg-economy-view.js','utf8');
if(!/DEVELOPMENT_PLAYER_PAGE_SIZE\s*=\s*24/.test(controller))throw new Error('RTG development player page must be limited to 24');
if(!/developmentPage/.test(controller))throw new Error('RTG development player pagination state missing');
if(!/data-rtg-development-page/.test(controller+view))throw new Error('RTG development pagination controls missing');
if(!/rtgTokenIcon/.test(view))throw new Error('RTG token icon helper missing');
console.log('rtg development pagination/icon regression passed');
