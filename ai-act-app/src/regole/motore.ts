import type { RuoloCliente } from '../domain/tipi';
import { valuta } from './condizioni';
import type { Classe, Domanda, FileRegole, RegolaEsito, RegolaTrasparenza, Risposte, RuoloEffettivo } from './tipi';

export interface ObbligoApplicabile {
  id: string;
  testo: string;
  riferimento: string;
  dataApplicazione: string;
  ruoli: RuoloEffettivo[];
}

export interface EsitoValutazione {
  classe: Classe;
  trasparenza: boolean;
  motivazione: { testo: string; riferimento: string }[];
  aperte: string[];
  ruoloEffettivo: RuoloEffettivo | 'da_definire';
  obblighi: ObbligoApplicabile[];
  dataApplicazioneClasse: string | null;
  completo: boolean;
  vociUsate: string[];
  vociNonValidate: number;
}

/**
 * Domande visibili, nell'ordine del file. Il `mostraSe` di ciascuna è valutato
 * sulle sole risposte delle domande che la precedono e sono già risultate visibili.
 */
export function domandeVisibili(regole: FileRegole, r: Risposte): Domanda[] {
  const visibili: Domanda[] = [];
  const rilevanti: Risposte = {};
  for (const d of regole.domande) {
    if (d.mostraSe !== null && !valuta(d.mostraSe, rilevanti)) continue;
    visibili.push(d);
    if (r[d.id] !== undefined) rilevanti[d.id] = r[d.id];
  }
  return visibili;
}

/** Risposte delle sole domande visibili: quelle a domande nascoste sono scartate. */
function risposteEffettive(regole: FileRegole, r: Risposte): { visibili: Domanda[]; R: Risposte } {
  const visibili = domandeVisibili(regole, r);
  const R: Risposte = {};
  for (const d of visibili) if (r[d.id] !== undefined) R[d.id] = r[d.id];
  return { visibili, R };
}

interface Classificazione {
  classe: Classe;
  vincente: RegolaEsito | null;
  trasparenza: boolean;
  regoleTrasparenza: RegolaTrasparenza[];
}

function classifica(regole: FileRegole, R: Risposte): Classificazione {
  const vincente = regole.esiti.find((e) => valuta(e.quando, R)) ?? null;
  const classe: Classe = vincente ? vincente.classe : 'minimo';
  const regoleTrasparenza = classe === 'fuori_ambito' || classe === 'vietato'
    ? []
    : regole.trasparenza.filter((t) => valuta(t.quando, R));
  return { classe, vincente, trasparenza: regoleTrasparenza.length > 0, regoleTrasparenza };
}

/**
 * Domande visibili con `non_so` che, forzate a `si` e poi a `no` (altre risposte invariate,
 * visibilità ricalcolata), portano a classe o trasparenza diverse.
 */
function domandeAperte(regole: FileRegole, visibili: Domanda[], r: Risposte): string[] {
  const aperte: string[] = [];
  for (const d of visibili) {
    if (r[d.id] !== 'non_so') continue;
    const conSi = classifica(regole, risposteEffettive(regole, { ...r, [d.id]: 'si' }).R);
    const conNo = classifica(regole, risposteEffettive(regole, { ...r, [d.id]: 'no' }).R);
    if (conSi.classe !== conNo.classe || conSi.trasparenza !== conNo.trasparenza) aperte.push(d.id);
  }
  return aperte;
}

export function calcolaEsito(regole: FileRegole, r: Risposte, ruoloCliente: RuoloCliente): EsitoValutazione {
  const { visibili, R } = risposteEffettive(regole, r);
  const completo = visibili.every((d) => R[d.id] !== undefined);

  const base = classifica(regole, R);
  const aperte = domandeAperte(regole, visibili, r);
  const classe: Classe = aperte.length > 0 ? 'da_approfondire' : base.classe;
  // Con classe da_approfondire nessuna regola esito "vince": la classe non è determinata.
  const vincente = classe === 'da_approfondire' ? null : base.vincente;
  const { trasparenza, regoleTrasparenza } = base;

  const ruoloEffettivo: RuoloEffettivo | 'da_definire' = valuta(regole.ruoloFornitoreSe, R)
    ? 'fornitore'
    : ruoloCliente;

  const obblighiApplicati = regole.obblighi
    .filter((o) =>
      o.classi.includes(classe) &&
      (!o.soloSeTrasparenza || trasparenza) &&
      (o.quando === null || valuta(o.quando, R)) &&
      (ruoloEffettivo === 'da_definire' || o.ruoli.includes(ruoloEffettivo)))
    .sort((a, b) =>
      a.dataApplicazione < b.dataApplicazione ? -1
        : a.dataApplicazione > b.dataApplicazione ? 1
          : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const motivazione = [
    ...(vincente ? [vincente] : []),
    ...regoleTrasparenza,
  ].map((x) => ({ testo: x.motivazione, riferimento: x.riferimento }));

  const voci: { id: string; stato: string }[] = [
    ...visibili,
    ...(vincente ? [vincente] : []),
    ...regoleTrasparenza,
    ...obblighiApplicati,
  ];

  return {
    classe,
    trasparenza,
    motivazione,
    aperte,
    ruoloEffettivo,
    obblighi: obblighiApplicati.map((o) => ({
      id: o.id,
      testo: o.testo,
      riferimento: o.riferimento,
      dataApplicazione: o.dataApplicazione,
      ruoli: o.ruoli,
    })),
    dataApplicazioneClasse: vincente?.dataApplicazione ?? null,
    completo,
    vociUsate: voci.map((v) => v.id),
    vociNonValidate: voci.filter((v) => v.stato !== 'validata').length,
  };
}
