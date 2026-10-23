import { describe, expect, it } from 'vitest';
import { validaCliente } from '../../src/domain/cliente';

const oggi = new Date(2026, 9, 23, 15, 30);
const valido = {
  ragioneSociale: 'Officina Rossi Srl',
  partitaIva: '00488410010',
  settore: 'Manifattura',
  referenteNome: 'Mario Rossi',
  referenteEmail: 'mario@rossi.it',
  note: 'nota',
  aiLiteracyDocumentata: true,
  aiLiteracyData: '2026-01-10',
};

function errori(patch: Record<string, unknown>) {
  const r = validaCliente({ ...valido, ...patch }, oggi);
  if (r.ok) throw new Error('atteso errore');
  return r.errori as Record<string, string>;
}

describe('validaCliente', () => {
  it('accetta un cliente valido', () => {
    const r = validaCliente(valido, oggi);
    expect(r).toEqual({ ok: true, valore: valido });
  });

  it('accetta e scarta proprietà extra', () => {
    const r = validaCliente({ ...valido, id: 'x', creatoIl: 'y' }, oggi);
    expect(r).toEqual({ ok: true, valore: valido });
  });

  it('ragioneSociale', () => {
    const m = 'Inserisci la ragione sociale (2–200 caratteri)';
    expect(errori({ ragioneSociale: 'A' }).ragioneSociale).toBe(m);
    expect(errori({ ragioneSociale: 'A'.repeat(201) }).ragioneSociale).toBe(m);
  });

  it('partitaIva', () => {
    expect(errori({ partitaIva: '12345678901' }).partitaIva).toBe('Partita IVA non valida');
  });

  it('settore', () => {
    expect(errori({ settore: '  ' }).settore).toBe('Inserisci il settore');
  });

  it('referenteNome', () => {
    expect(errori({ referenteNome: '' }).referenteNome).toBe('Inserisci il nome del referente');
  });

  it('referenteEmail', () => {
    expect(errori({ referenteEmail: 'mario@' }).referenteEmail).toBe('Email non valida');
  });

  it('aiLiteracyData futura / malformata / oggi', () => {
    expect(errori({ aiLiteracyData: '2026-10-24' }).aiLiteracyData).toBe('La data non può essere futura');
    expect(errori({ aiLiteracyData: '24/10/2026' }).aiLiteracyData).toBe('Data non valida');
    expect(errori({ aiLiteracyData: '2026-02-30' }).aiLiteracyData).toBe('Data non valida');
    expect(validaCliente({ ...valido, aiLiteracyData: '2026-10-23' }, oggi).ok).toBe(true);
  });

  it('opzionali vuoti diventano null', () => {
    const r = validaCliente({ ...valido, referenteEmail: '', note: '  ', aiLiteracyData: '' }, oggi);
    expect(r.ok && r.valore.referenteEmail).toBeNull();
    expect(r.ok && r.valore.note).toBeNull();
    expect(r.ok && r.valore.aiLiteracyData).toBeNull();
  });

  it('normalizza la partita IVA e fa trim', () => {
    const r = validaCliente({ ...valido, partitaIva: 'IT 00488410010', ragioneSociale: '  Officina  ' }, oggi);
    expect(r.ok && r.valore.partitaIva).toBe('00488410010');
    expect(r.ok && r.valore.ragioneSociale).toBe('Officina');
  });

  it('aiLiteracyDocumentata default false', () => {
    const { aiLiteracyDocumentata: _, ...resto } = valido;
    const r = validaCliente(resto, oggi);
    expect(r.ok && r.valore.aiLiteracyDocumentata).toBe(false);
  });

  it('input non oggetto o campi mancanti', () => {
    expect(validaCliente(null, oggi).ok).toBe(false);
    expect(errori({ ragioneSociale: undefined }).ragioneSociale).toBe('Inserisci la ragione sociale (2–200 caratteri)');
  });
});
