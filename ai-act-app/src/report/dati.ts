import { formattaData, giornoLocale } from '../domain/formatoData';
import type { ImpostazioniStudio } from '../domain/report';
import { RUOLI, type Cliente, type SistemaAI } from '../domain/tipi';
import { ETICHETTE_STATO, type Valutazione } from '../domain/valutazione';
import type { EsitoValutazione } from '../regole/motore';
import { ETICHETTE_CLASSE, type Classe, type FileRegole } from '../regole/tipi';

/** Dati del Word di un sistema. Tutte le date sono già `gg/mm/aaaa` (solo `cliente` e `sistema` restano grezzi). */
export interface DatiReportSistema {
  studio: ImpostazioniStudio;
  cliente: Cliente;
  sistema: SistemaAI;
  ruoloEtichetta: string;
  ruoloEffettivoEtichetta: string;
  /** Ruolo effettivo da definire: gli obblighi sono quelli di tutti i ruoli. */
  ruoloDaDefinire: boolean;
  /** Classe del consulente (quella calcolata se non modificata). */
  classe: Classe;
  /** Classe calcolata dal motore; valorizzata solo se il consulente l'ha modificata. */
  classeCalcolata: Classe | null;
  /** Motivo della modifica; null se la classe non è stata modificata. */
  notaModifica: string | null;
  trasparenza: boolean;
  /** gg/mm/aaaa */
  applicabileDal: string | null;
  motivazione: { testo: string; riferimento: string }[];
  /** Testi delle domande da approfondire. */
  aperte: string[];
  obblighi: { testo: string; riferimento: string; /** gg/mm/aaaa */ dal: string }[];
  regoleNonValidate: boolean;
  /** gg/mm/aaaa, giorno locale */
  confermatoIl: string;
  versioneRegole: string;
  /** Vuota se le regole non sono disponibili. */
  norma: string;
}

/**
 * Regole non validate (R3): una voce usata dall'esito che nelle regole correnti non è `validata`
 * (voce mancante inclusa). Senza regole, o se la valutazione è di un'altra versione delle regole,
 * ci si affida al conteggio salvato nell'esito.
 */
function nonValidate(valutazione: Valutazione, esito: EsitoValutazione, regole: FileRegole | null): boolean {
  if (!regole || valutazione.versioneRegole !== regole.meta.versione) return esito.vociNonValidate > 0;
  const usate = esito.vociUsate;
  const stati = new Map<string, string>();
  for (const v of [...regole.domande, ...regole.esiti, ...regole.trasparenza, ...regole.obblighi]) stati.set(v.id, v.stato);
  return usate.some((id) => stati.get(id) !== 'validata');
}

export function datiReportSistema(
  studio: ImpostazioniStudio,
  cliente: Cliente,
  sistema: SistemaAI,
  valutazione: Valutazione,
  regole: FileRegole | null,
): DatiReportSistema {
  const esito = valutazione.esito;
  if (valutazione.stato !== 'confermata' || !esito) throw new Error('Valutazione non confermata');
  const modificata = valutazione.classeConfermata !== null && valutazione.classeConfermata !== esito.classe;
  const conferma = valutazione.confermatoIl ?? valutazione.modificatoIl;
  return {
    studio,
    cliente,
    sistema,
    ruoloEtichetta: RUOLI[sistema.ruoloCliente],
    ruoloEffettivoEtichetta: RUOLI[esito.ruoloEffettivo],
    ruoloDaDefinire: esito.ruoloEffettivo === 'da_definire',
    classe: valutazione.classeConfermata ?? esito.classe,
    classeCalcolata: modificata ? esito.classe : null,
    notaModifica: modificata ? valutazione.notaModifica : null,
    trasparenza: esito.trasparenza,
    applicabileDal: esito.dataApplicazioneClasse ? formattaData(esito.dataApplicazioneClasse) : null,
    motivazione: esito.motivazione.map((m) => ({ testo: m.testo, riferimento: m.riferimento })),
    aperte: esito.aperte.map((id) => regole?.domande.find((d) => d.id === id)?.testo ?? id),
    obblighi: esito.obblighi.map((o) => ({
      testo: o.testo,
      riferimento: o.riferimento,
      dal: formattaData(o.dataApplicazione),
    })),
    regoleNonValidate: nonValidate(valutazione, esito, regole),
    confermatoIl: formattaData(conferma),
    versioneRegole: valutazione.versioneRegole,
    norma: regole?.meta.norma ?? '',
  };
}

/**
 * Riga del foglio Inventario. I testi sono già pronti per la cella.
 * Date: `AAAA-MM-GG` del giorno di calendario locale (timestamp convertito nel fuso locale),
 * null se assenti; il generatore Excel le trasforma in `Date.UTC(y, m-1, d)` (R2).
 * Classe: etichetta della classe del consulente; se modificata, con la classe calcolata a cui si riferiscono gli obblighi.
 * Classe, Trasparenza, Data conferma, Applicabile dal: valorizzati solo per le valutazioni confermate
 * (stringa vuota / null altrimenti); N. obblighi vale 0 se non confermata.
 */
export interface RigaInventario {
  sistema: string;
  fornitore: string;
  scopo: string;
  reparto: string;
  ruoloCliente: string;
  classe: string;
  /** 'Sì' | 'No' | '' */
  trasparenza: string;
  /** Etichetta dello stato, oppure `Non avviata`. */
  stato: string;
  dataConferma: string | null;
  applicabileDal: string | null;
  nObblighi: number;
  /** 'Sì' | 'No' */
  daRivedere: string;
}

/** Riga del foglio Obblighi. `dal`: `AAAA-MM-GG`, data propria dell'obbligo (non spostata di fuso). */
export interface RigaObbligo {
  sistema: string;
  obbligo: string;
  riferimento: string;
  dal: string;
}

export interface DatiInventario {
  studio: ImpostazioniStudio;
  cliente: Cliente;
  righe: RigaInventario[];
  /** Solo sistemi con valutazione confermata, ordinati per data poi sistema. */
  obblighi: RigaObbligo[];
}

/**
 * Cella Classe: le colonne sono fisse, quindi la classe modificata dal consulente dichiara
 * a quale classe si riferiscono gli obblighi (quelli della classe calcolata).
 */
function etichettaClasse(confermata: Classe | null, calcolata: Classe): string {
  if (confermata === null || confermata === calcolata) return ETICHETTE_CLASSE[calcolata];
  return `${ETICHETTE_CLASSE[confermata]} (modificata; obblighi riferiti a: ${ETICHETTE_CLASSE[calcolata]})`;
}

/** `attive[i]` è la valutazione attiva di `sistemi[i]` (o null). */
export function datiInventario(
  studio: ImpostazioniStudio,
  cliente: Cliente,
  sistemi: SistemaAI[],
  attive: (Valutazione | null)[],
  versioneCorrente: string,
): DatiInventario {
  const righe: RigaInventario[] = [];
  const obblighi: RigaObbligo[] = [];
  sistemi.forEach((s, i) => {
    const v = attive[i] ?? null;
    const esito = v?.esito ?? null;
    const confermata = v !== null && v.stato === 'confermata' && esito !== null;
    righe.push({
      sistema: s.nome,
      fornitore: s.fornitore,
      scopo: s.scopo,
      reparto: s.reparto ?? '',
      ruoloCliente: RUOLI[s.ruoloCliente],
      classe: confermata ? etichettaClasse(v.classeConfermata, esito.classe) : '',
      trasparenza: confermata ? (esito.trasparenza ? 'Sì' : 'No') : '',
      stato: v ? ETICHETTE_STATO[v.stato] : 'Non avviata',
      dataConferma: confermata ? giornoLocale(v.confermatoIl ?? v.modificatoIl) : null,
      applicabileDal: confermata ? esito.dataApplicazioneClasse : null,
      nObblighi: confermata ? esito.obblighi.length : 0,
      daRivedere: v !== null && v.versioneRegole !== versioneCorrente ? 'Sì' : 'No',
    });
    if (confermata) {
      for (const o of esito.obblighi) {
        obblighi.push({ sistema: s.nome, obbligo: o.testo, riferimento: o.riferimento, dal: o.dataApplicazione });
      }
    }
  });
  obblighi.sort((a, b) => a.dal.localeCompare(b.dal) || a.sistema.localeCompare(b.sistema, 'it'));
  return { studio, cliente, righe, obblighi };
}
