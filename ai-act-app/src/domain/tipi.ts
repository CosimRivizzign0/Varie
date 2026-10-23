export type RuoloCliente = 'fornitore' | 'deployer' | 'importatore' | 'distributore' | 'da_definire';

export const RUOLI: Record<RuoloCliente, string> = {
  fornitore: 'Fornitore',
  deployer: 'Deployer (utilizzatore)',
  importatore: 'Importatore',
  distributore: 'Distributore',
  da_definire: 'Da definire',
};

export interface ClienteInput {
  ragioneSociale: string;
  partitaIva: string;
  settore: string;
  referenteNome: string;
  referenteEmail: string | null;
  note: string | null;
  aiLiteracyDocumentata: boolean;
  /** YYYY-MM-DD */
  aiLiteracyData: string | null;
}

export type Cliente = ClienteInput & {
  id: string;
  inventarioConfermato: boolean;
  /** ISO */
  creatoIl: string;
  /** ISO */
  modificatoIl: string;
  eliminatoIl: string | null;
};

export interface SistemaInput {
  nome: string;
  fornitore: string;
  scopo: string;
  reparto: string | null;
  /** YYYY-MM-DD */
  dataAvvio: string | null;
  ruoloCliente: RuoloCliente;
}

export type SistemaAI = SistemaInput & {
  id: string;
  clienteId: string;
  creatoIl: string;
  modificatoIl: string;
  eliminatoIl: string | null;
};

export type TipoAttivita = 'creato' | 'modificato' | 'eliminato' | 'ripristinato' | 'inventario_confermato';

export interface Attivita {
  id: string;
  clienteId: string;
  sistemaId: string | null;
  tipo: TipoAttivita;
  descrizione: string;
  quando: string;
}

export type Esito<T> = { ok: true; valore: T } | { ok: false; errori: Partial<Record<keyof T, string>> };
