import { invoke } from '@tauri-apps/api/core';
import type { Istruzione, Parametro, SqlDriver } from './driver';

// I comandi Rust restituiscono gli errori come stringhe: li trasformiamo in Error.
async function chiama<T>(comando: string, argomenti: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(comando, argomenti);
  } catch (errore) {
    throw errore instanceof Error ? errore : new Error(String(errore));
  }
}

/** Driver su SQLite nativo tramite i comandi Tauri `db_select` / `db_batch`. */
export function creaTauriDriver(): SqlDriver {
  return {
    select<T = Record<string, Parametro>>(sql: string, params?: Parametro[]) {
      return chiama<T[]>('db_select', { sql, params: params ?? [] });
    },

    async batch(istruzioni: Istruzione[]) {
      if (istruzioni.length === 0) return;
      await chiama<void>('db_batch', {
        istruzioni: istruzioni.map((i) => ({ sql: i.sql, params: i.params ?? [] })),
      });
    },
  };
}
