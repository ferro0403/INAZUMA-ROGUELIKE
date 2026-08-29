# InaZumo moves extractor — Phase 1

Questo tool è **separato dal gameplay** di Inazuma Roguelike.

Scopo della Phase 1: costruire un database grezzo e riutilizzabile delle supertecniche presenti su InaZumo, senza modificare run, save, simulatori, dataset di squadra o player.

## Regola di progetto già fissata

Nel gioco finale un giocatore avrà **una sola mossa equipaggiata/assegnata**.

La stessa identità `playerId` potrà però avere una mossa diversa in Season diverse. Questa Phase 1 non assegna ancora mosse ai giocatori: prepara soltanto il catalogo canonico da cui verranno poi scelte.

## Dati estratti per ogni tecnica

- `moveId` stabile, preferibilmente derivato dallo slug InaZumo;
- `name`: nome inglese piccolo mostrato da InaZumo;
- `sourceNameEs`: nome grande spagnolo;
- `type`: `shot`, `dribble`, `defense`, `save`;
- `sourceTypeEs`: tipo originale spagnolo;
- `element`: `Fire`, `Wind`, `Mountain`, `Forest`;
- `sourceElementEs`: elemento originale spagnolo;
- `power`;
- `tension`;
- `flags`: attualmente conserva `long_shot` e `counterattack` quando presenti;
- `sourceUrl`.

Non viene aggiunto alcun valore gameplay, rarità, bonus o assegnazione player.

## Installazione Windows

Dalla root del repository:

```bat
py -m venv .venv
.venv\Scripts\activate
pip install -r tools\inazumo_moves\requirements.txt
python -m playwright install chromium
```

## Primo test consigliato

Prima di lanciare tutto il catalogo:

```bat
python tools\inazumo_moves\extract_moves.py --headed --limit 10
```

Output:

```text
tools/inazumo_moves/output/moves_catalog_raw.json
```

Controllare che per le 10 tecniche risultino corretti:

- nome inglese;
- nome spagnolo;
- tipo;
- elemento;
- potenza;
- tensione.

Se il test è corretto, eseguire tutto:

```bat
python tools\inazumo_moves\extract_moves.py --headed
```

Per riprendere un'estrazione già iniziata riusando i dettagli già salvati:

```bat
python tools\inazumo_moves\extract_moves.py --headed --resume
```

## Perché visita anche il dettaglio della tecnica

Il catalogo principale espone già gran parte dei dati, ma l'elemento può richiedere la pagina di dettaglio. Per questo `--resolve-details` è attivo di default.

Per un test veloce senza aprire ogni dettaglio:

```bat
python tools\inazumo_moves\extract_moves.py --headed --limit 20 --no-resolve-details
```

## Diagnostica

Se il sito cambia struttura e non viene riconosciuta nessuna tecnica, il tool salva automaticamente:

```text
tools/inazumo_moves/output/inazumo_catalog_debug.html
```

Questo file serve per aggiornare i selettori senza toccare il gioco.

## Output raw, non database definitivo del gioco

`moves_catalog_raw.json` è intenzionalmente un artefatto locale/intermedio e non viene committato automaticamente.

La fase successiva sarà l'estrazione dei candidati per giocatore e poi l'associatore Season-aware. L'assegnazione finale dovrà essere concettualmente del tipo:

```json
{
  "seasonId": "ie1",
  "playerId": "123",
  "moveId": "god-hand"
}
```

mentre lo stesso `playerId` in un'altra Season potrà puntare a un altro `moveId`.
