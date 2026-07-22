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

Le due immagini allegate mostrano uno stadio calcistico anime molto luminoso e costituiscono riferimenti concreti per atmosfera e composizione.

- **Immagine A, verticale:** riferimento principale per la composizione futura mobile.
- **Immagine B, orizzontale:** riferimento principale per la composizione futura desktop.

Entrambe esprimono correttamente:

- atmosfera da grande torneo;
- luminosità;
- energia anime;
- contrasto tra area azzurra e area giallo-oro;
- centralità dello stadio;
- spazio visivo adatto a ospitare l'interfaccia;
- sensazione di finale o competizione importante.

## Interpretazione cromatica

Il celeste e l'azzurro presenti nelle immagini sono ammessi come colori atmosferici dell'illustrazione. Non devono però riportare il blu come colore strutturale dominante di:

- pannelli;
- pulsanti;
- navigazione;
- shell;
- bordi principali.

Il blu atmosferico appartiene allo sfondo illustrato; non definisce il tema dei componenti.

Giallo e oro dell'interfaccia dovranno restare distinguibili dai bagliori presenti nelle immagini. La UI non dovrà perdere gerarchia quando un elemento giallo si sovrappone a una zona luminosa dello stadio.

## Uso futuro

Le immagini:

- non implicano che ogni schermata debba avere lo stesso sfondo;
- potranno essere usate integralmente, ritagliate o reinterpretate soltanto dopo test di leggibilità;
- sono riferimenti visivi e candidati asset, non una scelta obbligatoria per ogni schermata;
- non dovranno essere aggiunte al repository in questa fase documentale.

I testi non dovranno essere posizionati direttamente sulle zone più luminose senza una superficie di contrasto.

Pannelli bianchi sovrapposti dovranno avere bordi neri, ombre, fasce o separazioni sufficienti. Un pannello bianco semitrasparente privo di struttura rischierebbe di scomparire nello sfondo.

La parte centrale della composizione dovrà restare abbastanza libera da non creare rumore dietro ai contenuti principali. Le decorazioni laterali non dovranno interferire con:

- safe area;
- navigazione;
- action bar;
- pulsanti di ritorno;
- elementi sticky o fixed.

## Responsive delle immagini

Mobile e desktop dovranno usare composizioni correlate ma non un unico asset stirato.

La composizione verticale è particolarmente adatta al mobile perché può preservare:

- cielo;
- stadio;
- campo;
- profondità verticale;
- bilanciamento delle aree azzurra e oro.

La composizione orizzontale è particolarmente adatta al desktop perché può sostenere:

- pannelli affiancati;
- campi più ampi;
- shell orizzontale;
- contenuti centrali più larghi;
- respiro laterale.

Non dovrà essere usato un unico `background-size: cover` concettualmente identico per tutti i viewport senza valutazione dei crop.

Mobile e desktop dovranno preservare:

- campo;
- effetto stadio;
- centro visivo;
- equilibrio tra lato azzurro e lato oro;
- aree libere per i contenuti.

In futuro potranno essere usati crop o composizioni differenti pur mantenendo una stessa identità.

## Prestazioni e provenienza

Prima dell'uso definitivo dovranno essere verificati:

- provenienza degli asset;
- diritto di utilizzo;
- eventuali limitazioni di modifica o distribuzione;
- qualità sufficiente per i viewport previsti.

Gli asset finali dovranno essere:

- ottimizzati localmente;
- preferibilmente WebP o AVIF;
- accompagnati da fallback quando necessario;
- privi di dipendenza da URL esterni fragili;
- caricati senza introdurre layout shift o lampeggiamenti.

Dovrà esistere un fallback cromatico coerente nel caso in cui l'immagine non venga caricata.

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