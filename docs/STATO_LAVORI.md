# Stato lavori — refactor INAZUMA-ROGUELIKE

Da leggere a inizio di ogni sessione e aggiornare a fine sessione.
Piano completo: Parte B delle istruzioni (Passi 0-7). Regole permanenti: `CLAUDE.md`.

## Dove siamo

**Passo 0 — Rete di sicurezza: in corso, in attesa dell'utente** (branch `chore/safety-net`).

### Fatto

- `CLAUDE.md` nella radice (Parte C delle istruzioni, invariata).
- `package.json` con:
  - `npm test` → `scripts/run-all-tests.mjs`: esegue tutti i `tests/*.js`, uno per processo, 4 in parallelo,
    timeout 180 s ciascuno; distingue `ok` / `SLOW` (passa ma > 20 s) / `FAIL` / `TIME` (timeout).
    Opzioni: `--timeout=SEC`, `--jobs=N`, `--json=file`, e un filtro sul nome (`npm test -- halloween`).
  - `npm run screenshots` → `scripts/screenshots/capture.mjs`.
- Triage dei 50 test rossi con causa: `docs/TRIAGE_TEST.md`.
- Script screenshot (Playwright, 412x915) con 33 schermate in `scripts/screenshots/scenes.mjs`: home e club,
  run classica (nome squadra → moduli → draft → squadra → mappa → boss → inventario → 5v5 → primo nodo),
  RTG (campagne, mappe S1 e Ares/Orion, prepartita, squadra, distributore, allenatori, dettaglio coach),
  evento Halloween (home, prepartita, distributore, squadra, card giocatore, allenatori, pagina intera).
  - Ora fissata (3 nov 2026 12:00 UTC) e casualita' con seme fisso: due esecuzioni danno le stesse foto.
  - Per RTG ed evento crea un "account di prova" solo nel browser di test (tutti gli svincolati sbloccati,
    usando le funzioni del gioco). Nessun dato reale viene toccato.
  - Se le immagini esterne non si caricano, il report lo dice e lo script esce con errore: quelle foto non
    valgono come baseline.
- `scripts/screenshots/compare.mjs`: confronto prima/dopo pixel per pixel con immagini "diff".

### Bloccato

- **Baseline screenshot NON salvata.** L'ambiente cloud blocca `dxi4wb638ujep.cloudfront.net` (quasi tutte le
  immagini del gioco) e `www.gstatic.com` (Firebase), oltre ad altri host minori (wikia, wp.com, magnific,
  vecteezy, depositphotos, namu.wiki, akibagamers, blogger, vercel.app). Le foto escono con ritratti vuoti.
  Serve che l'utente aggiunga almeno `dxi4wb638ujep.cloudfront.net` ai domini consentiti dell'ambiente.

### Da fare per chiudere il Passo 0

1. Sbloccato il dominio: `npm run screenshots -- --out=tests/visual-baseline` e controllare il report.
2. Concordare con l'utente il nucleo di ~10 prove nel browser (proposta sotto) e scriverle.
3. Sistemare i 6 test del gruppo 4 (solo file di supporto ai test).
4. Decidere con l'utente cosa fare dei gruppi 2 e 3 (vedi `docs/TRIAGE_TEST.md`).

## Proposta: nucleo di prove nel browser (da approvare)

1. Il gioco si avvia senza errori JavaScript e mostra la home.
2. Run classica: nome squadra → modulo → draft completo → squadra valida → mappa.
3. Run classica: si entra in un nodo 5v5, si simula la partita, si torna alla mappa.
4. Run classica: si gioca il boss (vittoria e sconfitta portano alle schermate giuste).
5. Ogni season (`ie1`, `ie1_s2`, `ie1_s3`, `ie2`, `orion`) si carica e la mappa della run si apre.
6. RTG: con 15+ svincolati si apre la mappa, si prepara e si gioca una partita.
7. RTG: si apre la card di un giocatore e il dettaglio di un coach.
8. RTG: un potere coach configurabile si attiva nel prepartita e cambia il valore mostrato.
9. Evento Halloween: si apre, la squadra e' valida, card giocatore e coach evento si vedono, il distributore si apre.
10. Salvataggi: una run e un account salvati con il formato attuale (e uno vecchio, senza `seasonId`) si riaprono
    dopo un ricaricamento della pagina.

## Decisioni prese

- Branch `chore/safety-net`; nessuna modifica a file del gioco nel Passo 0 (solo script, test, documenti).
- I test lenti restano dentro `npm test` per ora; proposta di spostarli in `npm run test:soak`.

## Numeri di partenza (main `3e9d71f`, 3 nov 2026)

- Test: 469 file; 419 verdi, 48 rossi, 2 timeout a 180 s.
- CSS: 50 file; `game.css` 8.823 righe; `!important` = 8.852 occorrenze su 5.404 righe.
  Attenzione: nell'audit i numeri per file (2.297 in `rtg-theme-core.css`, ecc.) sono *righe*, il totale 8.852
  sono *occorrenze*. Per file, in occorrenze: rtg-theme-core 2.506, rtg-theme-base 1.020, road-to-glory 976,
  rtg-theme 867, rtg-coaches 725, rtg-halloween-event 611. Nel Passo 1 si usera' sempre lo stesso metodo.
- JS: 1.059 righe oltre 200 caratteri, 291 oltre 400.
- Id di season scritti tra virgolette nei file JS: 325 occorrenze in 50 file (stima con grep).

## Problemi aperti

- `500-complete-run-stateful-soak.js`: oltre 500 s; esito della prova senza limite da annotare qui.
- `dynamic-progression-legacy-parity-test.js`: 3 giocatori in meno nei dati di addestramento — voluto?
- Evento Halloween: fine nel codice il 6 nov 2026 22:59:59 UTC (verificato il 3 nov). Fino al 7 nov nessuna
  proposta di merge di modifiche visibili.
