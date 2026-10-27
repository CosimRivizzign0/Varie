import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Cliente } from '../../src/domain/tipi';
import type { ImpostazioniStudio } from '../../src/domain/report';
import type { DatiInventario, RigaInventario } from '../../src/report/dati';
import { creaExcel } from '../../src/report/excel';

beforeAll(() => {
  process.env.TZ = 'Europe/Rome';
});

const studio: ImpostazioniStudio = { nome: 'Studio Bianchi', indirizzo: '', piva: '', email: '', telefono: '' };
const cliente = { id: 'c1', ragioneSociale: 'Officina Rossi Srl' } as Cliente;

const riga = (extra: Partial<RigaInventario> = {}): RigaInventario => ({
  sistema: 'Selezione CV', fornitore: 'Acme', scopo: 'Screening', reparto: 'HR', ruoloCliente: 'Deployer',
  classe: 'Alto rischio', trasparenza: 'Sì', stato: 'Confermata', dataConferma: '2026-10-24',
  applicabileDal: '2027-12-02', nObblighi: 2, daRivedere: 'No', ...extra,
});

function dati(extra: Partial<DatiInventario> = {}): DatiInventario {
  return {
    studio, cliente,
    righe: [riga(), riga({ sistema: 'Chatbot', dataConferma: null, applicabileDal: null, classe: '', stato: 'Non avviata', nObblighi: 0 })],
    obblighi: [
      { sistema: 'Selezione CV', obbligo: 'Registro', riferimento: 'art. 12', dal: '2026-08-02' },
      { sistema: 'Selezione CV', obbligo: 'Sorveglianza', riferimento: 'art. 14', dal: '2027-12-02' },
      { sistema: 'Chatbot', obbligo: 'Info', riferimento: 'art. 50', dal: '2026-08-02' },
    ],
    ...extra,
  };
}

async function leggi(d: DatiInventario): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await creaExcel(d)).buffer as ArrayBuffer);
  return wb;
}

describe('creaExcel', () => {
  it('restituisce un Uint8Array con i fogli Inventario e Obblighi', async () => {
    const out = await creaExcel(dati());
    expect(out).toBeInstanceOf(Uint8Array);
    const wb = await leggi(dati());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Inventario', 'Obblighi']);
  });

  it('ha le intestazioni esatte, in grassetto, bloccate e con filtro', async () => {
    const wb = await leggi(dati());
    const inv = wb.getWorksheet('Inventario')!;
    expect((inv.getRow(1).values as unknown[]).slice(1)).toEqual([
      'Sistema', 'Fornitore', 'Scopo', 'Reparto', 'Ruolo cliente', 'Classe', 'Trasparenza', 'Stato valutazione',
      'Data conferma', 'Applicabile dal', 'N. obblighi', 'Da rivedere',
    ]);
    const obb = wb.getWorksheet('Obblighi')!;
    expect((obb.getRow(1).values as unknown[]).slice(1)).toEqual(['Sistema', 'Obbligo', 'Riferimento', 'Dal']);
    for (const f of [inv, obb]) {
      expect(f.getRow(1).font?.bold).toBe(true);
      expect(f.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(f.autoFilter).toBeTruthy();
    }
  });

  it('scrive una riga per sistema e una per obbligo', async () => {
    const wb = await leggi(dati());
    expect(wb.getWorksheet('Inventario')!.rowCount).toBe(3);
    expect(wb.getWorksheet('Obblighi')!.rowCount).toBe(4);
    expect(wb.getWorksheet('Inventario')!.getRow(2).getCell(11).value).toBe(2);
  });

  it('le date sono celle data con formato dd/mm/yyyy, senza spostare il giorno', async () => {
    const wb = await leggi(dati());
    const inv = wb.getWorksheet('Inventario')!;
    const c = inv.getRow(2).getCell(9);
    expect(c.value).toBeInstanceOf(Date);
    const v = c.value as Date;
    expect([v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()]).toEqual([2026, 10, 24]);
    expect(c.numFmt).toBe('dd/mm/yyyy');
    const dal = inv.getRow(2).getCell(10).value as Date;
    expect(dal.toISOString().slice(0, 10)).toBe('2027-12-02');
    // data nulla: cella vuota
    expect(inv.getRow(3).getCell(9).value).toBeNull();
    expect(inv.getRow(3).getCell(10).value).toBeNull();
    const o = wb.getWorksheet('Obblighi')!.getRow(2).getCell(4);
    expect((o.value as Date).toISOString().slice(0, 10)).toBe('2026-08-02');
    expect(o.numFmt).toBe('dd/mm/yyyy');
  });

  it('conserva identici nomi con apostrofo, accenti ed emoji', async () => {
    const nome = "L'Officina ✓ Città 🚀";
    const wb = await leggi(dati({ righe: [riga({ sistema: nome })], obblighi: [{ sistema: nome, obbligo: 'è à', riferimento: 'x', dal: '2026-08-02' }] }));
    expect(wb.getWorksheet('Inventario')!.getRow(2).getCell(1).value).toBe(nome);
    expect(wb.getWorksheet('Obblighi')!.getRow(2).getCell(1).value).toBe(nome);
  });

  it('funziona senza righe', async () => {
    const wb = await leggi(dati({ righe: [], obblighi: [] }));
    expect(wb.getWorksheet('Inventario')!.rowCount).toBe(1);
  });
});
