import type { Condizione, Risposte } from './tipi';

export function valuta(c: Condizione, r: Risposte): boolean {
  if ('risposta' in c) return r[c.risposta] === c.uguale;
  if ('tutte' in c) return c.tutte.every((x) => valuta(x, r));
  if ('almenoUna' in c) return c.almenoUna.some((x) => valuta(x, r));
  return !valuta(c.non, r);
}

export function riferimentiDi(c: Condizione): string[] {
  if ('risposta' in c) return [c.risposta];
  if ('tutte' in c) return c.tutte.flatMap(riferimentiDi);
  if ('almenoUna' in c) return c.almenoUna.flatMap(riferimentiDi);
  return riferimentiDi(c.non);
}
