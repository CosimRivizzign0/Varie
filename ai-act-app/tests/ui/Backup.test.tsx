// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  confirm: vi.fn(),
  ricarica: vi.fn(),
  tauri: { attivo: true },
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: mocks.save, confirm: mocks.confirm }));
vi.mock('../../src/archivio/avvio', async (originale) => ({
  ...(await originale<typeof import('../../src/archivio/avvio')>()),
  ambienteTauri: () => mocks.tauri.attivo,
  ricarica: mocks.ricarica,
}));

import { nuovoRepository, renderizza } from './aiuti';
import { Dashboard } from '../../src/ui/pagine/Dashboard';
import { ErroreAvvio } from '../../src/ui/pagine/ErroreAvvio';
import App from '../../src/ui/App';
import { RepositoryProvider } from '../../src/ui/RepositoryContext';
import { ripristinaUltimoBackup } from '../../src/archivio/avvio';

const FILTRO = [{ name: 'Database', extensions: ['db'] }];

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.tauri.attivo = true;
  mocks.invoke.mockResolvedValue(null);
});

describe('menu backup in Dashboard', () => {
  it('nell\'anteprima web non mostra i pulsanti di backup', async () => {
    mocks.tauri.attivo = false;
    renderizza(<Dashboard />, await nuovoRepository());
    await screen.findByText(/Nessun cliente/);
    expect(screen.queryByRole('button', { name: 'Esporta backup' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ripristina backup' })).toBeNull();
  });

  it('Esporta backup salva nel percorso scelto', async () => {
    mocks.save.mockResolvedValue('/tmp/copia.db');
    renderizza(<Dashboard />, await nuovoRepository());
    await userEvent.click(await screen.findByRole('button', { name: 'Esporta backup' }));
    expect(await screen.findByText('Backup esportato.')).toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ filters: FILTRO }));
    expect(mocks.invoke).toHaveBeenCalledWith('esporta_backup', { dest: '/tmp/copia.db' });
  });

  it('Esporta backup annullato non invoca nulla', async () => {
    mocks.save.mockResolvedValue(null);
    renderizza(<Dashboard />, await nuovoRepository());
    await userEvent.click(await screen.findByRole('button', { name: 'Esporta backup' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('Ripristina backup chiede conferma, ripristina e ricarica', async () => {
    mocks.open.mockResolvedValue('/tmp/vecchio.db');
    const conferma = mocks.confirm.mockResolvedValue(true);
    renderizza(<Dashboard />, await nuovoRepository());
    await userEvent.click(await screen.findByRole('button', { name: 'Ripristina backup' }));
    await waitFor(() => expect(mocks.ricarica).toHaveBeenCalled());
    expect(conferma).toHaveBeenCalledWith(
      'Ripristinare il backup? I dati attuali verranno salvati in un backup prima della sostituzione.',
      expect.objectContaining({ title: 'AI Act Assessment', kind: 'warning' }),
    );
    expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ multiple: false, filters: FILTRO }));
    expect(mocks.invoke).toHaveBeenCalledWith('ripristina_backup', { sorgente: '/tmp/vecchio.db' });
    expect(sessionStorage.getItem('aiact.saltaPulizia')).toBe('1');
  });

  it('Ripristina backup senza conferma non tocca nulla', async () => {
    mocks.open.mockResolvedValue('/tmp/vecchio.db');
    const conferma = mocks.confirm.mockResolvedValue(false);
    renderizza(<Dashboard />, await nuovoRepository());
    await userEvent.click(await screen.findByRole('button', { name: 'Ripristina backup' }));
    await waitFor(() => expect(conferma).toHaveBeenCalled());
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.ricarica).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('aiact.saltaPulizia')).toBeNull();
  });

  it('un ripristino rifiutato mostra l\'errore e non ricarica', async () => {
    mocks.open.mockResolvedValue('/tmp/testo.db');
    mocks.invoke.mockRejectedValue('Il file non è un database valido: file is not a database');
    mocks.confirm.mockResolvedValue(true);
    renderizza(<Dashboard />, await nuovoRepository());
    await userEvent.click(await screen.findByRole('button', { name: 'Ripristina backup' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Il file non è un database valido');
    expect(mocks.ricarica).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('aiact.saltaPulizia')).toBeNull();
  });
});

describe('ErroreAvvio', () => {
  it('mostra il messaggio e ripristina l\'ultimo backup, poi ricarica', async () => {
    render(<ErroreAvvio messaggio="file is not a database" ripristina={ripristinaUltimoBackup} />);
    expect(screen.getByText('Il database non può essere aperto.')).toBeInTheDocument();
    expect(screen.getByText('file is not a database')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Ripristina l'ultimo backup" }));
    await waitFor(() => expect(mocks.ricarica).toHaveBeenCalled());
    expect(mocks.invoke).toHaveBeenCalledWith('ripristina_ultimo_backup', undefined);
    expect(sessionStorage.getItem('aiact.saltaPulizia')).toBe('1');
  });

  it('senza backup mostra "Nessun backup disponibile." e non ricarica', async () => {
    mocks.invoke.mockRejectedValue('Nessun backup disponibile.');
    render(<ErroreAvvio messaggio="errore" ripristina={ripristinaUltimoBackup} />);
    await userEvent.click(screen.getByRole('button', { name: "Ripristina l'ultimo backup" }));
    expect(await screen.findByText('Nessun backup disponibile.')).toBeInTheDocument();
    expect(mocks.ricarica).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('aiact.saltaPulizia')).toBeNull();
  });

  it('senza funzione di ripristino (anteprima web) non mostra il pulsante', () => {
    render(<ErroreAvvio messaggio="errore" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('avviso di backup all\'avvio', () => {
  it('App mostra l\'avviso non bloccante se il backup automatico è fallito', async () => {
    const repo = await nuovoRepository();
    render(
      <RepositoryProvider repository={repo}>
        <App erroreBackup="disco pieno" />
      </RepositoryProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Backup automatico non riuscito: disco pieno');
    expect(await screen.findByText(/Nessun cliente/)).toBeInTheDocument();
  });

  it('App senza errore di backup non mostra avvisi', async () => {
    const repo = await nuovoRepository();
    render(
      <RepositoryProvider repository={repo}>
        <App />
      </RepositoryProvider>,
    );
    await screen.findByText(/Nessun cliente/);
    expect(screen.queryByText(/Backup automatico non riuscito/)).toBeNull();
    expect(screen.queryByText(/Backup ripristinato/)).toBeNull();
  });

  it('App dopo un ripristino mostra «Backup ripristinato.» senza bloccare', async () => {
    const repo = await nuovoRepository();
    render(
      <RepositoryProvider repository={repo}>
        <App ripristinato />
      </RepositoryProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Backup ripristinato.');
    expect(await screen.findByText(/Nessun cliente/)).toBeInTheDocument();
  });
});
