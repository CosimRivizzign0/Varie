// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SchedaSistema } from '../../src/ui/pagine/SchedaSistema';
import { SchedaCliente } from '../../src/ui/pagine/SchedaCliente';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer',
};

function rotte() {
  return (
    <Routes>
      <Route path="/clienti/:id" element={<SchedaCliente />} />
      <Route path="/clienti/:id/sistemi/nuovo" element={<SchedaSistema />} />
      <Route path="/sistemi/:id" element={<SchedaSistema />} />
    </Routes>
  );
}

describe('SchedaSistema nuovo', () => {
  it('crea un sistema e compare nell\'elenco del cliente', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    renderizza(rotte(), repo, `/clienti/${c.id}/sistemi/nuovo`);
    const u = userEvent.setup();
    expect(await screen.findByRole('link', { name: 'Acme Srl' })).toHaveAttribute('href', `/clienti/${c.id}`);
    await u.type(screen.getByLabelText('Nome del sistema'), 'Chatbot');
    await u.type(screen.getByLabelText('Fornitore'), 'OpenAI');
    await u.type(screen.getByLabelText("Scopo d'uso"), 'Assistenza clienti');
    await u.selectOptions(screen.getByLabelText('Ruolo del cliente'), 'deployer');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('link', { name: 'Chatbot' })).toBeInTheDocument();
    expect(await repo.elencaSistemi(c.id)).toHaveLength(1);
  });

  it('errori live e Salva disabilitato senza ruolo', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    renderizza(rotte(), repo, `/clienti/${c.id}/sistemi/nuovo`);
    const nome = await screen.findByLabelText('Nome del sistema');
    await userEvent.type(nome, 'A');
    expect(await screen.findByText('Inserisci il nome del sistema (2–200 caratteri)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('cliente inesistente: Cliente non trovato', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/clienti/xxx/sistemi/nuovo');
    expect(await screen.findByText('Cliente non trovato')).toBeInTheDocument();
  });

  it('errore di caricamento in role=alert', async () => {
    const repo = await nuovoRepository();
    repo.getCliente = async () => { throw new Error('boom'); };
    renderizza(rotte(), repo, '/clienti/xxx/sistemi/nuovo');
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});

describe('SchedaSistema esistente', () => {
  it('modifica e salva', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    const u = userEvent.setup();
    const nome = await screen.findByLabelText('Nome del sistema');
    expect(nome).toHaveValue('Chatbot');
    await u.clear(nome);
    await u.type(nome, 'Assistente');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('link', { name: 'Assistente' })).toBeInTheDocument();
    expect((await repo.getSistema(s.id))?.nome).toBe('Assistente');
  });

  it('sposta nel cestino dopo conferma', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    const conf = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta nel cestino' }));
    expect(conf).toHaveBeenCalledWith('Spostare il sistema nel cestino?');
    await waitFor(async () => expect(await repo.elencaSistemi(c.id)).toHaveLength(0));
    expect(await screen.findByRole('button', { name: 'Sposta nel cestino' })).toBeInTheDocument();
    conf.mockRestore();
  });

  it('id sconosciuto: Sistema non trovato', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/sistemi/xxx');
    expect(await screen.findByText('Sistema non trovato')).toBeInTheDocument();
  });
});
