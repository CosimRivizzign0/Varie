import ExcelJS from 'exceljs';
import type { DatiInventario } from './dati';

const FORMATO_DATA = 'dd/mm/yyyy';

/**
 * `AAAA-MM-GG` → `Date.UTC(y, m-1, d)` (R2): il numero seriale di Excel non sposta mai il giorno.
 * null → cella vuota.
 */
function cellaData(giorno: string | null): Date | null {
  if (!giorno) return null;
  const [a, m, g] = giorno.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, g));
}

function foglio(
  wb: ExcelJS.Workbook,
  nome: string,
  colonne: { intestazione: string; larghezza: number; data?: boolean }[],
  righe: (string | number | Date | null)[][],
): void {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = colonne.map((c) => ({ header: c.intestazione, width: c.larghezza, style: c.data ? { numFmt: FORMATO_DATA } : {} }));
  ws.getRow(1).font = { bold: true };
  righe.forEach((r) => ws.addRow(r));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonne.length } };
}

/** Excel dell'inventario di un cliente (spec §2): fogli `Inventario` e `Obblighi`. */
export async function creaExcel(d: DatiInventario): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = d.studio.nome || 'AI Act Assessment';

  foglio(
    wb,
    'Inventario',
    [
      { intestazione: 'Sistema', larghezza: 28 },
      { intestazione: 'Fornitore', larghezza: 22 },
      { intestazione: 'Scopo', larghezza: 40 },
      { intestazione: 'Reparto', larghezza: 18 },
      { intestazione: 'Ruolo cliente', larghezza: 18 },
      { intestazione: 'Classe', larghezza: 20 },
      { intestazione: 'Trasparenza', larghezza: 13 },
      { intestazione: 'Stato valutazione', larghezza: 20 },
      { intestazione: 'Data conferma', larghezza: 15, data: true },
      { intestazione: 'Applicabile dal', larghezza: 15, data: true },
      { intestazione: 'N. obblighi', larghezza: 12 },
      { intestazione: 'Da rivedere', larghezza: 12 },
    ],
    d.righe.map((r) => [
      r.sistema, r.fornitore, r.scopo, r.reparto, r.ruoloCliente, r.classe, r.trasparenza, r.stato,
      cellaData(r.dataConferma), cellaData(r.applicabileDal), r.nObblighi, r.daRivedere,
    ]),
  );

  foglio(
    wb,
    'Obblighi',
    [
      { intestazione: 'Sistema', larghezza: 28 },
      { intestazione: 'Obbligo', larghezza: 60 },
      { intestazione: 'Riferimento', larghezza: 22 },
      { intestazione: 'Dal', larghezza: 15, data: true },
    ],
    d.obblighi.map((o) => [o.sistema, o.obbligo, o.riferimento, cellaData(o.dal)]),
  );

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
