// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());
const tauri = vi.hoisted(() => ({ attivo: false }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open, save }));
vi.mock('../../src/archivio/avvio', () => ({ ambienteTauri: () => tauri.attivo }));

import { salvaConNome, salvaInCartella, scegliCartella } from '../../src/archivio/salvaFile';

const BYTE = new Uint8Array([80, 75, 3, 4]);
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('salvaFile in Tauri', () => {
  beforeEach(() => {
    tauri.attivo = true;
    invoke.mockReset();
    open.mockReset();
    save.mockReset();
  });

  it('scegliCartella apre il dialogo di cartella e restituisce il percorso', async () => {
    open.mockResolvedValueOnce('/Users/a/Report');
    expect(await scegliCartella()).toBe('/Users/a/Report');
    expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
  });

  it('scegliCartella restituisce null se annullato', async () => {
    open.mockResolvedValueOnce(null);
    expect(await scegliCartella()).toBeNull();
  });

  it('salvaInCartella unisce con / su macOS e invia i byte come array', async () => {
    invoke.mockResolvedValueOnce(undefined);
    const percorso = await salvaInCartella('/Users/a/Report', 'a.docx', BYTE);
    expect(percorso).toBe('/Users/a/Report/a.docx');
    expect(invoke).toHaveBeenCalledWith('scrivi_file', { percorso: '/Users/a/Report/a.docx', contenuto: [80, 75, 3, 4] });
  });

  it('salvaInCartella unisce con \\ su Windows', async () => {
    invoke.mockResolvedValueOnce(undefined);
    expect(await salvaInCartella('C:\\Users\\a\\Report', 'a.xlsx', BYTE)).toBe('C:\\Users\\a\\Report\\a.xlsx');
    expect(invoke).toHaveBeenCalledWith('scrivi_file', { percorso: 'C:\\Users\\a\\Report\\a.xlsx', contenuto: [80, 75, 3, 4] });
  });

  it('salvaInCartella non raddoppia il separatore finale', async () => {
    invoke.mockResolvedValue(undefined);
    expect(await salvaInCartella('/Users/a/', 'a.docx', BYTE)).toBe('/Users/a/a.docx');
    expect(await salvaInCartella('C:\\Users\\a\\', 'a.docx', BYTE)).toBe('C:\\Users\\a\\a.docx');
  });

  it('salvaConNome usa il nome proposto e il filtro per estensione, poi scrive', async () => {
    save.mockResolvedValueOnce('/Users/a/x.docx');
    invoke.mockResolvedValueOnce(undefined);
    expect(await salvaConNome('x.docx', BYTE)).toBe('/Users/a/x.docx');
    expect(save).toHaveBeenCalledWith({ defaultPath: 'x.docx', filters: [{ name: 'DOCX', extensions: ['docx'] }] });
    expect(invoke).toHaveBeenCalledWith('scrivi_file', { percorso: '/Users/a/x.docx', contenuto: [80, 75, 3, 4] });
  });

  it('salvaConNome restituisce null se annullato, senza scrivere', async () => {
    save.mockResolvedValueOnce(null);
    expect(await salvaConNome('x.xlsx', BYTE)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('salvaFile nell\'anteprima web', () => {
  let creaUrl: ReturnType<typeof vi.fn>;
  let revoca: ReturnType<typeof vi.fn>;
  let clic: ReturnType<typeof vi.spyOn>;
  let blob: Blob | null;

  beforeEach(() => {
    vi.useFakeTimers();
    tauri.attivo = false;
    invoke.mockReset();
    open.mockReset();
    save.mockReset();
    blob = null;
    creaUrl = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:finto';
    });
    revoca = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: creaUrl, revokeObjectURL: revoca });
    clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clic.mockRestore();
  });

  it('scegliCartella restituisce la stringa vuota (= download), senza dialoghi', async () => {
    expect(await scegliCartella()).toBe('');
    expect(open).not.toHaveBeenCalled();
  });

  it('salvaInCartella scarica via Blob e <a download>, poi revoca l\'URL in differita', async () => {
    let download = '';
    let href = '';
    clic.mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
      href = this.href;
    });
    expect(await salvaInCartella('', 'a.docx', BYTE)).toBe('a.docx');
    expect(creaUrl).toHaveBeenCalledOnce();
    expect(blob!.type).toBe(MIME_DOCX);
    expect(blob!.size).toBe(4);
    expect(download).toBe('a.docx');
    expect(href).toBe('blob:finto');
    expect(revoca).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(revoca).toHaveBeenCalledWith('blob:finto');
    expect(invoke).not.toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('salvaConNome scarica un xlsx con il suo MIME e restituisce il nome', async () => {
    expect(await salvaConNome('b.xlsx', BYTE)).toBe('b.xlsx');
    expect(blob!.type).toBe(MIME_XLSX);
    expect(save).not.toHaveBeenCalled();
    expect(clic).toHaveBeenCalledOnce();
  });
});
