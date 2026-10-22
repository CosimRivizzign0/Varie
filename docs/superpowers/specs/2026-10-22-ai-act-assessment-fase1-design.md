# AI Act Assessment — Fase 1: Registro clienti + Roadmap — Design

- **Data:** 2026-10-22
- **Stato:** in revisione
- **Cartella del codice:** `ai-act-app/` (in questo repository)

## 1. Obiettivo

App desktop per **uso personale** di un consulente, per gestire gli assessment AI Act
(Reg. UE 2024/1689) dei propri clienti. La Fase 1 copre il **registro** di clienti e
sistemi AI e una **roadmap visiva** che mostra a che punto è ciascun cliente.

### Vincoli (indicati dall'utente)

- Windows e macOS, un solo codebase.
- Dati **solo sul PC**, funzionamento offline, un solo utente.
- Output finali (fasi successive): **Word** per sistema AI + **Excel** inventario per cliente.

### Assunzioni (da confermare)

- Interfaccia in italiano.
- Classificazione basata sul Reg. UE 2024/1689; l'impatto del "Digital Omnibus"
  si verifica prima della Fase 2.

## 2. Ambito

### Incluso nella Fase 1

- Anagrafica clienti, sistemi AI per cliente, log attività.
- Roadmap a 5 tappe per cliente; tappe 1–2 operative, 3–5 visibili ma bloccate.
- Promemoria AI literacy (art. 4) per cliente.
- Backup automatico e manuale, cestino con recupero.
- Build automatica degli installer Windows e macOS (GitHub Actions).

### Escluso dalla Fase 1

- Questionario e classificazione del rischio (Fase 2).
- Generazione Word/Excel (Fase 2b).
- Analisi documentale con LLM (Fase 3).
- Auto-aggiornamento, multiutente, sincronizzazione, cifratura applicativa.

## 3. Modello dei dati

### Cliente

| Campo | Tipo | Obbligatorio | Regola |
|---|---|---|---|
| id | UUID | sì | generato |
| ragioneSociale | testo | sì | 2–200 caratteri |
| partitaIva | testo | sì | 11 cifre + cifra di controllo valida (§3.4); unica tra i clienti non nel cestino |
| settore | testo | sì | testo libero con suggerimenti |
| referenteNome | testo | sì | |
| referenteEmail | testo | no | formato email valido se presente |
| note | testo lungo | no | |
| aiLiteracyDocumentata | booleano | sì | default `false` |
| aiLiteracyData | data | no | data dell'ultima formazione documentata |
| inventarioConfermato | booleano | sì | default `false`; impostato dall'utente |
| creatoIl, modificatoIl | data-ora | sì | automatici |
| eliminatoIl | data-ora | no | valorizzato = nel cestino |

### Sistema AI

| Campo | Tipo | Obbligatorio | Regola |
|---|---|---|---|
| id | UUID | sì | generato |
| clienteId | UUID | sì | riferimento a Cliente |
| nome | testo | sì | 2–200 caratteri |
| fornitore | testo | sì | |
| scopo | testo lungo | sì | finalità d'uso |
| reparto | testo | no | |
| dataAvvio | data | no | |
| ruoloCliente | enum | sì | `fornitore`, `deployer`, `importatore`, `distributore`, `da_definire` (definizioni art. 3) |
| creatoIl, modificatoIl, eliminatoIl | data-ora | | come Cliente |

### Attività (log)

`id`, `clienteId`, `sistemaId` (opzionale), `tipo` (`creato`, `modificato`,
`eliminato`, `ripristinato`, `inventario_confermato`), `descrizione`, `quando`.
Scritto automaticamente nella stessa transazione dell'operazione che lo genera.

### 3.4 Validazione Partita IVA

11 cifre. Somma X delle cifre in posizione dispari (1,3,5,7,9); per ogni cifra in
posizione pari (2,4,6,8,10) si raddoppia e, se > 9, si sottrae 9: somma Y.
Cifra di controllo attesa = `(10 − (X + Y) mod 10) mod 10`, deve coincidere con l'11ª cifra.

## 4. Roadmap del processo

Cinque tappe fisse per cliente, ciascuna vale il 20%:

| # | Tappa | Completata quando | Fase |
|---|---|---|---|
| 1 | Anagrafica | tutti i campi obbligatori del Cliente sono validi | 1 |
| 2 | Inventario | almeno 1 sistema AI attivo **e** `inventarioConfermato = true` | 1 |
| 3 | Questionario | tutti i sistemi hanno il questionario completato | 2 (bloccata) |
| 4 | Classificazione | tutti i sistemi hanno una classificazione | 2 (bloccata) |
| 5 | Report | report Word/Excel generati | 2b (bloccata) |

Regole:

- **Avanzamento %** = numero di tappe completate × 20.
- **Stato tappa:** `completata`, `in_corso` (la prima non completata), `da_fare`, `bloccata`
  (tappe di fasi non ancora disponibili, con etichetta "disponibile dalla Fase 2").
- **Prossima azione** (testo), calcolata dalla prima tappa non completata:
  - Anagrafica → "Completa l'anagrafica: manca <campo>"
  - Inventario senza sistemi → "Aggiungi il primo sistema AI"
  - Inventario con sistemi non confermato → "Conferma l'inventario (N sistemi)"
  - Tappa bloccata → "In attesa della Fase 2"
- Se l'inventario viene confermato e poi si aggiunge o elimina un sistema,
  `inventarioConfermato` torna `false` (l'inventario va riconfermato).

### Schermate

1. **Dashboard:** elenco clienti, ciascuno con barra a 5 tappe, % e prossima azione;
   filtro per tappa corrente; ricerca per ragione sociale/P.IVA; indicatore AI literacy.
2. **Scheda cliente:** anagrafica modificabile, roadmap estesa, elenco sistemi AI,
   pulsante "Conferma inventario", log attività.
3. **Scheda sistema AI:** form di inserimento/modifica.
4. **Cestino:** elementi eliminati con data, "Ripristina", eliminazione definitiva.

## 5. Architettura

| Livello | Tecnologia | Responsabilità | Dipende da |
|---|---|---|---|
| UI | React + TypeScript (Vite) | schermate e interazione | Dominio, Archivio (tramite interfaccia) |
| Dominio | TypeScript puro + zod | tipi, validazione, calcolo roadmap e prossima azione | nulla |
| Archivio | `tauri-plugin-sql` (SQLite) | CRUD, migrazioni versionate, transazioni | Dominio (tipi) |
| Shell | Tauri 2 (Rust, minimo) | finestra, percorso dati, backup, dialoghi file | — |

- L'Archivio espone un'interfaccia TypeScript (`Repository`) con due implementazioni:
  SQLite su Tauri e SQLite in memoria per test e anteprima web. La UI non conosce
  quale sta usando.
- La Fase 2 aggiungerà il questionario nel Dominio senza modificare l'Archivio esistente.

## 6. Dati, backup, sicurezza

- **File:** `ai-act.db` nella cartella dati dell'app (`%APPDATA%` su Windows,
  `~/Library/Application Support` su macOS).
- **Backup automatico** all'avvio: copia con data-ora nella sottocartella `backup/`;
  si conservano le ultime 10 copie.
- **Esporta/Ripristina backup** manuali tramite dialogo file; prima del ripristino si
  crea un backup del database corrente.
- **Cifratura:** non applicativa; si raccomanda la cifratura del disco (BitLocker/FileVault)
  come misura tecnica ai sensi dell'art. 32 GDPR.
- **Cestino:** eliminazione logica; svuotamento automatico all'avvio degli elementi
  con `eliminatoIl` più vecchio di 30 giorni. Eliminare un cliente sposta nel cestino
  anche i suoi sistemi; ripristinarlo li ripristina.

## 7. Gestione errori

- **Validazione:** errori mostrati accanto al campo; salvataggio disabilitato finché ci sono errori.
- **Database:** ogni operazione di scrittura (incluso il log) in una transazione;
  in caso di errore rollback completo e messaggio comprensibile, nessun dato parziale.
- **Backup fallito all'avvio:** avviso non bloccante; l'app resta utilizzabile.
- **Migrazione fallita:** l'app non apre il database e propone il ripristino dell'ultimo backup.

## 8. Test

| Livello | Cosa | Strumento |
|---|---|---|
| Dominio | P.IVA valide/non valide, % roadmap, prossima azione, reset `inventarioConfermato`, scadenza cestino | Vitest (scritti prima del codice) |
| Archivio | CRUD, unicità P.IVA, transazioni e rollback, migrazioni, cestino a cascata | Vitest + SQLite in memoria |
| UI | crea cliente → 2 sistemi → conferma inventario → roadmap al 40% | Playwright sull'anteprima web |
| Build | installer Windows e macOS a ogni push | GitHub Actions |
| Manuale | checklist di 5 minuti sull'installer, eseguita dall'utente | — |

## 9. Roadmap di sviluppo

| Fase | Contenuto | Criterio di chiusura |
|---|---|---|
| 1 | Registro + roadmap (questo documento) | installer funzionante; un cliente reale inserito resta salvato dopo riavvio |
| 2 | Questionario + classificazione (art. 5, 6, 50, Allegato III) con regole in file versionati | 3 casi test (vietato, alto rischio, minimo) classificati correttamente |
| 2b | Report Word per sistema + Excel inventario per cliente | il Word si apre e si modifica in Office |
| 3 | Analisi documentale con LLM che propone risposte, confermate dall'utente | prima: decisione LLM locale vs API con DPA |

**Prerequisito della Fase 2:** verificare lo stato del "Digital Omnibus" (proposta della
Commissione, nov. 2025) per le date applicabili agli obblighi alto rischio (art. 113).

## 10. Limiti noti

- Gli installer non sono firmati: al primo avvio Windows (SmartScreen) e macOS
  (Gatekeeper) mostrano un avviso.
- Dal container di sviluppo non è possibile eseguire l'app installata: la verifica
  finale dell'installer è manuale.
