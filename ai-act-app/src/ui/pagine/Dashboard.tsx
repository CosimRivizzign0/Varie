import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { open, save } from '@tauri-apps/plugin-dialog';
import { ambienteTauri, esportaBackup, ricarica, ripristinaBackup } from '../../archivio/avvio';
import type { Cliente } from '../../domain/tipi';
import { calcolaRoadmap, type Roadmap } from '../../domain/roadmap';
import { normalizzaPartitaIva } from '../../domain/partitaIva';
import { useRepository } from '../RepositoryContext';
import { RoadmapBar } from '../componenti/RoadmapBar';

interface Riga {
  cliente: Cliente;
  roadmap: Roadmap;
}

const TAPPE = ['Anagrafica', 'Inventario', 'Questionario', 'Classificazione', 'Report'] as const;

const FILTRO_DB = [{ name: 'Database', extensions: ['db'] }];

function messaggioDi(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Esporta/Ripristina backup: solo nell'app desktop. */
function MenuBackup() {
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function esegui(azione: () => Promise<void>) {
    if (inCorso) return;
    setInCorso(true);
    setEsito(null);
    setErrore(null);
    try {
      await azione();
    } catch (e) {
      setErrore(messaggioDi(e));
    } finally {
      setInCorso(false);
    }
  }

  const esporta = () =>
    esegui(async () => {
      const dest = await save({ defaultPath: 'ai-act-backup.db', filters: FILTRO_DB });
      if (!dest) return;
      await esportaBackup(dest);
      setEsito('Backup esportato.');
    });

  const ripristina = () =>
    esegui(async () => {
      const sorgente = await open({ multiple: false, directory: false, filters: FILTRO_DB });
      if (!sorgente) return;
      if (!window.confirm('Ripristinare il backup? I dati attuali verranno salvati in un backup prima della sostituzione.')) return;
      await ripristinaBackup(sorgente);
      ricarica();
    });

  return (
    <>
      <button type="button" className="pulsante" disabled={inCorso} onClick={esporta}>Esporta backup</button>
      <button type="button" className="pulsante" disabled={inCorso} onClick={ripristina}>Ripristina backup</button>
      {esito && <p className="esito-backup" role="status">{esito}</p>}
      {errore && <p className="avviso esito-backup" role="alert">{errore}</p>}
    </>
  );
}

export function Dashboard() {
  const repo = useRepository();
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [tappa, setTappa] = useState('');

  useEffect(() => {
    let attivo = true;
    (async () => {
      const clienti = await repo.elencaClienti();
      const oggi = new Date();
      const caricate = await Promise.all(
        clienti.map(async (cliente) => ({
          cliente,
          roadmap: calcolaRoadmap(cliente, await repo.elencaSistemi(cliente.id), oggi),
        })),
      );
      if (attivo) setRighe(caricate);
    })();
    return () => {
      attivo = false;
    };
  }, [repo]);

  const q = ricerca.trim().toLowerCase();
  const qPiva = normalizzaPartitaIva(ricerca.trim());
  const visibili = (righe ?? []).filter(({ cliente, roadmap }) => {
    const okRicerca =
      q === '' ||
      cliente.ragioneSociale.toLowerCase().includes(q) ||
      (qPiva !== '' && cliente.partitaIva.includes(qPiva));
    const okTappa = tappa === '' || roadmap.tappe.some((t) => t.stato === 'in_corso' && t.etichetta === tappa);
    return okRicerca && okTappa;
  });

  return (
    <section>
      <div className="barra-azioni">
        <h1>Clienti</h1>
        <Link className="pulsante pulsante-primario" to="/clienti/nuovo">Nuovo cliente</Link>
        <Link className="pulsante" to="/cestino">Cestino</Link>
        {ambienteTauri() && <MenuBackup />}
      </div>
      <div className="filtri">
        <input
          type="search"
          aria-label="Cerca"
          placeholder="Cerca per ragione sociale o P.IVA"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
        />
        <label>
          Filtra per tappa{' '}
          <select value={tappa} onChange={(e) => setTappa(e.target.value)}>
            <option value="">Tutte</option>
            {TAPPE.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {righe === null ? (
        <p>Caricamento…</p>
      ) : righe.length === 0 ? (
        <p className="vuoto">Nessun cliente. Inizia con «Nuovo cliente».</p>
      ) : visibili.length === 0 ? (
        <p className="vuoto">Nessun cliente corrisponde ai filtri.</p>
      ) : (
        <ul className="elenco-clienti">
          {visibili.map(({ cliente, roadmap }) => (
            <li key={cliente.id} className="riga-cliente">
              <div className="riga-testa">
                <Link to={`/clienti/${cliente.id}`} className="nome-cliente">{cliente.ragioneSociale}</Link>
                {cliente.aiLiteracyDocumentata ? (
                  <span className="badge badge-ok">AI literacy ✓</span>
                ) : (
                  <span className="badge badge-attenzione">AI literacy da documentare</span>
                )}
              </div>
              <RoadmapBar roadmap={roadmap} variante="compatta" />
              <p className="prossima-azione">{roadmap.prossimaAzione}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
