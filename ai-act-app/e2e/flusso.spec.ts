import { expect, test, type Page } from '@playwright/test';

async function creaCliente(page: Page) {
  await page.getByRole('link', { name: 'Nuovo cliente' }).click();
  await page.getByLabel('Ragione sociale').fill('Rossi S.r.l.');
  await page.getByLabel('Partita IVA').fill('00488410010');
  await page.getByLabel('Settore').fill('Manifattura');
  await page.getByLabel('Referente', { exact: true }).fill('Mario Rossi');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByRole('heading', { name: 'Rossi S.r.l.' })).toBeVisible();
}

async function aggiungiSistema(page: Page, nome: string, fornitore: string, scopo: string) {
  await page.getByRole('link', { name: 'Aggiungi sistema AI' }).click();
  await page.getByLabel('Nome del sistema').fill(nome);
  await page.getByLabel('Fornitore').fill(fornitore);
  await page.getByLabel("Scopo d'uso").fill(scopo);
  await page.getByLabel('Ruolo del cliente').selectOption({ label: 'Deployer (utilizzatore)' });
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByRole('link', { name: nome })).toBeVisible();
}

test('flusso completo: cliente, due sistemi, conferma inventario, dashboard al 40%', async ({ page }) => {
  const erroriConsole: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') erroriConsole.push(msg.text());
  });
  page.on('pageerror', (err) => erroriConsole.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Clienti' })).toBeVisible();
  await expect(page.getByText('Nessun cliente.')).toBeVisible();

  await creaCliente(page);
  await aggiungiSistema(page, 'Chatbot HR', 'OpenAI', 'Risposte ai dipendenti');
  await aggiungiSistema(page, 'Scoring CV', 'Acme AI', 'Selezione del personale');
  await page.getByRole('button', { name: 'Conferma inventario' }).click();
  await expect(page.getByText('Prossima azione: Compila il questionario per «Chatbot HR»')).toBeVisible();

  await page.getByRole('link', { name: '← Clienti' }).click();
  const riga = page.getByRole('listitem').filter({ hasText: 'Rossi S.r.l.' });
  await expect(riga.getByText('40%')).toBeVisible();
  await expect(riga.getByText('Compila il questionario per «Chatbot HR»')).toBeVisible();

  expect(erroriConsole).toEqual([]);
});

test('valutazione: screening CV (deployer) → Alto rischio → conferma → roadmap all\'80%', async ({ page }) => {
  const erroriConsole: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') erroriConsole.push(msg.text());
  });
  page.on('pageerror', (err) => erroriConsole.push(err.message));

  await page.goto('/');
  await creaCliente(page);
  await aggiungiSistema(page, 'Screening CV', 'Acme AI', 'Selezione del personale');
  await page.getByRole('button', { name: 'Conferma inventario' }).click();
  await expect(page.getByText('Prossima azione: Compila il questionario per «Screening CV»')).toBeVisible();

  await page.getByRole('link', { name: 'Screening CV' }).click();
  await page.getByRole('button', { name: 'Avvia valutazione' }).click();
  await expect(page.getByRole('heading', { name: 'Valutazione AI Act' })).toBeVisible();

  const vaiAllEsito = page.getByRole('button', { name: "Vai all'esito" });
  // Gruppi visibili senza alcuna risposta selezionata (una risposta può rivelare nuove domande).
  const senzaRisposta = page.locator('fieldset.domanda').filter({ hasNot: page.locator('input[type="radio"]:checked') });
  for (let pagina = 0; pagina < 10; pagina++) {
    // Risponde finché nella sezione non resta nessuna domanda visibile senza risposta.
    for (let giro = 0; giro < 40 && (await senzaRisposta.count()) > 0; giro++) {
      const gruppo = senzaRisposta.first();
      const testo = (await gruppo.locator('legend').textContent()) ?? '';
      // Caso 3: è un sistema di IA (Sì) usato per selezionare personale (Sì); tutto il resto No.
      const si = testo.startsWith('Il sistema è un sistema di IA') || testo.startsWith('Il sistema è usato per selezionare personale');
      // Locator stabile (per nome della domanda): il gruppo esce da «senzaRisposta» appena risposto.
      const nome = await gruppo.locator('input[type="radio"]').first().getAttribute('name');
      const scelta = page.locator(`input[type="radio"][name="${nome}"][value="${si ? 'si' : 'no'}"]`);
      await scelta.check();
      await expect(scelta).toBeChecked();
    }
    await expect(senzaRisposta).toHaveCount(0);
    if (await vaiAllEsito.isVisible()) break;
    await page.getByRole('button', { name: 'Avanti' }).click();
  }
  // Nessuna attesa sul salvataggio: «Vai all'esito» attende da sé i salvataggi in sospeso.
  await expect(vaiAllEsito).toBeVisible();
  await vaiAllEsito.click();

  await expect(page.getByText('Alto rischio', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Conferma classificazione' }).click();
  await expect(page.getByText(/Confermata il/)).toBeVisible();

  await page.getByRole('link', { name: 'AI Act Assessment' }).click();
  const riga = page.getByRole('listitem').filter({ hasText: 'Rossi S.r.l.' });
  await expect(riga.getByText('80%')).toBeVisible();
  await expect(riga.getByText('In attesa della Fase 2b')).toBeVisible();

  expect(erroriConsole).toEqual([]);
});

test('cestino: sposta il cliente nel cestino e lo ripristina', async ({ page }) => {
  await page.goto('/');
  await creaCliente(page);

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Sposta nel cestino' }).click();
  await expect(page.getByText('Nessun cliente.')).toBeVisible();

  await page.getByRole('link', { name: 'Cestino' }).click();
  await expect(page.getByRole('cell', { name: 'Rossi S.r.l.' })).toBeVisible();
  await page.getByRole('button', { name: 'Ripristina' }).click();
  await expect(page.getByText('Il cestino è vuoto.')).toBeVisible();

  await page.getByRole('link', { name: '← Torna ai clienti' }).click();
  await expect(page.getByRole('link', { name: 'Rossi S.r.l.' })).toBeVisible();
});
