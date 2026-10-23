// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SchedaSistema } from '../../src/ui/pagine/SchedaSistema';
import type { EsitoValutazione } from '../../src/regole/motore';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

vi.mock('../../src/regole/attive', () => ({
  REGOLE: null,
  ERRORE_REGOLE: { problemi: ['domanda duplicata'] },
}));

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'da_definire' as const,
};

// Senza regole l'esito si costruisce a mano (valutazione confermata in precedenza)
const esito: EsitoValutazione = {
  classe: 'minimo', trasparenza: false, motivazione: [], aperte: [], ruoloEffettivo: 'da_definire', obblighi: [],
  dataApplicazioneClasse: null, completo: true, vociUsate: [], vociNonValidate: 0,
};

function rotte() {
  return (
    <Routes>
      <Route path="/clienti/:id" element={<p>Scheda cliente</p>} />
      <Route path="/sistemi/:id" element={<SchedaSistema />} />
    </Routes>
  );
}

describe('Cambio del ruolo senza regole', () => {
  it('con una valutazione con esito: cambio rifiutato con messaggio, nulla salvato', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    const v = await repo.avviaValutazione(s.id, '1.0.0');
    await repo.salvaRisposte(v.id, {}, esito, '1.0.0');
    await repo.confermaValutazione(v.id, 'minimo', null);
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    const u = userEvent.setup();
    await u.selectOptions(await screen.findByLabelText('Ruolo del cliente'), 'deployer');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    // Anche il riquadro della valutazione segnala le regole mancanti: si cerca l'alert del salvataggio
    const messaggio = await screen.findByText(
      "Ruolo del cliente non modificato: regole non caricate, impossibile ricalcolare l'esito della valutazione.",
    );
    expect(messaggio).toHaveAttribute('role', 'alert');
    expect((await repo.getSistema(s.id))?.ruoloCliente).toBe('da_definire');
    expect(await repo.getValutazioneAttiva(s.id)).toMatchObject({ stato: 'confermata', classeConfermata: 'minimo' });
  });

  it('senza valutazione: il ruolo si salva', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    const u = userEvent.setup();
    await u.selectOptions(await screen.findByLabelText('Ruolo del cliente'), 'deployer');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText('Scheda cliente')).toBeInTheDocument();
    expect((await repo.getSistema(s.id))?.ruoloCliente).toBe('deployer');
  });
});
