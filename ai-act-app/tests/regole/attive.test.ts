import { describe, expect, it } from 'vitest';
import { ERRORE_REGOLE, REGOLE } from '../../src/regole/attive';

describe('regole attive (regole/ai-act.json)', () => {
  it('si caricano senza errori, versione 1.0.0', () => {
    expect(ERRORE_REGOLE).toBeNull();
    expect(REGOLE).not.toBeNull();
    expect(REGOLE!.meta.id).toBe('ai-act');
    expect(REGOLE!.meta.versione).toBe('1.0.0');
    expect(REGOLE!.meta.norma).toBe('Reg. (UE) 2024/1689 come modificato dal Reg. (UE) 2026/1744');
  });

  it("ogni domanda vie_* cita l'art. 5", () => {
    const vie = REGOLE!.domande.filter((d) => d.id.startsWith('vie_'));
    expect(vie.length).toBe(9);
    for (const d of vie) expect(d.riferimento.startsWith('Art. 5'), d.id).toBe(true);
  });

  it('art. 4, art. 49(2) e la nuova pratica art. 5 sono da_verificare', () => {
    const tutte = [...REGOLE!.domande, ...REGOLE!.esiti, ...REGOLE!.trasparenza, ...REGOLE!.obblighi];
    const stato = (id: string) => tutte.find((v) => v.id === id)?.stato;
    expect(stato('ob_art4_alfabetizzazione')).toBe('da_verificare');
    expect(stato('ob_art49_2_registrazione_deroga')).toBe('da_verificare');
    expect(stato('vie_ncii')).toBe('da_verificare');
    expect(stato('es_vietato_ncii')).toBe('da_verificare');
    expect(stato('ob_art5_ncii_cessazione')).toBe('da_verificare');
    // Nessun'altra voce è da_verificare; nessuna è già validata.
    const daVerificare = tutte.filter((v) => v.stato === 'da_verificare').map((v) => v.id).sort();
    expect(daVerificare).toEqual([
      'es_vietato_ncii', 'ob_art49_2_registrazione_deroga', 'ob_art4_alfabetizzazione',
      'ob_art5_ncii_cessazione', 'vie_ncii',
    ]);
    expect(tutte.some((v) => v.stato === 'validata')).toBe(false);
  });

  it("l'art. 4 si applica a tutte le classi tranne fuori_ambito", () => {
    const o = REGOLE!.obblighi.find((x) => x.id === 'ob_art4_alfabetizzazione')!;
    expect([...o.classi].sort()).toEqual(
      ['alto_rischio', 'da_approfondire', 'minimo', 'non_alto_rischio_deroga', 'vietato'],
    );
    expect(o.dataApplicazione).toBe('2025-02-02');
  });

  it('la nuova pratica art. 5 si applica dal 02/12/2026', () => {
    expect(REGOLE!.esiti.find((e) => e.id === 'es_vietato_ncii')!.dataApplicazione).toBe('2026-12-02');
    expect(REGOLE!.obblighi.find((o) => o.id === 'ob_art5_ncii_cessazione')!.dataApplicazione).toBe('2026-12-02');
  });

  it('nessun obbligo per fuori_ambito; date art. 50 al 02/08/2026', () => {
    expect(REGOLE!.obblighi.some((o) => o.classi.includes('fuori_ambito'))).toBe(false);
    for (const o of REGOLE!.obblighi.filter((x) => x.riferimento.startsWith('Art. 50'))) {
      expect(o.dataApplicazione, o.id).toBe('2026-08-02');
      expect(o.soloSeTrasparenza, o.id).toBe(true);
    }
  });
});
