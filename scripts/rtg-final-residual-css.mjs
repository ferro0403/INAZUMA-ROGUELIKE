import fs from 'node:fs';
const legacyPath='css/road-to-glory.css';
const legacy=fs.readFileSync(legacyPath,'utf8');
const targets=[
 {path:'css/rtg-squad.css',needles:['.rtg-adapt-button','.rtg-picker-','.rtg-roster-summary','.rtg-squad-card-slot','.rtg-squad-change-trigger','.rtg-squad-section-head','.rtg-catalog-','.rtg-player-catalog']},
 {path:'css/rtg-match.css',needles:['.rtg-ticker-empty','.rtg-halftime','.rtg-matchup-','.rtg-choice-','.rtg-shared-match-card','.rtg-result-modal','.rtg-final-','.rtg-score-']},
 {path:'css/rtg-run.css',needles:['.rtg-map {']}
];
function brace(s,o){let d=1,q=null,c=false;for(let i=o+1;i<s.length;i++){if(c){if(s.startsWith('*/',i)){c=false;i++;}continue;}if(q){if(s[i]==='\\'){i++;continue;}if(s[i]===q)q=null;continue;}if(s.startsWith('/*',i)){c=true;i++;continue;}if(s[i]==='"'||s[i]==="'")q=s[i];else if(s[i]==='{')d++;else if(s[i]==='}'&&--d===0)return i;}throw new Error('Unbalanced CSS braces');}
const moved=new Map(targets.map(t=>[t.path,[]]));
function ownerFor(sel){for(const t of targets)if(t.needles.some(n=>sel.includes(n)))return t.path;return null;}
function clean(s){let out='',pos=0;while(pos<s.length){const o=s.indexOf('{',pos);if(o<0)return out+s.slice(pos);const x=brace(s,o);const start=Math.max(pos,Math.max(s.lastIndexOf('}',o-1),s.lastIndexOf(';',o-1))+1);out+=s.slice(pos,start);const pre=s.slice(start,o),sel=pre.trim(),body=s.slice(o+1,x);if(/^@(media|supports|layer)\b/.test(sel)){const before=new Map([...moved].map(([p,a])=>[p,a.length]));const b=clean(body);let any=false;for(const [p,a] of moved){const n=before.get(p);if(a.length>n){const rules=a.splice(n);a.push(`${pre}{${rules.join('')}}`);any=true;}}if(!any&&b.trim())out+=`${pre}{${b}}`;}else if(sel.startsWith('@'))out+=`${pre}{${body}}`;else{const owner=ownerFor(sel);if(owner)moved.get(owner).push(`${pre}{${body}}`);else out+=`${pre}{${body}}`;}pos=x+1;}return out;}
const cleaned=clean(legacy);
for(const [p,rules] of moved){if(!rules.length)continue;const current=fs.readFileSync(p,'utf8');fs.writeFileSync(p,`${current.trimEnd()}\n\n/* Final ownership migrated from road-to-glory.css. */\n${rules.join('\n')}\n`);console.log(`${p}: +${rules.length} groups`);}
fs.writeFileSync(legacyPath,cleaned);console.log(`${legacyPath}: ${legacy.length} -> ${cleaned.length}`);
