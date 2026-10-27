export type Parametro = string | number | null;

export interface Istruzione {
  sql: string;
  params?: Parametro[];
}

export interface SqlDriver {
  select<T = Record<string, Parametro>>(sql: string, params?: Parametro[]): Promise<T[]>;
  /** Atomico: tutte le istruzioni vengono applicate oppure nessuna. */
  batch(istruzioni: Istruzione[]): Promise<void>;
}
