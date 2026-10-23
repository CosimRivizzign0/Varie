import { validaCliente } from '../domain/cliente';
import { isScaduto } from '../domain/cestino';
import type { Attivita, Cliente, SistemaAI, TipoAttivita } from '../domain/tipi';
import type { Istruzione, Parametro, SqlDriver } from './driver';
import {
  ErroreNonTrovato,
  ErrorePartitaIvaDuplicata,
  ErroreValidazione,
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

// Sarà usata dai metodi sui sistemi (Task 6).
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

export function creaRepository(driver: SqlDriver, deps: DipendenzeRepository = {}): Repository {
  const ora = deps.ora ?? (() => new Date());
  const nuovoId = deps.nuovoId ?? (() => crypto.randomUUID());

  const attivita = (
    clienteId: string,
    tipo: TipoAttivita,
    descrizione: string,
    quando: string,
  ): Istruzione => ({
    sql: `INSERT INTO attivita (id, cliente_id, sistema_id, tipo, descrizione, quando)
          VALUES (?, ?, NULL, ?, ?, ?)`,
    params: [nuovoId(), clienteId, tipo, descrizione, quando],
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

  const istruzioniCancellaCliente = (id: string): Istruzione[] => [
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
        await driver.batch([{ sql: 'DELETE FROM sistemi WHERE id = ?', params: [id] }]);
      }
    },

    async svuotaCestinoScaduto() {
      const adesso = ora();
      const cestino = await elencaCestino();
      const clientiScaduti = cestino.filter((e) => e.tipo === 'cliente' && isScaduto(e.eliminatoIl, adesso));
      const sistemiScaduti = cestino.filter((e) => e.tipo === 'sistema' && isScaduto(e.eliminatoIl, adesso));
      const istruzioni: Istruzione[] = [];
      for (const c of clientiScaduti) istruzioni.push(...istruzioniCancellaCliente(c.id));
      for (const s of sistemiScaduti) istruzioni.push({ sql: 'DELETE FROM sistemi WHERE id = ?', params: [s.id] });
      const rimossi = clientiScaduti.length + sistemiScaduti.length;
      if (istruzioni.length > 0) await driver.batch(istruzioni);
      return rimossi;
    },
  };
}
