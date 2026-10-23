import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { SqlDriver } from './driver';
import { creaSqlJsDriver } from './sqljsDriver';

// Il driver Tauri arriva nel Task 9; fino ad allora si usa solo sql.js.
export async function creaDriver(): Promise<SqlDriver> {
  return creaSqlJsDriver({ wasmUrl });
}
