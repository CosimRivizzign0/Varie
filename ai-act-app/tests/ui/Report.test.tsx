// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REGOLE } from '../../src/regole/attive';
import { calcolaEsito } from '../../src/regole/motore';
import type { Risposte } from '../../src/regole/tipi';
import type { Repository } from '../../src/archivio/repository';
import { giornoDiDate } from '../../src/domain/formatoData';
import { SchedaCliente } from '../../src/ui/pagine/SchedaCliente';
import { EsitoValutazione } from '../../src/ui/pagine/EsitoValutazione';
import { creaWord } from '../../src/report/word';
import { creaExcel } from '../../src/report/excel';
import { salvaConNome, salvaInCartella, scegliCartella } from '../../src/archivio/salvaFile';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';

vi.mock('../../src/report/word', () => ({ creaWord: vi.fn() }));
vi.mock('../../src/report/excel', () => ({ creaExcel: vi.fn() }));
vi.mock('../../src/archivio/salvaFile', () => ({
  scegliCartella: vi.fn(),
  salvaInCartella: vi.fn(),
  salvaConNome: vi.fn(),
}));

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
  ar3_biometria: 'no',
  ar3_infrastrutture_critiche: 'no',
  ar3_istruzione: 'no',
  ar3_occupazione: 'si',
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
};

const sistema = (nome: string) => ({
  nome, fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer' as const,
});

const OGGI = giornoDiDate(new Date());
const WORD = `AI-Act_Acme-Srl_Chatbot_${OGGI}.docx`;
const EXCEL = `AI-Act_Acme-Srl_inventario_${OGGI}.xlsx`;

/** Cliente con «Chatbot» confermato e «Selezione CV» con valutazione solo avviata. */
async function preparato() {
  const repo: Repository = await nuovoRepository();
  await repo.salvaImpostazioniStudio({ nome: 'Studio Bianchi', indirizzo: '', piva: '', email: '', telefono: '' });
  const c = await repo.creaCliente(clienteValido());
  const s1 = await repo.creaSistema(c.id, sistema('Chatbot'));
  const s2 = await repo.creaSistema(c.id, sistema('Selezione CV'));
  await repo.confermaInventario(c.id);
  const v = await repo.avviaValutazione(s1.id, REGOLE!.meta.versione);
  const esito = calcolaEsito(REGOLE!, BASE, 'deployer');
  await repo.salvaRisposte(v.id, BASE, esito, REGOLE!.meta.versione);
  await repo.confermaValutazione(v.id, esito.classe, null);
  await repo.avviaValutazione(s2.id, REGOLE!.meta.versione);
  return { repo, c, s1, s2, v };
}

function rotte() {
  return (
    <Routes>
      <Route path="/clienti/:id" element={<SchedaCliente />} />
      <Route path="/sistemi/:id" element={<p>Scheda sistema</p>} />
      <Route path="/sistemi/:id/valutazione" element={<p>Questionario</p>} />
      <Route path="/sistemi/:id/valutazione/esito" element={<EsitoValutazione />} />
    </Routes>
  );
}

beforeEach(() => {
  vi.mocked(creaWord).mockReset().mockResolvedValue(new Uint8Array([1]));
  vi.mocked(creaExcel).mockReset().mockResolvedValue(new Uint8Array([2]));
  vi.mocked(scegliCartella).mockReset().mockResolvedValue('/cartella');
  vi.mocked(salvaInCartella).mockReset().mockImplementation(async (cartella, nome) => `${cartella}/${nome}`);
  vi.mocked(salvaConNome).mockReset();
});

describe('Genera report', () => {
  it('1 sistema confermato + 1 no: Word + Excel, esclusione, registro e roadmap aggiornati', async () => {
    const { repo, c, s1, v } = await preparato();
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const u = userEvent.setup();
    expect(await screen.findByText('0 di 3 report')).toBeInTheDocument();
    expect(screen.getByText('Nessun report generato.')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Genera report' }));

    const esito = await screen.findByRole('status');
    await waitFor(() => expect(esito).toHaveTextContent('File creati:'));
    expect(within(esito).getByText(WORD)).toBeInTheDocument();
    expect(within(esito).getByText(EXCEL)).toBeInTheDocument();
    expect(within(esito).getByText('«Selezione CV»: Non incluso: classificazione non confermata')).toBeInTheDocument();

    expect(salvaInCartella).toHaveBeenCalledTimes(2);
    expect(salvaInCartella).toHaveBeenCalledWith('/cartella', WORD, new Uint8Array([1]));
    expect(salvaInCartella).toHaveBeenCalledWith('/cartella', EXCEL, new Uint8Array([2]));
    expect(vi.mocked(creaWord).mock.calls[0][0]).toMatchObject({ sistema: { id: s1.id }, studio: { nome: 'Studio Bianchi' } });
    const inventario = vi.mocked(creaExcel).mock.calls[0][0];
    expect(inventario.righe).toHaveLength(2);
    expect(inventario.obblighi.length).toBeGreaterThan(0);

    const registro = await repo.elencaReport(c.id);
    expect(registro).toHaveLength(2);
    expect(registro.find((r) => r.tipo === 'word')).toMatchObject({ sistemaId: s1.id, valutazioneId: v.id, nomeFile: WORD });
    expect(registro.find((r) => r.tipo === 'excel')).toMatchObject({ sistemaId: null, valutazioneId: null, nomeFile: EXCEL });

    expect(await screen.findByText('2 di 3 report')).toBeInTheDocument();
    const sezione = screen.getByRole('list', { name: 'Report generati' });
    expect(within(sezione).getByText(new RegExp(`^\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2} — ${WORD.replace(/\./g, '\\.')}$`))).toBeInTheDocument();
    expect(within(sezione).getByText(new RegExp(EXCEL.replace(/\./g, '\\.')))).toBeInTheDocument();
    expect(screen.getByText(`Report Word di «Chatbot» generato`, { exact: false })).toBeInTheDocument();
  });

  it('nessun sistema confermato: crea comunque l\'Excel ed elenca gli esclusi', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    await repo.creaSistema(c.id, sistema('Chatbot'));
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Genera report' }));
    const esito = await screen.findByRole('status');
    await waitFor(() => expect(esito).toHaveTextContent(EXCEL));
    expect(within(esito).getByText('«Chatbot»: Non incluso: classificazione non confermata')).toBeInTheDocument();
    expect(creaWord).not.toHaveBeenCalled();
    expect((await repo.elencaReport(c.id)).map((r) => r.tipo)).toEqual(['excel']);
  });

  it('cartella non scelta: nessun file e nessuna riga nel registro', async () => {
    const { repo, c } = await preparato();
    vi.mocked(scegliCartella).mockResolvedValue(null);
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const u = userEvent.setup();
    const pulsante = await screen.findByRole('button', { name: 'Genera report' });
    await u.click(pulsante);
    await waitFor(() => expect(pulsante).toBeEnabled());
    expect(salvaInCartella).not.toHaveBeenCalled();
    expect(screen.queryByText('File creati:')).toBeNull();
    expect(await repo.elencaReport(c.id)).toHaveLength(0);
  });

  it('doppio clic: una sola generazione, pulsante disabilitato durante la generazione', async () => {
    const { repo, c } = await preparato();
    let sblocca!: (v: string) => void;
    vi.mocked(scegliCartella).mockImplementation(() => new Promise((r) => { sblocca = r; }));
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const u = userEvent.setup();
    const pulsante = await screen.findByRole('button', { name: 'Genera report' });
    await u.dblClick(pulsante);
    expect(pulsante).toBeDisabled();
    sblocca('/cartella');
    await screen.findByText(EXCEL);
    await waitFor(() => expect(pulsante).toBeEnabled());
    expect(scegliCartella).toHaveBeenCalledTimes(1);
    expect(await repo.elencaReport(c.id)).toHaveLength(2);
  });

  it('errore durante la scrittura: alert, i file già scritti restano registrati', async () => {
    const { repo, c } = await preparato();
    vi.mocked(salvaInCartella).mockImplementation(async (cartella, nome) => {
      if (nome.endsWith('.xlsx')) throw new Error('Permesso negato');
      return `${cartella}/${nome}`;
    });
    renderizza(rotte(), repo, `/clienti/${c.id}`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Genera report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permesso negato');
    expect(within(screen.getByRole('status')).getByText(WORD)).toBeInTheDocument();
    const registro = await repo.elencaReport(c.id);
    expect(registro.map((r) => r.tipo)).toEqual(['word']);
    expect(await screen.findByText('1 di 3 report')).toBeInTheDocument();
  });
});

describe('Esporta Word', () => {
  it('valutazione confermata: Salva con nome e registro', async () => {
    const { repo, c, s1, v } = await preparato();
    vi.mocked(salvaConNome).mockImplementation(async (nome) => `/scelto/${nome}`);
    renderizza(rotte(), repo, `/sistemi/${s1.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Esporta Word' }));
    expect(await screen.findByRole('status')).toHaveTextContent(`File creato: /scelto/${WORD}`);
    expect(salvaConNome).toHaveBeenCalledWith(WORD, new Uint8Array([1]));
    expect(vi.mocked(creaWord).mock.calls[0][0]).toMatchObject({ studio: { nome: 'Studio Bianchi' }, cliente: { id: c.id } });
    const registro = await repo.elencaReport(c.id);
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({ tipo: 'word', sistemaId: s1.id, valutazioneId: v.id, nomeFile: WORD });
  });

  it('Salva con nome annullato: nulla registrato', async () => {
    const { repo, c, s1 } = await preparato();
    vi.mocked(salvaConNome).mockResolvedValue(null);
    renderizza(rotte(), repo, `/sistemi/${s1.id}/valutazione/esito`);
    const u = userEvent.setup();
    const pulsante = await screen.findByRole('button', { name: 'Esporta Word' });
    await u.click(pulsante);
    await waitFor(() => expect(salvaConNome).toHaveBeenCalled());
    await waitFor(() => expect(pulsante).toBeEnabled());
    expect(screen.queryByRole('status')).toBeNull();
    expect(await repo.elencaReport(c.id)).toHaveLength(0);
  });

  it('errore di scrittura in role="alert"', async () => {
    const { repo, c, s1 } = await preparato();
    vi.mocked(salvaConNome).mockRejectedValue(new Error('Disco pieno'));
    renderizza(rotte(), repo, `/sistemi/${s1.id}/valutazione/esito`);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Esporta Word' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disco pieno');
    expect(await repo.elencaReport(c.id)).toHaveLength(0);
  });

  it('valutazione non confermata: nessun pulsante', async () => {
    const { repo, s2 } = await preparato();
    const v2 = await repo.getValutazioneAttiva(s2.id);
    await repo.salvaRisposte(v2!.id, BASE, calcolaEsito(REGOLE!, BASE, 'deployer'), REGOLE!.meta.versione);
    renderizza(rotte(), repo, `/sistemi/${s2.id}/valutazione/esito`);
    expect(await screen.findByRole('button', { name: 'Conferma classificazione' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Esporta Word' })).toBeNull();
  });
});
