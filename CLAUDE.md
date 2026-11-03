# Regole per lavorare su INAZUMA-ROGUELIKE

Questo file viene riletto a ogni sessione. Le regole valgono per qualsiasi modifica, grande o piccola.

## Il progetto in breve

- Gioco statico nel browser: `index.html` + JS a script globali (`window.*`, nessuna build oggi) + CSS. Deploy su Netlify.
- Due modalita': **Run classica** (`js/run-*.js`, `js/map-generator.js`, `js/match-simulator.js`) e **Road to Glory / RTG** (`js/road-to-glory/`).
- Season: `ie1`, `ie1_s2`, `ie1_s3`, `ie2`, `orion`. Evento a tempo: Halloween 2026.
- Dati di gioco in `data/*.json`. Test in `tests/` (Node, file `*-test.js`).
- Documenti di architettura da rispettare: `docs/RTG_CSS_ARCHITECTURE.md`, `docs/app-js-decomposition.md`.

## Regole d'oro (non negoziabili)

1. **Mai scrivere su `main`** e mai sulle PR altrui. Ogni lavoro va su un branch nuovo, in PR piccole (una PR = un passo). La descrizione della PR dice cosa cambia, come verificarlo e i rischi. **Il merge lo fa solo l'utente**, dopo aver provato la preview: l'agente non unisce mai una PR.
2. **Nessuna modifica al gameplay dentro un refactor.** Bilanciamento, probabilita', costi e ricompense si cambiano solo in una PR dedicata e dichiarata.
3. **Non cancellare e non riscrivere la storia** senza chiedere prima. Operazioni difficili da annullare = chiedere.
4. **Verificare prima di dire "fatto"**: `npm test` verde (quando esiste) e, per ogni modifica visiva, screenshot prima/dopo.

## Season e eventi sono DATI, non codice

- Vietato scrivere id di season nel codice nuovo (`"ie1_s3"`, `"orion"`, ecc.) e vietato aggiungere `if (seasonId === ...)`.
- Ogni caratteristica specifica di una season va in un campo del suo manifest (es. `profileAware`, `levelStep`, `bossStageOverride`, etichette, nome coppa, ordine, mappa, cap e squadre) e il codice legge il campo.
- Etichette come `IE1/IE2/IE3/ARES/ORION` e nomi delle coppe esistono in **un solo posto** (il manifest), mai copiate nei file UI.
- Un evento (come Halloween) ha il suo manifest: id, data di inizio/fine, prezzi, premi, squadre, asset. Date e prezzi non stanno nel codice.
- Se una regola speciale non entra in un campo del manifest, si aggiunge un campo generico, non un caso speciale nel motore.
- Esempio: in Orion la squadra `zhao_eclipse` ripete giocatori gia' sbloccabili, e la regola in `rtg-gacha.js` (`orionZhaoOrigin`, `canonicalCollectibleCardId`) impedisce di sbloccarli due volte. **E' una regola voluta: va conservata identica.** Va solo spostata nel manifest (come regola generica di carte equivalenti) invece di avere season e squadra scritte nel motore, con un test di parita' sul comportamento attuale. Gli id delle carte gia' possedute non si riscrivono mai.

### Fino a quando il manifest non esiste: dove si tocca per aggiungere una season

Controllare TUTTI questi punti (elenco rilevato dall'audit, puo' essere incompleto, rifare `grep` degli id esistenti):
`js/season-registry.js`, `js/road-to-glory/rtg-config.js` (SEASONS, constraints, rewards), `js/road-to-glory/rtg-state.js` (ACTIVE_SEASON_IDS, CAMPAIGN_SEASONS, nodo di partenza), `js/road-to-glory/rtg-card-identity.js` (SEASON_ORDER, sigle), `js/road-to-glory/rtg-coaches.js` (CAMPAIGN_SEASONS e coach con seasonId), `js/road-to-glory/rtg-squad-controller.js` (etichette filtro), `js/shop-catalog.js`, `js/shop/shop-view.js`, `js/shop-ui-polish.js`, `js/special-reward-ui-bridge.js`, `js/development-v2.js`, `js/development-v3.js`, `js/development/development-center-controller.js`, `js/album-progress.js`, `js/album/album-controller.js`, `js/run-entry/season-selection-view.js`, `js/run-state.js` (riga con `simulationRulesVersion`), `js/persistence-diagnostics.js` (RUN_IDS), `js/level-progression.js`, `js/map-generator.js`, `js/game-rules.js`, e gli `<script>` in `index.html`.
Dopo la modifica: aprire il gioco, avviare una run e una partita RTG di quella season, e controllare card giocatore, poteri coach ed evento.

## CSS

- **Un componente, un proprietario.** Prima di scrivere CSS cercare il file che gia' possiede quel componente (vedi `docs/RTG_CSS_ARCHITECTURE.md`) e modificare quello.
- **Vietato creare file CSS di patch** (`fix`, `polish`, `tuning`, `final`, `restyle`, `override`, `v2`, `v3`...). Si modifica il file proprietario.
- **`!important` vietato** nel codice nuovo. Eccezione solo con commento che nomina la regola legacy da battere. Il debito esistente (~8.700 occorrenze) si riduce, non si aumenta.
- Colori, ombre, spazi e raggi ripetuti vanno in variabili CSS (token), non come valori letterali.
- I temi per season usano un attributo (`data-season="..."`), non classi scritte a mano per ogni season.
- Le media query restano nel file del componente a cui appartengono.
- Una modifica CSS e' accettata solo con screenshot prima/dopo delle schermate toccate.

## JavaScript

- Righe al massimo ~120 caratteri. Vietati blob di dati compressi o base64 dentro file `.js` (esempio da eliminare: `PACKED` in `rtg-four-moves-runtime.js`): i dati vanno in `data/*.json` leggibili.
- Vietato sostituire a runtime metodi di altri moduli (`RunState.save = ...`). Si usa un'estensione esplicita (hook/evento) dichiarata dal modulo proprietario.
- Un solo helper per clonare, normalizzare id ed escape dell'HTML, non copie locali in ogni file.
- Nuovo codice in file piccoli (obiettivo < 400 righe) con una sola responsabilita'.
- L'HTML non si costruisce con concatenazione di stringhe nel codice nuovo: usare template leggibili.
- Aggiungere un file JS = aggiungerlo a `index.html` nell'ordine corretto e verificarlo con i test di ordine di caricamento (`tests/rtg-foundation-load-order-test.js`).

## Asset

- Nuove immagini: file locali in `assets/`, in WebP/AVIF, con dimensioni dichiarate. Vietato linkare immagini da siti terzi (stock, wiki, blog): possono sparire e hanno problemi di licenza.
- Le immagini esterne gia' presenti (CloudFront e altri host) si migrano in locale a gruppi, non si aggiungono nuovi host.

## Test e verifica

- `npm test` esegue tutti i test e riporta quelli falliti. Nessuna PR chiude con test rossi che prima erano verdi.
- Ogni bug corretto porta un test che lo avrebbe preso.
- Per ogni schermata toccata: screenshot mobile (412x915) prima e dopo, allegati alla PR.
- Se un test e' "datato" (verifica dettagli non piu' veri), si aggiorna o si elimina motivando nella PR, non si lascia rosso.

## Quando fermarsi e chiedere

Chiedere all'utente prima di: cambiare numeri di bilanciamento, cancellare file grandi o dati, cambiare formato di salvataggio (rischio perdere run e account), toccare regole Firestore, cambiare il deploy.
