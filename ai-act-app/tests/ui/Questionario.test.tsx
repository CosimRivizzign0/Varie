// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SchedaSistema } from '../../src/ui/pagine/SchedaSistema';
import { Questionario } from '../../src/ui/pagine/Questionario';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer' as const,
};

function rotte() {
  return (
    <Routes>
      <Route path="/sistemi/:id" element={<SchedaSistema />} />
      <Route path="/sistemi/:id/valutazione" element={<Questionario />} />
    </Routes>
  );
}

async function preparato() {
  const repo = await nuovoRepository();
  const c = await repo.creaCliente(clienteValido());
  const s = await repo.creaSistema(c.id, sistema);
  return { repo, s };
}

describe('Questionario', () => {
  it('Avvia valutazione dal riquadro crea la valutazione e apre il questionario', async () => {
    const { repo, s } = await preparato();
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    const u = userEvent.setup();
    expect(await screen.findByText('Valutazione AI Act')).toBeInTheDocument();
    expect(await screen.findByText('Non avviata')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Avvia valutazione' }));
    expect(await screen.findByText(/^Sezione 1 di \d+ — Ambito$/)).toBeInTheDocument();
    expect(await repo.getValutazioneAttiva(s.id)).not.toBeNull();
  });

  it('la risposta è salvata e ripresa dopo il rimontaggio', async () => {
    const { repo, s } = await preparato();
    await repo.avviaValutazione(s.id, '1.0.0');
    const u = userEvent.setup();
    const { unmount } = renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    const gruppo = await screen.findByRole('group', { name: /sistema di IA/ });
    await u.click(within(gruppo).getByRole('radio', { name: 'Sì' }));
    expect(within(gruppo).getByRole('radio', { name: 'Sì' })).toBeChecked();
    const v = await repo.getValutazioneAttiva(s.id);
    expect(v?.risposte.amb_sistema_ia).toBe('si');
    unmount();
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    const g2 = await screen.findByRole('group', { name: /sistema di IA/ });
    expect(within(g2).getByRole('radio', { name: 'Sì' })).toBeChecked();
  });

  it('rispondere No alla definizione di sistema di IA nasconde le altre sezioni', async () => {
    const { repo, s } = await preparato();
    await repo.avviaValutazione(s.id, '1.0.0');
    const u = userEvent.setup();
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    const gruppo = await screen.findByRole('group', { name: /sistema di IA/ });
    expect(screen.getByText(/^Sezione 1 di [2-9]/)).toBeInTheDocument();
    await u.click(within(gruppo).getByRole('radio', { name: 'No' }));
    expect(await screen.findByText('Sezione 1 di 1 — Ambito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vai all\'esito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Avanti' })).toBeNull();
  });

  it('mostra Da rivedere con valutazione su versione diversa', async () => {
    const { repo, s } = await preparato();
    await repo.avviaValutazione(s.id, '0.0.1');
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    expect(await screen.findByText('Da rivedere')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Riprendi' })).toBeInTheDocument();
  });

  it('senza valutazione attiva reindirizza alla scheda sistema', async () => {
    const { repo, s } = await preparato();
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    expect(await screen.findByLabelText('Nome del sistema')).toBeInTheDocument();
  });
});
