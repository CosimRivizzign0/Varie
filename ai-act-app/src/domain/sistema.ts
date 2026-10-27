import { z } from 'zod';
import type { Esito, SistemaInput } from './tipi';
import { dataValida, esito, testo, testoOpzionale } from './validazione';

export function validaSistema(input: unknown): Esito<SistemaInput> {
  const schema = z.object({
    nome: testo('Inserisci il nome del sistema (2–200 caratteri)', 2, 200),
    fornitore: testo('Inserisci il fornitore'),
    scopo: testo("Descrivi lo scopo d'uso"),
    reparto: testoOpzionale('Reparto non valido'),
    dataAvvio: testoOpzionale('Data non valida', dataValida),
    ruoloCliente: z.enum(['fornitore', 'deployer', 'importatore', 'distributore', 'da_definire'], {
      error: 'Seleziona il ruolo del cliente',
    }),
  });
  return esito<typeof schema, SistemaInput>(schema, input);
}
