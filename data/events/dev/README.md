# Eventi finti (solo sviluppo)

I file di questa cartella **non** sono elencati in `data/events/index.json` e il gioco normale non li carica.
Si aprono solo con `?dev=1&evento=<id>` (es. `index.html?dev=1&evento=prova_dev`).

Un evento finto salva tutto in chiavi locali `dev:<id>:...` (campo `save.storagePrefix`): non scrive mai
`shared:account`, quindi non tocca l'account vero e non arriva nel cloud. Alla prima apertura parte da una
copia dell'account vero, solo letta.

Serve a provare il formato degli eventi (Passo 3.5) senza aspettare un evento reale.

## Squadra dell'evento di prova (Passo 4.2)

`prova_dev/` contiene la squadra propria dell'evento di prova, "Angeli di prova" (`prova-angeli`): gli 11 giocatori
di `data/DARK_ANGELS_team.json` con la formazione di `data/DARK_ANGELS_lineup.json` e le 4 mosse di ciascuno prese
dal database delle mosse RTG (Season `ie1_s3`, `rtg-four-moves-runtime.js`). Nessun dato inventato: cambia solo l'id
e il nome della squadra. Allenatore "Allenatore di prova" (sconto 10) e valuta "Gettoni prova" sono propri.
