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

/** Oltre questa soglia di `non_so` visibili non si enumera: sono considerate tutte aperte. */
const MAX_NON_SO = 12;

function ruoloDi(regole: FileRegole, R: Risposte, ruoloCliente: RuoloCliente): RuoloEffettivo | 'da_definire' {
  return valuta(regole.ruoloFornitoreSe, R) ? 'fornitore' : ruoloCliente;
}

/**
 * Domande visibili con `non_so` determinanti. Si enumerano tutte le 2^|N| assegnazioni si/no
 * delle `non_so` visibili (visibilità ricalcolata per ciascuna; le domande senza risposta restano
 * senza risposta). Una domanda è aperta se esistono due assegnazioni che differiscono solo per
 * essa con esito (classe, trasparenza, ruolo effettivo) diverso.
 */
function domandeAperte(
  regole: FileRegole, visibili: Domanda[], r: Risposte, ruoloCliente: RuoloCliente,
): string[] {
  const nonSo = visibili.filter((d) => r[d.id] === 'non_so').map((d) => d.id);
  if (nonSo.length > MAX_NON_SO) return nonSo;
  const esiti: string[] = [];
  for (let m = 0; m < 1 << nonSo.length; m++) {
    const forzate: Risposte = { ...r };
    nonSo.forEach((id, i) => { forzate[id] = m & (1 << i) ? 'si' : 'no'; });
    const { R } = risposteEffettive(regole, forzate);
    const c = classifica(regole, R);
    esiti.push(`${c.classe}|${c.trasparenza}|${ruoloDi(regole, R, ruoloCliente)}`);
  }
  return nonSo.filter((_, i) => esiti.some((e, m) => !(m & (1 << i)) && e !== esiti[m | (1 << i)]));
}

export function calcolaEsito(regole: FileRegole, r: Risposte, ruoloCliente: RuoloCliente): EsitoValutazione {
  const { visibili, R } = risposteEffettive(regole, r);
  const completo = visibili.every((d) => R[d.id] !== undefined);

  const base = classifica(regole, R);
  const aperte = domandeAperte(regole, visibili, r, ruoloCliente);
  const classe: Classe = aperte.length > 0 ? 'da_approfondire' : base.classe;
  // Con classe da_approfondire nessuna regola esito "vince": la classe non è determinata.
  const vincente = classe === 'da_approfondire' ? null : base.vincente;
  const { trasparenza, regoleTrasparenza } = base;

  const ruoloEffettivo = ruoloDi(regole, R, ruoloCliente);

  const obblighiApplicati = regole.obblighi
    .filter((o) =>
      o.classi.includes(classe) &&
      (!o.soloSeTrasparenza || trasparenza) &&
      (o.quando === null || valuta(o.quando, R)) &&
      (ruoloEffettivo === 'da_definire' || o.ruoli.includes(ruoloEffettivo)))
    .sort((a, b) => a.dataApplicazione.localeCompare(b.dataApplicazione) || a.id.localeCompare(b.id));

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
