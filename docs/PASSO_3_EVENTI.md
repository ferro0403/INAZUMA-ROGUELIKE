# Passo 3 — Eventi come dati: analisi e proposta

Stato: **proposta, in attesa dell'ok dell'utente.** Nessun file del gioco è stato modificato.
Ramo di partenza: `release/passo-1-css` (PR #559). Data: 5 novembre 2026.

Obiettivo: aggiungere un evento (come Halloween) deve voler dire **compilare un file di dati**, senza riscrivere
codice e senza sbagliare carte, poteri degli allenatori o tema.

---

## 1. Analisi di Halloween

### 1.1 Dove sono scritti i dati dell'evento oggi

Halloween tocca **25 file** (23 JS + 2 CSS) più 3 file di dati. Il cuore è `js/road-to-glory/rtg-halloween-event.js`
(1.508 righe, 81 funzioni), che fa da solo: dati, regole, economia, schermate, squadra, distributore, partita, album.

| Cosa | Valore | Dove è scritto (file) |
|---|---|---|
| Id evento | `halloween2026` | 13 file, 42 volte: evento, `rtg-card-identity.js`, `rtg-player-resolver.js`, `rtg-squad-controller.js`, `rtg-coach-powers-runtime.js`, `rtg-coach-powers-squad-ui.js`, `rtg-album-view.js`, `rtg-development-controller.js`, `player-view.js`, CSS (11 volte) |
| Squadra | `occult-2` | 5 file: evento, `rtg-squad-controller.js` (4 volte, con il nome "Occult Halloween"), premio finale, 2 file dati |
| Date | fine `Date.UTC(2026,10,6,22,59,59)`; **nessuna data di inizio** (l'evento è aperto da quando è pubblicato) | `rtg-halloween-event.js` riga 5 |
| Prezzo e premi | capsula 200 zucche, vittoria 300, vittoria fortunata 600 con probabilità 10% | `rtg-halloween-event.js` righe 9-10 e 1392 |
| Carte | 18 giocatori Occult (14 Forte, 2 Elite, 2 Leggenda), id `38…53` + `custom_0001`, `custom_0002`; premio segreto `custom_0003` (Shawn) | dati in `data/rtg-halloween-occult-players.json`, `-lineup.json`, `-moves.json`; il premio segreto è **scritto nel codice** (`rtg-halloween-completion-reward.js`); il conteggio "18 + premio" e l'espressione `custom_000[123]` sono scritti in `rtg-album-view.js` |
| Mosse | 4 mosse per giocatore (`halloweenMoves`) | dati; ma la parola `halloweenMoves` è letta in 6 file (motore poteri, partita, scheda) |
| Allenatore | `halloween-coach-54` (Hekyll Jyde) | catalogo in `rtg-coaches.js`; id ripetuto in 7 file (18 volte) |
| Potere | "Maschera Maledetta": un titolare Halloween vale 15 OVR in meno nei requisiti | **codice**: `if(coachId==="halloween-coach-54")` in `rtg-coach-powers-runtime.js` e `rtg-coach-powers-squad-ui.js`; titolo e testi in `rtg-coach-powers-squad-ui.js`; il numero 15 in `rtg-squad-controller.js` |
| Sigla carta | `HW` | `rtg-card-identity.js`, `rtg-squad-controller.js`, `rtg-coaches-view.js`, CSS (`[data-legacy-season="HW"]`, 11 volte) |
| Immagini | banner, cimitero, zucca, logo, 16 fullbody | **20 indirizzi esterni** scritti nel file evento (magnific, depositphotos, vecteezy, CloudFront); 16 ritratti CloudFront + **2 immagini base64** nei dati |
| Tema | colori, scheda giocatore, carta, badge | `css/rtg-halloween-event.css` (827 righe, **379 colori diversi**, 64 classi `halloween-*`), parte in `css/rtg-coaches.css` |
| Salvataggio | `shared.halloween = {pumpkins, ownedIds, pullCount, completedIds, luckyWins}`; carte `halloween2026::<id>` | `rtg-cloud-snapshot.js`, `rtg-repository.js`, `rtg-cloud-local-adapter.js` |

### 1.2 Errori passati: dati, CSS o altro?

Ho classificato i commit di `main` che hanno toccato i file di evento, allenatori e poteri: **217 commit in 12 giorni**
(21 ottobre → 2 novembre), di cui **116 correzioni**. La classificazione si basa sul titolo del commit, quindi è
indicativa (±10%).

| Causa | Correzioni | Esempi |
|---|---|---|
| **Integrazione con le schermate RTG native** (squadra, selettore giocatori, album, prepartita, duelli, distributore) | ~36 | slot tattici persi, filtri del selettore, panchina, ritmo dei duelli, fisica delle capsule |
| **Dati: immagini e identità di carte e allenatori** | ~27 | fullbody sbagliati (Nathan, Samford), René con id 4761 invece di 4763, Hekyll fullbody, badge HW, stemma Occult |
| **Poteri degli allenatori (logica)** | ~25 | Maschera Maledetta non applicata alla rosa risolta, Arrows/Yi/Zoolan sulle carte Halloween, selezioni scadute dopo un cambio |
| **Dati: numeri e regole dell'evento** | ~12 | prezzo capsula 200, proroga al 6 novembre, zucche solo con la vittoria, cap OVR, 10% fortunato |
| **CSS / tema** | ~9 (17 commit toccano un file CSS) | contrasto del testo, badge HW nero, proporzioni dei fullbody, scheda Halloween |
| Altro | ~7 | |

**Le "carte sbagliate"** dipendevano soprattutto dai **dati scritti dentro il codice** (indirizzi delle immagini, id,
quale carta è "evento") e dall'integrazione, non dal CSS. Il CSS ha causato i problemi di leggibilità e, questa
settimana, la regressione della scheda Halloween di #549.

**I poteri degli allenatori che non vanno quando si apre una season nuova** non dipendevano dal CSS né dai file dati,
ma da **elenchi scritti nel codice**:
- `rtg-coaches.js` ha `CAMPAIGN_SEASONS` scritto a mano: lo sblocco degli allenatori segue quell'elenco. La correzione
  `549dfe8` ("preserve René and all coach Season unlocks after a completed campaign replay") nasce da qui;
- `rtg-coach-powers-runtime.js` ha `powerReady = ["208","1329","1777","1974","4401","halloween-coach-54"]`: un
  allenatore nuovo, o di un evento nuovo, non ha potere finché qualcuno non aggiunge il suo id a mano;
- ogni potere è un `if(coachId === "...")` nel motore: il potere *è* codice, non dato.

### 1.3 L'evento dipende dalle liste di season scritte a mano?

**Sì, in tre modi.** Non usa `ACTIVE_SEASON_IDS` direttamente, ma:
1. scrive `"ie1"` **23 volte** nel file evento: formazioni, database, regole dei requisiti, risolutore delle carte.
   La squadra evento "vive" dentro la Season 1;
2. carica tutte le season con un elenco scritto a mano: `needed = ["ie1","ie1_s2","ie1_s3","ie2","orion"]`
   (riga 1489). Una season nuova non verrebbe caricata, e le sue carte non comparirebbero nella squadra evento;
3. le etichette delle season (Season 1 / S1 … Orion / OR, e "Halloween" / HW) sono **copiate in 4 file**:
   evento, `rtg-squad-controller.js`, `rtg-card-identity.js`, `rtg-development-controller.js`.

**Quanta parte del Passo 2 serve.** Non tutto il Passo 2: niente shop, sviluppo, gacha o mappa. Serve una **fetta piccola**:
- un **registro unico delle season** con id, ordine, campagna, etichetta lunga e corta, letto da tutti al posto
  delle 4 copie;
- una funzione "tutte le season", al posto dell'elenco scritto a mano;
- il campo `baseSeasonId` nel file evento, al posto di `"ie1"` scritto 23 volte.

È **una PR** (la 3.0 qui sotto). Il resto del Passo 2 si può fare dopo, senza bloccare gli eventi.

---

## 2. Formato del file evento

Un file per evento: `data/events/<id>.json`. Le statistiche dei giocatori restano nei file dati che esistono già
(`players`, `lineup`, `moves`): il manifest li **indica** e dichiara ciò che serve per controllarli.

```json
{
  "schemaVersion": 1,
  "id": "halloween2026",
  "name": "Occult Halloween",
  "labels": { "badge": "HW", "collection": "Halloween", "filter": "Halloween" },

  "window": { "start": "2026-10-28T00:00:00+01:00", "end": "2026-11-06T23:59:59+01:00" },
  "baseSeasonId": "ie1",

  "save": { "key": "halloween", "cardIdPrefix": "halloween2026::" },

  "currency": { "id": "pumpkins", "name": "Zucche", "icon": "assets/events/halloween2026/pumpkin.webp" },
  "economy": { "pullPrice": 200, "winPrize": 300, "luckyPrize": 600, "luckyChancePercent": 10 },

  "team": {
    "teamId": "occult-2",
    "name": "Occult Halloween",
    "logo": "assets/events/halloween2026/occult-logo.webp",
    "files": {
      "players": "data/rtg-halloween-occult-players.json",
      "lineup": "data/rtg-halloween-occult-lineup.json",
      "moves": "data/rtg-halloween-occult-moves.json"
    },
    "rosterSize": 18,
    "startersSize": 11
  },

  "cards": [
    { "playerId": "38", "rarity": "Forte", "fullbody": "assets/events/halloween2026/38-fullbody.webp", "vampire": true },
    { "playerId": "custom_0001", "rarity": "Leggenda", "fullbody": "assets/events/halloween2026/custom_0001-fullbody.webp", "vampire": false }
  ],
  "completionReward": {
    "playerId": "custom_0003", "name": "Shawn Froste", "rarity": "Leggenda",
    "portrait": "assets/rtg/halloween-shawn-portrait.webp", "fullbody": "assets/rtg/halloween-shawn-fullbody.webp",
    "requires": { "allCards": true, "coachId": "halloween-coach-54" }
  },

  "coaches": [
    {
      "id": "halloween-coach-54", "zukanId": "54", "name": "Hekyll Jyde",
      "portrait": "assets/events/halloween2026/hekyll-portrait.webp",
      "fullbody": "assets/events/halloween2026/hekyll-fullbody.webp",
      "power": {
        "type": "requirementsOvrDiscount",
        "name": "Maschera Maledetta",
        "description": "Scegli un tuo titolare della collezione Halloween. Per i soli requisiti OVR della squadra, il suo contributo vale 15 punti in meno.",
        "pickerTitle": "SCEGLI UN TITOLARE HALLOWEEN",
        "params": { "amount": 15, "picks": 1, "target": "ownStarter", "cardScope": "event" }
      }
    }
  ],

  "assets": {
    "banner": "assets/events/halloween2026/banner.webp",
    "background": "assets/events/halloween2026/graveyard.webp"
  },

  "theme": {
    "tokens": {
      "--event-bg": "#23131b",
      "--event-surface": "#170f18",
      "--event-panel": "#221622",
      "--event-accent": "#f98a27",
      "--event-accent-strong": "#ff9028",
      "--event-text": "#fff0d6",
      "--event-text-muted": "#edd7c9",
      "--event-danger": "#ff304b",
      "--event-ink": "var(--ir-ink)",
      "--event-paper": "var(--ir-paper)",
      "--event-on-accent": "var(--ir-ink)"
    }
  }
}
```

(L'elenco `cards` contiene tutte e 18 le carte; qui ne sono mostrate 2. `vampire` riproduce la regola di oggi:
tutte le carte hanno lo stile "vampiro" tranne le due speciali `custom_0001` e `custom_0002`.)

Note sul formato:
- **`id` e `save.cardIdPrefix` non cambiano mai.** Le carte già possedute si chiamano `halloween2026::<id>`, e
  CLAUDE.md vieta di riscriverle.
- **`save.key`**: Halloween resta in `shared.halloween`, per non cambiare il formato di salvataggio.
  - Un evento *nuovo* avrebbe bisogno di un posto suo nel salvataggio, per esempio `shared.events.<id>`.
  - **Questo è un cambio di formato del salvataggio: va approvato a parte.** Si aggiunge un campo, non se ne tocca
    nessuno: i salvataggi vecchi restano validi senza migrazione.
- **`window.start`** oggi non esiste nel codice. Il valore dell'esempio è **da confermare**.
  - Le date si scrivono con il fuso (`+01:00`), così "23:59 italiane" si legge direttamente.
- **`economy`**: sono numeri di bilanciamento. **Li sposto con valori identici e un test che lo garantisce.**
  Cambiarli resta una decisione dell'utente.
- **`power.type`**: i poteri non diventano "codice nei dati".
  - Esiste un **registro dei tipi di potere** nel codice (per ora uno: `requirementsOvrDiscount`, quello di Hekyll).
  - Il file evento sceglie un tipo e i suoi parametri.
  - Un evento con un potere di tipo nuovo richiede codice nuovo: una volta, nel registro, non nel motore.
  - Gli altri 10 allenatori restano come sono.
- **`theme`**: i colori di Halloween **non esistono tra i `--ir-*`** (che sono neutri: inchiostro, carta, bianco,
  giallo).
  - Propongo variabili `--event-*` scritte nel file evento e applicate con un attributo `data-event="<id>"`,
    come chiede CLAUDE.md per i temi.
  - Dove il colore è neutro si usa `var(--ir-*)`.
  - Il CSS di Halloween però ha 379 colori diversi. Ridurli a ~11 variabili **cambia l'aspetto**. Due strade:
    - **A (consigliata)**: un **CSS tema generico** (`css/rtg-event-theme.css`) che usa solo `--event-*`, per gli
      eventi nuovi. Halloween tiene il suo CSS per le parti già finite (schermate dell'evento chiuse dopo il
      6 novembre). Le parti che restano visibili per sempre (carta, scheda, badge, allenatore) passano alle
      variabili, con foto prima/dopo.
    - **B**: convertire tutto Halloween alle ~11 variabili. È più pulito, ma cambia leggermente i colori e va
      approvato con le foto.
- **`assets`**: tutto locale in WebP (`assets/events/<id>/`). Oggi Halloween usa 20 indirizzi esterni nel codice,
  16 CloudFront nei dati e 2 immagini base64.

---

## 3. Test dei dati (`tests/event-manifest-test.js`)

Per **ogni** file in `data/events/`:

1. **Forma**:
   - campi obbligatori e tipi giusti;
   - `id` uguale al nome del file;
   - `id`, `labels.badge` e `save.cardIdPrefix` unici tra eventi **e** season: `HW` non può essere `S1`/`AR`…
2. **Date**:
   - `start` ed `end` validi, con fuso orario;
   - **`end` dopo `start`**;
   - durata ragionevole (meno di 90 giorni).
3. **Season base**: `baseSeasonId` esiste nel registro delle season.
4. **Carte**:
   - **ogni carta esiste** nel file `players` della squadra;
   - **la rarità dichiarata è uguale** a quella dei dati ed è una rarità RTG valida;
   - ha 4 mosse nel file `moves`;
   - numero carte = `rosterSize`; gli 11 titolari del `lineup` sono 11 diversi e tutti tra le carte;
   - ogni immagine indicata esiste in `assets/` ed è WebP o AVIF.
5. **Premio finale**: la carta esiste (o è descritta tutta nel manifest) e non è tra le carte del distributore.
6. **Allenatori**:
   - id unico rispetto al catalogo `rtg-coaches.js`;
   - **`power.type` esiste nel registro** e i `params` rispettano lo schema di quel tipo (es. `amount` intero tra 1 e 30);
   - **esiste almeno una carta a cui il potere si può applicare** (per `cardScope: "event"`, `target: "ownStarter"`:
     almeno una carta dell'evento può fare il titolare).
7. **Economia**: numeri interi positivi; `luckyChancePercent` tra 0 e 100.
8. **Tema**:
   - **ci sono tutte le variabili richieste** dal CSS tema generico: il test legge le `var(--event-*)` usate nel
     CSS e controlla che il file evento le definisca;
   - ogni valore è un colore valido o `var(--ir-…)` di un token che esiste in `game.css`;
   - **contrasto** testo/sfondo almeno 4,5:1 (`--event-text` su `--event-bg`, `--event-on-accent` su `--event-accent`).
9. **Parità con oggi (solo Halloween)**: i valori del manifest sono **uguali** a quelli del codice di adesso
   (200/300/600/10%, `occult-2`, 18 carte con le stesse rarità, fine `2026-11-06 22:59:59 UTC`, Hekyll e il suo -15).
   È la garanzia che spostare i dati non cambia il gioco.

Più una **prova nel browser** per ogni evento: si apre l'evento, si gira il distributore, si mette una carta in squadra,
si configura il potere dell'allenatore, si apre la scheda della carta (anche fuori dall'evento) e si controlla il tema
(colori calcolati = token del manifest).

---

## 4. Evento finto di prova

`data/events/test-inverno.json`: **"Evento Inverno (prova)"**, visibile solo con `?dev=1` (campo `"testOnly": true`).
- **Squadra**: una squadra già esistente in un file dati (es. una squadra IE1), con prefisso carte nuovo
  `testinverno::`. Nessuna immagine nuova obbligatoria: usa i ritratti locali già presenti.
- **Allenatore**: un allenatore finto con lo **stesso tipo di potere** (`requirementsOvrDiscount`, `amount: 10`).
- **Tema**: palette blu/bianca con le stesse variabili `--event-*`.
- **Date**: sempre aperto in modalità dev.

**Criterio di successo** (quello delle istruzioni): l'evento finto si aggiunge **con un solo file nuovo**, senza
toccare controller, album, allenatori, identità delle carte o CSS. Passano:
- il test dei dati;
- la prova nel browser;
- la copertura (schermate dell'evento finto).

Se per farlo funzionare serve toccare codice, il sistema non è ancora generico e lo scrivo nella PR.

---

## 5. Piano delle PR

Tutte partono da `release/passo-1-css` e puntano a quel ramo. Niente in `main`.

| PR | Contenuto | Rischio |
|---|---|---|
| **3.0** | Registro unico delle season (id, ordine, campagna, etichette); tolte le 4 copie delle etichette e l'elenco `needed` | basso |
| **3.1** | `data/events/halloween2026.json` + caricatore + **test dei dati e di parità**; il codice legge prezzi, date, squadra e carte dal manifest (valori identici) | basso |
| **3.2** | Registro dei tipi di potere; Hekyll dal manifest; `powerReady` letto dal registro; test di parità del potere (stesso OVR prima/dopo) | medio |
| **3.3** | Modulo evento generico: via `halloween2026`, `occult-2`, `HW`, `"ie1"` e `custom_000[123]` scritti nei 25 file; tutto dal manifest. Salvataggio invariato | **alto** (la più grande) |
| **3.4** | CSS tema generico `--event-*` + `data-event`; carta, scheda e badge Halloween sulle variabili (foto prima/dopo) | medio |
| **3.5** | Immagini Halloween in locale (WebP) al posto dei 20 indirizzi esterni e delle 2 base64 | basso (servono 5 host oggi bloccati, o le immagini dall'utente) |
| **3.6** | Evento finto + prova nel browser + schermate di copertura | basso |

Le verifiche "a evento finito" (dopo il 6 novembre alle 23:59 italiane) si fanno su 3.1-3.4.
