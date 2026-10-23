import dati from '../../regole/ai-act.json';
import { caricaRegole, ErroreRegole } from './carica';
import type { FileRegole } from './tipi';

/** Regole in uso nell'app, validate all'avvio. Se il file non è valido: REGOLE null ed ERRORE_REGOLE valorizzato. */
let regole: FileRegole | null = null;
let errore: ErroreRegole | null = null;
try {
  regole = caricaRegole(dati);
} catch (e) {
  if (!(e instanceof ErroreRegole)) throw e;
  errore = e;
}

export const REGOLE: FileRegole | null = regole;
export const ERRORE_REGOLE: ErroreRegole | null = errore;
