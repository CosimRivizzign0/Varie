// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Dashboard } from '../../src/ui/pagine/Dashboard';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

describe('Dashboard', () => {
  it('stato vuoto e pulsanti', async () => {
    renderizza(<Dashboard />, await nuovoRepository());
    expect(await screen.findByText('Nessun cliente. Inizia con «Nuovo cliente».')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuovo cliente' })).toHaveAttribute('href', '/clienti/nuovo');
    expect(screen.getByRole('link', { name: 'Cestino' })).toHaveAttribute('href', '/cestino');
  });

  it('elenca, cerca, filtra e mostra badge AI literacy', async () => {
    const repo = await nuovoRepository();
    await repo.creaCliente(clienteValido());
    const b = await repo.creaCliente(clienteValido({
      ragioneSociale: 'Beta Spa', partitaIva: '12345678903', aiLiteracyDocumentata: true, aiLiteracyData: '2026-01-10',
    }));
    await repo.creaSistema(b.id, { nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza clienti', reparto: null, dataAvvio: null, ruoloCliente: 'deployer' });
    await repo.confermaInventario(b.id);
    renderizza(<Dashboard />, repo);
    expect(await screen.findByText('Acme Srl')).toBeInTheDocument();
    expect(screen.getByText('Beta Spa')).toBeInTheDocument();
    expect(screen.getByText('AI literacy ✓')).toBeInTheDocument();
    expect(screen.getByText('AI literacy da documentare')).toBeInTheDocument();

    const u = userEvent.setup();
    await u.type(screen.getByPlaceholderText('Cerca per ragione sociale o P.IVA'), '1234567');
    expect(screen.queryByText('Acme Srl')).toBeNull();
    expect(screen.getByText('Beta Spa')).toBeInTheDocument();
    await u.clear(screen.getByPlaceholderText('Cerca per ragione sociale o P.IVA'));

    await u.selectOptions(screen.getByLabelText('Filtra per tappa'), 'Inventario');
    const righe = document.querySelectorAll<HTMLElement>('li.riga-cliente');
    expect(righe).toHaveLength(1);
    expect(within(righe[0]).getByText('Acme Srl')).toBeInTheDocument();
  });

  it('errore di caricamento mostrato in role=alert', async () => {
    const repo = await nuovoRepository();
    const rotto = { ...repo, elencaClienti: () => Promise.reject(new Error("Database non disponibile: riavviare l'app")) };
    renderizza(<Dashboard />, rotto);
    expect(await screen.findByRole('alert')).toHaveTextContent("Database non disponibile: riavviare l'app");
    expect(screen.queryByText('Caricamento…')).toBeNull();
  });
});
