import fs from 'node:fs';
const legacyPath='css/road-to-glory.css';
const shellPath='css/rtg-shell.css';
const foundationPath='css/rtg-foundation.css';
const legacy=fs.readFileSync(legacyPath,'utf8');
let shell=fs.readFileSync(shellPath,'utf8');
let foundation=fs.readFileSync(foundationPath,'utf8');
const shellNeedles=['.rtg-main-title','.rtg-home-button','.rtg-token-pill','.rtg-main-topbar','.rtg-tabs--main-style','.rtg-bottom-nav.bottom-nav'];
const sharedNeedles=['.modal.rtg-modal','.rtg-paper-modal','.rtg-requirements','.rtg-requirements-list','.rtg-requirement'];
function brace(s,o){let d=1,q=null,c=false;for(let i=o+1;i<s.length;i++){if(c){if(s.startsWith('*/',i)){c=false;i++;}continue;}if(q){if(s[i]==='\\'){i++;continue;}if(s[i]===q)q=null;continue;}if(s.startsWith('/*',i)){c=true;i++;continue;}if(s[i]==='"'||s[i]==="'")q=s[i];else if(s[i]==='{')d++;else if(s[i]==='}'&&--d===0)return i;}throw new Error('Unbalanced CSS braces');}
const shellMoved=[],sharedMoved=[];
function clean(s){let out='',pos=0;while(pos<s.length){const o=s.indexOf('{',pos);if(o<0)return out+s.slice(pos);const x=brace(s,o);const start=Math.max(pos,Math.max(s.lastIndexOf('}',o-1),s.lastIndexOf(';',o-1))+1);out+=s.slice(pos,start);const pre=s.slice(start,o),sel=pre.trim(),body=s.slice(o+1,x);if(/^@(media|supports|layer)\b/.test(sel)){const beforeS=shellMoved.length,beforeF=sharedMoved.length;const b=clean(body);const sm=shellMoved.splice(beforeS),fm=sharedMoved.splice(beforeF);if(sm.length)shellMoved.push(`${pre}{${sm.join('')}}`);if(fm.length)sharedMoved.push(`${pre}{${fm.join('')}}`);if(!sm.length&&!fm.length&&b.trim())out+=`${pre}{${b}}`;}else if(sel.startsWith('@'))out+=`${pre}{${body}}`;else if(shellNeedles.some(n=>sel.includes(n)))shellMoved.push(`${pre}{${body}}`);else if(sharedNeedles.some(n=>sel.includes(n)))sharedMoved.push(`${pre}{${body}}`);else out+=`${pre}{${body}}`;pos=x+1;}return out;}
const cleaned=clean(legacy);
if(shellMoved.length)shell+=`\n\n/* Shell ownership migrated from road-to-glory.css. */\n${shellMoved.join('\n')}\n`;
if(sharedMoved.length)foundation+=`\n\n/* Shared modal/requirements ownership migrated from road-to-glory.css. */\n${sharedMoved.join('\n')}\n`;
fs.writeFileSync(shellPath,shell);fs.writeFileSync(foundationPath,foundation);fs.writeFileSync(legacyPath,cleaned);
console.log(`shell=${shellMoved.length} shared=${sharedMoved.length}; legacy ${legacy.length} -> ${cleaned.length}`);
