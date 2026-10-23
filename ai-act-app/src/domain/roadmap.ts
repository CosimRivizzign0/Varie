import { validaCliente } from './cliente';
import type { SintesiValutazione } from './valutazione';
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

function sistemiTesto(n: number): string {
  return n === 1 ? '1 sistema' : `${n} sistemi`;
}

export function calcolaRoadmap(
  cliente: Cliente,
  sistemiAttivi: SistemaAI[],
  oggi: Date,
  valutazioni: SintesiValutazione[],
): Roadmap {
  const validazione = validaCliente(cliente, oggi);
  const n = sistemiAttivi.length;
  const anagraficaOk = validazione.ok;
  const inventarioOk = cliente.inventarioConfermato && n > 0;

  const sintesi = [...sistemiAttivi]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    .map(
      (sis): SintesiValutazione =>
        valutazioni.find((v) => v.sistemaId === sis.id) ?? {
          sistemaId: sis.id,
          sistemaNome: sis.nome,
          stato: null,
          daRivedere: false,
        },
    );
  const valutati = sintesi.filter((v) => (v.stato === 'completata' || v.stato === 'confermata') && !v.daRivedere);
  const confermati = sintesi.filter((v) => v.stato === 'confermata' && !v.daRivedere);
  const questionarioOk = n > 0 && valutati.length === n;
  const classificazioneOk = n > 0 && confermati.length === n;

  const tappe: Tappa[] = [
    { id: 'anagrafica', etichetta: 'Anagrafica', stato: 'da_fare', dettaglio: null },
    { id: 'inventario', etichetta: 'Inventario', stato: 'da_fare', dettaglio: sistemiTesto(n) },
    { id: 'questionario', etichetta: 'Questionario', stato: 'da_fare', dettaglio: `${valutati.length} di ${n} sistemi` },
    { id: 'classificazione', etichetta: 'Classificazione', stato: 'da_fare', dettaglio: `${confermati.length} di ${n} confermati` },
    { id: 'report', etichetta: 'Report', stato: 'bloccata', dettaglio: 'disponibile dalla Fase 2b' },
  ];

  const completate = [anagraficaOk, inventarioOk, questionarioOk, classificazioneOk];
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
    const daCompilare = sintesi.find((v) => !valutati.includes(v));
    const daConfermare = sintesi.find((v) => !confermati.includes(v));
    if (daCompilare) prossimaAzione = `Compila il questionario per «${daCompilare.sistemaNome}»`;
    else if (daConfermare) prossimaAzione = `Conferma la classificazione di «${daConfermare.sistemaNome}»`;
    else prossimaAzione = 'In attesa della Fase 2b';
  }

  const percentuale = completate.filter(Boolean).length * 20;
  return { tappe, percentuale, prossimaAzione };
}
