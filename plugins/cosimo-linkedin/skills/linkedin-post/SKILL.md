---
name: linkedin-post
description: "Scrive un post LinkedIn da zero nella voce di Cosimo Rivizzigno, partendo da un tema, un episodio di lavoro o un dato. Sceglie l'apertura, sviluppa un unico punto di vista, applica il filtro anti-stile-AI e consegna la bozza con le alternative di apertura. Usa quando Cosimo dice \"scrivimi un post\", \"fammi un post su\", \"ho questa cosa da raccontare su LinkedIn\". Non pubblica nulla: la pubblicazione resta manuale. Non usarla per commentare post altrui (linkedin-commento) né per pianificare la settimana (linkedin-piano-editoriale)."
---

# Post LinkedIn

Produce una bozza di post nella voce di Cosimo. Non pubblica: questo plugin
non ha credenziali né chiamate di rete, la bozza va copiata a mano.

## Quando usarla

- "Scrivimi un post su X"
- "Ho fatto questa cosa con un cliente, ne farei un post"
- "Questo dato di bilancio è interessante, lo porto su LinkedIn"

## Prima di scrivere: le tre domande

Non partire dalla bozza. Chiedi, in una volta sola, e aspetta la risposta:

1. **Qual è la cosa che vuoi che resti al lettore?** Una frase. Se ne servono
   due, sono due post.
2. **Chi deve leggerlo?** Imprenditori PMI, colleghi consulenti, commercialisti,
   banche, potenziali clienti: il registro cambia.
3. **Che materiale hai?** Un episodio, un numero, una norma, una discussione
   avuta. Senza materiale concreto il post diventa generico, e il generico è
   esattamente ciò che questa skill esiste per evitare.

Se Cosimo ha già dato tutto e tre nel messaggio iniziale, non ripeterle:
riformula in una riga quello che hai capito e procedi.

## Struttura

Non c'è un template unico. C'è un'ossatura:

**Apertura (2 righe).** Scegli tra le sei di `references/ganci.md` quella che
il materiale sostiene davvero. Se il materiale è un dato → A1. Se è una tesi →
A2. Se è un errore tuo → A3. Se è un equivoco diffuso → A4. Se è un episodio →
A5. Se è una domanda aperta → A6.

**Sviluppo (corpo).** Qui la sintassi si allunga: è il punto in cui il
pensiero si articola, con le subordinate che servono. Concretezza ossessiva —
nome dello strumento, cifra, data, articolo di legge. Se c'è un calcolo, il
procedimento si mostra, non solo il risultato.

**Il costo o il limite.** Quasi tutti i post reggono meglio se dicono anche
cosa non funziona, cosa è costato, dove il ragionamento si ferma. Questa è la
parte che gli altri non scrivono.

**Chiusa secca.** Dopo lo sviluppo lungo, una o due righe corte. Non un
riassunto. Se serve un invito ai commenti, che sia una domanda a cui tu non
hai già risposto nel post.

## Lunghezza

800-1.400 caratteri per il post riflessivo standard. Oltre i 1.800 il post
va diviso o tagliato: se non riesci a tagliare, il problema è che stai
tenendo dentro due tesi.

## Passaggi obbligatori prima di consegnare

1. Applica `/cosimo-linkedin:cosimo-humanize` sul testo — non come revisione
   di cortesia, come riscrittura vera di ogni frase che contiene lessico
   vietato.
2. Scorri `references/checklist-pubblicazione.md` voce per voce.
3. Se il post cita norme, importi o dati: verificali. Se non sono
   verificabili, dillo prima della bozza.
4. Se il post racconta un cliente: controlla che non sia identificabile.
   Settore e ordine di grandezza sì; nome, città piccola, fatturato esatto e
   combinazioni che li ricostruiscono, no.

## Cosa consegnare

- Il post completo, pronto da copiare.
- **Due aperture alternative** (le prime due righe soltanto), da altre due
  formule di `references/ganci.md`, così la scelta resta a Cosimo.
- Una riga su cosa hai tenuto fuori e perché, se hai scartato qualcosa di
  sostanziale.
- Gli hashtag proposti, al massimo tre, separati dal corpo.

Non aggiungere metriche previste, stime di reach o punteggi: sarebbero
inventati.
