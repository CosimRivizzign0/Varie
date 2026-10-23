// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SchedaCliente } from '../../src/ui/pagine/SchedaCliente';
import { Dashboard } from '../../src/ui/pagine/Dashboard';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer',
};

function rotte() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/clienti/nuovo" element={<SchedaCliente />} />
      <Route path="/clienti/:id" element={<SchedaCliente />} />
    </Routes>
  );
}

async function compila(u: ReturnType<typeof userEvent.setup>) {
  await u.type(screen.getByLabelText('Ragione sociale'), 'Acme Srl');
  await u.type(screen.getByLabelText('Partita IVA'), '00488410010');
  await u.type(screen.getByLabelText('Settore'), 'Manifattura');
  await u.type(screen.getByLabelText('Referente'), 'Mario Rossi');
}

describe('SchedaCliente nuovo', () => {
  it('P.IVA non valida: errore visibile e Salva disabilitato', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/clienti/nuovo');
    await userEvent.type(screen.getByLabelText('Partita IVA'), '123');
    expect(await screen.findByText('Partita IVA non valida')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('doppio clic su Salva crea un solo cliente e apre la scheda', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/clienti/nuovo');
    const u = userEvent.setup();
    await compila(u);
    const salva = screen.getByRole('button', { name: 'Salva' });
    await waitFor(() => expect(salva).toBeEnabled());
    await u.dblClick(salva);
    await waitFor(async () => expect(await repo.elencaClienti()).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Sposta nel cestino' })).toBeInTheDocument();
    expect(await repo.elencaClienti()).toHaveLength(1);
  });

  it('mostra l\'errore del repository per P.IVA duplicata', async () => {
    const repo = await nuovoRepository();
    await repo.creaCliente(clienteValido());
    renderizza(rotte(), repo, '/clienti/nuovo');
    const u = userEvent.setup();
    await compila(u);
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un cliente con questa Partita IVA');
  });
});

describe('SchedaCliente esistente', () => {
  it('elenca sistemi, conferma inventario, log e cestino', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const u = userEvent.setup();

    await u.click(await screen.findByRole('button', { name: 'Conferma inventario' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aggiungi almeno un sistema AI');
    expect(screen.getByRole('link', { name: 'Aggiungi sistema AI' })).toHaveAttribute('href', `/clienti/${c.id}/sistemi/nuovo`);
  });

  it('mostra i sistemi con link e conferma l\'inventario', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const link = await screen.findByRole('link', { name: /Chatbot/ });
    expect(link).toHaveAttribute('href', `/sistemi/${s.id}`);
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument();
    expect(screen.getByText(/Deployer/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Conferma inventario' }));
    await waitFor(async () => expect((await repo.getCliente(c.id))?.inventarioConfermato).toBe(true));
    expect(await screen.findByText(/inventario/i, { selector: 'li' })).toBeInTheDocument();
  });

  it('sposta nel cestino dopo conferma e torna alla dashboard', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta nel cestino' }));
    expect(window.confirm).toHaveBeenCalledWith('Spostare il cliente nel cestino?');
    expect(await screen.findByRole('link', { name: 'Nuovo cliente' })).toBeInTheDocument();
    expect(await repo.elencaClienti()).toHaveLength(0);
  });

  it('Conferma inventario non perde le modifiche non salvate del modulo', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    await repo.creaSistema(c.id, sistema);
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const u = userEvent.setup();
    const settore = await screen.findByLabelText('Settore');
    await u.clear(settore);
    await u.type(settore, 'Logistica');
    await u.click(screen.getByRole('button', { name: 'Conferma inventario' }));
    await waitFor(async () => expect((await repo.getCliente(c.id))?.inventarioConfermato).toBe(true));
    expect(await screen.findByText(/inventario/i, { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByLabelText('Settore')).toHaveValue('Logistica');
    expect((await repo.getCliente(c.id))?.settore).toBe('Manifattura');
  });
});
