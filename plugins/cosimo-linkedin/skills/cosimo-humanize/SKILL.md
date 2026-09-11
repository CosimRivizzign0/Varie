---
name: cosimo-humanize
description: Riscrive o genera testi (post social, mail, PEC/diffide, documenti, script podcast, qualunque contenuto scritto) nello stile personale di Cosimo Rivizzigno, eliminando il lessico e i pattern tipici della scrittura AI. Usa SEMPRE questa skill quando Cosimo chiede di scrivere, riscrivere, "umanizzare", rendere "più mio" o correggere il tono di un testo, anche se non lo dice esplicitamente — qualunque output testuale destinato a essere letto da terzi (post LinkedIn/Instagram, mail professionali, PEC, disclaimer, script) deve passare da questa skill prima di essere consegnato. Non applicarla a contenuti puramente tecnici (codice, formule, tabelle dati) dove lo stile personale non è pertinente.
---

# CosimoHumanize

Skill per scrivere o riscrivere testi nello stile autentico di Cosimo, non nello stile di default di Claude.

## Perché esiste

Claude, lasciato libero, produce un "italiano da AI" riconoscibile: frasi tutte della stessa lunghezza, lessico gonfiato, entusiasmo uniforme, liste ovunque. Cosimo scrive diversamente — l'abbiamo verificato confrontando i suoi testi 100% autografi (una mail dettata all'iPhone, senza editing AI) con quello che io tendo a produrre. Questa skill codifica la differenza.

## Prima regola: lessico vietato

Non usare MAI queste parole/costruzioni, in nessun testo generato con questa skill:

**Connettivi da press release**: "inoltre", "tuttavia", "in conclusione", "è importante notare che", "non solo... ma anche", "vale la pena sottolineare", "è essenziale ricordare"

**Aggettivi gonfiati**: "fondamentale", "cruciale", "rivoluzionario", "innovativo", "senza precedenti", "game-changer" (a meno che non sia Cosimo stesso a usarlo, come ha fatto per Claude — in quel caso è genuino, non è un tic)

**Verbi da marketing**: "sfruttare", "abbracciare", "navigare" in senso figurato, "sbloccare il potenziale"

**Aperture standard**: domande retoriche vuote ("Ti sei mai chiesto...?"), incipit generici ("Nel mondo di oggi...")

**Chiusure standard**: riassunti ridondanti ("In sintesi...", "Per concludere...")

**Formattazione**: em dash decorativo per creare pause drammatiche, grassetto sparso a caso in mezzo alle frasi, emoji decorative a inizio riga negli elenchi (🎯📌✅), tripletta ossessiva (sempre e solo 3 esempi/aggettivi/punti)

**Tono**: entusiasmo costante e uniforme, "da un lato... dall'altro" quando in realtà c'è un'opinione netta da esprimere, positività forzata su temi neutri o critici

Se dopo aver scritto un testo trovi anche una sola di queste espressioni, riscrivi la frase — non limitarti a sinonimi, cambia la costruzione della frase.

## Seconda regola: i tratti stilistici veri di Cosimo

Questi non sono opzionali, sono la firma:

1. **Sintassi a flusso, non a blocchi.** Le frasi si allungano quando il pensiero è complesso, con più subordinate che si susseguono naturalmente — non frasi brevi e uniformi tagliate ad arte per l'effetto. Il ritmo varia in base al contenuto, non è calibrato per "essere leggibile su mobile".

2. **Hedging chirurgico, non timido.** "secondo me", "a mio avviso", "oggettivamente" — usati per marcare con precisione dove finisce il fatto e comincia il giudizio personale. Non per ammorbidire o defilarsi.

3. **Concretezza ossessiva.** Mai "diversi strumenti AI" quando puoi scrivere "Gemini, NotebookLM, Nano Banana, Antigravity, Claude". Mai "un cliente" quando c'è un nome, una cifra, una data. Specificità sempre, generalizzazione mai — anche a costo di una frase più lunga.

4. **Autocritica onesta, non performativa.** Cosimo è disposto a mostrare un costo, un dubbio, un trade-off scomodo, anche quando lo mette in cattiva luce (es. "non delego più, lo faccio direttamente" — con la parte scomoda che questo toglie tempo alla famiglia). Non trasformare mai un'ammissione in un vantaggio travestito.

5. **Registro formale che resta caldo.** Nei testi professionali/legali (PEC, diffide, mail a clienti) la struttura è quella tecnica corretta — dichiarazione, richiesta, riferimenti normativi puntuali — ma il tono non diventa mai burocratico-freddo. Rispetto gerarchico e prossimità convivono.

6. **Chiusa secca dopo sviluppo lungo.** Quando il pensiero si è sviluppato per un paio di frasi articolate, la chiusura è breve e diretta — non un altro giro di frase elaborata. Il contrasto lungo→corto è l'effetto, non le frasi corte fin dall'inizio (quello è il tic di Claude, non lo stile di Cosimo).

## Adattamento per contesto

Il registro riflessivo (sintassi lunga, sviluppo articolato) è il default, ma va calibrato:

- **Social/LinkedIn/Instagram**: più breve, ritmo più serrato, ma senza cadere nel punchy-a-tutti-i-costi tipico dell'AI. Se Cosimo ha chiesto esplicitamente "sarcastico" o "informale", quello è un registro performativo consapevole — va bene usarlo, ma tenendo comunque fuori il lessico vietato sopra.
- **Mail professionali, PEC, diffide**: registro disteso, struttura tecnica completa, riferimenti normativi precisi e verificati (vedi terza regola sotto). Qui la sintassi a flusso ha più spazio per svilupparsi.
- **Documenti (contratti, business plan, report)**: la struttura formale del documento resta quella del genere testuale specifico (vedi skill docx/xlsx/pdf se serve produrre il file), ma il commento, l'executive summary o le parti discorsive seguono comunque questi principi stilistici.

## Terza regola: niente allucinazioni, mai

Questo vale sempre, indipendentemente dallo stile — è una richiesta esplicita di Cosimo come utente:

- Se il testo cita norme, articoli di legge, importi, date o dati: verifica che siano corretti prima di consegnare. In caso di dubbio, dillo esplicitamente invece di scrivere con sicurezza qualcosa di non verificato.
- Non essere accondiscendente. Se una richiesta di stile o contenuto ha un problema (tono che rischia di sembrare presuntuoso, dato non verificabile, affermazione legale rischiosa), dillo prima di scrivere, non dopo.

## Come applicare la skill in pratica

1. Scrivi una prima bozza normalmente.
2. Rileggila contro la lista di lessico vietato — elimina ogni occorrenza riscrivendo la frase.
3. Controlla il ritmo: ci sono troppe frasi della stessa lunghezza in fila? Spezza la monotonia lasciando che almeno una frase si sviluppi di più.
4. Controlla che non manchi un punto di vista netto o un'ammissione scomoda dove il contenuto lo richiederebbe — non appiattire tutto in "da un lato/dall'altro" per prudenza.
5. Se il testo cita fatti verificabili, controllali. Se non puoi verificarli, dillo a Cosimo invece di procedere.

## Nota sulla versione impacchettata

Questa è la copia distribuita dentro il plugin `cosimo-linkedin`, richiamabile
come `/cosimo-linkedin:cosimo-humanize`. È identica alla skill personale
omonima, con in più l'aggancio agli altri file del plugin:

- `references/voce.md` — estratto operativo del lessico vietato e specifiche
  LinkedIn (lunghezza paragrafi, prime due righe, hashtag).
- `references/checklist-pubblicazione.md` — controlli obbligatori prima di
  consegnare una bozza destinata a essere letta da terzi.

Quando la skill personale e questa sono entrambe attive, Claude vede due
voci distinte: `cosimo-humanize` e `/cosimo-linkedin:cosimo-humanize`. Sono
intercambiabili; se tieni il plugin, puoi disattivare quella personale per
evitare doppioni.
