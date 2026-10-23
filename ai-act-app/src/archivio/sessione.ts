import type { Repository } from './repository';

/** Chiave in sessionStorage: la pagina è stata ricaricata dopo un ripristino di backup. */
export const CHIAVE_SALTA_PULIZIA = 'aiact.saltaPulizia';

type Archivio = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** sessionStorage, o null se il browser lo nega (accesso che lancia un'eccezione). */
export function archivioSessione(): Archivio | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Da chiamare subito prima di ricaricare dopo un ripristino riuscito: al prossimo avvio
 * il cestino non viene svuotato, così gli elementi scaduti del backup restano recuperabili.
 */
export function segnaRipristino(archivio: Archivio | null = archivioSessione()): void {
  try {
    archivio?.setItem(CHIAVE_SALTA_PULIZIA, '1');
  } catch {
    // Senza sessionStorage il cestino verrà svuotato come a ogni avvio.
  }
}

function leggiERimuovi(archivio: Archivio | null): boolean {
  try {
    const presente = archivio?.getItem(CHIAVE_SALTA_PULIZIA) != null;
    if (presente) archivio?.removeItem(CHIAVE_SALTA_PULIZIA);
    return presente;
  } catch {
    return false;
  }
}

/**
 * Operazioni d'avvio dopo la migrazione. Svuota il cestino scaduto, salvo nella sessione
 * che segue un ripristino di backup: restituisce allora `ripristinato: true`.
 */
export async function avvioApp(repo: Repository, archivio: Archivio | null): Promise<{ ripristinato: boolean }> {
  if (leggiERimuovi(archivio)) return { ripristinato: true };
  try {
    await repo.svuotaCestinoScaduto();
  } catch (e) {
    // Non blocca l'avvio: gli elementi scaduti restano nel cestino fino al prossimo avvio.
    console.error('Svuotamento del cestino non riuscito', e);
  }
  return { ripristinato: false };
}
