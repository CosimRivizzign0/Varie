import initSqlJs from 'sql.js';
import type { Istruzione, Parametro, SqlDriver } from './driver';

export async function creaSqlJsDriver(opzioni?: { wasmUrl?: string }): Promise<SqlDriver> {
  const wasmUrl = opzioni?.wasmUrl;
  const SQL = await initSqlJs(wasmUrl ? { locateFile: () => wasmUrl } : undefined);
  const db = new SQL.Database();
  // Fuori da qualsiasi transazione, altrimenti il pragma è ignorato.
  db.run('PRAGMA foreign_keys = ON');

  return {
    async select<T = Record<string, Parametro>>(sql: string, params: Parametro[] = []) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const righe: T[] = [];
        while (stmt.step()) righe.push(stmt.getAsObject() as T);
        return righe;
      } finally {
        stmt.free();
      }
    },

    async batch(istruzioni: Istruzione[]) {
      if (istruzioni.length === 0) return;
      db.run('BEGIN');
      try {
        for (const { sql, params } of istruzioni) db.run(sql, params ?? []);
        db.run('COMMIT');
      } catch (errore) {
        try {
          db.run('ROLLBACK');
        } catch {
          // nessuna transazione attiva: niente da annullare
        }
        throw errore;
      }
    },
  };
}
