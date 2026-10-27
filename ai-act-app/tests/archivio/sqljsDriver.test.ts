import { describe, expect, it } from 'vitest';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';

async function nuovoDriver() {
  const driver = await creaSqlJsDriver();
  await driver.batch([
    { sql: 'CREATE TABLE t (id TEXT PRIMARY KEY, nome TEXT NOT NULL, n INTEGER, nota TEXT)' },
  ]);
  return driver;
}

describe('sqljsDriver', () => {
  it('batch fallito fa rollback completo', async () => {
    const driver = await nuovoDriver();
    await expect(
      driver.batch([
        { sql: 'INSERT INTO t (id, nome) VALUES (?, ?)', params: ['a', 'uno'] },
        { sql: 'INSERT INTO t (id, nome) VALUES (?, ?)', params: ['b', null] },
      ]),
    ).rejects.toThrow();
    const righe = await driver.select<{ c: number }>('SELECT count(*) AS c FROM t');
    expect(righe[0].c).toBe(0);
  });

  it('select con parametro con apostrofo restituisce la riga', async () => {
    const driver = await nuovoDriver();
    await driver.batch([
      { sql: 'INSERT INTO t (id, nome, n) VALUES (?, ?, ?)', params: ['a', "L'Officina", 3] },
    ]);
    const righe = await driver.select('SELECT * FROM t WHERE nome = ?', ["L'Officina"]);
    expect(righe).toEqual([{ id: 'a', nome: "L'Officina", n: 3, nota: null }]);
  });

  it('batch vuoto è un no-op', async () => {
    const driver = await nuovoDriver();
    await expect(driver.batch([])).resolves.toBeUndefined();
  });

  it('testi con accenti ed emoji sono riletti identici', async () => {
    const driver = await nuovoDriver();
    const nome = "L'Officina Società ✓ 🚀";
    await driver.batch([{ sql: 'INSERT INTO t (id, nome) VALUES (?, ?)', params: ['a', nome] }]);
    const righe = await driver.select<{ nome: string }>('SELECT nome FROM t');
    expect(righe[0].nome).toBe(nome);
  });
});
