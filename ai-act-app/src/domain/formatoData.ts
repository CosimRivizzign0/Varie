const p = (n: number) => String(n).padStart(2, '0');

/**
 * gg/mm/aaaa.
 * - Data senza orario (AAAA-MM-GG): riportata così com'è, senza spostamenti di fuso.
 * - Timestamp (es. confermatoIl, salvato in UTC): convertito nel fuso locale.
 */
export function formattaData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Giorno di calendario locale nel formato AAAA-MM-GG.
 * - Data senza orario: restituita così com'è.
 * - Timestamp: giorno nel fuso locale. Invalido: null.
 */
export function giornoLocale(iso: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return giornoDiDate(d);
}

/** Giorno di calendario locale di una `Date`, nel formato AAAA-MM-GG. */
export function giornoDiDate(d: Date): string {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
