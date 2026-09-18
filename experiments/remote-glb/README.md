# Remote GLB player prototype

Esperimento isolato per verificare una sola ipotesi architetturale:

> il database del gioco può contenere soltanto un URL per giocatore e il relativo GLB può essere
> scaricato e istanziato esclusivamente quando la UI richiede il 3D.

## Cosa NON fa

- non modifica index.html del gioco;
- non cambia player detail, gameplay, RTG, salvataggi o IndexedDB;
- non aggiunge file .glb al repository;
- non usa asset di Victory Road;
- non pretende di risolvere la sostituzione delle divise.

## Cosa prova

Aprire /experiments/remote-glb/ carica il piccolo manifest
data/REMOTE_3D_PROTOTYPE.json, ma mantiene il contatore richieste GLB a 0.

Solo il click su Carica modello esegue:

    model id
      -> modelUrl nel manifest
      -> fetch remoto on-demand
      -> verifica magic glTF
      -> GLTFLoader.parse(ArrayBuffer)
      -> scena Three.js

Rilascia memoria rimuove il modello dalla scena e libera:

- geometrie;
- materiali;
- texture, incluse quelle annidate negli uniform/material;
- skeleton e bone texture;
- ImageBitmap quando il browser li espone;
- cache interna del parser GLTF.

## Stress test

Il pulsante Stress test ×100 esegue 100 cicli consecutivi:

    carica -> render -> rilascia -> misura

Prima del ciclo 1 viene misurato il baseline GPU della pagina vuota. Alla fine il test è PASS
solo se geometrie e texture GPU tornano allo stesso baseline o sotto. L'heap JavaScript viene
mostrato come dato diagnostico ma non determina il PASS, perché il momento della garbage
collection è deciso dal browser.

## Asset di test

Il test usa asset pubblici di Khronos glTF Sample Assets perché servono solo a verificare
trasporto, parsing, skinning e rilascio memoria. I modelli non vengono copiati nel progetto.

- CesiumMan: modello umano con skin e animazione, CC BY 4.0.
- Fox: modello animato leggero; licenze indicate nel README upstream.

Three.js viene caricato soltanto dalla pagina laboratorio ed è fissato alla versione 0.186.0.

## Limite importante

Le metriche Web disponibili non equivalgono alla RAM totale del processo browser. Il prototipo
mostra i contatori GPU di Three.js (renderer.info.memory) e, quando Chromium lo espone,
performance.memory.usedJSHeapSize. La verifica definitiva su mobile richiede quindi anche un
test reale del browser/dispositivo.
