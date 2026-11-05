# Stato lavori — refactor INAZUMA-ROGUELIKE

Da leggere a inizio di ogni sessione e aggiornare a fine sessione.
Piano completo: Parte B delle istruzioni (Passi 0-7). Regole permanenti: `CLAUDE.md`.

## Dove siamo

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
  - Prossimo: Passo 3 (eventi come dati) dopo il 7 novembre; prima del codice proporre formato del file evento,
    test di controllo e evento finto, e aspettare l'ok.
  - `!important`: 8.852 all'inizio → 7.402 dopo 1c → 6.464 dopo 1e → 4.804 dopo 1f → 4.371 dopo 1i.

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
