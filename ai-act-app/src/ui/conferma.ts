import { confirm } from '@tauri-apps/plugin-dialog';
import { ambienteTauri } from '../archivio/avvio';

const TITOLO = 'AI Act Assessment';

/**
 * Chiede conferma all'utente. Nell'app desktop usa il dialogo nativo del plugin
 * (il plugin sostituisce window.confirm con una versione asincrona, che restituisce
 * una Promise sempre "vera" se usata in modo sincrono); nell'anteprima web usa window.confirm.
 */
export async function conferma(messaggio: string): Promise<boolean> {
  if (ambienteTauri()) {
    return confirm(messaggio, { title: TITOLO, kind: 'warning', okLabel: 'OK', cancelLabel: 'Annulla' });
  }
  return window.confirm(messaggio);
}
