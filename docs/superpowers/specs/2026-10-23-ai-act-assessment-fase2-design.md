# AI Act Assessment — Fase 2: Questionario e classificazione — Design

- **Data:** 2026-10-23
- **Stato:** in revisione
- **Dipende da:** Fase 1 (`2026-10-22-ai-act-assessment-fase1-design.md`)

## 1. Obiettivo

Per ogni sistema AI di un cliente, un questionario guidato produce:

1. la **classe di rischio** secondo il Reg. (UE) 2024/1689 come modificato dal
   Reg. (UE) 2026/1744 ("Digital Omnibus on AI");
2. la **motivazione** (risposte determinanti con articolo citato);
3. gli **obblighi** applicabili al ruolo del cliente, ciascuno con la data da cui si applica.

Il consulente conferma la classificazione o la modifica con motivazione obbligatoria.

### Decisioni dell'utente

- Profondità: classificazione + obblighi (nessuna gap analysis punto per punto).
- Contenuto giuridico: bozza scritta da Claude, validata dall'utente riga per riga.
- Approccio: albero di domande con regole in file dati versionato (approccio A).
- Modelli GPAI (Capo V) **esclusi**.
- Risposte Sì / No / **Non so**; modifica della classificazione con motivazione mantenuta.

### Escluso

- Report Word/Excel (Fase 2b). Analisi documentale con LLM (Fase 3).
- Editor delle regole nell'app. Gap analysis per obbligo.

## 2. Quadro normativo e date (da confermare sul testo in GU)

Fonte: sintesi di fonti secondarie consultate il 2026-10-23; il testo del Reg. 2026/1744
in GU non è stato letto direttamente. **Prerequisito del §9 punto 1.**

| Elemento | Data di applicazione |
|---|---|
| Reg. 2026/1744: pubblicazione GU / entrata in vigore | 24/07/2026 / 27/07/2026 |
| Art. 5 pratiche vietate (originarie) e art. 4 | 02/02/2025 |
| Art. 5 nuova pratica (materiale intimo non consensuale / CSAM) | 02/12/2026 |
| Art. 50 trasparenza | 02/08/2026 (marcatura leggibile dalle macchine: 02/12/2026 per sistemi immessi prima del 02/08/2026) |
| Alto rischio Allegato III | 02/12/2027 |
| Alto rischio Allegato I | 02/08/2028 |

Punti **da verificare** sul testo ufficiale (marcati `da_verificare` nelle regole):
art. 4 (riformulazione dell'obbligo di alfabetizzazione), art. 49(2) (registrazione dei
sistemi che usano la deroga dell'art. 6(3)), numerazione delle nuove lettere dell'art. 5.

La Fase 1 dava per data alto rischio il 02/08/2026: superata da questa tabella.

## 3. Percorso di valutazione

Sezioni nell'ordine, ciascuna con domande Sì / No / Non so:

| # | Sezione | Esito se determinante |
|---|---|---|
| 0 | **Ambito** — definizione di sistema di IA (art. 3(1)); esclusioni art. 2 (militare, sola ricerca, uso personale non professionale) | `fuori_ambito` → fine |
| 1 | **Pratiche vietate** — una domanda per ogni pratica dell'art. 5(1) + nuova pratica 2026/1744 | `vietato` → fine |
| 2a | **Allegato I** — componente di sicurezza di prodotto soggetto a valutazione di terzi (art. 6(1)) | `alto_rischio` (dal 02/08/2028) |
| 2b | **Allegato III** — una domanda per ciascuna delle 8 aree | se sì → 2c |
| 2c | **Deroga art. 6(3)** — compito procedurale ristretto / miglioramento di attività umana completata / rilevazione di schemi senza sostituire la valutazione umana / compito preparatorio; **profilazione** | profilazione → `alto_rischio`; deroga applicabile → `non_alto_rischio_deroga` (obbligo di documentare, art. 6(4)); altrimenti `alto_rischio` (dal 02/12/2027) |
| 3 | **Trasparenza** — interazione con persone, contenuti sintetici, riconoscimento emozioni / categorizzazione biometrica, deepfake (art. 50) | flag `trasparenza` cumulabile con qualsiasi classe tranne `fuori_ambito` e `vietato` |
| 4 | **Ruolo** — nome/marchio proprio o modifica sostanziale (art. 25(1)) | ruolo effettivo `fornitore` |

**Classi:** `fuori_ambito`, `vietato`, `alto_rischio`, `non_alto_rischio_deroga`, `minimo`,
`da_approfondire`. Flag aggiuntivo: `trasparenza`.

**Non so:** se una domanda con risposta "Non so" avrebbe potuto cambiare l'esito
(cioè l'esito differisce tra l'ipotesi "sì" e "no"), la classe è `da_approfondire` con
l'elenco delle domande aperte. Le domande "Non so" non determinanti non bloccano.

**Ruolo effettivo:** il `ruoloCliente` del sistema (Fase 1), salvo art. 25 → `fornitore`.
Con `da_definire` gli obblighi sono mostrati per tutti i ruoli, con avviso.

### Obblighi (bozza, per classe × ruolo)

| Classe | Ruolo | Obblighi |
|---|---|---|
| tutte tranne fuori ambito | tutti | art. 4 |
| `vietato` | tutti | cessare/non immettere l'uso (art. 5) |
| `alto_rischio` | deployer | art. 26; art. 27 FRIA solo se ente pubblico / servizio pubblico o All. III p. 5(b)(c); art. 86 |
| `alto_rischio` | fornitore | artt. 9–17, 43, 47, 48, 49, 72, 73 |
| `alto_rischio` | importatore / distributore | art. 23 / art. 24 |
| `non_alto_rischio_deroga` | fornitore | documentazione art. 6(4); art. 49(2) (`da_verificare`) |
| flag `trasparenza` | fornitore / deployer | art. 50 parr. pertinenti |

La domanda "ente pubblico o servizio pubblico" compare solo per deployer con classe
`alto_rischio`.

## 4. File delle regole

`ai-act-app/regole/ai-act.json`, importato in build. Struttura:

```
meta:      { id, versione (semver), norma, dataRedazione }
domande:   [{ id, sezione, testo, aiuto, riferimento, mostraSe?, stato }]
esiti:     [{ id, quando, classe, motivazione, riferimento, dataApplicazione?, stato }]   // ordinati: vince il primo
trasparenza: [{ id, quando, motivazione, riferimento, stato }]
obblighi:  [{ id, classi[], ruoli[], quando?, testo, riferimento, dataApplicazione, stato }]
```

- `stato`: `bozza` | `validata` | `da_verificare`.
- Condizioni come dati: `{ "risposta": "<id>", "uguale": "si"|"no"|"non_so" }`,
  `{ "tutte": [...] }`, `{ "almenoUna": [...] }`, `{ "non": ... }`. Nessun `eval`.
- Validazione all'avvio (zod + controlli): id univoci, ogni riferimento a domanda esiste,
  nessun ciclo in `mostraSe`, date ISO valide, ogni voce ha `stato`. File non valido →
  la sezione valutazioni mostra un errore e non calcola esiti.
- **Tabella di revisione**: script `npm run regole:revisione` genera
  `docs/ai-act-app/revisione-regole.md` (una riga per voce: id, testo, riferimento, stato,
  colonna "Esito revisione" vuota). L'utente la compila; Claude riporta gli stati nel JSON.

## 5. Dati

Migrazione 2, tabella `valutazioni`:

| Colonna | Note |
|---|---|
| id, sistema_id | FK su sistemi |
| versione_regole | `meta.versione` usata |
| risposte | JSON `{ [idDomanda]: "si" \| "no" \| "non_so" }` |
| esito | JSON: copia fissa di classe, flag, motivazione, obblighi calcolati (null finché in corso) |
| stato | `in_corso` \| `completata` \| `confermata` |
| classe_confermata, nota_modifica | classe scelta dal consulente; nota obbligatoria se diversa da `esito.classe` |
| creato_il, modificato_il, confermato_il, sostituita_il | `sostituita_il` valorizzato quando una nuova valutazione la rimpiazza |

- Una sola valutazione **attiva** per sistema (`sostituita_il IS NULL`); le precedenti
  restano come storico.
- **Da rivedere**: valutazione attiva con `versione_regole` ≠ versione corrente.
- Modificare una risposta di una valutazione `completata`/`confermata` ricalcola l'esito e
  azzera la conferma: torna `completata` se il questionario resta completo, altrimenti `in_corso`.
- Cestino: eliminare un sistema sposta con lui le sue valutazioni (come Fase 1).
- Ogni scrittura in un unico batch con riga `attivita`.

## 6. Interfaccia

- **Scheda sistema:** riquadro "Valutazione AI Act" con stato, classe, badge "Da rivedere";
  pulsanti "Avvia valutazione" / "Riprendi" / "Nuova valutazione".
- **Questionario** (`/sistemi/:id/valutazione`): una sezione per pagina, barra di
  avanzamento, domande nascoste se `mostraSe` è falsa, aiuto espandibile, articolo citato.
  Salvataggio automatico a ogni risposta.
- **Esito** (`/sistemi/:id/valutazione/esito`): classe, flag trasparenza, motivazione,
  domande "Non so" aperte, obblighi con data; avviso "Regole non ancora validate (N di M)"
  se qualche voce usata non è `validata`; pulsanti "Conferma classificazione" e
  "Modifica classificazione" (select classe + nota obbligatoria).

## 7. Roadmap

| Tappa | Completata quando | Stato in Fase 2 |
|---|---|---|
| 3 Questionario | ogni sistema attivo ha una valutazione attiva `completata` o `confermata` | attiva |
| 4 Classificazione | ogni sistema attivo ha una valutazione attiva `confermata` | attiva |
| 5 Report | — | bloccata (Fase 2b) |

`dettaglio` tappa 3: "N di M sistemi"; prossima azione: "Compila il questionario per «<sistema>»"
/ "Conferma la classificazione di «<sistema>»". Una valutazione "da rivedere" conta
come non completata.

## 8. Test

- **Casi di prova** (`tests/regole/casi.test.ts`), esiti attesi:

| # | Caso | Atteso |
|---|---|---|
| 1 | Filtro antispam | `minimo` |
| 2 | Chatbot clienti di terzi (deployer) | `minimo` + trasparenza |
| 3 | Screening CV, deployer | `alto_rischio`, art. 26, 86 |
| 4 | Screening CV rivenduto col proprio marchio | `alto_rischio`, ruolo fornitore |
| 5 | Scoring creditizio, banca deployer | `alto_rischio` + art. 27 |
| 6 | Riconoscimento emozioni dipendenti | `vietato` |
| 7 | All. III, compito procedurale ristretto, senza profilazione | `non_alto_rischio_deroga` |
| 8 | Come 7 con profilazione | `alto_rischio` |
| 9 | Generatore di immagini sintetiche | `minimo` + trasparenza |
| 10 | Uso personale non professionale | `fuori_ambito` |
| 11 | "Non so" sull'area All. III determinante | `da_approfondire` |
| 12 | Componente di sicurezza di macchinario | `alto_rischio`, dal 02/08/2028 |

- Validazione del file regole (id, riferimenti, cicli, date, stato) e test negativi con file
  malformati.
- Motore: `mostraSe`, Non so determinante / non determinante, obblighi per ruolo e data,
  ruolo `da_definire`.
- Archivio: migrazione 2 su DB della Fase 1 senza perdita, copia fissa dell'esito,
  "da rivedere", storico, cestino a cascata.
- UI: questionario ripreso a metà, conferma, modifica con nota obbligatoria, tappe 3–4.
- E2E: cliente → sistema → questionario → esito → conferma → roadmap 80%.

## 9. Ordine di lavoro

1. Verifica sul testo ufficiale del Reg. 2026/1744 (GU) delle date del §2 e dei punti
   `da_verificare`; aggiornamento di questa spec.
2. Bozza `regole/ai-act.json` + tabella di revisione.
3. Motore, archivio, interfaccia, roadmap (piano di implementazione separato).
4. Validazione delle regole da parte dell'utente: l'avviso resta finché anche una voce
   usata non è `validata`.

## 10. Limiti

- Le regole sono uno strumento di supporto: la classificazione finale è del consulente
  (conferma o modifica).
- Contenuto giuridico non validato fino al §9 punto 4.
