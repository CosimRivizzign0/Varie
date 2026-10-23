//! Archivio SQLite dell'app: connessione unica protetta da mutex, batch atomici, backup.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{params_from_iter, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub type Result<T> = std::result::Result<T, String>;

pub const NON_DISPONIBILE: &str = "Database non disponibile: riavviare l'app";

/// Numero di backup `ai-act-*.db` conservati nella cartella dei backup.
pub const BACKUP_CONSERVATI: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Istruzione {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<Value>,
}

pub struct Store {
    percorso: PathBuf,
    /// `None` solo se la riapertura dopo un ripristino è fallita: ogni operazione
    /// restituisce allora [`NON_DISPONIBILE`] invece di lavorare su un database vuoto.
    connessione: Mutex<Option<Connection>>,
}

fn attiva(conn: &mut Option<Connection>) -> Result<&mut Connection> {
    conn.as_mut().ok_or_else(|| NON_DISPONIBILE.to_string())
}

fn errore(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn apri_connessione(percorso: &Path) -> Result<Connection> {
    let conn = Connection::open(percorso).map_err(errore)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(errore)?;
    Ok(conn)
}

fn percorso_str(p: &Path) -> Result<&str> {
    p.to_str()
        .ok_or_else(|| format!("Percorso non valido: {}", p.display()))
}

fn in_parametro(v: &Value) -> Result<SqlValue> {
    match v {
        Value::Null => Ok(SqlValue::Null),
        Value::Bool(b) => Ok(SqlValue::Integer(i64::from(*b))),
        Value::String(s) => Ok(SqlValue::Text(s.clone())),
        Value::Number(n) => match n.as_i64() {
            Some(i) => Ok(SqlValue::Integer(i)),
            None => n
                .as_f64()
                .map(SqlValue::Real)
                .ok_or_else(|| format!("Numero non supportato: {n}")),
        },
        _ => Err(format!("Tipo di parametro non supportato: {v}")),
    }
}

fn in_parametri(params: &[Value]) -> Result<Vec<SqlValue>> {
    params.iter().map(in_parametro).collect()
}

fn in_json(v: ValueRef<'_>) -> Result<Value> {
    match v {
        ValueRef::Null => Ok(Value::Null),
        ValueRef::Integer(i) => Ok(Value::from(i)),
        ValueRef::Real(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .ok_or_else(|| format!("Numero non rappresentabile: {f}")),
        ValueRef::Text(t) => std::str::from_utf8(t)
            .map(|s| Value::String(s.to_string()))
            .map_err(errore),
        ValueRef::Blob(_) => Err("Valori BLOB non supportati".to_string()),
    }
}

/// `VACUUM INTO` su un file temporaneo accanto a `dest`, poi rinomina:
/// sovrascrive un file esistente senza lasciare copie parziali.
fn vacuum_in(conn: &Connection, percorso_db: &Path, dest: &Path) -> Result<()> {
    if dest.exists() {
        let stesso = std::fs::canonicalize(dest).ok() == std::fs::canonicalize(percorso_db).ok();
        if stesso {
            return Err("Il backup non può sovrascrivere il database in uso.".to_string());
        }
    }
    let nome = dest
        .file_name()
        .ok_or_else(|| format!("Percorso non valido: {}", dest.display()))?
        .to_string_lossy();
    let tmp = dest.with_file_name(format!(".{nome}.tmp"));
    let _ = std::fs::remove_file(&tmp);
    let esito = conn
        .execute("VACUUM INTO ?1", [percorso_str(&tmp)?])
        .map_err(errore)
        .and_then(|_| std::fs::rename(&tmp, dest).map_err(errore));
    if esito.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    esito
}

fn nomi_backup(dir: &Path) -> Vec<String> {
    let Ok(voci) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut nomi: Vec<String> = voci
        .filter_map(|v| v.ok())
        .filter(|v| v.file_type().map(|t| t.is_file()).unwrap_or(false))
        .filter_map(|v| v.file_name().into_string().ok())
        .filter(|n| n.starts_with("ai-act-") && n.ends_with(".db"))
        .collect();
    nomi.sort();
    nomi
}

/// Copia byte per byte di `percorso_db` in `dest` (file temporaneo e poi rinomina):
/// serve quando il database è danneggiato e `VACUUM INTO` non può leggerlo.
fn copia_grezza(percorso_db: &Path, dest: &Path) -> Result<()> {
    let nome = dest
        .file_name()
        .ok_or_else(|| format!("Percorso non valido: {}", dest.display()))?
        .to_string_lossy();
    let tmp = dest.with_file_name(format!(".{nome}.tmp"));
    let esito = std::fs::copy(percorso_db, &tmp)
        .map_err(errore)
        .and_then(|_| std::fs::rename(&tmp, dest).map_err(errore));
    if esito.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    esito
}

/// Data e ora locali `YYYYMMDD-HHMMSS`, calcolate su una connessione in memoria:
/// funziona anche quando il database corrente non è leggibile.
fn ora_locale() -> Result<String> {
    Connection::open_in_memory()
        .and_then(|c| c.query_row("SELECT strftime('%Y%m%d-%H%M%S', 'now', 'localtime')", [], |r| r.get(0)))
        .map_err(errore)
}

fn backup_ruotato(conn: &Connection, percorso_db: &Path, dir: &Path, ora: &str) -> Result<PathBuf> {
    ruotato_con(dir, ora, |dest| vacuum_in(conn, percorso_db, dest))
}

/// Crea `ai-act-<ora>.db` in `dir` con `scrivi`, poi conserva solo i 10 backup più recenti.
fn ruotato_con(dir: &Path, ora: &str, scrivi: impl FnOnce(&Path) -> Result<()>) -> Result<PathBuf> {
    std::fs::create_dir_all(dir).map_err(errore)?;
    let dest = dir.join(format!("ai-act-{ora}.db"));
    scrivi(&dest)?;
    let nomi = nomi_backup(dir);
    let eccedenti = nomi.len().saturating_sub(BACKUP_CONSERVATI);
    for nome in &nomi[..eccedenti] {
        std::fs::remove_file(dir.join(nome)).map_err(errore)?;
    }
    Ok(dest)
}

fn verifica_integrita(sorgente: &Path) -> Result<()> {
    let conn = Connection::open_with_flags(
        sorgente,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Il file non è un database valido: {e}"))?;
    let esito: String = conn
        .query_row("PRAGMA quick_check", [], |r| r.get(0))
        .map_err(|e| format!("Il file non è un database valido: {e}"))?;
    if esito != "ok" {
        return Err(format!("Il file non è un database valido: {esito}"));
    }
    Ok(())
}

impl Store {
    /// Apre (o crea) il database con una connessione unica e le foreign key attive.
    pub fn apri(percorso: &Path) -> Result<Store> {
        Ok(Store {
            percorso: percorso.to_path_buf(),
            connessione: Mutex::new(Some(apri_connessione(percorso)?)),
        })
    }

    #[cfg(test)]
    fn simula_connessione_persa(&self) {
        *self.connessione.lock().unwrap() = None;
    }

    fn guardia(&self) -> Result<MutexGuard<'_, Option<Connection>>> {
        self.connessione
            .lock()
            .map_err(|_| NON_DISPONIBILE.to_string())
    }


    pub fn select(&self, sql: &str, params: &[Value]) -> Result<Vec<Map<String, Value>>> {
        let valori = in_parametri(params)?;
        let mut guardia = self.guardia()?;
        let conn = attiva(&mut guardia)?;
        let mut stmt = conn.prepare(sql).map_err(errore)?;
        let colonne: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
        let mut righe = stmt.query(params_from_iter(valori.iter())).map_err(errore)?;
        let mut out = Vec::new();
        while let Some(riga) = righe.next().map_err(errore)? {
            let mut mappa = Map::new();
            for (i, nome) in colonne.iter().enumerate() {
                mappa.insert(nome.clone(), in_json(riga.get_ref(i).map_err(errore)?)?);
            }
            out.push(mappa);
        }
        Ok(out)
    }

    /// Esegue tutte le istruzioni in una transazione: o tutte o nessuna.
    pub fn batch(&self, istruzioni: &[Istruzione]) -> Result<()> {
        let valori: Vec<Vec<SqlValue>> = istruzioni
            .iter()
            .map(|i| in_parametri(&i.params))
            .collect::<Result<_>>()?;
        let mut guardia = self.guardia()?;
        let conn = attiva(&mut guardia)?;
        // Il drop senza commit esegue il rollback.
        let tx = conn.transaction().map_err(errore)?;
        for (istruzione, params) in istruzioni.iter().zip(&valori) {
            let mut stmt = tx.prepare(&istruzione.sql).map_err(errore)?;
            let mut righe = stmt.query(params_from_iter(params.iter())).map_err(errore)?;
            while righe.next().map_err(errore)?.is_some() {}
        }
        tx.commit().map_err(errore)
    }

    /// Copia coerente del database in `dest` (`VACUUM INTO`).
    pub fn backup_in(&self, dest: &Path) -> Result<()> {
        let mut guardia = self.guardia()?;
        vacuum_in(attiva(&mut guardia)?, &self.percorso, dest)
    }

    /// Crea `ai-act-<ora>.db` in `dir` e conserva solo i 10 backup più recenti per nome.
    pub fn backup_avvio(&self, dir: &Path, ora: &str) -> Result<PathBuf> {
        let mut guardia = self.guardia()?;
        backup_ruotato(attiva(&mut guardia)?, &self.percorso, dir, ora)
    }

    /// Sostituisce il database con `sorgente` dopo averne verificato l'integrità e
    /// aver salvato un backup del database corrente in `dir_backup`.
    pub fn ripristina(&self, sorgente: &Path, dir_backup: &Path) -> Result<()> {
        let nome = self
            .percorso
            .file_name()
            .ok_or_else(|| "Percorso del database non valido".to_string())?
            .to_string_lossy();
        let tmp = self.percorso.with_file_name(format!(".{nome}.ripristino"));
        // Prima si copia e verifica la sorgente: la rotazione del backup qui sotto
        // potrebbe eliminarla, se è il backup più vecchio della cartella.
        let copia = std::fs::copy(sorgente, &tmp)
            .map_err(errore)
            .and_then(|_| verifica_integrita(&tmp));
        if let Err(e) = copia {
            let _ = std::fs::remove_file(&tmp);
            return Err(e);
        }
        let esito = self.sostituisci_con(&tmp, dir_backup);
        let _ = std::fs::remove_file(&tmp);
        esito
    }

    fn sostituisci_con(&self, tmp: &Path, dir_backup: &Path) -> Result<()> {
        let mut guardia = self.guardia()?;
        let conn = attiva(&mut guardia)?;
        let ora = ora_locale()?;
        if let Err(e_vacuum) = backup_ruotato(conn, &self.percorso, dir_backup, &ora) {
            // Database corrente danneggiato ("file is not a database"): VACUUM INTO non
            // può leggerlo, ma il ripristino deve comunque poter procedere. Se ne
            // conserva una copia grezza con lo stesso nome e la stessa rotazione.
            ruotato_con(dir_backup, &ora, |dest| copia_grezza(&self.percorso, dest)).map_err(|e| {
                format!("Impossibile salvare una copia del database corrente prima del ripristino: {e_vacuum}; {e}")
            })?;
        }

        // Chiude la connessione corrente prima di sostituire il file.
        if let Some(vecchia) = guardia.take() {
            if let Err((c, e)) = vecchia.close() {
                *guardia = Some(c);
                return Err(errore(e));
            }
        }
        let sostituzione = std::fs::rename(tmp, &self.percorso).map_err(errore);
        // Riapre il file: quello nuovo, o l'originale se la sostituzione è fallita.
        // Se la riapertura fallisce la connessione resta None: errore esplicito ovunque.
        let riaperta = apri_connessione(&self.percorso)
            .map_err(|e| format!("{NON_DISPONIBILE} ({e})"))?;
        *guardia = Some(riaperta);
        sostituzione
    }
}

/// Come [`ultimo_backup`], ma salta i file in `esclusi` (per esempio le copie del
/// database corrente fatte in questa sessione, che non servono a ripararlo).
pub fn ultimo_backup_escludendo(dir: &Path, esclusi: &[PathBuf]) -> Option<PathBuf> {
    nomi_backup(dir)
        .into_iter()
        .rev()
        .map(|n| dir.join(n))
        .find(|p| !esclusi.contains(p))
}

/// Il backup `ai-act-*.db` più recente (per nome) in `dir`, se esiste.
pub fn ultimo_backup(dir: &Path) -> Option<PathBuf> {
    ultimo_backup_escludendo(dir, &[])
}

#[cfg(test)]
mod test {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    fn store_con_tabella(dir: &TempDir) -> Store {
        let store = Store::apri(&dir.path().join("ai-act.db")).unwrap();
        store
            .batch(&[ist("CREATE TABLE t (id INTEGER PRIMARY KEY, testo TEXT NOT NULL)", vec![])])
            .unwrap();
        store
    }

    fn ist(sql: &str, params: Vec<Value>) -> Istruzione {
        Istruzione { sql: sql.to_string(), params }
    }

    fn testi(store: &Store) -> Vec<String> {
        store
            .select("SELECT testo FROM t ORDER BY id", &[])
            .unwrap()
            .into_iter()
            .map(|r| r["testo"].as_str().unwrap().to_string())
            .collect()
    }

    fn file_backup(dir: &Path) -> Vec<String> {
        let mut nomi: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        nomi.sort();
        nomi
    }

    #[test]
    fn batch_con_secondo_statement_non_valido_non_inserisce_nulla() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        let esito = store.batch(&[
            ist("INSERT INTO t (testo) VALUES (?)", vec![json!("uno")]),
            ist("INSERT INTO tabella_inesistente VALUES (1)", vec![]),
        ]);
        assert!(esito.is_err());
        assert!(testi(&store).is_empty());
        // La connessione resta utilizzabile dopo il rollback.
        store
            .batch(&[ist("INSERT INTO t (testo) VALUES (?)", vec![json!("due")])])
            .unwrap();
        assert_eq!(testi(&store), vec!["due"]);
    }

    #[test]
    fn select_restituisce_utf8_identico_e_tipi_json() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        let testo = "L'Officina Società ✓ 🚀";
        store
            .batch(&[ist("INSERT INTO t (id, testo) VALUES (?, ?)", vec![json!(7), json!(testo)])])
            .unwrap();
        let righe = store
            .select("SELECT id, testo, 1.5 AS reale, NULL AS nullo FROM t WHERE testo = ?", &[json!(testo)])
            .unwrap();
        assert_eq!(righe.len(), 1);
        assert_eq!(righe[0]["id"], json!(7));
        assert_eq!(righe[0]["testo"], json!(testo));
        assert_eq!(righe[0]["reale"], json!(1.5));
        assert_eq!(righe[0]["nullo"], Value::Null);
    }

    #[test]
    fn parametri_bool_diventano_interi_e_tipi_non_ammessi_sono_rifiutati() {
        let dir = TempDir::new().unwrap();
        let store = Store::apri(&dir.path().join("ai-act.db")).unwrap();
        let righe = store.select("SELECT ? AS v", &[json!(true)]).unwrap();
        assert_eq!(righe[0]["v"], json!(1));
        assert!(store.select("SELECT ? AS v", &[json!([1, 2])]).is_err());
        assert!(store.select("SELECT x'00' AS b", &[]).is_err());
    }

    #[test]
    fn foreign_keys_attive() {
        let dir = TempDir::new().unwrap();
        let store = Store::apri(&dir.path().join("ai-act.db")).unwrap();
        let righe = store.select("PRAGMA foreign_keys", &[]).unwrap();
        assert_eq!(righe[0]["foreign_keys"], json!(1));
    }

    #[test]
    fn backup_avvio_tiene_i_10_piu_recenti() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        let dir_backup = dir.path().join("backup");
        std::fs::create_dir_all(&dir_backup).unwrap();
        std::fs::write(dir_backup.join("altro.txt"), "non toccare").unwrap();
        for i in 0..12 {
            let ora = format!("20261023-1200{:02}", i);
            let creato = store.backup_avvio(&dir_backup, &ora).unwrap();
            assert_eq!(creato, dir_backup.join(format!("ai-act-{ora}.db")));
            assert!(creato.exists());
        }
        let nomi = file_backup(&dir_backup);
        let db: Vec<&String> = nomi.iter().filter(|n| n.ends_with(".db")).collect();
        assert_eq!(db.len(), 10);
        assert!(!nomi.contains(&"ai-act-20261023-120000.db".to_string()));
        assert!(!nomi.contains(&"ai-act-20261023-120001.db".to_string()));
        assert!(nomi.contains(&"ai-act-20261023-120002.db".to_string()));
        assert!(nomi.contains(&"ai-act-20261023-120011.db".to_string()));
        assert!(nomi.contains(&"altro.txt".to_string()));
        assert_eq!(
            ultimo_backup(&dir_backup),
            Some(dir_backup.join("ai-act-20261023-120011.db"))
        );
    }

    #[test]
    fn backup_avvio_crea_la_cartella_se_manca() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        let dir_backup = dir.path().join("backup");
        store.backup_avvio(&dir_backup, "20261023-120000").unwrap();
        assert_eq!(file_backup(&dir_backup), vec!["ai-act-20261023-120000.db"]);
    }

    #[test]
    fn ultimo_backup_senza_file_restituisce_none() {
        let dir = TempDir::new().unwrap();
        assert_eq!(ultimo_backup(&dir.path().join("inesistente")), None);
        std::fs::write(dir.path().join("altro.db"), "x").unwrap();
        assert_eq!(ultimo_backup(dir.path()), None);
    }

    #[test]
    fn ultimo_backup_escludendo_salta_i_file_esclusi() {
        let dir = TempDir::new().unwrap();
        for nome in ["ai-act-20261020-090000.db", "ai-act-20261021-090000.db", "ai-act-20261022-090000.db"] {
            std::fs::write(dir.path().join(nome), "x").unwrap();
        }
        let p = |n: &str| dir.path().join(n);
        assert_eq!(ultimo_backup_escludendo(dir.path(), &[]), Some(p("ai-act-20261022-090000.db")));
        assert_eq!(
            ultimo_backup_escludendo(dir.path(), &[p("ai-act-20261022-090000.db")]),
            Some(p("ai-act-20261021-090000.db"))
        );
        assert_eq!(
            ultimo_backup_escludendo(
                dir.path(),
                &[p("ai-act-20261022-090000.db"), p("ai-act-20261021-090000.db"), p("ai-act-20261020-090000.db")]
            ),
            None
        );
    }

    #[test]
    fn ripristina_da_file_di_testo_fallisce_e_lascia_i_dati_intatti() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        store
            .batch(&[ist("INSERT INTO t (testo) VALUES (?)", vec![json!("originale")])])
            .unwrap();
        let falso = dir.path().join("falso.db");
        std::fs::write(&falso, "questo non è un database SQLite, solo testo").unwrap();
        let dir_backup = dir.path().join("backup");
        assert!(store.ripristina(&falso, &dir_backup).is_err());
        assert_eq!(testi(&store), vec!["originale"]);
        assert!(!dir_backup.exists() || file_backup(&dir_backup).is_empty());
        // Anche riaprendo il file, i dati sono invariati.
        drop(store);
        let riaperto = Store::apri(&dir.path().join("ai-act.db")).unwrap();
        assert_eq!(testi(&riaperto), vec!["originale"]);
    }

    #[test]
    fn ripristina_il_backup_piu_vecchio_con_10_backup_presenti() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        let dir_backup = dir.path().join("backup");
        for i in 0..10 {
            store
                .batch(&[ist("INSERT INTO t (testo) VALUES (?)", vec![json!(format!("riga {i}"))])])
                .unwrap();
            store.backup_avvio(&dir_backup, &format!("20000101-0000{:02}", i)).unwrap();
        }
        let piu_vecchio = dir_backup.join("ai-act-20000101-000000.db");
        store.ripristina(&piu_vecchio, &dir_backup).unwrap();
        assert_eq!(testi(&store), vec!["riga 0"]);
        let db: Vec<String> = file_backup(&dir_backup).into_iter().filter(|n| n.ends_with(".db")).collect();
        assert_eq!(db.len(), 10);
    }

    #[test]
    fn ripristina_con_database_corrente_danneggiato_salva_una_copia_grezza_e_procede() {
        let dir = TempDir::new().unwrap();
        let percorso = dir.path().join("ai-act.db");
        let valido = dir.path().join("valido.db");
        {
            let store = store_con_tabella(&dir);
            store
                .batch(&[ist("INSERT INTO t (testo) VALUES (?)", vec![json!("dal backup")])])
                .unwrap();
            store.backup_in(&valido).unwrap();
        }
        let spazzatura: Vec<u8> = b"questo file non e' un database SQLite ".repeat(200);
        std::fs::write(&percorso, &spazzatura).unwrap();
        let store = Store::apri(&percorso).unwrap();
        assert!(store.select("SELECT * FROM t", &[]).is_err());

        let dir_backup = dir.path().join("backup");
        store.ripristina(&valido, &dir_backup).unwrap();
        assert_eq!(testi(&store), vec!["dal backup"]);
        let backup = file_backup(&dir_backup);
        assert_eq!(backup.len(), 1);
        assert!(backup[0].starts_with("ai-act-") && backup[0].ends_with(".db"));
        assert_eq!(std::fs::read(dir_backup.join(&backup[0])).unwrap(), spazzatura);
        assert_eq!(ultimo_backup(&dir_backup), Some(dir_backup.join(&backup[0])));
    }

    #[test]
    fn connessione_persa_restituisce_errore_esplicito() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        store.simula_connessione_persa();
        let atteso = Err(NON_DISPONIBILE.to_string());
        assert_eq!(store.select("SELECT 1", &[]).map(|_| ()), atteso);
        assert_eq!(store.batch(&[ist("INSERT INTO t (testo) VALUES ('x')", vec![])]), atteso);
        assert_eq!(store.backup_in(&dir.path().join("copia.db")), atteso);
        assert_eq!(store.backup_avvio(&dir.path().join("backup"), "20261023-120000").map(|_| ()), atteso);
        assert!(!dir.path().join("copia.db").exists());
    }

    #[test]
    fn ripristina_da_backup_valido_mostra_i_dati_del_backup() {
        let dir = TempDir::new().unwrap();
        let store = store_con_tabella(&dir);
        store
            .batch(&[ist("INSERT INTO t (testo) VALUES (?)", vec![json!("nel backup")])])
            .unwrap();
        let esportato = dir.path().join("esportato.db");
        store.backup_in(&esportato).unwrap();
        store
            .batch(&[ist("INSERT INTO t (testo) VALUES (?)", vec![json!("dopo il backup")])])
            .unwrap();
        assert_eq!(testi(&store), vec!["nel backup", "dopo il backup"]);

        let dir_backup = dir.path().join("backup");
        store.ripristina(&esportato, &dir_backup).unwrap();
        assert_eq!(testi(&store), vec!["nel backup"]);
        let backup = file_backup(&dir_backup);
        assert_eq!(backup.len(), 1);
        assert!(backup[0].starts_with("ai-act-") && backup[0].ends_with(".db"));
        // Il backup pre-ripristino contiene lo stato precedente.
        let precedente = Store::apri(&dir_backup.join(&backup[0])).unwrap();
        assert_eq!(testi(&precedente), vec!["nel backup", "dopo il backup"]);
        // La connessione riaperta accetta scritture e mantiene le FK.
        store
            .batch(&[ist("INSERT INTO t (testo) VALUES (?)", vec![json!("nuovo")])])
            .unwrap();
        assert_eq!(testi(&store), vec!["nel backup", "nuovo"]);
        assert_eq!(store.select("PRAGMA foreign_keys", &[]).unwrap()[0]["foreign_keys"], json!(1));
    }
}
