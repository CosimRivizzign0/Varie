// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SchedaSistema } from '../../src/ui/pagine/SchedaSistema';
import { Questionario } from '../../src/ui/pagine/Questionario';
import { EsitoValutazione } from '../../src/ui/pagine/EsitoValutazione';
import type { Repository } from '../../src/archivio/repository';
import { REGOLE } from '../../src/regole/attive';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer' as const,
};

function rotte() {
  return (
    <Routes>
      <Route path="/sistemi/:id" element={<SchedaSistema />} />
      <Route path="/sistemi/:id/valutazione" element={<Questionario />} />
      <Route path="/sistemi/:id/valutazione/esito" element={<EsitoValutazione />} />
    </Routes>
  );
}

/** Ritarda ogni salvataggio e registra gli istanti di inizio/fine per verificare la sequenzialità. */
function rallenta(repo: Repository, ms: number) {
  const originale = repo.salvaRisposte.bind(repo);
  const eventi: string[] = [];
  repo.salvaRisposte = async (...args) => {
    eventi.push(`inizio:${JSON.stringify(args[1])}`);
    await new Promise((r) => setTimeout(r, ms));
    const v = await originale(...args);
    eventi.push('fine');
    return v;
  };
  return eventi;
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

  it("Vai all'esito subito dopo l'ultima risposta attende il salvataggio (nessuna attesa nel test)", async () => {
    const { repo, s } = await preparato();
    await repo.avviaValutazione(s.id, REGOLE!.meta.versione);
    rallenta(repo, 80);
    const u = userEvent.setup();
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    const gruppo = await screen.findByRole('group', { name: /sistema di IA/ });
    await u.click(within(gruppo).getByRole('radio', { name: 'No' }));
    await u.click(screen.getByRole('button', { name: "Vai all'esito" }));
    expect(await screen.findByRole('heading', { name: 'Esito della valutazione' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Conferma classificazione' })).toBeInTheDocument();
    expect(screen.queryByText('Questionario incompleto')).toBeNull();
    expect((await repo.getValutazioneAttiva(s.id))?.stato).toBe('completata');
  });

  it("Vai all'esito non naviga se il salvataggio fallisce", async () => {
    const { repo, s } = await preparato();
    await repo.avviaValutazione(s.id, REGOLE!.meta.versione);
    repo.salvaRisposte = async () => {
      await new Promise((r) => setTimeout(r, 150));
      throw new Error('disco pieno');
    };
    const u = userEvent.setup();
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    const gruppo = await screen.findByRole('group', { name: /sistema di IA/ });
    await u.click(within(gruppo).getByRole('radio', { name: 'No' }));
    await u.click(screen.getByRole('button', { name: "Vai all'esito" }));
    expect(await screen.findByRole('alert')).toHaveTextContent('disco pieno');
    expect(screen.getByRole('heading', { name: 'Valutazione AI Act' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Esito della valutazione' })).toBeNull();
  });

  it('coda di salvataggio: clic rapidi salvati in sequenza, vince l\'ultima risposta', async () => {
    const { repo, s } = await preparato();
    await repo.avviaValutazione(s.id, REGOLE!.meta.versione);
    const eventi = rallenta(repo, 40);
    const u = userEvent.setup();
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    const gruppo = await screen.findByRole('group', { name: /sistema di IA/ });
    await u.click(within(gruppo).getByRole('radio', { name: 'Sì' }));
    await u.click(within(gruppo).getByRole('radio', { name: 'No' }));
    await u.click(within(gruppo).getByRole('radio', { name: 'Non so' }));
    await u.click(screen.getByRole('button', { name: /^(Avanti|Vai all'esito)$/ }));
    await waitFor(() => expect(eventi.filter((e) => e === 'fine').length).toBe(eventi.filter((e) => e !== 'fine').length));
    // mai due salvataggi sovrapposti
    for (let i = 0; i < eventi.length; i += 2) {
      expect(eventi[i]).toMatch(/^inizio:/);
      expect(eventi[i + 1]).toBe('fine');
    }
    expect(eventi.length).toBeLessThanOrEqual(6);
    expect(eventi.at(-2)).toBe('inizio:{"amb_sistema_ia":"non_so"}');
    expect((await repo.getValutazioneAttiva(s.id))?.risposte).toEqual({ amb_sistema_ia: 'non_so' });
  });

  it('riprendere una valutazione da rivedere la aggiorna alla versione corrente delle regole', async () => {
    const { repo, s } = await preparato();
    await repo.avviaValutazione(s.id, '0.0.1');
    const u = userEvent.setup();
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione`);
    const gruppo = await screen.findByRole('group', { name: /sistema di IA/ });
    await u.click(within(gruppo).getByRole('radio', { name: 'Sì' }));
    await waitFor(async () => expect((await repo.getValutazioneAttiva(s.id))?.versioneRegole).toBe(REGOLE!.meta.versione));
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
