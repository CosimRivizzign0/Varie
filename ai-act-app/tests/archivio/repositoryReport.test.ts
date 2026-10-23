import { beforeEach, describe, expect, it } from 'vitest';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { migra } from '../../src/archivio/migrazioni';
import type { SqlDriver } from '../../src/archivio/driver';
import { creaRepository, type Repository } from '../../src/archivio/repository';

const cliente = {
  ragioneSociale: 'Acme Srl', partitaIva: '00488410010', settore: 'Manifattura',
  referenteNome: 'Mario Rossi', referenteEmail: null, note: null,
  aiLiteracyDocumentata: false, aiLiteracyData: null,
};
const sis = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Risposte', reparto: null,
  dataAvvio: null, ruoloCliente: 'deployer',
};

let driver: SqlDriver;
let adesso: Date;
let n: number;
let repo: Repository;
let cid: string;
let sid: string;

beforeEach(async () => {
  driver = await creaSqlJsDriver();
  await migra(driver);
  adesso = new Date('2026-10-01T10:00:00.000Z');
  n = 0;
  repo = creaRepository(driver, { ora: () => adesso, nuovoId: () => `id${++n}` });
  cid = (await repo.creaCliente(cliente)).id;
  sid = (await repo.creaSistema(cid, sis)).id;
});

const count = async (t: string) =>
  Number((await driver.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))[0].n);

describe('impostazioni studio', () => {
  it('vuote di default', async () => {
    expect(await repo.getImpostazioniStudio()).toEqual({
      nome: '', indirizzo: '', piva: '', email: '', telefono: '',
    });
  });

  it('salva con trim, rilegge, sovrascrive e non crea attività', async () => {
    const prima = await count('attivita');
    await repo.salvaImpostazioniStudio({
      nome: "  L'Officina ✓ ", indirizzo: 'Via Roma 1', piva: '00488410010', email: 'a@b.it', telefono: ' 011 123 ',
    });
    expect(await repo.getImpostazioniStudio()).toEqual({
      nome: "L'Officina ✓", indirizzo: 'Via Roma 1', piva: '00488410010', email: 'a@b.it', telefono: '011 123',
    });
    await repo.salvaImpostazioniStudio({ nome: 'Nuovo', indirizzo: '', piva: '', email: '', telefono: '' });
    expect(await repo.getImpostazioniStudio()).toEqual({
      nome: 'Nuovo', indirizzo: '', piva: '', email: '', telefono: '',
    });
    expect(await count('attivita')).toBe(prima);
  });
});

describe('registro report', () => {
  it('registra un Word con attività e lo elenca', async () => {
    const r = await repo.registraReport({
      clienteId: cid, sistemaId: sid, valutazioneId: 'v1', tipo: 'word', nomeFile: 'Acme_Chatbot.docx',
    });
    expect(r.id).toMatch(/^id\d+$/);
    expect(r).toEqual({
      id: r.id, clienteId: cid, sistemaId: sid, valutazioneId: 'v1', tipo: 'word',
      nomeFile: 'Acme_Chatbot.docx', creatoIl: adesso.toISOString(),
    });
    const att = (await repo.elencaAttivita(cid))[0];
    expect(att).toMatchObject({ tipo: 'modificato', sistemaId: sid, descrizione: 'Report Word di «Chatbot» generato' });
    expect(await repo.elencaReport(cid)).toEqual([r]);
  });

  it('registra un Excel con attività senza sistema; più recente prima', async () => {
    const a = await repo.registraReport({
      clienteId: cid, sistemaId: sid, valutazioneId: null, tipo: 'word', nomeFile: 'a.docx',
    });
    adesso = new Date('2026-10-02T10:00:00.000Z');
    const b = await repo.registraReport({
      clienteId: cid, sistemaId: null, valutazioneId: null, tipo: 'excel', nomeFile: 'inv.xlsx',
    });
    const att = (await repo.elencaAttivita(cid))[0];
    expect(att).toMatchObject({ tipo: 'modificato', sistemaId: null, descrizione: 'Inventario Excel generato' });
    expect((await repo.elencaReport(cid)).map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it('a pari timestamp, l\'ultimo registrato viene prima', async () => {
    const a = await repo.registraReport({ clienteId: cid, sistemaId: null, valutazioneId: null, tipo: 'excel', nomeFile: 'a.xlsx' });
    const b = await repo.registraReport({ clienteId: cid, sistemaId: null, valutazioneId: null, tipo: 'excel', nomeFile: 'b.xlsx' });
    expect((await repo.elencaReport(cid)).map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it('rifiuta un sistema inesistente o di altro cliente', async () => {
    await expect(
      repo.registraReport({ clienteId: cid, sistemaId: 'nope', valutazioneId: null, tipo: 'word', nomeFile: 'x' }),
    ).rejects.toThrow();
    expect(await count('report')).toBe(0);
  });
});

describe('cascata report', () => {
  const reg = async () => {
    await repo.registraReport({ clienteId: cid, sistemaId: sid, valutazioneId: null, tipo: 'word', nomeFile: 'a.docx' });
    await repo.registraReport({ clienteId: cid, sistemaId: null, valutazioneId: null, tipo: 'excel', nomeFile: 'i.xlsx' });
  };

  it('eliminaDefinitivamente del cliente cancella i report', async () => {
    await reg();
    await repo.eliminaCliente(cid);
    await repo.eliminaDefinitivamente('cliente', cid);
    expect(await count('report')).toBe(0);
    expect(await count('clienti')).toBe(0);
  });

  it('eliminaDefinitivamente del sistema cancella solo i suoi report', async () => {
    await reg();
    await repo.eliminaSistema(sid);
    await repo.eliminaDefinitivamente('sistema', sid);
    expect((await repo.elencaReport(cid)).map((r) => r.tipo)).toEqual(['excel']);
  });

  it('svuotaCestinoScaduto cancella i report di clienti e sistemi scaduti', async () => {
    await reg();
    const c2 = (await repo.creaCliente({ ...cliente, partitaIva: '00743110157' })).id;
    const s2 = (await repo.creaSistema(c2, sis)).id;
    await repo.registraReport({ clienteId: c2, sistemaId: s2, valutazioneId: null, tipo: 'word', nomeFile: 'b.docx' });
    await repo.eliminaSistema(sid);
    await repo.eliminaCliente(c2);
    adesso = new Date('2027-10-01T10:00:00.000Z');
    expect(await repo.svuotaCestinoScaduto()).toBe(2);
    expect((await repo.elencaReport(cid)).map((r) => r.tipo)).toEqual(['excel']);
    expect(await count('report')).toBe(1);
  });
});
