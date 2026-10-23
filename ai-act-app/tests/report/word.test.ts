import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Cliente, SistemaAI } from '../../src/domain/tipi';
import type { ImpostazioniStudio } from '../../src/domain/report';
import type { DatiReportSistema } from '../../src/report/dati';
import { creaWord } from '../../src/report/word';

const studioVuoto: ImpostazioniStudio = { nome: '', indirizzo: '', piva: '', email: '', telefono: '' };

function dati(extra: Partial<DatiReportSistema> = {}): DatiReportSistema {
  return {
    studio: { ...studioVuoto, nome: 'Studio Bianchi', piva: 'IT01234567890' },
    cliente: {
      id: 'c1', ragioneSociale: 'Officina Rossi Srl', partitaIva: '12345678901', settore: 'Meccanica',
      referenteNome: 'Mario Rossi',
    } as Cliente,
    sistema: {
      id: 's1', clienteId: 'c1', nome: 'Selezione CV', fornitore: 'Acme', scopo: 'Screening candidati',
      reparto: 'HR', dataAvvio: '2026-03-05', ruoloCliente: 'deployer',
    } as SistemaAI,
    ruoloEtichetta: 'Deployer',
    ruoloEffettivoEtichetta: 'Fornitore',
    classe: 'alto_rischio',
    classeCalcolata: null,
    notaModifica: null,
    trasparenza: true,
    applicabileDal: '02/12/2027',
    motivazione: [{ testo: 'Selezione del personale', riferimento: 'All. III' }],
    aperte: ['Il sistema profila le persone?'],
    obblighi: [
      { testo: 'Registro eventi', riferimento: 'art. 12', dal: '02/08/2026' },
      { testo: 'Sorveglianza umana', riferimento: 'art. 14', dal: '02/12/2027' },
    ],
    regoleNonValidate: false,
    confermatoIl: '23/10/2026',
    versioneRegole: '1.2.0',
    norma: 'Regolamento (UE) 2024/1689',
    ...extra,
  };
}

async function file(d: DatiReportSistema, nome: string): Promise<string> {
  const zip = await JSZip.loadAsync(await creaWord(d));
  return zip.file(nome)!.async('string');
}

async function testo(d: DatiReportSistema): Promise<string> {
  const xml = await file(d, 'word/document.xml');
  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

const AVVISO = 'Documento basato su regole non ancora validate dal consulente: verificare prima della consegna.';
const RISERVA =
  'Il presente documento è uno strumento di supporto alla valutazione di conformità al Regolamento (UE) 2024/1689 e non costituisce parere legale definitivo.';

describe('creaWord', () => {
  it('produce un docx valido con titolo, sottotitolo e dati', async () => {
    const t = await testo(dati());
    expect(t).toContain('Valutazione AI Act — Selezione CV');
    expect(t).toContain('Officina Rossi Srl');
    expect(t).toContain('12345678901');
    expect(t).toContain('Mario Rossi');
    expect(t).toContain('05/03/2026');
    expect(t).toContain('Fornitore');
    expect(t).toContain('Alto rischio');
    expect(t).toContain('+ obblighi di trasparenza');
    expect(t).toContain('Applicabile dal 02/12/2027');
    expect(t).toContain('Selezione del personale');
    expect(t).toContain('All. III');
    expect(t).toContain('Punti da approfondire');
    expect(t).toContain('Il sistema profila le persone?');
  });

  it('mostra l\'avviso solo se le regole non sono validate', async () => {
    expect(await testo(dati({ regoleNonValidate: true }))).toContain(AVVISO);
    expect(await testo(dati({ regoleNonValidate: false }))).not.toContain(AVVISO);
  });

  it('elenca le righe degli obblighi con intestazione', async () => {
    const t = await testo(dati());
    for (const s of ['Obbligo', 'Riferimento', 'Dal', 'Registro eventi', 'art. 12', '02/08/2026', 'Sorveglianza umana', 'art. 14']) {
      expect(t).toContain(s);
    }
  });

  it('chiude con conferma e nota di riserva fissa', async () => {
    const t = await testo(dati());
    expect(t).toContain('Valutazione confermata il 23/10/2026 · Regole v1.2.0 · Regolamento (UE) 2024/1689');
    expect(t).toContain(RISERVA);
  });

  it('Classe calcolata solo se la classe è stata modificata', async () => {
    expect(await testo(dati())).not.toContain('Classe calcolata:');
    const t = await testo(dati({ classe: 'minimo', classeCalcolata: 'alto_rischio', notaModifica: 'Uso solo interno' }));
    expect(t).toContain('Classe calcolata: Alto rischio');
    expect(t).toContain('Uso solo interno');
  });

  it('omette Punti da approfondire se non ce ne sono', async () => {
    expect(await testo(dati({ aperte: [] }))).not.toContain('Punti da approfondire');
  });

  it('senza obblighi mostra il titolo con una riga di cortesia', async () => {
    const t = await testo(dati({ obblighi: [] }));
    expect(t).toContain('Obblighi');
    expect(t).toContain('Nessun obbligo applicabile');
  });

  it('studio vuoto: nessuna intestazione e nessun errore', async () => {
    const t = await testo(dati({ studio: studioVuoto }));
    expect(t).not.toContain('Studio Bianchi');
    expect(t).toContain('Valutazione AI Act — Selezione CV');
  });

  it('studio parziale: solo i campi valorizzati', async () => {
    const t = await testo(dati({ studio: { ...studioVuoto, email: 'info@studio.it' } }));
    expect(t).toContain('info@studio.it');
  });

  it('apostrofi, accenti ed emoji restano identici', async () => {
    const t = await testo(
      dati({
        cliente: { ...dati().cliente, ragioneSociale: "L'Officina ✓" },
        motivazione: [{ testo: 'È un sistema già in uso 🚀', riferimento: 'art. 6' }],
      }),
    );
    expect(t).toContain("L'Officina ✓");
    expect(t).toContain('È un sistema già in uso 🚀');
  });

  it('le sezioni seguono l\'ordine della specifica', async () => {
    const t = await testo(dati());
    const ordine = [
      'Studio Bianchi',
      'Valutazione AI Act — Selezione CV',
      'Cliente\n',
      'Sistema\n',
      'Classificazione\n',
      'Motivazione\n',
      'Punti da approfondire',
      'Obblighi\n',
      'Valutazione confermata il',
      'Il presente documento è uno strumento',
    ];
    const pos = ordine.map((x) => t.indexOf(x));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it('l\'avviso è riquadrato e in grassetto', async () => {
    const xml = await file(dati({ regoleNonValidate: true }), 'word/document.xml');
    const par = xml.split('<w:p>').concat(xml.split('<w:p ')).find((p) => p.includes('Documento basato su regole'))!;
    expect(par).toContain('<w:pBdr>');
    expect(par).toContain('<w:b/>');
  });

  it('il font predefinito è Calibri 11', async () => {
    const xml = await file(dati(), 'word/styles.xml');
    expect(xml).toContain('Calibri');
    expect(xml).toMatch(/<w:docDefaults>[\s\S]*<w:sz w:val="22"\/>[\s\S]*<\/w:docDefaults>/);
  });
});
