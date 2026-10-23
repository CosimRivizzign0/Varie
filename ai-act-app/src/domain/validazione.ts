import { z } from 'zod';
import type { Esito } from './tipi';

/** Testo obbligatorio: trim, lunghezza min..max, messaggio unico. */
export function testo(messaggio: string, min = 1, max = Infinity) {
  return z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string({ error: messaggio }).min(min, messaggio).max(max, messaggio),
  );
}

/** Testo facoltativo: trim, vuoto/mancante → null. */
export function testoOpzionale(messaggio: string, controllo?: (s: string) => boolean) {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== 'string') return v;
      const t = v.trim();
      return t === '' ? null : t;
    },
    z
      .string({ error: messaggio })
      .refine((s) => (controllo ? controllo(s) : true), messaggio)
      .nullable(),
  );
}

/** Verifica 'YYYY-MM-DD' come data di calendario reale. */
export function dataValida(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [a, me, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, me - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === me - 1 && d.getUTCDate() === g;
}

export function dataLocale(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Primo messaggio per campo. */
export function esito<S extends z.ZodType, T>(schema: S, input: unknown): Esito<T> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, valore: r.data as T };
  const errori: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const chiave = String(issue.path[0] ?? '');
    if (chiave && !(chiave in errori)) errori[chiave] = issue.message;
  }
  return { ok: false, errori } as Esito<T>;
}
