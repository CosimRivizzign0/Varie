export const GIORNI_CESTINO = 30;

/** Vero se dall'eliminazione sono passati più di GIORNI_CESTINO giorni. */
export function isScaduto(eliminatoIl: string, ora: Date): boolean {
  return ora.getTime() - Date.parse(eliminatoIl) > GIORNI_CESTINO * 24 * 60 * 60 * 1000;
}
