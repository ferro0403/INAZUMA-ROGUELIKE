# Direzione visiva ufficiale del restyle UI

Questo documento formalizza la direzione artistica futura di Inazuma Roguelike. Non introduce codice, CSS definitivo, mockup implementati o modifiche al comportamento dell'applicazione.

La direzione deriva da:

- `docs/UI_RESTYLE_PLAN.md`;
- `docs/UI_SCREEN_INVENTORY.md`;
- le due immagini di riferimento allegate alla conversazione, interpretate rispettivamente come riferimento principale mobile e desktop;
- il codice corrente del repository, che resta la fonte tecnica finale per superfici, stati e vincoli di interazione.

Le indicazioni qui contenute descrivono un linguaggio visivo da validare progressivamente. Non sostituiscono i test visuali, le fixture deterministiche o le verifiche responsive previste nelle fasi successive.

# 1. Visione del restyle

Il concetto centrale è:

> **Interfaccia anime calcistica da torneo, luminosa, energica e competitiva, basata su bianco, nero, giallo e oro.**

Il risultato percettivo desiderato deve comunicare immediatamente:

- competizione;
- calcio;
- energia anime;
- progressione da torneo;
- identità Inazuma;
- importanza delle decisioni della run;
- chiarezza delle informazioni tattiche.

L'interfaccia dovrà sembrare parte di un videogioco calcistico, non un sito che ospita un gioco. La shell, i pannelli, le Player Card, le navigazioni e le modali dovranno condividere lo stesso linguaggio, pur adattandosi alla densità e alla funzione di ogni schermata.

Il bianco sarà il colore dominante delle superfici, ma non dovrà produrre un'interfaccia piatta, vuota o indistinta. La profondità dovrà emergere attraverso:

- bordi neri riconoscibili;
- fasce gialle o oro;
- tagli diagonali;
- sovrapposizioni controllate;
- contrasti netti;
- ombre più grafiche che fotografiche;
- pattern e dettagli ispirati a fulmini, tabelloni e broadcast sportivi.

Il tema non sarà una semplice sostituzione del blu attuale con il bianco. La nuova identità dovrà ripensare gerarchia, superfici e ritmo visivo senza cambiare il funzionamento dell'applicazione.

La grafica dovrà essere:

- riconoscibile anche senza immagini decorative;
- leggibile nelle schermate dense;
- coerente tra mobile e desktop;
- energica senza diventare caotica;
- moderna senza assumere il linguaggio di una dashboard SaaS;
- luminosa senza sacrificare contrasto e accessibilità.

La grafica non dovrà sembrare:

- una dashboard aziendale;
- un'app bancaria;
- un sito generico;
- una raccolta di riquadri bianchi privi di identità;
- un'interfaccia eccessivamente elegante o minimale;
- un collage di stili differenti;
- una copia diretta di un singolo gioco o prodotto esistente.

# 2. Ruolo semantico dei colori

Le tonalità HEX definitive restano da approvare. In questa fase vengono definiti i ruoli semantici, affinché il colore non sia utilizzato in modo arbitrario o contraddittorio tra schermate.

## Bianco

Il bianco sarà il fondamento delle superfici informative. Verrà utilizzato principalmente per:

- sfondi di pagina o aree centrali;
- pannelli;
- card;
- aree di contenuto;
- modali;
- separazione visuale;
- leggibilità di testi e dati;
- superfici sulle quali far risaltare nero, giallo, oro e rarità.

Non sarà necessario usare sempre bianco puro. Saranno preferibili, secondo il contesto:

- bianchi caldi;
- avorio;
- grigi chiarissimi;
- superfici leggermente differenziate;
- variazioni appena percettibili tra shell, pannello e card.

Queste variazioni dovranno evitare sia l'effetto “pagina vuota” sia l'accumulo di troppe tonalità quasi uguali.

## Nero

Il nero avrà una funzione strutturale e competitiva. Verrà utilizzato per:

- testi principali;
- bordi;
- outline;
- navigazione;
- pannelli ad alto contrasto;
- overlay;
- separatori;
- elementi competitivi;
- ombre nette;
- fasce e testate;
- stati che richiedono massima leggibilità.

Il nero non dovrà trasformare nuovamente l'interfaccia in un tema prevalentemente scuro. Dovrà costruire e delimitare il bianco, non sostituirlo.

## Giallo

Il giallo sarà il colore dell'energia Inazuma e dell'azione. Verrà utilizzato per:

- azioni primarie;
- focus;
- selezioni;
- elementi attivi;
- indicatori importanti;
- evidenziazioni;
- progressione;
- dettagli a forma di fulmine;
- accenti rapidi e ad alta riconoscibilità.

Il giallo non dovrà essere utilizzato come testo sottile su fondo bianco. Quando serve come sfondo o fascia, il testo dovrà essere nero o comunque ad alto contrasto.

## Oro

L'oro avrà un ruolo più raro e prestigioso del giallo. Verrà utilizzato in modo limitato per:

- boss;
- trofei;
- vittorie;
- ricompense speciali;
- elementi di prestigio;
- rarità elevate;
- Album;
- Albo d'Oro;
- celebrazioni finali;
- accenti premium.

Giallo e oro non dovranno diventare indistinguibili. Il giallo dovrà comunicare energia, azione e selezione; l'oro dovrà comunicare prestigio, rarità e risultato.

La distinzione dovrà essere garantita non soltanto dalla tonalità, ma anche da:

- frequenza d'uso;
- contesto;
- materiali o texture;
- bordi;
- pattern;
- icone;
- intensità della luce.

## Colori secondari funzionali

I colori secondari resteranno disponibili quando hanno una funzione comprensibile:

- **rosso:** sconfitta, pericolo, avversari, vite perse, errori e azioni distruttive;
- **verde:** campo, successo, formazione valida e conferme positive;
- **colori rarità:** devono restare riconoscibili e distinguibili;
- **colori squadra o asset:** possono essere conservati quando appartengono a loghi, divise o illustrazioni.

Il blu non dovrà essere il colore dominante di:

- shell;
- pannelli;
- navigazione;
- pulsanti principali;
- bordi strutturali;
- sfondo generale dell'applicazione.

Un blu residuale potrà esistere soltanto quando è strettamente funzionale a:

- elementi;
- statistiche;
- asset specifici;
- contrasto atmosferico;
- differenziazione di squadra o stato.

Non dovrà tornare a essere la fondazione dell'interfaccia.

# 3. Forme e geometria

Il linguaggio geometrico dovrà evocare un torneo calcistico anime attraverso:

- tagli diagonali;
- fasce;
- angoli dinamici;
- motivi a fulmine;
- bordi neri riconoscibili;
- pannelli sovrapposti;
- livelli visuali distinti;
- testate ispirate a tabelloni;
- composizioni da broadcast sportivo;
- indicatori che ricordano punteggio, formazione e percorso competitivo.

Le forme dinamiche dovranno essere applicate con gerarchia. Non ogni elemento dovrà avere un taglio diagonale o un fulmine. Gli accenti più energici saranno riservati a:

- header;
- CTA;
- selezioni;
- Player Card;
- boss;
- vittorie;
- passaggi di stato importanti.

Le superfici informative dense dovranno mantenere una geometria più stabile e prevedibile.

Sono da evitare:

- uso indiscriminato di pillole;
- bordi arrotondati identici ovunque;
- glassmorphism dominante;
- trasparenze che riducono la leggibilità;
- ombre morbide eccessivamente da sito web;
- pannelli tutti equivalenti;
- decorazioni che invadono testi o controlli;
- forme talmente irregolari da alterare tap target o layout.

La geometria decorativa non dovrà cambiare:

- ordine logico dei contenuti;
- area cliccabile;
- data attribute;
- wrapper necessari alle interazioni;
- coordinate funzionali dei campi e della mappa.

# 4. Tipografia e gerarchia

La gerarchia tipografica dovrà rendere immediatamente distinguibili:

- titolo della schermata;
- stato della run;
- nome squadra;
- nome giocatore;
- ruolo;
- overall;
- livello;
- rarità;
- azione primaria;
- testo descrittivo;
- stato di errore o conferma.

## Titoli

I titoli dovranno essere:

- energici;
- compatti;
- riconoscibili;
- ad alto peso;
- leggibili anche sopra composizioni atmosferiche.

Potranno usare maiuscolo, inclinazione o tagli grafici in modo controllato. Il maiuscolo non dovrà essere applicato a lunghi paragrafi o a tutte le etichette.

## Testi normali

I testi normali dovranno privilegiare:

- elevata leggibilità;
- peso sufficiente su superfici chiare;
- interlinea stabile;
- lunghezze contenute;
- buon comportamento con nomi e descrizioni lunghe.

Sono vietati:

- testi sottili su sfondi chiari;
- giallo chiaro su bianco;
- grigio troppo tenue per dati importanti;
- maiuscolo prolungato in testi descrittivi;
- gerarchie affidate soltanto alla dimensione.

## Numeri e dati competitivi

Overall, livelli, punteggi, vite e probabilità dovranno avere una gerarchia evidente. I numeri fondamentali dovranno poter essere riconosciuti rapidamente anche nelle card più piccole.

Le etichette secondarie dovranno essere brevi e non competere con nome, overall e azione primaria.

## Font futuri

Non viene ancora scelto obbligatoriamente un font esterno. Eventuali font futuri dovranno:

- essere legalmente utilizzabili;
- non compromettere le prestazioni;
- avere fallback affidabili;
- supportare correttamente l'italiano;
- avere accenti e apostrofi coerenti;
- restare leggibili nelle dimensioni molto piccole delle Player Card;
- offrire pesi sufficienti;
- non rendere i numeri ambigui.

Potrà essere valutata una combinazione tra un carattere più espressivo per titoli e numeri e un carattere più neutro per testi e dati, ma questa scelta resta aperta.

# 5. Profondità, bordi e ombre

La profondità dovrà essere più vicina a una UI da videogioco che a un sito moderno.

Elementi consigliati:

- bordi neri;
- outline riconoscibili;
- ombre nette e direzionali;
- superfici stratificate;
- fasce colorate;
- piccoli highlight;
- bordi interni;
- variazioni di spessore;
- accenti grafici che suggeriscono energia e pressione competitiva.

I pannelli bianchi dovranno rimanere distinguibili anche sopra sfondi molto luminosi. La separazione potrà derivare dalla combinazione di:

- bordo;
- ombra;
- fascia nera;
- fascia gialla;
- variazione della superficie;
- overlay locale.

I glow dovranno essere limitati a:

- selezioni;
- rarità speciali;
- boss;
- vittorie;
- eventi importanti;
- elementi attivi ad alta priorità.

Sono da evitare glow diffusi su tutta l'interfaccia, soprattutto su:

- liste lunghe;
- Album;
- inventario;
- campi con molti giocatori;
- griglie di Player Card.

L'uso eccessivo di filtri, blur o ombre complesse peggiorerebbe sia la leggibilità sia le prestazioni.

# 6. Iconografia e asset

L'iconografia dovrà avere uno stile uniforme e riconoscibile.

Principi:

- preferenza per SVG locali;
- forme semplici ma energiche;
- spessori coerenti;
- leggibilità nelle dimensioni piccole;
- uso coerente del fulmine;
- differenza chiara tra azione, stato e decorazione;
- icone accompagnate da label quando il significato non è universale.

Il fulmine dovrà essere un elemento identitario, non un riempitivo ripetuto ovunque.

I fallback delle immagini dovranno essere integrati nel design. Un'immagine mancante non dovrà sembrare un errore tecnico esterno alla UI.

I loghi squadra dovranno restare leggibili su superfici sia chiare sia scure. Potranno richiedere:

- contenitore neutro;
- bordo;
- ombra;
- fondo di contrasto;
- variante chiara o scura, quando disponibile.

Le emoji non dovranno diventare la soluzione definitiva per elementi principali quali:

- navigazione;
- trofei;
- boss;
- categorie di nodo;
- logo applicazione;
- oggetti principali.

Potranno restare come placeholder temporanei o per casi volutamente secondari fino alla disponibilità degli asset finali.

# 6.1 Immagini atmosferiche di riferimento

La presente revisione è basata sull'analisi diretta dei due file realmente allegati alla conversazione:

- **asset mobile verticale:** `864 × 1536`, rapporto `9:16`;
- **asset desktop orizzontale:** `1536 × 864`, rapporto `16:9`.

Le immagini appartengono chiaramente alla stessa composizione artistica: uno stadio calcistico anime estremamente luminoso, osservato frontalmente, con una grande apertura di cielo al centro, energia acquatica/celeste sul lato sinistro ed energia giallo-oro, elettrica e rocciosa sul lato destro. Il campo e l'anello dello stadio occupano la zona inferiore, mentre il centro superiore resta ampio e relativamente libero.

Le due immagini vengono interpretate obbligatoriamente così:

- **immagine verticale:** riferimento atmosferico e compositivo principale per mobile;
- **immagine orizzontale:** riferimento atmosferico e compositivo principale per desktop.

Questa classificazione non rende gli asset sfondi definitivi. Li rende riferimenti concreti da usare nei piloti per verificare se la futura UI riesce a conservare luminosità, atmosfera da torneo e leggibilità.

## Metodo di lettura

Per evitare di trasformare ipotesi in decisioni già approvate, questa sezione distingue tre livelli:

- **osservabile:** caratteristica realmente presente nei file allegati;
- **possibile scelta futura:** trattamento progettuale compatibile con l'immagine, ma non ancora implementato o approvato;
- **da testare:** comportamento che può essere confermato soltanto nell'applicazione, con pannelli reali e viewport reali.

## Caratteristiche comuni realmente osservabili

In entrambi gli asset sono osservabili:

- uno stadio calcistico anime di grande scala;
- un punto di vista centrale rivolto verso il campo;
- una luminosità generale molto elevata;
- un cielo celeste e bianco che occupa la maggior parte della composizione;
- una zona centrale quasi bianca in prossimità dell'orizzonte;
- una massa energetica azzurra/acquatica sulla sinistra;
- una massa energetica giallo-oro/elettrica sulla destra;
- foglie e frammenti nella zona sinistra;
- rocce, scintille e scariche nella zona destra;
- geometrie traslucide e fasci diagonali nel cielo;
- un campo relativamente piccolo rispetto all'intera immagine;
- una sensazione coerente con finale, torneo o competizione importante.

Non è invece possibile dedurre dalle sole immagini:

- che debbano essere usate in ogni schermata;
- che il centro libero sia automaticamente leggibile con testo sovrapposto;
- che un unico crop funzioni per tutti i dispositivi;
- che il bianco dei pannelli sia sufficiente senza bordo o ombra;
- che serva necessariamente blur;
- che l'asset debba restare sempre a piena saturazione o luminosità;
- che l'immagine possa essere distribuita nel prodotto senza una verifica di provenienza e licenza.

## Immagine verticale — riferimento mobile

### Osservazioni compositive

L'asset verticale ha rapporto `9:16`. La composizione non è un semplice ritaglio casuale dell'immagine orizzontale: è organizzata per conservare una grande colonna di cielo e collocare stadio e campo nella parte bassa.

Sono osservabili:

- una quantità molto ampia di spazio negativo nella metà superiore;
- un asse centrale quasi libero, formato soprattutto da cielo celeste e bianco;
- fasci e geometrie diagonali tenui nella parte alta;
- l'anello dello stadio collocato indicativamente nel terzo inferiore;
- il campo visibile vicino al fondo, con prospettiva centrale;
- energia azzurra che cresce lungo il bordo sinistro, soprattutto dalla metà verso il basso;
- energia oro che cresce lungo il bordo destro e culmina nelle rocce dell'angolo inferiore;
- una luminosità centrale molto forte sopra il campo;
- dettagli più rumorosi e contrastati nei due angoli inferiori.

Il grande cielo superiore rende plausibile una composizione mobile con contenuto principale nella parte alta o medio-alta, ma **non rende sicuro il testo libero**: le nuvole, i fasci chiari e le variazioni celesti possono ridurre il contrasto, soprattutto con testo bianco, grigio chiaro o giallo.

### Zone più adatte ai contenuti

Potenzialmente adatte, previa superficie di contrasto:

- area centrale alta, per titolo breve o identità della schermata;
- fascia medio-alta, per un pannello principale non trasparente;
- zona centrale sopra l'anello dello stadio, se il pannello non copre completamente la profondità dell'illustrazione;
- aree interne lontane dai bordi, per CTA e metriche.

Poco adatte:

- angolo inferiore sinistro, molto ricco di acqua, foglie e contrasti;
- angolo inferiore destro, occupato da rocce, bagliori e fulmini oro;
- centro immediatamente sopra il campo, quasi bianco;
- aree sulle nuvole più luminose senza pannello;
- bordo superiore se la topbar è trasparente e contiene testo chiaro.

### Topbar, bottom bar e safe area

La topbar si troverebbe sopra un cielo molto chiaro. Una futura topbar dovrà quindi avere una propria struttura leggibile, per esempio:

- superficie bianca o quasi bianca sufficientemente opaca con bordo inferiore scuro;
- fascia nera con testo chiaro;
- composizione bianca con bordo, ombra e accento giallo;
- overlay locale limitato all'area della barra.

La bottom action bar si sovrapporrebbe alla zona più illustrata e competitiva dell'asset: campo, acqua, oro e rocce. Non dovrà essere lasciata senza superficie. Dovrà inoltre rispettare `env(safe-area-inset-bottom)` e non coprire in modo permanente la parte del campo necessaria a mantenere riconoscibile lo stadio.

Le decorazioni laterali non devono essere usate come giustificazione per spostare controlli essenziali troppo vicino ai bordi o dentro la safe area.

### Viewport mobili di riferimento

I tre viewport hanno un rapporto più stretto del file `9:16`. Con un futuro comportamento equivalente a `cover`, l'immagine tenderebbe quindi a perdere una parte dei lati, non dell'altezza. Questo può ridurre proprio la separazione visiva tra energia azzurra e oro.

| Viewport | Valutazione preliminare | Rischio principale | Verifica necessaria |
|---|---|---|---|
| `360 × 800` | viewport più stretto e critico | crop laterale più evidente; action bar e pannello possono occupare gran parte del campo | preservare almeno parte di entrambi i lati energetici e la linea dello stadio |
| `390 × 844` | comportamento simile al 360, con poco spazio aggiuntivo | pannello centrale lungo può scendere sulla zona quasi bianca e sul campo | provare composizione Home reale con safe area |
| `430 × 932` | maggiore respiro, ma rapporto ancora più stretto del file | rischio di allargare eccessivamente i pannelli fino a coprire le energie laterali | mantenere margini e gerarchia senza creare colonne vuote |

L'uso futuro richiederà probabilmente un `background-position` o un `object-position` dedicato al mobile. La posizione non viene fissata ora. Dovranno essere confrontate almeno:

- centro;
- centro-basso;
- una posizione verticale calibrata per mantenere l'anello dello stadio visibile sopra la bottom bar;
- eventuali crop dedicati per viewport bassi o per schermate con contenuto lungo.

Non è sufficiente dichiarare `background-size: cover` una sola volta e presumere che il campo resti sempre visibile. Su schermate che superano l'altezza del viewport, su browser mobile con barre dinamiche o con tastiera aperta, il rapporto tra immagine, contenitore e contenuto può cambiare.

Gli overlay, se necessari, dovranno essere **locali**:

- dietro un hero;
- dietro un pannello;
- sotto topbar o action bar;
- in una fascia specifica.

È da evitare un overlay scuro uniforme su tutta l'immagine, perché eliminerebbe la caratteristica più importante dell'asset: la luminosità da grande torneo.

## Immagine orizzontale — riferimento desktop

### Osservazioni compositive

L'asset desktop ha rapporto `16:9`. La composizione dedica una parte molto ampia al cielo e mantiene l'orizzonte dello stadio e il campo nella fascia inferiore.

Sono osservabili:

- una vasta zona centrale azzurro-bianca;
- un punto di massima luminosità vicino all'orizzonte del campo;
- lo stadio disposto ad arco da sinistra a destra;
- il campo centrato nella parte bassa;
- la linea di metà campo visibile come riferimento prospettico centrale;
- energia azzurra/acquatica concentrata nel lato e nell'angolo inferiore sinistro;
- energia oro/elettrica e rocce concentrate nel lato e nell'angolo inferiore destro;
- un equilibrio cromatico intenzionale tra i due lati;
- fasci diagonali e geometrie traslucide nel cielo superiore;
- grande respiro orizzontale, specialmente nella parte alta e centrale.

La zona centrale è ampia ma estremamente luminosa. È adatta a sostenere una composizione di pannelli soltanto se i pannelli hanno una silhouette forte; non è un fondale neutro per card bianche prive di bordo.

### Zone più adatte ai pannelli

Potenzialmente adatte:

- area centrale alta per titolo, logo o hero contenuti in una superficie strutturata;
- colonna centrale per un pannello principale con larghezza controllata;
- composizione a due pannelli medio-alti, purché non invada completamente le energie laterali;
- fascia superiore per navigazione opaca o ad alto contrasto;
- area centrale sopra lo stadio per una Home con pochi blocchi e forte gerarchia.

Poco adatte:

- centro basso immediatamente sopra il campo, quasi bianco;
- angolo inferiore sinistro, visivamente molto attivo;
- angolo inferiore destro, ricco di rocce e bagliori;
- intera larghezza con una griglia densa di card bianche, che cancellerebbe lo stadio senza ottenere contrasto;
- testo chiaro direttamente sul cielo.

### Viewport desktop di riferimento

| Viewport | Relazione con l'asset | Rischio principale | Verifica necessaria |
|---|---|---|---|
| `1366 × 768` | quasi identico a `16:9` | altezza ridotta: hero, navigazione e CTA possono coprire rapidamente stadio e campo | assicurare che il contenuto prioritario resti sopra la piega senza cancellare l'orizzonte |
| `1440 × 900` | viewport più alto e meno largo del `16:9` | un comportamento `cover` tende a tagliare parte dei lati, riducendo acqua e oro | confrontare crop centrale e posizione dedicata |
| `1920 × 1080` | rapporto `16:9` coerente | pannelli troppo larghi possono occupare il grande spazio disponibile e rendere l'immagine irrilevante | limitare la larghezza del contenuto e preservare respiro laterale |

Su monitor molto larghi un semplice `cover` può tagliare cielo e fascia inferiore. Se l'allineamento privilegia il centro, il campo rischia di perdere importanza; se privilegia il fondo, può ridursi eccessivamente il cielo. Potrebbero quindi essere necessari:

- un asset o crop ultrawide dedicato;
- un limite alla larghezza visiva dell'illustrazione con estensione cromatica laterale;
- una posizione verticale differente;
- una composizione in più livelli, da verificare soltanto in fase di prototipo.

Su finestre desktop poco alte, il problema è ancora più evidente: topbar, pannelli e action area possono comprimere il campo nella porzione inferiore o nasconderlo. La verifica dovrà includere finestre ridimensionate, non soltanto monitor a schermo intero.

Non viene fissato ora un unico `background-position`. La scelta dovrà dipendere dalla schermata e dal viewport, con priorità a:

1. riconoscibilità dello stadio;
2. leggibilità dei pannelli;
3. conservazione del bilanciamento azzurro/oro;
4. assenza di tagli casuali su campo e linea centrale.

## Ruolo preciso di celeste, azzurro, bianco, giallo e oro

Le immagini confermano che celeste e azzurro sono parte importante dell'atmosfera. Devono rimanere nell'illustrazione: eliminarli o neutralizzarli artificialmente indebolirebbe cielo, energia, profondità e contrasto tra i due lati.

La distinzione obbligatoria è:

- **celeste e azzurro illustrati:** cielo, acqua, energia, profondità atmosferica;
- **bianco UI:** superfici informative, pannelli, card e modali;
- **nero UI:** testo, struttura, bordi, navigazione e separazione;
- **giallo UI:** azione, selezione, focus ed energia Inazuma;
- **oro UI:** prestigio, vittorie, boss, trofei ed elementi speciali.

Celeste e azzurro non devono diventare il colore strutturale dominante di pannelli, shell, navigazione o pulsanti. La nuova UI resta fondata su bianco, nero, giallo e oro.

La componente azzurra dello sfondo può contribuire alla percezione di aria, cielo e velocità, ma i pannelli non dovranno usare automaticamente bordi, riempimenti o glow blu che li riportino visivamente al tema precedente.

Il lato giallo-oro dell'illustrazione è molto luminoso. Giallo e oro della UI dovranno essere separati dallo sfondo tramite bordo scuro, area piena, pattern o posizione. Non è sufficiente collocare una CTA gialla direttamente sopra il bagliore destro.

## Pannelli e testi sopra le immagini

Criteri concreti per i futuri prototipi:

- pannelli bianchi o avorio non completamente trasparenti;
- bordo nero o molto scuro chiaramente percepibile;
- ombra netta, sufficiente a separare la superficie dal cielo quasi bianco;
- possibile fascia nera o gialla per titolo, stato o azione;
- testi principali neri o quasi neri;
- nessun testo libero sulle aree bianche del cielo;
- nessun testo giallo chiaro senza un fondo scuro;
- niente glassmorphism dominante;
- blur usato soltanto se localizzato e realmente necessario;
- eventuale overlay collocato dietro il singolo gruppo di contenuti, non sull'intera immagine;
- navigazione e action bar dotate di propria superficie;
- pannelli con larghezza controllata, per non cancellare completamente lo stadio.

È da evitare un overlay scuro uniforme che trasformi l'immagine luminosa in un generico sfondo cupo. L'obiettivo è mantenere l'identità chiara degli asset e costruire il contrasto attraverso la UI.

## Prima valutazione delle schermate di utilizzo

### Potenzialmente adatte

Le immagini potrebbero funzionare bene, previa verifica nei piloti, in superfici con contenuto relativamente concentrato e valore atmosferico elevato:

- **Home:** candidato principale, soprattutto per validare shell, pannelli e differenze tra composizione mobile e desktop;
- **selezione Season:** adatta se le card Season non coprono completamente campo e lati energetici;
- **creazione nuova run:** possibile come fondale della shell, con modal o pannello molto leggibile;
- **celebrazione finale:** coerente con atmosfera da finale e con il lato oro;
- **riepilogo finale:** possibile nelle aree hero o header, non necessariamente dietro tutte le statistiche;
- **Game Over:** possibile per contrasto narrativo, ma richiede trattamento rosso/nero che non annulli la luminosità;
- **Albo d'Oro:** possibile per testata, hero o dettaglio prestigioso, più rischioso dietro liste lunghe;
- **schermate boss o torneo:** possibile come fascia atmosferica o sfondo selettivo, senza interferire con formazioni e cronaca.

### Potenzialmente poco adatte o ad alto rischio

Gli asset possono creare troppo rumore o un costo visivo inutile nelle superfici dense:

- **Squadra completa:** campo 11v11, panchina e molte Player Card richiedono uno sfondo più controllato;
- **Inventario:** categorie, card oggetto e pannelli sticky hanno già elevata densità;
- **Album con griglie lunghe:** l'immagine si ripeterebbe o scomparirebbe dietro centinaia di card;
- **rosa Album:** stato locked, rarità e ritratti richiedono contrasto stabile;
- **match con cronaca:** campo, log, punteggio e controlli competono con lo stadio illustrato;
- **modali dense:** pull, trade, assegnazione oggetti e Player Detail devono mantenere una superficie autonoma;
- **campi con molte Player Card:** le energie laterali possono confondersi con rarità, equipaggiamenti e stati selected.

“Poco adatta” non significa vietata. Significa che l'asset non dovrebbe essere assunto come sfondo completo senza un confronto con un fallback più semplice.

## Crop, overlay e posizionamento: decisioni non definitive

Restano da testare:

- crop specifico per ciascuno dei sei viewport di riferimento;
- `background-position` o `object-position` separato per mobile e desktop;
- comportamento con contenuto più alto del viewport;
- comportamento con browser mobile e barre dinamiche;
- conservazione del campo sopra una bottom action bar;
- quantità di cielo necessaria sopra il pannello principale;
- opportunità di overlay locali chiari, scuri o neutri;
- eventuale uso dell'immagine soltanto nella fascia hero;
- eventuale separazione tra sfondo della shell e sfondo dei contenuti;
- intensità di contrasto e saturazione;
- eventuale sfocatura esclusivamente locale;
- gestione di monitor ultrawide e finestre desktop poco alte.

Nessun crop, overlay o posizionamento viene approvato definitivamente in questa fase.

## Prestazioni, file e provenienza

Le immagini non vengono aggiunte al repository con questo documento.

Prima di qualsiasi uso definitivo dovranno essere verificati:

- provenienza;
- autore o processo di generazione;
- diritto di utilizzo, modifica e distribuzione;
- eventuale necessità di generare asset originali equivalenti;
- risoluzione effettiva richiesta sui diversi device pixel ratio;
- qualità dopo compressione;
- conversione WebP o AVIF;
- fallback per browser o condizioni non supportate;
- caricamento differenziato mobile e desktop;
- preload soltanto dove realmente utile;
- dimensione finale dei file;
- impatto sul tempo di apertura della Home;
- assenza di dipendenza da URL esterni fragili;
- fallback cromatico coerente in caso di errore di caricamento.

Il fatto che i file allegati abbiano rapporti corretti per i viewport principali non dimostra ancora che la loro risoluzione, compressione o licenza siano adatte alla distribuzione finale.

# 7. Motion e microinterazioni

Le microinterazioni dovranno rafforzare chiarezza ed energia, non rallentare il flusso.

Principi:

- animazioni brevi;
- feedback immediato al tap o click;
- selezione evidente;
- transizioni comprensibili tra stati;
- movimento controllato per vittorie, boss e rarità speciali;
- focus e active state distinti;
- rispetto di `prefers-reduced-motion`.

Esempi di movimento appropriato da valutare in seguito:

- breve scatto o cambio di fascia alla selezione;
- highlight rapido del giallo;
- entrata controllata di un risultato;
- accento speciale per boss o Leggenda;
- feedback di pressione senza spostare il layout.

Sono da evitare:

- animazioni di ingresso riavviate durante ogni rerender;
- scale eccessive;
- movimenti che cambiano il layout;
- animazioni lunghe sulle azioni frequenti;
- effetti pesanti su tutte le Player Card;
- filtri animati su liste complete;
- animazioni che rallentano Album o campi con molti giocatori.

Le animazioni non dovranno interferire con:

- listener ricreati dopo `app.innerHTML`;
- ripristino dello scroll;
- playback delle partite;
- aggiornamenti locali della Squadra e del 5v5;
- apertura e chiusura delle modali.

# 8. Responsive

Mobile e desktop dovranno essere trattati come due composizioni correlate, non come un semplice ridimensionamento.

La coerenza dovrà derivare da:

- palette;
- gerarchia;
- forme;
- iconografia;
- stati;
- famiglia di Player Card;
- linguaggio delle azioni.

La disposizione potrà cambiare in modo sostanziale quando il viewport lo richiede.

## Mobile

Priorità:

- tap target adeguati;
- testi leggibili;
- action bar raggiungibili;
- rispetto della safe area;
- card compatte;
- informazioni essenziali sempre visibili;
- navigazione comprensibile con una mano;
- modali gestibili con viewport dinamico e tastiera;
- densità controllata.

Sono vietati:

- faccioni enormi;
- scroll orizzontale involontario;
- pannelli desktop compressi;
- testi fondamentali nascosti;
- action bar coperte dalla safe area;
- campi con card illeggibili;
- decorazioni laterali che sottraggono spazio utile.

Le viewport minime di riferimento restano:

- `360 × 800`;
- `390 × 844`;
- `430 × 932`.

## Desktop

Priorità:

- uso efficace dello spazio;
- nessun contenuto spinto o troncato dalla navigazione;
- composizioni più ampie;
- campi e rose leggibili;
- modali senza spreco di spazio;
- gerarchia chiara;
- equilibrio tra densità e respiro;
- card non ingrandite inutilmente.

Il desktop non dovrà essere una versione mobile semplicemente allargata. Potrà utilizzare:

- pannelli affiancati;
- testate più ampie;
- controlli laterali;
- campi estesi;
- riepiloghi visibili nello stesso viewport.

Le viewport minime di riferimento restano:

- `1366 × 768`;
- `1440 × 900`;
- `1920 × 1080`.

# 9. Principi delle Player Card

La Player Card dovrà diventare il componente visivo centrale del gioco.

Ogni variante dovrà comunicare la stessa identità attraverso:

- cornice;
- gerarchia;
- trattamento dell'immagine;
- badge;
- rarità;
- stati;
- comportamento del nome;
- linguaggio di selezione.

## Dati fondamentali

I dati fondamentali sono:

- immagine;
- nome;
- ruolo;
- overall;
- livello;
- rarità;
- eventuale equipaggiamento.

La presenza e la densità potranno cambiare tra varianti, ma ruolo, overall, livello e oggetto non dovranno cambiare posizione senza una motivazione funzionale.

## Famiglia futura di varianti

Senza implementarle ancora, la famiglia futura dovrà prevedere almeno:

1. **Grande** — draft, pull e ricompense;
2. **Compatta tattica** — Squadra, panchina e selezioni dense;
3. **Campo** — formazioni 5v5 e 11v11;
4. **Orizzontale** — liste mobile e selettori;
5. **Album bloccata** — stato realmente non disponibile;
6. **Storica/non interattiva** — Albo d'Oro, finali e snapshot.

Le nove varianti tecniche censite nel documento di inventario dovranno essere ricondotte progressivamente a questa famiglia senza rompere i contesti esistenti.

## Gerarchia

La card dovrà rendere immediatamente leggibili:

1. nome;
2. overall;
3. ruolo;
4. livello;
5. rarità;
6. equipaggiamento.

La rarità dovrà essere evidente, ma non potrà:

- ridurre il contrasto del testo;
- coprire il ritratto;
- confondersi con selected o locked;
- trasformare tutta la card in un glow pesante.

## Distinzione degli stati

Gli stati dovranno essere separati semanticamente e visivamente:

- `selected`;
- `disabled`;
- `locked`;
- `equipped`;
- hover;
- focus;
- active;
- user;
- opponent;
- historical.

Il colore non dovrà essere l'unico segnale. Potranno essere usati bordi, icone, pattern, label e variazioni di struttura.

Le card della propria squadra e dell'avversario dovranno essere distinguibili senza rendere il testo dell'utente meno leggibile. Le card della propria squadra dovranno mantenere testi perfettamente leggibili su ogni superficie.

Le card bloccate Album dovranno apparire realmente non disponibili. L'utente dovrà capire immediatamente che il giocatore non è stato sbloccato, anche se il Player Detail resta consultabile secondo il comportamento corrente.

# 10. Azioni e pulsanti

La futura gerarchia dovrà distinguere:

- **azione primaria:** avanza, conferma, simula, continua;
- **azione secondaria:** apre dettagli o modifica una scelta;
- **azione neutra:** torna, chiude, annulla senza conseguenze;
- **azione distruttiva:** sostituisce, elimina, rinuncia con perdita o sovrascrive;
- **azione speciale/prestigiosa:** boss, ricompensa, vittoria, trofeo;
- **pulsante icona:** azione compatta con label accessibile;
- **tab:** cambio di sezione o vista, non conferma.

Il colore non dovrà essere l'unico segnale. Ogni categoria dovrà essere riconoscibile anche attraverso:

- bordo;
- forma;
- icona;
- testo;
- posizione;
- peso;
- feedback.

Ogni pulsante dovrà avere:

- stato normale;
- hover desktop;
- active;
- focus visibile;
- disabled;
- loading, quando applicabile.

Gli stati disabled non dovranno diventare illeggibili. Le azioni distruttive non dovranno assomigliare alle CTA primarie. Le azioni prestigiose dovranno essere rare per non svalutare l'oro.

I pulsanti principali mobile dovranno mantenere target adeguati e non essere coperti da bottom bar o safe area.

# 11. Superfici pilota

Prima della migrazione completa verranno progettate e verificate tre superfici pilota. Queste superfici permettono di validare il linguaggio visivo su livelli di complessità differenti.

## Pilota A — Home con run attiva

La Home con run attiva dovrà validare:

- identità complessiva;
- uso delle immagini atmosferiche o del fallback;
- sfondo;
- shell;
- pannelli;
- tipografia;
- navigazione;
- CTA;
- metriche;
- preview giocatori;
- gerarchia tra Run, Album e Albo d'Oro;
- differenze mobile e desktop.

Criteri specifici:

- il bianco deve dominare senza creare vuoto;
- il nome squadra deve restare leggibile anche al limite consentito;
- la CTA “Continua run” deve essere immediatamente riconoscibile;
- metriche e preview devono sembrare elementi da videogioco, non KPI aziendali;
- l'immagine atmosferica non deve competere con i pannelli;
- mobile e desktop devono avere composizioni proprie.

Questo pilota stabilirà la prima versione della shell, ma non renderà automaticamente approvati tutti gli utilizzi dello sfondo nelle altre schermate.

## Pilota B — Squadra completa

La Squadra completa dovrà validare:

- Player Card compatta;
- campo 11v11;
- panchina;
- selezione modulo;
- equipaggiamenti;
- modalità modifica titolari;
- densità;
- leggibilità dei testi piccoli;
- differenze mobile e desktop;
- convivenza tra bianco strutturale e verde del campo.

Dati minimi del pilota:

- 15 giocatori;
- 11 titolari;
- 4 riserve;
- almeno un equipaggiamento;
- rarità differenti;
- nome squadra lungo;
- modalità normale e modalità modifica;
- giocatore selezionato.

Il futuro restyle non dovrà cambiare wrapper, data attribute o ordine logico necessari alle interazioni prima che siano disponibili test adeguati.

In particolare, non dovranno essere alterati senza copertura:

- `data-squad-player`;
- distinzione lineup/bench;
- ordine dei ruoli;
- selezione locale;
- sostituzione DOM delle card;
- geometria funzionale delle righe.

## Pilota C — Pull svincolati

La Pull svincolati dovrà validare:

- Player Card grande;
- rarità;
- modal;
- selezione;
- stato selected;
- pulsanti Sì, No e Scheda;
- Rinuncia;
- disposizione verticale desktop;
- card orizzontali mobile;
- leggibilità del nuovo tema chiaro;
- differenza tra azione primaria e annullamento;
- integrazione degli strumenti di pull quando presenti.

Dati minimi del pilota:

- tre candidati con nomi e immagini differenti;
- almeno tre rarità;
- una card selezionata;
- eventuale equipaggiamento non necessario;
- descrizioni e azioni complete;
- viewport mobile e desktop critici.

Il pilota dovrà verificare che una modal chiara e luminosa resti percepita come parte di un videogioco e non come un form web.

# 12. Perché la Mappa non è il primo pilota

La Mappa è una superficie fondamentale e identitaria, ma non è il primo pilota perché dipende da un numero elevato di fondazioni non ancora validate:

- token;
- shell;
- Player Card;
- pulsanti;
- pannelli;
- modali;
- contrasto;
- navigazione;
- iconografia.

La Mappa presenta inoltre rischi tecnici specifici già rilevati nel censimento:

- coordinate inline;
- SVG e linee;
- stati `locked`, `reachable`, `completed` e `current`;
- logica di raggiungibilità;
- nodo boss speciale;
- posizioni assolute;
- colori evento inline;
- differenze di scroll tra desktop e mobile;
- dimensioni legate al viewport.

Un intervento prematuro potrebbe modificare accidentalmente il comportamento o rendere difficile distinguere problemi di fondazione da problemi propri della Mappa.

La Mappa verrà affrontata dopo che saranno stabiliti e approvati:

1. linguaggio cromatico;
2. gerarchia tipografica;
3. shell;
4. pannelli;
5. pulsanti;
6. Player Card;
7. navigazione;
8. modal e contrasto.

Prima del restyle della Mappa sarà necessario un test visuale dedicato con almeno:

- nodo corrente;
- nodo raggiungibile;
- nodo bloccato;
- nodo completato;
- boss;
- linee disponibili e completate;
- viewport mobile e desktop critici.

# 13. Criteri di approvazione della direzione

La direzione potrà essere approvata soltanto se soddisfa congiuntamente i seguenti criteri:

- appare chiaramente diversa dall'attuale tema blu;
- il bianco domina senza sembrare vuoto;
- nero, giallo e oro hanno ruoli distinti;
- il blu atmosferico non diventa nuovamente strutturale;
- mobile e desktop sembrano progettati appositamente;
- nomi, overall e livelli sono immediatamente leggibili;
- la UI sembra appartenere a un videogioco;
- la UI non sembra un sito o una dashboard;
- le rarità restano riconoscibili;
- selected, disabled, locked ed equipped sono distinguibili;
- le azioni principali sono evidenti;
- il colore non è l'unico segnale di stato;
- gli elementi decorativi non coprono contenuti;
- gli sfondi non interferiscono con safe area o action bar;
- la grafica regge sia una schermata semplice sia una molto densa;
- il tema resta leggibile con immagini mancanti;
- i pannelli restano leggibili sopra le immagini stadio;
- la densità della Squadra e della Pull resta controllata;
- le prestazioni non vengono compromesse da glow, blur o animazioni diffuse;
- `prefers-reduced-motion` è rispettato;
- il risultato funziona sui viewport minimi del censimento.

L'approvazione dovrà avvenire sui tre piloti e non soltanto su una singola schermata o un singolo mockup.

# 14. Decisioni ancora aperte

Le seguenti decisioni restano intenzionalmente aperte e dovranno essere affrontate nelle fasi successive:

- tonalità HEX definitive;
- bianco caldo, avorio e grigi chiari specifici;
- nero pieno o varianti quasi nere;
- rapporto cromatico definitivo tra giallo e oro;
- font dei titoli;
- font dei testi;
- combinazione tra font espressivo e font funzionale;
- intensità degli angoli e dei tagli diagonali;
- quantità di motivi a fulmine;
- stile preciso dello sfondo;
- stile delle icone;
- set SVG definitivo;
- intensità dell'oro;
- materiali, gradienti o texture dell'oro;
- forma definitiva delle Player Card;
- proporzioni delle Player Card;
- posizioni definitive dei badge nelle varianti;
- trattamento dettagliato delle rarità;
- trattamento user/opponent;
- transizioni;
- durata e curva delle animazioni;
- eventuali pattern e texture;
- stile del campo rispetto alle superfici chiare;
- uso eventuale di illustrazioni o asset decorativi;
- utilizzo definitivo delle due immagini stadio allegate;
- schermate nelle quali usare le immagini stadio;
- eventuale uso soltanto su Home, finali o superfici selezionate;
- crop mobile;
- crop desktop;
- posizione del centro visivo;
- quantità di overlay;
- livello di contrasto;
- eventuale sfocatura locale;
- fallback cromatico preciso;
- strategia di caricamento degli asset;
- provenienza e diritto di utilizzo degli asset;
- formato finale WebP o AVIF e relativi fallback;
- eventuali varianti dedicate alle diverse Season;
- grado di differenziazione tra Album, Albo d'Oro, boss e schermate normali.

Nessuna di queste decisioni viene considerata definitiva con questo documento. Dovrà essere approvata attraverso confronto visuale, piloti, fixture e screenshot sui viewport previsti.
