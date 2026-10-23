import { describe, expect, it } from 'vitest';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { MIGRAZIONI, migra } from '../../src/archivio/migrazioni';

describe('migra', () => {
  it('su db vuoto porta a versione 1, è idempotente e crea le tabelle', async () => {
    const driver = await creaSqlJsDriver();
    expect(await migra(driver)).toBe(1);
    expect(await migra(driver)).toBe(1);
    const tabelle = await driver.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const nomi = tabelle.map((t) => t.name);
    expect(nomi).toEqual(expect.arrayContaining(['clienti', 'sistemi', 'attivita']));
  });

  it('applica i vincoli: P.IVA unica tra attivi, ruolo e tipo validi, FK', async () => {
    const driver = await creaSqlJsDriver();
    await migra(driver);
    const ins = (id: string, piva: string, eliminato: string | null = null) => ({
      sql: `INSERT INTO clienti (id, ragione_sociale, partita_iva, settore, referente_nome,
        creato_il, modificato_il, eliminato_il) VALUES (?, 'X', ?, 'S', 'R', 'c', 'm', ?)`,
      params: [id, piva, eliminato],
    });
    await driver.batch([ins('1', '00488410010')]);
    await expect(driver.batch([ins('2', '00488410010')])).rejects.toThrow();
    await driver.batch([ins('3', '00488410010', 'ieri')]);
    await expect(
      driver.batch([
        {
          sql: `INSERT INTO sistemi (id, cliente_id, nome, fornitore, scopo, ruolo_cliente,
            creato_il, modificato_il) VALUES ('s', '1', 'n', 'f', 'sc', 'boh', 'c', 'm')`,
        },
      ]),
    ).rejects.toThrow();
    await expect(
      driver.batch([
        {
          sql: `INSERT INTO attivita (id, cliente_id, tipo, descrizione, quando)
            VALUES ('a', 'inesistente', 'creato', 'd', 'q')`,
        },
      ]),
    ).rejects.toThrow();
  });
});

describe('migra con database di una versione più recente', () => {
  it('rifiuta user_version maggiore delle migrazioni note', async () => {
    const driver = await creaSqlJsDriver();
    await migra(driver);
    await driver.batch([{ sql: `PRAGMA user_version = ${MIGRAZIONI.length + 1}` }]);
    await expect(migra(driver)).rejects.toThrow(
      'Il backup proviene da una versione più recente dell\'app.',
    );
  });
});
