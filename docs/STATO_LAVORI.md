# Stato lavori — refactor INAZUMA-ROGUELIKE

Da leggere a inizio di ogni sessione e aggiornare a fine sessione.
Piano completo: Parte B delle istruzioni (Passi 0-7). Regole permanenti: `CLAUDE.md`.

## Dove siamo

- **7 novembre 2026:** Passo 1 (CSS) chiuso; Passo 3 (eventi come dati), Passo 4 (due eventi attivi insieme) e
  Passo 3.6 (aspetto degli eventi come dati) fatti. Tutto e' nella PR finale #577 (`release/passo-1-3-6` -> `main`),
  da unire dopo le verifiche: vedi "Ordine di unione definitivo" qui sotto. Fuori: Passo 2, Passo 5 e la 3.7 (immagini
  locali di Halloween).
- **Passo 0 — Rete di sicurezza: chiuso il 3 novembre 2026** (branch `chore/safety-net`, PR in bozza
  ferro0403/INAZUMA-ROGUELIKE#540).
- **Passo 1 — CSS: in corso** (ok dell'utente il 3 novembre). PR in bozza, da unire in ordine dopo la #540:
  - **1a** ferro0403/INAZUMA-ROGUELIKE#541 `refactor/css-1-misura`: misura del CSS morto (`npm run css:usage`),
    61 schermate, baseline stabile. Nessun file del gioco modificato.
  - **1b** ferro0403/INAZUMA-ROGUELIKE#542 `refactor/css-2-file-mai-caricati`: tolti i 7 file mai caricati
    (1.656 righe, 1.441 `!important`). Screenshot 0/61 diversi, test invariati, prove 12/12.
  - **1c** `refactor/css-3-regole-morte`: tolte 390 regole morte certe (522 righe, 9 `!important`), esclusi i file
    Halloween/coach fino al 7 novembre. Screenshot 0/61 diversi, test invariati, prove 12/12.
  - **1d** `refactor/css-4-copertura`: 17 schermate in piu' con gli strumenti ?dev=1 (vittoria finale,
    celebrazione, riepilogo, Albo d'Oro con campioni, pull leggendario, oggetto equipaggiato, ricompensa IE3,
    storico evoluzioni, sviluppo/negozio/album RTG, premio distributore RTG): 78 schermate, baseline stabile
    (0/78 diverse). Regole viste in uso: 72% (prima 67%). Strumenti nuovi: impronta dello stile calcolato
    (`--styles`, `compare-styles.mjs`) e ricerca delle regole "battute" (`--rule-effect`).
    Non coperta: fine season RTG (servono reclute "recenti" non ottenibili in modo controllato).
  - **1e** `refactor/css-5-regole-battute`: tolte 1.432 regole "battute" (sempre sovrascritte da altre),
    trovate disattivandole una alla volta in modo cumulativo nelle 78 schermate a 412 px e ricontrollate a
    360/768/1280 px. Tenute 18 regole: 15 cercate dai test nel testo dei CSS, 3 su pseudo-elementi
    (::placeholder) che lo strumento non sapeva controllare (errore trovato da una foto e corretto).
    Verifica: stile calcolato identico in tutte le schermate a 412, 768 e 1280 px; foto 0/78 diverse;
    npm test invariato; prove 12/12. `!important`: 7.402 -> 6.464. Tetti dei test architettura abbassati.
    Baseline rifatta: lo script ora sposta il mouse prima della foto (prima alcune foto avevano un "hover").
  - **1f** `refactor/css-6-important`: tolti 1.660 `!important` inutili (resi normali non cambiano il valore
    calcolato). Primo tentativo fallito alla verifica (12 schermate RTG diverse): corretti tre difetti degli
    strumenti (dichiarazione normale successiva nella stessa regola; file esclusi non bloccati durante la misura;
    31 !important dei test rimessi dopo la misura invece che prima) e rimessi 3 !important del tabellone RTG
    trovati per bisezione con la verifica dello stile. Verifica finale: stile identico a 412/768/1280 px,
    foto 0/78, npm test invariato, prove 12/12. `!important`: 6.464 -> 4.804.
  - **1g** `refactor/css-7-file-patch`: i 21 file CSS "patch" uniti al loro proprietario nello stesso ordine
    di caricamento (43 -> 26 file). `game.css` (+3 patch e il blocco `<style>` di `index.html`), nuovi
    proprietari `match.css` (11 file), `player-detail.css` (4), `shop.css` (2); `trade-result-card-fix.css`
    diviso in `trade-result.css` e `rtg-halftime-penalty.css` (stessa posizione). Ogni parte unita ha
    un'intestazione "(unito da X.css il 4 nov 2026)"; i test che leggevano i vecchi file usano
    `tests/helpers/css-sections.js`. Script: `scripts/css/merge-patch-files.mjs`. Verifica: stile identico a
    412/768/1280 px, foto 0/78, npm test invariato (426/40), prove 12/12.
  - **1h** `refactor/css-8-token`: 2.676 colori e ombre ripetuti (37 colori usati 10+ volte, 21 ombre usate 5+
    volte) sostituiti con 58 variabili `--ir-*` definite una volta in testa a `game.css` (`--ir-ink` #111216,
    `--ir-yellow` #ffd21f, `--ir-paper` #fffdf6, `--ir-shadow-ink-4-5`...). Script `scripts/css/color-tokens.mjs`
    (`--report` per contare, `--apply` per sostituire; tocca solo i valori, mai selettori/stringhe/url).
    I test che cercano un colore nel CSS usano `tests/helpers/css-tokens.js`; 6 test con la chiave `?v=` aggiornati.
    `capture.mjs --styles-ignore=--ir-` confronta lo stile senza contare le nuove variabili, e la misura `--styles`
    riprende dopo un'interruzione. Verifica: stile identico a 412/768/1280 px, foto 0/78, npm test invariato, 12/12.
    Nota: il container si spegne se la sessione resta senza un comando seguito; le misure lunghe vanno lanciate
    come comando in background seguito dalla sessione.
  - **1i** `refactor/css-9-halloween-coach` (ok dell'utente anche prima del 7 novembre, PR separata): in
    `rtg-halloween-event.css` e `rtg-coaches.css` tolte 87 regole morte certe, 54 regole battute (55, una rimessa
    perche' cercata da un test), 320 `!important` inutili (389, 69 rimessi perche' cercati dai test) e 129 valori
    passati ai token `--ir-*`. Misure fatte con tutti gli altri file bloccati (`--frozen`). Verifica: stile identico
    a 412/768/1280 px (una differenza a 1280 nella schermata 70 non si ripete rifacendo la misura: misura instabile,
    non CSS), foto 0/78, npm test invariato (426/40), prove 12/12. `!important` totali: 4.804 -> 4.371.
  - **Regressioni viste nelle preview (5 nov) e correzioni.** Quattro difetti in schermate che le 78 della misura
    non visitavano. Trovati per bisezione con prove nel browser vero:
    - avatar quadrati nel Riepilogo azioni RTG e capsule del distributore ammucchiate -> da #545 (regole
      "battute" solo nelle schermate visitate; la regola delle capsule agiva solo con le animazioni attive).
      Correzione ferro0403/INAZUMA-ROGUELIKE#552.
    - carte del potere allenatore allargate (`.pitch-row` grid -> flex) + 34 `!important` che bloccavano
      `:hover`/`:focus`/`:active` -> da #546. Correzione ferro0403/INAZUMA-ROGUELIKE#553.
    - scheda giocatore Halloween chiara (Shawn) -> da #549: senza la classe `halloween-detail-native` sul modale
      valgono le regole generiche, tolte come "battute". Correzione ferro0403/INAZUMA-ROGUELIKE#554.
    - #547 (unione dei file) verificata: l'ordine delle 7.855 regole applicate dal browser e' identico a prima.
    - Le correzioni sono state unite anche nei branch successivi (#546-#549 contengono quelle precedenti).
    - Copertura e controllo hover/animazioni: ferro0403/INAZUMA-ROGUELIKE#555.
    - **Lezione:** "battuta" e "!important inutile" valgono solo per gli stati misurati. Animazioni, hover e
      percorsi diversi (classi messe dal JS) vanno controllati a parte; foto e stile non bastano.
  - **Fine Season RTG (5 nov, segnalazione utente):** "Traguardo raggiunto" sotto il cerchio in tutte le Season, da
    #546 (font-size del titolo non piu' !important). Correzione ferro0403/INAZUMA-ROGUELIKE#556 (+3 !important delle
    mappe Season 2/3); 2 regole della fine campagna/mappe S2-S3 tolte da #545 aggiunte a #552; 4 !important del testo
    Halloween in home aggiunti a #554. Comando ?dev=1 "FINE SEASON" e 4 schermate: ferro0403/INAZUMA-ROGUELIKE#557.
    A 1280 px la fine Season e' rotta anche in main (problema esistente, non toccato).
  - **Pulizia CSS fermata qui (decisione dell'utente, 5 nov).**
  - Altre PR del 5 nov: ferro0403/INAZUMA-ROGUELIKE#550 (commento rotto in `rtg-run.css`, cambio visibile voluto),
    ferro0403/INAZUMA-ROGUELIKE#551 (tolti 8 script di migrazione e 3 workflow legati a `refactor/rtg-css-cleanup`).
  - `dynamic-progression-legacy-parity-test.js` (non toccato): i 4 giocatori tolti da IE1 il 13 set (commit
    `c54483d`) sono Trice Topper (4461), Gideon Poe (4477), Electra Faraday (4482), Darren Gouger (4484), ora in
    `removedPlayers` di `data/IE1_season_compact.json`.
  - Passo 3 (eventi come dati): fatte 3.1-3.5 il 5-6 novembre, vedi sotto. PR finale #566 (`release/passo-1-3`).
  - `!important`: 8.852 all'inizio → 7.402 dopo 1c → 6.464 dopo 1e → 4.804 dopo 1f → 4.371 dopo 1i.
    Dopo le correzioni del 5 nov (regole e `!important` rimessi): **4.504** nella PR finale; file CSS 50 → 27.

## Passo 3.6 — Aspetto degli eventi come dati (approvato il 7 nov 2026, fatto il 7 nov)

Obiettivo: per un evento nuovo non si ricrea niente di condiviso. Squadra, Allenatori e Collezione restano comuni; le
carte normali non cambiano; le carte dell'evento hanno la base comune (striscia della rarita' uguale) e cornice, sfondo,
badge e bordi dell'evento; home, banner, colori, sfondi, moneta, pannelli e distributore vengono dal file dell'evento.
Decisioni dell'utente (7 nov): Halloween e' concluso, il suo aspetto fuori dalle carte si semplifica; le carte Halloween
(cornice, colori, striscia, badge HW, vampiri) e i loro dati restano identici. Dopo ogni PR: push, controllo dell'utente
sulla preview, poi la successiva. Fuori: Passo 2, Passo 5, 3.7.

| PR | Cosa | Stima | Stato |
|---|---|---|---|
| 3.6a | Grafica comune degli eventi: 7 colori base in `theme.colors` del file; schermate, ingresso e finestre dell'evento li usano | 3-4 h | fatta (#573), vista dall'utente |
| 3.6b | Carte, schede e allenatori dell'evento: pelle base con i colori dell'evento, oppure la pelle nominata nel file (`theme.skin`, Halloween); carte Halloween e Hekyll identici in 8 schermate (stile di ogni elemento); 10 schermate interne di Halloween cambiano solo nello sfondo | 3-4 h | fatta (#574), ~2,5 h |
| 3.6c | Distributore e moneta: le 25 regole del distributore dell'evento (macchina, capsule, portafoglio, apertura) usano i colori base; moneta con forma e fusione dal file (`theme.coin`); carte Halloween identiche (8 schermate); distributori delle stagioni identici | 2 h | fatta (#575), ~1,5 h |
| 3.6d | Pezzi aggiuntivi: un evento elenca i suoi file (`extensions`, in `js/events/<id>/`) che si agganciano a punti fissi (classi in piu' sulle carte, riquadro nella home); i vampiri sono il pezzo di Halloween (carte identiche in 8 schermate); evento di prova con aspetto completo suo (colori, sfondi, gettone e stemma propri, distributore, carte blu) e un riquadro di esempio | 3 h | fatta (#576), ~3 h |

### Correzioni dopo la preview della #577 (Parte 1, 7-8 nov 2026)

| PR | Problema | Causa (in breve) | Correzione |
|---|---|---|---|
| 3.6e | Finestre di sblocco con l'arancio di Halloween | 16 regole delle finestre dell'evento escluse dalla 3.6c perche' il loro nome conteneva "card"/"reveal"; la finestra "Nuovo allenatore" usa l'arancio comune RTG | colori base dell'evento; "Nuovo allenatore" degli allenatori con pelle base nei colori dell'evento; test: nessuna finestra dell'evento con colori fissi |
| 3.6f | "0 di 0" con il filtro "Prova" nelle run RTG | Le carte dell'evento di prova stanno solo nel suo salvataggio locale `dev:` (mai nell'account vero, come deciso); le run RTG leggono l'account vero. Per gli eventi veri la regola funziona gia' | test: carte evento giocabili in tutte e 5 le Season RTG (resolver vero) e prova nel browser in entrambe le campagne |
| 3.6g | Allenatori senza immagine (David Arrows, Mister Yi) | Immagini e collegamento giusti; Safari non disegna un ritratto bloccato (filtro grigio) fuori dalla parte visibile della finestra che scorre: sono le carte piu' in basso | ogni ritratto bloccato su un suo livello di disegno, aspetto identico; test |

Scelta aperta della 3.6g (presa da me, come richiesto):
- **Scelta:** livello di disegno proprio per ogni ritratto bloccato (`transform:translateZ(0)`), rimedio abituale per questo
  difetto di Safari. **Pro:** nessun cambio di aspetto (foto identiche). **Contro:** non verificabile qui (il container non
  ha WebKit): va controllato sul telefono. **Se non basta:** estendere a tutti gli allenatori bloccati la tela gia' usata
  per René Gadé (provata sul telefono), che pero' cambia un poco il grigio dei ritratti bloccati.
  **Come tornare indietro:** non unire la 3.6g o togliere la regola in `css/rtg-coaches.css` (commento "7 nov 2026").
- **Run classiche (non RTG):** non usano le carte degli eventi in nessun modo (nessun codice delle run classiche legge le
  carte acquisite RTG): non c'e' una regola da cambiare.

Foto: oltre alle 88 schermate di prima, 5 nuove con le carte Halloween nelle schermate RTG comuni (97-101: collezione
nell'album, scheda dall'album, cambio giocatore RTG, allenatori RTG, album allenatori), con un account che possiede le
18 carte e Hekyll. Dal 7 nov Halloween e' concluso davvero: test e foto usano l'ora degli eventi del 3 nov.

## Parte 2 — Eventi molto diversi tra loro (piano dell'8 nov 2026, approvato in anticipo dall'utente)

Obiettivo: aggiungere in futuro eventi diversi senza rifare le parti comuni.
- **Comune per tutti (solo alcuni colori dall'evento):** sezione Squadra (carte, grafica, schede), partita, distributore
  (stessa meccanica; colori per distributore, premi, finestre di sblocco).
- **Libero per ogni evento:** home e schermate proprie, numero di squadre e di monete, meccaniche nuove (es. una schermata
  che consuma carte e ne crea altre), uso di carte di un altro evento senza rompere l'isolamento.

| PR | Cosa cambia | Stima |
|---|---|---|
| (a) | Piu' squadre e piu' monete in un evento. Nel file: `teams` (elenco) accanto a `team`, `currencies` accanto a `currency`; ogni carta dice la sua squadra; prezzi e premi dicono la loro moneta. Il saldo di ogni moneta sta nello stato dell'evento (`shared.events.<id>`), un campo per moneta. Halloween resta con una squadra e una moneta, identico | 4-5 h |
| (b) | Home e schermate proprie: il pezzo aggiuntivo di un evento puo' dare la sua home (`home`) e le sue schermate (`screens`). La parte comune offre solo strumenti: saldo, carte possedute, pesca (il distributore comune), aprire la squadra (la sezione Squadra comune), avviare una partita contro una squadra, salvare dati propri dell'evento, consumare/dare carte del proprio evento. L'evento di prova li usa tutti: home diversa da Halloween, due squadre, due monete, e una schermata "Laboratorio" che consuma 2 carte dell'evento e ne crea un'altra | 5-6 h |
| (c) | Carte di un evento usabili da un altro: nel file `uses.cardsFrom` (es. l'evento di prova usa le carte di Halloween). Si possono vedere e schierare; non si possono consumare ne' cambiare; poteri, stati e salvataggi restano separati | 2-3 h |

**Totale: circa 11-14 ore.**

Rischi e controlli:
- **Il modulo eventi e' grande (1.500 righe):** passare da "una squadra, una moneta" a "piu' squadre e monete" tocca molti
  punti. Controlli: Halloween identico (foto, stile delle carte elemento per elemento, test delle 18 carte e dei numeri).
- **Salvataggio:** cambia solo per gli eventi che usano le novita' (campi aggiunti in `shared.events.<id>`); Halloween e
  chi non le usa non vede nessun campo nuovo (test con un salvataggio vecchio, anche con due eventi).
- **Codice dei pezzi aggiuntivi:** un errore nella home di un evento non deve fermare il gioco: si torna alla home comune.

Come tornare indietro: ogni passo e' una PR separata a catena; non unendola si resta al passo prima. Nessuna migrazione
del salvataggio.

## Ordine di unione definitivo (aggiornato il 7 nov 2026, dopo il Passo 3.6)

**Da unire in `main`: una sola PR, la finale `release/passo-1-3-6` -> `main` (#577).** Sostituisce la #572 e la #566.
Contiene, controllato commit per commit:
1. Passo 0 e Passo 1 (CSS): #540-#559, con #550 e #551;
2. Passo 3, eventi come dati: #560-#565 (gia' nella vecchia finale #566);
3. Passo 4, due eventi attivi insieme: #567-#571 (gia' nella finale #572);
4. Passo 3.6, aspetto degli eventi come dati: #573 (3.6a), #574 (3.6b), #575 (3.6c), #576 (3.6d);
5. questo documento.

`main` e' antenato del ramo finale: nessun conflitto.

**Da chiudere senza unire, dopo aver unito la #577** (il loro contenuto e' gia' in `main`): #540-#576, comprese le
vecchie PR finali #566 e #572.

Prima di unire, controllare nell'anteprima della #577:
- `?dev=1&oraEvento=2026-11-07`: Halloween e' concluso;
- `?dev=1&evento=prova_dev`: due eventi, ognuno con il suo aspetto;
- carte Halloween (squadra, album, collezione, Hekyll, vampiri) identiche.

## Passo 3 — Eventi come dati (approvato il 5 nov 2026)

Proposta e analisi: `docs/PASSO_3_EVENTI.md` (PR #560). Risposte dell'utente: via libera; poteri degli allenatori
identici (test prima/dopo); nessun numero di Halloween cambia (200/300/600/10%); inizio evento = primo commit
dell'evento su main (**647c4672, 28 ott 2026 01:38:58 ora italiana**); salvataggio `shared.events.<id>` solo come campo
aggiunto, Halloween resta in `shared.halloween`, test con salvataggio vecchio, l'evento finto non scrive mai
sull'account reale; tema opzione A; immagini esterne per ora restano. Niente in `main`: tutto su
`release/passo-1-css`, unisce l'utente alla fine.

### Ordine delle PR (ognuna si appoggia alla precedente; la catena finisce in `release/passo-1-css`)

| # | PR | Cosa cambia | Ci si puo' fermare qui? |
|---|---|---|---|
| 3.1 | #561 registro Season | etichette, sigle, campagne delle 5 Season in un solo posto (`rtg-config.js`) | si': una Season nuova si scrive in un posto solo |
| 3.2 | #562 evento nei dati | `data/events/halloween2026.json` + registro eventi; Halloween legge date, prezzi, premi, squadra, carte, immagini dal file; test dei dati | si': i numeri dell'evento sono nel file, controllati dal test |
| 3.3 | #563 poteri come dati | registro dei tipi di potere; Hekyll e `powerReady` dai dati; test di comportamento prima/dopo | si': un allenatore con un potere esistente si aggiunge con i dati |
| 3.4 | #564 modulo evento generico | via `halloween2026`/`occult-2`/`HW` scritti negli altri ~20 file; `shared.events.<id>` per gli eventi nuovi; test salvataggio vecchio | si': il sistema e' generico |
| 3.5 | #565 evento finto + test | evento di prova solo in `?dev=1`, mai scritto sull'account reale; prova nel browser; copertura | prova finale del passo |
| 3.6 | tema (opzione A) | CSS tema `--event-*` per gli eventi nuovi; carta/scheda/badge Halloween sulle variabili | rimandata (decisione del 6 nov) |
| 3.7 | immagini locali | rimandata (decisione del 5 nov) | — |

Il vantaggio principale arriva con 3.1-3.3; 3.4-3.5 rendono il sistema davvero generico.

### Passo 3: risultato finale (6 nov 2026)

Fatte 3.1-3.5. Restano fuori, per decisione dell'utente del 6 nov: 3.6 (tema) e 3.7 (immagini locali).
La proposta di partenza resta in `docs/PASSO_3_EVENTI.md` (le stime di tempo li' sono quelle del 5 nov).

| Controllo | Risultato |
|---|---|
| `npm test` | 471 test: **432 passati, 39 falliti**. Sono gli stessi 39 gia' rossi in `release/passo-1-css` (gruppo 2, `dynamic-progression-legacy-parity` e gli altri noti): nessun test peggiorato. 5 test nuovi: `rtg-season-registry`, `event-manifest`, `coach-power-parity`, `event-save-compat`, `event-registry-load` |
| Parita' dei poteri degli allenatori | `tests/coach-power-parity-test.js`: **1.861 casi identici** al codice di prima (tutti gli 11 allenatori + uno sconosciuto, squadra e prepartita), verde a ogni push |
| Numeri di Halloween | `tests/event-manifest-test.js`: prezzo 200, premi 300/600, 10%, fine 6 nov 23:59:59, inizio 647c4672, 18 carte (14 Forte, 2 Elite, 2 Leggenda), Shawn invariato: verde a ogni push |
| Salvataggio | `tests/event-save-compat-test.js`: un salvataggio vecchio da' nel cloud lo stesso risultato del codice di prima (impronta registrata con il Passo 3.3); `shared.events.<id>` solo aggiunto; Halloween in `shared.halloween`. Regole Firestore non toccate |
| Prove nel browser | **13/13** (le 12 di prima + `12-evento-finto`: l'evento finto non scrive mai `shared:account`, controllato anche con un guasto voluto) |
| Foto e stile calcolato | Identici a `release/passo-1-css`: 12 schermate Halloween, 5 album, squadra RTG, allenatori RTG, 4 sviluppo (3.4 e di nuovo 3.5); 4 allenatori, 2 potere, distributore allenatori (3.3 e di nuovo dopo la correzione della scheda allenatori). 0 schermate diverse |

Cosa e' cambiato nel comportamento (voluto):
- **Avvio:** se `data/events/index.json` non si carica, il gioco riprova una volta e poi si ferma con "Impossibile caricare i dati del gioco…".
  Prima partiva lo stesso, ma senza l'elenco degli eventi le carte Halloween sarebbero state lette come carte IE1.
- **Evento finto:** esiste solo con `?dev=1&evento=prova_dev`.

Restano nel codice:
- **Hekyll Jyde nel catalogo allenatori** (`rtg-coaches.js`, 1 riga: `halloween-coach-54` e `seasonId:"halloween2026"`).
  E' una dipendenza vera: `rtg-state.js` tiene nel salvataggio solo gli allenatori del catalogo e rifiuta quelli sconosciuti.
  Se l'allenatore fosse preso solo dal file dell'evento e quel file non si caricasse, l'allenatore sparirebbe dall'account.
  Toglierla vuol dire cambiare le regole del salvataggio: si fa solo con l'ok dell'utente.
  `event-manifest-test` controlla che nome e potere coincidano con il file dell'evento.
- I testi dell'ingresso evento ("EVENTO HALLOWEEN", "ZUCCHE HALLOWEEN") e le classi CSS `halloween-*`: sono il lavoro del 3.6.

### Cosa unire, in ordine (superato: vedi "Ordine di unione definitivo" in alto)

**Consigliato: una sola PR, la finale #566 (`release/passo-1-3` -> `main`).** Contiene, controllato commit per commit:
1. Passo 0 e Passo 1: #540-#558, tutto quello che c'e' in `release/passo-1-css` (#559);
2. proposta del Passo 3 (#560, solo documenti);
3. 3.1 #561 -> 3.2 #562 -> 3.3 #563 -> 3.4 #564 -> 3.5 #565 (ognuna contiene la precedente);
4. #550 (commento rotto in `rtg-run.css`) e #551 (script di migrazione) sono gia' dentro #559.

Dopo averla unita, le PR #540-#565 si chiudono senza unirle: il loro contenuto e' gia' in `main`.

Se invece si vuole unire una PR alla volta, l'ordine e' questo, e ognuna va unita nel ramo su cui punta:
#559 in `main`, poi #561 in `release/passo-1-css`, #562 in #561, #563, #564, #565, infine #560.
In pratica e' piu' semplice unire solo la finale.

Prima di unire: le verifiche con l'evento finito, dopo il 6 nov alle 23:59 italiane. Evento chiuso; carte, allenatore,
potere e scheda Halloween ancora corretti in squadra e album.

## Passo 4 — Due eventi attivi insieme (stima del 6 nov 2026, approvata; fatto il 6-7 nov)

Richiesta: due eventi attivi insieme, ognuno con il suo ingresso nelle campagne. Halloween resta identico (200/300/600/10%,
stessa partita, `shared.halloween`). L'evento finto ha id, squadra, carte, allenatore e valuta propri, sta accanto a
Halloween e non scrive mai sull'account reale. Ogni potere riconosce solo le carte del proprio evento.
PR da `release/passo-1-3` verso `release/passo-1-3`; niente in `main`.

### Cosa succede oggi (misurato)
- **Un solo modulo evento per volta.** `rtg-halloween-event.js` (1.537 righe) crea un solo oggetto globale
  `RoadToGloryHalloween`. Lo usano altri 5 file, tutti come se esistesse un solo evento: ingresso nelle campagne
  (`rtg-run-view.js`), apertura (`rtg-controller.js`, 4 punti), album (`rtg-album-controller.js`), carte
  (`rtg-player-resolver.js`, 2 punti), premio finale (`rtg-halloween-completion-reward.js`).
  Con `?evento=prova_dev` si installa l'evento finto **al posto** di Halloween, per questo la scheda "EVENTO HALLOWEEN"
  mostra la scadenza dell'evento finto (84 giorni).
- **Hekyll non riconosce i giocatori Halloween con `?evento=prova_dev` (causa trovata).** L'evento finto usa lo stesso
  allenatore di Halloween (`halloween-coach-54`). Il potere viene letto dal primo evento caricato che ha
  quell'allenatore, e in quella modalita' il primo e' l'evento finto. Risultato: Hekyll riconosce solo le carte
  `prova_dev::`. Verificato: gioco normale -> `halloween2026::`, con l'evento finto -> `prova_dev::`.
- **Testi fissi.** Nel modulo ci sono ~25 testi visibili scritti per Halloween: "🎃 EVENTO HALLOWEEN",
  "ZUCCHE HALLOWEEN", "DISTRIBUTORE STREGATO", "Occult Halloween", "zucche", "PREMIO HALLOWEEN ACCREDITATO",
  "ALBUM → EVENTO HALLOWEEN"... Ci sono anche gli attributi `data-halloween-*` e le classi `halloween-*`.
- **Ora dell'evento.** `Date.now()` compare 3 volte nel modulo (apertura e conto alla rovescia) e una volta nel premio
  finale.

### PR proposte (in ordine; ognuna si appoggia alla precedente)

| # | PR | Cosa cambia | Stima | Ci si puo' fermare qui? |
|---|---|---|---|---|
| 4.1 | Hekyll + ora dell'evento | Il potere di un allenatore si legge dal **suo** evento. Il registro rifiuta lo stesso allenatore in due eventi. L'evento finto riceve un allenatore e una valuta propri: l'allenatore e' visibile solo in sviluppo e posseduto solo nel salvataggio `dev:`. `?dev=1&oraEvento=2026-11-07` sposta solo l'ora usata dagli eventi (apertura, conto alla rovescia, premio finale); l'orologio del dispositivo non cambia e nell'account non si scrive niente. Test: il caso di Hekyll (punto 3) e l'ora dell'evento | 1,5-2 h | **Si'**: Hekyll funziona con Halloween anche con l'evento di prova, e le verifiche "evento finito" si possono fare anche prima delle 23:59 |
| 4.2 | Squadra e carte proprie dell'evento finto | File dati in `data/events/dev/` (giocatori, formazione, 4 mosse per carta) presi da una squadra gia' esistente nei dati, con id squadra, nome e carte propri. Il test dei dati controlla anche questi file | 1-1,5 h | Si': l'evento finto non condivide piu' niente con Halloween |
| 4.3 | Modulo a istanze + un ingresso per evento | Il modulo crea un'istanza per ogni evento attivo, ognuna con le sue chiavi di salvataggio. `RoadToGloryHalloween` resta come nome dell'istanza Halloween, cosi' il codice esistente non cambia. Carte, scheda giocatore, album e apertura scelgono l'istanza giusta dal prefisso della carta o dall'id dell'evento (`data-rtg-event-open="<id>"`). Nelle campagne compare un ingresso per ogni evento attivo, ognuno con la sua scadenza. Il premio finale vale per l'evento che lo ha. L'evento finto non sostituisce piu' Halloween, gli si affianca. Test automatici con due eventi insieme: due ingressi, date di fine diverse, nessuna interferenza tra carte, poteri e salvataggi, salvataggio vecchio invariato. Prova nel browser con i due eventi | 4-6 h | Si': due eventi insieme funzionano. L'evento finto pero' mostra ancora i testi di Halloween |
| 4.4 | Etichette dal file dell'evento | I ~25 testi fissi si leggono dal file dell'evento (`labels`, `currency.name`, `team.name`). Halloween resta con gli stessi testi: lo controllano le foto e lo stile identici sulle 12 schermate Halloween. L'id del nodo partita salvato (`event:occult-halloween`) diventa un campo del file con lo stesso valore, cosi' le partite gia' salvate restano valide | 1,5-2 h | Fine del lavoro richiesto |

**Totale: 4 PR, circa 8-11 ore di sessione.** La parte piu' lunga e rischiosa e' la 4.3. Come nel Passo 3, le verifiche
(foto e stile sulle schermate Halloween, album e allenatori, `npm test`, prove nel browser) pesano quanto il codice.

### Cosa resta uguale e cosa no
- **Halloween:** numeri, partita, salvataggio (`shared.halloween`) e schermate identici. Il test di parita' dei poteri
  (1.861 casi) e quello dei numeri di Halloween restano verdi a ogni push.
- **Salvataggio:** solo campi aggiunti. Gli eventi nuovi usano `shared.events.<id>`; l'evento finto scrive solo nelle
  chiavi locali `dev:<id>:...`, mai `shared:account` e quindi mai il cloud. Il test con il salvataggio vecchio viene
  esteso al caso dei due eventi.
- **Fuori da questo lavoro:** il tema grafico (3.6). L'evento finto avra' testi e allenatore propri, ma i colori e lo
  stile delle carte di Halloween (classi `halloween-*`) finche' non si fa il tema.
- **Rischio principale (4.3):** i punti che oggi danno per scontato un solo evento, cioe' l'apertura nel controller
  RTG, l'album e le carte nella scheda giocatore. Per ognuno ci sara' un test con due eventi.
- **Da decidere (non bloccante):** l'allenatore dell'evento finto. Proposta: un allenatore gia' esistente nelle immagini
  ma senza potere, con il potere "Maschera Maledetta" su carte `prova_dev::` e uno sconto diverso, per esempio 10, cosi'
  il test distingue i due poteri. Visibile solo con `?dev=1&evento=prova_dev`.

### Passo 4: risultato finale (7 nov 2026)

| PR | Cosa cambia |
|---|---|
| #568 4.1 | Hekyll con l'evento di prova (causa: l'evento finto riusava Hekyll, ora un allenatore sta in un solo evento); allenatore e valuta propri dell'evento di prova (l'allenatore finto mai nel catalogo reale ne' nel salvataggio); `?dev=1&oraEvento=` |
| #569 4.2 | Squadra "Angeli di prova" (gli 11 Dark Angels con le loro 4 mosse dal database RTG) e carte proprie |
| #570 4.3 | Un'istanza del modulo per evento, un ingresso per evento nelle campagne, l'evento di prova accanto a Halloween; correzione del 7 nov: 11 avversari in ogni evento (la formazione viene dal file dell'evento, prima era sempre 4-4-2 e se ne vedevano 9) |
| #571 4.4 | Titolo, immagine, ~45 testi e valuta dal file di ogni evento; Halloween identico, l'evento di prova si distingue in Campagne |

| Controllo | Risultato |
|---|---|
| `npm test` | 474 test: **435 passati, 39 falliti**. Sono gli stessi 39 gia' rossi prima del Passo 3, nessun peggioramento. Test nuovi: `event-coach-isolation`, `event-two-active`, `event-starters` |
| Parita' dei poteri | **1.861 casi identici**, verde dopo ogni PR |
| Numeri di Halloween | verdi dopo ogni PR (200/300/600/10%), con in piu' i testi di Halloween identici a quelli che erano nel codice |
| Salvataggio vecchio | identico a prima (impronta del cloud), anche con due eventi attivi; Halloween solo in `shared.halloween`, evento di prova solo in chiavi locali `dev:` |
| Prove nel browser | **15/15**: comprese `08b` (Hekyll con l'evento di prova attivo), `12-evento-finto` (due ingressi, carte e saldi separati, account vero invariato) e `13-ora-evento` (Halloween chiuso, evento di prova aperto e apribile) |
| Foto e stile calcolato | identici a prima su 12 schermate Halloween, 5 album, 4 allenatori, 2 potere (dopo ogni PR) |

Differenze rispetto alla stima:
- i testi da spostare erano circa 45 e non 25;
- `rtg-album-controller.js` non e' cambiato, perche' apre gia' Halloween; e' cambiato invece `rtg-album-view.js`, che con
  l'evento di prova attivo continua a mostrare l'evento vero.

Restano fuori:
- il tema grafico (3.6): l'evento di prova ha ancora i colori di Halloween;
- le immagini locali di Halloween (3.7);
- Hekyll nel catalogo allenatori, una dipendenza del salvataggio spiegata sopra.

## Come unire le PR #540–#558 (aggiornato il 5 nov 2026)

**Consigliato: unire solo la PR finale (`release/passo-1-css` -> `main`).** E' l'unico branch che contiene
tutte le PR da #540 a #558 (controllato commit per commit). Unendola, `main` riceve tutto in una volta; dopo,
le PR #540–#558 si possono chiudere senza unirle (il loro contenuto e' gia' in `main`).

Verifica della PR finale **contro `main`** (non contro la PR precedente):
- stile calcolato di ogni elemento e foto di 88 schermate (78 + 10 nuove) a 412 e 1280 px: identici a `main`,
  tranne il riquadro dei requisiti RTG (#550, cambio voluto). Una foto (65, sconfitta RTG) differiva solo perche'
  in `main` lo stemma Occult non era ancora caricato: stile identico.
- `npm test`: 427 passati, 39 falliti; nessun test peggiorato rispetto a `main` (9 migliorati dal Passo 0).
- prove nel browser 12/12.

### Come sono collegate

| PR | Branch | Base | Contenuto | Rapporto con le altre |
|---|---|---|---|---|
| #540 | `chore/safety-net` | main | Passo 0: test, prove nel browser, baseline | base della pila |
| #541 | `refactor/css-1-misura` | #540 | misura CSS morto | — |
| #542 | `refactor/css-2-file-mai-caricati` | #541 | 7 file mai caricati tolti | — |
| #543 | `refactor/css-3-regole-morte` | #542 | 390 regole morte certe | **da sola ha 1 difetto** (capsula `.c14`), corretto da #558 |
| #544 | `refactor/css-4-copertura` | #543 | 78 schermate, strumenti | contiene #558 |
| #545 | `refactor/css-5-regole-battute` | #544 | regole "battute" tolte | contiene #558; **da sola ha difetti**, corretti da #552 |
| #546 | `refactor/css-6-important` | #545 | `!important` inutili tolti | contiene #552, #558; **da sola ha difetti**, corretti da #553 e #556 |
| #547 | `refactor/css-7-file-patch` | #546 | file patch uniti | contiene #552, #553, #556, #558 |
| #548 | `refactor/css-8-token` | #547 | token colori | contiene #552, #553, #556, #558 |
| #549 | `refactor/css-9-halloween-coach` | #548 | pulizia file Halloween/coach | contiene #552, #553, #556, #558; **da sola ha difetti**, corretti da #554 |
| #550 | `fix/rtg-run-commento-rotto` | main | commento rotto (1 riga, cambio visibile voluto) | indipendente |
| #551 | `chore/rimuovi-migrazioni-css` | main | script/workflow di migrazione tolti | indipendente |
| #552 | `fix/css-5-regole-necessarie` | #545 | correzione di #545 (5 regole) | gia' dentro #546–#549 |
| #553 | `fix/css-6-potere-allenatore` | #546 | correzione di #546 (36 `!important`) | gia' dentro #547–#549 |
| #554 | `fix/css-9-scheda-halloween` | #549 | correzione di #549 | contiene #540–#549, #552, #553, #556, #558: **sostituisce #549** |
| #555 | `test/copertura-regressioni` | #549 | 6 schermate + controllo hover | solo strumenti |
| #556 | `fix/css-6-fine-season` | #546 | correzione di #546 (fine Season) | gia' dentro #547–#549 |
| #557 | `dev/rtg-fine-season` | #555 | comando dev "FINE SEASON" + 4 schermate | contiene tutto tranne #550, #551, #554 |
| #558 | `fix/css-3-capsula-c14` | #543 | correzione di #543 | gia' dentro #544–#549 |
| finale | `release/passo-1-css` | main | tutto | **contiene tutte, #540–#558** |

"Sostituisce / contiene" vuol dire: unendo quella PR si hanno gia' le PR elencate, che quindi non vanno
unite a parte. Solo la PR finale contiene anche #550 e #551 (partono da `main`).

### Se invece si vuole unire una PR alla volta
Ordine esatto. Ogni correzione va unita nel branch della PR che corregge, **prima** di unire quella PR:
1. #540 -> main
2. #541 -> main, poi #542 -> main
3. #558 -> branch di #543, poi #543 -> main
4. #544 -> main
5. #552 -> branch di #545, poi #545 -> main
6. #553 e #556 -> branch di #546, poi #546 -> main
7. #547 -> main, poi #548 -> main
8. #554 -> branch di #549, poi #549 -> main
9. #555 -> main, poi #557 -> main
10. #550 e #551 -> main. #550 da' un conflitto di una riga se unita dopo #548: tenere la riga con i token e
    togliere quella del commento rotto (come nella PR finale).
GitHub sposta la base di una PR su `main` quando la sua base viene unita; se non lo fa, cambiarla a mano.

## Scoperte del Passo 1

- **7 file CSS non vengono mai caricati** (`rtg-foundation`, `rtg-shell`, `rtg-match`, `rtg-prematch`,
  `rtg-vending`, `rtg-economy`, `rtg-squad`: 1.656 righe, 1.441 `!important`). Sono i "proprietari" previsti da
  `docs/RTG_CSS_ARCHITECTURE.md`: la vecchia migrazione ci ha scritto dentro, ma non li ha mai collegati a
  `index.html`. Ecco perche' si e' fermata: chi modifica quei file non vede nessun effetto nel gioco.
  Gli script `scripts/rtg-cleanup-*.mjs`, `rtg-final-residual-css.mjs`, `rtg-migrate-shell-shared-css.mjs` e i
  workflow `rtg-css-migrate.yml` / `rtg-squad-migrate.yml` erano migrazioni "una tantum" legate a branch vecchi.
- **Misura del CSS caricato** (`docs/CSS_MORTO.md`): 9.587 regole; 63% usate nelle schermate visitate,
  5% morte certe (classi che non esistono nel codice), 32% non viste (da controllare caso per caso).
- **Difetto reale in `css/rtg-run.css` riga 129**: un pezzo di commento rimasto a meta' (`power remains XI-only. */`)
  rende invalida la regola `.rtg-requirements { padding: 12px }`, che il browser ignora. Non corretto: farlo
  cambierebbe l'aspetto dei requisiti RTG (decide l'utente).
- Foto instabili trovate e corrette nello script: immagini caricate in ritardo (ora si scatta quando due foto
  consecutive sono identiche), seme della campagna RTG da `crypto.randomUUID` (ora con seme fisso anche
  `crypto`), messaggi a comparsa (nascosti nelle foto). **La baseline va rigenerata** (non ancora fatto).
- Copertura della misura (3 nov): 61 schermate + 11 prove nel browser. Visti: partite 5v5/boss/speciale in corso
  e finite, boss vinto e perso, game over, evento casuale, intervallo, rigori, vittoria e sconfitta RTG, partita
  Halloween, pop-up principali. **Non visti** (servono progressi lunghi): vittoria finale (boss 10), celebrazione
  e riepilogo finale, Albo d'Oro con squadre, fine season RTG / campagna completata, sviluppo/negozio/album RTG,
  evoluzioni gia' fatte (storico), equipaggiare un oggetto, risultato di uno scambio, panchina/sostituzioni 11v11,
  pull leggendario, ricompensa IE3 secondaria, layout desktop.
- Cancellazioni 1b e 1c approvate dall'utente il 3 novembre ("fai tutti e 2").

## Comandi

| Comando | Cosa fa | Durata |
|---|---|---|
| `npm test` | tutti i test Node in `tests/*.js` tranne i 3 lunghi, 4 alla volta, timeout 180 s ciascuno | ~4 min |
| `npm run test:soak` | solo i 3 test lunghi (timeout 30 min ciascuno) | da 5 a 30+ min |
| `npm run test:browser` | le 11 prove nel browser (Playwright), vedi sotto | ~6,5 min |
| `npm run screenshots` | 48 screenshot 412x915 in `test-results/screenshots/current/` | ~6 min |
| `npm run css:usage` | misura il CSS morto e riscrive `docs/CSS_MORTO.md` | ~15 min |
| `node scripts/screenshots/compare.mjs tests/visual-baseline test-results/screenshots/current` | confronto con la baseline, immagini "diff" in `test-results/screenshots/diff/` | ~1 min |

Filtri: `npm test -- halloween`, `npm run test:browser -- boss`, `npm run screenshots -- --only=halloween`.

## Fatto nel Passo 0

- `CLAUDE.md` nella radice (Parte C delle istruzioni, invariata).
- `package.json` (nessuna dipendenza, nessuno script `build`): `npm test`, `test:soak`, `test:browser`, `screenshots`.
- Triage dei test con causa: `docs/TRIAGE_TEST.md`.
- Corretti, toccando solo file in `tests/`: 4 test del gruppo 4 (ordine di caricamento, finto gioco) e 4 test
  della rarita' Aurico (gruppo 3).
- **Baseline screenshot** in `tests/visual-baseline/` (33 PNG + `report.json`), con immagini del gioco caricate.
  Verificata ripetibile: due catture dello stesso codice danno 0 differenze.
- **Nucleo di 11 prove nel browser** in `tests/browser/` (12 casi, perche' il boss ha vittoria e sconfitta):

  | # | Prova |
  |---|---|
  | 01 | il gioco si avvia senza errori JavaScript e mostra la home |
  | 02 | run: nome squadra → modulo → draft completo → squadra con 11 titolari → mappa con il boss |
  | 03 | run: nodo 5v5 giocato, ritorno alla mappa, nodo segnato come fatto |
  | 04 | run: si attraversa la mappa e si vince il boss → offerta del giocatore premio |
  | 04b | run: si perde il boss → si torna alla mappa con una vita in meno |
  | 05 | ogni season (5) si avvia fino alla mappa, con boss diversi |
  | 06 | RTG: con 15+ svincolati si prepara e si gioca una partita intera (duelli, intervallo, rigori) |
  | 07 | RTG: scheda di un giocatore della squadra e scheda di un allenatore |
  | 08 | potere coach: allenatore Halloween dal distributore, assegnato, potere su un titolare Halloween → l'overall dei requisiti scende come da anteprima |
  | 09 | evento Halloween: squadra valida, card giocatore, distributore, allenatore dell'evento |
  | 10 | salvataggi: run ripresa dopo il ricaricamento (stessa mappa); salvataggio vecchio senza `seasonId` letto come Season 1 con 2 vite |
  | 11 | negozio → acquisto Progetto Buono (monete 1000 → 750); Centro di sviluppo → evoluzione (progetti 1 → 0); album: dopo il draft 0 → 11 giocatori sbloccati |

  Come funzionano: browser pulito per ogni prova, ora fissata al 3 nov 2026 12:00 UTC, casualita' con seme fisso
  (la mappa della run e' sempre la stessa; il seme 8 serve a perdere il boss). Per dare monete, zucche e
  svincolati usano gli strumenti di test gia' presenti nel gioco (`?dev=1`) o le sue stesse funzioni, mai
  scritture a mano nei salvataggi (tranne la prova 10, che scrive apposta un salvataggio vecchio).

## Problemi aperti e cose scoperte

- **Bug noto (non corretto, Passo 0 non tocca il gioco):** all'intervallo RTG il pulsante "Conferma e riparti"
  ha due gestori del clic (`js/road-to-glory/rtg-match-view.js:1166` e `js/road-to-glory/rtg-controller.js:915`).
  L'intervallo viene confermato due volte: la seconda lancia "RTG halftime unavailable" (errore non gestito).
  Per il giocatore probabilmente non cambia nulla. La prova 06 lo dichiara come "errore noto".
- Gli strumenti di test del Centro di sviluppo (`?dev=1`, "+100/+500/+1500 monete") danno l'errore
  "Development IndexedDB richiede il percorso asincrono". Quelli del negozio funzionano. Solo strumento di test.
- `500-complete-run-stateful-soak.js` non termina nemmeno in 28 minuti: da capire se e' bloccato.
- `dynamic-progression-legacy-parity-test.js`: in attesa di decisione dell'utente (4 giocatori tolti da IE1 il
  13 settembre). **Non toccarlo finche' l'utente non risponde.**
- `final-recovery-write-gap-test.js` e `five-cycle-final-hardening-test.js`: obsoleti (gruppo 3), non toccati.
- Gruppo 2 (36 test che cercano testo nel codice): rimandato, "se ne parla dopo".
- La baseline ha ancora alcune immagini mancanti: l'ambiente blocca 5 siti esterni minori usati dal gioco
  (`www.akibagamers.it`, `i0.wp.com`, `i.namu.wiki`, `inazuma-eleven-legends.vercel.app`, `static.vecteezy.com`:
  banner season, alcune immagini allenatori, sfondo Halloween). Il confronto prima/dopo funziona lo stesso (mancano
  in entrambe le foto), ma un cambiamento in quelle immagini non si vedrebbe. Se l'utente li consente, rifare la
  baseline con `npm run screenshots -- --out=tests/visual-baseline`.
- Evento Halloween: nel codice finisce il 6 nov 2026 22:59:59 UTC. Le prove usano la data fissa del 3 novembre,
  quindi continuano a vedere l'evento anche dopo. Fino al 7 novembre nessuna proposta di merge di modifiche visibili.

## Decisioni prese

- Branch `chore/safety-net`; nessun file del gioco modificato nel Passo 0.
- Test lenti in `npm run test:soak` (ok utente).
- Gruppo 3: aggiornati solo i valori Aurico (ok utente).
- Prova 11 aggiunta su richiesta dell'utente.

## Numeri di partenza (main `3e9d71f`, 3 nov 2026)

- Test Node: 469 file; all'inizio 419 verdi, 48 rossi, 2 timeout. Dopo il Passo 0: vedi `docs/TRIAGE_TEST.md`.
- CSS: 50 file; `game.css` 8.823 righe; `!important` = 8.852 occorrenze su 5.404 righe.
  Nell'audit i numeri per file sono *righe*, il totale 8.852 sono *occorrenze*. Per file, in occorrenze:
  rtg-theme-core 2.506, rtg-theme-base 1.020, road-to-glory 976, rtg-theme 867, rtg-coaches 725,
  rtg-halloween-event 611. Nel Passo 1 si usera' sempre lo stesso metodo (occorrenze).
- JS: 1.059 righe oltre 200 caratteri, 291 oltre 400.
- Id di season scritti tra virgolette nei file JS: 325 occorrenze in 50 file (stima con grep).

## Prossimo passo (dopo l'ok dell'utente)

Passo 1 — CSS: misurare il CSS morto con Playwright (riusare `scripts/screenshots/scenes.mjs` e le prove del
browser per visitare gli stati), poi dividere per componente, senza toccare i file dell'evento Halloween
fino al 7 novembre.
