//! Comandi Tauri invocati dal frontend (`src/archivio/tauriDriver.ts` e la UI di backup).

use std::path::PathBuf;
use std::sync::Mutex;

use ai_act_store::{ultimo_backup, ultimo_backup_escludendo, Istruzione, Store};
use serde::Serialize;
use serde_json::{Map, Value};
use tauri::State;

pub struct Stato {
    pub store: Store,
    pub dir_backup: PathBuf,
    /// Errore del backup automatico all'avvio, mostrato come avviso non bloccante.
    pub errore_backup: Option<String>,
    /// Backup da non proporre in `ripristina_ultimo_backup`: copie del database che
    /// sta fallendo (quella fatta all'avvio) e backup già ripristinati senza successo.
    pub esclusi: Mutex<Vec<PathBuf>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatoAvvio {
    errore_backup: Option<String>,
}

fn esclusi(stato: &Stato) -> Result<std::sync::MutexGuard<'_, Vec<PathBuf>>, String> {
    stato
        .esclusi
        .lock()
        .map_err(|_| "Stato dei backup non disponibile".to_string())
}

#[tauri::command]
pub async fn db_select(
    stato: State<'_, Stato>,
    sql: String,
    params: Vec<Value>,
) -> Result<Vec<Map<String, Value>>, String> {
    stato.store.select(&sql, &params)
}

#[tauri::command]
pub async fn db_batch(stato: State<'_, Stato>, istruzioni: Vec<Istruzione>) -> Result<(), String> {
    stato.store.batch(&istruzioni)
}

#[tauri::command]
pub async fn esporta_backup(stato: State<'_, Stato>, dest: PathBuf) -> Result<(), String> {
    stato.store.backup_in(&dest)
}

#[tauri::command]
pub async fn ripristina_backup(stato: State<'_, Stato>, sorgente: PathBuf) -> Result<(), String> {
    let mut esclusi = esclusi(&stato)?;
    stato.store.ripristina(&sorgente, &stato.dir_backup)?;
    // Il backup più recente ora è la copia del database sostituito: se il file
    // ripristinato non si apre, è proprio quella da proporre.
    esclusi.clear();
    Ok(())
}

#[tauri::command]
pub async fn ripristina_ultimo_backup(stato: State<'_, Stato>) -> Result<(), String> {
    let mut esclusi = esclusi(&stato)?;
    let sorgente = ultimo_backup_escludendo(&stato.dir_backup, &esclusi)
        .ok_or_else(|| "Nessun backup disponibile.".to_string())?;
    stato.store.ripristina(&sorgente, &stato.dir_backup)?;
    // La copia appena creata è del database che non si apriva; se anche `sorgente`
    // fallisce, il prossimo tentativo passa al backup precedente.
    if let Some(copia) = ultimo_backup(&stato.dir_backup) {
        esclusi.push(copia);
    }
    esclusi.push(sorgente);
    Ok(())
}

#[tauri::command]
pub fn stato_avvio(stato: State<'_, Stato>) -> StatoAvvio {
    StatoAvvio {
        errore_backup: stato.errore_backup.clone(),
    }
}
