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

## Stress test multi-modello

Il pulsante **Stress multi 20×5** usa **20 URL GLB realmente diversi** e li percorre per
**5 giri completi**, per un totale di 100 caricamenti:

    modello A -> release
    modello B -> release
    ...
    modello T -> release
    ripeti per 5 giri

Il set include asset statici, animati, riggati/skinned, texturizzati e con materiali differenti.
Il primo giro sui 20 modelli è un **warm-up controllato**. Serve a far creare a Three.js le
eventuali risorse interne lazy necessarie a materiali o pipeline che non erano mai stati usati
prima (per esempio render target interni). Subito dopo il warm-up viene registrato un nuovo
baseline GPU.

I successivi 4 giri, cioè 80 caricamenti/rilasci, sono la parte che decide il risultato:
il test è **PASS STABILE** soltanto se geometrie e texture GPU non crescono rispetto al baseline
post-warm-up.

Il report mostra separatamente:

- delta cold -> warm-up, che può includere allocazioni one-shot del renderer;
- delta warm-up -> finale, che deve restare a 0 o sotto.

In questo modo una singola texture interna persistente di Three.js non viene confusa con un leak
che cresce a ogni giocatore. L'heap JavaScript resta diagnostico e non determina il PASS, perché
il garbage collector è gestito dal browser.

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
