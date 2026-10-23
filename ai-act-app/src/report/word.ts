import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import { formattaData } from '../domain/formatoData';
import { AVVISO_CLASSE_MODIFICATA, AVVISO_RUOLO_DA_DEFINIRE } from '../domain/valutazione';
import { ETICHETTE_CLASSE } from '../regole/tipi';
import type { DatiReportSistema } from './dati';

const AVVISO = 'Documento basato su regole non ancora validate dal consulente: verificare prima della consegna.';
const RISERVA =
  'Il presente documento è uno strumento di supporto alla valutazione di conformità al Regolamento (UE) 2024/1689 e non costituisce parere legale definitivo.';

const paragrafo = (testo: string, opzioni: { grassetto?: boolean; dimensione?: number; dopo?: number } = {}) =>
  new Paragraph({
    spacing: { after: opzioni.dopo ?? 80 },
    children: [new TextRun({ text: testo, bold: opzioni.grassetto, size: opzioni.dimensione })],
  });

const titolo = (testo: string) =>
  new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: testo, bold: true, size: 26 })],
  });

/** Riga "Etichetta: valore" con l'etichetta in grassetto. */
const campo = (etichetta: string, valore: string) =>
  new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: `${etichetta}: `, bold: true }), new TextRun({ text: valore })],
  });

const cella = (testo: string, larghezza: number, grassetto = false) =>
  new TableCell({
    width: { size: larghezza, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text: testo, bold: grassetto })] })],
  });

function tabellaObblighi(obblighi: DatiReportSistema['obblighi']): Table {
  const intestazione = new TableRow({
    tableHeader: true,
    children: [cella('Obbligo', 60, true), cella('Riferimento', 25, true), cella('Dal', 15, true)],
  });
  const righe = obblighi.map(
    (o) => new TableRow({ children: [cella(o.testo, 60), cella(o.riferimento, 25), cella(o.dal, 15)] }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [intestazione, ...righe] });
}

export async function creaWord(d: DatiReportSistema): Promise<Uint8Array> {
  const figli: (Paragraph | Table)[] = [];

  // Intestazione dello studio: solo i campi valorizzati
  const righeStudio = [
    d.studio.nome,
    d.studio.indirizzo,
    d.studio.piva ? `P.IVA ${d.studio.piva}` : '',
    d.studio.email,
    d.studio.telefono,
  ].filter((r) => r.trim() !== '');
  righeStudio.forEach((r, i) => figli.push(paragrafo(r, { grassetto: i === 0 && d.studio.nome !== '', dimensione: 20, dopo: 0 })));
  if (righeStudio.length > 0) figli.push(paragrafo('', { dopo: 120 }));

  figli.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: `Valutazione AI Act — ${d.sistema.nome}`, bold: true, size: 36 })],
    }),
    paragrafo(d.cliente.ragioneSociale, { dimensione: 26, dopo: 160 }),
  );

  if (d.regoleNonValidate) {
    const bordo = { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 4 };
    figli.push(
      new Paragraph({
        spacing: { before: 120, after: 160 },
        border: { top: bordo, bottom: bordo, left: bordo, right: bordo },
        children: [new TextRun({ text: AVVISO, bold: true })],
      }),
    );
  }

  figli.push(titolo('Cliente'), campo('Ragione sociale', d.cliente.ragioneSociale), campo('P.IVA', d.cliente.partitaIva));
  figli.push(campo('Settore', d.cliente.settore), campo('Referente', d.cliente.referenteNome));

  figli.push(titolo('Sistema'), campo('Nome', d.sistema.nome), campo('Fornitore', d.sistema.fornitore));
  figli.push(campo("Scopo d'uso", d.sistema.scopo));
  if (d.sistema.reparto) figli.push(campo('Reparto', d.sistema.reparto));
  if (d.sistema.dataAvvio) figli.push(campo('Data di avvio', formattaData(d.sistema.dataAvvio)));
  figli.push(campo('Ruolo del cliente', d.ruoloEtichetta), campo('Ruolo effettivo', d.ruoloEffettivoEtichetta));

  figli.push(titolo('Classificazione'));
  figli.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: ETICHETTE_CLASSE[d.classe], bold: true }),
        ...(d.trasparenza ? [new TextRun({ text: ' + obblighi di trasparenza', bold: true })] : []),
      ],
    }),
  );
  if (d.classeCalcolata) {
    figli.push(paragrafo(`Classe calcolata: ${ETICHETTE_CLASSE[d.classeCalcolata]}`, { dopo: 40 }));
    if (d.notaModifica) figli.push(campo('Motivo della modifica', d.notaModifica));
  }
  if (d.applicabileDal) figli.push(paragrafo(`Applicabile dal ${d.applicabileDal}`));

  figli.push(titolo('Motivazione'));
  for (const m of d.motivazione) {
    figli.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(m.riferimento.trim() ? `${m.testo} — ${m.riferimento}` : m.testo)] }));
  }

  if (d.aperte.length > 0) {
    figli.push(titolo('Punti da approfondire'));
    for (const a of d.aperte) figli.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(a)] }));
  }

  figli.push(titolo('Obblighi'));
  if (d.obblighi.length > 0) {
    figli.push(tabellaObblighi(d.obblighi));
  } else {
    figli.push(paragrafo('Nessun obbligo applicabile per questa classificazione.'));
  }
  // Gli obblighi vengono dalla classe calcolata e, se il ruolo è da definire, da tutti i ruoli.
  if (d.classeCalcolata) figli.push(paragrafo(AVVISO_CLASSE_MODIFICATA, { grassetto: true }));
  if (d.ruoloDaDefinire) figli.push(paragrafo(AVVISO_RUOLO_DA_DEFINIRE, { grassetto: true }));

  figli.push(
    new Paragraph({
      spacing: { before: 360, after: 80 },
      children: [
        new TextRun({ text: `Valutazione confermata il ${d.confermatoIl} · Regole v${d.versioneRegole}${d.norma ? ` · ${d.norma}` : ''}` }),
      ],
    }),
    new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: RISERVA, italics: true, size: 18 })] }),
  );

  const documento = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children: figli }],
  });
  // toBlob funziona sia nel webview sia in Node (toBuffer non è nella build browser)
  const blob = await Packer.toBlob(documento);
  return new Uint8Array(await blob.arrayBuffer());
}
