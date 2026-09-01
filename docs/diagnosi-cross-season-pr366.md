# Diagnosi cross-Season sulla base locale della PR #366

Base analizzata: `ca4f4eddc6e50c755867b4c705cd7e6b8a1d8970` (`work`).

## Verifica dei contratti #366

| Contratto | Stato | Implementazione verificata |
| --- | --- | --- |
| Cloud limitato a `profile`, `album`, `development`, `hall_index` | Presente | `js/cloud-save-core.js`, `SECTOR_NAMES` |
| Eventi `domain: "run"` ignorati | Presente | `js/firebase-cloud-save.js`, `onLocalSave` |
| Restore Firebase senza autorità su RunStorage | Presente | `js/cloud-restore-protocol.js`; il wiring applica solo profile/album/development/hall |
| `RunStorage.save/remove` indipendenti dal RecoveryGuard account | Presente | `js/run-state.js`, `RunStorage.save` e `remove` |
| Bootstrap gameplay non attende Firebase | Presente | `js/app.js`, `init` |
| `teamIdentity` posseduta dalla run dopo la creazione | Presente | `js/run-state.js`, `normalize` |
| `resumeRun` non attraversa il routing gate account | Presente | `js/app.js`, `resumeRun` |
| Nuova run non attraversa il routing gate account | Presente | `js/app.js`, `startNewRunFromHome` / `startRunWithIdentity` |
| Run salvata prima del profilo account | Presente | `js/app.js`, `startRunWithIdentity` |
| Lettura Development V3 autorevole durante recovery | Presente | `js/development-account-v3.js`, `ensureMigrated` |

I primi nove contratti sono presenti: questo checkout è quindi una base #366 valida per l'indagine.

## Matrice di riproduzione prima di modifiche correttive

Le righe seguenti derivano dal runtime production-path e dai database Season reali. La simulazione 11v11 è stata avviata tramite `app.js:startMatchSimulation`, che usa `ensureMatchPreview`, `commitMatchMutation` e `RunState.save` reali.

| Season | Scenario | Riprodotto? | Transaction label | Error code | Error stage | Generation prima / canonica dopo | Classificazione |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ie1` | Boss 11v11: pre-match → start | No | `match-simulation-start` | — | — | 1 / 2 | Il blocco pre-partita segnalato non si riproduce |
| `ie2` | Boss 11v11: pre-match → start | No | `match-simulation-start` | — | — | 1 / 2 | Il blocco pre-partita segnalato non si riproduce |
| `ie1_s2` | 11v11 con runtime profile-aware: pre-match → start | No | `match-simulation-start` | — | — | 1 / 2 | Il blocco pre-partita segnalato non si riproduce |
| `ie1_s3` | Save/normalize profile-aware ripetuto | No | save diretto | — | — | 1 / 2 | Nessun drift logico osservato |
| `orion` | Boss 11v11: pre-match → start (controllo) | No | `match-simulation-start` | — | — | 1 / 2 | Controllo positivo confermato |

## Evidenze iniziali

### Generation e riferimenti runtime

`RunStorage.save` rilegge il payload appena serializzato e lo assegna all'oggetto runtime con `Object.assign`. Nei probe cross-Season ogni start 11v11 riuscito ha aggiornato sia l'oggetto runtime sia il canonico da generation 1 a generation 2; non è stato osservato uno stale-write consecutivo.

### Normalizzazione profile-aware

Il ciclo `save → load → save → load`, senza gameplay, è risultato semanticamente idempotente per tutte le cinque Season dopo l'esclusione dei soli metadati di commit (`storageGeneration`, `storageCommitId`, `updatedAt`). Non è stato osservato drift di `activeProfileId`, `activeRoleVariantId`, special match o zona.

### Dimensioni iniziali dopo l'avvio 11v11

Le misure comprendono primary, backup, head e altre chiavi RunStorage note, in UTF-16 come riportato da `RunStorage.diagnostics`.

| Season | Totale chiavi RunStorage dopo start 11v11 |
| --- | ---: |
| `ie1` | 137,818 byte |
| `ie2` | 106,810 byte |
| `ie1_s2` | 187,606 byte |
| `ie1_s3` | 189,770 byte |
| `orion` | 193,946 byte |

Orion è risultato più grande delle Season segnalate come rotte. La quota non spiega quindi, da sola, perché Orion funzioni mentre IE1/IE2/IE1_S2/IE1_S3 fallirebbero. Resta una causa secondaria possibile soltanto in presenza di altro stato locale reale non disponibile nel fixture.

## Classificazione prima dei fix

### ROOT CAUSE CONFERMATA

Nessuna per gli incidenti iPhone: il checkout locale non riproduce ancora i tre sintomi osservati usando stato canonico valido.

### SINTOMI NON RIPRODOTTI

- IE1_S2/IE2 bloccati in pre-partita.
- IE1 con `resolutionApplied === false` dopo risultato completato.
- IE1_S3 che raggiunge `renderMapFailureRecovery` durante il percorso.

### IPOTESI SCARTATE COME CAUSA GENERALE

- Firebase/RecoveryGuard: il salvataggio RunStorage non lo consulta e i test account-blocked restano verdi.
- Drift sistematico di normalizzazione profile-aware: il ciclo idempotente non produce differenze logiche.
- Quota come spiegazione cross-Season unica: Orion produce il payload più grande nel confronto controllato ma completa lo start.
- Modal bridge come causa già dimostrata: non è stata osservata alcuna chiamata del bridge nel percorso di commit; il bridge non avvia la simulazione.

## Informazione runtime ancora necessaria

Poiché il caso Preview non è riprodotto localmente, serve catturare il primo fallimento reale direttamente nel runtime Preview: label, errore, generation/commit in memoria e canonici, identità match/nodo e dimensioni delle chiavi. La branch diagnostica aggiunge esclusivamente questa telemetria locale in modalità `?dev=1`; non modifica transazioni, retry o sicurezza di RunStorage.

## Secondo pass: percorsi reali da mappa e diagnostica pre-recovery

Il secondo pass non parte più da una `activeMatch` costruita dal test. Usa `enterNode` su una zona in fase `map`, lascia che `enterMatchFromNode` crei il match production, esegue il vero handler del pulsante `simulate-boss-match` e verifica il canonico dopo ogni transazione.

| Season | Percorso reale | Esito | Generation |
| --- | --- | --- | --- |
| IE1 | map → nodo 5v5 → match → click Simula → skip → statistiche reali → resolution → map | PASS, incidente non riprodotto | 1 ingresso, 1 start, 1 completion, 1 resolution, 1 navigation |
| IE1_S3 | map → nodo 5v5 → match → click Simula | PASS, failure map/formation non riprodotta | ingresso e start entrambi canonici |
| IE1_S2 | map → nodo special normalizzato → match creato → click Simula | PASS, pre-partita bloccata non riprodotta | ingresso e start entrambi canonici |
| IE2 | map → nodo boss → match creato → click Simula | PASS, pre-partita bloccata non riprodotta | ingresso e start entrambi canonici |
| Orion | stesso percorso IE2 come controllo | PASS | ingresso e start entrambi canonici |

Il percorso IE1 usa l'implementazione production di `RunStatistics.applyCompletedMatchStatistics`: dopo la vittoria risultano `fiveVFiveWins === 1`, nodo completato, livello aumentato, vite invariate, `resolutionApplied === true`, `activeMatch === null` dopo Continua e fase `map`.

### Failure snapshot corretto

`GameplayPersistence` clona ora l'oggetto tentato immediatamente dopo la mutation e prima di `save`. Su failure passa tale clone al recorder prima che l'app possa perdere l'informazione attraverso `replaceRun(canonical)`. Il probe stale reale produce:

- attempted generation: 1;
- canonical generation before: 2;
- error-reported generation: 2 (esplicitamente separata, non chiamata expected);
- canonical generation after recovery: 2;
- explicit expected generation: `null`.

Il record separa inoltre match e nodo tentati dalle rispettive versioni canoniche. Nel probe il match tentato è già `simulating` e ha il nuovo stable match ID, mentre il canonico resta `pre-match` col precedente match ID.

### Trace e persistenza di sessione

In `?dev=1` una trace circolare conserva al massimo 200 eventi e le failure al massimo 100. I record vengono copiati in `sessionStorage` con gestione fail-safe delle eccezioni. La trace copre ingressi mappa/match, click, preview, confini delle mutation, tentativi e risultati dei save, playback/skip, resolution e navigazione. Il menu DEV permette copia/esportazione JSON e reset; nessun payload giocatori completo o dato Firebase viene incluso.

### Root cause dopo i percorsi reali

Nessuna root cause gameplay è stata riprodotta. Non è stato applicato alcun gameplay fix. La nuova diagnostica serve a distinguere nella Preview una mutation exception da stale/write/quota e conserva lo stato tentato pre-recovery necessario per una decisione successiva.
