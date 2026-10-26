# Cloud Save Road to Glory — integrazione sulla PR #506

Base obbligatoria: `8c162e1dbfd33a599fe9e00535285de8901bfb07`, branch sorgente `feat/rtg-cloud-local-adapter-phase3-20261026`. Lavoro sul solo branch `feat/rtg-cloud-save-integration-20261026`. Catena #502 → #504 → #505 → #506 verificata. Nessun reset, rebase, cherry-pick, merge, cambio a main o deploy in produzione. Il review gate sui sistemi protetti è stato approvato esplicitamente prima dell'implementazione.

## Problema e comportamento risultante

Gli adapter preparati trasportavano RTG soltanto in memoria: Firebase continuava a salvare quattro settori Roguelike. Ora un settore opzionale `rtg` appartiene allo stesso account, manifest, revisione, hash, bundle immutabile, staging e CAS. Si riusano login, sincronizzazione, conferme, conflitti e i pulsanti **USA QUESTO DISPOSITIVO** / **USA I PROGRESSI ACCOUNT CLOUD**.

RTG include entrambe le campagne, Season, seed/checkpoint/progressione, vite, Gettoni, progetti, squadre sconfitte, identificativi delle ricompense già applicate, carte, sviluppo/evoluzioni, allenatori condivisi, Album e contatori `pullCount`, `recruitmentPullCount`, `coachPullCount`. Formazioni, titolari, panchina, moduli, ruoli selezionati, slot, allenatori assegnati, poteri configurati e incontri attivi restano sul dispositivo.

Non sono state cambiate formule, probabilità, reward, costi, RNG, match engine, progressione o database. RunStorage, RecoveryGuard, permanent effects e gli archivi canonici Roguelike Development/Hall/Album sono rimasti byte-identici alla base; gli adapter RTG invocano le API del guard esistente.

## Responsabilità dei moduli e funzioni

| Modulo | Responsabilità |
| --- | --- |
| `rtg-cloud-snapshot.js`: `project`, `validate` | Proiezione pura completa e validazione senza normalizzazioni distruttive. Schema RTG 1 mantenuto; contatori legacy assenti compatibili. |
| `rtg-cloud-local-adapter.js`: `captureStable` | Letture coerenti/read-only, default solo per campi legacy assenti, ricostruzione della proprietà legacy in RAM. |
| `rtg-persistence-runtime.js` | Fence durevole tra schede e sessioni, generation persistente, rigetto dei callback stale anche dopo il completamento, riapertura esplicita dei controller. |
| `rtg-storage.js`, `rtg-repository.js` | Scritture guardate anche dopo gli await e dentro la transazione; evento account permanente soltanto dopo `transaction.complete`; riuso esatto delle squadre locali salvate. |
| `rtg-album-controller.js`, `rtg-controller.js`, `rtg-squad-slot-runtime.js` | Scritture Album/slot guardate, errori non nascosti, continuazioni e doppi pull protetti, nessuna migrazione persistente durante la lettura degli slot. |
| `rtg-cloud-bridge.js` | Materializzazione asincrona del solo snapshot locale; nessuna contaminazione di uno snapshot remoto con dati del dispositivo. |
| `rtg-cloud-restore-adapter.js`: `validateTarget`, `preflight`, `apply`, `verify` | Validazione semantica prima di qualsiasi scrittura account; sostituzione atomica RTG, Album recuperabile, verifica permanente/configurazioni. |
| `cloud-save-core.js`: `sectorNames`, preparazione/ricostruzione/confronto/manifest | Il contratto dei quattro settori originali rimane disponibile. RTG opzionale entra in hash, limiti, confronto e manifest; vietata la perdita di un checkpoint RTG già pubblicato. |
| `firebase-cloud-save.js` | Stesso manager per upload, download, conflitti, retry e restore. Nuove mutation durante un upload rimangono dirty anche se scade il debounce o è in corso una scelta esplicita locale. |
| `cloud-restore-protocol.js` | Passaggio RTG opzionale nello stesso journal, preflight completo e chiusura del fence prima della rimozione del journal. Percorso senza RTG invariato. |
| `firestore.rules` | Settore RTG ammesso; pubblicazione vincolata al documento staged corrispondente, impossibilità di ometterlo dopo la prima pubblicazione, staging immutabile e isolamento account. |
| `index.html`, bootstrap cloud | Catena adapter caricata prima del manager e cache busting `20261026-rtg-cloud-1`. |

## Confini atomici e recovery

- Gameplay RTG: prima commit locale campagna + `shared:account` nella stessa transazione IndexedDB; poi evento per il manager Firebase. Un errore Firebase non annulla il commit locale e non abilita il guard di recovery.
- Partita attiva: RTG non avanza nel cloud. Gli altri settori possono pubblicare un bundle che riporta l'ultimo checkpoint RTG remoto verificato. Lo stato dirty resta recuperabile e viene ritentato dopo un nuovo commit locale.
- Restore: prima si scarica e valida l'intero bundle immutabile, incluse le regole semantiche RTG; poi si crea il journal e si blocca la scrittura. Entrambe le campagne, shared, copie locali delle squadre e prova di ripristino appartengono a una singola `updateMany`.
- Album in localStorage è un altro store: il journal rimane attivo se l'Album fallisce dopo il commit IndexedDB. Retry/reload riprendono lo stesso target immutabile, anche se un altro dispositivo ha successivamente pubblicato una revisione nuova. Nessun finto commit cross-store e nessun outbox/cloud parallelo.
- Fence e journal: errori di quota sulla chiusura del fence o SecurityError sulla rimozione del journal lasciano una prova recuperabile; il retry nella stessa sessione è verificato. Un incontro che vince la race locale prima delle prime scritture non viene cancellato.
- Configurazioni: il restore conserva esattamente `squads`, senza farle passare dalla normalizzazione che rimuoveva gli allenatori assegnati non posseduti. La proprietà account resta distinta dalle preferenze: una selezione conservata non concede proprietà o poteri. Gli slot locali non vengono importati.
- Campagna cloud esplicitamente null: la campagna resta non iniziata; le squadre del dispositivo vengono conservate nei record locali `local:squads:<campaignId>` e riutilizzate alla successiva inizializzazione esplicita. Non si ricreano vecchi progressi per preservare la formazione.
- Proprietà legacy: letture locali ricostruiscono la union legittima degli allenatori precedenti senza scritture; il restore sostituisce entrambe le repliche di campagna insieme a shared, evitando la ricomparsa di proprietà eliminate.

## Retrocompatibilità e dati non validi

Il cloud legacy senza settore RTG lascia intatti i dati RTG del dispositivo. Non si introduce un'importazione/fusione automatica tra dispositivi. Lo schema cloud resta 1 e la lista storica dei quattro settori resta disponibile; l'enumerazione effettiva è opzionale. La prova del journal RTG include un discriminante che impedisce al vecchio manager di completarlo ignorandone il settore.

Le nuove rules richiedono che un bundle pubblicato con RTG contenga il documento RTG della stessa revisione/hash/commit. Il vecchio client che carica soltanto i quattro settori non può pubblicare un bundle incompleto al posto di quello RTG. Il controllo completo di queste rules è delegato alla suite emulatore descritta sotto: non è dichiarato eseguito localmente.

È stato corretto anche il predicato delle revisioni che accedeva a chiavi run assenti nei manifest a quattro settori: l'omissione resta permessa solo per metadati run già assenti; revisioni storiche presenti continuano a essere protette. Il test esegue il corpo effettivo del predicato con mappe che segnalano accessi a chiavi mancanti.

Payload corrotti, hash/revisioni errati, vite oltre il massimo e chiavi riservate che il gameplay non potrebbe conservare vengono rifiutati. I default legacy esplicitamente supportati restano compatibili; non si converte JSON corrotto in un Album vuoto.

## Verifiche eseguite

Risultati macchina e lista completa dei fallimenti: [rtg-cloud-validation.json](rtg-cloud-validation.json).

- Baseline #506: **437 script, 390 PASS, 47 FAIL**, riprodotti sul suo HEAD esatto prima delle modifiche.
- Finale: **452 script, 405 PASS, gli stessi 47 FAIL, 0 nuove failure e 0 timeout**. Tutti i **170 script RTG PASS**.
- **18 script cloud RTG PASS**, inclusi dati legacy, atomicità/rollback, errori Firebase e retry, conflitti PC/telefono sintetici, preservazione delle run locali, partite attive, dati corrotti/mancanti, 10 boundary di crash del journal, target immutabile, errori di cleanup, proprietà e configurazioni locali, upload sovrapposti e debounce scaduto.
- **7 verifiche Chromium** con IndexedDB/localStorage reali, comprese quota Album dopo commit IDB e secondo browsing context. Nessuna connessione SDK Firebase nel browser di test.
- Gate **500 scenari soak/fuzz PASS**.
- Gate **500 campagne complete PASS**: 300 campioni, 200 GameOver, 100 campagne per ciascuna delle cinque Season; 29 retry di quota, 55 azioni doppie, 104 refresh; controlli Album per tutte le 500 campagne e finalizzazione asincrona per le 300 vittorie.
- Sintassi **198 JS di produzione PASS**; **229 riferimenti JS/CSS** e **82 URL CSS** verificati; diff whitespace pulito.
- Review indipendente: trovati e risolti con regressioni la validazione tardiva, il journal rimosso troppo presto, valori semanticamente non conservabili e la perdita del dirty state durante upload sovrapposti.

Comandi principali:

```sh
for test_file in tests/rtg-cloud-*-test.js; do node --experimental-vm-modules "$test_file"; done
node tests/rtg-cloud-browser-test.mjs
for test_file in tests/*test.js; do node --experimental-vm-modules "$test_file"; done
node tests/500-run-soak-fuzz-gate.js
node tests/500-complete-run-stateful-soak.js
node scripts/verify-index-local-assets.cjs
node scripts/verify-css-local-assets.cjs
```

I test storici aggiornati mantengono le verifiche comportamentali: tre guard sul cache busting riflettono le nuove versioni, il conteggio letture cloud considera i settori effettivi e il test slot legacy verifica ora che la lettura sia read-only e la successiva scrittura esplicita persista i dati. Non sono stati eliminati test né ridotte verifiche di gameplay per ottenere un risultato verde.

## Verifiche non eseguite localmente e rilascio

Il download del JAR Firestore Emulator ha ricevuto HTTP **403 dal proxy** dell'ambiente. I quattro guard statici delle rules e il predicato revisioni passano; la suite completa di enforcement **non è stata eseguita localmente**. Il workflow dedicato `.github/workflows/rtg-cloud-validation.yml` esegue runtime/browser e un job separato con emulatore, progetto `demo-rtg-cloud-ci` e `--require-emulator`: l'assenza dell'emulatore non può risultare un successo di quel job.

Per eseguire le rules localmente in un ambiente che consenta il download, installare in una cartella scratch `firebase-tools@14.12.0`, `@firebase/rules-unit-testing@4.0.1`, `firebase@11.10.0`; avviare `firebase emulators:exec --only firestore --project demo-rtg-cloud-ci` e dentro l'emulatore eseguire `node tests/rtg-cloud-firestore-rules-test.js --require-emulator` con `NODE_PATH` configurato. Il workflow contiene il comando completo e la configurazione locale.

Non sono stati collaudati Safari/iPhone o telefoni fisici. PC/telefono sono rappresentati da due runtime isolati collegati allo stesso backend sintetico; il controllo cross-tab Chromium usa due browsing context aggiornati. Nessun account Firebase reale usato. Nessun deploy delle rules o del sito in produzione eseguito. L'attivazione sulle risorse reali richiede la review della PR e una successiva operazione di rilascio esplicita.

**PR in bozza, stacked contro la #506. Nessun merge.**
