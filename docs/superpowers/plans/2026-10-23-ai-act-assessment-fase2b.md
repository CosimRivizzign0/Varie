# AI Act Assessment — Fase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Report Word per sistema ed Excel per cliente, impostazioni dello studio, registro dei report e tappa 5 della roadmap.

**Architecture:** Funzioni pure costruiscono i dati dei report; due generatori (`docx`, `exceljs`) producono `Uint8Array`; un modulo di salvataggio scrive su disco via comando Rust atomico (Tauri) o download Blob (web). Migrazione 3 aggiunge `impostazioni` e `report`.

**Tech Stack:** Fase 2 + `docx` 9.14.0, `exceljs` 4.4.0, dev `jszip` 3.10.2 (tutti esatti).

**Spec:** `docs/superpowers/specs/2026-10-23-ai-act-assessment-fase2b-design.md`

## Global Constraints

- Testi esatti dalla spec §2–5 (avviso regole, nota di riserva, `Non incluso: classificazione non confermata`, `Assessment completato`, `Genera i report aggiornati`).
- Date nei documenti `gg/mm/aaaa`; timestamp in ora locale, date `YYYY-MM-DD` senza fuso (riusare `src/ui/formatoData.ts` o spostarlo in `src/domain/` se serve fuori UI).
- Nessuna rete a runtime; versioni esatte; ogni scrittura DB in un batch con `attivita` di tipo `modificato`.
- Nomi file ripuliti (spec §2).

## Review Focus

1. **Ragione sociale o nome sistema con `/ \ : * ? " < > |` o molto lunghi** → nome file valido su Windows. Test Task 2.
2. **Cliente con sistemi non confermati** → esclusi dal Word, presenti nell'inventario con il loro stato. Test Task 2.
3. **Nuova conferma dopo i report** → tappa 5 torna non completata con `Genera i report aggiornati`. Test Task 6.
4. **Testi con apostrofi/accenti/emoji** → identici nel `.docx` e nel `.xlsx`. Test Task 3–4.
5. **Impostazioni studio vuote** → report senza intestazione, nessun errore. Test Task 3.

---

### Task 1: Migrazione 3, impostazioni e registro report

**Files:** Modify `src/archivio/migrazioni.ts`, `src/archivio/repository.ts`; Create `src/domain/report.ts` · Test `tests/archivio/repositoryReport.test.ts`, `tests/archivio/migrazioni.test.ts`

**Interfaces — Produces:**
- `ImpostazioniStudio { nome; indirizzo; piva; email; telefono }` (stringhe, vuote se assenti) in `src/domain/report.ts`
- `RegistroReport { id; clienteId; sistemaId: string | null; valutazioneId: string | null; tipo: 'word' | 'excel'; nomeFile; creatoIl }`
- Repository: `getImpostazioniStudio(): Promise<ImpostazioniStudio>`, `salvaImpostazioniStudio(i: ImpostazioniStudio): Promise<void>` (trim; nessuna attività), `registraReport(r: Omit<RegistroReport, 'id' | 'creatoIl'>): Promise<RegistroReport>` (attività spec §4), `elencaReport(clienteId): Promise<RegistroReport[]>` (più recente prima)
- Cascata: `eliminaDefinitivamente` e `svuotaCestinoScaduto` cancellano le righe `report`.

- [ ] Test che falliscono: migrazione da v2 con dati → v3 intatta; impostazioni salvate e rilette (incluso `L'Officina ✓`), vuote di default; registraReport + elenca; cascata senza errori FK.
- [ ] `npm test` → FAIL; implementa; → PASS + tsc.
- [ ] Commit `feat(ai-act-app): impostazioni studio e registro report`.

### Task 2: Dati dei report e nomi file

**Files:** Create `src/report/dati.ts`, `src/report/nomiFile.ts` · Test `tests/report/dati.test.ts`, `tests/report/nomiFile.test.ts`

**Interfaces — Produces:**
- `DatiReportSistema { studio: ImpostazioniStudio; cliente: Cliente; sistema: SistemaAI; ruoloEtichetta; ruoloEffettivoEtichetta; classe: Classe; classeCalcolata: Classe | null /* se modificata */; notaModifica: string | null; trasparenza: boolean; applicabileDal: string | null; motivazione; aperte: string[] /* testi */; obblighi; regoleNonValidate: boolean; confermatoIl: string; versioneRegole; norma }`
- `datiReportSistema(studio, cliente, sistema, valutazione: Valutazione, regole: FileRegole | null): DatiReportSistema` — lancia `Error('Valutazione non confermata')` se `stato !== 'confermata'`
- `RigaInventario`, `RigaObbligo`, `DatiInventario { studio; cliente; righe: RigaInventario[]; obblighi: RigaObbligo[] }`
- `datiInventario(studio, cliente, sistemi: SistemaAI[], attive: (Valutazione | null)[], versioneCorrente: string): DatiInventario`
- `nomeFileWord(cliente, sistema, oggi: Date): string`, `nomeFileExcel(cliente, oggi: Date): string`, `ripulisci(s: string): string`

- [ ] Test che falliscono: classe modificata → `classe` del consulente e `classeCalcolata`; non confermata → errore; inventario con sistema senza valutazione (stato `Non avviata`) e obblighi solo dei confermati ordinati per data poi sistema; Review Focus #1 (`A/B:C*"x"` → nessun carattere vietato, ≤ 80 per parte, estensione corretta), #2.
- [ ] FAIL → implementa → PASS → commit `feat(ai-act-app): dati dei report e nomi file`.

### Task 3: Generatore Word

**Files:** Create `src/report/word.ts` · Test `tests/report/word.test.ts` · deps `docx` 9.14.0, dev `jszip` 3.10.2

**Interfaces — Produces:** `creaWord(d: DatiReportSistema): Promise<Uint8Array>` (contenuto e ordine spec §2; tabella obblighi con intestazione; avviso riquadrato in grassetto; font predefinito Calibri 11).

- [ ] Test (apre il risultato con jszip, legge `word/document.xml`, normalizza il testo): titolo, avviso solo se `regoleNonValidate`, righe obblighi, nota di riserva, `Classe calcolata:` solo se modificata, Review Focus #4 e #5 (studio vuoto → nessuna intestazione, nessun errore).
- [ ] FAIL → implementa → PASS → commit `feat(ai-act-app): report Word per sistema`.

### Task 4: Generatore Excel

**Files:** Create `src/report/excel.ts` · Test `tests/report/excel.test.ts` · dep `exceljs` 4.4.0

**Interfaces — Produces:** `creaExcel(d: DatiInventario): Promise<Uint8Array>` (fogli e colonne spec §2; intestazione grassetto, `views` frozen ySplit 1, `autoFilter`, date come `Date` con `numFmt 'dd/mm/yyyy'`).

- [ ] Test (rilegge con exceljs): nomi fogli, intestazioni esatte, numero righe, cella data è `Date`, autoFilter presente, Review Focus #4.
- [ ] FAIL → implementa → PASS → commit `feat(ai-act-app): inventario Excel per cliente`.

### Task 5: Salvataggio file (Rust + TS)

**Files:** Modify `src-tauri/store/src/lib.rs`, `src-tauri/src/comandi.rs`, `src-tauri/src/main.rs`; Create `src/archivio/salvaFile.ts` · Test Rust nel crate, `tests/archivio/salvaFile.test.ts`

**Interfaces — Produces:**
- Rust: `pub fn scrivi_file_atomico(percorso: &Path, contenuto: &[u8]) -> Result<()>` (tmp nella stessa cartella + rename; rimuove il tmp su errore); comando `scrivi_file { percorso: PathBuf, contenuto: Vec<u8> }`.
- TS: `scegliCartella(): Promise<string | null>` (Tauri: `open({ directory: true })`; web: `''` che significa "download"), `salvaInCartella(cartella: string, nome: string, byte: Uint8Array): Promise<string>` (Tauri: `invoke('scrivi_file', { percorso: join, contenuto: Array.from(byte) })`; web: Blob + `<a download>`), `salvaConNome(nome, byte): Promise<string | null>` (Tauri `save`; web download). `join` con il separatore del percorso scelto (`\` se contiene `\`).

- [ ] Test Rust: scrittura, sovrascrittura, nessun tmp residuo su errore (cartella inesistente). Test TS con `invoke` e dialog mockati: argomenti corretti, join Windows/macOS, ramo web chiama `URL.createObjectURL`.
- [ ] `cargo test -p ai-act-store` + `npm test` → PASS → commit `feat(ai-act-app): salvataggio dei report su disco`.

### Task 6: Tappa 5 della roadmap

**Files:** Modify `src/domain/roadmap.ts`, `src/domain/valutazione.ts`, chiamanti in `Dashboard.tsx`, `SchedaCliente.tsx` · Test `tests/domain/roadmap.test.ts`

**Interfaces — Produces:** `SintesiValutazione` estesa con `valutazioneId: string | null`, `confermatoIl: string | null`; `calcolaRoadmap(cliente, sistemi, oggi, valutazioni, report: RegistroReport[])`. Regole spec §5; dettaglio tappa 5 `"N di M report"` (singolare per M=1); tappa 5 non più `bloccata`.

- [ ] Test: tutto confermato e report aggiornati → 100% e `Assessment completato`; conferma successiva all'ultimo Word → `Genera i report aggiornati` (Review Focus #3); manca solo l'Excel → non completata; 0 sistemi → non completata. Aggiorna test esistenti.
- [ ] FAIL → implementa → PASS → commit `feat(ai-act-app): tappa report nella roadmap`.

### Task 7: UI

**Files:** Create `src/ui/pagine/Impostazioni.tsx`; Modify `App.tsx` (rotta `/impostazioni`), `Dashboard.tsx` (link `Impostazioni`), `SchedaCliente.tsx` (pulsante `Genera report`, sezione `Report generati`), `EsitoValutazione.tsx` (pulsante `Esporta Word` se confermata) · Test `tests/ui/Impostazioni.test.tsx`, `tests/ui/Report.test.tsx`

Flusso `Genera report`: `scegliCartella` (annullato → niente); per ogni sistema attivo con valutazione confermata `datiReportSistema` → `creaWord` → `salvaInCartella` → `registraReport`; poi Excel; doppio clic bloccato; elenco finale `File creati:` con i nomi e, per gli esclusi, `«<sistema>»: Non incluso: classificazione non confermata`; errori in `role="alert"` (i file già scritti restano registrati).

- [ ] Test (moduli `word`/`excel`/`salvaFile` mockati dove serve, repo reale): impostazioni salvate; genera report con 1 confermato + 1 non confermato → 2 file (1 Word + 1 Excel), esclusione mostrata, 2 righe registro, roadmap aggiornata; Esporta Word dalla pagina esito.
- [ ] FAIL → implementa → PASS → commit `feat(ai-act-app): generazione report dall'interfaccia`.

### Task 8: E2E e documentazione

- [ ] E2E (anteprima web): dopo il flusso valutazione confermata, `Genera report` → Playwright `page.waitForEvent('download')` ×2 con nomi `.docx` e `.xlsx`; Dashboard `100%` e `Assessment completato`.
- [ ] README (sezione Report) e checklist (generare report sull'installer, aprirli in Word/Excel).
- [ ] `CI=true CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e` → PASS; commit `test(ai-act-app): e2e report e documentazione`.
