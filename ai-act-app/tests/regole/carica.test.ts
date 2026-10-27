import { describe, expect, it } from 'vitest';
import { caricaRegole, ErroreRegole } from '../../src/regole/carica';

function base(): any {
  return {
    meta: { id: 'ai-act', versione: '1.0.0', norma: 'Reg. (UE) 2024/1689', dataRedazione: '2026-10-23' },
    ruoloFornitoreSe: { risposta: 'd1', uguale: 'si' },
    domande: [
      { id: 'd1', sezione: 'ambito', testo: 'Q1?', aiuto: null, riferimento: 'art. 2', mostraSe: null, stato: 'validata' },
      {
        id: 'd2', sezione: 'vietate', testo: 'Q2?', aiuto: 'aiuto', riferimento: 'art. 5',
        mostraSe: { risposta: 'd1', uguale: 'si' }, stato: 'bozza',
      },
    ],
    esiti: [
      {
        id: 'e1', quando: { risposta: 'd2', uguale: 'si' }, classe: 'vietato', motivazione: 'm',
        riferimento: 'art. 5', dataApplicazione: '2025-02-02', stato: 'da_verificare',
      },
    ],
    trasparenza: [{ id: 't1', quando: { risposta: 'd1', uguale: 'si' }, motivazione: 'm', riferimento: 'art. 50', stato: 'validata' }],
    obblighi: [
      {
        id: 'o1', classi: ['alto_rischio'], soloSeTrasparenza: false, ruoli: ['fornitore'], quando: null,
        testo: 'x', riferimento: 'art. 16', dataApplicazione: '2027-12-02', stato: 'bozza',
      },
    ],
  };
}

function problemi(json: unknown): string[] {
  try {
    caricaRegole(json);
  } catch (e) {
    expect(e).toBeInstanceOf(ErroreRegole);
    return (e as ErroreRegole).problemi;
  }
  throw new Error('atteso ErroreRegole');
}

describe('caricaRegole', () => {
  it('accetta un fixture minimo valido', () => {
    const f = caricaRegole(base());
    expect(f.domande).toHaveLength(2);
    expect(f.meta.versione).toBe('1.0.0');
  });
  it('id duplicato', () => {
    const j = base();
    j.esiti[0].id = 'd1';
    expect(problemi(j)).toContain('Id duplicato: d1');
  });
  it('domanda inesistente', () => {
    const j = base();
    j.esiti[0].quando = { risposta: 'zz', uguale: 'si' };
    expect(problemi(j)).toContain('Domanda inesistente "zz" in e1');
  });
  it('domanda inesistente in ruoloFornitoreSe', () => {
    const j = base();
    j.ruoloFornitoreSe = { risposta: 'zz', uguale: 'si' };
    expect(problemi(j)).toContain('Domanda inesistente "zz" in ruoloFornitoreSe');
  });
  it('ciclo in mostraSe', () => {
    const j = base();
    j.domande[0].mostraSe = { risposta: 'd2', uguale: 'si' };
    expect(problemi(j)).toContain('Ciclo in mostraSe: d1 → d2 → d1');
  });
  it('domanda citata prima di essere definita', () => {
    const j = base();
    j.domande[0].mostraSe = { risposta: 'd2', uguale: 'si' };
    j.domande[1].mostraSe = null;
    expect(problemi(j)).toEqual(['Domanda "d2" citata prima di essere definita in d1']);
  });
  it('data non valida', () => {
    const j = base();
    j.esiti[0].dataApplicazione = '2026-02-30';
    expect(problemi(j)).toContain('Data non valida in e1: 2026-02-30');
    const k = base();
    k.obblighi[0].dataApplicazione = '02/12/2027';
    expect(problemi(k)).toContain('Data non valida in o1: 02/12/2027');
  });
  it('versione non valida', () => {
    const j = base();
    j.meta.versione = '1.0';
    expect(problemi(j)).toContain('Versione non valida: 1.0');
  });
  it('due errori insieme', () => {
    const j = base();
    j.meta.versione = 'x';
    j.esiti[0].dataApplicazione = '2026-13-01';
    expect(problemi(j)).toHaveLength(2);
  });
  it('chiave mancante', () => {
    const j = base();
    delete j.obblighi;
    expect(problemi(j).length).toBeGreaterThan(0);
    expect(problemi(null).length).toBeGreaterThan(0);
  });
});
