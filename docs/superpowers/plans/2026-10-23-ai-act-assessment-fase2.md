# AI Act Assessment — Fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Questionario guidato per sistema AI che calcola classe di rischio, motivazione e obblighi da un file di regole versionato, con conferma/modifica del consulente e tappe 3–4 della roadmap attive.

**Architecture:** Nuovo modulo `src/regole/` in TypeScript puro: tipi, valutatore di condizioni, caricamento/validazione del file `regole/ai-act.json`, motore (`domandeVisibili`, `calcolaEsito`). L'archivio aggiunge la tabella `valutazioni` (migrazione 2) e i metodi sul `Repository`; la UI chiama il motore e salva risposte + copia fissa dell'esito. La roadmap riceve una sintesi delle valutazioni.

**Tech Stack:** come Fase 1 (React 19, TS 6.0.3, Vite 8, Vitest 5, zod 4.6.7, sql.js / Tauri+rusqlite, Playwright 1.64.1). Nessuna nuova dipendenza runtime.

**Spec:** `docs/superpowers/specs/2026-10-23-ai-act-assessment-fase2-design.md` (e Fase 1: `docs/superpowers/specs/2026-10-22-ai-act-assessment-fase1-design.md`)

## Global Constraints

- Codice in `ai-act-app/`; UI e messaggi in italiano; versioni esatte (niente `^`/`~`).
- Norma di riferimento: "Reg. (UE) 2024/1689 come modificato dal Reg. (UE) 2026/1744".
- Risposte ammesse: `si` | `no` | `non_so`. Modelli GPAI (Capo V) esclusi.
- Classi: `fuori_ambito`, `vietato`, `alto_rischio`, `non_alto_rischio_deroga`, `minimo`, `da_approfondire`; flag `trasparenza`.
- Date: art. 5 originario e art. 4 `2025-02-02`; nuova pratica art. 5 `2026-12-02`; art. 50 `2026-08-02`; Allegato III `2027-12-02`; Allegato I `2028-08-02`.
- Voci del file regole con `stato`: `bozza` | `validata` | `da_verificare`; da marcare `da_verificare`: art. 4, art. 49(2), lettere nuove dell'art. 5.
- Condizioni solo come dati JSON; vietato `eval`/`new Function`.
- Ogni scrittura in un unico `driver.batch` con riga `attivita` (tipi esistenti: si usa `modificato`, nessuna modifica al CHECK di `attivita.tipo`).
- Tappa 5 resta `bloccata` con dettaglio `disponibile dalla Fase 2b`.
- SQL con parametri vincolati; la migrazione 2 non tocca le tabelle della Fase 1.

## Review Focus

1. **Risposta a una domanda poi nascosta** (si cambia la risposta "genitore") → ignorata nell'esito. Test in Task 2.
2. **Modifica di una risposta dopo la conferma** → la conferma viene azzerata (stato `completata` o `in_corso`). Test in Task 4.
3. **Versione regole cambiata** → valutazione "da rivedere" e la tappa 3 non risulta completata. Test in Task 5.
4. **Cliente con 0 sistemi** → tappe 3 e 4 non completate (niente "vero a vuoto"). Test in Task 5.
5. **Eliminazione definitiva / svuotamento cestino di sistema o cliente con valutazioni** → nessun errore di foreign key, valutazioni rimosse. Test in Task 4.

---

## File Structure

```
ai-act-app/
  regole/ai-act.json                    file regole v1.0.0 (Task 3)
  scripts/revisione-regole.mjs          genera docs/ai-act-app/revisione-regole.md (Task 3)
  src/regole/
    tipi.ts          Risposta, Condizione, Domanda, RegolaEsito, RegolaTrasparenza, Obbligo, FileRegole, Classe, ETICHETTE_CLASSE, EsitoValutazione
    condizioni.ts    valuta, riferimentiDi
    carica.ts        caricaRegole, ErroreRegole
    motore.ts        domandeVisibili, calcolaEsito
    attive.ts        REGOLE / ERRORE_REGOLE (file reale caricato)
  src/domain/valutazione.ts             Valutazione, StatoValutazione, sintesiPerRoadmap
  src/archivio/migrazioni.ts            + migrazione 2
  src/archivio/repository.ts            + metodi valutazioni, cascade
  src/domain/roadmap.ts                 tappe 3–4 attive
  src/ui/componenti/RiquadroValutazione.tsx
  src/ui/pagine/Questionario.tsx, EsitoValutazione.tsx
tests/regole/  tests/domain/  tests/archivio/  tests/ui/  e2e/
```

---

### Task 1: Tipi, condizioni e caricamento del file regole

**Files:**
- Create: `src/regole/tipi.ts`, `src/regole/condizioni.ts`, `src/regole/carica.ts`
- Test: `tests/regole/condizioni.test.ts`, `tests/regole/carica.test.ts`

**Interfaces:**
- Consumes: `RuoloCliente` da `src/domain/tipi.ts`.
- Produces:
  - `type Risposta = 'si' | 'no' | 'non_so'`; `type Risposte = Record<string, Risposta>`
  - `type Condizione = { risposta: string; uguale: Risposta } | { tutte: Condizione[] } | { almenoUna: Condizione[] } | { non: Condizione }`
  - `type StatoVoce = 'bozza' | 'validata' | 'da_verificare'`
  - `type Sezione = 'ambito' | 'vietate' | 'alto_rischio' | 'trasparenza' | 'ruolo'`; `SEZIONI: { id: Sezione; etichetta: string }[]` con etichette `Ambito`, `Pratiche vietate`, `Alto rischio`, `Trasparenza`, `Ruolo`
  - `type Classe = 'fuori_ambito' | 'vietato' | 'alto_rischio' | 'non_alto_rischio_deroga' | 'minimo' | 'da_approfondire'`
  - `ETICHETTE_CLASSE: Record<Classe, string>` = `Fuori ambito`, `Pratica vietata`, `Alto rischio`, `Non alto rischio (deroga art. 6(3))`, `Rischio minimo`, `Da approfondire`
  - `type RuoloEffettivo = 'fornitore' | 'deployer' | 'importatore' | 'distributore'`
  - `Domanda { id; sezione: Sezione; testo; aiuto: string | null; riferimento; mostraSe: Condizione | null; stato: StatoVoce }`
  - `RegolaEsito { id; quando: Condizione; classe: Exclude<Classe, 'minimo' | 'da_approfondire'>; motivazione; riferimento; dataApplicazione: string | null; stato }` — ordinate, vince la prima vera
  - `RegolaTrasparenza { id; quando: Condizione; motivazione; riferimento; stato }`
  - `Obbligo { id; classi: Classe[]; soloSeTrasparenza: boolean; ruoli: RuoloEffettivo[]; quando: Condizione | null; testo; riferimento; dataApplicazione: string; stato }`
  - `FileRegole { meta: { id: string; versione: string; norma: string; dataRedazione: string }; ruoloFornitoreSe: Condizione; domande: Domanda[]; esiti: RegolaEsito[]; trasparenza: RegolaTrasparenza[]; obblighi: Obbligo[] }`
  - `valuta(c: Condizione, r: Risposte): boolean` — risposta mancante ⇒ `uguale` falso
  - `riferimentiDi(c: Condizione): string[]` — id domanda citati
  - `class ErroreRegole extends Error { problemi: string[] }`
  - `caricaRegole(json: unknown): FileRegole` — zod + controlli; lancia `ErroreRegole` con tutti i problemi

Controlli di `caricaRegole` (messaggi esatti, uno per problema): `Id duplicato: <id>`, `Domanda inesistente "<rif>" in <idVoce>`, `Ciclo in mostraSe: <id1> → <id2> → <id1>`, `Data non valida in <idVoce>: <valore>` (formato `YYYY-MM-DD` reale), `Versione non valida: <valore>` (semver `x.y.z`). Le domande citate in `mostraSe` devono precedere la domanda nell'elenco (altrimenti `Domanda "<rif>" citata prima di essere definita in <id>`).

- [ ] **Step 1: Test che falliscono** — `valuta`: `uguale` vero/falso, risposta mancante falsa, `tutte` vuoto ⇒ vero, `almenoUna` vuoto ⇒ falso, `non`, annidamento. `caricaRegole`: un fixture minimo valido (scritto nel test) passa; un fixture per ciascun messaggio sopra lancia `ErroreRegole` con quel messaggio in `problemi`; due errori insieme ⇒ `problemi.length === 2`; JSON con chiave mancante ⇒ `ErroreRegole`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa (schema zod ricorsivo con `z.lazy`; ciclo con DFS sul grafo `mostraSe`).
- [ ] **Step 4:** `npm test` + `npx tsc --noEmit` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): tipi e validazione del file regole`.

### Task 2: Motore di valutazione

**Files:**
- Create: `src/regole/motore.ts`
- Test: `tests/regole/motore.test.ts` (con un fixture di regole definito nel test, non il file reale)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `domandeVisibili(regole: FileRegole, r: Risposte): Domanda[]` — in ordine; una domanda è visibile se `mostraSe` è null o vera valutata sulle sole risposte di domande visibili
  - `EsitoValutazione { classe: Classe; trasparenza: boolean; motivazione: { testo: string; riferimento: string }[]; aperte: string[]; ruoloEffettivo: RuoloEffettivo | 'da_definire'; obblighi: { id; testo; riferimento; dataApplicazione; ruoli: RuoloEffettivo[] }[]; dataApplicazioneClasse: string | null; completo: boolean; vociUsate: string[]; vociNonValidate: number }`
  - `calcolaEsito(regole: FileRegole, r: Risposte, ruoloCliente: RuoloCliente): EsitoValutazione`

Algoritmo (fissato qui perché i test da soli non lo determinano):
1. `R` = risposte delle sole domande visibili. `completo` = ogni domanda visibile ha risposta.
2. `classeDi(R)`: prima `RegolaEsito` con `quando` vero ⇒ sua classe; nessuna ⇒ `minimo`. `trasparenzaDi(R)`: almeno una `RegolaTrasparenza` vera e classe ∉ {`fuori_ambito`, `vietato`}.
3. Per ogni domanda visibile con `non_so`: calcola classe e trasparenza con quella risposta forzata a `si` e poi a `no` (le altre invariate, visibilità ricalcolata). Se differiscono, l'id va in `aperte`.
4. `aperte` non vuoto ⇒ `classe = 'da_approfondire'`, `obblighi = []` (tranne art. 4, vedi sotto). Altrimenti classe/trasparenza dal punto 2.
5. `ruoloEffettivo`: `valuta(ruoloFornitoreSe, R)` ⇒ `fornitore`; altrimenti `ruoloCliente`.
6. `obblighi`: voci con `classe ∈ classi`, `soloSeTrasparenza ⇒ trasparenza`, `quando` null o vero, e `ruoloEffettivo ∈ ruoli` (con `da_definire` si includono tutte). Per `da_approfondire` si includono solo gli obblighi che hanno `da_approfondire` in `classi`.
7. `motivazione`: la regola esito vincente (se c'è) + le regole trasparenza vere, ciascuna `{testo: motivazione, riferimento}`. `vociUsate`: id di domande visibili + regole/obblighi applicati; `vociNonValidate`: quante di queste hanno `stato !== 'validata'`.

- [ ] **Step 1: Test che falliscono** (fixture con domande `q_ambito`, `q_vietata`, `q_area`, `q_deroga` con `mostraSe: q_area=si`, `q_profilazione` con `mostraSe: q_deroga=si`, `q_chatbot`, `q_marchio`):
  - `q_area=si, q_deroga=si, q_profilazione=si` ⇒ `alto_rischio`
  - poi `q_area=no` con le altre risposte rimaste ⇒ `q_deroga` e `q_profilazione` non visibili e **ignorate** (Review Focus #1): classe `minimo`
  - `q_vietata=si` + `q_chatbot=si` ⇒ `vietato`, `trasparenza === false`
  - `q_chatbot=si` ⇒ `minimo`, `trasparenza === true`, motivazione contiene la regola trasparenza
  - `q_area=non_so` ⇒ `da_approfondire`, `aperte` = [`q_area`]
  - `q_chatbot=non_so` con `q_vietata=si` ⇒ resta `vietato` (non determinante), `aperte` vuoto
  - `q_marchio=si` e `ruoloCliente='deployer'` ⇒ `ruoloEffettivo='fornitore'` e solo obblighi del fornitore
  - `ruoloCliente='da_definire'` ⇒ obblighi di tutti i ruoli
  - risposte parziali ⇒ `completo === false`
  - fixture con una voce `bozza` usata ⇒ `vociNonValidate === 1`
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): motore di valutazione AI Act`.

### Task 3: File regole v1.0.0, casi di prova, tabella di revisione

**Files:**
- Create: `regole/ai-act.json`, `src/regole/attive.ts`, `scripts/revisione-regole.mjs`, `docs/ai-act-app/revisione-regole.md` (generato)
- Modify: `package.json` (script `"regole:revisione": "node scripts/revisione-regole.mjs"`)
- Test: `tests/regole/casi.test.ts`, `tests/regole/attive.test.ts`

**Interfaces:**
- Consumes: Task 1–2.
- Produces: `REGOLE: FileRegole | null` e `ERRORE_REGOLE: ErroreRegole | null` da `src/regole/attive.ts` (carica `../../regole/ai-act.json` con `caricaRegole`, cattura l'errore).

Contenuto (spec §3 e tabella obblighi): `meta.id = "ai-act"`, `meta.versione = "1.0.0"`, `meta.norma = "Reg. (UE) 2024/1689 come modificato dal Reg. (UE) 2026/1744"`. Prefissi id: `amb_`, `vie_`, `ar1_` (Allegato I), `ar3_` (8 aree Allegato III, una domanda per area), `der_` (4 condizioni art. 6(3) + `der_profilazione`), `tra_`, `ruo_` (`ruo_marchio`, `ruo_modifica`, `ruo_ente_pubblico`). Domande dell'art. 5: una per lettera dell'art. 5(1) (a–h) + `vie_ncii` (nuova pratica, `stato: "da_verificare"`, data `2026-12-02`). `ruo_ente_pubblico` visibile solo se un'area Allegato III è `si` e nessuna deroga si applica. Obbligo art. 4 su tutte le classi tranne `fuori_ambito`, `stato: "da_verificare"`. Obbligo art. 49(2) su `non_alto_rischio_deroga` per fornitore, `stato: "da_verificare"`. Tutte le altre voci `stato: "bozza"`. Testi delle domande in italiano, chiari per un non giurista, `riferimento` nel formato `Art. 5(1)(f)` / `All. III, p. 4(a)`.

Casi di prova: i 12 della spec §8, uno per `it(...)`, con risposte esplicite e asserzioni su `classe`, `trasparenza`, `ruoloEffettivo`, presenza degli obblighi citati (per id), `dataApplicazioneClasse` dove la spec la indica (caso 12 ⇒ `2028-08-02`, caso 3 ⇒ `2027-12-02`).

Script revisione: legge il JSON e scrive una tabella Markdown con colonne `Id | Tipo | Testo | Riferimento | Data | Stato | Esito revisione` (ultima vuota), intestazione con `meta` e conteggi per stato.

- [ ] **Step 1: Test che falliscono** — `attive.test.ts`: `ERRORE_REGOLE === null`, `REGOLE.meta.versione === '1.0.0'`, ogni `vie_*` ha riferimento che inizia con `Art. 5`, le voci art. 4 e 49(2) e `vie_ncii` sono `da_verificare`. `casi.test.ts`: i 12 casi.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Scrivi `regole/ai-act.json`, `attive.ts`, lo script; genera la tabella con `npm run regole:revisione`.
- [ ] **Step 4:** `npm test` → PASS; la tabella esiste e conta tutte le voci.
- [ ] **Step 5:** Commit `feat(ai-act-app): bozza regole AI Act v1.0.0 e tabella di revisione`.

### Task 4: Archivio valutazioni

**Files:**
- Create: `src/domain/valutazione.ts`
- Modify: `src/archivio/migrazioni.ts`, `src/archivio/repository.ts`, `src/archivio/errori.ts`
- Test: `tests/archivio/repositoryValutazioni.test.ts`, `tests/archivio/migrazioni.test.ts`

**Interfaces:**
- Consumes: `EsitoValutazione`, `Risposte`, `Classe` (Task 1–2); Repository Fase 1.
- Produces:
  - `type StatoValutazione = 'in_corso' | 'completata' | 'confermata'`
  - `Valutazione { id; sistemaId; versioneRegole; risposte: Risposte; esito: EsitoValutazione | null; stato: StatoValutazione; classeConfermata: Classe | null; notaModifica: string | null; creatoIl; modificatoIl; confermatoIl: string | null; sostituitaIl: string | null }`
  - Repository:
    - `getValutazioneAttiva(sistemaId: string): Promise<Valutazione | null>`
    - `elencaValutazioni(sistemaId: string): Promise<Valutazione[]>` (più recente prima, incluse sostituite)
    - `avviaValutazione(sistemaId: string, versioneRegole: string): Promise<Valutazione>` — la precedente attiva riceve `sostituita_il`
    - `salvaRisposte(id: string, risposte: Risposte, esito: EsitoValutazione): Promise<Valutazione>` — `stato = esito.completo ? 'completata' : 'in_corso'`; azzera `classe_confermata`, `nota_modifica`, `confermato_il`
    - `confermaValutazione(id: string, classe: Classe, nota: string | null): Promise<Valutazione>`
  - Errori: `ErroreValutazioneIncompleta` (`Completa il questionario prima di confermare`); `ErroreValidazione({ nota: 'Indica il motivo della modifica' })` se `classe !== esito.classe` e nota vuota.

Migrazione 2: `valutazioni(id TEXT PK, sistema_id TEXT NOT NULL REFERENCES sistemi(id), versione_regole TEXT NOT NULL, risposte TEXT NOT NULL, esito TEXT NULL, stato TEXT NOT NULL CHECK (stato IN ('in_corso','completata','confermata')), classe_confermata TEXT NULL, nota_modifica TEXT NULL, creato_il, modificato_il TEXT NOT NULL, confermato_il TEXT NULL, sostituita_il TEXT NULL)` + `CREATE UNIQUE INDEX ux_valutazioni_attiva ON valutazioni(sistema_id) WHERE sostituita_il IS NULL`.

Attività (tipo `modificato`, cliente del sistema, `sistema_id`): `Valutazione di «<nome>» avviata`, `Valutazione di «<nome>» completata: <ETICHETTE_CLASSE>`, `Classificazione di «<nome>» confermata: <etichetta>`, `Classificazione di «<nome>» modificata: <etichetta> — <nota>`. `salvaRisposte` registra attività solo quando lo stato passa a `completata`.

Cancellazioni: `eliminaDefinitivamente` (cliente o sistema) e `svuotaCestinoScaduto` cancellano prima le valutazioni dei sistemi coinvolti.

- [ ] **Step 1: Test che falliscono**
  - migrazione: DB alla versione 1 con dati Fase 1 → `migra` ⇒ 2, dati intatti, tabella presente
  - avvia → attiva in_corso; secondo avvio ⇒ precedente con `sostituitaIl`, `elencaValutazioni` ha 2 voci
  - `salvaRisposte` con esito completo ⇒ `completata`; conferma con stessa classe e nota null ⇒ `confermata`
  - conferma con classe diversa e nota `''` ⇒ `ErroreValidazione` con chiave `nota`; con nota ⇒ ok e `notaModifica` salvata
  - conferma su `in_corso` ⇒ `ErroreValutazioneIncompleta`
  - **Review Focus #2:** `salvaRisposte` su `confermata` ⇒ `completata`, `classeConfermata === null`
  - **Review Focus #5:** sistema con valutazione → `eliminaSistema` + `eliminaDefinitivamente('sistema')` senza errori e valutazioni rimosse; idem cliente; idem `svuotaCestinoScaduto`
  - esito con testo `L'Officina ✓` ⇒ riletto identico
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): archivio delle valutazioni`.

### Task 5: Roadmap con tappe 3–4

**Files:**
- Modify: `src/domain/roadmap.ts`, `src/domain/valutazione.ts`, `src/ui/pagine/Dashboard.tsx`, `src/ui/pagine/SchedaCliente.tsx`
- Test: `tests/domain/roadmap.test.ts`, UI esistenti aggiornati

**Interfaces:**
- Consumes: `Valutazione` (Task 4), `REGOLE` (Task 3).
- Produces:
  - `SintesiValutazione { sistemaId: string; sistemaNome: string; stato: StatoValutazione | null; daRivedere: boolean }`
  - `sintesiPerRoadmap(sistemi: SistemaAI[], attive: (Valutazione | null)[], versioneCorrente: string): SintesiValutazione[]` (in `valutazione.ts`; `daRivedere = v !== null && v.versioneRegole !== versioneCorrente`)
  - `calcolaRoadmap(cliente, sistemiAttivi, oggi, valutazioni: SintesiValutazione[]): Roadmap`

Regole: tappa 3 completata se `sistemiAttivi.length > 0` e ogni sintesi ha stato `completata`|`confermata` e `!daRivedere`; tappa 4 se ogni sintesi è `confermata` e `!daRivedere`. Dettaglio tappa 3 `"N di M sistemi"` (valutati), tappa 4 `"N di M confermati"`. Tappa 5 `bloccata`, dettaglio `disponibile dalla Fase 2b`. Prossima azione dopo inventario: `Compila il questionario per «<nome>»` (primo sistema per nome senza valutazione completata o da rivedere), poi `Conferma la classificazione di «<nome>»`, infine `In attesa della Fase 2b`. Dashboard e SchedaCliente caricano le valutazioni attive e passano la sintesi.

- [ ] **Step 1: Test che falliscono** — 2 sistemi, nessuna valutazione ⇒ 40%, tappa 3 in_corso, `Compila il questionario per «A»`; entrambi completati ⇒ 60%, `Conferma la classificazione di «A»`; entrambi confermati ⇒ 80%, `In attesa della Fase 2b`; **Review Focus #3:** uno confermato con versione vecchia ⇒ tappa 3 non completata; **Review Focus #4:** 0 sistemi ⇒ tappe 3–4 non completate; tappa 5 `bloccata`. Aggiorna i test esistenti con 4° argomento.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa e aggiorna i chiamanti.
- [ ] **Step 4:** `npm test` + tsc → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): tappe questionario e classificazione nella roadmap`.

### Task 6: UI — riquadro valutazione e questionario

**Files:**
- Create: `src/ui/componenti/RiquadroValutazione.tsx`, `src/ui/pagine/Questionario.tsx`
- Modify: `src/ui/pagine/SchedaSistema.tsx`, `src/ui/App.tsx`, `src/ui/stile.css`
- Test: `tests/ui/Questionario.test.tsx`, `tests/ui/SchedaSistema.test.tsx`

**Interfaces:**
- Consumes: `REGOLE`, `ERRORE_REGOLE`, `domandeVisibili`, `calcolaEsito`, `SEZIONI`, `ETICHETTE_CLASSE`, Repository Task 4.
- Produces: rotta `/sistemi/:id/valutazione`.

Riquadro (solo per sistema esistente, sotto il form): titolo `Valutazione AI Act`; stato `Non avviata` / `In corso` / `Completata` / `Confermata`, classe con etichetta, badge `Da rivedere`; pulsanti `Avvia valutazione` (nessuna attiva), `Riprendi` (in corso), `Vedi esito` (completata/confermata), `Nuova valutazione` (con `conferma("Avviare una nuova valutazione? Quella attuale resterà nello storico.")`). Con `ERRORE_REGOLE` mostra `Regole non caricate: <problemi>` in `role="alert"` e nessun pulsante.

Questionario: una sezione per pagina (solo sezioni con domande visibili), intestazione `Sezione N di M — <etichetta>`, barra `<risposte>/<visibili>`; per ogni domanda: testo, `riferimento`, aiuto in `<details>`, tre radio `Sì` / `No` / `Non so`; a ogni cambio `calcolaEsito` + `repo.salvaRisposte` (salvataggio immediato; errori in `role="alert"`). Pulsanti `Indietro`, `Avanti`, sull'ultima `Vai all'esito` → `/sistemi/:id/valutazione/esito`.

- [ ] **Step 1: Test che falliscono** — avvio dal riquadro crea una valutazione e apre il questionario; risposta salvata e presente dopo smontaggio/rimontaggio (ripresa a metà); rispondere `no` alla definizione di sistema di IA nasconde le altre sezioni; badge `Da rivedere` con valutazione su versione diversa; `ERRORE_REGOLE` simulato (mock del modulo) ⇒ alert.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): questionario AI Act`.

### Task 7: UI — esito, conferma e modifica

**Files:**
- Create: `src/ui/pagine/EsitoValutazione.tsx`
- Modify: `src/ui/App.tsx`
- Test: `tests/ui/EsitoValutazione.test.tsx`

**Interfaces:**
- Consumes: Task 4 Repository, `ETICHETTE_CLASSE`, `REGOLE`.
- Produces: rotta `/sistemi/:id/valutazione/esito`.

Contenuto: classe (etichetta grande) + `+ obblighi di trasparenza` se flag; `Applicabile dal gg/mm/aaaa` se `dataApplicazioneClasse`; `Motivazione` (elenco testo — riferimento); se `aperte` non vuoto: `Punti da approfondire` con il testo delle domande; `Obblighi` (tabella testo / riferimento / dal); con ruolo `da_definire` avviso `Ruolo del cliente da definire: sono mostrati gli obblighi di tutti i ruoli.`; se `vociNonValidate > 0`: `Regole non ancora validate (N di M): verificare l'esito prima di consegnarlo.`; norma e versione regole in piccolo. Azioni (solo se `completata`/`confermata`): `Conferma classificazione` e `Modifica classificazione` (select con le 6 classi + textarea `Motivo della modifica`, errore sotto il campo); se `confermata` mostra `Confermata il gg/mm/aaaa` e, se modificata, classe scelta e nota. Se `in_corso`: `Questionario incompleto` e link `Torna al questionario`.

- [ ] **Step 1: Test che falliscono** — conferma ⇒ stato confermato visibile; modifica senza nota ⇒ `Indica il motivo della modifica` sotto il campo, nessun salvataggio; modifica con nota ⇒ salvata e mostrata; avviso regole non validate presente con la bozza v1.0.0; esito `da_approfondire` mostra i punti aperti.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(ai-act-app): esito della valutazione con conferma`.

### Task 8: E2E e documentazione

**Files:**
- Modify: `e2e/flusso.spec.ts`, `ai-act-app/README.md`, `docs/ai-act-app/checklist-installer.md`

- [ ] **Step 1:** Nuovo test e2e: cliente + 1 sistema (screening CV, ruolo deployer) → conferma inventario → avvia valutazione → risposte del caso 3 della spec → `Vai all'esito` ⇒ `Alto rischio` → `Conferma classificazione` → Dashboard mostra `80%` e `In attesa della Fase 2b`. Nessun errore in console.
- [ ] **Step 2:** `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run e2e` → PASS (tutti i test).
- [ ] **Step 3:** README: sezione regole (`regole/ai-act.json`, `npm run regole:revisione`, stati delle voci); checklist: passi per una valutazione e conferma sull'installer.
- [ ] **Step 4:** Commit `test(ai-act-app): flusso e2e della valutazione e documentazione`.
