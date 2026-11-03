# Stato lavori — refactor INAZUMA-ROGUELIKE

Da leggere a inizio di ogni sessione e aggiornare a fine sessione.
Piano completo: Parte B delle istruzioni (Passi 0-7). Regole permanenti: `CLAUDE.md`.

## Dove siamo

**Passo 0 — Rete di sicurezza: CHIUSO il 3 novembre 2026** (branch `chore/safety-net`, PR in bozza
ferro0403/INAZUMA-ROGUELIKE#540). **In attesa dell'ok dell'utente per il Passo 1 (CSS).**

## Comandi

| Comando | Cosa fa | Durata |
|---|---|---|
| `npm test` | tutti i test Node in `tests/*.js` tranne i 3 lunghi, 4 alla volta, timeout 180 s ciascuno | ~4 min |
| `npm run test:soak` | solo i 3 test lunghi (timeout 30 min ciascuno) | da 5 a 30+ min |
| `npm run test:browser` | le 11 prove nel browser (Playwright), vedi sotto | ~6,5 min |
| `npm run screenshots` | 33 screenshot 412x915 in `test-results/screenshots/current/` | ~4 min |
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
