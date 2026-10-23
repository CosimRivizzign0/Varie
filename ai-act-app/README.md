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

## Dove sono i dati

Nella cartella dati dell'app, identificativo `com.cosimorivizzigno.aiactassessment`:
- Windows: `%APPDATA%\com.cosimorivizzigno.aiactassessment`
- macOS: `~/Library/Application Support/com.cosimorivizzigno.aiactassessment`

I backup automatici sono nella sottocartella `backup/`.

## Installer e prova manuale

La CI (`.github/workflows/ai-act-app.yml`) esegue i test e produce gli installer Windows e macOS come artifact. Per verificarli: [checklist di prova](../docs/ai-act-app/checklist-installer.md).

## Roadmap

Fase 1 (questa): anagrafica, inventario sistemi e roadmap; le fasi successive aggiungeranno la valutazione di rischio e i documenti.
