// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Repository } from '../../src/archivio/repository';
import { Dashboard } from '../../src/ui/pagine/Dashboard';
import { Impostazioni } from '../../src/ui/pagine/Impostazioni';
import { nuovoRepository, renderizza } from './aiuti';

function rotte() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/impostazioni" element={<Impostazioni />} />
    </Routes>
  );
}

describe('Impostazioni', () => {
  it('la dashboard porta alle impostazioni', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/');
    await userEvent.click(await screen.findByRole('link', { name: 'Impostazioni' }));
    expect(await screen.findByRole('heading', { name: 'Impostazioni' })).toBeInTheDocument();
  });

  it('salva i dati dello studio, mostra la conferma e li rilegge', async () => {
    const repo = await nuovoRepository();
    const vista = renderizza(rotte(), repo, '/impostazioni');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Nome dello studio'), "Studio L'Officina");
    await u.type(screen.getByLabelText('Indirizzo'), 'Via Roma 1, Torino');
    await u.type(screen.getByLabelText('Partita IVA'), '00488410010');
    await u.type(screen.getByLabelText('Email'), 'info@studio.it');
    await u.type(screen.getByLabelText('Telefono'), '011 123456');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Impostazioni salvate.');
    expect(await repo.getImpostazioniStudio()).toEqual({
      nome: "Studio L'Officina",
      indirizzo: 'Via Roma 1, Torino',
      piva: '00488410010',
      email: 'info@studio.it',
      telefono: '011 123456',
    });

    vista.unmount();
    renderizza(rotte(), repo, '/impostazioni');
    expect(await screen.findByLabelText('Nome dello studio')).toHaveValue("Studio L'Officina");
    expect(screen.getByLabelText('Telefono')).toHaveValue('011 123456');
  });

  it('modificare un campo dopo il salvataggio toglie la conferma', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/impostazioni');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Nome dello studio'), 'Studio');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Email'), 'x');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('errore di salvataggio in role="alert"', async () => {
    const repo = await nuovoRepository();
    const guasto: Repository = { ...repo, salvaImpostazioniStudio: async () => { throw new Error('Disco pieno'); } };
    renderizza(rotte(), guasto, '/impostazioni');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Nome dello studio'), 'Studio');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disco pieno');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
