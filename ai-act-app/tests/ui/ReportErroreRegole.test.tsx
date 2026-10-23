// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SchedaCliente } from '../../src/ui/pagine/SchedaCliente';
import { scegliCartella } from '../../src/archivio/salvaFile';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

vi.mock('../../src/regole/attive', () => ({
  REGOLE: null,
  ERRORE_REGOLE: { problemi: ['domanda duplicata'] },
}));
vi.mock('../../src/archivio/salvaFile', () => ({
  scegliCartella: vi.fn(),
  salvaInCartella: vi.fn(),
  salvaConNome: vi.fn(),
}));

describe('Genera report senza regole', () => {
  it('pulsante disabilitato con spiegazione', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    renderizza(
      <Routes><Route path="/clienti/:id" element={<SchedaCliente />} /></Routes>,
      repo,
      `/clienti/${c.id}`,
    );
    expect(await screen.findByRole('button', { name: 'Genera report' })).toBeDisabled();
    expect(screen.getByText('Report non disponibili: regole non caricate.')).toBeInTheDocument();
    expect(scegliCartella).not.toHaveBeenCalled();
  });
});
