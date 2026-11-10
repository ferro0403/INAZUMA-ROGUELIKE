(function(global) {
 "use strict";
 const asId = x => String(x??"");
 const fail = code => {const error=new Error(code);error.code=code;throw error;};
 function apply({account,ledger,recipe,prefix,squadRecord,fallbackSquad,allowedCardIds,recordCard,roleFor,rolesForSlot}) {
   if(!account||!ledger||!recipe||!Array.isArray(recipe.inputs)||recipe.inputs.length!==2||!prefix) fail("miximax-invalid");
   const parents=recipe.inputs.map(asId);
   const child=asId(recipe.resultId);
   if(new Set(parents).size!==2||parents.includes(child)||!/^[0-9]+$/.test(child))fail("miximax-invalid");
   const owned=ledger(account),entries=account.gachaAcquiredCards;
   if(!owned||!Array.isArray(owned.ownedIds)||!Array.isArray(entries))fail("miximax-invalid-account");
   const parentIds=new Set(parents.map(p=>prefix+p)),resultId=prefix+child;
   if(!parents.every(p=>owned.ownedIds.includes(p)) || ![...parentIds].every(id=>entries.some(p=>p.cardId===id)))fail("miximax-parents-missing");
   if(owned.ownedIds.includes(child)||entries.some(p=>p.cardId===resultId))fail("miximax-already-owned");
   const record=recordCard(child);
   if(record?.cardId!==resultId)fail("miximax-invalid-result");
   const remaining=entries.filter(p=>!parentIds.has(asId(p?.cardId))).concat(record);
   const available=Array.from(new Set([...allowedCardIds.filter(id=>!parentIds.has(asId(id))),resultId].map(asId)));
   const allowed=new Set(available);
   const base=squadRecord&&typeof squadRecord==="object"?squadRecord:fallbackSquad;
   if(!base)fail("miximax-squad-missing");
   const active=[1,2,3].includes(Number(base.activeSquadSlot))?String(base.activeSquadSlot):"1";
   const original=base.slots||{"1":base,"2":base,"3":base};
   const nextSlots={};
   for(const slot of ["1","2","3"]){
     const previous=original[slot]||fallbackSquad;
     if(!previous||!Array.isArray(previous.lineup)||previous.lineup.length!==11||!Array.isArray(previous.bench)||previous.bench.length!==4)fail("miximax-squad-invalid");
     const used=new Set();let placed=false;
     const consume=id=>{
       if(parentIds.has(id)){if(!placed){placed=true;used.add(resultId);return resultId;}return null;}
       if(!allowed.has(id)||used.has(id))return null;
       used.add(id);return id;
     };
     const lineup=previous.lineup.map(id=>consume(asId(id)));
     const bench=previous.bench.map(id=>consume(asId(id)));
     const pick=role=>{
       const candidate=available.find(id=>!used.has(id)&&roleFor(id)===role)||available.find(id=>!used.has(id));
       if(!candidate)fail("miximax-squad-insufficient");
       used.add(candidate);return candidate;
     };
     const tacticalRoles=typeof rolesForSlot==="function"?rolesForSlot(previous.formationId):[];
     for(let i=0;i<lineup.length;i++)if(!lineup[i])lineup[i]=pick(tacticalRoles[i]||"");
     for(let i=0;i<bench.length;i++)if(!bench[i])bench[i]=pick("");
     if(new Set([...lineup,...bench]).size!==15)fail("miximax-squad-invalid");
     const roles={...(previous.activeRoleVariantByCardId||{})};
     for(const id of parentIds)delete roles[id];
     nextSlots[slot]={...previous,lineup,bench,lineupOrderedBySlot:true,
       activeRoleVariantByCardId:roles,coachPowerSelection:placed?null:previous.coachPowerSelection};
   }
   owned.ownedIds=owned.ownedIds.filter(p=>!parents.includes(p)).concat(child);
   account.gachaAcquiredCards=remaining;
   return {squad:{...base,...nextSlots[active],activeSquadSlot:Number(active),slots:nextSlots},resultId};
 }
 global.VentoFuocoMiximax=Object.freeze({apply});
})(globalThis);
