# AI Act Assessment — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App desktop Tauri (Windows + macOS) con registro clienti/sistemi AI, roadmap a 5 tappe per cliente, dati SQLite locali con backup e cestino.

**Architecture:** Dominio in TypeScript puro (validazione zod, calcolo roadmap) → Repository TS che parla a un'interfaccia `SqlDriver` → due driver: `sql.js` (test + anteprima web) e Tauri (comandi Rust su `rusqlite`, una sola connessione, batch atomici). La logica Rust di database/backup sta in un crate separato `ai-act-store` testabile senza WebKit.

**Tech Stack:** Tauri 2 · React 19 · TypeScript · Vite 8 · Vitest 5 · zod 4 · React Router 7 · sql.js 1.15 · Playwright 1.64 · Rust 1.97 + rusqlite (bundled) · GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-22-ai-act-assessment-fase1-design.md`

## Global Constraints

- Codice in `ai-act-app/`. Interfaccia e messaggi in italiano; nomi di dominio come nella spec (`ragioneSociale`, `partitaIva`, `inventarioConfermato`, …).
- Piattaforme: Windows e macOS. Nessuna rete a runtime, nessuna telemetria.
- File dati: `ai-act.db` nella `app_data_dir` di Tauri; backup in `<app_data_dir>/backup/`, ultime **10** copie.
- Cestino: eliminazione logica, svuotamento automatico oltre **30** giorni.
- Roadmap: 5 tappe, **20%** ciascuna; tappe 3–5 `bloccata` con etichetta `disponibile dalla Fase 2`.
- Ogni scrittura (incluso il log attività) è un unico batch atomico.
- SQL sempre con parametri vincolati, mai concatenazione di stringhe.
- `productName`: `AI Act Assessment`; `identifier`: `com.cosimorivizzigno.aiactassessment`.

**Deviazione dalla spec (da approvare):** la spec cita `tauri-plugin-sql`. Il plugin usa un pool di connessioni sqlx, quindi `BEGIN`/`COMMIT` inviati con chiamate separate possono finire su connessioni diverse e non garantiscono l'atomicità richiesta dal §7. Il piano usa invece due comandi Rust propri (`db_select`, `db_batch`) su una connessione `rusqlite` unica protetta da mutex.

## Review Focus

1. **P.IVA incollata con spazi o prefisso "IT"** (`IT 00488410010`) → va normalizzata a 11 cifre e accettata, non rifiutata. Test in Task 1.
2. **Ripristino dal cestino di un cliente la cui P.IVA è ora usata da un altro cliente attivo** → errore chiaro `ErrorePartitaIvaDuplicata`, nessun dato modificato. Test in Task 5.
3. **Testi con apostrofi, accenti, emoji** (`L'Officina Società ✓`) → salvati e riletti identici. Test in Task 5.
4. **Ripristino da un file che non è un database valido** → rifiutato, database corrente intatto. Test in Task 9.
5. **Doppio clic su "Salva"** → un solo record creato (pulsante disabilitato durante il salvataggio). Test in Task 7.

---

## File Structure

```
ai-act-app/
  package.json, vite.config.ts, vitest.config.ts, tsconfig.json, index.html, playwright.config.ts
  src/
    domain/
      tipi.ts            tipi Cliente, SistemaAI, Attivita, input, enum
      partitaIva.ts      normalizzaPartitaIva, validaPartitaIva
      cliente.ts         schema zod + validaCliente
      sistema.ts         schema zod + validaSistema
      roadmap.ts         calcolaRoadmap
      cestino.ts         GIORNI_CESTINO, isScaduto
    archivio/
      driver.ts          interfaccia SqlDriver
      sqljsDriver.ts     driver sql.js
      tauriDriver.ts     driver via invoke
      migrazioni.ts      MIGRAZIONI, migra
      errori.ts          classi di errore
      repository.ts      creaRepository
      avvio.ts           creaDriver (sceglie il driver)
    ui/
      App.tsx, RepositoryContext.tsx
      componenti/RoadmapBar.tsx, Campo.tsx
      pagine/Dashboard.tsx, SchedaCliente.tsx, SchedaSistema.tsx, Cestino.tsx, ErroreAvvio.tsx
    main.tsx
  tests/ (unit, mirror di src/)  e2e/flusso.spec.ts
  src-tauri/
    Cargo.toml (workspace: app + store)
    store/  Cargo.toml, src/lib.rs        crate ai-act-store
    src/main.rs, src/comandi.rs, tauri.conf.json, capabilities/default.json
docs/ai-act-app/checklist-installer.md
.github/workflows/ai-act-app.yml
```

---

### Task 1: Scaffold + Partita IVA

**Files:**
- Create: `ai-act-app/` (Vite React TS, Vitest), `ai-act-app/src/domain/partitaIva.ts`
- Test: `ai-act-app/tests/domain/partitaIva.test.ts`

**Interfaces:**
- Produces: `normalizzaPartitaIva(raw: string): string` (rimuove spazi, punti, trattini e prefisso `IT` case-insensitive); `validaPartitaIva(raw: string): boolean` (normalizza, poi 11 cifre + cifra di controllo, spec §3.4).

- [ ] **Step 1:** Scaffold con `npm create vite@latest ai-act-app -- --template react-ts`; aggiungi `vitest`, script `"test": "vitest run"`. Fissa le versioni esatte in `package.json` (nessun `^`).
- [ ] **Step 2: Test che fallisce**

```ts
test.each(['00488410010', '00905811006', 'IT 00488410010', ' 004 884 100 10 ', 'it00488410010'])('valida %s', p => expect(validaPartitaIva(p)).toBe(true));
test.each(['12345678901', '0048841001', '004884100100', 'ABCDEFGHIJK', ''])('rifiuta %s', p => expect(validaPartitaIva(p)).toBe(false));
test('normalizza', () => expect(normalizzaPartitaIva('IT 004.884-100 10')).toBe('00488410010'));
```

- [ ] **Step 3:** `npm test` → FAIL (modulo inesistente).
- [ ] **Step 4:** Implementa in `src/domain/partitaIva.ts`.
- [ ] **Step 5:** `npm test` → PASS. `npx tsc --noEmit` → 0 errori.
- [ ] **Step 6:** Commit `feat(ai-act-app): scaffold e validazione Partita IVA`.

### Task 2: Tipi e validazione Cliente / Sistema AI

**Files:**
- Create: `src/domain/tipi.ts`, `src/domain/cliente.ts`, `src/domain/sistema.ts`
- Test: `tests/domain/cliente.test.ts`, `tests/domain/sistema.test.ts`

**Interfaces:**
- Consumes: `normalizzaPartitaIva`, `validaPartitaIva`.
- Produces:
  - `type RuoloCliente = 'fornitore' | 'deployer' | 'importatore' | 'distributore' | 'da_definire'`; `RUOLI: Record<RuoloCliente, string>` con le etichette (`'Fornitore'`, `'Deployer (utilizzatore)'`, `'Importatore'`, `'Distributore'`, `'Da definire'`).
  - `ClienteInput { ragioneSociale; partitaIva; settore; referenteNome; referenteEmail: string | null; note: string | null; aiLiteracyDocumentata: boolean; aiLiteracyData: string | null /* YYYY-MM-DD */ }`
  - `Cliente = ClienteInput & { id; inventarioConfermato: boolean; creatoIl; modificatoIl: string /* ISO */; eliminatoIl: string | null }`
  - `SistemaInput { nome; fornitore; scopo; reparto: string | null; dataAvvio: string | null; ruoloCliente: RuoloCliente }`
  - `SistemaAI = SistemaInput & { id; clienteId; creatoIl; modificatoIl; eliminatoIl: string | null }`
  - `TipoAttivita = 'creato' | 'modificato' | 'eliminato' | 'ripristinato' | 'inventario_confermato'`; `Attivita { id; clienteId; sistemaId: string | null; tipo: TipoAttivita; descrizione: string; quando: string }`
  - `type Esito<T> = { ok: true; valore: T } | { ok: false; errori: Partial<Record<keyof T, string>> }`
  - `validaCliente(input: unknown, oggi: Date): Esito<ClienteInput>`, `validaSistema(input: unknown): Esito<SistemaInput>`. Trim su tutti i testi; stringhe vuote dei campi opzionali → `null`; `partitaIva` restituita normalizzata.

- [ ] **Step 1: Test che falliscono** — un caso valido per ciascuno, poi un test per ogni messaggio (copia esatta):

| Campo | Input non valido | Messaggio |
|---|---|---|
| ragioneSociale | `'A'`, 201 caratteri | `Inserisci la ragione sociale (2–200 caratteri)` |
| partitaIva | `'12345678901'` | `Partita IVA non valida` |
| settore | `'  '` | `Inserisci il settore` |
| referenteNome | `''` | `Inserisci il nome del referente` |
| referenteEmail | `'mario@'` | `Email non valida` |
| aiLiteracyData | domani rispetto a `oggi` | `La data non può essere futura` |
| nome (sistema) | `'X'` | `Inserisci il nome del sistema (2–200 caratteri)` |
| fornitore | `''` | `Inserisci il fornitore` |
| scopo | `''` | `Descrivi lo scopo d'uso` |
| ruoloCliente | `'altro'` | `Seleziona il ruolo del cliente` |

  Più: `referenteEmail: ''` → `valore.referenteEmail === null`; `partitaIva: 'IT 00488410010'` → `valore.partitaIva === '00488410010'`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa con zod (`safeParse`, mappatura `issues` → primo messaggio per campo).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): modello dati e validazione`.

### Task 3: Calcolo roadmap e cestino

**Files:**
- Create: `src/domain/roadmap.ts`, `src/domain/cestino.ts`
- Test: `tests/domain/roadmap.test.ts`, `tests/domain/cestino.test.ts`

**Interfaces:**
- Consumes: `Cliente`, `SistemaAI`, `validaCliente`.
- Produces:
  - `type IdTappa = 'anagrafica' | 'inventario' | 'questionario' | 'classificazione' | 'report'`
  - `Tappa { id: IdTappa; etichetta: string; stato: 'completata' | 'in_corso' | 'da_fare' | 'bloccata'; dettaglio: string | null }`
  - `Roadmap { tappe: Tappa[] /* sempre 5, in ordine */; percentuale: number; prossimaAzione: string }`
  - `calcolaRoadmap(cliente: Cliente, sistemiAttivi: SistemaAI[], oggi: Date): Roadmap`
  - `GIORNI_CESTINO = 30`; `isScaduto(eliminatoIl: string, ora: Date): boolean` (vero se sono passati **più** di 30 giorni).

Regole (spec §4): etichette `Anagrafica`, `Inventario`, `Questionario`, `Classificazione`, `Report`. Tappe 3–5 sempre `bloccata` con `dettaglio: 'disponibile dalla Fase 2'`. La prima tappa non completata e non bloccata è `in_corso`, le successive non bloccate `da_fare`. `dettaglio` dell'inventario: `'N sistemi'` / `'1 sistema'`.

Testi `prossimaAzione` (copia esatta):
- anagrafica non valida → `Completa l'anagrafica: manca ` + il primo campo non valido tra `la ragione sociale`, `la Partita IVA`, `il settore`, `il referente`
- 0 sistemi → `Aggiungi il primo sistema AI`
- sistemi > 0, non confermato → `Conferma l'inventario (3 sistemi)` / `(1 sistema)`
- tappe 1–2 completate → `In attesa della Fase 2`

- [ ] **Step 1: Test che falliscono**
  - cliente valido, 0 sistemi → `percentuale 20`, tappe `[completata, in_corso, bloccata, bloccata, bloccata]`, `prossimaAzione 'Aggiungi il primo sistema AI'`
  - 3 sistemi, non confermato → `20`, `'Conferma l\'inventario (3 sistemi)'`, inventario `dettaglio '3 sistemi'`
  - 1 sistema non confermato → `'Conferma l\'inventario (1 sistema)'`
  - 2 sistemi, confermato → `40`, `'In attesa della Fase 2'`
  - confermato ma 0 sistemi attivi → inventario non completata (`20`)
  - settore vuoto → `0`, anagrafica `in_corso`, `'Completa l\'anagrafica: manca il settore'`
  - `isScaduto`: 30 giorni esatti → `false`; 30 giorni + 1 ms → `true`
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): calcolo roadmap e scadenza cestino`.

### Task 4: SqlDriver, driver sql.js, migrazioni

**Files:**
- Create: `src/archivio/driver.ts`, `src/archivio/sqljsDriver.ts`, `src/archivio/migrazioni.ts`
- Test: `tests/archivio/sqljsDriver.test.ts`, `tests/archivio/migrazioni.test.ts`

**Interfaces:**
- Produces:
  - `type Parametro = string | number | null`; `interface Istruzione { sql: string; params?: Parametro[] }`
  - `interface SqlDriver { select<T = Record<string, Parametro>>(sql: string, params?: Parametro[]): Promise<T[]>; batch(istruzioni: Istruzione[]): Promise<void> /* atomico: tutto o niente */ }`
  - `creaSqlJsDriver(opzioni?: { wasmUrl?: string }): Promise<SqlDriver>` (database in memoria)
  - `MIGRAZIONI: Istruzione[][]` (indice 0 = versione 1); `migra(driver: SqlDriver): Promise<number>` legge `PRAGMA user_version`, applica in un batch ciascuna migrazione mancante insieme a `PRAGMA user_version = N`, restituisce la versione finale.

Migrazione 1 (snake_case):
- `clienti(id TEXT PK, ragione_sociale, partita_iva, settore, referente_nome TEXT NOT NULL, referente_email, note, ai_literacy_data TEXT NULL, ai_literacy_documentata INTEGER NOT NULL DEFAULT 0, inventario_confermato INTEGER NOT NULL DEFAULT 0, creato_il, modificato_il TEXT NOT NULL, eliminato_il TEXT NULL)`
- `CREATE UNIQUE INDEX ux_clienti_piva_attivi ON clienti(partita_iva) WHERE eliminato_il IS NULL`
- `sistemi(id PK, cliente_id REFERENCES clienti(id), nome, fornitore, scopo, ruolo_cliente NOT NULL, reparto, data_avvio NULL, creato_il, modificato_il, eliminato_il)`
- `attivita(id PK, cliente_id, sistema_id NULL, tipo, descrizione, quando NOT NULL)` + indice su `(cliente_id, quando)`

- [ ] **Step 1: Test che falliscono**
  - `batch` con 2 insert dove il secondo viola un vincolo → `rejects`, e `select count(*)` = 0 (rollback)
  - `select` con parametro `"L'Officina"` restituisce la riga
  - `migra` su db vuoto → `1`; seconda chiamata → `1` senza errori; le tre tabelle esistono
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa (`BEGIN` / esecuzione / `COMMIT`, `ROLLBACK` e rilancio dell'errore in caso di eccezione).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): driver sql.js e migrazioni`.

### Task 5: Repository — clienti, attività, cestino

**Files:**
- Create: `src/archivio/errori.ts`, `src/archivio/repository.ts`
- Test: `tests/archivio/repositoryClienti.test.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `migra`, `validaCliente`, `isScaduto`, tipi del Task 2.
- Produces:
  - Errori: `ErroreValidazione(errori: Record<string, string>)`, `ErrorePartitaIvaDuplicata` (messaggio `Esiste già un cliente con questa Partita IVA`), `ErroreInventarioVuoto` (`Aggiungi almeno un sistema AI prima di confermare l'inventario`), `ErroreNonTrovato`, `ErroreClienteNelCestino` (`Ripristina prima il cliente`).
  - `ElementoCestino { tipo: 'cliente' | 'sistema'; id: string; nome: string; clienteNome: string | null; eliminatoIl: string }`
  - `creaRepository(driver: SqlDriver, deps?: { ora?: () => Date; nuovoId?: () => string }): Repository` con:
    - `elencaClienti(): Promise<Cliente[]>` (attivi, ordinati per ragione sociale, senza distinzione maiuscole/minuscole)
    - `getCliente(id): Promise<Cliente | null>`
    - `creaCliente(input: unknown): Promise<Cliente>` / `aggiornaCliente(id, input: unknown): Promise<Cliente>`
    - `eliminaCliente(id): Promise<void>` / `ripristinaCliente(id): Promise<void>`
    - `elencaAttivita(clienteId): Promise<Attivita[]>` (più recente prima)
    - `elencaCestino(): Promise<ElementoCestino[]>`, `eliminaDefinitivamente(tipo, id): Promise<void>`, `svuotaCestinoScaduto(): Promise<number>`
    - metodi sui sistemi: vedi Task 6.

Regole:
- Validazione con `validaCliente(input, ora())`; se fallisce → `ErroreValidazione`. Prima di scrivere, verifica la P.IVA tra i clienti attivi (escludendo il cliente stesso) → `ErrorePartitaIvaDuplicata`.
- Ogni scrittura e la relativa `attivita` nello stesso `batch`. Descrizioni: `Cliente creato`, `Anagrafica modificata`, `Cliente spostato nel cestino`, `Cliente ripristinato`.
- `eliminaCliente` imposta lo stesso `eliminato_il = T` sul cliente e sui suoi sistemi attivi; `ripristinaCliente` ripristina il cliente e solo i sistemi con `eliminato_il = T` (quelli eliminati prima restano nel cestino).
- `eliminaDefinitivamente('cliente')` cancella anche i suoi sistemi e le sue attività.

- [ ] **Step 1: Test che falliscono** (driver sql.js + `migra`, `ora` fissa)
  - crea → `getCliente` restituisce gli stessi campi; `elencaAttivita` ha 1 voce `creato`
  - `ragioneSociale: "L'Officina Società ✓"` → riletta identica
  - seconda creazione con stessa P.IVA → `ErrorePartitaIvaDuplicata`
  - input non valido → `ErroreValidazione` con chiave `partitaIva`; nessuna riga scritta
  - elimina → sparisce da `elencaClienti`, compare in `elencaCestino`; i sistemi seguono il cliente
  - sistema S1 eliminato prima del cliente; ripristino del cliente → S1 resta nel cestino, S2 torna
  - A eliminato, B creato con la stessa P.IVA, ripristino di A → `ErrorePartitaIvaDuplicata` e A ancora nel cestino
  - `svuotaCestinoScaduto` con `ora` = eliminazione + 31 giorni → restituisce 1, cliente non più presente
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa; mappa snake_case ↔ camelCase e 0/1 ↔ boolean in funzioni private `rigaACliente` / `rigaASistema`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): repository clienti, log e cestino`.

### Task 6: Repository — sistemi AI e conferma inventario

**Files:**
- Modify: `src/archivio/repository.ts`
- Test: `tests/archivio/repositorySistemi.test.ts`

**Interfaces:**
- Produces (sul `Repository`):
  - `elencaSistemi(clienteId): Promise<SistemaAI[]>` (attivi, ordinati per nome)
  - `getSistema(id): Promise<SistemaAI | null>`
  - `creaSistema(clienteId, input: unknown)`, `aggiornaSistema(id, input: unknown): Promise<SistemaAI>`
  - `eliminaSistema(id)`, `ripristinaSistema(id): Promise<void>`
  - `confermaInventario(clienteId): Promise<void>`

Regole: creazione, eliminazione e ripristino di un sistema impostano `inventario_confermato = 0` sul cliente nello stesso batch. La sola modifica non lo azzera. `ripristinaSistema` con cliente nel cestino → `ErroreClienteNelCestino`. `confermaInventario` con 0 sistemi attivi → `ErroreInventarioVuoto`. Descrizioni attività: `Sistema "<nome>" aggiunto`, `Sistema "<nome>" modificato`, `Sistema "<nome>" spostato nel cestino`, `Sistema "<nome>" ripristinato`, `Inventario confermato (N sistemi)`.

- [ ] **Step 1: Test che falliscono** — crea 2 sistemi, conferma → `inventarioConfermato true`; aggiungi un terzo → `false`; conferma con 0 sistemi → `ErroreInventarioVuoto`; modifica → resta `true`; `ripristinaSistema` con cliente nel cestino → `ErroreClienteNelCestino`; input con `ruoloCliente: 'altro'` → `ErroreValidazione`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): repository sistemi AI e inventario`.

### Task 7: UI — struttura, Dashboard, RoadmapBar, scheda cliente

**Files:**
- Create: `src/archivio/avvio.ts`, `src/ui/RepositoryContext.tsx`, `src/ui/App.tsx`, `src/ui/componenti/RoadmapBar.tsx`, `src/ui/componenti/Campo.tsx`, `src/ui/pagine/Dashboard.tsx`, `src/ui/pagine/SchedaCliente.tsx`, `src/main.tsx`
- Test: `tests/ui/RoadmapBar.test.tsx`, `tests/ui/SchedaCliente.test.tsx` (jsdom + @testing-library/react)

**Interfaces:**
- Consumes: `Repository`, `calcolaRoadmap`, `RUOLI`.
- Produces:
  - `creaDriver(): Promise<SqlDriver>`: `creaTauriDriver()` se `'__TAURI_INTERNALS__' in window`, altrimenti `creaSqlJsDriver({ wasmUrl })` con `import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'`. Il driver Tauri è implementato nel Task 9; fino ad allora `avvio.ts` usa solo sql.js.
  - `<RepositoryProvider repository={Repository}>`, `useRepository(): Repository`
  - `<RoadmapBar roadmap={Roadmap} variante="compatta" | "estesa" />`
  - Rotte (`HashRouter`): `/` Dashboard, `/clienti/nuovo`, `/clienti/:id`, `/clienti/:id/sistemi/nuovo`, `/sistemi/:id`, `/cestino`.

Dashboard (spec §4): righe cliente con ragione sociale, `RoadmapBar` compatta, `percentuale%`, prossima azione e badge `AI literacy ✓` / `AI literacy da documentare`. Ricerca su ragione sociale/P.IVA, filtro per tappa `in_corso`, pulsanti `Nuovo cliente` e `Cestino`. Scheda cliente: form anagrafica, roadmap estesa, elenco sistemi, pulsante `Conferma inventario`, log attività, pulsante `Sposta nel cestino` con conferma.

Form: errori sotto il campo (`Campo` con `aria-describedby`), `Salva` disabilitato se ci sono errori **o durante il salvataggio**. Gli errori del repository (`ErrorePartitaIvaDuplicata`, ecc.) compaiono in un avviso sopra il form.

- [ ] **Step 1: Test che falliscono**
  - `RoadmapBar` con roadmap al 40% → 5 elementi `listitem`; 2 con `aria-label` che contiene `completata`; 3 con testo `disponibile dalla Fase 2`; testo `40%`
  - `SchedaCliente` nuovo: P.IVA `123` → testo `Partita IVA non valida` visibile, `Salva` disabilitato
  - doppio clic su `Salva` con dati validi → `elencaClienti()` ha lunghezza 1
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa. CSS semplice in un file `src/ui/stile.css`, nessuna libreria di componenti.
- [ ] **Step 4:** `npm test` → PASS; `npm run dev` apre l'anteprima su sql.js.
- [ ] **Step 5:** Commit `feat(ai-act-app): dashboard e scheda cliente`.

### Task 8: UI — scheda sistema AI e cestino

**Files:**
- Create: `src/ui/pagine/SchedaSistema.tsx`, `src/ui/pagine/Cestino.tsx`
- Test: `tests/ui/SchedaSistema.test.tsx`, `tests/ui/Cestino.test.tsx`

**Interfaces:**
- Consumes: `Repository` (Task 5–6), `Campo`, `RUOLI`.

Scheda sistema: campi `nome`, `fornitore`, `scopo` (textarea), `reparto`, `dataAvvio`, `ruoloCliente` (select con `RUOLI`); stesse regole dei form del Task 7. Cestino: tabella con tipo, nome, cliente, `Eliminato il` (formato `gg/mm/aaaa`), azioni `Ripristina` e `Elimina definitivamente`, quest'ultima con conferma `Eliminare definitivamente? L'operazione non si può annullare.` Nota a pie' di pagina: `Gli elementi vengono eliminati automaticamente dopo 30 giorni.`

- [ ] **Step 1: Test che falliscono** — creazione di un sistema dalla scheda → compare nell'elenco del cliente; `Ripristina` nel cestino → l'elemento sparisce dal cestino e torna nel cliente; ripristino di un sistema con cliente nel cestino → avviso `Ripristina prima il cliente`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): scheda sistema AI e cestino`.

### Task 9: Shell Tauri, store Rust, backup

**Files:**
- Create: `src-tauri/Cargo.toml` (workspace), `src-tauri/store/Cargo.toml`, `src-tauri/store/src/lib.rs`, `src-tauri/src/main.rs`, `src-tauri/src/comandi.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src/archivio/tauriDriver.ts`, `src/ui/pagine/ErroreAvvio.tsx`
- Modify: `src/archivio/avvio.ts`, `src/ui/App.tsx` (backup e avviso di avvio)
- Test: `src-tauri/store/src/lib.rs` (`#[cfg(test)]`, `tempfile`), `tests/archivio/tauriDriver.test.ts` (mock di `invoke`)

**Interfaces:**
- Produces (crate `ai-act-store`, dipendenze `rusqlite` con feature `bundled`, `serde_json`):
  - `Store::apri(percorso: &Path) -> Result<Store>` (connessione unica in `Mutex`, `PRAGMA foreign_keys = ON`)
  - `select(&self, sql: &str, params: &[serde_json::Value]) -> Result<Vec<serde_json::Map<String, Value>>>`
  - `batch(&self, istruzioni: &[Istruzione]) -> Result<()>`: una transazione, rollback su errore. `Istruzione { sql: String, params: Vec<Value> }` (serde)
  - `backup_in(&self, dest: &Path) -> Result<()>` con `VACUUM INTO ?`
  - `backup_avvio(&self, dir: &Path, ora: &str) -> Result<PathBuf>`: crea `ai-act-<YYYYMMDD-HHMMSS>.db`, poi tiene i 10 più recenti per nome
  - `ripristina(&self, sorgente: &Path, dir_backup: &Path) -> Result<()>`: apre la sorgente in sola lettura e richiede `PRAGMA quick_check` = `ok`, altrimenti `Err` senza toccare nulla; poi fa un backup del corrente, sostituisce il file e riapre la connessione
  - `ultimo_backup(dir: &Path) -> Option<PathBuf>`
- Produces (comandi Tauri in `comandi.rs`): `db_select { sql, params }`, `db_batch { istruzioni }`, `esporta_backup { dest }`, `ripristina_backup { sorgente }`, `ripristina_ultimo_backup`, `stato_avvio -> { erroreBackup: string | null }`. Il database si apre in `setup()` su `app_data_dir()/ai-act.db`, poi parte `backup_avvio`; un errore viene salvato in `stato_avvio`, non blocca l'app.
- Produces (TS): `creaTauriDriver(): SqlDriver` via `invoke`.
- Frontend: all'avvio `migra()`; se fallisce mostra `ErroreAvvio` con il testo `Il database non può essere aperto.` e il pulsante `Ripristina l'ultimo backup`. Se `erroreBackup` non è null mostra un avviso non bloccante `Backup automatico non riuscito: <errore>`. Poi `svuotaCestinoScaduto()`. In Dashboard, menu `Esporta backup` / `Ripristina backup` tramite `@tauri-apps/plugin-dialog` (`save` / `open`, filtro `.db`); ricarica la pagina dopo il ripristino.

- [ ] **Step 1: Test Rust che falliscono** (`cargo test -p ai-act-store`)
  - `batch` con il secondo statement non valido → nessuna riga inserita
  - 12 chiamate a `backup_avvio` con orari crescenti → 10 file, mancano i 2 più vecchi
  - `ripristina` da un file di testo → `Err`; i dati correnti restano leggibili e invariati
  - `ripristina` da un backup valido → dati del backup visibili; esiste un nuovo file in `dir_backup`
  - `select` restituisce testo UTF-8 con apostrofo ed emoji identico
- [ ] **Step 2:** `cargo test -p ai-act-store` → FAIL.
- [ ] **Step 3:** Implementa lo store; poi i comandi e `tauri.conf.json` (`productName`, `identifier` dai Global Constraints, finestra 1200×800, titolo `AI Act Assessment`, CSP `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'`), capability con `dialog:allow-open`, `dialog:allow-save`.
- [ ] **Step 4:** `cargo test -p ai-act-store` → PASS; `npm test` → PASS (test `tauriDriver` con `invoke` mockato verifica nomi dei comandi e argomenti).
- [ ] **Step 5:** Commit `feat(ai-act-app): shell Tauri, store Rust e backup`.

Nota: il crate dell'app Tauri richiede WebKitGTK per compilare su Linux, non installato in questo container: lo compila la CI (Task 11). Il crate `ai-act-store` invece non dipende da Tauri e si testa qui.

### Task 10: Test end-to-end

**Files:**
- Create: `ai-act-app/playwright.config.ts`, `ai-act-app/e2e/flusso.spec.ts`

- [ ] **Step 1: Test** — su `npm run dev` (sql.js): `Nuovo cliente` → compila con P.IVA `00488410010` → `Salva` → aggiungi 2 sistemi → `Conferma inventario` → in Dashboard la riga mostra `40%` e `In attesa della Fase 2`. Secondo test: sposta nel cestino → `Cestino` → `Ripristina` → il cliente torna in Dashboard.
- [ ] **Step 2:** `npx playwright test` → PASS (se la versione di Playwright non corrisponde al Chromium preinstallato, `launchOptions.executablePath` letto dalla variabile d'ambiente `CHROMIUM_PATH`).
- [ ] **Step 3:** Commit `test(ai-act-app): flusso end-to-end`.

### Task 11: CI, installer, checklist manuale

**Files:**
- Create: `.github/workflows/ai-act-app.yml`, `docs/ai-act-app/checklist-installer.md`, `ai-act-app/README.md`

Workflow su push e PR che toccano `ai-act-app/**`:
- job `test` (ubuntu-latest): `npm ci`, `npx tsc --noEmit`, `npm test`, `cargo test -p ai-act-store`, `npx playwright install --with-deps chromium`, `npx playwright test`
- job `build` (dipende da `test`, matrix `windows-latest` e `macos-latest`): `tauri-apps/tauri-action@v0`, su macOS `--target universal-apple-darwin`; upload degli installer (`.msi`/`.exe`, `.dmg`) come artifact. Action fissate a versione maggiore (`actions/checkout@v4`, `actions/setup-node@v4`, `dtolnay/rust-toolchain@stable`).

Checklist (5 minuti): scarica l'artifact, installa (superando l'avviso SmartScreen/Gatekeeper, istruzioni per entrambi), crea un cliente reale, aggiungi un sistema, chiudi e riapri l'app → i dati sono presenti; verifica che esista un file nella cartella `backup/` (percorsi per Windows e macOS); `Esporta backup` su Desktop; `Ripristina backup` dal file esportato.

- [ ] **Step 1:** Scrivi workflow, checklist e README (avvio di sviluppo, test, percorso dati).
- [ ] **Step 2:** Push → job `test` verde, job `build` produce 2 artifact.
- [ ] **Step 3:** Commit `ci(ai-act-app): test e build installer Windows/macOS`.
