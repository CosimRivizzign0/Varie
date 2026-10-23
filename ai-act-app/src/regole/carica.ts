import { z } from 'zod';
import { riferimentiDi } from './condizioni';
import type { Condizione, FileRegole } from './tipi';

export class ErroreRegole extends Error {
  problemi: string[];
  constructor(problemi: string[]) {
    super(`File regole non valido: ${problemi.join('; ')}`);
    this.name = 'ErroreRegole';
    this.problemi = problemi;
  }
}

const risposta = z.enum(['si', 'no', 'non_so']);
const stato = z.enum(['bozza', 'validata', 'da_verificare']);

const condizione: z.ZodType<Condizione> = z.lazy(() =>
  z.union([
    z.strictObject({ risposta: z.string(), uguale: risposta }),
    z.strictObject({ tutte: z.array(condizione) }),
    z.strictObject({ almenoUna: z.array(condizione) }),
    z.strictObject({ non: condizione }),
  ]),
);

const classe = z.enum([
  'fuori_ambito',
  'vietato',
  'alto_rischio',
  'non_alto_rischio_deroga',
  'minimo',
  'da_approfondire',
]);

const schema = z.object({
  meta: z.object({ id: z.string(), versione: z.string(), norma: z.string(), dataRedazione: z.string() }),
  ruoloFornitoreSe: condizione,
  domande: z.array(
    z.object({
      id: z.string(),
      sezione: z.enum(['ambito', 'vietate', 'alto_rischio', 'trasparenza', 'ruolo']),
      testo: z.string(),
      aiuto: z.string().nullable(),
      riferimento: z.string(),
      mostraSe: condizione.nullable(),
      stato,
    }),
  ),
  esiti: z.array(
    z.object({
      id: z.string(),
      quando: condizione,
      classe: z.enum(['fuori_ambito', 'vietato', 'alto_rischio', 'non_alto_rischio_deroga']),
      motivazione: z.string(),
      riferimento: z.string(),
      dataApplicazione: z.string().nullable(),
      stato,
    }),
  ),
  trasparenza: z.array(
    z.object({ id: z.string(), quando: condizione, motivazione: z.string(), riferimento: z.string(), stato }),
  ),
  obblighi: z.array(
    z.object({
      id: z.string(),
      classi: z.array(classe),
      soloSeTrasparenza: z.boolean(),
      ruoli: z.array(z.enum(['fornitore', 'deployer', 'importatore', 'distributore'])),
      quando: condizione.nullable(),
      testo: z.string(),
      riferimento: z.string(),
      dataApplicazione: z.string(),
      stato,
    }),
  ),
});

function dataValida(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [a, me, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, me - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === me - 1 && d.getUTCDate() === g;
}

function controlli(f: FileRegole): string[] {
  const problemi: string[] = [];

  if (!/^\d+\.\d+\.\d+$/.test(f.meta.versione)) problemi.push(`Versione non valida: ${f.meta.versione}`);
  if (!dataValida(f.meta.dataRedazione)) {
    problemi.push(`Data non valida in meta: ${f.meta.dataRedazione}`);
  }

  // Id duplicati (una segnalazione per id)
  const visti = new Set<string>();
  const segnalati = new Set<string>();
  for (const id of [...f.domande, ...f.esiti, ...f.trasparenza, ...f.obblighi].map((v) => v.id)) {
    if (visti.has(id) && !segnalati.has(id)) {
      problemi.push(`Id duplicato: ${id}`);
      segnalati.add(id);
    }
    visti.add(id);
  }

  // Riferimenti a domande
  const posizione = new Map<string, number>();
  f.domande.forEach((d, i) => {
    if (!posizione.has(d.id)) posizione.set(d.id, i);
  });
  const citazioni: [string, Condizione | null][] = [
    ['ruoloFornitoreSe', f.ruoloFornitoreSe],
    ...f.domande.map((d): [string, Condizione | null] => [d.id, d.mostraSe]),
    ...f.esiti.map((e): [string, Condizione | null] => [e.id, e.quando]),
    ...f.trasparenza.map((t): [string, Condizione | null] => [t.id, t.quando]),
    ...f.obblighi.map((o): [string, Condizione | null] => [o.id, o.quando]),
  ];
  for (const [idVoce, c] of citazioni) {
    if (!c) continue;
    for (const rif of new Set(riferimentiDi(c))) {
      if (!posizione.has(rif)) problemi.push(`Domanda inesistente "${rif}" in ${idVoce}`);
    }
  }

  // Ordine e cicli in mostraSe
  const archi = new Map<string, string[]>();
  f.domande.forEach((d, i) => {
    const rifs = d.mostraSe ? [...new Set(riferimentiDi(d.mostraSe))].filter((r) => posizione.has(r)) : [];
    archi.set(d.id, rifs);
    for (const r of rifs) {
      if (r !== d.id && posizione.get(r)! > i) {
        problemi.push(`Domanda "${r}" citata prima di essere definita in ${d.id}`);
      }
    }
  });
  const stato = new Map<string, 'in_corso' | 'fatto'>();
  const percorso: string[] = [];
  const visita = (id: string): void => {
    stato.set(id, 'in_corso');
    percorso.push(id);
    for (const next of archi.get(id) ?? []) {
      const s = stato.get(next);
      if (s === 'in_corso') {
        const ciclo = [...percorso.slice(percorso.indexOf(next)), next];
        problemi.push(`Ciclo in mostraSe: ${ciclo.join(' → ')}`);
      } else if (s === undefined) {
        visita(next);
      }
    }
    percorso.pop();
    stato.set(id, 'fatto');
  };
  for (const d of f.domande) if (!stato.has(d.id)) visita(d.id);

  // Date
  for (const e of f.esiti) {
    if (e.dataApplicazione !== null && !dataValida(e.dataApplicazione)) {
      problemi.push(`Data non valida in ${e.id}: ${e.dataApplicazione}`);
    }
  }
  for (const o of f.obblighi) {
    if (!dataValida(o.dataApplicazione)) problemi.push(`Data non valida in ${o.id}: ${o.dataApplicazione}`);
  }

  return problemi;
}

export function caricaRegole(json: unknown): FileRegole {
  const r = schema.safeParse(json);
  if (!r.success) {
    throw new ErroreRegole(
      r.error.issues.map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`),
    );
  }
  const file: FileRegole = r.data;
  const problemi = controlli(file);
  if (problemi.length > 0) throw new ErroreRegole(problemi);
  return file;
}
