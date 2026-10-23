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
