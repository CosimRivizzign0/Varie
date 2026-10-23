// Nessuna finestra console su Windows nelle build di rilascio.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod comandi;

use std::sync::Mutex;

use ai_act_store::Store;
use tauri::Manager;

use comandi::Stato;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir_dati = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir_dati)?;
            let store = Store::apri(&dir_dati.join("ai-act.db"))?;
            let dir_backup = dir_dati.join("backup");
            let ora = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
            // Un backup fallito non blocca l'avvio: l'errore arriva alla UI via `stato_avvio`.
            let (errore_backup, esclusi) = match store.backup_avvio(&dir_backup, &ora) {
                Ok(copia) => (None, vec![copia]),
                Err(e) => (Some(e), Vec::new()),
            };
            app.manage(Stato {
                store,
                dir_backup,
                errore_backup,
                esclusi: Mutex::new(esclusi),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            comandi::db_select,
            comandi::db_batch,
            comandi::esporta_backup,
            comandi::scrivi_file,
            comandi::ripristina_backup,
            comandi::ripristina_ultimo_backup,
            comandi::stato_avvio,
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio di AI Act Assessment");
}
