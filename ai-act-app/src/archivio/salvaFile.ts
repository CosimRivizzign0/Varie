import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { ambienteTauri } from './avvio';

const MIME: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Nell'anteprima web ogni file è un download del browser: nessun dialogo. */
function scarica(nome: string, byte: Uint8Array): string {
  const estensione = nome.split('.').pop()?.toLowerCase() ?? '';
  const blob = new Blob([byte as BlobPart], { type: MIME[estensione] ?? 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    // Revoca differita: revocare subito può annullare il download in Chromium.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return nome;
}

async function scrivi(percorso: string, byte: Uint8Array): Promise<void> {
  try {
    await invoke('scrivi_file', { percorso, contenuto: Array.from(byte) });
  } catch (errore) {
    throw errore instanceof Error ? errore : new Error(String(errore));
  }
}

/** Percorso della cartella scelta, null se annullato; nel web `''` significa "download". */
export async function scegliCartella(): Promise<string | null> {
  if (!ambienteTauri()) return '';
  const scelta = await open({ directory: true, multiple: false });
  return typeof scelta === 'string' ? scelta : null;
}

/** Salva `nome` dentro `cartella` (separatore del percorso scelto); restituisce il percorso scritto. */
export async function salvaInCartella(cartella: string, nome: string, byte: Uint8Array): Promise<string> {
  if (!ambienteTauri()) return scarica(nome, byte);
  const sep = cartella.includes('\\') ? '\\' : '/';
  const percorso = cartella.endsWith(sep) ? `${cartella}${nome}` : `${cartella}${sep}${nome}`;
  await scrivi(percorso, byte);
  return percorso;
}

/** Salva con il dialogo "Salva con nome"; null se annullato. */
export async function salvaConNome(nome: string, byte: Uint8Array): Promise<string | null> {
  if (!ambienteTauri()) return scarica(nome, byte);
  const estensione = nome.split('.').pop() ?? '';
  const percorso = await save({
    defaultPath: nome,
    filters: [{ name: estensione.toUpperCase(), extensions: [estensione] }],
  });
  if (!percorso) return null;
  await scrivi(percorso, byte);
  return percorso;
}
