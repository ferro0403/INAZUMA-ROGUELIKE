# Specifica provvisoria del tema e delle Player Card

## Stato del documento

- **Repository di riferimento:** `ferro0403/INAZUMA-ROGUELIKE`
- **Branch di riferimento:** `restyle-v2`
- **SHA di partenza:** `f80c954799c8d6613b1b1f8751ddfdc19def62e9`
- **Fonti documentali:** `docs/UI_RESTYLE_PLAN.md`, `docs/UI_SCREEN_INVENTORY.md`, `docs/UI_VISUAL_DIRECTION.md`
- **Fonte tecnica finale:** codice corrente del repository.
- **Natura della specifica:** documentale e provvisoria; non introduce CSS, HTML, renderer, componenti o modifiche di gameplay.

# 1. Scopo del documento

Questo documento trasforma la direzione visiva approvata in una specifica operativa sufficientemente concreta per guidare:

- definizione futura dei token del tema;
- uso coerente della palette;
- gerarchia delle superfici;
- progettazione della famiglia di Player Card;
- integrazione dei colori di rarità nel tema chiaro;
- preparazione delle tre superfici pilota: Home con run attiva, Squadra completa e Pull svincolati.

I valori cromatici indicati sono **provvisori ma concreti**. Servono a evitare interpretazioni arbitrarie durante i primi prototipi, senza essere ancora una dichiarazione CSS definitiva. Potranno essere rifiniti dopo:

- mockup comparabili;
- fixture deterministiche;
- screenshot sui viewport previsti;
- verifiche di contrasto;
- prove su sfondi stadio luminosi;
- test delle schermate dense.

La struttura corrente dei renderer non deve essere modificata in questa fase. Il censimento ha rilevato renderer completi basati su `app.innerHTML`, aggiornamenti locali che dipendono da wrapper e `data-*`, nove varianti tecniche di Player Card e più generatori di markup. Nessun consolidamento strutturale deve precedere fixture e test adeguati.

# 2. Palette base provvisoria

La palette è costruita per una UI luminosa da torneo anime, con superfici chiare delimitate da nero e attivate da giallo e oro. Il blu non è una fondazione strutturale; resta ammesso in illustrazioni, rarità e funzioni specifiche.

## 2.1 Colori fondamentali

| Token provvisorio | Valore | Funzione |
|---|---:|---|
| `--bg-base` | `#F7F6F0` | Avorio chiaro di base. È il fondo neutro dell’app quando non è presente un’illustrazione e il fallback cromatico dietro gli asset atmosferici. |
| `--surface-1` | `#FFFFFF` | Pannello principale, modal, card e superficie informativa prioritaria. Deve essere opaco o quasi opaco nelle aree di contenuto. |
| `--surface-2` | `#ECEBE5` | Superficie secondaria per pannelli interni, righe, tab inattivi e zone che devono separarsi dal bianco puro. |
| `--surface-3` | `#DDD9CF` | Separazione tenue, riquadro passivo, divisore largo o stato neutro più marcato. Non è il colore del testo. |
| `--ink-1` | `#111111` | Nero principale per titoli, nomi, numeri, dati competitivi e bordi forti. |
| `--ink-2` | `#242424` | Nero secondario per pannelli scuri, testo forte meno dominante e struttura. |
| `--ink-3` | `#4B4B4B` | Testo secondario, descrizioni e metadati che devono restare leggibili. |
| `--accent-yellow` | `#FFD21F` | Giallo principale per CTA, stato attivo, selezione e accenti Inazuma. |
| `--accent-yellow-strong` | `#FFE45C` | Giallo luminoso per focus, highlight breve e dettagli energetici; non va usato come testo su bianco. |
| `--accent-gold` | `#C99524` | Oro principale per prestigio, boss, trofei, vittorie e rarità Leggenda. |
| `--accent-gold-light` | `#E1B94B` | Oro chiaro per riflessi, fasce secondarie e highlight prestigiosi. |
| `--danger` | `#C93A32` | Sconfitta, pericolo, errore e azione distruttiva. |
| `--success` | `#2E8B57` | Successo, formazione valida, conferma positiva e stato completato. |

## 2.2 Bordi, ombre, focus e overlay

| Ruolo | Valore o relazione provvisoria | Uso |
|---|---|---|
| Bordo standard | derivato da `--ink-2` con intensità ridotta | Delimita pannelli e card senza attribuire loro stato speciale. |
| Bordo forte | `--ink-1` | Shell, card principali, modali, topbar e superfici sopra sfondi luminosi. |
| Bordo tenue | derivato da `--surface-3` | Divisioni interne e gruppi secondari. Non sostituisce il bordo forte quando serve contrasto. |
| Ombra netta | nero a opacità controllata, offset riconoscibile | Separa fisicamente superfici bianche da cielo e bagliori; deve sembrare grafica da videogioco, non ombra morbida da sito. |
| Focus ring | combinazione giallo forte + contorno scuro | Deve restare visibile sia su superfici chiare sia sulle rarità colorate. |
| Overlay chiaro | bianco/avorio ad alta opacità | Fascia locale dietro testo o pannello su immagine. Non è glassmorphism. |
| Overlay scuro | nero ad opacità controllata | Solo localmente dietro topbar, titoli o controlli; non deve oscurare uniformemente l’intera immagine. |
| Pannello scuro | `--ink-1` o `--ink-2` con testo chiaro | Navigazione, testata competitiva, scoreboard, dialoghi ad alto contrasto o sezioni prestigiose. |

## 2.3 Regola sul bianco

Il bianco domina le superfici, non necessariamente l’intero fotogramma. Sopra gli sfondi stadio:

- il cielo può restare celeste e luminoso;
- i pannelli possono essere bianchi;
- bordi, ombre e fasce devono impedirne la scomparsa;
- il fallback senza immagine deve restare completo e intenzionale usando `--bg-base`.

# 3. Token semantici dell’interfaccia

I token semantici descrivono **relazioni**. La futura implementazione potrà usare nomi tecnici diversi, ma dovrà preservarne la funzione.

| Token semantico | Relazione cromatica provvisoria | Regola |
|---|---|---|
| Background pagina | `--bg-base` | Fondo neutro e fallback affidabile. |
| Background illustrato | asset atmosferico + fallback `--bg-base` | Non deve trasferire l’azzurro nei componenti strutturali. |
| Pannello principale | `--surface-1` + bordo forte + ombra netta | Contenuto prioritario e leggibilità massima. |
| Pannello secondario | `--surface-2` + bordo standard | Informazioni di supporto e gruppi interni. |
| Pannello evidenziato | superficie chiara + fascia gialla | Azione, progresso o selezione importante. |
| Pannello prestigio | superficie chiara o scura + accento oro | Boss, vittoria, trofeo e Hall; uso raro. |
| Pannello scuro | `--ink-1`/`--ink-2` | Navigazione, scoreboard e testate competitive. |
| Testo principale | `--ink-1` | Nomi, titoli, overall, livelli e dati essenziali. |
| Testo secondario | `--ink-3` | Descrizioni e metadati non critici. |
| Testo su scuro | bianco o avorio ad alto contrasto | Non usare giallo chiaro per paragrafi. |
| Bordo standard | nero secondario | Identità della superficie senza stato. |
| Bordo forte | nero principale | Gerarchia, modal, card e separazione dallo sfondo. |
| Pulsante primario | fondo `--accent-yellow`, testo `--ink-1` | Avanza, conferma, simula, continua. |
| Pulsante secondario | superficie chiara, bordo scuro, testo scuro | Dettaglio, modifica o azione subordinata. |
| Pulsante neutro | `--surface-2`, testo scuro | Torna, chiudi o annulla senza conseguenze. |
| Pulsante distruttivo | `--danger`, testo ad alto contrasto | Elimina, sovrascrive o rinuncia con perdita. |
| Pulsante prestigio | `--accent-gold` con struttura distinta | Boss, premio o vittoria; non sostituisce la CTA gialla ordinaria. |
| Focus visibile | ring giallo forte + contorno scuro | Sempre indipendente da rarità e selected. |
| Selezione | outline/offset strutturale + indicatore | Non affidarsi soltanto al giallo. |
| Stato attivo | accento giallo + forma/label | Tab, nodo o controllo corrente. |
| Stato disabled | contrasto attenuato + struttura invariata | Deve restare leggibile e non sembrare locked. |
| Stato locked | overlay, icona e label specifica | Non deve sembrare una rarità o un semplice disabled. |
| Area hero | illustrazione o fondo base + pannelli opachi | Nessun testo importante libero sul cielo chiaro. |
| Navigazione | pannello scuro o superficie chiara fortemente bordata | Deve separarsi dall’illustrazione e rispettare safe area. |
| Tab attivo | giallo + bordo/indicatore | Chiaramente corrente anche senza percezione del colore. |
| Tab inattivo | `--surface-2` + testo `--ink-2` | Disponibile ma subordinato. |

# 4. Regole di contrasto e leggibilità

1. Nessun testo giallo chiaro su bianco, avorio o cielo luminoso.
2. Nessun testo sottile per nome, ruolo, overall, livello, pulsanti o dati competitivi.
3. Pannelli bianchi sopra immagini luminose devono avere almeno bordo scuro e ombra netta; una fascia gialla o nera può rafforzare la gerarchia.
4. Titoli, numeri e dati principali usano nero strutturale come base.
5. Il contenuto importante non va posizionato direttamente sul cielo chiaro, sull’orizzonte quasi bianco o sui bagliori oro.
6. Gli overlay devono essere localizzati dietro il contenuto; un overlay scuro globale distruggerebbe l’atmosfera approvata.
7. L’oro comunica prestigio e non sostituisce il giallo dell’azione primaria.
8. Il grigio secondario non deve scendere a un contrasto che renda incerti livello, ruolo o stato.
9. Le superfici devono restare leggibili quando l’immagine di sfondo non è caricata.
10. Selected, focus, rarità e stato non possono dipendere dallo stesso unico bordo colorato.
11. Su card compatte, il nome non può essere sacrificato per aggiungere texture o decorazioni.
12. La leggibilità deve essere verificata almeno sui viewport 360×800, 390×844, 430×932, 1366×768, 1440×900 e 1920×1080.

# 5. Rarità: regola non negoziabile

Il colore di rarità è un linguaggio funzionale del gioco. Deve restare immediatamente riconoscibile dopo il restyle.

## 5.1 Scala visiva da preservare

| Rarità | Famiglia cromatica da preservare | Nota |
|---|---|---|
| Scarso / Debole | neutrali scuri | Devono risultare inferiori senza diventare illeggibili. |
| Normale | grigio | Neutro, chiaramente distinto dalla struttura nera della card. |
| Buono | verde | Progressione positiva di base. |
| Forte | azzurro | Colore funzionale di rarità; è consentito e non reintroduce il vecchio tema blu. |
| Elite | viola | Deve restare riconoscibile anche su superfici chiare. |
| Mondiale | rosso | Prestigio competitivo elevato, distinto da danger tramite contesto e struttura. |
| Leggenda | oro | Massimo prestigio; deve distinguersi dall’oro strutturale attraverso pattern, intensità o iconografia. |

## 5.2 Vincoli

- La rarità non può essere rimossa per uniformare il tema.
- La rarità non è il colore della shell, della navigazione o del pulsante.
- La rarità Forte può usare azzurro perché svolge una funzione specifica.
- Mondiale e danger devono distinguersi tramite posizione, label, pattern e contesto.
- Leggenda e pulsante prestigio non devono risultare identici.
- Il tema chiaro deve ospitare tutte le rarità senza cambiare il colore dei testi essenziali.
- Ogni rarità deve essere riconoscibile anche con luminosità ridotta, overlay o immagine di sfondo.
- Il colore non deve essere l’unico segnale: bordo, label, pattern o icona devono supportarlo.

# 6. Come integrare i colori rarità nel nuovo tema

## 6.1 Approccio preferito — base chiara con struttura di rarità

- corpo card chiaro e leggibile;
- bordo o outline di rarità;
- fascia, taglio diagonale o corner di rarità;
- badge o cornice overall coordinata;
- testo principale nero;
- glow limitato alle rarità alte e mai necessario per leggere la classe.

Questo approccio mantiene una famiglia coerente e riduce il costo visivo nelle griglie lunghe.

## 6.2 Approccio secondario — header o footer di rarità

- corpo card bianco/avorio;
- testata o fascia inferiore colorata;
- nome e meta collocati sulla superficie con contrasto controllato;
- bordo scuro strutturale indipendente dalla rarità.

È utile quando la variante ha spazio orizzontale sufficiente, ma può comprimere le card campo e mobile.

## 6.3 Approccio ad alta intensità — quasi full-color

- grande presenza del colore di rarità;
- texture, pattern o bagliore dedicato;
- corpo ancora dotato di aree di testo ad alto contrasto.

È riservato a Leggenda o casi speciali approvati. Non è l’approccio generale perché:

- può ridurre la leggibilità;
- rende le griglie caotiche;
- confonde selected, user/opponent e rarity;
- aumenta il costo di glow e filtri;
- rende difficile mantenere coerenza tra varianti.

## 6.4 Regola di intensità

La quantità di colore può aumentare con la rarità, ma nome, overall, ruolo e livello devono restare su superfici controllate. La rarità arricchisce la card; non ne sostituisce l’architettura.

# 7. Principi strutturali delle Player Card

La Player Card è il componente visivo centrale del gioco.

## 7.1 Dati fondamentali

Ogni variante deve considerare:

- immagine giocatore;
- nome;
- ruolo;
- overall;
- livello;
- rarità;
- equipaggiamento eventuale.

Una variante può omettere un dato solo quando il contesto lo rende davvero ridondante e la decisione è documentata.

## 7.2 Principi obbligatori

- Il nome deve essere leggibile e non coperto.
- L’overall deve essere individuabile a colpo d’occhio.
- Il livello deve avere una posizione stabile.
- Il ruolo deve essere sempre chiaro.
- L’equipaggiamento deve essere piccolo ma riconoscibile.
- La rarità deve essere visibile senza dominare il testo.
- Tutte le varianti condividono identità, gerarchia e grammatica degli stati.
- Decorazioni, fulmini, tagli e pattern non possono coprire dati.
- Le card della propria squadra privilegiano leggibilità assoluta.
- Le card campo non devono modificare la geometria funzionale o l’ordine dei giocatori.
- Le implementazioni future devono rispettare wrapper, `data-*` e listener finché i test non autorizzano cambiamenti strutturali.

# 8. Famiglia futura delle Player Card

Le nove varianti tecniche censite dovranno essere ricondotte progressivamente a sei varianti progettuali.

## 8.1 Card grande

- **Scopo:** draft, pull, ricompense e presentazione di un singolo giocatore.
- **Densità:** bassa o media.
- **Dati visibili:** tutti i dati fondamentali, immagine dominante, rarità evidente.
- **Priorità:** immagine, nome e overall.
- **Interazioni:** selezione, dettaglio, conferma o rifiuto.
- **Rischio:** diventare troppo alta su mobile o troppo decorativa.
- **Mobile:** preferibile trasformazione orizzontale o composizione compatta.
- **Desktop:** verticale, con azioni chiaramente separate dalla card.

## 8.2 Card compatta tattica

- **Scopo:** Squadra, panchina, trade, equipaggiamento e preview dense.
- **Densità:** alta.
- **Dati visibili:** nome, ruolo, overall, livello, equip; immagine ridotta.
- **Priorità:** leggibilità e riconoscimento rapido.
- **Interazioni:** dettaglio, selezione o swap.
- **Rischio:** sovrapposizione di badge e testo troppo piccolo.
- **Mobile:** larghezza e altezza controllate, nessun ritratto enorme.
- **Desktop:** può mostrare più meta senza duplicare le informazioni.

## 8.3 Card campo

- **Scopo:** formazioni 5v5 e 11v11, preview e match.
- **Densità:** molto alta.
- **Dati visibili:** ruolo, overall, nome abbreviato ma riconoscibile, livello ed equip quando applicabile.
- **Priorità:** posizione tattica e overall.
- **Interazioni:** dettaglio o selezione dello slot.
- **Rischio:** rompere righe, coordinate, ordine dei ruoli o interazioni.
- **Mobile:** deve reggere fino a cinque giocatori sulla stessa riga.
- **Desktop:** non va ingrandita fino a rendere il campo secondario.

## 8.4 Card orizzontale

- **Scopo:** liste mobile, selettore 5v5 e sostituzioni.
- **Densità:** media.
- **Dati visibili:** immagine, nome, ruolo, overall, livello, stato e azione breve.
- **Priorità:** scansione verticale veloce.
- **Interazioni:** selezione, assegnazione o dettaglio.
- **Rischio:** azioni troppo vicine o nome compresso.
- **Mobile:** variante primaria.
- **Desktop:** solo quando la lista laterale lo richiede, non come default.

## 8.5 Card Album locked

- **Scopo:** rappresentare giocatori non ancora ottenuti.
- **Densità:** coerente con la griglia Album.
- **Dati visibili:** solo quanto consentito dal comportamento attuale, più stato di blocco inequivocabile.
- **Priorità:** indisponibilità, non rarità.
- **Interazioni:** eventuale Player Detail secondo il comportamento corrente.
- **Rischio:** confondere lock, rarità e semplice disabled.
- **Mobile/Desktop:** stesso linguaggio, intensità calibrata alla dimensione.

## 8.6 Card storica/non interattiva

- **Scopo:** Albo d’Oro, finali e snapshot.
- **Densità:** media o alta.
- **Dati visibili:** dati storici congelati, senza affordance falsa.
- **Priorità:** identità e leggibilità dello snapshot.
- **Interazioni:** nessuna oppure apertura dettaglio storico esplicita.
- **Rischio:** sembrare selezionabile o usare dati correnti al posto dello snapshot.
- **Mobile:** composizione compatta.
- **Desktop:** può mostrare più contesto senza cambiare la gerarchia base.

# 9. Layout interno consigliato delle card

## 9.1 Schema preferito

- **Angolo alto sinistro:** ruolo.
- **Angolo alto destro:** overall.
- **Centro/sopra:** immagine giocatore.
- **Parte inferiore:** nome e meta breve.
- **Angolo basso destro:** livello.
- **Angolo basso sinistro:** equipaggiamento eventuale.
- **Bordo/fascia/corner dedicato:** rarità.
- **Outline esterno separato:** selected/focus.

Questo schema riprende posizioni già frequenti nel progetto e riduce il costo cognitivo tra varianti.

## 9.2 Adattamenti ammessi

- La card orizzontale può spostare immagine a sinistra e testo al centro.
- La card campo può comprimere il nome e usare badge più piccoli.
- La card storica può ridurre affordance e azioni.
- La card locked può sovrapporre un layer, ma deve preservare la comprensione della struttura.

## 9.3 Regola chiave

Ruolo, overall, livello e oggetto non cambiano posizione senza una motivazione funzionale documentata. Le eccezioni devono derivare dal formato, non da preferenze estetiche isolate.

# 10. Distinzione tra stati delle card

Gli stati sono livelli indipendenti e devono poter coesistere.

| Stato | Trattamento preferenziale | Cosa non deve fare |
|---|---|---|
| Rarità | bordo, fascia, corner, pattern o glow controllato | Non rappresentare selezione, lock o equip. |
| Selected | outline forte, offset, indicatore o check | Non usare soltanto il colore della rarità. |
| Equipped | badge oggetto nell’area dedicata | Non sembrare un badge rarità. |
| Disabled | contrasto attenuato, azione inibita, testo ancora leggibile | Non diventare indistinguibile o sembrare locked. |
| Locked | overlay strutturato, icona/label e riduzione controllata | Non sembrare una rarità scura. |
| Propria squadra | massima leggibilità, testo forte, contesto user coerente | Non cambiare completamente architettura. |
| Avversario | contesto, bordo secondario o area di supporto distinta | Non coprire o alterare la rarità. |
| Storica | affordance ridotta e label/snapshot contestuale | Non sembrare selected o interattiva. |
| Focus | ring accessibile indipendente | Non coincidere con selected. |
| Hover | feedback leggero desktop | Non spostare layout o riavviare animazioni pesanti. |

Regole non negoziabili:

- rarità e selected non devono confondersi;
- Leggenda non deve sembrare automaticamente selected;
- locked non deve sembrare soltanto raro;
- equipped non deve sembrare una classe di rarità;
- disabled resta leggibile;
- focus è sempre percepibile anche su card Leggenda o Mondiale.

# 11. Card della propria squadra vs avversario

La distinzione user/opponent deve esistere, ma la stessa architettura di card deve rimanere riconoscibile.

## Preferenza

- stessa griglia interna;
- stesse posizioni per ruolo, overall, livello ed equip;
- stessa logica di rarità;
- propria squadra con testo più forte e contrasto assoluto;
- avversario differenziato tramite contesto della sezione, label, bordo secondario, pattern o area di supporto;
- nessuna inversione radicale che trasformi la card avversaria in un componente diverso.

La distinzione può essere rafforzata a livello di campo, pannello o testata, evitando di sovraccaricare ogni singola card.

# 12. Card locked Album

La variante locked è critica perché nel repository corrente il blocco è aggiunto tramite wrapper e overlay esterni alla card base.

## Regole

- Deve apparire realmente non disponibile.
- Lock e rarità devono essere livelli separati.
- L’overlay non deve sembrare un colore di rarità.
- Icona e testo “Non sbloccato” o equivalente devono essere inequivocabili.
- La silhouette può essere attenuata, ma il lock deve restare leggibile.
- Una card Leggenda locked deve sembrare prima di tutto locked, pur permettendo di riconoscere la rarità quando previsto.
- Un’eventuale apertura del Player Detail non deve far sembrare la card acquisita.
- L’overlay non deve creare una falsa affordance selected.
- Mobile e desktop devono condividere la stessa semantica.

# 13. Intensità stilistica consigliata per area

## Alta intensità

- Home;
- selezione Season;
- schermate boss;
- celebrazione e finali.

Uso ammesso: hero, diagonali, fulmini, illustrazioni stadio, oro e motion controllato.

## Intensità media

- Pull;
- Albo d’Oro;
- sezioni hero;
- ricompense e risultati importanti.

Uso ammesso: rarità più presente, card grandi e pannelli con identità forte.

## Intensità controllata

- Squadra;
- Inventario;
- Album;
- editor 5v5;
- schermate dense.

Priorità: leggibilità, densità, prestazioni e distinzione degli stati. Decorazioni limitate.

## Intensità funzionale

- modali di conferma;
- assegnazioni;
- stati tecnici;
- errori;
- overwrite e azioni distruttive.

Priorità: chiarezza dell’azione, rischio e possibilità di annullamento. Nessun rumore superfluo.

# 14. Criteri di approvazione delle future card

Una futura Player Card sarà approvabile soltanto se:

- i colori rarità sono immediatamente riconoscibili;
- il nome si legge bene;
- overall e livello sono immediatamente individuabili;
- il ruolo è chiaro;
- l’equipaggiamento è leggibile ma non invadente;
- la card appartiene visivamente a Inazuma Roguelike;
- mobile e desktop restano coerenti;
- selected, locked, disabled ed equipped sono distinguibili;
- propria squadra e avversario sono distinguibili senza rompere la rarità;
- la card resta leggibile su sfondo stadio luminoso;
- la card resta completa con fallback `--bg-base`;
- non sembra una card generica da sito;
- non rompe la densità delle schermate piene;
- non richiede testo minuscolo;
- non altera wrapper, `data-*`, ordine logico o coordinate funzionali;
- non usa glow o filtri pesanti su tutte le istanze;
- è verificata nelle tre superfici pilota e nei viewport critici.

# 15. Decisioni ancora aperte

Restano da approvare nelle fasi successive:

- tonalità finali dei colori rarità nel nuovo tema;
- contrasto preciso tra `--surface-1`, `--surface-2` e `--surface-3`;
- intensità di glow e outline per ogni rarità;
- forma esatta dei bordi;
- quantità di diagonali;
- fascia superiore, laterale o corner;
- aspetto finale del badge overall;
- aspetto finale del badge livello;
- aspetto finale del badge equip;
- differenziazione precisa tra propria squadra e avversario;
- pattern speciale per Leggenda;
- eventuale texture per Mondiale;
- separazione visiva tra Mondiale rosso e danger;
- trattamenti hover desktop;
- feedback touch mobile;
- quantità e durata delle animazioni;
- comportamento con `prefers-reduced-motion`;
- quali varianti possano condividere realmente lo stesso markup;
- adapter necessari per le nove varianti tecniche correnti;
- fino a che punto riusare l’architettura attuale senza refactor aggiuntivi;
- momento in cui sarà sicuro cambiare wrapper e `data-*`;
- misure definitive di card, badge, bordi e target touch;
- verifica completa dei colori su tutte le immagini e rarità.

Nessuna decisione aperta è resa definitiva da questo documento. La validazione dovrà avvenire attraverso prototipi delle tre superfici pilota, fixture deterministiche, screenshot e controlli di contrasto.
