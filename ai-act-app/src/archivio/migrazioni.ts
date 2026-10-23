import type { Istruzione, SqlDriver } from './driver';

export const MIGRAZIONI: Istruzione[][] = [
  [
    {
      sql: `CREATE TABLE clienti (
        id TEXT PRIMARY KEY NOT NULL,
        ragione_sociale TEXT NOT NULL,
        partita_iva TEXT NOT NULL,
        settore TEXT NOT NULL,
        referente_nome TEXT NOT NULL,
        referente_email TEXT,
        note TEXT,
        ai_literacy_data TEXT,
        ai_literacy_documentata INTEGER NOT NULL DEFAULT 0,
        inventario_confermato INTEGER NOT NULL DEFAULT 0,
        creato_il TEXT NOT NULL,
        modificato_il TEXT NOT NULL,
        eliminato_il TEXT
      )`,
    },
    {
      sql: `CREATE UNIQUE INDEX ux_clienti_piva_attivi ON clienti(partita_iva) WHERE eliminato_il IS NULL`,
    },
    {
      sql: `CREATE TABLE sistemi (
        id TEXT PRIMARY KEY NOT NULL,
        cliente_id TEXT NOT NULL REFERENCES clienti(id),
        nome TEXT NOT NULL,
        fornitore TEXT NOT NULL,
        scopo TEXT NOT NULL,
        ruolo_cliente TEXT NOT NULL
          CHECK (ruolo_cliente IN ('fornitore','deployer','importatore','distributore','da_definire')),
        reparto TEXT,
        data_avvio TEXT,
        creato_il TEXT NOT NULL,
        modificato_il TEXT NOT NULL,
        eliminato_il TEXT
      )`,
    },
    {
      sql: `CREATE TABLE attivita (
        id TEXT PRIMARY KEY NOT NULL,
        cliente_id TEXT NOT NULL REFERENCES clienti(id),
        sistema_id TEXT,
        tipo TEXT NOT NULL
          CHECK (tipo IN ('creato','modificato','eliminato','ripristinato','inventario_confermato')),
        descrizione TEXT NOT NULL,
        quando TEXT NOT NULL
      )`,
    },
    { sql: `CREATE INDEX ix_attivita_cliente_quando ON attivita(cliente_id, quando)` },
  ],
  [
    {
      sql: `CREATE TABLE valutazioni (
        id TEXT PRIMARY KEY NOT NULL,
        sistema_id TEXT NOT NULL REFERENCES sistemi(id),
        versione_regole TEXT NOT NULL,
        risposte TEXT NOT NULL,
        esito TEXT NULL,
        stato TEXT NOT NULL CHECK (stato IN ('in_corso','completata','confermata')),
        classe_confermata TEXT NULL,
        nota_modifica TEXT NULL,
        creato_il TEXT NOT NULL,
        modificato_il TEXT NOT NULL,
        confermato_il TEXT NULL,
        sostituita_il TEXT NULL
      )`,
    },
    {
      sql: `CREATE UNIQUE INDEX ux_valutazioni_attiva ON valutazioni(sistema_id) WHERE sostituita_il IS NULL`,
    },
  ],
];

export async function migra(driver: SqlDriver): Promise<number> {
  const righe = await driver.select<{ user_version: number }>('PRAGMA user_version');
  const attuale = righe[0]?.user_version ?? 0;
  if (attuale > MIGRAZIONI.length) {
    throw new Error("Il backup proviene da una versione più recente dell'app.");
  }
  for (let n = attuale + 1; n <= MIGRAZIONI.length; n++) {
    // user_version non accetta parametri vincolati; n è un intero interno, non input utente.
    await driver.batch([...MIGRAZIONI[n - 1], { sql: `PRAGMA user_version = ${n}` }]);
  }
  return Math.max(attuale, MIGRAZIONI.length);
}
