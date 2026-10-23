import { beforeEach, describe, expect, it } from 'vitest';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { migra } from '../../src/archivio/migrazioni';
import type { SqlDriver } from '../../src/archivio/driver';
import { creaRepository, type Repository } from '../../src/archivio/repository';
import { ErroreNonTrovato, ErroreValidazione, ErroreValutazioneIncompleta } from '../../src/archivio/errori';
import type { EsitoValutazione } from '../../src/regole/motore';
import type { Classe } from '../../src/regole/tipi';

const cliente = {
  ragioneSociale: 'Acme Srl', partitaIva: '00488410010', settore: 'Manifattura',
  referenteNome: 'Mario Rossi', referenteEmail: null, note: null,
  aiLiteracyDocumentata: false, aiLiteracyData: null,
};
const sis = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Risposte', reparto: null,
  dataAvvio: null, ruoloCliente: 'deployer',
};
const esito = (o: Partial<EsitoValutazione> = {}): EsitoValutazione => ({
  classe: 'minimo', trasparenza: false, motivazione: [{ testo: "L'Officina ✓", riferimento: 'art. 1' }],
  aperte: [], ruoloEffettivo: 'deployer', obblighi: [], dataApplicazioneClasse: null,
  completo: true, vociUsate: [], vociNonValidate: 0, ...o,
});

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

describe('repository valutazioni', () => {
  it('avvia: attiva in_corso, senza esito, con attività', async () => {
    expect(await repo.getValutazioneAttiva(sid)).toBeNull();
    const v = await repo.avviaValutazione(sid, '1.0.0');
    expect(v).toMatchObject({ sistemaId: sid, versioneRegole: '1.0.0', stato: 'in_corso', esito: null, risposte: {}, sostituitaIl: null });
    expect((await repo.getValutazioneAttiva(sid))?.id).toBe(v.id);
    const att = (await repo.elencaAttivita(cid))[0];
    expect(att).toMatchObject({ tipo: 'modificato', sistemaId: sid, descrizione: 'Valutazione di «Chatbot» avviata' });
  });

  it('secondo avvio sostituisce la precedente', async () => {
    const a = await repo.avviaValutazione(sid, '1.0.0');
    adesso = new Date('2026-10-02T10:00:00.000Z');
    const b = await repo.avviaValutazione(sid, '1.1.0');
    const lista = await repo.elencaValutazioni(sid);
    expect(lista.map((x) => x.id)).toEqual([b.id, a.id]);
    expect(lista[1].sostituitaIl).toBe(adesso.toISOString());
    expect((await repo.getValutazioneAttiva(sid))?.id).toBe(b.id);
  });

  it('avvia su sistema mancante o nel cestino → ErroreNonTrovato', async () => {
    await expect(repo.avviaValutazione('zz', '1')).rejects.toBeInstanceOf(ErroreNonTrovato);
    await repo.eliminaSistema(sid);
    await expect(repo.avviaValutazione(sid, '1')).rejects.toBeInstanceOf(ErroreNonTrovato);
  });

  it('salvaRisposte: completo → completata con attività; incompleto → in_corso senza attività', async () => {
    const v = await repo.avviaValutazione(sid, '1.0.0');
    const prima = (await repo.elencaAttivita(cid)).length;
    const p = await repo.salvaRisposte(v.id, { a: 'si' }, esito({ completo: false }), '1.0.0');
    expect(p.stato).toBe('in_corso');
    expect(p.risposte).toEqual({ a: 'si' });
    expect((await repo.elencaAttivita(cid)).length).toBe(prima);
    const c = await repo.salvaRisposte(v.id, { a: 'si', b: 'no' }, esito({ classe: 'alto_rischio' }), '1.0.0');
    expect(c.stato).toBe('completata');
    expect((await repo.elencaAttivita(cid))[0].descrizione).toBe('Valutazione di «Chatbot» completata: Alto rischio');
    // ancora completata: nessuna nuova attività
    const dopo = (await repo.elencaAttivita(cid)).length;
    await repo.salvaRisposte(v.id, { a: 'si', b: 'si' }, esito({ classe: 'alto_rischio' }), '1.0.0');
    expect((await repo.elencaAttivita(cid)).length).toBe(dopo);
  });

  it('esito con caratteri speciali riletto identico', async () => {
    const v = await repo.avviaValutazione(sid, '1.0.0');
    const e = esito();
    await repo.salvaRisposte(v.id, { a: 'si' }, e, '1.0.0');
    expect((await repo.getValutazioneAttiva(sid))?.esito).toEqual(e);
  });

  it('conferma con stessa classe e nota null → confermata', async () => {
    const v = await repo.avviaValutazione(sid, '1.0.0');
    await repo.salvaRisposte(v.id, { a: 'si' }, esito(), '1.0.0');
    const c = await repo.confermaValutazione(v.id, 'minimo', null);
    expect(c).toMatchObject({ stato: 'confermata', classeConfermata: 'minimo', notaModifica: null, confermatoIl: adesso.toISOString() });
    expect((await repo.elencaAttivita(cid))[0].descrizione).toBe('Classificazione di «Chatbot» confermata: Rischio minimo');
  });

  it('conferma con stessa classe e nota → nota salvata (trim)', async () => {
    const v = await repo.avviaValutazione(sid, '1.0.0');
    await repo.salvaRisposte(v.id, { a: 'si' }, esito(), '1.0.0');
    const c = await repo.confermaValutazione(v.id, 'minimo', '  ok  ');
    expect(c.notaModifica).toBe('ok');
  });

  it('conferma con classe diversa richiede nota', async () => {
    const v = await repo.avviaValutazione(sid, '1.0.0');
    await repo.salvaRisposte(v.id, { a: 'si' }, esito(), '1.0.0');
    for (const nota of ['', '   ', null]) {
      const err = await repo.confermaValutazione(v.id, 'alto_rischio', nota).catch((e) => e);
      expect(err).toBeInstanceOf(ErroreValidazione);
      expect(err.errori).toEqual({ nota: 'Indica il motivo della modifica' });
    }
    const c = await repo.confermaValutazione(v.id, 'alto_rischio' as Classe, 'Perché sì');
    expect(c).toMatchObject({ stato: 'confermata', classeConfermata: 'alto_rischio', notaModifica: 'Perché sì' });
    expect((await repo.elencaAttivita(cid))[0].descrizione).toBe(
      'Classificazione di «Chatbot» modificata: Alto rischio — Perché sì',
    );
  });

  it('conferma su in_corso → ErroreValutazioneIncompleta', async () => {
    const v = await repo.avviaValutazione(sid, '1.0.0');
    await expect(repo.confermaValutazione(v.id, 'minimo', null)).rejects.toBeInstanceOf(ErroreValutazioneIncompleta);
    await repo.salvaRisposte(v.id, { a: 'si' }, esito({ completo: false }), '1.0.0');
    await expect(repo.confermaValutazione(v.id, 'minimo', null)).rejects.toThrow('Completa il questionario prima di confermare');
  });

  it('salvaRisposte su confermata → completata e azzera la conferma', async () => {
    const v = await repo.avviaValutazione(sid, '1.0.0');
    await repo.salvaRisposte(v.id, { a: 'si' }, esito(), '1.0.0');
    await repo.confermaValutazione(v.id, 'alto_rischio', 'motivo');
    const r = await repo.salvaRisposte(v.id, { a: 'no' }, esito(), '1.0.0');
    expect(r).toMatchObject({ stato: 'completata', classeConfermata: null, notaModifica: null, confermatoIl: null });
  });

  it('salvaRisposte aggiorna versione_regole alla versione indicata', async () => {
    const v = await repo.avviaValutazione(sid, '0.9.0');
    const r = await repo.salvaRisposte(v.id, { a: 'si' }, esito(), '1.1.0');
    expect(r.versioneRegole).toBe('1.1.0');
    expect((await repo.getValutazioneAttiva(sid))?.versioneRegole).toBe('1.1.0');
  });

  it('id mancante o sostituita o sistema nel cestino → ErroreNonTrovato', async () => {
    await expect(repo.salvaRisposte('zz', {}, esito(), '1.0.0')).rejects.toBeInstanceOf(ErroreNonTrovato);
    await expect(repo.confermaValutazione('zz', 'minimo', null)).rejects.toBeInstanceOf(ErroreNonTrovato);
    const a = await repo.avviaValutazione(sid, '1');
    await repo.salvaRisposte(a.id, { a: 'si' }, esito(), '1.0.0');
    await repo.avviaValutazione(sid, '1');
    await expect(repo.salvaRisposte(a.id, {}, esito(), '1.0.0')).rejects.toBeInstanceOf(ErroreNonTrovato);
    await expect(repo.confermaValutazione(a.id, 'minimo', null)).rejects.toBeInstanceOf(ErroreNonTrovato);
    const b = (await repo.getValutazioneAttiva(sid))!;
    await repo.eliminaSistema(sid);
    await expect(repo.salvaRisposte(b.id, {}, esito(), '1.0.0')).rejects.toBeInstanceOf(ErroreNonTrovato);
    await expect(repo.confermaValutazione(b.id, 'minimo', null)).rejects.toBeInstanceOf(ErroreNonTrovato);
  });

  it('eliminaDefinitivamente sistema rimuove le valutazioni', async () => {
    await repo.avviaValutazione(sid, '1');
    await repo.avviaValutazione(sid, '1');
    await repo.eliminaSistema(sid);
    await repo.eliminaDefinitivamente('sistema', sid);
    expect(await count('valutazioni')).toBe(0);
  });

  it('eliminaDefinitivamente cliente rimuove le valutazioni dei suoi sistemi', async () => {
    await repo.avviaValutazione(sid, '1');
    await repo.eliminaCliente(cid);
    await repo.eliminaDefinitivamente('cliente', cid);
    expect(await count('valutazioni')).toBe(0);
    expect(await count('sistemi')).toBe(0);
  });

  it('svuotaCestinoScaduto rimuove le valutazioni di sistemi e clienti scaduti', async () => {
    const c2 = (await repo.creaCliente({ ...cliente, partitaIva: '00743110157' })).id;
    const s2 = (await repo.creaSistema(c2, sis)).id;
    await repo.avviaValutazione(sid, '1');
    await repo.avviaValutazione(s2, '1');
    await repo.eliminaSistema(sid);
    await repo.eliminaCliente(c2);
    adesso = new Date('2027-10-01T10:00:00.000Z');
    expect(await repo.svuotaCestinoScaduto()).toBe(2);
    expect(await count('valutazioni')).toBe(0);
  });
});
