import fs from 'node:fs';
const path='css/road-to-glory.css';
const text=fs.readFileSync(path,'utf8');
const needles=['.rtg-development-','.development-requirement','.development-selected','.development-wallet','.rtg-legacy-badge','.player-detail-rtg-legacy-badge','.rtg-pull-player-card','.rtg-shop-'];
function brace(s,o){let d=1,q=null,c=false;for(let i=o+1;i<s.length;i++){if(c){if(s.startsWith('*/',i)){c=false;i++;}continue;}if(q){if(s[i]==='\\'){i++;continue;}if(s[i]===q)q=null;continue;}if(s.startsWith('/*',i)){c=true;i++;continue;}if(s[i]==='"'||s[i]==="'")q=s[i];else if(s[i]==='{')d++;else if(s[i]==='}'&&--d===0)return i;}throw new Error('Unbalanced CSS braces');}
function clean(s){let out='',pos=0;while(pos<s.length){const o=s.indexOf('{',pos);if(o<0)return out+s.slice(pos);const x=brace(s,o);const start=Math.max(pos,Math.max(s.lastIndexOf('}',o-1),s.lastIndexOf(';',o-1))+1);out+=s.slice(pos,start);const pre=s.slice(start,o),sel=pre.trim(),body=s.slice(o+1,x);if(/^@(media|supports|layer)\b/.test(sel)){const b=clean(body);if(b.trim())out+=`${pre}{${b}}`;}else if(sel.startsWith('@'))out+=`${pre}{${body}}`;else if(!needles.some(n=>sel.includes(n)))out+=`${pre}{${body}}`;pos=x+1;}return out;}
const cleaned=clean(text);fs.writeFileSync(path,cleaned);console.log(`road-to-glory.css: ${text.length} -> ${cleaned.length} chars`);
