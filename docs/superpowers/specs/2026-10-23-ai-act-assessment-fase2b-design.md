# AI Act Assessment — Fase 2b: Report Word ed Excel — Design

- **Data:** 2026-10-23 · **Stato:** in revisione · **Dipende da:** Fase 1 e Fase 2

## 1. Obiettivo e decisioni dell'utente

Generare i documenti da consegnare al cliente:

- **Word**: un `.docx` **per sistema AI** con valutazione confermata.
- **Excel**: un `.xlsx` **per cliente** con l'inventario e gli obblighi.
- **Intestazione**: dati dello studio inseriti in una schermata *Impostazioni* (nome, indirizzo, P.IVA, email, telefono). Nessun logo.
- **Regole non validate**: l'export procede, ma il documento riporta l'avviso in evidenza.

Escluso: PDF, logo, modelli Word personalizzabili, invio email.

## 2. Contenuto

### Word (per sistema)

1. Intestazione: dati dello studio (se presenti).
2. Titolo `Valutazione AI Act — <nome sistema>` e sottotitolo `<ragione sociale>`.
3. **Avviso** (se `vociNonValidate > 0`), in grassetto e riquadrato:
   `Documento basato su regole non ancora validate dal consulente: verificare prima della consegna.`
4. Dati del cliente: ragione sociale, P.IVA, settore, referente.
5. Dati del sistema: nome, fornitore, scopo d'uso, reparto, data di avvio, ruolo del cliente (etichetta `RUOLI`) e ruolo effettivo.
6. **Classificazione**: classe (quella del consulente se modificata, con `Classe calcolata: …` e motivo della modifica), `+ obblighi di trasparenza` se il flag è attivo, `Applicabile dal gg/mm/aaaa`.
7. **Motivazione**: elenco testo — riferimento.
8. **Punti da approfondire** (se presenti).
9. **Obblighi**: tabella con le colonne Obbligo | Riferimento | Dal. Se la classe è stata modificata, vi si aggiunge la nota della Fase 2.
10. Chiusura: `Valutazione confermata il gg/mm/aaaa · Regole v<versione> · <norma>`, seguita dalla nota di riserva fissa:
    `Il presente documento è uno strumento di supporto alla valutazione di conformità al Regolamento (UE) 2024/1689 e non costituisce parere legale definitivo.`

### Excel (per cliente)

- **Foglio `Inventario`**, una riga per ogni sistema attivo. Colonne: Sistema, Fornitore, Scopo, Reparto, Ruolo cliente, Classe, Trasparenza (Sì/No), Stato valutazione, Data conferma, Applicabile dal, N. obblighi, Da rivedere (Sì/No).
- **Foglio `Obblighi`**, una riga per ogni obbligo dei sistemi con valutazione confermata. Colonne: Sistema, Obbligo, Riferimento, Dal. Ordinamento: per data, poi per sistema.
- Riga di intestazione in grassetto e bloccata, filtro automatico, date come vere celle data nel formato `dd/mm/yyyy`.

### Nomi dei file

- `AI-Act_<cliente>_<sistema>_<aaaa-mm-gg>.docx`
- `AI-Act_<cliente>_inventario_<aaaa-mm-gg>.xlsx`

I nomi sono ripuliti: niente caratteri vietati da Windows o macOS, spazi sostituiti con `-`, al massimo 80 caratteri per parte.

## 3. Flusso

- **Scheda cliente**: pulsante `Genera report`. Si sceglie una cartella, poi l'app scrive un Word per ogni sistema con valutazione confermata e l'Excel del cliente. Al termine mostra l'elenco dei file creati. I sistemi senza valutazione confermata vengono saltati e sono elencati con l'avviso `Non incluso: classificazione non confermata`.
- **Pagina esito** (valutazione confermata): pulsante `Esporta Word` per il singolo sistema, con finestra "Salva con nome".
- **Anteprima web**: nessuna finestra di dialogo. Ogni file viene scaricato dal browser.
- **File già esistente**: viene sovrascritto (stesso nome, stesso giorno). La scrittura usa un file temporaneo seguito da una rinomina.

## 4. Dati

Migrazione 3:

- `impostazioni(chiave TEXT PK, valore TEXT NOT NULL)`, con le chiavi `studio_nome`, `studio_indirizzo`, `studio_piva`, `studio_email`, `studio_telefono`.
- `report(id PK, cliente_id NOT NULL, sistema_id NULL, valutazione_id NULL, tipo CHECK IN ('word','excel'), nome_file NOT NULL, creato_il NOT NULL)`. Il registro serve all'avanzamento della tappa 5 e alla sezione "Report generati" della scheda cliente.
- Attività: tipo `modificato`, con le descrizioni `Report Word di «<sistema>» generato` e `Inventario Excel generato`.
- Cancellazioni: l'eliminazione definitiva e lo svuotamento del cestino cancellano anche le righe `report` del cliente o del sistema.

## 5. Roadmap: tappa 5

La tappa 5 `Report` diventa attiva. È **completata** quando valgono tutte e tre le condizioni:
- la tappa 4 è completata;
- ogni sistema attivo ha un report Word con `valutazione_id` uguale alla sua valutazione attiva e `creato_il` non anteriore alla conferma;
- esiste un Excel del cliente con `creato_il` non anteriore all'ultima conferma.

Con la tappa 5 completata l'avanzamento è del 100% e la prossima azione diventa `Assessment completato`. Se una conferma è più recente dell'ultimo report, la prossima azione è `Genera i report aggiornati`.

## 6. Architettura

| Unità | Responsabilità |
|---|---|
| `src/report/dati.ts` | funzioni pure che costruiscono `DatiReportSistema` e `DatiInventario` a partire da cliente, sistemi, valutazioni e impostazioni |
| `src/report/word.ts` | `creaWord(dati): Promise<Uint8Array>` con la libreria `docx` |
| `src/report/excel.ts` | `creaExcel(dati): Promise<Uint8Array>` con `exceljs` |
| `src/report/nomiFile.ts` | nomi dei file ripuliti |
| `src/archivio/salvaFile.ts` | Tauri: `scrivi_file` (Rust, scrittura atomica); web: download con Blob |
| crate `ai-act-store` | `scrivi_file_atomico(percorso, byte)` testato |
| UI | `Impostazioni.tsx`, pulsanti nella scheda cliente e nella pagina esito, sezione "Report generati" |

Tutto avviene sul computer, senza rete. Le librerie vengono incluse nell'app al momento della compilazione.

## 7. Test

- **Dati**: contenuto con classe modificata, con regole non validate, con punti aperti, con sistemi non confermati esclusi.
- **Word**: il `.docx` generato viene aperto con `jszip`, che legge `word/document.xml`. Si verificano titolo, avviso, tabella degli obblighi e caratteri speciali (`L'Officina ✓`).
- **Excel**: il file generato viene riletto con `exceljs`. Si verificano fogli, intestazioni, numero di righe, date come celle data e filtro automatico.
- **Nomi dei file**: caratteri vietati, nomi lunghi, accenti.
- **Rust**: scrittura atomica e sovrascrittura.
- **Archivio**: migrazione 3 senza perdita di dati, registro dei report, cancellazioni a cascata.
- **Roadmap**: 100%, report obsoleti dopo una nuova conferma, 0 sistemi.
- **UI**: impostazioni salvate e rilette, "Genera report" con sistemi esclusi, "Esporta Word".
- **E2E**: dalla valutazione confermata a "Genera report" (download nell'anteprima web), con verifica che la roadmap arrivi al 100%.
