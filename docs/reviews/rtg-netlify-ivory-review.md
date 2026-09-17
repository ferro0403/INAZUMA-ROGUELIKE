# RTG — restyling della base Netlify

## Base
- Main verificato: `83e7c2811d8c617171bbebd0489023ba5f083cb9`.
- Base richiesta: PR #447, `preview/rtg-netlify`, `f16af2da84ca97dd8c614c8aff0964cbec10911d`.
- Branch: `feat/rtg-netlify-ivory-polish`.
- Non incorpora i successivi cambiamenti della #448. Nessun auto-merge.

## Modifiche e architettura
- `css/rtg-theme.css`: tema circoscritto RTG, avorio/oro/nero, campo verde desaturato; card canoniche compatte, immagini contenute, responsive, picker, prepartita, HUD e duelli. Caricato dopo il foglio storico per preservare i componenti condivisi.
- `js/road-to-glory/rtg-squad-view.js`: markup squadra con campo prima della panchina, cambio esplicito, requisiti e stato del salvataggio; picker più chiaro.
- `js/road-to-glory/rtg-controller.js`: renderSquad legge mainEligibility sulla bozza; bindRun collega la prossima tappa all'esistente openNode; testo selezione modulo più chiaro.
- `js/road-to-glory/rtg-run-view.js`: runMarkup mostra prossima partita e progresso; nodi con etichette accessibili; requirementsMarkup spiega titolari/panchina.
- `js/road-to-glory/rtg-match-view.js`: nome accessibile per Abbandona.
- `index.html`: tema e cache bust dei quattro script modificati.

## Sicurezza
Nessuna modifica a save schema, IndexedDB, repository, migrazioni, cloud, regole, RNG, reward, gacha, probabilità, mosse, database o MatchSimulator. Transazioni esistenti in repository.update preservate. Nessun write nel rendering. Compatibilità vecchi save e recovery invariati. Diff incrementale limitato a questi file e al report; lo stack RTG ereditato rimane separato concettualmente dal restyling.

## Verifica
- Base Netlify: 52/52 test RTG PASS.
- Dopo le modifiche: 52/52 test RTG PASS.
- Suite ampia: 331 file tests/*-test.js e tests/*-suite.js; 283 PASS, 48 FAIL, nessuno saltato. Tutte le 48 failure riprovate sull'estrazione intatta del commit Netlify: 48/48 falliscono anche lì, nessuna nuova failure. Numerose failure statiche cercano implementazioni ormai estratte da app.js.
- Test mirati finali: controller transaction, run view, main-style squad view e two-card duel result PASS. Syntax e diff whitespace verificati.
- Nessun nuovo test di dominio per questo intervento di presentazione; regressioni esistenti e verifica browser.
- Browser Chromium con dati giocatori reali, controller/view/repository/storage RTG reali, entitlement fixture e IndexedDB QA dedicato: squadra 11+4, picker 24 card, ricerca, sostituzione, 3-5-2, adattamento requisiti, salvataggio, percorso, accesso partita, prepartita e duello/esito.
- Larghezze 390 e 320 verificate; reparti da cinque su due file a 320, nessun overflow orizzontale squadra osservato.
- Duello: entrambi i giocatori presenti, vincitore evidenziato e render perdente attenuato senza overlay nero fuori card.

## Limiti prima del merge
Candidata per review visiva, non release certificata. Restano prova Safari/iPhone, campagna RTG completa e gate CI dello stack. I due soak da 500 campagne non sono stati eseguiti. La fixture sostituisce entitlement e apertura dettaglio, quindi non certifica login e scheda completa. Alcuni loghi esterni non caricano nel browser QA; asset canonici invariati. Adattamento automatico con tutti gli svincolati potenzialmente lento: algoritmo preesistente non modificato. Le 48 failure preesistenti richiedono triage separato prima di dichiarare verde l'intera suite.

## Follow-up screenshot utente — 17 settembre 2026

- Superfici più bianche, intestazioni chiare, nero e giallo del gioco originale.
- Probabilità e delta a capo su mobile, nomi delle mosse adattabili senza taglio.
- Cornice e sfondo della rarità nei duelli; vincitore a colori, sconfitto attenuato.
- Ingresso del banner, impatto del vincitore e arretramento del perdente; rispetta reduced motion, senza modificare le tempistiche del motore.
- Card canoniche compatte: ritratti mobile da 48 px, carta da 66 px anche nei cambi/catalogo/estrazione.
- Distributore compatto bianco/nero/giallo, probabilità adattabili e gettoni mancanti espliciti.
- Nessuna modifica a motore, RNG, salvataggi, cloud o costo estrazione.

Verifica follow-up: cinque test esistenti PASS (vending-restyle, pull-card-style, main-style-squad-view, match-presentation-revolution, duel-result-two-cards), sintassi JS e diff whitespace PASS. Browser Chromium con fixture isolata: squadra, duello, esito e distributore a 390 px; probabilità/delta senza overflow a 320 px. Animazione vincitore applicata verificata via computed style. Non ripetuta la suite completa; restano le limitazioni e i gate documentati sopra, incluso Safari reale.
