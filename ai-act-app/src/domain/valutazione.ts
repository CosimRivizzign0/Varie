import type { EsitoValutazione } from '../regole/motore';
import type { Classe, Risposte } from '../regole/tipi';

export type StatoValutazione = 'in_corso' | 'completata' | 'confermata';

export interface Valutazione {
  id: string;
  sistemaId: string;
  versioneRegole: string;
  risposte: Risposte;
  esito: EsitoValutazione | null;
  stato: StatoValutazione;
  classeConfermata: Classe | null;
  notaModifica: string | null;
  creatoIl: string;
  modificatoIl: string;
  confermatoIl: string | null;
  sostituitaIl: string | null;
}
