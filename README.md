INAZUMA ROGUELIKE — SEASON 1 PROTOTYPE

COME AVVIARE SU WINDOWS
1. Estrai tutta la cartella.
2. Apri AVVIA_GIOCO.bat.
3. Il browser aprirà http://localhost:8000.

In alternativa usa Visual Studio Code + Live Server.
Non aprire index.html direttamente con doppio clic: i browser possono bloccare
il caricamento dei database JSON quando la pagina usa il protocollo file://.

CONTENUTO ATTUALE
- Nuova run con nome squadra obbligatorio e continua salvataggio.
- Scelta di 6 moduli, compreso il 4-2-4.
- Draft iniziale: 11 scelte da 1 giocatore su 3 in base ai ruoli del modulo.
- Rosa con 11 titolari e fino a 4 riserve.
- Cambio modulo e scambio titolare/riserva dello stesso ruolo.
- Percorsi casuali ramificati e persistenti.
- Nodi 5v5, oggetto, pull, evento casuale, scambio e boss.
- Scambi filtrati per ruolo e finalOverall, con giocatore ricevuto a +1 livello.
- Inventario da 20, consumabili ed equipaggiamenti individuali con bonus +5.
- Punto interrogativo che nasconde un vero nodo con probabilità proporzionali.
- Gettone scout, portafortuna, kit medico e oggetti di allenamento funzionanti.
- 2 vite e ripristino al checkpoint del boss corrente.
- Progressione, due ricompense 1-su-3 dopo i boss e sblocco squadre.
- Salvataggio automatico in localStorage.

LIMITI VOLUTI DEL PROTOTIPO
- Le partite usano pulsanti Vittoria/Sconfitta per testare la run.
- Le grafiche e le icone sono provvisorie.
- Percentuali delle categorie e forza degli oggetti potranno essere bilanciate dopo i test.
- Allenatori e partite secondarie 11v11 sono disattivati nella Season 1.

FILE DI CONFIGURAZIONE
Le probabilità e le regole provvisorie sono in js/season1-config.js.
