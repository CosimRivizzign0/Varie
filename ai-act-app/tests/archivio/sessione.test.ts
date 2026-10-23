import { describe, expect, it, vi } from 'vitest';
import { CHIAVE_SALTA_PULIZIA, avvioApp, segnaRipristino } from '../../src/archivio/sessione';
import { creaSqlJsDriver } from '../../src/archivio/sqljsDriver';
import { migra } from '../../src/archivio/migrazioni';
import { creaRepository, type Repository } from '../../src/archivio/repository';

function archivioFinto() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    mappa: m,
  };
}

const LANCIA = {
  getItem: () => { throw new Error('negato'); },
  setItem: () => { throw new Error('negato'); },
  removeItem: () => { throw new Error('negato'); },
};

/** Repository con un cliente nel cestino da 31 giorni rispetto a `ora`. */
async function repoConClienteScaduto(): Promise<{ repo: Repository; id: string }> {
  const d = await creaSqlJsDriver();
  await migra(d);
  let ora = new Date('2026-09-01T10:00:00Z');
  const repo = creaRepository(d, { ora: () => ora });
  const c = await repo.creaCliente({
    ragioneSociale: 'Acme Srl', partitaIva: '00488410010', settore: 'Manifattura', referenteNome: 'Mario Rossi',
    referenteEmail: null, note: null, aiLiteracyDocumentata: false, aiLiteracyData: null,
  });
  await repo.eliminaCliente(c.id);
  ora = new Date('2026-10-02T10:00:00Z');
  return { repo, id: c.id };
}

describe('avvioApp', () => {
  it('senza segnale di ripristino svuota il cestino scaduto', async () => {
    const { repo } = await repoConClienteScaduto();
    const archivio = archivioFinto();
    await expect(avvioApp(repo, archivio)).resolves.toEqual({ ripristinato: false });
    expect(await repo.elencaCestino()).toHaveLength(0);
  });

  it('dopo un ripristino salta lo svuotamento una volta sola e rimuove il segnale', async () => {
    const { repo } = await repoConClienteScaduto();
    const archivio = archivioFinto();
    segnaRipristino(archivio);
    expect(archivio.mappa.get(CHIAVE_SALTA_PULIZIA)).toBe('1');
    await expect(avvioApp(repo, archivio)).resolves.toEqual({ ripristinato: true });
    expect(await repo.elencaCestino()).toHaveLength(1);
    expect(archivio.mappa.has(CHIAVE_SALTA_PULIZIA)).toBe(false);
    // Avvio successivo: pulizia normale.
    await expect(avvioApp(repo, archivio)).resolves.toEqual({ ripristinato: false });
    expect(await repo.elencaCestino()).toHaveLength(0);
  });

  it('sessionStorage assente o che lancia: nessuna eccezione, pulizia normale', async () => {
    const { repo } = await repoConClienteScaduto();
    expect(() => segnaRipristino(LANCIA)).not.toThrow();
    expect(() => segnaRipristino(null)).not.toThrow();
    await expect(avvioApp(repo, LANCIA)).resolves.toEqual({ ripristinato: false });
    await expect(avvioApp(repo, null)).resolves.toEqual({ ripristinato: false });
    expect(await repo.elencaCestino()).toHaveLength(0);
  });

  it('uno svuotamento fallito non blocca l\'avvio', async () => {
    const { repo } = await repoConClienteScaduto();
    const errore = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rotto = { ...repo, svuotaCestinoScaduto: () => Promise.reject(new Error('disco')) };
    await expect(avvioApp(rotto, archivioFinto())).resolves.toEqual({ ripristinato: false });
    expect(errore).toHaveBeenCalled();
    errore.mockRestore();
  });
});
