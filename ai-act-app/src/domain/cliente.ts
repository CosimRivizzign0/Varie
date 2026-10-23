import { z } from 'zod';
import { normalizzaPartitaIva, validaPartitaIva } from './partitaIva';
import type { ClienteInput, Esito } from './tipi';
import { dataLocale, dataValida, esito, testo, testoOpzionale } from './validazione';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validaCliente(input: unknown, oggi: Date): Esito<ClienteInput> {
  const msgFutura = 'La data non può essere futura';
  const schema = z.object({
    ragioneSociale: testo('Inserisci la ragione sociale (2–200 caratteri)', 2, 200),
    partitaIva: z
      .preprocess(
        (v) => (typeof v === 'string' ? normalizzaPartitaIva(v.trim()) : v),
        z.string({ error: 'Partita IVA non valida' }).refine(validaPartitaIva, 'Partita IVA non valida'),
      ),
    settore: testo('Inserisci il settore'),
    referenteNome: testo('Inserisci il nome del referente'),
    referenteEmail: testoOpzionale('Email non valida', (s) => EMAIL.test(s)),
    note: testoOpzionale('Note non valide'),
    aiLiteracyDocumentata: z.preprocess((v) => v ?? false, z.boolean({ error: 'Valore non valido' })),
    aiLiteracyData: testoOpzionale('Data non valida', dataValida).refine(
      (s) => s === null || s <= dataLocale(oggi),
      msgFutura,
    ),
  });
  return esito<typeof schema, ClienteInput>(schema, input);
}
