// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/regole/attive', () => ({
  REGOLE: null,
  ERRORE_REGOLE: { problemi: ['domanda duplicata', 'riferimento mancante'] },
}));

import { SchedaSistema } from '../../src/ui/pagine/SchedaSistema';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

describe('ERRORE_REGOLE', () => {
  it('mostra un alert e nessun pulsante di valutazione', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, {
      nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer',
    });
    renderizza(
      <Routes><Route path="/sistemi/:id" element={<SchedaSistema />} /></Routes>,
      repo,
      `/sistemi/${s.id}`,
    );
    const alert = await screen.findByText('Regole non caricate: domanda duplicata; riferimento mancante');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.queryByRole('button', { name: 'Avvia valutazione' })).toBeNull();
  });
});
