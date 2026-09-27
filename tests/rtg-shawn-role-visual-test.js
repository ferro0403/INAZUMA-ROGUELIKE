const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/match-ui-cleanup.css', 'utf8');
const FW = 'https://dxi4wb638ujep.cloudfront.net/1/k/v/t/vtvoof1qo6m_r0.webp';
const OLD_1162_FW = 'wk5ezxf-7dm.png';

assert(css.includes(`.rtg-duel-render > img[src*="${OLD_1162_FW}"]`), 'duel override must target only the old 1162 FW render source');
assert(css.includes(`.rtg-match-ticker img[src*="${OLD_1162_FW}"]`), 'ticker override must target only the old 1162 FW render source');
assert(css.includes(`content: url("${FW}")`), '1162 FW must use the supplied portrait');
assert(!css.includes('img[alt="Shawn Froste"]'), 'must not target Shawn by name: that would also modify 1166 and the 1162 DF variant');
assert(css.includes('transform: scale(1.72)'), 'only the supplied 1162 FW portrait must receive its dedicated duel zoom');
assert(!css.includes('data-player-id="1166"'), '1166 Raimon must not be overridden');

console.log('rtg-shawn-role-visual-test: ok');
