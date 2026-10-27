export type Risposta = 'si' | 'no' | 'non_so';
export type Risposte = Record<string, Risposta>;

export type Condizione =
  | { risposta: string; uguale: Risposta }
  | { tutte: Condizione[] }
  | { almenoUna: Condizione[] }
  | { non: Condizione };

export type StatoVoce = 'bozza' | 'validata' | 'da_verificare';

export type Sezione = 'ambito' | 'vietate' | 'alto_rischio' | 'trasparenza' | 'ruolo';

export const SEZIONI: { id: Sezione; etichetta: string }[] = [
  { id: 'ambito', etichetta: 'Ambito' },
  { id: 'vietate', etichetta: 'Pratiche vietate' },
  { id: 'alto_rischio', etichetta: 'Alto rischio' },
  { id: 'trasparenza', etichetta: 'Trasparenza' },
  { id: 'ruolo', etichetta: 'Ruolo' },
];

export type Classe =
  | 'fuori_ambito'
  | 'vietato'
  | 'alto_rischio'
  | 'non_alto_rischio_deroga'
  | 'minimo'
  | 'da_approfondire';

export const ETICHETTE_CLASSE: Record<Classe, string> = {
  fuori_ambito: 'Fuori ambito',
  vietato: 'Pratica vietata',
  alto_rischio: 'Alto rischio',
  non_alto_rischio_deroga: 'Non alto rischio (deroga art. 6(3))',
  minimo: 'Rischio minimo',
  da_approfondire: 'Da approfondire',
};

export type RuoloEffettivo = 'fornitore' | 'deployer' | 'importatore' | 'distributore';

export interface Domanda {
  id: string;
  sezione: Sezione;
  testo: string;
  aiuto: string | null;
  riferimento: string;
  mostraSe: Condizione | null;
  stato: StatoVoce;
}

export interface RegolaEsito {
  id: string;
  quando: Condizione;
  classe: Exclude<Classe, 'minimo' | 'da_approfondire'>;
  motivazione: string;
  riferimento: string;
  dataApplicazione: string | null;
  stato: StatoVoce;
}

export interface RegolaTrasparenza {
  id: string;
  quando: Condizione;
  motivazione: string;
  riferimento: string;
  stato: StatoVoce;
}

export interface Obbligo {
  id: string;
  classi: Classe[];
  soloSeTrasparenza: boolean;
  ruoli: RuoloEffettivo[];
  quando: Condizione | null;
  testo: string;
  riferimento: string;
  dataApplicazione: string;
  stato: StatoVoce;
}

export interface FileRegole {
  meta: { id: string; versione: string; norma: string; dataRedazione: string };
  ruoloFornitoreSe: Condizione;
  domande: Domanda[];
  esiti: RegolaEsito[];
  trasparenza: RegolaTrasparenza[];
  obblighi: Obbligo[];
}
