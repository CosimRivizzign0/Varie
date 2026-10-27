// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { REGOLE } from '../../src/regole/attive';
import { calcolaEsito } from '../../src/regole/motore';
import type { Risposte } from '../../src/regole/tipi';
import type { Repository } from '../../src/archivio/repository';
import { EsitoValutazione } from '../../src/ui/pagine/EsitoValutazione';
import { Questionario } from '../../src/ui/pagine/Questionario';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

const BASE: Risposte = {
  amb_sistema_ia: 'si',
  amb_esclusione: 'no',
  vie_manipolazione: 'no',
  vie_vulnerabilita: 'no',
  vie_punteggio_sociale: 'no',
  vie_previsione_reati: 'no',
  vie_scraping_volti: 'no',
  vie_emozioni_lavoro: 'no',
  vie_categorizzazione_biometrica: 'no',
  vie_identificazione_tempo_reale: 'no',
  vie_ncii: 'no',
  ar1_componente_sicurezza: 'no',
  ar1_sezione_b: 'no',
  ar3_biometria: 'no',
  ar3_infrastrutture_critiche: 'no',
  ar3_istruzione: 'no',
  ar3_occupazione: 'no',
  ar3_servizi_pubblici: 'no',
  ar3_servizi_credito_assicurazioni: 'no',
  ar3_contrasto: 'no',
  ar3_migrazione: 'no',
  ar3_giustizia_democrazia: 'no',
  der_compito_procedurale: 'no',
  der_migliora_attivita_umana: 'no',
  der_rileva_schemi: 'no',
  der_compito_preparatorio: 'no',
  der_profilazione: 'no',
  tra_interazione: 'no',
  tra_contenuti_sintetici: 'no',
  tra_emozioni_biometria: 'no',
  tra_deepfake: 'no',
  tra_testi_pubblici: 'no',
  ruo_marchio: 'no',
  ruo_modifica: 'no',
  ruo_ente_pubblico: 'no',
  ruo_uso_autorita_pubbliche: 'no',
};

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer' as const,
};

function rotte() {
  return (
    <Routes>
      <Route path="/sistemi/:id" element={<p>Scheda sistema</p>} />
      <Route path="/sistemi/:id/valutazione" element={<p>Questionario</p>} />
      <Route path="/sistemi/:id/valutazione/esito" element={<EsitoValutazione />} />
    </Routes>
  );
}

function rotteConQuestionario() {
  return (
    <Routes>
      <Route path="/sistemi/:id/valutazione" element={<Questionario />} />
      <Route path="/sistemi/:id/valutazione/esito" element={<EsitoValutazione />} />
    </Routes>
  );
}

async function preparato(modifiche: Risposte | null, nonValidate = 0) {
  const repo: Repository = await nuovoRepository();
  const c = await repo.creaCliente(clienteValido());
  const s = await repo.creaSistema(c.id, sistema);
  const v = await repo.avviaValutazione(s.id, '1.0.0');
  if (modifiche) {
    const r = { ...BASE, ...modifiche };
    const esito = calcolaEsito(REGOLE!, r, 'deployer');
    // Simula una voce usata non validata (es. esito calcolato con regole precedenti).
    await repo.salvaRisposte(v.id, r, { ...esito, vociNonValidate: nonValidate }, REGOLE!.meta.versione);
  }
  return { repo, s, v };
}

describe('EsitoValutazione', () => {
  it('mostra classe, trasparenza, data, motivazione, obblighi e avviso regole non validate', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si', tra_interazione: 'si' }, 3);
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    expect(await screen.findByText('Alto rischio')).toBeInTheDocument();
    expect(screen.getByText('+ obblighi di trasparenza')).toBeInTheDocument();
    expect(screen.getByText('Applicabile dal 02/12/2027')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Motivazione' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Obblighi' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Dal' })).toBeInTheDocument();
    expect(screen.getByText(/^Regole non ancora validate \(\d+ di \d+\): verificare l'esito prima di consegnarlo\.$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chatbot' })).toBeInTheDocument();
  });

  it('con tutte le voci usate validate non mostra l\'avviso regole non validate', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si', tra_interazione: 'si' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    expect(await screen.findByText('Alto rischio')).toBeInTheDocument();
    expect(screen.queryByText(/Regole non ancora validate/)).toBeNull();
  });

  it('conferma la classificazione e mostra lo stato confermato', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Conferma classificazione' }));
    expect(await screen.findByText(/^Confermata il \d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    expect((await repo.getValutazioneAttiva(s.id))?.stato).toBe('confermata');
    expect(screen.queryByRole('button', { name: 'Conferma classificazione' })).toBeNull();
  });

  it('modifica senza motivo mostra l\'errore sotto il campo e non salva', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Modifica classificazione' }));
    await u.selectOptions(screen.getByLabelText('Classe'), 'minimo');
    await u.click(screen.getByRole('button', { name: 'Salva modifica' }));
    expect(await screen.findByText('Indica il motivo della modifica')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo della modifica')).toHaveAccessibleDescription('Indica il motivo della modifica');
    expect((await repo.getValutazioneAttiva(s.id))?.stato).toBe('completata');
  });

  it('modifica con motivo salva e mostra classe scelta e nota', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Modifica classificazione' }));
    await u.selectOptions(screen.getByLabelText('Classe'), 'minimo');
    await u.type(screen.getByLabelText('Motivo della modifica'), 'Solo uso interno');
    await u.click(screen.getByRole('button', { name: 'Salva modifica' }));
    expect(await screen.findByText(/^Confermata il /)).toBeInTheDocument();
    expect(screen.getByText('Rischio minimo')).toBeInTheDocument();
    expect(screen.getByText('Solo uso interno')).toBeInTheDocument();
    const v = await repo.getValutazioneAttiva(s.id);
    expect(v?.classeConfermata).toBe('minimo');
    expect(v?.notaModifica).toBe('Solo uso interno');
  });

  it('classe modificata dal consulente: titolo con la classe scelta, classe calcolata e avviso', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Modifica classificazione' }));
    await u.selectOptions(screen.getByLabelText('Classe'), 'minimo');
    await u.type(screen.getByLabelText('Motivo della modifica'), 'Solo uso interno');
    await u.click(screen.getByRole('button', { name: 'Salva modifica' }));
    await screen.findByText(/^Confermata il /);
    const titolo = document.querySelector('.esito-classe');
    expect(titolo).toHaveTextContent(/^Rischio minimo$/);
    expect(screen.getByText('Classe calcolata: Alto rischio')).toBeInTheDocument();
    expect(
      screen.getByText('Classificazione modificata dal consulente: gli obblighi elencati si riferiscono alla classe calcolata.'),
    ).toBeInTheDocument();
  });

  it('classe confermata uguale alla calcolata: nessun avviso di modifica', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Conferma classificazione' }));
    await screen.findByText(/^Confermata il /);
    expect(document.querySelector('.esito-classe')).toHaveTextContent(/^Alto rischio$/);
    expect(screen.queryByText(/^Classe calcolata:/)).toBeNull();
    expect(screen.queryByText(/^Classificazione modificata dal consulente/)).toBeNull();
  });

  it('Torna al questionario nell\'intestazione sia per completata sia per confermata', async () => {
    const { repo, s, v } = await preparato({ ar3_occupazione: 'si' });
    const { unmount } = renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    expect(await screen.findByRole('link', { name: 'Torna al questionario' })).toHaveAttribute('href', `/sistemi/${s.id}/valutazione`);
    unmount();
    await repo.confermaValutazione(v.id, 'alto_rischio', null);
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    expect(await screen.findByText(/^Confermata il /)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Torna al questionario' })).toHaveAttribute('href', `/sistemi/${s.id}/valutazione`);
  });

  it('modificare una risposta di una valutazione confermata la riporta a completata', async () => {
    const { repo, s, v } = await preparato({ ar3_occupazione: 'si' });
    await repo.confermaValutazione(v.id, 'alto_rischio', null);
    renderizza(rotteConQuestionario(), repo, `/sistemi/${s.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('link', { name: 'Torna al questionario' }));
    const gruppo = await screen.findByRole('group', { name: /sistema di IA/ });
    await u.click(within(gruppo).getByRole('radio', { name: 'No' }));
    await u.click(await screen.findByRole('button', { name: "Vai all'esito" }));
    expect(await screen.findByRole('button', { name: 'Conferma classificazione' })).toBeInTheDocument();
    expect(screen.queryByText(/^Confermata il /)).toBeNull();
    const dopo = await repo.getValutazioneAttiva(s.id);
    expect(dopo).toMatchObject({ stato: 'completata', classeConfermata: null, confermatoIl: null });
  });

  it('Annulla chiude il modulo di modifica', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'si' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Modifica classificazione' }));
    await u.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByLabelText('Motivo della modifica')).toBeNull();
  });

  it('da approfondire mostra i punti aperti con il testo della domanda', async () => {
    const { repo, s } = await preparato({ ar3_occupazione: 'non_so' });
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    expect(await screen.findByRole('heading', { name: 'Punti da approfondire' })).toBeInTheDocument();
    const testo = REGOLE!.domande.find((d) => d.id === 'ar3_occupazione')!.testo;
    expect(screen.getByText(testo)).toBeInTheDocument();
    expect(screen.getAllByText('Da approfondire').length).toBeGreaterThan(0);
  });

  it('ruolo da definire mostra l\'avviso', async () => {
    const repo: Repository = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, { ...sistema, ruoloCliente: 'da_definire' });
    const v = await repo.avviaValutazione(s.id, '1.0.0');
    const r = { ...BASE };
    const e = calcolaEsito(REGOLE!, r, s.ruoloCliente);
    await repo.salvaRisposte(v.id, r, e, REGOLE!.meta.versione);
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    await screen.findByRole('heading', { name: 'Obblighi' });
    expect(e.ruoloEffettivo).toBe('da_definire');
    expect(screen.getByText('Ruolo del cliente da definire: sono mostrati gli obblighi di tutti i ruoli.')).toBeInTheDocument();
  });

  it('valutazione in corso: questionario incompleto e link', async () => {
    const { repo, s } = await preparato(null);
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    expect(await screen.findByText('Questionario incompleto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Torna al questionario' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conferma classificazione' })).toBeNull();
  });

  it('senza valutazione attiva reindirizza alla scheda sistema', async () => {
    const repo: Repository = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    renderizza(rotte(), repo, `/sistemi/${s.id}/valutazione/esito`);
    expect(await screen.findByText('Scheda sistema')).toBeInTheDocument();
  });
});
