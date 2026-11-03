# Triage dei test (Passo 0)

Misurato il 3 novembre 2026 su `main` al commit `3e9d71f`, Node 22, con `npm test`
(4 test in parallelo, timeout 180 s per test).

## Risultato

| | Numero |
|---|---|
| Test totali (`tests/*.js`) | 469 |
| Passano | 419 (+1 lento: `500-run-soak-fuzz-gate.js`) |
| Falliscono | 48 |
| Timeout a 180 s | 2 |

I 2 timeout, rieseguiti da soli:

- `rtg-svincolati-real-db-five-seasons-test.js`: **passa in 265 s**. E' solo lento.
- `500-complete-run-stateful-soak.js`: **ancora in timeout a 500 s**. Vedi la riga in fondo per l'esito della prova senza limite.

Differenze rispetto all'audit (che contava 47 rotti + 3 timeout):
`development-runtime-consumers-test.js` non e' lento, fallisce subito (cerca una stringa in un file spostato);
`rtg-svincolati-...` passa con un timeout piu' lungo.

Nessun test con `rtg-` nel nome fallisce: la CI esegue proprio quelli, e per questo e' verde.
**Tutti i 48 test rossi sono fuori dalla CI**, e tutti tranne uno (`home-layout-regression-test.js`, 30 ottobre)
sono stati modificati l'ultima volta ad inizio settembre 2026: sono rimasti indietro mentre il codice andava avanti.

## Come leggere i gruppi

1. **Vivi e utili**: provano un comportamento vero. Da tenere. (Tutti i 419 verdi sono qui o nel gruppo 2; non li ho
   ancora divisi uno per uno.)
2. **Legati all'implementazione**: leggono il testo di un file JS/CSS/HTML e cercano una stringa precisa
   (`assert.match(source, /.../)`). Si rompono ogni volta che il codice viene spostato o rinominato, anche se il gioco
   funziona. Da sostituire con prove nel browser (Playwright) o da riscrivere sul comportamento.
3. **Obsoleti**: il comportamento e' cambiato di proposito (es. nuova rarita' Aurico) e il test descrive quello vecchio.
   Da aggiornare o eliminare motivando nella PR.
4. **Rotti dall'ambiente / ordine di caricamento**: il "finto gioco" che il test costruisce e' rimasto indietro
   (mancano file nuovi, ordine sbagliato, dati non forniti). Da sistemare il test, non il gioco.

La causa qui sotto viene dal messaggio d'errore e, per alcuni, da un controllo nel codice.
**Nessun test rosso indica, per quanto visto, un bug del gioco**: dove il test cerca una funzione "sparita" ho
controllato che la funzione esiste ancora, solo in un altro file (es. `openInventoryConfirmation` ora e' in
`js/inventory/inventory-controller.js`, la logica dei tentativi 5v5 in `js/five-v-five/five-match-presentation.js`,
`userEmblemMarkup` in `js/match/match-controller.js`). Prima di toccare ciascun test va comunque riverificato.

## Gruppo 2 — legati all'implementazione (36)

Il codice e' stato spostato in nuovi file (scomposizione di `app.js`, vedi `docs/app-js-decomposition.md`) o le
chiavi di cache `?v=` in `index.html` sono cambiate; il test cerca ancora il testo vecchio nel posto vecchio.

| Test | Cosa cerca (e non trova piu') |
|---|---|
| account-integration-test.js | markup `<small>OVR</small>` nel sorgente |
| app-polish-test.js | classe `five-match-card-portrait` nel sorgente |
| boss-flow-test.js | firma esatta di `fiveMatchComparisonMarkup` in `app.js` |
| boss-match-prematch-restyle-test.js | listener di `simulate-boss-match` scritto in un certo modo |
| boss-match-simulation-modal-bridge-test.js | chiave di cache `?v=` di uno script in `index.html` |
| cloud-save-integration-test.js | ordine degli `<script>` e chiavi `?v=` in `index.html` |
| consecutive-loss-protection-test.js | chiamata `simulate({... consecutiveLosses: run.consecutiveLosses` |
| cross-store-finalization-resume-test.js | posizione di un blocco di codice prima di un altro |
| dev-diagnostics-menu-test.js | attributo `aria-expanded="false"` scritto nel sorgente |
| development-management-ui-test.js | chiave di cache `?v=20260829-...` |
| development-new-run-failure-test.js | testo esatto di un messaggio d'errore nel sorgente |
| development-runtime-consumers-test.js | stringa `DevelopmentRuntime.resolveRosterPlayer` |
| development-ui-regression-test.js | `data-buy-project` dentro `app.js` |
| five-match-modal-regression-test.js | oggetto di navigazione scritto in un certo modo |
| five-match-player-swap-test.js | chiamata al renderer del picker in un file preciso |
| half-heart-lives-test.js | espressione `remaining >= 0.5 ? "half"` |
| home-layout-regression-test.js | costante `HOME_SECONDARY_ACTIONS` con un certo ordine |
| ie1-s2-final-fixes-test.js | espressione `isProfileAwareSeason(collectionId) && ...` |
| ie1-s3-dark-angels-regression-test.js | espressione `run.bossIndex >= seasonDb.bossOrder.length` |
| legacy-matchid-compatibility-final-test.js | costruzione del `matchId` in `app.js` (ora in moduli) |
| match-retry-seed-regression-test.js | logica tentativi 5v5 in `app.js` (ora in `five-match-presentation.js`) |
| permanent-club-ui-domain-characterization-test.js | assenza di `activeMatch` in certi file |
| production-path-tests-contract-test.js | assenza di un pattern negli helper di test |
| rendering-performance-regression-test.js | lettura dell'Album una sola volta, cercata come testo |
| run-ending-and-reward-actions-test.js | `openInventoryConfirmation` in `app.js` (ora in `inventory-controller.js`) |
| run-local-bootstrap-cloud-independence-test.js | `await renderHome()` scritto nel sorgente |
| s3-prerelease-ui-regression-test.js | `FormationLayout.displayRows(formation)` |
| season-select-simplified-test.js | ordine dei bottoni `CONTINUA / INIZIA / ELIMINA` nel markup |
| shop-settings-domain-characterization-test.js | `DevelopmentAccountV3.purchaseProject` |
| sports-bandage-weight-test.js | riuso dei candidati salvati, cercato come testo |
| squad-five-config-domain-characterization-test.js | stringa `state: "pre-match"` |
| tactical-player-card-test.js | `compactPlayerCardMarkup(player` |
| team-emblems-test.js | `userEmblemMarkup` nel banner (ora in `match-controller.js`) |
| trade-preview-dev-tools-test.js | espressione sugli svincolati nello scambio |
| ui-interaction-dom-test.js | `bindDevelopmentSelectedCardInteraction` in `app.js` |
| ui-smoke-test.js | `node-type-${escapeHtml(node.type)}` nel markup della mappa |

**Proposta:** non riscriverli uno per uno. I comportamenti che contano (mappa, 5v5, boss, scambio, inventario,
salvataggi) vanno coperti dal nucleo di prove nel browser (vedi sotto); poi questi test si eliminano in una PR
dedicata, elencando per ciascuno quale prova nel browser lo sostituisce.

## Gruppo 3 — obsoleti (6)

| Test | Causa |
|---|---|
| development-account-v3-test.js | aspetta 5 rarita'; il gioco ora ne ha 6 (aggiunta `Aurico`) |
| development-management-v3-test.js | idem, manca `Aurico` nell'elenco atteso |
| development-v3-migration-test.js | idem |
| development-v3-materializer-test.js | aspetta che `Leggenda` arrivi a 99; ora `Leggenda` = 95-98 (sopra c'e' `Aurico`) |
| dynamic-progression-legacy-parity-test.js | aspetta 1376 giocatori nei dati di addestramento, ora sono 1373 (dati cambiati: da confermare che sia voluto) |
| initial-formation-draft-production-path-test.js | confronta con una versione di `js/app.js` presa dalla storia git (`git show eb9dd02...`), ma in quel commit il file non esiste |

**Proposta:** aggiornare i valori attesi (Aurico, 95-98) dopo conferma; per `dynamic-progression` controllare quali
3 giocatori sono spariti dai dati e se e' voluto; eliminare il confronto con la storia git.

## Gruppo 4 — "finto gioco" del test rimasto indietro (6)

| Test | Causa |
|---|---|
| development-runtime-test.js | `PlayerIdentity must be loaded before RecruitmentPoolRuntime`: il test non carica il file `PlayerIdentity` |
| ie1-s3-dark-angels-save-balance-test.js | idem |
| ie1-s3-runtime-fixes-test.js | idem |
| final-recovery-write-gap-test.js | `Database non raggiungibili`: l'helper `tests/helpers/production-runtime.js` risponde a ogni `fetch` con `ok: false`, ma oggi l'avvio del gioco scarica i dati |
| five-cycle-final-hardening-test.js | idem (stesso helper) |
| transactional-entry-stale-recovery-test.js | idem: senza dati manca la configurazione della formazione 5v5 (`formation.slots` undefined) |

**Proposta:** sistemare l'helper (caricare `PlayerIdentity`, servire i file di `data/` dal disco). Probabilmente
basta toccare 2 file di supporto e tornano verdi tutti e 6.

## Lenti / timeout

| Test | Esito |
|---|---|
| 500-run-soak-fuzz-gate.js | passa, ~60 s |
| rtg-svincolati-real-db-five-seasons-test.js | passa, ~265 s |
| 500-complete-run-stateful-soak.js | oltre 500 s; esito senza limite: vedi `docs/STATO_LAVORI.md` |

**Proposta:** spostarli in `npm run test:soak` (da lanciare prima dei rilasci), fuori dal `npm test` di tutti i giorni.
