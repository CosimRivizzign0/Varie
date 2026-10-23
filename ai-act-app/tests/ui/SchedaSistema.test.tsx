// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SchedaSistema } from '../../src/ui/pagine/SchedaSistema';
import { SchedaCliente } from '../../src/ui/pagine/SchedaCliente';
import { clienteValido, nuovoRepository, renderizza } from './aiuti';
import { REGOLE } from '../../src/regole/attive';
import { calcolaEsito } from '../../src/regole/motore';
import type { Risposte } from '../../src/regole/tipi';

const sistema = {
  nome: 'Chatbot', fornitore: 'OpenAI', scopo: 'Assistenza', reparto: null, dataAvvio: null, ruoloCliente: 'deployer',
};

function rotte() {
  return (
    <Routes>
      <Route path="/clienti/:id" element={<SchedaCliente />} />
      <Route path="/clienti/:id/sistemi/nuovo" element={<SchedaSistema />} />
      <Route path="/sistemi/:id" element={<SchedaSistema />} />
    </Routes>
  );
}

describe('SchedaSistema nuovo', () => {
  it('crea un sistema e compare nell\'elenco del cliente', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    renderizza(rotte(), repo, `/clienti/${c.id}/sistemi/nuovo`);
    const u = userEvent.setup();
    expect(await screen.findByRole('link', { name: 'Acme Srl' })).toHaveAttribute('href', `/clienti/${c.id}`);
    await u.type(screen.getByLabelText('Nome del sistema'), 'Chatbot');
    await u.type(screen.getByLabelText('Fornitore'), 'OpenAI');
    await u.type(screen.getByLabelText("Scopo d'uso"), 'Assistenza clienti');
    await u.selectOptions(screen.getByLabelText('Ruolo del cliente'), 'deployer');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('link', { name: 'Chatbot' })).toBeInTheDocument();
    expect(await repo.elencaSistemi(c.id)).toHaveLength(1);
  });

  it('errori live e Salva disabilitato senza ruolo', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    renderizza(rotte(), repo, `/clienti/${c.id}/sistemi/nuovo`);
    const nome = await screen.findByLabelText('Nome del sistema');
    await userEvent.type(nome, 'A');
    expect(await screen.findByText('Inserisci il nome del sistema (2–200 caratteri)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('cliente inesistente: Cliente non trovato', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/clienti/xxx/sistemi/nuovo');
    expect(await screen.findByText('Cliente non trovato')).toBeInTheDocument();
  });

  it('errore di caricamento in role=alert', async () => {
    const repo = await nuovoRepository();
    repo.getCliente = async () => { throw new Error('boom'); };
    renderizza(rotte(), repo, '/clienti/xxx/sistemi/nuovo');
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});

describe('SchedaSistema esistente', () => {
  it('modifica e salva', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    const u = userEvent.setup();
    const nome = await screen.findByLabelText('Nome del sistema');
    expect(nome).toHaveValue('Chatbot');
    await u.clear(nome);
    await u.type(nome, 'Assistente');
    await u.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByRole('link', { name: 'Assistente' })).toBeInTheDocument();
    expect((await repo.getSistema(s.id))?.nome).toBe('Assistente');
  });

  it('sposta nel cestino dopo conferma', async () => {
    const repo = await nuovoRepository();
    const c = await repo.creaCliente(clienteValido());
    const s = await repo.creaSistema(c.id, sistema);
    const conf = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderizza(rotte(), repo, `/sistemi/${s.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Sposta nel cestino' }));
    expect(conf).toHaveBeenCalledWith('Spostare il sistema nel cestino?');
    await waitFor(async () => expect(await repo.elencaSistemi(c.id)).toHaveLength(0));
    expect(await screen.findByRole('button', { name: 'Sposta nel cestino' })).toBeInTheDocument();
    conf.mockRestore();
  });

  describe('cambio del ruolo del cliente con valutazione esistente', () => {
    // Screening CV alto rischio; ruolo_marchio/modifica = no; ente pubblico = no.
    const risposte: Risposte = {
      amb_sistema_ia: 'si', amb_esclusione: 'no',
      vie_manipolazione: 'no', vie_vulnerabilita: 'no', vie_punteggio_sociale: 'no', vie_previsione_reati: 'no',
      vie_scraping_volti: 'no', vie_emozioni_lavoro: 'no', vie_categorizzazione_biometrica: 'no',
      vie_identificazione_tempo_reale: 'no', vie_ncii: 'no',
      ar1_componente_sicurezza: 'no', ar3_biometria: 'no', ar3_infrastrutture_critiche: 'no', ar3_istruzione: 'no',
      ar3_occupazione: 'si', ar3_servizi_pubblici: 'no', ar3_servizi_credito_assicurazioni: 'no', ar3_contrasto: 'no',
      ar3_migrazione: 'no', ar3_giustizia_democrazia: 'no',
      der_compito_procedurale: 'no', der_migliora_attivita_umana: 'no', der_rileva_schemi: 'no',
      der_compito_preparatorio: 'no', der_profilazione: 'no',
      tra_interazione: 'no', tra_contenuti_sintetici: 'no', tra_emozioni_biometria: 'no', tra_deepfake: 'no',
      tra_testi_pubblici: 'no', ruo_marchio: 'no', ruo_modifica: 'no', ruo_ente_pubblico: 'no',
    };

    async function confermato() {
      const repo = await nuovoRepository();
      const c = await repo.creaCliente(clienteValido());
      const s = await repo.creaSistema(c.id, { ...sistema, ruoloCliente: 'da_definire' });
      const v = await repo.avviaValutazione(s.id, REGOLE!.meta.versione);
      await repo.salvaRisposte(v.id, risposte, calcolaEsito(REGOLE!, risposte, 'da_definire'), REGOLE!.meta.versione);
      await repo.confermaValutazione(v.id, 'alto_rischio', null);
      return { repo, s };
    }

    it("ricalcola l'esito con il nuovo ruolo e azzera la conferma", async () => {
      const { repo, s } = await confermato();
      renderizza(rotte(), repo, `/sistemi/${s.id}`);
      const u = userEvent.setup();
      await u.selectOptions(await screen.findByLabelText('Ruolo del cliente'), 'deployer');
      await u.click(screen.getByRole('button', { name: 'Salva' }));
      expect(await screen.findByRole('link', { name: 'Chatbot' })).toBeInTheDocument();
      const v = await repo.getValutazioneAttiva(s.id);
      expect(v?.esito?.ruoloEffettivo).toBe('deployer');
      expect(v?.esito).toEqual(calcolaEsito(REGOLE!, risposte, 'deployer'));
      expect(v).toMatchObject({ stato: 'completata', classeConfermata: null, confermatoIl: null });
    });

    it('senza cambio di ruolo la conferma resta', async () => {
      const { repo, s } = await confermato();
      renderizza(rotte(), repo, `/sistemi/${s.id}`);
      const u = userEvent.setup();
      const nome = await screen.findByLabelText('Nome del sistema');
      await u.type(nome, ' 2');
      await u.click(screen.getByRole('button', { name: 'Salva' }));
      expect(await screen.findByRole('link', { name: 'Chatbot 2' })).toBeInTheDocument();
      const v = await repo.getValutazioneAttiva(s.id);
      expect(v).toMatchObject({ stato: 'confermata', classeConfermata: 'alto_rischio' });
      expect(v?.esito?.ruoloEffettivo).toBe('da_definire');
    });
  });

  it('id sconosciuto: Sistema non trovato', async () => {
    const repo = await nuovoRepository();
    renderizza(rotte(), repo, '/sistemi/xxx');
    expect(await screen.findByText('Sistema non trovato')).toBeInTheDocument();
  });
});
