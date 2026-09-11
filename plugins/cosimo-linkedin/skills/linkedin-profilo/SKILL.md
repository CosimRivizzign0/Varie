---
name: linkedin-profilo
description: "Analizza e riscrive il profilo LinkedIn di Cosimo Rivizzigno sezione per sezione: titolo, informazioni/About, esperienze, in evidenza, competenze. Cosimo incolla i testi attuali (il plugin non legge LinkedIn), la skill dice cosa non funziona e propone la riscrittura nella sua voce. Usa per \"rivedi il mio profilo\", \"riscrivimi il titolo\", \"il mio About non mi convince\". Non per scrivere post (linkedin-post)."
---

# Profilo LinkedIn

Analizza e riscrive il profilo. Il plugin non accede a LinkedIn: Cosimo
incolla i testi attuali, sezione per sezione o tutti insieme.

## Cosa chiedere se manca

- I testi attuali di titolo, About, esperienze.
- **A chi deve parlare il profilo**: imprenditori PMI che cercano un
  consulente, colleghi, banche, aziende per collaborazioni. Un profilo che
  parla a tutti non parla a nessuno.
- Cosa deve fare chi arriva sul profilo: contattare, capire di cosa si occupa,
  leggere i contenuti. Cambia la chiusa dell'About.

## Il difetto da correggere quasi sempre

La maggior parte dei profili è scritta come un curriculum: elenca ruoli e
anni. Il curriculum risponde a "cosa ha fatto"; il profilo deve rispondere a
"questa persona può risolvere il mio problema". Sono due testi diversi.

Segnale che il profilo è ancora un curriculum: nelle prime tre righe dell'About
non compare mai il problema del lettore, solo la storia di chi scrive.

## Sezione per sezione

**Titolo (220 caratteri).** È l'unica cosa che si vede ovunque: nei commenti,
nelle ricerche, nelle notifiche. Deve dire cosa fa e per chi, con le parole
che il cliente userebbe cercando. "Dottore commercialista" dice il titolo di
studio, non il servizio. Evitare l'accumulo di etichette separate da barre
verticali quando non corrispondono ad attività reali.

**Informazioni / About.** Le prime tre righe sono ciò che si vede prima di
"…altro": lì va il problema e l'approccio, non la biografia. Poi si può
sviluppare: come lavora, su cosa, con quali strumenti, cosa non fa. Qui la
sintassi a flusso ha spazio. Chiusura con un'indicazione chiara di cosa fare
per parlargli, senza formule da landing page.

**Esperienze.** Per ogni voce: cosa faceva concretamente e, dove possibile,
un risultato misurabile e vero. Se un numero non è verificabile o non è
condivisibile, non inventarne uno approssimato: si descrive l'attività.

**In evidenza.** Ha senso solo se c'è qualcosa di reale da mettere: un
articolo, un caso, uno strumento. Se non c'è, dirlo invece di riempire.

**Competenze.** Poche e coerenti con il titolo. Una lista lunga di competenze
generiche diluisce le tre che contano.

## Metodo

1. Per ogni sezione: **cosa non funziona** (due righe, motivo concreto) poi
   **la riscrittura**. Non consegnare solo il testo nuovo: senza la diagnosi
   Cosimo non può valutare se sei d'accordo con lui o se stai indovinando.
2. Nessun dato inventato. Se una riscrittura richiederebbe un numero che non
   hai, lascia un segnaposto esplicito e chiedilo.
3. `/cosimo-linkedin:cosimo-humanize` su ogni testo prodotto. L'About è il
   punto dove lo stile AI si nota di più, perché è lungo e autoreferenziale.
4. Niente promesse di risultato ("il triplo delle visualizzazioni"): sono
   numeri che non puoi verificare.

## Consegna

Sezione per sezione, diagnosi + riscrittura, e in fondo l'elenco delle
informazioni che ti mancano per completare le parti rimaste con segnaposto.
