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
    expect(idObblighi(e)).toEqual(['ob_art4_alfabetizzazione', 'ob_all1b_normativa_settore']);
    expect(e.obblighi.find((o) => o.id === 'ob_all1b_normativa_settore')!.dataApplicazione).toBe('2028-08-02');
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

  it('Allegato I, Sez. A e Sez. B insieme → prevale la Sez. A, senza l\'obbligo della normativa di settore', () => {
    const e = esito({ ar1_componente_sicurezza: 'si', ar1_sezione_b: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(e.motivazione.map((m) => m.riferimento)).toEqual(['Art. 6(1), All. I, Sez. A']);
    expect(idObblighi(e)).toEqual(expect.arrayContaining(['ob_art26_deployer_all1']));
    expect(idObblighi(e)).not.toContain('ob_all1b_normativa_settore');
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
  it('ente pubblico deployer di un sistema Allegato III → registrazione dell\'uso (art. 49(3)) e termine del 02/08/2030', () => {
    const e = esito({ ar3_occupazione: 'si', ruo_ente_pubblico: 'si' }, 'deployer');
    expect(e.classe).toBe('alto_rischio');
    expect(idObblighi(e)).toEqual(expect.arrayContaining([
      'ob_art26_deployer', 'ob_art27_fria', 'ob_art49_3_deployer_pubblico', 'ob_art111_2_autorita_pubbliche',
    ]));
    const o = (id: string) => e.obblighi.find((x) => x.id === id)!;
    expect(o('ob_art49_3_deployer_pubblico').dataApplicazione).toBe('2027-12-02');
    expect(o('ob_art49_3_deployer_pubblico').riferimento).toBe('Art. 49(3)');
    expect(o('ob_art111_2_autorita_pubbliche').dataApplicazione).toBe('2030-08-02');
    expect(o('ob_art111_2_autorita_pubbliche').riferimento).toBe('Art. 111(2)');
  });

  it('ente pubblico fornitore → termine del 02/08/2030 ma non la registrazione del deployer', () => {
    const e = esito({ ar3_occupazione: 'si', ruo_ente_pubblico: 'si', ruo_marchio: 'si' }, 'distributore');
    expect(e.ruoloEffettivo).toBe('fornitore');
    expect(idObblighi(e)).toContain('ob_art111_2_autorita_pubbliche');
    expect(idObblighi(e)).not.toContain('ob_art49_3_deployer_pubblico');
  });

  it('senza ente pubblico nessuno dei due obblighi', () => {
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
    expect(voce('ob_art27_fria').testo).toContain('(art. 27(4))');
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
    expect(voce('tra_interazione').aiuto).toContain('è di norma fornitore (art. 3(3))');
  });
});
