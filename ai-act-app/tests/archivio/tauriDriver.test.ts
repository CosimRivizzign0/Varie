import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { creaTauriDriver } from '../../src/archivio/tauriDriver';

describe('creaTauriDriver', () => {
  beforeEach(() => invoke.mockReset());

  it('select invoca db_select con sql e parametri e restituisce le righe', async () => {
    invoke.mockResolvedValueOnce([{ id: '1', nome: "L'Officina ✓" }]);
    const righe = await creaTauriDriver().select('SELECT * FROM clienti WHERE id = ?', ['1']);
    expect(invoke).toHaveBeenCalledWith('db_select', {
      sql: 'SELECT * FROM clienti WHERE id = ?',
      params: ['1'],
    });
    expect(righe).toEqual([{ id: '1', nome: "L'Officina ✓" }]);
  });

  it('select senza parametri invia un array vuoto', async () => {
    invoke.mockResolvedValueOnce([]);
    await creaTauriDriver().select('PRAGMA user_version');
    expect(invoke).toHaveBeenCalledWith('db_select', { sql: 'PRAGMA user_version', params: [] });
  });

  it('batch invoca db_batch con tutte le istruzioni, params sempre presenti', async () => {
    invoke.mockResolvedValueOnce(null);
    await creaTauriDriver().batch([
      { sql: 'INSERT INTO t VALUES (?, ?)', params: ['a', null] },
      { sql: 'PRAGMA user_version = 1' },
    ]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('db_batch', {
      istruzioni: [
        { sql: 'INSERT INTO t VALUES (?, ?)', params: ['a', null] },
        { sql: 'PRAGMA user_version = 1', params: [] },
      ],
    });
  });

  it('batch vuoto non invoca nulla', async () => {
    await creaTauriDriver().batch([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('propaga come Error il messaggio di errore del comando', async () => {
    invoke.mockRejectedValueOnce('UNIQUE constraint failed: clienti.partita_iva');
    await expect(creaTauriDriver().batch([{ sql: 'INSERT' }])).rejects.toThrow(
      'UNIQUE constraint failed: clienti.partita_iva',
    );
  });
});
