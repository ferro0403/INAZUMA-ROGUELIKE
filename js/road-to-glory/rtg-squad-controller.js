(function (global) {
  "use strict";

  const SQUAD_PICKER_PAGE_SIZE=24;
  function create(deps={}){
    function draftState(){
      const state=deps.clone(deps.campaign);
      state.squads[deps.activeSeasonId()]=deps.clone(deps.squadDraft||deps.activeSquad(deps.campaign));
      return state;
    }
    function draftRosterIds(){
      return Array.from(new Set([...(deps.squadDraft?.lineup||[]),...(deps.squadDraft?.bench||[])].map(deps.id)));
    }
    function roleOfDraftPlayer(playerId){
      const variant=deps.squadDraft?.activeRoleVariantByCardId?.[deps.id(playerId)]||null;
      const player=deps.resolved(playerId,variant);
      return String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();
    }
    function accessibleDraftIds(){
      return deps.accessibleCards(draftState()).map(deps.id);
    }
    function canUseDraftFormation(formation){
      if(!formation)return false;
      const counts={GK:0,DF:0,MF:0,FW:0};
      for(const playerId of accessibleDraftIds()){
        const role=deps.rawRole(playerId);
        if(Object.prototype.hasOwnProperty.call(counts,role))counts[role]+=1;
      }
      return Object.entries(formation.requirements||{}).every(([role,amount])=>Number(counts[String(role).toUpperCase()]||0)>=Number(amount||0));
    }
    function arrangeDraftForFormation(formation){
      if(!formation||!canUseDraftFormation(formation))return{ok:false,reason:"formation-incompatible"};
      const currentLineup=new Set((deps.squadDraft?.lineup||[]).map(deps.id));
      const currentBench=new Set((deps.squadDraft?.bench||[]).map(deps.id));
      const accessible=accessibleDraftIds().map(playerId=>({
        playerId,
        role:deps.rawRole(playerId),
        overall:deps.rawOverall(playerId),
        priority:currentLineup.has(playerId)?0:currentBench.has(playerId)?1:2,
      })).filter(entry=>["GK","DF","MF","FW"].includes(entry.role));
      accessible.sort((a,b)=>a.priority-b.priority||b.overall-a.overall||deps.rawName(a.playerId).localeCompare(deps.rawName(b.playerId),"it"));
      const slotRoles=Array.isArray(formation.slotRoles)&&formation.slotRoles.length
        ? formation.slotRoles.map(role=>String(role).toUpperCase())
        : Object.entries(formation.requirements||{}).flatMap(([role,amount])=>Array.from({length:Number(amount)||0},()=>String(role).toUpperCase()));
      const used=new Set(),lineup=[];
      for(const role of slotRoles){
        const candidate=accessible.find(entry=>entry.role===role&&!used.has(entry.playerId));
        if(!candidate)return{ok:false,reason:"formation-incompatible"};
        used.add(candidate.playerId);lineup.push(candidate.playerId);
      }
      if(lineup.length!==11)return{ok:false,reason:"formation-invalid-slots"};
      const remaining=accessible.filter(entry=>!used.has(entry.playerId)).sort((a,b)=>{
        const preserveA=currentLineup.has(a.playerId)||currentBench.has(a.playerId)?0:1;
        const preserveB=currentLineup.has(b.playerId)||currentBench.has(b.playerId)?0:1;
        return preserveA-preserveB||b.overall-a.overall||deps.rawName(a.playerId).localeCompare(deps.rawName(b.playerId),"it");
      });
      const bench=remaining.slice(0,4).map(entry=>entry.playerId);
      if(bench.length!==4)return{ok:false,reason:"bench-unavailable"};
      deps.squadDraft={...deps.squadDraft,formationId:deps.id(formation.id),lineup,bench,activeRoleVariantByCardId:{...(deps.squadDraft?.activeRoleVariantByCardId||{})}};
      return{ok:true};
    }
    function openFormationSelector(model){
      const body=`<div class="modal-head squad-formation-modal-head"><div><p class="eyebrow">Assetto tattico RTG</p><h2>Modifica modulo</h2><p class="muted">Scegli il modulo. I giocatori già in rosa hanno la precedenza; i posti mancanti vengono coperti dalla tua collezione.</p></div></div>${deps.squadView.formationOptionsMarkup(model,canUseDraftFormation)}`;
      deps.openModal?.(body,{className:"squad-formation-modal rtg-formation-modal"});
      deps.getModalRoot?.()?.querySelectorAll?.("[data-rtg-formation-option]")?.forEach(button=>button.addEventListener("click",()=>{
        if(button.disabled)return;
        const formation=(model.formations||[]).find(item=>deps.id(item.id)===deps.id(button.dataset.rtgFormationOption));
        const result=arrangeDraftForFormation(formation);
        if(!result.ok){deps.toast?.("Non ci sono abbastanza giocatori sbloccati nei ruoli richiesti","error");return;}
        deps.closeModal?.();
        renderSquad();
      }));
    }
    function squadPickerCandidateIds(targetId,role,{benchTarget=false}={}){
      const accessible=deps.accessibleCards(draftState()).map(deps.id);
      const rosterIds=new Set(draftRosterIds());
      return accessible
        .filter(playerId=>playerId!==deps.id(targetId))
        .filter(playerId=>!benchTarget||!rosterIds.has(playerId))
        .filter(playerId=>!role||deps.rawRole(playerId)===role)
        .sort((a,b)=>deps.rawOverall(b)-deps.rawOverall(a)||deps.rawName(a).localeCompare(deps.rawName(b),"it"));
    }
    function squadPickerRarity(playerId){
      return String(
        deps.playerResolver.rarity?.(playerId,"ie1",deps.freeAgentsDb)
        || deps.rawPlayer(playerId)?.category
        || deps.resolved(playerId,deps.squadDraft?.activeRoleVariantByCardId?.[deps.id(playerId)]||null)?.category
        || ""
      ).trim();
    }
    function squadPickerRarityOptions(){
      return ["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"];
    }

    const SQUAD_FILTER_SEASON_LABELS=Object.freeze({ie1:"Season 1",ie1_s2:"Season 2",ie1_s3:"Season 3",ie2:"Ares",orion:"Orion"});
    function squadFilterSeasonIds(){
      return Array.from(deps.config?.SEASON_IDS||[]).map(deps.id).filter(Boolean);
    }
    function squadFilterSeasonLabel(seasonId){
      const sid=deps.id(seasonId);
      return SQUAD_FILTER_SEASON_LABELS[sid]||global.SeasonRegistry?.get?.(sid)?.name||sid.toUpperCase();
    }
    function squadFilterSeasonShortLabel(seasonId){
      return ({ie1:"S1",ie1_s2:"S2",ie1_s3:"S3",ie2:"AR",orion:"OR"})[deps.id(seasonId)]||squadFilterSeasonLabel(seasonId);
    }
    function squadFilterSeasonOptions(){
      return [{value:"all",label:"Tutte"},...squadFilterSeasonIds().map(seasonId=>({value:seasonId,label:squadFilterSeasonLabel(seasonId)}))];
    }
    let squadFilterDataPromise=null;
    function ensureSquadFilterSeasonData(){
      if(squadFilterDataPromise)return squadFilterDataPromise;
      const registry=global.SeasonRegistry;
      const previous=registry?.activeId?.();
      squadFilterDataPromise=(async()=>{
        for(const seasonId of squadFilterSeasonIds()){
          if(registry?.database?.(seasonId))continue;
          if(typeof registry?.loadDatabase!=="function")continue;
          await registry.loadDatabase(seasonId);
        }
        if(previous)registry?.setActive?.(previous);
        return true;
      })().catch(error=>{
        if(previous)registry?.setActive?.(previous);
        squadFilterDataPromise=null;
        throw error;
      });
      return squadFilterDataPromise;
    }
    function squadFilterDataReady(){
      return squadFilterSeasonIds().every(seasonId=>!!global.SeasonRegistry?.database?.(seasonId));
    }
    function waitForSquadFilterData(reopen){
      if(squadFilterDataReady())return false;
      ensureSquadFilterSeasonData()
        .then(()=>reopen?.())
        .catch(error=>{
          global.console?.error?.("[RTG] Impossibile caricare i dati dei filtri Season/Squadra",error);
          deps.toast?.("Filtri Season/Squadra non disponibili","error");
        });
      return true;
    }
    function humanizeTeamId(teamId){
      return deps.id(teamId).split("_").filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(" ");
    }
    function buildCardFilterMeta(cardRef){
      const cardId=deps.id(cardRef);
      const identity=deps.cardMeta(cardId)||{};
      const seasonId=deps.id(identity.legacySeasonId);
      if(!squadFilterSeasonIds().includes(seasonId))return{seasonId:"",teamIds:[],teamNames:new Map()};
      const roleVariant=deps.squadDraft?.activeRoleVariantByCardId?.[cardId]||null;
      const player=deps.resolved(cardId,roleVariant);
      const raw=deps.rawPlayer(cardId);
      const teamIds=Array.from(new Set([
        player?.resolvedTeamId,player?.teamId,...(player?.teamIds||[]),
        raw?.resolvedTeamId,raw?.teamId,...(raw?.teamIds||[]),
      ].map(deps.id).filter(Boolean)));
      const teamNames=new Map();
      for(const teamId of teamIds){
        const team=global.SeasonRegistry?.team?.(teamId,seasonId);
        const directName=teamIds.length===1?deps.id(player?.teamName||raw?.teamName):"";
        teamNames.set(teamId,deps.id(team?.teamName||team?.name||directName||humanizeTeamId(teamId)));
      }
      return{seasonId,teamIds,teamNames};
    }
    function squadFilterTeamOptions(seasonFilter="all"){
      const seasonIds=squadFilterSeasonIds();
      const records=new Map();
      for(const seasonId of seasonIds){
        if(seasonFilter!=="all"&&seasonId!==seasonFilter)continue;
        const database=global.SeasonRegistry?.database?.(seasonId);
        for(const team of database?.teams||[]){
          const teamId=deps.id(team?.teamId||team?.id);
          if(!teamId)continue;
          const value=`${seasonId}::${teamId}`;
          if(records.has(value))continue;
          records.set(value,{
            value,
            seasonId,
            teamId,
            baseLabel:deps.id(team?.teamName||team?.name||humanizeTeamId(teamId)),
          });
        }
      }
      const rows=Array.from(records.values());
      const labelCounts=new Map();
      for(const row of rows){
        const key=row.baseLabel.toLocaleLowerCase("it");
        labelCounts.set(key,(labelCounts.get(key)||0)+1);
      }
      rows.sort((a,b)=>a.baseLabel.localeCompare(b.baseLabel,"it")||seasonIds.indexOf(a.seasonId)-seasonIds.indexOf(b.seasonId));
      return [{value:"all",label:"Tutte"},...rows.map(row=>({
        value:row.value,
        label:seasonFilter==="all"&&(labelCounts.get(row.baseLabel.toLocaleLowerCase("it"))||0)>1
          ? `${row.baseLabel} · ${squadFilterSeasonShortLabel(row.seasonId)}`
          : row.baseLabel,
      }))];
    }
    function cardMatchesSquadFilters(cardId,seasonFilter,teamFilter,metaFor){
      const meta=metaFor(cardId);
      if(seasonFilter!=="all"&&meta.seasonId!==seasonFilter)return false;
      if(teamFilter!=="all"&&!Array.from(meta.teamIds||[]).some(teamId=>teamFilter===`${meta.seasonId}::${teamId}`))return false;
      return true;
    }
    function reconcileSquadTeamFilter(teamFilter,options){
      const current=deps.id(teamFilter||"all");
      if(current==="all"||options.some(option=>option.value===current))return current;
      const separator=current.indexOf("::");
      const teamId=separator>=0?current.slice(separator+2):"";
      if(teamId){
        const sameTeam=options.find(option=>option.value!=="all"&&deps.id(option.value).slice(deps.id(option.value).indexOf("::")+2)===teamId);
        if(sameTeam)return sameTeam.value;
      }
      return"all";
    }

    function openSquadPlayerPicker(targetId,restoreState=null){
      if(waitForSquadFilterData(()=>openSquadPlayerPicker(targetId,restoreState)))return{loading:true};
      const targetLoc=locationInDraft(targetId);
      if(!targetLoc)return;
      const strictRole=targetLoc.area==="lineup";
      const role=strictRole?roleOfDraftPlayer(targetId):"";
      if(strictRole&&!role)return deps.toast?.("Ruolo giocatore non disponibile","error");
      const quickEntries=strictRole
        ? (deps.squadDraft?.bench||[]).map(deps.id).filter(playerId=>roleOfDraftPlayer(playerId)===role).map(playerId=>({
            playerId,
            source:deps.sourceForDraftPlayer(playerId),
            player:deps.resolved(playerId,deps.squadDraft?.activeRoleVariantByCardId?.[playerId]||null),
          })).filter(entry=>entry.player)
        : [];
      const quickIds=new Set(quickEntries.map(entry=>deps.id(entry.playerId)));
      // The full picker keeps one lightweight representative per canonical player.
      // Other S1/S2 versions are deps.resolved/rendered only when that grouped card is opened.
      let candidateGroups=[];
      let visibleCount=0;
      let query=String(restoreState?.query||"");
      let sourceFilter=restoreState?.sourceFilter||"all";
      let rarityFilter=restoreState?.rarityFilter||"all";
      let seasonFilter=restoreState?.seasonFilter||"all";
      let teamFilter=restoreState?.teamFilter||"all";
      let overallDescending=restoreState?.overallDescending!==false;
      const rarityOptions=squadPickerRarityOptions();
      const seasonOptions=squadFilterSeasonOptions();
      const filterMetaCache=new Map();
      const filterMetaFor=(cardId)=>{
        const key=deps.id(cardId);
        if(!filterMetaCache.has(key))filterMetaCache.set(key,buildCardFilterMeta(key));
        return filterMetaCache.get(key);
      };
      const targetPlayer=deps.resolved(targetId,deps.squadDraft?.activeRoleVariantByCardId?.[deps.id(targetId)]||null);
      const target={playerId:deps.id(targetId),source:deps.sourceForDraftPlayer(targetId),player:targetPlayer};
      const buildGroups=(cardIds)=>Array.from(groupVersionCards(cardIds).entries()).map(([key,cardIds])=>({
        key,
        cardIds,
        representativeId:preferredVersionCardId(cardIds),
      })).filter(group=>group.representativeId);
      const filteredGroups=()=>candidateGroups.map(group=>{
        let matchingCardIds=(group.cardIds||[]).filter(cardId=>cardMatchesSquadFilters(cardId,seasonFilter,teamFilter,filterMetaFor));
        if(!matchingCardIds.length)return null;
        const source=deps.sourceForDraftPlayer(preferredVersionCardId(matchingCardIds));
        if(sourceFilter==="free"&&source!=="Svincolato")return null;
        if(sourceFilter==="rtg"&&source!=="RTG")return null;
        if(rarityFilter!=="all")matchingCardIds=matchingCardIds.filter(cardId=>squadPickerRarity(cardId).toLocaleLowerCase("it")===rarityFilter.toLocaleLowerCase("it"));
        if(!matchingCardIds.length)return null;
        const representativeId=preferredVersionCardId(matchingCardIds);
        const needle=query.trim().toLocaleLowerCase("it");
        if(needle&&!deps.rawName(representativeId).toLocaleLowerCase("it").includes(needle))return null;
        return{...group,representativeId,matchingCardIds};
      }).filter(Boolean).sort((a,b)=>{
        const delta=deps.rawOverall(b.representativeId)-deps.rawOverall(a.representativeId);
        return (overallDescending?delta:-delta)||deps.rawName(a.representativeId).localeCompare(deps.rawName(b.representativeId),"it");
      });
      const entries=()=>{
        const groups=filteredGroups();
        return groups.slice(0,visibleCount).map(group=>({
          cardId:group.representativeId,
          playerId:group.representativeId,
          source:deps.sourceForDraftPlayer(group.representativeId),
          versionCount:group.matchingCardIds?.length||group.cardIds.length,
          player:deps.resolved(group.representativeId,deps.squadDraft?.activeRoleVariantByCardId?.[group.representativeId]||null),
        })).filter(entry=>entry.player);
      };
      const chooseCandidate=(candidateId)=>{
        const result=swapSquadDraft(targetId,candidateId,{render:false});
        if(!result.ok)return deps.toast?.("Cambio non disponibile","error");
        deps.closeModal?.();
        renderSquad();
        return result;
      };
      const renderResults=()=>{
        const modal=deps.getModalRoot?.();
        const groups=filteredGroups();
        const results=modal?.querySelector?.("[data-rtg-picker-results]");
        if(results)results.innerHTML=deps.squadView.replacementPickerResultsMarkup({entries:entries(),total:groups.length,visibleCount});
        modal?.querySelectorAll?.("[data-rtg-picker-source]")?.forEach(button=>button.classList.toggle("active",button.dataset.rtgPickerSource===sourceFilter));
        bindResults();
      };
      const bindResults=()=>{
        const modal=deps.getModalRoot?.();
        modal?.querySelectorAll?.("[data-rtg-picker-player]")?.forEach(button=>button.addEventListener("click",()=>{
          const representativeId=deps.id(button.dataset.rtgPickerPlayer);
          if(!representativeId)return;
          const group=filteredGroups().find(entry=>entry.key===versionGroupKey(representativeId));
          const versions=group?.matchingCardIds||group?.cardIds||[representativeId];
          if(versions.length>1){
            const pickerModal=deps.getModalRoot?.()?.querySelector?.(".modal");
            const stateToRestore={
              query,sourceFilter,rarityFilter,seasonFilter,teamFilter,overallDescending,visibleCount,
              scrollTop:pickerModal?.scrollTop||0,scrollLeft:pickerModal?.scrollLeft||0,
            };
            openRtgVersionPicker(versions,{
              onSelect:chooseCandidate,
              onClose:()=>openSquadPlayerPicker(targetId,stateToRestore),
            });
            return;
          }
          chooseCandidate(representativeId);
        }));
        modal?.querySelector?.("[data-rtg-picker-load-more]")?.addEventListener("click",()=>{
          visibleCount=Math.min(filteredGroups().length,visibleCount+SQUAD_PICKER_PAGE_SIZE);
          renderResults();
        });
      };
      const currentTeamOptions=()=>squadFilterTeamOptions(seasonFilter);
      const refreshTeamFilterControl=()=>{
        const options=currentTeamOptions();
        teamFilter=reconcileSquadTeamFilter(teamFilter,options);
        const select=deps.getModalRoot?.()?.querySelector?.("[data-rtg-picker-team]");
        if(select)select.innerHTML=deps.squadView.filterOptionsMarkup(options,teamFilter);
        return options;
      };
      if(!deps.getModalRoot){
        const candidateIds=squadPickerCandidateIds(targetId,role,{benchTarget:!strictRole}).filter(playerId=>!quickIds.has(deps.id(playerId)));
        candidateGroups=buildGroups(candidateIds);
        visibleCount=Math.min(SQUAD_PICKER_PAGE_SIZE,candidateGroups.length);
      }
      deps.openModal?.(deps.squadView.replacementPickerMarkup({target,role,allowAnyRole:!strictRole,quickEntries,entries:deps.getModalRoot?[]:entries(),total:deps.getModalRoot?0:candidateGroups.length,visibleCount:deps.getModalRoot?0:visibleCount,query,sourceFilter,rarityFilter,rarityOptions,seasonFilter,teamFilter,seasonOptions,teamOptions:currentTeamOptions()}),{className:"rtg-modal rtg-squad-picker-modal"});
      const modal=deps.getModalRoot?.();
      if(!overallDescending){
        const sortButton=modal?.querySelector?.("[data-rtg-picker-sort]");
        sortButton?.setAttribute?.("aria-label","Ordina per overall crescente");
        sortButton?.setAttribute?.("aria-pressed","false");
        const arrow=sortButton?.querySelector?.("[data-rtg-picker-sort-arrow]");
        if(arrow)arrow.textContent="↑";
      }
      modal?.querySelector?.("[data-rtg-picker-search]")?.addEventListener("input",event=>{
        query=String(event.target?.value||"");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      });
      modal?.querySelectorAll?.("[data-rtg-picker-source]")?.forEach(button=>button.addEventListener("click",()=>{
        sourceFilter=String(button.dataset.rtgPickerSource||"all");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      }));
      modal?.querySelector?.("[data-rtg-picker-season]")?.addEventListener("change",event=>{
        seasonFilter=String(event.target?.value||"all");
        refreshTeamFilterControl();
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      });
      modal?.querySelector?.("[data-rtg-picker-team]")?.addEventListener("change",event=>{
        teamFilter=String(event.target?.value||"all");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      });
      modal?.querySelector?.("[data-rtg-picker-rarity]")?.addEventListener("change",event=>{
        rarityFilter=String(event.target?.value||"all");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderResults();
      });
      modal?.querySelector?.("[data-rtg-picker-sort]")?.addEventListener("click",event=>{
        overallDescending=!overallDescending;
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        const button=event.currentTarget;
        const arrow=button.querySelector?.("[data-rtg-picker-sort-arrow]");
        if(arrow)arrow.textContent=overallDescending?"↓":"↑";
        else button.textContent=overallDescending?"OVR ↓":"OVR ↑";
        button.setAttribute("aria-label",overallDescending?"Ordina per overall decrescente":"Ordina per overall crescente");
        button.setAttribute("aria-pressed",overallDescending?"true":"false");
        renderResults();
      });
      bindResults();
      const hydratePicker=()=>{
        const candidateIds=squadPickerCandidateIds(targetId,role,{benchTarget:!strictRole}).filter(playerId=>!quickIds.has(deps.id(playerId)));
        candidateGroups=buildGroups(candidateIds);
        visibleCount=Math.min(candidateGroups.length,Math.max(SQUAD_PICKER_PAGE_SIZE,Number(restoreState?.visibleCount)||0));
        refreshTeamFilterControl();
        renderResults();
        if(restoreState){
          const scroller=deps.getModalRoot?.()?.querySelector?.(".modal");
          const restoreScroll=()=>{
            if(!scroller||scroller.isConnected===false)return;
            scroller.scrollTop=Number(restoreState.scrollTop)||0;
            scroller.scrollLeft=Number(restoreState.scrollLeft)||0;
          };
          if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>requestAnimationFrame(restoreScroll));
          else restoreScroll();
        }
      };
      if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>typeof setTimeout==="function"?setTimeout(hydratePicker,0):hydratePicker());
      else if(typeof setTimeout==="function")setTimeout(hydratePicker,0);
      else hydratePicker();
    }
    function canonicalCardPlayerId(cardRef){
      const meta=deps.cardMeta(cardRef);
      return deps.id(meta.canonicalPlayerId||global.ProfiledSeasonRuntime?.canonicalPlayerId?.(meta.legacySeasonId,meta.profileId||meta.playerId)||meta.playerId);
    }
    function versionGroupKey(cardRef){
      return deps.id(deps.cardIdentity?.versionGroupKey?.(cardRef,deps.activeSeasonId())||`card::${deps.cardMeta(cardRef).cardId||deps.id(cardRef)}`);
    }
    function groupVersionCards(cardIds=[]){
      const groups=new Map();
      for(const cardId of Array.from(new Set(cardIds.map(deps.id))).filter(Boolean)){
        const key=versionGroupKey(cardId);
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(cardId);
      }
      return groups;
    }
    function preferredVersionCardId(cardIds=[]){
      const versions=Array.from(new Set(cardIds.map(deps.id))).filter(Boolean);
      const active=deps.activeSeasonId();
      return versions.find(cardId=>deps.id(deps.cardMeta(cardId).legacySeasonId)===active)||versions[0]||"";
    }
    function openRtgVersionPicker(cardIds=[],options={}){
      const versions=Array.from(new Set(cardIds.map(deps.id))).filter(Boolean);
      const onSelect=typeof options.onSelect==="function"?options.onSelect:null;
      if(versions.length<=1){
        const only=versions[0];
        if(!only)return null;
        return onSelect?onSelect(only):deps.openRtgPlayerDetails(only,"",{onClose:options.onDetailsClose||null});
      }
      // Resolve/render every version only after the unified player card is opened.
      const entries=versions.map(cardId=>({
        cardId,
        playerId:cardId,
        source:"RTG",
        player:deps.resolved(cardId,deps.squadDraft?.activeRoleVariantByCardId?.[cardId]||null),
      })).filter(entry=>entry.player);
      deps.openModal?.(
        deps.squadView.versionPickerMarkup
          ? deps.squadView.versionPickerMarkup({entries,mode:onSelect?"select":"details"})
          : `<section class="rtg-version-picker"><div class="modal-head"><div><p class="eyebrow">Versioni possedute</p><h2>Scegli la versione</h2></div></div></section>`,
        {className:"rtg-modal rtg-version-picker-modal",onClose:typeof options.onClose==="function"?options.onClose:null}
      );
      const modal=deps.getModalRoot?.();
      modal?.querySelectorAll?.("[data-rtg-version-card]")?.forEach(button=>button.addEventListener("click",()=>{
        const selected=deps.id(button.dataset.rtgVersionCard);
        if(!selected)return;
        deps.closeModal?.({invokeOnClose:false});
        if(onSelect){
          onSelect(selected);
          return;
        }
        // Return straight to the originating catalogue after closing the detail card.
        // Opening synchronously also avoids flashing the Squad beneath the modal.
        deps.openRtgPlayerDetails(selected,"",{onClose:options.onDetailsClose||null});
      }));
      return {count:versions.length};
    }
    function openRtgCatalog(restoreState=null){
      // The catalog is immediately usable even while other Season DBs preload.
      // Never hold the button behind several sequential Season network requests.
      const owned=Array.from(deps.acquiredCardIdSet()).filter(Boolean);
      const groups=groupVersionCards(owned);
      const catalogGroups=Array.from(groups.entries()).map(([key,cardIds])=>({key,cardIds,representativeId:preferredVersionCardId(cardIds)})).filter(group=>group.representativeId);
      let query=String(restoreState?.query||"");
      let seasonFilter=restoreState?.seasonFilter||"all";
      let teamFilter=restoreState?.teamFilter||"all";
      let visibleCount=Math.min(catalogGroups.length,Math.max(SQUAD_PICKER_PAGE_SIZE,Number(restoreState?.visibleCount)||0));
      const seasonOptions=squadFilterSeasonOptions();
      const filterMetaCache=new Map();
      const filterMetaFor=(cardId)=>{
        const key=deps.id(cardId);
        if(!filterMetaCache.has(key))filterMetaCache.set(key,buildCardFilterMeta(key));
        return filterMetaCache.get(key);
      };
      const filtered=()=>catalogGroups.map(group=>{
        const matchingCardIds=(group.cardIds||[]).filter(cardId=>cardMatchesSquadFilters(cardId,seasonFilter,teamFilter,filterMetaFor));
        if(!matchingCardIds.length)return null;
        const representativeId=preferredVersionCardId(matchingCardIds);
        const needle=query.trim().toLocaleLowerCase("it");
        if(needle&&!deps.rawName(representativeId).toLocaleLowerCase("it").includes(needle))return null;
        return{...group,representativeId,matchingCardIds};
      }).filter(Boolean).sort((a,b)=>deps.rawRole(a.representativeId).localeCompare(deps.rawRole(b.representativeId))||deps.rawOverall(b.representativeId)-deps.rawOverall(a.representativeId)||deps.rawName(a.representativeId).localeCompare(deps.rawName(b.representativeId),"it"));
      const entries=()=>filtered().slice(0,visibleCount).map(group=>({
        cardId:group.representativeId,
        playerId:group.representativeId,
        source:"RTG",
        versionCount:group.matchingCardIds?.length||group.cardIds.length,
        player:deps.resolved(group.representativeId,deps.squadDraft?.activeRoleVariantByCardId?.[group.representativeId]||null),
      })).filter(entry=>entry.player);
      const currentTeamOptions=()=>squadFilterTeamOptions(seasonFilter);
      const refreshTeamFilterControl=()=>{
        const options=currentTeamOptions();
        teamFilter=reconcileSquadTeamFilter(teamFilter,options);
        const select=deps.getModalRoot?.()?.querySelector?.("[data-rtg-catalog-team]");
        if(select)select.innerHTML=deps.squadView.filterOptionsMarkup(options,teamFilter);
        return options;
      };
      const catalogState=()=>{
        const scroller=deps.getModalRoot?.()?.querySelector?.(".rtg-player-catalog-modal");
        return {query,seasonFilter,teamFilter,visibleCount,
          scrollTop:scroller?.scrollTop||0,scrollLeft:scroller?.scrollLeft||0};
      };
      const bindCatalog=()=>{
        const modal=deps.getModalRoot?.();
        modal?.querySelectorAll?.("[data-rtg-catalog-player]")?.forEach(button=>button.addEventListener("click",()=>{
          const cardId=deps.id(button.dataset.rtgCatalogPlayer);
          if(!cardId)return;
          const group=filtered().find(entry=>entry.key===versionGroupKey(cardId));
          const savedState=catalogState();
          const returnToCatalog=()=>openRtgCatalog(savedState);
          openRtgVersionPicker(group?.matchingCardIds||group?.cardIds||groups.get(versionGroupKey(cardId))||[cardId],{
            onClose:returnToCatalog,
            onDetailsClose:returnToCatalog,
          });
        }));
        modal?.querySelector?.("[data-rtg-catalog-load-more]")?.addEventListener("click",()=>{
          visibleCount=Math.min(filtered().length,visibleCount+SQUAD_PICKER_PAGE_SIZE);
          renderCatalogResults();
        });
      };
      const renderCatalogResults=()=>{
        const modal=deps.getModalRoot?.();
        const results=modal?.querySelector?.("[data-rtg-catalog-results]");
        const filteredGroups=filtered();
        if(results)results.innerHTML=deps.squadView.catalogResultsMarkup({entries:entries(),total:filteredGroups.length});
        bindCatalog();
      };
      deps.openModal?.(deps.squadView.catalogMarkup({entries:entries(),total:catalogGroups.length,query,seasonFilter,teamFilter,seasonOptions,teamOptions:currentTeamOptions()}),{className:"rtg-modal rtg-player-catalog-modal"});
      const modal=deps.getModalRoot?.();
      modal?.querySelector?.("[data-rtg-catalog-search]")?.addEventListener("input",event=>{
        query=String(event.target?.value||"");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderCatalogResults();
      });
      modal?.querySelector?.("[data-rtg-catalog-season]")?.addEventListener("change",event=>{
        seasonFilter=String(event.target?.value||"all");
        refreshTeamFilterControl();
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderCatalogResults();
      });
      modal?.querySelector?.("[data-rtg-catalog-team]")?.addEventListener("change",event=>{
        teamFilter=String(event.target?.value||"all");
        visibleCount=SQUAD_PICKER_PAGE_SIZE;
        renderCatalogResults();
      });
      bindCatalog();
      if(restoreState){
        const scroller=modal?.querySelector?.(".rtg-player-catalog-modal");
        const restoreScroll=()=>{
          if(!scroller||scroller.isConnected===false)return;
          scroller.scrollTop=Number(restoreState.scrollTop)||0;
          scroller.scrollLeft=Number(restoreState.scrollLeft)||0;
        };
        if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>requestAnimationFrame(restoreScroll));
        else restoreScroll();
      }
      if(!squadFilterDataReady()){
        const mountedCatalog=modal?.querySelector?.(".rtg-player-catalog-modal");
        ensureSquadFilterSeasonData().then(()=>{
          // Never reopen an already closed catalogue or replace another modal.
          if(!mountedCatalog||deps.getModalRoot?.()?.querySelector?.(".rtg-player-catalog-modal")!==mountedCatalog)return;
          refreshTeamFilterControl();
          renderCatalogResults();
        }).catch(error=>{
          global.console?.error?.("[RTG] Impossibile caricare i filtri Giocatori RTG",error);
          if(mountedCatalog&&deps.getModalRoot?.()?.querySelector?.(".rtg-player-catalog-modal")===mountedCatalog)
            deps.toast?.("Filtri Season/Squadra non disponibili","error");
        });
      }
      return {count:catalogGroups.length,versionCount:owned.length};
    }

    function currentRequirementTeamId(){
      const node=deps.nodeById(deps.campaign?.currentNodeId);
      if(!node)return null;
      if(node.type==="main")return deps.id(node.teamId);
      if(node.type==="secondary")return deps.id(node.beforeTeamId);
      return null;
    }
    function seasonTeamIdsForPlayer(cardRef){
      const parsed=deps.cardIdentity?.parse?.(cardRef,deps.activeSeasonId())||{};
      const player=deps.playerResolver.resolveVersion?.(cardRef,deps.campaign?.activeSeasonId||"ie1",deps.freeAgentsDb)?.player||deps.rawPlayer(cardRef);
      const profileId=deps.id(parsed.profileId||parsed.playerId);
      const profile=(deps.seasonDb?.profiles||[]).find(entry=>deps.id(entry?.profileId||entry?.id)===profileId);
      const canonicalId=deps.id(profile?.playerId||parsed.canonicalPlayerId||parsed.playerId).split("@")[0];
      const canonical=(deps.seasonDb?.players||[]).find(entry=>deps.id(entry?.playerId||entry?.id)===canonicalId);
      return [player?.teamId,...(player?.teamIds||[]),profile?.teamId,...(profile?.teamIds||[]),canonical?.teamId,...(canonical?.teamIds||[])].filter(Boolean).map(deps.id);
    }
    function requirementPool(teamId){
      const constraint=deps.activeConfig()?.constraints?.[teamId];
      if(!constraint)return[];
      const recruitSet=deps.acquiredCardIdSet();
      const recentTeams=new Set(deps.squadRuntime.recentDefeatedTeamIds(teamId,draftState(),constraint.recentWindow));
      return accessibleDraftIds().map(playerId=>{
        const player=deps.resolved(playerId,deps.squadDraft?.activeRoleVariantByCardId?.[playerId]||null);
        if(!player)return null;
        const role=String(player.normalizedRole||player.position||player.role||deps.rawRole(playerId)).toUpperCase();
        if(!["GK","DF","MF","FW"].includes(role))return null;
        const move=deps.playerResolver.resolveMove?.(playerId,deps.activeSeasonId(),role,deps.freeAgentsDb,deps.squadDraft?.activeRoleVariantByCardId?.[playerId]||null)||null;
        const movePower=Number(move?.power);
        const contribution=Number(player.overall||0)+(Number.isFinite(movePower)?Math.max(0,Math.min(2,(movePower-50)/30)):0);
        const recruit=recruitSet.has(playerId);
        const recent=recruit&&seasonTeamIdsForPlayer(playerId).some(team=>recentTeams.has(team));
        return{playerId,role,overall:Number(player.overall||0),contribution,recruit,recent};
      }).filter(Boolean);
    }
    function buildRequirementCandidate(formation,teamId,pool){
      const constraint=deps.activeConfig()?.constraints?.[teamId];
      if(!formation||!constraint)return null;
      const candidates=Array.from(pool||[]);
      const targetPower=Number(constraint.cap);
      const required={GK:0,DF:0,MF:0,FW:0,...(formation.requirements||{})};
      const left={GK:Number(required.GK)||0,DF:Number(required.DF)||0,MF:Number(required.MF)||0,FW:Number(required.FW)||0};
      const selected=[],used=new Set();
      const distanceToTarget=entry=>Math.abs(Number(entry.contribution||0)-targetPower);
      const balanced=(a,b)=>{
        const distanceDelta=distanceToTarget(a)-distanceToTarget(b);
        if(Math.abs(distanceDelta)>1e-9)return distanceDelta;
        const aAbove=Number(a.contribution)>targetPower?1:0;
        const bAbove=Number(b.contribution)>targetPower?1:0;
        if(aAbove!==bAbove)return aAbove-bAbove;
        return Number(b.contribution)-Number(a.contribution)||a.playerId.localeCompare(b.playerId);
      };
      const addLineupFrom=(source,needed)=>{
        for(const entry of source){
          if(needed<=0)break;
          if(used.has(entry.playerId)||left[entry.role]<=0)continue;
          selected.push(entry);used.add(entry.playerId);left[entry.role]-=1;needed-=1;
        }
        return needed;
      };
      // Composition requirements apply to all 15 active players. Only the amount
      // that cannot fit on the four-player bench is forced into the XI.
      const minFieldRecent=Math.max(0,Number(constraint.recentCount||0)-4);
      const minFieldRecruit=Math.max(0,Number(constraint.minRecruit||0)-4);
      if(addLineupFrom(candidates.filter(entry=>entry.recent).sort(balanced),minFieldRecent)>0)return null;
      const fieldRecruitNow=selected.filter(entry=>entry.recruit).length;
      if(addLineupFrom(candidates.filter(entry=>entry.recruit).sort(balanced),Math.max(0,minFieldRecruit-fieldRecruitNow))>0)return null;
      for(const role of ["GK","DF","MF","FW"]){
        if(addLineupFrom(candidates.filter(entry=>entry.role===role).sort(balanced),left[role])>0)return null;
      }
      if(selected.length!==11)return null;

      const bench=[];
      const benchUsed=new Set(used);
      const addBenchFrom=(source,needed)=>{
        for(const entry of source){
          if(needed<=0||bench.length>=4)break;
          if(benchUsed.has(entry.playerId))continue;
          bench.push(entry);benchUsed.add(entry.playerId);needed-=1;
        }
        return needed;
      };
      const fieldRecruitCount=selected.filter(entry=>entry.recruit).length;
      const fieldRecentCount=selected.filter(entry=>entry.recent).length;
      if(addBenchFrom(candidates.filter(entry=>entry.recent).sort(balanced),Math.max(0,Number(constraint.recentCount||0)-fieldRecentCount))>0)return null;
      const activeRecruitAfterRecent=fieldRecruitCount+bench.filter(entry=>entry.recruit).length;
      if(addBenchFrom(candidates.filter(entry=>entry.recruit).sort(balanced),Math.max(0,Number(constraint.minRecruit||0)-activeRecruitAfterRecent))>0)return null;
      addBenchFrom(candidates.sort(balanced),4-bench.length);
      if(bench.length!==4)return null;

      // Prefer players individually close to the requested level. Afterwards,
      // use any remaining cap headroom while keeping the roster as homogeneous
      // as possible. This avoids solutions such as a few 86 OVR players mixed
      // with many 70 OVR players when 75 OVR alternatives are available.
      const capTotal=targetPower*15;
      const roster=()=>[...selected,...bench];
      const spreadOf=entries=>entries.reduce((sum,entry)=>{
        const delta=Number(entry.contribution||0)-targetPower;
        return sum+(delta*delta);
      },0);
      const metric=(total,spread)=>({
        overage:Math.max(0,total-capTotal),
        shortfall:Math.max(0,capTotal-total),
        spread,
      });
      const betterMetric=(candidate,current)=>{
        if(candidate.overage!==current.overage)return candidate.overage<current.overage;
        if(candidate.shortfall!==current.shortfall)return candidate.shortfall<current.shortfall;
        if(Math.abs(candidate.spread-current.spread)>1e-9)return candidate.spread<current.spread;
        return false;
      };
      let active=roster();
      let total=active.reduce((sum,entry)=>sum+entry.contribution,0);
      let spread=spreadOf(active);
      let currentMetric=metric(total,spread);

      let guard=0;
      while(guard++<180){
        active=roster();
        const activeRecruitCount=active.filter(entry=>entry.recruit).length;
        const activeRecentCount=active.filter(entry=>entry.recent).length;
        const activeIds=new Set(active.map(entry=>entry.playerId));
        let best=null;
        for(let index=0;index<active.length;index++){
          const outgoing=active[index];
          const isLineup=index<selected.length;
          for(const incoming of candidates){
            if(activeIds.has(incoming.playerId))continue;
            if(isLineup&&incoming.role!==outgoing.role)continue;
            const nextRecruit=activeRecruitCount-(outgoing.recruit?1:0)+(incoming.recruit?1:0);
            const nextRecent=activeRecentCount-(outgoing.recent?1:0)+(incoming.recent?1:0);
            if(nextRecruit<Number(constraint.minRecruit||0)||nextRecent<Number(constraint.recentCount||0))continue;
            const nextTotal=total-outgoing.contribution+incoming.contribution;
            const outgoingDelta=Number(outgoing.contribution||0)-targetPower;
            const incomingDelta=Number(incoming.contribution||0)-targetPower;
            const nextSpread=spread-(outgoingDelta*outgoingDelta)+(incomingDelta*incomingDelta);
            const nextMetric=metric(nextTotal,nextSpread);
            if(!betterMetric(nextMetric,currentMetric))continue;
            if(!best||betterMetric(nextMetric,best.metric))best={index,incoming,nextTotal,nextSpread,metric:nextMetric};
          }
        }
        if(!best)break;
        if(best.index<selected.length)selected[best.index]=best.incoming;
        else bench[best.index-selected.length]=best.incoming;
        total=best.nextTotal;
        spread=best.nextSpread;
        currentMetric=best.metric;
      }
      if(total>capTotal+1e-9)return null;

      const state=deps.clone(draftState());
      state.squads[deps.activeSeasonId()]={
        formationId:deps.id(formation.id),
        lineup:selected.map(entry=>entry.playerId),
        bench:bench.map(entry=>entry.playerId),
        activeRoleVariantByCardId:{...(deps.squadDraft?.activeRoleVariantByCardId||{})},
      };
      const eligibility=deps.squadRuntime.mainEligibility({teamId,state,seasonDb:deps.seasonDb,freeAgentIds:deps.freeAgentIds,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolverForState(state)});
      if(!eligibility.eligible)return null;
      return{
        squad:state.squads[deps.activeSeasonId()],
        eligibility,
        targetShortfall:Math.max(0,capTotal-total),
        balanceSpread:spread,
      };
    }
    function adaptSquadToCurrentRequirements(){
      const teamId=currentRequirementTeamId();
      if(!teamId){deps.toast?.("Nessun requisito principale attivo","error");return{ok:false,reason:"no-target"};}
      const formations=deps.activeConfig()?.formations||deps.seasonDb?.formations?.eleven||[];
      const pool=requirementPool(teamId);
      const currentId=deps.id(deps.squadDraft?.formationId||deps.activeSquad(deps.campaign)?.formationId);
      const ordered=[...formations].sort((a,b)=>(deps.id(a.id)===currentId?-1:0)-(deps.id(b.id)===currentId?-1:0));
      let best=null;
      for(const formation of ordered){
        const candidate=buildRequirementCandidate(formation,teamId,pool);
        if(!candidate)continue;
        if(!best||candidate.targetShortfall<best.targetShortfall-1e-9||(Math.abs(candidate.targetShortfall-best.targetShortfall)<=1e-9&&candidate.balanceSpread<best.balanceSpread-1e-9))best=candidate;
      }
      if(!best){deps.toast?.("Non riesco a costruire automaticamente una squadra valida con i giocatori disponibili","error");return{ok:false,reason:"no-valid-squad"};}
      deps.squadDraft=deps.clone(best.squad);
      renderSquad();
      deps.toast?.(`Squadra adattata: Potenza ${best.eligibility.teamPower} / ${best.eligibility.cap}`);
      return{ok:true,teamId,eligibility:best.eligibility,squad:deps.clone(deps.squadDraft)};
    }

    function renderSquad(){
      ensureSquadFilterSeasonData().catch(error=>global.console?.error?.("[RTG] Preload filtri Season/Squadra fallito",error));
      deps.squadDraft=deps.clone(deps.squadDraft||deps.activeSquad(deps.campaign));
      const model=deps.squadView.renderModel({state:draftState(),freeAgentIds:deps.freeAgentIds,seasonDb:deps.seasonDb,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolverForState(draftState())});
      const teamId=currentRequirementTeamId();
      const eligibility=teamId?deps.squadRuntime.mainEligibility?.({teamId,state:draftState(),seasonDb:deps.seasonDb,freeAgentIds:deps.freeAgentIds,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolver}):null;
      const nextTeam=(deps.seasonDb?.teams||[]).find(team=>deps.id(team.teamId||team.id)===teamId);
      const userMeta=deps.getUserTeamMeta?.()||{};
      deps.renderHtml(deps.squadView.markup(model,{
        teamName:userMeta.name||"La tua squadra",
        teamIdentity:userMeta.teamIdentity||null,
        nextTeamName:nextTeam?.name||nextTeam?.teamName||teamId,
        requirementsMarkup:eligibility?deps.runView.requirementsMarkup(eligibility):"",
        teamPower:eligibility?.teamPower ?? deps.squadRuntime.teamPower?.({lineup:deps.squadDraft.lineup||[],activeSeasonId:deps.campaign.activeSeasonId||"ie1",playerResolver:deps.playerResolver,freeAgentsDb:deps.freeAgentsDb,activeRoleVariantByCardId:deps.squadDraft.activeRoleVariantByCardId||{}}) ?? null,
        dirty:JSON.stringify(deps.squadDraft)!==JSON.stringify(deps.activeSquad(deps.campaign)),
        activeSquadSlot:deps.activeSquadSlot,
      }));
      deps.bindHomeAndTabs();
      deps.squadView.bind(deps.app,{
        onOpenFormation:()=>openFormationSelector(model),
        onOpenPlayer:(playerId)=>openSquadPlayerPicker(playerId),
        onOpenDetails:(playerId)=>deps.openRtgPlayerDetails(playerId,"",{allowRoleSwitch:true}),
        onOpenCatalog:()=>openRtgCatalog(),
        onAdaptRequirements:()=>adaptSquadToCurrentRequirements(),
        onSave:()=>saveSquad(deps.squadDraft),
        onSelectSquadSlot:(slot)=>deps.selectSquadSlot(slot),
      });
      deps.mountDevQuickTools();
      return model;
    }
    function switchBenchRole(cardRef,options={}){
      const cardId=deps.id(cardRef),loc=locationInDraft(cardId);
      if(!loc||loc.area!=="bench")return deps.toast?.("Il ruolo si può cambiare solo dalla panchina","error");
      const current=deps.resolved(cardId,deps.squadDraft?.activeRoleVariantByCardId?.[cardId]||null);
      const variants=Array.from(current?.roleVariants||[]);
      if(variants.length<2)return deps.toast?.("Questo giocatore non ha un secondo ruolo","error");
      const active=deps.id(deps.squadDraft?.activeRoleVariantByCardId?.[cardId]||current?.roleVariantId||current?.defaultRoleVariantId);
      const next=variants.find(v=>deps.id(v?.roleVariantId||v?.variantId)!==active)||variants[0];
      const nextId=deps.id(next?.roleVariantId||next?.variantId);
      if(!nextId)return deps.toast?.("Ruolo alternativo non disponibile","error");
      deps.squadDraft={...deps.squadDraft,activeRoleVariantByCardId:{...(deps.squadDraft?.activeRoleVariantByCardId||{}),[cardId]:nextId}};
      if(options.render!==false)renderSquad();
      return {ok:true,cardId,roleVariantId:nextId};
    }
    function locationInDraft(playerId){
      const idValue=deps.id(playerId);
      const lineupIndex=(deps.squadDraft?.lineup||[]).map(deps.id).indexOf(idValue),benchIndex=(deps.squadDraft?.bench||[]).map(deps.id).indexOf(idValue);
      return lineupIndex>=0?{area:"lineup",index:lineupIndex}:benchIndex>=0?{area:"bench",index:benchIndex}:null;
    }
    function swapSquadDraft(firstId,secondId,options={}){
      const first=deps.id(firstId),second=deps.id(secondId);
      if(!first||!second||first===second)return{ok:false,reason:"same-player"};
      const accessible=new Set(deps.accessibleCards(draftState()).map(deps.id));
      if(!accessible.has(first)||!accessible.has(second))return{ok:false,reason:"inaccessible-player"};
      const firstRole=roleOfDraftPlayer(first),secondRole=roleOfDraftPlayer(second);
      const firstLoc=locationInDraft(first),secondLoc=locationInDraft(second);
      if(!firstLoc&&!secondLoc)return{ok:false,reason:"collection-only"};
      // The XI must preserve the role required by the formation. Bench slots are
      // role-free: replacing a bench DF with a FW/MF/GK is always allowed.
      if(firstLoc?.area==="lineup"&&(!secondRole||secondRole!==firstRole))return{ok:false,reason:"role-mismatch"};
      if(secondLoc?.area==="lineup"&&(!firstRole||firstRole!==secondRole))return{ok:false,reason:"role-mismatch"};
      if(firstLoc&&secondLoc){
        deps.squadDraft[firstLoc.area][firstLoc.index]=second;
        deps.squadDraft[secondLoc.area][secondLoc.index]=first;
      }else{
        const loc=firstLoc||secondLoc;
        const incoming=firstLoc?second:first;
        deps.squadDraft[loc.area][loc.index]=incoming;
      }
      if(options.render!==false)renderSquad();
      return{ok:true};
    }
    async function saveSquad(nextSquad=deps.squadDraft,options={}){
      const candidate=deps.clone(nextSquad);
      deps.campaign=await deps.repository.update("rtg-save-squad",current=>{
        const probe=deps.clone(current);probe.squads[deps.activeSeasonId()]=candidate;
        const validation=deps.squadRuntime.validateSquad({state:probe,seasonDb:deps.seasonDb,freeAgentIds:deps.freeAgentIds,freeAgentsDb:deps.freeAgentsDb,playerResolver:deps.playerResolverForState(probe)});
        if(!validation.valid)throw Object.assign(new Error("Squadra RTG non valida"),{code:"rtg-squad-invalid",reasons:validation.reasons});
        current.squads[deps.id(current.activeSeasonId||deps.activeSeasonId())]=candidate;return current;
      });
      deps.squadDraft=deps.clone(candidate);
      deps.storeSquadSlot(deps.activeSquadSlot,deps.squadDraft);
      if(!options.quiet)deps.toast?.(`Squadra ${deps.activeSquadSlot} salvata`);
      return renderSquad();
    }
    return Object.freeze({renderSquad,saveSquad,openRtgCatalog,preloadFilterData:ensureSquadFilterSeasonData,locationInDraft,switchBenchRole,swapSquadDraft,canUseDraftFormation,arrangeDraftForFormation,openSquadPlayerPicker,adaptSquadToCurrentRequirements,getDraftSquad:()=>deps.clone(deps.squadDraft)});
  }
  global.RoadToGlorySquadController=Object.freeze({create});
})(globalThis);
