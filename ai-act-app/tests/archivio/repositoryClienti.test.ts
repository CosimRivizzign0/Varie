import { beforeEach, describe, expect, it } from 'vitest';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { migra } from '../../src/archivio/migrazioni';
import type { SqlDriver } from '../../src/archivio/driver';
import { creaRepository, type Repository } from '../../src/archivio/repository';
import { ErrorePartitaIvaDuplicata, ErroreValidazione, ErroreNonTrovato } from '../../src/archivio/errori';

const input = (o: Record<string, unknown> = {}) => ({
  ragioneSociale: 'Acme Srl',
  partitaIva: '00488410010',
  settore: 'Manifattura',
  referenteNome: 'Mario Rossi',
  referenteEmail: 'mario@acme.it',
  note: null,
  aiLiteracyDocumentata: true,
  aiLiteracyData: '2026-01-10',
  ...o,
});

let driver: SqlDriver;
let adesso: Date;
let n: number;
let repo: Repository;

beforeEach(async () => {
  driver = await creaSqlJsDriver();
  await migra(driver);
  adesso = new Date('2026-10-01T10:00:00.000Z');
  n = 0;
  repo = creaRepository(driver, { ora: () => adesso, nuovoId: () => `id${++n}` });
});

const sistema = (id: string, clienteId: string, eliminato: string | null) =>
  driver.batch([
    {
      sql: `INSERT INTO sistemi (id, cliente_id, nome, fornitore, scopo, ruolo_cliente, creato_il, modificato_il, eliminato_il)
            VALUES (?, ?, ?, 'F', 'S', 'deployer', 'c', 'm', ?)`,
      params: [id, clienteId, `Sistema ${id}`, eliminato],
    },
  ]);

describe('repository clienti', () => {
  it('crea e rilegge, con una voce di attività', async () => {
    const c = await repo.creaCliente(input());
    expect(await repo.getCliente(c.id)).toEqual(c);
    expect(c).toMatchObject({ ragioneSociale: 'Acme Srl', inventarioConfermato: false, eliminatoIl: null });
    const att = await repo.elencaAttivita(c.id);
    expect(att).toHaveLength(1);
    expect(att[0]).toMatchObject({ tipo: 'creato', descrizione: 'Cliente creato' });
  });

  it('testi con apostrofi, accenti ed emoji restano identici', async () => {
    const c = await repo.creaCliente(input({ ragioneSociale: "L'Officina Società ✓" }));
    expect((await repo.getCliente(c.id))?.ragioneSociale).toBe("L'Officina Società ✓");
  });

  it('P.IVA duplicata tra attivi', async () => {
    await repo.creaCliente(input());
    await expect(repo.creaCliente(input({ ragioneSociale: 'Altro' }))).rejects.toBeInstanceOf(
      ErrorePartitaIvaDuplicata,
    );
  });

  it('input non valido: ErroreValidazione e nessuna riga', async () => {
    const e = await repo.creaCliente(input({ partitaIva: '123' })).catch((x) => x);
    expect(e).toBeInstanceOf(ErroreValidazione);
    expect(e.errori).toHaveProperty('partitaIva');
    expect(await driver.select('SELECT * FROM clienti')).toHaveLength(0);
    expect(await driver.select('SELECT * FROM attivita')).toHaveLength(0);
  });

  it('aggiorna e registra attività; id inesistente non trovato', async () => {
    const c = await repo.creaCliente(input());
    adesso = new Date('2026-10-02T10:00:00.000Z');
    const a = await repo.aggiornaCliente(c.id, input({ settore: 'Servizi' }));
    expect(a.settore).toBe('Servizi');
    expect(a.modificatoIl).toBe('2026-10-02T10:00:00.000Z');
    expect(a.creatoIl).toBe(c.creatoIl);
    expect((await repo.elencaAttivita(c.id))[0].descrizione).toBe('Anagrafica modificata');
    await expect(repo.aggiornaCliente('zz', input())).rejects.toBeInstanceOf(ErroreNonTrovato);
  });

  it('elenco ordinato senza distinzione di maiuscole', async () => {
    await repo.creaCliente(input({ ragioneSociale: 'beta', partitaIva: '00743110157' }));
    await repo.creaCliente(input({ ragioneSociale: 'Alfa' }));
    expect((await repo.elencaClienti()).map((c) => c.ragioneSociale)).toEqual(['Alfa', 'beta']);
  });

  it('elimina: sparisce, compare nel cestino, sistemi seguono', async () => {
    const c = await repo.creaCliente(input());
    await sistema('S1', c.id, null);
    await repo.eliminaCliente(c.id);
    expect(await repo.elencaClienti()).toHaveLength(0);
    const cestino = await repo.elencaCestino();
    expect(cestino.map((e) => [e.tipo, e.id, e.clienteNome])).toEqual(
      expect.arrayContaining([['cliente', c.id, null], ['sistema', 'S1', 'Acme Srl']]),
    );
    await expect(repo.eliminaCliente(c.id)).rejects.toBeInstanceOf(ErroreNonTrovato);
    expect((await repo.elencaAttivita(c.id))[0].descrizione).toBe('Cliente spostato nel cestino');
  });

  it('ripristino: S1 eliminato prima resta nel cestino, S2 torna', async () => {
    const c = await repo.creaCliente(input());
    await sistema('S1', c.id, '2026-09-01T00:00:00.000Z');
    await sistema('S2', c.id, null);
    await repo.eliminaCliente(c.id);
    adesso = new Date('2026-10-05T00:00:00.000Z');
    await repo.ripristinaCliente(c.id);
    const righe = await driver.select<{ id: string; eliminato_il: string | null }>(
      'SELECT id, eliminato_il FROM sistemi ORDER BY id',
    );
    expect(righe).toEqual([
      { id: 'S1', eliminato_il: '2026-09-01T00:00:00.000Z' },
      { id: 'S2', eliminato_il: null },
    ]);
    expect((await repo.elencaAttivita(c.id))[0].descrizione).toBe('Cliente ripristinato');
    await expect(repo.ripristinaCliente(c.id)).rejects.toBeInstanceOf(ErroreNonTrovato);
  });

  it('ripristino con P.IVA ora usata da un attivo: errore e A resta nel cestino', async () => {
    const a = await repo.creaCliente(input());
    await repo.eliminaCliente(a.id);
    await repo.creaCliente(input({ ragioneSociale: 'Beta Srl' }));
    await expect(repo.ripristinaCliente(a.id)).rejects.toBeInstanceOf(ErrorePartitaIvaDuplicata);
    expect((await repo.getCliente(a.id))?.eliminatoIl).not.toBeNull();
  });

  it('eliminaDefinitivamente cancella cliente, sistemi e attività', async () => {
    const c = await repo.creaCliente(input());
    await sistema('S1', c.id, null);
    await expect(repo.eliminaDefinitivamente('cliente', c.id)).rejects.toBeInstanceOf(ErroreNonTrovato);
    await repo.eliminaCliente(c.id);
    await repo.eliminaDefinitivamente('cliente', c.id);
    for (const t of ['clienti', 'sistemi', 'attivita'])
      expect(await driver.select(`SELECT * FROM ${t}`)).toHaveLength(0);
  });

  it('eliminaDefinitivamente di un sistema', async () => {
    const c = await repo.creaCliente(input());
    await sistema('S1', c.id, '2026-09-01T00:00:00.000Z');
    await repo.eliminaDefinitivamente('sistema', 'S1');
    expect(await driver.select('SELECT * FROM sistemi')).toHaveLength(0);
  });

  it('svuotaCestinoScaduto dopo 31 giorni', async () => {
    const c = await repo.creaCliente(input());
    await sistema('S1', c.id, null);
    await repo.eliminaCliente(c.id);
    adesso = new Date(adesso.getTime() + 31 * 86400000);
    expect(await repo.svuotaCestinoScaduto()).toBe(1);
    expect(await repo.getCliente(c.id)).toBeNull();
    expect(await driver.select('SELECT * FROM sistemi')).toHaveLength(0);
    expect(await repo.svuotaCestinoScaduto()).toBe(0);
  });

  it('svuotaCestinoScaduto: sistema scaduto di cliente attivo, cliente resta', async () => {
    const c = await repo.creaCliente(input());
    await sistema('S1', c.id, '2026-08-01T00:00:00.000Z');
    expect(await repo.svuotaCestinoScaduto()).toBe(1);
    expect(await repo.getCliente(c.id)).not.toBeNull();
    expect(await repo.elencaAttivita(c.id)).toHaveLength(1);
  });
});
