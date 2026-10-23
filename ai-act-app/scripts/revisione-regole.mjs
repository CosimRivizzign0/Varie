// Genera la tabella di revisione del file regole: docs/ai-act-app/revisione-regole.md
// Uso: npm run regole:revisione
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = dirname(fileURLToPath(import.meta.url));
const sorgente = resolve(qui, '../regole/ai-act.json');
const destinazione = resolve(qui, '../../docs/ai-act-app/revisione-regole.md');

const regole = JSON.parse(readFileSync(sorgente, 'utf8'));

const ETICHETTA_RISPOSTA = { si: 'Sì', no: 'No', non_so: 'Non so' };

/** Condizione in forma leggibile, es. «ar3_istruzione = Sì E (der_a = Sì O der_b = Sì)». */
function condizione(c, annidata = false) {
  let testo;
  if ('risposta' in c) return `${c.risposta} = ${ETICHETTA_RISPOSTA[c.uguale]}`;
  if ('tutte' in c) testo = c.tutte.map((x) => condizione(x, true)).join(' E ');
  else if ('almenoUna' in c) testo = c.almenoUna.map((x) => condizione(x, true)).join(' O ');
  else return `NON ${condizione(c.non, true)}`;
  return annidata ? `(${testo})` : testo;
}

/** Testo sicuro in una cella Markdown. */
const cella = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const data = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

const righe = [];
for (const d of regole.domande) {
  const parti = [`**${d.testo}**`];
  if (d.aiuto) parti.push(`Aiuto: ${d.aiuto}`);
  parti.push(`Sezione: ${d.sezione}`);
  if (d.mostraSe) parti.push(`Mostrata se: ${condizione(d.mostraSe)}`);
  righe.push({ id: d.id, tipo: 'Domanda', testo: parti.join('<br>'), rif: d.riferimento, data: null, stato: d.stato });
}
for (const e of regole.esiti) {
  righe.push({
    id: e.id, tipo: 'Esito',
    testo: [`**Classe: ${e.classe}**`, e.motivazione, `Quando: ${condizione(e.quando)}`].join('<br>'),
    rif: e.riferimento, data: e.dataApplicazione, stato: e.stato,
  });
}
for (const t of regole.trasparenza) {
  righe.push({
    id: t.id, tipo: 'Trasparenza',
    testo: [t.motivazione, `Quando: ${condizione(t.quando)}`].join('<br>'),
    rif: t.riferimento, data: null, stato: t.stato,
  });
}
for (const o of regole.obblighi) {
  const parti = [o.testo, `Classi: ${o.classi.join(', ')} · Ruoli: ${o.ruoli.join(', ')}`];
  if (o.soloSeTrasparenza) parti.push('Solo con flag trasparenza');
  if (o.quando) parti.push(`Quando: ${condizione(o.quando)}`);
  righe.push({ id: o.id, tipo: 'Obbligo', testo: parti.join('<br>'), rif: o.riferimento, data: o.dataApplicazione, stato: o.stato });
}

const conta = (chiave, valore) => righe.filter((r) => r[chiave] === valore).length;
const STATI = ['bozza', 'da_verificare', 'validata'];
const TIPI = ['Domanda', 'Esito', 'Trasparenza', 'Obbligo'];

const md = [
  '# Tabella di revisione delle regole AI Act',
  '',
  '<!-- File generato da `npm run regole:revisione` (ai-act-app/scripts/revisione-regole.mjs): non modificare a mano le colonne diverse da «Esito revisione». -->',
  '',
  `- **File:** \`ai-act-app/regole/ai-act.json\``,
  `- **Id:** ${regole.meta.id} · **Versione:** ${regole.meta.versione} · **Redazione:** ${data(regole.meta.dataRedazione)}`,
  `- **Norma:** ${regole.meta.norma}`,
  `- **Ruolo effettivo «fornitore» se:** ${condizione(regole.ruoloFornitoreSe)}`,
  `- **Voci:** ${righe.length} (${TIPI.map((t) => `${t}: ${conta('tipo', t)}`).join(', ')})`,
  `- **Per stato:** ${STATI.map((s) => `${s}: ${conta('stato', s)}`).join(', ')}`,
  '',
  'Compilare la colonna «Esito revisione» con: **OK** (la voce diventa `validata`), **Modifica: …** (testo corretto) oppure **Da verificare: …**.',
  'Gli esiti sono valutati nell\'ordine della tabella: vince il primo la cui condizione è vera; se nessuno lo è, la classe è «minimo».',
  '',
  '| Id | Tipo | Testo | Riferimento | Data | Stato | Esito revisione |',
  '|---|---|---|---|---|---|---|',
  ...righe.map((r) => `| ${r.id} | ${r.tipo} | ${cella(r.testo)} | ${cella(r.rif)} | ${data(r.data)} | ${r.stato} |  |`),
  '',
].join('\n');

mkdirSync(dirname(destinazione), { recursive: true });
writeFileSync(destinazione, md);
console.log(`Tabella di revisione scritta in ${destinazione}: ${righe.length} voci.`);
