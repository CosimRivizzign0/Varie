import { describe, expect, it } from 'vitest';
import { calcolaRoadmap } from '../../src/domain/roadmap';
import { sintesiPerRoadmap, type SintesiValutazione, type Valutazione } from '../../src/domain/valutazione';
import type { RegistroReport } from '../../src/domain/report';
import type { Cliente, SistemaAI } from '../../src/domain/tipi';

const oggi = new Date(2026, 9, 23, 15, 30);
const cliente: Cliente = {
  id: 'c1',
  ragioneSociale: 'Officina Rossi Srl',
  partitaIva: '00488410010',
  settore: 'Manifattura',
  referenteNome: 'Mario Rossi',
  referenteEmail: 'mario@rossi.it',
  note: null,
  aiLiteracyDocumentata: true,
  aiLiteracyData: '2026-01-10',
  inventarioConfermato: false,
  creatoIl: '2026-01-01T00:00:00.000Z',
  modificatoIl: '2026-01-01T00:00:00.000Z',
  eliminatoIl: null,
};
function sistemi(n: number): SistemaAI[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    clienteId: 'c1',
    nome: `Sistema ${i}`,
    fornitore: 'Acme',
    scopo: 'Test',
    reparto: null,
    dataAvvio: null,
    ruoloCliente: 'deployer' as const,
    creatoIl: '2026-01-01T00:00:00.000Z',
    modificatoIl: '2026-01-01T00:00:00.000Z',
    eliminatoIl: null,
  }));
}
const stati = (r: ReturnType<typeof calcolaRoadmap>) => r.tappe.map((t) => t.stato);

describe('calcolaRoadmap', () => {
  it('cliente valido, 0 sistemi', () => {
    const r = calcolaRoadmap(cliente, [], oggi, [], []);
    expect(r.percentuale).toBe(20);
    expect(stati(r)).toEqual(['completata', 'in_corso', 'da_fare', 'da_fare', 'da_fare']);
    expect(r.prossimaAzione).toBe('Aggiungi il primo sistema AI');
    expect(r.tappe.map((t) => t.etichetta)).toEqual(['Anagrafica', 'Inventario', 'Questionario', 'Classificazione', 'Report']);
    expect(r.tappe[1].dettaglio).toBe('0 sistemi');
    expect(r.tappe[2].dettaglio).toBe('0 di 0 sistemi');
    expect(r.tappe[4].dettaglio).toBe('0 di 1 report');
    expect(r.tappe[0].dettaglio).toBeNull();
  });

  it('3 sistemi non confermato', () => {
    const r = calcolaRoadmap(cliente, sistemi(3), oggi, [], []);
    expect(r.percentuale).toBe(20);
    expect(r.prossimaAzione).toBe("Conferma l'inventario (3 sistemi)");
    expect(r.tappe[1].dettaglio).toBe('3 sistemi');
  });

  it('1 sistema non confermato', () => {
    const r = calcolaRoadmap(cliente, sistemi(1), oggi, [], []);
    expect(r.prossimaAzione).toBe("Conferma l'inventario (1 sistema)");
    expect(r.tappe[1].dettaglio).toBe('1 sistema');
  });

  it('2 sistemi confermato', () => {
    const r = calcolaRoadmap({ ...cliente, inventarioConfermato: true }, sistemi(2), oggi, [], []);
    expect(r.percentuale).toBe(40);
    expect(stati(r)).toEqual(['completata', 'completata', 'in_corso', 'da_fare', 'da_fare']);
    expect(r.prossimaAzione).toBe('Compila il questionario per «Sistema 0»');
  });

  it('confermato ma 0 sistemi attivi', () => {
    const r = calcolaRoadmap({ ...cliente, inventarioConfermato: true }, [], oggi, [], []);
    expect(r.percentuale).toBe(20);
    expect(r.tappe[1].stato).toBe('in_corso');
    expect(r.prossimaAzione).toBe('Aggiungi il primo sistema AI');
  });

  it('settore vuoto', () => {
    const r = calcolaRoadmap({ ...cliente, settore: '' }, sistemi(2), oggi, [], []);
    expect(r.percentuale).toBe(0);
    expect(stati(r)).toEqual(['in_corso', 'da_fare', 'da_fare', 'da_fare', 'da_fare']);
    expect(r.prossimaAzione).toBe("Completa l'anagrafica: manca il settore");
  });

  it('inventario confermato con anagrafica non valida', () => {
    const r = calcolaRoadmap({ ...cliente, settore: '', inventarioConfermato: true }, sistemi(2), oggi, [], []);
    expect(stati(r)).toEqual(['in_corso', 'completata', 'da_fare', 'da_fare', 'da_fare']);
    expect(r.percentuale).toBe(20);
    expect(r.prossimaAzione).toBe("Completa l'anagrafica: manca il settore");
  });

  it('altri campi non validi', () => {
    expect(calcolaRoadmap({ ...cliente, ragioneSociale: '' }, [], oggi, [], []).prossimaAzione).toBe("Completa l'anagrafica: manca la ragione sociale");
    expect(calcolaRoadmap({ ...cliente, partitaIva: '123' }, [], oggi, [], []).prossimaAzione).toBe("Completa l'anagrafica: manca la Partita IVA");
    expect(calcolaRoadmap({ ...cliente, referenteNome: '' }, [], oggi, [], []).prossimaAzione).toBe("Completa l'anagrafica: manca il referente");
    expect(calcolaRoadmap({ ...cliente, referenteEmail: 'x' }, [], oggi, [], []).prossimaAzione).toBe("Completa l'anagrafica: manca l'email del referente");
    expect(calcolaRoadmap({ ...cliente, aiLiteracyData: '2999-01-01' }, [], oggi, [], []).prossimaAzione).toBe("Completa l'anagrafica: manca la data della formazione AI");
  });

  describe('tappe 3-4', () => {
    const conf = { ...cliente, inventarioConfermato: true };
    const sis = (nomi: string[]): SistemaAI[] => sistemi(nomi.length).map((x, i) => ({ ...x, id: `id-${nomi[i]}`, nome: nomi[i] }));
    const sint = (
      lista: SistemaAI[],
      stati: ('in_corso' | 'completata' | 'confermata' | null)[],
      daRivedere: boolean[] = [],
    ): SintesiValutazione[] =>
      lista.map((x, i) => ({ sistemaId: x.id, sistemaNome: x.nome, valutazioneId: `val-${x.id}`, confermatoIl: stati[i] === 'confermata' ? '2026-10-01T10:00:00.000Z' : null, stato: stati[i], daRivedere: daRivedere[i] ?? false }));

    it('nessuna valutazione: 40%, tappa 3 in corso', () => {
      const l = sis(['B', 'A']);
      const r = calcolaRoadmap(conf, l, oggi, sint(l, [null, null]), []);
      expect(r.percentuale).toBe(40);
      expect(stati(r)).toEqual(['completata', 'completata', 'in_corso', 'da_fare', 'da_fare']);
      expect(r.prossimaAzione).toBe('Compila il questionario per «A»');
      expect(r.tappe[2].dettaglio).toBe('0 di 2 sistemi');
      expect(r.tappe[3].dettaglio).toBe('0 di 2 confermati');
      expect(r.tappe[4].dettaglio).toBe('0 di 3 report');
    });

    it('tutti completati: 60%, conferma la classificazione', () => {
      const l = sis(['B', 'A']);
      const r = calcolaRoadmap(conf, l, oggi, sint(l, ['completata', 'completata']), []);
      expect(r.percentuale).toBe(60);
      expect(stati(r)).toEqual(['completata', 'completata', 'completata', 'in_corso', 'da_fare']);
      expect(r.prossimaAzione).toBe('Conferma la classificazione di «A»');
      expect(r.tappe[2].dettaglio).toBe('2 di 2 sistemi');
    });

    it('un in_corso e uno completato: questionario per quello in corso', () => {
      const l = sis(['A', 'B']);
      const r = calcolaRoadmap(conf, l, oggi, sint(l, ['completata', 'in_corso']), []);
      expect(r.percentuale).toBe(40);
      expect(r.prossimaAzione).toBe('Compila il questionario per «B»');
      expect(r.tappe[2].dettaglio).toBe('1 di 2 sistemi');
    });

    it('tutti confermati senza report: 80%, genera i report', () => {
      const l = sis(['A', 'B']);
      const r = calcolaRoadmap(conf, l, oggi, sint(l, ['confermata', 'confermata']), []);
      expect(r.percentuale).toBe(80);
      expect(stati(r)).toEqual(['completata', 'completata', 'completata', 'completata', 'in_corso']);
      expect(r.prossimaAzione).toBe('Genera i report');
      expect(r.tappe[3].dettaglio).toBe('2 di 2 confermati');
    });

    it('Review Focus 3: confermato con versione vecchia, tappa 3 non completata', () => {
      const l = sis(['A', 'B']);
      const r = calcolaRoadmap(conf, l, oggi, sint(l, ['confermata', 'confermata'], [true, false]), []);
      expect(r.tappe[2].stato).toBe('in_corso');
      expect(r.tappe[3].stato).toBe('da_fare');
      expect(r.percentuale).toBe(40);
      expect(r.prossimaAzione).toBe('Compila il questionario per «A»');
      expect(r.tappe[2].dettaglio).toBe('1 di 2 sistemi');
    });

    it('Review Focus 4: 0 sistemi, tappe 3-4 non completate', () => {
      const r = calcolaRoadmap(conf, [], oggi, [], []);
      expect(r.tappe[2].stato).not.toBe('completata');
      expect(r.tappe[3].stato).not.toBe('completata');
      expect(r.tappe[4].stato).toBe('da_fare');
      expect(r.percentuale).toBe(20);
    });

    describe('tappa 5', () => {
      const l = sis(['A', 'B']);
      const sin = sint(l, ['confermata', 'confermata']);
      const rep = (tipo: 'word' | 'excel', sistema: SistemaAI | null, creatoIl: string): RegistroReport => ({
        id: `${tipo}-${sistema?.id ?? 'x'}-${creatoIl}`,
        clienteId: 'c1',
        sistemaId: sistema?.id ?? null,
        valutazioneId: sistema ? `val-${sistema.id}` : null,
        tipo,
        nomeFile: 'f',
        creatoIl,
      });
      const dopo = '2026-10-02T10:00:00.000Z';
      const completi = [rep('word', l[0], dopo), rep('word', l[1], dopo), rep('excel', null, dopo)];

      it('tutto confermato e report aggiornati: 100%, Assessment completato', () => {
        const r = calcolaRoadmap(conf, l, oggi, sin, completi);
        expect(r.percentuale).toBe(100);
        expect(r.tappe[4].stato).toBe('completata');
        expect(r.tappe[4].dettaglio).toBe('3 di 3 report');
        expect(r.prossimaAzione).toBe('Assessment completato');
      });

      it('conferma successiva all\'ultimo Word: Genera i report aggiornati', () => {
        const r = calcolaRoadmap(conf, l, oggi, sint(l, ['confermata', 'confermata']).map((x) => ({ ...x, confermatoIl: '2026-10-03T10:00:00.000Z' })), completi);
        expect(r.tappe[4].stato).toBe('in_corso');
        expect(r.tappe[4].dettaglio).toBe('0 di 3 report');
        expect(r.percentuale).toBe(80);
        expect(r.prossimaAzione).toBe('Genera i report aggiornati');
      });

      it('manca solo l\'Excel: non completata', () => {
        const r = calcolaRoadmap(conf, l, oggi, sin, completi.slice(0, 2));
        expect(r.tappe[4].stato).toBe('in_corso');
        expect(r.tappe[4].dettaglio).toBe('2 di 3 report');
        expect(r.percentuale).toBe(80);
        expect(r.prossimaAzione).toBe('Genera i report aggiornati');
      });

      it('Word di un\'altra valutazione non conta', () => {
        const vecchio = { ...completi[0], valutazioneId: 'altra' };
        const r = calcolaRoadmap(conf, l, oggi, sin, [vecchio, completi[1], completi[2]]);
        expect(r.tappe[4].dettaglio).toBe('2 di 3 report');
        expect(r.percentuale).toBe(80);
      });

      it('0 sistemi: tappa 5 non completata', () => {
        const r = calcolaRoadmap(conf, [], oggi, [], [rep('excel', null, dopo)]);
        expect(r.tappe[4].stato).toBe('da_fare');
        expect(r.percentuale).toBe(20);
      });

      it('solo l\'Excel è superato: Word aggiornati, Excel precedente all\'ultima conferma', () => {
        // A confermato il 01/10, B il 03/10; i Word seguono ciascuno la propria conferma, l'Excel no
        const conferme = sin.map((x, i) => ({ ...x, confermatoIl: i === 0 ? '2026-10-01T10:00:00.000Z' : '2026-10-03T10:00:00.000Z' }));
        const r = calcolaRoadmap(conf, l, oggi, conferme, [
          rep('word', l[0], '2026-10-02T10:00:00.000Z'),
          rep('word', l[1], '2026-10-04T10:00:00.000Z'),
          rep('excel', null, '2026-10-02T10:00:00.000Z'),
        ]);
        expect(r.tappe[4].stato).toBe('in_corso');
        expect(r.tappe[4].dettaglio).toBe('2 di 3 report');
        expect(r.percentuale).toBe(80);
        expect(r.prossimaAzione).toBe('Genera i report aggiornati');
      });

      it('uno dei due Word è superato: non completata', () => {
        // A riconfermato il 03/10 dopo il suo Word del 02/10; B e l'Excel aggiornati
        const conferme = sin.map((x, i) => ({ ...x, confermatoIl: i === 0 ? '2026-10-03T10:00:00.000Z' : '2026-10-01T10:00:00.000Z' }));
        const r = calcolaRoadmap(conf, l, oggi, conferme, [
          rep('word', l[0], '2026-10-02T10:00:00.000Z'),
          rep('word', l[1], '2026-10-02T10:00:00.000Z'),
          rep('excel', null, '2026-10-04T10:00:00.000Z'),
        ]);
        expect(r.tappe[4].stato).toBe('in_corso');
        expect(r.tappe[4].dettaglio).toBe('2 di 3 report');
        expect(r.percentuale).toBe(80);
        expect(r.prossimaAzione).toBe('Genera i report aggiornati');
      });

      it('tappa 4 non completata: tappa 5 da fare', () => {
        const r = calcolaRoadmap(conf, l, oggi, sint(l, ['completata', 'completata']), completi);
        expect(r.tappe[4].stato).toBe('da_fare');
        expect(r.percentuale).toBe(60);
      });

      it('un solo sistema: 1 di 2 report', () => {
        const uno = sis(['A']);
        const r = calcolaRoadmap(conf, uno, oggi, sint(uno, ['confermata']), [rep('word', uno[0], dopo)]);
        expect(r.tappe[4].dettaglio).toBe('1 di 2 report');
      });
    });

    it('un solo sistema usa il singolare nei dettagli', () => {
      const l = sis(['A']);
      const zero = calcolaRoadmap(conf, l, oggi, sint(l, [null]), []);
      expect(zero.tappe[2].dettaglio).toBe('0 di 1 sistema');
      expect(zero.tappe[3].dettaglio).toBe('0 di 1 confermato');
      const uno = calcolaRoadmap(conf, l, oggi, sint(l, ['confermata']), []);
      expect(uno.tappe[2].dettaglio).toBe('1 di 1 sistema');
      expect(uno.tappe[3].dettaglio).toBe('1 di 1 confermato');
    });

    it('tappe 3-4 indipendenti da 1-2 ma la prossima azione segue la priorità', () => {
      const l = sis(['A']);
      const r = calcolaRoadmap(cliente, l, oggi, sint(l, ['confermata']), []);
      expect(stati(r)).toEqual(['completata', 'in_corso', 'completata', 'completata', 'da_fare']);
      expect(r.percentuale).toBe(60);
      expect(r.prossimaAzione).toBe("Conferma l'inventario (1 sistema)");
    });
  });
});

describe('sintesiPerRoadmap', () => {
  const l = sistemi(2);
  const val = (sistemaId: string, versioneRegole: string, stato: Valutazione['stato']): Valutazione => ({
    id: 'v', sistemaId, versioneRegole, risposte: {}, esito: null, stato, classeConfermata: null,
    notaModifica: null, creatoIl: '', modificatoIl: '', confermatoIl: '2026-10-01T10:00:00.000Z', sostituitaIl: null,
  });
  it('calcola daRivedere dalla versione', () => {
    const r = sintesiPerRoadmap(l, [val('s0', '1.0.0', 'confermata'), null], '1.1.0');
    expect(r).toEqual([
      { sistemaId: 's0', sistemaNome: 'Sistema 0', valutazioneId: 'v', confermatoIl: '2026-10-01T10:00:00.000Z', stato: 'confermata', daRivedere: true },
      { sistemaId: 's1', sistemaNome: 'Sistema 1', valutazioneId: null, confermatoIl: null, stato: null, daRivedere: false },
    ]);
  });
  it('versione corrente: non da rivedere', () => {
    expect(sintesiPerRoadmap([l[0]], [val('s0', '1.0.0', 'completata')], '1.0.0')[0].daRivedere).toBe(false);
  });
});
