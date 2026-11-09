# Evento Vento-Fuoco — Passo dati (non ancora attivo)

Import dei database consegnati il 9 novembre 2026, su base main 77429e7cb9c6.
Le sei risorse sotto `data/events/vento_fuoco/` NON sono nell'indice eventi:
questo passo non cambia gameplay, schermate, salvataggi o cloud.

## Dati verificati
- Fire Team: id `fire-team`, 19 giocatori, 3-4-3, livello 20.
- Blizzard Team: id `blizzard-team`, 19 giocatori, 3-4-3, livello 20.
- 38 ID univoci, quattro mosse per carta (152 mosse).
- Nomi delle squadre provvisori, da aggiornare dopo la conferma del proprietario.
- `totalPlayers: 30` nei file team rimane un metadato dell'export originale:
  i roster **effettivamente consegnati** hanno 19 giocatori ciascuno.
- Mosse e statistiche trascritte dall'export senza modifiche.
- Formazioni separate per le due squadre; id squadra uniformati ai file team.

## Specifiche approvate per la futura integrazione
- Un evento `vento_fuoco`, con due sfide indipendenti e due valute:
  stemmi Fuoco contro Fire Team; stemmi Vento contro Blizzard Team.
- Vittoria +300 della valuta della squadra affrontata.
- Vittoria fortunata +600, probabilità 20%; costo pull 200.
- Due distributori con pool separati e switch nella stessa schermata,
  skin fuoco/vento; entrambe le squadre nell'album Giocatori evento.
- Carte speciali più difficili: Aiden Froste (`4539`), Torch (`1105`),
  Shawn Froste (`4538`), Gazelle (`1122`). Pesi di estrazione
  prima dell'attivazione: peso 1 per ciascuna delle 4 carte speciali, peso 3 per ciascuna altra carta nello stesso distributore (probabilità individuale 3 volte inferiore). Rarità Mondiale e OVR restano quelli consegnati.
- Allenatori indicati dal proprietario: zukan 4818 Fuoco, 4602 Vento.
  **Poteri e dati di catalogo ancora da definire:** non creare poteri fittizi.
- Finestra richiesta: 2026-11-09 18:29:26 → 2026-11-16 18:29:26 Europe/Rome.
  Usare ISO con fuso `+01:00`; evitare di rendere l'evento visibile prima
  della review e della promozione dal sandbox.
- Miximax fuori dallo scope: consumi e rifusione richiedono fix cloud dedicato,
  compatibile con salvataggi storici. Nessuna modifica alla persistence ora.

## Prossimi passi (PR a catena, merge solo della PR finale)
1. Manifest `data/events/dev/vento_fuoco_dev.json` con salvataggi isolati
   `dev:vento_fuoco_dev:`, home personalizzata; nessuna iscrizione in
   `data/events/index.json` fino alla conferma del proprietario.
2. Hook generici per premiare la valuta dell'avversario e selezionare il
   distributore/pool; conservare la parità totale con Halloween.
3. Skin carte per squadra tramite hook `classes`; CSS del componente
   esistente, senza nuovi file di patch, e album a due squadre.
4. Allenatori dopo ricezione poteri e immagini/catalogo.
5. Test regressioni, salvataggi e browser/Safari; promozione a evento reale
   in PR finale verificata dal proprietario.

Verifiche del passo corrente: `node tests/vento-fuoco-data-test.js`.
