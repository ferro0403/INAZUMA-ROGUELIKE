# Eventi finti (solo sviluppo)

I file di questa cartella **non** sono elencati in `data/events/index.json` e il gioco normale non li carica.
Si aprono solo con `?dev=1&evento=<id>` (es. `index.html?dev=1&evento=prova_dev`).

Un evento finto salva tutto in chiavi locali `dev:<id>:...` (campo `save.storagePrefix`): non scrive mai
`shared:account`, quindi non tocca l'account vero e non arriva nel cloud. Alla prima apertura parte da una
copia dell'account vero, solo letta.

Serve a provare il formato degli eventi (Passo 3.5) senza aspettare un evento reale.
