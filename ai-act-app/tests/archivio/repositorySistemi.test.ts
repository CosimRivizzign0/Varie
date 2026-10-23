import { beforeEach, describe, expect, it } from 'vitest';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { migra } from '../../src/archivio/migrazioni';
import type { SqlDriver } from '../../src/archivio/driver';
import { creaRepository, type Repository } from '../../src/archivio/repository';
import {
  ErroreClienteNelCestino,
  ErroreInventarioVuoto,
  ErroreNonTrovato,
  ErroreValidazione,
} from '../../src/archivio/errori';

const cliente = (o: Record<string, unknown> = {}) => ({
  ragioneSociale: 'Acme Srl',
  partitaIva: '00488410010',
  settore: 'Manifattura',
  referenteNome: 'Mario Rossi',
  referenteEmail: null,
  note: null,
  aiLiteracyDocumentata: false,
  aiLiteracyData: null,
  ...o,
});

const sis = (o: Record<string, unknown> = {}) => ({
  nome: 'Chatbot Assistenza',
  fornitore: 'OpenAI',
  scopo: 'Risposte ai clienti',
  reparto: 'Assistenza',
  dataAvvio: '2026-03-01',
  ruoloCliente: 'deployer',
  ...o,
});

let driver: SqlDriver;
let adesso: Date;
let n: number;
let repo: Repository;
let cid: string;

beforeEach(async () => {
  driver = await creaSqlJsDriver();
  await migra(driver);
  adesso = new Date('2026-10-01T10:00:00.000Z');
  n = 0;
  repo = creaRepository(driver, { ora: () => adesso, nuovoId: () => `id${++n}` });
  cid = (await repo.creaCliente(cliente())).id;
});

describe('repository sistemi', () => {
  it('crea, rilegge e registra attività con sistemaId', async () => {
    const s = await repo.creaSistema(cid, sis());
    expect(s).toMatchObject({ clienteId: cid, nome: 'Chatbot Assistenza', eliminatoIl: null });
    expect(await repo.getSistema(s.id)).toEqual(s);
    const att = (await repo.elencaAttivita(cid))[0];
    expect(att).toMatchObject({
      tipo: 'creato',
      descrizione: 'Sistema "Chatbot Assistenza" aggiunto',
      sistemaId: s.id,
    });
  });

  it('elenca solo gli attivi, ordinati per nome senza distinguere maiuscole', async () => {
    await repo.creaSistema(cid, sis({ nome: 'zeta' }));
    await repo.creaSistema(cid, sis({ nome: 'Alfa' }));
    const b = await repo.creaSistema(cid, sis({ nome: 'beta' }));
    await repo.eliminaSistema(b.id);
    expect((await repo.elencaSistemi(cid)).map((s) => s.nome)).toEqual(['Alfa', 'zeta']);
  });

  it('input non valido → ErroreValidazione (ruoloCliente "altro")', async () => {
    await expect(repo.creaSistema(cid, sis({ ruoloCliente: 'altro' }))).rejects.toBeInstanceOf(ErroreValidazione);
    expect(await repo.elencaSistemi(cid)).toHaveLength(0);
  });

  it('creaSistema su cliente inesistente o nel cestino → ErroreNonTrovato', async () => {
    await expect(repo.creaSistema('nope', sis())).rejects.toBeInstanceOf(ErroreNonTrovato);
    await repo.eliminaCliente(cid);
    await expect(repo.creaSistema(cid, sis())).rejects.toBeInstanceOf(ErroreNonTrovato);
  });

  it('conferma inventario: true dopo 2 sistemi, false dopo il terzo, attività registrata', async () => {
    await repo.creaSistema(cid, sis({ nome: 'Uno' }));
    await repo.creaSistema(cid, sis({ nome: 'Due' }));
    await repo.confermaInventario(cid);
    expect((await repo.getCliente(cid))?.inventarioConfermato).toBe(true);
    expect((await repo.elencaAttivita(cid))[0]).toMatchObject({
      tipo: 'inventario_confermato',
      descrizione: 'Inventario confermato (2 sistemi)',
    });
    await repo.creaSistema(cid, sis({ nome: 'Tre' }));
    expect((await repo.getCliente(cid))?.inventarioConfermato).toBe(false);
  });

  it('descrizione con 1 sistema al singolare', async () => {
    await repo.creaSistema(cid, sis());
    await repo.confermaInventario(cid);
    expect((await repo.elencaAttivita(cid))[0].descrizione).toBe('Inventario confermato (1 sistema)');
  });

  it('conferma con 0 sistemi attivi → ErroreInventarioVuoto', async () => {
    await expect(repo.confermaInventario(cid)).rejects.toBeInstanceOf(ErroreInventarioVuoto);
    const s = await repo.creaSistema(cid, sis());
    await repo.eliminaSistema(s.id);
    await expect(repo.confermaInventario(cid)).rejects.toBeInstanceOf(ErroreInventarioVuoto);
  });

  it('confermaInventario su cliente inesistente o nel cestino → ErroreNonTrovato', async () => {
    await expect(repo.confermaInventario('nope')).rejects.toBeInstanceOf(ErroreNonTrovato);
  });

  it('la modifica non azzera la conferma', async () => {
    const s = await repo.creaSistema(cid, sis());
    await repo.confermaInventario(cid);
    const agg = await repo.aggiornaSistema(s.id, sis({ nome: 'Nuovo nome' }));
    expect(agg.nome).toBe('Nuovo nome');
    expect((await repo.getCliente(cid))?.inventarioConfermato).toBe(true);
    expect((await repo.elencaAttivita(cid))[0]).toMatchObject({
      tipo: 'modificato',
      descrizione: 'Sistema "Nuovo nome" modificato',
      sistemaId: s.id,
    });
  });

  it('aggiornaSistema: validazione e id mancante/nel cestino', async () => {
    const s = await repo.creaSistema(cid, sis());
    await expect(repo.aggiornaSistema(s.id, sis({ ruoloCliente: 'altro' }))).rejects.toBeInstanceOf(ErroreValidazione);
    await expect(repo.aggiornaSistema('nope', sis())).rejects.toBeInstanceOf(ErroreNonTrovato);
    await repo.eliminaSistema(s.id);
    await expect(repo.aggiornaSistema(s.id, sis())).rejects.toBeInstanceOf(ErroreNonTrovato);
  });

  it('eliminazione e ripristino azzerano la conferma e registrano attività', async () => {
    const s = await repo.creaSistema(cid, sis());
    await repo.confermaInventario(cid);
    await repo.eliminaSistema(s.id);
    expect((await repo.getCliente(cid))?.inventarioConfermato).toBe(false);
    expect((await repo.getSistema(s.id))?.eliminatoIl).toBe(adesso.toISOString());
    expect((await repo.elencaAttivita(cid))[0]).toMatchObject({
      tipo: 'eliminato',
      descrizione: 'Sistema "Chatbot Assistenza" spostato nel cestino',
      sistemaId: s.id,
    });
    await expect(repo.eliminaSistema(s.id)).rejects.toBeInstanceOf(ErroreNonTrovato);

    // conferma di nuovo non possibile con 0 attivi; ripristina e conferma
    await repo.ripristinaSistema(s.id);
    expect((await repo.getSistema(s.id))?.eliminatoIl).toBeNull();
    expect((await repo.elencaAttivita(cid))[0]).toMatchObject({
      tipo: 'ripristinato',
      descrizione: 'Sistema "Chatbot Assistenza" ripristinato',
    });
    await repo.confermaInventario(cid);
    await repo.eliminaSistema(s.id);
    await repo.ripristinaSistema(s.id);
    expect((await repo.getCliente(cid))?.inventarioConfermato).toBe(false);
  });

  it('ripristinaSistema: non nel cestino → ErroreNonTrovato; cliente nel cestino → ErroreClienteNelCestino', async () => {
    const s = await repo.creaSistema(cid, sis());
    await expect(repo.ripristinaSistema(s.id)).rejects.toBeInstanceOf(ErroreNonTrovato);
    await expect(repo.ripristinaSistema('nope')).rejects.toBeInstanceOf(ErroreNonTrovato);
    await repo.eliminaSistema(s.id);
    await repo.eliminaCliente(cid);
    await expect(repo.ripristinaSistema(s.id)).rejects.toBeInstanceOf(ErroreClienteNelCestino);
    expect((await repo.getSistema(s.id))?.eliminatoIl).not.toBeNull();
  });

  it('un creaSistema fallito non azzera inventarioConfermato', async () => {
    await repo.creaSistema(cid, sis());
    await repo.confermaInventario(cid);
    await expect(repo.creaSistema(cid, sis({ ruoloCliente: 'altro' }))).rejects.toBeInstanceOf(ErroreValidazione);
    expect((await repo.getCliente(cid))?.inventarioConfermato).toBe(true);
    expect(await repo.elencaSistemi(cid)).toHaveLength(1);
  });

  it('conferma e reset non cambiano modificato_il del cliente', async () => {
    const prima = (await repo.getCliente(cid))!.modificatoIl;
    adesso = new Date('2026-10-02T10:00:00.000Z');
    await repo.creaSistema(cid, sis());
    await repo.confermaInventario(cid);
    expect((await repo.getCliente(cid))!.modificatoIl).toBe(prima);
  });

  it('testi con apostrofi, accenti ed emoji restano identici', async () => {
    const s = await repo.creaSistema(cid, sis({ nome: "L'Officina Società ✓", scopo: 'Qualità 😀' }));
    expect(await repo.getSistema(s.id)).toMatchObject({ nome: "L'Officina Società ✓", scopo: 'Qualità 😀' });
  });

  it('getSistema inesistente → null', async () => {
    expect(await repo.getSistema('nope')).toBeNull();
  });
});
