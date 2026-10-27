/** Dati dello studio, stampati nell'intestazione dei report. Stringhe vuote se assenti. */
export interface ImpostazioniStudio {
  nome: string;
  indirizzo: string;
  piva: string;
  email: string;
  telefono: string;
}

/** Riga del registro dei report generati. */
export interface RegistroReport {
  id: string;
  clienteId: string;
  sistemaId: string | null;
  valutazioneId: string | null;
  tipo: 'word' | 'excel';
  nomeFile: string;
  /** ISO */
  creatoIl: string;
}
