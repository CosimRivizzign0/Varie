import { validaCliente } from '../domain/cliente';
import { validaSistema } from '../domain/sistema';
import { isScaduto } from '../domain/cestino';
import type { Attivita, Cliente, SistemaAI, TipoAttivita } from '../domain/tipi';
import type { ImpostazioniStudio, RegistroReport } from '../domain/report';
import type { Valutazione } from '../domain/valutazione';
import type { EsitoValutazione } from '../regole/motore';
import { ETICHETTE_CLASSE, type Classe, type Risposte } from '../regole/tipi';
import type { Istruzione, Parametro, SqlDriver } from './driver';
import {
  ErroreClienteNelCestino,
  ErroreInventarioVuoto,
  ErroreNonTrovato,
  ErrorePartitaIvaDuplicata,
  ErroreValidazione,
  ErroreValutazioneIncompleta,
} from './errori';

export interface ElementoCestino {
  tipo: 'cliente' | 'sistema';
  id: string;
  nome: string;
  clienteNome: string | null;
  eliminatoIl: string;
}

export interface Repository {
  elencaClienti(): Promise<Cliente[]>;
  getCliente(id: string): Promise<Cliente | null>;
  creaCliente(input: unknown): Promise<Cliente>;
  aggiornaCliente(id: string, input: unknown): Promise<Cliente>;
  eliminaCliente(id: string): Promise<void>;
  ripristinaCliente(id: string): Promise<void>;
  elencaAttivita(clienteId: string): Promise<Attivita[]>;
  elencaCestino(): Promise<ElementoCestino[]>;
  eliminaDefinitivamente(tipo: 'cliente' | 'sistema', id: string): Promise<void>;
  svuotaCestinoScaduto(): Promise<number>;
  elencaSistemi(clienteId: string): Promise<SistemaAI[]>;
  getSistema(id: string): Promise<SistemaAI | null>;
  creaSistema(clienteId: string, input: unknown): Promise<SistemaAI>;
  /**
   * Aggiorna il sistema. Con `ricalcolo` (cambio del ruolo del cliente) salva nello stesso batch anche
   * l'esito ricalcolato della valutazione attiva del sistema, che torna da confermare.
   */
  aggiornaSistema(id: string, input: unknown, ricalcolo?: RicalcoloEsito): Promise<SistemaAI>;
  eliminaSistema(id: string): Promise<void>;
  ripristinaSistema(id: string): Promise<void>;
  confermaInventario(clienteId: string): Promise<void>;
  getValutazioneAttiva(sistemaId: string): Promise<Valutazione | null>;
  elencaValutazioni(sistemaId: string): Promise<Valutazione[]>;
  avviaValutazione(sistemaId: string, versioneRegole: string): Promise<Valutazione>;
  /** Salva risposte ed esito ricalcolato; aggiorna versione_regole alla versione con cui è stato calcolato l'esito. */
  salvaRisposte(id: string, risposte: Risposte, esito: EsitoValutazione, versioneRegole: string): Promise<Valutazione>;
  confermaValutazione(id: string, classe: Classe, nota: string | null): Promise<Valutazione>;
  getImpostazioniStudio(): Promise<ImpostazioniStudio>;
  /** Salva i dati dello studio (valori ripuliti con trim); non registra attività. */
  salvaImpostazioniStudio(i: ImpostazioniStudio): Promise<void>;
  registraReport(r: Omit<RegistroReport, 'id' | 'creatoIl'>): Promise<RegistroReport>;
  /** Report del cliente, il più recente prima. */
  elencaReport(clienteId: string): Promise<RegistroReport[]>;
}

/** Esito ricalcolato della valutazione attiva `valutazioneId` (risposte invariate). */
export interface RicalcoloEsito {
  valutazioneId: string;
  esito: EsitoValutazione;
  versioneRegole: string;
}

export interface DipendenzeRepository {
  ora?: () => Date;
  nuovoId?: () => string;
}

type Riga = Record<string, Parametro>;

function rigaACliente(r: Riga): Cliente {
  return {
    id: r.id as string,
    ragioneSociale: r.ragione_sociale as string,
    partitaIva: r.partita_iva as string,
    settore: r.settore as string,
    referenteNome: r.referente_nome as string,
    referenteEmail: r.referente_email as string | null,
    note: r.note as string | null,
    aiLiteracyDocumentata: r.ai_literacy_documentata === 1,
    aiLiteracyData: r.ai_literacy_data as string | null,
    inventarioConfermato: r.inventario_confermato === 1,
    creatoIl: r.creato_il as string,
    modificatoIl: r.modificato_il as string,
    eliminatoIl: r.eliminato_il as string | null,
  };
}

export function rigaASistema(r: Riga): SistemaAI {
  return {
    id: r.id as string,
    clienteId: r.cliente_id as string,
    nome: r.nome as string,
    fornitore: r.fornitore as string,
    scopo: r.scopo as string,
    ruoloCliente: r.ruolo_cliente as SistemaAI['ruoloCliente'],
    reparto: r.reparto as string | null,
    dataAvvio: r.data_avvio as string | null,
    creatoIl: r.creato_il as string,
    modificatoIl: r.modificato_il as string,
    eliminatoIl: r.eliminato_il as string | null,
  };
}

function rigaAValutazione(r: Riga): Valutazione {
  return {
    id: r.id as string,
    sistemaId: r.sistema_id as string,
    versioneRegole: r.versione_regole as string,
    risposte: JSON.parse(r.risposte as string) as Risposte,
    esito: r.esito === null ? null : (JSON.parse(r.esito as string) as EsitoValutazione),
    stato: r.stato as Valutazione['stato'],
    classeConfermata: r.classe_confermata as Classe | null,
    notaModifica: r.nota_modifica as string | null,
    creatoIl: r.creato_il as string,
    modificatoIl: r.modificato_il as string,
    confermatoIl: r.confermato_il as string | null,
    sostituitaIl: r.sostituita_il as string | null,
  };
}

const CHIAVI_STUDIO: Record<keyof ImpostazioniStudio, string> = {
  nome: 'studio_nome',
  indirizzo: 'studio_indirizzo',
  piva: 'studio_piva',
  email: 'studio_email',
  telefono: 'studio_telefono',
};

function rigaAReport(r: Riga): RegistroReport {
  return {
    id: r.id as string,
    clienteId: r.cliente_id as string,
    sistemaId: r.sistema_id as string | null,
    valutazioneId: r.valutazione_id as string | null,
    tipo: r.tipo as RegistroReport['tipo'],
    nomeFile: r.nome_file as string,
    creatoIl: r.creato_il as string,
  };
}

export function creaRepository(driver: SqlDriver, deps: DipendenzeRepository = {}): Repository {
  const ora = deps.ora ?? (() => new Date());
  const nuovoId = deps.nuovoId ?? (() => crypto.randomUUID());

  const attivita = (
    clienteId: string,
    tipo: TipoAttivita,
    descrizione: string,
    quando: string,
    sistemaId: string | null = null,
  ): Istruzione => ({
    sql: `INSERT INTO attivita (id, cliente_id, sistema_id, tipo, descrizione, quando)
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: [nuovoId(), clienteId, sistemaId, tipo, descrizione, quando],
  });

  async function leggiSistema(id: string): Promise<SistemaAI | null> {
    const righe = await driver.select<Riga>('SELECT * FROM sistemi WHERE id = ?', [id]);
    return righe[0] ? rigaASistema(righe[0]) : null;
  }

  async function sistemaAttivo(id: string): Promise<SistemaAI> {
    const s = await leggiSistema(id);
    if (!s || s.eliminatoIl !== null) throw new ErroreNonTrovato('Sistema non trovato');
    return s;
  }

  function validaSis(input: unknown) {
    const esito = validaSistema(input);
    if (!esito.ok) {
      const errori: Record<string, string> = {};
      for (const [k, v] of Object.entries(esito.errori)) if (v) errori[k] = v;
      throw new ErroreValidazione(errori);
    }
    return esito.valore;
  }

  const azzeraInventario = (clienteId: string): Istruzione => ({
    sql: 'UPDATE clienti SET inventario_confermato = 0 WHERE id = ?',
    params: [clienteId],
  });

  async function leggi(id: string): Promise<Cliente | null> {
    const righe = await driver.select<Riga>('SELECT * FROM clienti WHERE id = ?', [id]);
    return righe[0] ? rigaACliente(righe[0]) : null;
  }

  async function verificaPivaLibera(partitaIva: string, escludiId: string | null) {
    const righe = await driver.select<Riga>(
      'SELECT id FROM clienti WHERE partita_iva = ? AND eliminato_il IS NULL AND id <> ?',
      [partitaIva, escludiId ?? ''],
    );
    if (righe.length > 0) throw new ErrorePartitaIvaDuplicata();
  }

  function valida(input: unknown, adesso: Date) {
    const esito = validaCliente(input, adesso);
    if (!esito.ok) {
      const errori: Record<string, string> = {};
      for (const [k, v] of Object.entries(esito.errori)) if (v) errori[k] = v;
      throw new ErroreValidazione(errori);
    }
    return esito.valore;
  }

  async function attivo(id: string): Promise<Cliente> {
    const c = await leggi(id);
    if (!c || c.eliminatoIl !== null) throw new ErroreNonTrovato('Cliente non trovato');
    return c;
  }

  async function leggiValutazione(id: string): Promise<Valutazione | null> {
    const righe = await driver.select<Riga>('SELECT * FROM valutazioni WHERE id = ?', [id]);
    return righe[0] ? rigaAValutazione(righe[0]) : null;
  }

  // Valutazione attiva (non sostituita) di un sistema non nel cestino, con il sistema.
  async function valutazioneModificabile(id: string): Promise<{ v: Valutazione; s: SistemaAI }> {
    const v = await leggiValutazione(id);
    if (!v || v.sostituitaIl !== null) throw new ErroreNonTrovato('Valutazione non trovata');
    const s = await leggiSistema(v.sistemaId);
    if (!s || s.eliminatoIl !== null) throw new ErroreNonTrovato('Valutazione non trovata');
    return { v, s };
  }

  // Risposte ed esito ricalcolato: la conferma si azzera; attività solo al passaggio a completata.
  function istruzioniRisposte(
    v: Valutazione,
    s: SistemaAI,
    risposte: Risposte,
    esito: EsitoValutazione,
    versioneRegole: string,
    t: string,
  ): Istruzione[] {
    const stato = esito.completo ? 'completata' : 'in_corso';
    const istruzioni: Istruzione[] = [
      {
        sql: `UPDATE valutazioni SET risposte = ?, esito = ?, stato = ?, versione_regole = ?,
                classe_confermata = NULL, nota_modifica = NULL, confermato_il = NULL, modificato_il = ?
              WHERE id = ?`,
        params: [JSON.stringify(risposte), JSON.stringify(esito), stato, versioneRegole, t, v.id],
      },
    ];
    if (v.stato === 'in_corso' && stato === 'completata') {
      istruzioni.push(
        attivita(
          s.clienteId,
          'modificato',
          `Valutazione di «${s.nome}» completata: ${ETICHETTE_CLASSE[esito.classe]}`,
          t,
          s.id,
        ),
      );
    }
    return istruzioni;
  }

  const istruzioniCancellaValutazioniCliente = (id: string): Istruzione => ({
    sql: 'DELETE FROM valutazioni WHERE sistema_id IN (SELECT id FROM sistemi WHERE cliente_id = ?)',
    params: [id],
  });

  const istruzioniCancellaCliente = (id: string): Istruzione[] => [
    { sql: 'DELETE FROM report WHERE cliente_id = ?', params: [id] },
    istruzioniCancellaValutazioniCliente(id),
    { sql: 'DELETE FROM attivita WHERE cliente_id = ?', params: [id] },
    { sql: 'DELETE FROM sistemi WHERE cliente_id = ?', params: [id] },
    { sql: 'DELETE FROM clienti WHERE id = ?', params: [id] },
  ];

  async function elencaCestino(): Promise<ElementoCestino[]> {
    const clienti = await driver.select<Riga>(
      'SELECT id, ragione_sociale, eliminato_il FROM clienti WHERE eliminato_il IS NOT NULL',
    );
    const sistemi = await driver.select<Riga>(
      `SELECT s.id, s.nome, s.eliminato_il, c.ragione_sociale AS cliente_nome
       FROM sistemi s JOIN clienti c ON c.id = s.cliente_id
       WHERE s.eliminato_il IS NOT NULL AND c.eliminato_il IS NULL`,
    );
    const elementi: ElementoCestino[] = [
      ...clienti.map((r) => ({
        tipo: 'cliente' as const,
        id: r.id as string,
        nome: r.ragione_sociale as string,
        clienteNome: null,
        eliminatoIl: r.eliminato_il as string,
      })),
      ...sistemi.map((r) => ({
        tipo: 'sistema' as const,
        id: r.id as string,
        nome: r.nome as string,
        clienteNome: r.cliente_nome as string,
        eliminatoIl: r.eliminato_il as string,
      })),
    ];
    return elementi.sort((a, b) => (a.eliminatoIl < b.eliminatoIl ? 1 : a.eliminatoIl > b.eliminatoIl ? -1 : 0));
  }

  return {
    async elencaClienti() {
      const righe = await driver.select<Riga>(
        'SELECT * FROM clienti WHERE eliminato_il IS NULL ORDER BY ragione_sociale COLLATE NOCASE, id',
      );
      return righe.map(rigaACliente);
    },

    getCliente: leggi,

    async creaCliente(input) {
      const adesso = ora();
      const v = valida(input, adesso);
      await verificaPivaLibera(v.partitaIva, null);
      const t = adesso.toISOString();
      const id = nuovoId();
      await driver.batch([
        {
          sql: `INSERT INTO clienti (id, ragione_sociale, partita_iva, settore, referente_nome,
                  referente_email, note, ai_literacy_data, ai_literacy_documentata,
                  inventario_confermato, creato_il, modificato_il, eliminato_il)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
          params: [
            id, v.ragioneSociale, v.partitaIva, v.settore, v.referenteNome, v.referenteEmail,
            v.note, v.aiLiteracyData, v.aiLiteracyDocumentata ? 1 : 0, t, t,
          ],
        },
        attivita(id, 'creato', 'Cliente creato', t),
      ]);
      return (await leggi(id)) as Cliente;
    },

    async aggiornaCliente(id, input) {
      const adesso = ora();
      await attivo(id);
      const v = valida(input, adesso);
      await verificaPivaLibera(v.partitaIva, id);
      const t = adesso.toISOString();
      await driver.batch([
        {
          sql: `UPDATE clienti SET ragione_sociale = ?, partita_iva = ?, settore = ?,
                  referente_nome = ?, referente_email = ?, note = ?, ai_literacy_data = ?,
                  ai_literacy_documentata = ?, modificato_il = ?
                WHERE id = ?`,
          params: [
            v.ragioneSociale, v.partitaIva, v.settore, v.referenteNome, v.referenteEmail,
            v.note, v.aiLiteracyData, v.aiLiteracyDocumentata ? 1 : 0, t, id,
          ],
        },
        attivita(id, 'modificato', 'Anagrafica modificata', t),
      ]);
      return (await leggi(id)) as Cliente;
    },

    async eliminaCliente(id) {
      await attivo(id);
      const t = ora().toISOString();
      await driver.batch([
        { sql: 'UPDATE clienti SET eliminato_il = ?, modificato_il = ? WHERE id = ?', params: [t, t, id] },
        {
          sql: 'UPDATE sistemi SET eliminato_il = ? WHERE cliente_id = ? AND eliminato_il IS NULL',
          params: [t, id],
        },
        attivita(id, 'eliminato', 'Cliente spostato nel cestino', t),
      ]);
    },

    async ripristinaCliente(id) {
      const c = await leggi(id);
      if (!c || c.eliminatoIl === null) throw new ErroreNonTrovato('Cliente non trovato nel cestino');
      await verificaPivaLibera(c.partitaIva, id);
      const t = ora().toISOString();
      await driver.batch([
        {
          sql: 'UPDATE sistemi SET eliminato_il = NULL WHERE cliente_id = ? AND eliminato_il = ?',
          params: [id, c.eliminatoIl],
        },
        { sql: 'UPDATE clienti SET eliminato_il = NULL, modificato_il = ? WHERE id = ?', params: [t, id] },
        attivita(id, 'ripristinato', 'Cliente ripristinato', t),
      ]);
    },

    async elencaAttivita(clienteId) {
      const righe = await driver.select<Riga>(
        'SELECT * FROM attivita WHERE cliente_id = ? ORDER BY quando DESC, rowid DESC',
        [clienteId],
      );
      return righe.map((r) => ({
        id: r.id as string,
        clienteId: r.cliente_id as string,
        sistemaId: r.sistema_id as string | null,
        tipo: r.tipo as TipoAttivita,
        descrizione: r.descrizione as string,
        quando: r.quando as string,
      }));
    },

    elencaCestino,

    async eliminaDefinitivamente(tipo, id) {
      if (tipo === 'cliente') {
        const c = await leggi(id);
        if (!c || c.eliminatoIl === null) throw new ErroreNonTrovato('Elemento non trovato nel cestino');
        await driver.batch(istruzioniCancellaCliente(id));
      } else {
        const righe = await driver.select<Riga>(
          'SELECT id FROM sistemi WHERE id = ? AND eliminato_il IS NOT NULL',
          [id],
        );
        if (righe.length === 0) throw new ErroreNonTrovato('Elemento non trovato nel cestino');
        await driver.batch([
          { sql: 'DELETE FROM report WHERE sistema_id = ?', params: [id] },
          { sql: 'DELETE FROM valutazioni WHERE sistema_id = ?', params: [id] },
          { sql: 'DELETE FROM sistemi WHERE id = ?', params: [id] },
        ]);
      }
    },

    async svuotaCestinoScaduto() {
      const adesso = ora();
      const cestino = await elencaCestino();
      const clientiScaduti = cestino.filter((e) => e.tipo === 'cliente' && isScaduto(e.eliminatoIl, adesso));
      const sistemiScaduti = cestino.filter((e) => e.tipo === 'sistema' && isScaduto(e.eliminatoIl, adesso));
      const istruzioni: Istruzione[] = [];
      for (const c of clientiScaduti) istruzioni.push(...istruzioniCancellaCliente(c.id));
      for (const s of sistemiScaduti) {
        istruzioni.push({ sql: 'DELETE FROM report WHERE sistema_id = ?', params: [s.id] });
        istruzioni.push({ sql: 'DELETE FROM valutazioni WHERE sistema_id = ?', params: [s.id] });
        istruzioni.push({ sql: 'DELETE FROM sistemi WHERE id = ?', params: [s.id] });
      }
      const rimossi = clientiScaduti.length + sistemiScaduti.length;
      if (istruzioni.length > 0) await driver.batch(istruzioni);
      return rimossi;
    },

    async elencaSistemi(clienteId) {
      const righe = await driver.select<Riga>(
        'SELECT * FROM sistemi WHERE cliente_id = ? AND eliminato_il IS NULL ORDER BY nome COLLATE NOCASE, id',
        [clienteId],
      );
      return righe.map(rigaASistema);
    },

    getSistema: leggiSistema,

    async creaSistema(clienteId, input) {
      await attivo(clienteId);
      const v = validaSis(input);
      const t = ora().toISOString();
      const id = nuovoId();
      await driver.batch([
        {
          sql: `INSERT INTO sistemi (id, cliente_id, nome, fornitore, scopo, ruolo_cliente,
                  reparto, data_avvio, creato_il, modificato_il, eliminato_il)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          params: [id, clienteId, v.nome, v.fornitore, v.scopo, v.ruoloCliente, v.reparto, v.dataAvvio, t, t],
        },
        azzeraInventario(clienteId),
        attivita(clienteId, 'creato', `Sistema "${v.nome}" aggiunto`, t, id),
      ]);
      return (await leggiSistema(id)) as SistemaAI;
    },

    async aggiornaSistema(id, input, ricalcolo) {
      const corrente = await sistemaAttivo(id);
      const v = validaSis(input);
      const t = ora().toISOString();
      let istruzioniValutazione: Istruzione[] = [];
      if (ricalcolo) {
        const { v: val, s } = await valutazioneModificabile(ricalcolo.valutazioneId);
        if (s.id !== id) throw new ErroreNonTrovato('Valutazione non trovata');
        istruzioniValutazione = istruzioniRisposte(val, s, val.risposte, ricalcolo.esito, ricalcolo.versioneRegole, t);
      }
      await driver.batch([
        {
          sql: `UPDATE sistemi SET nome = ?, fornitore = ?, scopo = ?, ruolo_cliente = ?,
                  reparto = ?, data_avvio = ?, modificato_il = ?
                WHERE id = ?`,
          params: [v.nome, v.fornitore, v.scopo, v.ruoloCliente, v.reparto, v.dataAvvio, t, id],
        },
        ...istruzioniValutazione,
        attivita(corrente.clienteId, 'modificato', `Sistema "${v.nome}" modificato`, t, id),
      ]);
      return (await leggiSistema(id)) as SistemaAI;
    },

    async eliminaSistema(id) {
      const s = await sistemaAttivo(id);
      const t = ora().toISOString();
      await driver.batch([
        { sql: 'UPDATE sistemi SET eliminato_il = ? WHERE id = ?', params: [t, id] },
        azzeraInventario(s.clienteId),
        attivita(s.clienteId, 'eliminato', `Sistema "${s.nome}" spostato nel cestino`, t, id),
      ]);
    },

    async ripristinaSistema(id) {
      const s = await leggiSistema(id);
      if (!s || s.eliminatoIl === null) throw new ErroreNonTrovato('Sistema non trovato nel cestino');
      const c = await leggi(s.clienteId);
      if (!c) throw new ErroreNonTrovato('Cliente non trovato');
      if (c.eliminatoIl !== null) throw new ErroreClienteNelCestino();
      const t = ora().toISOString();
      await driver.batch([
        { sql: 'UPDATE sistemi SET eliminato_il = NULL WHERE id = ?', params: [id] },
        azzeraInventario(s.clienteId),
        attivita(s.clienteId, 'ripristinato', `Sistema "${s.nome}" ripristinato`, t, id),
      ]);
    },

    async confermaInventario(clienteId) {
      await attivo(clienteId);
      const righe = await driver.select<Riga>(
        'SELECT COUNT(*) AS n FROM sistemi WHERE cliente_id = ? AND eliminato_il IS NULL',
        [clienteId],
      );
      const conteggio = Number(righe[0]?.n ?? 0);
      if (conteggio === 0) throw new ErroreInventarioVuoto();
      const t = ora().toISOString();
      await driver.batch([
        { sql: 'UPDATE clienti SET inventario_confermato = 1 WHERE id = ?', params: [clienteId] },
        attivita(
          clienteId,
          'inventario_confermato',
          `Inventario confermato (${conteggio === 1 ? '1 sistema' : `${conteggio} sistemi`})`,
          t,
        ),
      ]);
    },

    async getValutazioneAttiva(sistemaId) {
      const righe = await driver.select<Riga>(
        'SELECT * FROM valutazioni WHERE sistema_id = ? AND sostituita_il IS NULL',
        [sistemaId],
      );
      return righe[0] ? rigaAValutazione(righe[0]) : null;
    },

    async elencaValutazioni(sistemaId) {
      const righe = await driver.select<Riga>(
        'SELECT * FROM valutazioni WHERE sistema_id = ? ORDER BY creato_il DESC, rowid DESC',
        [sistemaId],
      );
      return righe.map(rigaAValutazione);
    },

    async avviaValutazione(sistemaId, versioneRegole) {
      const s = await sistemaAttivo(sistemaId);
      const t = ora().toISOString();
      const id = nuovoId();
      await driver.batch([
        {
          sql: 'UPDATE valutazioni SET sostituita_il = ? WHERE sistema_id = ? AND sostituita_il IS NULL',
          params: [t, sistemaId],
        },
        {
          sql: `INSERT INTO valutazioni (id, sistema_id, versione_regole, risposte, esito, stato,
                  classe_confermata, nota_modifica, creato_il, modificato_il, confermato_il, sostituita_il)
                VALUES (?, ?, ?, '{}', NULL, 'in_corso', NULL, NULL, ?, ?, NULL, NULL)`,
          params: [id, sistemaId, versioneRegole, t, t],
        },
        attivita(s.clienteId, 'modificato', `Valutazione di «${s.nome}» avviata`, t, sistemaId),
      ]);
      return (await leggiValutazione(id)) as Valutazione;
    },

    async salvaRisposte(id, risposte, esito, versioneRegole) {
      const { v, s } = await valutazioneModificabile(id);
      await driver.batch(istruzioniRisposte(v, s, risposte, esito, versioneRegole, ora().toISOString()));
      return (await leggiValutazione(id)) as Valutazione;
    },

    async confermaValutazione(id, classe, nota) {
      const { v, s } = await valutazioneModificabile(id);
      if (v.stato === 'in_corso' || v.esito === null) throw new ErroreValutazioneIncompleta();
      const notaPulita = nota?.trim() ? nota.trim() : null;
      const uguale = classe === v.esito.classe;
      if (!uguale && notaPulita === null) {
        throw new ErroreValidazione({ nota: 'Indica il motivo della modifica' });
      }
      const t = ora().toISOString();
      const etichetta = ETICHETTE_CLASSE[classe];
      const descrizione = uguale
        ? `Classificazione di «${s.nome}» confermata: ${etichetta}`
        : `Classificazione di «${s.nome}» modificata: ${etichetta} — ${notaPulita}`;
      await driver.batch([
        {
          sql: `UPDATE valutazioni SET stato = 'confermata', classe_confermata = ?, nota_modifica = ?,
                  confermato_il = ?, modificato_il = ?
                WHERE id = ?`,
          params: [classe, notaPulita, t, t, id],
        },
        attivita(s.clienteId, 'modificato', descrizione, t, s.id),
      ]);
      return (await leggiValutazione(id)) as Valutazione;
    },

    async getImpostazioniStudio() {
      const righe = await driver.select<Riga>('SELECT chiave, valore FROM impostazioni');
      const valori = new Map(righe.map((r) => [r.chiave as string, r.valore as string]));
      const leggi = (k: keyof ImpostazioniStudio) => valori.get(CHIAVI_STUDIO[k]) ?? '';
      return {
        nome: leggi('nome'),
        indirizzo: leggi('indirizzo'),
        piva: leggi('piva'),
        email: leggi('email'),
        telefono: leggi('telefono'),
      };
    },

    async salvaImpostazioniStudio(i) {
      await driver.batch(
        (Object.keys(CHIAVI_STUDIO) as (keyof ImpostazioniStudio)[]).map((k) => ({
          sql: 'INSERT OR REPLACE INTO impostazioni (chiave, valore) VALUES (?, ?)',
          params: [CHIAVI_STUDIO[k], (i[k] ?? '').trim()],
        })),
      );
    },

    async registraReport(r) {
      await attivo(r.clienteId);
      let descrizione = 'Inventario Excel generato';
      if (r.sistemaId !== null) {
        const s = await leggiSistema(r.sistemaId);
        if (!s || s.clienteId !== r.clienteId) throw new ErroreNonTrovato('Sistema non trovato');
        descrizione = `Report Word di «${s.nome}» generato`;
      }
      const t = ora().toISOString();
      const id = nuovoId();
      await driver.batch([
        {
          sql: `INSERT INTO report (id, cliente_id, sistema_id, valutazione_id, tipo, nome_file, creato_il)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [id, r.clienteId, r.sistemaId, r.valutazioneId, r.tipo, r.nomeFile, t],
        },
        attivita(r.clienteId, 'modificato', descrizione, t, r.sistemaId),
      ]);
      return { id, ...r, creatoIl: t };
    },

    async elencaReport(clienteId) {
      const righe = await driver.select<Riga>(
        'SELECT * FROM report WHERE cliente_id = ? ORDER BY creato_il DESC, rowid DESC',
        [clienteId],
      );
      return righe.map(rigaAReport);
    },
  };
}
