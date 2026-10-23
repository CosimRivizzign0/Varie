import { beforeAll, describe, expect, it } from 'vitest';
import type { Cliente, SistemaAI } from '../../src/domain/tipi';
import type { Valutazione } from '../../src/domain/valutazione';
import type { ImpostazioniStudio } from '../../src/domain/report';
import type { EsitoValutazione } from '../../src/regole/motore';
import type { FileRegole } from '../../src/regole/tipi';
import { datiInventario, datiReportSistema } from '../../src/report/dati';
import { AVVISO_CLASSE_MODIFICATA, AVVISO_RUOLO_DA_DEFINIRE } from '../../src/domain/valutazione';

beforeAll(() => {
  process.env.TZ = 'Europe/Rome';
});

const studio: ImpostazioniStudio = { nome: 'Studio Bianchi', indirizzo: '', piva: '', email: '', telefono: '' };
const cliente = { id: 'c1', ragioneSociale: 'Officina Rossi Srl' } as Cliente;
const sis = (id: string, nome: string, extra: Partial<SistemaAI> = {}): SistemaAI => ({
  id, clienteId: 'c1', nome, fornitore: 'Acme', scopo: 'Scopo', reparto: null, dataAvvio: null,
  ruoloCliente: 'deployer', creatoIl: '', modificatoIl: '', eliminatoIl: null, ...extra,
});

const esito = (extra: Partial<EsitoValutazione> = {}): EsitoValutazione => ({
  classe: 'alto_rischio',
  trasparenza: true,
  motivazione: [{ testo: 'Selezione del personale', riferimento: 'All. III' }],
  aperte: ['q_x'],
  ruoloEffettivo: 'fornitore',
  obblighi: [
    { id: 'o2', testo: 'Sorveglianza umana', riferimento: 'art. 14', dataApplicazione: '2027-12-02', ruoli: [] },
    { id: 'o1', testo: 'Registro', riferimento: 'art. 12', dataApplicazione: '2026-08-02', ruoli: [] },
  ],
  dataApplicazioneClasse: '2027-12-02',
  completo: true,
  vociUsate: ['q_a', 'e_1'],
  vociNonValidate: 0,
  ...extra,
});

const val = (id: string, sistemaId: string, extra: Partial<Valutazione> = {}): Valutazione => ({
  id, sistemaId, versioneRegole: '1.0', risposte: {}, esito: esito(), stato: 'confermata',
  classeConfermata: 'alto_rischio', notaModifica: null, creatoIl: '', modificatoIl: '',
  confermatoIl: '2026-10-23T22:30:00.000Z', sostituitaIl: null, ...extra,
});

const regole = (stato: 'validata' | 'bozza' = 'validata'): FileRegole => ({
  meta: { id: 'r', versione: '1.0', norma: 'Reg. (UE) 2024/1689', dataRedazione: '2026-01-01' },
  ruoloFornitoreSe: { risposta: 'q_a', uguale: 'si' },
  domande: [
    { id: 'q_a', sezione: 'ambito', testo: 'Domanda A?', aiuto: null, riferimento: '', mostraSe: null, stato },
    { id: 'q_x', sezione: 'ambito', testo: 'Domanda X?', aiuto: null, riferimento: '', mostraSe: null, stato: 'validata' },
  ],
  esiti: [
    { id: 'e_1', quando: { risposta: 'q_a', uguale: 'si' }, classe: 'alto_rischio', motivazione: '', riferimento: '', dataApplicazione: null, stato: 'validata' },
  ],
  trasparenza: [],
  obblighi: [],
});

describe('datiReportSistema', () => {
  const s = sis('s1', 'Assistente HR', { ruoloCliente: 'deployer' });

  it('valutazione confermata senza modifica', () => {
    const d = datiReportSistema(studio, cliente, s, val('v1', 's1'), regole());
    expect(d.studio).toBe(studio);
    expect(d.classe).toBe('alto_rischio');
    expect(d.classeCalcolata).toBeNull();
    expect(d.notaModifica).toBeNull();
    expect(d.trasparenza).toBe(true);
    expect(d.ruoloEtichetta).toBe('Deployer (utilizzatore)');
    expect(d.ruoloEffettivoEtichetta).toBe('Fornitore');
    expect(d.applicabileDal).toBe('02/12/2027');
    expect(d.motivazione).toEqual([{ testo: 'Selezione del personale', riferimento: 'All. III' }]);
    expect(d.aperte).toEqual(['Domanda X?']);
    expect(d.obblighi).toEqual([
      { testo: 'Sorveglianza umana', riferimento: 'art. 14', dal: '02/12/2027' },
      { testo: 'Registro', riferimento: 'art. 12', dal: '02/08/2026' },
    ]);
    expect(d.regoleNonValidate).toBe(false);
    expect(d.confermatoIl).toBe('24/10/2026');
    expect(d.versioneRegole).toBe('1.0');
    expect(d.norma).toBe('Reg. (UE) 2024/1689');
  });

  it('classe modificata: classe del consulente, classeCalcolata e nota', () => {
    const v = val('v1', 's1', { classeConfermata: 'minimo', notaModifica: 'Uso solo interno' });
    const d = datiReportSistema(studio, cliente, s, v, regole());
    expect(d.classe).toBe('minimo');
    expect(d.classeCalcolata).toBe('alto_rischio');
    expect(d.notaModifica).toBe('Uso solo interno');
  });

  it('domanda aperta non trovata: resta l\'id; regole null: norma vuota', () => {
    const v = val('v1', 's1', { esito: esito({ aperte: ['q_zzz'], vociNonValidate: 2 }) });
    const d = datiReportSistema(studio, cliente, s, v, null);
    expect(d.aperte).toEqual(['q_zzz']);
    expect(d.norma).toBe('');
    expect(d.regoleNonValidate).toBe(true);
  });

  it('R3: regoleNonValidate dalle regole correnti', () => {
    expect(datiReportSistema(studio, cliente, s, val('v1', 's1'), regole('bozza')).regoleNonValidate).toBe(true);
    const mancante = val('v1', 's1', { esito: esito({ vociUsate: ['q_sparita'] }) });
    expect(datiReportSistema(studio, cliente, s, mancante, regole()).regoleNonValidate).toBe(true);
    const nuovo = val('v1', 's1', { esito: esito({ vociNonValidate: 3 }) });
    expect(datiReportSistema(studio, cliente, s, nuovo, regole()).regoleNonValidate).toBe(false);
  });

  it('R3 ristretta: versione regole diversa → conteggio salvato nell\'esito', () => {
    const vecchia = (n: number) => val('v1', 's1', { versioneRegole: '0.9', esito: esito({ vociNonValidate: n }) });
    // regole correnti tutte validate, ma la valutazione è di un'altra versione: vale il conteggio salvato
    expect(datiReportSistema(studio, cliente, s, vecchia(2), regole()).regoleNonValidate).toBe(true);
    // regole correnti in bozza, ma l'esito salvato non aveva voci non validate
    expect(datiReportSistema(studio, cliente, s, vecchia(0), regole('bozza')).regoleNonValidate).toBe(false);
  });

  it('R3 ristretta: stessa versione → controllo sulle regole correnti', () => {
    const stessa = (n: number) => val('v1', 's1', { versioneRegole: '1.0', esito: esito({ vociNonValidate: n }) });
    expect(datiReportSistema(studio, cliente, s, stessa(0), regole('bozza')).regoleNonValidate).toBe(true);
    expect(datiReportSistema(studio, cliente, s, stessa(2), regole()).regoleNonValidate).toBe(false);
  });

  it('ruoloDaDefinire solo se il ruolo effettivo è da definire', () => {
    expect(datiReportSistema(studio, cliente, s, val('v1', 's1'), regole()).ruoloDaDefinire).toBe(false);
    const v = val('v1', 's1', { esito: esito({ ruoloEffettivo: 'da_definire' }) });
    expect(datiReportSistema(studio, cliente, s, v, regole()).ruoloDaDefinire).toBe(true);
  });

  it('avvisi condivisi con la pagina Esito: testi esatti', () => {
    expect(AVVISO_CLASSE_MODIFICATA).toBe(
      'Classificazione modificata dal consulente: gli obblighi elencati si riferiscono alla classe calcolata.',
    );
    expect(AVVISO_RUOLO_DA_DEFINIRE).toBe('Ruolo del cliente da definire: sono mostrati gli obblighi di tutti i ruoli.');
  });

  it('non confermata: errore', () => {
    for (const stato of ['in_corso', 'completata'] as const) {
      expect(() => datiReportSistema(studio, cliente, s, val('v1', 's1', { stato }), regole()))
        .toThrow('Valutazione non confermata');
    }
  });
});

describe('datiInventario', () => {
  let d: ReturnType<typeof datiInventario>;
  const sistemi = [sis('s1', 'Zeta', { reparto: 'HR' }), sis('s2', 'Alfa'), sis('s3', 'Beta'), sis('s4', 'Delta')];
  const attive = [
    val('v1', 's1'),
    null,
    val('v3', 's3', { stato: 'completata', classeConfermata: null, confermatoIl: null }),
    val('v4', 's4', {
      versioneRegole: '0.9',
      classeConfermata: 'minimo',
      esito: esito({
        obblighi: [{ id: 'o1', testo: 'Registro', riferimento: 'art. 12', dataApplicazione: '2026-08-02', ruoli: [] }],
        dataApplicazioneClasse: null,
        trasparenza: false,
      }),
    }),
  ];
  beforeAll(() => {
    d = datiInventario(studio, cliente, sistemi, attive, '1.0');
  });

  it('una riga per sistema, stato Non avviata se senza valutazione', () => {
    expect(d.studio).toBe(studio);
    expect(d.cliente).toBe(cliente);
    expect(d.righe.map((r) => r.sistema)).toEqual(['Zeta', 'Alfa', 'Beta', 'Delta']);
    expect(d.righe[1]).toEqual({
      sistema: 'Alfa', fornitore: 'Acme', scopo: 'Scopo', reparto: '', ruoloCliente: 'Deployer (utilizzatore)',
      classe: '', trasparenza: '', stato: 'Non avviata', dataConferma: null, applicabileDal: null,
      nObblighi: 0, daRivedere: 'No',
    });
  });

  it('sistema confermato', () => {
    expect(d.righe[0]).toMatchObject({
      reparto: 'HR', classe: 'Alto rischio', trasparenza: 'Sì', stato: 'Confermata',
      dataConferma: '2026-10-24', applicabileDal: '2027-12-02', nObblighi: 2, daRivedere: 'No',
    });
  });

  it('sistema completato ma non confermato: classe non mostrata, nessun obbligo', () => {
    expect(d.righe[2]).toMatchObject({
      classe: '', trasparenza: '', stato: 'Completata', dataConferma: null, applicabileDal: null, nObblighi: 0,
    });
  });

  it('versione regole diversa: Da rivedere; classe del consulente con riferimento alla calcolata', () => {
    expect(d.righe[3]).toMatchObject({
      classe: 'Rischio minimo (modificata; obblighi riferiti a: Alto rischio)',
      trasparenza: 'No',
      daRivedere: 'Sì',
      nObblighi: 1,
    });
  });

  it('classe confermata uguale alla calcolata: solo l\'etichetta', () => {
    expect(d.righe[0].classe).toBe('Alto rischio');
  });

  it('obblighi solo dei confermati, ordinati per data poi sistema (Review Focus #2)', () => {
    expect(d.obblighi).toEqual([
      { sistema: 'Delta', obbligo: 'Registro', riferimento: 'art. 12', dal: '2026-08-02' },
      { sistema: 'Zeta', obbligo: 'Registro', riferimento: 'art. 12', dal: '2026-08-02' },
      { sistema: 'Zeta', obbligo: 'Sorveglianza umana', riferimento: 'art. 14', dal: '2027-12-02' },
    ]);
  });
});
