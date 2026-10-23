// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Cestino } from '../../src/ui/pagine/Cestino';
import { SchedaCliente } from '../../src/ui/pagine/SchedaCliente';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer',
};

function rotte() {
  return (
    <Routes>
      <Route path="/" element={<p>Home</p>} />
      <Route path="/cestino" element={<Cestino />} />
      <Route path="/clienti/:id" element={<SchedaCliente />} />
    </Routes>
  );
}

describe('Cestino', () => {
  it('stato vuoto e nota a pie\' di pagina', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/cestino');
    expect(await screen.findByText('Il cestino è vuoto.')).toBeInTheDocument();
    expect(screen.getByText('Gli elementi vengono eliminati automaticamente dopo 30 giorni.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Torna ai clienti' })).toHaveAttribute('href', '/');
  });

  it('mostra cliente e sistema con colonne e data gg/mm/aaaa', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    await repo.eliminaSistema(s.id);
    const c2 = await repo.creaCliente(clienteValido({ ragioneSociale: 'Beta Spa', partitaIva: '00743110157' }));
    await repo.eliminaCliente(c2.id);
    renderizza(rotte(), repo, '/cestino');
    const riga = (await screen.findByText('Chatbot')).closest('tr')!;
    expect(within(riga).getByText('Sistema AI')).toBeInTheDocument();
    expect(within(riga).getByText('Acme Srl')).toBeInTheDocument();
    expect(within(riga).getByText(/^\d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    const rigaC = screen.getByText('Beta Spa').closest('tr')!;
    expect(within(rigaC).getByText('Cliente')).toBeInTheDocument();
    expect(within(rigaC).getByText('—')).toBeInTheDocument();
  });

  it('Ripristina: sparisce dal cestino e torna nel cliente', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    await repo.eliminaSistema(s.id);
    renderizza(rotte(), repo, '/cestino');
    await userEvent.click(await screen.findByRole('button', { name: 'Ripristina' }));
    expect(await screen.findByText('Il cestino è vuoto.')).toBeInTheDocument();
    expect(await repo.elencaSistemi(c.id)).toHaveLength(1);
  });

  it('Elimina definitivamente: conferma rimuove, annulla mantiene', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    await repo.eliminaCliente(c.id);
    const conf = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderizza(rotte(), repo, '/cestino');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Elimina definitivamente' }));
    expect(conf).toHaveBeenCalledWith("Eliminare definitivamente? L'operazione non si può annullare.");
    expect(screen.getByText('Acme Srl')).toBeInTheDocument();
    conf.mockReturnValue(true);
    await u.click(screen.getByRole('button', { name: 'Elimina definitivamente' }));
    expect(await screen.findByText('Il cestino è vuoto.')).toBeInTheDocument();
    await waitFor(async () => expect(await repo.elencaCestino()).toHaveLength(0));
    conf.mockRestore();
  });

  it('errore del repository in role=alert', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    await repo.eliminaCliente(c.id);
    repo.ripristinaCliente = async () => { throw new Error('Impossibile ripristinare'); };
    renderizza(rotte(), repo, '/cestino');
    await userEvent.click(await screen.findByRole('button', { name: 'Ripristina' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile ripristinare');
  });

  it('errore di caricamento in role=alert', async () => {
    const repo = await nuovoRepository();
    repo.elencaCestino = async () => { throw new Error('boom'); };
    renderizza(rotte(), repo, '/cestino');
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});
