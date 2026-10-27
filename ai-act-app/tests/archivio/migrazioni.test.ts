import { describe, expect, it } from 'vitest';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { MIGRAZIONI, migra } from '../../src/archivio/migrazioni';

describe('migra', () => {
  it('su db vuoto porta a versione 3, è idempotente e crea le tabelle', async () => {
    const driver = await creaSqlJsDriver();
    expect(await migra(driver)).toBe(3);
    expect(await migra(driver)).toBe(3);
    const tabelle = await driver.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const nomi = tabelle.map((t) => t.name);
    expect(nomi).toEqual(expect.arrayContaining(['clienti', 'sistemi', 'attivita', 'valutazioni', 'impostazioni', 'report']));
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

describe('migrazione 2', () => {
  it('da un db alla versione 1 con dati Fase 1 mantiene i dati e crea valutazioni', async () => {
    const driver = await creaSqlJsDriver();
    await driver.batch([...MIGRAZIONI[0], { sql: 'PRAGMA user_version = 1' }]);
    await driver.batch([
      {
        sql: `INSERT INTO clienti (id, ragione_sociale, partita_iva, settore, referente_nome,
          creato_il, modificato_il) VALUES ('c', 'X', '00488410010', 'S', 'R', 'c', 'm')`,
      },
      {
        sql: `INSERT INTO sistemi (id, cliente_id, nome, fornitore, scopo, ruolo_cliente,
          creato_il, modificato_il) VALUES ('s', 'c', 'n', 'f', 'sc', 'deployer', 'c', 'm')`,
      },
    ]);
    expect(await migra(driver)).toBe(3);
    expect((await driver.select('SELECT id FROM clienti')).length).toBe(1);
    expect((await driver.select('SELECT id FROM sistemi')).length).toBe(1);
    const ins = (id: string, stato = 'in_corso', sost: string | null = null) => ({
      sql: `INSERT INTO valutazioni (id, sistema_id, versione_regole, risposte, stato, creato_il, modificato_il, sostituita_il)
        VALUES (?, 's', '1', '{}', ?, 'c', 'm', ?)`,
      params: [id, stato, sost],
    });
    await driver.batch([ins('v1')]);
    await expect(driver.batch([ins('v2')])).rejects.toThrow();
    await driver.batch([ins('v3', 'in_corso', 'ieri')]);
    await expect(driver.batch([ins('v4', 'boh', 'ieri')])).rejects.toThrow();
  });
});

describe('migrazione 3', () => {
  it('da un db alla versione 2 con dati mantiene i dati e crea impostazioni e report', async () => {
    const driver = await creaSqlJsDriver();
    await driver.batch([...MIGRAZIONI[0], { sql: 'PRAGMA user_version = 1' }]);
    await driver.batch([...MIGRAZIONI[1], { sql: 'PRAGMA user_version = 2' }]);
    await driver.batch([
      {
        sql: `INSERT INTO clienti (id, ragione_sociale, partita_iva, settore, referente_nome,
          creato_il, modificato_il) VALUES ('c', 'X', '00488410010', 'S', 'R', 'c', 'm')`,
      },
      {
        sql: `INSERT INTO sistemi (id, cliente_id, nome, fornitore, scopo, ruolo_cliente,
          creato_il, modificato_il) VALUES ('s', 'c', 'n', 'f', 'sc', 'deployer', 'c', 'm')`,
      },
      {
        sql: `INSERT INTO valutazioni (id, sistema_id, versione_regole, risposte, stato, creato_il, modificato_il)
          VALUES ('v', 's', '1', '{}', 'in_corso', 'c', 'm')`,
      },
    ]);
    expect(await migra(driver)).toBe(3);
    expect((await driver.select('SELECT id FROM clienti')).length).toBe(1);
    expect((await driver.select('SELECT id FROM sistemi')).length).toBe(1);
    expect((await driver.select('SELECT id FROM valutazioni')).length).toBe(1);
    expect((await driver.select('SELECT * FROM impostazioni')).length).toBe(0);
    const rep = (id: string, tipo: string, cliente = 'c') => ({
      sql: `INSERT INTO report (id, cliente_id, tipo, nome_file, creato_il) VALUES (?, ?, ?, 'f', 'q')`,
      params: [id, cliente, tipo],
    });
    await driver.batch([rep('r1', 'word')]);
    await expect(driver.batch([rep('r2', 'pdf')])).rejects.toThrow();
    await expect(driver.batch([rep('r3', 'word', 'inesistente')])).rejects.toThrow();
  });
});
