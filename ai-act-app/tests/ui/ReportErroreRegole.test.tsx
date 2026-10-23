// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SchedaCliente } from '../../src/ui/pagine/SchedaCliente';
import { EsitoValutazione } from '../../src/ui/pagine/EsitoValutazione';
import { scegliCartella, salvaConNome } from '../../src/archivio/salvaFile';
import type { EsitoValutazione as Esito } from '../../src/regole/motore';
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

describe('Esporta Word senza regole', () => {
  it('pulsante disabilitato con spiegazione', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, {
      nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer',
    });
    // Senza regole l'esito si costruisce a mano (valutazione confermata in precedenza)
    const esito: Esito = {
      classe: 'minimo', trasparenza: false, motivazione: [], aperte: [], ruoloEffettivo: 'deployer', obblighi: [],
      dataApplicazioneClasse: null, completo: true, vociUsate: [], vociNonValidate: 0,
    };
    const v = await repo.avviaValutazione(s.id, '1.0.0');
    await repo.salvaRisposte(v.id, {}, esito, '1.0.0');
    await repo.confermaValutazione(v.id, 'minimo', null);
    renderizza(
      <Routes><Route path="/sistemi/:id/valutazione/esito" element={<EsitoValutazione />} /></Routes>,
      repo,
      `/sistemi/${s.id}/valutazione/esito`,
    );
    const pulsante = await screen.findByRole('button', { name: 'Esporta Word' });
    expect(pulsante).toBeDisabled();
    expect(screen.getByText('Report non disponibili: regole non caricate.')).toBeInTheDocument();
    expect(salvaConNome).not.toHaveBeenCalled();
  });
});
