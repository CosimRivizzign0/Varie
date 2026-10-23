export class ErroreValidazione extends Error {
  constructor(public errori: Record<string, string>) {
    super('Dati non validi');
    this.name = 'ErroreValidazione';
  }
}

export class ErrorePartitaIvaDuplicata extends Error {
  constructor() {
    super('Esiste già un cliente con questa Partita IVA');
    this.name = 'ErrorePartitaIvaDuplicata';
  }
}

export class ErroreInventarioVuoto extends Error {
  constructor() {
    super("Aggiungi almeno un sistema AI prima di confermare l'inventario");
    this.name = 'ErroreInventarioVuoto';
  }
}

export class ErroreNonTrovato extends Error {
  constructor(message = 'Elemento non trovato') {
    super(message);
    this.name = 'ErroreNonTrovato';
  }
}

export class ErroreClienteNelCestino extends Error {
  constructor() {
    super('Ripristina prima il cliente');
    this.name = 'ErroreClienteNelCestino';
  }
}

export class ErroreValutazioneIncompleta extends Error {
  constructor() {
    super('Completa il questionario prima di confermare');
    this.name = 'ErroreValutazioneIncompleta';
  }
}
