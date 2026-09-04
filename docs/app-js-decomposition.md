# APP.JS DECOMPOSITION — FASE 1

## Obiettivo

Ridurre progressivamente il monolite `js/app.js` in moduli di dominio piccoli e testabili senza cambiare intenzionalmente il gameplay durante le PR di estrazione.

## Confine architetturale obbligatorio

### Run: solo locale

La run e tutto il suo stato derivato appartengono esclusivamente allo storage locale. Questo include almeno:

- roster, lineup, panchina e modulo;
- vite, livello run, mappa, nodi, boss e checkpoint;
- 5v5;
- boss match;
- special match;
- partite 11v11 secondarie;
- activeMatch e risultati;
- pull, candidati, reroll e reclutamenti della run;
- inventario temporaneo della run;
- pendingBossVictory, postBossFlow, game over e finalizzazione della run.

Firebase/cloud non deve salvare, ripristinare, selezionare, bloccare o sovrascrivere una run.

### Cloud: solo stato account permanente

Il cloud resta autorizzato esclusivamente per:

- profilo;
- negozio/economia permanente;
- Centro di Sviluppo;
- Album;
- Albo d'Oro.

Il solo passaggio Run -> Account deve avvenire tramite effetti permanenti idempotenti con ID stabile; il cloud non riceve lo snapshot della run.

## Strategia di decomposizione

Ogni estrazione deve preservare il comportamento corrente. Correzioni funzionali e modifiche di gameplay vengono effettuate in PR successive e separate.

Ordine iniziale:

1. Player Identity / Recruitment / Pull;
2. 5v5;
3. match 11v11 secondarie;
4. boss e post-boss;
5. game over e finalizzazione;
6. resto del match engine;
7. schermate e navigazione residue.

## Fase 1

La prima estrazione introduce `js/recruitment/player-identity.js` come proprietario unico della semantica di identità già usata dal recruitment pool. In questa fase non vengono ancora corretti i duplicati: la correzione arriverà dopo la verifica di parità della nuova separazione.
