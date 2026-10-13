import fs from 'node:fs';
const sourcePath='css/road-to-glory.css';
const ownerPath='css/rtg-match.css';
const text=fs.readFileSync(sourcePath,'utf8');
const owner=fs.readFileSync(ownerPath,'utf8');
const needles=['.rtg-ticker-event','.rtg-halftime-','.rtg-half-confirm','.rtg-penalty-','.rtg-shootout-score','.rtg-static-field--main','.rtg-field-card','.rtg-field-midline','.rtg-field-team-label','.rtg-probability','.rtg-versus--cards','.rtg-final-probability','.rtg-action-button'];
function brace(s,o){let d=1,q=null,c=false;for(let i=o+1;i<s.length;i++){if(c){if(s.startsWith('*/',i)){c=false;i++;}continue;}if(q){if(s[i]==='\\'){i++;continue;}if(s[i]===q)q=null;continue;}if(s.startsWith('/*',i)){c=true;i++;continue;}if(s[i]==='"'||s[i]==="'")q=s[i];else if(s[i]==='{')d++;else if(s[i]==='}'&&--d===0)return i;}throw new Error('Unbalanced CSS braces');}
const moved=[];
function clean(s){let out='',pos=0;while(pos<s.length){const o=s.indexOf('{',pos);if(o<0)return out+s.slice(pos);const x=brace(s,o);const start=Math.max(pos,Math.max(s.lastIndexOf('}',o-1),s.lastIndexOf(';',o-1))+1);out+=s.slice(pos,start);const pre=s.slice(start,o),sel=pre.trim(),body=s.slice(o+1,x);if(/^@(media|supports|layer)\b/.test(sel)){const before=moved.length;const b=clean(body);if(moved.length>before){const rules=moved.splice(before);moved.push(`${pre}{${rules.join('')}}`);}else if(b.trim())out+=`${pre}{${b}}`;}else if(sel.startsWith('@'))out+=`${pre}{${body}}`;else if(needles.some(n=>sel.includes(n)))moved.push(`${pre}{${body}}`);else out+=`${pre}{${body}}`;pos=x+1;}return out;}
const cleaned=clean(text);
if(moved.length){fs.writeFileSync(ownerPath,`${owner.trimEnd()}\n\n/* Residual match ownership migrated from road-to-glory.css. */\n${moved.join('\n')}\n`);}
fs.writeFileSync(sourcePath,cleaned);
console.log(`moved ${moved.length} residual match rule groups; road-to-glory.css ${text.length} -> ${cleaned.length}`);
