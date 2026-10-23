// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  tauri: { attivo: true },
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: mocks.confirm, open: vi.fn(), save: vi.fn() }));
vi.mock('../../src/archivio/avvio', async (originale) => ({
  ...(await originale<typeof import('../../src/archivio/avvio')>()),
  ambienteTauri: () => mocks.tauri.attivo,
}));

import { conferma } from '../../src/ui/conferma';
import { Cestino } from '../../src/ui/pagine/Cestino';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  mocks.tauri.attivo = true;
});

describe('conferma', () => {
  it('nell\'app desktop usa il dialogo nativo e ne attende la risposta', async () => {
    const finestra = vi.spyOn(window, 'confirm');
    mocks.confirm.mockResolvedValue(false);
    await expect(conferma('Sicuro?')).resolves.toBe(false);
    mocks.confirm.mockResolvedValue(true);
    await expect(conferma('Sicuro?')).resolves.toBe(true);
    expect(mocks.confirm).toHaveBeenCalledWith('Sicuro?', expect.objectContaining({ title: 'AI Act Assessment', kind: 'warning' }));
    expect(finestra).not.toHaveBeenCalled();
  });

  it('nell\'anteprima web usa window.confirm', async () => {
    mocks.tauri.attivo = false;
    const finestra = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await expect(conferma('Sicuro?')).resolves.toBe(false);
    finestra.mockReturnValue(true);
    await expect(conferma('Sicuro?')).resolves.toBe(true);
    expect(finestra).toHaveBeenCalledWith('Sicuro?');
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it('desktop: Elimina definitivamente annullato (Promise false) non elimina nulla', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    await repo.eliminaCliente(c.id);
    mocks.confirm.mockResolvedValue(false);
    renderizza(<Routes><Route path="/cestino" element={<Cestino />} /></Routes>, repo, '/cestino');
    await userEvent.click(await screen.findByRole('button', { name: 'Elimina definitivamente' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(await repo.elencaCestino()).toHaveLength(1);
    expect(screen.getByText('Acme Srl')).toBeInTheDocument();
  });
});
