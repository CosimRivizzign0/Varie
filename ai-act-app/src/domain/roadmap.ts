import { validaCliente } from './cliente';
import type { Cliente, ClienteInput, SistemaAI } from './tipi';

export type IdTappa = 'anagrafica' | 'inventario' | 'questionario' | 'classificazione' | 'report';

export interface Tappa {
  id: IdTappa;
  etichetta: string;
  stato: 'completata' | 'in_corso' | 'da_fare' | 'bloccata';
  dettaglio: string | null;
}

export interface Roadmap {
  tappe: Tappa[];
  percentuale: number;
  prossimaAzione: string;
}

const CAMPI_MANCANTI: [keyof ClienteInput, string][] = [
  ['ragioneSociale', 'la ragione sociale'],
  ['partitaIva', 'la Partita IVA'],
  ['settore', 'il settore'],
  ['referenteNome', 'il referente'],
  ['referenteEmail', "l'email del referente"],
  ['aiLiteracyData', 'la data della formazione AI'],
];

const BLOCCATE: [IdTappa, string][] = [
  ['questionario', 'Questionario'],
  ['classificazione', 'Classificazione'],
  ['report', 'Report'],
];

function sistemiTesto(n: number): string {
  return n === 1 ? '1 sistema' : `${n} sistemi`;
}

export function calcolaRoadmap(cliente: Cliente, sistemiAttivi: SistemaAI[], oggi: Date): Roadmap {
  const validazione = validaCliente(cliente, oggi);
  const n = sistemiAttivi.length;
  const anagraficaOk = validazione.ok;
  const inventarioOk = anagraficaOk && cliente.inventarioConfermato && n > 0;

  const tappe: Tappa[] = [
    { id: 'anagrafica', etichetta: 'Anagrafica', stato: 'da_fare', dettaglio: null },
    { id: 'inventario', etichetta: 'Inventario', stato: 'da_fare', dettaglio: sistemiTesto(n) },
    ...BLOCCATE.map(([id, etichetta]): Tappa => ({
      id,
      etichetta,
      stato: 'bloccata',
      dettaglio: 'disponibile dalla Fase 2',
    })),
  ];

  const completate = [anagraficaOk, inventarioOk];
  let inCorsoAssegnata = false;
  completate.forEach((fatta, i) => {
    if (fatta) tappe[i].stato = 'completata';
    else if (!inCorsoAssegnata) {
      tappe[i].stato = 'in_corso';
      inCorsoAssegnata = true;
    } else tappe[i].stato = 'da_fare';
  });

  let prossimaAzione: string;
  if (!validazione.ok) {
    const errori = validazione.errori as Record<string, string>;
    const mancante = CAMPI_MANCANTI.find(([k]) => k in errori);
    prossimaAzione = `Completa l'anagrafica: manca ${mancante ? mancante[1] : 'un dato obbligatorio'}`;
  } else if (n === 0) {
    prossimaAzione = 'Aggiungi il primo sistema AI';
  } else if (!cliente.inventarioConfermato) {
    prossimaAzione = `Conferma l'inventario (${sistemiTesto(n)})`;
  } else {
    prossimaAzione = 'In attesa della Fase 2';
  }

  const percentuale = completate.filter(Boolean).length * 20;
  return { tappe, percentuale, prossimaAzione };
}
