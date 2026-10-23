import type { SistemaAI } from './tipi';
import type { EsitoValutazione } from '../regole/motore';
import type { Classe, Risposte } from '../regole/tipi';

export type StatoValutazione = 'in_corso' | 'completata' | 'confermata';

export const ETICHETTE_STATO: Record<StatoValutazione, string> = {
  in_corso: 'In corso',
  completata: 'Completata',
  confermata: 'Confermata',
};

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

export interface SintesiValutazione {
  sistemaId: string;
  sistemaNome: string;
  stato: StatoValutazione | null;
  daRivedere: boolean;
}

/** `attive[i]` è la valutazione attiva di `sistemi[i]` (o null). */
export function sintesiPerRoadmap(
  sistemi: SistemaAI[],
  attive: (Valutazione | null)[],
  versioneCorrente: string,
): SintesiValutazione[] {
  return sistemi.map((s, i) => {
    const v = attive[i] ?? null;
    return {
      sistemaId: s.id,
      sistemaNome: s.nome,
      stato: v?.stato ?? null,
      daRivedere: v !== null && v.versioneRegole !== versioneCorrente,
    };
  });
}
