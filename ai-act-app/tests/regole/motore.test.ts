import { describe, expect, it } from 'vitest';
import { calcolaEsito, domandeVisibili } from '../../src/regole/motore';
import type { Condizione, Domanda, FileRegole, Sezione } from '../../src/regole/tipi';

const si = (r: string): Condizione => ({ risposta: r, uguale: 'si' });
const no = (r: string): Condizione => ({ risposta: r, uguale: 'no' });

function d(id: string, sezione: Sezione, mostraSe: Condizione | null = null): Domanda {
  return { id, sezione, testo: `${id}?`, aiuto: null, riferimento: 'art. x', mostraSe, stato: 'validata' };
}

function fixture(): FileRegole {
  return {
    meta: { id: 'test', versione: '1.0.0', norma: 'Reg. test', dataRedazione: '2026-10-23' },
    ruoloFornitoreSe: si('q_marchio'),
    domande: [
      d('q_ambito', 'ambito'),
      d('q_vietata', 'vietate'),
      d('q_area', 'alto_rischio'),
      d('q_deroga', 'alto_rischio', si('q_area')),
      d('q_profilazione', 'alto_rischio', si('q_deroga')),
      d('q_chatbot', 'trasparenza'),
      d('q_marchio', 'ruolo'),
    ],
    esiti: [
      {
        id: 'e_fuori', quando: no('q_ambito'), classe: 'fuori_ambito', motivazione: 'Fuori ambito',
        riferimento: 'art. 2', dataApplicazione: null, stato: 'validata',
      },
      {
        id: 'e_vietato', quando: si('q_vietata'), classe: 'vietato', motivazione: 'Pratica vietata',
        riferimento: 'art. 5', dataApplicazione: '2025-02-02', stato: 'validata',
      },
      {
        id: 'e_alto',
        // q_profilazione da sola basta: serve a verificare che una risposta nascosta sia ignorata
        quando: { almenoUna: [{ tutte: [si('q_area'), { non: si('q_deroga') }] }, si('q_profilazione')] },
        classe: 'alto_rischio', motivazione: 'Area Allegato III', riferimento: 'art. 6(2)',
        dataApplicazione: '2027-12-02', stato: 'validata',
      },
      {
        id: 'e_deroga', quando: { tutte: [si('q_area'), si('q_deroga'), no('q_profilazione')] },
        classe: 'non_alto_rischio_deroga', motivazione: 'Deroga', riferimento: 'art. 6(3)',
        dataApplicazione: '2027-12-02', stato: 'validata',
      },
    ],
    trasparenza: [
      { id: 't_chatbot', quando: si('q_chatbot'), motivazione: 'Interagisce con persone', riferimento: 'art. 50(1)', stato: 'validata' },
    ],
    obblighi: [
      {
        id: 'o_alto_forn', classi: ['alto_rischio'], soloSeTrasparenza: false, ruoli: ['fornitore'], quando: null,
        testo: 'Sistema di gestione qualità', riferimento: 'art. 17', dataApplicazione: '2027-12-02', stato: 'validata',
      },
      {
        id: 'o_alto_dep', classi: ['alto_rischio'], soloSeTrasparenza: false, ruoli: ['deployer'], quando: null,
        testo: 'Sorveglianza umana', riferimento: 'art. 26', dataApplicazione: '2027-12-02', stato: 'validata',
      },
      {
        id: 'o_trasp', classi: ['minimo', 'alto_rischio', 'non_alto_rischio_deroga'], soloSeTrasparenza: true,
        ruoli: ['fornitore', 'deployer'], quando: null, testo: 'Informare', riferimento: 'art. 50',
        dataApplicazione: '2026-08-02', stato: 'validata',
      },
      {
        id: 'o_art4',
        classi: ['vietato', 'alto_rischio', 'non_alto_rischio_deroga', 'minimo', 'da_approfondire'],
        soloSeTrasparenza: false, ruoli: ['fornitore', 'deployer'], quando: null, testo: 'Alfabetizzazione',
        riferimento: 'art. 4', dataApplicazione: '2025-02-02', stato: 'validata',
      },
    ],
  };
}

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('domandeVisibili', () => {
  it('nasconde le domande con mostraSe falso, a cascata', () => {
    const f = fixture();
    expect(ids(domandeVisibili(f, {}))).toEqual(['q_ambito', 'q_vietata', 'q_area', 'q_chatbot', 'q_marchio']);
    expect(ids(domandeVisibili(f, { q_area: 'si', q_deroga: 'si' }))).toContain('q_profilazione');
    // q_deroga=si resta, ma q_deroga è nascosta: q_profilazione non deve comparire
    expect(ids(domandeVisibili(f, { q_area: 'no', q_deroga: 'si' }))).not.toContain('q_profilazione');
  });
});

describe('calcolaEsito', () => {
  it('area + deroga + profilazione => alto_rischio', () => {
    const e = calcolaEsito(fixture(), { q_ambito: 'si', q_area: 'si', q_deroga: 'si', q_profilazione: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(e.dataApplicazioneClasse).toBe('2027-12-02');
    expect(e.motivazione).toContainEqual({ testo: 'Area Allegato III', riferimento: 'art. 6(2)' });
  });

  it('risposta a una domanda poi nascosta viene ignorata (Review Focus #1)', () => {
    const e = calcolaEsito(fixture(), { q_ambito: 'si', q_area: 'no', q_deroga: 'si', q_profilazione: 'si' }, 'deployer');
    expect(e.classe).toBe('minimo');
    expect(e.vociUsate).not.toContain('q_deroga');
    expect(e.vociUsate).not.toContain('q_profilazione');
    expect(e.dataApplicazioneClasse).toBeNull();
  });

  it('vietato prevale e azzera la trasparenza', () => {
    const e = calcolaEsito(fixture(), { q_vietata: 'si', q_chatbot: 'si' }, 'deployer');
    expect(e.classe).toBe('vietato');
    expect(e.trasparenza).toBe(false);
    expect(e.motivazione).not.toContainEqual({ testo: 'Interagisce con persone', riferimento: 'art. 50(1)' });
  });

  it('chatbot => minimo con trasparenza e motivazione', () => {
    const e = calcolaEsito(fixture(), { q_chatbot: 'si' }, 'deployer');
    expect(e.classe).toBe('minimo');
    expect(e.trasparenza).toBe(true);
    expect(e.motivazione).toContainEqual({ testo: 'Interagisce con persone', riferimento: 'art. 50(1)' });
    expect(ids(e.obblighi)).toEqual(['o_art4', 'o_trasp']);
  });

  it('non_so determinante => da_approfondire', () => {
    const e = calcolaEsito(fixture(), { q_area: 'non_so' }, 'deployer');
    expect(e.classe).toBe('da_approfondire');
    expect(e.aperte).toEqual(['q_area']);
    expect(ids(e.obblighi)).toEqual(['o_art4']);
    expect(e.dataApplicazioneClasse).toBeNull();
  });

  it('non_so non determinante => classe invariata', () => {
    const e = calcolaEsito(fixture(), { q_vietata: 'si', q_chatbot: 'non_so' }, 'deployer');
    expect(e.classe).toBe('vietato');
    expect(e.aperte).toEqual([]);
  });

  it('marchio proprio => ruolo fornitore e solo i suoi obblighi', () => {
    const e = calcolaEsito(fixture(), { q_area: 'si', q_deroga: 'no', q_marchio: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(ids(e.obblighi)).toEqual(['o_art4', 'o_alto_forn']);
  });

  it('ruolo da_definire => obblighi di tutti i ruoli', () => {
    const e = calcolaEsito(fixture(), { q_area: 'si', q_deroga: 'no' }, 'da_definire');
    expect(e.ruoloEffettivo).toBe('da_definire');
    expect(ids(e.obblighi)).toEqual(['o_art4', 'o_alto_dep', 'o_alto_forn']);
    expect(e.obblighi[0]).toEqual({
      id: 'o_art4', testo: 'Alfabetizzazione', riferimento: 'art. 4', dataApplicazione: '2025-02-02',
      ruoli: ['fornitore', 'deployer'],
    });
  });

  it('completo solo se ogni domanda visibile ha risposta', () => {
    const f = fixture();
    expect(calcolaEsito(f, { q_ambito: 'si' }, 'deployer').completo).toBe(false);
    const tutte = { q_ambito: 'si', q_vietata: 'no', q_area: 'no', q_chatbot: 'no', q_marchio: 'no' } as const;
    expect(calcolaEsito(f, tutte, 'deployer').completo).toBe(true);
  });

  it('conta le voci usate non validate', () => {
    const f = fixture();
    f.domande[5].stato = 'bozza'; // q_chatbot, sempre visibile
    f.esiti[0].stato = 'da_verificare'; // e_fuori, non vince
    const e = calcolaEsito(f, { q_ambito: 'si' }, 'deployer');
    expect(e.vociUsate).toContain('q_chatbot');
    expect(e.vociUsate).not.toContain('e_fuori');
    expect(e.vociNonValidate).toBe(1);
  });
});
