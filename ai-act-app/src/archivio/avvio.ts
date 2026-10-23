import { invoke } from '@tauri-apps/api/core';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { SqlDriver } from './driver';
import { creaSqlJsDriver } from './sqljsDriver';
import { creaTauriDriver } from './tauriDriver';

/** Vero dentro l'app desktop; falso nell'anteprima web (sql.js in memoria, niente backup). */
export function ambienteTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Ricarica la pagina: riparte da migra() sul database appena ripristinato. */
export function ricarica(): void {
  location.reload();
}

export async function creaDriver(): Promise<SqlDriver> {
  return ambienteTauri() ? creaTauriDriver() : creaSqlJsDriver({ wasmUrl });
}

// Comandi di backup: disponibili solo con ambienteTauri().
async function comando<T>(nome: string, argomenti?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(nome, argomenti);
  } catch (errore) {
    throw errore instanceof Error ? errore : new Error(String(errore));
  }
}

export function statoAvvio(): Promise<{ erroreBackup: string | null }> {
  return comando('stato_avvio');
}

export function esportaBackup(dest: string): Promise<void> {
  return comando('esporta_backup', { dest });
}

export function ripristinaBackup(sorgente: string): Promise<void> {
  return comando('ripristina_backup', { sorgente });
}

export function ripristinaUltimoBackup(): Promise<void> {
  return comando('ripristina_ultimo_backup');
}
