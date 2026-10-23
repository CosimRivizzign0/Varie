# AI Act Assessment

App desktop (Tauri + React + TypeScript) per gestire l'assessment AI Act dei clienti di uno studio: anagrafica clienti, inventario dei sistemi di IA, roadmap degli adempimenti, cestino e backup. I dati restano in locale, in un database SQLite sul computer.

## Sviluppo

Requisiti: Node >= 22.12, Rust stabile.

```bash
npm install
npm run dev          # interfaccia nel browser (database in memoria, solo prova)
npm test             # test unitari e di interfaccia (Vitest)
npm run e2e          # test end-to-end (Playwright)
cargo test -p ai-act-store   # dalla cartella src-tauri
npm run tauri dev    # app desktop completa
```

Note:
- `npm run e2e`: se Chromium di Playwright non e' installato, usa `npx playwright install chromium` oppure imposta `CHROMIUM_PATH` con il percorso di un Chromium esistente.
- `npm run tauri dev` su Linux richiede WebKitGTK (e le altre dipendenze di Tauri).

## Regole AI Act

Le regole di classificazione (domande del questionario, esiti, obblighi, date di applicazione) sono nel file `regole/ai-act.json`, validato all'avvio. Se il file non e' valido, il questionario mostra un avviso al posto delle domande.

- **Versione**: `meta.versione` (es. `1.0.0`). Ogni valutazione salva la versione delle regole con cui e' stata compilata.
- **Stato di ogni voce** (campo `stato`): `bozza` (scritta, non ancora controllata), `validata` (revisionata e approvata) o `da_verificare` (norma incerta o in evoluzione). Se l'esito dipende da voci non `validata`, l'app lo segnala con l'avviso «Regole non ancora validate».
- **Revisione**: `npm run regole:revisione` genera `docs/ai-act-app/revisione-regole.md`, la tabella delle voci con riferimento normativo, condizioni e stato, da far rivedere e correggere nel JSON.
- **Cambio di versione**: quando si modifica `meta.versione`, le valutazioni compilate con una versione diversa mostrano il badge **Da rivedere** nella scheda del sistema: restano consultabili, e si puo' avviare una nuova valutazione con le regole aggiornate (la precedente resta nello storico).

## Report

- **Impostazioni studio**: nome, indirizzo, partita IVA, email e telefono dello studio (menu **Impostazioni**) compaiono nell'intestazione dei report.
- **Genera report** (scheda cliente): si sceglie una cartella e l'app scrive un Word per ogni sistema con valutazione confermata e un Excel di inventario per il cliente, poi elenca i file creati. I sistemi senza classificazione confermata sono esclusi e indicati con «Non incluso: classificazione non confermata».
- **Nomi dei file**: `AI-Act_<cliente>_<sistema>_<aaaa-mm-gg>.docx` e `AI-Act_<cliente>_inventario_<aaaa-mm-gg>.xlsx`, ripuliti da caratteri non validi su Windows e macOS (spazi come `-`, al massimo 80 caratteri per parte). Rigenerando lo stesso giorno i file vengono sovrascritti.
- **Excel**: fogli `Inventario` (un sistema per riga) e `Obblighi` (solo sistemi con valutazione confermata), date come vere celle data.
- **Esporta Word**: dalla pagina esito di una valutazione confermata si esporta il Word del singolo sistema, con «Salva con nome».
- **Regole non validate**: se l'esito dipende da voci non `validata`, il Word riporta in evidenza l'avviso «Documento basato su regole non ancora validate dal consulente: verificare prima della consegna.». Ogni Word termina con la nota di riserva (strumento di supporto, non parere legale).
- **Anteprima web** (`npm run dev`): nessuna finestra di dialogo, i file vengono scaricati dal browser.
- La roadmap arriva al 100% («Assessment completato») quando i report sono generati e aggiornati.

## Dove sono i dati

Nella cartella dati dell'app, identificativo `com.cosimorivizzigno.aiactassessment`:
- Windows: `%APPDATA%\com.cosimorivizzigno.aiactassessment`
- macOS: `~/Library/Application Support/com.cosimorivizzigno.aiactassessment`

I backup automatici sono nella sottocartella `backup/`.

## Installer e prova manuale

La CI (`.github/workflows/ai-act-app.yml`) esegue i test e produce gli installer Windows e macOS come artifact. Per verificarli: [checklist di prova](../docs/ai-act-app/checklist-installer.md).

## Roadmap

Fase 1: anagrafica, inventario sistemi e roadmap. Fase 2a: valutazione di rischio. Fase 2b (questa): report Word ed Excel.
