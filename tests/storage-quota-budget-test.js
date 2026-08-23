const assert=require('assert');const BudgetStorage=require('./helpers/budget-storage');
for(let q=0;q<=8;q++){const s=new BudgetStorage(80,{canonical:'old'});const before=s.getItem('canonical');assert.throws(()=>s.setItem(`stage-${q}`,'x'.repeat(100)),e=>e.name==='QuotaExceededError');assert.equal(s.getItem('canonical'),before);}
console.log('storage quota budget Q0-Q8: ok');
