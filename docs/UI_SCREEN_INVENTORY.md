# Inventario tecnico dell'interfaccia attuale

## 1. Fonte e stato dell'analisi

- **Repository:** `ferro0403/INAZUMA-ROGUELIKE`
- **Branch analizzato:** `restyle-v2`
- **SHA di partenza analizzato:** `b23b91a4fd1aacad0606c762bc96c638f0414ff0`
- **Data dell'analisi:** 22 luglio 2026
- **Metodo:** analisi statica del markup prodotto, dei collegamenti di navigazione, dello stato persistito e delle regole CSS presenti nel repository.
- **Fonte tecnica finale:** il codice del repository sullo SHA indicato; documenti storici e richieste pregresse non sono stati usati per dichiarare una schermata come esistente.

File principali esaminati:

- `index.html`
- `css/game.css`
- `js/app.js`
- `js/run-state.js`
- `js/draft.js`
- `js/five-v-five.js`
- `js/match-simulator.js`
- `js/map-generator.js`
- `js/album-progress.js`
- `js/hall-of-fame.js`
- `js/run-statistics.js`, `js/season-registry.js`, `js/season1-config.js` e gli altri moduli caricati da `index.html` che alimentano stato, dati o navigazione.

Limiti dell'analisi statica:

- Non sono state eseguite fixture, simulazioni browser o misurazioni visuali; overflow, tempi di rendering e comportamento effettivo della tastiera mobile richiedono una verifica runtime successiva.
- Le immagini provengono in parte da URL esterni e da fallback concatenati; la resa reale dipende dalla disponibilità delle risorse.
- Le dimensioni effettive delle liste dipendono dai dataset e dai salvataggi locali.
- Gli stati temporizzati della simulazione sono ricostruibili dal codice, ma non sono stati riprodotti in questa fase.
- Il censimento distingue **vista root**, **flusso modale** e **variante visuale**: una variante non viene presentata come renderer autonomo quando condivide lo stesso `app.innerHTML`.

## 2. Architettura UI attuale

### Montaggio e cambio schermata

`index.html` espone tre root principali:

- `#app`, inizialmente contenente `.loading-screen`;
- `#modal-root`, usato per tutte le modali;
- `#toast-root`, usato per notifiche temporanee.

`js/app.js` contiene il coordinamento UI. La maggior parte delle viste viene sostituita integralmente assegnando una nuova stringa a `app.innerHTML`. Il routing non usa URL o un router: dipende da funzioni `render...`, da `run.phase`, da `run.activeMatch`, da `run.postBossFlow` e da stato UI volatile nell'oggetto `ui`.

`resumeRun()` interpreta almeno le fasi `formation`, `draft`, `squad`, `five`, `inventory`, `match`, `gameover`, `final-celebration`, `final-summary` e `complete`; in assenza di una fase speciale ripristina la mappa.

### Modali

`openModal(content, options)` sostituisce `modalRoot.innerHTML` con:

- `.modal-backdrop` fixed;
- `.modal` con eventuale classe specifica;
- pulsante `.modal-close` opzionale.

La funzione salva focus e scroll, azzera lo scroll della nuova modal e, alla chiusura, tenta di ripristinare posizione e focus. Alcuni flussi sono chiudibili, altri impongono una scelta e usano `closeable: false`.

### Toast

`toast(message)` crea dinamicamente un elemento `.toast` dentro `#toast-root` e lo rimuove dopo 3200 ms. Non esiste una coda formalizzata, ma più toast possono convivere nella griglia del root.

### Renderer e stato della run

I renderer leggono direttamente variabili condivise (`run`, `seasonDb`, `freeAgentsDb`, indici dei giocatori e oggetto `ui`). Molti renderer modificano `run.phase` e chiamano `RunState.save()` prima o dopo il markup. Le viste partita dipendono inoltre dallo snapshot in `activeMatch.simulation`; Album e Albo d'Oro leggono storage separati.

### Rerender completi e aggiornamenti locali

Rerender completi rilevati:

- quasi tutte le transizioni di schermata tramite `app.innerHTML`;
- cambio modulo squadra con `runKeepingScroll(renderSquad)`;
- filtri inventario con `renderInventory({ keepScroll: true })`;
- cambio modulo 5v5 con `renderFiveVFive()`.

Aggiornamenti locali rilevati:

- selezione e swap titolare/riserva in Squadra;
- selezione giocatore nello Scambio;
- selezione, filtro e assegnazione degli slot 5v5;
- cambio tab mobile nelle partite;
- append incrementale della cronaca;
- aggiornamento punteggio e controlli della simulazione;
- selezione inline nelle pull.

### Organizzazione CSS

`css/game.css` è un unico foglio globale. Contiene:

- token globali in `:root`;
- reset e primitive (`.btn`, `.panel`, `.screen`, `.topbar`);
- componenti condivisi;
- blocchi dedicati a Squadra, mappa, inventario, Player Detail, 5v5, boss match, Home, finali, Album e Albo d'Oro;
- numerose media query distribuite nel file, incluse più sezioni separate con `max-width: 780px`.

Non esiste una separazione fisica tra CSS mobile e desktop. Il desktop è generalmente il default; il mobile viene sovrascritto con media query a 900, 780, 700, 620, 520 e 379 px, oltre a regole `min-width` e `prefers-reduced-motion`.

## 3. Inventario delle schermate principali

La tabella censisce **39 superfici principali o stati visuali necessari per coprire l'app**. Le righe che condividono un renderer sono marcate come variante.

| # | Schermata / stato | Renderer o origine | Root / classi principali | Accesso e stato richiesto | Desktop / mobile | Sottoflussi e componenti | Rischio restyle |
|---:|---|---|---|---|---|---|---|
| 1 | Caricamento | markup statico in `index.html` | `.loading-screen`, `.ball-loader` | apertura pagina prima di `init()` | layout centrato condiviso | nessuno | basso; dipende da stile globale `body`, `h1` |
| 2 | Errore caricamento | `showLoadError()` | `.hero-screen`, `.panel` | fetch database fallito o file aperto senza server | stessa struttura responsive | messaggio tecnico e `<pre>` | medio; testo/stack lungo può overfloware |
| 3 | Home | `renderHome()` | `.home-screen.modern-home`, `.home-hero`, `.home-choice-grid` | init riuscito; con o senza run attiva | griglia desktop, cards impilate su mobile | Run card, Albo d'Oro, Album | alto; combina molti componenti e stati vuoti |
| 4 | Home senza run | variante di `renderHome()` / `homeRunCardMarkup()` | `.home-run-card`, `.empty-state.compact-empty` | nessun salvataggio attivo | CTA diversa | selezione Season | medio |
| 5 | Home con run | variante di `renderHome()` | `.home-run-card`, `.home-stat-grid`, `.home-roster-preview` | run attiva risolvibile | avatar preview e progress bar | continua/seleziona run | alto; nomi, roster e progresso dinamici |
| 6 | Selezione Season | `renderSeasonSelect()` | `.home-screen.modern-home.season-select-screen`, `.season-choice-grid` | CTA Home o selezione run | numero preview differente per viewport | card Season vuota/attiva | alto; carica più database e varianti run |
| 7 | Creazione nuova run | `startNewRunFromHome()` + `openTeamNameModal()` | modal `.team-name-modal` | Season selezionata, nessun profilo nome valido | modal responsive | validazione nome | medio; input, tastiera e messaggi errore |
| 8 | Conferma sostituzione run | `startNewRunFromHome()` | `.team-name-modal.new-run-confirm-modal` | Season con run attiva | modal | annulla / inizia nuova run | medio; operazione distruttiva da rendere inequivocabile |
| 9 | Selezione modulo iniziale | `renderFormationChoice()` | `.screen`, `.content.narrow`, `.formation-grid` | `run.phase = formation` | auto-fit desktop, singola colonna stretta | card modulo e role chips | medio |
| 10 | Draft iniziale | `renderDraft()` | `.screen`, `.candidate-grid.pull-offer-grid.initial-draft-grid` | `run.phase = draft`, tre candidati | card grandi desktop, orizzontali mobile | progress bar, Player Card grande | alto; 11 scelte consecutive e immagini variabili |
| 11 | Mappa / percorso | `renderMap()` | `.screen.route-screen`, `.route-content`, `.map-wrap`, `.route-map` | zona corrente generata | desktop centrato/scroll; mobile altezza proporzionale | nodi, SVG collegamenti, bottom nav, preview boss | molto alto; coordinate inline e logica di raggiungibilità |
| 12 | Squadra | `renderSquad()` | `.screen.squad-screen`, `.squad-content`, `.squad-layout`, `.pitch` | rosa e modulo presenti | campo + panchina; layout mobile dedicato | topbar, metriche, tattica, bottom nav | molto alto; card e geometria campo condivise con modali |
| 13 | Modifica titolari | variante di `renderSquad()` con `ui.squadEditMode` | `.squad-edit-toggle`, `.player-card.selected` | toggle “Modifica titolari” | stessa vista; tap/click selettivo | swap locale titolare-riserva | molto alto; posizione DOM usata dall'interazione |
| 14 | Formazione 5v5 | `renderFiveVFive()` | `.screen.five-screen`, `.five-layout`, `.five-pitch`, `.five-selector` | run con rosa; `run.phase = five` | due colonne desktop, flusso verticale mobile | slot, filtri ruolo, lista orizzontale, bottom nav | molto alto; validazione e sostituzioni DOM locali |
| 15 | Formazione 5v5 invalida / vuota | variante di `renderFiveVFive()` | `.five-slot.missing`, `.five-validation.invalid` | slot mancante/duplicato/non compatibile | messaggi e pulsante disabilitato | stato vuoto lista filtro | alto |
| 16 | Anteprima partita 5v5 | ramo 5v5 di `renderMatch()` | `.screen.five-match-screen[data-match-state="pre-match"]` | `activeMatch.type = five_v_five` | due campi desktop, tab e campo singolo mobile | confronto, probabilità, controlli | molto alto |
| 17 | Simulazione partita 5v5 | stessa vista, stato `simulating` | `.match-sim-log`, badge Live | simulazione valida avviata | cronaca scrollabile; action controls | timer, “Vai al risultato” | molto alto; aggiornamenti incrementali e scroll |
| 18 | Risultato partita 5v5 | stessa vista, stato completed | `.five-match-result-panel`, `.boss-match-score` | vittoria/sconfitta risolta | CTA ritorno mappa | badge esito, vite/livello | alto |
| 19 | Anteprima formazione boss dalla mappa | `openBossPreviewModal()` | `.route-boss-preview-modal`, `.route-boss-preview-field` | click “Vedi formazione” | campo responsive | Player Detail boss | alto; riusa campo 11v11 in modal |
| 20 | Anteprima boss 11v11 | ramo boss di `renderMatch()` | `.screen.boss-match-screen[data-match-state="pre-match"]` | nodo boss selezionato | tab squadre anche desktop; mobile campo dedicato | riepilogo boss, tattiche, controlli | molto alto |
| 21 | Simulazione boss | stessa vista, stato `simulating` | `.boss-match-log`, `.match-state-badge` | simulazione 11v11 avviata | boss panel nascosto sotto 900 px | cronaca, punteggio, skip | molto alto |
| 22 | Risultato boss | stessa vista, completed victory/defeat | `.boss-match-result-panel--victory/--defeat` | esito applicato | CTA continua | ricompense o ritorno nodo | molto alto; collegato al post-boss flow persistito |
| 23 | Pull svincolati | `openPull()` → `showPlayerOffer()` | modal con `.pull-offer-grid` | nodo `pull_free_agents` | grandi desktop, orizzontali mobile | scelta inline, scout, portafortuna, rinuncia | alto |
| 24 | Pull squadre | stesso renderer | stesse classi | nodo `pull_unlocked_teams`, squadre sbloccate | come sopra | pool e testo differenti | alto; stessa UI con regole diverse |
| 25 | Pull leggendario | stesso renderer | stesse classi | nodo `pull_legendary` sbloccato | come sopra | scout/portafortuna disabilitati | alto; stati disabled devono restare leggibili |
| 26 | Ricompensa boss | `showNextBossReward()` → `showPlayerOffer()` | stessa modal pull | post-boss flow, ricompensa 1 o 2 | come pull | reroll, rinuncia, avanzamento persistito | molto alto; riuso visivo con semantica diversa |
| 27 | Sostituzione panchinaro a rosa piena | `recruitPlayer()` | `.bench-replacement-grid`, `.mobile-compact-player-list` | roster a capienza massima | griglia desktop, card orizzontali mobile | eventuale recupero equipaggiamento | alto |
| 28 | Scambio: selezione | `resolveTradeNode()` | `.trade-modal`, `.exchange-screen`, `.trade-squad-layout` | nodo trade | campo e panchina diventano una colonna mobile | card tattiche, action bar | molto alto; selezione locale e modal full-screen |
| 29 | Scambio: conferma | `prepareTrade()` | `.trade-confirm-modal`, `.trade-confirm-panel` | giocatore selezionato e candidato disponibile | modal | conferma/annulla, inventario pieno | medio |
| 30 | Scambio: risultato | `showTradeResult()` | `.trade-result-modal`, `.trade-result-card` | scambio eseguito | card compatta mobile | Player Detail e continua | medio |
| 31 | Nodo oggetto | `resolveItemNode()` | `.item-reward-modal`, `.item-reward-screen`, `.item-reward-grid` | nodo item | grid responsive | item card, rinuncia, ritorno mappa | alto; action area e contenuto variabile |
| 32 | Evento casuale rivelato | `resolveRandomNode()` | `.random-event-modal`, `.random-event-reveal` | nodo random non ancora aperto | modal | colore e icona inline | medio |
| 33 | Inventario | `renderInventory()` | `.screen.inventory-screen`, `.inventory-layout`, `.inventory-categories` | rosa esistente; `run.phase = inventory` | due colonne desktop, singola mobile | filtri, card oggetto, equipaggiati, bottom nav | molto alto; molti stati e azioni |
| 34 | Inventario vuoto / filtro vuoto | variante `inventoryCategoriesMarkup()` | `.inventory-empty-state` | zero oggetti o filtro senza risultati | stessa vista | messaggio contestuale | medio |
| 35 | Player Detail | `showPlayerDetailsFor()` / `playerDetailMarkup()` | `.player-detail-modal`, `.player-detail-layout` | click su una card risolvibile | due colonne desktop, verticale quasi full-screen mobile | current, album, historical; equip rimuovibile | molto alto; tre modalità e immagini fallback |
| 36 | Album: collezioni | `renderAlbumCollections()` | `.album-screen`, `.album-collection-grid` | Home → Album | card orizzontale desktop, verticale mobile | progress bar inline | alto |
| 37 | Album: squadre | `renderAlbumTeams()` | `.album-screen`, `.album-team-grid` | collezione selezionata | auto-fit / due colonne mobile | logo fallback, stato completo | medio |
| 38 | Album: rosa | `renderAlbumRoster()` | `.album-screen.album-roster-screen`, `.album-player-grid` | squadra Album selezionata | griglia responsive a due colonne mobile | card bloccate/sbloccate, Player Detail Album | molto alto |
| 39 | Albo d'Oro, dettaglio e finali | `renderHallOfFame()`, `renderHallOfFameDetail()`, `renderFinalCelebration()`, `renderFinalSummary()`, `renderGameOver()` | `.hall-screen`, `.hall-detail-screen`, `.final-celebration-screen`, `.final-summary-screen`, `.gameover-screen` | Home, vittoria finale o zero vite | griglie e tab responsive | snapshot card, statistiche, premi, storico | molto alto; cinque root correlate ma con renderer distinti |

> Nota: la riga 39 raggruppa cinque root strettamente correlate per mantenere leggibile la matrice. Ai fini delle fixture devono essere trattate separatamente: Albo vuoto, Albo popolato, dettaglio storico, celebrazione finale, riepilogo finale e Game Over.

## 4. Inventario delle modali e degli overlay

Sono state individuate **19 varianti modali/overlay** rilevanti.

| # | Modal / overlay | Apertura e condizione | Chiusura / pulsanti | Dati e classi | Mobile / rischi |
|---:|---|---|---|---|---|
| 1 | Shell modale generica | `openModal()` | X solo se `closeable` | `.modal-backdrop`, `.modal`, `.modal-close` | fixed, `max-height`, z-index 100; rischio annidamento logico |
| 2 | Nome squadra | `openTeamNameModal(create/edit)` | Conferma, Indietro | `.team-name-modal`, input e errore live | tastiera, focus, viewport dinamico |
| 3 | Conferma nuova run | run attiva nella Season | Annulla, Inizia nuova run | `.new-run-confirm-modal` | testo distruttivo e nome lungo |
| 4 | Preview boss percorso | `openBossPreviewModal()` | X / Chiudi | `.route-boss-preview-modal` | campo 11v11 dentro area scrollabile |
| 5 | Ricompensa oggetto | `resolveItemNode()` | scelta, Rinuncia, Torna mappa | `.item-reward-modal` | action area e tre card |
| 6 | Evento casuale | `resolveRandomNode()` | Continua obbligatorio | `.random-event-modal`, style `--reveal-color` | nessun back immediato |
| 7 | Pull svincolati | `showPlayerOffer()` | Sì, Annulla, Scheda, Rinuncia, back | `.pull-offer-grid` | tre card + azioni inline possono allungare molto |
| 8 | Pull squadre | stesso shell | come sopra + scout/portafortuna | stesse classi | semantica diversa non espressa da root dedicata |
| 9 | Pull leggendario | stesso shell | come sopra, strumenti disabilitati | stesse classi | testi disabled lunghi |
| 10 | Ricompensa boss | `showNextBossReward()` | scelta/rinuncia/reroll | stesso shell pull | dipende da `postBossFlow` persistito |
| 11 | Sostituzione riserva | `recruitPlayer()` con roster pieno | scelta card, rinuncia opzionale | `.bench-replacement-grid` | card mobile compatte; possibile catena con discard |
| 12 | Scambio selezione | `resolveTradeNode()` | Procedi, Rinuncia | `.trade-modal`, `.exchange-actions` | full-screen, overflow e action bar |
| 13 | Scambio conferma | `prepareTrade()` | Conferma, Annulla | `.trade-confirm-modal` | possibile apertura discard prima dell'esecuzione |
| 14 | Scambio risultato | `showTradeResult()` | Scheda, Continua | `.trade-result-modal` | Player Detail sostituisce temporaneamente la modal |
| 15 | Scarto inventario pieno | `chooseInventoryDiscard()` | scelta obbligatoria o Annulla | `.item-grid`, `.danger-card` | lista fino al cap; rischio altezza e target piccoli |
| 16 | Assegnazione consumabile / potenziamento | `choosePlayerForConsumable()`, `choosePlayerForPotentialBoost()` | X o scelta giocatore | `.item-assignment-modal.consumable-assignment-modal` | campo + panchina dentro modal |
| 17 | Assegnazione equipaggiamento | `chooseEquipmentPlayer()` | X o scelta giocatore | `.item-assignment-modal` | stessa geometria della Squadra con altra interazione |
| 18 | Conferma sostituzione equip | giocatore già equipaggiato | Conferma, Annulla | shell generica non chiudibile | rischio perdita del contesto precedente |
| 19 | Player Detail / toast layer | click card o `toast()` | X, eventuale “Rimuovi oggetto”; toast auto-dismiss | `.player-detail-modal`, `.toast-root`, `.toast` | Player Detail quasi full-screen mobile; toast z-index 200 e testi multilinea |

## 5. Componenti condivisi

| Componente | Helper / markup | Classi principali | Utilizzo | Duplicazioni / incoerenze | Opportunità futura |
|---|---|---|---|---|---|
| Player Card grande | `playerCard()` | `.player-card-large`, `.pull-player-card` | draft, pull, boss reward, Album, trade result | stesso markup assume contesti interattivi e statici | API di varianti esplicite |
| Player Card compatta | `compactPlayerCardMarkup()` | `.player-card-compact`, `.tactical-player-card`, `.mini-player` | Squadra, trade, equip, boss field, storico | molte classi alias sullo stesso nodo | ridurre alias e definire slot dati |
| Card campo 11v11 | `tacticalMiniPlayer()`, `matchFormationCard()` | `.pitch-row`, `.match-player-card`, `.boss-match-card` | Squadra, boss, preview, modali item | stessa base con metadati/layout diversi | variante centralizzata “field” |
| Card orizzontale | `fiveRosterCard()`; CSS mobile di `playerCard()` | `.five-roster-card`, pull card mobile | selettore 5v5, pull mobile | due implementazioni indipendenti | un pattern list-card condiviso |
| Card bloccata Album | wrapper in `renderAlbumRoster()` | `.album-player-entry.is-locked`, `.album-lock-overlay` | Album rosa | card sottostante resta cliccabile per detail | stato lock esplicito nel componente |
| Badge ruolo | `roleBadge()` e `.player-role` | `.role-token`, `.role-chip`, `.player-corner` | filtri 5v5, moduli, card | tre linguaggi visuali per lo stesso concetto | token semantico unico con varianti |
| Badge livello / overall | markup nelle card | `.player-level`, `.player-overall`, `.five-slot-overall`, `.five-match-card-overall` | tutte le card | posizioni e naming duplicati | slot standardizzati |
| Indicatore equipaggiamento | `equipmentBadgeMarkup()`, `fivePlayerEquipmentMarkup()` e markup card | `.equipment-badge`, `.player-equipment`, `.five-player-equipment` | Squadra, partite, detail | più wrapper e posizioni | badge unico con placement configurabile |
| Card oggetto | `itemChoiceCard()`, `inventoryItemCard()` | `.item-card`, `.item-choice-card`, `.inventory-item-card` | nodo oggetto, inventario, discard | stessa entità con markup molto diverso | modello item-card con density/action |
| Pulsanti | markup diffuso | `.btn`, `.btn-primary`, `.btn-yellow`, `.btn-ghost`, `.btn-danger`, `.btn-tool` | ovunque | semantica colore non sempre uniforme | gerarchia azioni documentata |
| Pannello | markup diffuso | `.panel` + classi locali | quasi tutte le viste | `.panel` porta stile forte globale | primitive più neutre e scope locale |
| Topbar | `topbar()` e header ad hoc | `.topbar`, `.game-topbar`, `.album-topbar` | run, Album, Hall | Home/Season/finali usano header separati | shell di pagina con slot |
| Navigazione | `bottomNav()`, `sectionRootButton()` | `.bottom-nav`, `[data-section-root]` | run e sezioni archivio | desktop/mobile condividono DOM con override | navigazione responsive esplicita |
| Bottom/action bar | markup diffuso | `.bottom-nav`, `.five-match-controls`, `.exchange-actions`, `.item-reward-actions` | app e modali | alcune fixed/sticky storiche, altre statiche | primitive action-bar con safe area |
| Tab | markup diffuso | `.boss-match-tabs`, `.five-match-tabs`, `.final-tabs`, `.squad-formation-tabs` | match, finali, moduli | quattro implementazioni | tab accessibile centralizzato |
| Campo 5v5 | `fiveMatchField()`, editor `five-pitch` | `.five-match-field`, `.five-pitch` | editor e partita | due strutture DOM/CSS diverse | condividere geometria, non logica |
| Campo 11v11 | `squadPitchMarkup()`, `renderMatchFormation()` | `.pitch`, `.boss-match-field` | Squadra, modali, boss | due renderer con righe simili | modello righe/slot centralizzato |
| Modal | `openModal()` | `.modal-backdrop`, `.modal` | tutti i sottoflussi | contenuti spesso incorporano `<main>`/`<section>` eterogenei | shell con header/body/footer |
| Toast | `toast()` | `.toast-root`, `.toast` | feedback globale | nessun tipo o gestione coda | livelli informativi e aria-live |
| Logo squadra | `teamLogoMarkup()`, `albumTeamLogoMarkup()`, `bossNodeIconMarkup()` | classi differenti | detail, Album, mappa, match | tre fallback differenti | resolver visivo unico |
| Rarità | `rarityClass()` applicata a card/detail | classi `rarity-*` | card e detail | overlay/lock possono alterare contrasto | token colore/contrasto centralizzati |
| Stato vuoto | markup inline in molti renderer | `.empty-state`, `.inventory-empty-state`, `.hall-empty`, `.season-preview-state` | Home, inventario, Hall, Season | copie testuali e strutturali | componente EmptyState |

## 6. Matrice delle varianti Player Card

Sono state individuate **9 varianti visuali rilevanti**.

| Variante | Generazione | Classi | Contesto / dati mostrati | Posizioni | Click | Mobile / desktop | Duplicazioni |
|---|---|---|---|---|---|---|---|
| 1. Grande draft/pull | `playerCard()` | `.player-card-large.pull-player-card` | immagine, nome, elemento, rarità, ruolo, OVR, livello, oggetto opzionale | ruolo TL, OVR TR, oggetto BL, livello BR | selezione o articolo statico | card verticale desktop; orizzontale sotto 780 px | base usata anche da Album e risultato trade |
| 2. Compatta tattica | `compactPlayerCardMarkup()` via `tacticalMiniPlayer()` | `.player-card-compact.tactical-player-card.mini-player` | nome, ruolo, OVR, livello, equip | corner desktop; parte dei corner nascosta mobile | detail o selezione in base a `data-*` | densità fortemente ridotta mobile | molte responsabilità in un helper |
| 3. Campo boss 11v11 | `matchFormationCard()` | variante 2 + `.match-player-card.boss-match-card--user/--boss` | ruolo, OVR, livello, equip utente | meta stacked; righe governate da CSS vars | apre detail | larghezze per 2–5 giocatori/riga mobile | semanticamente distinta ma stesso markup compatto |
| 4. Partita 5v5 | `fiveMatchCard()` | `.five-match-card--user/--opponent` | ruolo, OVR, immagine, nome corto, livello, equip utente | markup bespoke | apre detail | dimensioni e campo memoizzati | duplica informazioni e fallback della card condivisa |
| 5. Slot editor 5v5 | `fiveSlotCard()` | `.five-slot`, `.missing`, `.selected` | slot/ruolo, OVR, immagine, nome, livello, equip o empty state | ruolo/OVR dedicati | seleziona slot | card fissa desktop, ridotta mobile | duplica card + aggiunge stato vuoto |
| 6. Lista rosa 5v5 | `fiveRosterCard()` | `.five-roster-card`, `.assigned`, `.disabled` | immagine, nome, ruolo, OVR, livello, slot assegnato | layout orizzontale | assegna giocatore | lista laterale/verticale | implementazione separata dalle pull orizzontali |
| 7. Preview rosa Season | `seasonRosterPreviewMarkup()` → compact helper | variante 2 + `.season-preview-player` | ruolo, OVR, livello, nome | meta stacked | non previsto come navigazione | numero card differente mobile/desktop | riuso corretto ma dipende da classi globali |
| 8. Album locked/unlocked | `renderAlbumRoster()` → `playerCard()` + wrapper | variante 1 + `.album-player-entry`, `.album-lock-overlay` | dati finali; overlay “Non sbloccato” | overlay full-card | apre Player Detail Album anche se bloccata | griglia 2 colonne mobile | lock è esterno alla card, possibile incoerenza focus |
| 9. Snapshot Hall/finale | `snapshotCard()` → compact helper | variante 2 + `.hall-player-card` | dati storici finali ed equip | come compact | apre detail storico | campo/panchina responsive | mapping storico duplicato prima del helper |

Duplicazioni più evidenti:

1. `fiveMatchCard()` e `fiveSlotCard()` ricostruiscono manualmente elementi già presenti nelle card condivise.
2. La versione orizzontale mobile di `playerCard()` è ottenuta solo via CSS, mentre `fiveRosterCard()` usa markup distinto.
3. Badge ruolo/OVR/livello esistono sia come `.player-corner` sia come classi dedicate 5v5.
4. I campi 11v11 usano la stessa card compatta ma con due generatori di righe differenti.
5. Album e Hall aggiungono semantica tramite wrapper/classi esterne invece di una variante esplicita del componente.

## 7. Mappa della navigazione

| Origine | Azione | Destinazione | Funzione | Salvataggio / stato | Ritorno |
|---|---|---|---|---|---|
| Loading | init riuscito | Home | `init()` → `renderHome()` | carica DB/storage | n/a |
| Home | Seleziona Season | Season select | `renderSeasonSelect()` | nessuno | root button Home |
| Season select | Continua run | fase salvata | `selectSeason()` → `resumeRun()` | touch del salvataggio | dipende dalla fase |
| Season select | Nuova run | nome o conferma overwrite | `startNewRunFromHome()` | crea run solo dopo conferma | annulla modal |
| Nome squadra | Conferma | Modulo iniziale | `startRunWithIdentity()` | crea e salva run | non torna alla run precedente dopo conferma |
| Modulo iniziale | scegli modulo | Draft | `DraftEngine.start()` → `renderDraft()` | salva formation/draft | root Home disponibile |
| Draft | scegli candidato | step successivo / Squadra | `DraftEngine.choose()` | salva ogni step | nessun back di step |
| Squadra | Inizia/Torna percorso | Mappa | `resumePostBossFlowOrMap()` | crea zona/checkpoint se necessario | bottom nav Squadra |
| Mappa | nodo 5v5 | Match 5v5 o editor invalido | `enterNode()` → `dispatchNode()` | salva pending node/active match | mappa o editor |
| Mappa | nodo boss | Match boss | `dispatchNode()` | crea activeMatch | mappa / Squadra prima dell'esito |
| Mappa | nodo pull/item/trade/random | modal specifica | `dispatchNode()` | stato candidato/rivelazione persistito | back o rinuncia secondo flusso |
| Match 5v5 | Modifica squadra | Editor 5v5 | `renderFiveVFive({returnToMatch:true})` | salva contesto e scroll | “Torna alla partita” se valido |
| Match | Simula | stessa vista simulating | `startMatchSimulation()` | snapshot e stato persistiti | skip al risultato |
| Match | Continua dopo esito | Mappa / Game Over / reward boss | `continueAfterMatch()` | applica esito una volta | non torna al match finalizzato |
| Boss vittoria | Continua | Ricompensa 1/2 | `resolvePendingRunFlow()` | `postBossFlow` persistito | flusso riprendibile da refresh |
| Ricompensa boss | completa due scelte | Mappa successiva / finale | `advanceBossReward()` | aggiorna boss e checkpoint | nessun back dopo finalizzazione |
| Bottom nav | Percorso/Squadra/Oggetti/5v5 | renderer relativo | `bindBottomNav()` | aggiorna `run.phase` dove previsto | nav reciproca |
| Inventario | Equipaggia/Usa | modal assegnazione o update locale | `useInventoryItem()`, `chooseEquipmentPlayer()` | salva consumo/equip | ritorna Inventario |
| Player Detail | X | superficie precedente | `closeModal()` | nessun cambio salvo rimozione equip | ripristino focus/scroll tentato |
| Home | Album | Collezioni → Squadre → Rosa | renderer Album | storage Album separato | root button gerarchico |
| Home | Albo d'Oro | Lista → Dettaglio | renderer Hall | storage Hall separato | root button Home/lista |
| Vittoria finale | Continua | Riepilogo finale | `renderFinalCelebration()` → `renderFinalSummary()` | fase e snapshot Hall salvati | Albo/Home/Nuova run |
| Game Over | Nuova run / Menu | nome squadra / Home | `renderGameOver()` | nuova run solo dopo conferma | Menu Home |

## 8. Stati visuali da riprodurre nei test

### Indispensabili

| Stato | Dati minimi per apertura diretta |
|---|---|
| Home senza run | database caricati, storage run vuoto |
| Home con run | run valida con identità, bossIndex, livello, vite, modulo e almeno 5 giocatori |
| Season select mista | due Season, una con run attiva e una vuota |
| Modulo iniziale | run `phase=formation`, formazioni disponibili |
| Draft | `phase=draft`, ruolo corrente e 3 candidateIds risolvibili |
| Squadra completa | 15 roster, 11 lineup, 4 bench, modulo valido |
| Squadra edit con selezione | come sopra + `ui.squadEditMode=true` e un player selezionato |
| Mappa | zona deterministica con nodi locked/reachable/completed/current e boss logo |
| 5v5 editor valido | 5 slot validi e un filtro ruolo |
| 5v5 editor invalido | almeno uno slot vuoto o non compatibile |
| Match 5v5 pre/sim/completed | `activeMatch` con simulation rispettivamente pre-match, simulating, completed |
| Boss pre/sim/completed | boss e 11+11 giocatori risolvibili, formationId, timeline |
| Inventario pieno e misto | 20 elementi tra consumabili/equip, almeno un equipaggiato |
| Pull normali/legendaria/reward | node pull state con 3 candidati persistiti e strumenti disponibili/disabilitati |
| Player Detail current/album/historical | giocatore risolto con stats, immagini e modalità specifica |
| Album bloccato/parziale | progress storage vuoto e poi con subset di playerIds |
| Hall vuoto/popolato/dettaglio | archive vuoto e snapshot campione completo |
| Finale e Game Over | `phase` finale con hallTeamId; run `gameOver=true`, vite 0 |

### Importanti

- nome squadra di 24 caratteri e stringa con spazi/apostrofo;
- giocatore senza portrait e senza fullbody, fino al placeholder finale;
- logo boss/squadra mancante;
- rarità per ogni classe disponibile, incluse Leggenda e stato locked Album;
- giocatore con equipaggiamento in Squadra, 5v5, boss, Inventory e Detail;
- inventario vuoto, filtro vuoto e pannello equipaggiati vuoto;
- rosa piena con sostituzione riserva e oggetto equipaggiato;
- trade senza candidato e trade con conferma;
- cronaca vuota e cronaca lunga con eventi user/opponent/neutral;
- testi lunghi in item, premi, statistiche e nomi squadra;
- run senza storico affidabile, con fallback “Non disponibile”.

### Secondari

- Home con Albo ma senza Album sbloccato;
- Season preview con giocatore non risolvibile;
- pull con Portafortuna già usato;
- pull con Visore scout disabilitato;
- boss reward seconda scelta;
- filtro inventario con una sola categoria;
- Album squadra completata;
- dettaglio storico senza statistiche o premi;
- `prefers-reduced-motion: reduce`.

### Casi limite

- viewport 360 px con safe area iPhone e tastiera aperta sul nome squadra;
- nome/descrizione molto lunghi senza spazi;
- immagine esterna lenta o 404;
- 5 giocatori sulla stessa riga di campo mobile;
- modal aperta dopo scroll profondo e successivo Player Detail;
- inventario pieno durante trade o sostituzione riserva equipaggiata;
- refresh durante simulazione, risultato boss o ricompensa 1 di 2;
- tab mobile avversario attivo al ripristino;
- formazione invalida durante ritorno da editor alla partita;
- toast multipli e multilinea sovrapposti a topbar/modal;
- Album con migliaia di svincolati e griglia lunga;
- Hall snapshot con dati parziali o vecchio schema.

## 9. Viewport di riferimento

### Matrice minima

Mobile:

- `360 × 800`
- `390 × 844`
- `430 × 932`

Desktop:

- `1366 × 768`
- `1440 × 900`
- `1920 × 1080`

### Viewport più critici per gruppo

| Gruppo | Viewport più critici | Motivo |
|---|---|---|
| Home / Season | 360×800, 1366×768 | cards lunghe e CTA sopra la piega |
| Modali nome / conferme | 360×800 | tastiera, `100dvh`, focus e safe area |
| Draft / pull | 360×800, 390×844 | tre card + azioni inline |
| Mappa | 360×800, 1366×768 | altezza proporzionale e coordinate assolute |
| Squadra / trade / assignment | 360×800, 1366×768 | 11 card, panchina, modal e action area |
| Editor 5v5 | 360×800, 1366×768 | campo + selettore + validazione |
| Match 5v5 / boss | 360×800, 1366×768 | campo, cronaca e controlli nello stesso viewport |
| Inventory | 360×800, 1440×900 | lista lunga, sticky panel desktop |
| Player Detail | 360×800, 1920×1080 | max-height mobile e fullbody grande desktop |
| Album svincolati | 360×800, 1920×1080 | griglia molto lunga e densità variabile |
| Finali / Hall | 390×844, 1366×768 | tab, statistiche, campi e azioni |

## 10. Rischi del restyle

1. **Rerender root completi:** `renderHome`, `renderSquad`, `renderMap`, `renderMatch`, `renderFiveVFive`, `renderInventory` e gli archivi sostituiscono `app.innerHTML`; ogni migrazione deve ricreare correttamente listener e ripristino scroll.
2. **Media query sovrapposte:** `css/game.css` contiene più blocchi separati `@media (max-width: 780px)` per componenti generali, boss, 5v5 e rifiniture; l'ordine nel file è parte del comportamento.
3. **Selettori globali:** `.panel`, `.btn`, `.player-card`, `.player-info`, `.topbar`, `h1/h2/h3/p` e selettori discendenti influenzano molte superfici.
4. **Classi alias sulla stessa card:** `compactPlayerCardMarkup()` applica contemporaneamente `.player-card-compact`, `.tactical-player-card`, varianti desktop/mobile e `.mini-player`; una modifica locale può propagarsi ovunque.
5. **Markup duplicato:** `fiveMatchCard`, `fiveSlotCard`, `fiveRosterCard`, `playerCard` e `compactPlayerCardMarkup` implementano parti analoghe separatamente.
6. **Style inline:** coordinate mappa (`left`, `top`, `--node-color`), conteggio righe (`--players-in-row`, `--row-count`, `--boss-row-count`, `--five-row-count`), progress bar e colori evento sono inseriti nel markup.
7. **Layout campo legato alla logica:** ordine dei ruoli, numero card per riga e data attribute sono usati per costruzione e interazioni; non sono solo decorativi.
8. **Listener ricreati:** i renderer associano listener dopo ogni `innerHTML`; alcune viste mitigano con event delegation o flag `data-bound`, altre no.
9. **Scroll complesso:** `scrollSnapshot`, `restoreScroll`, `resetRenderedViewScroll` scandiscono anche discendenti scrollabili; un nuovo overflow container cambia il comportamento.
10. **Sticky/fixed e safe area:** `.topbar` è sticky, `.modal-backdrop` fixed, `.toast-root` fixed; bottom/action bar hanno trattamenti diversi e non tutti usano `env(safe-area-inset-bottom)` nello stesso modo.
11. **Z-index distribuiti:** topbar 30, modal 100, toast 200 e variabili locali per action bar; nuovi layer possono sovrapporsi in modo inatteso.
12. **Dimensioni fisse e clamp:** campi e card usano altezze/min-height specifiche (es. campi boss/5v5) e larghezze per numero di giocatori; attenzione a zoom e testi lunghi.
13. **Uso di `:has()`:** selettori CSS della Squadra dipendono dal supporto browser e dalla struttura esatta dei figli.
14. **Fallback immagini eterogenei:** Player, team, boss e Album hanno resolver/fallback diversi; il restyle non deve rimuovere gli attributi `onerror` o i placeholder.
15. **Semantica condivisa ma regole diverse:** pull normali, legendary e boss reward usano la stessa modal; gli stati enabled/disabled dipendono dal tipo, non dalla classe root.
16. **Persistenza dei flussi:** `run.phase`, `activeMatch`, `postBossFlow`, `pullState`, `revealedType` e selezioni devono restare compatibili con refresh e vecchi save.
17. **Aggiornamenti DOM locali:** swap Squadra, assegnazione 5v5 e playback partita sostituiscono singoli nodi; cambiare wrapper o data attribute può rompere l'interazione.
18. **Accessibilità non uniforme:** alcuni tab hanno `role`/`aria-selected`, altri sono semplici button; overlay Album locked resta cliccabile; i toast non dichiarano esplicitamente un live region nel markup creato.
19. **Overflow delle modali:** campo 11v11, item assignment, trade e pull possono superare `90vh`; su mobile Player Detail ha regole proprie ma altri modali no.
20. **Prestazioni:** Album svincolati e campi ripetuti generano grandi quantità di markup; un restyle con ombre/filtri/animazioni globali può amplificare il costo.

## 11. Ordine consigliato per la futura migrazione

### Fondazioni

1. Registrare fixture deterministiche per ogni superficie e stato indicato nella sezione 8.
2. Bloccare una baseline screenshot sui sei viewport.
3. Definire token neutrali per spaziatura, tipografia, focus, layer, safe area e motion senza cambiare il layout.
4. Definire confini di scope CSS per evitare che le nuove regole tocchino schermate non migrate.

### Componenti

1. Pulsanti, panel, EmptyState, badge e logo/fallback.
2. Shell di pagina: topbar, navigazione, action bar e tab.
3. Item Card e indicatore equipaggiamento.
4. Player Card, iniziando da matrice e API varianti; mantenere temporaneamente adapter per markup legacy.
5. Campi 5v5/11v11 separando geometria visuale da dati e interazioni.
6. Modal shell, header/body/footer, Player Detail e toast.

### Schermate semplici

1. Loading ed errore.
2. Home e selezione Season.
3. Modulo iniziale e Draft.
4. Album collezioni/squadre.
5. Hall lista e Game Over.

### Schermate complesse

1. Inventario e modali item/equip.
2. Squadra e modifica titolari.
3. Editor 5v5.
4. Pull, sostituzione riserva e trade.
5. Mappa e preview boss.
6. Match 5v5.
7. Match boss e post-boss flow.
8. Album rosa, Player Detail storico, finali e Hall detail.

### Rifiniture finali

1. Test di overflow, zoom, focus, tastiera e safe area.
2. Reduced motion, contrasto per rarità e stati disabled.
3. Performance su liste lunghe e campi 11v11.
4. Confronto screenshot completo e verifica manuale dei ritorni/scroll.
5. Rimozione di CSS legacy solo dopo migrazione e copertura di tutte le fixture.

## 12. Checklist di completezza

### Copertura superfici

- [ ] Loading e load error
- [ ] Home senza run e con run
- [ ] Season vuota, attiva e ultima giocata
- [ ] Nome squadra e overwrite
- [ ] Modulo iniziale e tutti gli step draft
- [ ] Mappa con ogni stato nodo e preview boss
- [ ] Squadra normale e modalità modifica
- [ ] Editor 5v5 valido, invalido e ritorno partita
- [ ] Match 5v5 pre, simulating, victory, defeat, error
- [ ] Boss pre, simulating, victory, defeat, error
- [ ] Pull free agents, team, legendary e boss reward
- [ ] Sostituzione riserva, trade select/confirm/result
- [ ] Nodo item, random reveal, discard inventario pieno
- [ ] Inventario vuoto, pieno, filtri ed equipaggiati
- [ ] Assegnazione consumabile, boost, equip e sostituzione equip
- [ ] Player Detail current, album locked/unlocked, historical
- [ ] Album collezioni, squadre e rosa
- [ ] Hall vuoto, lista e dettaglio
- [ ] Celebrazione, riepilogo finale e Game Over

### Varianti componenti

- [ ] Tutte le 9 varianti Player Card
- [ ] Tutte le rarità e fallback immagini
- [ ] Badge ruolo, OVR, livello ed equip
- [ ] Item Card choice/inventory/discard
- [ ] Campo 5v5 editor/match
- [ ] Campo 11v11 Squadra/boss/preview/modal
- [ ] Tab, topbar, bottom nav e action bar
- [ ] Modal chiudibile/non chiudibile e toast multipli
- [ ] Empty state e messaggi errore

### Responsive e accessibilità

- [ ] 360×800
- [ ] 390×844
- [ ] 430×932
- [ ] 1366×768
- [ ] 1440×900
- [ ] 1920×1080
- [ ] safe area iPhone
- [ ] zoom e testo lungo
- [ ] focus visibile e ordine tastiera
- [ ] target touch adeguati
- [ ] `prefers-reduced-motion`
- [ ] contrasto per rarità, disabled, locked e risultati

### Integrità tecnica

- [ ] Nessuna modifica a gameplay, dataset, seed o salvataggi
- [ ] Data attribute e listener preservati
- [ ] Snapshot partita congelata dopo l'avvio
- [ ] Post-boss flow riprendibile dopo refresh
- [ ] Pull e random node senza reroll da refresh
- [ ] Scroll e focus ripristinati da modali/detail
- [ ] Nessun overflow orizzontale involontario
- [ ] Nessun CSS globale distruttivo
- [ ] Nessuna schermata migrata dichiarata completa senza screenshot su tutti i viewport critici
