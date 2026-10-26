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
  ar1_sezione_b: 'no',
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
  ruo_uso_autorita_pubbliche: 'no',
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

describe('casi di prova sulle regole v1.1.0 (spec §8)', () => {
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

  it('12. componente di sicurezza di un macchinario (All. I, Sez. B) → alto rischio tramite la normativa di settore, dal 02/08/2028', () => {
    const e = esito({ ar1_componente_sicurezza: 'no', ar1_sezione_b: 'si' }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(e.completo).toBe(true);
    expect(e.dataApplicazioneClasse).toBe('2028-08-02');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 6(1), art. 2(2), All. I, Sez. B']);
    // Il Capo III non si applica direttamente (art. 2(2)): solo l'obbligo di rispettare la normativa di settore.
    // Per i sistemi della sola Sez. B non si applicano neppure gli artt. 4 e 50 (art. 2(2)).
    expect(idObblighi(e)).toEqual(['ob_all1b_normativa_settore']);
    expect(e.obblighi.find((o) => o.id === 'ob_all1b_normativa_settore')!.dataApplicazione).toBe('2028-08-02');
  });

  it('12-bis. macchina (solo Sez. B) che interagisce con persone → niente art. 4 né art. 50, trasparenza false', () => {
    for (const ruolo of ['fornitore', 'deployer'] as const) {
      const e = esito({
        ar1_sezione_b: 'si', tra_interazione: 'si', tra_contenuti_sintetici: 'si', tra_emozioni_biometria: 'si',
        tra_deepfake: 'si', tra_testi_pubblici: 'si',
      }, ruolo);
      expect(e.classe).toBe('alto_rischio');
      expect(e.trasparenza).toBe(false);
      expect(idObblighi(e).filter((id) => id.startsWith('ob_art50') || id === 'ob_art4_alfabetizzazione')).toEqual([]);
    }
  });

  it('12b. dispositivo medico certificato da organismo notificato (All. I, Sez. A) → alto rischio dal 02/08/2028', () => {
    const e = esito({ ar1_componente_sicurezza: 'si' }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(e.dataApplicazioneClasse).toBe('2028-08-02');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 6(1), All. I, Sez. A']);
    expect(idObblighi(e)).toEqual(expect.arrayContaining(OBBLIGHI_FORNITORE_ALTO_RISCHIO.map((id) => `${id}_all1`)));
    expect(idObblighi(e)).not.toContain('ob_art9_gestione_rischi');
    expect(idObblighi(e)).not.toContain('ob_all1b_normativa_settore');
    // La registrazione nella banca dati UE (art. 49(1)) riguarda i sistemi dell'Allegato III.
    expect(idObblighi(e)).not.toContain('ob_art49_registrazione');
    // Tutti gli obblighi di alto rischio si applicano dal 02/08/2028.
    for (const o of e.obblighi.filter((x) => x.id !== 'ob_art4_alfabetizzazione')) {
      expect(o.dataApplicazione, o.id).toBe('2028-08-02');
    }
  });
});

describe('date e ambito: casi aggiuntivi', () => {
  it('Allegato I + Allegato III senza deroga → alto rischio e obblighi dal 02/12/2027', () => {
    const e = esito({ ar1_componente_sicurezza: 'si', ar3_infrastrutture_critiche: 'si' }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.dataApplicazioneClasse).toBe('2027-12-02');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 6(2), All. III']);
    expect(idObblighi(e)).toEqual(expect.arrayContaining([...OBBLIGHI_FORNITORE_ALTO_RISCHIO, 'ob_art49_registrazione']));
    expect(idObblighi(e).some((id) => id.endsWith('_all1'))).toBe(false);
    for (const o of e.obblighi.filter((x) => x.id !== 'ob_art4_alfabetizzazione')) {
      expect(o.dataApplicazione, o.id).toBe('2027-12-02');
    }
  });

  it('Allegato I + Allegato III in deroga → alto rischio per l\'Allegato I, dal 02/08/2028, senza obblighi solo Allegato III', () => {
    const e = esito({
      ar1_componente_sicurezza: 'si', ar3_occupazione: 'si', der_compito_preparatorio: 'si', der_profilazione: 'no',
    }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(e.dataApplicazioneClasse).toBe('2028-08-02');
    expect(idObblighi(e)).toEqual(expect.arrayContaining(['ob_art26_deployer_all1', 'ob_art26_7_lavoratori_all1']));
    expect(idObblighi(e)).not.toContain('ob_art86_spiegazione');
    expect(idObblighi(e)).not.toContain('ob_art27_fria');
  });

  it('Allegato I, Sez. A e Sez. B insieme → obblighi Sez. A più l\'obbligo della normativa di settore', () => {
    const e = esito({ ar1_componente_sicurezza: 'si', ar1_sezione_b: 'si' }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 6(1), All. I, Sez. A']);
    expect(idObblighi(e)).toEqual(expect.arrayContaining([
      ...OBBLIGHI_FORNITORE_ALTO_RISCHIO.map((id) => `${id}_all1`), 'ob_all1b_normativa_settore', 'ob_art4_alfabetizzazione',
    ]));
    const d = esito({ ar1_componente_sicurezza: 'si', ar1_sezione_b: 'si' }, 'deployer');
    expect(idObblighi(d)).toContain('ob_art26_deployer_all1');
    // L'obbligo della normativa di settore grava su fornitore e importatore.
    expect(idObblighi(d)).not.toContain('ob_all1b_normativa_settore');
  });

  it('Allegato I, Sez. A e Sez. B insieme: art. 50 applicabile', () => {
    const e = esito({ ar1_componente_sicurezza: 'si', ar1_sezione_b: 'si', tra_interazione: 'si' }, 'fornitore');
    expect(e.trasparenza).toBe(true);
    expect(idObblighi(e)).toContain('ob_art50_1_interazione');
  });

  it('Allegato I, Sez. B + Allegato III senza deroga → obblighi Allegato III, senza l\'obbligo della normativa di settore', () => {
    const e = esito({ ar1_sezione_b: 'si', ar3_infrastrutture_critiche: 'si' }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.dataApplicazioneClasse).toBe('2027-12-02');
    expect(idObblighi(e)).toEqual(expect.arrayContaining([...OBBLIGHI_FORNITORE_ALTO_RISCHIO, 'ob_art49_registrazione']));
    expect(idObblighi(e)).not.toContain('ob_all1b_normativa_settore');
  });

  it('Allegato I, Sez. B + Allegato III in deroga → alto rischio per la Sez. B, obbligo della normativa di settore', () => {
    const e = esito({
      ar1_sezione_b: 'si', ar3_occupazione: 'si', der_compito_preparatorio: 'si', der_profilazione: 'no',
    }, 'fornitore');
    expect(e.classe).toBe('alto_rischio');
    expect(e.dataApplicazioneClasse).toBe('2028-08-02');
    expect(idObblighi(e)).toContain('ob_all1b_normativa_settore');
    expect(idObblighi(e).some((id) => id.endsWith('_all1'))).toBe(false);
    expect(idObblighi(e)).not.toContain('ob_art9_gestione_rischi');
    expect(idObblighi(e)).not.toContain('ob_art4_alfabetizzazione');
  });

  it('Allegato I, Sez. B + Allegato III senza deroga → artt. 4 e 50 applicabili', () => {
    const e = esito({ ar1_sezione_b: 'si', ar3_infrastrutture_critiche: 'si', tra_interazione: 'si' }, 'fornitore');
    expect(e.trasparenza).toBe(true);
    expect(idObblighi(e)).toEqual(expect.arrayContaining(['ob_art4_alfabetizzazione', 'ob_art50_1_interazione']));
  });

  it('impresa che offre ai consumatori un generatore di immagini → non esclusa: minimo + trasparenza', () => {
    const e = esito({ amb_esclusione: 'no', tra_contenuti_sintetici: 'si' }, 'fornitore');
    expect(e.classe).toBe('minimo');
    expect(e.trasparenza).toBe(true);
    expect(idObblighi(e)).toEqual(['ob_art4_alfabetizzazione', 'ob_art50_2_marcatura']);
  });

  it("la domanda sulle esclusioni limita l'art. 2(10) al cliente persona fisica e non esclude chi offre ai consumatori", () => {
    const d = REGOLE!.domande.find((x) => x.id === 'amb_esclusione')!;
    expect(d.testo).toContain('il cliente è una persona fisica');
    expect(d.aiuto).toContain('NON è escluso');
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

describe('autorità pubbliche (artt. 49(3) e 111(2))', () => {
  const visibili = (modifiche: Risposte) =>
    domandeVisibili(REGOLE!, { ...NESSUN_RISCHIO, ...modifiche }).map((d) => d.id);

  it('la domanda sull\'uso da parte di autorità pubbliche compare per ogni caso ad alto rischio', () => {
    expect(visibili({ ar1_componente_sicurezza: 'si' })).toContain('ruo_uso_autorita_pubbliche');
    expect(visibili({ ar1_sezione_b: 'si' })).toContain('ruo_uso_autorita_pubbliche');
    expect(visibili({ ar3_occupazione: 'si' })).toContain('ruo_uso_autorita_pubbliche');
    expect(visibili({ ar3_occupazione: 'si', der_compito_preparatorio: 'si', der_profilazione: 'si' }))
      .toContain('ruo_uso_autorita_pubbliche');
    expect(visibili({})).not.toContain('ruo_uso_autorita_pubbliche');
    expect(visibili({ ar3_occupazione: 'si', der_compito_preparatorio: 'si', der_profilazione: 'no' }))
      .not.toContain('ruo_uso_autorita_pubbliche');
    const d = REGOLE!.domande.find((x) => x.id === 'ruo_uso_autorita_pubbliche')!;
    expect(d.sezione).toBe('ruolo');
    expect(d.riferimento).toBe('Art. 111(2), art. 49(3)');
    expect(d.stato).toBe('bozza');
  });

  it('All. III punto 4 + uso da autorità pubbliche, deployer → artt. 49(3) e 111(2)', () => {
    const e = esito({ ar3_occupazione: 'si', ruo_uso_autorita_pubbliche: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(e.completo).toBe(true);
    expect(idObblighi(e)).toEqual(expect.arrayContaining([
      'ob_art26_deployer', 'ob_art49_3_deployer_pubblico', 'ob_art111_2_autorita_pubbliche',
    ]));
    const o = (id: string) => e.obblighi.find((x) => x.id === id)!;
    expect(o('ob_art49_3_deployer_pubblico').dataApplicazione).toBe('2027-12-02');
    expect(o('ob_art49_3_deployer_pubblico').riferimento).toBe('Art. 49(3)');
    expect(o('ob_art111_2_autorita_pubbliche').dataApplicazione).toBe('2030-08-02');
    expect(o('ob_art111_2_autorita_pubbliche').riferimento).toBe('Art. 111(2)');
  });

  it('il solo ente pubblico (art. 27) non attiva più gli artt. 49(3) e 111(2)', () => {
    const e = esito({ ar3_occupazione: 'si', ruo_ente_pubblico: 'si' }, 'deployer');
    expect(idObblighi(e)).toContain('ob_art27_fria');
    expect(idObblighi(e)).not.toContain('ob_art49_3_deployer_pubblico');
    expect(idObblighi(e)).not.toContain('ob_art111_2_autorita_pubbliche');
  });

  it('All. III solo punto 2 + autorità pubblica deployer → niente art. 49(3)', () => {
    const e = esito({ ar3_infrastrutture_critiche: 'si', ruo_uso_autorita_pubbliche: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(idObblighi(e)).not.toContain('ob_art49_3_deployer_pubblico');
    expect(idObblighi(e)).toContain('ob_art111_2_autorita_pubbliche');
  });

  it('All. III punto 2 e punto 4 + autorità pubblica deployer → art. 49(3)', () => {
    const e = esito({ ar3_infrastrutture_critiche: 'si', ar3_occupazione: 'si', ruo_uso_autorita_pubbliche: 'si' }, 'deployer');
    expect(idObblighi(e)).toContain('ob_art49_3_deployer_pubblico');
  });

  it('fornitore di un sistema destinato ad autorità pubbliche → art. 111(2) ma non art. 49(3)', () => {
    const e = esito({ ar3_occupazione: 'si', ruo_uso_autorita_pubbliche: 'si', ruo_marchio: 'si' }, 'distributore');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(idObblighi(e)).toContain('ob_art111_2_autorita_pubbliche');
    expect(idObblighi(e)).not.toContain('ob_art49_3_deployer_pubblico');
  });

  it('Sez. A (dispositivo medico) + uso da autorità pubbliche → art. 111(2)', () => {
    const e = esito({ ar1_componente_sicurezza: 'si', ruo_uso_autorita_pubbliche: 'si' }, 'fornitore');
    expect(idObblighi(e)).toContain('ob_art111_2_autorita_pubbliche');
    expect(idObblighi(e)).not.toContain('ob_art49_3_deployer_pubblico');
  });

  it('solo Sez. B + uso da autorità pubbliche → art. 111(2) (artt. 102–112 applicabili)', () => {
    const e = esito({ ar1_sezione_b: 'si', ruo_uso_autorita_pubbliche: 'si' }, 'fornitore');
    expect(idObblighi(e)).toEqual(['ob_all1b_normativa_settore', 'ob_art111_2_autorita_pubbliche']);
  });

  it('senza uso da autorità pubbliche nessuno dei due obblighi', () => {
    const e = esito({ ar3_occupazione: 'si' }, 'deployer');
    expect(idObblighi(e)).not.toContain('ob_art49_3_deployer_pubblico');
    expect(idObblighi(e)).not.toContain('ob_art111_2_autorita_pubbliche');
  });
});

describe('testi allineati al Reg. (UE) 2026/1744', () => {
  const tutte = () => [...REGOLE!.domande, ...REGOLE!.esiti, ...REGOLE!.trasparenza, ...REGOLE!.obblighi];
  const voce = (id: string) => tutte().find((v) => v.id === id)! as unknown as Record<string, string>;

  it('art. 4: misure per sostenere l\'alfabetizzazione, senza livello specifico garantito', () => {
    const o = voce('ob_art4_alfabetizzazione');
    expect(o.testo).toContain("Adottare misure per sostenere lo sviluppo dell'alfabetizzazione");
    expect(o.testo).toContain('Non è richiesto di garantire un livello specifico');
    expect(o.testo).not.toContain('verificare il testo in GU');
    expect(o.riferimento).toBe('Art. 4(1)');
  });

  it('art. 49(2): obbligo confermato, contenuti semplificati', () => {
    const o = voce('ob_art49_2_registrazione_deroga');
    expect(o.testo).not.toContain('potrebbe aver modificato');
    expect(o.testo).toContain('Allegato VIII, sezione B, punti 7 e 9 soppressi');
  });

  it('art. 27(4): rinvio alla DPIA', () => {
    expect(voce('ob_art27_fria').testo).toContain(
      "Se la valutazione d'impatto sulla protezione dei dati (art. 35 GDPR) copre già alcuni elementi, si può rinviare alle relative sezioni o includerne le parti pertinenti (art. 27(4)).");
  });

  it('art. 49(2): obbligo sorge con la classificazione dell\'art. 6(3)', () => {
    expect(voce('ob_art49_2_registrazione_deroga').testo).toContain(
      "L'art. 49 si applica formalmente dal 02/08/2026, ma l'obbligo sorge con la classificazione ai sensi dell'art. 6(3), applicabile dal 02/12/2027.");
  });

  it('art. 49(3) e art. 111(2): testi', () => {
    expect(voce('ob_art49_3_deployer_pubblico').testo).toBe("Prima di mettere in servizio o usare il sistema, le autorità pubbliche, le istituzioni, organi e organismi dell'Unione e chi agisce per loro conto devono registrarsi, selezionare il sistema e registrarne l'uso nella banca dati UE (esclusi i sistemi dell'Allegato III, punto 2). L'art. 49 si applica formalmente dal 02/08/2026, ma l'obbligo sorge con la classificazione ai sensi dell'art. 6(2), applicabile dal 02/12/2027.");
    expect(voce('ob_art111_2_autorita_pubbliche').testo).toBe("Solo per sistemi destinati a essere usati da autorità pubbliche e già immessi sul mercato o messi in servizio prima della data di applicazione del Capo III (02/12/2027 per l'Allegato III, 02/08/2028 per l'Allegato I): fornitori e deployer devono adeguarli ai requisiti e agli obblighi del Regolamento entro il 02/08/2030, anche in assenza di modifiche significative. Per i sistemi immessi o messi in servizio dopo tali date gli obblighi si applicano dalle date ordinarie.");
    const d = voce('ruo_uso_autorita_pubbliche');
    expect(d.testo).toBe("Il sistema è destinato a essere usato da autorità pubbliche (o da istituzioni, organi e organismi dell'Unione)?");
    expect(d.aiuto).toBe("Conta la destinazione d'uso del sistema, non la natura del cliente: rispondi «Sì» anche se il cliente è un fornitore privato che lo vende alla pubblica amministrazione. Non rientrano i privati che forniscono servizi pubblici.");
  });

  it('Sez. B: normativa di settore, ruoli e testo', () => {
    const o = REGOLE!.obblighi.find((x) => x.id === 'ob_all1b_normativa_settore')!;
    expect(o.ruoli).toEqual(['fornitore', 'importatore']);
    expect(o.testo).toBe("Rispettare i requisiti per i sistemi di IA ad alto rischio come integrati nella normativa di settore dell'Allegato I, Sezione B (es. Reg. (UE) 2023/1230 macchine, Reg. (UE) 2018/858 veicoli). Per la parte che ricade nella Sezione B gli obblighi del Capo III dell'AI Act non si applicano direttamente (art. 2(2)); se il sistema rientra anche nella Sezione A o nell'Allegato III, valgono anche gli obblighi elencati per quei casi. Per le macchine i requisiti saranno inseriti nell'Allegato III del Reg. (UE) 2023/1230 con atti delegati applicabili entro il 02/08/2028; per le altre normative della Sezione B i tempi dipendono dagli atti della Commissione previsti dagli artt. 102–109. Se il sistema rientra solo nella Sezione B, non si applicano neppure gli artt. 4 e 50 dell'AI Act (art. 2(2)), che restano applicabili agli altri sistemi di IA dell'organizzazione.");
  });

  it('art. 43(3): Sez. A + Allegato III', () => {
    expect(voce('ob_art43_conformita').testo).toContain(
      "Se il sistema rientra anche nell'Allegato I, Sezione A, si segue la procedura di valutazione prevista da quella normativa (art. 43(3)).");
  });

  it('art. 6(1a)-(1c) nelle domande dell\'Allegato I', () => {
    const frase = "Non è componente di sicurezza un sistema usato solo per assistenza all'utente, ottimizzazione delle prestazioni, efficienza, automazione, comodità o controllo qualità non legati alla sicurezza; lo è comunque se un suo guasto metterebbe in pericolo salute e sicurezza (art. 6(1a)-(1b)). Rispondi «No» anche se l'organismo terzo interviene solo per rischi diversi da salute e sicurezza, es. spettro radio o interferenze elettromagnetiche (art. 6(1c)).";
    expect(voce('ar1_componente_sicurezza').aiuto).toContain(frase);
    expect(voce('ar1_sezione_b').aiuto).toContain(frase);
    const t = voce('ar1_sezione_b').testo;
    expect(t).toContain('veicoli a due o tre ruote e quadricicli');
    expect(t).toContain('aviazione civile (inclusi aeromobili senza equipaggio)');
    expect(t).toContain('soggetto a omologazione o a valutazione della conformità da parte di terzi');
  });

  it('art. 5(1b) e consenso nella domanda NCII', () => {
    expect(voce('vie_ncii').aiuto).toContain("Per il fornitore rileva anche un risultato ottenibile senza modifiche tecniche significative. Non è manipolazione la modifica che non aumenta l'esposizione delle parti intime né altera la natura delle attività sessuali raffigurate (art. 5(1b)). Il consenso deve essere libero, specifico, informato, inequivocabile ed esplicito.");
  });

  it('voci toccate in stato bozza', () => {
    for (const id of ['ruo_uso_autorita_pubbliche', 'ob_art111_2_autorita_pubbliche', 'ob_art4_alfabetizzazione',
      'ob_all1b_normativa_settore', 'ob_art49_3_deployer_pubblico', 'ar1_componente_sicurezza', 'ar1_sezione_b',
      'tra_interazione', 'ob_art43_conformita', 'ob_art49_2_registrazione_deroga', 'vie_ncii', 'ob_art27_fria',
      'tr_interazione', 'tr_contenuti_sintetici', 'tr_emozioni_biometria', 'tr_deepfake', 'tr_testi_pubblici']) {
      expect(voce(id).stato, id).toBe('bozza');
    }
  });

  it('nuova pratica vietata con le lettere (ba) e (bb)', () => {
    for (const id of ['vie_ncii', 'es_vietato_ncii', 'ob_art5_ncii_cessazione']) {
      expect(voce(id).riferimento, id).toBe('Art. 5(1), lett. (ba) e (bb); art. 5(1a)-(1b)');
    }
    const aiuto = voce('vie_ncii').aiuto;
    expect(aiuto).not.toContain('da verificare');
    expect(aiuto).toContain('ragionevolmente prevedibile');
    expect(aiuto).toContain('02/12/2026');
    expect(aiuto).toContain('«spogliano»');
  });

  it('Allegato I: le macchine sono nella Sezione B', () => {
    const a = voce('ar1_componente_sicurezza');
    expect(a.riferimento).toBe('Art. 6(1), All. I, Sez. A');
    expect(a.testo).not.toContain('macchine');
    const b = voce('ar1_sezione_b');
    expect(b.testo).toContain('macchine');
    expect(b.riferimento).toBe('Art. 6(1), art. 2(2), All. I, Sez. B');
    const ids = REGOLE!.domande.map((d) => d.id);
    expect(ids.indexOf('ar1_sezione_b')).toBe(ids.indexOf('ar1_componente_sicurezza') + 1);
    expect(JSON.stringify(REGOLE!.domande[ids.indexOf('ar1_sezione_b')].mostraSe))
      .toBe(JSON.stringify(REGOLE!.domande[ids.indexOf('ar1_componente_sicurezza')].mostraSe));
    const es = REGOLE!.esiti.map((x) => x.id);
    expect(es.indexOf('es_alto_all1_b')).toBe(es.indexOf('es_alto_all1') + 1);
    expect(es.indexOf('es_alto_all1_b')).toBeLessThan(es.indexOf('es_deroga'));
  });

  it('chatbot di terzi col marchio del cliente: il cliente è di norma fornitore (art. 50(1))', () => {
    expect(voce('tra_interazione').aiuto).toContain("Se il cliente offre il chatbot con il proprio nome o marchio, anche basato su un modello di terzi, è di norma fornitore (art. 3(3)): in tal caso indica «Fornitore» come ruolo del cliente nella scheda del sistema, così compaiono gli obblighi dell'art. 50(1).");
  });
});
