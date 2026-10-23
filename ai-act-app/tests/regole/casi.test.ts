import { describe, expect, it } from 'vitest';
import { REGOLE } from '../../src/regole/attive';
import { calcolaEsito, domandeVisibili } from '../../src/regole/motore';
import type { RuoloCliente } from '../../src/domain/tipi';
import type { Risposte } from '../../src/regole/tipi';

/**
 * Risposte di partenza, esplicite per ogni domanda del file: un sistema di IA in ambito
 * che non ricade in nessuna pratica vietata, area ad alto rischio, obbligo di trasparenza
 * o ipotesi dell'art. 25. Ogni caso indica solo le risposte che cambia.
 */
const NESSUN_RISCHIO: Risposte = {
  amb_sistema_ia: 'si',
  amb_esclusione: 'no',
  vie_manipolazione: 'no',
  vie_vulnerabilita: 'no',
  vie_punteggio_sociale: 'no',
  vie_previsione_reati: 'no',
  vie_scraping_volti: 'no',
  vie_emozioni_lavoro: 'no',
  vie_categorizzazione_biometrica: 'no',
  vie_identificazione_tempo_reale: 'no',
  vie_ncii: 'no',
  ar1_componente_sicurezza: 'no',
  ar3_biometria: 'no',
  ar3_infrastrutture_critiche: 'no',
  ar3_istruzione: 'no',
  ar3_occupazione: 'no',
  ar3_servizi_pubblici: 'no',
  ar3_servizi_credito_assicurazioni: 'no',
  ar3_contrasto: 'no',
  ar3_migrazione: 'no',
  ar3_giustizia_democrazia: 'no',
  der_compito_procedurale: 'no',
  der_migliora_attivita_umana: 'no',
  der_rileva_schemi: 'no',
  der_compito_preparatorio: 'no',
  der_profilazione: 'no',
  tra_interazione: 'no',
  tra_contenuti_sintetici: 'no',
  tra_emozioni_biometria: 'no',
  tra_deepfake: 'no',
  tra_testi_pubblici: 'no',
  ruo_marchio: 'no',
  ruo_modifica: 'no',
  ruo_ente_pubblico: 'no',
};

const esito = (modifiche: Risposte, ruolo: RuoloCliente) =>
  calcolaEsito(REGOLE!, { ...NESSUN_RISCHIO, ...modifiche }, ruolo);

const idObblighi = (e: ReturnType<typeof esito>) => e.obblighi.map((o) => o.id);

const OBBLIGHI_FORNITORE_ALTO_RISCHIO = [
  'ob_art9_gestione_rischi', 'ob_art10_dati', 'ob_art11_documentazione_tecnica', 'ob_art12_log',
  'ob_art13_istruzioni', 'ob_art14_sorveglianza_umana', 'ob_art15_accuratezza',
  'ob_art16_obblighi_fornitore', 'ob_art17_qualita', 'ob_art43_conformita', 'ob_art47_48_dichiarazione_ce',
  'ob_art72_monitoraggio', 'ob_art73_incidenti',
];

describe('casi di prova sulle regole v1.0.0 (spec §8)', () => {
  it('le risposte di partenza coprono esattamente le domande del file', () => {
    expect(Object.keys(NESSUN_RISCHIO).sort()).toEqual(REGOLE!.domande.map((d) => d.id).sort());
  });

  it('1. filtro antispam → minimo', () => {
    const e = esito({}, 'deployer');
    expect(e.classe).toBe('minimo');
    expect(e.trasparenza).toBe(false);
    expect(e.ruoloEffettivo).toBe('deployer');
    expect(e.completo).toBe(true);
    expect(idObblighi(e)).toEqual(['ob_art4_alfabetizzazione']);
    expect(e.dataApplicazioneClasse).toBeNull();
  });

  it('2. chatbot clienti di un fornitore terzo, deployer → minimo + trasparenza', () => {
    const e = esito({ tra_interazione: 'si' }, 'deployer');
    expect(e.classe).toBe('minimo');
    expect(e.trasparenza).toBe(true);
    expect(e.ruoloEffettivo).toBe('deployer');
    expect(e.motivazione.map((m) => m.riferimento)).toContain('Art. 50(1)');
    // L'obbligo dell'art. 50(1) grava sul fornitore, non sul deployer.
    expect(idObblighi(e)).toEqual(['ob_art4_alfabetizzazione']);
  });

  it('3. screening dei CV, deployer → alto rischio, art. 26 e 86, dal 02/12/2027', () => {
    const e = esito({ ar3_occupazione: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(e.trasparenza).toBe(false);
    expect(e.ruoloEffettivo).toBe('deployer');
    expect(e.completo).toBe(true);
    expect(e.dataApplicazioneClasse).toBe('2027-12-02');
    expect(idObblighi(e)).toEqual(expect.arrayContaining([
      'ob_art4_alfabetizzazione', 'ob_art26_deployer', 'ob_art26_7_lavoratori', 'ob_art86_spiegazione',
    ]));
    expect(idObblighi(e)).not.toContain('ob_art27_fria');
    expect(idObblighi(e)).not.toContain('ob_art9_gestione_rischi');
  });

  it('4. screening dei CV rivenduto col proprio marchio → alto rischio, ruolo fornitore', () => {
    const e = esito({ ar3_occupazione: 'si', ruo_marchio: 'si' }, 'distributore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(e.dataApplicazioneClasse).toBe('2027-12-02');
    expect(idObblighi(e)).toEqual(expect.arrayContaining([
      ...OBBLIGHI_FORNITORE_ALTO_RISCHIO, 'ob_art49_registrazione',
    ]));
    expect(idObblighi(e)).not.toContain('ob_art24_distributore');
    expect(idObblighi(e)).not.toContain('ob_art26_deployer');
  });

  it('5. scoring creditizio, banca deployer → alto rischio + art. 27 (FRIA)', () => {
    const e = esito({ ar3_servizi_credito_assicurazioni: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(e.ruoloEffettivo).toBe('deployer');
    expect(e.dataApplicazioneClasse).toBe('2027-12-02');
    expect(idObblighi(e)).toEqual(expect.arrayContaining([
      'ob_art26_deployer', 'ob_art27_fria', 'ob_art86_spiegazione',
    ]));
  });

  it('6. riconoscimento delle emozioni dei dipendenti → vietato', () => {
    const e = esito({ vie_emozioni_lavoro: 'si', tra_emozioni_biometria: 'si' }, 'deployer');
    expect(e.classe).toBe('vietato');
    expect(e.trasparenza).toBe(false);
    expect(e.dataApplicazioneClasse).toBe('2025-02-02');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 5(1)']);
    expect(idObblighi(e)).toEqual(['ob_art4_alfabetizzazione', 'ob_art5_cessazione']);
  });

  it('7. area Allegato III, compito procedurale ristretto, senza profilazione → deroga art. 6(3)', () => {
    const e = esito({ ar3_istruzione: 'si', der_compito_procedurale: 'si', der_profilazione: 'no' }, 'fornitore');
    expect(e.classe).toBe('non_alto_rischio_deroga');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(e.completo).toBe(true);
    expect(idObblighi(e)).toEqual(expect.arrayContaining([
      'ob_art4_alfabetizzazione', 'ob_art6_4_documentazione_deroga', 'ob_art49_2_registrazione_deroga',
    ]));
    expect(idObblighi(e)).not.toContain('ob_art9_gestione_rischi');
  });

  it('8. come il caso 7 ma con profilazione → alto rischio', () => {
    const e = esito({ ar3_istruzione: 'si', der_compito_procedurale: 'si', der_profilazione: 'si' }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 6(3), ultimo comma']);
    expect(e.dataApplicazioneClasse).toBe('2027-12-02');
    expect(idObblighi(e)).toEqual(expect.arrayContaining(OBBLIGHI_FORNITORE_ALTO_RISCHIO));
    expect(idObblighi(e)).not.toContain('ob_art6_4_documentazione_deroga');
  });

  it('9. generatore di immagini sintetiche, fornitore → minimo + trasparenza', () => {
    const e = esito({ tra_contenuti_sintetici: 'si' }, 'fornitore');
    expect(e.classe).toBe('minimo');
    expect(e.trasparenza).toBe(true);
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(idObblighi(e)).toEqual(['ob_art4_alfabetizzazione', 'ob_art50_2_marcatura']);
  });

  it('10. uso personale non professionale → fuori ambito', () => {
    const e = esito({ amb_esclusione: 'si' }, 'deployer');
    expect(e.classe).toBe('fuori_ambito');
    expect(e.trasparenza).toBe(false);
    expect(e.completo).toBe(true);
    expect(e.obblighi).toEqual([]);
  });

  it("11. «Non so» su un'area dell'Allegato III determinante → da approfondire", () => {
    const e = esito({ ar3_occupazione: 'non_so' }, 'deployer');
    expect(e.classe).toBe('da_approfondire');
    expect(e.aperte).toEqual(['ar3_occupazione']);
    expect(e.completo).toBe(true);
    expect(e.dataApplicazioneClasse).toBeNull();
    expect(idObblighi(e)).toEqual(['ob_art4_alfabetizzazione']);
  });

  it('12. componente di sicurezza di un macchinario → alto rischio dal 02/08/2028', () => {
    const e = esito({ ar1_componente_sicurezza: 'si' }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(e.dataApplicazioneClasse).toBe('2028-08-02');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 6(1), All. I']);
    expect(idObblighi(e)).toEqual(expect.arrayContaining(OBBLIGHI_FORNITORE_ALTO_RISCHIO));
    // La registrazione nella banca dati UE (art. 49(1)) riguarda i sistemi dell'Allegato III.
    expect(idObblighi(e)).not.toContain('ob_art49_registrazione');
  });
});

describe('«Non so» sulle domande che ne mostrano altre', () => {
  const visibili = (modifiche: Risposte) =>
    domandeVisibili(REGOLE!, { ...NESSUN_RISCHIO, ...modifiche }).map((d) => d.id);

  it('«Non so» su una condizione di deroga mostra la domanda sulla profilazione, che resta determinabile', () => {
    expect(visibili({ ar3_istruzione: 'si', der_compito_procedurale: 'non_so' })).toContain('der_profilazione');
    const e = esito({ ar3_istruzione: 'si', der_compito_procedurale: 'non_so', der_profilazione: 'no' }, 'fornitore');
    expect(e.classe).toBe('da_approfondire');
    expect(e.aperte).toEqual(['der_compito_procedurale']);
    expect(e.completo).toBe(true);
  });

  it('«Non so» sulla definizione di sistema di IA mostra la domanda sulle esclusioni', () => {
    expect(visibili({ amb_sistema_ia: 'non_so' })).toContain('amb_esclusione');
    const e = esito({ amb_sistema_ia: 'non_so' }, 'deployer');
    expect(e.classe).toBe('da_approfondire');
    expect(e.aperte).toEqual(['amb_sistema_ia']);
  });

  it('con tutte le condizioni di deroga a «No» la domanda sulla profilazione resta nascosta', () => {
    expect(visibili({ ar3_istruzione: 'si' })).not.toContain('der_profilazione');
  });
});
